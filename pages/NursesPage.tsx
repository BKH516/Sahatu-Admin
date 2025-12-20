
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Nurse } from '../types';
import api from '../services/api';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { runWithConcurrency, throwIfAborted } from '../utils/async';

const LIST_PAGE_SIZE = 100;
const DATASET_PAGE_SIZE = 200;
const DATASET_CONCURRENCY = 4;
const SEARCH_DEBOUNCE_MS = 350;

interface PaginatedNurses {
    items: Nurse[];
    currentPage: number;
    lastPage: number;
    total: number;
    perPage: number;
}

interface ListState {
    data: Nurse[];
    loading: boolean;
    totalPages: number;
    total: number;
}

interface SearchState {
    active: boolean;
    loading: boolean;
    data: Nurse[];
    total: number;
    error: string;
}

const toQueryString = (params: Record<string, string | number | undefined>) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.append(key, String(value));
        }
    });
    return searchParams.toString();
};

const extractNursesPayload = (response: any): PaginatedNurses => {
    const candidates = [response?.nurses, response?.data, response];

    let container = candidates.find(
        (candidate) => candidate !== undefined && candidate !== null,
    );

    if (container && typeof container === 'object' && 'nurses' in container) {
        container = container.nurses;
    }

    let data: Nurse[] = [];

    if (Array.isArray(container?.data)) {
        data = container.data as Nurse[];
    } else if (Array.isArray(container)) {
        data = container as Nurse[];
    } else if (Array.isArray(response?.nurses?.data)) {
        data = response.nurses.data as Nurse[];
    } else if (Array.isArray(response?.data?.data)) {
        data = response.data.data as Nurse[];
    } else if (Array.isArray(response?.data)) {
        data = response.data as Nurse[];
    } else if (Array.isArray(response)) {
        data = response as Nurse[];
    }

    const currentPage =
        container?.current_page ??
        response?.current_page ??
        response?.data?.current_page ??
        1;

    const lastPage =
        container?.last_page ??
        response?.last_page ??
        response?.data?.last_page ??
        currentPage;

    const total =
        container?.total ??
        response?.total ??
        response?.data?.total ??
        data.length;

    const perPage =
        container?.per_page ??
        response?.per_page ??
        response?.data?.per_page ??
        data.length;

    return {
        items: data,
        currentPage: Number(currentPage) || 1,
        lastPage: Number(lastPage) || 1,
        total: Number(total) || data.length,
        perPage: Number(perPage) || data.length,
    };
};

const nurseMatchesQuery = (nurse: Nurse, query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;

    const fields = [
        nurse.full_name,
        nurse.account?.email,
        nurse.account?.phone_number,
        nurse.graduation_type,
    ];

    return fields
        .filter((value): value is string => !!value)
        .some((value) => value.toLowerCase().includes(normalized));
};

