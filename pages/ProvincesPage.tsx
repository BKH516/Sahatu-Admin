import React, { useState, useEffect } from 'react';
import { Province } from '../types';
import api from '../services/api';
import Table, { Column } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { useToast } from '../hooks/useToast';
import Toast from '../components/ui/Toast';

const ProvincesPage: React.FC = () => {
    const { toasts, removeToast, success, error, warning } = useToast();
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        name_ar: '',
        name_en: '',
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchProvinces();
    }, []);

    const fetchProvinces = async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/provinces');
            const data = Array.isArray(response) ? response : (response.data || []);
            setProvinces(data);
        } catch (err: any) {
            // إخفاء خطأ 404 إذا كان API غير متوفر بعد
            if (err?.status === 404 || err?.message?.includes('404') || err?.message?.includes('Not Found')) {
                setProvinces([]);
                // لا نعرض رسالة خطأ إذا كان API غير متوفر بعد
                return;
            }
            error('فشل تحميل المحافظات: ' + (err.message || 'خطأ غير معروف'));
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (province?: Province) => {
        if (province) {
            setIsEditMode(true);
            setEditingId(province.id);
            setFormData({
                name_ar: province.name_ar || '',
                name_en: province.name_en || '',
            });
        } else {
            setIsEditMode(false);
            setEditingId(null);
            setFormData({
                name_ar: '',
                name_en: '',
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setIsEditMode(false);
        setEditingId(null);
        setFormData({
            name_ar: '',
            name_en: '',
        });
    };

    const handleSubmit = async () => {
        if (!formData.name_ar.trim() || !formData.name_en.trim()) {
            warning('يرجى إدخال اسم المحافظة بالعربية والإنجليزية');
            return;
        }

        setSubmitting(true);
        try {
            if (isEditMode && editingId) {
                await api.put(`/admin/provinces/${editingId}`, formData);
                success('تم تحديث المحافظة بنجاح');
            } else {
                await api.post('/admin/provinces', formData);
                success('تم إنشاء المحافظة بنجاح');
            }
            handleCloseModal();
            fetchProvinces();
        } catch (err: any) {
            if (err?.status === 404 || err?.message?.includes('404') || err?.message?.includes('Not Found')) {
                error('API المحافظات غير متوفر بعد. يرجى التواصل مع فريق الباك اند.');
            } else {
                error('فشل حفظ المحافظة: ' + (err.message || 'خطأ غير معروف'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('هل أنت متأكد من حذف هذه المحافظة؟')) {
            return;
        }

        try {
            await api.delete(`/admin/provinces/${id}`);
            success('تم حذف المحافظة بنجاح');
            fetchProvinces();
        } catch (err: any) {
            if (err?.status === 404 || err?.message?.includes('404') || err?.message?.includes('Not Found')) {
                error('API المحافظات غير متوفر بعد. يرجى التواصل مع فريق الباك اند.');
            } else {
                error('فشل حذف المحافظة: ' + (err.message || 'خطأ غير معروف'));
            }
        }
    };

    const columns: Column<Province>[] = [
        {
            header: 'ID',
            accessor: (row) => row.id,
            className: 'font-mono text-slate-400',
        },
        {
            header: 'الاسم بالعربية',
            accessor: (row) => row.name_ar || '-',
            sortable: true,
            className: 'font-medium text-white',
        },
        {
            header: 'الاسم بالإنجليزية',
            accessor: (row) => row.name_en || '-',
            sortable: true,
        },
        {
            header: 'الإجراءات',
            accessor: (row) => (
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(row);
                        }}
                    >
                        تعديل
                    </Button>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(row.id);
                        }}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        حذف
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">إدارة المحافظات</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1 md:mt-2">
                        إدارة ومراقبة جميع المحافظات المسجلة في النظام
                    </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <Badge variant="info" size="lg">
                        {loading ? '...' : `${provinces.length} محافظة`}
                    </Badge>
                    <Button
                        variant="primary"
                        size="md"
                        icon={
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        }
                        onClick={() => handleOpenModal()}
                    >
                        <span className="hidden sm:inline">إضافة محافظة</span>
                        <span className="sm:hidden">إضافة</span>
                    </Button>
                </div>
            </div>

            <Table
                data={provinces}
                columns={columns}
                loading={loading}
                searchable={false}
                emptyMessage="لا توجد محافظات مسجلة"
                itemsPerPage={25}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={isEditMode ? 'تعديل المحافظة' : 'إنشاء محافظة جديدة'}
                footer={
                    <div className="flex gap-3 justify-end">
                        <Button variant="secondary" onClick={handleCloseModal}>
                            إلغاء
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            isLoading={submitting}
                        >
                            {isEditMode ? 'تحديث' : 'إنشاء'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="الاسم بالعربية"
                        value={formData.name_ar}
                        onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                        placeholder="أدخل اسم المحافظة بالعربية"
                        disabled={submitting}
                    />
                    <Input
                        label="الاسم بالإنجليزية"
                        value={formData.name_en}
                        onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                        placeholder="Enter province name in English"
                        disabled={submitting}
                    />
                </div>
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

export default ProvincesPage;

