import React, { useState, useEffect } from 'react';
import { ChoiceCount, ChoiceLabelType, Exam } from '../types';
import { storageService } from '../services/storageService';
import { useAuth } from '../services/authContext';
import { useToast } from '../services/toastContext';
import {
  X,
  FileCheck,
  Check,
  CheckCircle2,
} from 'lucide-react';

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExamCreated: (newExam: Exam) => void;
  editingExam?: Exam | null;
  examToEdit?: Exam | null;
}

const GRADE_LEVELS = [
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

export const CreateExamModal: React.FC<CreateExamModalProps> = ({
  isOpen,
  onClose,
  onExamCreated,
  editingExam,
  examToEdit,
}) => {
  const { currentUser } = useAuth();
  const { success, error, info } = useToast();

  const activeExam = editingExam || examToEdit;

  const [title, setTitle] = useState('');
  const [gradeLevel, setGradeLevel] = useState<string>('ชั้นประถมศึกษาปีที่ 1');
  const [description, setDescription] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [choiceCount, setChoiceCount] = useState<ChoiceCount>(4);
  const [choiceLabelType, setChoiceLabelType] = useState<ChoiceLabelType>('thai');
  const [passPercentage, setPassPercentage] = useState<number>(50);

  // Answer Key: questionNumber (1-based) -> choiceIndex (0-based)
  const [answerKey, setAnswerKey] = useState<Record<number, number>>({});

  // Synchronize state when modal opens or activeExam changes
  useEffect(() => {
    if (!isOpen) return;

    if (activeExam) {
      // 1. STRICTLY preserve the saved exam's data!
      setTitle(activeExam.title || '');
      setGradeLevel(activeExam.gradeLevel || 'ชั้นประถมศึกษาปีที่ 1');
      setDescription(activeExam.description || '');
      setQuestionCount(activeExam.questionCount || 20);
      setChoiceCount(activeExam.choiceCount || 4);
      setChoiceLabelType(activeExam.choiceLabelType || 'thai');
      setPassPercentage(activeExam.passPercentage || 50);

      // Load EXACT answer key saved in the exam
      if (activeExam.answerKey && Object.keys(activeExam.answerKey).length > 0) {
        setAnswerKey({ ...activeExam.answerKey });
      } else {
        const defaultKeys: Record<number, number> = {};
        for (let i = 1; i <= (activeExam.questionCount || 20); i++) {
          defaultKeys[i] = 0;
        }
        setAnswerKey(defaultKeys);
      }
    } else {
      // Creating a new exam from scratch
      setTitle('');
      setGradeLevel('ชั้นประถมศึกษาปีที่ 1');
      setDescription('');
      setQuestionCount(20);
      setChoiceCount(4);
      setChoiceLabelType('thai');
      setPassPercentage(50);
      const defaultKeys: Record<number, number> = {};
      for (let i = 1; i <= 20; i++) {
        defaultKeys[i] = 0;
      }
      setAnswerKey(defaultKeys);
    }
  }, [isOpen, activeExam]);

  if (!isOpen) return null;

  const thaiLabels = ['ก', 'ข', 'ค', 'ง', 'จ'];
  const latinLabels = ['A', 'B', 'C', 'D', 'E'];
  const currentLabels = choiceLabelType === 'latin'
    ? latinLabels.slice(0, choiceCount)
    : thaiLabels.slice(0, choiceCount);

  const handleQuestionCountChange = (rawCount: number) => {
    const count = Math.max(1, Math.min(100, rawCount || 1));
    setQuestionCount(count);
    setAnswerKey((prev) => {
      const updated = { ...prev };
      for (let i = 1; i <= count; i++) {
        if (updated[i] === undefined || updated[i] >= choiceCount) {
          updated[i] = 0;
        }
      }
      Object.keys(updated).forEach((k) => {
        if (Number(k) > count) delete updated[Number(k)];
      });
      return updated;
    });
  };

  const handleChoiceCountChange = (choices: ChoiceCount) => {
    setChoiceCount(choices);
    setAnswerKey((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((k) => {
        const qNum = Number(k);
        if (updated[qNum] >= choices) {
          updated[qNum] = choices - 1;
        }
      });
      return updated;
    });
  };

  const handleSelectChoice = (questionNum: number, choiceIndex: number) => {
    setAnswerKey((prev) => ({
      ...prev,
      [questionNum]: choiceIndex,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      error('กรุณาระบุชื่อวิชา');
      return;
    }

    if (questionCount < 1 || questionCount > 100) {
      error('จำนวนข้อต้องอยู่ระหว่าง 1 ถึง 100 ข้อ');
      return;
    }

    // Verify all questions have an answer key
    for (let i = 1; i <= questionCount; i++) {
      if (answerKey[i] === undefined) {
        error(`กรุณาระบุเฉลยสำหรับข้อที่ ${i}`);
        return;
      }
    }

    const examData: Exam = {
      id: activeExam?.id || 'exam_' + Math.random().toString(36).substring(2, 9),
      title: title.trim(),
      gradeLevel,
      code: activeExam?.code || '',
      description: description.trim(),
      questionCount,
      choiceCount,
      choiceLabelType,
      passPercentage,
      answerKey,
      createdBy: activeExam?.createdBy || currentUser?.email || 'admin',
      creatorName: activeExam?.creatorName || currentUser?.displayName || 'Admin',
      createdAt: activeExam?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storageService.saveExam(examData);
    onExamCreated(examData);
    success(
      activeExam ? 'แก้ไขชุดกระดาษคำตอบเรียบร้อย' : 'สร้างชุดกระดาษคำตอบสำเร็จ',
      `วิชา ${examData.title} • ${examData.gradeLevel} (${examData.questionCount} ข้อ)`
    );
    onClose();
  };

  // 3 Columns Calculation: Questions flow downwards in col 1, then col 2, then col 3
  const numCols = 3;
  const qPerCol = Math.ceil(questionCount / numCols);
  const columnQuestions: number[][] = [
    Array.from({ length: Math.min(qPerCol, Math.max(0, questionCount)) }, (_, i) => 1 + i),
    Array.from({ length: Math.min(qPerCol, Math.max(0, questionCount - qPerCol)) }, (_, i) => 1 + qPerCol + i),
    Array.from({ length: Math.max(0, questionCount - 2 * qPerCol) }, (_, i) => 1 + 2 * qPerCol + i),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-slate-800">
                {activeExam ? 'แก้ไขชุดกระดาษคำตอบ' : 'สร้างชุดกระดาษคำตอบ'}
              </h3>
              <p className="text-xs text-slate-500">
                กำหนดชื่อวิชา ระดับชั้น จำนวนข้อ ตัวเลือก และบันทึกเฉลยข้อสอบ (Answer Key)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1 bg-white">
          {/* Section 1: ชื่อวิชา และ ระดับชั้น (ป.1 - ม.3) */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* ชื่อวิชา */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อวิชา / การสอบ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น ภาษาอังกฤษเพื่อการสื่อสาร (กลางภาคเรียนที่ 1)"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* ระดับชั้น: ป.1 - ม.3 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ระดับชั้น <span className="text-rose-500">*</span>
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {GRADE_LEVELS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                คำอธิบายเพิ่มเติม (ไม่บังคับ)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="เช่น ข้อสอบประเมินผลการเรียนรู้ท้ายบทเรียน"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Section 2: Questions & Choice Config */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            {/* 1. จำนวนข้อสอบ (กรอกได้เลย) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                จำนวนข้อสอบ (กรอกจำนวนข้อ) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={questionCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  handleQuestionCountChange(val);
                }}
                placeholder="ระบุจำนวนข้อ เช่น 20"
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">กรอกได้ตั้งแต่ 1 - 100 ข้อ</p>
            </div>

            {/* 2. จำนวนตัวเลือก (3 ตัวเลือก หรือ 4 ตัวเลือก) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                จำนวนตัวเลือกต่อข้อ
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleChoiceCountChange(3)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    choiceCount === 3
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  3 ตัวเลือก
                </button>
                <button
                  type="button"
                  onClick={() => handleChoiceCountChange(4)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    choiceCount === 4
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  4 ตัวเลือก
                </button>
              </div>
            </div>

            {/* 3. รูปแบบตัวอักษร (ก กับ A) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                รูปแบบตัวเลือก
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChoiceLabelType('thai')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    choiceLabelType === 'thai'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  ก (ก, ข, ค{choiceCount === 4 ? ', ง' : ''})
                </button>
                <button
                  type="button"
                  onClick={() => setChoiceLabelType('latin')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    choiceLabelType === 'latin'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  A (A, B, C{choiceCount === 4 ? ', D' : ''})
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: กำหนดเฉลยข้อสอบ */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="font-heading font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>กำหนดเฉลยข้อสอบ (Answer Key Matrix)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  คลิกเลือกตัวเลือกที่ถูกต้องของแต่ละข้อได้ทันที
                </p>
              </div>
            </div>

            {/* 3 Columns Grid: ข้อเรียงลงมาตามแนวตั้ง */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white rounded-2xl border border-slate-200 max-h-[360px] overflow-y-auto">
              {columnQuestions.map((colQuestions, cIdx) => {
                if (colQuestions.length === 0) return null;

                return (
                  <div key={cIdx} className="space-y-2">
                    {colQuestions.map((qNum) => {
                      const currentChoice = answerKey[qNum];

                      return (
                        <div
                          key={qNum}
                          className="flex items-center justify-between p-2 bg-slate-50/70 hover:bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-indigo-300 transition-colors"
                        >
                          <span className="font-mono font-bold text-xs text-slate-700 w-8">
                            {String(qNum).padStart(2, '0')}.
                          </span>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: choiceCount }, (_, cIndex) => {
                              const isSelected = currentChoice === cIndex;
                              const label = currentLabels[cIndex];

                              return (
                                <button
                                  key={cIndex}
                                  type="button"
                                  onClick={() => handleSelectChoice(qNum, cIndex)}
                                  className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white shadow-xs scale-105'
                                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              ข้อสอบทั้งหมด <strong className="text-slate-800">{questionCount} ข้อ</strong> • รูปแบบ{' '}
              <strong className="text-slate-800">{choiceCount} ตัวเลือก ({currentLabels.join(', ')})</strong> •{' '}
              <strong className="text-slate-800">{gradeLevel}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{activeExam ? 'บันทึกการแก้ไข' : 'สร้างชุดกระดาษคำตอบ'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
