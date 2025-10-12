import React, { createContext, useState, useContext, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import { Admin } from '../types';
import api from '../services/api';
import {
  generateCSRFToken,
  isSessionValid,
  logSecurityEvent,
  isValidEmail,
  loginRateLimiter,
  preventClickjacking,
  getTokenTimeRemaining,
} from '../utils/security';

interface AuthContextType {
  isAuthenticated: boolean;
  admin: Admin | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  sessionTimeRemaining: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// إعدادات الجلسة
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 دقيقة من عدم النشاط
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // تحديث التوكن كل 5 دقائق
const SESSION_CHECK_INTERVAL = 60 * 1000; // فحص الجلسة كل دقيقة

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);
  const lastActivityRef = useRef<number>(Date.now());
  const activityTimeoutRef = useRef<NodeJS.Timeout>();
  const tokenRefreshIntervalRef = useRef<NodeJS.Timeout>();
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout>();

  // تحديث آخر نشاط
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    localStorage.setItem('sahtee_last_activity', String(Date.now()));
  }, []);

  // تسجيل الخروج التلقائي
  const autoLogout = useCallback(async () => {
    logSecurityEvent('AUTO_LOGOUT', { reason: 'Session timeout' });
    await logout();
    window.location.hash = '#/login';
  }, []);

  // فحص صحة الجلسة
  const checkSession = useCallback(() => {
    const lastActivity = Number(localStorage.getItem('sahtee_last_activity')) || lastActivityRef.current;
    
    if (!isSessionValid(lastActivity, SESSION_TIMEOUT)) {
      autoLogout();
      return false;
    }

    // تحديث الوقت المتبقي
    const remaining = Math.floor((SESSION_TIMEOUT - (Date.now() - lastActivity)) / 1000);
    setSessionTimeRemaining(Math.max(0, remaining));
    
    return true;
  }, [autoLogout]);

  // تحديث التوكن تلقائياً
  const refreshTokenAutomatically = useCallback(async () => {
    const token = localStorage.getItem('sahtee_token');
    if (!token) return;

    const timeRemaining = getTokenTimeRemaining(token);
    
    // إذا كان الوقت المتبقي أقل من 10 دقائق، قم بتحديث التوكن
    if (timeRemaining < 600 && timeRemaining > 0) {
      try {
        await api.refreshToken();
        logSecurityEvent('TOKEN_AUTO_REFRESH', { success: true });
      } catch (error) {
        logSecurityEvent('TOKEN_AUTO_REFRESH_FAILED', { error });
      }
    }
  }, []);

  // مراقبة نشاط المستخدم
  useEffect(() => {
    if (!admin) return;

    const activities = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      updateActivity();
      checkSession();
    };

    activities.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // فحص دوري للجلسة
    sessionCheckIntervalRef.current = setInterval(() => {
      if (!checkSession()) {
        clearInterval(sessionCheckIntervalRef.current);
      }
    }, SESSION_CHECK_INTERVAL);

    // تحديث دوري للتوكن
    tokenRefreshIntervalRef.current = setInterval(refreshTokenAutomatically, TOKEN_REFRESH_INTERVAL);

    return () => {
      activities.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      if (tokenRefreshIntervalRef.current) {
        clearInterval(tokenRefreshIntervalRef.current);
      }
    };
  }, [admin, updateActivity, checkSession, refreshTokenAutomatically]);

  // حماية من Clickjacking
  useEffect(() => {
    preventClickjacking();
  }, []);

  // إنشاء CSRF Token عند تحميل التطبيق
  useEffect(() => {
    if (!localStorage.getItem('csrf_token')) {
      const csrfToken = generateCSRFToken();
      localStorage.setItem('csrf_token', csrfToken);
      
      // إضافة meta tag للـ CSRF token
      const metaTag = document.createElement('meta');
      metaTag.name = 'csrf-token';
      metaTag.content = csrfToken;
      document.head.appendChild(metaTag);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('sahtee_token');
      if (token) {
        try {
          const adminData = await api.get('/admin/me');
          setAdmin(adminData);
          updateActivity();
          logSecurityEvent('AUTH_CHECK_SUCCESS', { adminId: adminData.id });
        } catch (error) {
          localStorage.removeItem('sahtee_token');
          setAdmin(null);
          logSecurityEvent('AUTH_CHECK_FAILED', { error });
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [updateActivity]);

  const login = async (email: string, password: string) => {
    // التحقق من صحة البريد الإلكتروني
    if (!isValidEmail(email)) {
      logSecurityEvent('INVALID_EMAIL_LOGIN_ATTEMPT', { email });
      throw new Error('صيغة البريد الإلكتروني غير صحيحة');
    }

    // Rate limiting لمحاولات تسجيل الدخول
    if (!loginRateLimiter.canMakeRequest(email)) {
      const remaining = loginRateLimiter.getRemainingRequests(email);
      logSecurityEvent('LOGIN_RATE_LIMIT_EXCEEDED', { email, remaining });
      throw new Error('محاولات تسجيل دخول كثيرة. يرجى المحاولة بعد 5 دقائق.');
    }

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    
    try {
      const response = await api.post('/admin/login', formData, { 
        skipAuth: true,
        skipRateLimit: true
      });
      
      if (!response.access_token) {
        logSecurityEvent('LOGIN_FAILED_NO_TOKEN', { email });
        throw new Error("فشل تسجيل الدخول، لم يتم استلام التوكن");
      }

      // حفظ التوكن
      localStorage.setItem('sahtee_token', response.access_token);
      updateActivity();
      
      // الانتظار قليلاً للتأكد من حفظ التوكن
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // التحقق من أن التوكن محفوظ فعلاً
      const savedToken = localStorage.getItem('sahtee_token');
      if (!savedToken || savedToken !== response.access_token) {
        throw new Error('فشل في حفظ التوكن');
      }
      
      try {
        // الحصول على بيانات المستخدم باستخدام التوكن الجديد
        console.log('Fetching admin data with token:', savedToken.substring(0, 20) + '...');
        
        const adminData = await api.get('/admin/me', {
          skipRateLimit: true
        });
        
        if (!adminData || !adminData.id) {
          throw new Error('بيانات المستخدم غير صحيحة');
        }
        
        setAdmin(adminData);
        
        // إعادة تعيين rate limiter بعد تسجيل دخول ناجح
        loginRateLimiter.reset(email);
        
        logSecurityEvent('LOGIN_SUCCESS', { 
          adminId: adminData.id, 
          email: adminData.email 
        });
      } catch (e: any) {
        // حذف التوكن إذا فشل الحصول على بيانات المستخدم
        localStorage.removeItem('sahtee_token');
        console.error('Failed to fetch admin data:', e);
        console.error('Token that was used:', savedToken.substring(0, 20) + '...');
        throw new Error("فشل في الحصول على بيانات المستخدم: " + (e.message || 'خطأ غير معروف'));
      }
    } catch (error: any) {
      // لا نسجل خطأ تسجيل الدخول مرتين إذا كان قد تم تسجيله بالفعل
      if (!error.message.includes('محاولات') && !error.message.includes('صيغة') && !error.message.includes('استلام')) {
        logSecurityEvent('LOGIN_FAILED', { email, error: error.message });
      }
      throw error;
    }
  };
  
  const logout = async () => {
    try {
      // محاولة إبلاغ الخادم بتسجيل الخروج (لكن لا نفشل إذا لم ينجح)
      const token = localStorage.getItem('sahtee_token');
      if (token) {
        await api.post('/admin/logout').catch(() => {
          // نتجاهل الأخطاء في تسجيل الخروج من الخادم
        });
      }
      logSecurityEvent('LOGOUT_SUCCESS', { adminId: admin?.id });
    } catch(error) {
      // لا نسجل خطأ إذا لم يكن هناك توكن أصلاً
      if (localStorage.getItem('sahtee_token')) {
        logSecurityEvent('LOGOUT_ERROR', { error });
      }
    } finally {
      setAdmin(null);
      localStorage.removeItem('sahtee_token');
      localStorage.removeItem('sahtee_last_activity');
      
      // تنظيف الـ intervals
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      if (tokenRefreshIntervalRef.current) {
        clearInterval(tokenRefreshIntervalRef.current);
      }
    }
  };

  const value = useMemo(() => ({
    isAuthenticated: !!admin,
    admin,
    login,
    logout,
    loading,
    sessionTimeRemaining,
  }), [admin, loading, sessionTimeRemaining]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};