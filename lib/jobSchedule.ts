import type { JobCard } from '../types/jobCard';
import { formatDate } from '../utils/formatDate';

export interface ScheduleLogEntry {
  at: string;
  userId: string;
  userName: string;
  fromDate: string;
  fromTime: string | null;
  toDate: string;
  toTime: string | null;
  note?: string;
}

export interface StoredJobSchedule {
  initialDate: string;
  initialTime: string | null;
  log: ScheduleLogEntry[];
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
        }))
        .filter((entry) => entry.fromDate && entry.toDate)
    : [];

  return {
    initialDate,
    initialTime: typeof row.initialTime === 'string' ? row.initialTime : null,
    log,
  };
}

export function initialSchedule(date: string, time: string | null): StoredJobSchedule {
  return { initialDate: date, initialTime: time, log: [] };
}

export function jobScheduledAt(job: Pick<JobCard, 'scheduledDate' | 'scheduledTime'>): Date | null {
  if (!job.scheduledDate) return null;
  const [y, m, d] = job.scheduledDate.split('-').map(Number);
  if (job.scheduledTime) {
    const [hh, mm] = job.scheduledTime.split(':').map(Number);
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
  'scheduledDate' | 'scheduledTime' | 'initialScheduledDate' | 'initialScheduledTime' | 'scheduleLog'
>): StoredJobSchedule {
  const initialDate = job.initialScheduledDate || job.scheduledDate;
  const initialTime = job.initialScheduledTime ?? job.scheduledTime ?? null;
  return {
    initialDate,
    initialTime,
    log: job.scheduleLog ?? [],
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

export function buildRescheduleUpdates(
  job: Pick<
    JobCard,
    'scheduledDate' | 'scheduledTime' | 'initialScheduledDate' | 'initialScheduledTime' | 'scheduleLog'
  >,
  toDate: string,
  toTime: string | null,
  actor: { id: string; name: string },
  note?: string,
): Pick<JobCard, 'scheduledDate' | 'scheduledTime' | 'initialScheduledDate' | 'initialScheduledTime' | 'scheduleLog'> {
  const fromDate = job.scheduledDate;
  const fromTime = job.scheduledTime ?? null;
  if (fromDate === toDate && fromTime === toTime) {
    throw new Error('Pick a different date or time.');
  }

  const schedule = appendScheduleLog(resolveStoredSchedule(job), {
    userId: actor.id,
    userName: actor.name,
    fromDate,
    fromTime,
    toDate,
    toTime,
    note: note?.trim() || undefined,
  });

  return {
    scheduledDate: toDate,
    scheduledTime: toTime,
    initialScheduledDate: schedule.initialDate,
    initialScheduledTime: schedule.initialTime,
    scheduleLog: schedule.log,
  };
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
