import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Doctor, DoctorReservation } from '../types';
import api from '../services/api';

const DoctorDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [doctor, setDoctor] = useState<Doctor | null>(null);
    const [reservations, setReservations] = useState<DoctorReservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [reservationsLoading, setReservationsLoading] = useState(true);
    
    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [fromDate, setFromDate] = useState<string>('');
    const [toDate, setToDate] = useState<string>('');
    
    // Stats
    const [stats, setStats] = useState({
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
        completed: 0,
        total: 0
    });

    useEffect(() => {
        fetchDoctorDetails();
    }, [id]);

    useEffect(() => {
        if (id) {
            fetchReservations();
        }
    }, [id, statusFilter, fromDate, toDate]);

    const fetchDoctorDetails = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/admin/doctor/${id}`);
            setDoctor(response.doctor || response);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const fetchReservations = async () => {
        setReservationsLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);
            if (fromDate) params.append('from', fromDate);
            if (toDate) params.append('to', toDate);
            
            const response = await api.get(`/admin/doctor/${id}/reservations?${params.toString()}`);
            
            const reservationsData = response.data || response.reservations || response;
            
            setReservations(Array.isArray(reservationsData) ? reservationsData : []);
            
            // Calculate stats
            calculateStats(reservationsData);
        } catch (error) {
            setReservations([]);
        } finally {
            setReservationsLoading(false);
        }
    };

    const calculateStats = (data: DoctorReservation[]) => {
        const newStats = {
            pending: 0,
            approved: 0,
            rejected: 0,
            cancelled: 0,
            completed: 0,
            total: data.length
        };
        
        data.forEach(reservation => {
            if (reservation.status in newStats) {
                newStats[reservation.status as keyof typeof newStats]++;
            }
        });
        
        setStats(newStats);
    };

    const getStatusBadge = (status: string) => {
        const badges = {
            pending: 'bg-yellow-600',
            approved: 'bg-green-600',
            rejected: 'bg-red-600',
            cancelled: 'bg-gray-600',
            completed: 'bg-blue-600'
        };
        const labels = {
            pending: 'قيد الانتظار',
            approved: 'موافق عليها',
            rejected: 'مرفوضة',
            cancelled: 'ملغاة',
            completed: 'مكتملة'
        };
        return (
            <span className={`px-2 py-1 text-xs rounded-full ${badges[status as keyof typeof badges] || 'bg-gray-600'}`}>
                {labels[status as keyof typeof labels] || status}
            </span>
        );
    };

    const getDayNameAr = (day: string) => {
        const days = {
            sunday: 'الأحد',
            monday: 'الاثنين',
            tuesday: 'الثلاثاء',
            wednesday: 'الأربعاء',
            thursday: 'الخميس',
            friday: 'الجمعة',
            saturday: 'السبت'
        };
        return days[day as keyof typeof days] || day;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
            </div>
        );
    }

    if (!doctor) {
        return (
            <div className="text-center p-8">
                <p className="text-xl text-slate-300 mb-6">لم يتم العثور على الطبيب</p>
                <button 
                    onClick={() => navigate('/doctors')} 
                    className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-cyan-500/20"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    العودة إلى قائمة الأطباء
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/doctors')} 
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-500 rounded-lg transition-all duration-200 group"
                    >
                        <svg className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-slate-300 group-hover:text-white font-medium transition-colors">رجوع</span>
                    </button>
                    <h1 className="text-3xl font-bold text-slate-100">تفاصيل الطبيب - {doctor.full_name}</h1>
                </div>
            </div>

            {/* Doctor Info Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">المعلومات الأساسية</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-slate-400 text-sm">الاسم الكامل</p>
                            <p className="text-white font-medium">{doctor.full_name}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">التخصص</p>
                            <p className="text-white font-medium">{doctor.specialization?.name_ar}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">البريد الإلكتروني</p>
                            <p className="text-white font-medium">{doctor.account?.email}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">رقم الهاتف</p>
                            <p className="text-white font-medium">{doctor.account?.phone_number}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">العمر</p>
                            <p className="text-white font-medium">{doctor.age} سنة</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">الجنس</p>
                            <p className="text-white font-medium">{doctor.gender === 'male' ? 'ذكر' : 'أنثى'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-slate-400 text-sm">العنوان</p>
                            <p className="text-white font-medium">{doctor.address}</p>
                        </div>
                        {doctor.profile_description && (
                            <div className="col-span-2">
                                <p className="text-slate-400 text-sm">الوصف</p>
                                <p className="text-white font-medium">{doctor.profile_description}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Card */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">إحصائيات الحجوزات</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">الإجمالي</span>
                            <span className="text-2xl font-bold text-white">{stats.total}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-yellow-400">قيد الانتظار</span>
                            <span className="font-bold text-yellow-400">{stats.pending}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-green-400">موافق عليها</span>
                            <span className="font-bold text-green-400">{stats.approved}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-blue-400">مكتملة</span>
                            <span className="font-bold text-blue-400">{stats.completed}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-red-400">مرفوضة</span>
                            <span className="font-bold text-red-400">{stats.rejected}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">ملغاة</span>
                            <span className="font-bold text-gray-400">{stats.cancelled}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Services */}
            {doctor.services && doctor.services.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">الخدمات المتاحة ({doctor.services.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {doctor.services.map(service => (
                            <div key={service.id} className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                                <h3 className="text-white font-medium mb-2">{service.name}</h3>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">السعر:</span>
                                    <span className="text-cyan-400 font-bold">{service.price} ل.س</span>
                                </div>
                                <div className="flex justify-between items-center text-sm mt-1">
                                    <span className="text-slate-400">المدة:</span>
                                    <span className="text-white">{service.duration_minutes} دقيقة</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Work Schedule */}
            {doctor.doctor_work_schedule && doctor.doctor_work_schedule.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">أوقات العمل ({doctor.doctor_work_schedule.length} أيام)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {doctor.doctor_work_schedule.map(schedule => (
                            <div key={schedule.id} className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                                <h3 className="text-white font-medium mb-2">{getDayNameAr(schedule.day_of_week)}</h3>
                                <div className="flex items-center space-x-2 space-x-reverse text-sm">
                                    <span className="text-cyan-400">{schedule.start_time}</span>
                                    <span className="text-slate-400">-</span>
                                    <span className="text-cyan-400">{schedule.end_time}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Reservations */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 space-y-4 md:space-y-0">
                    <h2 className="text-xl font-bold text-cyan-400">الحجوزات</h2>
                    
                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm"
                        >
                            <option value="">جميع الحالات</option>
                            <option value="pending">قيد الانتظار</option>
                            <option value="approved">موافق عليها</option>
                            <option value="completed">مكتملة</option>
                            <option value="rejected">مرفوضة</option>
                            <option value="cancelled">ملغاة</option>
                        </select>
                        <input 
                            type="date" 
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm"
                            placeholder="من تاريخ"
                        />
                        <input 
                            type="date" 
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm"
                            placeholder="إلى تاريخ"
                        />
                        {(statusFilter || fromDate || toDate) && (
                            <button 
                                onClick={() => {
                                    setStatusFilter('');
                                    setFromDate('');
                                    setToDate('');
                                }}
                                className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-md text-sm"
                            >
                                إلغاء الفلاتر
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-slate-300">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-800">
                            <tr>
                                <th scope="col" className="px-6 py-3">#</th>
                                <th scope="col" className="px-6 py-3">المريض</th>
                                <th scope="col" className="px-6 py-3">الخدمة</th>
                                <th scope="col" className="px-6 py-3">التاريخ</th>
                                <th scope="col" className="px-6 py-3">الوقت</th>
                                <th scope="col" className="px-6 py-3">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reservationsLoading ? (
                                <tr><td colSpan={6} className="text-center p-8">جاري التحميل...</td></tr>
                            ) : reservations.length > 0 ? (
                                reservations.map(reservation => {
                                    const phoneNumber = reservation.user?.account?.phone_number || 
                                        reservation.user?.phone_number || 
                                        reservation.user?.account?.phone || 
                                        reservation.user?.phone || 
                                        reservation.user?.account?.mobile ||
                                        reservation.user?.mobile;
                                    
                                    return (
                                    <tr key={reservation.id} className="border-b border-slate-700 hover:bg-slate-800">
                                        <td className="px-6 py-4">{reservation.id}</td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium">
                                                    {reservation.user?.full_name || 
                                                     reservation.user?.account?.full_name || 
                                                     `مريض #${reservation.user_id}`}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    📞 {phoneNumber || 'غير متوفر'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{reservation.doctor_service?.name || '-'}</td>
                                        <td className="px-6 py-4">{reservation.date}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs">
                                                <p>{reservation.start_time}</p>
                                                <p className="text-slate-400">إلى {reservation.end_time}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{getStatusBadge(reservation.status)}</td>
                                    </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan={6} className="text-center p-8">لا توجد حجوزات.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DoctorDetailsPage;

