import React, { useState, useMemo } from 'react';
import { Exam, ScanResult } from '../types';
import { storageService } from '../services/storageService';
import { useAuth } from '../services/authContext';
import { useToast } from '../services/toastContext';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  BarChart3,
  Calendar,
  Layers,
  GraduationCap,
  HardDrive,
} from 'lucide-react';
import { ImageFallback } from './ImageFallback';
import { LightboxModal } from './LightboxModal';

interface ExamResultsReportProps {
  exams: Exam[];
  selectedExamId?: string;
  onSelectExam?: (examId: string) => void;
}

export const ExamResultsReport: React.FC<ExamResultsReportProps> = ({
  exams,
  selectedExamId,
  onSelectExam,
}) => {
  const { isAdmin } = useAuth();
  const { success, error, info } = useToast();

  const [filterExamId, setFilterExamId] = useState<string>(selectedExamId || 'all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'date' | 'score' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Lightbox target
  const [lightboxResult, setLightboxResult] = useState<ScanResult | null>(null);

  // Results list
  const [results, setResults] = useState<ScanResult[]>(() => storageService.getScanResults());

  const reloadResults = () => {
    setResults(storageService.getScanResults());
  };

  const currentExam = useMemo(() => {
    return exams.find((e) => e.id === filterExamId);
  }, [exams, filterExamId]);

  // Filter and sort results
  const filteredResults = useMemo(() => {
    return results
      .filter((r) => {
        const matchExam = filterExamId === 'all' ? true : r.examId === filterExamId;
        const matchStatus =
          filterStatus === 'all' ? true : filterStatus === 'passed' ? r.passed : !r.passed;
        const matchSearch =
          r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.examTitle.toLowerCase().includes(searchQuery.toLowerCase());
        return matchExam && matchStatus && matchSearch;
      })
      .sort((a, b) => {
        if (sortField === 'score') {
          return sortOrder === 'desc'
            ? b.scorePercentage - a.scorePercentage
            : a.scorePercentage - b.scorePercentage;
        } else if (sortField === 'name') {
          return sortOrder === 'desc'
            ? b.studentName.localeCompare(a.studentName)
            : a.studentName.localeCompare(b.studentName);
        } else {
          return sortOrder === 'desc'
            ? new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
            : new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime();
        }
      });
  }, [results, filterExamId, filterStatus, searchQuery, sortField, sortOrder]);

  // Aggregate statistics
  const stats = useMemo(() => {
    if (filteredResults.length === 0) {
      return { total: 0, passed: 0, passRate: 0, avgScore: 0, highest: 0, lowest: 0 };
    }
    const total = filteredResults.length;
    const passed = filteredResults.filter((r) => r.passed).length;
    const passRate = Math.round((passed / total) * 100);
    const sumScore = filteredResults.reduce((acc, r) => acc + r.score, 0);
    const avgScore = parseFloat((sumScore / total).toFixed(1));
    const highest = Math.max(...filteredResults.map((r) => r.score));
    const lowest = Math.min(...filteredResults.map((r) => r.score));

    return { total, passed, passRate, avgScore, highest, lowest };
  }, [filteredResults]);

  // Item Analysis (Item Difficulty Index: % of students answering each question correctly)
  const itemAnalysis = useMemo(() => {
    if (!currentExam || filteredResults.length === 0) return [];

    const questionStats: { qNum: number; correctStudents: number; totalStudents: number; rate: number }[] = [];

    for (let q = 1; q <= currentExam.questionCount; q++) {
      let correct = 0;
      let total = 0;

      filteredResults.forEach((res) => {
        if (res.examId === currentExam.id) {
          const ans = res.answers?.find((a) => a.questionNumber === q);
          if (ans) {
            total++;
            if (ans.isCorrect) correct++;
          }
        }
      });

      const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
      questionStats.push({ qNum: q, correctStudents: correct, totalStudents: total, rate });
    }

    return questionStats;
  }, [currentExam, filteredResults]);

  const handleDeleteResult = (id: string) => {
    storageService.deleteScanResult(id);
    reloadResults();
    info('ลบข้อมูลผลสอบเรียบร้อยแล้ว');
  };

  // Export to Excel-compatible CSV with UTF-8 BOM for Thai Language support
  const handleExportCSV = () => {
    if (filteredResults.length === 0) {
      error('ไม่มีข้อมูลผลการสอบสำหรับส่งออก');
      return;
    }

    // CSV Headers
    const headers = [
      'ลำดับ',
      'รหัสนักเรียน',
      'ชื่อ-นามสกุล',
      'ระดับชั้น/ห้อง',
      'ชื่อชุดข้อสอบ',
      'คะแนนที่ได้',
      'คะแนนเต็ม',
      'ร้อยละ (%)',
      'ผลการประเมิน',
      'วันที่และเวลาที่สแกน',
      'ผู้ตรวจ (Email)',
    ];

    const rows = filteredResults.map((r, index) => [
      index + 1,
      `"${r.studentId}"`,
      `"${r.studentName}"`,
      `"${r.studentClass || '-'}"`,
      `"${r.examTitle}"`,
      r.score,
      r.totalQuestions,
      r.scorePercentage,
      r.passed ? 'ผ่าน' : 'ไม่ผ่าน',
      `"${new Date(r.scannedAt).toLocaleString('th-TH')}"`,
      `"${r.scannedByEmail}"`,
    ]);

    const csvContent =
      '\uFEFF' + // UTF-8 BOM
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Exam_Results_${filterExamId !== 'all' ? currentExam?.code || 'Export' : 'All'}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    success('ส่งออกไฟล์ CSV สำเร็จ', 'ไฟล์รองรับการเปิดด้วย Microsoft Excel และ Google Sheets อย่างสมบูรณ์');
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Lightbox Modal */}
      {lightboxResult && (
        <LightboxModal
          result={lightboxResult}
          onClose={() => setLightboxResult(null)}
          onDelete={handleDeleteResult}
        />
      )}

      {/* Top Banner / Controls (Hidden when printing) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-heading font-bold text-slate-800">
                รายงานผลคะแนนและการวิเคราะห์ข้อสอบ (Results & Analytics)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              สรุปผลการสอบปรนัย กรองข้อมูล ค้นหา และส่งออกรายงานเป็น Excel/CSV หรือพิมพ์กระดาษ
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              ส่งออก CSV (Excel)
            </button>

            <button
              onClick={handlePrintReport}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              พิมพ์รายงาน (Print)
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
          {/* Exam Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              เลือกชุดข้อสอบ:
            </label>
            <select
              value={filterExamId}
              onChange={(e) => {
                setFilterExamId(e.target.value);
                if (onSelectExam) onSelectExam(e.target.value);
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">ทุกชุดวิชา (ทั้งหมด)</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.code})
                </option>
              ))}
            </select>
          </div>

          {/* Pass/Fail Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              สถานะผลการสอบ:
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">ทั้งหมด (ผ่านและไม่ผ่าน)</option>
              <option value="passed">เฉพาะผู้สอบผ่านเกณฑ์</option>
              <option value="failed">เฉพาะผู้ไม่ผ่านเกณฑ์</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              เรียงลำดับข้อมูล (Sort):
            </label>
            <div className="flex gap-1">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
              >
                <option value="date">วันที่ทำการสแกน</option>
                <option value="score">คะแนนสอบ</option>
                <option value="name">ชื่อนักเรียน</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="p-2 border border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                title={sortOrder === 'desc' ? 'จากมากไปน้อย / ล่าสุด' : 'จากน้อยไปมาก / เก่าสุด'}
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              ค้นหาชื่อ หรือ รหัสนักเรียน:
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="พิมพ์ชื่อ หรือเลขประจำตัว..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 no-print">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">จำนวนผู้เข้าสอบ</div>
          <div className="text-2xl font-heading font-bold text-slate-800 mt-1">
            {stats.total} <span className="text-xs font-normal text-slate-400">คน</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">อัตราการสอบผ่าน</div>
          <div className="text-2xl font-heading font-bold text-emerald-600 mt-1">
            {stats.passRate}% <span className="text-xs font-normal text-slate-400">({stats.passed} คน)</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">คะแนนเฉลี่ย</div>
          <div className="text-2xl font-heading font-bold text-indigo-600 mt-1">
            {stats.avgScore} <span className="text-xs font-normal text-slate-400">คะแนน</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">คะแนนสูงสุด / ต่ำสุด</div>
          <div className="text-2xl font-heading font-bold text-slate-800 mt-1">
            <span className="text-emerald-600">{stats.highest}</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-rose-500">{stats.lowest}</span>
          </div>
        </div>
      </div>

      {/* Item Analysis Chart (If an exam is selected) */}
      {currentExam && itemAnalysis.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm no-print">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-sm text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                การวิเคราะห์ความยากง่ายรายข้อ (Item Difficulty Analysis)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ร้อยละของนักเรียนที่ตอบถูกในแต่ละข้อ (% ถูกต้อง)
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> ง่าย (&gt;70%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> ปานกลาง (40-70%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> ยาก (&lt;40%)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-20 gap-2">
            {itemAnalysis.map((item) => {
              const bg =
                item.rate >= 70
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : item.rate >= 40
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-rose-100 text-rose-800 border-rose-200';

              return (
                <div
                  key={item.qNum}
                  className={`p-2 rounded-xl border text-center font-mono ${bg}`}
                  title={`ข้อ ${item.qNum}: ตอบถูก ${item.correctStudents}/${item.totalStudents} คน (${item.rate}%)`}
                >
                  <div className="text-[10px] opacity-75 font-sans">ข้อ {item.qNum}</div>
                  <div className="font-bold text-xs mt-0.5">{item.rate}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Results Table & Print Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Printable Header (Visible only when printing) */}
        <div className="hidden print-only p-8 text-center border-b border-slate-300">
          <h1 className="text-xl font-bold text-slate-900">
            รายงานผลการสอบและคะแนนปรนัย (Multiple-Choice Exam Scanner Report)
          </h1>
          <p className="text-sm text-slate-700 mt-1">
            ชุดวิชา: {filterExamId !== 'all' ? currentExam?.title : 'ภาพรวมทุกรายวิชา'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')} | จำนวนผู้สอบ: {filteredResults.length} คน
          </p>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">กระดาษที่สแกน</th>
                <th className="py-3.5 px-4">ชื่อ - รหัสนักเรียน</th>
                <th className="py-3.5 px-4">วิชา / ข้อสอบ</th>
                <th className="py-3.5 px-4 text-center">คะแนนสุทธิ</th>
                <th className="py-3.5 px-4 text-center">สถานะ</th>
                <th className="py-3.5 px-4">วันที่สแกน</th>
                <th className="py-3.5 px-4 text-right no-print">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <GraduationCap className="w-10 h-10 text-slate-300" />
                      <p>ยังไม่มีข้อมูลผลการตรวจข้อสอบตามเงื่อนไขที่เลือก</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredResults.map((result, idx) => (
                  <tr
                    key={result.id}
                    className="hover:bg-slate-50/70 transition-colors page-break-inside-avoid"
                  >
                    <td className="py-3 px-4 text-center font-mono text-xs text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Scanned Image Thumbnail / Fallback */}
                    <td className="py-3 px-4">
                      <div
                        onClick={() => setLightboxResult(result)}
                        className="w-12 h-16 rounded-lg overflow-hidden border border-slate-200 cursor-pointer shadow-2xs hover:scale-105 transition-transform bg-slate-100 flex items-center justify-center shrink-0 group relative"
                        title="คลิกเพื่อขยายดูภาพเต็มใน Lightbox"
                      >
                        <ImageFallback
                          src={result.annotatedImageUrl || result.scannedImageUrl}
                          alt={`แผ่นคำตอบของ ${result.studentName}`}
                          className="w-full h-full object-cover"
                          aspectRatio="aspect-[3/4]"
                          fallbackText="ชำรุด"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity no-print">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    </td>

                    {/* Student Info */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{result.studentName}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        ID: {result.studentId} {result.studentClass && `• ${result.studentClass}`}
                      </div>
                    </td>

                    {/* Exam Title */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-700 max-w-[200px] truncate" title={result.examTitle}>
                        {result.examTitle}
                      </div>
                    </td>

                    {/* Score */}
                    <td className="py-3 px-4 text-center">
                      <div className="font-heading font-bold text-base text-slate-800">
                        {result.score} / {result.totalQuestions}
                      </div>
                      <div className="text-xs font-mono text-slate-400">{result.scorePercentage}%</div>
                    </td>

                    {/* Pass/Fail Status */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          result.passed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {result.passed ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> ผ่าน
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" /> ไม่ผ่าน
                          </>
                        )}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-xs text-slate-500">
                      <div>{new Date(result.scannedAt).toLocaleDateString('th-TH')}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(result.scannedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    {/* Actions (Lightbox + Delete) */}
                    <td className="py-3 px-4 text-right no-print">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setLightboxResult(result)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="ขยายดูภาพกระดาษคำตอบ (Lightbox)"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => {
                              if (confirm(`คุณต้องการลบผลการสอบของ ${result.studentName} หรือไม่?`)) {
                                handleDeleteResult(result.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบผลการสแกนนี้ (Admin)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
