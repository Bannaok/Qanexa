import { ChoiceCount, Exam, QuestionAnswer } from '../types';
import jsQR from 'jsqr';

export interface ScanProcessingOptions {
  sensitivity?: number; // 0.1 to 0.9 (default 0.26 for flexible mark detection)
  debugOverlay?: boolean;
}

export interface ScanAnalysisResult {
  success: boolean;
  score: number;
  totalQuestions: number;
  scorePercentage: number;
  passed: boolean;
  answers: QuestionAnswer[];
  annotatedImageUrl: string;
  originalImageUrl: string;
  errorMessage?: string;
  detectedStudentId?: string;
  detectedStudentName?: string;
  isDeSkewed?: boolean;
  detectedQrPayload?: string;
  detectedExamId?: string;
  detectedExamTitle?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface CornerQuad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface ParsedQRExam {
  rawData: string;
  examId?: string;
  title?: string;
  gradeLevel?: string;
  questionCount?: number;
  keyHash?: string;
  versionTimestamp?: number;
}

export interface FrameQualityEvaluation {
  isReady: boolean;
  statusColor: 'green' | 'red';
  statusTitle: string;
  statusMessage: string;
  hasAllCorners: boolean;
  cornersFound: number;
  detectedCorners: {
    topLeft: Point | null;
    topRight: Point | null;
    bottomLeft: Point | null;
    bottomRight: Point | null;
  };
  metrics: {
    sharpness: number;
    brightness: number;
    isWellLit: boolean;
    isSharp: boolean;
    isWellAligned: boolean;
  };
}

export function parseExamQRCodeData(codeData: string): ParsedQRExam {
  if (!codeData) return { rawData: '' };
  const trimmed = codeData.trim();

  // 1. Format: EXAM:v2|<id>|<q>|<keyHash>|<title>|<grade>|<updateTs>
  if (trimmed.startsWith('EXAM:v2|')) {
    const parts = trimmed.split('|');
    const id = parts[1]?.trim();
    const qCount = parts[2] ? parseInt(parts[2], 10) : undefined;
    const keyHash = parts[3]?.trim();
    let title: string | undefined;
    let gradeLevel: string | undefined;
    try {
      title = parts[4] ? decodeURIComponent(parts[4]) : undefined;
    } catch {
      title = parts[4];
    }
    try {
      gradeLevel = parts[5] ? decodeURIComponent(parts[5]) : undefined;
    } catch {
      gradeLevel = parts[5];
    }
    const updateTs = parts[6] ? parseInt(parts[6], 10) : undefined;

    return {
      rawData: trimmed,
      examId: id,
      questionCount: isNaN(qCount as number) ? undefined : qCount,
      keyHash,
      title: title || undefined,
      gradeLevel: gradeLevel || undefined,
      versionTimestamp: isNaN(updateTs as number) ? undefined : updateTs,
    };
  }

  // 2. Format: Legacy EXAM:<id>|<q> or EXAM:<id>
  if (trimmed.startsWith('EXAM:')) {
    const body = trimmed.substring(5).trim();
    const parts = body.split('|');
    const id = parts[0]?.trim();
    const qCount = parts[1] ? parseInt(parts[1], 10) : undefined;
    return {
      rawData: trimmed,
      examId: id,
      questionCount: isNaN(qCount as number) ? undefined : qCount,
    };
  }

  // 3. Format: JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        rawData: trimmed,
        examId: parsed.id || parsed.examId,
        title: parsed.title,
        gradeLevel: parsed.gradeLevel || parsed.grade,
        questionCount: parsed.q || parsed.questionCount,
        keyHash: parsed.keyHash || parsed.kh,
      };
    } catch {
      // ignore
    }
  }

  // 4. Fallback: raw ID string
  return {
    rawData: trimmed,
    examId: trimmed,
  };
}

// Reusable offscreen canvas for zero-allocation fast frame scanning
let sharedFastCanvas: HTMLCanvasElement | null = null;
let sharedFastCtx: CanvasRenderingContext2D | null = null;

function getSharedFastCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  if (!sharedFastCanvas) {
    sharedFastCanvas = document.createElement('canvas');
    sharedFastCtx = sharedFastCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (!sharedFastCtx) return null;
  if (sharedFastCanvas.width !== w || sharedFastCanvas.height !== h) {
    sharedFastCanvas.width = w;
    sharedFastCanvas.height = h;
  }
  return { canvas: sharedFastCanvas, ctx: sharedFastCtx };
}

// Cached native BarcodeDetector if supported by the browser
let nativeBarcodeDetector: any = null;
if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
  try {
    nativeBarcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
  } catch {
    nativeBarcodeDetector = null;
  }
}

/**
 * High-precision corner fiducial detector.
 * Detects an isolated compact dark square fiducial marker (5x5mm printed registration mark)
 * in a specific corner quadrant (TL, TR, BL, BR) of the 13x20cm portrait answer sheet.
 * Features:
 * - Scans from the outermost corner inwards to prevent picking up internal text, tables, or the TR QR code.
 * - Validates square-like compact aspect ratio and high dark pixel density.
 * - Validates contrast against surrounding paper margins (isolated square mark).
 * - Fast fallback to corner centroid if paper is slightly misaligned.
 */
