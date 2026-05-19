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
