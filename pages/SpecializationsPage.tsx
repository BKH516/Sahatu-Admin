
import React, { useState, useEffect } from 'react';
import { Specialization } from '../types';
import api from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import Toast from '../components/ui/Toast';

// Helper function to get the correct image URL
const getSpecializationImageUrl = (imagePath: string | null | undefined): string | null => {
    if (!imagePath) return null;
    
    // If it's already a full URL, return it
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    
    // Remove leading slashes and 'storage/' prefix if they exist
    let cleanPath = imagePath.replace(/^\/+/, '').replace(/^storage\//, '');
    
    // If the path doesn't include 'images/specializations', add it
    if (!cleanPath.includes('images/specializations')) {
        cleanPath = `images/specializations/${cleanPath}`;
    }
    
    // Build the full URL
    return `https://sahtee.evra-co.com/storage/${cleanPath}`;
};

const SpecializationsPage: React.FC = () => {
    const [specializations, setSpecializations] = useState<Specialization[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentSpec, setCurrentSpec] = useState<Partial<Specialization>>({});
    const [saving, setSaving] = useState(false);
    const { toasts, removeToast, success, error } = useToast();
    
    const fetchSpecializations = async () => {
        setLoading(true);
        try {
            const data = await api.get('/admin/specializations');
            setSpecializations(data || []);
        } catch (err) {
            error('فشل تحميل التخصصات');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSpecializations();
    }, []);

    const handleOpenModal = (spec?: Specialization) => {
        setCurrentSpec(spec || { name_ar: '', name_en: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentSpec({});
    };

    const handleSave = async (formData: FormData) => {
        setSaving(true);
        try {
            let response;
            if (currentSpec.id) {
                response = await api.post(`/admin/specializations/${currentSpec.id}`, formData);
                success('تم تحديث التخصص بنجاح');
            } else {
                response = await api.post('/admin/specializations', formData);
                success('تم إضافة التخصص بنجاح');
            }
            
            await fetchSpecializations();
            handleCloseModal();
        } catch (err: any) {
            error(`فشل الحفظ: ${err.response?.data?.message || err.message || 'حدث خطأ غير متوقع'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا التخصص؟')) {
            try {
                await api.delete(`/admin/specializations/${id}`);
                setSpecializations(specializations.filter(s => s.id !== id));
                success('تم حذف التخصص بنجاح');
            } catch(err: any) {
                error(`فشل الحذف: ${err.message}`);
            }
        }
    };

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">إدارة التخصصات</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1 md:mt-2">إدارة تخصصات الأطباء في النظام</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="info" size="lg">
                        {specializations.length} تخصص
                    </Badge>
                    <Button 
                        variant="primary"
                        onClick={() => handleOpenModal()}
                        icon={
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        }
                    >
                        <span className="hidden sm:inline">إضافة تخصص</span>
                        <span className="sm:hidden">إضافة</span>
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <LoadingSpinner text="جاري تحميل التخصصات..." />
                </div>
            ) : specializations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {specializations.map(spec => (
                        <Card key={spec.id} gradient hover className="p-4 md:p-6 text-center group">
                            <div className="relative inline-block mb-4">
                                {getSpecializationImageUrl(spec.image) ? (
                                    <img 
                                        src={getSpecializationImageUrl(spec.image)!} 
                                        alt={spec.name_ar} 
                                        className="w-20 h-20 md:w-24 md:h-24 rounded-full mx-auto object-cover border-4 border-slate-700 group-hover:border-cyan-500 transition-all duration-300 group-hover:scale-110"
                                        onError={(e) => {
                                            const target = e.currentTarget;
                                            const currentSrc = target.src;
                                            
                                            // Try alternative paths if the first one fails
                                            if (spec.image && !currentSrc.includes('data:image')) {
                                                // Try without 'images/specializations' prefix
                                                if (currentSrc.includes('images/specializations')) {
                                                    target.src = `https://sahtee.evra-co.com/storage/${spec.image.replace(/^\/+/, '')}`;
                                                    return;
                                                }
                                                // Try with just 'specializations' prefix
                                                if (!currentSrc.includes('specializations/')) {
                                                    target.src = `https://sahtee.evra-co.com/storage/specializations/${spec.image.replace(/^\/+/, '')}`;
                                                    return;
                                                }
                                            }
                                            
                                            // If all attempts fail, show default icon
                                            target.onerror = null;
                                            target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2306b6d4"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E';
                                        }}
                                    />
                                ) : (
                                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full mx-auto flex items-center justify-center bg-slate-700 border-4 border-slate-600">
                                        <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                )}
                        </div>
                            <h3 className="font-bold text-base md:text-lg text-white mb-1">{spec.name_ar}</h3>
                            <p className="text-slate-400 text-xs md:text-sm mb-4">{spec.name_en}</p>
                            <div className="flex justify-center gap-2">
                                <Button 
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleOpenModal(spec)}
                                    icon={
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    }
                                >
                                    تعديل
                                </Button>
                                <Button 
                                    size="sm"
                                    variant="danger"
                                    onClick={() => handleDelete(spec.id)}
                                    icon={
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    }
                                >
                                    حذف
                                </Button>
                    </div>
                        </Card>
                ))}
            </div>
            ) : (
                <EmptyState
                    icon={
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    }
                    title="لا توجد تخصصات"
                    description="ابدأ بإضافة تخصص جديد للأطباء"
                    action={{
                        label: 'إضافة تخصص',
                        onClick: () => handleOpenModal()
                    }}
                />
            )}
            
            {isModalOpen && (
                <SpecializationModal 
                    spec={currentSpec} 
                    onClose={handleCloseModal} 
                    onSave={handleSave}
                    saving={saving}
                />
            )}

            {/* Toast Notifications */}
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    duration={toast.duration}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </div>
    );
};

