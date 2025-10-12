import React, { useState, useEffect } from 'react';
import { HospitalService } from '../types';
import api from '../services/api';

const HospitalServicesPage: React.FC = () => {
    const [services, setServices] = useState<HospitalService[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentService, setCurrentService] = useState<Partial<HospitalService>>({});

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
            alert('يرجى إدخال اسم الخدمة.');
            return;
        }
        try {
            if (currentService.id) {
                // Update (PUT) uses JSON as per Postman raw body
                await api.put(`/admin/service/${currentService.id}`, { service_name: serviceName });
            } else {
                // Create (POST) uses FormData as per Postman formdata body
                const formData = new FormData();
                formData.append('service_name', serviceName);
                await api.post('/admin/service', formData);
            }
            fetchServices();
            handleCloseModal();
        } catch (error: any) {
            alert(`فشل الحفظ: ${error.message}`);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من رغبتك في حذف هذه الخدمة؟')) {
            try {
                await api.delete(`/admin/service/${id}`);
                fetchServices();
            } catch (error: any) {
                alert(`فشل الحذف: ${error.message}`);
            }
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-100">إدارة خدمات المشافي</h1>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white font-semibold transition-colors">إضافة خدمة</button>
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
                                services.map(service => (
                                    <tr key={service.id} className="border-b border-slate-700 hover:bg-slate-800">
                                        <td className="px-6 py-4">{service.id}</td>
                                        <td className="px-6 py-4 font-medium">{service.service_name}</td>
                                        <td className="px-6 py-4">{service.created_at ? new Date(service.created_at).toLocaleDateString('ar-EG') : '-'}</td>
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
            {isModalOpen && <ServiceModal service={currentService} onClose={handleCloseModal} onSave={handleSave} />}
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


export default HospitalServicesPage;