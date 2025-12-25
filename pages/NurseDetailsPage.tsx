import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Nurse, NurseReservation } from '../types';
import api from '../services/api';

const NurseDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [nurse, setNurse] = useState<Nurse | null>(null);
    const [loading, setLoading] = useState(true);
    const [reservations, setReservations] = useState<NurseReservation[]>([]);
    const [reservationsLoading, setReservationsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [fromDate, setFromDate] = useState<string>('');
    const [toDate, setToDate] = useState<string>('');
    const [stats, setStats] = useState({
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
        completed: 0,
        total: 0,
    });

    useEffect(() => {
        fetchNurseDetails();
    }, [id]);

    useEffect(() => {
        if (id) {
            fetchReservations();
        }
    }, [id, statusFilter, fromDate, toDate]);

    const fetchNurseDetails = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/admin/nurse/${id}`);
            setNurse(response.nurse || response);
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

            const response = await api.get(`/admin/nurse/${id}/reservations?${params.toString()}`);
            const payload =
                response.data?.data ||
                response.data ||
                response.reservations ||
                response.nurse_reservations ||
                response;

            const reservationsData = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.data)
                ? payload.data
                : [];

            setReservations(reservationsData);
            calculateStats(reservationsData);
        } catch (error) {
            setReservations([]);
            setStats({
                pending: 0,
                approved: 0,
                rejected: 0,
                cancelled: 0,
                completed: 0,
                total: 0,
            });
        } finally {
            setReservationsLoading(false);
        }
    };

    const calculateStats = (data: NurseReservation[]) => {
        const newStats = {
            pending: 0,
            approved: 0,
            rejected: 0,
            cancelled: 0,
            completed: 0,
            total: data.length,
        };

        data.forEach((reservation) => {
            if (reservation.status in newStats) {
                newStats[reservation.status as keyof typeof newStats]++;
            }
        });

        setStats(newStats);
    };

    const formatDateTime = (value: string | null) => {
        if (!value) return '-';
        const date = new Date(value.replace(' ', 'T'));
        return date.toLocaleString('ar-EG', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, string> = {
            pending: 'bg-yellow-600',
            approved: 'bg-green-600',
            rejected: 'bg-red-600',
            cancelled: 'bg-gray-600',
            completed: 'bg-blue-600',
        };
        const labels: Record<string, string> = {
            pending: 'قيد الانتظار',
            approved: 'موافق عليها',
            rejected: 'مرفوضة',
            cancelled: 'ملغاة',
            completed: 'مكتملة',
        };
        return (
            <span className={`px-2 py-1 text-xs rounded-full ${badges[status] || 'bg-slate-600'}`}>
                {labels[status] || status}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
            </div>
        );
    }

    if (!nurse) {
        return (
            <div className="text-center p-8">
                <p className="text-xl text-slate-300 mb-6">لم يتم العثور على الممرض</p>
                <button 
                    onClick={() => navigate('/nurses')} 
                    className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-cyan-500/20"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    العودة إلى قائمة الممرضين
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
                        onClick={() => navigate('/nurses')} 
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-500 rounded-lg transition-all duration-200 group"
                    >
                        <svg className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-slate-300 group-hover:text-white font-medium transition-colors">رجوع</span>
                    </button>
                    <h1 className="text-3xl font-bold text-slate-100">تفاصيل الممرض - {nurse.full_name}</h1>
                </div>
            </div>

            {/* Nurse Info Card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">المعلومات الأساسية</h2>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <p className="text-slate-400 text-sm">الاسم الكامل</p>
                            <p className="text-white font-medium">{nurse.full_name}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">البريد الإلكتروني</p>
                            <p className="text-white font-medium">{nurse.account?.email}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">رقم الهاتف</p>
                            <p className="text-white font-medium">{nurse.account?.phone_number}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">العمر</p>
                            <p className="text-white font-medium">{nurse.age} سنة</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">الجنس</p>
                            <p className="text-white font-medium">{nurse.gender === 'male' ? 'ذكر' : 'أنثى'}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">نوع التخرج</p>
                            <p className="text-white font-medium">{nurse.graduation_type}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">الحالة</p>
                            <p className="text-white font-medium">
                                <span className={`inline-block px-3 py-1 text-xs rounded-full ${nurse.is_active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                    {nurse.is_active ? 'نشط' : 'غير نشط'}
                                </span>
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">العنوان</p>
                            <p className="text-white font-medium">{nurse.address}</p>
                        </div>
                        {nurse.profile_description && (
                            <div>
                                <p className="text-slate-400 text-sm">الوصف</p>
                                <p className="text-white font-medium">{nurse.profile_description}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Profile Image (if available) */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex flex-col">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">الملف الشخصي</h2>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-48 h-48 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
                                <svg className="w-24 h-24 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <p className="text-slate-400 text-sm">صورة الملف الشخصي</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reservations */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-cyan-400 mb-1">حجوزات الممرض</h2>
                        <p className="text-slate-400 text-sm">معاينة كل الطلبات المرتبطة بهذا الممرض</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                        >
                            <option value="">كل الحالات</option>
                            <option value="pending">قيد الانتظار</option>
                            <option value="approved">موافق عليها</option>
                            <option value="rejected">مرفوضة</option>
                            <option value="cancelled">ملغاة</option>
                            <option value="completed">مكتملة</option>
                        </select>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                        />
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                        />
                        {(fromDate || toDate || statusFilter) && (
                            <button
                                onClick={() => {
                                    setStatusFilter('');
                                    setFromDate('');
                                    setToDate('');
                                }}
                                className="px-4 py-2 text-sm rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:border-cyan-400 transition-colors"
                            >
                                إعادة تعيين
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'إجمالي', value: stats.total, color: 'text-slate-200' },
                        { label: 'قيد الانتظار', value: stats.pending, color: 'text-amber-300' },
                        { label: 'موافق عليها', value: stats.approved, color: 'text-emerald-300' },
                        { label: 'مرفوضة', value: stats.rejected, color: 'text-rose-300' },
                        { label: 'ملغاة', value: stats.cancelled, color: 'text-slate-400' },
                        { label: 'مكتملة', value: stats.completed, color: 'text-sky-300' },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 text-center"
                        >
                            <p className="text-xs text-slate-400">{item.label}</p>
                            <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                        </div>
                    ))}
                </div>

                {reservationsLoading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400"></div>
                    </div>
                ) : reservations.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-700">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                                    <th className="px-4 py-3">المستخدم</th>
                                    <th className="px-4 py-3">الخدمة</th>
                                    <th className="px-4 py-3">الحالة</th>
                                    <th className="px-4 py-3">نوع الحجز</th>
                                    <th className="px-4 py-3">الموقع</th>
                                    <th className="px-4 py-3">بداية الحجز</th>
                                    <th className="px-4 py-3">نهاية الحجز</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 text-sm">
                                {reservations.map((reservation) => (
                                    <tr key={reservation.id} className="hover:bg-slate-800/60 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="text-white font-medium">
                                                {reservation.user?.full_name || 'غير معروف'}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {reservation.user?.account?.phone_number || reservation.user?.account?.email || '-'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-white font-medium">
                                                {reservation.nurse_service?.name || 'خدمة عامة'}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {reservation.nurse_service?.price ? `${reservation.nurse_service.price} ل.س` : ''}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">{getStatusBadge(reservation.status)}</td>
                                        <td className="px-4 py-3 capitalize text-white">{reservation.reservation_type}</td>
                                        <td className="px-4 py-3 text-slate-300">
                                            {reservation.location?.lat && reservation.location?.lng
                                                ? `${reservation.location.lat}, ${reservation.location.lng}`
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">{formatDateTime(reservation.start_at)}</td>
                                        <td className="px-4 py-3 text-slate-300">{formatDateTime(reservation.end_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400">
                        لا توجد حجوزات مطابقة للمعايير الحالية.
                    </div>
                )}
            </div>
        </div>
    );
};

export default NurseDetailsPage;

