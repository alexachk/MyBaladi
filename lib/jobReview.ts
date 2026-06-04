import type { JobCard } from '../types/jobCard';
import type { OrgMember } from '../types/org';
import { formatDateTime } from '../utils/formatDate';
import { getDescendantIds } from './orgHierarchy';
import type { RecapDocumentType } from './jobRecapExport';

export interface ReviewActor {
  id: string;
  name: string;
}

/** User ids tied to a job (technician + assignees) — review authority targets these. */
function jobOwnerIds(job: Pick<JobCard, 'technicianId' | 'assigneeId' | 'assignees'>): string[] {
  const ids = new Set<string>();
  if (job.technicianId) ids.add(job.technicianId);
  if (job.assigneeId) ids.add(job.assigneeId);
  for (const assignee of job.assignees ?? []) {
    if (assignee.userId) ids.add(assignee.userId);
  }
  return [...ids];
}

/** True when the user is a manager (N+1 or higher) of the job's technician/assignees, or admin. */
export function canReviewJob(
  job: Pick<JobCard, 'technicianId' | 'assigneeId' | 'assignees'>,
  userId: string | undefined,
  isAdmin: boolean,
  members: OrgMember[],
): boolean {
  if (isAdmin) return true;
  if (!userId) return false;
  const owners = new Set(jobOwnerIds(job));
  if (!owners.size) return false;
  // Reviewer must sit above at least one owner (and not be that owner themselves).
  const descendants = getDescendantIds(userId, members);
  return descendants.some((id) => owners.has(id) && id !== userId);
}

/** Whether the current user may submit the job for supervisor review. */
export function canSubmitForReview(
  job: Pick<JobCard, 'status' | 'reviewStatus' | 'lockedAt'>,
): boolean {
  if (job.lockedAt) return false;
  if (job.status === 'completed' || job.status === 'draft') return false;
  return job.reviewStatus !== 'submitted';
}

export function buildSubmitForReview(actor: ReviewActor): Partial<JobCard> {
  return {
    status: 'pending_review',
    reviewStatus: 'submitted',
    submittedById: actor.id,
    submittedAt: new Date().toISOString(),
    reviewedById: null,
    reviewedByName: null,
    reviewedAt: null,
    reviewNote: null,
    reviewBypassed: false,
  };
}

export function buildApproveReview(actor: ReviewActor): Partial<JobCard> {
  return {
    status: 'completed',
    reviewStatus: 'approved',
    reviewedById: actor.id,
    reviewedByName: actor.name,
    reviewedAt: new Date().toISOString(),
    reviewNote: null,
    reviewBypassed: false,
  };
}

export function buildRejectReview(
  actor: ReviewActor,
  note: string,
  job: Pick<JobCard, 'visits'>,
): Partial<JobCard> {
  const hasScheduled = (job.visits ?? []).some((visit) => (visit.status ?? 'scheduled') === 'scheduled');
  return {
    status: hasScheduled ? 'planned' : 'in_progress',
    reviewStatus: 'rejected',
    reviewedById: actor.id,
    reviewedByName: actor.name,
    reviewedAt: new Date().toISOString(),
    reviewNote: note.trim() || 'Changes requested.',
    reviewBypassed: false,
  };
}

/** Complete without supervisor review — flagged so reports show it was not revised. */
export function buildBypassComplete(actor: ReviewActor): Partial<JobCard> {
  return {
    status: 'completed',
    reviewStatus: 'approved',
    reviewedById: actor.id,
    reviewedByName: actor.name,
    reviewedAt: new Date().toISOString(),
    reviewBypassed: true,
  };
}

export function reviewBadge(job: Pick<JobCard, 'reviewStatus' | 'reviewBypassed'>): {
  label: string;
  tone: 'pending' | 'approved' | 'rejected' | 'none';
} | null {
  if (job.reviewBypassed && job.reviewStatus === 'approved') {
    return { label: 'Completed · not revised by supervisor', tone: 'rejected' };
  }
  switch (job.reviewStatus) {
    case 'submitted':
      return { label: 'Awaiting supervisor review', tone: 'pending' };
    case 'approved':
      return { label: 'Approved by supervisor', tone: 'approved' };
    case 'rejected':
      return { label: 'Changes requested', tone: 'rejected' };
    default:
      return null;
  }
}

