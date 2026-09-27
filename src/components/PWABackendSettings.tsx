import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, Download, QrCode, Share2, PlusSquare, CheckCircle2, Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '../services/toastContext';

export const PWABackendSettings: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { success } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (currentUrl) {
      QRCode.toDataURL(currentUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => {});
    }
  }, [currentUrl]);

  const handleCopyLink = () => {
    if (navigator.clipboard && currentUrl) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      success('คัดลอกลิงก์เรียบร้อย', 'คุณสามารถส่งลิงก์นี้ไปยังมือถือเพื่อติดตั้งแอปได้ทันที');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-slate-800 flex items-center gap-2">
              <span>ติดตั้งแอปบนมือถือ (PWA Mobile App)</span>
              {isInstalled && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> ติดตั้งแล้วในเครื่องนี้
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ระบบติดตั้งแอปพลิเคชันสำหรับโทรศัพท์มือถือ (iOS / Android) เพื่อเปิดใช้งานแบบเต็มหน้าจอและสแกนข้อสอบได้สะดวก
            </p>
          </div>
        </div>

        {isInstallable && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>ติดตั้งแอปลงในเครื่องนี้</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: QR Code to open on Mobile */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-600" />
            <h4 className="font-heading font-semibold text-sm text-slate-800">
              สแกน QR Code ด้วยมือถือเพื่อติดตั้ง
            </h4>
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="App Mobile Link QR Code"
                className="w-40 h-40 object-contain rounded-lg border border-slate-200 shadow-2xs"
              />
            ) : (
              <div className="w-40 h-40 bg-slate-200 animate-pulse rounded-lg" />
            )}
            <p className="text-xs text-slate-500 mt-2 text-center">
              ใช้กล้องมือถือสแกนเพื่อเปิดหน้าเว็บและกดติดตั้ง
            </p>
          </div>

          {/* Copy Link field */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={currentUrl}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 truncate"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}</span>
            </button>
          </div>
        </div>

        {/* Right: Step-by-step instructions */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-600" />
            <h4 className="font-heading font-semibold text-sm text-slate-800">
              วิธีติดตั้งลงหน้าจอมือถือ (Add to Home Screen)
            </h4>
          </div>

          <div className="space-y-3 text-xs text-slate-600">
            {/* iOS */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-800 text-white text-[10px] flex items-center justify-center font-bold"></span>
                <span>สำหรับ iPhone / iPad (Safari):</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li>เปิดลิงก์ในเบราว์เซอร์ <strong>Safari</strong></li>
                <li>
                  กดปุ่ม <strong>แชร์ (Share)</strong> <Share2 className="w-3.5 h-3.5 inline text-indigo-600 mx-0.5" /> ด้านล่างหน้าจอ
                </li>
                <li>
                  เลือกเมนู <strong>"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</strong> <PlusSquare className="w-3.5 h-3.5 inline text-indigo-600 mx-0.5" />
                </li>
                <li>กด <strong>"เพิ่ม" (Add)</strong> มุมขวาบน เป็นอันเสร็จสิ้น</li>
              </ol>
            </div>

            {/* Android */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">A</span>
                <span>สำหรับ Android (Google Chrome):</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                <li>เปิดลิงก์ในเบราว์เซอร์ <strong>Chrome</strong></li>
                <li>กดปุ่มเมนู <strong>จุด 3 จุด (⋮)</strong> มุมขวาบน</li>
                <li>
                  เลือกเมนู <strong>"ติดตั้งแอป" (Install App)</strong> หรือ <strong>"เพิ่มลงในหน้าจอหลัก"</strong>
                </li>
                <li>กดยืนยันการติดตั้ง ไอคอนจะปรากฏบนหน้าจอทันที</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
