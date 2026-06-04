import type { JobCard } from '../types/jobCard';
import {
  formatVisitWhen,
  normalizeVisitsList,
  visitStatus,
  type StoredJobVisit,
} from './jobVisits';
import { formatDateTime } from '../utils/formatDate';

/** Visit tied to job sign-off (stored id, else latest completed visit). */
export function resolveSignOffVisit(
  job: Pick<JobCard, 'signatureVisitId' | 'visits'>,
): StoredJobVisit | null {
  const visits = normalizeVisitsList(job.visits ?? []);
  if (job.signatureVisitId) {
    const linked = visits.find((visit) => visit.id === job.signatureVisitId);
    if (linked) return linked;
  }
  const done = visits.filter((visit) => visitStatus(visit) === 'done');
  if (!done.length) return null;
  return [...done].sort((a, b) => {
    const ta = a.completedAt ?? '';
    const tb = b.completedAt ?? '';
    return tb.localeCompare(ta);
  })[0];
}

export function resolveSignOffVisitId(job: Pick<JobCard, 'signatureVisitId' | 'visits'>): string | null {
  return resolveSignOffVisit(job)?.id ?? null;
}

export function formatSignOffVisitLabel(
  visit: StoredJobVisit | null,
  visits: StoredJobVisit[],
): string {
  if (!visit) return 'Job card';
  const index = visits.findIndex((row) => row.id === visit.id);
  const num = index >= 0 ? index + 1 : null;
  const label = visit.label?.trim() || (num != null ? `Visit ${num}` : 'Visit');
  return `${label} · ${formatVisitWhen(visit)}`;
}

export interface SignOffPdfBlock {
  visitLabel: string;
  technicianName: string;
  clientName: string;
  techSignedAt: string | null;
  clientSignedAt: string | null;
  techImageUri: string | null;
  clientImageUri: string | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSignOffRecapHtml(block: SignOffPdfBlock): string {
  const sigImg = (uri: string | null, alt: string) =>
    uri
      ? `<div class="sig-img-wrap"><img src="${uri}" alt="${escapeHtml(alt)}" class="sig-img"/></div>`
      : `<p class="muted">Image unavailable</p>`;

  return `
    <p class="sig-visit"><strong>Visit:</strong> ${escapeHtml(block.visitLabel)}</p>
    <div class="sig-grid">
      <div class="sig-card">
        <div class="sig-head">
          <strong>Technician</strong>
          <span>${escapeHtml(block.technicianName)}</span>
        </div>
        ${block.techSignedAt ? `<div class="sig-time">Signed ${escapeHtml(block.techSignedAt)}</div>` : ''}
        ${sigImg(block.techImageUri, 'Technician signature')}
      </div>
      <div class="sig-card">
        <div class="sig-head">
          <strong>Client</strong>
          <span>${escapeHtml(block.clientName)}</span>
        </div>
        ${block.clientSignedAt ? `<div class="sig-time">Signed ${escapeHtml(block.clientSignedAt)}</div>` : ''}
        ${sigImg(block.clientImageUri, 'Client signature')}
      </div>
    </div>`;
}

export function buildSignOffPdfBlock(
  job: Pick<
    JobCard,
    | 'signatureVisitId'
    | 'visits'
    | 'technicianName'
    | 'clientSignatureName'
    | 'technicianSignatureId'
    | 'clientSignatureId'
    | 'technicianSignedAt'
    | 'lockedAt'
  >,
  images: { tech: string | null; client: string | null },
): SignOffPdfBlock | null {
  if (!job.clientSignatureId && !job.technicianSignatureId) return null;
  const visits = normalizeVisitsList(job.visits ?? []);
  const visit = resolveSignOffVisit(job);
  return {
    visitLabel: formatSignOffVisitLabel(visit, visits),
    technicianName: job.technicianName?.trim() || 'Technician',
    clientName: job.clientSignatureName?.trim() || 'Client',
    techSignedAt: job.technicianSignedAt
      ? formatDateTime(job.technicianSignedAt)
      : null,
    clientSignedAt: job.lockedAt ? formatDateTime(job.lockedAt) : null,
    techImageUri: images.tech,
    clientImageUri: images.client,
  };
}
