import React, { useState, useEffect } from 'react';
import { HospitalService } from '../types';
import api from '../services/api';
import { useToast } from '../hooks/useToast';
import Toast from '../components/ui/Toast';

const HospitalServicesPage: React.FC = () => {
    const [services, setServices] = useState<HospitalService[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentService, setCurrentService] = useState<Partial<HospitalService>>({});
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { toasts, removeToast, success, error, warning } = useToast();
    const [showTrashModal, setShowTrashModal] = useState(false);
    const [trashedServices, setTrashedServices] = useState<HospitalService[]>([]);
    const [trashedLoading, setTrashedLoading] = useState(false);
    const [trashError, setTrashError] = useState('');

    const fetchServices = async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/service');
            const servicesData = response.services || response.data || response;
            setServices(Array.isArray(servicesData) ? servicesData : []);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);
    
    const handleOpenModal = (service?: HospitalService) => {
        setCurrentService(service || {});
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentService({});
    };

    const handleSave = async (serviceName: string) => {
        if (!serviceName.trim()) {
            warning('يرجى إدخال اسم الخدمة.');
            return;
        }
        try {
            if (currentService.id) {
                // Update (PUT) uses JSON as per Postman raw body
                await api.put(`/admin/service/${currentService.id}`, { service_name: serviceName });
                success('تم تحديث الخدمة بنجاح');
            } else {
                // Create (POST) uses FormData as per Postman formdata body
                const formData = new FormData();
                formData.append('service_name', serviceName);
                await api.post('/admin/service', formData);
                success('تم إضافة الخدمة بنجاح');
            }
            fetchServices();
            handleCloseModal();
        } catch (err: any) {
            error(`فشل الحفظ: ${err?.message || 'خطأ غير معروف'}`);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من رغبتك في حذف هذه الخدمة؟')) {
            try {
                await api.delete(`/admin/service/${id}`);
                success('تم حذف الخدمة بنجاح');
                fetchServices();
            } catch (err: any) {
                error(`فشل الحذف: ${err?.message || 'خطأ غير معروف'}`);
            }
        }
    };

    // حساب البيانات للصفحة الحالية
    const totalPages = Math.ceil(services.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentServices = services.slice(startIndex, endIndex);

    const goToPage = (page: number) => {
        setCurrentPage(page);
    };

    const goToPreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const goToNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    // دالة لإنشاء أرقام الصفحات مع النقاط
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 5; // عدد الصفحات المرئية

        if (totalPages <= 7) {
            // إذا كان العدد قليل، اعرض كل الصفحات
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // اعرض الصفحة الأولى دائماً
            pages.push(1);

            if (currentPage > 3) {
                pages.push('...');
            }

            // اعرض الصفحات حول الصفحة الحالية
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push('...');
            }

            // اعرض الصفحة الأخيرة دائماً
            pages.push(totalPages);
        }

        return pages;
    };

    const formatDate = (value?: string | null) => {
        if (!value) return '-';
        const normalized = value.includes('T') ? value : value.replace(' ', 'T');
        const date = new Date(normalized);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleDateString('ar-EG');
    };

    const fetchTrashedServices = async () => {
        setTrashedLoading(true);
        setTrashError('');
        try {
            const response = await api.get('/admin/service/trashed');
            const data = Array.isArray(response)
                ? response
                : Array.isArray(response?.data)
                ? response.data
                : [];
            setTrashedServices(data);
        } catch (err: any) {
            setTrashError(err?.message || 'فشل تحميل العناصر المحذوفة');
            setTrashedServices([]);
        } finally {
            setTrashedLoading(false);
        }
    };

    const handleRestore = async (serviceId: number) => {
        try {
            await api.patch(`/admin/service/${serviceId}`);
            success('تمت استعادة الخدمة بنجاح');
            await fetchServices();
            await fetchTrashedServices();
        } catch (err: any) {
            error(err?.message || 'فشل استعادة الخدمة');
        }
    };

    const openTrashModal = async () => {
        setShowTrashModal(true);
        await fetchTrashedServices();
    };

    return (
        <div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
                <h1 className="text-3xl font-bold text-slate-100">إدارة خدمات المشافي</h1>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={openTrashModal}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-white font-semibold transition-colors"
                    >
                        العناصر المحذوفة
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white font-semibold transition-colors"
                    >
                        إضافة خدمة
                    </button>
                </div>
            </div>
            
             <div className="bg-slate-800/50 border border-slate-700 rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-slate-300">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-800">
                            <tr>
                                <th scope="col" className="px-6 py-3">#</th>
                                <th scope="col" className="px-6 py-3">اسم الخدمة</th>
                                <th scope="col" className="px-6 py-3">تاريخ الإنشاء</th>
                                <th scope="col" className="px-6 py-3">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} className="text-center p-8">جاري التحميل...</td></tr>
                            ) : services.length > 0 ? (
                                currentServices.map(service => (
                                    <tr key={service.id} className="border-b border-slate-700 hover:bg-slate-800">
                                        <td className="px-6 py-4">{service.id}</td>
                                        <td className="px-6 py-4 font-medium">{service.service_name}</td>
                                        <td className="px-6 py-4">
                                            {formatDate(
                                                service.created_at ??
                                                (service as any).createdAt ??
                                                service.updated_at ??
                                                (service as any).updatedAt ??
                                                null
                                            )}
                                        </td>
                                        <td className="px-6 py-4 flex space-x-2 space-x-reverse">
                                            <button onClick={() => handleOpenModal(service)} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded-md">تعديل</button>
                                            <button onClick={() => handleDelete(service.id)} className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded-md">حذف</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={4} className="text-center p-8">لا توجد خدمات لعرضها.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* عناصر التنقل بين الصفحات */}
            {!loading && services.length > 0 && totalPages > 1 && (
                <div className="mt-6">
                    {/* معلومات الصفحة */}
                    <div className="text-center text-slate-400 text-sm mb-4">
                        عرض {startIndex + 1} - {Math.min(endIndex, services.length)} من إجمالي {services.length} خدمة
                    </div>
                    
                    {/* أزرار التنقل */}
                    <div className="flex justify-center items-center gap-2">
                        <button
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                currentPage === totalPages
                                    ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600 hover:shadow-lg'
                            }`}
                        >
                            التالي ←
                        </button>

                        <div className="flex gap-1.5">
                            {getPageNumbers().map((page, index) => (
                                typeof page === 'number' ? (
                                    <button
                                        key={`page-${page}`}
                                        onClick={() => goToPage(page)}
                                        className={`min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                            currentPage === page
                                                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 scale-105'
                                                : 'bg-slate-700 text-slate-200 hover:bg-slate-600 hover:shadow-md'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ) : (
                                    <span
                                        key={`dots-${index}`}
                                        className="px-2 py-2 text-slate-500 text-sm flex items-center"
                                    >
                                        {page}
                                    </span>
                                )
                            ))}
                        </div>

                        <button
                            onClick={goToPreviousPage}
                            disabled={currentPage === 1}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                currentPage === 1
                                    ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600 hover:shadow-lg'
                            }`}
                        >
                            → السابق
                        </button>
                    </div>
                </div>
            )}

            {isModalOpen && <ServiceModal service={currentService} onClose={handleCloseModal} onSave={handleSave} />}
            {showTrashModal && (
                <TrashModal
                    services={trashedServices}
                    loading={trashedLoading}
                    error={trashError}
                    onClose={() => setShowTrashModal(false)}
                    onRefresh={fetchTrashedServices}
                    onRestore={handleRestore}
                    formatDate={formatDate}
                />
            )}
            
            {/* Toast Notifications */}
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

interface ModalProps {
    service: Partial<HospitalService>;
    onClose: () => void;
    onSave: (name: string) => void;
}

const ServiceModal: React.FC<ModalProps> = ({ service, onClose, onSave }) => {
    const [name, setName] = useState(service.service_name || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(name);
    }
    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{service.id ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block mb-2">اسم الخدمة</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-2 bg-slate-700 rounded-md border border-slate-600"/>
                    </div>
                    <div className="flex justify-end space-x-2 space-x-reverse mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-md">إلغاء</button>
                        <button type="submit" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md">حفظ</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface TrashModalProps {
    services: HospitalService[];
    loading: boolean;
    error: string;
    onClose: () => void;
    onRefresh: () => void;
    onRestore: (id: number) => void;
    formatDate: (value?: string | null) => string;
}

const TrashModal: React.FC<TrashModalProps> = ({ services, loading, error, onClose, onRefresh, onRestore, formatDate }) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center px-4" onClick={onClose}>
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-3xl max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
                    <div>
                        <h2 className="text-xl font-bold text-white">العناصر المحذوفة</h2>
                        <p className="text-slate-400 text-sm mt-1">
                            يمكنك استعادة الخدمات المحذوفة خلال فترة السماح.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onRefresh}
                            className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 transition-colors"
                        >
                            تحديث
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            aria-label="إغلاق"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4">
                    {error && (
                        <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-2">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400"></div>
                        </div>
                    ) : services.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            لا توجد عناصر محذوفة حالياً.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {services.map((service) => (
                                <div
                                    key={service.id}
                                    className="border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/60"
                                >
                                    <div>
                                        <p className="text-white font-semibold">{service.service_name}</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            معرف الخدمة #{service.id}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            حذف في: {formatDate(service.deleted_at)}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={() => onRestore(service.id)}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white text-sm font-semibold transition-colors"
                                        >
                                            استعادة
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


export default HospitalServicesPage;