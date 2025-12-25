import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Nurse, NurseReservation } from '../types';
import api from '../services/api';
import { getLicenseImageUrl } from '../utils/imageUtils';

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

    const [licenseImageUrl, setLicenseImageUrl] = useState<string | null>(null);
    const [licenseImageLoading, setLicenseImageLoading] = useState(false);
    const [licenseImageError, setLicenseImageError] = useState<string | null>(null);

    useEffect(() => {
        if (nurse) {
            // Try multiple possible field names
            const licensePath = nurse.license_image_path || 
                               (nurse as any).license_image || 
                               (nurse as any).license || 
                               (nurse as any).license_path;
            
            if (licensePath) {
                const url = getLicenseImageUrl(licensePath);
                setLicenseImageUrl(url);
                setLicenseImageError(null);
                if (url) {
                    setLicenseImageLoading(true);
                    
                    // Set a longer timeout before showing error (30 seconds)
                    const timeoutId = setTimeout(() => {
                        console.warn('⏱️ License image taking longer than expected to load (Nurse)...');
                    }, 30000); // 30 seconds
                    
                    // Preload image with longer timeout
                    const img = new Image();
                    let imageLoaded = false;
                    
                    img.onload = () => {
                        if (!imageLoaded) {
                            imageLoaded = true;
                            clearTimeout(timeoutId);
                            setLicenseImageLoading(false);
                            setLicenseImageError(null);
                        }
                    };
                    
                    img.onerror = () => {
                        console.warn('⚠️ License image preload failed, but will retry in UI (Nurse)');
                        // Don't set error or stop loading - let the UI img tag handle it
                    };
                    
                    // Start loading with a delay to allow network to stabilize
                    setTimeout(() => {
                        img.src = url;
                    }, 100);
                    
                    // Cleanup timeout on unmount
                    return () => {
                        clearTimeout(timeoutId);
                    };
                } else {
                    setLicenseImageLoading(false);
                }
            } else {
                setLicenseImageUrl(null);
                setLicenseImageLoading(false);
                setLicenseImageError(null);
            }
        } else {
            setLicenseImageUrl(null);
            setLicenseImageLoading(false);
            setLicenseImageError(null);
        }
    }, [nurse]);

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
            const nurseData = response.nurse || response;
            
            // Debug: Log the response to check for license image field
            console.log('Nurse API Response:', nurseData);
            console.log('License image path:', nurseData.license_image_path);
            console.log('License image:', nurseData.license_image);
            console.log('All keys:', Object.keys(nurseData));
            
            // Try to find license image in various possible field names
            if (!nurseData.license_image_path) {
                if (nurseData.license_image) {
                    nurseData.license_image_path = nurseData.license_image;
                } else if (nurseData.license) {
                    nurseData.license_image_path = nurseData.license;
                } else if (nurseData.license_path) {
                    nurseData.license_image_path = nurseData.license_path;
                }
            }
            
            setNurse(nurseData);
        } catch (error) {
            console.error('Error fetching nurse details:', error);
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
                    
                    {/* License Image */}
                    <div className="mt-6 pt-6 border-t border-slate-700">
                        <h3 className="text-lg font-bold text-cyan-400 mb-4">رخصة الممرضة</h3>
                        {licenseImageLoading && !licenseImageUrl ? (
                            <div className="flex items-center justify-center p-8 bg-slate-700/50 rounded-lg border border-slate-600">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-2"></div>
                                    <p className="text-slate-400">جاري تحميل صورة الرخصة...</p>
                                    <p className="text-slate-500 text-xs mt-2">يرجى الانتظار، قد يستغرق الأمر بضع لحظات</p>
                                </div>
                            </div>
                        ) : licenseImageError && !licenseImageUrl ? (
                            <div className="flex items-center justify-center p-8 bg-red-900/20 rounded-lg border border-red-600">
                                <div className="text-center">
                                    <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-red-400 font-medium">{licenseImageError}</p>
                                    {nurse?.license_image_path && (
                                        <p className="text-red-300 text-sm mt-1 break-all">{nurse.license_image_path}</p>
                                    )}
                                    {licenseImageUrl && (
                                        <button
                                            onClick={() => {
                                                if (licenseImageUrl) window.open(licenseImageUrl, '_blank');
                                            }}
                                            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-colors"
                                        >
                                            محاولة فتح الرابط مباشرة
                                        </button>
                                    )}
                                    {/* Fallback: Try API endpoint if direct URL fails */}
                                    {id && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const response = await api.get(`/admin/nurse/${id}/license`, {
                                                        skipAuth: false,
                                                    });
                                                    if (response instanceof Blob) {
                                                        const url = URL.createObjectURL(response);
                                                        window.open(url, '_blank');
                                                    } else if (response.url) {
                                                        window.open(response.url, '_blank');
                                                    }
                                                } catch (error: any) {
                                                    alert('فشل تحميل صورة الرخصة: ' + (error.message || 'خطأ غير معروف'));
                                                }
                                            }}
                                            className="mt-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white text-sm font-medium transition-colors"
                                        >
                                            محاولة التحميل من API
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : licenseImageUrl ? (
                            <div className="space-y-4">
                                <div className="relative group">
                                    <img 
                                        src={licenseImageUrl}
                                        alt="رخصة ممرضة"
                                        className="w-full max-w-md rounded-lg border-2 border-slate-600 hover:border-cyan-400 transition-all duration-300 cursor-pointer shadow-lg"
                                        onClick={() => {
                                            if (licenseImageUrl) window.open(licenseImageUrl, '_blank');
                                        }}
                                        onLoad={() => {
                                            console.log('✅ License image rendered successfully in Nurse UI');
                                            setLicenseImageLoading(false);
                                            setLicenseImageError(null);
                                        }}
                                        onError={(e) => {
                                            const target = e.currentTarget;
                                            const retryCount = parseInt(target.dataset.retryCount || '0');
                                            
                                            // Retry up to 3 times with increasing delays
                                            if (retryCount < 3) {
                                                console.warn(`⚠️ License image failed (Nurse), retrying (${retryCount + 1}/3)...`);
                                                target.dataset.retryCount = String(retryCount + 1);
                                                
                                                // Retry with exponential backoff: 2s, 5s, 10s
                                                const delays = [2000, 5000, 10000];
                                                setTimeout(() => {
                                                    const separator = licenseImageUrl?.includes('?') ? '&' : '?';
                                                    target.src = `${licenseImageUrl}${separator}_retry=${Date.now()}`;
                                                }, delays[retryCount]);
                                            } else {
                                                console.error('❌ License image failed after 3 retries (Nurse):', licenseImageUrl);
                                                setLicenseImageError('فشل تحميل صورة الرخصة بعد عدة محاولات');
                                                setLicenseImageLoading(false);
                                            }
                                        }}
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 rounded-lg flex items-center justify-center pointer-events-none">
                                        <svg className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 text-center">انقر على الصورة لعرضها بحجم كامل</p>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center p-8 bg-slate-700/50 rounded-lg border border-slate-600">
                                <div className="text-center">
                                    <svg className="w-12 h-12 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-slate-400">لا توجد صورة رخصة متاحة</p>
                                    {process.env.NODE_ENV === 'development' && nurse && (
                                        <div className="mt-4 text-xs text-slate-500 text-left">
                                            <p>Debug Info:</p>
                                            <p>license_image_path: {nurse.license_image_path || 'null'}</p>
                                            <p>license_image: {(nurse as any).license_image || 'null'}</p>
                                            <p>license: {(nurse as any).license || 'null'}</p>
                                        </div>
                                    )}
                                </div>
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

