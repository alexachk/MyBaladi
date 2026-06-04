import type { JobCard } from '../types/jobCard';
import { formatHolidayList, getLebanonHolidaysByDate } from './lebanonHolidays';
import {
  visitScheduledAt,
  visitStatus,
  visitToDate,
  type JobVisitEntry,
  type StoredJobVisit,
} from './jobVisits';
import { DEFAULT_VISIT_DURATION_MINUTES, normalizeVisitDurationMinutes } from './visitDuration';

export type VisitScheduleWarningCode = 'weekend' | 'holiday' | 'conflict';

export interface VisitScheduleWarning {
  code: VisitScheduleWarningCode;
  message: string;
}

interface TimeWindow {
  start: Date;
  end: Date;
  dateIso: string;
}

interface BusySlot {
  jobId: string;
  jobReference: string;
  visitId: string;
  clientName: string;
  label?: string;
  start: Date;
  end: Date;
  assigneeIds: string[];
}

function toLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isWeekendIsoDate(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

function windowsOverlap(
  a: Pick<TimeWindow, 'start' | 'end'>,
  b: Pick<TimeWindow, 'start' | 'end'>,
): boolean {
  return a.start < b.end && b.start < a.end;
}

function visitWindow(
  date: string,
  time: string | null | undefined,
  durationMinutes: number | undefined,
): TimeWindow | null {
  if (!date?.trim()) return null;
  const [y, m, d] = date.split('-').map(Number);
  let hours = 9;
  let minutes = 0;
  if (time) {
    const [hh, mm] = time.split(':').map(Number);
    hours = hh;
    minutes = mm;
  }
  const start = new Date(y, m - 1, d, hours, minutes, 0, 0);
  const duration = normalizeVisitDurationMinutes(durationMinutes ?? DEFAULT_VISIT_DURATION_MINUTES);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  return { start, end, dateIso: date };
}

function windowFromEntry(
  entry: Pick<JobVisitEntry, 'visitDate' | 'estimatedArrivalAt' | 'estimatedDurationMinutes'>,
): TimeWindow | null {
  const scheduled = visitScheduledAt(entry);
  if (!scheduled) return null;
  const dateIso = toLocalIsoDate(entry.visitDate ?? scheduled);
  const time = `${String(scheduled.getHours()).padStart(2, '0')}:${String(scheduled.getMinutes()).padStart(2, '0')}`;
  return visitWindow(dateIso, time, entry.estimatedDurationMinutes);
}

function windowFromStoredVisit(visit: StoredJobVisit): TimeWindow | null {
  const status = visitStatus(visit);
  if (status === 'rescheduled' || status === 'cancelled') return null;
  return visitWindow(visit.date, visit.time, visit.durationMinutes);
}

function windowFromDateTime(at: Date, durationMinutes?: number): TimeWindow | null {
  const dateIso = toLocalIsoDate(at);
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  return visitWindow(dateIso, time, durationMinutes);
}

function formatWindowRange(window: TimeWindow): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fmt(window.start)}–${fmt(window.end)}`;
}

export function assigneeUserIdsFromJob(
  job: Pick<JobCard, 'technicianId' | 'assigneeId' | 'assignees'>,
): string[] {
  const ids = new Set<string>();
  if (job.technicianId) ids.add(job.technicianId);
  if (job.assigneeId) ids.add(job.assigneeId);
  for (const row of job.assignees ?? []) {
    if (row.userId) ids.add(row.userId);
  }
  return [...ids];
}

function jobCountsForScheduling(job: Pick<JobCard, 'status'>): boolean {
  return job.status !== 'completed' && job.status !== 'draft';
}

function collectBusySlots(
  jobs: Array<
    Pick<
      JobCard,
      | 'id'
      | 'reference'
      | 'clientName'
      | 'status'
      | 'technicianId'
      | 'assigneeId'
      | 'assignees'
      | 'visits'
      | 'scheduledDate'
      | 'scheduledTime'
    >
  >,
  options: { excludeVisitId?: string } = {},
): BusySlot[] {
  const slots: BusySlot[] = [];
  for (const job of jobs) {
    if (!jobCountsForScheduling(job)) continue;
    const assigneeIds = assigneeUserIdsFromJob(job);
    if (!assigneeIds.length) continue;

    const visits = job.visits?.length ? job.visits : [];
    if (visits.length) {
      for (const visit of visits) {
        if (options.excludeVisitId && visit.id === options.excludeVisitId) continue;
        const window = windowFromStoredVisit(visit);
        if (!window) continue;
        slots.push({
          jobId: job.id,
          jobReference: job.reference,
          visitId: visit.id,
          clientName: job.clientName,
          label: visit.label,
          start: window.start,
          end: window.end,
          assigneeIds,
        });
      }
      continue;
    }

    const window = visitWindow(job.scheduledDate, job.scheduledTime, DEFAULT_VISIT_DURATION_MINUTES);
    if (!window) continue;
    slots.push({
      jobId: job.id,
      jobReference: job.reference,
      visitId: '__legacy__',
      clientName: job.clientName,
      start: window.start,
      end: window.end,
      assigneeIds,
    });
  }
  return slots;
}

function collectSiblingSlots(
  entries: JobVisitEntry[],
  assigneeUserIds: string[],
  excludeVisitKey?: string,
): BusySlot[] {
  const slots: BusySlot[] = [];
  for (const entry of entries) {
    if (excludeVisitKey && entry.key === excludeVisitKey) continue;
    const window = windowFromEntry(entry);
    if (!window) continue;
    slots.push({
      jobId: '__draft__',
      jobReference: 'This card',
      visitId: entry.key,
      clientName: '',
      label: entry.label.trim() || undefined,
      start: window.start,
      end: window.end,
      assigneeIds: assigneeUserIds,
    });
  }
  return slots;
}

function sharedAssignees(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((id) => setB.has(id));
}

function conflictWarnings(
  window: TimeWindow,
  assigneeUserIds: string[],
  slots: BusySlot[],
): VisitScheduleWarning[] {
  if (!assigneeUserIds.length) return [];
  const warnings: VisitScheduleWarning[] = [];
  const seen = new Set<string>();

  for (const slot of slots) {
    const overlap = sharedAssignees(assigneeUserIds, slot.assigneeIds);
    if (!overlap.length) continue;
    if (!windowsOverlap(window, slot)) continue;

    const key = `${slot.jobId}:${slot.visitId}:${formatWindowRange({ start: slot.start, end: slot.end, dateIso: '' })}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const visitLabel = slot.label ? `${slot.label} · ` : '';
    const ref = slot.jobReference || 'Mission';
    const client = slot.clientName ? ` · ${slot.clientName}` : '';
    const range = formatWindowRange({ start: slot.start, end: slot.end, dateIso: '' });
    warnings.push({
      code: 'conflict',
      message: `Team already scheduled: ${visitLabel}${ref}${client} (${range})`,
    });
  }
  return warnings;
}

