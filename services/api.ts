import { 
  apiRateLimiter, 
  isValidJWT, 
  isTokenExpired,
  logSecurityEvent,
  sanitizeInput,
  sanitizePayload,
} from '../utils/security';
import { secureStorage } from '../utils/secureStorage';

// Use relative URL in development (will be proxied), absolute URL in production
const API_BASE_URL = import.meta.env.DEV ? '/api' : 'https://sahtee.evra-co.com/api';

// إعدادات الأمان
const REQUEST_TIMEOUT = 30000; // 30 ثانية
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 ثانية

const TOKEN_STORAGE_KEY = 'auth_token';

// دالة لتأخير التنفيذ (للـ retry)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// التحقق من صحة التوكن قبل كل طلب
interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipRateLimit?: boolean;
  retryCount?: number;
}

const api = {
  // متغير لتتبع محاولة تحديث التوكن
  isRefreshing: false,
  refreshSubscribers: [] as ((token: string) => void)[],

  // إضافة مشتركين لانتظار تحديث التوكن
  subscribeTokenRefresh(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  },

  // إشعار المشتركين بالتوكن الجديد
  onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  },

  // تحديث التوكن
  async refreshToken(): Promise<string | null> {
    try {
      const existingToken = await secureStorage.getItem(TOKEN_STORAGE_KEY);
      if (!existingToken) {
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/admin/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${existingToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Token refresh failed');

      const data = await response.json();
      if (data.access_token) {
        await secureStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
        return data.access_token;
      }
      return null;
    } catch (error) {
      secureStorage.removeItem(TOKEN_STORAGE_KEY);
      logSecurityEvent('TOKEN_REFRESH_FAILED', { error });
      window.location.hash = '#/login';
      return null;
    }
  },

  // دالة الطلب الرئيسية مع حماية متقدمة
  async request(endpoint: string, options: RequestOptions = {}): Promise<any> {
    const {
      skipAuth = false,
      skipRateLimit = false,
      retryCount = 0,
      ...fetchOptions
    } = options;

    // Rate Limiting
    if (!skipRateLimit && !apiRateLimiter.canMakeRequest('api')) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', { endpoint });
      throw new Error('Too many requests. Please try again later.');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    
    // الحصول على التوكن
    let token: string | null = null;
    if (!skipAuth) {
      token = await secureStorage.getItem(TOKEN_STORAGE_KEY);
    }
    
    // التحقق من التوكن للطلبات المحمية
    if (!skipAuth) {
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // التحقق من صحة التوكن (بدون حذفه)
      if (!isValidJWT(token)) {
        logSecurityEvent('INVALID_JWT_TOKEN', { action: 'Token validation failed', endpoint });
        secureStorage.removeItem(TOKEN_STORAGE_KEY);
        throw new Error('Invalid authentication token');
      }

      if (isTokenExpired(token)) {
        logSecurityEvent('EXPIRED_TOKEN', { action: 'Token expired', endpoint, strategy: 'preflight-refresh' });
        const refreshedToken = await this.refreshToken();
        if (refreshedToken) {
          token = refreshedToken;
        } else {
          secureStorage.removeItem(TOKEN_STORAGE_KEY);
          throw new Error('Authentication token expired');
        }
      }
      
      // التحقق من انتهاء الصلاحية (نسمح بإرسال التوكن، الخادم سيقرر)
      // الكود سيقوم تلقائياً بتحديث التوكن عند استلام 401 من الخادم
    }
    
    const headers = new Headers(fetchOptions.headers || {});
    if (token && !skipAuth) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!(fetchOptions.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');
    
    // إضافة CSRF token من الـ meta tag إذا كان موجود
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }

    // Timeout للطلب
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const config: RequestInit = {
      ...fetchOptions,
      headers,
      signal: controller.signal,
      credentials: 'same-origin', // حماية من CSRF
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      const responseBody = await response.text();
      const data = responseBody ? JSON.parse(responseBody) : {};

      // معالجة حالة انتهاء صلاحية التوكن
      if (response.status === 401 && !skipAuth) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          const newToken = await this.refreshToken();
          this.isRefreshing = false;

          if (newToken) {
            this.onTokenRefreshed(newToken);
            return this.request(endpoint, options);
          }
        } else {
          // انتظار تحديث التوكن من طلب آخر
          return new Promise((resolve) => {
            this.subscribeTokenRefresh((token: string) => {
              resolve(this.request(endpoint, options));
            });
          });
        }
      }

      if (!response.ok) {
        const errorMsg = data.message || data.error || response.statusText || 'An unknown error occurred';
        
        // تسجيل الأخطاء الأمنية (إلا إذا كان skipAuth)
        if (response.status === 403 && !skipAuth) {
          logSecurityEvent('FORBIDDEN_ACCESS', { 
            endpoint, 
            status: response.status,
            hasToken: !!token,
            details: errorMsg
          });
        } else if (response.status >= 500) {
          logSecurityEvent('SERVER_ERROR', { endpoint, status: response.status });
        }
        
        throw new Error(errorMsg);
      }
      
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Retry logic للأخطاء المؤقتة
      if (retryCount < MAX_RETRIES && (
        error.name === 'AbortError' ||
        error.message.includes('network') ||
        error.message.includes('fetch')
      )) {
        await delay(RETRY_DELAY * (retryCount + 1));
        return this.request(endpoint, { ...options, retryCount: retryCount + 1 });
      }

      // تسجيل الأخطاء
      logSecurityEvent('API_REQUEST_FAILED', {
        endpoint,
        error: error.message,
        retryCount
      });

      throw error;
    }
  },

  get(endpoint: string, options?: RequestOptions) {
    return this.request(endpoint, { 
      ...options, 
      method: 'GET',
      cache: 'no-cache' as RequestCache
    });
  },

  post(endpoint: string, body?: any, options?: RequestOptions) {
    if (body instanceof FormData) {
      const sanitizedFormData = new FormData();
      body.forEach((value, key) => {
        if (typeof value === 'string') {
          sanitizedFormData.append(key, sanitizeInput(value));
        } else {
          sanitizedFormData.append(key, value);
        }
      });

      return this.request(endpoint, {
        ...options,
        method: 'POST',
        body: sanitizedFormData,
      });
    }

    const sanitizedBody = body ? sanitizePayload(body) : body;
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: sanitizedBody !== undefined ? JSON.stringify(sanitizedBody) : undefined,
    });
  },
  
  put(endpoint: string, body?: any, options?: RequestOptions) {
    const sanitizedBody = body ? sanitizePayload(body) : body;
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: sanitizedBody !== undefined ? JSON.stringify(sanitizedBody) : undefined,
    });
  },

  delete(endpoint: string, options?: RequestOptions) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  },

  // دالة لتحميل الملفات بشكل آمن
  async uploadFile(endpoint: string, file: File, additionalData?: Record<string, string>) {
    // التحقق من نوع وحجم الملف
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

    if (file.size > maxSize) {
      throw new Error('File size exceeds 10MB limit');
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error('File type not allowed');
    }

    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, sanitizeInput(value));
      });
    }

    return this.post(endpoint, formData);
  },
};

export default api;
