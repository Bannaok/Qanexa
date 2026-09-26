import React, { useState } from 'react';
import { useAuth } from '../services/authContext';
import { useToast } from '../services/toastContext';
import { X, User, Key, Check, ShieldCheck, Mail, Lock } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, isAdmin, updateProfile, changeAdminPassword } = useAuth();
  const { error } = useToast();

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  if (!isOpen || !currentUser) return null;

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      error('กรุณาระบุชื่อ-นามสกุล');
      return;
    }

    setIsUpdating(true);
    await updateProfile(displayName);
    setIsUpdating(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      error('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (newPassword !== confirmPassword) {
      error('รหัสผ่านใหม่กับยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setIsUpdating(true);
    const res = await changeAdminPassword(currentPassword, newPassword);
    setIsUpdating(false);

    if (res.success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else if (res.message) {
      error(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-slate-800">
                ข้อมูลส่วนตัวและรหัสผ่าน (User Settings)
              </h3>
              <p className="text-xs text-slate-500">
                {isAdmin ? 'สิทธิ์ผู้ดูแลระบบ (Admin)' : 'สิทธิ์สมาชิกทั่วไป (Member)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Email Info */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-600">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-400">อีเมลบัญชี (Gmail / ID)</div>
              <div className="text-sm font-semibold text-slate-800 truncate">{currentUser.email}</div>
            </div>
          </div>

          {/* Section 1: Edit First Name - Last Name (Both Regular and Admin) */}
          <form onSubmit={handleUpdateName} className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. แก้ไข ชื่อ - นามสกุล
            </h4>
            <div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ระบุชื่อ - นามสกุลของคุณ"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                บันทึกชื่อ-นามสกุล
              </button>
            </div>
          </form>

          {/* Section 2: Admin Password Change (Admin Only) */}
          {isAdmin ? (
            <form onSubmit={handleChangePassword} className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>2. เปลี่ยนรหัสผ่านระบบ Admin (Admin Password)</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">รหัสผ่านปัจจุบัน</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="รหัสผ่านปัจจุบัน"
                    className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="รหัสผ่านใหม่"
                    className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ยืนยันรหัสผ่านใหม่</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                    className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Key className="w-3.5 h-3.5" />
                  บันทึกรหัสผ่านใหม่
                </button>
              </div>
            </form>
          ) : (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-500">
              💡 สมาชิกทั่วไปเข้าสู่ระบบผ่าน Google Sign-In จึงไม่ต้องจัดการรหัสผ่านระบบ
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
