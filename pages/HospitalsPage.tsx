import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hospital } from '../types';
import api from '../services/api';
import Table, { Column } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { useToast } from '../hooks/useToast';
import Toast from '../components/ui/Toast';
import { runWithConcurrency, throwIfAborted } from '../utils/async';

const LIST_PAGE_SIZE = 25;
const DATASET_PAGE_SIZE = 200;
const SEARCH_DEBOUNCE_MS = 350;
const DATASET_CONCURRENCY = 4;

interface PaginatedHospitals {
    items: Hospital[];
    currentPage: number;
    lastPage: number;
    total: number;
    perPage: number;
}

interface ListState {
    data: Hospital[];
    loading: boolean;
    totalPages: number;
    total: number;
}

interface SearchState {
    active: boolean;
    loading: boolean;
    data: Hospital[];
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

const extractHospitalsPayload = (response: any): PaginatedHospitals => {
    const candidates = [response?.hospitals, response?.data, response];

    let container = candidates.find(
        (candidate) => candidate !== undefined && candidate !== null,
    );

    if (container && typeof container === 'object' && 'hospitals' in container) {
        container = container.hospitals;
    }

    let data: Hospital[] = [];

    if (Array.isArray(container?.data)) {
        data = container.data as Hospital[];
    } else if (Array.isArray(container)) {
        data = container as Hospital[];
    } else if (Array.isArray(response?.hospitals?.data)) {
        data = response.hospitals.data as Hospital[];
    } else if (Array.isArray(response?.data?.data)) {
        data = response.data.data as Hospital[];
    } else if (Array.isArray(response?.data)) {
        data = response.data as Hospital[];
    } else if (Array.isArray(response)) {
        data = response as Hospital[];
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

const hospitalMatchesQuery = (hospital: Hospital, query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;

    const fields = [
        hospital.full_name,
        hospital.account?.email,
        hospital.account?.phone_number,
        hospital.address,
    ];

    return fields
        .filter((value): value is string => !!value)
        .some((value) => value.toLowerCase().includes(normalized));
};

const HospitalsPage: React.FC = () => {
    const navigate = useNavigate();
    const { toasts, removeToast, success, error, warning } = useToast();

    const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newHospitalName, setNewHospitalName] = useState('');
    const [creating, setCreating] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [createdHospitalData, setCreatedHospitalData] = useState<any>(null);

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

    const [datasetVersion, setDatasetVersion] = useState(0);
    const datasetCacheRef = useRef<Hospital[] | null>(null);
    const datasetPromiseRef = useRef<Promise<Hospital[]> | null>(null);
    const searchAbortRef = useRef<AbortController | null>(null);

    const fetchHospitalsPage = useCallback(
        async (page: number, perPage: number, signal?: AbortSignal): Promise<PaginatedHospitals> => {
            const query = toQueryString({ page, per_page: perPage });
            const response = await api.get(`/admin/hospital/all?${query}`, { signal });
            return extractHospitalsPayload(response);
        },
        [],
    );

    const loadEntireDataset = useCallback(
        async (signal?: AbortSignal): Promise<Hospital[]> => {
            if (datasetCacheRef.current) {
                return datasetCacheRef.current;
            }

            if (datasetPromiseRef.current) {
                return datasetPromiseRef.current;
            }

            const promise = (async () => {
                throwIfAborted(signal);
                const aggregated: Hospital[] = [];

                const {
                    items: firstItems,
                    lastPage: firstLastPage,
                    total: firstTotal,
                    perPage: firstPerPage,
                } = await fetchHospitalsPage(1, DATASET_PAGE_SIZE, signal);

                aggregated.push(...firstItems);

                const effectivePerPage = firstPerPage || DATASET_PAGE_SIZE;
                const totalRecords = firstTotal || aggregated.length;
                const estimatedTotalPages =
                    effectivePerPage > 0 ? Math.ceil(totalRecords / effectivePerPage) : 1;
                const targetLastPage = Math.max(firstLastPage || 1, estimatedTotalPages || 1);

                if (targetLastPage > 1) {
                    const remainingPages = Array.from({ length: targetLastPage - 1 }, (_, index) => index + 2);

                    const pageChunks = await runWithConcurrency(
                        remainingPages,
                        DATASET_CONCURRENCY,
                        async (page) => {
                            throwIfAborted(signal);
                            const { items } = await fetchHospitalsPage(page, DATASET_PAGE_SIZE, signal);
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
            } catch (err) {
                datasetPromiseRef.current = null;
                if (!signal?.aborted) {
                    datasetCacheRef.current = null;
                }
                throw err;
            }
        },
        [fetchHospitalsPage, datasetVersion],
    );

    const invalidateDataset = useCallback(() => {
        datasetCacheRef.current = null;
        datasetPromiseRef.current = null;
        setDatasetVersion((prev) => prev + 1);
    }, []);

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

            loadEntireDataset(controller.signal)
                .then((dataset) => {
                    if (controller.signal.aborted) return;
                    const results = dataset.filter((hospital) =>
                        hospitalMatchesQuery(hospital, debouncedSearchTerm),
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
    }, [debouncedSearchTerm, loadEntireDataset, datasetVersion]);

    useEffect(() => {
        if (debouncedSearchTerm || datasetCacheRef.current || datasetPromiseRef.current) {
            return;
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
            loadEntireDataset(controller.signal).catch(() => {
                controller.abort();
            });
        }, 800);

        return () => {
            controller.abort();
            window.clearTimeout(timeoutId);
        };
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

        fetchHospitalsPage(listPage, LIST_PAGE_SIZE, controller.signal)
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
    }, [debouncedSearchTerm, listPage, fetchHospitalsPage]);

    const handlePageChange = (page: number) => {
        if (searchState.active) return;
        if (page >= 1 && page <= listState.totalPages) {
            setListPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleCreateHospital = async () => {
        if (!newHospitalName.trim()) {
            warning('يرجى إدخال اسم المشفى');
            return;
        }

        setCreating(true);

        try {
            const formData = new FormData();
            formData.append('hospital_name', newHospitalName);

            const response = await api.post('/admin/create-hospital-account', formData);

            if (!response) {
                throw new Error('لم يتم استلام رد من الخادم');
            }

            setCreatedHospitalData(response);
            success('تم إنشاء حساب المشفى بنجاح');
            setNewHospitalName('');
            setIsModalOpen(false);
            setIsSuccessModalOpen(true);
            invalidateDataset();
            setListPage(1);
        } catch (err: any) {
            let errorMessage = err?.message || 'حدث خطأ غير متوقع';

            if (err?.message === 'Validation failed' || errorMessage.includes('Validation failed')) {
                errorMessage = 'اسم المشفى موجود مسبقاً أو البيانات غير صحيحة';
            } else if (errorMessage.includes('already been taken')) {
                errorMessage = 'اسم المشفى موجود مسبقاً، يرجى استخدام اسم آخر';
            }

            error(errorMessage);
        } finally {
            setCreating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                success('تم نسخ الرمز بنجاح');
            })
            .catch(() => {
                error('فشل نسخ الرمز');
            });
    };

    const columns: Column<Hospital>[] = [
        {
            header: 'اسم المشفى',
            accessor: (row) => row.full_name || 'غير محدد',
            sortable: true,
            className: 'font-medium text-white',
        },
        {
            header: 'البريد الإلكتروني',
            accessor: (row) => row.account?.email || '-',
        },
        {
            header: 'رقم الهاتف',
            accessor: (row) => row.account?.phone_number || '-',
        },
        {
            header: 'العنوان',
            accessor: (row) => (
                <div className="max-w-xs truncate" title={row.address || 'غير محدد'}>
                    {row.address || '-'}
                </div>
            ),
        },
        {
            header: 'التقييم',
            accessor: (row) => (
                <div className="flex items-center gap-2">
                    {row.avg_rating !== undefined && row.avg_rating !== null ? (
                        <>
                            <span className="text-yellow-400 font-semibold">
                                {row.avg_rating.toFixed(1)}
                            </span>
                            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {row.ratings_count !== undefined && row.ratings_count !== null && (
                                <span className="text-slate-400 text-xs">
                                    ({row.ratings_count})
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="text-slate-500 text-sm">-</span>
                    )}
                </div>
            ),
        },
        {
            header: 'الإجراءات',
            accessor: (row) => (
                <Button
                    size="sm"
                    variant="primary"
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHospital(row);
                    }}
                    icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    }
                >
                    عرض التفاصيل
                </Button>
            ),
        },
    ];

    const totalCount = searchState.active ? searchState.total : listState.total;
    const tableData = searchState.active ? searchState.data : listState.data;
    const tableLoading = searchState.active ? searchState.loading : listState.loading;
    const tableEmptyMessage = searchState.active
        ? searchState.loading
            ? 'جاري البحث في المشافي...'
            : searchState.error || 'لم يتم العثور على نتائج مطابقة.'
        : 'لا توجد مشافي مسجلة';

    const tableItemsPerPage = searchState.active
        ? Math.max(tableData.length, 1)
        : LIST_PAGE_SIZE;

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">إدارة المشافي</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1 md:mt-2">إدارة ومراقبة جميع المشافي المسجلة في النظام</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <Badge variant="info" size="lg">
                        {tableLoading ? '...' : `${totalCount} مشفى`}
                    </Badge>
                    <Button
                        variant="primary"
                        size="md"
                        icon={
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        }
                        onClick={() => setIsModalOpen(true)}
                    >
                        <span className="hidden sm:inline">إضافة مشفى</span>
                        <span className="sm:hidden">إضافة</span>
                    </Button>
                </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث في جميع المشافي بالاسم، البريد، الهاتف..."
                    icon={
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    }
                />
                {debouncedSearchTerm && (
                    <div className="mt-2 text-sm text-slate-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        {searchState.loading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                </svg>
                                جاري تحميل جميع المشافي لضمان دقة النتائج...
                            </span>
                        ) : (
                            <span>
                                {searchState.total > 0
                                    ? `تم العثور على ${searchState.total} مشفى مطابق`
                                    : 'لم يتم العثور على نتائج مطابقة'}
                            </span>
                        )}
                        {searchState.error && (
                            <span className="text-red-400">{searchState.error}</span>
                        )}
                    </div>
                )}
            </div>

            <Table
                key={searchState.active ? 'search-results' : `page-${listPage}`}
                data={tableData}
                columns={columns}
                loading={tableLoading}
                searchable={false}
                emptyMessage={tableEmptyMessage}
                itemsPerPage={tableItemsPerPage}
                onRowClick={(hospital) => navigate(`/hospitals/${hospital.id}`)}
            />

            {!searchState.active && listState.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-sm text-slate-400">
                        الصفحة {listPage} من {listState.totalPages} ({listState.total} مشفى إجمالاً)
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

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setNewHospitalName('');
                }}
                title="إنشاء حساب مشفى جديد"
                footer={
                    <div className="flex gap-3 justify-end">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                            إلغاء
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleCreateHospital}
                            isLoading={creating}
                        >
                            إنشاء المشفى
                        </Button>
                    </div>
                }
            >
                <Input
                    label="اسم المشفى"
                    value={newHospitalName}
                    onChange={(e) => setNewHospitalName(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' && !creating) {
                            handleCreateHospital();
                        }
                    }}
                    placeholder="أدخل اسم المشفى"
                    disabled={creating}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    }
                />
            </Modal>