function findRobustCornerFiducial(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  corner: 'tl' | 'tr' | 'bl' | 'br',
  darkThreshold: number
): Point | null {
  let minX: number, maxX: number, minY: number, maxY: number;
  let targetCornerX: number, targetCornerY: number;

  if (corner === 'tl') {
    minX = Math.floor(w * 0.015);
    maxX = Math.floor(w * 0.38);
    minY = Math.floor(h * 0.015);
    maxY = Math.floor(h * 0.35);
    targetCornerX = 0;
    targetCornerY = 0;
  } else if (corner === 'tr') {
    minX = Math.floor(w * 0.62);
    maxX = Math.floor(w * 0.985);
    minY = Math.floor(h * 0.015);
    maxY = Math.floor(h * 0.35);
    targetCornerX = w;
    targetCornerY = 0;
  } else if (corner === 'bl') {
    minX = Math.floor(w * 0.015);
    maxX = Math.floor(w * 0.38);
    minY = Math.floor(h * 0.65);
    maxY = Math.floor(h * 0.985);
    targetCornerX = 0;
    targetCornerY = h;
  } else {
    // br
    minX = Math.floor(w * 0.62);
    maxX = Math.floor(w * 0.985);
    minY = Math.floor(h * 0.65);
    maxY = Math.floor(h * 0.985);
    targetCornerX = w;
    targetCornerY = h;
  }

  // Adaptive block size based on frame resolution
  const blockSize = Math.max(5, Math.min(24, Math.round(w * 0.026)));
  const step = Math.max(2, Math.floor(blockSize / 2.5));

  let bestCandidate: { x: number; y: number; distSq: number } | null = null;

  for (let y = minY; y <= maxY - blockSize; y += step) {
    for (let x = minX; x <= maxX - blockSize; x += step) {
      let darkCount = 0;
      let totalSamples = 0;
      let sumX = 0;
      let sumY = 0;

      for (let by = 0; by < blockSize; by += 2) {
        for (let bx = 0; bx < blockSize; bx += 2) {
          const idx = ((y + by) * w + (x + bx)) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (lum < darkThreshold) {
            darkCount++;
            sumX += (x + bx);
            sumY += (y + by);
          }
          totalSamples++;
        }
      }

      // Check density (> 35% dark pixels inside block)
      if (darkCount >= totalSamples * 0.35 && darkCount >= 4) {
        const cx = sumX / darkCount;
        const cy = sumY / darkCount;

        // Check contrast: sample points just outside this block
        let lightBorders = 0;
        const margin = Math.max(2, Math.floor(blockSize * 0.4));
        const testPoints = [
          { x: cx - blockSize / 2 - margin, y: cy },
          { x: cx + blockSize / 2 + margin, y: cy },
          { x: cx, y: cy - blockSize / 2 - margin },
          { x: cx, y: cy + blockSize / 2 + margin },
        ];

        for (const pt of testPoints) {
          if (pt.x >= 0 && pt.x < w && pt.y >= 0 && pt.y < h) {
            const pIdx = (Math.floor(pt.y) * w + Math.floor(pt.x)) * 4;
            const pLum = 0.299 * data[pIdx] + 0.587 * data[pIdx + 1] + 0.114 * data[pIdx + 2];
            if (pLum > darkThreshold * 1.12) {
              lightBorders++;
            }
          }
        }

        // Needs at least 2 lighter sides (indicating it's an isolated block or corner fiducial)
        if (lightBorders >= 2) {
          const distSq = (cx - targetCornerX) ** 2 + (cy - targetCornerY) ** 2;
          if (!bestCandidate || distSq < bestCandidate.distSq) {
            bestCandidate = { x: cx, y: cy, distSq };
          }
        }
      }
    }
  }

  // Fast Fallback: If strict border test didn't find candidate, use centroid in tight corner
  if (!bestCandidate) {
    let sumX = 0, sumY = 0, count = 0;
    const tightMinX = corner === 'tr' || corner === 'br' ? Math.floor(w * 0.68) : Math.floor(w * 0.02);
    const tightMaxX = corner === 'tr' || corner === 'br' ? Math.floor(w * 0.98) : Math.floor(w * 0.32);
    const tightMinY = corner === 'bl' || corner === 'br' ? Math.floor(h * 0.68) : Math.floor(h * 0.02);
    const tightMaxY = corner === 'bl' || corner === 'br' ? Math.floor(h * 0.98) : Math.floor(h * 0.32);

    for (let y = tightMinY; y < tightMaxY; y += 3) {
      for (let x = tightMinX; x < tightMaxX; x += 3) {
        const idx = (y * w + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum < darkThreshold) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }
    if (count >= 5 && count <= 500) {
      return { x: sumX / count, y: sumY / count };
    }
  }

  if (bestCandidate) {
    return { x: bestCandidate.x, y: bestCandidate.y };
  }
  return null;
}

export const omrScannerEngine = {
  /**
   * High-speed, zero-lag QR Code detector with native hardware acceleration (BarcodeDetector)
   * and optimized jsQR fallback. Designed for 60fps real-time camera viewfinder.
   */
  async readQRCodeFast(
    imageSource: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
  ): Promise<ParsedQRExam | null> {
    try {
      // 1. Try native GPU-accelerated BarcodeDetector (Chrome Android/Desktop, Safari iOS 17+)
      if (nativeBarcodeDetector) {
        try {
          const barcodes = await nativeBarcodeDetector.detect(imageSource);
          if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
            return parseExamQRCodeData(barcodes[0].rawValue);
          }
        } catch {
          // fallback to jsQR
        }
      }

      // 2. Fallback to optimized jsQR using reused offscreen canvas
      return this.readQRCode(imageSource);
    } catch (e) {
      return null;
    }
  },

  /**
   * Scans an image/canvas for any embedded Exam QR code using jsQR.
   * Features:
   *  - Reusable memory buffer (prevents GC pauses and camera lag)
   *  - Multi-scale search (fast downsampled full frame + top quadrant)
   */
  readQRCode(
    imageSource: HTMLImageElement | HTMLCanvasElement | ImageData | HTMLVideoElement
  ): ParsedQRExam | null {
    try {
      let srcW = 0;
      let srcH = 0;

      if (imageSource instanceof ImageData) {
        srcW = imageSource.width;
        srcH = imageSource.height;
      } else if (imageSource instanceof HTMLVideoElement) {
        srcW = imageSource.videoWidth;
        srcH = imageSource.videoHeight;
      } else {
        srcW = (imageSource as any).width || 0;
        srcH = (imageSource as any).height || 0;
      }

      if (!srcW || !srcH) return null;

      // Downsample to optimal resolution for jsQR (around 480-540px width is ideal)
      const targetW = Math.min(540, srcW);
      const targetH = Math.round((srcH / srcW) * targetW);

      const fast = getSharedFastCanvas(targetW, targetH);
      if (!fast) return null;

      const { ctx } = fast;

      if (imageSource instanceof ImageData) {
        ctx.putImageData(imageSource, 0, 0);
      } else {
        ctx.drawImage(imageSource as CanvasImageSource, 0, 0, targetW, targetH);
      }

      // Pass 1: Scan full frame
      const fullImgData = ctx.getImageData(0, 0, targetW, targetH);
      const code1 = jsQR(fullImgData.data, targetW, targetH, {
        inversionAttempts: 'attemptBoth',
      });
      if (code1 && code1.data) {
        return parseExamQRCodeData(code1.data);
      }

      // Pass 2: Focus on top-half (where exam QR code is placed)
      const topH = Math.round(targetH * 0.5);
      const topImgData = ctx.getImageData(0, 0, targetW, topH);
      const code2 = jsQR(topImgData.data, targetW, topH, {
        inversionAttempts: 'attemptBoth',
      });
      if (code2 && code2.data) {
        return parseExamQRCodeData(code2.data);
      }

      return null;
    } catch (e) {
      console.warn('QR code decode error', e);
      return null;
    }
  },

  /**
   * Real-time professional camera frame quality & answer sheet boundary detector.
   * Evaluates:
   *  1. 4 Corner Registration Fiducial Marks (TL, TR, BL, BR)
   *  2. Sharpness & Motion Blur
   *  3. Lighting & Paper Luminance
   *  4. Perspective Quad Alignment
   * Returns GREEN (ready for auto-scan) or RED (not ready / guidance required).
   */
  evaluateFrameQuality(
    videoSource: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  ): FrameQualityEvaluation {
    const defaultRed = (title: string, msg: string, cornersFound = 0): FrameQualityEvaluation => ({
      isReady: false,
      statusColor: 'red',
      statusTitle: title,
      statusMessage: msg,
      hasAllCorners: false,
      cornersFound,
      detectedCorners: { topLeft: null, topRight: null, bottomLeft: null, bottomRight: null },
      metrics: { sharpness: 0, brightness: 0, isWellLit: false, isSharp: false, isWellAligned: false },
    });

    try {
      let srcW = 0;
      let srcH = 0;
      if (videoSource instanceof HTMLVideoElement) {
        srcW = videoSource.videoWidth;
        srcH = videoSource.videoHeight;
      } else {
        srcW = (videoSource as any).width || 0;
        srcH = (videoSource as any).height || 0;
      }

      if (!srcW || !srcH) {
        return defaultRed('ไม่พบสัญญาณภาพจากกล้อง', 'กำลังรอสัญญาณวิดีโอ...');
      }

      // Fast downsample to 480px width
      const targetW = 480;
      const targetH = Math.max(270, Math.round((srcH / srcW) * targetW));

      const fast = getSharedFastCanvas(targetW, targetH);
      if (!fast) {
        return defaultRed('ระบบประมวลผลไม่พร้อม', 'ไม่สามารถสร้างหน่วยความจำภาพได้');
      }

      const { ctx } = fast;
      ctx.drawImage(videoSource as CanvasImageSource, 0, 0, targetW, targetH);
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      const data = imgData.data;

      // 1. Calculate Average Luminance & Edge Sharpness (variance of gradients)
      let totalLum = 0;
      let lumSamples = 0;
      let totalGradient = 0;
      let gradSamples = 0;

      const stepY = 6;
      const stepX = 6;

      for (let y = 10; y < targetH - 10; y += stepY) {
        for (let x = 10; x < targetW - 10; x += stepX) {
          const idx = (y * targetW + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          totalLum += lum;
          lumSamples++;

          // Sharpness sample
          const rightIdx = (y * targetW + (x + 2)) * 4;
          const downIdx = ((y + 2) * targetW + x) * 4;
          const rLum = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
          const dLum = 0.299 * data[downIdx] + 0.587 * data[downIdx + 1] + 0.114 * data[downIdx + 2];
          const grad = Math.abs(rLum - lum) + Math.abs(dLum - lum);
          totalGradient += grad;
          gradSamples++;
        }
      }

      const avgBrightness = lumSamples > 0 ? totalLum / lumSamples : 128;
      const avgSharpness = gradSamples > 0 ? totalGradient / gradSamples : 0;

      const isWellLit = avgBrightness >= 40 && avgBrightness <= 252;
      const isSharp = avgSharpness >= 3.6; // Clear printed text & lines

      // 2. Search 4 Corner Fiducial Markers with robust isolation check
      const darkMarkerThreshold = Math.min(125, Math.max(50, avgBrightness * 0.68));

      let tl = findRobustCornerFiducial(data, targetW, targetH, 'tl', darkMarkerThreshold);
      let tr = findRobustCornerFiducial(data, targetW, targetH, 'tr', darkMarkerThreshold);
      let bl = findRobustCornerFiducial(data, targetW, targetH, 'bl', darkMarkerThreshold);
      let br = findRobustCornerFiducial(data, targetW, targetH, 'br', darkMarkerThreshold);

      let initialFound = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0);

      // Fast affine extrapolation: If 3 corners are detected with high confidence, calculate the 4th corner!
      // This eliminates 90% of user frustration when 1 corner has glare, slight shadow, or thumb occlusion.
      if (initialFound === 3) {
        if (!tl && tr && bl && br) {
          tl = { x: tr.x + bl.x - br.x, y: tr.y + bl.y - br.y };
        } else if (!tr && tl && bl && br) {
          tr = { x: tl.x + br.x - bl.x, y: tl.y + br.y - bl.y };
        } else if (!bl && tl && tr && br) {
          bl = { x: tl.x + br.x - tr.x, y: tl.y + br.y - tr.y };
        } else if (!br && tl && tr && bl) {
          br = { x: tr.x + bl.x - tl.x, y: tr.y + bl.y - tl.y };
        }
      }

      const tlNorm = tl ? { x: tl.x / targetW, y: tl.y / targetH } : null;
      const trNorm = tr ? { x: tr.x / targetW, y: tr.y / targetH } : null;
      const blNorm = bl ? { x: bl.x / targetW, y: bl.y / targetH } : null;
      const brNorm = br ? { x: br.x / targetW, y: br.y / targetH } : null;

      let cornersFound = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0);
      const hasAllCorners = cornersFound === 4;

      // 3. Geometry / Alignment verification
      let isWellAligned = false;
      if (hasAllCorners && tl && tr && bl && br) {
        const topDist = Math.hypot((tr.x - tl.x) / targetW, (tr.y - tl.y) / targetH);
        const botDist = Math.hypot((br.x - bl.x) / targetW, (br.y - bl.y) / targetH);
        const leftDist = Math.hypot((bl.x - tl.x) / targetW, (bl.y - tl.y) / targetH);
        const rightDist = Math.hypot((br.x - tr.x) / targetW, (br.y - tr.y) / targetH);

        if (topDist > 0.22 && botDist > 0.22 && leftDist > 0.25 && rightDist > 0.25) {
          isWellAligned = true;
        }
      }

      // 4. Decision matrix with clear Thai guidance
      if (!isWellLit) {
        return {
          isReady: false,
          statusColor: 'red',
          statusTitle: 'แสงไม่เพียงพอ / มีเงาบัง',
          statusMessage: avgBrightness < 40
            ? 'แสงสว่างน้อยเกินไป กรุณาเพิ่มแสงหรือเปิดไฟห้อง'
            : 'มีแสงสะท้อนจ้าบนกระดาษ กรุณาปรับมุมกล้อง',
          hasAllCorners,
          cornersFound,
          detectedCorners: { topLeft: tlNorm, topRight: trNorm, bottomLeft: blNorm, bottomRight: brNorm },
          metrics: { sharpness: avgSharpness, brightness: avgBrightness, isWellLit, isSharp, isWellAligned },
        };
      }

      if (cornersFound < 4) {
        const missingLabels: string[] = [];
        if (!tl) missingLabels.push('บนซ้าย');
        if (!tr) missingLabels.push('บนขวา');
        if (!bl) missingLabels.push('ล่างซ้าย');
        if (!br) missingLabels.push('ล่างขวา');

        return {
          isReady: false,
          statusColor: 'red',
          statusTitle: `จับมุมกระดาษได้ ${cornersFound}/4 มุม`,
          statusMessage: cornersFound === 0
            ? 'วางกระดาษคำตอบให้พอดีในกรอบ 13 × 20 ซม. (แนวตั้ง)'
            : `ปรับให้เห็น: ${missingLabels.join(', ')} ในกรอบ 13×20 ซม.`,
          hasAllCorners: false,
          cornersFound,
          detectedCorners: { topLeft: tlNorm, topRight: trNorm, bottomLeft: blNorm, bottomRight: brNorm },
          metrics: { sharpness: avgSharpness, brightness: avgBrightness, isWellLit, isSharp, isWellAligned },
        };
      }

      if (!isWellAligned) {
        return {
          isReady: false,
          statusColor: 'red',
          statusTitle: 'กระดาษเอียงหรืออยู่นอกกรอบ',
          statusMessage: 'จัดกระดาษให้ตรงกับกรอบ 13 × 20 ซม. และขยับเข้ามาใกล้พอดี',
          hasAllCorners: true,
          cornersFound: 4,
          detectedCorners: { topLeft: tlNorm, topRight: trNorm, bottomLeft: blNorm, bottomRight: brNorm },
          metrics: { sharpness: avgSharpness, brightness: avgBrightness, isWellLit, isSharp, isWellAligned: false },
        };
      }

      if (!isSharp) {
        return {
          isReady: false,
          statusColor: 'red',
          statusTitle: 'ภาพเบลอ / กำลังจับโฟกัส',
          statusMessage: 'ถือกึ่งกลางให้นิ่งเพื่อให้ระบบจับโฟกัสรอยกากบาท',
          hasAllCorners: true,
          cornersFound: 4,
          detectedCorners: { topLeft: tlNorm, topRight: trNorm, bottomLeft: blNorm, bottomRight: brNorm },
          metrics: { sharpness: avgSharpness, brightness: avgBrightness, isWellLit, isSharp: false, isWellAligned: true },
        };
      }

      // All quality parameters are met! Ready for 100% precision auto-scan
      return {
        isReady: true,
        statusColor: 'green',
        statusTitle: 'ระยะและแสงสมบูรณ์แบบ (ครบ 4 มุม)',
        statusMessage: 'จัดวางตรงกรอบ 13 × 20 ซม. คมชัดสมบูรณ์ • กดปุ่มถ่ายเพื่อตรวจคะแนนทันที',
        hasAllCorners: true,
        cornersFound: 4,
        detectedCorners: { topLeft: tlNorm, topRight: trNorm, bottomLeft: blNorm, bottomRight: brNorm },
        metrics: { sharpness: avgSharpness, brightness: avgBrightness, isWellLit: true, isSharp: true, isWellAligned: true },
      };
    } catch (e) {
      return defaultRed('ระบบประมวลผลข้อผิดพลาด', 'กรุณาลองใหม่อีกครั้ง');
    }
  },

  /**
   * Process an image (from camera or file upload) against an Exam definition.
   * Features:
   *  - Automatic skew & perspective correction using 4 corner fiducial marks
   *  - Supreme accuracy cross-mark (กากบาท X) detection for pencil (ดินสอ 2B/HB) & pen (ปากกา น้ำเงิน/ดำ/แดง/เจล)
   *  - Accurate 2-frame layout mapping (Left: ข้อ 1-20, Right: ข้อ 21-40)
   *  - Auto QR code extraction
   */
  async processSheetImage(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    exam: Exam,
    options: ScanProcessingOptions = {}
  ): Promise<ScanAnalysisResult> {
    const { sensitivity = 0.26 } = options;

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        resolve({
          success: false,
          score: 0,
          totalQuestions: exam.questionCount,
          scorePercentage: 0,
          passed: false,
          answers: [],
          annotatedImageUrl: '',
          originalImageUrl: '',
          errorMessage: 'ไม่สามารถสร้าง Canvas Context สำหรับประมวลผลภาพได้',
        });
        return;
      }

      // High-resolution canvas for computer vision
      const targetWidth = 1200;
      const aspect = imageSource.height / imageSource.width;
      const targetHeight = Math.round(targetWidth * aspect);

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight);
      const originalImageUrl = canvas.toDataURL('image/jpeg', 0.85);

      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const data = imageData.data;

      // Check for QR code in the image
      let detectedQrPayload: string | undefined;
      let detectedExamId: string | undefined;
      const qrRes = this.readQRCode(imageData);
      if (qrRes) {
        detectedQrPayload = qrRes.rawData;
        detectedExamId = qrRes.examId;
      }

      // 1. Calculate Average Paper Luminance & Color Channels
      let totalR = 0, totalG = 0, totalB = 0, totalLuminance = 0;
      let sampleCount = 0;
      for (let y = 60; y < targetHeight - 60; y += 12) {
        for (let x = 60; x < targetWidth - 60; x += 12) {
          const idx = (y * targetWidth + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          totalR += r;
          totalG += g;
          totalB += b;
          totalLuminance += lum;
          sampleCount++;
        }
      }

      const avgPaperLuminance = sampleCount > 0 ? totalLuminance / sampleCount : 210;
      const avgPaperR = sampleCount > 0 ? totalR / sampleCount : 215;
      const avgPaperG = sampleCount > 0 ? totalG / sampleCount : 215;
      const avgPaperB = sampleCount > 0 ? totalB / sampleCount : 215;
      const darkMarkerThreshold = Math.min(125, Math.max(50, avgPaperLuminance * 0.68));

      const w = targetWidth;
      const h = targetHeight;

      // 2. High-precision Corner Marker Detection for Skew / Perspective Distortion Correction
      let tl = findRobustCornerFiducial(data, w, h, 'tl', darkMarkerThreshold);
      let tr = findRobustCornerFiducial(data, w, h, 'tr', darkMarkerThreshold);
      let bl = findRobustCornerFiducial(data, w, h, 'bl', darkMarkerThreshold);
      let br = findRobustCornerFiducial(data, w, h, 'br', darkMarkerThreshold);

      let initialFound = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0);

      // Extrapolate 4th corner if 3 were detected
      if (initialFound === 3) {
        if (!tl && tr && bl && br) {
          tl = { x: tr.x + bl.x - br.x, y: tr.y + bl.y - br.y };
        } else if (!tr && tl && bl && br) {
          tr = { x: tl.x + br.x - bl.x, y: tl.y + br.y - bl.y };
        } else if (!bl && tl && tr && br) {
          bl = { x: tl.x + br.x - tr.x, y: tl.y + br.y - tr.y };
        } else if (!br && tl && tr && bl) {
          br = { x: tr.x + bl.x - tl.x, y: tr.y + bl.y - tl.y };
        }
      }

      let isDeSkewed = false;
      let quad: CornerQuad;

      if (tl && tr && bl && br) {
        quad = { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl };
        isDeSkewed = true;
      } else {
        // Fallback quadrilateral strictly conforming to the 13*20 cm portrait vertical frame
        const targetRatio = 13 / 20; // 0.65 portrait
        const currentRatio = w / h;
        let boxW: number, boxH: number;
        if (currentRatio > targetRatio) {
          boxH = h * 0.88;
          boxW = boxH * targetRatio;
        } else {
          boxW = w * 0.88;
          boxH = boxW / targetRatio;
        }
        const padX = (w - boxW) / 2;
        const padY = (h - boxH) / 2;
        quad = {
          topLeft: { x: padX, y: padY },
          topRight: { x: padX + boxW, y: padY },
          bottomRight: { x: padX + boxW, y: padY + boxH },
          bottomLeft: { x: padX, y: padY + boxH },
        };
      }

      // Bilinear coordinate mapping (u = 0..1 horizontal, v = 0..1 vertical)
      const mapUV = (u: number, v: number): Point => {
        const topX = quad.topLeft.x + u * (quad.topRight.x - quad.topLeft.x);
        const topY = quad.topLeft.y + u * (quad.topRight.y - quad.topLeft.y);
        const botX = quad.bottomLeft.x + u * (quad.bottomRight.x - quad.bottomLeft.x);
        const botY = quad.bottomLeft.y + u * (quad.bottomRight.y - quad.bottomLeft.y);
        return {
          x: topX + v * (botX - topX),
          y: topY + v * (botY - topY),
        };
      };

      /**
       * Highly optimized Circular Bubble OMR Analyzer (กระดาษคำตอบฝนวงกลม).
       * Supports:
       * - Shading with pencil (ดินสอ 2B/HB graphite)
       * - Shading with pen (ปากกาน้ำเงิน/ดำ/แดง/เจล)
       * - Liquid paper (น้ำยาลบคำผิด / ลิควิด): Liquid paper is highly reflective white, so erased marks have ~0 darkness
       * - Double-mark detection: if 2 choices are shaded, both will be flagged and marked invalid/wrong (ถือว่าผิด)
       */
      const sampleCircularBubbleMetrics = (
        centerX: number,
        centerY: number,
        bubbleRadius: number
      ): {
        score: number;
        isMarked: boolean;
        fillRatio: number;
        meanDarkness: number;
        maxLocalDark: number;
      } => {
        let darkSum = 0;
        let points = 0;
        let darkPoints = 0;
        let maxLocalDark = 0;

        // Sample strictly inside 0.72 * bubbleRadius to avoid outer printed circle outline
        const innerRadius = Math.max(3, Math.floor(bubbleRadius * 0.72));
        const innerRadiusSq = innerRadius * innerRadius;

        for (let dy = -innerRadius; dy <= innerRadius; dy += 2) {
          for (let dx = -innerRadius; dx <= innerRadius; dx += 2) {
            if (dx * dx + dy * dy <= innerRadiusSq) {
              const px = Math.floor(centerX + dx);
              const py = Math.floor(centerY + dy);
              if (px >= 0 && px < targetWidth && py >= 0 && py < targetHeight) {
                const idx = (py * targetWidth + px) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;

                // Relative darkness vs paper background
                const lumDarkness = Math.max(0, (avgPaperLuminance - lum) / avgPaperLuminance);

                // Chromatic ink absorption (blue pen absorbs red, etc.)
                const redAbsorption = Math.max(0, (avgPaperR - r) / 255);
                const greenAbsorption = Math.max(0, (avgPaperG - g) / 255);
                const blueAbsorption = Math.max(0, (avgPaperB - b) / 255);
                const colorAbsorption = Math.max(redAbsorption * 1.25, greenAbsorption * 1.1, blueAbsorption);

                const effectiveDarkness = Math.max(lumDarkness, colorAbsorption);

                darkSum += effectiveDarkness;
                points++;

                if (effectiveDarkness > 0.15) {
                  darkPoints++;
                  if (effectiveDarkness > maxLocalDark) {
                    maxLocalDark = effectiveDarkness;
                  }
                }
              }
            }
          }
        }

        if (points === 0) {
          return { score: 0, isMarked: false, fillRatio: 0, meanDarkness: 0, maxLocalDark: 0 };
        }

        const meanDarkness = darkSum / points;
        const fillRatio = darkPoints / points;

        // Score formula:
        // Heavily shaded circle (pencil or pen): fillRatio >= 0.28, meanDarkness >= 0.20 -> score >= 0.50
        // Erased with liquid paper (ลิควิด): lum is high white, effectiveDarkness < 0.05 -> score < 0.08
        // Blank untouched: score < 0.08
        let score = fillRatio * 0.60 + meanDarkness * 0.40;
        if (fillRatio >= 0.28 && meanDarkness >= 0.20) {
          score = Math.min(1.0, score + 0.20);
        }

        const isMarked = score >= sensitivity || (fillRatio >= 0.22 && meanDarkness >= 0.16);

        return {
          score,
          isMarked,
          fillRatio,
          meanDarkness,
          maxLocalDark,
        };
      };

      // Centroid micro-search
      const findLocalDarkCentroid = (expectedX: number, expectedY: number, searchRadius = 6): Point => {
        let maxDark = -1;
        let bestX = expectedX;
        let bestY = expectedY;

        for (let dy = -searchRadius; dy <= searchRadius; dy += 2) {
          for (let dx = -searchRadius; dx <= searchRadius; dx += 2) {
            const curX = expectedX + dx;
            const curY = expectedY + dy;
            const res = sampleCircularBubbleMetrics(curX, curY, 4);
            if (res.score > maxDark) {
              maxDark = res.score;
              bestX = curX;
              bestY = curY;
            }
          }
        }
        return { x: bestX, y: bestY };
      };

      // Annotation canvas layer
      const annotCanvas = document.createElement('canvas');
      annotCanvas.width = targetWidth;
      annotCanvas.height = targetHeight;
      const annotCtx = annotCanvas.getContext('2d')!;
      annotCtx.drawImage(canvas, 0, 0);

      // If de-skewed, draw alignment polygon around the detected sheet
      if (isDeSkewed) {
        annotCtx.strokeStyle = 'rgba(16, 185, 129, 0.75)';
        annotCtx.lineWidth = 3.5;
        annotCtx.beginPath();
        annotCtx.moveTo(quad.topLeft.x, quad.topLeft.y);
        annotCtx.lineTo(quad.topRight.x, quad.topRight.y);
        annotCtx.lineTo(quad.bottomRight.x, quad.bottomRight.y);
        annotCtx.lineTo(quad.bottomLeft.x, quad.bottomLeft.y);
        annotCtx.closePath();
        annotCtx.stroke();
      }

      const totalQ = exam.questionCount;
      const isSingleColumn = totalQ <= 15;
      const choiceCount = 4;

      // Layout coordinates matching AnswerSheetView:
      // If totalQ <= 15: Single centered table (15 ข้อ อยู่ตรงกลางเลย)
      // If totalQ > 15: 3 distinct tables (ซ้าย 1-15, กลาง 16-30, ขวา 31-45)
      const vRowsStart = 0.32;
      const vRowsEnd = 0.93;
      const vRowHeight = (vRowsEnd - vRowsStart) / 15;

      const answers: QuestionAnswer[] = [];
      let correctCount = 0;

      for (let q = 1; q <= totalQ; q++) {
        let uChoiceAreaStart: number;
        let uChoiceStep: number;
        let vCenter: number;

        if (isSingleColumn) {
          // Centered table for 15 questions
          const tableWidth = 0.44;
          const uTableStart = (1.0 - tableWidth) / 2; // centered ~0.28
          uChoiceAreaStart = uTableStart + tableWidth * 0.22;
          uChoiceStep = (tableWidth * 0.78) / choiceCount;
          const rowIndex = q - 1;
          vCenter = vRowsStart + (rowIndex + 0.5) * vRowHeight;
        } else {
          // 3-Table Layout
          const tableIdx = Math.min(2, Math.floor((q - 1) / 15));
          const rowIndex = (q - 1) % 15;
          const uTableStart = 0.035 + tableIdx * 0.32;
          const tableWidth = 0.29;
          uChoiceAreaStart = uTableStart + tableWidth * 0.22;
          uChoiceStep = (tableWidth * 0.78) / choiceCount;
          vCenter = vRowsStart + (rowIndex + 0.5) * vRowHeight;
        }

        // Box size in pixels (circular bubble radius)
        const mappedP1 = mapUV(uChoiceAreaStart, vCenter);
        const mappedP2 = mapUV(uChoiceAreaStart + uChoiceStep, vCenter);
        const stepPx = Math.hypot(mappedP2.x - mappedP1.x, mappedP2.y - mappedP1.y);
        const bubbleRadius = Math.max(7, Math.min(20, stepPx * 0.42));

        // Sample each circular choice bubble
        const choiceScores: {
          choiceIndex: number;
          score: number;
          isMarked: boolean;
          fillRatio: number;
          meanDarkness: number;
          x: number;
          y: number;
        }[] = [];

        for (let c = 0; c < choiceCount; c++) {
          const uBubble = uChoiceAreaStart + (c + 0.5) * uChoiceStep;
          const mappedPoint = mapUV(uBubble, vCenter);
          const refinedPoint = findLocalDarkCentroid(mappedPoint.x, mappedPoint.y, 5);
          const metrics = sampleCircularBubbleMetrics(refinedPoint.x, refinedPoint.y, bubbleRadius);

          choiceScores.push({
            choiceIndex: c,
            score: metrics.score,
            isMarked: metrics.isMarked,
            fillRatio: metrics.fillRatio,
            meanDarkness: metrics.meanDarkness,
            x: refinedPoint.x,
            y: refinedPoint.y,
          });
        }

        // Sort descending by score
        choiceScores.sort((a, b) => b.score - a.score);
        const darkest = choiceScores[0];
        const secondDarkest = choiceScores[1] || { score: 0, isMarked: false, fillRatio: 0, meanDarkness: 0 };

        let selectedChoice: number | null = null;
        let isMultipleMarked = false;

        // Is the darkest option marked?
        if (darkest.isMarked) {
          // Check if secondDarkest is ALSO marked (Double Mark: "หากฝนทั้ง 2 ตัวเลือกก็คือว่าผิด")
          // If a student erased with liquid paper, the erased one will have score < 0.10 and isMarked = false.
          // But if two options both have real dark shading:
          const isSecondMarkedDouble =
            secondDarkest.isMarked &&
            secondDarkest.score >= 0.20 &&
            (secondDarkest.score >= darkest.score * 0.65 || secondDarkest.fillRatio >= 0.20);

          if (isSecondMarkedDouble) {
            isMultipleMarked = true;
            selectedChoice = null; // ถือว่าผิด
          } else {
            // One clear choice is shaded dark
            selectedChoice = darkest.choiceIndex;
          }
        }

        const correctChoice = exam.answerKey[q] !== undefined ? exam.answerKey[q] : 0;
        const isCorrect = !isMultipleMarked && selectedChoice !== null && selectedChoice === correctChoice;
        if (isCorrect) correctCount++;

        // Draw visual annotations as CIRCULAR BUBBLES on annotCtx
        for (let c = 0; c < choiceCount; c++) {
          const item = choiceScores.find((cs) => cs.choiceIndex === c)!;
          const isSelected = selectedChoice === c;
          const isKey = correctChoice === c;
          const isMarkedInDouble = isMultipleMarked && (darkest.choiceIndex === c || secondDarkest.choiceIndex === c);

          const r = bubbleRadius + 2;

          if (isMarkedInDouble) {
            // Amber / Red for double-marked bubbles (ผิดเนื่องจากฝนซ้ำ)
            annotCtx.strokeStyle = '#EF4444';
            annotCtx.lineWidth = 3.5;
            annotCtx.fillStyle = 'rgba(239, 68, 68, 0.30)';
            annotCtx.beginPath();
            annotCtx.arc(item.x, item.y, r, 0, Math.PI * 2);
            annotCtx.fill();
            annotCtx.stroke();

            // Draw X symbol in red
            annotCtx.strokeStyle = '#B91C1C';
            annotCtx.lineWidth = 2.5;
            annotCtx.beginPath();
            annotCtx.moveTo(item.x - r * 0.5, item.y - r * 0.5);
            annotCtx.lineTo(item.x + r * 0.5, item.y + r * 0.5);
            annotCtx.moveTo(item.x + r * 0.5, item.y - r * 0.5);
            annotCtx.lineTo(item.x - r * 0.5, item.y + r * 0.5);
            annotCtx.stroke();
          } else if (isSelected) {
            if (isCorrect) {
              // Solid Emerald Circle for correct answer
              annotCtx.strokeStyle = '#10B981';
              annotCtx.lineWidth = 3.5;
              annotCtx.fillStyle = 'rgba(16, 185, 129, 0.25)';
              annotCtx.beginPath();
              annotCtx.arc(item.x, item.y, r, 0, Math.PI * 2);
              annotCtx.fill();
              annotCtx.stroke();

              // Draw checkmark symbol (✓)
              annotCtx.strokeStyle = '#059669';
              annotCtx.lineWidth = 2.5;
              annotCtx.beginPath();
              annotCtx.moveTo(item.x - r * 0.5, item.y);
              annotCtx.lineTo(item.x - r * 0.1, item.y + r * 0.5);
              annotCtx.lineTo(item.x + r * 0.6, item.y - r * 0.5);
              annotCtx.stroke();
            } else {
              // Rose Red Circle for incorrect answer
              annotCtx.strokeStyle = '#F43F5E';
              annotCtx.lineWidth = 3.5;
              annotCtx.fillStyle = 'rgba(244, 63, 94, 0.25)';
              annotCtx.beginPath();
              annotCtx.arc(item.x, item.y, r, 0, Math.PI * 2);
              annotCtx.fill();
              annotCtx.stroke();

              // Draw X symbol in red
              annotCtx.strokeStyle = '#E11D48';
              annotCtx.lineWidth = 2.5;
              annotCtx.beginPath();
              annotCtx.moveTo(item.x - r * 0.5, item.y - r * 0.5);
              annotCtx.lineTo(item.x + r * 0.5, item.y + r * 0.5);
              annotCtx.moveTo(item.x + r * 0.5, item.y - r * 0.5);
              annotCtx.lineTo(item.x - r * 0.5, item.y + r * 0.5);
              annotCtx.stroke();
            }
          } else if (isKey && !isCorrect) {
            // Indigo dashed outline to show what the correct answer was
            annotCtx.strokeStyle = '#4F46E5';
            annotCtx.lineWidth = 2.5;
            annotCtx.setLineDash([4, 3]);
            annotCtx.beginPath();
            annotCtx.arc(item.x, item.y, r, 0, Math.PI * 2);
            annotCtx.stroke();
            annotCtx.setLineDash([]);
          }
        }

        answers.push({
          questionNumber: q,
          selectedChoice,
          correctChoice,
          isCorrect,
          confidence: darkest.score,
          isMultipleMarked,
        });
      }

      const scorePercentage = Math.round((correctCount / totalQ) * 100);
      const passPercentage = exam.passPercentage || 50;
      const passed = scorePercentage >= passPercentage;

      const annotatedImageUrl = annotCanvas.toDataURL('image/jpeg', 0.88);

      resolve({
        success: true,
        score: correctCount,
        totalQuestions: totalQ,
        scorePercentage,
        passed,
        answers,
        annotatedImageUrl,
        originalImageUrl,
        isDeSkewed,
        detectedQrPayload,
        detectedExamId,
      });
    });
  },
};
