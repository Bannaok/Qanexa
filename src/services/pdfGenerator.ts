import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { Exam } from '../types';

export const getExamQRPayload = (exam: Exam): string => {
  return JSON.stringify({
    app: 'OMR-SCAN',
    id: exam.id,
    title: exam.title,
    grade: exam.gradeLevel || '',
    creator: exam.createdBy || '',
    q: exam.questionCount,
    c: exam.choiceCount,
    keyLen: Object.keys(exam.answerKey || {}).length,
  });
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

    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);

    try {
      if (document.fonts) {
        await document.fonts.ready;
      }
      await new Promise((r) => setTimeout(r, 150));

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

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

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
          margin: 1,
          width: 200,
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
      ctx.strokeRect(offsetX + padX + 50, padY, innerW - 100, 220);

      // Title (No "OMR ANSWER SHEET", No "ศูนย์ทดสอบ...")
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 32px "Kanit", "Sarabun", sans-serif';
      ctx.fillText('กระดาษคำตอบ', offsetX + padX + 70, padY + 45);

      // Subject info
      ctx.font = 'bold 20px "Sarabun", sans-serif';
      ctx.fillStyle = '#1e293b';
      const gradeStr = exam.gradeLevel ? ` | ชั้น: ${exam.gradeLevel}` : '';
      ctx.fillText(`วิชา: ${exam.title}${gradeStr} | ${exam.questionCount} ข้อ (${exam.choiceCount} ตัวเลือก)`, offsetX + padX + 70, padY + 80);

      // Student fields: ONLY ชื่อ-สกุล, เลขที่, วันที่สอบ
      ctx.font = '19px "Sarabun", sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText('ชื่อ - สกุล: ___________________________    เลขที่: ________', offsetX + padX + 70, padY + 130);
      ctx.fillText('วันที่สอบ: ___________________________', offsetX + padX + 70, padY + 175);

      // QR Code
      if (qrImg) {
        ctx.drawImage(qrImg, offsetX + halfWidth - padX - 50 - 150, padY + 25, 140, 140);
        ctx.font = 'bold 12px "Sarabun", monospace';
        ctx.fillStyle = '#475569';
        ctx.fillText('รหัสข้อสอบ', offsetX + halfWidth - padX - 50 - 120, padY + 185);
      }

      // Instruction
      ctx.font = '16px "Sarabun", sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText('📌 คำแนะนำ: กากบาท (X) หรือระบายในช่องสี่เหลี่ยม [ ] เพียงตัวเลือกเดียว', offsetX + padX + 50, padY + 255);

      // Question Grid
      const totalQ = exam.questionCount;
      const numCols = totalQ <= 20 ? 2 : totalQ <= 40 ? 3 : 4;
      const qPerCol = Math.ceil(totalQ / numCols);
      const gridStartY = padY + 275;
      const gridW = innerW - 100;
      const colW = (gridW - (numCols - 1) * 16) / numCols;

      for (let c = 0; c < numCols; c++) {
        const colX = offsetX + padX + 50 + c * (colW + 16);
        const startQ = c * qPerCol + 1;
        const endQ = Math.min((c + 1) * qPerCol, totalQ);
        if (startQ > totalQ) continue;

        // Column header
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(colX, gridStartY, colW, 36);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.strokeRect(colX, gridStartY, colW, 36);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 18px "Sarabun", sans-serif';
        ctx.fillText('ข้อ', colX + 10, gridStartY + 25);

        const boxSize = 26;
        const boxGap = 10;
        const totalBoxW = choiceLabels.length * boxSize + (choiceLabels.length - 1) * boxGap;
        const choiceStartX = colX + 50 + ((colW - 55) - totalBoxW) / 2;

        choiceLabels.forEach((lbl, idx) => {
          const bx = choiceStartX + idx * (boxSize + boxGap);
          ctx.fillText(lbl, bx + 7, gridStartY + 25);
        });

        // Question rows
        let rowY = gridStartY + 36;
        const availableHeight = height - padY - 80 - (gridStartY + 36);
        const rowHeight = Math.min(38, Math.max(28, availableHeight / qPerCol));

        for (let q = startQ; q <= endQ; q++) {
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.strokeRect(colX, rowY, colW, rowHeight);

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 16px monospace';
          ctx.fillText(`${q}.`, colX + 8, rowY + rowHeight / 2 + 5);

          choiceLabels.forEach((lbl, idx) => {
            const bx = choiceStartX + idx * (boxSize + boxGap);
            const by = rowY + (rowHeight - boxSize) / 2;
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, by, boxSize, boxSize);
            ctx.font = 'bold 15px "Sarabun", sans-serif';
            ctx.fillStyle = '#0f172a';
            ctx.fillText(lbl, bx + 7, by + 18);
          });

          rowY += rowHeight;
        }
      }

      // Footer
      ctx.font = '16px "Sarabun", sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`กระดาษคำตอบวิชา: ${exam.title} (ครึ่งแผ่น A4)`, offsetX + padX + 50, height - padY - 15);
    }

    // Center Dashed Cutting Line (✂ ตัดตรงกลาง)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(halfWidth, 20);
    ctx.lineTo(halfWidth, height - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Scissor Cut Here Mark
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 20px "Sarabun", sans-serif';
    ctx.fillText('✂ ตัดตามรอยประ (แบ่งครึ่งกระดาษได้ 2 แผ่น)', halfWidth - 170, 30);
    ctx.fillText('✂ ตัดตามรอยประ', halfWidth - 65, height - 20);

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
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
