import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import QRCode from 'qrcode';
import { Exam } from '../types';
import { pdfGenerator, getExamQRPayload } from '../services/pdfGenerator';
import { storageService } from '../services/storageService';
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
} from 'lucide-react';

interface AnswerSheetViewProps {
  exam: Exam;
  onClose: () => void;
}

export const AnswerSheetView: React.FC<AnswerSheetViewProps> = ({
  exam,
  onClose,
}) => {
  const settings = storageService.getSettings();
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
      width: 256,
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [exam]);

  // Calculate perfect fit scale so the entire A4 sheet is visible without clipping
  useLayoutEffect(() => {
    const calculateFitScale = () => {
      if (!scrollContainerRef.current) return;
      const containerWidth = scrollContainerRef.current.clientWidth - 32;
      const containerHeight = scrollContainerRef.current.clientHeight - 32;

      // A4 at ~96 DPI: ~794px width x ~1123px height
      const a4Width = 794;
      const a4Height = 1123;

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
      success('ดาวน์โหลด PDF สำเร็จ', 'ไฟล์กระดาษคำตอบ A4 พร้อมพิมพ์เรียบร้อย');
    } catch (err) {
      console.warn('DOM PDF failed, falling back to direct generator', err);
      try {
        await pdfGenerator.downloadPDF(exam, settings.organizationName, qrCodeUrl);
        success('ดาวน์โหลด PDF สำเร็จ', 'ไฟล์กระดาษคำตอบ A4 พร้อมพิมพ์เรียบร้อย');
      } catch (fallbackErr: any) {
        console.error('PDF generation error', fallbackErr);
        error('ดาวน์โหลด PDF ไม่สำเร็จ', 'กรุณาลองกดปุ่ม "พิมพ์กระดาษคำตอบ" แล้วเลือก Save as PDF แทน');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const totalQ = exam.questionCount;
  const numCols = totalQ <= 20 ? 1 : totalQ <= 40 ? 2 : totalQ <= 60 ? 3 : 4;
  const qPerCol = Math.ceil(totalQ / numCols);

  // Dynamic choice labels: ก-ง หรือ A-D ตามตั้งค่าของชุดข้อสอบ
  const choiceLabels = exam.choiceLabelType === 'latin'
    ? ['A', 'B', 'C', 'D', 'E'].slice(0, exam.choiceCount)
    : ['ก', 'ข', 'ค', 'ง', 'จ'].slice(0, exam.choiceCount);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-sm print-modal-overlay">
      {/* Top Floating Control Bar (Always firmly at the top, NEVER blocks the paper) */}
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
              <span className="hidden md:inline-flex px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                A4 แนวตั้ง (210 × 297 มม.)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {exam.gradeLevel ? `${exam.gradeLevel} • ` : ''}
              {exam.questionCount} ข้อ ({exam.choiceCount} ตัวเลือก)
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
              setManualZoom(null);
            }}
            className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === '100%' && manualZoom === null
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>ขนาดจริง 100%</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={() => setManualZoom(Math.max(0.4, Number((currentScale - 0.1).toFixed(1))))}
            className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
            title="ย่อขนาด"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="font-mono text-[11px] px-1.5 text-slate-300 min-w-[42px] text-center">
            {Math.round(currentScale * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setManualZoom(Math.min(1.5, Number((currentScale + 0.1).toFixed(1))))}
            className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
            title="ขยายขนาด"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Main Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
            title="สั่งพิมพ์ออกเครื่องพิมพ์หรือบันทึกเป็น PDF"
          >
            <Printer className="w-4 h-4" />
            <span className="font-medium">พิมพ์กระดาษคำตอบ</span>
          </button>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-medium shadow-md shadow-indigo-900/30 transition-all cursor-pointer"
            title="ดาวน์โหลดไฟล์ PDF ขนาด A4"
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

      {/* Main Preview Container: items-start guarantees the TOP of the page is NEVER pushed offscreen */}
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
            marginBottom: currentScale < 1 ? `-${Math.round((1 - currentScale) * 1123)}px` : '24px',
            marginRight: currentScale < 1 ? `-${Math.round((1 - currentScale) * 794 / 2)}px` : '0',
            marginLeft: currentScale < 1 ? `-${Math.round((1 - currentScale) * 794 / 2)}px` : '0',
          }}
          className="shrink-0"
        >
          {/* Authentic Standard A4 Portrait Answer Sheet (210mm × 297mm) */}
          <article
            id="printable-answer-sheet"
            ref={printRef}
            className="w-[210mm] min-h-[297mm] h-[297mm] bg-white p-[8mm_10mm] shadow-2xl rounded-sm border border-slate-300 relative text-slate-900 select-none box-border flex flex-col justify-between"
          >
            {/* 4 Corner Alignment Registration Marks (OMR fiducials for skew correction) */}
            <div className="absolute top-[6mm] left-[6mm] w-[7mm] h-[7mm] bg-black pointer-events-none" />
            <div className="absolute top-[6mm] right-[6mm] w-[7mm] h-[7mm] bg-black pointer-events-none" />
            <div className="absolute bottom-[6mm] left-[6mm] w-[7mm] h-[7mm] bg-black pointer-events-none" />
            <div className="absolute bottom-[6mm] right-[6mm] w-[7mm] h-[7mm] bg-black pointer-events-none" />

            {/* Top Sheet Header Box (ภาษาไทยทั้งหมด ชัดเจน ครบถ้วน ไม่โดนบัง) */}
            <div>
              <div className="border-2 border-slate-900 rounded-xl p-3 mb-3 bg-white">
                <div className="flex items-start justify-between gap-3 pb-2.5 border-b-2 border-slate-800">
                  <div className="flex-1 space-y-1">
                    <h1 className="font-heading font-black text-lg text-slate-900 tracking-wide uppercase leading-tight">
                      กระดาษคำตอบแบบปรนัย (OMR ANSWER SHEET)
                    </h1>
                    <p className="text-xs font-bold text-slate-700">
                      {settings.organizationName || 'ศูนย์ทดสอบวัดผลทางการศึกษา'}
                    </p>
                    <div className="text-[12px] text-slate-800 font-semibold pt-0.5 leading-snug">
                      วิชา: <strong className="text-slate-950 font-bold">{exam.title}</strong>
                      {exam.gradeLevel ? (
                        <> | ระดับชั้น / ห้องเรียน: <strong className="text-slate-950 font-bold">{exam.gradeLevel}</strong></>
                      ) : null}
                      {exam.code ? (
                        <> | รหัสวิชา: <strong className="text-slate-950 font-mono font-bold">{exam.code}</strong></>
                      ) : null} | จำนวน: <strong className="text-slate-950 font-bold">{exam.questionCount} ข้อ ({exam.choiceCount} ตัวเลือก)</strong>
                    </div>
                  </div>

                  {/* Real QR Code: Unique to each exam */}
                  {qrCodeUrl && (
                    <div className="flex flex-col items-center justify-center p-1 bg-white border-2 border-slate-900 rounded-lg shrink-0 shadow-2xs">
                      <img
                        src={qrCodeUrl}
                        alt="Exam QR Code"
                        className="w-16 h-16 object-contain"
                      />
                      <span className="text-[8px] font-mono font-bold text-slate-800 uppercase tracking-tighter mt-0.5">
                        QR ชุดข้อสอบ
                      </span>
                    </div>
                  )}
                </div>

                {/* Student Information Lines (ภาษาไทยทั้งหมดตามคำขอ เห็นชัดเจน) */}
                <div className="grid grid-cols-2 gap-y-2 gap-x-6 pt-2.5 text-xs text-slate-900 font-medium">
                  <div className="flex items-baseline">
                    <span className="font-bold text-slate-900 shrink-0">ชื่อ - นามสกุล: </span>
                    <span className="ml-2 flex-1 border-b border-dotted border-slate-600 min-h-[14px]" />
                  </div>

                  <div className="flex items-baseline">
                    <span className="font-bold text-slate-900 shrink-0">เลขประจำตัวนักเรียน: </span>
                    <span className="ml-2 flex-1 border-b border-dotted border-slate-600 min-h-[14px]" />
                  </div>

                  <div className="flex items-baseline">
                    <span className="font-bold text-slate-900 shrink-0">ระดับชั้น / ห้องเรียน: </span>
                    <span className="ml-2 flex-1 border-b border-dotted border-slate-600 min-h-[14px] font-bold text-slate-900 pl-1">
                      {exam.gradeLevel ? exam.gradeLevel : ''}
                    </span>
                  </div>

                  <div className="flex items-baseline">
                    <span className="font-bold text-slate-900 shrink-0">วันที่ทำการสอบ: </span>
                    <span className="ml-2 flex-1 border-b border-dotted border-slate-600 min-h-[14px]" />
                  </div>
                </div>

                {/* Instruction Note */}
                <div className="mt-2 pt-1.5 border-t border-slate-300 text-[10.5px] text-slate-700 flex items-center justify-between">
                  <span>
                    📌 <strong>คำแนะนำ:</strong> ทำเครื่องหมายกากบาท (X) หรือขีดเขียนลงในช่องสี่เหลี่ยม [ ] เพียงตัวเลือกเดียวต่อหนึ่งข้อ
                  </span>
                  <span className="font-mono text-[9px] text-slate-500">ID: {exam.id}</span>
                </div>
              </div>

              {/* Questions Grid Columns */}
              <div
                className={`grid gap-2.5 ${
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
                      className="border-2 border-slate-800 rounded-lg overflow-hidden bg-white shadow-2xs"
                    >
                      {/* Column Header */}
                      <div className="bg-slate-200 border-b-2 border-slate-800 py-1 px-2 flex items-center justify-between text-xs font-black text-slate-900">
                        <span className="w-8 text-center font-bold">ข้อ</span>
                        <div className="flex-1 flex justify-around px-1 font-bold">
                          {choiceLabels.map((lbl) => (
                            <span key={lbl} className="w-5 text-center font-mono">
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
                              className="py-1 px-2 flex items-center justify-between text-xs"
                            >
                              <span className="w-8 font-mono font-bold text-slate-900 text-right pr-2">
                                {qNum}.
                              </span>
                              <div className="flex-1 flex justify-around items-center px-1">
                                {choiceLabels.map((lbl) => (
                                  <div
                                    key={lbl}
                                    className="w-[19px] h-[19px] rounded-xs border-2 border-slate-800 flex items-center justify-center text-[10px] font-mono font-bold text-slate-800 bg-white shadow-2xs"
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
            </div>

            {/* Bottom Footer Information */}
            <div className="flex items-center justify-between text-[10px] text-slate-600 border-t border-slate-400 pt-1.5 mt-2">
              <span>OMR Answer Sheet System • กระดาษคำตอบมาตรฐาน A4 แนวตั้ง (210 × 297 มม.)</span>
              <span>รหัสชุดข้อสอบ: {exam.id}</span>
              <span className="font-semibold">หน้า 1 / 1</span>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
};
