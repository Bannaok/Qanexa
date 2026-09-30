import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { Exam } from '../types';

/**
 * Fast deterministic hash of the answer key and question count.
 * Changes whenever any answer key is altered, guaranteeing that
 * the generated QR code and answer sheet version immediately update.
 */
export function computeExamAnswerKeyHash(
  answerKey: Record<number, number> | undefined,
  questionCount: number
): string {
  if (!answerKey) return 'k0';
  let keyString = '';
  for (let i = 1; i <= questionCount; i++) {
    keyString += `${i}:${answerKey[i] ?? -1};`;
  }
  let hash = 0x811c9dc5;
  for (let i = 0; i < keyString.length; i++) {
    hash ^= keyString.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return 'k' + hash.toString(36);
}

export const getExamQRPayload = (exam: Exam): string => {
  // Enhanced payload containing subject, grade level, and answer key checksum
  // Changes every time answers or questions are modified
  const keyHash = computeExamAnswerKeyHash(exam.answerKey, exam.questionCount);
  const titleSafe = encodeURIComponent(exam.title || '').slice(0, 40);
  const gradeSafe = encodeURIComponent(exam.gradeLevel || '').slice(0, 30);
  const updateTs = exam.updatedAt ? new Date(exam.updatedAt).getTime() : Date.now();
  return `EXAM:v2|${exam.id}|${exam.questionCount}|${keyHash}|${titleSafe}|${gradeSafe}|${updateTs}`;
};

export const pdfGenerator = {
  /**
   * Generates a 100% faithful, high-resolution A4 Landscape PDF Answer Sheet (297mm x 210mm).
   * 1 A4 sheet contains 2 identical answer sheets side-by-side (half A4 each, cut down the middle).
   */
  async downloadPDFFromElement(element: HTMLElement, exam: Exam): Promise<void> {
    // 1. Create an isolated off-screen sandbox container (A4 landscape: 1123px x 794px at 96 DPI)
    const sandbox = document.createElement('div');
    sandbox.style.position = 'fixed';
    sandbox.style.left = '-9999px';
    sandbox.style.top = '0';
    sandbox.style.width = '1123px'; // 297mm at 96 DPI
    sandbox.style.height = '794px'; // 210mm at 96 DPI
    sandbox.style.minHeight = '794px';
    sandbox.style.maxHeight = '794px';
    sandbox.style.backgroundColor = '#ffffff';
    sandbox.style.zIndex = '-9999';
    sandbox.style.overflow = 'hidden';

    // 2. Clone the answer sheet element
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';
    clone.style.margin = '0';
    clone.style.width = '1123px';
    clone.style.height = '794px';
    clone.style.minHeight = '794px';
    clone.style.maxHeight = '794px';
    clone.style.boxSizing = 'border-box';
    clone.style.boxShadow = 'none';
    clone.style.borderRadius = '0';
    clone.style.backgroundColor = '#ffffff';
    clone.style.border = '2px solid #0f172a';

    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);

    try {
      if (document.fonts) {
        await document.fonts.ready;
      }
      await new Promise((r) => setTimeout(r, 200));

      // Capture at scale: 2 (crisp high-DPI quality)
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 1123,
        height: 794,
        windowWidth: 1123,
        windowHeight: 794,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      // Create PDF A4 Landscape: 297mm x 210mm
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
      const safeTitle = (exam.title || 'answer_sheet').replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
      pdf.save(`กระดาษคำตอบA4แนวนอน_2ชุด_${safeTitle}.pdf`);
    } finally {
      if (document.body.contains(sandbox)) {
        document.body.removeChild(sandbox);
      }
    }
  },

  /**
   * High-fidelity Canvas-rendered PDF fallback for A4 Landscape (2 answer sheets in 1 page).
   * Matches the exact 2-table layout: Left frame (1-20), Right frame (21-40) and full-width dotted student fields.
   */
  async downloadPDF(exam: Exam, _orgName?: string, precomputedQR?: string): Promise<void> {
    const width = 2246; // 1123 * 2
    const height = 1588; // 794 * 2
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // QR Code Image
    let qrImg: HTMLImageElement | null = null;
    try {
      const qrDataUrl =
        precomputedQR ||
        (await QRCode.toDataURL(getExamQRPayload(exam), {
          margin: 3,
          width: 360,
          errorCorrectionLevel: 'M',
        }));
      qrImg = new Image();
      qrImg.src = qrDataUrl;
      await new Promise((res) => {
        if (qrImg) qrImg.onload = res;
      });
    } catch {}

    const halfWidth = width / 2;
    const choiceLabels =
      exam.choiceLabelType === 'latin'
        ? ['A', 'B', 'C', 'D', 'E'].slice(0, exam.choiceCount)
        : ['ก', 'ข', 'ค', 'ง', 'จ'].slice(0, exam.choiceCount);

    const totalQ = exam.questionCount;
    let leftQuestions: number[] = [];
    let rightQuestions: number[] = [];

    if (totalQ <= 20) {
      leftQuestions = Array.from({ length: totalQ }, (_, i) => i + 1);
      rightQuestions = [];
    } else if (totalQ <= 40) {
      leftQuestions = Array.from({ length: 20 }, (_, i) => i + 1);
      rightQuestions = Array.from({ length: totalQ - 20 }, (_, i) => i + 21);
    } else {
      const half = Math.ceil(totalQ / 2);
      leftQuestions = Array.from({ length: half }, (_, i) => i + 1);
      rightQuestions = Array.from({ length: totalQ - half }, (_, i) => i + half + 1);
    }

    // Draw both halves (Copy 1 on left, Copy 2 on right)
    for (let copy = 0; copy < 2; copy++) {
      const offsetX = copy * halfWidth;
      const padX = 40;
      const padY = 35;
      const innerW = halfWidth - padX * 2;

      // 4 Corner Alignment Registration Marks (OMR fiducials)
      ctx.fillStyle = '#000000';
      const mark = 36;
      ctx.fillRect(offsetX + padX, padY, mark, mark);
      ctx.fillRect(offsetX + halfWidth - padX - mark, padY, mark, mark);
      ctx.fillRect(offsetX + padX, height - padY - mark, mark, mark);
      ctx.fillRect(offsetX + halfWidth - padX - mark, height - padY - mark, mark, mark);

      // Header box
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      const headerBoxW = innerW - 100;
      ctx.strokeRect(offsetX + padX + 50, padY, headerBoxW, 225);

      // Title
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 32px "Kanit", "Sarabun", sans-serif';
      ctx.fillText('กระดาษคำตอบ', offsetX + padX + 70, padY + 45);

      // Subject info
      ctx.font = 'bold 20px "Sarabun", sans-serif';
      ctx.fillStyle = '#1e293b';
      const gradeStr = exam.gradeLevel ? ` | ชั้น: ${exam.gradeLevel}` : '';
      ctx.fillText(`วิชา: ${exam.title}${gradeStr} | ${exam.questionCount} ข้อ (${exam.choiceCount} ตัวเลือก)`, offsetX + padX + 70, padY + 80);

      // Student fields: Row 1 ชื่อ-สกุล (ยาวเต็มบรรทัดเดี่ยวๆ), Row 2 ชั้น + เลขที่ + วันที่
      ctx.font = '19px "Sarabun", sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText('ชื่อ - สกุล: ....................................................................................................................', offsetX + padX + 70, padY + 130);
      ctx.fillText('ชั้น: ....................    เลขที่: ....................    วันที่: ................................................................', offsetX + padX + 70, padY + 175);

      // QR Code (Large & prominent framed for instant mobile detection from distance)
      if (qrImg) {
        const qrBoxW = 160;
        const qrBoxH = 175;
        const qrX = offsetX + halfWidth - padX - 50 - qrBoxW;
        const qrY = padY + 18;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(qrX, qrY, qrBoxW, qrBoxH);
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(qrX, qrY, qrBoxW, qrBoxH);

        const qrImgSize = qrBoxW - 16;
        ctx.drawImage(qrImg, qrX + 8, qrY + 8, qrImgSize, qrImgSize);
        ctx.font = 'bold 13px "Sarabun", monospace';
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText('QR รหัสข้อสอบ', qrX + qrBoxW / 2, qrY + qrBoxH - 10);
        ctx.textAlign = 'left';
      }

      // Instruction Badge (กระดาษคำตอบฝนวงกลม)
      ctx.fillStyle = '#334155';
      const badgeW = 440;
      ctx.fillRect(offsetX + padX + 50 + (headerBoxW - badgeW) / 2, padY + 245, badgeW, 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "Sarabun", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ใช้ดินสอหรือปากกาฝนในวงกลมให้เข้มเต็มวง (ลบด้วยน้ำยาลบคำผิดได้ • ห้ามฝนเกิน 1 ข้อ)', offsetX + padX + 50 + headerBoxW / 2, padY + 263);
      ctx.textAlign = 'left';

      // Strictly 4 choices (ก, ข, ค, ง and A, B, C, D)
      const choiceLabels = ['ก', 'ข', 'ค', 'ง'];
      const latinLabels = ['A', 'B', 'C', 'D'];

      // Layout:
      // If totalQ <= 15: Single centered table (15 ข้อ อยู่ตรงกลางเลย)
      // If totalQ > 15: 3 Tables / Frames (Table 1: 1-15, Table 2: 16-30, Table 3: 31-45)
      const isSingleColumn = totalQ <= 15;
      const tablesConfig = isSingleColumn
        ? [{ start: 1, end: 15 }]
        : [
            { start: 1, end: 15 },
            { start: 16, end: 30 },
            { start: 31, end: 45 },
          ];

      // Exact mathematical coordinates aligned with OMR Scanner Engine
      const gridStartY = 370;
      const headerH1 = 26;
      const headerH2 = 20;
      const totalHeaderH = headerH1 + headerH2; // 46
      const rowH = 70;
      const availableGridH = totalHeaderH + rowH * 15; // 46 + 1050 = 1096

      const tableW = isSingleColumn ? 440 : 325;
      const tableGap = 16;
      const fiducialStartX = 58;

      tablesConfig.forEach((cfg, tIdx) => {
        const colX = isSingleColumn
          ? offsetX + fiducialStartX + (1007 - tableW) / 2
          : offsetX + fiducialStartX + tIdx * (tableW + tableGap);

        // Outer border for each table (กรอบชัดเจนในการแบ่ง)
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(colX, gridStartY, tableW, availableGridH);

        // Header Background
        ctx.fillStyle = '#ffe4e6'; // soft rose
        ctx.fillRect(colX, gridStartY, tableW, totalHeaderH);

        // Dividing lines in header: 5 Equal Columns (Number + 4 Choices)
        const colWidth = tableW / 5;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.2;

        // "ข้อ" cell (spans both header rows)
        ctx.strokeRect(colX, gridStartY, colWidth, totalHeaderH);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 16px "Sarabun", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ข้อ', colX + colWidth / 2, gridStartY + totalHeaderH / 2 + 5);

        // Header rows: Row 1 (ก ข ค ง), Row 2 (A B C D)
        choiceLabels.forEach((lbl, cIdx) => {
          const cx = colX + (cIdx + 1) * colWidth;
          ctx.strokeRect(cx, gridStartY, colWidth, headerH1);
          ctx.strokeRect(cx, gridStartY + headerH1, colWidth, headerH2);

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 15px "Sarabun", sans-serif';
          ctx.fillText(lbl, cx + colWidth / 2, gridStartY + headerH1 - 7);

          ctx.fillStyle = '#475569';
          ctx.font = 'bold 12px monospace';
          ctx.fillText(latinLabels[cIdx], cx + colWidth / 2, gridStartY + totalHeaderH - 5);
        });

        // 15 Question Rows (Table grid cells share borders, adjacent)
        for (let r = 0; r < 15; r++) {
          const qNum = cfg.start + r;
          const isActive = qNum <= totalQ;
          const ry = gridStartY + totalHeaderH + r * rowH;

          // Number cell: shaded, left aligned to table border
          ctx.fillStyle = isActive ? '#fff1f2' : '#f8fafc';
          ctx.fillRect(colX, ry, colWidth, rowH);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1;
          ctx.strokeRect(colX, ry, colWidth, rowH);

          if (isActive) {
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 17px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${qNum}`, colX + colWidth / 2, ry + rowH / 2 + 6);
          }

          // Choice cells with Small Compact Circular OMR Bubbles (วงกลมขนาดเล็ก กะทัดรัด ฝนง่าย)
          choiceLabels.forEach((lbl, cIdx) => {
            const cx = colX + (cIdx + 1) * colWidth;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx, ry, colWidth, rowH);
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1;
            ctx.strokeRect(cx, ry, colWidth, rowH);

            if (isActive) {
              const bubbleCx = cx + colWidth / 2;
              const bubbleCy = ry + rowH / 2;
              // Small compact bubble radius: 10px (diameter 20px ~ 3.6mm on paper)
              const bubbleR = 10;

              // Draw circular bubble border
              ctx.strokeStyle = '#0f172a';
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.arc(bubbleCx, bubbleCy, bubbleR, 0, Math.PI * 2);
              ctx.stroke();

              // Draw choice letter inside small circular bubble
              ctx.fillStyle = '#334155';
              ctx.font = 'bold 10px "Sarabun", sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(lbl, bubbleCx, bubbleCy + 3.5);
            }
          });
        }
      });
      ctx.textAlign = 'left';

    }

    // Outer border around the entire A4 Landscape paper (เหมือนการแสดงผล)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // Border around left half sheet and right half sheet
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, halfWidth - 30, height - 40);
    ctx.strokeRect(halfWidth + 10, 20, halfWidth - 30, height - 40);

    // Center Dashed Cutting Line (เส้นประตัดตรงกลาง เรียบง่าย ไม่มีข้อความ)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(halfWidth, 20);
    ctx.lineTo(halfWidth, height - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });
    pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
    const safeTitle = (exam.title || 'answer_sheet').replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
    pdf.save(`กระดาษคำตอบA4แนวนอน_2ชุด_${safeTitle}.pdf`);
  },
};
