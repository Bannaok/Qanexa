import { ChoiceCount, Exam, QuestionAnswer, ScanResult } from '../types';

export interface ScanProcessingOptions {
  sensitivity?: number; // 0.1 to 0.9 (default 0.30 for flexible mark detection)
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
   * Process an image (from camera or file upload) against an Exam definition.
   * Features automatic skew & perspective correction to handle tilted photos.
   * Supports square choice boxes with flexible detection:
   *  - เส้นกากบาท (X-marks)
   *  - ขีดคล้ายๆ กากบาท (Slanted strokes, checkmarks, slashes, casual crosses)
   *  - การฝนดินสอดำ (Full shading)
   */
  async processSheetImage(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    exam: Exam,
    options: ScanProcessingOptions = {}
  ): Promise<ScanAnalysisResult> {
    const { sensitivity = 0.28 } = options;

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

      // 1. Calculate Average Paper Luminance
      let totalLuminance = 0;
      let sampleCount = 0;
      for (let y = 60; y < targetHeight - 60; y += 12) {
        for (let x = 60; x < targetWidth - 60; x += 12) {
          const idx = (y * targetWidth + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          totalLuminance += lum;
          sampleCount++;
        }
      }
      const avgPaperLuminance = sampleCount > 0 ? totalLuminance / sampleCount : 200;
      const darkMarkerThreshold = Math.min(115, avgPaperLuminance * 0.58);

      // 2. Corner Marker Detection for Skew / Perspective Distortion Correction
      const findCornerMarker = (
        minX: number,
        maxX: number,
        minY: number,
        maxY: number
      ): Point | null => {
        let sumX = 0;
        let sumY = 0;
        let count = 0;

        for (let y = Math.floor(minY); y < maxY; y += 4) {
          for (let x = Math.floor(minX); x < maxX; x += 4) {
            const idx = (y * targetWidth + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            if (lum < darkMarkerThreshold) {
              sumX += x;
              sumY += y;
              count++;
            }
          }
        }

        if (count >= 15) {
          return { x: sumX / count, y: sumY / count };
        }
        return null;
      };

      const w = targetWidth;
      const h = targetHeight;

      // Search 4 corner quadrants
      const tl = findCornerMarker(w * 0.01, w * 0.30, h * 0.01, h * 0.25);
      const tr = findCornerMarker(w * 0.70, w * 0.99, h * 0.01, h * 0.25);
      const bl = findCornerMarker(w * 0.01, w * 0.30, h * 0.75, h * 0.99);
      const br = findCornerMarker(w * 0.70, w * 0.99, h * 0.75, h * 0.99);

      let isDeSkewed = false;
      let quad: CornerQuad;

      if (tl && tr && bl && br) {
        quad = { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl };
        isDeSkewed = true;
      } else if (tl && tr && bl) {
        const calculatedBR = { x: tr.x + (bl.x - tl.x), y: tr.y + (bl.y - tl.y) };
        quad = { topLeft: tl, topRight: tr, bottomRight: calculatedBR, bottomLeft: bl };
        isDeSkewed = true;
      } else if (tl && tr && br) {
        const calculatedBL = { x: tl.x + (br.x - tr.x), y: tl.y + (br.y - tr.y) };
        quad = { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: calculatedBL };
        isDeSkewed = true;
      } else {
        quad = {
          topLeft: { x: w * 0.05, y: h * 0.04 },
          topRight: { x: w * 0.95, y: h * 0.04 },
          bottomRight: { x: w * 0.95, y: h * 0.96 },
          bottomLeft: { x: w * 0.05, y: h * 0.96 },
        };
      }

      // Bilinear coordinate mapping: maps normalized paper coordinates (u in [0,1], v in [0,1]) to skewed image coordinates
      const mapUV = (u: number, v: number): Point => {
        const topX = quad.topLeft.x + u * (quad.topRight.x - quad.topLeft.x);
        const topY = quad.topLeft.y + u * (quad.topRight.y - quad.topLeft.y);
        const botX = quad.bottomLeft.x + u * (quad.bottomRight.x - quad.bottomLeft.x);
        const botY = quad.bottomLeft.y + u * (quad.bottomRight.y - quad.bottomLeft.y);

        const x = topX + v * (botX - topX);
        const y = topY + v * (botY - topY);
        return { x, y };
      };

      /**
       * Sample inside a square choice box.
       * Detects:
       * 1) เส้นกากบาท (Clear X-marks)
       * 2) ขีดคล้ายๆ กากบาท (Slashes, diagonal marks, casual checks, strokes)
       * 3) การฝนเต็มช่อง (Shaded boxes)
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

        let mainDiagDark = 0;
        let antiDiagDark = 0;
        let quad1Dark = 0; // top-left
        let quad2Dark = 0; // top-right
        let quad3Dark = 0; // bottom-left
        let quad4Dark = 0; // bottom-right

        // Sample inside 0.74 * boxRadius to strictly ignore the outer black printed border line
        const innerHalf = Math.max(3, Math.floor(boxRadius * 0.74));

        for (let dy = -innerHalf; dy <= innerHalf; dy += 2) {
          for (let dx = -innerHalf; dx <= innerHalf; dx += 2) {
            const px = Math.floor(centerX + dx);
            const py = Math.floor(centerY + dy);
            if (px >= 0 && px < targetWidth && py >= 0 && py < targetHeight) {
              const idx = (py * targetWidth + px) * 4;
              const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              const darkness = Math.max(0, (avgPaperLuminance - lum) / avgPaperLuminance);
              darkSum += darkness;
              points++;

              // Contrast threshold: a pencil or pen stroke is distinctly darker than background paper
              if (darkness > 0.22) {
                strokePoints++;
                if (darkness > maxLocalDark) {
                  maxLocalDark = darkness;
                }

                // Main diagonal (TL to BR)
                if (Math.abs(dx - dy) <= 2.5) mainDiagDark++;
                // Anti diagonal (TR to BL)
                if (Math.abs(dx + dy) <= 2.5) antiDiagDark++;

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

        // Check quadrant spread
        let quadrantHits = 0;
        if (quad1Dark >= 1) quadrantHits++;
        if (quad2Dark >= 1) quadrantHits++;
        if (quad3Dark >= 1) quadrantHits++;
        if (quad4Dark >= 1) quadrantHits++;

        // 1. Is it a clear X-cross?
        const isXMark = (mainDiagDark >= 2 && antiDiagDark >= 2) || (quadrantHits >= 3 && strokeRatio >= 0.08);

        // 2. Is it a flexible stroke? (ขีดคล้ายๆ กากบาท เช่น ขีดเฉียง / กาถูก ✓ / ขีดขวาง / ขีดทับ)
        const isFlexibleStroke =
          strokeRatio >= 0.06 &&
          (mainDiagDark >= 2 || antiDiagDark >= 2 || quadrantHits >= 2 || maxLocalDark >= 0.35);

        // Compute overall score
        let score = 0;
        if (isXMark) {
          score = Math.max(0.72, strokeRatio * 2.4 + maxLocalDark * 0.2);
        } else if (isFlexibleStroke) {
          // ขีดคล้ายๆ กากบาท ให้คะแนนความมั่นใจสูงพอที่จะนับว่าตอบ
          score = Math.max(0.50, strokeRatio * 2.2 + maxLocalDark * 0.2);
        } else if (meanDarkness > 0.28) {
          // ฝนทึบ
          score = meanDarkness;
        } else if (strokeRatio >= 0.05) {
          // รอยขีดเส้นบาง
          score = strokeRatio * 2.0;
        } else {
          score = meanDarkness;
        }

        const isMarked = isXMark || isFlexibleStroke || score >= 0.25;

        return {
          score,
          isMarked,
          isXMark,
          isFlexibleStroke,
          meanDarkness,
        };
      };

      // Centroid micro-search
      const findLocalDarkCentroid = (expectedX: number, expectedY: number, searchRadius = 7): Point => {
        let maxDark = -1;
        let bestX = expectedX;
        let bestY = expectedY;

        for (let dy = -searchRadius; dy <= searchRadius; dy += 3) {
          for (let dx = -searchRadius; dx <= searchRadius; dx += 3) {
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
        annotCtx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
        annotCtx.lineWidth = 3;
        annotCtx.beginPath();
        annotCtx.moveTo(quad.topLeft.x, quad.topLeft.y);
        annotCtx.lineTo(quad.topRight.x, quad.topRight.y);
        annotCtx.lineTo(quad.bottomRight.x, quad.bottomRight.y);
        annotCtx.lineTo(quad.bottomLeft.x, quad.bottomLeft.y);
        annotCtx.closePath();
        annotCtx.stroke();
      }

      const totalQ = exam.questionCount;
      const numCols = totalQ <= 20 ? 1 : totalQ <= 40 ? 2 : totalQ <= 60 ? 3 : 4;
      const qPerCol = Math.ceil(totalQ / numCols);
      const choiceCount = exam.choiceCount;

      const vGridTop = 0.22;
      const vGridBottom = 0.94;
      const vRowHeight = (vGridBottom - vGridTop) / qPerCol;

      const uGridLeft = 0.05;
      const uGridRight = 0.95;
      const uColWidth = (uGridRight - uGridLeft) / numCols;

      const answers: QuestionAnswer[] = [];
      let correctCount = 0;

      for (let q = 1; q <= totalQ; q++) {
        const colIndex = Math.floor((q - 1) / qPerCol);
        const rowIndex = (q - 1) % qPerCol;

        const uColStart = uGridLeft + colIndex * uColWidth;
        const vCenter = vGridTop + rowIndex * vRowHeight + vRowHeight * 0.5;

        const uChoiceStart = uColStart + uColWidth * 0.26;
        const uChoiceEnd = uColStart + uColWidth * 0.95;
        const uChoiceStep = (uChoiceEnd - uChoiceStart) / (choiceCount - 1);

        // Box size in pixels
        const mappedP1 = mapUV(uChoiceStart, vCenter);
        const mappedP2 = mapUV(uChoiceStart + uChoiceStep, vCenter);
        const stepPx = Math.hypot(mappedP2.x - mappedP1.x, mappedP2.y - mappedP1.y);
        const boxRadius = Math.max(7, Math.min(18, stepPx * 0.36));

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
          const uBubble = uChoiceStart + c * uChoiceStep;
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
        const secondDarkest = choiceScores[1];

        let selectedChoice: number | null = null;
        let isMultipleMarked = false;

        // Flexible recognition logic:
        // 1. If darkest is an X-mark, flexible stroke, or exceeds sensitivity threshold
        // 2. AND is clearly distinct from the second darkest (not an accidental double mark)
        const isCandidate =
          darkest.isXMark ||
          darkest.isFlexibleStroke ||
          darkest.score >= sensitivity ||
          (darkest.score >= 0.22 && darkest.score >= secondDarkest.score + 0.12);

        if (isCandidate) {
          if (
            secondDarkest.score >= sensitivity &&
            secondDarkest.score > darkest.score * 0.75 &&
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

              // Draw small checkmark symbol (✓)
              annotCtx.strokeStyle = '#059669';
              annotCtx.lineWidth = 2.5;
              annotCtx.beginPath();
              annotCtx.moveTo(item.x - halfSize * 0.5, item.y);
              annotCtx.lineTo(item.x - halfSize * 0.1, item.y + halfSize * 0.5);
              annotCtx.lineTo(item.x + halfSize * 0.6, item.y - halfSize * 0.5);
              annotCtx.stroke();
            } else {
              // Solid Red Square for wrong answer
              annotCtx.strokeStyle = '#EF4444';
              annotCtx.lineWidth = 3.5;
              annotCtx.fillStyle = 'rgba(239, 68, 68, 0.25)';
              annotCtx.beginPath();
              annotCtx.rect(item.x - halfSize, item.y - halfSize, boxSize, boxSize);
              annotCtx.fill();
              annotCtx.stroke();
            }
          }

          // If student was wrong or blank, highlight the correct answer with a Dashed Green Square
          if (!isCorrect && isKey) {
            annotCtx.strokeStyle = '#059669';
            annotCtx.lineWidth = 3;
            annotCtx.setLineDash([4, 3]);
            annotCtx.beginPath();
            annotCtx.rect(item.x - halfSize - 1, item.y - halfSize - 1, boxSize + 2, boxSize + 2);
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
      const passed = scorePercentage >= exam.passPercentage;

      const annotatedImageUrl = annotCanvas.toDataURL('image/jpeg', 0.85);

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
      });
    });
  },

  /**
   * Converts a user uploaded File (Blob) into an HTMLImageElement
   */
  async fileToImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  },
};
