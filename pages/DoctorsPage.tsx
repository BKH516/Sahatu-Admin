
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

    useEffect(() => {
        const fetchDoctors = async () => {
            setLoading(true);
            try {
                const response = await api.get('/admin/doctor/all?per_page=10000');
                setDoctors(response.doctors?.data || response.doctors || []);
            } catch (error) {
            } finally {
                setLoading(false);
            }
        };
        fetchDoctors();
    }, []);

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
                        {doctors.length} طبيب
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
                itemsPerPage={10}
                onRowClick={(doctor) => navigate(`/doctors/${doctor.id}`)}
            />
        </div>
    );
};

export default DoctorsPage;
