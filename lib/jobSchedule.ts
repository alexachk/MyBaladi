import type { JobCard } from '../types/jobCard';
import { formatDate } from '../utils/formatDate';
import {
  ensureVisitShape,
  nextScheduledVisit,
  normalizeVisitsList,
  parseStoredVisits,
  primaryVisitFields,
  type StoredJobVisit,
} from './jobVisits';

export type { StoredJobVisit };

export type ScheduleLogAction = 'rescheduled' | 'done' | 'added';

export interface ScheduleLogEntry {
  at: string;
  userId: string;
  userName: string;
  fromDate: string;
  fromTime: string | null;
  toDate: string;
  toTime: string | null;
  note?: string;
  action?: ScheduleLogAction;
  visitId?: string;
}

export interface StoredJobSchedule {
  initialDate: string;
  initialTime: string | null;
  log: ScheduleLogEntry[];
  visits: StoredJobVisit[];
}

export function parseStoredSchedule(raw: unknown): StoredJobSchedule | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;
  const initialDate = typeof row.initialDate === 'string' ? row.initialDate : '';
  if (!initialDate) return undefined;

  const log = Array.isArray(row.log)
    ? row.log
        .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
        .map((entry) => ({
          at: typeof entry.at === 'string' ? entry.at : new Date().toISOString(),
          userId: typeof entry.userId === 'string' ? entry.userId : '',
          userName: typeof entry.userName === 'string' ? entry.userName : '',
          fromDate: typeof entry.fromDate === 'string' ? entry.fromDate : '',
          fromTime: typeof entry.fromTime === 'string' ? entry.fromTime : null,
          toDate: typeof entry.toDate === 'string' ? entry.toDate : '',
          toTime: typeof entry.toTime === 'string' ? entry.toTime : null,
          note: typeof entry.note === 'string' && entry.note.trim() ? entry.note.trim() : undefined,
          action:
            entry.action === 'rescheduled' || entry.action === 'done' || entry.action === 'added'
              ? entry.action
              : undefined,
          visitId: typeof entry.visitId === 'string' && entry.visitId.trim() ? entry.visitId.trim() : undefined,
        } satisfies ScheduleLogEntry))
        .filter((entry) => entry.toDate || entry.action === 'done')
    : [];

  return {
    initialDate,
    initialTime: typeof row.initialTime === 'string' ? row.initialTime : null,
    log,
    visits: parseStoredVisits(row.visits, initialDate, typeof row.initialTime === 'string' ? row.initialTime : null),
  };
}

export function initialSchedule(date: string, time: string | null, visits?: StoredJobVisit[]): StoredJobSchedule {
  const resolvedVisits = visits?.length ? normalizeVisitsList(visits) : [ensureVisitShape({ date, time, status: 'scheduled' })];
  return {
    initialDate: date,
    initialTime: time,
    log: [],
    visits: resolvedVisits,
  };
}

export function jobScheduledAt(job: Pick<JobCard, 'scheduledDate' | 'scheduledTime' | 'visits'>): Date | null {
  const next = job.visits?.length ? nextScheduledVisit(normalizeVisitsList(job.visits)) : null;
  const date = next?.date || job.scheduledDate;
  const time = next?.time ?? job.scheduledTime ?? null;
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  if (time) {
    const [hh, mm] = time.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm);
  }
  return new Date(y, m - 1, d, 9, 0);
}

