import React, { useState, useRef, useEffect } from 'react';
import { Exam, ScanResult, QuestionAnswer } from '../types';
import { omrScannerEngine } from '../services/omrScannerEngine';
import { storageService } from '../services/storageService';
import { useAuth } from '../services/authContext';
import { useToast } from '../services/toastContext';
import confetti from 'canvas-confetti';
import {
  X,
  Camera,
  Upload,
  AlertCircle,
  Save,
  Eye,
  Sliders,
  User,
  RefreshCw,
} from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  onScanSaved: (savedResult: ScanResult) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  exam,
  onScanSaved,
}) => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();

  // Always default to camera mode on open
  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Scan outputs
  const [scanOutput, setScanOutput] = useState<{
    score: number;
    total: number;
    pct: number;
    passed: boolean;
    answers: QuestionAnswer[];
    annotatedUrl: string;
    originalUrl: string;
    imageSizeBytes: number;
    isDeSkewed?: boolean;
  } | null>(null);

  // Student inputs
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentClass, setStudentClass] = useState(exam.gradeLevel || 'ป.1');
  const [notes, setNotes] = useState('');

  // Sensitivity (Default 0.28 for flexible X-cross and stroke recognition)
  const [sensitivity, setSensitivity] = useState(0.28);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Every time modal is opened, activate camera as default
  useEffect(() => {
    if (isOpen) {
      setMode('camera');
      setScanOutput(null);
      setStudentName('');
      setStudentId('');
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.warn('High res camera failed, falling back to basic camera', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play();
        }
        setCameraActive(true);
      } catch (e) {
        console.error('Camera access completely denied', e);
        setCameraError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้องบนเบราว์เซอร์ หรือเลือกภาพจากเครื่องแทน');
        setCameraActive(false);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleCaptureFromCamera = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setIsProcessing(true);
    try {
      await processImageCanvas(canvas);
      stopCamera();
    } catch (err: any) {
      error('เกิดข้อผิดพลาดในการประมวลผลกล้อง', err?.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    setIsProcessing(true);
    try {
      const img = await omrScannerEngine.fileToImage(file);
      await processImageCanvas(img, file.size);
    } catch (err: any) {
      error('ไม่สามารถประมวลผลไฟล์ภาพได้', err?.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const processImageCanvas = async (
    imgSource: HTMLImageElement | HTMLCanvasElement,
    sizeBytes?: number
  ) => {
    const result = await omrScannerEngine.processSheetImage(imgSource, exam, { sensitivity });

    if (!result.success) {
      error('การตรวจจับกระดาษคำตอบล้มเหลว', result.errorMessage);
      return;
    }

    const approxSize = sizeBytes || 150000;

    setScanOutput({
      score: result.score,
      total: result.totalQuestions,
      pct: result.scorePercentage,
      passed: result.passed,
      answers: result.answers,
      annotatedUrl: result.annotatedImageUrl,
      originalUrl: result.originalImageUrl,
      imageSizeBytes: approxSize,
      isDeSkewed: result.isDeSkewed,
    });

    if (result.passed) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

  const handleSaveResult = () => {
    if (!scanOutput) return;

    if (!studentName.trim()) {
      error('กรุณาระบุชื่อ-นามสกุลนักเรียน');
      return;
    }

    const newResult: ScanResult = {
      id: 'scan_' + Math.random().toString(36).substring(2, 9),
      examId: exam.id,
      examTitle: exam.title,
      studentName: studentName.trim(),
      studentId: studentId.trim() || 'STD-' + Math.floor(1000 + Math.random() * 9000),
      studentClass: studentClass.trim() || exam.gradeLevel || '',
      totalQuestions: scanOutput.total,
      correctCount: scanOutput.score,
      score: scanOutput.score,
      scorePercentage: scanOutput.pct,
      passed: scanOutput.passed,
      answers: scanOutput.answers,
      scannedImageUrl: scanOutput.originalUrl || scanOutput.annotatedUrl,
      annotatedImageUrl: scanOutput.annotatedUrl,
      imageSizeBytes: scanOutput.imageSizeBytes,
      scannedAt: new Date().toISOString(),
      scannedByEmail: currentUser?.email || 'admin',
      notes: notes.trim(),
    };

    storageService.addScanResult(newResult);
    onScanSaved(newResult);
    success(
      'บันทึกผลการตรวจเรียบร้อย',
      `${newResult.studentName} ทำได้ ${newResult.score}/${newResult.totalQuestions} ข้อ (${newResult.scorePercentage}%)`
    );

    setScanOutput(null);
    setStudentName('');
    setStudentId('');
    setMode('camera');
    startCamera();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 no-print animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base sm:text-lg text-slate-800 leading-tight">
                สแกนตรวจข้อสอบ (OMR Scanner)
              </h3>
              <p className="text-xs text-slate-500">
                วิชา: <strong className="text-slate-800">{exam.title}</strong>{' '}
                {exam.gradeLevel ? `[${exam.gradeLevel}]` : ''} • {exam.questionCount} ข้อ ({exam.choiceCount} ตัวเลือก)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1 bg-white">
          {/* If scanOutput is ready, show Results & Student Form */}
          {scanOutput ? (
            <div className="space-y-5 animate-fadeIn">
              {/* Score Highlight Banner - แสดงชัดเจน: ทำได้ X ข้อ จากทั้งหมด Y ข้อ */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                  scanOutput.passed
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50/80 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center gap-3.5 text-center sm:text-left">
                  <div
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex flex-col items-center justify-center font-bold shadow-xs shrink-0 ${
                      scanOutput.passed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    <span className="text-xl sm:text-2xl font-mono leading-none">
                      {scanOutput.score}/{scanOutput.total}
                    </span>
                    <span className="text-[10px] sm:text-xs opacity-90 mt-1">ข้อ</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                      <h4 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900">
                        ทำได้ {scanOutput.score} ข้อ จากทั้งหมด {scanOutput.total} ข้อ ({scanOutput.score}/{scanOutput.total})
                      </h4>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          scanOutput.passed
                            ? 'bg-emerald-200 text-emerald-900'
                            : 'bg-rose-200 text-rose-900'
                        }`}
                      >
                        {scanOutput.passed ? 'ผ่านเกณฑ์ ✅' : 'ไม่ผ่านเกณฑ์ ❌'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      คิดเป็น <strong>{scanOutput.pct}%</strong> • ตอบถูก <strong>{scanOutput.score} ข้อ</strong> • ตอบผิด/เว้นว่าง{' '}
                      <strong>{scanOutput.total - scanOutput.score} ข้อ</strong> (เกณฑ์ผ่าน {exam.passPercentage}%)
                      {scanOutput.isDeSkewed && (
                        <span className="ml-2 inline-block text-[11px] text-emerald-700 font-semibold">
                          ✓ ปรับระนาบองศาเอียงอัตโนมัติ
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setScanOutput(null);
                      setMode('camera');
                      startCamera();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                    <span>สแกนใบถัดไป</span>
                  </button>
                </div>
              </div>

              {/* Grid: Preview Visual Image + Student Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Visual Annotated Image */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      ภาพผลตรวจกระดาษคำตอบ (OMR Result)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      กรอบเขียว = ถูก (✓), กรอบแดง = ผิด
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-900 max-h-[340px] flex items-center justify-center p-2 shadow-inner">
                    <img
                      src={scanOutput.annotatedUrl}
                      alt="Scanned Sheet Result"
                      className="max-h-[320px] w-auto object-contain rounded-lg shadow-md"
                    />
                  </div>
                </div>

                {/* Student Info Inputs Form */}
                <div className="space-y-3.5 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
                  <h4 className="font-heading font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-indigo-600" />
                    กรอกข้อมูลนักเรียนเพื่อบันทึกผลคะแนน
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ชื่อ - นามสกุล นักเรียน <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="เช่น ด.ช. ธนกร พลอยดี"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        เลขประจำตัวนักเรียน
                      </label>
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="เช่น 50124"
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        ชั้น / ห้องเรียน
                      </label>
                      <input
                        type="text"
                        value={studentClass}
                        onChange={(e) => setStudentClass(e.target.value)}
                        placeholder="เช่น ป.1 หรือ ม.3/1"
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      หมายเหตุเพิ่มเติม (ถ้ามี)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="เช่น สอบกลางภาค หรือ สอบแก้ตัว"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Save button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveResult}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>บันทึกผลสอบ (ทำได้ {scanOutput.score}/{scanOutput.total} ข้อ)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Question Breakdown Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-600">
                  รายละเอียดรายข้อ: ทำได้ {scanOutput.score} ข้อ จากทั้งหมด {scanOutput.total} ข้อ ({scanOutput.score}/{scanOutput.total})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[160px] overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {scanOutput.answers.map((ans) => {
                    const thaiLabels = ['ก', 'ข', 'ค', 'ง', 'จ'];
                    const latinLabels = ['A', 'B', 'C', 'D', 'E'];
                    const choiceLabels = exam.choiceLabelType === 'latin'
                      ? latinLabels.slice(0, exam.choiceCount)
                      : thaiLabels.slice(0, exam.choiceCount);

                    const studentAnsText = ans.selectedChoice !== null ? choiceLabels[ans.selectedChoice] : 'ไม่ตอบ';
                    const correctAnsText = choiceLabels[ans.correctChoice];

                    return (
                      <div
                        key={ans.questionNumber}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                          ans.isCorrect
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                      >
                        <span className="font-bold">ข้อ {ans.questionNumber}</span>
                        <span>
                          {studentAnsText}{' '}
                          {!ans.isCorrect && <span className="opacity-70 font-mono">({correctAnsText})</span>}
                        </span>
                        <span>{ans.isCorrect ? '✅' : '❌'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Live Camera First (ตัดแถบทดสอบระบบออกทั้งหมดตามคำขอ) */
            <div className="space-y-4">
              {/* Method Switcher Header (กล้องถ่ายภาพเป็นค่าเริ่มต้น) */}
              <div className="flex items-center justify-between gap-2 pb-1">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('camera');
                      startCamera();
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      mode === 'camera'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    <span>กล้องถ่ายภาพ (ค่าเริ่มต้น)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setMode('upload');
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      mode === 'upload'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>เลือกรูปภาพจากเครื่อง</span>
                  </button>
                </div>

                <div className="text-[11px] text-emerald-700 font-medium hidden sm:flex items-center gap-1">
                  <span>📐 ตรวจจับและปรับมุมเอียงอัตโนมัติ</span>
                </div>
              </div>

              {/* Camera Mode */}
              {mode === 'camera' && (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-[460px] flex items-center justify-center border-2 border-slate-800 shadow-lg">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Viewfinder Overlay with 4 Corner Fiducial Brackets */}
                    <div className="absolute inset-5 sm:inset-8 border-2 border-dashed border-emerald-400/90 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                      <div className="flex justify-between text-emerald-300 text-[11px] font-mono">
                        <span className="bg-black/60 px-2 py-0.5 rounded">┌ มุมบนซ้าย</span>
                        <span className="bg-black/60 px-2 py-0.5 rounded">มุมบนขวา ┐</span>
                      </div>

                      <div className="text-center text-white text-xs bg-black/65 py-1.5 px-4 rounded-full backdrop-blur-xs mx-auto shadow-md">
                        วางกระดาษให้อยู่ในกรอบ • แม้ถ่ายเอียงระบบจะชดเชยระนาบให้อัตโนมัติ
                      </div>

                      <div className="flex justify-between text-emerald-300 text-[11px] font-mono">
                        <span className="bg-black/60 px-2 py-0.5 rounded">└ มุมล่างซ้าย</span>
                        <span className="bg-black/60 px-2 py-0.5 rounded">มุมล่างขวา ┘</span>
                      </div>
                    </div>

                    {cameraError && (
                      <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center text-rose-300 space-y-3">
                        <AlertCircle className="w-10 h-10 text-rose-400" />
                        <div>
                          <p className="text-sm font-semibold text-white">ไม่สามารถเปิดกล้องได้ (Camera Permission Denied)</p>
                          <p className="text-xs text-slate-300 mt-1 max-w-md">
                            เบราว์เซอร์หรืออุปกรณ์ไม่อนุญาตให้เข้าถึงกล้องในสภาพแวดล้อมนี้ คุณสามารถเลือกอัปโหลดรูปภาพกระดาษคำตอบจากเครื่องแทนได้ทันที
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                          <button
                            onClick={() => {
                              stopCamera();
                              setMode('upload');
                            }}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md transition-colors"
                          >
                            📁 เลือกอัปโหลดรูปภาพจากเครื่อง
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center pt-2">
                    <button
                      type="button"
                      disabled={isProcessing || !cameraActive}
                      onClick={handleCaptureFromCamera}
                      className="flex items-center justify-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-200 transition-all cursor-pointer disabled:opacity-50 w-full sm:w-auto"
                    >
                      <Camera className="w-5 h-5" />
                      <span>{isProcessing ? 'กำลังตรวจและชดเชยความเอียง...' : 'ถ่ายภาพและตรวจทันที'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Mode */}
              {mode === 'upload' && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/60 hover:bg-indigo-50/20 rounded-3xl p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-colors">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-base text-slate-800">
                      คลิกเพื่อเลือกไฟล์ หรือ ลากรูปภาพกระดาษคำตอบมาวางที่นี่
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      รองรับไฟล์ภาพ JPG, PNG, WebP (ระบบจะตรวจจับมุมเอียงอัตโนมัติ)
                    </p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-xs">
                    เลือกรูปภาพจากเครื่อง
                  </div>
                </div>
              )}

              {/* Sensitivity adjustment */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-slate-700">
                    ความไวตรวจจับกากบาท/รอยขีด (Sensitivity):
                  </span>
                  <span className="font-mono text-emerald-600 font-bold">
                    {Math.round(sensitivity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.15}
                  max={0.50}
                  step={0.03}
                  value={sensitivity}
                  onChange={(e) => setSensitivity(Number(e.target.value))}
                  className="w-44 accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