interface ModalProps {
    spec: Partial<Specialization>;
    onClose: () => void;
    onSave: (formData: FormData) => Promise<void>;
    saving: boolean;
}

const SpecializationModal: React.FC<ModalProps> = ({ spec, onClose, onSave, saving }) => {
    const [nameAr, setNameAr] = useState(spec.name_ar || '');
    const [nameEn, setNameEn] = useState(spec.name_en || '');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        if (spec.image) {
            const imageUrl = getSpecializationImageUrl(spec.image);
            if (imageUrl) {
                setImagePreview(imageUrl);
            }
        }
    }, [spec.image]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check if file is a valid image type (including SVG)
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
            const maxSize = 5 * 1024 * 1024; // 5MB
            
            if (!validTypes.includes(file.type)) {
                showToast.warning('يرجى اختيار صورة صالحة (JPG, PNG, GIF, WEBP, SVG)');
                e.target.value = '';
                return;
            }
            
            if (file.size > maxSize) {
                showToast.warning('حجم الصورة كبير جداً. الحد الأقصى 5 ميجابايت');
                e.target.value = '';
                return;
            }
            
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!nameAr.trim() || !nameEn.trim()) {
            showToast.warning('الرجاء إدخال اسم التخصص بالعربية والإنجليزية');
            return;
        }

        const formData = new FormData();
        formData.append('name_ar', nameAr.trim());
        formData.append('name_en', nameEn.trim());
        
        if (imageFile) {
            formData.append('image', imageFile);
        }
        
        await onSave(formData);
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={spec.id ? 'تعديل التخصص' : 'إضافة تخصص جديد'}
            size="md"
            footer={
                <div className="flex gap-3 justify-end">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>
                        إلغاء
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={handleSubmit}
                        isLoading={saving}
                        icon={
                            !saving && (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            )
                        }
                    >
                        {saving ? 'جاري الحفظ...' : 'حفظ'}
                    </Button>
                    </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Image Preview */}
                {imagePreview && (
                    <div className="flex justify-center mb-4">
                        <div className="relative">
                            <img 
                                src={imagePreview} 
                                alt="Preview" 
                                className="w-24 h-24 rounded-full object-cover border-4 border-cyan-500/30"
                                onError={(e) => {
                                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2306b6d4"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E';
                                }}
                            />
                    </div>
                    </div>
                )}

                <Input
                    label="الاسم بالعربية"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="مثال: جراحة عامة"
                    required
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                    }
                />

                <Input
                    label="الاسم بالإنجليزية"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="Example: General Surgery"
                    required
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                    }
                />

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        صورة التخصص {spec.id && '(اختياري للتحديث)'}
                        <span className="text-xs text-slate-400 block mt-1">
                            الصيغ المدعومة: JPG, PNG, GIF, WEBP, SVG (الحد الأقصى 5 ميجابايت)
                        </span>
                    </label>
                    <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
                        onChange={handleImageChange}
                        className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent hover:border-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-500 file:text-white hover:file:bg-cyan-600 cursor-pointer"
                        required={!spec.id}
                    />
                    </div>
                </form>
        </Modal>
    );
}

export default SpecializationsPage;
