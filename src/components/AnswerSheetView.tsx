import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import QRCode from 'qrcode';
import { Exam } from '../types';
import { pdfGenerator, getExamQRPayload } from '../services/pdfGenerator';
import { useToast } from '../services/toastContext';
import {
  Printer,
  Download,
  X,
  FileText,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Scissors,
} from 'lucide-react';

interface AnswerSheetViewProps {
  exam: Exam;
  onClose: () => void;
}

/**
 * Single Answer Sheet Half (A5 size in A4 Landscape: 148.5mm x 210mm)
 * Each half has its own 4 corner fiducial marks, QR code, header, student fields, and bubble grid.
 */
const SingleAnswerSheetHalf: React.FC<{
  exam: Exam;
  qrCodeUrl: string;
  copyIndex: number;
}> = ({ exam, qrCodeUrl, copyIndex }) => {
  const totalQ = exam.questionCount;
  // Columns per half: 1 column for <= 10, 2 columns for <= 20, 3 columns for <= 40, 4 columns for > 40
  const numCols = totalQ <= 10 ? 1 : totalQ <= 20 ? 2 : totalQ <= 40 ? 3 : 4;
  const qPerCol = Math.ceil(totalQ / numCols);

  const choiceLabels =
    exam.choiceLabelType === 'latin'
      ? ['A', 'B', 'C', 'D', 'E'].slice(0, exam.choiceCount)
      : ['ก', 'ข', 'ค', 'ง', 'จ'].slice(0, exam.choiceCount);

  return (
    <div className="w-[148.5mm] h-[210mm] max-h-[210mm] p-[5mm_6mm] relative flex flex-col justify-between box-border overflow-hidden bg-white text-slate-900">
      {/* 4 Corner Alignment Registration Marks (OMR fiducials for skew correction) */}
      <div className="absolute top-[4.5mm] left-[4.5mm] w-[5.5mm] h-[5.5mm] bg-black pointer-events-none" />
      <div className="absolute top-[4.5mm] right-[4.5mm] w-[5.5mm] h-[5.5mm] bg-black pointer-events-none" />
      <div className="absolute bottom-[4.5mm] left-[4.5mm] w-[5.5mm] h-[5.5mm] bg-black pointer-events-none" />
      <div className="absolute bottom-[4.5mm] right-[4.5mm] w-[5.5mm] h-[5.5mm] bg-black pointer-events-none" />

      {/* Sheet Content */}
      <div className="flex-1 flex flex-col justify-between">
        {/* Header Box */}
        <div className="border-2 border-slate-900 rounded-lg p-2.5 bg-white shrink-0">
          <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-800">
            <div className="flex-1 min-w-0">
              {/* Title: Only 'กระดาษคำตอบ' - No (OMR ANSWER SHEET), No 'ศูนย์ทดสอบ...' */}
              <div className="flex items-center gap-1.5">
                <h1 className="font-heading font-black text-base text-slate-900 leading-tight">
                  กระดาษคำตอบ
                </h1>
                <span className="text-[10px] text-slate-500 font-mono">
                  [แผ่นที่ {copyIndex}]
                </span>
              </div>

              {/* Subject Info: No 'หน่วยการเรียนรู้ที่ ...' */}
              <div className="text-[11px] text-slate-800 font-semibold pt-0.5 leading-tight truncate">
                วิชา: <strong className="text-slate-950 font-bold">{exam.title}</strong>
                {exam.gradeLevel ? (
                  <> | ชั้น: <strong className="text-slate-950">{exam.gradeLevel}</strong></>
                ) : null}
                {exam.code ? (
                  <> | รหัส: <strong className="text-slate-950 font-mono">{exam.code}</strong></>
                ) : null}
                {' '}| จำนวน: <strong className="text-slate-950">{exam.questionCount} ข้อ</strong>
              </div>
            </div>

            {/* Exam QR Code */}
            {qrCodeUrl && (
              <div className="flex flex-col items-center justify-center p-0.5 bg-white border border-slate-900 rounded shrink-0 shadow-2xs">
                <img
                  src={qrCodeUrl}
                  alt="Exam QR Code"
                  className="w-11 h-11 object-contain"
                />
                <span className="text-[7px] font-mono font-bold text-slate-700 uppercase tracking-tighter">
                  รหัสข้อสอบ
                </span>
              </div>
            )}
          </div>

          {/* Student Fields: ONLY ชื่อ-สกุล, เลขที่, วันที่สอบ (No รหัสนักศึกษา) */}
          <div className="pt-2 text-xs text-slate-900 space-y-1.5">
            <div className="flex items-baseline gap-2">
              <div className="flex items-baseline flex-1 min-w-0">
                <span className="font-bold text-slate-900 shrink-0 text-[11px]">ชื่อ - สกุล:</span>
                <span className="ml-1.5 flex-1 border-b border-dotted border-slate-600 min-h-[14px]" />
              </div>
              <div className="flex items-baseline w-28 shrink-0">
                <span className="font-bold text-slate-900 shrink-0 text-[11px]">เลขที่:</span>
                <span className="ml-1.5 flex-1 border-b border-dotted border-slate-600 min-h-[14px]" />
              </div>
            </div>

            <div className="flex items-baseline">
              <span className="font-bold text-slate-900 shrink-0 text-[11px]">วันที่สอบ:</span>
              <span className="ml-1.5 flex-1 border-b border-dotted border-slate-600 min-h-[14px]" />
            </div>
          </div>

          {/* Simple Instruction Note */}
          <div className="mt-1.5 pt-1 border-t border-slate-200 text-[10px] text-slate-600 leading-tight">
            📌 <strong>คำแนะนำ:</strong> กากบาท (X) หรือระบายในช่องสี่เหลี่ยม [ ] เพียงตัวเลือกเดียวต่อหนึ่งข้อ
          </div>
        </div>

        {/* Questions Grid Columns */}
        <div
          className={`grid gap-1.5 my-1.5 flex-1 items-start ${
            numCols === 1
              ? 'grid-cols-1'
              : numCols === 2
              ? 'grid-cols-2'
              : numCols === 3
              ? 'grid-cols-3'
              : 'grid-cols-4'
          }`}
        >
          {Array.from({ length: numCols }, (_, colIdx) => {
            const startQ = colIdx * qPerCol + 1;
            const endQ = Math.min((colIdx + 1) * qPerCol, totalQ);
            if (startQ > totalQ) return null;

            return (
              <div
                key={colIdx}
                className="border border-slate-900 rounded-md overflow-hidden bg-white shadow-2xs"
              >
                {/* Column Header */}
                <div className="bg-slate-100 border-b border-slate-900 py-0.5 px-1.5 flex items-center justify-between text-[11px] font-black text-slate-900">
                  <span className="w-6 text-center font-bold text-[10px]">ข้อ</span>
                  <div className="flex-1 flex justify-center items-center gap-1.5 px-0.5 font-bold">
                    {choiceLabels.map((lbl) => (
                      <span key={lbl} className="w-[18px] text-center font-bold text-[10px]">
                        {lbl}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Question Rows */}
                <div className="divide-y divide-slate-200">
                  {Array.from({ length: endQ - startQ + 1 }, (_, rowIdx) => {
                    const qNum = startQ + rowIdx;
                    return (
                      <div
                        key={qNum}
                        className="py-0.5 px-1 flex items-center justify-between text-[11px]"
                      >
                        <span className="w-6 font-mono font-bold text-slate-900 text-xs text-right pr-1">
                          {qNum}.
                        </span>
                        <div className="flex-1 flex justify-center items-center gap-1.5 px-0.5">
                          {choiceLabels.map((lbl) => (
                            <div
                              key={lbl}
                              className="w-[18px] h-[18px] rounded-xs border border-slate-900 flex items-center justify-center text-[10px] font-mono font-bold text-slate-900 bg-white"
                            >
                              {lbl}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Half Footer */}
        <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-300 pt-1">
          <span className="truncate">วิชา: {exam.title} {exam.gradeLevel ? `(${exam.gradeLevel})` : ''}</span>
          <span className="font-semibold shrink-0">กระดาษคำตอบ (ครึ่งแผ่น A4)</span>
        </div>
      </div>
    </div>
  );
};

export const AnswerSheetView: React.FC<AnswerSheetViewProps> = ({
  exam,
  onClose,
}) => {
  const { success, error } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Zoom and fit state
  const [viewMode, setViewMode] = useState<'fit' | '100%'>('fit');
  const [manualZoom, setManualZoom] = useState<number | null>(null);
  const [fitScale, setFitScale] = useState<number>(0.85);

  // Generate distinct QR code
  useEffect(() => {
    QRCode.toDataURL(getExamQRPayload(exam), {
      margin: 1,
      width: 200,
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [exam]);

  // Calculate perfect fit scale for A4 Landscape (1123px width x 794px height at 96 DPI)
  useLayoutEffect(() => {
    const calculateFitScale = () => {
      if (!scrollContainerRef.current) return;
      const containerWidth = scrollContainerRef.current.clientWidth - 32;
      const containerHeight = scrollContainerRef.current.clientHeight - 32;

      // A4 Landscape: 1123px width x 794px height
      const a4Width = 1123;
      const a4Height = 794;

      const scaleX = containerWidth / a4Width;
      const scaleY = containerHeight / a4Height;
      const calculated = Math.min(scaleX, scaleY, 1.0);
      setFitScale(Math.max(0.4, Math.round(calculated * 100) / 100));
    };

    calculateFitScale();
    window.addEventListener('resize', calculateFitScale);
    return () => window.removeEventListener('resize', calculateFitScale);
  }, []);

  const currentScale = manualZoom !== null ? manualZoom : viewMode === 'fit' ? fitScale : 1.0;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    try {
      setIsGeneratingPdf(true);
      await pdfGenerator.downloadPDFFromElement(printRef.current, exam);
      success('ดาวน์โหลด PDF สำเร็จ', 'ไฟล์กระดาษคำตอบ A4 แนวนอน (2 ชุด/แผ่น) พร้อมพิมพ์เรียบร้อย');
    } catch (err) {
      console.warn('DOM PDF failed, falling back to direct generator', err);
      try {
        await pdfGenerator.downloadPDF(exam, undefined, qrCodeUrl);
        success('ดาวน์โหลด PDF สำเร็จ', 'ไฟล์กระดาษคำตอบ A4 แนวนอน (2 ชุด/แผ่น) พร้อมพิมพ์เรียบร้อย');
      } catch (fallbackErr: any) {
        console.error('PDF generation error', fallbackErr);
        error('ดาวน์โหลด PDF ไม่สำเร็จ', 'กรุณาลองกดปุ่ม "พิมพ์กระดาษคำตอบ" แล้วเลือก Save as PDF แทน');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-sm print-modal-overlay">
      {/* Top Floating Control Bar */}
      <header className="h-14 sm:h-16 bg-slate-900 border-b border-slate-700/80 px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0 z-30 shadow-md no-print text-white">
        {/* Left: Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0 hidden sm:flex">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-bold text-sm sm:text-base text-white truncate max-w-[180px] sm:max-w-xs md:max-w-sm">
                กระดาษคำตอบ: {exam.title}
              </h2>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                A4 แนวนอน (29.7 × 21 ซม.) • 2 ชุด/แผ่น
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {exam.gradeLevel ? `${exam.gradeLevel} • ` : ''}
              {exam.questionCount} ข้อ ({exam.choiceCount} ตัวเลือก) • ประหยัดกระดาษ ตัดตรงกลางได้ 2 แผ่น
            </p>
          </div>
        </div>

        {/* Center: View Mode Controls */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => {
              setViewMode('fit');
              setManualZoom(null);
            }}
            className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'fit' && manualZoom === null
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>พอดีหน้าจอ</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode('100%');
              setManualZoom(1.0);
            }}
            className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              manualZoom === 1.0
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            100%
          </button>

          <div className="h-4 w-[1px] bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={() => setManualZoom(Math.max(0.3, (currentScale - 0.1)))}
            className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
            title="ซูมออก"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] font-mono text-slate-300 px-1 min-w-[42px] text-center">
            {Math.round(currentScale * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setManualZoom(Math.min(2.0, (currentScale + 0.1)))}
            className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
            title="ซูมเข้า"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {manualZoom !== null && (
            <button
              type="button"
              onClick={() => setManualZoom(null)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 cursor-pointer ml-0.5"
              title="รีเซ็ตขนาด"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-medium shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
            title="สั่งพิมพ์ A4 แนวนอน (1 แผ่นได้ 2 ชุดข้อสอบ)"
          >
            <Printer className="w-4 h-4" />
            <span className="font-medium">พิมพ์กระดาษคำตอบ</span>
          </button>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-medium shadow-md shadow-indigo-900/30 transition-all cursor-pointer"
            title="ดาวน์โหลดไฟล์ PDF ขนาด A4 แนวนอน"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{isGeneratingPdf ? 'กำลังสร้าง...' : 'ดาวน์โหลด PDF'}</span>
            <span className="sm:hidden">PDF</span>
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Preview Container */}
      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-2 sm:p-6 flex justify-center items-start bg-slate-900/90 print-scroll-container"
      >
        {/* Transform wrapper for smooth zooming / fitting */}
        <div
          style={{
            transform: `scale(${currentScale})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
            marginBottom: currentScale < 1 ? `-${Math.round((1 - currentScale) * 794)}px` : '24px',
            marginRight: currentScale < 1 ? `-${Math.round((1 - currentScale) * 1123 / 2)}px` : '0',
            marginLeft: currentScale < 1 ? `-${Math.round((1 - currentScale) * 1123 / 2)}px` : '0',
          }}
          className="shrink-0"
        >
          {/* Authentic Standard A4 Landscape Answer Sheet (297mm × 210mm) - 2 copies side-by-side */}
          <article
            id="printable-answer-sheet"
            ref={printRef}
            className="w-[297mm] min-h-[210mm] h-[210mm] max-h-[210mm] bg-white shadow-2xl rounded-sm border border-slate-300 relative text-slate-900 select-none box-border flex overflow-hidden"
          >
            {/* Center Dashed Cutting Line (ตัดตรงกลางกระดาษ) */}
            <div className="absolute top-0 bottom-0 left-[148.5mm] -translate-x-1/2 flex flex-col items-center justify-between pointer-events-none py-1.5 z-20">
              <div className="bg-white/95 px-2 py-0.5 text-[9px] font-bold text-slate-600 flex items-center gap-1 border border-slate-400 rounded-full shadow-2xs">
                <Scissors className="w-3 h-3 text-slate-700" />
                <span>ตัดตามรอยประ</span>
              </div>
              <div className="w-[1px] h-full border-r-2 border-dashed border-slate-400 my-1.5" />
              <div className="bg-white/95 px-2 py-0.5 text-[9px] font-bold text-slate-600 flex items-center gap-1 border border-slate-400 rounded-full shadow-2xs">
                <Scissors className="w-3 h-3 text-slate-700" />
                <span>ตัดแบ่งครึ่งแผ่น</span>
              </div>
            </div>

            {/* Left Copy (ชุดที่ 1) */}
            <SingleAnswerSheetHalf
              exam={exam}
              qrCodeUrl={qrCodeUrl}
              copyIndex={1}
            />

            {/* Right Copy (ชุดที่ 2) */}
            <SingleAnswerSheetHalf
              exam={exam}
              qrCodeUrl={qrCodeUrl}
              copyIndex={2}
            />
          </article>
        </div>
      </main>
    </div>
  );
};
