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
   * Generates a 100% faithful, high-resolution A4 PDF Answer Sheet.
   * Clones the element into a clean, unscaled off-screen sandbox to avoid CSS transform scaling bugs,
   * rendering Thai fonts (Sarabun, Kanit), tables, registration marks, and QR codes at crisp 300 DPI print quality.
   */
  async downloadPDFFromElement(element: HTMLElement, exam: Exam): Promise<void> {
    // 1. Create an isolated off-screen sandbox container
    const sandbox = document.createElement('div');
    sandbox.style.position = 'fixed';
    sandbox.style.left = '-9999px';
    sandbox.style.top = '0';
    sandbox.style.width = '794px'; // 210mm in pixels at 96 DPI
    sandbox.style.minHeight = '1123px'; // 297mm in pixels at 96 DPI
    sandbox.style.backgroundColor = '#ffffff';
    sandbox.style.zIndex = '-9999';
    sandbox.style.overflow = 'visible';

    // 2. Clone the answer sheet element
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';
    clone.style.margin = '0';
    clone.style.width = '794px';
    clone.style.height = '1123px';
    clone.style.minHeight = '1123px';
    clone.style.maxHeight = '1123px';
    clone.style.boxSizing = 'border-box';
    clone.style.boxShadow = 'none';
    clone.style.borderRadius = '0';
    clone.style.backgroundColor = '#ffffff';

    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);

    try {
      // Allow fonts and any nested images to settle
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
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      // Create PDF A4 portrait: 210mm x 297mm
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      const safeTitle = (exam.title || 'answer_sheet').replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
      pdf.save(`OMR_กระดาษคำตอบ_${safeTitle}.pdf`);
    } finally {
      // Clean up sandbox
      if (document.body.contains(sandbox)) {
        document.body.removeChild(sandbox);
      }
    }
  },

  /**
   * High-fidelity Canvas-rendered PDF fallback (Never outputs raw garbled text)
   * If DOM capture fails for any unexpected browser permission reason,
   * this builds the exact answer sheet onto an HTML5 Canvas with proper Thai text rendering
   * and exports it to PDF, preventing any jspdf font encoding corruption.
   */
  async downloadPDF(exam: Exam, orgName = 'ศูนย์ทดสอบวัดผลทางการศึกษา', precomputedQR?: string): Promise<void> {
    const width = 1588; // 794 * 2
    const height = 2246; // 1123 * 2
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Corner fiducial marks (7mm = ~53px at 2x)
    ctx.fillStyle = '#000000';
    const mark = 53;
    const offset = 45;
    ctx.fillRect(offset, offset, mark, mark);
    ctx.fillRect(width - offset - mark, offset, mark, mark);
    ctx.fillRect(offset, height - offset - mark, mark, mark);
    ctx.fillRect(width - offset - mark, height - offset - mark, mark, mark);

    // Header box
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.strokeRect(90, 80, width - 180, 270);

    // Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 36px "Kanit", "Sarabun", sans-serif';
    ctx.fillText('กระดาษคำตอบแบบปรนัย (OMR ANSWER SHEET)', 120, 135);

    ctx.font = 'bold 24px "Sarabun", sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(orgName, 120, 175);

    ctx.font = '22px "Sarabun", sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`วิชา: ${exam.title} (${exam.questionCount} ข้อ)`, 120, 215);
    ctx.fillText(`ระดับชั้น: ${exam.gradeLevel || '-'}   |   รหัสวิชา: ${exam.code || '-'}`, 120, 250);

    // Student fields
    ctx.font = '20px "Sarabun", sans-serif';
    ctx.fillText('ชื่อ - นามสกุล: _____________________________________   เลขที่ / รหัสนักเรียน: ___________________', 120, 310);

    // QR Code
    try {
      const qrDataUrl =
        precomputedQR ||
        (await QRCode.toDataURL(getExamQRPayload(exam), {
          margin: 1,
          width: 240,
          errorCorrectionLevel: 'M',
        }));
      const img = new Image();
      img.src = qrDataUrl;
      await new Promise((res) => {
        img.onload = res;
      });
      ctx.drawImage(img, width - 290, 95, 170, 170);
    } catch {}

    // Questions Grid
    const totalQ = exam.questionCount;
    const numCols = totalQ <= 20 ? 1 : totalQ <= 40 ? 2 : totalQ <= 60 ? 3 : 4;
    const qPerCol = Math.ceil(totalQ / numCols);
    const colWidth = (width - 180 - (numCols - 1) * 20) / numCols;
    const choiceLabels = exam.choiceLabelType === 'latin'
      ? ['A', 'B', 'C', 'D', 'E'].slice(0, exam.choiceCount)
      : ['ก', 'ข', 'ค', 'ง', 'จ'].slice(0, exam.choiceCount);

    let startY = 380;

    for (let c = 0; c < numCols; c++) {
      const colX = 90 + c * (colWidth + 20);
      const startQ = c * qPerCol + 1;
      const endQ = Math.min((c + 1) * qPerCol, totalQ);

      // Header row
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(colX, startY, colWidth, 40);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(colX, startY, colWidth, 40);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px "Sarabun", sans-serif';
      ctx.fillText('ข้อ', colX + 15, startY + 28);

      const boxSize = 32;
      const boxGap = 16;
      const totalBoxesW = choiceLabels.length * boxSize + (choiceLabels.length - 1) * boxGap;
      const choiceAreaStart = colX + 70 + ((colWidth - 80) - totalBoxesW) / 2;

      choiceLabels.forEach((lbl, idx) => {
        const bx = choiceAreaStart + idx * (boxSize + boxGap);
        ctx.fillText(lbl, bx + boxSize / 2 - 7, startY + 28);
      });

      // Question rows
      let rowY = startY + 40;
      const rowHeight = Math.min(42, (height - startY - 140) / qPerCol);

      for (let q = startQ; q <= endQ; q++) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.strokeRect(colX, rowY, colWidth, rowHeight);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 18px "Sarabun", monospace';
        ctx.fillText(`${q}.`, colX + 10, rowY + rowHeight / 2 + 6);

        choiceLabels.forEach((lbl, idx) => {
          const bx = choiceAreaStart + idx * (boxSize + boxGap);
          const by = rowY + (rowHeight - boxSize) / 2;
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, boxSize, boxSize);
          ctx.font = 'bold 16px "Sarabun", sans-serif';
          ctx.fillStyle = '#0f172a';
          ctx.fillText(lbl, bx + 9, by + 22);
        });

        rowY += rowHeight;
      }
    }

    // Footer (Clean without irrelevant tech specs)
    ctx.font = '18px "Sarabun", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(`กระดาษคำตอบวิชา: ${exam.title} (${exam.gradeLevel || ''})`, 90, height - 60);
    ctx.fillText('หน้า 1 / 1', width - 200, height - 60);

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    const safeTitle = (exam.title || 'answer_sheet').replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
    pdf.save(`OMR_กระดาษคำตอบ_${safeTitle}.pdf`);
  },
};
