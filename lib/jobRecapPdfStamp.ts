import { File, Paths } from 'expo-file-system';
import { degrees, PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib/dist/pdf-lib.min.js';

import {
  RECAP_HEADER_CONTENT_MM,
  RECAP_HEADER_GAP_MM,
  RECAP_LOGO,
  RECAP_MARGIN_MM,
} from './jobRecapPdfTheme';

export const A4_WIDTH_PT = 595;
export const A4_HEIGHT_PT = 842;

export { RECAP_MARGIN_MM };

export const PRINT_FOOTER_BAND_MM = 12;

/** Top @page margin: page inset + stamped header + small gap before body. */
export const RECAP_PAGE_TOP_MARGIN_MM =
  RECAP_MARGIN_MM.top + RECAP_HEADER_CONTENT_MM + RECAP_HEADER_GAP_MM;
export const RECAP_PAGE_BOTTOM_MARGIN_MM = PRINT_FOOTER_BAND_MM + RECAP_MARGIN_MM.bottom;

/** Chromium `page.pdf` margins — must match stamp bands (use HTML @page, not duplicate here). */
export const RECAP_CHROMIUM_MARGIN_MM = {
  top: RECAP_PAGE_TOP_MARGIN_MM,
  right: RECAP_MARGIN_MM.right,
  bottom: RECAP_PAGE_BOTTOM_MARGIN_MM,
  left: RECAP_MARGIN_MM.left,
} as const;

/** Horizontal margin (mm) for pdf-lib footer alignment. */
export const PAGE_MARGIN_MM = RECAP_MARGIN_MM.left;

export function mmToPt(mm: number): number {
  return Math.round((mm / 25.4) * 72);
}

export const PAGE_MARGIN_SIDE_PT = mmToPt(PAGE_MARGIN_MM);

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
  isDraft?: boolean;
}

const FOOTER_TEXT = rgb(0.42, 0.45, 0.55);
const FOOTER_STRONG = rgb(0.22, 0.25, 0.31);

export type RecapPdfFooterMeta = Pick<
  RecapPdfStampMeta,
  'appName' | 'generatedDate' | 'generatedByName' | 'jobReference'
>;

export function recapLogoBase64FromDataUri(dataUri?: string): string | undefined {
  if (!dataUri) return undefined;
  const idx = dataUri.indexOf('base64,');
  return idx >= 0 ? dataUri.slice(idx + 7) : undefined;
}

async function drawRecapHeader(
  doc: PDFDocument,
  page: PDFPage,
  width: number,
  height: number,
  meta: RecapPdfStampMeta,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>,
): Promise<void> {
  const side = PAGE_MARGIN_SIDE_PT;
  const bandBottom = height - mmToPt(RECAP_PAGE_TOP_MARGIN_MM);
  const bandTop = height - mmToPt(RECAP_MARGIN_MM.top);

  page.drawRectangle({
    x: 0,
    y: bandBottom,
    width,
    height: height - bandBottom,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });

  let textX = side;

  if (meta.logoPngBase64) {
    try {
      const raw = Uint8Array.from(atob(meta.logoPngBase64), (c) => c.charCodeAt(0));
      const img = await doc.embedPng(raw);
      let w = img.width;
      let h = img.height;
      const scale = RECAP_LOGO.heightPt / h;
      w *= scale;
      h = RECAP_LOGO.heightPt;
      if (w > RECAP_LOGO.maxWidthPt) {
        const shrink = RECAP_LOGO.maxWidthPt / w;
        w = RECAP_LOGO.maxWidthPt;
        h *= shrink;
      }
      page.drawImage(img, { x: side, y: bandTop - h, width: w, height: h });
      textX = side + w + 6;
    } catch {
      // skip corrupt logo
    }
  }

  const nameSize = 8;
  const tagSize = 6;
  const refSize = 9.5;
  const docTagSize = 6.5;
  const nameY = bandTop - nameSize - 2;

  page.drawText(meta.companyName.toUpperCase(), {
    x: textX,
    y: nameY,
    size: nameSize,
    font: fontBold,
    color: FOOTER_STRONG,
  });
  page.drawText(meta.companyTagline.toUpperCase(), {
    x: textX,
    y: nameY - tagSize - 2,
    size: tagSize,
    font,
    color: FOOTER_TEXT,
  });

  const refW = fontBold.widthOfTextAtSize(meta.jobReference, refSize);
  page.drawText(meta.jobReference, {
    x: width - side - refW,
    y: bandTop - refSize - 2,
    size: refSize,
    font: fontBold,
    color: FOOTER_STRONG,
  });

  const docTag = meta.documentTypeTag.toUpperCase();
  const docTagW = fontBold.widthOfTextAtSize(docTag, docTagSize);
  page.drawText(docTag, {
    x: width - side - docTagW,
    y: bandTop - refSize - docTagSize - 4,
    size: docTagSize,
    font: fontBold,
    color: FOOTER_TEXT,
  });
}

function maskRecapFooterBand(page: PDFPage, width: number, height: number): void {
  const bandTop = mmToPt(RECAP_PAGE_BOTTOM_MARGIN_MM);
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: bandTop,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });
}

function drawRecapFooter(
  page: PDFPage,
  width: number,
  height: number,
  meta: RecapPdfFooterMeta,
  pageIndex: number,
  total: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>,
): void {
  maskRecapFooterBand(page, width, height);
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

const DRAFT_STAMP = rgb(0.42, 0.45, 0.5);

function drawDraftStamp(
  page: PDFPage,
  width: number,
  height: number,
  fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>,
): void {
  const size = 64;
  const text = 'DRAFT';
  const textWidth = fontBold.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: width / 2 - textWidth / 2,
    y: height * 0.4,
    size,
    font: fontBold,
    color: DRAFT_STAMP,
    opacity: 0.16,
    rotate: degrees(-26),
  });
}

/** Header + footer on every page (WKWebView running headers are unreliable on iOS). */
export async function finalizeRecapPdf(
  sourceUri: string,
  meta: RecapPdfStampMeta,
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
    const { width, height } = page.getSize();
    await drawRecapHeader(doc, page, width, height, meta, font, fontBold);
    drawRecapFooter(page, width, height, meta, i, total, font, fontBold);
    if (meta.isDraft) drawDraftStamp(page, width, height, fontBold);
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
