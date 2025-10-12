import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Nurse } from '../types';
import api from '../services/api';

const NurseDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [nurse, setNurse] = useState<Nurse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNurseDetails();
    }, [id]);

    const fetchNurseDetails = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/admin/nurse/${id}`);
            setNurse(response.nurse || response);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
            </div>
        );
    }

    if (!nurse) {
        return (
            <div className="text-center p-8">
                <p className="text-xl text-slate-300 mb-6">لم يتم العثور على الممرض</p>
                <button 
                    onClick={() => navigate('/nurses')} 
                    className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-cyan-500/20"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    العودة إلى قائمة الممرضين
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/nurses')} 
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-500 rounded-lg transition-all duration-200 group"
                    >
                        <svg className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-slate-300 group-hover:text-white font-medium transition-colors">رجوع</span>
                    </button>
                    <h1 className="text-3xl font-bold text-slate-100">تفاصيل الممرض - {nurse.full_name}</h1>
                </div>
            </div>

            {/* Nurse Info Card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">المعلومات الأساسية</h2>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <p className="text-slate-400 text-sm">الاسم الكامل</p>
                            <p className="text-white font-medium">{nurse.full_name}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">البريد الإلكتروني</p>
                            <p className="text-white font-medium">{nurse.account?.email}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">رقم الهاتف</p>
                            <p className="text-white font-medium">{nurse.account?.phone_number}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">العمر</p>
                            <p className="text-white font-medium">{nurse.age} سنة</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">الجنس</p>
                            <p className="text-white font-medium">{nurse.gender === 'male' ? 'ذكر' : 'أنثى'}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">نوع التخرج</p>
                            <p className="text-white font-medium">{nurse.graduation_type}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">الحالة</p>
                            <p className="text-white font-medium">
                                <span className={`inline-block px-3 py-1 text-xs rounded-full ${nurse.is_active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                    {nurse.is_active ? 'نشط' : 'غير نشط'}
                                </span>
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">العنوان</p>
                            <p className="text-white font-medium">{nurse.address}</p>
                        </div>
                        {nurse.profile_description && (
                            <div>
                                <p className="text-slate-400 text-sm">الوصف</p>
                                <p className="text-white font-medium">{nurse.profile_description}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Profile Image (if available) */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex flex-col">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">الملف الشخصي</h2>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-48 h-48 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
                                <svg className="w-24 h-24 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <p className="text-slate-400 text-sm">صورة الملف الشخصي</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NurseDetailsPage;

