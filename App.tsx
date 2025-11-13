
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import NursesPage from './pages/NursesPage';
import NurseDetailsPage from './pages/NurseDetailsPage';
import SpecializationsPage from './pages/SpecializationsPage';
import HospitalServicesPage from './pages/HospitalServicesPage';
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route
          path="/"
          element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" replace />}
        >
          <Route index element={<DashboardPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="doctors" element={<DoctorsPage />} />
          <Route path="doctors/:id" element={<DoctorDetailsPage />} />
          <Route path="nurses" element={<NursesPage />} />
          <Route path="nurses/:id" element={<NurseDetailsPage />} />
          <Route path="hospitals" element={<HospitalsPage />} />
          <Route path="hospitals/:id" element={<HospitalDetailsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="specializations" element={<SpecializationsPage />} />
          <Route path="hospital-services" element={<HospitalServicesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        {!isAuthenticated && <Route path="*" element={<Navigate to="/login" replace />} />}
      </Routes>
    </HashRouter>
  );
};

export default App;
