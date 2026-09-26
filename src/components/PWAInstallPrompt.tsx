import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Share2, PlusSquare, Check } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // If already installed or dismissed by user for this session, hide
  if (isInstalled || dismissed) {
    return null;
  }

  // Handle Android / Chromium native install prompt
  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // General guide modal
      setShowIOSModal(true);
    }
  };

  return (
    <>
      {/* Floating or Top-Mounted Mobile Install Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm no-print">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20">
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">
              ติดตั้งแอป ExamScan บนมือถือ
            </p>
            <p className="text-[11px] text-indigo-100 hidden sm:block">
              เปิดใช้งานได้เต็มจอ รวดเร็ว เสมือนแอปแท้ และสแกนได้สะดวกยิ่งขึ้น
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-700 hover:bg-indigo-50 font-bold rounded-xl shadow-xs transition-colors cursor-pointer text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ดาวน์โหลดติดตั้ง</span>
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            aria-label="ปิดการแจ้งเตือน"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Guide Modal for iOS Safari / Manual Installation */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-slate-800 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-slate-900">
                    วิธีติดตั้งลงในหน้าจอมือถือ
                  </h3>
                  <p className="text-xs text-slate-500">
                    ไม่ต้องโหลดผ่าน App Store / Play Store
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
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
                  กดปุ่ม <strong>แชร์ (Share)</strong> <Share2 className="w-3.5 h-3.5 inline text-indigo-600 mx-0.5" /> บริเวณแถบล่างหรือบนของเบราว์เซอร์
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </span>
                <div>
                  เลื่อนหาและเลือกเมนู <strong>"เพิ่มไปยังหน้าจอโฮม"</strong> หรือ <strong>"Add to Home Screen"</strong> <PlusSquare className="w-3.5 h-3.5 inline text-indigo-600 mx-0.5" />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </span>
                <div>
                  กดปุ่ม <strong>"เพิ่ม" (Add)</strong> มุมขวาบน เป็นอันเสร็จสิ้น! ไอคอนแอป ExamScan จะไปปรากฏบนหน้าจอมือถือทันที
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}
    </>
  );
};