            <Modal
                isOpen={isSuccessModalOpen}
                onClose={() => {
                    setIsSuccessModalOpen(false);
                    setCreatedHospitalData(null);
                }}
                title="✅ تم إنشاء حساب المشفى بنجاح"
                footer={
                    <div className="flex gap-3 justify-end">
                        <Button
                            variant="primary"
                            onClick={() => {
                                setIsSuccessModalOpen(false);
                                setCreatedHospitalData(null);
                            }}
                        >
                            تم
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <p className="text-slate-300 text-center mb-2">
                            تم إنشاء حساب المشفى بنجاح. يمكن للمشفى تسجيل الدخول باستخدام الرمز الفريد التالي:
                        </p>
                    </div>

                    {createdHospitalData && (
                        <>
                            {(createdHospitalData.hospital?.full_name || createdHospitalData.full_name) && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-400">
                                        اسم المشفى
                                    </label>
                                    <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3">
                                        <p className="text-white font-medium text-center">
                                            {createdHospitalData.hospital?.full_name || createdHospitalData.full_name}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {(createdHospitalData.account?.email || createdHospitalData.email) && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-400">
                                        البريد الإلكتروني
                                    </label>
                                    <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 flex items-center justify-between">
                                        <p className="text-white font-mono">
                                            {createdHospitalData.account?.email || createdHospitalData.email}
                                        </p>
                                        <button
                                            onClick={() =>
                                                copyToClipboard(createdHospitalData.account?.email || createdHospitalData.email)
                                            }
                                            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded-md text-sm transition-colors"
                                        >
                                            نسخ
                                        </button>
                                    </div>
                                </div>
                            )}

                            {(createdHospitalData.unique_code || createdHospitalData.code || createdHospitalData.password) && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-400">
                                        الرمز الفريد / كلمة المرور
                                    </label>
                                    <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/50 rounded-lg p-4 flex items-center justify-between">
                                        <p className="text-white font-mono text-lg font-bold">
                                            {createdHospitalData.unique_code || createdHospitalData.code || createdHospitalData.password}
                                        </p>
                                        <button
                                            onClick={() =>
                                                copyToClipboard(
                                                    createdHospitalData.unique_code ||
                                                    createdHospitalData.code ||
                                                    createdHospitalData.password
                                                )
                                            }
                                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-medium transition-colors flex items-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            نسخ
                                        </button>
                                    </div>
                                </div>
                            )}

                            {(createdHospitalData.account?.phone_number || createdHospitalData.phone_number) && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-400">
                                        رقم الهاتف
                                    </label>
                                    <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 flex items-center justify-between">
                                        <p className="text-white font-mono">
                                            {createdHospitalData.account?.phone_number || createdHospitalData.phone_number}
                                        </p>
                                        <button
                                            onClick={() =>
                                                copyToClipboard(
                                                    createdHospitalData.account?.phone_number ||
                                                    createdHospitalData.phone_number
                                                )
                                            }
                                            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded-md text-sm transition-colors"
                                        >
                                            نسخ
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mt-4">
                                <div className="flex items-start gap-3">
                                    <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <p className="text-yellow-200 text-sm">
                                        <strong>تنبيه مهم:</strong> يرجى حفظ الرمز الفريد وإرساله للمشفى. لن تتمكن من رؤيته مرة أخرى!
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                    {createdHospitalData &&
                        !createdHospitalData.unique_code &&
                        !createdHospitalData.code &&
                        !createdHospitalData.password && (
                            <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 mt-4">
                                <p className="text-slate-400 text-sm mb-2">معلومات المشفى المُنشأ:</p>
                                <pre className="text-xs text-slate-300 overflow-auto max-h-60">
                                    {JSON.stringify(createdHospitalData, null, 2)}
                                </pre>
                            </div>
                        )}
                </div>
            </Modal>

            {/* Hospital Details Modal */}
            <Modal
                isOpen={!!selectedHospital}
                onClose={() => setSelectedHospital(null)}
                title="تفاصيل المشفى"
                size="lg"
            >
                {selectedHospital && (
                    <div className="space-y-6">
                        {/* Profile Header */}
                        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-4 sm:p-6 border border-purple-500/30">
                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                <div className="flex-shrink-0">
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center border-4 border-purple-400 shadow-lg shadow-purple-500/50">
                                        <svg className="w-12 h-12 sm:w-16 sm:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="flex-1 text-center sm:text-right space-y-2">
                                    <h2 className="text-2xl sm:text-3xl font-bold text-white">
                                        {selectedHospital.full_name || 'غير محدد'}
                                    </h2>
                                </div>
                            </div>
                        </div>

                        {/* Basic Information */}
                        <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700/50">
                            <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                المعلومات الأساسية
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <DetailItem label="اسم المشفى" value={selectedHospital.full_name || 'غير متوفر'} />
                                <DetailItem label="البريد الإلكتروني" value={selectedHospital.account?.email || 'غير متوفر'} />
                                <DetailItem label="رقم الهاتف" value={selectedHospital.account?.phone_number || 'غير متوفر'} />
                                <DetailItem label="العنوان" value={selectedHospital.address || 'غير متوفر'} />
                                {selectedHospital.avg_rating !== undefined && selectedHospital.avg_rating !== null && (
                                    <DetailItem 
                                        label="التقييم" 
                                        value={
                                            <div className="flex items-center gap-2">
                                                <span className="text-yellow-400 font-semibold">
                                                    {selectedHospital.avg_rating.toFixed(1)}
                                                </span>
                                                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                {selectedHospital.ratings_count && (
                                                    <span className="text-slate-400 text-sm">
                                                        ({selectedHospital.ratings_count} تقييم)
                                                    </span>
                                                )}
                                            </div>
                                        } 
                                    />
                                )}
                                {selectedHospital.created_at && (
                                    <DetailItem 
                                        label="تاريخ التسجيل" 
                                        value={new Date(selectedHospital.created_at).toLocaleDateString('ar-EG', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })} 
                                    />
                                )}
                            </div>
                        </div>

                        {/* Services */}
                        {selectedHospital.services_2 && selectedHospital.services_2.length > 0 && (
                            <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700/50">
                                <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    الخدمات
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {selectedHospital.services_2.map((service) => (
                                        <div key={service.id} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                                            <div className="font-semibold text-white mb-1">{service.service_name}</div>
                                            <div className="text-sm text-slate-400">
                                                السعر: {service.pivot.price} ل.س | السعة: {service.pivot.capacity}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Work Schedule */}
                        {selectedHospital.work_schedule && selectedHospital.work_schedule.length > 0 && (
                            <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700/50">
                                <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    الجدول الزمني
                                </h3>
                                <div className="space-y-2">
                                    {selectedHospital.work_schedule.map((schedule) => {
                                        const days = {
                                            sunday: 'الأحد',
                                            monday: 'الإثنين',
                                            tuesday: 'الثلاثاء',
                                            wednesday: 'الأربعاء',
                                            thursday: 'الخميس',
                                            friday: 'الجمعة',
                                            saturday: 'السبت'
                                        };
                                        return (
                                            <div key={schedule.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
                                                <span className="font-medium text-white">{days[schedule.day_of_week]}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {toasts.map((toast, index) => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    duration={toast.duration}
                    offset={index}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
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

export default HospitalsPage;