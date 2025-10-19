
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import api from '../services/api';
import Table, { Column } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    
    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const perPage = 20;

    const fetchUsers = async (page: number = 1) => {
        setLoading(true);
        try {
            const response = await api.get(`/admin/user/all?page=${page}&per_page=${perPage}`);
            
            let usersData: any[] = [];
            let paginationData = {
                total: 0,
                lastPage: 1,
                currentPageNum: page
            };
            
            // استخراج البيانات من الاستجابة
            if (response.users?.data && Array.isArray(response.users.data)) {
                usersData = response.users.data;
                paginationData.total = response.users.total || usersData.length;
                paginationData.lastPage = response.users.last_page || 1;
                paginationData.currentPageNum = response.users.current_page || page;
            } else if (response.users && Array.isArray(response.users)) {
                usersData = response.users;
                paginationData.total = usersData.length;
            } else if (response.data && Array.isArray(response.data)) {
                usersData = response.data;
                paginationData.total = usersData.length;
            } else if (Array.isArray(response)) {
                usersData = response;
                paginationData.total = usersData.length;
            }
            
            setUsers(usersData);
            setTotalPages(paginationData.lastPage);
            setTotalUsers(paginationData.total);
            setCurrentPage(paginationData.currentPageNum);
            
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers(1);
    }, []);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            fetchUsers(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

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
                        {totalUsers} مستخدم
                    </Badge>
                </div>
            </div>

            <Table
                data={users}
                columns={columns}
                loading={loading}
                searchable={true}
                searchPlaceholder="ابحث عن مستخدم بالاسم، البريد، الهاتف..."
                emptyMessage="لا يوجد مستخدمون مسجلون"
                itemsPerPage={perPage}
                onRowClick={setSelectedUser}
            />

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-sm text-slate-400">
                        الصفحة {currentPage} من {totalPages} ({totalUsers} مستخدم إجمالاً)
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePageChange(1)}
                            disabled={currentPage === 1 || loading}
                        >
                            الأولى
                        </Button>
                        
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1 || loading}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                </svg>
                            }
                        >
                            السابقة
                        </Button>
                        
                        {/* Page Numbers */}
                        <div className="hidden sm:flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }
                                
                                return (
                                    <Button
                                        key={pageNum}
                                        variant={currentPage === pageNum ? 'primary' : 'secondary'}
                                        size="sm"
                                        onClick={() => handlePageChange(pageNum)}
                                        disabled={loading}
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
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages || loading}
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
                            onClick={() => handlePageChange(totalPages)}
                            disabled={currentPage === totalPages || loading}
                        >
                            الأخيرة
                        </Button>
                    </div>
                </div>
            )}

            {/* User Details Modal */}
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
