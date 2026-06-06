import type { JobCard } from '../types/jobCard';
import {
  formatVisitWhen,
  hasActiveFollowUpVisits,
  normalizeVisitsList,
  visitStatus,
  type StoredJobVisit,
} from './jobVisits';
import { formatDateTime } from '../utils/formatDate';

export interface VisitSignOffData {
  technicianSignatureId?: string;
  clientSignatureId?: string;
  clientSignatureName?: string;
  technicianSignedAt?: string;
  lockedAt?: string;
  lockedBy?: string;
}

type LegacyJobSignOff = Pick<
  JobCard,
  | 'signatureVisitId'
  | 'technicianSignatureId'
  | 'clientSignatureId'
  | 'clientSignatureName'
  | 'technicianSignedAt'
  | 'lockedAt'
  | 'lockedBy'
>;

/** Effective sign-off on a visit (visit blob, else legacy job-level for that visit id). */
export function visitSignOffData(
  visit: Pick<StoredJobVisit, 'id'> & Partial<StoredJobVisit>,
  job?: LegacyJobSignOff,
): VisitSignOffData {
  if (visit.lockedAt) {
    return {
      technicianSignatureId: visit.technicianSignatureId,
      clientSignatureId: visit.clientSignatureId,
      clientSignatureName: visit.clientSignatureName,
      technicianSignedAt: visit.technicianSignedAt,
      lockedAt: visit.lockedAt,
      lockedBy: visit.lockedBy,
    };
  }
  if (
    job?.signatureVisitId === visit.id &&
    (job.lockedAt || job.technicianSignatureId || job.clientSignatureId)
  ) {
    return {
      technicianSignatureId: job.technicianSignatureId ?? undefined,
      clientSignatureId: job.clientSignatureId ?? undefined,
      clientSignatureName: job.clientSignatureName ?? undefined,
      technicianSignedAt: job.technicianSignedAt ?? undefined,
      lockedAt: job.lockedAt ?? undefined,
      lockedBy: job.lockedBy ?? undefined,
    };
  }
  return {};
}

export function isVisitLocked(
  visit: Pick<StoredJobVisit, 'id'> & Partial<StoredJobVisit>,
  job?: LegacyJobSignOff,
): boolean {
  return Boolean(visitSignOffData(visit, job).lockedAt);
}

export function lockedVisitCount(
  job: Pick<JobCard, 'visits'> & LegacyJobSignOff,
): number {
  return normalizeVisitsList(job.visits ?? []).filter((visit) => isVisitLocked(visit, job)).length;
}

export function signableDoneVisits(
  job: Pick<JobCard, 'visits'> & LegacyJobSignOff,
): StoredJobVisit[] {
  const visits = normalizeVisitsList(job.visits ?? []);
  if (hasActiveFollowUpVisits(visits)) return [];
  return visits.filter((visit) => visitStatus(visit) === 'done' && !isVisitLocked(visit, job));
}

/** Visit tied to sign-off (explicit id, else latest unlocked done visit). */
export function resolveSignOffVisit(
  job: Pick<JobCard, 'signatureVisitId' | 'visits'> & LegacyJobSignOff,
  preferredVisitId?: string | null,
): StoredJobVisit | null {
  const visits = normalizeVisitsList(job.visits ?? []);
  if (preferredVisitId) {
    const picked = visits.find((visit) => visit.id === preferredVisitId);
    if (picked) return picked;
  }
  if (job.signatureVisitId) {
    const linked = visits.find((visit) => visit.id === job.signatureVisitId);
    if (linked) return linked;
  }
  const done = signableDoneVisits(job);
  if (!done.length) {
    const anyDone = visits.filter((visit) => visitStatus(visit) === 'done');
    if (!anyDone.length) return null;
    return [...anyDone].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0];
  }
  return [...done].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0];
}

