import React, { useState } from 'react';
import { AppSettings } from '../types';
import { useAuth } from '../services/authContext';
import { useToast } from '../services/toastContext';
import { storageService } from '../services/storageService';
import {
  Home,
  FileText,
  Settings,
  LogOut,
  User,
  ShieldCheck,
  CheckCircle2,
  Clock,
  HardDrive,
  Menu,
  X,
  FileCheck,
  Users,
  RefreshCw,
} from 'lucide-react';
import { ImageFallback } from './ImageFallback';

interface NavbarProps {
  currentTab: 'home' | 'exams';
  onSelectTab: (tab: 'home' | 'exams') => void;
  appSettings: AppSettings;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenMembers?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  appSettings,
  onOpenSettings,
  onOpenProfile,
  onOpenMembers,
}) => {
  const { currentUser, isAuthenticated, isAdmin, isPending, logout, syncCloudData } = useAuth();
  const { success, info } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncCloudData();
      success('ซิงค์ข้อมูลเรียบร้อย', 'ข้อมูลบนเบราว์เซอร์นี้ตรงกับคลาวด์ล่าสุดแล้ว');
    } catch {
      info('เชื่อมต่อคลาวด์', 'ใช้งานข้อมูลในเครื่องอัตโนมัติ');
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  const storageDisplay = currentUser
    ? storageService.formatBytes(currentUser.storageBytes || 0)
    : '0 KB';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-2xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Side: Brand Logo & Name */}
          <div className="flex items-center gap-3">
            {/* Brand Logo & Name */}
            <div
              onClick={() => {
                if (isAuthenticated) onSelectTab('home');
              }}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 p-0.5 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                {appSettings.appLogoUrl ? (
                  <ImageFallback
                    src={appSettings.appLogoUrl}
                    alt={appSettings.appName}
                    className="w-full h-full object-contain bg-white rounded-lg p-0.5"
                    aspectRatio="aspect-square"
                  />
                ) : (
                  <FileCheck className="w-5 h-5 text-white" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-bold text-base text-slate-900 tracking-tight">
                    {appSettings.appName}
                  </span>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    OMR Pro
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links for Authenticated Users (เอาออกปุ่มชุดข้อสอบที่อยู่ข้างบนตรงกลางตามคำขอ) */}
          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl">
              <button
                onClick={() => onSelectTab('home')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  currentTab === 'home'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Home className="w-4 h-4" />
                หน้าหลัก
              </button>
            </nav>
          )}

          {/* User Auth & Actions on Right */}
          <div className="flex items-center gap-2">
            {isAuthenticated && currentUser ? (
              <div className="flex items-center gap-2">
                {/* Storage index indicator */}
                <div
                  className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 shadow-2xs"
                  title="ปริมาณพื้นที่จัดเก็บข้อมูลที่ใช้งาน"
                >
                  <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{storageDisplay}</span>
                </div>

                {/* Cloud Sync Button */}
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-200 rounded-xl transition-all cursor-pointer text-xs font-medium shadow-2xs"
                  title="ซิงค์ข้อมูลกับคลาวด์ D1 (ทุกอุปกรณ์ตรงกัน)"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
                  <span className="hidden sm:inline">{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูล'}</span>
                </button>

                {/* Settings button */}
                <button
                  onClick={onOpenSettings}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                  title="การตั้งค่าระบบ (Settings & Members)"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Profile menu dropdown toggle */}
                <div className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                  >
                    <img
                      src={
                        currentUser.avatarUrl ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                          currentUser.displayName || currentUser.email
                        )}`
                      }
                      alt={currentUser.displayName}
                      className="w-8 h-8 rounded-full bg-slate-200 object-cover border border-slate-300"
                    />
                    <div className="text-left hidden sm:block">
                      <div className="text-xs font-semibold text-slate-800 leading-tight">
                        {currentUser.displayName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isAdmin ? 'Admin' : isPending ? 'รออนุมัติ' : 'สมาชิก'}
                      </div>
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-fadeIn">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <div className="font-semibold text-xs text-slate-800 truncate">
                          {currentUser.displayName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {currentUser.email}
                        </div>
                        <div className="mt-1.5">
                          {isAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                              <ShieldCheck className="w-3 h-3" /> ผู้ดูแลระบบ
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                              <Clock className="w-3 h-3" /> รออนุมัติ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-3 h-3" /> อนุมัติแล้ว
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onOpenProfile();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        <span>ข้อมูลส่วนตัว (User Settings)</span>
                      </button>

                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onOpenSettings();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        <span>การตั้งค่าระบบ (Settings)</span>
                      </button>

                      {isAdmin && onOpenMembers && (
                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            onOpenMembers();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-purple-700 hover:bg-purple-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Users className="w-4 h-4 text-purple-600" />
                          <span>จัดการสมาชิก (Members)</span>
                        </button>
                      )}

                      <div className="border-t border-slate-100 my-1" />

                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>ออกจากระบบ</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Mobile menu toggle for authenticated users */}
            {isAuthenticated && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-600 hover:text-slate-900 md:hidden rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && isAuthenticated && (
          <div className="md:hidden py-3 border-t border-slate-100 space-y-1 animate-fadeIn bg-white">
            <button
              onClick={() => {
                onSelectTab('home');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold ${
                currentTab === 'home'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Home className="w-4 h-4" />
              หน้าหลัก
            </button>

            <button
              onClick={() => {
                onOpenSettings();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Settings className="w-4 h-4" />
              การตั้งค่าระบบ & สมาชิก
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
