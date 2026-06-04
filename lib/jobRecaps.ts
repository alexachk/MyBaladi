import { RECAP_DOCUMENT_TYPE_META, type JobRecapExportOptions } from './jobRecapExport';

/** How a recap row was persisted (job history lists `save` only). */
export type RecapDeliveryMode = 'save' | 'share' | 'email';

/** A persisted recap PDF generated for a job, logged with date + signature + email. */
export interface JobRecap {
  id: string;
  jobId: string;
  jobReference: string;
  clientName: string;
  fileId: string;
  fileName: string;
  technicianId: string | null;
  technicianName: string;
  generatedById: string;
  generatedByName: string;
  optionsJson: string;
  summary: string;
  clientSignatureId: string | null;
  clientSignatureName: string;
  signedAt: string | null;
  emailedTo: string;
  emailedAt: string | null;
  createdBy: string;
  createdAt: string;
  deliveryMode: RecapDeliveryMode | null;
}

/** Rows shown under Recap history on the job card (Save icon only). */
export function isSavedRecapForHistory(recap: JobRecap): boolean {
  if (recap.deliveryMode === 'save') return true;
  if (recap.deliveryMode === 'share' || recap.deliveryMode === 'email') return false;
  // legacy rows before deliveryMode existed
  return !recap.emailedTo && !recap.emailedAt;
}

const SECTION_LABELS: Array<{ key: keyof JobRecapExportOptions; label: string }> = [
  { key: 'includeClient', label: 'Client' },
  { key: 'includeContacts', label: 'Contacts' },
  { key: 'includeMission', label: 'Mission' },
  { key: 'includeVisits', label: 'Visits' },
  { key: 'includeWorkReport', label: 'Work report' },
  { key: 'includeScheduleHistory', label: 'Schedule' },
  { key: 'includeComments', label: 'Comments' },
  { key: 'includePhotos', label: 'Photos' },
  { key: 'includeDocuments', label: 'Documents' },
];

/** Short human label of the sections included in a recap export. */
export function summarizeRecapOptions(options: JobRecapExportOptions): string {
  const typeLabel = RECAP_DOCUMENT_TYPE_META[options.documentType]?.label ?? 'Draft';
  const parts = SECTION_LABELS.filter(({ key }) => options[key]).map(({ label }) => label);
  if (options.visitIds.length) parts.push(`${options.visitIds.length} visit(s)`);
  return [typeLabel, parts.join(', ') || 'Empty'].join(' · ');
}

export function emailListToArray(emailedTo: string | null | undefined): string[] {
  if (!emailedTo) return [];
  return emailedTo
    .split(/[,;]/)
    .map((value) => value.trim())
    .filter(Boolean);
}
