
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import api from '../services/api';
import Table, { Column } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const response = await api.get('/admin/user/all?per_page=10000');
                setUsers(response.users?.data || response.users || []);
            } catch (error) {
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const columns: Column<User>[] = [
        {
            header: 'الاسم الكامل',
            accessor: 'full_name',
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
            header: 'العمر',
            accessor: 'age',
            sortable: true,
        },
        {
            header: 'الجنس',
            accessor: (row) => (
                <Badge variant={row.gender === 'male' ? 'info' : 'success'} size="sm">
                    {row.gender === 'male' ? 'ذكر' : row.gender === 'female' ? 'أنثى' : '-'}
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
                        setSelectedUser(row);
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
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">إدارة المستخدمين</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1 md:mt-2">إدارة ومراقبة جميع المستخدمين المسجلين في النظام</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="info" size="lg">
                        {users.length} مستخدم
                    </Badge>
                </div>
            </div>

            <Table
                data={users}
                columns={columns}
                loading={loading}
                searchable={true}
                searchPlaceholder="ابحث عن مستخدم بالاسم، البريد، الهاتف..."
                emptyMessage="لا يوجد مستخدمون مسجلون"
                itemsPerPage={10}
                onRowClick={setSelectedUser}
            />

            {/* User Details Modal */}
            <Modal
                isOpen={!!selectedUser}
                onClose={() => setSelectedUser(null)}
                title="تفاصيل المستخدم"
                footer={
                    <Button variant="secondary" onClick={() => setSelectedUser(null)}>
                        إغلاق
                    </Button>
                }
            >
                {selectedUser && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <p className="text-slate-400 text-sm">الاسم الكامل</p>
                            <p className="text-white font-medium text-lg">{selectedUser.full_name || '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-slate-400 text-sm">العمر</p>
                            <p className="text-white font-medium text-lg">{selectedUser.age || '-'} سنة</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-slate-400 text-sm">الجنس</p>
                            <Badge variant={selectedUser.gender === 'male' ? 'info' : 'success'}>
                                {selectedUser.gender === 'male' ? 'ذكر' : 'أنثى'}
                            </Badge>
                        </div>
                        <div className="space-y-1">
                            <p className="text-slate-400 text-sm">معرف المستخدم</p>
                            <p className="text-white font-medium text-lg">#{selectedUser.id}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                            <p className="text-slate-400 text-sm">البريد الإلكتروني</p>
                            <p className="text-white font-medium text-lg">{selectedUser.account?.email || '-'}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                            <p className="text-slate-400 text-sm">رقم الهاتف</p>
                            <p className="text-white font-medium text-lg direction-ltr text-right">{selectedUser.account?.phone_number || '-'}</p>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default UsersPage;
