import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Exam, ScanResult, QuestionAnswer } from '../types';
import { omrScannerEngine } from '../services/omrScannerEngine';
import { storageService } from '../services/storageService';
import { useAuth } from '../services/authContext';
import { useToast } from '../services/toastContext';
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import {
  X,
  Camera,
  Upload,
  AlertCircle,
  Save,
  FileCheck,
  Sliders,
  User,
  RefreshCw,
  Zap,
  ZapOff,
  SwitchCamera,
  CheckCircle2,
  XCircle,
  QrCode,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam?: Exam | null; // Optional: If null, Universal QR Auto-Detect Mode is active!
  allExams?: Exam[];
  onScanSaved: (savedResult: ScanResult) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  exam: initialExam,
  allExams = [],
  onScanSaved,
}) => {
  const { currentUser } = useAuth();
  const { success, error, info } = useToast();

  // Active exam (auto-detected via QR code or initially provided)
  const [activeExam, setActiveExam] = useState<Exam | null>(initialExam || null);
  const [showExamPicker, setShowExamPicker] = useState(false);
  const [examsList, setExamsList] = useState<Exam[]>(allExams);

  // Camera state (Mobile Portrait First)
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // QR Real-time Detection
  const [lastDetectedQR, setLastDetectedQR] = useState<string | null>(null);
  const [qrDetectedNotice, setQrDetectedNotice] = useState<string | null>(null);

  // Scan outputs
  const [isProcessing, setIsProcessing] = useState(false);
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
    detectedQrExamTitle?: string;
  } | null>(null);

  // Student inputs
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [notes, setNotes] = useState('');

  // Sensitivity (Default 0.26 for optimal pencil & pen cross-mark detection)
  const [sensitivity, setSensitivity] = useState(0.26);
  const [showSensitivitySlider, setShowSensitivitySlider] = useState(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qrLoopRef = useRef<number | null>(null);
  const isScanningRef = useRef(false);

  // Load fresh exams list
  useEffect(() => {
    if (allExams.length > 0) {
      setExamsList(allExams);
    } else {
      setExamsList(storageService.getExams());
    }
  }, [allExams, isOpen]);

  // Synchronize initial exam when opened
  useEffect(() => {
    if (initialExam) {
      setActiveExam(initialExam);
    } else {
      // If none provided, start in Universal QR Auto-Detect Mode
      setActiveExam(null);
    }
  }, [initialExam, isOpen]);

  // Sound beep on QR detection
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  };

  // Start / Stop camera lifecycle
  useEffect(() => {
    if (isOpen) {
      setScanOutput(null);
      setStudentName('');
      setStudentId('');
      setQrDetectedNotice(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const stopCamera = () => {
    if (qrLoopRef.current) {
      window.cancelAnimationFrame(qrLoopRef.current);
      qrLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsTorchOn(false);
    setCameraActive(false);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('เบราว์เซอร์หรืออุปกรณ์นี้ไม่อนุญาตให้เปิดกล้องโดยตรง กรุณาเลือกอัปโหลดรูปภาพกระดาษคำตอบแทน');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920, min: 1080 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setCameraActive(true);

      // Check flashlight/torch capability
      const track = stream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        const caps = track.getCapabilities() as any;
        setHasTorch(!!caps.torch);
      } else {
        setHasTorch(false);
      }

      // Start continuous real-time QR code detection
      startQRScanningLoop();
    } catch (err: any) {
      console.warn('Camera access error', err);
      setCameraError('ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบสิทธิ์การใช้งานกล้องในเบราว์เซอร์ของคุณ หรืออัปโหลดไฟล์ภาพแทน');
      setCameraActive(false);
    }
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle failed', e);
    }
  };

  // Flip camera between environment and user
  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  /**
   * Continuous real-time QR code detection loop
   * Looks for exam QR codes in video frames and auto-matches the exam
   */
  const startQRScanningLoop = () => {
    let lastScanTime = 0;
    const qrCanvas = document.createElement('canvas');
    const qrCtx = qrCanvas.getContext('2d', { willReadFrequently: true });

    const scanFrame = (timestamp: number) => {
      if (!videoRef.current || !streamRef.current || isScanningRef.current) {
        qrLoopRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      // Check once every 160ms for low CPU usage & high responsiveness
      if (timestamp - lastScanTime >= 160 && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        lastScanTime = timestamp;
        const vid = videoRef.current;
        const w = vid.videoWidth;
        const h = vid.videoHeight;

        if (w > 0 && h > 0 && qrCtx) {
          // Downsample for blazing fast QR code detection (width ~480px)
          const scale = Math.min(1.0, 480 / w);
          const cw = Math.round(w * scale);
          const ch = Math.round(h * scale);
          qrCanvas.width = cw;
          qrCanvas.height = ch;

          qrCtx.drawImage(vid, 0, 0, cw, ch);
          const imgData = qrCtx.getImageData(0, 0, cw, ch);
          const code = jsQR(imgData.data, cw, ch, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data && code.data !== lastDetectedQR) {
            handleDetectedQRCode(code.data);
          }
        }
      }

      qrLoopRef.current = requestAnimationFrame(scanFrame);
    };

    qrLoopRef.current = requestAnimationFrame(scanFrame);
  };

  // Handle detected QR payload
  const handleDetectedQRCode = useCallback(
    (rawData: string) => {
      try {
        setLastDetectedQR(rawData);
        let examId = '';
        let examTitle = '';

        try {
          const parsed = JSON.parse(rawData);
          examId = parsed.id || '';
          examTitle = parsed.title || '';
        } catch {
          examId = rawData;
        }

        // Match against existing exams
        const freshList = storageService.getExams();
        const matched = freshList.find(
          (e) => (examId && e.id === examId) || (examTitle && e.title.trim() === examTitle.trim())
        );

        if (matched) {
          setActiveExam(matched);
          setQrDetectedNotice(`วิชา: ${matched.title} (${matched.questionCount} ข้อ)`);
          playBeep();
          if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
        }
      } catch (e) {
        console.warn('QR parse notice', e);
      }
    },
    [examsList]
  );

  /**
   * Process and Score the OMR Sheet
   */
  const handleProcessImage = async (imageSource: HTMLImageElement | HTMLCanvasElement) => {
    try {
      setIsProcessing(true);
      isScanningRef.current = true;

      // 1. If activeExam is not selected yet, scan image for embedded QR code first!
      let targetExam = activeExam;
      if (!targetExam) {
        const qrInfo = omrScannerEngine.readQRCode(imageSource);
        if (qrInfo) {
          const freshExams = storageService.getExams();
          const matched = freshExams.find(
            (e) => (qrInfo.examId && e.id === qrInfo.examId) || (qrInfo.title && e.title === qrInfo.title)
          );
          if (matched) {
            targetExam = matched;
            setActiveExam(matched);
          }
        }
      }

      // If still no exam matched, default to the most recent exam or prompt user
      if (!targetExam) {
        const freshExams = storageService.getExams();
        if (freshExams.length > 0) {
          targetExam = freshExams[0];
          setActiveExam(targetExam);
        } else {
          error('ไม่พบชุดข้อสอบในระบบ', 'กรุณาสร้างชุดข้อสอบอย่างน้อย 1 ชุดก่อนทำการตรวจ');
          setIsProcessing(false);
          isScanningRef.current = false;
          return;
        }
      }

      // 2. Run OMR analysis with pencil & pen cross-mark recognition
      const result = await omrScannerEngine.processSheetImage(imageSource, targetExam, {
        sensitivity,
      });

      if (!result.success) {
        error('ตรวจกระดาษคำตอบไม่สำเร็จ', result.errorMessage || 'กรุณาลองจัดมุมกล้องใหม่ให้เห็นจุดมาร์กมุมครบทั้ง 4 มุม');
        return;
      }

      // 3. Set scan output
      setScanOutput({
        score: result.score,
        total: result.totalQuestions,
        pct: result.scorePercentage,
        passed: result.passed,
        answers: result.answers,
        annotatedUrl: result.annotatedImageUrl,
        originalUrl: result.originalImageUrl,
        imageSizeBytes: Math.round(result.annotatedImageUrl.length * 0.75),
        isDeSkewed: result.isDeSkewed,
        detectedQrExamTitle: targetExam.title,
      });

      // Play success feedback
      if (result.passed) {
        confetti({
          particleCount: 40,
          spread: 55,
          origin: { y: 0.6 },
        });
      }

      success(
        `ตรวจข้อสอบเสร็จสิ้น: ${result.score}/${result.totalQuestions} คะแนน`,
        `${targetExam.title} • คิดเป็น ${result.scorePercentage}% (${result.passed ? 'ผ่าน' : 'ไม่ผ่าน'})`
      );
    } catch (err: any) {
      console.error('Scan processing error', err);
      error('เกิดข้อผิดพลาดในการประมวลผลภาพ', err?.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsProcessing(false);
      isScanningRef.current = false;
    }
  };

  /**
   * Capture from video stream and scan
   */
  const handleCaptureFromCamera = () => {
    if (!videoRef.current || !cameraActive) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    handleProcessImage(canvas);
  };

  /**
   * Handle File Upload
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        handleProcessImage(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /**
   * Save the scan result
   */
  const handleSaveResult = async () => {
    if (!scanOutput || !activeExam) return;

    const newResult: ScanResult = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      examId: activeExam.id,
      examTitle: activeExam.title,
      studentName: studentName.trim() || 'ไม่ระบุชื่อ',
      studentId: studentId.trim() || '-',
      studentClass: activeExam.gradeLevel || '',
      totalQuestions: scanOutput.total,
      correctCount: scanOutput.score,
      score: scanOutput.score,
      scorePercentage: scanOutput.pct,
      passed: scanOutput.passed,
      answers: scanOutput.answers,
      scannedImageUrl: scanOutput.originalUrl,
      annotatedImageUrl: scanOutput.annotatedUrl,
      imageSizeBytes: scanOutput.imageSizeBytes,
      scannedAt: new Date().toISOString(),
      scannedByEmail: currentUser?.username || 'admin',
      notes: notes.trim() || undefined,
    };

    await storageService.addScanResult(newResult);
    onScanSaved(newResult);
    success('บันทึกผลการตรวจเรียบร้อย', `บันทึกคะแนน ${newResult.studentName} สำเร็จ`);

    // Reset to scan next sheet immediately!
    handleScanNextSheet();
  };

  /**
   * Reset output to scan next sheet
   */
  const handleScanNextSheet = () => {
    setScanOutput(null);
    setStudentName('');
    setStudentId('');
    setNotes('');
    setLastDetectedQR(null);
    if (!cameraActive) {
      startCamera();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden select-none">
      {/* 1. Mobile Portrait Top Floating Control Bar */}
      <header className="h-14 sm:h-16 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0 z-40 text-white">
        {/* Left: Close Button */}
        <button
          onClick={onClose}
          className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer"
          title="ปิดหน้าต่างสแกน"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Center: Active Exam Selector / Auto-detect Pill */}
        <div className="relative flex-1 max-w-xs sm:max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setShowExamPicker(!showExamPicker)}
            className="w-full flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-xs text-white shadow-xs cursor-pointer transition-all"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {activeExam ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                  <span className="font-bold truncate max-w-[170px] sm:max-w-[220px]">
                    {activeExam.title}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    ({activeExam.questionCount} ข้อ)
                  </span>
                </>
              ) : (
                <>
                  <QrCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="font-semibold text-slate-200 truncate">
                    ตรวจจับ QR ทุกวิชาอัตโนมัติ
                  </span>
                </>
              )}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {/* Exam Picker Dropdown */}
          {showExamPicker && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl z-50 max-h-64 overflow-y-auto">
              <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 flex items-center justify-between">
                <span>เลือกชุดข้อสอบ หรือให้ตรวจจับจาก QR</span>
              </div>

              {/* Auto-detect option */}
              <button
                type="button"
                onClick={() => {
                  setActiveExam(null);
                  setShowExamPicker(false);
                  info('โหมดตรวจจับ QR อัตโนมัติ', 'จ่อกล้องไปที่กระดาษคำตอบวิชาใดก็ได้ ระบบจะตรวจจับเฉลยให้อัตโนมัติ');
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer mb-1 ${
                  !activeExam ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <div className="flex-1">
                  <div>ตรวจจับวิชาจาก QR อัตโนมัติ (ตรวจได้ทุกวิชา)</div>
                  <div className="text-[10px] opacity-75">ไม่ต้องเลือกวิชา สแกนวิชาไหนก็ตรวจได้ทันที</div>
                </div>
              </button>

              {/* List of exams */}
              <div className="space-y-1">
                {examsList.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => {
                      setActiveExam(ex);
                      setShowExamPicker(false);
                      setQrDetectedNotice(`วิชา: ${ex.title}`);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      activeExam?.id === ex.id
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate pr-2">{ex.title}</span>
                    <span className="text-[10px] opacity-80 shrink-0 font-mono">
                      {ex.questionCount} ข้อ
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Camera Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Torch Toggle */}
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isTorchOn ? 'bg-amber-500 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title={isTorchOn ? 'ปิดแฟลช' : 'เปิดแฟลช'}
            >
              {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          {/* Switch Camera */}
          <button
            onClick={handleSwitchCamera}
            className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="สลับกล้องหน้า/หลัง"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          {/* File Upload Trigger */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="เลือกภาพจากคลังรูปภาพ"
          >
            <Upload className="w-4 h-4" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
        </div>
      </header>

      {/* 2. Main Viewport Area (Mobile Portrait Viewfinder) */}
      <main className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        {/* Live Camera Video (Strictly vertical & portrait responsive) */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover sm:object-contain bg-black"
          playsInline
          muted
          autoPlay
        />

        {/* Camera Error Message */}
        {cameraError && (
          <div className="absolute inset-4 z-30 flex flex-col items-center justify-center bg-slate-900/90 rounded-3xl p-6 text-center text-white border border-rose-500/40">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
            <h3 className="font-heading font-bold text-base mb-1">ไม่สามารถเปิดกล้องได้</h3>
            <p className="text-xs text-slate-300 mb-4 max-w-sm">{cameraError}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Upload className="w-4 h-4" />
              <span>เลือกรูปภาพกระดาษคำตอบจากเครื่อง</span>
            </button>
          </div>
        )}

        {/* Heads-Up Display (HUD): 4 Corner Brackets & QR Target Box */}
        {cameraActive && !scanOutput && !cameraError && (
          <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 sm:p-8">
            {/* Top QR Target Reticle (Right upper quadrant where QR code lives) */}
            <div className="flex justify-end pt-2 pr-2">
              <div className="flex flex-col items-center gap-1 bg-black/45 backdrop-blur-xs p-1.5 rounded-xl border border-indigo-400/50 shadow-lg">
                <div className="w-16 h-16 border-2 border-dashed border-indigo-400 rounded-lg flex items-center justify-center animate-pulse">
                  <QrCode className="w-8 h-8 text-indigo-300 opacity-80" />
                </div>
                <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-tight">
                  กรอบเล็ง QR Code
                </span>
              </div>
            </div>

            {/* 4 Corner Registration Fiducial Markers Overlay */}
            <div className="absolute inset-6 sm:inset-12 border-2 border-emerald-500/20 rounded-2xl pointer-events-none">
              {/* Corner 1: Top-Left */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg shadow-sm" />
              {/* Corner 2: Top-Right */}
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg shadow-sm" />
              {/* Corner 3: Bottom-Left */}
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg shadow-sm" />
              {/* Corner 4: Bottom-Right */}
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg shadow-sm" />
            </div>

            {/* Animated Laser Scanning Beam */}
            <div className="absolute inset-x-8 top-16 bottom-24 pointer-events-none overflow-hidden">
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-[bounce_3s_infinite]" />
            </div>

            {/* Real-time Guidance Banner */}
            <div className="flex justify-center pb-2 z-20">
              <div className="bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700/80 text-white text-xs font-medium flex items-center gap-2 shadow-lg">
                {qrDetectedNotice ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 font-bold truncate max-w-xs">
                      {qrDetectedNotice}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>วางกระดาษให้ตรงกรอบ • รองรับกากบาททั้งดินสอและปากกา</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center animate-spin mb-4">
              <RefreshCw className="w-7 h-7 text-indigo-400" />
            </div>
            <h4 className="font-heading font-bold text-lg mb-1">กำลังตรวจกระดาษคำตอบ...</h4>
            <p className="text-xs text-slate-300 text-center max-w-xs">
              วิเคราะห์รอยกากบาทดินสอ/ปากกา และคำนวณคะแนนตามเฉลยข้อสอบ
            </p>
          </div>
        )}

        {/* 3. Scan Result Drawer (Slides Up Seamlessly on Mobile) */}
        {scanOutput && (
          <div className="absolute inset-0 z-30 bg-slate-950/95 overflow-y-auto flex flex-col p-4 sm:p-6 text-white animate-in fade-in slide-in-from-bottom duration-200">
            <div className="max-w-md w-full mx-auto space-y-4 my-auto">
              {/* Result Header Badge */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">ผลการตรวจ OMR</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        scanOutput.passed
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {scanOutput.passed ? 'ผ่านเกณฑ์' : 'ไม่ผ่าน'}
                    </span>
                  </div>
                  <h3 className="font-heading font-black text-xl text-white mt-1">
                    {activeExam?.title || 'กระดาษคำตอบ'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    ตอบถูก {scanOutput.score} จาก {scanOutput.total} ข้อ ({scanOutput.pct}%)
                  </p>
                </div>

                {/* Circular Score Badge */}
                <div
                  className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex flex-col items-center justify-center border-2 shrink-0 ${
                    scanOutput.passed
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-rose-500 bg-rose-500/10 text-rose-400'
                  }`}
                >
                  <span className="font-heading font-black text-xl sm:text-2xl leading-none">
                    {scanOutput.score}
                  </span>
                  <span className="text-[10px] font-mono opacity-80 mt-0.5">
                    /{scanOutput.total}
                  </span>
                </div>
              </div>

              {/* Scanned Visual Image Preview */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-h-48 sm:max-h-56 flex items-center justify-center relative shadow-inner">
                <img
                  src={scanOutput.annotatedUrl}
                  alt="Scanned Sheet"
                  className="max-h-48 sm:max-h-56 w-auto object-contain"
                />
                <div className="absolute bottom-2 left-2 right-2 bg-slate-950/80 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] text-slate-300 flex items-center justify-between">
                  <span>กรอบเขียว (✓) = ถูก | กรอบแดง (X) = ผิด</span>
                  <span className="text-emerald-400 font-semibold">ตรวจจับตรงจุด</span>
                </div>
              </div>

              {/* Student Identification Form */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>ข้อมูลนักเรียนที่สอบ</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ชื่อ - สกุล:</label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="ระบุชื่อผู้เข้าสอบ..."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">เลขที่:</label>
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="ระบุเลขที่..."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons: Save & Scan Next */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleSaveResult}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>บันทึกผลสอบ</span>
                </button>

                <button
                  type="button"
                  onClick={handleScanNextSheet}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all border border-slate-700"
                  title="ตรวจแผ่นถัดไปทันที"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">สแกนแผ่นถัดไป</span>
                  <span className="sm:hidden">แผ่นถัดไป</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. Bottom Action Bar (Shutter / Trigger on Mobile) */}
      {!scanOutput && (
        <footer className="h-20 sm:h-24 bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 px-4 flex items-center justify-between gap-4 shrink-0 z-40 text-white max-w-lg mx-auto w-full">
          {/* Left: Gallery Upload */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 p-2 text-slate-400 hover:text-white transition-colors cursor-pointer w-16"
          >
            <Upload className="w-5 h-5" />
            <span className="text-[10px]">คลังภาพ</span>
          </button>

          {/* Center: Big Mobile Shutter Button */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={handleCaptureFromCamera}
              disabled={isProcessing || !cameraActive}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 text-white shadow-xl shadow-emerald-900/50 flex items-center justify-center border-4 border-slate-900 cursor-pointer transition-all"
            >
              <Camera className="w-7 h-7 sm:w-8 sm:h-8" />
            </button>
            <span className="text-[10px] text-slate-400 mt-1 font-semibold">
              กดสแกนตรวจ
            </span>
          </div>

          {/* Right: Sensitivity Settings */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSensitivitySlider(!showSensitivitySlider)}
              className="flex flex-col items-center justify-center gap-1 p-2 text-slate-400 hover:text-white transition-colors cursor-pointer w-16"
            >
              <Sliders className="w-5 h-5" />
              <span className="text-[10px]">ความไว</span>
            </button>

            {/* Sensitivity Slider Popover */}
            {showSensitivitySlider && (
              <div className="absolute bottom-full right-0 mb-3 w-56 bg-slate-900 border border-slate-700 rounded-2xl p-3.5 shadow-2xl z-50 text-white text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-200">ความไวตรวจกากบาท</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {Math.round(sensitivity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.15"
                  max="0.45"
                  step="0.02"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>ดินสอจาง</span>
                  <span>ปากกาเข้ม</span>
                </div>
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};
