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
} from 'lucide-react';

interface AnswerSheetViewProps {
  exam: Exam;
  onClose: () => void;
}

/**
 * Single Answer Sheet Half (A5 size in A4 Landscape: 148.5mm x 210mm)
 * - 3 Distinct Tables:
 *     Table 1 (Left): ข้อ 1 - 15
 *     Table 2 (Center): ข้อ 16 - 30
 *     Table 3 (Right): ข้อ 31 - 45
 * - Strictly 4 Choices: ก, ข, ค, ง / A, B, C, D (No 'จ' or 'E' to maximize square space)
 * - Choice cells are perfect squares (สี่เหลี่ยมจัตุรัส ~8.6mm x ~8.6mm)
 * - Row 15 does not touch the bottom margin so tightly, leaving comfortable breathing room
 * - Student info box:
 *     Row 1: ชื่อ - สกุล (ยาวเต็มบรรทัดเดี่ยวๆ)
 *     Row 2: ชั้น, เลขที่, วันที่ (อยู่ร่วมกันในบรรทัดที่ 2)
 */
/**
 * Single Answer Sheet Half (A5 size in A4 Landscape: 148.5mm x 210mm)
 * - Circular OMR Bubbles (ฝนวงกลม):
 *     Circles (◯) with crisp border for pencil (2B/HB) and pen (blue/black), supports liquid paper correction.
 * - Dynamic Layout:
 *     If total questions <= 15: Single centered table (ตรงกลางเลย)
 *     If total questions > 15: 3 distinct tables:
 *         Table 1 (Left): ข้อ 1 - 15
 *         Table 2 (Center): ข้อ 16 - 30
 *         Table 3 (Right): ข้อ 31 - 45
 * - Strictly 4 Choices: ก, ข, ค, ง / A, B, C, D
 * - Student info box:
 *     Row 1: ชื่อ - สกุล (ยาวเต็มบรรทัด)
 *     Row 2: ชั้น, เลขที่, วันที่
 */
