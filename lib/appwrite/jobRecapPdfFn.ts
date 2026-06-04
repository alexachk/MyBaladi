import { File, Paths } from 'expo-file-system';
import { getAppwriteClient } from './client';
import { APPWRITE_ENDPOINT, JOB_RECAP_PDF_FUNCTION_ID } from './config';
import { getFileViewUrl } from './storage';

import type { RecapPdfStampMeta } from '../jobRecapPdfStamp';

export type RecapPdfChromeMeta = RecapPdfStampMeta;

type Execution = {
  status: string;
  responseStatusCode: number;
  responseBody: string;
  errors?: string;
};

type RenderOk = { ok: true; fileId: string; fileName: string };
type RenderErr = { ok: false; error: string };

async function executeRender(body: Record<string, unknown>): Promise<RenderOk> {
  const client = getAppwriteClient();
  const execution = (await client.call(
    'POST',
    new URL(`${APPWRITE_ENDPOINT}/functions/${JOB_RECAP_PDF_FUNCTION_ID}/executions`),
    { 'content-type': 'application/json' },
    { body: JSON.stringify(body), async: false },
  )) as Execution;

  if (execution.status === 'failed') {
    let detail = execution.errors?.trim() || '';
    if (!detail && execution.responseBody) {
      try {
        const parsed = JSON.parse(execution.responseBody) as { error?: string };
        detail = parsed.error?.trim() || execution.responseBody;
      } catch {
        detail = execution.responseBody;
      }
    }
    throw new Error(detail || 'PDF service execution failed.');
  }

  let payload: RenderOk | RenderErr;
  try {
    payload = JSON.parse(execution.responseBody || '{}') as RenderOk | RenderErr;
  } catch {
    throw new Error('Invalid response from PDF service.');
  }

  if (!payload.ok) {
    throw new Error(payload.error || 'PDF render failed.');
  }

  return payload;
}

/** Render recap HTML to PDF on Appwrite (Chromium) and save to local cache. */
export async function renderRecapPdfOnServer(
  html: string,
  fileName: string,
  chrome: RecapPdfChromeMeta,
): Promise<string> {
  const { fileId } = await executeRender({
    action: 'render',
    html,
    fileName,
    chrome,
  });

  const viewUrl = getFileViewUrl(fileId);
  const response = await fetch(viewUrl);
  if (!response.ok) {
    throw new Error('Could not download rendered PDF.');
  }

  const buffer = await response.arrayBuffer();
  const dest = new File(Paths.cache, fileName);
  if (dest.exists) dest.delete();
  dest.write(new Uint8Array(buffer));
  return dest.uri;
}
