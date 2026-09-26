import React, { useState } from 'react';
import { Exam } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { FileText, QrCode, ArrowRight, Smartphone, Download, Share2, PlusSquare, X } from 'lucide-react';

interface MinimalHomeViewProps {
  exams: Exam[];
  onNavigateToExams: () => void;
  onOpenQuickScan: () => void;
}

export const MinimalHomeView: React.FC<MinimalHomeViewProps> = ({
  exams,
  onNavigateToExams,
  onOpenQuickScan,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInstallable) {
      await install();
    } else {
      setShowInstallGuide(true);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8 sm:py-10 px-3 sm:px-4 space-y-6 bg-white animate-fadeIn">
      {/* Title */}
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
          หน้าหลัก
        </h1>
      </div>

      {/* 2 Main Minimal Items Listed Vertically */}
      <div className="space-y-4">
        {/* Item 1: ชุดข้อสอบ (Exams) */}
        <div
          onClick={onNavigateToExams}
          className="group p-4 sm:p-6 bg-white border border-slate-200 hover:border-indigo-400 rounded-3xl transition-all shadow-xs hover:shadow-md cursor-pointer flex items-center justify-between gap-3 sm:gap-4"
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                <span className="font-mono text-xs font-bold text-slate-400 shrink-0">01.</span>
                <h2 className="font-heading font-bold text-base sm:text-lg text-slate-900 group-hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0">
                  ชุดข้อสอบ
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-slate-100 text-slate-700 whitespace-nowrap shrink-0">
                  {exams.length} รายการ
                </span>
              </div>
            </div>
          </div>

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-slate-200 group-hover:border-indigo-600 group-hover:bg-indigo-50 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0">
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Item 2: สแกนคิวอาร์โค้ด / สแกนตรวจข้อสอบ (QR & OMR Scanner) */}
        <div
          onClick={onOpenQuickScan}
          className="group p-4 sm:p-6 bg-white border border-slate-200 hover:border-emerald-400 rounded-3xl transition-all shadow-xs hover:shadow-md cursor-pointer flex items-center justify-between gap-3 sm:gap-4"
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
              <QrCode className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                <span className="font-mono text-xs font-bold text-slate-400 shrink-0">02.</span>
                <h2 className="font-heading font-bold text-base sm:text-lg text-slate-900 group-hover:text-emerald-600 transition-colors whitespace-nowrap shrink-0">
                  สแกนคิวอาร์โค้ด
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-100 text-emerald-800 whitespace-nowrap shrink-0">
                  OMR Scanner
                </span>
              </div>
            </div>
          </div>

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-slate-200 group-hover:border-emerald-600 group-hover:bg-emerald-50 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0">
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Optional Item 3: ติดตั้งแอปบนมือถือ (PWA Install Card) */}
        {!isInstalled && (
          <div
            onClick={handleInstallClick}
            className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50/60 to-purple-50/60 border border-indigo-100 hover:border-indigo-300 rounded-3xl transition-all shadow-2xs hover:shadow-xs cursor-pointer flex items-center justify-between gap-3 sm:gap-4"
          >
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading font-bold text-sm sm:text-base text-slate-900">
                    ดาวน์โหลดติดตั้งลงมือถือ
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                    PWA App
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  ติดตั้งไว้ที่หน้าจอหลัก เปิดใช้งานได้เต็มจอและเร็วขึ้น
                </p>
              </div>
            </div>

            <button
              type="button"
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ติดตั้ง</span>
            </button>
          </div>
        )}
      </div>

      {/* Guide Modal for Manual Installation (iOS / Android) */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-slate-800 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-slate-900">
                    {isIOS ? 'วิธีติดตั้งบน iPhone / iPad' : 'วิธีติดตั้งลงหน้าจอมือถือ'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    เปิดใช้งานเต็มจอโดยไม่ต้องผ่านสโตร์
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallGuide(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </span>
                <div>
                  เปิดหน้านี้ในเบราว์เซอร์มือถือ (Safari หรือ Chrome) แล้วกดปุ่ม <strong>แชร์ (Share)</strong> <Share2 className="w-3.5 h-3.5 inline text-indigo-600 mx-0.5" /> หรือจุด 3 จุด
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </span>
                <div>
                  เลือกเมนู <strong>"เพิ่มไปยังหน้าจอโฮม"</strong> หรือ <strong>"Add to Home Screen / ติดตั้งแอป"</strong> <PlusSquare className="w-3.5 h-3.5 inline text-indigo-600 mx-0.5" />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </span>
                <div>
                  กด <strong>"เพิ่ม" (Add)</strong> ไอคอน ExamScan จะไปปรากฏบนหน้าจอมือถือพร้อมเปิดใช้งานแบบเต็มหน้าจอทันที!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowInstallGuide(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              รับทราบ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