export interface RecapValidationRow {
  label: string;
  value: string;
}

export type RecapValidationTone = 'pending' | 'approved' | 'rejected' | 'none' | 'bypass';

export interface RecapValidationDetails {
  statusLabel: string;
  tone: RecapValidationTone;
  rows: RecapValidationRow[];
}

function resolveSubmittedByName(
  job: Pick<JobCard, 'submittedById' | 'technicianId' | 'technicianName' | 'assignees'>,
): string | undefined {
  if (!job.submittedById) return undefined;
  if (job.technicianId === job.submittedById && job.technicianName?.trim()) {
    return job.technicianName.trim();
  }
  const assignee = job.assignees?.find((a) => a.userId === job.submittedById);
  return assignee?.name?.trim() || undefined;
}

/** Rows for recap PDF supervisor validation section. */
export function buildRecapValidationDetails(
  job: Pick<
    JobCard,
    | 'reviewStatus'
    | 'reviewBypassed'
    | 'submittedAt'
    | 'submittedById'
    | 'technicianId'
    | 'technicianName'
    | 'assignees'
    | 'reviewedByName'
    | 'reviewedAt'
    | 'reviewNote'
    | 'lockedAt'
    | 'clientSignatureName'
    | 'status'
  >,
): RecapValidationDetails {
  const badge = reviewBadge(job);
  const tone: RecapValidationTone =
    job.reviewBypassed && job.reviewStatus === 'approved'
      ? 'bypass'
      : (badge?.tone ?? 'none');
  const statusLabel =
    badge?.label ??
    (job.status === 'pending_review'
      ? 'Awaiting supervisor review'
      : 'No supervisor review on file');

  const rows: RecapValidationRow[] = [];

  if (job.submittedAt) {
    const who = resolveSubmittedByName(job);
    rows.push({
      label: 'Submitted for review',
      value: who
        ? `${formatDateTime(job.submittedAt)} · ${who}`
        : formatDateTime(job.submittedAt),
    });
  } else if (job.reviewStatus === 'submitted') {
    rows.push({ label: 'Submitted for review', value: 'Date not recorded' });
  }

  if (job.reviewBypassed && job.reviewedByName) {
    rows.push({
      label: 'Completed without supervisor revision',
      value: job.reviewedAt
        ? `${job.reviewedByName} · ${formatDateTime(job.reviewedAt)}`
        : job.reviewedByName,
    });
  } else if (
    (job.reviewStatus === 'approved' || job.reviewStatus === 'rejected') &&
    job.reviewedByName
  ) {
    const action = job.reviewStatus === 'approved' ? 'Approved by' : 'Reviewed by';
    rows.push({
      label: action,
      value: job.reviewedAt
        ? `${job.reviewedByName} · ${formatDateTime(job.reviewedAt)}`
        : job.reviewedByName,
    });
  }

  if (job.reviewNote?.trim()) {
    rows.push({ label: 'Supervisor note', value: job.reviewNote.trim() });
  }

  if (job.lockedAt) {
    rows.push({ label: 'Signed & locked', value: formatDateTime(job.lockedAt) });
  }

  if (job.clientSignatureName?.trim()) {
    rows.push({ label: 'Client sign-off', value: job.clientSignatureName.trim() });
  }

  return { statusLabel, tone, rows };
}

export function recapValidationSectionVisible(
  job: Pick<
    JobCard,
    | 'reviewStatus'
    | 'reviewBypassed'
    | 'lockedAt'
    | 'clientSignatureName'
    | 'status'
    | 'submittedAt'
  >,
  documentType: RecapDocumentType,
): boolean {
  if (documentType !== 'draft') return true;
  return Boolean(
    (job.reviewStatus && job.reviewStatus !== 'none') ||
      job.reviewBypassed ||
      job.lockedAt ||
      job.clientSignatureName ||
      job.submittedAt ||
      job.status === 'pending_review',
  );
}
