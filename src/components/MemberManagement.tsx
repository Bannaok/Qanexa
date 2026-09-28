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
  UserPlus,
  Key,
  Eye,
  EyeOff,
  User,
  ShieldAlert,
} from 'lucide-react';

interface MemberManagementProps {
  onClose?: () => void;
}

export const MemberManagement: React.FC<MemberManagementProps> = () => {
  const { currentUser } = useAuth();
  const { success, warning, error, info } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');

  // Form for creating a new member (ID + Password + DisplayName)
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [newDisplayNameInput, setNewDisplayNameInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Toggle visibility of passwords in table (keyed by user id)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

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
      success('อนุมัติสิทธิ์การใช้งานสำเร็จ', `อนุญาตให้รหัสผู้ใช้ ${user.username || user.id} เข้าใช้งานระบบเรียบร้อย`);
    } else if (newStatus === 'rejected') {
      warning('ระงับสิทธิ์การใช้งาน', `ระงับการเข้าถึงของรหัสผู้ใช้ ${user.username || user.id}`);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.role === 'admin' && (user.id === 'admin_root' || user.username === 'admin')) {
      error('ไม่สามารถลบ Root Admin ได้');
      return;
    }
    const displayNameOrId = user.displayName || user.username || user.id;
    if (confirm(`คุณต้องการลบผู้ใช้งาน "${displayNameOrId}" (ID: ${user.username || user.id}) ออกจากระบบอย่างถาวรหรือไม่?`)) {
      storageService.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      info('ลบผู้ใช้งานเรียบร้อยแล้ว');
    }
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    const username = newUsernameInput.trim();
    const password = newPasswordInput.trim();

    if (!username) {
      error('กรุณาระบุรหัสผู้ใช้ (ID)');
      return;
    }

    if (!password) {
      error('กรุณาระบุรหัสผ่าน');
      return;
    }

    if (password.length < 4) {
      error('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    const lower = username.toLowerCase();
    const existing = users.find(
      (u) => (u.username && u.username.toLowerCase() === lower) || u.id.toLowerCase() === lower
    );

    if (existing) {
      error('รหัสผู้ใช้ (ID) นี้มีอยู่ในระบบแล้ว กรุณาเลือกรหัสอื่น');
      return;
    }

    const newUser: UserProfile = {
      id: 'user_' + Math.random().toString(36).substring(2, 9),
      username,
      password,
      email: `${username}@system.local`,
      displayName: newDisplayNameInput.trim() || username,
      role: 'member',
      status: 'approved',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      storageBytes: 0,
    };

    storageService.updateUser(newUser);
    loadUsers();
    setNewUsernameInput('');
    setNewPasswordInput('');
    setNewDisplayNameInput('');
    setIsAdding(false);
    success(
      'สร้างสมาชิกใหม่เรียบร้อย',
      `ID: ${newUser.username} รหัสผ่าน: ${newUser.password} (สมาชิกสามารถเข้าสู่ระบบและเปลี่ยนชื่อได้)`
    );
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      (u.username && u.username.toLowerCase().includes(search.toLowerCase())) ||
      (u.displayName && u.displayName.toLowerCase().includes(search.toLowerCase())) ||
      u.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' ? true : u.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Storage stats
  const totalStorageBytes = users.reduce((acc, u) => acc + (u.storageBytes || 0), 0);
  const pendingCount = users.filter((u) => u.status === 'pending').length;
  const maxQuotaBytes = 20 * 1024 * 1024;

  return (
    <div className="w-full space-y-4">
      {/* Top Header & Actions Bar */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-heading font-bold text-slate-800">
                จัดการสมาชิก (Member Management)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              สร้าง ID/รหัสผ่าน อนุมัติสิทธิ์ และดูแลผู้ใช้งานในระบบ
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isAdding ? 'ปิดฟอร์ม' : 'สร้าง ID & รหัสผ่าน'}</span>
            </button>
            <button
              onClick={loadUsers}
              disabled={isSyncing}
              className="p-2 text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Summary Cards (Fills full width evenly) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200/90 flex items-center gap-3 shadow-2xs">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-500 font-medium truncate">สมาชิกทั้งหมด</div>
              <div className="text-base font-bold text-slate-800">{users.length} <span className="text-xs font-normal text-slate-400">บัญชี</span></div>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/90 flex items-center gap-3 shadow-2xs">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-500 font-medium truncate">รอการอนุมัติ</div>
              <div className="text-base font-bold text-amber-600">{pendingCount} <span className="text-xs font-normal text-slate-400">รายการ</span></div>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/90 flex items-center gap-3 shadow-2xs">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-500 font-medium truncate">พื้นที่จัดเก็บข้อมูลรวม</div>
              <div className="text-base font-bold text-purple-700 truncate">{storageService.formatBytes(totalStorageBytes)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Member Form (Collapsible) */}
      {isAdding && (
        <form onSubmit={handleCreateMember} className="p-4 sm:p-5 bg-indigo-50/70 border border-indigo-200 rounded-2xl animate-fadeIn space-y-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-indigo-900">
            <UserPlus className="w-4 h-4 text-indigo-600" />
            <span>สร้างบัญชีสมาชิกใหม่ (กำหนด ID และ Password)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Username / ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รหัสผู้ใช้ / ID (Username) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="เช่น teacher01"
                  value={newUsernameInput}
                  onChange={(e) => setNewUsernameInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รหัสผ่าน (Password) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="เช่น 123456"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  required
                />
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อ - นามสกุล (ไม่บังคับ)
              </label>
              <input
                type="text"
                placeholder="เช่น อ.สมชาย (เปลี่ยนภายหลังได้)"
                value={newDisplayNameInput}
                onChange={(e) => setNewDisplayNameInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-slate-500">
              💡 สมาชิกสามารถนำ ID และรหัสผ่านไปล็อกอินเข้าสู่ระบบได้ทันที
            </p>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-xs font-medium cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                บันทึกและสร้างสมาชิก
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter and Search Bar (Responsive full width) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหารหัสผู้ใช้ (ID) หรือชื่อ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 shrink-0">
          <span className="text-xs text-slate-500 font-medium shrink-0">สถานะ:</span>
          <div className="inline-flex bg-slate-100 p-0.5 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'all' ? 'bg-white shadow-xs text-slate-800 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({users.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs font-semibold'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              รออนุมัติ ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'approved' ? 'bg-white shadow-xs text-emerald-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              อนุมัติแล้ว
            </button>
          </div>
        </div>
      </div>

      {/* Members List Container - Perfectly fits width, no side-scroll */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm">ไม่พบข้อมูลสมาชิกตามเงื่อนไขที่เลือก</p>
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table View (Fits width perfectly with table-fixed & auto layout) */}
            <div className="hidden md:block">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/90 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-4/12">สมาชิก (ID & ชื่อ)</th>
                    <th className="py-3 px-3 w-2/12">รหัสผ่าน</th>
                    <th className="py-3 px-3 w-2/12">สิทธิ์ & สถานะ</th>
                    <th className="py-3 px-3 w-2/12">พื้นที่ใช้งาน</th>
                    <th className="py-3 px-4 w-2/12 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => {
                    const storagePercent = Math.min(
                      100,
                      Math.round(((user.storageBytes || 0) / maxQuotaBytes) * 100)
                    );
                    const displayId = user.username || user.id;
                    const isPasswordVisible = visiblePasswords[user.id];

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* User Info (ID + Name) */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={
                                user.avatarUrl ||
                                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                  user.displayName || displayId
                                )}`
                              }
                              alt={user.displayName}
                              className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 object-cover shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                  {displayId}
                                </span>
                              </div>
                              <div className="text-xs text-slate-700 truncate mt-0.5 font-medium">
                                {user.displayName || 'ยังไม่ระบุชื่อ'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Password */}
                        <td className="py-3 px-3">
                          {user.role === 'admin' ? (
                            <span className="text-[11px] text-slate-400 italic">Admin Root</span>
                          ) : (
                            <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                              <span className="font-mono text-xs text-slate-800">
                                {isPasswordVisible ? (user.password || '123456') : '••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(user.id)}
                                className="p-0.5 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                                title={isPasswordVisible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                              >
                                {isPasswordVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Role & Status */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            {user.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                <ShieldCheck className="w-3 h-3" />
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                                สมาชิก
                              </span>
                            )}

                            {user.status === 'approved' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                                <CheckCircle className="w-3 h-3 text-emerald-500" />
                                อนุมัติแล้ว
                              </span>
                            )}
                            {user.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 animate-pulse">
                                <Clock className="w-3 h-3 text-amber-500" />
                                รออนุมัติ
                              </span>
                            )}
                            {user.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600">
                                <XCircle className="w-3 h-3 text-rose-500" />
                                ระงับสิทธิ์
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Storage Usage Index */}
                        <td className="py-3 px-3">
                          <div className="w-full max-w-[120px]">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-semibold text-slate-700 truncate">
                                {storageService.formatBytes(user.storageBytes || 0)}
                              </span>
                              <span className="text-slate-400 text-[10px]">{storagePercent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  storagePercent > 80
                                    ? 'bg-rose-500'
                                    : storagePercent > 50
                                    ? 'bg-amber-500'
                                    : 'bg-indigo-500'
                                }`}
                                style={{ width: `${Math.max(storagePercent, 4)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {user.status === 'pending' && (
                              <button
                                onClick={() => handleUpdateStatus(user, 'approved')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                อนุมัติ
                              </button>
                            )}

                            {user.status === 'approved' && user.role !== 'admin' && (
                              <button
                                onClick={() => handleUpdateStatus(user, 'rejected')}
                                className="px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                                title="ระงับสิทธิ์ชั่วคราว"
                              >
                                ระงับ
                              </button>
                            )}

                            {user.status === 'rejected' && user.role !== 'admin' && (
                              <button
                                onClick={() => handleUpdateStatus(user, 'approved')}
                                className="px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                                title="คืนสิทธิ์การใช้งาน"
                              >
                                ปลดบล็อก
                              </button>
                            )}

                            {user.role !== 'admin' && (
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-0.5"
                                title="ลบผู้ใช้งานนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Small Screens Card View (No horizontal scroll at all!) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const storagePercent = Math.min(
                  100,
                  Math.round(((user.storageBytes || 0) / maxQuotaBytes) * 100)
                );
                const displayId = user.username || user.id;
                const isPasswordVisible = visiblePasswords[user.id];

                return (
                  <div key={user.id} className="p-3.5 hover:bg-slate-50/80 transition-colors space-y-2.5">
                    {/* Header Row: Avatar, ID, Display Name, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={
                            user.avatarUrl ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                              user.displayName || displayId
                            )}`
                          }
                          alt={user.displayName}
                          className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                              {displayId}
                            </span>
                            {user.role === 'admin' ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                Admin
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-slate-800 font-medium truncate mt-0.5">
                            {user.displayName || 'ยังไม่ได้ระบุชื่อ'}
                          </div>
                        </div>
                      </div>

                      {/* Status Tag */}
                      <div className="shrink-0">
                        {user.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            อนุมัติแล้ว
                          </span>
                        )}
                        {user.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-300 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-500" />
                            รออนุมัติ
                          </span>
                        )}
                        {user.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <ShieldAlert className="w-3 h-3 text-rose-500" />
                            ระงับสิทธิ์
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Password & Storage */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-xl text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium mb-0.5">รหัสผ่าน</div>
                        {user.role === 'admin' ? (
                          <span className="text-[11px] text-slate-400 italic">Root Admin</span>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <span className="font-mono font-semibold text-slate-700">
                              {isPasswordVisible ? (user.password || '123456') : '••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="p-0.5 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                            >
                              {isPasswordVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mb-0.5">
                          <span>พื้นที่</span>
                          <span>{storagePercent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              storagePercent > 80 ? 'bg-rose-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.max(storagePercent, 4)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Row */}
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      {user.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus(user, 'approved')}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          อนุมัติการใช้งาน
                        </button>
                      )}

                      {user.status === 'approved' && user.role !== 'admin' && (
                        <button
                          onClick={() => handleUpdateStatus(user, 'rejected')}
                          className="px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                        >
                          ระงับสิทธิ์
                        </button>
                      )}

                      {user.status === 'rejected' && user.role !== 'admin' && (
                        <button
                          onClick={() => handleUpdateStatus(user, 'approved')}
                          className="px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                        >
                          ปลดบล็อก
                        </button>
                      )}

                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="ลบผู้ใช้งาน"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
