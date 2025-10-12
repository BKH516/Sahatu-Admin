
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Nurse } from '../types';
import api from '../services/api';

const NursesPage: React.FC = () => {
    const navigate = useNavigate();
    const [nurses, setNurses] = useState<Nurse[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNurses = async () => {
            setLoading(true);
            try {
                const response = await api.get('/admin/nurse/all?per_page=10000');
                setNurses(response.nurses?.data || response.nurses || []);
            } catch (error) {
            } finally {
                setLoading(false);
            }
        };
        fetchNurses();
    }, []);

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 text-slate-100">إدارة الممرضين</h1>
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
        </div>
    );
};

export default NursesPage;
