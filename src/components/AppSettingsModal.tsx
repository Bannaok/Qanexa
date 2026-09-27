import React, { useState } from 'react';
import { AppSettings } from '../types';
import { storageService } from '../services/storageService';
import { useAuth } from '../services/authContext';
import { useToast } from '../services/toastContext';
import { X, Settings, Upload, Image, Clock, Check, Building, Users, ShieldCheck, Cloud, Smartphone } from 'lucide-react';
import { ImageFallback } from './ImageFallback';
import { MemberManagement } from './MemberManagement';
import { CloudflareD1Tab } from './CloudflareD1Tab';
import { PWABackendSettings } from './PWABackendSettings';

interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved: (updated: AppSettings) => void;
  initialTab?: 'general' | 'members' | 'pwa' | 'cloudflare';
}

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
  initialTab = 'general',
}) => {
  const { currentUser, isAdmin } = useAuth();
  const { success, error, warning } = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'pwa' | 'cloudflare'>(initialTab);
  const [settings, setSettings] = useState<AppSettings>(() => storageService.getSettings());
  const [appName, setAppName] = useState(settings.appName);
  const [appLogoUrl, setAppLogoUrl] = useState(settings.appLogoUrl);
  const [orgName, setOrgName] = useState(settings.organizationName);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      error('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WebP, SVG)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      warning('ขนาดไฟล์เกิน 2MB', 'แนะนำให้ใช้ภาพขนาดไม่เกิน 2MB เพื่อความเร็วในการโหลด');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setAppLogoUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!appName.trim()) {
      error('ชื่อแอปพลิเคชันจำเป็นต้องระบุ (ห้ามเว้นว่าง)');
      return;
    }

    setIsSaving(true);
    const updatedSettings: AppSettings = {
      appName: appName.trim(),
      appLogoUrl: appLogoUrl.trim(),
      organizationName: orgName.trim() || 'ศูนย์ทดสอบวัดผลทางการศึกษา',
      lastUpdated: new Date().toISOString(),
      updatedBy: currentUser?.displayName || 'Admin',
    };

    storageService.saveSettings(updatedSettings);
    setSettings(updatedSettings);
    onSettingsSaved(updatedSettings);
    setIsSaving(false);
    success('บันทึกการตั้งค่าระบบเรียบร้อย', 'ข้อมูลชื่อและโลโก้แอปพลิเคชันได้รับการอัปเดตแล้ว');
    onClose();
  };

  const handleResetDefaultLogo = () => {
    setAppLogoUrl('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print animate-fadeIn overflow-y-auto">
      <div className={`bg-white rounded-3xl ${activeTab !== 'general' ? 'max-w-4xl' : 'max-w-xl'} w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-slate-800">
                การตั้งค่าระบบ (Settings)
              </h3>
              <p className="text-xs text-slate-500">
                {isAdmin ? 'ตั้งค่าชื่อแอปพลิเคชัน โลโก้ สมาชิก และการเชื่อมต่อ Cloudflare D1' : 'ตั้งค่าข้อมูลทั่วไปของแอปพลิเคชัน'}
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

        {/* Tab Selector if Admin */}
        {isAdmin && (
          <div className="px-6 pt-4 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'general'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>การตั้งค่าแอปพลิเคชัน (App Settings)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'members'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-4 h-4 text-purple-600" />
                <span>จัดการสมาชิก (Members)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pwa')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'pwa'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>แอปมือถือ (PWA Mobile)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('cloudflare')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'cloudflare'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Cloud className="w-4 h-4 text-amber-500" />
                <span>Cloudflare D1 & Deploy</span>
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {activeTab === 'general' ? (
            <form onSubmit={handleSave} className="space-y-5">
              {/* App Name (บังคับระบุ) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  ชื่อแอปพลิเคชัน <span className="text-rose-500">* (บังคับระบุ)</span>
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="เช่น ExamScan OMR Pro หรือ ระบบตรวจข้อสอบโรงเรียน"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <p className="text-xs text-slate-400 mt-1">ชื่อนี้จะปรากฏที่แถบเมนูหลักและหัวกระดาษข้อสอบ</p>
              </div>

              {/* Organization Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-slate-400" />
                  ชื่อสถานศึกษา / องค์กร
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="เช่น โรงเรียนมัธยมวิทยา หรือ คณะวิทยาศาสตร์"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* App Logo */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Image className="w-4 h-4 text-slate-400" />
                  โลโก้แอปพลิเคชัน (App Logo)
                </label>

                <div className="flex items-center gap-4 p-3.5 bg-white border border-slate-200 rounded-2xl">
                  <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    {appLogoUrl ? (
                      <ImageFallback
                        src={appLogoUrl}
                        alt="App Logo"
                        className="w-full h-full object-contain p-1"
                        fallbackText="โลโก้ชำรุด"
                        aspectRatio="aspect-square"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xl">
                        {appName ? appName.charAt(0) : 'E'}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 text-slate-700 rounded-xl text-xs font-medium cursor-pointer shadow-xs transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      อัปโหลดโลโก้ใหม่
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>

                    {appLogoUrl && (
                      <button
                        type="button"
                        onClick={handleResetDefaultLogo}
                        className="ml-2 text-xs text-rose-500 hover:underline cursor-pointer"
                      >
                        ใช้โลโก้เริ่มต้น
                      </button>
                    )}
                    <div className="text-[11px] text-slate-400">
                      รองรับไฟล์ PNG, JPG, WebP, SVG ขนาดไม่เกิน 2MB
                    </div>
                  </div>
                </div>
              </div>

              {/* Timestamp Notice */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">วันที่และเวลาที่แก้ไขล่าสุด (Timestamp):</span>
                  <div className="mt-0.5 text-amber-800 font-mono text-[11px]">
                    {settings.lastUpdated
                      ? new Date(settings.lastUpdated).toLocaleString('th-TH', {
                          dateStyle: 'full',
                          timeStyle: 'medium',
                        })
                      : 'ยังไม่มีประวัติการแก้ไข'}
                  </div>
                  <div className="text-[11px] text-amber-700/80 mt-0.5">
                    แก้ไขโดย: {settings.updatedBy || 'ระบบ'}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
              </div>
            </form>
          ) : activeTab === 'members' ? (
            <div className="space-y-4">
              <MemberManagement />
            </div>
          ) : activeTab === 'pwa' ? (
            <PWABackendSettings />
          ) : (
            <CloudflareD1Tab />
          )}
        </div>
      </div>
    </div>
  );
};
