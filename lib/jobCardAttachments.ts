import type { JobCard } from '../types/jobCard';
import { visitLinkLabel } from './jobVisitLink';
import type { StoredJobVisit } from './jobVisits';

/** fileId → visitId (null / missing = general · whole job) */
export type AttachmentVisitLinks = Record<string, string | null>;

export function parseAttachmentVisitLinks(raw: unknown): AttachmentVisitLinks {
  if (!raw || typeof raw !== 'object') return {};
  const out: AttachmentVisitLinks = {};
  for (const [fileId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) out[fileId] = value.trim();
    else out[fileId] = null;
  }
  return out;
}

export function compactAttachmentVisitLinks(links: AttachmentVisitLinks): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [fileId, visitId] of Object.entries(links)) {
    if (visitId) out[fileId] = visitId;
  }
  return out;
}

export function visitIdForAttachment(
  fileId: string,
  links?: AttachmentVisitLinks,
): string | null {
  if (!links || !(fileId in links)) return null;
  return links[fileId] ?? null;
}

export function attachmentVisitLabel(
  fileId: string,
  visits: StoredJobVisit[],
  links?: AttachmentVisitLinks,
): string {
  const visitId = visitIdForAttachment(fileId, links);
  return visitId ? visitLinkLabel(visits, visitId) : 'General (whole job)';
}

export function setAttachmentVisit(
  links: AttachmentVisitLinks,
  fileId: string,
  visitId: string | null,
): AttachmentVisitLinks {
  return { ...links, [fileId]: visitId };
}

export function removeAttachmentVisit(links: AttachmentVisitLinks, fileId: string): AttachmentVisitLinks {
  const next = { ...links };
  delete next[fileId];
  return next;
}

export function jobPhotosForVisit(
  job: Pick<JobCard, 'photoIds' | 'attachmentVisitLinks'>,
  visitId: string,
): string[] {
  return (job.photoIds ?? []).filter((id) => visitIdForAttachment(id, job.attachmentVisitLinks) === visitId);
}

export function jobDocumentsForVisit(
  job: Pick<JobCard, 'documentIds' | 'attachmentVisitLinks'>,
  visitId: string,
): string[] {
  return (job.documentIds ?? []).filter(
    (id) => visitIdForAttachment(id, job.attachmentVisitLinks) === visitId,
  );
}

export function jobAttachmentsForVisit(
  job: Pick<JobCard, 'photoIds' | 'documentIds' | 'attachmentVisitLinks'>,
  visitId: string | null,
): { photoIds: string[]; documentIds: string[] } {
  const match = (fileId: string) => visitIdForAttachment(fileId, job.attachmentVisitLinks) === visitId;
  return {
    photoIds: (job.photoIds ?? []).filter(match),
    documentIds: (job.documentIds ?? []).filter(match),
  };
}
