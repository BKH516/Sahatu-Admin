
import React, { useMemo } from 'react';
import { createHashRouter, RouterProvider, Navigate, RouteObject } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { useSecurityMonitor } from './hooks/useSecurityMonitor';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import ApprovalsPage from './pages/ApprovalsPage';
import DoctorsPage from './pages/DoctorsPage';
import DoctorDetailsPage from './pages/DoctorDetailsPage';
import HospitalsPage from './pages/HospitalsPage';
import HospitalDetailsPage from './pages/HospitalDetailsPage';
import UsersPage from './pages/UsersPage';
import UserDetailsPage from './pages/UserDetailsPage';
import NursesPage from './pages/NursesPage';
import NurseDetailsPage from './pages/NurseDetailsPage';
import SpecializationsPage from './pages/SpecializationsPage';
import HospitalServicesPage from './pages/HospitalServicesPage';
import EntityRatingsPage from './pages/EntityRatingsPage';
import ProvincesPage from './pages/ProvincesPage';
import NotFoundPage from './pages/NotFoundPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import { SessionTimeout } from './components/security';

const App: React.FC = () => {
  useSecurityMonitor();

  return (
    <AuthProvider>
      <NotificationProvider>
        <AppRoutes />
        <SessionTimeout />
      </NotificationProvider>
    </AuthProvider>
  );
};

const AppRoutes: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  const router = useMemo(() => {
    const baseRoutes: RouteObject[] = [
      {
        path: '/login',
        element: !isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />,
      },
      {
        path: '/unauthorized',
        element: <UnauthorizedPage />,
      },
      {
        path: '/',
        element: isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" replace />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'approvals', element: <ApprovalsPage /> },
          { path: 'doctors', element: <DoctorsPage /> },
          { path: 'doctors/:id', element: <DoctorDetailsPage /> },
          { path: 'nurses', element: <NursesPage /> },
          { path: 'nurses/:id', element: <NurseDetailsPage /> },
          { path: 'hospitals', element: <HospitalsPage /> },
          { path: 'hospitals/:id', element: <HospitalDetailsPage /> },
          { path: 'users', element: <UsersPage /> },
          { path: 'users/:id', element: <UserDetailsPage /> },
          { path: 'specializations', element: <SpecializationsPage /> },
          { path: 'hospital-services', element: <HospitalServicesPage /> },
          { path: 'entity-ratings', element: <EntityRatingsPage /> },
          { path: 'provinces', element: <ProvincesPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ];

    if (!isAuthenticated) {
      baseRoutes.push({
        path: '*',
        element: <Navigate to="/login" replace />,
      });
    }

    return createHashRouter(baseRoutes, {
      future: {
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      },
    });
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return <RouterProvider router={router} />;
};

export default App;
