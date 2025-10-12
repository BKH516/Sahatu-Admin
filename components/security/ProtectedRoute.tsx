import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { logSecurityEvent } from '../../utils/security';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
  requiredRole?: string;
  fallbackPath?: string;
}

/**
 * ProtectedRoute Component
 * يحمي المسارات من الوصول غير المصرح به
 * ويدعم التحكم بالصلاحيات والأدوار
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
  fallbackPath = '/login',
}) => {
  const { isAuthenticated, admin } = useAuth();

  // إذا لم يكن مسجل الدخول
  if (!isAuthenticated || !admin) {
    logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', {
      path: window.location.hash,
      reason: 'Not authenticated',
    });
    return <Navigate to={fallbackPath} replace />;
  }

  // التحقق من الصلاحية المطلوبة
  if (requiredPermission && admin.permissions) {
    const hasPermission = admin.permissions.includes(requiredPermission);
    if (!hasPermission) {
      logSecurityEvent('PERMISSION_DENIED', {
        adminId: admin.id,
        requiredPermission,
        path: window.location.hash,
      });
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // التحقق من الدور المطلوب
  if (requiredRole && admin.role) {
    if (admin.role !== requiredRole) {
      logSecurityEvent('ROLE_ACCESS_DENIED', {
        adminId: admin.id,
        requiredRole,
        currentRole: admin.role,
        path: window.location.hash,
      });
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

