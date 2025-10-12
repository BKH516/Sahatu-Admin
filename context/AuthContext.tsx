import React, { createContext, useState, useContext, ReactNode, useMemo, useEffect } from 'react';
import { Admin } from '../types';
import api from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  admin: Admin | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('sahtee_token');
      if (token) {
        try {
          const adminData = await api.get('/admin/me');
          setAdmin(adminData);
        } catch (error) {
          localStorage.removeItem('sahtee_token');
          setAdmin(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    
    const response = await api.post('/admin/login', formData);
    if (response.access_token) {
      localStorage.setItem('sahtee_token', response.access_token);
      try {
        const adminData = await api.get('/admin/me');
        setAdmin(adminData);
      } catch (e) {
        await logout();
        throw new Error("Could not fetch user details");
      }
    } else {
        throw new Error("Login failed, no token received");
    }
  };
  
  const logout = async () => {
    try {
        await api.post('/admin/logout');
    } catch(error) {
    } finally {
        setAdmin(null);
        localStorage.removeItem('sahtee_token');
    }
  };

  const value = useMemo(() => ({
    isAuthenticated: !!admin,
    admin,
    login,
    logout,
    loading,
  }), [admin, loading]);


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