import type { JobCard } from '../types/jobCard';
import type { OrgMember } from '../types/org';
import { getDescendantIds } from './orgHierarchy';

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