function weekendWarning(dateIso: string): VisitScheduleWarning | null {
  if (!isWeekendIsoDate(dateIso)) return null;
  const [y, m, d] = dateIso.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long' });
  return {
    code: 'weekend',
    message: `${label} is a weekend — confirm with the client if needed.`,
  };
}

function holidayWarning(dateIso: string): VisitScheduleWarning | null {
  const [y] = dateIso.split('-').map(Number);
  const holidays = getLebanonHolidaysByDate(y)[dateIso] ?? [];
  if (!holidays.length) return null;
  return {
    code: 'holiday',
    message: `Public holiday: ${formatHolidayList(holidays, 'en')}`,
  };
}

export function getVisitScheduleWarnings(input: {
  visitDate: Date | null;
  estimatedArrivalAt: Date | null;
  estimatedDurationMinutes: number;
  visitKey?: string;
  assigneeUserIds: string[];
  jobs?: Array<
    Pick<
      JobCard,
      | 'id'
      | 'reference'
      | 'clientName'
      | 'status'
      | 'technicianId'
      | 'assigneeId'
      | 'assignees'
      | 'visits'
      | 'scheduledDate'
      | 'scheduledTime'
    >
  >;
  siblingEntries?: JobVisitEntry[];
  excludeVisitId?: string;
}): VisitScheduleWarning[] {
  const window = windowFromEntry({
    visitDate: input.visitDate,
    estimatedArrivalAt: input.estimatedArrivalAt,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
  });
  if (!window) return [];

  const warnings: VisitScheduleWarning[] = [];
  const weekend = weekendWarning(window.dateIso);
  if (weekend) warnings.push(weekend);
  const holiday = holidayWarning(window.dateIso);
  if (holiday) warnings.push(holiday);

  const slots = [
    ...collectBusySlots(input.jobs ?? [], {
      excludeVisitId: input.excludeVisitId,
    }),
    ...collectSiblingSlots(
      input.siblingEntries ?? [],
      input.assigneeUserIds,
      input.visitKey,
    ),
  ];
  warnings.push(...conflictWarnings(window, input.assigneeUserIds, slots));
  return warnings;
}

/** Warnings when picking a single datetime (reschedule / add visit on job detail). */
export function getVisitDateTimeWarnings(input: {
  at: Date | null;
  durationMinutes?: number;
  assigneeUserIds: string[];
  jobs?: Array<
    Pick<
      JobCard,
      | 'id'
      | 'reference'
      | 'clientName'
      | 'status'
      | 'technicianId'
      | 'assigneeId'
      | 'assignees'
      | 'visits'
      | 'scheduledDate'
      | 'scheduledTime'
    >
  >;
  excludeVisitId?: string;
}): VisitScheduleWarning[] {
  const window = input.at ? windowFromDateTime(input.at, input.durationMinutes) : null;
  if (!window) return [];

  const warnings: VisitScheduleWarning[] = [];
  const weekend = weekendWarning(window.dateIso);
  if (weekend) warnings.push(weekend);
  const holiday = holidayWarning(window.dateIso);
  if (holiday) warnings.push(holiday);

  const slots = collectBusySlots(input.jobs ?? [], {
    excludeVisitId: input.excludeVisitId,
  });
  warnings.push(...conflictWarnings(window, input.assigneeUserIds, slots));
  return warnings;
}

/** Resolve visit duration for an existing stored visit (for reschedule warnings). */
export function storedVisitDurationMinutes(visit: StoredJobVisit): number {
  return normalizeVisitDurationMinutes(visit.durationMinutes ?? DEFAULT_VISIT_DURATION_MINUTES);
}

export function warningsFromStoredVisit(
  visit: StoredJobVisit,
  assigneeUserIds: string[],
  jobs: Parameters<typeof getVisitScheduleWarnings>[0]['jobs'],
): VisitScheduleWarning[] {
  const at = visitToDate(visit);
  if (!at) return [];
  return getVisitDateTimeWarnings({
    at,
    durationMinutes: storedVisitDurationMinutes(visit),
    assigneeUserIds,
    jobs,
    excludeVisitId: visit.id,
  });
}
