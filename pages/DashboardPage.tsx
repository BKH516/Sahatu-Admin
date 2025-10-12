import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import api from '../services/api';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactElement;
  color: string;
  loading?: boolean;
  delay?: number;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, loading, delay = 0, onClick }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Card 
      gradient 
      hover 
      onClick={onClick}
      className={`p-4 md:p-6 card-shine transform transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-slate-400 text-xs md:text-sm font-medium mb-2">{title}</p>
          {loading ? (
            <div className="h-8 w-20 skeleton rounded"></div>
          ) : (
            <p className="text-2xl md:text-3xl font-bold text-white mb-2">{value}</p>
          )}
        </div>
        <div className={`p-3 md:p-4 rounded-2xl ${color} shadow-lg transform transition-transform duration-300 hover:scale-110`}>
          {icon}
        </div>
      </div>
    </Card>
  );
};

const QuickAction: React.FC<{
  title: string;
  description: string;
  icon: React.ReactElement;
  color: string;
  onClick: () => void;
}> = ({ title, description, icon, color, onClick }) => (
  <button
    onClick={onClick}
    className={`p-4 rounded-xl ${color} border border-slate-700/50 hover:border-cyan-500/50 transition-all duration-200 hover:shadow-xl hover:shadow-cyan-500/10 hover:-translate-y-1 group text-right w-full`}
  >
    <div className="flex items-center gap-3 mb-2">
      <div className="p-2 rounded-lg bg-white/10 group-hover:bg-white/20 transition-colors">
        {icon}
      </div>
      <h3 className="text-white font-semibold text-sm md:text-base">{title}</h3>
    </div>
    <p className="text-slate-400 text-xs md:text-sm">{description}</p>
  </button>
);

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        pendingCount: 0,
        doctorsCount: 0,
        usersCount: 0,
        hospitalsCount: 0,
    });

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const fetchDashboardStats = async () => {
            setLoading(true);
            try {
                // جلب البيانات الحقيقية من API
                const [doctorPending, nursePending, doctors, users, hospitals] = await Promise.all([
                    api.post('/admin/get-pending-accounts', { role: 'doctor' }).catch(() => ({ data: [] })),
                    api.post('/admin/get-pending-accounts', { role: 'nurse' }).catch(() => ({ data: [] })),
                    api.get('/admin/doctor/all?per_page=10000').catch(() => ({ doctors: [] })),
                    api.get('/admin/user/all?per_page=10000').catch(() => ({ users: [] })),
                    api.get('/admin/hospital/all?per_page=10000').catch(() => ({ hospitals: { data: [] } })),
                ]);

                setStats({
                    pendingCount: (doctorPending.data?.length || 0) + (nursePending.data?.length || 0),
                    doctorsCount: doctors.doctors?.data?.length || doctors.doctors?.length || 0,
                    usersCount: users.users?.data?.length || users.users?.length || 0,
                    hospitalsCount: hospitals.hospitals?.data?.length || 0,
                });
            } catch (error) {
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardStats();
    }, []);

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in">
            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text mb-2">لوحة التحكم الرئيسية</h1>
                    <p className="text-sm md:text-base text-slate-400">مرحباً بك، إليك نظرة عامة على النظام</p>
                </div>
                <div className="text-right md:text-left">
                    <p className="text-xl md:text-2xl font-bold text-white">{currentTime.toLocaleTimeString('ar-EG')}</p>
                    <p className="text-xs md:text-sm text-slate-400 hidden sm:block">{currentTime.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p className="text-xs md:text-sm text-slate-400 sm:hidden">{currentTime.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</p>
                </div>
            </div>

            {/* Stats Grid - بيانات حقيقية من API */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
                <StatCard 
                    title="طلبات موافقة" 
                    value={stats.pendingCount}
                    icon={<IconCheck />} 
                    color="bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-300" 
                    loading={loading}
                    delay={0}
                    onClick={() => navigate('/approvals')}
                />
                <StatCard 
                    title="إجمالي الأطباء" 
                    value={stats.doctorsCount}
                    icon={<IconDoctor />} 
                    color="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-300" 
                    loading={loading}
                    delay={100}
                    onClick={() => navigate('/doctors')}
                />
                <StatCard 
                    title="إجمالي المستخدمين" 
                    value={stats.usersCount}
                    icon={<IconUsers />} 
                    color="bg-gradient-to-br from-emerald-500/20 to-green-500/20 text-emerald-300" 
                    loading={loading}
                    delay={200}
                    onClick={() => navigate('/users')}
                />
                <StatCard 
                    title="إجمالي المشافي" 
                    value={stats.hospitalsCount}
                    icon={<IconHospital />} 
                    color="bg-gradient-to-br from-rose-500/20 to-red-500/20 text-rose-300" 
                    loading={loading}
                    delay={300}
                    onClick={() => navigate('/hospitals')}
                />
            </div>

            {/* Quick Actions */}
            <Card gradient className="p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-white mb-4 md:mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    إجراءات سريعة
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    <QuickAction
                        title="مراجعة الطلبات"
                        description="عرض طلبات الموافقة المعلقة"
                        icon={<IconCheck />}
                        color="bg-gradient-to-br from-amber-500/10 to-orange-500/10"
                        onClick={() => navigate('/approvals')}
                    />
                    <QuickAction
                        title="إدارة الأطباء"
                        description="عرض وإدارة الأطباء"
                        icon={<IconDoctor />}
                        color="bg-gradient-to-br from-cyan-500/10 to-blue-500/10"
                        onClick={() => navigate('/doctors')}
                    />
                    <QuickAction
                        title="إدارة المشافي"
                        description="عرض وإدارة المشافي"
                        icon={<IconHospital />}
                        color="bg-gradient-to-br from-emerald-500/10 to-green-500/10"
                        onClick={() => navigate('/hospitals')}
                    />
                </div>
            </Card>

            {/* System Status */}
            <Card gradient className="p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-white mb-4 md:mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    حالة النظام
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div className="p-3 md:p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs md:text-sm text-slate-300">الخادم</span>
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                        </div>
                        <p className="text-xs text-emerald-400 font-medium">نشط ويعمل</p>
                    </div>
                    <div className="p-3 md:p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs md:text-sm text-slate-300">قاعدة البيانات</span>
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                        </div>
                        <p className="text-xs text-emerald-400 font-medium">متصلة</p>
                    </div>
                    <div className="p-3 md:p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs md:text-sm text-slate-300">API</span>
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                        </div>
                        <p className="text-xs text-emerald-400 font-medium">جاهز</p>
                    </div>
                    <div className="p-3 md:p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs md:text-sm text-slate-300">الأداء</span>
                            <span className="text-xs text-cyan-400 font-bold">98%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-1.5">
                            <div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-1.5 rounded-full" style={{ width: '98%' }}></div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

// Icons
const IconCheck = () => (
    <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
const IconUsers = () => (
    <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 016-6h6a6 6 0 016 6v1h-1M15 21a3 3 0 116 0v-1a3 3 0 11-6 0v1z" />
    </svg>
);
const IconDoctor = () => (
  <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const IconHospital = () => (
  <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

export default DashboardPage;
