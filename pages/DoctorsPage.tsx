
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Doctor } from '../types';
import api from '../services/api';
import Table, { Column } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

const DoctorsPage: React.FC = () => {
    const navigate = useNavigate();
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalDoctors, setTotalDoctors] = useState(0);
    const perPage = 20;

    const fetchDoctors = async (page: number = 1) => {
        setLoading(true);
        try {
            const response = await api.get(`/admin/doctor/all?page=${page}&per_page=${perPage}`);
            
            let doctorsData: any[] = [];
            let paginationData = {
                total: 0,
                lastPage: 1,
                currentPageNum: page
            };
            
            // استخراج البيانات من الاستجابة
            if (response.doctors?.data && Array.isArray(response.doctors.data)) {
                doctorsData = response.doctors.data;
                paginationData.total = response.doctors.total || doctorsData.length;
                paginationData.lastPage = response.doctors.last_page || 1;
                paginationData.currentPageNum = response.doctors.current_page || page;
            } else if (response.doctors && Array.isArray(response.doctors)) {
                doctorsData = response.doctors;
                paginationData.total = doctorsData.length;
            } else if (response.data && Array.isArray(response.data)) {
                doctorsData = response.data;
                paginationData.total = doctorsData.length;
            } else if (Array.isArray(response)) {
                doctorsData = response;
                paginationData.total = doctorsData.length;
            }
            
            setDoctors(doctorsData);
            setTotalPages(paginationData.lastPage);
            setTotalDoctors(paginationData.total);
            setCurrentPage(paginationData.currentPageNum);
            
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDoctors(1);
    }, []);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            fetchDoctors(page);
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
            header: 'الإجراءات',
            accessor: (row) => (
                <Button
                    size="sm"
                    variant="primary"
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/doctors/${row.id}`);
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
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">إدارة الأطباء</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1 md:mt-2">إدارة ومراقبة جميع الأطباء المسجلين في النظام</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="info" size="lg">
                        {totalDoctors} طبيب
                    </Badge>
                </div>
            </div>

            <Table
                data={doctors}
                columns={columns}
                loading={loading}
                searchable={true}
                searchPlaceholder="ابحث عن طبيب بالاسم، التخصص، البريد..."
                emptyMessage="لا يوجد أطباء مسجلين"
                itemsPerPage={perPage}
                onRowClick={(doctor) => navigate(`/doctors/${doctor.id}`)}
            />

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-sm text-slate-400">
                        الصفحة {currentPage} من {totalPages} ({totalDoctors} طبيب إجمالاً)
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
        </div>
    );
};

export default DoctorsPage;
