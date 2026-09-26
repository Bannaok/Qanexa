import React, { useState } from 'react';
import { useAuth } from '../services/authContext';
import { useToast } from '../services/toastContext';
import { X, Lock, ShieldCheck, Mail, ArrowRight, User } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { loginAsAdmin, loginWithGoogle } = useAuth();
  const { error, success } = useToast();

  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');

  // Email form state
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Google prompt state
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');

  // Admin form state
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId.trim() || !adminPassword.trim()) {
      error('กรุณาระบุรหัสผู้ดูแลระบบและรหัสผ่าน');
      return;
    }
    setLoading(true);
    const res = await loginAsAdmin(adminId, adminPassword);
    setLoading(false);

    if (res.success) {
      onClose();
    } else if (res.message) {
      error(res.message);
    }
  };

  const handleGoogleContinueClick = () => {
    setShowGooglePrompt(true);
    setShowEmailInput(false);
  };

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmailInput.trim()) {
      error('กรุณาระบุบัญชี Google (Gmail)');
      return;
    }
    const mail = googleEmailInput.trim().toLowerCase();
    if (!mail.includes('@')) {
      error('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    setLoading(true);
    const res = await loginWithGoogle(mail);
    setLoading(false);

    if (res.success) {
      onClose();
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      error('กรุณาระบุอีเมล');
      return;
    }

    const mail = email.trim().toLowerCase();
    if (!mail.includes('@')) {
      error('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    setLoading(true);
    const res = await loginWithGoogle(mail, displayName.trim() || undefined);
    setLoading(false);

    if (res.success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              OMR
            </div>
            <h3 className="font-heading font-bold text-lg text-slate-900">เข้าสู่ระบบ (Sign In)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 mx-6 mt-6 rounded-2xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('user');
              setShowEmailInput(false);
              setShowGooglePrompt(false);
            }}
            className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'user'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4 text-indigo-600" />
            ผู้ใช้งานทั่วไป
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'admin'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            ผู้ดูแลระบบ (Admin)
          </button>
        </div>

        {/* Tab 1: Member Section (Continue with Google, Continue with Email) */}
        {activeTab === 'user' && (
          <div className="p-6 space-y-4 bg-white">
            <div className="text-center mb-2">
              <h4 className="font-heading font-semibold text-slate-900 text-base">
                เข้าสู่ระบบสมาชิก
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                เลือกช่องทางการเข้าสู่ระบบเพื่อเริ่มใช้งาน
              </p>
            </div>

            {/* Standard Login Buttons: Continue with Google & Continue with Email */}
            {!showEmailInput && !showGooglePrompt && (
              <div className="space-y-3 pt-1">
                {/* Continue with Google Button */}
                <button
                  type="button"
                  onClick={handleGoogleContinueClick}
                  className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-2xl text-sm font-semibold shadow-xs transition-all flex items-center justify-center gap-3 cursor-pointer group"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {/* Continue with Email Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailInput(true);
                    setShowGooglePrompt(false);
                  }}
                  className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-2xl text-sm font-semibold shadow-xs transition-all flex items-center justify-center gap-3 cursor-pointer group"
                >
                  <Mail className="w-5 h-5 text-indigo-600 shrink-0" />
                  <span>Continue with Email</span>
                </button>
              </div>
            )}

            {/* Google prompt input */}
            {showGooglePrompt && (
              <form onSubmit={handleGoogleSubmit} className="space-y-4 pt-1 animate-fadeIn">
                <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold mb-1">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>ลงชื่อเข้าใช้งานด้วย Google Account</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google Email:
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="example@gmail.com"
                      value={googleEmailInput}
                      onChange={(e) => setGoogleEmailInput(e.target.value)}
                      required
                      autoFocus
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowGooglePrompt(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>Continue with Google</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}

            {/* Email form */}
            {showEmailInput && (
              <form onSubmit={handleEmailSubmit} className="space-y-4 pt-1 animate-fadeIn">
                <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold mb-1">
                  <Mail className="w-4 h-4" />
                  <span>ลงชื่อเข้าใช้งานด้วย Email</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address:
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="name@school.ac.th หรือ gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อ - นามสกุล (ไม่บังคับ):
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น อาจารย์สมคิด สุขใจ"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowEmailInput(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>Continue with Email</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Admin Login (No leaked password hint - Keep Secret!) */}
        {activeTab === 'admin' && (
          <form onSubmit={handleAdminSubmit} className="p-6 space-y-4 bg-white">
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-50 text-purple-700 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-purple-100">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="font-heading font-semibold text-slate-900 text-base">
                เข้าสู่ระบบผู้ดูแลระบบ (Admin)
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                สำหรับผู้ดูแลระบบเพื่อจัดการสิทธิ์ อนุมัติสมาชิก และตั้งค่าระบบ
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รหัสประจำตัวผู้ดูแลระบบ (Admin ID):
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  placeholder="กรอกรหัสประจำตัว Admin"
                  required
                  autoFocus
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รหัสผ่าน (Password):
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-purple-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>เข้าสู่ระบบ Admin</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
