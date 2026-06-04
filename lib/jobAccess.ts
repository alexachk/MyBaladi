import type { JobCard } from '../types/jobCard';
import type { OrgMember } from '../types/org';
import { canReviewJob } from './jobReview';

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

/** Creator, team on card, or N+1+ of participants (same gate as review, minus admin shortcut). */
export function canManageJob(
  job: Pick<JobCard, 'technicianId' | 'assigneeId' | 'assignees'>,
  userId: string | undefined,
  isAdmin: boolean,
  members: OrgMember[],
): boolean {
  if (isAdmin) return true;
  if (!userId) return false;
  if (jobParticipantIds(job).includes(userId)) return true;
  return canReviewJob(job, userId, false, members);
}
