import React, { useState } from 'react';
import { ScanResult } from '../types';
import { useAuth } from '../services/authContext';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sliders,
  Calendar,
  User,
  Hash,
} from 'lucide-react';
import { ImageFallback } from './ImageFallback';

interface LightboxModalProps {
  result: ScanResult | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onRescan?: (result: ScanResult) => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  result,
  onClose,
  onDelete,
  onRescan,
}) => {
  const { isAdmin } = useAuth();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showAnnotated, setShowAnnotated] = useState(true);

  if (!result) return null;

  const currentImageUrl = showAnnotated && result.annotatedImageUrl
    ? result.annotatedImageUrl
    : result.scannedImageUrl;

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = currentImageUrl;
    a.download = `Scan_${result.studentId || 'Exam'}_${result.examTitle}.jpg`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6 no-print">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${result.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {result.passed ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-semibold text-lg text-white">
                  {result.studentName || 'ไม่ระบุชื่อนักเรียน'} ({result.studentId || 'ไม่มีรหัส'})
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  result.passed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {result.score} / {result.totalQuestions} คะแนน ({result.scorePercentage}%)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                วิชา: {result.examTitle} • สแกนเมื่อ: {new Date(result.scannedAt).toLocaleString('th-TH')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            {result.annotatedImageUrl && (
              <button
                onClick={() => setShowAnnotated(!showAnnotated)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  showAnnotated
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title="สลับมุมมองระหว่างผลตรวจกับภาพต้นฉบับ"
              >
                <Eye className="w-4 h-4" />
                {showAnnotated ? 'ดูผลการตรวจ (OMR Overlay)' : 'ดูภาพถ่ายต้นฉบับ'}
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport / Image Area */}
        <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center p-4 min-h-[360px]">
          <div
            className="transition-transform duration-200 ease-out flex items-center justify-center select-none"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          >
            <ImageFallback
              src={currentImageUrl}
              alt={`กระดาษคำตอบของ ${result.studentName}`}
              className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-800"
            />
          </div>

          {/* Floating Controls Bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/80 shadow-lg text-xs">
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full transition-colors cursor-pointer"
              title="ขยายภาพ"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-slate-400 px-1 font-mono text-[11px]">{Math.round(zoom * 100)}%</span>
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full transition-colors cursor-pointer"
              title="ย่อภาพ"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <button
              onClick={handleRotate}
              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full transition-colors cursor-pointer"
              title="หมุน 90 องศา"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded-md transition-colors cursor-pointer text-[11px]"
            >
              รีเซ็ต
            </button>
          </div>
        </div>

        {/* Footer with Question Answer Grid and Admin Actions */}
        <div className="bg-slate-900 px-6 py-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span>ถูกต้อง ({result.correctCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span>ตอบผิด ({result.totalQuestions - result.correctCount})</span>
            </div>
            <div className="text-slate-400">
              ขนาดไฟล์: {(result.imageSizeBytes / 1024).toFixed(1)} KB
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              ดาวน์โหลดรูปภาพ
            </button>

            {/* Admin Management Actions */}
            {isAdmin && onDelete && (
              <button
                onClick={() => {
                  if (confirm(`ยืนยันการลบผลการสแกนของ ${result.studentName || 'นักเรียนท่านนี้'}?`)) {
                    onDelete(result.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                ลบข้อมูลผลสอบ (Admin)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
