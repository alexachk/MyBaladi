import { getRoleLevel } from '../constants/positions';
import type { JobCard } from '../types/jobCard';
import type { OrgMember } from '../types/org';
import { canReviewJob } from './jobReview';
import { normalizeVisitsList, visitStatus, type StoredJobVisit } from './jobVisits';

function jobParticipantIds(
  job: Pick<JobCard, 'technicianId' | 'assigneeId' | 'assignees'>,
): string[] {
  const ids = new Set<string>();
  if (job.technicianId) ids.add(job.technicianId);
  if (job.assigneeId) ids.add(job.assigneeId);
  for (const assignee of job.assignees ?? []) {
    if (assignee.userId) ids.add(assignee.userId);
  }
  return [...ids];
}

export function isJobParticipant(
  job: Pick<JobCard, 'technicianId' | 'assigneeId' | 'assignees'>,
  userId: string | undefined,
): boolean {
  return Boolean(userId && jobParticipantIds(job).includes(userId));
}

/** Completed or signed off — field work closed until reopen. */
export function isJobTerminated(job: Pick<JobCard, 'status' | 'lockedAt'>): boolean {
  return job.status === 'completed' || Boolean(job.lockedAt);
}

/** Supervisor (N+1) has approved the job card. */
export function isSupervisorValidated(job: Pick<JobCard, 'reviewStatus'>): boolean {
  return job.reviewStatus === 'approved';
}

export function isSupervisorOfJob(
  job: Pick<JobCard, 'technicianId' | 'assigneeId' | 'assignees'>,
  userId: string | undefined,
  isAdmin: boolean,
  members: OrgMember[],
): boolean {
  return canReviewJob(job, userId, isAdmin, members);
}

/** Mission, work report, attachments, status (not visit-only reopen). */
export function canTechnicianEditJobContent(
  job: Pick<JobCard, 'technicianId' | 'assigneeId' | 'assignees' | 'status' | 'lockedAt' | 'reviewStatus'>,
  userId: string | undefined,
): boolean {
  if (!userId || !isJobParticipant(job, userId)) return false;
  if (isJobTerminated(job)) return false;
  if (isSupervisorValidated(job)) return false;
  return true;
}

export function canEditJobContent(
  job: Pick<
    JobCard,
    'technicianId' | 'assigneeId' | 'assignees' | 'status' | 'lockedAt' | 'reviewStatus'
  >,
  userId: string | undefined,
  isAdmin: boolean,
  members: OrgMember[],
): boolean {
  if (isAdmin) return true;
  if (!userId) return false;
  if (isSupervisorOfJob(job, userId, false, members)) return true;
  return canTechnicianEditJobContent(job, userId);
}

/** Add / reschedule visits; technicians may reopen a closed card with a new visit only. */
export function canScheduleJobVisits(
  job: Pick<
    JobCard,
    'technicianId' | 'assigneeId' | 'assignees' | 'status' | 'lockedAt' | 'reviewStatus'
  >,
  userId: string | undefined,
  isAdmin: boolean,
  members: OrgMember[],
): boolean {
  if (isAdmin) return true;
  if (!userId) return false;
  if (isSupervisorOfJob(job, userId, false, members)) return true;
  if (!isJobParticipant(job, userId)) return false;
  if (canTechnicianEditJobContent(job, userId)) return true;
  return isJobTerminated(job);
}

export function jobNeedsReopenForFollowUp(
  job: Pick<JobCard, 'status' | 'lockedAt' | 'reviewStatus'>,
): boolean {
  return isJobTerminated(job) || isSupervisorValidated(job);
}

/** Level 2+ (Supervisor, Operations Manager) or platform admin label. */
export function isLeadLevelUser(
  userPosition: string | undefined,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  const level = getRoleLevel(userPosition ?? '');
  return level !== null && level >= 2;
}

/** Done visits coexist with new scheduled / in-progress work (follow-up cycle). */
export function jobInFollowUpCycle(job: Pick<JobCard, 'visits'>): boolean {
  const visits = normalizeVisitsList(job.visits ?? []);
  const hasDone = visits.some((visit) => visitStatus(visit) === 'done');
  const hasActive = visits.some((visit) => {
    const status = visitStatus(visit);
    return status === 'scheduled' || status === 'in_progress';
  });
  return hasDone && hasActive;
}

