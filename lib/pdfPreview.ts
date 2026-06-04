import { downloadAttachmentAsDataUri } from './appwrite/storage';

export type PdfPreviewSource =
  | { kind: 'uri'; uri: string }
  | { kind: 'fileId'; fileId: string };

function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triplet = (a << 16) | (b << 8) | c;
    result += chars[(triplet >> 18) & 63];
    result += chars[(triplet >> 12) & 63];
    result += i + 1 < bytes.length ? chars[(triplet >> 6) & 63] : '=';
    result += i + 2 < bytes.length ? chars[triplet & 63] : '=';
  }
  return result;
}

function base64FromDataUri(dataUri: string): string {
  const comma = dataUri.indexOf(',');
  return comma >= 0 ? dataUri.slice(comma + 1) : dataUri;
}

/** Raw base64 payload for pdf.js (no data: prefix). */
export async function loadPdfPreviewBase64(source: PdfPreviewSource): Promise<string> {
  if (source.kind === 'fileId') {
    const dataUri = await downloadAttachmentAsDataUri(source.fileId);
    if (!dataUri) throw new Error('Could not load this PDF.');
    return base64FromDataUri(dataUri);
  }

  const response = await fetch(source.uri);
  if (!response.ok) throw new Error('Could not load this PDF.');
  const buffer = await response.arrayBuffer();
  return bytesToBase64(new Uint8Array(buffer));
}
