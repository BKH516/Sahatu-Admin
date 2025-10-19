
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Nurse } from '../types';
import api from '../services/api';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

const NursesPage: React.FC = () => {
    const navigate = useNavigate();
    const [nurses, setNurses] = useState<Nurse[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalNurses, setTotalNurses] = useState(0);
    const perPage = 20;

    const fetchNurses = async (page: number = 1) => {
        setLoading(true);
        try {
            const response = await api.get(`/admin/nurse/all?page=${page}&per_page=${perPage}`);
            
            let nursesData: any[] = [];
            let paginationData = {
                total: 0,
                lastPage: 1,
                currentPageNum: page
            };
            
            // استخراج البيانات من الاستجابة
            if (response.nurses?.data && Array.isArray(response.nurses.data)) {
                nursesData = response.nurses.data;
                paginationData.total = response.nurses.total || nursesData.length;
                paginationData.lastPage = response.nurses.last_page || 1;
                paginationData.currentPageNum = response.nurses.current_page || page;
            } else if (response.nurses && Array.isArray(response.nurses)) {
                nursesData = response.nurses;
                paginationData.total = nursesData.length;
            } else if (response.data && Array.isArray(response.data)) {
                nursesData = response.data;
                paginationData.total = nursesData.length;
            } else if (Array.isArray(response)) {
                nursesData = response;
                paginationData.total = nursesData.length;
            }
            
            setNurses(nursesData);
            setTotalPages(paginationData.lastPage);
            setTotalNurses(paginationData.total);
            setCurrentPage(paginationData.currentPageNum);
            
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNurses(1);
    }, []);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            fetchNurses(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">إدارة الممرضين</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1 md:mt-2">إدارة ومراقبة جميع الممرضين المسجلين في النظام</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="info" size="lg">
                        {totalNurses} ممرض/ة
                    </Badge>
                </div>
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
                                <th scope="col" className="px-6 py-3">الحالة</th>
                                <th scope="col" className="px-6 py-3">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="text-center p-8">جاري التحميل...</td></tr>
                            ) : nurses.length > 0 ? (
                                nurses.map(nurse => (
                                    <tr key={nurse.id} className="border-b border-slate-700 hover:bg-slate-800">
                                        <td className="px-6 py-4 font-medium">{nurse.full_name}</td>
                                        <td className="px-6 py-4">{nurse.account.email}</td>
                                        <td className="px-6 py-4">{nurse.account.phone_number}</td>
                                        <td className="px-6 py-4">{nurse.graduation_type}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs rounded-full ${nurse.is_active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                                {nurse.is_active ? 'نشط' : 'غير نشط'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => navigate(`/nurses/${nurse.id}`)}
                                                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                                            >
                                                عرض التفاصيل
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={6} className="text-center p-8">لا يوجد ممرضون لعرضهم.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-sm text-slate-400">
                        الصفحة {currentPage} من {totalPages} ({totalNurses} ممرض/ة إجمالاً)
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

export default NursesPage;
