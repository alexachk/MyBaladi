import type { ClientType } from './client';

export type JobStatus = 'draft' | 'in_progress' | 'completed' | 'pending_review';

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface JobCard {
  id: string;
  reference: string;
  clientName: string;
  siteAddress: string;
  contactName: string;
  contactPhone: string;
  missionType: string;
  equipment: string;
  technicianName: string;
  scheduledDate: string;
  arrivalTime: string;
  departureTime: string;
  workPerformed: string;
  partsUsed: string;
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

  scheduledTime?: string | null;
  reminderAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;

  technicianSignatureId?: string | null;
  clientSignatureId?: string | null;
  clientSignatureName?: string | null;
  lockedAt?: string | null;
  lockedBy?: string | null;
  notificationId?: string | null;
  calendarEventId?: string | null;

  photoIds?: string[];
  documentIds?: string[];
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  completed: 'Completed',
  pending_review: 'Pending Review',
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

export function isJobLocked(job: Pick<JobCard, 'lockedAt'>): boolean {
  return Boolean(job.lockedAt);
}
