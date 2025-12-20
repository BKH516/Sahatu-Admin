
import React, { useState, useEffect, useCallback } from 'react';
import { PendingAccount, Specialization } from '../types';
import api from '../services/api';
import Table, { Column } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import Toast from '../components/ui/Toast';

type Role = 'doctor' | 'nurse';

const ApprovalsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Role>('doctor');
    const [accounts, setAccounts] = useState<PendingAccount[]>([]);
    const [specializations, setSpecializations] = useState<Specialization[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAccount, setSelectedAccount] = useState<PendingAccount | null>(null);
    const { toasts, removeToast, success, error, warning } = useToast();

    const fetchAccounts = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.post('/admin/get-pending-accounts', { role: activeTab });
            
            // Ensure we get the correct data from the response
            let accountsData = response.data || response || [];
            
            // Filter accounts based on the active tab to ensure we only show the correct role
            if (Array.isArray(accountsData)) {
                accountsData = accountsData.filter((account: PendingAccount) => {
                    if (activeTab === 'doctor') {
                        return account.doctor && !account.nurse;
                    } else if (activeTab === 'nurse') {
                        return account.nurse && !account.doctor;
                    }
                    return false;
                });
            }
            
            setAccounts(accountsData);
        } catch (err) {
            error('فشل تحميل طلبات الموافقة');
            setAccounts([]);
        } finally {
            setLoading(false);
        }
    }, [activeTab, error]);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    useEffect(() => {
        const fetchSpecializations = async () => {
            try {
                const response = await api.get('/admin/specializations');
                let specs: Specialization[] = [];
                
                // Handle different response structures
                // Sometimes the response itself is the array
                if (Array.isArray(response)) {
                    specs = response;
                } else if (Array.isArray(response.data)) {
                    specs = response.data;
                } else if (response.data?.data && Array.isArray(response.data.data)) {
                    specs = response.data.data;
                } else if (response.data?.specializations) {
                    specs = response.data.specializations;
                }
                
                setSpecializations(specs);
            } catch (err: any) {
                // Only show error if it's not a rate limit error (429)
                // Rate limit errors are handled by the server and user should wait
                if (err?.status !== 429) {
                    error('فشل تحميل التخصصات');
                }
            }
        };
        fetchSpecializations();
    }, [error]);

    const getSpecializationName = (specializationId?: number): string => {
        if (!specializationId) return 'غير محدد';
        const spec = specializations.find(s => s.id === specializationId);
        return spec?.name_ar || 'غير محدد';
    };


    const handleApprove = async (id: number) => {
        try {
            await api.get(`/admin/approveAccount/${id}`);
            setAccounts(prev => prev.filter(acc => acc.id !== id));
            success('تمت الموافقة على الحساب بنجاح');
        } catch (err: any) {
            error(`فشلت الموافقة: ${err?.message || 'حدث خطأ غير متوقع'}`);
        }
    };
    
    const handleReject = async (id: number) => {
        const confirmed = window.confirm('هل أنت متأكد من رفض هذا الحساب؟');
        if (!confirmed) {
            return;
        }

        const rejectAccount = async () => {
            try {
                await api.post(`/admin/rejectAccount/${id}`);
                return;
            } catch (error) {
                await api.post('/admin/rejectAccount', { id });
            }
        };

        try {
            await rejectAccount();
            setAccounts(prev => prev.filter(acc => acc.id !== id));
            warning('تم رفض الحساب');
        } catch (err: any) {
            error(`فشل رفض الحساب: ${err?.message || 'حدث خطأ غير متوقع'}`);
        }
    };

    const columns: Column<PendingAccount>[] = [
        {
            header: 'الاسم الكامل',
            accessor: (row) => row.doctor?.full_name || row.nurse?.full_name || 'غير متوفر',
            sortable: true,
            className: 'font-medium text-white',
        },
        {
            header: 'البريد الإلكتروني',
            accessor: 'email',
        },
        {
            header: 'رقم الهاتف',
            accessor: 'phone_number',
        },
        {
            header: 'التخصص',
            accessor: (row) => (
                <div className="text-sm">
                    {row.doctor && (
                        <Badge variant="info" size="sm">
                            {row.doctor.specialization?.name_ar || getSpecializationName(row.doctor.specialization_id)}
                        </Badge>
                    )}
                    {row.nurse && (
                        <Badge variant="success" size="sm">
                            {row.nurse.graduation_type}
                        </Badge>
                    )}
                </div>
            ),
        },
        {
            header: 'تاريخ الطلب',
            accessor: (row) => new Date(row.created_at).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            }),
            sortable: true,
        },
        {
            header: 'الإجراءات',
            accessor: (row) => (
                <div className="flex gap-2 flex-wrap">
                    <Button
                        size="sm"
                        variant="primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAccount(row);
                        }}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        }
                    >
                        عرض
                    </Button>
                    <Button
                        size="sm"
                        variant="success"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(row.id);
                        }}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        }
                    >
                        موافقة
                    </Button>
                    <Button
                        size="sm"
                        variant="danger"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleReject(row.id);
                        }}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        }
                    >
                        رفض
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">طلبات الموافقة</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1 md:mt-2">مراجعة والموافقة على طلبات الانضمام للنظام</p>
                </div>
                <Badge variant="warning" size="lg">
                    {accounts.length} طلب معلق
                </Badge>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 sm:gap-2 p-1 bg-slate-800/50 rounded-lg border border-slate-700/50 w-full sm:w-fit overflow-x-auto">
                <TabButton
                    title="الأطباء"
                    isActive={activeTab === 'doctor'}
                    onClick={() => setActiveTab('doctor')}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    }
                />
                <TabButton
                    title="الممرضون"
                    isActive={activeTab === 'nurse'}
                    onClick={() => setActiveTab('nurse')}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    }
                />
            </div>

            <Table
                data={accounts}
                columns={columns}
                loading={loading}
                searchable={true}
                searchPlaceholder="ابحث في طلبات الموافقة..."
                emptyMessage={`لا توجد طلبات موافقة من ${activeTab === 'doctor' ? 'الأطباء' : 'الممرضين'} حالياً`}
                itemsPerPage={10}
            />

            {/* Details Modal */}
            <Modal
                isOpen={!!selectedAccount}
                onClose={() => setSelectedAccount(null)}
                title={`تفاصيل ${activeTab === 'doctor' ? 'الطبيب' : 'الممرض'}`}
                size="lg"
                footer={
                    <div className="flex gap-3 justify-end">
                        <Button
                            variant="danger"
                            onClick={() => {
                                if (selectedAccount) {
                                    handleReject(selectedAccount.id);
                                    setSelectedAccount(null);
                                }
                            }}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            }
                        >
                            رفض الحساب
                        </Button>
                        <Button
                            variant="success"
                            onClick={() => {
                                if (selectedAccount) {
                                    handleApprove(selectedAccount.id);
                                    setSelectedAccount(null);
                                }
                            }}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            }
                        >
                            الموافقة على الحساب
                        </Button>
                    </div>
                }
            >
                {selectedAccount && (
                    <div className="space-y-6">
                        {/* Profile Header with Image */}
                        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl p-4 sm:p-6 border border-cyan-500/30">
                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                {/* Profile Image */}
                                <div className="flex-shrink-0">
                                    {(selectedAccount.doctor?.profile_image || selectedAccount.nurse?.profile_image) ? (
                                        <img 
                                            src={selectedAccount.doctor?.profile_image || selectedAccount.nurse?.profile_image} 
                                            alt={selectedAccount.doctor?.full_name || selectedAccount.nurse?.full_name}
                                            className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-cyan-400 shadow-lg shadow-cyan-500/50"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                            }}
                                        />
                                    ) : null}
                                    <div className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center border-4 border-cyan-400 shadow-lg shadow-cyan-500/50 ${(selectedAccount.doctor?.profile_image || selectedAccount.nurse?.profile_image) ? 'hidden' : ''}`}>
                                        <svg className="w-12 h-12 sm:w-16 sm:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                </div>
                                
                                {/* Profile Info */}
                                <div className="flex-1 text-center sm:text-right space-y-2">
                                    <h2 className="text-2xl sm:text-3xl font-bold text-white">
                                        {selectedAccount.doctor?.full_name || selectedAccount.nurse?.full_name || 'غير متوفر'}
                                    </h2>
                                    {selectedAccount.doctor && (
                                        <div className="flex items-center justify-center sm:justify-start gap-2">
                                            <Badge variant="info" size="lg">
                                                <span className="flex items-center gap-2">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    {selectedAccount.doctor.specialization?.name_ar || getSpecializationName(selectedAccount.doctor.specialization_id)}
                                                </span>
                                            </Badge>
                                        </div>
                                    )}
                                    {selectedAccount.nurse && (
                                        <div className="flex items-center justify-center sm:justify-start gap-2">
                                            <Badge variant="success" size="lg">
                                                <span className="flex items-center gap-2">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                    </svg>
                                                    {selectedAccount.nurse.graduation_type}
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
                                <DetailItem label="البريد الإلكتروني" value={selectedAccount.email} />
                                <DetailItem label="رقم الهاتف" value={selectedAccount.phone_number} />
                                <DetailItem 
                                    label="تاريخ التسجيل" 
                                    value={new Date(selectedAccount.created_at).toLocaleDateString('ar-EG', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })} 
                                />
                            </div>
                        </div>

                        {/* Doctor/Nurse Specific Information */}
                        {selectedAccount.doctor && (
                            <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700/50">
                                <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    المعلومات المهنية
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <DetailItem 
                                        label="التخصص" 
                                        value={
                                            <Badge variant="info" size="md">
                                                {selectedAccount.doctor.specialization?.name_ar || getSpecializationName(selectedAccount.doctor.specialization_id)}
                                            </Badge>
                                        } 
                                    />
                                    <DetailItem label="العنوان" value={selectedAccount.doctor.address} />
                                    {selectedAccount.doctor.age && (
                                        <DetailItem label="العمر" value={`${selectedAccount.doctor.age} سنة`} />
                                    )}
                                    {selectedAccount.doctor.gender && (
                                        <DetailItem 
                                            label="الجنس" 
                                            value={selectedAccount.doctor.gender === 'male' ? 'ذكر' : 'أنثى'} 
                                        />
                                    )}
                                    {selectedAccount.doctor.profile_description && (
                                        <div className="sm:col-span-2">
                                            <DetailItem 
                                                label="الوصف الشخصي" 
                                                value={selectedAccount.doctor.profile_description} 
                                            />
                                        </div>
                                    )}
                                    {selectedAccount.doctor.license_image_path && (
                                        <div className="sm:col-span-2">
                                            <p className="text-xs sm:text-sm text-slate-400 font-medium mb-2">صورة الرخصة الطبية</p>
                                            <div className="relative group">
                                                <img 
                                                    src={`https://sahtee.evra-co.com/storage/${selectedAccount.doctor.license_image_path}`}
                                                    alt="رخصة طبية"
                                                    className="w-full max-w-md rounded-lg border-2 border-slate-600 hover:border-cyan-400 transition-all duration-300 cursor-pointer"
                                                    onClick={() => window.open(`https://sahtee.evra-co.com/storage/${selectedAccount.doctor.license_image_path}`, '_blank')}
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 rounded-lg flex items-center justify-center">
                                                    <svg className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {selectedAccount.nurse && (
                            <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700/50">
                                <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    المعلومات المهنية
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <DetailItem 
                                        label="نوع التخرج" 
                                        value={
                                            <Badge variant="success" size="md">
                                                {selectedAccount.nurse.graduation_type}
                                            </Badge>
                                        } 
                                    />
                                    <DetailItem label="العنوان" value={selectedAccount.nurse.address} />
                                    {selectedAccount.nurse.age && (
                                        <DetailItem label="العمر" value={`${selectedAccount.nurse.age} سنة`} />
                                    )}
                                    {selectedAccount.nurse.gender && (
                                        <DetailItem 
                                            label="الجنس" 
                                            value={selectedAccount.nurse.gender === 'male' ? 'ذكر' : 'أنثى'} 
                                        />
                                    )}
                                    {selectedAccount.nurse.profile_description && (
                                        <div className="sm:col-span-2">
                                            <DetailItem 
                                                label="الوصف الشخصي" 
                                                value={selectedAccount.nurse.profile_description} 
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Status Badge */}
                        <div className="flex items-center justify-center">
                            <Badge 
                                variant={
                                    selectedAccount.is_approved === 'approved' ? 'success' : 
                                    selectedAccount.is_approved === 'rejected' ? 'danger' : 
                                    'warning'
                                } 
                                size="lg"
                            >
                                {selectedAccount.is_approved === 'approved' ? '✓ تمت الموافقة' : 
                                 selectedAccount.is_approved === 'rejected' ? '✗ مرفوض' : 
                                 '⏳ قيد الانتظار'}
                            </Badge>
                        </div>
                    </div>
                )}
            </Modal>

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

interface TabButtonProps {
    title: string;
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ title, isActive, onClick, icon }) => (
    <button
        onClick={onClick}
        className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-xs sm:text-sm transition-all duration-200 flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
            isActive
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }`}
    >
        <span className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">{icon}</span>
        {title}
    </button>
);

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

export default ApprovalsPage;
