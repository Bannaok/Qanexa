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
}

interface Point {
  x: number;
  y: number;
}

interface CornerQuad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export const omrScannerEngine = {
  /**
   * Scans an image/canvas for any embedded Exam QR code using jsQR.
   * Features:
   *  - Multi-scale search (full, half, and top-half crop where exam QR is located)
   *  - Supports high-resolution and low-resolution frames effortlessly
   *  - Binarization & contrast boost for dim/shadowy paper environments
   */
  readQRCode(
    imageSource: HTMLImageElement | HTMLCanvasElement | ImageData | HTMLVideoElement
  ): { rawData: string; examId?: string; title?: string } | null {
    try {
      let canvas: HTMLCanvasElement;
      let ctx: CanvasRenderingContext2D | null;

      if (imageSource instanceof ImageData) {
        canvas = document.createElement('canvas');
        canvas.width = imageSource.width;
        canvas.height = imageSource.height;
        ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.putImageData(imageSource, 0, 0);
      } else {
        const w = (imageSource as HTMLVideoElement).videoWidth || imageSource.width;
        const h = (imageSource as HTMLVideoElement).videoHeight || imageSource.height;
        if (!w || !h) return null;

        canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(imageSource as CanvasImageSource, 0, 0, w, h);
      }

      const w = canvas.width;
      const h = canvas.height;

      const parseResult = (codeData: string) => {
        try {
          const parsed = JSON.parse(codeData);
          return {
            rawData: codeData,
            examId: parsed.id || parsed.examId,
            title: parsed.title,
          };
        } catch {
          return {
            rawData: codeData,
            examId: codeData,
          };
        }
      };

      // Pass 1: Try reading directly from top-right quadrant or top half where QR lives (super fast & reliable)
      const topHalfCanvas = document.createElement('canvas');
      const topHalfW = Math.min(640, w);
      const topHalfH = Math.min(640, Math.round(h * 0.45));
      topHalfCanvas.width = topHalfW;
      topHalfCanvas.height = topHalfH;
      const topCtx = topHalfCanvas.getContext('2d');
      if (topCtx) {
        topCtx.drawImage(canvas, 0, 0, w, h * 0.45, 0, 0, topHalfW, topHalfH);
        const topImgData = topCtx.getImageData(0, 0, topHalfW, topHalfH);
        const code = jsQR(topImgData.data, topHalfW, topHalfH, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) {
          return parseResult(code.data);
        }
      }

      // Pass 2: Downsampled full-frame (optimal resolution ~600px width for jsQR)
      const targetW = Math.min(720, w);
      const targetH = Math.round((h / w) * targetW);
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = targetW;
      scaledCanvas.height = targetH;
      const scaledCtx = scaledCanvas.getContext('2d');
      if (scaledCtx) {
        scaledCtx.drawImage(canvas, 0, 0, targetW, targetH);
        const scaledImgData = scaledCtx.getImageData(0, 0, targetW, targetH);
        const code = jsQR(scaledImgData.data, targetW, targetH, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) {
          return parseResult(code.data);
        }
      }

      // Pass 3: Original raw dimensions fallback if not too enormous
      if (w <= 1280 && h <= 1280) {
        const fullImgData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(fullImgData.data, w, h, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) {
          return parseResult(code.data);
        }
      }

      return null;
    } catch (e) {
      console.warn('QR code decode error', e);
      return null;
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
      const darkMarkerThreshold = Math.min(115, avgPaperLuminance * 0.58);

      // 2. Robust Corner Marker Detection for Skew / Perspective Distortion Correction
      // Looks for dense dark square fiducials printed at the 4 corners of the A5/A4 sheet
      const findCornerMarker = (
        minX: number,
        maxX: number,
        minY: number,
        maxY: number
      ): Point | null => {
        let sumX = 0;
        let sumY = 0;
        let count = 0;

        for (let y = Math.floor(minY); y < maxY; y += 3) {
          for (let x = Math.floor(minX); x < maxX; x += 3) {
            const idx = (y * targetWidth + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            if (lum < darkMarkerThreshold) {
              sumX += x;
              sumY += y;
              count++;
            }
          }
        }

        // Accepts compact dark corner block (at least 8 sampled dark pixels)
        if (count >= 8) {
          return { x: sumX / count, y: sumY / count };
        }
        return null;
      };

      const w = targetWidth;
      const h = targetHeight;

      // Search 4 corner quadrants with wide search margins for typical phone viewing angles
      const tl = findCornerMarker(w * 0.01, w * 0.40, h * 0.01, h * 0.32);
      const tr = findCornerMarker(w * 0.60, w * 0.99, h * 0.01, h * 0.32);
      const bl = findCornerMarker(w * 0.01, w * 0.40, h * 0.68, h * 0.99);
      const br = findCornerMarker(w * 0.60, w * 0.99, h * 0.68, h * 0.99);

      let isDeSkewed = false;
      let quad: CornerQuad;

      if (tl && tr && bl && br) {
        quad = { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl };
        isDeSkewed = true;
      } else {
        // Fallback quadrilateral tuned to typical smartphone camera framing
        quad = {
          topLeft: { x: w * 0.05, y: h * 0.05 },
          topRight: { x: w * 0.95, y: h * 0.05 },
          bottomRight: { x: w * 0.95, y: h * 0.95 },
          bottomLeft: { x: w * 0.05, y: h * 0.95 },
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
       * Highly optimized Cross-Mark (กากบาท X) and Bubble Analyzer.
       * Supports both Pencil (ดินสอ 2B/HB graphite) and Pen (ปากกาน้ำเงิน/ดำ/แดง/เจล).
       */
      const sampleSquareBoxMetrics = (
        centerX: number,
        centerY: number,
        boxRadius: number
      ): {
        score: number;
        isMarked: boolean;
        isXMark: boolean;
        isFlexibleStroke: boolean;
        meanDarkness: number;
      } => {
        let darkSum = 0;
        let points = 0;
        let strokePoints = 0;
        let maxLocalDark = 0;

        let mainDiagDark = 0; // Top-Left to Bottom-Right (x ≈ y)
        let antiDiagDark = 0; // Top-Right to Bottom-Left (x ≈ -y)
        let centerInk = 0;    // Ink right at the cross intersection
        let quad1Dark = 0;    // Top-Left
        let quad2Dark = 0;    // Top-Right
        let quad3Dark = 0;    // Bottom-Left
        let quad4Dark = 0;    // Bottom-Right

        // Sample inside 0.76 * boxRadius to strictly ignore outer printed border
        const innerHalf = Math.max(3, Math.floor(boxRadius * 0.76));

        for (let dy = -innerHalf; dy <= innerHalf; dy += 2) {
          for (let dx = -innerHalf; dx <= innerHalf; dx += 2) {
            const px = Math.floor(centerX + dx);
            const py = Math.floor(centerY + dy);
            if (px >= 0 && px < targetWidth && py >= 0 && py < targetHeight) {
              const idx = (py * targetWidth + px) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;

              // Luminance darkness (for pencil & black ink)
              const lumDarkness = Math.max(0, (avgPaperLuminance - lum) / avgPaperLuminance);

              // Chromatic ink absorption (for blue pen, red pen, colored gel pens)
              const redAbsorption = Math.max(0, (avgPaperR - r) / 255);
              const greenAbsorption = Math.max(0, (avgPaperG - g) / 255);
              const blueAbsorption = Math.max(0, (avgPaperB - b) / 255);
              const colorAbsorption = Math.max(redAbsorption * 1.25, greenAbsorption * 1.1, blueAbsorption);

              // Effective ink contrast: catches both pencil (gray) and pen ink (blue/black/red)
              const effectiveDarkness = Math.max(lumDarkness, colorAbsorption);

              darkSum += effectiveDarkness;
              points++;

              // Pencil threshold (> 0.14) & Pen threshold:
              // Extremely sensitive to pencil graphite strokes without picking up white paper grain
              if (effectiveDarkness > 0.14) {
                strokePoints++;
                if (effectiveDarkness > maxLocalDark) {
                  maxLocalDark = effectiveDarkness;
                }

                // Check intersection at center
                if (Math.abs(dx) <= 2.5 && Math.abs(dy) <= 2.5) {
                  centerInk++;
                }

                // Main diagonal (Top-Left to Bottom-Right)
                if (Math.abs(dx - dy) <= 3.0) mainDiagDark++;
                // Anti diagonal (Top-Right to Bottom-Left)
                if (Math.abs(dx + dy) <= 3.0) antiDiagDark++;

                // Quadrants
                if (dx < 0 && dy < 0) quad1Dark++;
                else if (dx > 0 && dy < 0) quad2Dark++;
                else if (dx < 0 && dy > 0) quad3Dark++;
                else if (dx > 0 && dy > 0) quad4Dark++;
              }
            }
          }
        }

        if (points === 0) {
          return { score: 0, isMarked: false, isXMark: false, isFlexibleStroke: false, meanDarkness: 0 };
        }

        const meanDarkness = darkSum / points;
        const strokeRatio = strokePoints / points;

        let quadrantHits = 0;
        if (quad1Dark >= 1) quadrantHits++;
        if (quad2Dark >= 1) quadrantHits++;
        if (quad3Dark >= 1) quadrantHits++;
        if (quad4Dark >= 1) quadrantHits++;

        // 1. True Cross Mark (กากบาท X):
        // Two intersecting diagonal strokes or stroke covering at least 3 quadrants
        const isXMark =
          (mainDiagDark >= 2 && antiDiagDark >= 2) ||
          (quadrantHits >= 3 && strokeRatio >= 0.07) ||
          (centerInk >= 1 && (mainDiagDark >= 2 || antiDiagDark >= 2) && strokeRatio >= 0.06);

        // 2. Flexible stroke (ขีดเฉียง / กาถูก ✓ / ขีดทับช่อง):
        const isFlexibleStroke =
          strokeRatio >= 0.05 &&
          (mainDiagDark >= 2 || antiDiagDark >= 2 || quadrantHits >= 2 || maxLocalDark >= 0.32);

        // Score formulation
        let score = 0;
        if (isXMark) {
          score = Math.max(0.75, strokeRatio * 2.6 + maxLocalDark * 0.25);
        } else if (isFlexibleStroke) {
          score = Math.max(0.52, strokeRatio * 2.3 + maxLocalDark * 0.2);
        } else if (meanDarkness > 0.24) {
          // Shaded / bubbled
          score = Math.max(0.68, meanDarkness * 2.2);
        } else if (strokeRatio >= 0.05) {
          score = strokeRatio * 2.2;
        } else {
          score = meanDarkness;
        }

        const isMarked = isXMark || isFlexibleStroke || score >= 0.24;

        return {
          score,
          isMarked,
          isXMark,
          isFlexibleStroke,
          meanDarkness,
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
            const res = sampleSquareBoxMetrics(curX, curY, 4);
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
      // Strictly 4 choices (ก, ข, ค, ง)
      const choiceCount = 4;

      // 3-Table Layout coordinates matching AnswerSheetView:
      // Table 0 (Left): Questions 1 - 15
      // Table 1 (Center): Questions 16 - 30
      // Table 2 (Right): Questions 31 - 45
      // Rows start below student info header and end leaving bottom breathing space
      const vRowsStart = 0.32;
      const vRowsEnd = 0.93;
      const vRowHeight = (vRowsEnd - vRowsStart) / 15;

      const answers: QuestionAnswer[] = [];
      let correctCount = 0;

      for (let q = 1; q <= totalQ; q++) {
        const tableIdx = Math.min(2, Math.floor((q - 1) / 15));
        const rowIndex = (q - 1) % 15;

        // Table horizontal coordinates: 3 tables evenly spaced
        const uTableStart = 0.035 + tableIdx * 0.32;
        const tableWidth = 0.29;
        // Inside table: Number column is 22%, 4 Choice columns take 78%
        const uChoiceAreaStart = uTableStart + tableWidth * 0.22;
        const uChoiceStep = (tableWidth * 0.78) / choiceCount;

        const vCenter = vRowsStart + (rowIndex + 0.5) * vRowHeight;

        // Box size in pixels (virtually 1:1 square)
        const mappedP1 = mapUV(uChoiceAreaStart, vCenter);
        const mappedP2 = mapUV(uChoiceAreaStart + uChoiceStep, vCenter);
        const stepPx = Math.hypot(mappedP2.x - mappedP1.x, mappedP2.y - mappedP1.y);
        const boxRadius = Math.max(7, Math.min(20, stepPx * 0.44));

        // Sample each square choice box
        const choiceScores: {
          choiceIndex: number;
          score: number;
          isMarked: boolean;
          isXMark: boolean;
          isFlexibleStroke: boolean;
          x: number;
          y: number;
        }[] = [];

        for (let c = 0; c < choiceCount; c++) {
          const uBubble = uChoiceAreaStart + (c + 0.5) * uChoiceStep;
          const mappedPoint = mapUV(uBubble, vCenter);
          const refinedPoint = findLocalDarkCentroid(mappedPoint.x, mappedPoint.y, 5);
          const metrics = sampleSquareBoxMetrics(refinedPoint.x, refinedPoint.y, boxRadius);

          choiceScores.push({
            choiceIndex: c,
            score: metrics.score,
            isMarked: metrics.isMarked,
            isXMark: metrics.isXMark,
            isFlexibleStroke: metrics.isFlexibleStroke,
            x: refinedPoint.x,
            y: refinedPoint.y,
          });
        }

        // Sort descending by score
        choiceScores.sort((a, b) => b.score - a.score);
        const darkest = choiceScores[0];
        const secondDarkest = choiceScores[1] || { score: 0 };

        let selectedChoice: number | null = null;
        let isMultipleMarked = false;

        // Enhanced candidate criteria:
        // Catches pencil, pen, and X-marks even with low contrast or light pressure
        const isCandidate =
          darkest.isXMark ||
          darkest.isFlexibleStroke ||
          darkest.score >= sensitivity ||
          (darkest.score >= 0.20 && darkest.score >= secondDarkest.score * 1.4);

        if (isCandidate) {
          if (
            secondDarkest.score >= sensitivity &&
            secondDarkest.score > darkest.score * 0.80 &&
            (secondDarkest.isXMark || secondDarkest.isFlexibleStroke)
          ) {
            isMultipleMarked = true;
            selectedChoice = null;
          } else {
            selectedChoice = darkest.choiceIndex;
          }
        }

        const correctChoice = exam.answerKey[q] !== undefined ? exam.answerKey[q] : 0;
        const isCorrect = selectedChoice !== null && selectedChoice === correctChoice;
        if (isCorrect) correctCount++;

        // Draw visual annotations as SQUARE BOXES on annotCtx
        for (let c = 0; c < choiceCount; c++) {
          const item = choiceScores.find((cs) => cs.choiceIndex === c)!;
          const isSelected = selectedChoice === c;
          const isKey = correctChoice === c;

          const boxSize = (boxRadius + 2) * 2;
          const halfSize = boxSize / 2;

          if (isSelected) {
            if (isCorrect) {
              // Solid Emerald Square for correct answer
              annotCtx.strokeStyle = '#10B981';
              annotCtx.lineWidth = 3.5;
              annotCtx.fillStyle = 'rgba(16, 185, 129, 0.25)';
              annotCtx.beginPath();
              annotCtx.rect(item.x - halfSize, item.y - halfSize, boxSize, boxSize);
              annotCtx.fill();
              annotCtx.stroke();

              // Draw checkmark symbol (✓)
              annotCtx.strokeStyle = '#059669';
              annotCtx.lineWidth = 2.5;
              annotCtx.beginPath();
              annotCtx.moveTo(item.x - halfSize * 0.5, item.y);
              annotCtx.lineTo(item.x - halfSize * 0.1, item.y + halfSize * 0.5);
              annotCtx.lineTo(item.x + halfSize * 0.6, item.y - halfSize * 0.5);
              annotCtx.stroke();
            } else {
              // Rose Red Square for incorrect answer
              annotCtx.strokeStyle = '#F43F5E';
              annotCtx.lineWidth = 3.5;
              annotCtx.fillStyle = 'rgba(244, 63, 94, 0.25)';
              annotCtx.beginPath();
              annotCtx.rect(item.x - halfSize, item.y - halfSize, boxSize, boxSize);
              annotCtx.fill();
              annotCtx.stroke();

              // Draw X symbol in red
              annotCtx.strokeStyle = '#E11D48';
              annotCtx.lineWidth = 2.5;
              annotCtx.beginPath();
              annotCtx.moveTo(item.x - halfSize * 0.5, item.y - halfSize * 0.5);
              annotCtx.lineTo(item.x + halfSize * 0.5, item.y + halfSize * 0.5);
              annotCtx.moveTo(item.x + halfSize * 0.5, item.y - halfSize * 0.5);
              annotCtx.lineTo(item.x - halfSize * 0.5, item.y + halfSize * 0.5);
              annotCtx.stroke();
            }
          } else if (isKey && !isCorrect) {
            // Amber / Indigo outline to show what the correct answer was
            annotCtx.strokeStyle = '#4F46E5';
            annotCtx.lineWidth = 2;
            annotCtx.setLineDash([3, 2]);
            annotCtx.beginPath();
            annotCtx.rect(item.x - halfSize, item.y - halfSize, boxSize, boxSize);
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
