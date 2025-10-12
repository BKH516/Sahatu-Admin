import React, { useState, useEffect } from 'react';
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

const HospitalsPage: React.FC = () => {
    const navigate = useNavigate();
    const [hospitals, setHospitals] = useState<Hospital[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newHospitalName, setNewHospitalName] = useState('');
    const [creating, setCreating] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [createdHospitalData, setCreatedHospitalData] = useState<any>(null);
    const { toasts, removeToast, success, error, warning } = useToast();

    const fetchHospitals = async () => {
        setLoading(true);
        try {
            let allHospitals: any[] = [];
            let currentPage = 1;
            let hasMorePages = true;

            // جلب جميع الصفحات
            while (hasMorePages) {
                const response = await api.get(`/admin/hospital/all?page=${currentPage}&per_page=50`);
                
                let hospitalsData: any[] = [];
                let totalPages = 1;
                let currentPageFromResponse = 1;
                
                // استخراج البيانات من الاستجابة
                if (response.hospitals?.data && Array.isArray(response.hospitals.data)) {
                    hospitalsData = response.hospitals.data;
                    totalPages = response.hospitals.last_page || 1;
                    currentPageFromResponse = response.hospitals.current_page || 1;
                } else if (response.hospitals && Array.isArray(response.hospitals)) {
                    hospitalsData = response.hospitals;
                } else if (response.data && Array.isArray(response.data)) {
                    hospitalsData = response.data;
                } else if (Array.isArray(response)) {
                    hospitalsData = response;
                }
                
                // إضافة البيانات إلى القائمة الكاملة
                allHospitals = [...allHospitals, ...hospitalsData];
                
                // التحقق من وجود صفحات إضافية
                if (currentPageFromResponse >= totalPages) {
                    hasMorePages = false;
                } else {
                    currentPage++;
                }
            }
            
            // تصفية المشافي الصالحة
            const validHospitals = allHospitals.filter((hospital) => {
                return hospital.id !== undefined && hospital.id !== null;
            });
            
            setHospitals(validHospitals);
            
        } catch (err: any) {
            error('فشل تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHospitals();
    }, []);

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
            await fetchHospitals();
            
        } catch (err: any) {
            let errorMessage = err?.message || 'حدث خطأ غير متوقع';
            
            if (err?.message === 'Validation failed' || errorMessage.includes('Validation failed')) {
                errorMessage = 'اسم المشفى موجود مسبقاً أو البيانات غير صحيحة';
            } else if (errorMessage.includes('already been taken')) {
                errorMessage = 'اسم المشفى موجود مسبقاً، يرجى استخدام اسم آخر';
            }
            
            error(`${errorMessage}`);
            
        } finally {
            setCreating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            success('تم نسخ الرمز بنجاح');
        }).catch(() => {
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
            header: 'الإجراءات',
            accessor: (row) => (
                <Button
                    size="sm"
                    variant="primary"
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/hospitals/${row.id}`);
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
                <div className="flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">إدارة المشافي</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1 md:mt-2">إدارة ومراقبة جميع المشافي المسجلة في النظام</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <Badge variant="info" size="lg">
                        {hospitals.length} مشفى
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

<Table
                data={hospitals}
                columns={columns}
                loading={loading}
                searchable={true}
                searchPlaceholder="ابحث عن مشفى بالاسم، البريد، الهاتف..."
                emptyMessage="لا توجد مشافي مسجلة"
                itemsPerPage={10}
            />

            {/* Create Hospital Modal */}
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

            {/* Success Modal with Unique Code */}
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
                            {/* Hospital Name */}
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

                            {/* Email */}
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
                                            onClick={() => copyToClipboard(createdHospitalData.account?.email || createdHospitalData.email)}
                                            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded-md text-sm transition-colors"
                                        >
                                            نسخ
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Unique Code */}
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
                                            onClick={() => copyToClipboard(createdHospitalData.unique_code || createdHospitalData.code || createdHospitalData.password)}
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

                            {/* Phone Number */}
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
                                            onClick={() => copyToClipboard(createdHospitalData.account?.phone_number || createdHospitalData.phone_number)}
                                            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded-md text-sm transition-colors"
                                        >
                                            نسخ
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Warning Message */}
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

                    {/* Debug: Show all response data if unique_code not found */}
                    {createdHospitalData && !createdHospitalData.unique_code && !createdHospitalData.code && !createdHospitalData.password && (
                        <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 mt-4">
                            <p className="text-slate-400 text-sm mb-2">معلومات المشفى المُنشأ:</p>
                            <pre className="text-xs text-slate-300 overflow-auto max-h-60">
                                {JSON.stringify(createdHospitalData, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </Modal>

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

export default HospitalsPage;