const NursesPage: React.FC = () => {
    const navigate = useNavigate();

    const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);
    const [listPage, setListPage] = useState(1);
    const [listState, setListState] = useState<ListState>({
        data: [],
        loading: true,
        totalPages: 1,
        total: 0,
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [searchState, setSearchState] = useState<SearchState>({
        active: false,
        loading: false,
        data: [],
        total: 0,
        error: '',
    });
    const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0 });

    const datasetCacheRef = useRef<Nurse[] | null>(null);
    const datasetPromiseRef = useRef<Promise<Nurse[]> | null>(null);
    const searchAbortRef = useRef<AbortController | null>(null);

    const fetchNursesPage = useCallback(
        async (page: number, perPage: number, signal?: AbortSignal): Promise<PaginatedNurses> => {
            const query = toQueryString({ page, per_page: perPage });
            const response = await api.get(`/admin/nurse/all?${query}`, { signal });
            return extractNursesPayload(response);
        },
        [],
    );

    const loadEntireDataset = useCallback(
        async (options?: { signal?: AbortSignal; onProgress?: (current: number, total: number) => void }): Promise<Nurse[]> => {
            const signal = options?.signal;
            const onProgress = options?.onProgress;

            if (datasetCacheRef.current) {
                onProgress?.(datasetCacheRef.current.length ? 1 : 0, 1);
                return datasetCacheRef.current;
            }

            if (datasetPromiseRef.current) {
                return datasetPromiseRef.current;
            }

            const promise = (async () => {
                throwIfAborted(signal);
                const aggregated: Nurse[] = [];

                const {
                    items: firstItems,
                    lastPage: firstLastPage,
                    total: firstTotal,
                    perPage: firstPerPage,
                } = await fetchNursesPage(1, DATASET_PAGE_SIZE, signal);

                aggregated.push(...firstItems);

                const effectivePerPage = firstPerPage || DATASET_PAGE_SIZE;
                const totalRecords = firstTotal || aggregated.length;
                const estimatedTotalPages =
                    effectivePerPage > 0 ? Math.ceil(totalRecords / effectivePerPage) : 1;
                const targetLastPage = Math.max(firstLastPage || 1, estimatedTotalPages || 1);

                onProgress?.(Math.min(1, targetLastPage), targetLastPage);

                if (targetLastPage > 1) {
                    const remainingPages = Array.from({ length: targetLastPage - 1 }, (_, index) => index + 2);
                    let completed = 1;

                    const pageChunks = await runWithConcurrency(
                        remainingPages,
                        DATASET_CONCURRENCY,
                        async (page) => {
                            throwIfAborted(signal);
                            const { items } = await fetchNursesPage(page, DATASET_PAGE_SIZE, signal);
                            completed += 1;
                            onProgress?.(Math.min(completed, targetLastPage), targetLastPage);
                            return items;
                        },
                    );

                    pageChunks.forEach((pageItems) => {
                        aggregated.push(...pageItems);
                    });
                }

                datasetCacheRef.current = aggregated;
                return aggregated;
            })();

            datasetPromiseRef.current = promise;

            try {
                const result = await promise;
                datasetPromiseRef.current = null;
                return result;
            } catch (error) {
                datasetPromiseRef.current = null;
                if (!signal?.aborted) {
                    datasetCacheRef.current = null;
                }
                throw error;
            }
        },
        [fetchNursesPage],
    );

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm.trim());
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => {
        if (debouncedSearchTerm) {
            if (searchAbortRef.current) {
                searchAbortRef.current.abort();
            }

            const controller = new AbortController();
            searchAbortRef.current = controller;

            setSearchState({
                active: true,
                loading: true,
                data: [],
                total: 0,
                error: '',
            });
            setSearchProgress({ current: 0, total: 0 });

            const handleProgress = (current: number, total: number) => {
                if (controller.signal.aborted) return;
                setSearchProgress({ current, total });
            };

            loadEntireDataset({ signal: controller.signal, onProgress: handleProgress })
                .then((dataset) => {
                    if (controller.signal.aborted) return;
                    const results = dataset.filter((nurse) =>
                        nurseMatchesQuery(nurse, debouncedSearchTerm),
                    );
                    setSearchState({
                        active: true,
                        loading: false,
                        data: results,
                        total: results.length,
                        error: '',
                    });
                })
                .catch(() => {
                    if (controller.signal.aborted) return;
                    setSearchState({
                        active: true,
                        loading: false,
                        data: [],
                        total: 0,
                        error: 'تعذر تحميل البيانات. يرجى المحاولة مرة أخرى.',
                    });
                })
                .finally(() => {
                    if (searchAbortRef.current === controller) {
                        searchAbortRef.current = null;
                    }
                });

            return () => controller.abort();
        }

        if (searchAbortRef.current) {
            searchAbortRef.current.abort();
            searchAbortRef.current = null;
        }

        setSearchState({
            active: false,
            loading: false,
            data: [],
            total: 0,
            error: '',
        });
        setSearchProgress({ current: 0, total: 0 });
    }, [debouncedSearchTerm, loadEntireDataset]);

    useEffect(() => {
        if (debouncedSearchTerm) {
            return;
        }

        const controller = new AbortController();

        setListState((prev) => ({
            ...prev,
            loading: true,
        }));

        fetchNursesPage(listPage, LIST_PAGE_SIZE, controller.signal)
            .then(({ items, lastPage, total }) => {
                if (controller.signal.aborted) return;
                setListState({
                    data: items,
                    loading: false,
                    totalPages: lastPage,
                    total,
                });
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                setListState((prev) => ({
                    ...prev,
                    loading: false,
                }));
            });

        return () => controller.abort();
    }, [debouncedSearchTerm, listPage, fetchNursesPage]);

    useEffect(() => {
        if (debouncedSearchTerm || datasetCacheRef.current || datasetPromiseRef.current) {
            return;
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
            loadEntireDataset({ signal: controller.signal }).catch(() => {
                controller.abort();
            });
        }, 800);

        return () => {
            controller.abort();
            window.clearTimeout(timeoutId);
        };
    }, [debouncedSearchTerm, loadEntireDataset]);

    const handlePageChange = (page: number) => {
        if (searchState.active) return;
        if (page >= 1 && page <= listState.totalPages) {
            setListPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const totalCount = searchState.active ? searchState.total : listState.total;
    const tableData = searchState.active ? searchState.data : listState.data;
    const tableLoading = searchState.active ? searchState.loading : listState.loading;
    const tableEmptyMessage = searchState.active
        ? searchState.loading
            ? 'جاري البحث في الممرضين...'
            : searchState.error || 'لم يتم العثور على نتائج مطابقة.'
        : 'لا يوجد ممرضون لعرضهم';

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">إدارة الممرضين</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1 md:mt-2">
                        إدارة ومراقبة جميع الممرضين المسجلين في النظام
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="info" size="lg">
                        {tableLoading ? '...' : `${totalCount} ممرض/ة`}
                    </Badge>
                </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث في جميع الممرضين بالاسم، البريد، الهاتف، المؤهل..."
                    icon={
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    }
                />
                {debouncedSearchTerm && (
                    <div className="mt-2 text-sm text-slate-400">
                        {searchState.loading ? (
                            <div className="space-y-2">
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    جاري البحث في جميع الصفحات...
                                </span>
                                {searchProgress.total > 0 && (
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
                                                style={{ width: `${(searchProgress.current / searchProgress.total) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs text-slate-500 min-w-[80px] text-right">
                                            {searchProgress.current} / {searchProgress.total}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                {searchState.total > 0
                                    ? `تم العثور على ${searchState.total} نتيجة مطابقة`
                                    : 'لم يتم العثور على نتائج مطابقة'}
                            </span>
                        )}
                        {searchState.error && (
                            <span className="mt-1 text-sm text-red-400 block">{searchState.error}</span>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-slate-300">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-800">
                            <tr>
                                <th scope="col" className="px-6 py-3">الاسم الكامل</th>
                                <th scope="col" className="px-6 py-3">البريد الإلكتروني</th>
                                <th scope="col" className="px-6 py-3">رقم الهاتف</th>
                                <th scope="col" className="px-6 py-3">المؤهل</th>
                                <th scope="col" className="px-6 py-3">التقييم</th>
                                <th scope="col" className="px-6 py-3">الحالة</th>
                                <th scope="col" className="px-6 py-3">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableLoading ? (
                                <tr><td colSpan={7} className="text-center p-8">جاري التحميل...</td></tr>
                            ) : tableData.length > 0 ? (
                                tableData.map((nurse) => (
                                    <tr key={nurse.id} className="border-b border-slate-700 hover:bg-slate-800">
                                        <td className="px-6 py-4 font-medium">{nurse.full_name}</td>
                                        <td className="px-6 py-4">{nurse.account?.email || '-'}</td>
                                        <td className="px-6 py-4">{nurse.account?.phone_number || '-'}</td>
                                        <td className="px-6 py-4">{nurse.graduation_type || '-'}</td>
                                        <td className="px-6 py-4">
                                            {nurse.avg_rating !== undefined && nurse.avg_rating !== null ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-yellow-400 font-semibold">
                                                        {nurse.avg_rating.toFixed(1)}
                                                    </span>
                                                    <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                    {nurse.ratings_count !== undefined && nurse.ratings_count !== null && (
                                                        <span className="text-slate-400 text-xs">
                                                            ({nurse.ratings_count})
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-500 text-sm">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs rounded-full ${nurse.is_active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                                {nurse.is_active ? 'نشط' : 'غير نشط'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => setSelectedNurse(nurse)}
                                                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-1"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                عرض التفاصيل
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={7} className="text-center p-8">
                                    {tableEmptyMessage}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {!searchState.active && listState.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-sm text-slate-400">
                        الصفحة {listPage} من {listState.totalPages} ({listState.total} ممرض/ة إجمالاً)
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePageChange(1)}
                            disabled={listPage === 1 || listState.loading}
                        >
                            الأولى
                        </Button>

                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePageChange(listPage - 1)}
                            disabled={listPage === 1 || listState.loading}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                </svg>
                            }
                        >
                            السابقة
                        </Button>

                        <div className="hidden sm:flex items-center gap-1">
                            {Array.from({ length: Math.min(5, listState.totalPages) }, (_, i) => {
                                let pageNum;
                                if (listState.totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (listPage <= 3) {
                                    pageNum = i + 1;
                                } else if (listPage >= listState.totalPages - 2) {
                                    pageNum = listState.totalPages - 4 + i;
                                } else {
                                    pageNum = listPage - 2 + i;
                                }

                                return (
                                    <Button
                                        key={pageNum}
                                        variant={listPage === pageNum ? 'primary' : 'secondary'}
                                        size="sm"
                                        onClick={() => handlePageChange(pageNum)}
                                        disabled={listState.loading}
                                        className="min-w-[40px]"
                                    >
                                        {pageNum}
                                    </Button>
                                );
                            })}
                        </div>

                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePageChange(listPage + 1)}
                            disabled={listPage === listState.totalPages || listState.loading}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            }
                        >
                            التالية
                        </Button>

                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePageChange(listState.totalPages)}
                            disabled={listPage === listState.totalPages || listState.loading}
                        >
                            الأخيرة
                        </Button>
                    </div>
                </div>
            )}

            {/* Nurse Details Modal */}
            <Modal
                isOpen={!!selectedNurse}
                onClose={() => setSelectedNurse(null)}
                title="تفاصيل الممرض/ة"
                size="lg"
            >
                {selectedNurse && (
                    <div className="space-y-6">
                        {/* Profile Header */}
                        <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-xl p-4 sm:p-6 border border-emerald-500/30">
                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                <div className="flex-shrink-0">
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center border-4 border-emerald-400 shadow-lg shadow-emerald-500/50">
                                        <svg className="w-12 h-12 sm:w-16 sm:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="flex-1 text-center sm:text-right space-y-2">
                                    <h2 className="text-2xl sm:text-3xl font-bold text-white">
                                        {selectedNurse.full_name}
                                    </h2>
                                    <div className="flex items-center justify-center sm:justify-start gap-2">
                                        <Badge variant="success" size="lg">
                                            <span className="flex items-center gap-2">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                </svg>
                                                {selectedNurse.graduation_type}
                                            </span>
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Personal Information */}
                        <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700/50">
                            <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                المعلومات الشخصية
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <DetailItem label="الاسم الكامل" value={selectedNurse.full_name} />
                                <DetailItem label="البريد الإلكتروني" value={selectedNurse.account?.email || 'غير متوفر'} />
                                <DetailItem label="رقم الهاتف" value={selectedNurse.account?.phone_number || 'غير متوفر'} />
                                <DetailItem label="العنوان" value={selectedNurse.address || 'غير متوفر'} />
                                {selectedNurse.age && (
                                    <DetailItem label="العمر" value={`${selectedNurse.age} سنة`} />
                                )}
                                <DetailItem 
                                    label="الجنس" 
                                    value={selectedNurse.gender === 'male' ? 'ذكر' : 'أنثى'} 
                                />
                            </div>
                        </div>

                        {/* Professional Information */}
                        <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700/50">
                            <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                المعلومات المهنية
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <DetailItem 
                                    label="نوع التخرج" 
                                    value={
                                        <Badge variant="success" size="md">
                                            {selectedNurse.graduation_type}
                                        </Badge>
                                    } 
                                />
                                <DetailItem 
                                    label="الحالة" 
                                    value={
                                        <Badge variant={selectedNurse.is_active ? 'success' : 'danger'} size="md">
                                            {selectedNurse.is_active ? 'نشط' : 'غير نشط'}
                                        </Badge>
                                    } 
                                />
                                {selectedNurse.avg_rating !== undefined && selectedNurse.avg_rating !== null && (
                                    <DetailItem 
                                        label="التقييم" 
                                        value={
                                            <div className="flex items-center gap-2">
                                                <span className="text-yellow-400 font-semibold">
                                                    {selectedNurse.avg_rating.toFixed(1)}
                                                </span>
                                                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                {selectedNurse.ratings_count && (
                                                    <span className="text-slate-400 text-sm">
                                                        ({selectedNurse.ratings_count} تقييم)
                                                    </span>
                                                )}
                                            </div>
                                        } 
                                    />
                                )}
                            </div>
                            {selectedNurse.profile_description && (
                                <div className="mt-4">
                                    <DetailItem 
                                        label="الوصف الشخصي" 
                                        value={selectedNurse.profile_description} 
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

interface DetailItemProps {
    label: string;
    value: React.ReactNode;
}

const DetailItem: React.FC<DetailItemProps> = ({ label, value }) => (
    <div className="space-y-1">
        <p className="text-xs sm:text-sm text-slate-400 font-medium">{label}</p>
        <p className="text-sm sm:text-base text-white font-semibold">
            {value || <span className="text-slate-500">غير متوفر</span>}
        </p>
    </div>
);

export default NursesPage;
