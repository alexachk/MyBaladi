import { createNotification, type CreateNotificationInput } from './appwrite/notifications';
import {
  formatScheduleLogOnSiteDetail,
  formatScheduleWhen,
  type ScheduleLogEntry,
} from './jobSchedule';
import type { JobCard } from '../types/jobCard';

interface Actor {
  id: string;
  name: string;
  isAdmin: boolean;
}

const FIELD_LABELS: Partial<Record<keyof JobCard, string>> = {
  reference: 'reference',
  clientName: 'client',
  siteAddress: 'site address',
  contactName: 'contact',
  contactPhone: 'contact phone',
  missionType: 'mission type',
  equipment: 'equipment',
  equipmentItems: 'equipment',
  scheduledDate: 'schedule',
  scheduledTime: 'schedule time',
  visits: 'visits',
  reminderAt: 'reminder',
  arrivalTime: 'arrival time',
  departureTime: 'departure time',
  workPerformed: 'work performed',
  partsUsed: 'parts used',
  workReport: 'work report',
  notes: 'notes',
  status: 'status',
  priority: 'priority',
  personId: 'client link',
  companyId: 'company link',
  photoIds: 'photos',
  documentIds: 'documents',
  assignees: 'team',
  jobContacts: 'contacts',
  missionTypes: 'mission types',
};

async function send(input: CreateNotificationInput) {
  try {
    await createNotification(input);
  } catch {
    // best-effort
  }
}

function baseFields(job: JobCard, actor: Actor) {
  return {
    jobId: job.id,
    jobReference: job.reference,
    actorId: actor.id,
    actorName: actor.name,
  };
}

function teamUserIds(job: JobCard): string[] {
  const ids = new Set<string>();
  if (job.assigneeId) ids.add(job.assigneeId);
  if (job.technicianId) ids.add(job.technicianId);
  for (const assignee of job.assignees ?? []) {
    if (assignee.userId) ids.add(assignee.userId);
  }
  return [...ids];
}

async function notifyAdmins(
  job: JobCard,
  actor: Actor,
  input: Omit<CreateNotificationInput, 'recipientScope' | 'recipientUserId'>,
) {
  await send({
    ...baseFields(job, actor),
    ...input,
    recipientScope: 'admin',
  });
}

async function notifyTeamMembers(
  job: JobCard,
  actor: Actor,
  input: Omit<CreateNotificationInput, 'recipientScope' | 'recipientUserId'>,
) {
  for (const userId of teamUserIds(job)) {
    if (userId === actor.id) continue;
    await send({
      ...baseFields(job, actor),
      ...input,
      recipientScope: 'user',
      recipientUserId: userId,
    });
  }
}

async function notifyJobAudience(
  job: JobCard,
  actor: Actor,
  input: Omit<CreateNotificationInput, 'recipientScope' | 'recipientUserId'>,
  opts: { admins?: boolean; team?: boolean } = { admins: true, team: true },
) {
  if (opts.admins !== false) {
    await notifyAdmins(job, actor, input);
  }
  if (opts.team !== false) {
    await notifyTeamMembers(job, actor, input);
  }
}

function formatChangedFields(fields: string[]): string {
  return fields
    .map((field) => FIELD_LABELS[field as keyof JobCard] ?? field)
    .join(', ');
}

export async function notifyJobCreated(job: JobCard, actor: Actor) {
  await notifyJobAudience(job, actor, {
    type: 'job_created',
    title: `New job card · ${job.reference}`,
    body: `${actor.name} created a mission for ${job.clientName || 'a client'}.`,
  });
}

export async function notifyJobUpdated(
  job: JobCard,
  actor: Actor,
  changedFields: string[],
) {
  if (!changedFields.length) return;

  const summary = formatChangedFields(changedFields);
  const payload = {
    type: 'job_updated' as const,
    title: `Job updated · ${job.reference}`,
    body: `${actor.name} updated ${summary}.`,
  };

  if (actor.isAdmin) {
    await notifyTeamMembers(job, actor, payload);
  } else {
    await notifyAdmins(job, actor, payload);
  }
}