/** Visit-linked mission / work / notes — done visits locked for L1 during follow-up. */
export function canEditVisitLinkedRecord(
  visit: Pick<StoredJobVisit, 'id' | 'status'>,
  job: Pick<
    JobCard,
    'technicianId' | 'assigneeId' | 'assignees' | 'status' | 'lockedAt' | 'reviewStatus' | 'visits'
  >,
  userId: string | undefined,
  isAdmin: boolean,
  members: OrgMember[],
  userPosition: string | undefined,
): boolean {
  if (isAdmin) return true;
  if (isSupervisorOfJob(job, userId, false, members)) return true;
  if (isLeadLevelUser(userPosition, false)) return true;
  if (!userId || !isJobParticipant(job, userId)) return false;
  if (!canTechnicianEditJobContent(job, userId)) return false;
  const status = visitStatus(visit);
  if (status === 'done' || status === 'rescheduled' || status === 'cancelled') {
    return !jobInFollowUpCycle(job);
  }
  return true;
}

/** Visit ids whose linked blobs are read-only for the current user. */
export function lockedVisitIdsForUser(
  job: Pick<
    JobCard,
    'technicianId' | 'assigneeId' | 'assignees' | 'status' | 'lockedAt' | 'reviewStatus' | 'visits'
  >,
  userId: string | undefined,
  isAdmin: boolean,
  members: OrgMember[],
  userPosition: string | undefined,
): Set<string> {
  const locked = new Set<string>();
  if (!jobInFollowUpCycle(job)) return locked;
  for (const visit of normalizeVisitsList(job.visits ?? [])) {
    if (
      !canEditVisitLinkedRecord(visit, job, userId, isAdmin, members, userPosition)
    ) {
      locked.add(visit.id);
    }
  }
  return locked;
}

/** Client & site — field team may adjust before scheduling a follow-up visit. */
export function canEditJobClientSite(
  job: Pick<
    JobCard,
    'technicianId' | 'assigneeId' | 'assignees' | 'status' | 'lockedAt' | 'reviewStatus'
  >,
  userId: string | undefined,
  isAdmin: boolean,
  members: OrgMember[],
): boolean {
  if (canEditJobContent(job, userId, isAdmin, members)) return true;
  if (!canScheduleJobVisits(job, userId, isAdmin, members)) return false;
  return jobNeedsReopenForFollowUp(job);
}

/** Clears lock / validation so the team can work a new visit. */
export function buildReopenJobFields(
  job: Pick<JobCard, 'status' | 'reviewStatus' | 'visits'>,
): Partial<JobCard> {
  const patch: Partial<JobCard> = {
    lockedAt: null,
    lockedBy: null,
  };
  const hasScheduled = job.visits?.some((visit) => (visit.status ?? 'scheduled') === 'scheduled');
  if (job.status === 'completed' || job.status === 'pending_review') {
    patch.status = hasScheduled ? 'planned' : 'in_progress';
  }
  if (job.reviewStatus === 'approved' || job.reviewStatus === 'submitted') {
    patch.reviewStatus = 'none';
    patch.submittedById = null;
    patch.submittedAt = null;
    patch.reviewedById = null;
    patch.reviewedByName = null;
    patch.reviewedAt = null;
    patch.reviewNote = null;
    patch.reviewBypassed = false;
  }
  return patch;
}

/** Who may remove the job card document (Appwrite delete ACL). */
export function canDeleteJobCard(
  job: Pick<
    JobCard,
    'technicianId' | 'assigneeId' | 'assignees' | 'status' | 'lockedAt' | 'reviewStatus'
  >,
  userId: string | undefined,
  isAdmin: boolean,
  members: OrgMember[],
): boolean {
  if (isAdmin) return true;
  if (!userId) return false;
  if (isSupervisorOfJob(job, userId, false, members)) return true;
  return canTechnicianEditJobContent(job, userId);
}

export function jobContentEditBlockReason(
  job: Pick<
    JobCard,
    'technicianId' | 'assigneeId' | 'assignees' | 'status' | 'lockedAt' | 'reviewStatus'
  >,
  userId: string | undefined,
  isAdmin: boolean,
  members: OrgMember[],
): string {
  if (canEditJobContent(job, userId, isAdmin, members)) return '';
  if (!userId || !isJobParticipant(job, userId)) {
    return 'You are not on the team for this job card.';
  }
  if (isSupervisorValidated(job)) {
    return 'Supervisor has approved this card. Only your N+1 can change it, or schedule a new visit to reopen.';
  }
  if (isJobTerminated(job)) {
    return 'This job is finished or signed. Use “Reopen · add visit” or ask your N+1.';
  }
  return 'You cannot edit this job card.';
}
