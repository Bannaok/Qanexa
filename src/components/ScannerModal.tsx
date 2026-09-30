import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Exam, ScanResult, QuestionAnswer } from '../types';
import { omrScannerEngine, ParsedQRExam, FrameQualityEvaluation } from '../services/omrScannerEngine';
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
  ChevronUp,
  ListOrdered,
  Check,
  AlertTriangle,
  Lock,
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
  // Default to false: user explicitly presses the shutter button after validating green frame
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);

  // State to toggle detailed question-by-question answer key breakdown
  const [showAnswersList, setShowAnswersList] = useState(true);

  // Camera shutter snap flash animation state
  const [isShutterFlashing, setIsShutterFlashing] = useState(false);

  // Real-time camera quality & 4 corner fiducials detection state (Green vs Red)
  const [frameQuality, setFrameQuality] = useState<FrameQualityEvaluation | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qrLoopRef = useRef<number | null>(null);
  const isScanningRef = useRef(false);
  const isProcessingRef = useRef(false);
  const lastAutoTriggerTimeRef = useRef(0);
  const consecutiveGreenFramesRef = useRef(0);
  const matchedExamRef = useRef<Exam | null>(initialExam || null);
  const prevGreenRef = useRef(false);

  // Load fresh exams list
  useEffect(() => {
    if (allExams.length > 0) {
      setExamsList(allExams);
    } else {
      setExamsList(storageService.getAllExamsRaw());
    }
  }, [allExams, isOpen]);

  // Synchronize initial exam when opened
  useEffect(() => {
    if (initialExam) {
      setActiveExam(initialExam);
      matchedExamRef.current = initialExam;
    } else {
      // If none provided, start in Universal QR Auto-Detect Mode
      setActiveExam(null);
      matchedExamRef.current = null;
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

  // Ultra-crisp camera shutter sound (dual mechanical clicks via AudioContext)
  const playShutterSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Click 1: Mirror lift
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(320, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.04);
      gain1.gain.setValueAtTime(0.25, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.045);

      // Click 2: Curtain snap
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1400, ctx.currentTime);
          osc2.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.06);
          gain2.gain.setValueAtTime(0.2, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.065);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.065);
        } catch {}
      }, 45);
    } catch {}
  };

  // Subtle ready chime when frame turns from red to green
  const playReadySound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.09); // A5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  };

  // Pleasant score evaluation result chime
  const playResultChime = (passed: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = passed ? [523.25, 659.25, 783.99, 1046.5] : [440, 392, 349.23];
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
            osc.start();
            osc.stop(ctx.currentTime + 0.16);
          } catch {}
        }, idx * 65);
      });
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
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
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
   * Continuous real-time QR code & frame quality detection loop
   * Evaluates paper boundaries (4 fiducials, blur, lighting) and matches exams
   */
  const startQRScanningLoop = () => {
    let lastScanTime = 0;

    const scanFrame = async (timestamp: number) => {
      if (!videoRef.current || !streamRef.current || isScanningRef.current || isProcessingRef.current) {
        qrLoopRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      // Check once every 120ms for ultra-responsive feedback
      if (timestamp - lastScanTime >= 120 && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        lastScanTime = timestamp;
        const vid = videoRef.current;
        const w = vid.videoWidth;
        const h = vid.videoHeight;

        if (w > 0 && h > 0) {
          try {
            // 1. Real-time Frame Quality & 4 Corner Fiducials evaluation (Green vs Red)
            const quality = omrScannerEngine.evaluateFrameQuality(vid);
            setFrameQuality(quality);

            // Audio & Haptic indicator when transitioning into GREEN (Ready) state
            const isGreenNow = quality.isReady && quality.statusColor === 'green';
            if (isGreenNow && !prevGreenRef.current) {
              playReadySound();
              if (navigator.vibrate) navigator.vibrate(25);
            }
            prevGreenRef.current = isGreenNow;

            // 2. Read QR Code for exam detection & answer key versioning
            const qrInfo = await omrScannerEngine.readQRCodeFast(vid);
            let currentTargetExam = activeExam || matchedExamRef.current;

            if (qrInfo && qrInfo.rawData) {
              setLastDetectedQR(qrInfo.rawData);
              const freshList = storageService.getAllExamsRaw();
              const examId = qrInfo.examId;
              const examTitle = qrInfo.title;

              const matched = freshList.find(
                (e) =>
                  (examId && (e.id === examId || e.id.toLowerCase() === examId.toLowerCase())) ||
                  (examTitle && e.title.trim().toLowerCase() === examTitle.trim().toLowerCase())
              );

              if (matched) {
                currentTargetExam = matched;
                matchedExamRef.current = matched;
                setActiveExam(matched);
                const gradeText = matched.gradeLevel || qrInfo.gradeLevel || '';
                setQrDetectedNotice(`วิชา: ${matched.title}${gradeText ? ` (${gradeText})` : ''} • ${matched.questionCount} ข้อ`);
              }
            }

            // 3. Auto-Scan execution:
            // MUST be green (quality.isReady === true), meaning all 4 fiducials found, sharp, not blurry, well-lit
            if (autoScanEnabled && !isProcessingRef.current && !scanOutput) {
              if (quality.isReady) {
                consecutiveGreenFramesRef.current += 1;

                // Require 2 consecutive green frames (~240ms of steady focus)
                if (consecutiveGreenFramesRef.current >= 2) {
                  const now = Date.now();
                  if (now - lastAutoTriggerTimeRef.current >= 1200) {
                    lastAutoTriggerTimeRef.current = now;
                    consecutiveGreenFramesRef.current = 0;

                    if (videoRef.current && videoRef.current.videoWidth > 0) {
                      playBeep();
                      if (navigator.vibrate) navigator.vibrate([40, 30, 40]);

                      const video = videoRef.current;
                      const canvas = document.createElement('canvas');
                      canvas.width = video.videoWidth;
                      canvas.height = video.videoHeight;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        await handleProcessImage(canvas, currentTargetExam || undefined);
                      }
                    }
                  }
                }
              } else {
                consecutiveGreenFramesRef.current = 0;
              }
            }
          } catch (e) {
            // ignore scan frame glitch
          }
        }
      }

      qrLoopRef.current = requestAnimationFrame(scanFrame);
    };

    qrLoopRef.current = requestAnimationFrame(scanFrame);
  };

  // Handle detected QR payload
  const handleDetectedQRCode = useCallback(
    async (qrInfo: ParsedQRExam) => {
      try {
        const rawData = qrInfo.rawData;
        setLastDetectedQR(rawData);

        // Match against ALL created exams in system
        const freshList = storageService.getAllExamsRaw();
        const examId = qrInfo.examId;
        const examTitle = qrInfo.title;

        const matched = freshList.find(
          (e) =>
            (examId && (e.id === examId || e.id.toLowerCase() === examId.toLowerCase())) ||
            (examTitle && e.title.trim().toLowerCase() === examTitle.trim().toLowerCase())
        );

        if (matched) {
          setActiveExam(matched);
          matchedExamRef.current = matched;
          const gradeText = matched.gradeLevel || qrInfo.gradeLevel || '';
          setQrDetectedNotice(`ตรวจพบวิชา: ${matched.title}${gradeText ? ` (${gradeText})` : ''} (${matched.questionCount} ข้อ)`);
        }
      } catch (e) {
        console.warn('QR parse notice', e);
      }
    },
    []
  );

  /**
   * Process and Score the OMR Sheet
   */
  const handleProcessImage = async (
    imageSource: HTMLImageElement | HTMLCanvasElement,
    overrideExam?: Exam
  ) => {
    if (isProcessingRef.current) return;
    try {
      setIsProcessing(true);
      isProcessingRef.current = true;
      isScanningRef.current = true;

      // Snappy non-blocking UI: yield 10ms to let the shutter flash render smoothly
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 1. Scan image for embedded QR code first to identify the subject!
      // This allows scanning ANY exam on the main screen since each subject's QR code is distinct.
      const qrInfo = omrScannerEngine.readQRCode(imageSource);
      let targetExam: Exam | null = null;

      if (qrInfo && (qrInfo.examId || qrInfo.title)) {
        const freshExams = storageService.getAllExamsRaw();
        const matched = freshExams.find(
          (e) =>
            (qrInfo.examId && (e.id === qrInfo.examId || e.id.toLowerCase() === qrInfo.examId.toLowerCase())) ||
            (qrInfo.title && e.title.trim().toLowerCase() === qrInfo.title.trim().toLowerCase())
        );
        if (matched) {
          targetExam = matched;
          setActiveExam(matched);
          matchedExamRef.current = matched;
          setQrDetectedNotice(`วิชา: ${matched.title}${matched.gradeLevel ? ` (${matched.gradeLevel})` : ''} • ${matched.questionCount} ข้อ`);
        }
      }

      // If no QR was matched in this photo, fallback to overrideExam or activeExam or matchedExamRef
      if (!targetExam) {
        targetExam = overrideExam || activeExam || matchedExamRef.current;
      }

      // If still no exam matched, default to the most recent exam or prompt user
      if (!targetExam) {
        const freshExams = storageService.getAllExamsRaw();
        if (freshExams.length > 0) {
          targetExam = freshExams[0];
          setActiveExam(targetExam);
          matchedExamRef.current = targetExam;
        } else {
          error('ไม่พบชุดข้อสอบในระบบ', 'กรุณาสร้างชุดข้อสอบอย่างน้อย 1 ชุดก่อนทำการตรวจ');
          return;
        }
      }

      // 2. Run OMR analysis with pencil & pen cross-mark recognition
      const result = await omrScannerEngine.processSheetImage(imageSource, targetExam, {
        sensitivity,
      });

      if (!result.success) {
        error('ตรวจกระดาษคำตอบไม่สำเร็จ', result.errorMessage || 'กรุณาจัดให้เห็นมุมครบทั้ง 4 มุมในกรอบ 13×20 ซม. แล้วถ่ายใหม่อีกครั้ง');
        return;
      }

      // 3. Set scan output immediately
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

      // Play score sound
      playResultChime(result.passed);

      // Play success feedback
      if (result.passed) {
        confetti({
          particleCount: 45,
          spread: 55,
          origin: { y: 0.6 },
        });
      }

      success(
        `ตรวจเสร็จทันที: ได้ ${result.score}/${result.totalQuestions} คะแนน (${result.scorePercentage}%)`,
        `${targetExam.title} • ${result.passed ? 'ผ่านเกณฑ์' : 'ไม่ผ่าน'}`
      );
    } catch (err: any) {
      console.error('Scan processing error', err);
      error('เกิดข้อผิดพลาดในการประมวลผลภาพ', err?.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
      isScanningRef.current = false;
    }
  };

  /**
   * Capture from video stream and scan
   * Strictly verifies Green frame quality (distance, lighting, 4 corners) before capturing
   */
  const handleCaptureFromCamera = async (force: boolean = false) => {
    if (!videoRef.current || !cameraActive || isProcessingRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const isFrameGreen = !!(frameQuality?.isReady && frameQuality?.statusColor === 'green');

    // Strict validation: must confirm perfect lighting, distance, and 4 corners in green before capture
    if (!isFrameGreen && !force) {
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      error(
        'ยังไม่สามารถกดถ่ายได้',
        frameQuality?.statusMessage || 'กรุณาจัดให้เห็นมุมครบทั้ง 4 มุมในกรอบ 13×20 ซม. และแถบเป็นสีเขียวก่อนถ่าย เพื่อความแม่นยำระดับมืออาชีพ'
      );
      return;
    }

    // Instant realistic shutter feedback: Flash + Sound + Haptics
    setIsShutterFlashing(true);
    playShutterSound();
    if (navigator.vibrate) navigator.vibrate([40, 25, 40]);
    setTimeout(() => setIsShutterFlashing(false), 120);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    await handleProcessImage(canvas);
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
    setQrDetectedNotice(null);
    setFrameQuality(null);
    consecutiveGreenFramesRef.current = 0;
    isProcessingRef.current = false;
    isScanningRef.current = false;
    lastAutoTriggerTimeRef.current = Date.now() + 1000; // 1s grace period to position next sheet
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
        <div className="flex items-center gap-1.5">
          {/* Auto Scan Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const next = !autoScanEnabled;
              setAutoScanEnabled(next);
              if (next) {
                success('เปิดโหมดสแกนอัตโนมัติ', 'จ่อกล้องแล้วระบบจะตรวจทันทีโดยไม่ต้องกดปุ่ม');
              } else {
                info('เปิดโหมดถ่ายเอง', 'กดปุ่มชัตเตอร์ด้านล่างเพื่อสั่งตรวจ');
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              autoScanEnabled
                ? 'bg-emerald-600/90 border-emerald-400 text-white shadow-xs'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title={autoScanEnabled ? 'คลิกเพื่อสลับเป็นโหมดถ่ายเอง' : 'คลิกเพื่อเปิดโหมดสแกนอัตโนมัติ'}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                autoScanEnabled ? 'bg-emerald-300 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span className="hidden sm:inline">
              {autoScanEnabled ? 'สแกนอัตโนมัติ' : 'ถ่ายเอง'}
            </span>
            <span className="sm:hidden">
              {autoScanEnabled ? 'ออโต้' : 'ถ่ายเอง'}
            </span>
          </button>

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
        {/* Instant White Camera Shutter Flash Effect */}
        {isShutterFlashing && (
          <div className="absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-100 opacity-90 animate-out fade-out" />
        )}

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

        {/* Heads-Up Display (HUD): 13*20 cm Portrait Frame & Dynamic 4 Corner Fiducial Alignment */}
        {cameraActive && !scanOutput && !cameraError && (
          <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-2 sm:p-4">
            {/* Top Bar: Subject Badge */}
            <div className="flex items-center justify-between pt-1 px-1">
              {/* Left: Identified Subject & Grade Level Status Badge */}
              <div className="max-w-[85%]">
                {activeExam ? (
                  <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-2xl shadow-lg flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 animate-ping" />
                    <div className="min-w-0">
                      <div className="font-heading font-black text-xs text-white truncate">
                        {activeExam.title}
                      </div>
                      <div className="text-[10px] text-emerald-300 font-semibold flex items-center gap-1.5 truncate">
                        <span>{activeExam.gradeLevel || 'ทั่วไป'}</span>
                        <span>•</span>
                        <span>{activeExam.questionCount} ข้อ</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-2xl shadow-lg flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
                    <div className="text-[11px] text-slate-300 font-medium">
                      สแกนตรวจได้ทุกวิชา (ส่อง QR บนกระดาษ)
                    </div>
                  </div>
                )}
              </div>

              {/* Status Tag */}
              <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-2.5 py-1 rounded-xl text-[10px] font-bold text-slate-200">
                13 × 20 ซม.
              </div>
            </div>

            {/* Center: 13*20 cm Portrait Viewfinder Frame (Aspect Ratio 13 : 20 = 0.65) */}
            <div className="flex-1 w-full flex items-center justify-center my-1 overflow-hidden">
              <div className="relative w-[min(calc(100vw-2rem),calc((100vh-215px)*13/20))] aspect-[13/20] max-h-[calc(100vh-215px)] pointer-events-none flex flex-col justify-between items-center transition-all duration-200">
                {/* 13*20 Border with dark vignette backdrop shadow masking outside area */}
                <div
                  className={`absolute inset-0 rounded-2xl pointer-events-none transition-colors duration-200 border-2 ${
                    frameQuality?.statusColor === 'green'
                      ? 'border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55),0_0_24px_rgba(52,211,153,0.5)]'
                      : 'border-rose-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.58),0_0_18px_rgba(244,63,94,0.35)]'
                  }`}
                />

                {/* 4 Corner Registration Fiducial Markers Overlay (Strictly 13*20 cm corner brackets) */}
                {/* Corner 1: Top-Left */}
                <div
                  className={`absolute -top-1.5 -left-1.5 w-10 h-10 border-t-4 border-l-4 rounded-tl-xl transition-all duration-200 ${
                    frameQuality?.statusColor === 'green'
                      ? 'border-emerald-400 shadow-[0_0_14px_#34d399]'
                      : frameQuality?.detectedCorners.topLeft
                      ? 'border-emerald-500 shadow-[0_0_10px_#10b981]'
                      : 'border-rose-500 shadow-[0_0_10px_#f43f5e]'
                  }`}
                >
                  <div
                    className={`absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-xs transition-colors duration-200 ${
                      frameQuality?.statusColor === 'green' || frameQuality?.detectedCorners.topLeft
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                        : 'bg-rose-500/80'
                    }`}
                  />
                </div>

                {/* Corner 2: Top-Right */}
                <div
                  className={`absolute -top-1.5 -right-1.5 w-10 h-10 border-t-4 border-r-4 rounded-tr-xl transition-all duration-200 ${
                    frameQuality?.statusColor === 'green'
                      ? 'border-emerald-400 shadow-[0_0_14px_#34d399]'
                      : frameQuality?.detectedCorners.topRight
                      ? 'border-emerald-500 shadow-[0_0_10px_#10b981]'
                      : 'border-rose-500 shadow-[0_0_10px_#f43f5e]'
                  }`}
                >
                  <div
                    className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-xs transition-colors duration-200 ${
                      frameQuality?.statusColor === 'green' || frameQuality?.detectedCorners.topRight
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                        : 'bg-rose-500/80'
                    }`}
                  />
                </div>

                {/* Corner 3: Bottom-Left */}
                <div
                  className={`absolute -bottom-1.5 -left-1.5 w-10 h-10 border-b-4 border-l-4 rounded-bl-xl transition-all duration-200 ${
                    frameQuality?.statusColor === 'green'
                      ? 'border-emerald-400 shadow-[0_0_14px_#34d399]'
                      : frameQuality?.detectedCorners.bottomLeft
                      ? 'border-emerald-500 shadow-[0_0_10px_#10b981]'
                      : 'border-rose-500 shadow-[0_0_10px_#f43f5e]'
                  }`}
                >
                  <div
                    className={`absolute bottom-1.5 left-1.5 w-2.5 h-2.5 rounded-xs transition-colors duration-200 ${
                      frameQuality?.statusColor === 'green' || frameQuality?.detectedCorners.bottomLeft
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                        : 'bg-rose-500/80'
                    }`}
                  />
                </div>

                {/* Corner 4: Bottom-Right */}
                <div
                  className={`absolute -bottom-1.5 -right-1.5 w-10 h-10 border-b-4 border-r-4 rounded-br-xl transition-all duration-200 ${
                    frameQuality?.statusColor === 'green'
                      ? 'border-emerald-400 shadow-[0_0_14px_#34d399]'
                      : frameQuality?.detectedCorners.bottomRight
                      ? 'border-emerald-500 shadow-[0_0_10px_#10b981]'
                      : 'border-rose-500 shadow-[0_0_10px_#f43f5e]'
                  }`}
                >
                  <div
                    className={`absolute bottom-1.5 right-1.5 w-2.5 h-2.5 rounded-xs transition-colors duration-200 ${
                      frameQuality?.statusColor === 'green' || frameQuality?.detectedCorners.bottomRight
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                        : 'bg-rose-500/80'
                    }`}
                  />
                </div>

                {/* Header inside 13*20 Frame: Top Badge & QR Reticle */}
                <div className="w-full flex items-start justify-between p-3 relative z-20">
                  {/* Top-Center Frame Indicator */}
                  <div className="bg-black/75 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700/80 text-[10px] text-slate-200 font-semibold flex items-center gap-1.5 shadow-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                    <span>กรอบ 13 × 20 ซม. (แนวตั้ง)</span>
                  </div>

                  {/* QR Code Targeting Box (Matching top-right of 13*20cm sheet) */}
                  <div className="flex flex-col items-center gap-1 bg-black/70 backdrop-blur-xs p-1.5 rounded-xl border border-indigo-400/60 shadow-lg">
                    <div
                      className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center ${
                        lastDetectedQR
                          ? 'border-emerald-400 bg-emerald-500/20'
                          : 'border-dashed border-indigo-400 animate-pulse'
                      }`}
                    >
                      <QrCode
                        className={`w-6 h-6 ${
                          lastDetectedQR ? 'text-emerald-400' : 'text-indigo-300 opacity-80'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-[8px] font-bold uppercase tracking-tight ${
                        lastDetectedQR ? 'text-emerald-300' : 'text-indigo-200'
                      }`}
                    >
                      {lastDetectedQR ? 'QR ติดแล้ว' : 'QR มุมขวา'}
                    </span>
                  </div>
                </div>

                {/* Animated Laser Scanning Beam inside 13*20 Frame */}
                <div className="absolute inset-x-3 top-14 bottom-10 pointer-events-none overflow-hidden">
                  <div
                    className={`w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent animate-[bounce_2.2s_infinite] ${
                      frameQuality?.statusColor === 'green'
                        ? 'text-emerald-400 shadow-[0_0_16px_#34d399]'
                        : 'text-rose-500 shadow-[0_0_16px_#f43f5e]'
                    }`}
                  />
                </div>

                {/* Bottom guide text inside frame */}
                <div className="pb-2.5 text-[10px] text-slate-300/80 font-medium drop-shadow-md">
                  จัด 4 มุมกระดาษให้พอดีกับกรอบ 13 × 20 ซม.
                </div>
              </div>
            </div>

            {/* Real-time Guidance Banner: Red (Warning/Missing/Blur) vs Green (Ready/Complete) */}
            <div className="flex flex-col items-center gap-1.5 pb-1 z-20 px-2">
              {/* Corner status indicator dots: TL, TR, BL, BR */}
              <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1 rounded-full border border-slate-800 text-[10px]">
                <span className="text-slate-400 font-semibold mr-0.5">สถานะมุมกระดาษ:</span>
                <span
                  className={`flex items-center gap-0.5 font-bold ${
                    frameQuality?.detectedCorners.topLeft ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {frameQuality?.detectedCorners.topLeft ? '✓' : '✗'} บนซ้าย
                </span>
                <span className="text-slate-600">•</span>
                <span
                  className={`flex items-center gap-0.5 font-bold ${
                    frameQuality?.detectedCorners.topRight ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {frameQuality?.detectedCorners.topRight ? '✓' : '✗'} บนขวา
                </span>
                <span className="text-slate-600">•</span>
                <span
                  className={`flex items-center gap-0.5 font-bold ${
                    frameQuality?.detectedCorners.bottomLeft ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {frameQuality?.detectedCorners.bottomLeft ? '✓' : '✗'} ล่างซ้าย
                </span>
                <span className="text-slate-600">•</span>
                <span
                  className={`flex items-center gap-0.5 font-bold ${
                    frameQuality?.detectedCorners.bottomRight ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {frameQuality?.detectedCorners.bottomRight ? '✓' : '✗'} ล่างขวา
                </span>
              </div>

              {/* Main Guidance Banner */}
              <div
                className={`backdrop-blur-md px-4 py-2 rounded-2xl border text-xs font-medium flex items-center gap-2.5 shadow-xl max-w-sm sm:max-w-md text-left transition-all ${
                  frameQuality?.statusColor === 'green'
                    ? 'bg-emerald-950/95 border-emerald-500/80 text-emerald-100 shadow-emerald-950/50'
                    : 'bg-rose-950/95 border-rose-500/80 text-rose-100 shadow-rose-950/50'
                }`}
              >
                {frameQuality?.statusColor === 'green' ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
                        <span>{frameQuality.statusTitle}</span>
                      </div>
                      <div className="text-[11px] text-emerald-200/90 truncate">
                        {frameQuality.statusMessage}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-400 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-rose-300 animate-bounce" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-rose-300 flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                        <span>{frameQuality?.statusTitle || 'กระดาษคำตอบยังไม่ชัด'}</span>
                      </div>
                      <div className="text-[11px] text-rose-200/90">
                        {frameQuality?.statusMessage ||
                          'กรุณาจัดให้เห็นมุมดำครบทั้ง 4 มุม และถือกล้องให้นิ่ง'}
                      </div>
                    </div>
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
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col gap-3 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">ผลตรวจ OMR แม่นยำระดับมืออาชีพ</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        scanOutput.passed
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {scanOutput.passed ? '✓ ผ่านเกณฑ์' : '✗ ไม่ผ่าน'}
                    </span>
                  </div>

                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center border-2 shrink-0 ${
                      scanOutput.passed
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                        : 'border-rose-500 bg-rose-500/10 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
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

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded-md">
                      {scanOutput.detectedQrExamTitle ? 'ตรวจพบจาก QR โค้ด' : 'วิชาที่ตรวจ'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {scanOutput.total <= 15 ? 'กระดาษคำตอบ 15 ข้อ ตรงกลางแผ่น' : 'กระดาษคำตอบฝนวงกลม 3 คอลัมน์'}
                    </span>
                  </div>
                  <h3 className="font-heading font-black text-lg sm:text-xl text-white mt-1">
                    {scanOutput.detectedQrExamTitle || activeExam?.title || 'กระดาษคำตอบ'}
                  </h3>
                  {activeExam?.gradeLevel && (
                    <span className="inline-block text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded-md mt-1">
                      {activeExam.gradeLevel}
                    </span>
                  )}

                  {/* Hero Score Display: "ได้ X จากทั้งหมด Y ข้อ (Z%)" */}
                  <div className="mt-2 p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <div className="text-base sm:text-lg font-heading font-extrabold text-white">
                      ได้ <span className="text-emerald-400 text-xl sm:text-2xl font-black">{scanOutput.score}</span> จากทั้งหมด <span className="font-mono">{scanOutput.total}</span> ข้อ ({scanOutput.pct}%)
                    </div>
                  </div>

                  {/* Notice if double-marks detected */}
                  {scanOutput.answers.some((a) => a.isMultipleMarked) && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-200 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        พบการฝนซ้ำ 2 ตัวเลือกในข้อ:{' '}
                        <strong>
                          {scanOutput.answers
                            .filter((a) => a.isMultipleMarked)
                            .map((a) => a.questionNumber)
                            .join(', ')}
                        </strong>{' '}
                        (ถือว่าตอบผิดตามเกณฑ์ OMR)
                      </span>
                    </div>
                  )}
                </div>

                {/* 3 Quick Metrics Cards */}
                <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
                  <div className="bg-slate-950/80 p-2 rounded-xl border border-emerald-500/30">
                    <div className="text-[10px] text-slate-400">ตอบถูก</div>
                    <div className="font-mono font-bold text-emerald-400 text-sm">{scanOutput.score} ข้อ</div>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-xl border border-rose-500/30">
                    <div className="text-[10px] text-slate-400">ตอบผิด</div>
                    <div className="font-mono font-bold text-rose-400 text-sm">{scanOutput.total - scanOutput.score} ข้อ</div>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-xl border border-indigo-500/30">
                    <div className="text-[10px] text-slate-400">คิดเป็น</div>
                    <div className="font-mono font-bold text-indigo-300 text-sm">{scanOutput.pct}%</div>
                  </div>
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
                  <span>วงกลมเขียว (✓) = ถูก | วงกลมแดง (✗) = ผิด</span>
                  <span className="text-emerald-400 font-semibold">ระบบ OMR ตรวจแม่นยำ</span>
                </div>
              </div>

              {/* Detailed Question-by-Question Answer Key Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <button
                  type="button"
                  onClick={() => setShowAnswersList(!showAnswersList)}
                  className="w-full p-3.5 bg-slate-800/80 hover:bg-slate-800 text-left flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200">
                      เฉลยรายข้อ ({scanOutput.score}/{scanOutput.total} ข้อถูก)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>{showAnswersList ? 'ย่อเฉลย' : 'ดูเฉลยละเอียด'}</span>
                    {showAnswersList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {showAnswersList && (
                  <div className="p-3 max-h-52 overflow-y-auto divide-y divide-slate-800">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {scanOutput.answers.map((ans) => {
                        const thaiLabels = ['ก', 'ข', 'ค', 'ง', 'จ'];
                        let selectedText = ans.selectedChoice !== null ? thaiLabels[ans.selectedChoice] || `${ans.selectedChoice + 1}` : 'ไม่ตอบ';
                        if (ans.isMultipleMarked) {
                          selectedText = 'ฝนซ้ำ (ผิด)';
                        }
                        const correctText = thaiLabels[ans.correctChoice] || `${ans.correctChoice + 1}`;

                        return (
                          <div
                            key={ans.questionNumber}
                            className={`p-2 rounded-xl border flex items-center justify-between text-xs ${
                              ans.isCorrect
                                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                                : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-mono">
                              <span className="font-bold text-slate-400 text-[11px]">
                                ข้อ {ans.questionNumber}:
                              </span>
                              <span className={`font-black px-1.5 py-0.5 rounded text-xs ${
                                ans.isCorrect
                                  ? 'bg-emerald-600/30 text-emerald-300'
                                  : ans.isMultipleMarked
                                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 text-[10px]'
                                  : 'bg-rose-600/30 text-rose-300'
                              }`}>
                                {selectedText}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {ans.isCorrect ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <div className="flex items-center gap-1 text-[11px]">
                                  <span className="text-slate-400 font-mono">เฉลย:</span>
                                  <span className="font-bold text-emerald-400 underline">{correctText}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
        <footer className="h-24 sm:h-28 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 px-4 flex items-center justify-between gap-3 shrink-0 z-40 text-white max-w-lg mx-auto w-full">
          {/* Left: Gallery Upload */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 p-2 text-slate-400 hover:text-white transition-colors cursor-pointer w-16"
            title="เลือกรูปภาพจากเครื่อง"
          >
            <Upload className="w-5 h-5" />
            <span className="text-[10px]">คลังภาพ</span>
          </button>

          {/* Center: Big Mobile Shutter Button with Real-time Green Validation Gate */}
          <div className="flex flex-col items-center flex-1 max-w-[260px]">
            {frameQuality?.isReady && frameQuality?.statusColor === 'green' ? (
              // Green State: Unlocked, glowing, animated, ready to capture
              <button
                type="button"
                onClick={() => handleCaptureFromCamera(false)}
                disabled={isProcessing || !cameraActive}
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 hover:from-emerald-500 hover:to-teal-300 active:scale-95 text-white shadow-xl shadow-emerald-950/80 ring-4 ring-emerald-400/80 border-4 border-slate-950 flex items-center justify-center cursor-pointer transition-all animate-pulse"
                title="ระยะและแสงสมบูรณ์แบบ • กดถ่ายตรวจคะแนนทันที"
              >
                <Camera className="w-8 h-8 text-white drop-shadow-md" />
              </button>
            ) : (
              // Red/Not Ready State: Locked, displays lock badge, informs user to align frame to green
              <button
                type="button"
                onClick={() => handleCaptureFromCamera(false)}
                disabled={isProcessing || !cameraActive}
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-slate-900 border-4 border-slate-800 text-slate-500 shadow-inner flex flex-col items-center justify-center transition-all cursor-not-allowed group relative active:scale-95"
                title="กรุณาจัดระยะและแสงให้เป็นสีเขียวก่อนถ่าย"
              >
                <Lock className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform mb-0.5" />
                <span className="text-[8px] font-bold text-rose-300 uppercase tracking-tighter">ล็อก</span>
              </button>
            )}

            {/* Real-time Status Caption below shutter button */}
            <div className="mt-1 text-center">
              {frameQuality?.isReady && frameQuality?.statusColor === 'green' ? (
                <div className="text-[11px] text-emerald-300 font-bold flex items-center gap-1 justify-center animate-bounce">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>สมบูรณ์แบบ! กดถ่ายตรวจทันที</span>
                </div>
              ) : (
                <div className="text-[10px] text-rose-300/90 font-medium flex items-center gap-1 justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                  <span>รอสีเขียวก่อนถ่าย (จัด 4 มุม / แสง / ระยะ)</span>
                </div>
              )}
            </div>
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