export async function notifyJobLifecycle(
  job: JobCard,
  event: 'started' | 'finished' | 'signed' | 'reopened' | 'completed',
  actor: Actor,
) {
  const titleMap = {
    started: `Mission started · ${job.reference}`,
    finished: `Mission finished on site · ${job.reference}`,
    signed: `Job completed & signed · ${job.reference}`,
    completed: `Job completed · ${job.reference}`,
    reopened: `Job card reopened · ${job.reference}`,
  };

  const typeMap = {
    started: 'job_started',
    finished: 'job_finished',
    signed: 'job_signed',
    completed: 'job_completed',
    reopened: 'job_reopened',
  } as const;

  const bodyMap = {
    started: `${actor.name} started the mission · ${job.clientName || 'client'}`,
    finished: `${actor.name} finished on site · ${job.clientName || 'client'}`,
    signed: `${actor.name} signed off · ${job.clientName || 'client'}`,
    completed: `${actor.name} marked job completed · ${job.clientName || 'client'}`,
    reopened: `${actor.name} reopened the job card`,
  };

  await notifyJobAudience(job, actor, {
    type: typeMap[event],
    title: titleMap[event],
    body: bodyMap[event],
  });
}

export async function notifyVisitScheduleEvents(
  job: JobCard,
  actor: Actor,
  entries: ScheduleLogEntry[],
) {
  for (const entry of entries) {
    if (entry.action === 'rescheduled') {
      const fromWhen = formatScheduleWhen(entry.fromDate, entry.fromTime);
      const toWhen = formatScheduleWhen(entry.toDate, entry.toTime);
      const note = entry.note ? ` · ${entry.note}` : '';
      await notifyJobAudience(job, actor, {
        type: 'visit_rescheduled',
        title: `Visit rescheduled · ${job.reference}`,
        body: `${actor.name}: ${fromWhen} → ${toWhen}${note}`,
      });
      continue;
    }

    if (entry.action === 'done') {
      const when = formatScheduleWhen(entry.toDate || entry.fromDate, entry.toTime ?? entry.fromTime);
      const onSite = formatScheduleLogOnSiteDetail(entry, job.visits);
      const stamp = onSite ? ` · ${onSite}` : '';
      await notifyJobAudience(job, actor, {
        type: 'visit_done',
        title: `Visit done · ${job.reference}`,
        body: `${actor.name} completed visit · ${when}${stamp}`,
      });
      continue;
    }

    if (entry.action === 'added') {
      const when = formatScheduleWhen(entry.toDate, entry.toTime);
      await notifyJobAudience(job, actor, {
        type: 'visit_added',
        title: `Visit added · ${job.reference}`,
        body: `${actor.name} programmed ${when}`,
      });
    }
  }
}

export async function notifyJobAssigned(job: JobCard, actor: Actor, assigneeId: string) {
  if (!assigneeId || assigneeId === actor.id) return;
  await send({
    ...baseFields(job, actor),
    recipientScope: 'user',
    recipientUserId: assigneeId,
    type: 'job_assigned',
    title: `Mission assigned · ${job.reference}`,
    body: `${actor.name} assigned ${job.clientName || 'a job'} to you.`,
  });
}

export async function notifyComment(job: JobCard, actor: Actor, body: string) {
  const snippet = body.length > 120 ? `${body.slice(0, 120)}…` : body;
  const payload = {
    type: 'job_commented' as const,
    title: `New comment · ${job.reference}`,
    body: `${actor.name}: ${snippet}`,
  };

  if (actor.isAdmin) {
    await notifyTeamMembers(job, actor, payload);
  } else {
    await notifyAdmins(job, actor, payload);
  }
}
