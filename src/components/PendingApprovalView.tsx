import React from 'react';
import { useAuth } from '../services/authContext';
import { Clock, ShieldAlert, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';

interface PendingApprovalViewProps {
  onOpenLogin: () => void;
}

export const PendingApprovalView: React.FC<PendingApprovalViewProps> = ({ onOpenLogin }) => {
  const { currentUser, logout, refreshCurrentUser } = useAuth();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 border border-amber-200/80 shadow-xl text-center space-y-6">
        <div className="w-20 h-20 bg-amber-50 border-2 border-amber-200 rounded-full flex items-center justify-center mx-auto text-amber-500 animate-pulse">
          <Clock className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            สถานะ: รอการอนุมัติสิทธิ์ (Pending Approval)
          </span>
          <h2 className="text-2xl font-heading font-bold text-slate-800">
            บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
            คุณได้เข้าสู่ระบบด้วยรหัสผู้ใช้ <strong className="text-slate-700 font-mono">{currentUser?.username || currentUser?.id}</strong> เรียบร้อยแล้ว แต่ต้องรอให้ Admin ทำการอนุมัติสิทธิ์ในระบบก่อนจึงจะเริ่มสร้างข้อสอบหรือสแกนกระดาษคำตอบได้
          </p>
        </div>

        {/* Tip for Admin Testing */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 text-left text-xs text-slate-600 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <ShieldAlert className="w-4 h-4 text-purple-600" />
            <span>คำแนะนำ:</span>
          </div>
          <p>
            กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อเข้าไปที่เมนู <strong>"จัดการสมาชิก"</strong> และกดอนุมัติสิทธิ์การเข้าใช้งาน
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={refreshCurrentUser}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-100 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>ตรวจสอบสถานะอีกครั้ง</span>
          </button>

          <button
            onClick={() => {
              logout();
              onOpenLogin();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>สลับบัญชีอื่น / เข้าสู่ระบบ Admin</span>
          </button>
        </div>
      </div>
    </div>
  );
};
