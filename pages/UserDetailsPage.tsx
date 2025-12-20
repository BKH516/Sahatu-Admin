import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import {
    DoctorReservation,
    HospitalReservation,
    NurseReservation,
    User,
} from '../types';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

type TabKey = 'doctor' | 'hospital' | 'nurse';

interface LocationState {
    user?: User;
}

const STATUS_OPTIONS = [
    { value: '', label: 'كل الحالات' },
    { value: 'pending', label: 'قيد الانتظار' },
    { value: 'approved', label: 'موافق عليها' },
    { value: 'rejected', label: 'مرفوضة' },
    { value: 'cancelled', label: 'ملغاة' },
    { value: 'completed', label: 'مكتملة' },
];

const TAB_CONFIG: Record<
    TabKey,
    {
        label: string;
        statuses: Record<string, { label: string; color: string }>;
    }
> = {
    doctor: {
        label: 'حجوزات الأطباء',
        statuses: {
            pending: { label: 'قيد الانتظار', color: 'bg-amber-500/20 text-amber-300' },
            approved: { label: 'موافق عليها', color: 'bg-emerald-500/20 text-emerald-300' },
            rejected: { label: 'مرفوضة', color: 'bg-rose-500/20 text-rose-300' },
            cancelled: { label: 'ملغاة', color: 'bg-slate-500/30 text-slate-200' },
            completed: { label: 'مكتملة', color: 'bg-sky-500/20 text-sky-300' },
        },
    },
    hospital: {
        label: 'حجوزات المشافي',
        statuses: {
            pending: { label: 'قيد الانتظار', color: 'bg-amber-500/20 text-amber-300' },
            confirmed: { label: 'مؤكدة', color: 'bg-emerald-500/20 text-emerald-300' },
            cancelled: { label: 'ملغاة', color: 'bg-slate-500/30 text-slate-200' },
        },
    },
    nurse: {
        label: 'حجوزات الممرضين',
        statuses: {
            pending: { label: 'قيد الانتظار', color: 'bg-amber-500/20 text-amber-300' },
            approved: { label: 'موافق عليها', color: 'bg-emerald-500/20 text-emerald-300' },
            rejected: { label: 'مرفوضة', color: 'bg-rose-500/20 text-rose-300' },
            cancelled: { label: 'ملغاة', color: 'bg-slate-500/30 text-slate-200' },
            completed: { label: 'مكتملة', color: 'bg-sky-500/20 text-sky-300' },
        },
    },
};

const toArray = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (Array.isArray((value as any)?.data)) return (value as any).data as T[];
    return [];
};

const extractUsersFromResponse = (response: any): User[] => {
    if (!response) return [];
    if (response?.user && response.user.id) return [response.user];

    const candidates = [
        response?.users?.data,
        response?.users,
        response?.data?.users?.data,
        response?.data?.users,
        response?.data?.data,
        response?.data,
        response,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate as User[];
        }
    }

    return [];
};

const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '-';
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('ar-EG', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
};

const formatDate = (value: string | null | undefined) => {
    if (!value) return '-';
    const normalized = value.includes('T') ? value : `${value}T00:00:00`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('ar-EG');
};

const UserDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const stateUser = (location.state as LocationState | undefined)?.user ?? null;

    const [user, setUser] = useState<User | null>(stateUser);
    const [loading, setLoading] = useState(!stateUser);

    const [doctorReservations, setDoctorReservations] = useState<DoctorReservation[]>([]);
    const [hospitalReservations, setHospitalReservations] = useState<HospitalReservation[]>([]);
    const [nurseReservations, setNurseReservations] = useState<NurseReservation[]>([]);
    const [reservationsLoading, setReservationsLoading] = useState(true);
    const [reservationsError, setReservationsError] = useState('');

    const [activeTab, setActiveTab] = useState<TabKey>('doctor');
    const [statusFilter, setStatusFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    useEffect(() => {
        if (!id) return;
        if (stateUser && stateUser.id === Number(id)) {
            setUser(stateUser);
            setLoading(false);
            return;
        }
        fetchUserProfile(id);
    }, [id]);

    useEffect(() => {
        if (!id) return;
        fetchReservations(id);
    }, [id, statusFilter, fromDate, toDate]);

    const fetchUserProfile = async (userId: string) => {
        setLoading(true);
        try {
            let profile: User | null = null;
            try {
                const direct = await api.get(`/admin/user/${userId}`);
                const candidate = direct?.user || direct?.data || direct;
                if (candidate?.id) {
                    profile = candidate;
                }
            } catch {
                // Endpoint may not exist; fallback to list lookup
            }

            if (!profile) {
                const collection = await api.get('/admin/user/all?per_page=1000');
                const users = extractUsersFromResponse(collection);
                profile = users.find((u) => u.id === Number(userId)) ?? null;
            }

            setUser(profile);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchReservations = async (userId: string) => {
        setReservationsLoading(true);
        setReservationsError('');
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);
            if (fromDate) params.append('from', fromDate);
            if (toDate) params.append('to', toDate);
            const query = params.toString();
            const endpoint = query
                ? `/admin/user/${userId}/reservations?${query}`
                : `/admin/user/${userId}/reservations`;
            const response = await api.get(endpoint);
            const payload = response?.data || response;

            setDoctorReservations(
                toArray<DoctorReservation>(
                    payload?.doctor_reservations || payload?.data?.doctor_reservations,
                ),
            );
            setHospitalReservations(
                toArray<HospitalReservation>(
                    payload?.hospital_reservations || payload?.data?.hospital_reservations,
                ),
            );
            setNurseReservations(
                toArray<NurseReservation>(
                    payload?.nurse_reservations || payload?.data?.nurse_reservations,
                ),
            );
        } catch (error: any) {
            setDoctorReservations([]);
            setHospitalReservations([]);
            setNurseReservations([]);
            setReservationsError(error?.message || 'فشل تحميل الحجوزات');
        } finally {
            setReservationsLoading(false);
        }
    };

    const activeReservations = useMemo(() => {
        switch (activeTab) {
            case 'hospital':
                return hospitalReservations;
            case 'nurse':
                return nurseReservations;
            default:
                return doctorReservations;
        }
    }, [activeTab, doctorReservations, hospitalReservations, nurseReservations]);

    const stats = useMemo(() => {
        const config = TAB_CONFIG[activeTab];
        const counters = Object.keys(config.statuses).reduce<Record<string, number>>((acc, key) => {
            acc[key] = 0;
            return acc;
        }, {});

        activeReservations.forEach((reservation: any) => {
            const status = reservation.status;
            if (status in counters) {
                counters[status] += 1;
            }
        });

        return counters;
    }, [activeReservations, activeTab]);

    if (!id) {
        return (
            <div className="text-center py-20 text-slate-400">
                لا يوجد معرف مستخدم صالح.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-80">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center py-20 space-y-4">
                <p className="text-slate-300 text-xl">لم يتم العثور على المستخدم</p>
                <Button variant="secondary" onClick={() => navigate('/users')}>
                    العودة لقائمة المستخدمين
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate('/users')}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        }
                    >
                        رجوع
                    </Button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">
                            {user.full_name || 'مستخدم غير معروف'}
                        </h1>
                        <p className="text-slate-400 text-sm">#{user.id}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Badge variant="info">{user.account?.email || 'لا يوجد بريد'}</Badge>
                    <Badge variant="secondary">{user.account?.phone_number || '-'}</Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
                    <p className="text-slate-400 text-sm">الاسم الكامل</p>
                    <p className="text-white font-semibold text-lg">{user.full_name || '-'}</p>
                </div>
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
                    <p className="text-slate-400 text-sm">العمر</p>
                    <p className="text-white font-semibold text-lg">
                        {user.age ? `${user.age} سنة` : '-'}
                    </p>
                </div>
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
                    <p className="text-slate-400 text-sm">الجنس</p>
                    <Badge variant={user.gender === 'male' ? 'info' : 'success'}>
                        {user.gender === 'male' ? 'ذكر' : 'أنثى'}
                    </Badge>
                </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-lg font-semibold text-white">مرشحات الحجوزات</p>
                        <p className="text-slate-400 text-sm">
                            يمكن تطبيق نفس المرشح على جميع أنواع الحجوزات
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                        >
                            {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                        />
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                        />
                        {(statusFilter || fromDate || toDate) && (
                            <button
                                onClick={() => {
                                    setStatusFilter('');
                                    setFromDate('');
                                    setToDate('');
                                }}
                                className="px-3 py-2 text-sm rounded-lg border border-slate-600 text-slate-300 hover:border-cyan-400 hover:text-white transition-colors"
                            >
                                إعادة التعيين
                            </button>
                        )}
                    </div>
                </div>
                {reservationsError && (
                    <div className="text-sm text-rose-400">{reservationsError}</div>
                )}
            </div>

            <div className="flex flex-wrap gap-3">
                {(['doctor', 'hospital', 'nurse'] as TabKey[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-xl border transition-all duration-200 ${
                            activeTab === tab
                                ? 'bg-cyan-600/20 border-cyan-500 text-white shadow-cyan-500/20 shadow-lg'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span>{TAB_CONFIG[tab].label}</span>
                            <span className="text-xs text-slate-400">
                                {tab === 'doctor'
                                    ? doctorReservations.length
                                    : tab === 'hospital'
                                    ? hospitalReservations.length
                                    : nurseReservations.length}
                            </span>
                        </div>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {Object.entries(TAB_CONFIG[activeTab].statuses).map(([key, meta]) => (
                    <div
                        key={key}
                        className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center"
                    >
                        <p className="text-xs text-slate-400">{meta.label}</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats[key] || 0}</p>
                    </div>
                ))}
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-x-auto">
                {reservationsLoading ? (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400"></div>
                    </div>
                ) : activeReservations.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        لا توجد حجوزات مطابقة للمعايير الحالية.
                    </div>
                ) : (
                    <table className="w-full text-sm text-right text-slate-200">
                        <thead className="bg-slate-900 text-xs uppercase text-slate-400">
                            {activeTab === 'doctor' && (
                                <tr>
                                    <th className="px-4 py-3">الخدمة</th>
                                    <th className="px-4 py-3">السعر</th>
                                    <th className="px-4 py-3">الحالة</th>
                                    <th className="px-4 py-3">تاريخ الحجز</th>
                                    <th className="px-4 py-3">الإنشاء</th>
                                </tr>
                            )}
                            {activeTab === 'hospital' && (
                                <tr>
                                    <th className="px-4 py-3">الخدمة</th>
                                    <th className="px-4 py-3">الحالة</th>
                                    <th className="px-4 py-3">تاريخ البداية</th>
                                    <th className="px-4 py-3">تاريخ النهاية</th>
                                    <th className="px-4 py-3">آخر تحديث</th>
                                </tr>
                            )}
                            {activeTab === 'nurse' && (
                                <tr>
                                    <th className="px-4 py-3">الخدمة</th>
                                    <th className="px-4 py-3">نوع الحجز</th>
                                    <th className="px-4 py-3">الموقع</th>
                                    <th className="px-4 py-3">الحالة</th>
                                    <th className="px-4 py-3">الفترة</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {activeTab === 'doctor' &&
                                (activeReservations as DoctorReservation[]).map((reservation) => (
                                    <tr key={reservation.id} className="hover:bg-slate-800/70">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold">
                                                {reservation.doctor_service?.name || 'خدمة غير معروفة'}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                #{reservation.id}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            {reservation.doctor_service?.price
                                                ? `${reservation.doctor_service.price} ل.س`
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge tab={activeTab} status={reservation.status} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <p>{formatDateTime(reservation.start_time)}</p>
                                            <p className="text-xs text-slate-400">
                                                حتى {formatDateTime(reservation.end_time)}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">{formatDateTime(reservation.created_at)}</td>
                                    </tr>
                                ))}

                            {activeTab === 'hospital' &&
                                (activeReservations as HospitalReservation[]).map((reservation) => (
                                    <tr key={reservation.id} className="hover:bg-slate-800/70">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold">
                                                {reservation.hospital_service?.service?.service_name ||
                                                    'خدمة غير معروفة'}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                #{reservation.id}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge tab={activeTab} status={reservation.status} />
                                        </td>
                                        <td className="px-4 py-3">{formatDate(reservation.start_date)}</td>
                                        <td className="px-4 py-3">{formatDate(reservation.end_date)}</td>
                                        <td className="px-4 py-3">{formatDateTime(reservation.updated_at)}</td>
                                    </tr>
                                ))}

                            {activeTab === 'nurse' &&
                                (activeReservations as NurseReservation[]).map((reservation) => (
                                    <tr key={reservation.id} className="hover:bg-slate-800/70">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold">
                                                {reservation.nurse_service?.name || 'خدمة غير معروفة'}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                #{reservation.id}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 capitalize text-white">
                                            {reservation.reservation_type === 'manual' ? 'يدوي' : 'مباشر'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">
                                            {reservation.location?.lat && reservation.location?.lng
                                                ? `${reservation.location.lat}, ${reservation.location.lng}`
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge tab={activeTab} status={reservation.status} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <p>{formatDateTime(reservation.start_at)}</p>
                                            <p className="text-xs text-slate-400">
                                                حتى {formatDateTime(reservation.end_at)}
                                            </p>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

interface StatusBadgeProps {
    tab: TabKey;
    status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ tab, status }) => {
    const meta = TAB_CONFIG[tab].statuses[status];
    if (!meta) {
        return <span className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300">{status}</span>;
    }
    return (
        <span className={`px-2 py-1 text-xs rounded-full ${meta.color}`}>
            {meta.label}
        </span>
    );
};

export default UserDetailsPage;

