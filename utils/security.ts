/**
 * Security Utilities
 * مجموعة من الدوال للحماية من الاختراقات
 */

// XSS Protection - تنظيف المدخلات من أكواد خطيرة
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  return input
    .replace(/[<>]/g, '') // إزالة HTML tags
    .replace(/javascript:/gi, '') // منع JavaScript injection
    .replace(/on\w+\s*=/gi, '') // منع event handlers
    .trim();
};

// تنظيف البيانات قبل إرسالها إلى الخادم
export const sanitizePayload = <T>(payload: T): T => {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === 'string') {
    return sanitizeInput(payload) as T;
  }

  if (Array.isArray(payload)) {
    return payload.map(item => sanitizePayload(item)) as T;
  }

  if (typeof payload === 'object') {
    const sanitizedObject: Record<string | number | symbol, unknown> = {};
    Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
      sanitizedObject[key] = sanitizePayload(value);
    });
    return sanitizedObject as T;
  }

  return payload;
};

// التحقق من صحة البريد الإلكتروني
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

// Rate Limiting - منع الطلبات الزائدة
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private timeWindow: number; // بالميلي ثانية

  constructor(maxRequests: number = 100, timeWindow: number = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
  }

  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    
    // إزالة الطلبات القديمة
    const recentRequests = userRequests.filter(
      timestamp => now - timestamp < this.timeWindow
    );
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    return true;
  }

  reset(key: string): void {
    this.requests.delete(key);
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    const recentRequests = userRequests.filter(
      timestamp => now - timestamp < this.timeWindow
    );
    return Math.max(0, this.maxRequests - recentRequests.length);
  }
}

// Rate limiters لأنواع مختلفة من الطلبات
export const apiRateLimiter = new RateLimiter(100, 60000); // 100 طلب في الدقيقة
export const loginRateLimiter = new RateLimiter(5, 300000); // 5 محاولات تسجيل دخول في 5 دقائق

// CSRF Token Generation
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Session Security - التحقق من صحة الجلسة
export const isSessionValid = (lastActivity: number, maxInactivity: number = 1800000): boolean => {
  // maxInactivity default: 30 دقيقة
  return Date.now() - lastActivity < maxInactivity;
};

// منع Clickjacking
export const preventClickjacking = (): void => {
  if (window.self !== window.top) {
    // الصفحة محملة في iframe - منعها
    window.top!.location = window.self.location;
  }
};

// تسجيل الأنشطة الأمنية المشبوهة
export const logSecurityEvent = (event: string, details: any): void => {
  // تم تعطيل console logs للحفاظ على نظافة Console
  // يمكن إرسال الأحداث للخادم للمراقبة إذا لزم الأمر
  
  // const securityLog = {
  //   event,
  //   details,
  //   timestamp: new Date().toISOString(),
  //   userAgent: navigator.userAgent,
  //   url: window.location.href,
  // };
  
  // إرسال للخادم في الإنتاج فقط (اختياري)
  // if (import.meta.env.PROD) {
  //   api.post('/security/log', securityLog).catch(() => {});
  // }
};

export const isSecureContext = (): boolean => {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.isSecureContext;
};

// التحقق من صحة JWT Token (بدون فك التشفير الكامل)
export const isValidJWT = (token: string): boolean => {
  if (!token) return false;
  
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  try {
    // التحقق من أن كل جزء base64 صحيح
    parts.forEach(part => atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return true;
  } catch {
    return false;
  }
};

// فك تشفير JWT Payload (بدون التحقق من التوقيع - للاستخدام في Frontend فقط)
export const decodeJWT = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

// التحقق من انتهاء صلاحية JWT Token
export const isTokenExpired = (token: string): boolean => {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) {
    logSecurityEvent('TOKEN_EXPIRY_UNDETERMINED', {
      hasPayload: !!decoded,
      hasExpiration: !!decoded?.exp,
    });
    return false;
  }
  
  return Date.now() >= decoded.exp * 1000;
};

// حساب الوقت المتبقي للتوكن بالثواني
export const getTokenTimeRemaining = (token: string): number => {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return 0;
  
  const remaining = decoded.exp * 1000 - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
};

