
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Doctor } from '../types';
import api from '../services/api';
import Table, { Column } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { runWithConcurrency, throwIfAborted } from '../utils/async';

const LIST_PAGE_SIZE = 25;
const DATASET_PAGE_SIZE = 200;
const SEARCH_DEBOUNCE_MS = 350;
const DATASET_CONCURRENCY = 4;

interface PaginatedDoctors {
    items: Doctor[];
    currentPage: number;
    lastPage: number;
    total: number;
    perPage: number;
}

interface ListState {
    data: Doctor[];
    loading: boolean;
    totalPages: number;
    total: number;
}

interface SearchState {
    active: boolean;
    loading: boolean;
    data: Doctor[];
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

const extractDoctorsPayload = (response: any): PaginatedDoctors => {
    const candidates = [
        response?.doctors,
        response?.data,
        response,
    ];

    let container = candidates.find(
        (candidate) => candidate !== undefined && candidate !== null,
    );

    if (container && typeof container === 'object' && 'doctors' in container) {
        // في بعض الاستجابات يكون هناك تداخل إضافي
        container = container.doctors;
    }

    let data: Doctor[] = [];

    if (Array.isArray(container?.data)) {
        data = container.data as Doctor[];
    } else if (Array.isArray(container)) {
        data = container as Doctor[];
    } else if (Array.isArray(response?.doctors?.data)) {
        data = response.doctors.data as Doctor[];
    } else if (Array.isArray(response?.data?.data)) {
        data = response.data.data as Doctor[];
    } else if (Array.isArray(response?.data)) {
        data = response.data as Doctor[];
    } else if (Array.isArray(response)) {
        data = response as Doctor[];
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

const doctorMatchesQuery = (doctor: Doctor, query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;

    const fields = [
        doctor.full_name,
        doctor.account?.email,
        doctor.account?.phone_number,
        doctor.specialization?.name_ar,
        doctor.specialization?.name_en,
        doctor.address,
    ];

    return fields
        .filter((value): value is string => !!value)
        .some((value) => value.toLowerCase().includes(normalized));
};

const DoctorsPage: React.FC = () => {
    const navigate = useNavigate();

    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
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
    const datasetCacheRef = useRef<Doctor[] | null>(null);
    const datasetPromiseRef = useRef<Promise<Doctor[]> | null>(null);
    const searchAbortRef = useRef<AbortController | null>(null);

    const fetchDoctorsPage = useCallback(
        async (page: number, perPage: number, signal?: AbortSignal): Promise<PaginatedDoctors> => {
            const query = toQueryString({ page, per_page: perPage });
            const response = await api.get(`/admin/doctor/all?${query}`, { signal });
            return extractDoctorsPayload(response);
        },
        [],
    );

    const loadEntireDataset = useCallback(
        async (signal?: AbortSignal): Promise<Doctor[]> => {
            if (datasetCacheRef.current) {
                return datasetCacheRef.current;
            }

            if (datasetPromiseRef.current) {
                return datasetPromiseRef.current;
            }

            const promise = (async () => {
                throwIfAborted(signal);
                const aggregated: Doctor[] = [];

                const {
                    items: firstItems,
                    lastPage: firstLastPage,
                    total: firstTotal,
                    perPage: firstPerPage,
                } = await fetchDoctorsPage(1, DATASET_PAGE_SIZE, signal);

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
                            const { items } = await fetchDoctorsPage(page, DATASET_PAGE_SIZE, signal);
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
        [fetchDoctorsPage, datasetVersion],
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

            loadEntireDataset(controller.signal)
                .then((dataset) => {
                    if (controller.signal.aborted) return;
                    const results = dataset.filter((doctor) =>
                        doctorMatchesQuery(doctor, debouncedSearchTerm),
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

        fetchDoctorsPage(listPage, LIST_PAGE_SIZE, controller.signal)
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
    }, [debouncedSearchTerm, listPage, fetchDoctorsPage]);

    const handlePageChange = (page: number) => {
        if (searchState.active) return;
        if (page >= 1 && page <= listState.totalPages) {
            setListPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const columns: Column<Doctor>[] = [
        {
            header: 'الاسم الكامل',
            accessor: 'full_name',
            sortable: true,
            className: 'font-medium text-white',
        },
        {
            header: 'التخصص',
            accessor: (row) => row.specialization?.name_ar || '-',
            sortable: true,
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
            header: 'الجنس',
            accessor: (row) => (
                <Badge variant="info" size="sm">
                    {row.gender === 'male' ? 'ذكر' : 'أنثى'}
                </Badge>
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
                        setSelectedDoctor(row);
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
            ? 'جاري البحث في الأطباء...'
            : searchState.error || 'لم يتم العثور على نتائج مطابقة.'
        : 'لا يوجد أطباء مسجلين';

    const tableItemsPerPage = searchState.active
        ? Math.max(tableData.length, 1)
        : LIST_PAGE_SIZE;

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">إدارة الأطباء</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1 md:mt-2">
                        إدارة ومراقبة جميع الأطباء المسجلين في النظام
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="info" size="lg">
                        {tableLoading ? '...' : `${totalCount} طبيب`}
                    </Badge>
                </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث في جميع الأطباء بالاسم، التخصص، البريد، الهاتف..."
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
                                جاري تحميل جميع الأطباء لضمان دقة النتائج...
                            </span>
                        ) : (
                            <span>
                                {searchState.total > 0
                                    ? `تم العثور على ${searchState.total} طبيب مطابق`
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
                onRowClick={(doctor) => navigate(`/doctors/${doctor.id}`)}
            />

            {!searchState.active && listState.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-sm text-slate-400">
                        الصفحة {listPage} من {listState.totalPages} ({listState.total} طبيب إجمالاً)
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

            {/* Doctor Details Modal */}
            <Modal
                isOpen={!!selectedDoctor}
                onClose={() => setSelectedDoctor(null)}
                title="تفاصيل الطبيب"
                size="lg"
            >
                {selectedDoctor && (
                    <div className="space-y-6">
                        {/* Profile Header */}
                        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl p-4 sm:p-6 border border-cyan-500/30">
                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                <div className="flex-shrink-0">
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center border-4 border-cyan-400 shadow-lg shadow-cyan-500/50">
                                        <svg className="w-12 h-12 sm:w-16 sm:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="flex-1 text-center sm:text-right space-y-2">
                                    <h2 className="text-2xl sm:text-3xl font-bold text-white">
                                        {selectedDoctor.full_name}
                                    </h2>
                                    {selectedDoctor.specialization && (
                                        <div className="flex items-center justify-center sm:justify-start gap-2">
                                            <Badge variant="info" size="lg">
                                                <span className="flex items-center gap-2">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    {selectedDoctor.specialization.name_ar}
                                                </span>
                                            </Badge>
                                        </div>
                                    )}
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
                                <DetailItem label="الاسم الكامل" value={selectedDoctor.full_name} />
                                <DetailItem label="البريد الإلكتروني" value={selectedDoctor.account?.email || 'غير متوفر'} />
                                <DetailItem label="رقم الهاتف" value={selectedDoctor.account?.phone_number || 'غير متوفر'} />
                                <DetailItem label="العنوان" value={selectedDoctor.address || 'غير متوفر'} />
                                {selectedDoctor.age && (
                                    <DetailItem label="العمر" value={`${selectedDoctor.age} سنة`} />
                                )}
                                <DetailItem 
                                    label="الجنس" 
                                    value={selectedDoctor.gender === 'male' ? 'ذكر' : 'أنثى'} 
                                />
                            </div>
                        </div>

                        {/* Professional Information */}
                        <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700/50">
                            <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                المعلومات المهنية
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {selectedDoctor.specialization && (
                                    <DetailItem 
                                        label="التخصص" 
                                        value={
                                            <Badge variant="info" size="md">
                                                {selectedDoctor.specialization.name_ar}
                                            </Badge>
                                        } 
                                    />
                                )}
                                {selectedDoctor.avg_rating !== undefined && selectedDoctor.avg_rating !== null && (
                                    <DetailItem 
                                        label="التقييم" 
                                        value={
                                            <div className="flex items-center gap-2">
                                                <span className="text-yellow-400 font-semibold">
                                                    {selectedDoctor.avg_rating.toFixed(1)}
                                                </span>
                                                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                {selectedDoctor.ratings_count && (
                                                    <span className="text-slate-400 text-sm">
                                                        ({selectedDoctor.ratings_count} تقييم)
                                                    </span>
                                                )}
                                            </div>
                                        } 
                                    />
                                )}
                                {selectedDoctor.reservations_count !== undefined && (
                                    <DetailItem 
                                        label="عدد الحجوزات" 
                                        value={selectedDoctor.reservations_count.toString()} 
                                    />
                                )}
                            </div>
                            {selectedDoctor.profile_description && (
                                <div className="mt-4">
                                    <DetailItem 
                                        label="الوصف الشخصي" 
                                        value={selectedDoctor.profile_description} 
                                    />
                                </div>
                            )}
                        </div>

                        {/* Services */}
                        {selectedDoctor.services && selectedDoctor.services.length > 0 && (
                            <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700/50">
                                <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    الخدمات
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {selectedDoctor.services.map((service) => (
                                        <div key={service.id} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                                            <div className="font-semibold text-white mb-1">{service.name}</div>
                                            <div className="text-sm text-slate-400">
                                                السعر: {service.price} ل.س | المدة: {service.duration_minutes} دقيقة
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Work Schedule */}
                        {selectedDoctor.doctor_work_schedule && selectedDoctor.doctor_work_schedule.length > 0 && (
                            <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700/50">
                                <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    الجدول الزمني
                                </h3>
                                <div className="space-y-2">
                                    {selectedDoctor.doctor_work_schedule.map((schedule) => {
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
                                                <span className="text-slate-300">
                                                    {schedule.start_time} - {schedule.end_time}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
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

export default DoctorsPage;
