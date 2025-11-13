import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { logSecurityEvent } from '../../utils/security';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requiredPermissions?: string[];
  fallbackPath?: string;
}

const LoadingScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-slate-200 gap-4">
    <div className="relative">
      <div className="h-16 w-16 rounded-full border-4 border-slate-700"></div>
      <div className="absolute inset-0 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
    </div>
    <p className="text-sm font-medium tracking-wide text-slate-400">جارٍ التحقق من صلاحيات الوصول...</p>
  </div>
);

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermissions,
  fallbackPath = '/unauthorized',
}) => {
  const { isAuthenticated, admin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !admin) {
    logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', {
      path: location.pathname,
      reason: !admin ? 'No admin data' : 'Not authenticated',
      timestamp: new Date().toISOString(),
    });
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requiredRole && admin.role !== requiredRole) {
    logSecurityEvent('ROLE_ACCESS_DENIED', {
      adminId: admin.id,
      currentRole: admin.role,
      requiredRole,
      path: location.pathname,
      timestamp: new Date().toISOString(),
    });
    return <Navigate to={fallbackPath} replace />;
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    const missingPermission = requiredPermissions.find(
      (permission) => !admin.permissions?.includes(permission)
    );

    if (missingPermission) {
      logSecurityEvent('PERMISSION_DENIED', {
        adminId: admin.id,
        requiredPermission: missingPermission,
        path: location.pathname,
        timestamp: new Date().toISOString(),
      });
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;


