import type { JobCard } from '../types/jobCard';
import { jobScheduledAt, schedulePartsFromDate } from './jobSchedule';

function toLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Monday–Sunday (local) containing `reference` (default today). */
export function currentWeekIsoRange(reference = new Date()): { start: string; end: string } {
  const day = reference.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(reference);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(reference.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toLocalIsoDate(monday), end: toLocalIsoDate(sunday) };
}

/** Monday–Sunday (local) immediately before the current week. */
export function previousWeekIsoRange(reference = new Date()): { start: string; end: string } {
  const { start } = currentWeekIsoRange(reference);
  const [y, m, d] = start.split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  monday.setDate(monday.getDate() - 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toLocalIsoDate(monday), end: toLocalIsoDate(sunday) };
}

export function formatWeekRangeLabel(start: string, end: string): string {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const a = parse(start);
  const b = parse(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameMonth) {
    return `${a.toLocaleDateString(undefined, { weekday: 'short', ...opts })} – ${b.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`;
  }
  return `${a.toLocaleDateString(undefined, { weekday: 'short', ...opts })} – ${b.toLocaleDateString(undefined, { weekday: 'short', ...opts })}`;
}

/** ISO date (local) for the job's next scheduled visit, if any. */
export function missionScheduleDay(
  job: Pick<JobCard, 'scheduledDate' | 'scheduledTime' | 'visits'>,
): string | null {
  const at = jobScheduledAt(job);
  if (at) return schedulePartsFromDate(at).date;
  return job.scheduledDate?.trim() || null;
}

/** All schedule days on the card (visits + primary). */
export function missionScheduleDays(
  job: Pick<JobCard, 'scheduledDate' | 'scheduledTime' | 'visits'>,
): string[] {
  const days = new Set<string>();
  const primary = missionScheduleDay(job);
  if (primary) days.add(primary);
  for (const visit of job.visits ?? []) {
    if (visit.status === 'rescheduled') continue;
    const date = visit.date?.trim();
    if (date) days.add(date);
  }
  return [...days];
}

export function isMissionScheduledInWeek(
  job: JobCard,
  weekStart: string,
  weekEnd: string,
): boolean {
  return missionScheduleDays(job).some((day) => day >= weekStart && day <= weekEnd);
}

function sortMissionsBySchedule(jobs: JobCard[], direction: 'asc' | 'desc' = 'asc'): JobCard[] {
  return [...jobs].sort((a, b) => {
    const dayA = missionScheduleDay(a) ?? (direction === 'asc' ? '9999-12-31' : '');
    const dayB = missionScheduleDay(b) ?? (direction === 'asc' ? '9999-12-31' : '');
    if (dayA !== dayB) {
      return direction === 'asc' ? dayA.localeCompare(dayB) : dayB.localeCompare(dayA);
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/** Jobs with at least one visit (or primary schedule) in the given Mon–Sun week. */
export function homeMissionsInWeek(
  jobs: JobCard[],
  week: { start: string; end: string },
  options: { direction?: 'asc' | 'desc'; limit?: number } = {},
): JobCard[] {
  const { direction = 'asc', limit } = options;
  const filtered = sortMissionsBySchedule(
    jobs.filter((job) => isMissionScheduledInWeek(job, week.start, week.end)),
    direction,
  );
  return limit != null ? filtered.slice(0, limit) : filtered;
}

export function homeMissionsThisWeek(
  jobs: JobCard[],
  week: { start: string; end: string } = currentWeekIsoRange(),
): JobCard[] {
  return homeMissionsInWeek(jobs, week, { direction: 'asc' });
}

export function homeMissionsPastWeek(
  jobs: JobCard[],
  week: { start: string; end: string } = previousWeekIsoRange(),
): JobCard[] {
  return homeMissionsInWeek(jobs, week, { direction: 'desc' });
}
