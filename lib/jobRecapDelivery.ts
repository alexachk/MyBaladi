import { File } from 'expo-file-system';
import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';
import { pickRecapEmailLaunch } from './jobRecapEmailPicker';
import { buildRecapPdfFileName, exportJobRecapPdf } from './jobRecapPdf';
import { defaultJobRecapExportOptions, type JobRecapExportOptions } from './jobRecapExport';
import { buildRecapEmail } from './jobRecapEmail';
import { summarizeRecapOptions } from './jobRecaps';
import { createJobRecap } from './appwrite/jobRecaps';
import { uploadAttachment } from './appwrite/storage';
import type { JobCard } from '../types/jobCard';
import type { JobRecap, RecapDeliveryMode } from './jobRecaps';

export interface RecapActor {
  id: string;
  name: string;
}

function recapFileName(job: JobCard, documentType: JobRecapExportOptions['documentType']): string {
  return buildRecapPdfFileName(job, documentType);
}

/** Render the recap PDF to a local cache file and return its uri. */
export async function generateRecapFile(
  job: JobCard,
  options: JobRecapExportOptions,
  actor?: RecapActor,
): Promise<string> {
  return exportJobRecapPdf(job, options, {
    generatedByName: actor?.name,
  });
}

/** Render recap PDF to a local file (caller opens in-app preview). */
export async function previewRecap(
  job: JobCard,
  options: JobRecapExportOptions,
  actor?: RecapActor,
): Promise<string> {
  return generateRecapFile(job, options, actor);
}

async function persistRecap(
  job: JobCard,
  options: JobRecapExportOptions,
  uri: string,
  actor: RecapActor,
  deliveryMode: RecapDeliveryMode,
  extra: { emailedTo?: string; emailedAt?: string | null } = {},
): Promise<JobRecap> {
  const name = new File(uri).name || recapFileName(job, options.documentType);
  let size = 0;
  try {
    size = new File(uri).size ?? 0;
  } catch {
    size = 0;
  }
  const fileId = await uploadAttachment({ uri, name, type: 'application/pdf', size });

  return createJobRecap({
    jobId: job.id,
    jobReference: job.reference,
    clientName: job.clientName,
    fileId,
    fileName: name,
    technicianId: job.technicianId ?? null,
    technicianName: job.technicianName,
    generatedById: actor.id,
    generatedByName: actor.name,
    optionsJson: JSON.stringify(options),
    summary: summarizeRecapOptions(options),
    clientSignatureId: job.clientSignatureId ?? null,
    clientSignatureName: job.clientSignatureName ?? '',
    signedAt: job.clientSignatureId ? job.lockedAt ?? job.finishedAt ?? null : null,
    emailedTo: extra.emailedTo ?? '',
    emailedAt: extra.emailedAt ?? null,
    deliveryMode,
  });
}

/** Generate + upload + log a recap to the job (archive, no send). */
export async function saveRecap(
  job: JobCard,
  options: JobRecapExportOptions,
  actor: RecapActor,
): Promise<JobRecap> {
  const uri = await generateRecapFile(job, options, actor);
  return persistRecap(job, options, uri, actor, 'save');
}

/** Generate + open OS share sheet (not archived to job history). */
export async function shareAndLogRecap(
  job: JobCard,
  options: JobRecapExportOptions,
  actor: RecapActor,
): Promise<void> {
  const uri = await generateRecapFile(job, options, actor);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Share recap · ${job.reference}`,
    });
  }
}

export interface EmailRecapResult {
  status: MailComposer.MailComposerStatus;
}

function recapShareMessage(recipients: string[], body: string): string {
  const to = recipients.length ? `To: ${recipients.join(', ')}\n\n` : '';
  return Platform.OS === 'android' ? `${to}${body}` : body;
}

async function shareRecapEmail(
  uri: string,
  subject: string,
  body: string,
  recipients: string[],
  jobReference: string,
): Promise<EmailRecapResult> {
  const message = `Subject: ${subject}\n\n${recapShareMessage(recipients, body)}`;
  const shared = await Share.share(
    { message, url: uri },
    { dialogTitle: `Email recap · ${jobReference}`, subject },
  );

  if (shared.action === Share.dismissedAction) {
    return { status: MailComposer.MailComposerStatus.CANCELLED };
  }
  return { status: MailComposer.MailComposerStatus.SENT };
}

/** Generate + open mail (user picks app) + log. */
export async function emailRecap(
  job: JobCard,
  options: JobRecapExportOptions,
  actor: RecapActor,
  recipients: string[],
): Promise<EmailRecapResult> {
  const launch = await pickRecapEmailLaunch();
  if (!launch) {
    return { status: MailComposer.MailComposerStatus.CANCELLED };
  }

  const uri = await generateRecapFile(job, options, actor);
  const email = buildRecapEmail(job, actor.name);

  if (launch === 'share') {
    return shareRecapEmail(uri, email.subject, email.body, recipients, job.reference || '—');
  }

  const available = await MailComposer.isAvailableAsync();
  if (!available) {
    throw new Error('No email account is set up on this device.');
  }

  const result = await MailComposer.composeAsync({
    recipients: recipients.length ? recipients : undefined,
    subject: email.subject,
    body: email.body,
    isHtml: false,
    attachments: [uri],
  });

  return { status: result.status };
}

export { defaultJobRecapExportOptions };
