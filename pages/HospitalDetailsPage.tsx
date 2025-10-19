import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Hospital, HospitalReservation } from '../types';
import api from '../services/api';

const HospitalDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [hospital, setHospital] = useState<Hospital | null>(null);
    const [reservations, setReservations] = useState<HospitalReservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [reservationsLoading, setReservationsLoading] = useState(true);
    
    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [fromDate, setFromDate] = useState<string>('');
    const [toDate, setToDate] = useState<string>('');
    
    // Stats
    const [stats, setStats] = useState({
        pending: 0,
        confirmed: 0,
        cancelled: 0,
        total: 0
    });

    useEffect(() => {
        fetchHospitalDetails();
    }, [id]);

    useEffect(() => {
        if (id) {
            fetchReservations();
        }
    }, [id, statusFilter, fromDate, toDate]);

    const fetchHospitalDetails = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/admin/hospital/${id}`);
            setHospital(response.hospital || response);
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
            
            const response = await api.get(`/admin/hospital/${id}/reservations?${params.toString()}`);
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

    const calculateStats = (data: HospitalReservation[]) => {
        const newStats = {
            pending: 0,
            confirmed: 0,
            cancelled: 0,
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
            confirmed: 'bg-green-600',
            cancelled: 'bg-gray-600'
        };
        const labels = {
            pending: 'قيد الانتظار',
            confirmed: 'مؤكدة',
            cancelled: 'ملغاة'
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

    if (!hospital) {
        return (
            <div className="text-center p-8">
                <p className="text-xl text-slate-300 mb-6">لم يتم العثور على المشفى</p>
                <button 
                    onClick={() => navigate('/hospitals')} 
                    className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-cyan-500/20"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    العودة إلى قائمة المشافي
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
                        onClick={() => navigate('/hospitals')} 
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-500 rounded-lg transition-all duration-200 group"
                    >
                        <svg className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-slate-300 group-hover:text-white font-medium transition-colors">رجوع</span>
                    </button>
                    <h1 className="text-3xl font-bold text-slate-100">تفاصيل المشفى - {hospital.full_name}</h1>
                </div>
            </div>

            {/* Hospital Info Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">المعلومات الأساسية</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-slate-400 text-sm">اسم المشفى</p>
                            <p className="text-white font-medium">{hospital.full_name || 'غير محدد'}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">البريد الإلكتروني</p>
                            <p className="text-white font-medium">{hospital.account?.email || 'غير محدد'}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">رقم الهاتف</p>
                            <p className="text-white font-medium">{hospital.account?.phone_number || 'غير محدد'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-slate-400 text-sm">العنوان</p>
                            <p className="text-white font-medium">{hospital.address || 'غير محدد'}</p>
                        </div>
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
                            <span className="text-green-400">مؤكدة</span>
                            <span className="font-bold text-green-400">{stats.confirmed}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">ملغاة</span>
                            <span className="font-bold text-gray-400">{stats.cancelled}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Services */}
            {hospital.services_2 && hospital.services_2.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">الخدمات المتاحة ({hospital.services_2.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {hospital.services_2.map(service => (
                            <div key={service.id} className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                                <h3 className="text-white font-medium mb-2">{service.service_name}</h3>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">السعر:</span>
                                    <span className="text-cyan-400 font-bold">{service.pivot.price} ل.س</span>
                                </div>
                                <div className="flex justify-between items-center text-sm mt-1">
                                    <span className="text-slate-400">السعة:</span>
                                    <span className="text-white">{service.pivot.capacity} شخص</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Work Schedule */}
            {hospital.work_schedule && hospital.work_schedule.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">أيام العمل ({hospital.work_schedule.length} أيام)</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {hospital.work_schedule.map(schedule => (
                            <div key={schedule.id} className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-center">
                                <p className="text-white font-medium">{getDayNameAr(schedule.day_of_week)}</p>
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
                            <option value="confirmed">مؤكدة</option>
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
                                <th scope="col" className="px-6 py-3">من تاريخ</th>
                                <th scope="col" className="px-6 py-3">إلى تاريخ</th>
                                <th scope="col" className="px-6 py-3">السعر</th>
                                <th scope="col" className="px-6 py-3">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reservationsLoading ? (
                                <tr><td colSpan={7} className="text-center p-8">جاري التحميل...</td></tr>
                            ) : reservations.length > 0 ? (
                                reservations.map(reservation => (
                                    <tr key={reservation.id} className="border-b border-slate-700 hover:bg-slate-800">
                                        <td className="px-6 py-4">{reservation.id}</td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium">
                                                    {reservation.user?.full_name || `مريض #${reservation.user_id}`}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    📞 {reservation.user?.account?.phone_number || 
                                                        reservation.user?.phone_number || 
                                                        reservation.user?.account?.phone || 
                                                        reservation.user?.phone || 
                                                        reservation.user?.account?.mobile ||
                                                        reservation.user?.mobile ||
                                                        'غير متوفر'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {reservation.hospital_service?.service?.service_name || '-'}
                                        </td>
                                        <td className="px-6 py-4">{reservation.start_date}</td>
                                        <td className="px-6 py-4">{reservation.end_date}</td>
                                        <td className="px-6 py-4">
                                            <span className="text-cyan-400 font-bold">
                                                {reservation.hospital_service?.price || '-'} ل.س
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{getStatusBadge(reservation.status)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={7} className="text-center p-8">لا توجد حجوزات.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default HospitalDetailsPage;

