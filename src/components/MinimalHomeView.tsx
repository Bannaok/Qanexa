import React from 'react';
import { Exam } from '../types';
import { FileText, QrCode, ArrowRight } from 'lucide-react';

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
          className="group p-4 sm:p-6 bg-white border border-slate-200 hover:border-emerald-500 rounded-3xl transition-all shadow-xs hover:shadow-lg cursor-pointer flex items-center justify-between gap-3 sm:gap-4 relative overflow-hidden"
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0 shadow-xs">
              <QrCode className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <span className="font-mono text-xs font-bold text-slate-400 shrink-0">02.</span>
                <h2 className="font-heading font-bold text-base sm:text-lg text-slate-900 group-hover:text-emerald-600 transition-colors shrink-0">
                  สแกนคิวอาร์โค้ด
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 shrink-0 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  สแกนตรวจได้ทุกวิชา • ออโต้
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate">
                สแกนได้ทุกวิชาและทุกระดับชั้น • จับกระดาษคำตอบเขียว-แดงแม่นยำระดับมืออาชีพ
              </p>
            </div>
          </div>

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-slate-200 group-hover:border-emerald-600 group-hover:bg-emerald-50 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0">
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};
