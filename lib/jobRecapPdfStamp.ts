import { File, Paths } from 'expo-file-system';
import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib/dist/pdf-lib.min.js';

export const A4_WIDTH_PT = 595;
export const A4_HEIGHT_PT = 842;

import { RECAP_MARGIN_MM } from './jobRecapPdfTheme';

export { RECAP_MARGIN_MM };
/** Horizontal margin (mm) for pdf-lib footer alignment. */
export const PAGE_MARGIN_MM = RECAP_MARGIN_MM.left;

export function mmToPt(mm: number): number {
  return Math.round((mm / 25.4) * 72);
}

export const PAGE_MARGIN_SIDE_PT = mmToPt(PAGE_MARGIN_MM);
export const PRINT_FOOTER_BAND_MM = 12;

/** Raster assets + Chromium render target (print-quality). */
export const PDF_TARGET_DPI = 300;
/** CSS px → print pixels (96 CSS dpi baseline). */
export const PDF_DEVICE_SCALE = Math.round((PDF_TARGET_DPI / 96) * 100) / 100;
export const PDF_RENDER_SCALE = 1;

export function recapContentWidthPt(pageWidthPt = A4_WIDTH_PT): number {
  return pageWidthPt - 2 * PAGE_MARGIN_SIDE_PT;
}

export function recapRasterWidthPx(pageWidthPt = A4_WIDTH_PT): number {
  return Math.round((recapContentWidthPt(pageWidthPt) / 72) * PDF_TARGET_DPI);
}

export interface RecapPdfStampMeta {
  appName: string;
  companyName: string;
  companyTagline: string;
  generatedDate: string;
  generatedByName: string;
  jobReference: string;
  documentTypeTag: string;
  logoPngBase64?: string;
}

const FOOTER_TEXT = rgb(0.42, 0.45, 0.55);
const FOOTER_STRONG = rgb(0.22, 0.25, 0.31);

export type RecapPdfFooterMeta = Pick<
  RecapPdfStampMeta,
  | 'appName'
  | 'generatedDate'
  | 'generatedByName'
  | 'jobReference'
>;

function drawRecapFooter(
  page: PDFPage,
  width: number,
  meta: RecapPdfFooterMeta,
  pageIndex: number,
  total: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>,
): void {
  const side = PAGE_MARGIN_SIDE_PT;
  const small = 6.5;
  const textY = mmToPt(5.5);
  const gen = `Generated via ${meta.appName} · ${meta.generatedDate} · By ${meta.generatedByName}`;
  page.drawText(gen, { x: side, y: textY, size: small, font, color: FOOTER_TEXT });

  const pageLabel = `Page ${pageIndex + 1} / ${total}`;
  const pageLabelWidth = fontBold.widthOfTextAtSize(pageLabel, small);
  page.drawText(pageLabel, {
    x: (width - pageLabelWidth) / 2,
    y: textY,
    size: small,
    font: fontBold,
    color: FOOTER_STRONG,
  });

  const refWidth = fontBold.widthOfTextAtSize(meta.jobReference, small);
  page.drawText(meta.jobReference, {
    x: width - side - refWidth,
    y: textY,
    size: small,
    font: fontBold,
    color: FOOTER_STRONG,
  });
}

/** Footer + page numbers on every page (WKWebView tfoot is unreliable on iOS). */
/** Device fallback only — footer text when server Chromium render is unavailable. */
export async function finalizeRecapPdf(
  sourceUri: string,
  meta: RecapPdfFooterMeta,
  outputFileName: string,
): Promise<string> {
  const source = new File(sourceUri);
  const raw = await source.bytes();
  const doc = await PDFDocument.load(raw);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  const total = pages.length;

  for (let i = 0; i < total; i++) {
    const page = pages[i];
    const { width } = page.getSize();
    drawRecapFooter(page, width, meta, i, total, font, fontBold);
  }

  const dest = new File(Paths.cache, outputFileName);
  if (dest.exists) dest.delete();
  dest.write(new Uint8Array(await doc.save()));

  try {
    source.delete();
  } catch {
    // best-effort
  }

  return dest.uri;
}

/** @deprecated Use finalizeRecapPdf */
export const stampRecapPdfFooters = finalizeRecapPdf;