export function schedulePartsFromDate(value: Date): { date: string; time: string } {
  return {
    date: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
    time: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`,
  };
}

export function formatScheduleWhen(date: string, time: string | null | undefined): string {
  if (!date) return '—';
  const label = formatDate(date);
  return time ? `${label} · ${time}` : label;
}

export function formatScheduleLogEntry(entry: ScheduleLogEntry): string {
  if (entry.action === 'done') {
    return `Visit done · ${formatScheduleWhen(entry.toDate || entry.fromDate, entry.toTime ?? entry.fromTime)}`;
  }
  if (entry.action === 'added') {
    return `Follow-up visit · ${formatScheduleWhen(entry.toDate, entry.toTime)}`;
  }
  return `${formatScheduleWhen(entry.fromDate, entry.fromTime)} → ${formatScheduleWhen(entry.toDate, entry.toTime)}`;
}

export function scheduleWasRescheduled(job: Pick<
  JobCard,
  'scheduledDate' | 'scheduledTime' | 'initialScheduledDate' | 'initialScheduledTime' | 'scheduleLog'
>): boolean {
  const initialDate = job.initialScheduledDate || job.scheduledDate;
  const initialTime = job.initialScheduledTime ?? job.scheduledTime ?? null;
  if (initialDate !== job.scheduledDate) return true;
  return (initialTime ?? '') !== (job.scheduledTime ?? '');
}

export function resolveStoredSchedule(job: Pick<
  JobCard,
  'scheduledDate' | 'scheduledTime' | 'initialScheduledDate' | 'initialScheduledTime' | 'scheduleLog' | 'visits'
>): StoredJobSchedule {
  const initialDate = job.initialScheduledDate || job.scheduledDate;
  const initialTime = job.initialScheduledTime ?? job.scheduledTime ?? null;
  return {
    initialDate,
    initialTime,
    log: job.scheduleLog ?? [],
    visits: job.visits?.length
      ? normalizeVisitsList(job.visits)
      : parseStoredVisits(null, job.scheduledDate, job.scheduledTime ?? null),
  };
}

export function appendScheduleLog(
  schedule: StoredJobSchedule,
  entry: Omit<ScheduleLogEntry, 'at'> & { at?: string },
): StoredJobSchedule {
  return {
    ...schedule,
    log: [
      ...schedule.log,
      {
        ...entry,
        at: entry.at ?? new Date().toISOString(),
      },
    ],
  };
}

function resolveVisits(job: Pick<JobCard, 'scheduledDate' | 'scheduledTime' | 'visits'>): StoredJobVisit[] {
  return normalizeVisitsList(
    job.visits?.length
      ? job.visits
      : parseStoredVisits(null, job.scheduledDate, job.scheduledTime ?? null),
  );
}

function schedulePayloadFromVisits(
  job: Pick<
    JobCard,
    'scheduledDate' | 'scheduledTime' | 'initialScheduledDate' | 'initialScheduledTime' | 'scheduleLog' | 'visits'
  >,
  visits: StoredJobVisit[],
): Pick<
  JobCard,
  'scheduledDate' | 'scheduledTime' | 'initialScheduledDate' | 'initialScheduledTime' | 'scheduleLog' | 'visits'
> {
  const schedule = resolveStoredSchedule({ ...job, visits });
  const primary = primaryVisitFields(visits);
  return {
    scheduledDate: primary.scheduledDate,
    scheduledTime: primary.scheduledTime,
    initialScheduledDate: schedule.initialDate,
    initialScheduledTime: schedule.initialTime,
    scheduleLog: schedule.log,
    visits,
  };
}

export function buildRescheduleVisitUpdates(
  job: Pick<
    JobCard,
    | 'scheduledDate'
    | 'scheduledTime'
    | 'initialScheduledDate'
    | 'initialScheduledTime'
    | 'scheduleLog'
    | 'visits'
  >,
  visitId: string,
  toDate: string,
  toTime: string | null,
  actor: { id: string; name: string },
  note?: string,
): Pick<
  JobCard,
  'scheduledDate' | 'scheduledTime' | 'initialScheduledDate' | 'initialScheduledTime' | 'scheduleLog' | 'visits'
> {
  const visits = resolveVisits(job);
  const index = visits.findIndex((visit) => visit.id === visitId);
  if (index < 0) throw new Error('Visit not found.');
  const from = visits[index];
  if ((from.status ?? 'scheduled') !== 'scheduled') {
    throw new Error('Only scheduled visits can be rescheduled.');
  }
  if (from.date === toDate && (from.time ?? '') === (toTime ?? '')) {
    throw new Error('Pick a different date or time.');
  }

  const newVisit = ensureVisitShape({
    date: toDate,
    time: toTime,
    label: from.label ? `${from.label} (follow-up)` : undefined,
    status: 'scheduled',
    location: from.location,
    latitude: from.latitude,
    longitude: from.longitude,
  });

  const updatedVisits = visits.map((visit, i) =>
    i === index
      ? { ...visit, status: 'rescheduled' as const, rescheduledToId: newVisit.id }
      : visit,
  );
  updatedVisits.push(newVisit);

  const schedule = appendScheduleLog(resolveStoredSchedule({ ...job, visits: updatedVisits }), {
    userId: actor.id,
    userName: actor.name,
    fromDate: from.date,
    fromTime: from.time,
    toDate,
    toTime,
    note: note?.trim() || undefined,
    action: 'rescheduled',
    visitId: from.id,
  });

  return schedulePayloadFromVisits({ ...job, scheduleLog: schedule.log }, updatedVisits);
}

export function buildMarkVisitDoneUpdates(
  job: Pick<
    JobCard,
    | 'scheduledDate'
    | 'scheduledTime'
    | 'initialScheduledDate'
    | 'initialScheduledTime'
    | 'scheduleLog'
    | 'visits'
  >,
  visitId: string,
  actor: { id: string; name: string },
): Pick<
  JobCard,
  'scheduledDate' | 'scheduledTime' | 'initialScheduledDate' | 'initialScheduledTime' | 'scheduleLog' | 'visits'
> {
  const visits = resolveVisits(job);
  const index = visits.findIndex((visit) => visit.id === visitId);
  if (index < 0) throw new Error('Visit not found.');
  const visit = visits[index];
  if ((visit.status ?? 'scheduled') !== 'scheduled') {
    throw new Error('Visit already closed.');
  }

  const updatedVisits = visits.map((row, i) =>
    i === index
      ? { ...row, status: 'done' as const, completedAt: new Date().toISOString() }
      : row,
  );

  const schedule = appendScheduleLog(resolveStoredSchedule({ ...job, visits: updatedVisits }), {
    userId: actor.id,
    userName: actor.name,
    fromDate: visit.date,
    fromTime: visit.time,
    toDate: visit.date,
    toTime: visit.time,
    action: 'done',
    visitId: visit.id,
  });

  return schedulePayloadFromVisits({ ...job, scheduleLog: schedule.log }, updatedVisits);
}

export function buildAddFollowUpVisitUpdates(
  job: Pick<
    JobCard,
    | 'scheduledDate'
    | 'scheduledTime'
    | 'initialScheduledDate'
    | 'initialScheduledTime'
    | 'scheduleLog'
    | 'visits'
  >,
  toDate: string,
  toTime: string | null,
  actor: { id: string; name: string },
  label?: string,
): Pick<
  JobCard,
  'scheduledDate' | 'scheduledTime' | 'initialScheduledDate' | 'initialScheduledTime' | 'scheduleLog' | 'visits'
> {
  const visits = resolveVisits(job);
  const newVisit = ensureVisitShape({
    date: toDate,
    time: toTime,
    label: label?.trim() || `Follow-up ${visits.filter((visit) => visit.status !== 'rescheduled').length + 1}`,
    status: 'scheduled',
  });
  const updatedVisits = [...visits, newVisit];

  const schedule = appendScheduleLog(resolveStoredSchedule({ ...job, visits: updatedVisits }), {
    userId: actor.id,
    userName: actor.name,
    fromDate: '',
    fromTime: null,
    toDate,
    toTime,
    action: 'added',
    visitId: newVisit.id,
  });

  return schedulePayloadFromVisits({ ...job, scheduleLog: schedule.log }, updatedVisits);
}

/** @deprecated Use buildRescheduleVisitUpdates */
export function buildRescheduleUpdates(
  job: Pick<
    JobCard,
    | 'scheduledDate'
    | 'scheduledTime'
    | 'initialScheduledDate'
    | 'initialScheduledTime'
    | 'scheduleLog'
    | 'visits'
  >,
  toDate: string,
  toTime: string | null,
  actor: { id: string; name: string },
  note?: string,
): Pick<
  JobCard,
  'scheduledDate' | 'scheduledTime' | 'initialScheduledDate' | 'initialScheduledTime' | 'scheduleLog' | 'visits'
> {
  const visits = resolveVisits(job);
  const target = nextScheduledVisit(visits) ?? visits[0];
  if (!target) throw new Error('No visit to reschedule.');
  return buildRescheduleVisitUpdates(job, target.id, toDate, toTime, actor, note);
}

export function reminderAtFromSchedule(
  nextScheduledAt: Date,
  previousReminderAt: string | null | undefined,
  previousScheduledAt: Date | null,
): string | null {
  if (!previousReminderAt || !previousScheduledAt) return null;
  const previousReminder = new Date(previousReminderAt);
  const offsetMs = previousScheduledAt.getTime() - previousReminder.getTime();
  if (offsetMs <= 0) return null;
  return new Date(nextScheduledAt.getTime() - offsetMs).toISOString();
}
