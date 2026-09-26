import React, { useState, useEffect } from 'react';
import { UserProfile, UserStatus } from '../types';
import { storageService } from '../services/storageService';
import { useAuth } from '../services/authContext';
import { useToast } from '../services/toastContext';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  HardDrive,
  Search,
  Trash2,
  ShieldCheck,
  UserCheck,
  RefreshCw,
  Mail,
  UserPlus,
} from 'lucide-react';

interface MemberManagementProps {
  onClose?: () => void;
}

export const MemberManagement: React.FC<MemberManagementProps> = ({ onClose }) => {
  const { currentUser } = useAuth();
  const { success, warning, error, info } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [newGmailInput, setNewGmailInput] = useState('');
  const [newDisplayNameInput, setNewDisplayNameInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);

  const loadUsers = async () => {
    // 1. Load local immediate
    const list = storageService.getUsers();
    setUsers(list);

    // 2. Fetch fresh from Cloudflare D1
    setIsSyncing(true);
    try {
      await storageService.syncWithD1(currentUser);
      const updated = storageService.getUsers();
      setUsers(updated);
    } catch {
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleUpdateStatus = async (user: UserProfile, newStatus: UserStatus) => {
    const updated: UserProfile = { ...user, status: newStatus };
    storageService.updateUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));

    if (newStatus === 'approved') {
      success('อนุมัติสิทธิ์การใช้งานสำเร็จ', `อนุญาตให้ ${user.email} เข้าใช้งานระบบเรียบร้อย (ซิงค์ไปยังทุกเครื่องทันที)`);
    } else if (newStatus === 'rejected') {
      warning('ระงับสิทธิ์การใช้งาน', `ระงับการเข้าถึงของ ${user.email} (ซิงค์ไปยังทุกเครื่องทันที)`);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.role === 'admin' && user.id === 'admin_root') {
      error('ไม่สามารถลบ Root Admin ได้');
      return;
    }
    if (confirm(`คุณต้องการลบผู้ใช้งาน ${user.email} ออกจากระบบอย่างถาวรหรือไม่?`)) {
      storageService.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      info('ลบผู้ใช้งานเรียบร้อยแล้ว (ซิงค์ไปยังคลาวด์เรียบร้อย)');
    }
  };

  const handleManualAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGmailInput.trim()) return;

    const email = newGmailInput.trim().toLowerCase();
    if (!email.includes('@')) {
      error('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    if (storageService.getUserByEmail(email)) {
      error('อีเมลนี้มีอยู่ในระบบแล้ว');
      return;
    }

    const newUser: UserProfile = {
      id: 'user_' + Math.random().toString(36).substring(2, 9),
      email,
      displayName: newDisplayNameInput.trim() || email.split('@')[0],
      role: 'member',
      status: 'approved', // Admin manually added so approved
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      storageBytes: 0,
    };

    storageService.updateUser(newUser);
    loadUsers();
    setNewGmailInput('');
    setNewDisplayNameInput('');
    setIsAdding(false);
    success('เพิ่มสมาชิกใหม่เรียบร้อย', `${newUser.email} ได้รับการอนุมัติสิทธิ์เข้าใช้งานทันที`);
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' ? true : u.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Calculate global storage stats
  const totalStorageBytes = users.reduce((acc, u) => acc + (u.storageBytes || 0), 0);
  const pendingCount = users.filter((u) => u.status === 'pending').length;

  // Max quota threshold for display percentage (e.g., 20 MB per user reference)
  const maxQuotaBytes = 20 * 1024 * 1024;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-heading font-bold text-slate-800">
                จัดการสมาชิกและการอนุมัติสิทธิ์ (Admin Approval Workflow)
              </h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              ตรวจสอบคำขอเข้าใช้งาน Gmail, อนุมัติสิทธิ์ และติดตามปริมาณพื้นที่จัดเก็บข้อมูล (Storage Usage Index)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              เพิ่มสมาชิกโดยตรง
            </button>
            <button
              onClick={loadUsers}
              className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">สมาชิกทั้งหมด</div>
              <div className="text-lg font-bold text-slate-800">{users.length} บัญชี</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">รอการอนุมัติ (Pending)</div>
              <div className="text-lg font-bold text-amber-600">{pendingCount} รายการ</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">พื้นที่จัดเก็บข้อมูลรวม</div>
              <div className="text-lg font-bold text-purple-700">{storageService.formatBytes(totalStorageBytes)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Add Member Form (Accordion) */}
      {isAdding && (
        <form onSubmit={handleManualAddMember} className="p-4 bg-indigo-50/50 border-b border-indigo-100 flex flex-wrap items-center gap-3 animate-fadeIn">
          <input
            type="email"
            placeholder="ระบุ Gmail สมาชิก เช่น teacher@gmail.com"
            value={newGmailInput}
            onChange={(e) => setNewGmailInput(e.target.value)}
            className="flex-1 min-w-[240px] px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          <input
            type="text"
            placeholder="ชื่อ - นามสกุล (ไม่บังคับ)"
            value={newDisplayNameInput}
            onChange={(e) => setNewDisplayNameInput(e.target.value)}
            className="w-56 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            บันทึกและอนุมัติ
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm cursor-pointer"
          >
            ยกเลิก
          </button>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ หรือ Gmail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium shrink-0">สถานะ:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'all' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({users.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              รออนุมัติ ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'approved' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              อนุมัติแล้ว
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
            <tr>
              <th className="py-3.5 px-6">ผู้ใช้งาน (Gmail & Name)</th>
              <th className="py-3.5 px-4">สิทธิ์ (Role)</th>
              <th className="py-3.5 px-4">สถานะการอนุมัติ</th>
              <th className="py-3.5 px-6">Storage Usage Index</th>
              <th className="py-3.5 px-6 text-right">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  ไม่พบข้อมูลสมาชิกตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const storagePercent = Math.min(
                  100,
                  Math.round(((user.storageBytes || 0) / maxQuotaBytes) * 100)
                );

                return (
                  <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* User Info */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            user.avatarUrl ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                              user.displayName || user.email
                            )}`
                          }
                          alt={user.displayName}
                          className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 object-cover"
                        />
                        <div>
                          <div className="font-semibold text-slate-800">{user.displayName}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-4 px-4">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          สมาชิก (Member)
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-4">
                      {user.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          อนุมัติแล้ว
                        </span>
                      )}
                      {user.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-300 animate-pulse">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          รอดำเนินการอนุมัติ
                        </span>
                      )}
                      {user.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          ไม่อนุมัติ
                        </span>
                      )}
                    </td>

                    {/* Storage Usage Index */}
                    <td className="py-4 px-6 min-w-[200px]">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-700">
                            {storageService.formatBytes(user.storageBytes || 0)}
                          </span>
                          <span className="text-slate-400">{storagePercent}% ของ 20MB</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              storagePercent > 80
                                ? 'bg-rose-500'
                                : storagePercent > 50
                                ? 'bg-amber-500'
                                : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.max(storagePercent, 3)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {user.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateStatus(user, 'approved')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            อนุญาต / อนุมัติ
                          </button>
                        )}

                        {user.status === 'approved' && user.role !== 'admin' && (
                          <button
                            onClick={() => handleUpdateStatus(user, 'pending')}
                            className="px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="ระงับสิทธิ์ชั่วคราว"
                          >
                            ระงับสิทธิ์
                          </button>
                        )}

                        {user.role !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบผู้ใช้นี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
