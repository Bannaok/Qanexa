import React, { useState } from 'react';
import { useAuth } from '../services/authContext';
import { useToast } from '../services/toastContext';
import { Lock, User, FileCheck, LogIn, Eye, EyeOff } from 'lucide-react';
import { ImageFallback } from './ImageFallback';
import { AppSettings } from '../types';

interface CenteredLoginFormProps {
  appSettings: AppSettings;
}

export const CenteredLoginForm: React.FC<CenteredLoginFormProps> = ({ appSettings }) => {
  const { login } = useAuth();
  const { error } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      error('กรุณาระบุรหัสผู้ใช้ (ID) และรหัสผ่าน');
      return;
    }

    setLoading(true);
    const res = await login(username.trim(), password.trim());
    setLoading(false);

    if (!res.success && res.message) {
      error(res.message);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-8 px-4 bg-white">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-xs mb-3 overflow-hidden">
            {appSettings.appLogoUrl ? (
              <ImageFallback
                src={appSettings.appLogoUrl}
                alt={appSettings.appName}
                className="w-full h-full object-contain bg-white p-1"
                aspectRatio="aspect-square"
              />
            ) : (
              <FileCheck className="w-8 h-8 text-white" />
            )}
          </div>
          <h1 className="font-heading font-bold text-2xl text-slate-900 tracking-tight">
            {appSettings.appName}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            {appSettings.organizationName || 'ระบบสร้างและสแกนกระดาษคำตอบปรนัย (OMR Scanner)'}
          </p>
        </div>

        {/* Single Unified Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center mb-2">
            <h2 className="font-heading font-semibold text-slate-800 text-base">
              เข้าสู่ระบบ (Sign In)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              กรอกรหัสผู้ใช้ (ID) และรหัสผ่านเพื่อเข้าใช้งานระบบ
            </p>
          </div>

          {/* Username / ID input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              รหัสผู้ใช้ / ID (Username):
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="เช่น admin หรือ ID ที่ผู้ดูแลระบบสร้างให้"
                required
                autoFocus
                className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Password input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              รหัสผ่าน (Password):
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
