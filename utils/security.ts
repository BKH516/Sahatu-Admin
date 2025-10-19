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

// تنظيف HTML مع السماح ببعض العناصر الآمنة
export const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
};

// التحقق من صحة البريد الإلكتروني
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

// التحقق من قوة كلمة المرور
export const isStrongPassword = (password: string): boolean => {
  // على الأقل 8 أحرف، حرف كبير، حرف صغير، رقم
  const minLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  return minLength && hasUpperCase && hasLowerCase && hasNumber;
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
export const sensitiveActionRateLimiter = new RateLimiter(10, 60000); // 10 إجراءات حساسة في الدقيقة

// CSRF Token Generation
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// التحقق من CSRF Token
export const validateCSRFToken = (token: string, storedToken: string): boolean => {
  return token === storedToken && token.length === 64;
};

// Session Security - التحقق من صحة الجلسة
export const isSessionValid = (lastActivity: number, maxInactivity: number = 1800000): boolean => {
  // maxInactivity default: 30 دقيقة
  return Date.now() - lastActivity < maxInactivity;
};

// تشفير البيانات الحساسة في localStorage (XOR cipher بسيط)
export const encryptData = (data: string, key: string): string => {
  let encrypted = '';
  for (let i = 0; i < data.length; i++) {
    encrypted += String.fromCharCode(
      data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return btoa(encrypted); // Base64 encode
};

export const decryptData = (encryptedData: string, key: string): string => {
  try {
    const decoded = atob(encryptedData);
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
      decrypted += String.fromCharCode(
        decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return decrypted;
  } catch {
    return '';
  }
};

// Content Security Policy Violation Reporter
export const reportCSPViolation = (violation: SecurityPolicyViolationEvent): void => {
  // تم تعطيل console logs - يمكن إرسال للخادم للمراقبة
  // يمكن إرسال التقرير إلى الخادم هنا
  // api.post('/security/csp-violation', { 
  //   blockedURI: violation.blockedURI,
  //   violatedDirective: violation.violatedDirective,
  //   originalPolicy: violation.originalPolicy,
  //   timestamp: new Date().toISOString(),
  // }).catch(() => {});
};

// منع Clickjacking
export const preventClickjacking = (): void => {
  if (window.self !== window.top) {
    // الصفحة محملة في iframe - منعها
    window.top!.location = window.self.location;
  }
};

// تنظيف وإزالة البيانات الحساسة عند إغلاق المتصفح
export const secureCleanup = (): void => {
  // إزالة البيانات الحساسة
  const sensitiveKeys = ['sahtee_token', 'csrf_token', 'session_data'];
  sensitiveKeys.forEach(key => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch (e) {
      // Silent cleanup - no console logs
    }
  });
};

// التحقق من صحة URL لمنع Open Redirect
export const isSafeUrl = (url: string, allowedDomains: string[]): boolean => {
  try {
    const urlObj = new URL(url);
    return allowedDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );
  } catch {
    // URL نسبي أو غير صحيح
    return !url.startsWith('http://') && !url.startsWith('https://');
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

// منع نسخ كلمات المرور
export const preventPasswordCopy = (inputElement: HTMLInputElement): void => {
  inputElement.addEventListener('copy', (e) => {
    e.preventDefault();
    logSecurityEvent('PASSWORD_COPY_ATTEMPT', { field: inputElement.name });
  });
  
  inputElement.addEventListener('cut', (e) => {
    e.preventDefault();
    logSecurityEvent('PASSWORD_CUT_ATTEMPT', { field: inputElement.name });
  });
};

// التحقق من Secure Context (HTTPS)
export const isSecureContext = (): boolean => {
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
  if (!decoded || !decoded.exp) return true;
  
  return Date.now() >= decoded.exp * 1000;
};

// حساب الوقت المتبقي للتوكن بالثواني
export const getTokenTimeRemaining = (token: string): number => {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return 0;
  
  const remaining = decoded.exp * 1000 - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
};

