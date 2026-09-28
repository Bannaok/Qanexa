import React, { useState } from 'react';
import { AppSettings } from '../types';
import { storageService } from '../services/storageService';
import { useAuth } from '../services/authContext';
import { useToast } from '../services/toastContext';
import { X, Settings, Upload, Image, Check, Building, Users } from 'lucide-react';
import { ImageFallback } from './ImageFallback';
import { MemberManagement } from './MemberManagement';

interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved: (updated: AppSettings) => void;
  initialTab?: 'general' | 'members';
}

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
  initialTab = 'general',
}) => {
  const { currentUser, isAdmin } = useAuth();
  const { success, error, warning } = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'members'>(
    initialTab === 'members' ? 'members' : 'general'
  );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 no-print animate-fadeIn overflow-y-auto">
      <div className={`bg-white rounded-3xl ${activeTab === 'members' ? 'max-w-5xl lg:max-w-6xl' : 'max-w-xl'} w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[94vh] flex flex-col transition-all duration-200`}>
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
                {isAdmin ? 'ตั้งค่าชื่อแอปพลิเคชัน โลโก้ และจัดการสมาชิก' : 'ตั้งค่าข้อมูลทั่วไปของแอปพลิเคชัน'}
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
          <div className="px-6 pt-3 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
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
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'members'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-4 h-4 text-purple-600" />
                <span>จัดการสมาชิก (Members)</span>
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className={`overflow-y-auto flex-1 ${activeTab === 'members' ? 'p-3 sm:p-5' : 'p-6'}`}>
          {activeTab === 'general' ? (
            <form onSubmit={handleSave} className="space-y-5">
              {/* App Name */}
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
                  placeholder="เช่น โรงเรียนสาธิต หรือ กลุ่มสาระการเรียนรู้"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Logo Upload & Preview */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Image className="w-4 h-4 text-slate-400" />
                  โลโก้แอปพลิเคชัน (App Logo)
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-slate-200 rounded-2xl bg-slate-50/50">
                  {/* Current Logo Preview */}
                  <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden shrink-0 p-1">
                    {appLogoUrl ? (
                      <ImageFallback
                        src={appLogoUrl}
                        alt="Preview Logo"
                        className="w-full h-full object-contain"
                        aspectRatio="aspect-square"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 text-center p-1">
                        <Image className="w-6 h-6 mb-1 text-slate-300" />
                        <span className="text-[10px] leading-tight">ค่าเริ่มต้น</span>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 text-center sm:text-left space-y-2">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer">
                        <Upload className="w-4 h-4 text-indigo-600" />
                        <span>อัปโหลดภาพโลโก้</span>
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
                          className="px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                          ใช้โลโก้เริ่มต้น
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      รองรับไฟล์ภาพ JPG, PNG, WebP หรือ SVG แนะนำภาพสี่เหลี่ยมจัตุรัส ไม่เกิน 2MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
          ) : (
            <div className="space-y-4">
              <MemberManagement />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
