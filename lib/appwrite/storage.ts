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

/**
 * Build a direct view URL for an Appwrite file. Use for <Image src={...}>.
 * The current user's session is used implicitly through the SDK.
 */
export function getFileViewUrl(fileId: string): string {
  const endpoint = APPWRITE_ENDPOINT.replace(/\/$/, '');
  return `${endpoint}/storage/buckets/${ATTACHMENT_BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
}

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

export async function downloadAttachmentAsDataUri(fileId: string): Promise<string | null> {
  try {
    const response = await fetch(getFileViewUrl(fileId));
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();
    const base64 = bytesToBase64(new Uint8Array(buffer));
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}
