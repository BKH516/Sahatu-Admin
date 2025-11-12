import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';
import api from '../services/api';
import Table, { Column } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { runWithConcurrency, throwIfAborted } from '../utils/async';

const LIST_PAGE_SIZE = 100;
const DATASET_PAGE_SIZE = 200;
const SEARCH_DEBOUNCE_MS = 350;
const DATASET_CONCURRENCY = 4;

interface PaginatedUsers {
    items: User[];
    currentPage: number;
    lastPage: number;
    total: number;
    perPage: number;
}

interface ListState {
    data: User[];
    loading: boolean;
    totalPages: number;
    total: number;
}

interface SearchState {
    active: boolean;
    loading: boolean;
    data: User[];
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

const extractUsersPayload = (response: any): PaginatedUsers => {
    const candidates = [response?.users, response?.data, response];

    let container = candidates.find(
        (candidate) => candidate !== undefined && candidate !== null,
    );

    if (container && typeof container === 'object' && 'users' in container) {
        container = container.users;
    }

    let data: User[] = [];

    if (Array.isArray(container?.data)) {
        data = container.data as User[];
    } else if (Array.isArray(container)) {
        data = container as User[];
    } else if (Array.isArray(response?.users?.data)) {
        data = response.users.data as User[];
    } else if (Array.isArray(response?.data?.data)) {
        data = response.data.data as User[];
    } else if (Array.isArray(response?.data)) {
        data = response.data as User[];
    } else if (Array.isArray(response)) {
        data = response as User[];
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

const userMatchesQuery = (user: User, query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;

    const fields = [
        user.full_name,
        user.account?.email,
        user.account?.phone_number,
        user.age ? String(user.age) : undefined,
    ];

    return fields
        .filter((value): value is string => !!value)
        .some((value) => value.toLowerCase().includes(normalized));
};

const UsersPage: React.FC = () => {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

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

    const datasetCacheRef = useRef<User[] | null>(null);
    const datasetPromiseRef = useRef<Promise<User[]> | null>(null);
    const searchAbortRef = useRef<AbortController | null>(null);

    const fetchUsersPage = useCallback(
        async (page: number, perPage: number, signal?: AbortSignal): Promise<PaginatedUsers> => {
            const query = toQueryString({ page, per_page: perPage });
            const response = await api.get(`/admin/user/all?${query}`, { signal });
            return extractUsersPayload(response);
        },
        [],
    );

    const loadEntireDataset = useCallback(
        async (options?: { signal?: AbortSignal; onProgress?: (current: number, total: number) => void }): Promise<User[]> => {
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
                const aggregated: User[] = [];

                const {
                    items: firstItems,
                    lastPage: firstLastPage,
                    total: firstTotal,
                    perPage: firstPerPage,
                } = await fetchUsersPage(1, DATASET_PAGE_SIZE, signal);

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
                            const { items } = await fetchUsersPage(page, DATASET_PAGE_SIZE, signal);
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
        [fetchUsersPage],
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
                    const results = dataset.filter((user) =>
                        userMatchesQuery(user, debouncedSearchTerm),
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

        fetchUsersPage(listPage, LIST_PAGE_SIZE, controller.signal)
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
    }, [debouncedSearchTerm, listPage, fetchUsersPage]);

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
            ? 'جاري البحث في المستخدمين...'
            : searchState.error || 'لم يتم العثور على نتائج مطابقة.'
        : 'لا يوجد مستخدمون مسجلون';

    const tableItemsPerPage = searchState.active
        ? Math.max(tableData.length, 1)
        : LIST_PAGE_SIZE;

    const columns: Column<User>[] = [
        {
            header: 'الاسم الكامل',
            accessor: 'full_name',
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
            header: 'العمر',
            accessor: 'age',
            sortable: true,
        },
        {
            header: 'الجنس',
            accessor: (row) => (
                <Badge variant={row.gender === 'male' ? 'info' : 'success'} size="sm">
                    {row.gender === 'male' ? 'ذكر' : row.gender === 'female' ? 'أنثى' : '-'}
                </Badge>
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
                        setSelectedUser(row);
                    }}
                >
                    عرض التفاصيل
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">إدارة المستخدمين</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1 md:mt-2">إدارة ومراقبة جميع المستخدمين المسجلين في النظام</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="info" size="lg">
                        {tableLoading ? '...' : `${totalCount} مستخدم`}
                    </Badge>
                </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث في جميع المستخدمين بالاسم، البريد، الهاتف، العمر..."
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

            <Table
                key={searchState.active ? 'search-results' : `page-${listPage}`}
                data={tableData}
                columns={columns}
                loading={tableLoading}
                searchable={false}
                emptyMessage={tableEmptyMessage}
                itemsPerPage={tableItemsPerPage}
                onRowClick={setSelectedUser}
            />

            {!searchState.active && listState.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-sm text-slate-400">
                        الصفحة {listPage} من {listState.totalPages} ({listState.total} مستخدم إجمالاً)
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
                isOpen={!!selectedUser}
                onClose={() => setSelectedUser(null)}
                title="تفاصيل المستخدم"
                footer={
                    <Button variant="secondary" onClick={() => setSelectedUser(null)}>
                        إغلاق
                    </Button>
                }
            >
                {selectedUser && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <p className="text-slate-400 text-sm">الاسم الكامل</p>
                            <p className="text-white font-medium text-lg">{selectedUser.full_name || '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-slate-400 text-sm">العمر</p>
                            <p className="text-white font-medium text-lg">{selectedUser.age || '-'} سنة</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-slate-400 text-sm">الجنس</p>
                            <Badge variant={selectedUser.gender === 'male' ? 'info' : 'success'}>
                                {selectedUser.gender === 'male' ? 'ذكر' : 'أنثى'}
                            </Badge>
                        </div>
                        <div className="space-y-1">
                            <p className="text-slate-400 text-sm">معرف المستخدم</p>
                            <p className="text-white font-medium text-lg">#{selectedUser.id}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                            <p className="text-slate-400 text-sm">البريد الإلكتروني</p>
                            <p className="text-white font-medium text-lg">{selectedUser.account?.email || '-'}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                            <p className="text-slate-400 text-sm">رقم الهاتف</p>
                            <p className="text-white font-medium text-lg direction-ltr text-right">{selectedUser.account?.phone_number || '-'}</p>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default UsersPage;

