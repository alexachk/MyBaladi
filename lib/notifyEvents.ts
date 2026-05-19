import { createNotification, type CreateNotificationInput } from './appwrite/notifications';
import type { JobCard } from '../types/jobCard';

interface Actor {
  id: string;
  name: string;
  isAdmin: boolean;
}

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

export async function notifyJobCreated(job: JobCard, actor: Actor) {
  // Admins always get notified of new jobs (unless the actor is an admin who created it, then only the assignee learns — still useful for audit so we keep it).
  await send({
    ...baseFields(job, actor),
    recipientScope: 'admin',
    type: 'job_created',
    title: `New job card · ${job.reference}`,
    body: `${actor.name} created a mission for ${job.clientName || 'a client'}.`,
  });

  // If admin assigned to a different technician, notify the tech
  const assigneeId = job.lockedBy /* placeholder if added later */ ?? '';
  void assigneeId;
}

export async function notifyJobUpdated(
  job: JobCard,
  actor: Actor,
  changedFields: string[],
) {
  if (!changedFields.length) return;

  const summary = changedFields.join(', ');

  // Admin always gets a notification when techs change things
  if (!actor.isAdmin) {
    await send({
      ...baseFields(job, actor),
      recipientScope: 'admin',
      type: 'job_updated',
      title: `Job updated · ${job.reference}`,
      body: `${actor.name} updated ${summary}.`,
    });
  }

  // If actor is admin, notify the assigned technician (if different)
  // The technician id is on the document via permissions; we don't have a clean assignee field yet.
  // Fall back to lockedBy — not great. Future: add explicit assigneeId to JobCard.
}

export async function notifyJobLifecycle(
  job: JobCard,
  event: 'started' | 'finished' | 'signed' | 'reopened',
  actor: Actor,
) {
  const titleMap = {
    started: `Mission started · ${job.reference}`,
    finished: `Mission finished on site · ${job.reference}`,
    signed: `Job card signed & locked · ${job.reference}`,
    reopened: `Job card reopened · ${job.reference}`,
  };

  const typeMap = {
    started: 'job_started',
    finished: 'job_finished',
    signed: 'job_signed',
    reopened: 'job_reopened',
  } as const;

  await send({
    ...baseFields(job, actor),
    recipientScope: 'admin',
    type: typeMap[event],
    title: titleMap[event],
    body: `${actor.name} · ${job.clientName || 'client'}`,
  });
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
  // Admin gets notified about tech comments; tech gets notified about admin comments
  const snippet = body.length > 120 ? `${body.slice(0, 120)}…` : body;
  await send({
    ...baseFields(job, actor),
    recipientScope: 'admin',
    type: 'job_commented',
    title: `New comment · ${job.reference}`,
    body: `${actor.name}: ${snippet}`,
  });
}
