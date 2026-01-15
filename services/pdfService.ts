
import { Modification } from '../types';

const PDFLib = (window as any).PDFLib;

export async function saveEditedPDF(file: File, modifications: Modification[]): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  const standardFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const standardFontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

  for (const mod of modifications) {
    const page = pages[mod.pageIndex];
    if (!page) continue;

    const { x, y, text, fontSize, type, width, isBold } = mod;

    if (type === 'edit') {
      // Overwrite original text with a white rectangle
      page.drawRectangle({
        x: x - 0.5,
        y: y - 2,
        width: width + 2,
        height: fontSize + 2,
        color: PDFLib.rgb(1, 1, 1),
      });
    }

    if (text) {
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font: isBold ? standardFontBold : standardFont,
        color: PDFLib.rgb(0, 0, 0),
      });
    }
  }

  return await pdfDoc.save();
}
