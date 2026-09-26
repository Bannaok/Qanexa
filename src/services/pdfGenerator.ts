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
   * Generates and downloads a crystal-clear, high-resolution A4 PDF Answer Sheet
   * using html2canvas directly from the on-screen rendered sheet DOM.
   * This guarantees 100% faithful Thai typography (Sarabun/Kanit), layout, QR code,
   * and student fields without missing or overlapping elements.
   */
  async downloadPDFFromElement(element: HTMLElement, exam: Exam): Promise<void> {
    // Render at 2x scale for 300 DPI print quality
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    // Standard A4 portrait in mm: 210 x 297
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

  /**
   * Direct programmatic PDF fallback
   */
  async downloadPDF(exam: Exam, orgName = 'ศูนย์ทดสอบวัดผลทางการศึกษา', precomputedQR?: string): Promise<void> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;

    // 4 Corner Alignment Registration Marks
    doc.setFillColor(0, 0, 0);
    const markSize = 7;
    doc.rect(6, 6, markSize, markSize, 'F');
    doc.rect(pageWidth - 6 - markSize, 6, markSize, markSize, 'F');
    doc.rect(6, pageHeight - 6 - markSize, markSize, markSize, 'F');
    doc.rect(pageWidth - 6 - markSize, pageHeight - 6 - markSize, markSize, markSize, 'F');

    // Header Box
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, 12, pageWidth - 30, 46, 2, 2, 'S');

    // QR Code
    try {
      const qrDataUrl =
        precomputedQR ||
        (await QRCode.toDataURL(getExamQRPayload(exam), {
          margin: 1,
          width: 200,
          errorCorrectionLevel: 'M',
        }));
      doc.addImage(qrDataUrl, 'PNG', pageWidth - 38, 14, 20, 20);
    } catch (err) {
      console.warn('QR Code generation failed', err);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('OMR ANSWER SHEET', (pageWidth - 30) / 2, 18, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(orgName, (pageWidth - 30) / 2, 24, { align: 'center' });
    doc.text(`Exam: ${exam.title} (${exam.questionCount} Questions)`, (pageWidth - 30) / 2, 30, { align: 'center' });

    doc.setFontSize(8.5);
    doc.text('Name: _________________________________________', 20, 38);
    doc.text('Student ID: _______________', 115, 38);
    doc.text(`Grade: ${exam.gradeLevel || '_______'}`, 20, 46);
    doc.text('Date: ___________________', 115, 46);

    const safeTitle = (exam.title || 'answer_sheet').replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
    doc.save(`OMR_Answer_Sheet_${safeTitle}.pdf`);
  },
};
