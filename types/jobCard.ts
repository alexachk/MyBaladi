import type { ClientType } from './client';
import type { StoredJobAssignee } from '../lib/jobAssignees';
import type { StoredMissionScope } from '../lib/jobMissionScopes';
import type { StoredVisitNote } from '../lib/jobVisitNotes';
import type { StoredJobContact } from '../lib/jobContacts';
import type { ScheduleLogEntry } from '../lib/jobSchedule';
import type { StoredJobVisit } from '../lib/jobVisits';
import type { AttachmentVisitLinks } from '../lib/jobCardAttachments';
import type { StoredWorkReport } from '../lib/jobWorkReports';

export type JobStatus = 'draft' | 'planned' | 'in_progress' | 'completed' | 'pending_review';

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export type JobReviewStatus = 'none' | 'submitted' | 'approved' | 'rejected';

export interface JobCard {
  id: string;
  reference: string;
  clientName: string;
  siteAddress: string;
  contactName: string;
  contactPhone: string;
  missionType: string;
  missionTypes?: string[];
  missionScopes?: StoredMissionScope[];
  missionNotes?: StoredVisitNote[];
  equipment: string;
  equipmentItems?: string[];
  technicianName: string;
  scheduledDate: string;
  initialScheduledDate?: string | null;
  initialScheduledTime?: string | null;
  scheduleLog?: ScheduleLogEntry[];
  visits?: StoredJobVisit[];
  arrivalTime: string;
  departureTime: string;
  workPerformed: string;
  partsUsed: string;
  workReport?: StoredWorkReport;
  notes: string;
  status: JobStatus;
  priority: JobPriority;
  createdAt: string;
  updatedAt: string;

  clientType?: ClientType | null;
  personId?: string | null;
  companyId?: string | null;
  parentJobId?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  assignees?: StoredJobAssignee[];
  jobContacts?: StoredJobContact[];
  technicianId?: string | null;

  scheduledTime?: string | null;
  reminderAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;

  technicianSignatureId?: string | null;
  clientSignatureId?: string | null;
  clientSignatureName?: string | null;
  /** Visit this sign-off applies to (defaults to latest completed visit). */
  signatureVisitId?: string | null;
  technicianSignedAt?: string | null;
  lockedAt?: string | null;
  lockedBy?: string | null;
  notificationId?: string | null;
  calendarEventId?: string | null;

  reviewStatus?: JobReviewStatus;
  submittedById?: string | null;
  submittedAt?: string | null;
  reviewedById?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  reviewBypassed?: boolean;

  photoIds?: string[];
  documentIds?: string[];
  /** fileId → visitId (null / missing = general) */
  attachmentVisitLinks?: AttachmentVisitLinks;
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Draft',
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  pending_review: 'Pending Review',
};

export const JOB_REVIEW_STATUS_LABELS: Record<JobReviewStatus, string> = {
  none: 'Not submitted',
  submitted: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Changes requested',
};

export const JOB_PRIORITY_LABELS: Record<JobPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const MISSION_TYPES = [
  'Installation',
  'Maintenance',
  'Repair',
  'Inspection',
  'Commissioning',
  'Emergency Call-out',
  'Other',
] as const;

export function isJobLocked(job: Pick<JobCard, 'lockedAt' | 'visits'>): boolean {
  if (job.lockedAt) return true;
  return (job.visits ?? []).some((visit) => Boolean(visit.lockedAt));
}