const SingleAnswerSheetHalf: React.FC<{
  exam: Exam;
  qrCodeUrl: string;
  copyIndex: number;
}> = ({ exam, qrCodeUrl, copyIndex }) => {
  const totalQ = exam.questionCount;
  const isSingleColumn = totalQ <= 15;
  const choiceCount = 4;
  const thaiLabels = ['ก', 'ข', 'ค', 'ง'];
  const latinLabels = ['A', 'B', 'C', 'D'];

  // 3 Fixed Tables of 15 rows each
  const tablesConfig = [
    { start: 1, end: 15 },
    { start: 16, end: 30 },
    { start: 31, end: 45 },
  ];

  const renderTable = (startQ: number, endQ: number, tableIdx: number, isCentered = false) => {
    const rows = Array.from({ length: 15 }, (_, i) => startQ + i);

    return (
      <div
        key={tableIdx}
        className={`${
          isCentered ? 'w-[62mm] max-w-[65mm]' : 'flex-1'
        } flex flex-col border-2 border-slate-950 bg-white rounded-xs overflow-hidden shadow-2xs`}
      >
        <table className="w-full border-collapse border-slate-950 text-center select-none table-fixed">
          <thead>
            {/* Header Row 1: ก ข ค ง */}
            <tr className="bg-rose-100/90 text-slate-950 font-black text-xs border-b border-slate-900">
              <th
                rowSpan={2}
                className="border-r border-slate-900 w-[22%] py-0.5 text-center font-black text-xs font-mono"
              >
                ข้อ
              </th>
              {thaiLabels.map((lbl) => (
                <th
                  key={lbl}
                  className="border-r border-slate-900 last:border-r-0 py-0.5 text-center font-black text-xs"
                >
                  {lbl}
                </th>
              ))}
            </tr>
            {/* Header Row 2: A B C D */}
            <tr className="bg-rose-100/90 text-slate-800 text-[10px] font-bold border-b-2 border-slate-950">
              {latinLabels.map((lbl) => (
                <th
                  key={lbl}
                  className="border-r border-slate-900 last:border-r-0 py-0 text-center font-mono leading-tight"
                >
                  {lbl}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((qNum) => {
              const isActive = qNum <= totalQ;

              return (
                <tr
                  key={qNum}
                  className="border-b border-slate-900 last:border-b-0 h-[8.5mm]"
                >
                  {/* Question Number Cell */}
                  <td className="border-r border-slate-900 bg-rose-50/80 font-mono font-black text-slate-950 text-xs sm:text-sm text-center p-0">
                    {isActive ? qNum : ''}
                  </td>

                  {/* 4 Circular Choice Bubbles (วงกลมสำหรับฝน) */}
                  {Array.from({ length: choiceCount }, (_, cIdx) => (
                    <td
                      key={cIdx}
                      className={`border-r border-slate-900 last:border-r-0 p-0 text-center align-middle ${
                        isActive ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      {isActive ? (
                        <div className="w-5.5 h-5.5 rounded-full border-2 border-slate-900 bg-white flex items-center justify-center font-bold text-slate-800 text-[10px] select-none mx-auto">
                          {thaiLabels[cIdx]}
                        </div>
                      ) : null}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="w-[148.5mm] h-[210mm] max-h-[210mm] p-[3.5mm_5mm] relative flex flex-col justify-between box-border overflow-hidden bg-white text-slate-900 border border-slate-300">
      {/* 4 Corner Alignment Registration Marks (OMR fiducials for skew correction) */}
      <div className="absolute top-[3.5mm] left-[3.5mm] w-[5mm] h-[5mm] bg-black pointer-events-none" />
      <div className="absolute top-[3.5mm] right-[3.5mm] w-[5mm] h-[5mm] bg-black pointer-events-none" />
      <div className="absolute bottom-[3.5mm] left-[3.5mm] w-[5mm] h-[5mm] bg-black pointer-events-none" />
      <div className="absolute bottom-[3.5mm] right-[3.5mm] w-[5mm] h-[5mm] bg-black pointer-events-none" />

      {/* Sheet Content: neatly structured with breathing room at bottom */}
      <div className="flex-1 flex flex-col justify-between h-full pt-1 px-0.5 pb-2">
        {/* Top Header: Title, Subject & QR Code */}
        <div className="flex items-center justify-between gap-2 px-1 pb-1">
          <div className="flex-1 text-center pl-8">
            <h1 className="font-heading font-black text-base text-slate-950 tracking-wider">
              กระดาษคำตอบ
            </h1>
            <div className="text-[11px] text-slate-700 font-semibold truncate">
              วิชา: <strong className="text-slate-950 font-bold">{exam.title}</strong>
              {exam.gradeLevel ? ` (${exam.gradeLevel})` : ''}
              {' '}<span className="text-slate-500 font-normal">| แผ่นที่ {copyIndex}</span>
            </div>
          </div>

          {/* Top Right: QR Code Box (ขนาดใหญ่ คมชัด สแกนติดง่ายมากในระยะถือกล้องมือถือ) */}
          {qrCodeUrl && (
            <div className="flex flex-col items-center justify-center p-2 bg-white border-2 border-slate-950 rounded-xl shrink-0 shadow-xs">
              <img
                src={qrCodeUrl}
                alt="Exam QR Code"
                className="w-18 h-18 object-contain"
              />
              <span className="text-[8px] font-mono font-black text-slate-900 uppercase tracking-tight mt-0.5">
                QR รหัสข้อสอบ
              </span>
            </div>
          )}
        </div>

        {/* Student Info Box:
            Row 1: ชื่อ - สกุล (ยาวเต็มบรรทัดเดี่ยวๆ สำหรับชื่อยาว)
            Row 2: ชั้น, เลขที่, วันที่ (อยู่ร่วมกันในบรรทัดที่ 2)
        */}
        <div className="border border-slate-900 rounded-xl p-2 px-3 bg-white text-[11px] leading-snug space-y-1.5 shrink-0">
          {/* Row 1: ชื่อ - สกุล ยาวเต็มบรรทัด */}
          <div className="flex items-center min-w-0">
            <span className="font-bold text-slate-950 shrink-0 text-xs">ชื่อ - สกุล:</span>
            <div className="ml-2 flex-1 border-b border-dotted border-slate-700 h-[14px] relative overflow-hidden">
              <span className="absolute inset-x-0 bottom-0 text-slate-500 tracking-[0.2em] whitespace-nowrap text-[10px] pointer-events-none select-none">
                ....................................................................................................................................
              </span>
            </div>
          </div>

          {/* Row 2: ชั้น + เลขที่ + วันที่ อยู่ร่วมกัน */}
          <div className="flex items-center gap-3">
            {/* ชั้น */}
            <div className="flex items-center w-28 shrink-0">
              <span className="font-bold text-slate-950 shrink-0">ชั้น:</span>
              <div className="ml-1.5 flex-1 border-b border-dotted border-slate-700 h-[14px] relative overflow-hidden">
                <span className="absolute inset-x-0 bottom-0 text-slate-500 tracking-[0.2em] whitespace-nowrap text-[10px] pointer-events-none select-none">
                  ................
                </span>
              </div>
            </div>

            {/* เลขที่ */}
            <div className="flex items-center w-24 shrink-0">
              <span className="font-bold text-slate-950 shrink-0">เลขที่:</span>
              <div className="ml-1.5 flex-1 border-b border-dotted border-slate-700 h-[14px] relative overflow-hidden">
                <span className="absolute inset-x-0 bottom-0 text-slate-500 tracking-[0.2em] whitespace-nowrap text-[10px] pointer-events-none select-none">
                  ............
                </span>
              </div>
            </div>

            {/* วันที่ */}
            <div className="flex items-center flex-1 min-w-0">
              <span className="font-bold text-slate-950 shrink-0">วันที่:</span>
              <div className="ml-1.5 flex-1 border-b border-dotted border-slate-700 h-[14px] relative overflow-hidden">
                <span className="absolute inset-x-0 bottom-0 text-slate-500 tracking-[0.2em] whitespace-nowrap text-[10px] pointer-events-none select-none">
                  ............................................................
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Centered Instruction Pill Badge */}
        <div className="flex justify-center my-1 shrink-0">
          <div className="bg-slate-700 text-white text-[9px] font-bold px-3 py-0.5 rounded-full tracking-wide shadow-2xs">
            คำชี้แจง: ใช้ดินสอ 2B หรือปากกา ฝนในวงกลม [ ◯ ] ให้เข้มเต็มวง (ลบด้วยน้ำยาลบคำผิดได้ • ห้ามฝนเกิน 1 ข้อ)
          </div>
        </div>

        {/* Answer Tables Layout:
            - If totalQ <= 15: Single centered table (15 ข้อ อยู่ตรงกลางเลย)
            - If totalQ > 15: 3 distinct tables (ซ้าย 1-15, กลาง 16-30, ขวา 31-45)
        */}
        {isSingleColumn ? (
          <div className="flex justify-center w-full items-start shrink-0 mb-1">
            {renderTable(1, 15, 0, true)}
          </div>
        ) : (
          <div className="flex gap-2 w-full items-start shrink-0 mb-1">
            {tablesConfig.map((cfg, idx) => renderTable(cfg.start, cfg.end, idx, false))}
          </div>
        )}
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

  // Generate distinct QR code (high resolution for crisp camera reading at any distance)
  useEffect(() => {
    QRCode.toDataURL(getExamQRPayload(exam), {
      margin: 3,
      width: 360,
      errorCorrectionLevel: 'M', // Industry standard 15% error recovery for reliable paper scanning
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

  /**
   * Print Handler: Prints ONLY the authentic answer sheet without any webpage UI or background
   */
  const handlePrint = () => {
    const element = document.getElementById('printable-answer-sheet');
    if (!element) {
      window.print();
      return;
    }

    try {
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      document.body.appendChild(printIframe);

      const doc = printIframe.contentDocument || printIframe.contentWindow?.document;
      if (doc) {
        doc.open();
        let styles = '';
        document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
          styles += el.outerHTML;
        });

        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>กระดาษคำตอบ - ${exam.title}</title>
              ${styles}
              <style>
                @page {
                  size: A4 landscape;
                  margin: 0;
                }
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 297mm !important;
                  height: 210mm !important;
                  background: #ffffff !important;
                  overflow: hidden !important;
                }
                #printable-answer-sheet {
                  width: 297mm !important;
                  height: 210mm !important;
                  max-height: 210mm !important;
                  margin: 0 !important;
                  box-sizing: border-box !important;
                  transform: none !important;
                  border: 2px solid #0f172a !important;
                  box-shadow: none !important;
                  display: flex !important;
                  flex-direction: row !important;
                }
              </style>
            </head>
            <body>
              ${element.outerHTML}
            </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(printIframe)) {
              document.body.removeChild(printIframe);
            }
          }, 2000);
        }, 300);
        return;
      }
    } catch (e) {
      console.warn('Iframe print error, falling back to window.print', e);
    }

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
                {exam.questionCount <= 15
                  ? 'กระดาษคำตอบฝนวงกลม 15 ข้อ (ตรงกลางแผ่น)'
                  : 'A4 แนวนอน • ฝนวงกลม 2 ชุด/แผ่น (3 คอลัมน์: 1-15, 16-30, 31-45)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {exam.gradeLevel ? `${exam.gradeLevel} • ` : ''}
              {exam.questionCount} ข้อ (ฝนวงกลม 4 ตัวเลือก ก,ข,ค,ง) • รองรับดินสอ ปากกา และลิควิดลบคำผิด
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
          {/* Download PDF Button (ปุ่มเดียวสีน้ำเงิน) */}
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-indigo-900/30 transition-all cursor-pointer"
            title="ดาวน์โหลดไฟล์ PDF ขนาด A4 แนวนอน (1 แผ่นได้ 2 ชุดข้อสอบ)"
          >
            <Download className="w-4 h-4" />
            <span>{isGeneratingPdf ? 'กำลังสร้างไฟล์ PDF...' : 'ดาวน์โหลด PDF'}</span>
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
            className="w-[297mm] min-h-[210mm] h-[210mm] max-h-[210mm] bg-white shadow-2xl rounded-sm border-2 border-slate-900 relative text-slate-900 select-none box-border flex overflow-hidden"
          >
            {/* Center Dashed Cutting Line (เส้นประตัดแบ่งครึ่งกระดาษ เรียบง่าย ไม่มีข้อความ) */}
            <div className="absolute top-0 bottom-0 left-[148.5mm] -translate-x-1/2 w-[1px] border-r-2 border-dashed border-slate-400 pointer-events-none z-10" />

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
