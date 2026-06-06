import { File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
import { ID, Storage } from 'react-native-appwrite';
import { client } from './client';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from './config';

export const ATTACHMENT_BUCKET_ID = 'job_attachments';

let storage: Storage | null = null;
export function getStorage(): Storage {
  if (!storage) storage = new Storage(client);
  return storage;
}

export interface UploadInput {
  uri: string;
  name: string;
  type: string;
  size: number;
}

export async function uploadAttachment(input: UploadInput): Promise<string> {
  const result = await getStorage().createFile({
    bucketId: ATTACHMENT_BUCKET_ID,
    fileId: ID.unique(),
    file: input,
  });
  return result.$id;
}

export async function deleteAttachment(fileId: string): Promise<void> {
  try {
    await getStorage().deleteFile({ bucketId: ATTACHMENT_BUCKET_ID, fileId });
  } catch {
    // ignore — admin may already have removed it
  }
}

/** Unauthenticated URL — only works for buckets with read("any") / read("guests"). */
export function getFileViewUrl(fileId: string): string {
  const endpoint = APPWRITE_ENDPOINT.replace(/\/$/, '');
  return `${endpoint}/storage/buckets/${ATTACHMENT_BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
}

/** Unauthenticated URL — only works for buckets with read("any") / read("guests"). */
export function getFilePreviewUrl(fileId: string, width = 600): string {
  const endpoint = APPWRITE_ENDPOINT.replace(/\/$/, '');
  return `${endpoint}/storage/buckets/${ATTACHMENT_BUCKET_ID}/files/${fileId}/preview?project=${APPWRITE_PROJECT_ID}&width=${width}`;
}

export async function getAttachmentName(fileId: string): Promise<string | null> {
  try {
    const file = await getStorage().getFile({ bucketId: ATTACHMENT_BUCKET_ID, fileId });
    return file.name;
  } catch {
    return null;
  }
}

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

function safeCacheName(fileId: string, name: string): string {
  const base = (name || fileId).replace(/[^\w.\-]+/g, '_');
  return `att-${fileId}-${base}`;
}

export interface CachedAttachment {
  uri: string;
  mimeType: string;
  name: string;
  file: File;
}

function isImageAttachment(mimeType: string, name: string): boolean {
  if (mimeType.startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(name);
}

function isPdfAttachment(mimeType: string, name: string): boolean {
  return mimeType === 'application/pdf' || /\.pdf$/i.test(name);
}

export async function downloadAttachmentToCache(fileId: string): Promise<CachedAttachment> {
  const meta = await getStorage().getFile({ bucketId: ATTACHMENT_BUCKET_ID, fileId });
  const buffer = await getStorage().getFileDownload({ bucketId: ATTACHMENT_BUCKET_ID, fileId });
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  const filename = safeCacheName(fileId, meta.name);
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(bytes);
  return {
    uri: file.uri,
    mimeType: meta.mimeType || 'application/octet-stream',
    name: meta.name || filename,
    file,
  };
}

export interface OpenAttachmentHandlers {
  onPdfPreview?: (input: { fileId: string; name: string }) => void;
  onImagePreview?: (input: { fileId: string; uri: string; name: string; mimeType: string }) => void;
}

/** Download via authenticated SDK, then open in the default app (or in-app preview on iOS). */
export async function openAttachment(fileId: string, handlers: OpenAttachmentHandlers = {}): Promise<void> {
  const cached = await downloadAttachmentToCache(fileId);
  const { uri, mimeType, name, file } = cached;

  if (isPdfAttachment(mimeType, name)) {
    handlers.onPdfPreview?.({ fileId, name });
    if (handlers.onPdfPreview) return;
  }

  if (isImageAttachment(mimeType, name)) {
    handlers.onImagePreview?.({ fileId, uri, name, mimeType });
    if (handlers.onImagePreview) return;
  }

  if (Platform.OS === 'android') {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: file.contentUri,
      flags: 1,
      type: mimeType || undefined,
    });
    return;
  }

  if (await Linking.canOpenURL(uri)) {
    await Linking.openURL(uri);
    return;
  }

  throw new Error('No app available to open this file.');
}

export async function getAttachmentPreviewUri(fileId: string, width = 600): Promise<string | null> {
  try {
    const buffer = await getStorage().getFilePreview({
      bucketId: ATTACHMENT_BUCKET_ID,
      fileId,
      width,
    });
    const bytes = new Uint8Array(buffer as ArrayBuffer);
    return `data:image/jpeg;base64,${bytesToBase64(bytes)}`;
  } catch {
    try {
      const cached = await downloadAttachmentToCache(fileId);
      return cached.uri;
    } catch {
      return null;
    }
  }
}

export async function downloadAttachmentAsDataUri(fileId: string): Promise<string | null> {
  try {
    const meta = await getStorage().getFile({ bucketId: ATTACHMENT_BUCKET_ID, fileId });
    const buffer = await getStorage().getFileView({ bucketId: ATTACHMENT_BUCKET_ID, fileId });
    const contentType = meta.mimeType || 'application/octet-stream';
    const base64 = bytesToBase64(new Uint8Array(buffer as ArrayBuffer));
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}
