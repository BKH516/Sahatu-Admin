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
  provinceId?: number; // للفلترة حسب المحافظة
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
      // Only set Content-Type if not already set
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    }
    // Only set Accept if not already set (allows custom Accept headers for file endpoints)
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    
    // إضافة CSRF token من الـ meta tag إذا كان موجود
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }

    // إضافة Province-ID header للفلترة حسب المحافظة
    if (options.provinceId) {
      headers.set('Province-ID', String(options.provinceId));
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

      // التحقق من نوع المحتوى للتعامل مع الملفات (مثل الصور)
      const contentType = response.headers.get('content-type') || '';
      
      // إذا كان الـ endpoint يتوقع ملف (مثل /license)، تحقق من content-type أو محتوى الـ response
      const isFileEndpoint = endpoint.includes('/license') || endpoint.includes('/image') || endpoint.includes('/file');
      
      // للـ file endpoints، نحاول قراءة الـ response كـ blob أولاً للتحقق من نوعه
      if (isFileEndpoint) {
        // قراءة كـ blob مباشرة (أفضل من arrayBuffer لأننا لا نحتاج للتحقق من signature)
        const blob = await response.blob();
        
        if (!response.ok) {
          // إذا كان status غير OK، حاول parse كـ JSON للرسالة
          try {
            const text = await blob.text();
            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
              const errorData = JSON.parse(text);
              const error = new Error(errorData.message || errorData.error || response.statusText || 'An unknown error occurred');
              (error as any).status = response.status;
              throw error;
            }
          } catch (parseError: any) {
            // إذا فشل parse JSON، استخدم رسالة الخطأ الافتراضية
            if (parseError.status) throw parseError; // إذا كان error object، أعد رميه
          }
          const error = new Error(response.statusText || 'An unknown error occurred');
          (error as any).status = response.status;
          throw error;
        }
        
        // إرجاع Blob مباشرة
        return blob;
      }
      
      // إذا كان content-type يشير إلى ملف، أو إذا كان الـ response يبدأ بـ PNG signature
      if (contentType.startsWith('image/') || contentType.startsWith('application/pdf') || contentType.startsWith('application/octet-stream')) {
        // إذا كانت الاستجابة ملف، نعيد Blob
        const blob = await response.blob();
        if (!response.ok) {
          // محاولة قراءة الـ blob كـ text للتحقق من وجود رسالة خطأ JSON
          try {
            const text = await blob.text();
            // إذا كان النص يبدأ بـ { أو [، فهو JSON
            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
              const errorData = JSON.parse(text);
              const errorMsg = errorData.message || errorData.error || response.statusText || 'An unknown error occurred';
              const error = new Error(errorMsg);
              (error as any).status = response.status;
              throw error;
            }
          } catch (parseError) {
            // إذا فشل parse، استخدم رسالة الخطأ الافتراضية
          }
          const errorMsg = response.statusText || 'An unknown error occurred';
          const error = new Error(errorMsg);
          (error as any).status = response.status;
          throw error;
        }
        return blob;
      }

      // قراءة الـ response body كـ text أولاً للتحقق من نوعه
      // (فقط إذا لم يكن endpoint يتوقع ملف - تم التعامل معه أعلاه)
      const responseBody = await response.text();
      
      // التحقق من أن الـ response ليس ملف (PNG, JPEG, etc.) قبل محاولة parse JSON
      // PNG signature: 89 50 4E 47 (hex) = .PNG (ASCII)
      // JPEG signature: FF D8 FF
      let isImageFile = false;
      if (responseBody.length >= 4) {
        const firstByte = responseBody.charCodeAt(0);
        const secondByte = responseBody.charCodeAt(1);
        // PNG: 89 50 4E 47
        isImageFile = (firstByte === 0x89 && responseBody.substring(1, 4) === 'PNG') ||
                     // JPEG: FF D8
                     (firstByte === 0xFF && secondByte === 0xD8);
      }
      
      if (isImageFile && !response.ok) {
        // إذا كان الـ response ملف صورة لكن status غير OK، فهذا خطأ
        const error = new Error('Image file not found or error occurred');
        (error as any).status = response.status;
        throw error;
      }
      
      // محاولة parse JSON فقط إذا لم يكن ملف
      let data: any = {};
      if (responseBody && !isImageFile) {
        try {
          data = JSON.parse(responseBody);
        } catch (parseError) {
          // إذا فشل parse JSON وكان status غير OK، استخدم رسالة الخطأ
          if (!response.ok) {
            const error = new Error(response.statusText || 'Invalid response format');
            (error as any).status = response.status;
            throw error;
          }
          // إذا كان status OK لكن parse فشل، قد يكون response فارغ أو نص عادي
          data = responseBody;
        }
      }

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
        const errorMsg = (typeof data === 'object' && data !== null) 
          ? (data.message || data.error || response.statusText || 'An unknown error occurred')
          : (response.statusText || 'An unknown error occurred');
        
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
        
        // إضافة status code للرسالة لتسهيل التعامل مع 404
        const error = new Error(errorMsg);
        (error as any).status = response.status;
        throw error;
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

  patch(endpoint: string, body?: any, options?: RequestOptions) {
    const sanitizedBody = body ? sanitizePayload(body) : body;
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
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

  // دالة لتحميل رخصة الطبيب من API (الصورة ليست عامة وتتطلب مصادقة)
  async getDoctorLicense(doctorId: number | string): Promise<Blob | null> {
    const endpoint = `/admin/doctor/${doctorId}/license`;
    try {
      const blob = await this.request(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'image/jpeg,image/png,image/*',
        },
      });
      return blob;
    } catch (error: any) {
      // إذا كان الخطأ 404، نعيد null بدلاً من throw
      if (error.status === 404) {
        return null;
      }
      // للأخطاء الأخرى، نرمي الخطأ
      throw error;
    }
  },

  // دالة لتحميل رخصة الممرضة من API (الصورة ليست عامة وتتطلب مصادقة)
  async getNurseLicense(nurseId: number | string): Promise<Blob | null> {
    const endpoint = `/admin/nurse/${nurseId}/license`;
    try {
      const blob = await this.request(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'image/jpeg,image/png,image/*',
        },
      });
      return blob;
    } catch (error: any) {
      // إذا كان الخطأ 404، نعيد null بدلاً من throw
      if (error.status === 404) {
        return null;
      }
      // للأخطاء الأخرى، نرمي الخطأ
      throw error;
    }
  },
};

export default api;
