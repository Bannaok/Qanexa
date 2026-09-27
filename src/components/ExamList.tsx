import React, { useState, useMemo } from 'react';
import { Exam } from '../types';
import { storageService } from '../services/storageService';
import { useToast } from '../services/toastContext';
import {
  FileText,
  PlusCircle,
  Search,
  Printer,
  Camera,
  Edit3,
  Trash2,
  Calendar,
  GraduationCap,
  ArrowLeft,
} from 'lucide-react';

interface ExamListProps {
  exams: Exam[];
  onOpenCreate: () => void;
  onEditExam: (exam: Exam) => void;
  onScanExam: (exam: Exam) => void;
  onPrintExam: (exam: Exam) => void;
  onExamsUpdated: () => void;
  onGoHome?: () => void;
}

const GRADE_ORDER = [
  'ชั้นประถมศึกษาปีที่ 1',
  'ชั้นประถมศึกษาปีที่ 2',
  'ชั้นประถมศึกษาปีที่ 3',
  'ชั้นประถมศึกษาปีที่ 4',
  'ชั้นประถมศึกษาปีที่ 5',
  'ชั้นประถมศึกษาปีที่ 6',
  'ชั้นมัธยมศึกษาปีที่ 1',
  'ชั้นมัธยมศึกษาปีที่ 2',
  'ชั้นมัธยมศึกษาปีที่ 3',
];

const getGradeRank = (grade?: string): number => {
  if (!grade) return 999;
  const idx = GRADE_ORDER.indexOf(grade);
  return idx === -1 ? 900 : idx;
};

export const ExamList: React.FC<ExamListProps> = ({
  exams,
  onOpenCreate,
  onEditExam,
  onScanExam,
  onPrintExam,
  onExamsUpdated,
  onGoHome,
}) => {
  const { info } = useToast();

  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState<string>('all');

  // Filter & Automatic Grade-Order Sorting (ป.1 -> ป.2 ... -> ม.3)
  const filteredExams = useMemo(() => {
    return exams
      .filter((e) => {
        const matchSearch =
          !search ||
          e.title.toLowerCase().includes(search.toLowerCase()) ||
          (e.code && e.code.toLowerCase().includes(search.toLowerCase())) ||
          (e.gradeLevel && e.gradeLevel.toLowerCase().includes(search.toLowerCase()));

        const matchGrade = filterGrade === 'all' ? true : e.gradeLevel === filterGrade;

        return matchSearch && matchGrade;
      })
      .sort((a, b) => {
        const rankA = getGradeRank(a.gradeLevel);
        const rankB = getGradeRank(b.gradeLevel);
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        return a.title.localeCompare(b.title, 'th');
      });
  }, [exams, search, filterGrade]);

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`ยืนยันการลบชุดข้อสอบ "${title}" หรือไม่? ข้อมูลจะถูกลบออกจากทุกเครื่องทันที`)) {
      await storageService.deleteExam(id);
      onExamsUpdated();
      info('ลบชุดข้อสอบเรียบร้อยแล้ว (ซิงค์ไปยังคลาวด์ D1 เรียบร้อย)');
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full animate-fadeIn pb-12">
      {/* Top Header Card - Mobile optimized */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onGoHome && (
              <button
                onClick={onGoHome}
                title="กลับหน้าหลัก"
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-heading font-bold text-slate-800 leading-tight">
                ชุดข้อสอบ
              </h2>
              <span className="text-[11px] text-slate-500">
                {filteredExams.length} รายการ (เรียงตามระดับชั้น)
              </span>
            </div>
          </div>

          <button
            onClick={onOpenCreate}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>สร้างชุดกระดาษคำตอบ</span>
          </button>
        </div>

        {/* Filter by Grade & Search in one compact row */}
        <div className="flex flex-col sm:flex-row gap-2 mt-3.5 pt-3.5 border-t border-slate-100">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อวิชา..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>

          {/* Grade Level Selector */}
          <div className="flex items-center gap-1.5 shrink-0">
            <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 transition-colors cursor-pointer"
            >
              <option value="all">ทุกระดับชั้น ({exams.length})</option>
              {GRADE_ORDER.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Exam List Cards */}
      {filteredExams.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-xs">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">ไม่พบชุดข้อสอบ</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {search || filterGrade !== 'all'
              ? 'ไม่พบข้อมูลที่ตรงกับตัวกรองที่เลือก ลองเปลี่ยนคำค้นหาหรือระดับชั้น'
              : 'เริ่มต้นสร้างชุดกระดาษคำตอบปรนัย (OMR) ชุดแรกของคุณเพื่อเริ่มใช้งาน'}
          </p>
          <button
            onClick={onOpenCreate}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>สร้างชุดข้อสอบใหม่</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredExams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 p-3 sm:p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
            >
              {/* Left Column: Grade badge & Title */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {exam.gradeLevel && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      <GraduationCap className="w-3 h-3" />
                      {exam.gradeLevel}
                    </span>
                  )}
                  {exam.code && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-600 font-medium">
                      {exam.code}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500 font-medium">
                    {exam.questionCount} ข้อ • {exam.choiceCount} ตัวเลือก
                  </span>
                  {exam.choiceLabelType && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      [{exam.choiceLabelType === 'latin' ? 'A,B,C' : 'ก,ข,ค'}]
                    </span>
                  )}
                </div>

                <h3 className="font-heading font-bold text-sm sm:text-base text-slate-900 group-hover:text-indigo-600 transition-colors truncate mt-1">
                  {exam.title}
                </h3>
              </div>

              {/* Right Column: Compact Actions */}
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                {/* Print button */}
                <button
                  onClick={() => onPrintExam(exam)}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  title="พิมพ์กระดาษคำตอบ A4"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>พิมพ์</span>
                </button>

                {/* Scan button */}
                <button
                  onClick={() => onScanExam(exam)}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  title="เริ่มสแกน OMR"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>สแกน</span>
                </button>

                {/* Edit & Delete in minimal icon buttons */}
                <button
                  onClick={() => onEditExam(exam)}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                  title="แก้ไข"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDelete(exam.id, exam.title)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="ลบ"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
