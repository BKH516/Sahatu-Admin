import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { EntityRating } from '../types';
import Badge from '../components/ui/Badge';

type EntityType = 'hospital' | 'doctor' | 'nurse';

interface EntityOption {
    id: number;
    name: string;
    subtitle?: string;
}

const ENTITY_ENDPOINTS: Record<EntityType, { endpoint: string; key: string }> = {
    hospital: { endpoint: '/admin/hospital/all', key: 'hospitals' },
    doctor: { endpoint: '/admin/doctor/all', key: 'doctors' },
    nurse: { endpoint: '/admin/nurse/all', key: 'nurses' },
};

const toArray = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (Array.isArray((value as any)?.data)) return (value as any).data as T[];
    return [];
};

const normalizeCollection = (response: any, key: string): any[] => {
    if (!response) return [];
    if (Array.isArray(response?.[key]?.data)) return response[key].data;
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key]?.data)) return response.data[key].data;
    if (Array.isArray(response?.data?.[key])) return response.data[key];
    if (Array.isArray(response?.data?.data)) return response.data.data;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
};

const EntityRatingsPage: React.FC = () => {
    const [entityType, setEntityType] = useState<EntityType>('hospital');
    const [entities, setEntities] = useState<EntityOption[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEntityId, setSelectedEntityId] = useState<number | ''>('');
    const [loadingEntities, setLoadingEntities] = useState(false);

    const [ratingsLoading, setRatingsLoading] = useState(false);
    const [ratingsError, setRatingsError] = useState('');
    const [ratingsData, setRatingsData] = useState<{ avg: number; count: number; ratings: EntityRating[] } | null>(null);

    useEffect(() => {
        setSelectedEntityId('');
        setRatingsData(null);
        setRatingsError('');
        fetchEntities();
    }, [entityType]);

    useEffect(() => {
        if (!selectedEntityId) {
            setRatingsData(null);
            setRatingsError('');
            return;
        }
        fetchRatings(selectedEntityId);
    }, [selectedEntityId, entityType]);

    const fetchEntities = async () => {
        const config = ENTITY_ENDPOINTS[entityType];
        setLoadingEntities(true);
        try {
            const response = await api.get(`${config.endpoint}?per_page=200`).catch(() => null);
            const list = normalizeCollection(response, config.key);
            const options = list
                .filter((item: any) => item?.id)
                .map((item: any) => {
                    switch (entityType) {
                        case 'doctor':
                            return {
                                id: item.id,
                                name: item.full_name || 'طبيب غير معروف',
                                subtitle: item.specialization?.name_ar || item.account?.email,
                            };
                        case 'nurse':
                            return {
                                id: item.id,
                                name: item.full_name || 'ممرض/ة غير معروف',
                                subtitle: item.graduation_type || item.account?.email,
                            };
                        default:
                            return {
                                id: item.id,
                                name: item.full_name || 'مشفى غير معروف',
                                subtitle: item.account?.email || item.address,
                            };
                    }
                });
            setEntities(options);
        } catch {
            setEntities([]);
        } finally {
            setLoadingEntities(false);
        }
    };

    const fetchRatings = async (entityId: number) => {
        setRatingsLoading(true);
        setRatingsError('');
        try {
            const response = await api.get(`/admin/entity-rates?id=${entityId}&entity=${entityType}`);
            const payload = response?.data || response;
            const ratingsList = toArray<EntityRating>(payload?.ratings);
            setRatingsData({
                avg: Number(payload?.avg_rating) || 0,
                count: Number(payload?.ratings_count) || ratingsList.length,
                ratings: ratingsList,
            });
        } catch (error: any) {
            setRatingsData(null);
            setRatingsError(error?.message || 'فشل تحميل بيانات التقييمات');
        } finally {
            setRatingsLoading(false);
        }
    };

    const filteredEntities = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return entities;
        return entities.filter(
            (entity) =>
                entity.name.toLowerCase().includes(term) ||
                entity.subtitle?.toLowerCase().includes(term),
        );
    }, [entities, searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">تقارير التقييمات</h1>
                    <p className="text-slate-400 text-sm mt-1">
                        راقب رضا المستخدمين عن الأطباء، الممرضين والمشافي
                    </p>
                </div>
                {ratingsData && (
                    <Badge variant="info">
                        متوسط {ratingsData.avg.toFixed(1)} من {ratingsData.count} تقييم
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
                    <label className="text-sm text-slate-400">نوع الكيان</label>
                    <select
                        value={entityType}
                        onChange={(e) => setEntityType(e.target.value as EntityType)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    >
                        <option value="hospital">المشافي</option>
                        <option value="doctor">الأطباء</option>
                        <option value="nurse">الممرضون</option>
                    </select>
                </div>
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
                    <label className="text-sm text-slate-400">بحث بالاسم أو البريد</label>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="اكتب للبحث..."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    />
                </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
                <label className="text-sm text-slate-400">اختر الكيان المطلوب</label>
                {loadingEntities ? (
                    <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400"></div>
                    </div>
                ) : (
                    <select
                        value={selectedEntityId}
                        onChange={(e) =>
                            setSelectedEntityId(e.target.value ? Number(e.target.value) : '')
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    >
                        <option value="">اختر من القائمة ({filteredEntities.length})</option>
                        {filteredEntities.map((entity) => (
                            <option key={entity.id} value={entity.id}>
                                #{entity.id} - {entity.name} {entity.subtitle ? `(${entity.subtitle})` : ''}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {selectedEntityId && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-4">
                    {ratingsLoading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400"></div>
                        </div>
                    ) : ratingsError ? (
                        <div className="text-center py-6 text-rose-400">{ratingsError}</div>
                    ) : ratingsData ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-center">
                                    <p className="text-sm text-slate-400">متوسط التقييم</p>
                                    <p className="text-4xl font-bold text-white mt-2">
                                        {ratingsData.avg.toFixed(1)}
                                    </p>
                                    <p className="text-xs text-slate-500">من 5</p>
                                </div>
                                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-center">
                                    <p className="text-sm text-slate-400">عدد التقييمات</p>
                                    <p className="text-4xl font-bold text-white mt-2">
                                        {ratingsData.count}
                                    </p>
                                </div>
                                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-center">
                                    <p className="text-sm text-slate-400">آخر تحديث</p>
                                    <p className="text-lg font-semibold text-white mt-2">
                                        {new Date().toLocaleDateString('ar-EG')}
                                    </p>
                                </div>
                            </div>

                            {ratingsData.ratings.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    لا توجد تقييمات لهذا الكيان حتى الآن.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-right text-slate-200">
                                        <thead className="bg-slate-900 text-xs uppercase text-slate-400">
                                            <tr>
                                                <th className="px-4 py-3">المستخدم</th>
                                                <th className="px-4 py-3">التقييم</th>
                                                <th className="px-4 py-3">المراجعة</th>
                                                <th className="px-4 py-3">التاريخ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {ratingsData.ratings.map((rating) => (
                                                <tr key={rating.id} className="hover:bg-slate-800/70">
                                                    <td className="px-4 py-3">
                                                        <p className="font-semibold">
                                                            {rating.user?.full_name || `مستخدم #${rating.user_id}`}
                                                        </p>
                                                        <p className="text-xs text-slate-400">
                                                            #{rating.id}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant="warning">
                                                            {rating.rating.toFixed(1)} / 5
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-300">
                                                        {rating.review || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-400">
                                                        {new Date(rating.created_at).toLocaleString('ar-EG')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8 text-slate-400">
                            اختر كياناً لعرض بياناته.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EntityRatingsPage;