export function resolveSignOffVisitId(
  job: Pick<JobCard, 'signatureVisitId' | 'visits'> & LegacyJobSignOff,
  preferredVisitId?: string | null,
): string | null {
  return resolveSignOffVisit(job, preferredVisitId)?.id ?? null;
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

function patchVisitSignOff(
  visits: StoredJobVisit[],
  visitId: string,
  patch: VisitSignOffData,
): StoredJobVisit[] {
  return visits.map((visit) => (visit.id === visitId ? { ...visit, ...patch } : visit));
}

function clearLegacyJobSignOffFields(): Partial<JobCard> {
  return {
    lockedAt: null,
    lockedBy: null,
    technicianSignatureId: null,
    clientSignatureId: null,
    clientSignatureName: null,
    technicianSignedAt: null,
    signatureVisitId: null,
  };
}

/** Lock a visit — with optional signatures. Does not lock the whole job card. */
export function buildVisitLockPatch(
  job: Pick<JobCard, 'visits'> & LegacyJobSignOff,
  visitId: string,
  userId: string,
  signOff: VisitSignOffData = {},
): Partial<JobCard> {
  const lockedAt = signOff.lockedAt ?? new Date().toISOString();
  const visits = patchVisitSignOff(normalizeVisitsList(job.visits ?? []), visitId, {
    ...signOff,
    lockedAt,
    lockedBy: signOff.lockedBy ?? userId,
  });
  return {
    ...clearLegacyJobSignOffFields(),
    visits,
    signatureVisitId: visitId,
  };
}

export function buildUnlockVisitPatch(
  job: Pick<JobCard, 'visits'> & LegacyJobSignOff,
  visitId: string,
): Partial<JobCard> {
  const visits = patchVisitSignOff(normalizeVisitsList(job.visits ?? []), visitId, {
    technicianSignatureId: undefined,
    clientSignatureId: undefined,
    clientSignatureName: undefined,
    technicianSignedAt: undefined,
    lockedAt: undefined,
    lockedBy: undefined,
  });
  const patch: Partial<JobCard> = { visits };
  if (job.signatureVisitId === visitId) {
    Object.assign(patch, clearLegacyJobSignOffFields());
  }
  return patch;
}

export function clearAllVisitLocks(visits: StoredJobVisit[]): StoredJobVisit[] {
  return visits.map((visit) => ({
    ...visit,
    technicianSignatureId: undefined,
    clientSignatureId: undefined,
    clientSignatureName: undefined,
    technicianSignedAt: undefined,
    lockedAt: undefined,
    lockedBy: undefined,
  }));
}

export interface SignOffPdfBlock {
  visitLabel: string;
  technicianName: string;
  clientName: string;
  techSignedAt: string | null;
  clientSignedAt: string | null;
  lockedAt: string | null;
  techImageUri: string | null;
  clientImageUri: string | null;
  lockOnly: boolean;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSignOffRecapHtml(block: SignOffPdfBlock): string {
  const sigImg = (uri: string | null, alt: string, emptyLabel: string) =>
    uri
      ? `<div class="sig-img-wrap"><img src="${uri}" alt="${escapeHtml(alt)}" class="sig-img"/></div>`
      : `<p class="muted">${escapeHtml(emptyLabel)}</p>`;

  const lockNote = block.lockedAt
    ? `<p class="sig-lock-note">Locked ${escapeHtml(block.lockedAt)}</p>`
    : '';

  return `
    <p class="sig-visit"><strong>Visit:</strong> ${escapeHtml(block.visitLabel)}</p>
    ${lockNote}
    <div class="sig-grid">
      <div class="sig-card">
        <div class="sig-head">
          <strong>Technician</strong>
          <span>${escapeHtml(block.technicianName)}</span>
        </div>
        ${block.techSignedAt ? `<div class="sig-time">Signed ${escapeHtml(block.techSignedAt)}</div>` : ''}
        ${sigImg(block.techImageUri, 'Technician signature', block.lockOnly ? 'No signature' : 'Image unavailable')}
      </div>
      <div class="sig-card">
        <div class="sig-head">
          <strong>Client</strong>
          <span>${escapeHtml(block.clientName)}</span>
        </div>
        ${block.clientSignedAt ? `<div class="sig-time">Signed ${escapeHtml(block.clientSignedAt)}</div>` : ''}
        ${sigImg(block.clientImageUri, 'Client signature', block.lockOnly ? 'No signature' : 'Image unavailable')}
      </div>
    </div>`;
}

export function buildSignOffPdfBlockForVisit(
  visit: StoredJobVisit,
  job: Pick<JobCard, 'technicianName' | 'visits'> & LegacyJobSignOff,
  images: { tech: string | null; client: string | null },
): SignOffPdfBlock | null {
  const data = visitSignOffData(visit, job);
  if (!data.lockedAt && !data.clientSignatureId && !data.technicianSignatureId) return null;
  const visits = normalizeVisitsList(job.visits ?? []);
  const lockOnly = Boolean(data.lockedAt && !data.clientSignatureId && !data.technicianSignatureId);
  return {
    visitLabel: formatSignOffVisitLabel(visit, visits),
    technicianName: job.technicianName?.trim() || 'Technician',
    clientName: data.clientSignatureName?.trim() || (lockOnly ? '—' : 'Client'),
    techSignedAt: data.technicianSignedAt ? formatDateTime(data.technicianSignedAt) : null,
    clientSignedAt:
      data.clientSignatureId && data.lockedAt ? formatDateTime(data.lockedAt) : null,
    lockedAt: data.lockedAt ? formatDateTime(data.lockedAt) : null,
    techImageUri: images.tech,
    clientImageUri: images.client,
    lockOnly,
  };
}

/** @deprecated Prefer buildSignOffPdfBlockForVisit — kept for single-visit recap fallback. */
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
    | 'lockedBy'
  >,
  images: { tech: string | null; client: string | null },
): SignOffPdfBlock | null {
  const visit = resolveSignOffVisit(job);
  if (!visit) return null;
  return buildSignOffPdfBlockForVisit(visit, job, images);
}

export function visitsWithSignOff(
  job: Pick<JobCard, 'visits'> & LegacyJobSignOff,
): StoredJobVisit[] {
  return normalizeVisitsList(job.visits ?? []).filter((visit) => {
    const data = visitSignOffData(visit, job);
    return Boolean(data.lockedAt || data.clientSignatureId || data.technicianSignatureId);
  });
}
