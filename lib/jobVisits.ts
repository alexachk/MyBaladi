import { newContactKey } from './clientContact';
import type { JobCard } from '../types/jobCard';
import {
  DEFAULT_VISIT_DURATION_MINUTES,
  formatVisitDurationShort,
  normalizeVisitDurationMinutes,
} from './visitDuration';

export type JobVisitStatus = 'scheduled' | 'in_progress' | 'done' | 'rescheduled' | 'cancelled';

export interface StoredJobVisit {
  id: string;
  date: string;
  time: string | null;
  label?: string;
  status?: JobVisitStatus;
  completedAt?: string;
  rescheduledToId?: string;
  /** Prior done visit this follow-up continues (reopen without erasing history). */
  followUpOfVisitId?: string;
  /** Planned length of visit (15-minute steps). */
  durationMinutes?: number;
  /** Actual on-site times (HH:mm). */
  arrivalTime?: string;
  departureTime?: string;
  calendarEventId?: string;
  /** When set, visit uses this address instead of the job site */
  location?: string;
  latitude?: number;
  longitude?: number;
  /** Per-visit sign-off — locks this visit only, not the whole job card. */
  technicianSignatureId?: string;
  clientSignatureId?: string;
  clientSignatureName?: string;
  technicianSignedAt?: string;
  lockedAt?: string;
  lockedBy?: string;
}

export interface JobVisitEntry {
  key: string;
  visitDate: Date | null;
  estimatedArrivalAt: Date | null;
  estimatedDurationMinutes: number;
  label: string;
  actualArrivalAt: Date | null;
  actualDepartureAt: Date | null;
  useJobLocation: boolean;
  location: string;
  latitude?: number;
  longitude?: number;
}

/** Combined scheduled start for reminders / calendar / links. */
export function visitScheduledAt(
  entry: Pick<JobVisitEntry, 'visitDate' | 'estimatedArrivalAt'>,
): Date | null {
  return mergeVisitSchedule(entry.visitDate, entry.estimatedArrivalAt);
}

export function mergeVisitSchedule(visitDate: Date | null, estimatedArrivalAt: Date | null): Date | null {
  if (!visitDate && !estimatedArrivalAt) return null;
  const base = visitDate ? new Date(visitDate) : new Date();
  if (estimatedArrivalAt) {
    base.setHours(estimatedArrivalAt.getHours(), estimatedArrivalAt.getMinutes(), 0, 0);
  } else {
    base.setHours(9, 0, 0, 0);
  }
  return base;
}

function dateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
}

export const JOB_VISIT_STATUS_LABELS: Record<JobVisitStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'On site',
  done: 'Done',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
};

function parseVisitStatus(value: unknown): JobVisitStatus {
  if (
    value === 'done' ||
    value === 'rescheduled' ||
    value === 'cancelled' ||
    value === 'scheduled' ||
    value === 'in_progress'
  ) {
    return value;
  }
  return 'scheduled';
}

export function ensureVisitShape(visit: Partial<StoredJobVisit> & Pick<StoredJobVisit, 'date'>): StoredJobVisit {
  return {
    id: visit.id?.trim() || newContactKey('visit'),
    date: visit.date,
    time: visit.time ?? null,
    label: visit.label?.trim() || undefined,
    status: visit.status ?? 'scheduled',
    completedAt: visit.completedAt,
    rescheduledToId: visit.rescheduledToId,
    followUpOfVisitId: visit.followUpOfVisitId?.trim() || undefined,
    durationMinutes:
      visit.durationMinutes != null
        ? normalizeVisitDurationMinutes(visit.durationMinutes)
        : undefined,
    arrivalTime: visit.arrivalTime?.trim() || undefined,
    departureTime: visit.departureTime?.trim() || undefined,
    calendarEventId: visit.calendarEventId?.trim() || undefined,
    location: visit.location?.trim() || undefined,
    latitude: typeof visit.latitude === 'number' ? visit.latitude : undefined,
    longitude: typeof visit.longitude === 'number' ? visit.longitude : undefined,
    technicianSignatureId: visit.technicianSignatureId?.trim() || undefined,
    clientSignatureId: visit.clientSignatureId?.trim() || undefined,
    clientSignatureName: visit.clientSignatureName?.trim() || undefined,
    technicianSignedAt: visit.technicianSignedAt?.trim() || undefined,
    lockedAt: visit.lockedAt?.trim() || undefined,
    lockedBy: visit.lockedBy?.trim() || undefined,
  };
}

export function normalizeVisitsList(visits: StoredJobVisit[]): StoredJobVisit[] {
  return visits.map((visit) => ensureVisitShape(visit));
}

/** 1-based label for the next visit on a job card. */
export function defaultVisitNumberLabel(visits: StoredJobVisit[]): string {
  return `Visit ${visits.length + 1}`;
}

export function visitRowLabel(
  visit: Pick<StoredJobVisit, 'label'>,
  index: number,
): string {
  return visit.label?.trim() || `Visit ${index + 1}`;
}

export function defaultVisitEntry(at: Date | null = new Date()): JobVisitEntry {
  const seed = at ?? new Date();
  return {
    key: newContactKey('visit'),
    visitDate: dateOnly(seed),
    estimatedArrivalAt: new Date(
      seed.getFullYear(),
      seed.getMonth(),
      seed.getDate(),
      seed.getHours(),
      seed.getMinutes(),
      0,
      0,
    ),
    estimatedDurationMinutes: DEFAULT_VISIT_DURATION_MINUTES,
    label: '',
    actualArrivalAt: null,
    actualDepartureAt: null,
    useJobLocation: true,
    location: '',
  };
}

function timePartsFromDate(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function timeOnVisitDate(date: string, time: string | null | undefined): Date | null {
  if (!date || !time) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function partsFromDate(value: Date): { date: string; time: string } {
  return {
    date: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
    time: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`,
  };
}

export function visitToDate(visit: Pick<StoredJobVisit, 'date' | 'time'>): Date | null {
  if (!visit.date) return null;
  const [y, m, d] = visit.date.split('-').map(Number);
  if (visit.time) {
    const [hh, mm] = visit.time.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm);
  }
  return new Date(y, m - 1, d, 9, 0);
}

export function visitStatus(visit: Pick<StoredJobVisit, 'status'>): JobVisitStatus {
  return visit.status ?? 'scheduled';
}

export function nextScheduledVisit(visits: StoredJobVisit[]): StoredJobVisit | null {
  const scheduled = visits
    .filter((visit) => visitStatus(visit) === 'scheduled')
    .sort(compareStoredVisits);
  return scheduled[0] ?? null;
}

export function visitsForCalendar(visits: StoredJobVisit[]): StoredJobVisit[] {
  return visits.filter((visit) => {
    const status = visitStatus(visit);
    return status === 'scheduled' || status === 'done';
  });
}

/** Phone calendar — upcoming visits only (excludes rescheduled / cancelled / done). */
export function visitsForPhoneCalendar(visits: StoredJobVisit[]): StoredJobVisit[] {
  return normalizeVisitsList(visits)
    .filter((visit) => visitStatus(visit) === 'scheduled')
    .sort(compareStoredVisits);
}

export function collectVisitCalendarEventIds(visits: StoredJobVisit[]): string[] {
  return [
    ...new Set(
      normalizeVisitsList(visits)
        .map((visit) => visit.calendarEventId?.trim())
        .filter(Boolean) as string[],
    ),
  ];
}

export function normalizeVisitEntries(entries: JobVisitEntry[]): StoredJobVisit[] {
  const out: StoredJobVisit[] = [];
  for (const entry of entries) {
    const scheduledAt = visitScheduledAt(entry);
    if (!scheduledAt) continue;
    const { date, time } = partsFromDate(scheduledAt);
    const label = entry.label.trim();
    const customLocation = !entry.useJobLocation && entry.location.trim();
    out.push(
      ensureVisitShape({
        id: entry.key,
        date,
        time,
        label: label || undefined,
        status: 'scheduled',
        durationMinutes: entry.estimatedDurationMinutes,
        arrivalTime: entry.actualArrivalAt ? timePartsFromDate(entry.actualArrivalAt) : undefined,
        departureTime: entry.actualDepartureAt ? timePartsFromDate(entry.actualDepartureAt) : undefined,
        location: customLocation ? entry.location.trim() : undefined,
        latitude: customLocation && typeof entry.latitude === 'number' ? entry.latitude : undefined,
        longitude: customLocation && typeof entry.longitude === 'number' ? entry.longitude : undefined,
      }),
    );
  }
  return out.sort(compareStoredVisits);
}

export function parseStoredVisits(
  raw: unknown,
  fallbackDate?: string,
  fallbackTime?: string | null,
): StoredJobVisit[] {
  if (Array.isArray(raw)) {
    const visits = raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const date = typeof row.date === 'string' ? row.date.trim() : '';
        if (!date) return null;
        const time = typeof row.time === 'string' ? row.time.trim() : null;
        const label = typeof row.label === 'string' && row.label.trim() ? row.label.trim() : undefined;
        const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : newContactKey('visit');
        const status = parseVisitStatus(row.status);
        const completedAt =
          typeof row.completedAt === 'string' && row.completedAt.trim() ? row.completedAt.trim() : undefined;
        const rescheduledToId =
          typeof row.rescheduledToId === 'string' && row.rescheduledToId.trim()
            ? row.rescheduledToId.trim()
            : undefined;
        const followUpOfVisitId =
          typeof row.followUpOfVisitId === 'string' && row.followUpOfVisitId.trim()
            ? row.followUpOfVisitId.trim()
            : undefined;
        const durationMinutes =
          typeof row.durationMinutes === 'number' ? row.durationMinutes : undefined;
        const arrivalTime =
          typeof row.arrivalTime === 'string' && row.arrivalTime.trim() ? row.arrivalTime.trim() : undefined;
        const departureTime =
          typeof row.departureTime === 'string' && row.departureTime.trim() ? row.departureTime.trim() : undefined;
        const location =
          typeof row.location === 'string' && row.location.trim() ? row.location.trim() : undefined;
        const latitude = typeof row.latitude === 'number' ? row.latitude : undefined;
        const longitude = typeof row.longitude === 'number' ? row.longitude : undefined;
        const calendarEventId =
          typeof row.calendarEventId === 'string' && row.calendarEventId.trim()
            ? row.calendarEventId.trim()
            : undefined;
        const technicianSignatureId =
          typeof row.technicianSignatureId === 'string' && row.technicianSignatureId.trim()
            ? row.technicianSignatureId.trim()
            : undefined;
        const clientSignatureId =
          typeof row.clientSignatureId === 'string' && row.clientSignatureId.trim()
            ? row.clientSignatureId.trim()
            : undefined;
        const clientSignatureName =
          typeof row.clientSignatureName === 'string' && row.clientSignatureName.trim()
            ? row.clientSignatureName.trim()
            : undefined;
        const technicianSignedAt =
          typeof row.technicianSignedAt === 'string' && row.technicianSignedAt.trim()
            ? row.technicianSignedAt.trim()
            : undefined;
        const lockedAt =
          typeof row.lockedAt === 'string' && row.lockedAt.trim() ? row.lockedAt.trim() : undefined;
        const lockedBy =
          typeof row.lockedBy === 'string' && row.lockedBy.trim() ? row.lockedBy.trim() : undefined;
        return ensureVisitShape({
          id,
          date,
          time: time || null,
          label,
          status,
          completedAt,
          rescheduledToId,
          followUpOfVisitId,
          durationMinutes,
          arrivalTime,
          departureTime,
          calendarEventId,
          location,
          latitude,
          longitude,
          technicianSignatureId,
          clientSignatureId,
          clientSignatureName,
          technicianSignedAt,
          lockedAt,
          lockedBy,
        });
      })
      .filter(Boolean) as StoredJobVisit[];
    if (visits.length) return visits.sort(compareStoredVisits);
  }

  if (fallbackDate?.trim()) {
    return [
      ensureVisitShape({
        date: fallbackDate.trim(),
        time: fallbackTime ?? null,
        status: 'scheduled',
      }),
    ];
  }

  return [];
}

export function visitsForForm(
  stored?: StoredJobVisit[] | null,
  legacyDate?: string,
  legacyTime?: string | null,
): JobVisitEntry[] {
  const visits = stored?.length
    ? normalizeVisitsList(stored)
    : parseStoredVisits(null, legacyDate, legacyTime ?? null);
  if (!visits.length) return [defaultVisitEntry(new Date())];
  return visits.map((visit, index) => {
    const scheduled = visitToDate(visit);
    return {
      key: visit.id,
      visitDate: scheduled ? dateOnly(scheduled) : null,
      estimatedArrivalAt: scheduled
        ? new Date(
            scheduled.getFullYear(),
            scheduled.getMonth(),
            scheduled.getDate(),
            scheduled.getHours(),
            scheduled.getMinutes(),
            0,
            0,
          )
        : timeOnVisitDate(visit.date, visit.time),
      estimatedDurationMinutes: normalizeVisitDurationMinutes(visit.durationMinutes),
      label: visit.label ?? (visits.length > 1 ? `Visit ${index + 1}` : ''),
      actualArrivalAt: timeOnVisitDate(visit.date, visit.arrivalTime),
      actualDepartureAt: timeOnVisitDate(visit.date, visit.departureTime),
      useJobLocation: !visit.location?.trim(),
      location: visit.location?.trim() ?? '',
      latitude: visit.latitude,
      longitude: visit.longitude,
    };
  });
}

export function primaryVisitFields(visits: StoredJobVisit[]): {
  scheduledDate: string;
  scheduledTime: string | null;
} {
  const next = nextScheduledVisit(visits);
  if (next) return { scheduledDate: next.date, scheduledTime: next.time };
  const last = [...visits].sort(compareStoredVisits).at(-1);
  if (!last) return { scheduledDate: '', scheduledTime: null };
  return { scheduledDate: last.date, scheduledTime: last.time };
}

export function jobVisitDates(job: Pick<JobCard, 'visits' | 'scheduledDate'>): string[] {
  const dates = new Set<string>();
  const visits = job.visits?.length
    ? visitsForCalendar(normalizeVisitsList(job.visits))
    : job.scheduledDate
      ? [{ date: job.scheduledDate, time: null, id: 'legacy', status: 'scheduled' as const }]
      : [];
  for (const visit of visits) {
    if (visit.date) dates.add(visit.date);
  }
  return [...dates].sort();
}

export function jobHasVisitOnDate(
  job: Pick<JobCard, 'visits' | 'scheduledDate'>,
  date: string,
): boolean {
  return jobVisitDates(job).includes(date);
}

export function visitOnDate(
  job: Pick<JobCard, 'visits' | 'scheduledDate' | 'scheduledTime'>,
  date: string,
): StoredJobVisit | null {
  if (job.visits?.length) {
    const matches = visitsForCalendar(normalizeVisitsList(job.visits))
      .filter((visit) => visit.date === date)
      .sort(compareStoredVisits);
    return matches[0] ?? null;
  }
  if (job.scheduledDate === date) {
    return ensureVisitShape({
      date: job.scheduledDate,
      time: job.scheduledTime ?? null,
      status: 'scheduled',
    });
  }
  return null;
}

export function visitUsesJobLocation(visit: Pick<StoredJobVisit, 'location'>): boolean {
  return !visit.location?.trim();
}

export function resolveVisitLocation(
  visit: Pick<StoredJobVisit, 'location'>,
  jobSiteAddress: string,
): string {
  const custom = visit.location?.trim();
  return custom || jobSiteAddress.trim() || '';
}

export function formatVisitLocationLabel(
  visit: Pick<StoredJobVisit, 'location'>,
  jobSiteAddress: string,
): string {
  if (visitUsesJobLocation(visit)) {
    const site = jobSiteAddress.trim();
    return site ? `Job site · ${site}` : 'Job site';
  }
  return visit.location!.trim();
}

export function compareStoredVisits(a: StoredJobVisit, b: StoredJobVisit): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return (a.time ?? '99:99').localeCompare(b.time ?? '99:99');
}

export function sortVisitsTimeline(visits: StoredJobVisit[]): StoredJobVisit[] {
  return [...normalizeVisitsList(visits)].sort(compareStoredVisits);
}

export function hasActiveFollowUpVisits(visits: StoredJobVisit[]): boolean {
  return normalizeVisitsList(visits).some((visit) => {
    const status = visitStatus(visit);
    return status === 'scheduled' || status === 'in_progress';
  });
}

export function followUpVisitFor(
  visits: StoredJobVisit[],
  priorVisitId: string,
): StoredJobVisit | undefined {
  return normalizeVisitsList(visits).find((visit) => visit.followUpOfVisitId === priorVisitId);
}

export function formatVisitWhen(
  visit: Pick<StoredJobVisit, 'date' | 'time' | 'durationMinutes'>,
): string {
  if (!visit.date) return '—';
  const [y, m, d] = visit.date.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const label = date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timePart = visit.time ? ` · ${visit.time}` : '';
  const durationPart =
    visit.durationMinutes != null
      ? ` · ${formatVisitDurationShort(visit.durationMinutes)}`
      : '';
  return `${label}${timePart}${durationPart}`;
}

export function formatVisitEstimatedWindow(
  visit: Pick<StoredJobVisit, 'date' | 'time' | 'durationMinutes'>,
): string {
  const when = formatVisitWhen(visit);
  if (!visit.time || visit.durationMinutes == null) return when;
  const [hh, mm] = visit.time.split(':').map(Number);
  const end = new Date(2000, 0, 1, hh, mm + visit.durationMinutes);
  const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  return `${when} → ${endTime}`;
}

export function formatVisitLine(visit: StoredJobVisit, allVisits: StoredJobVisit[]): string {
  const when = formatVisitWhen(visit);
  const status = visitStatus(visit);
  const prefix = visit.label ? `${visit.label} · ${when}` : when;
  if (status === 'rescheduled' && visit.rescheduledToId) {
    const target = allVisits.find((row) => row.id === visit.rescheduledToId);
    if (target) return `${prefix} → ${formatVisitWhen(target)} · ${JOB_VISIT_STATUS_LABELS.rescheduled}`;
  }
  if (status === 'scheduled') return prefix;
  return `${prefix} · ${JOB_VISIT_STATUS_LABELS[status]}`;
}

export function formatVisitsDisplay(visits: StoredJobVisit[]): string {
  const normalized = sortVisitsTimeline(visits);
  if (!normalized.length) return '';
  return normalized.map((visit, index) => {
    const line = formatVisitLine(visit, normalized);
    return visit.label ? line : `Visit ${index + 1} · ${line}`;
  }).join('\n');
}

export function jobIsScheduled(job: Pick<JobCard, 'visits' | 'scheduledDate'>): boolean {
  if (job.visits?.length) {
    return job.visits.some((visit) => visitStatus(visit) === 'scheduled');
  }
  return Boolean(job.scheduledDate);
}

export function scheduledVisitCount(visits: StoredJobVisit[] | undefined): number {
  return (visits ?? []).filter((visit) => visitStatus(visit) === 'scheduled').length;
}

export function doneVisitCount(visits: StoredJobVisit[] | undefined): number {
  return (visits ?? []).filter((visit) => visitStatus(visit) === 'done').length;
}

export function patchVisitInList(
  visits: StoredJobVisit[],
  visitId: string,
  patch: Partial<StoredJobVisit>,
): StoredJobVisit[] {
  return normalizeVisitsList(
    visits.map((visit) => (visit.id === visitId ? ensureVisitShape({ ...visit, ...patch }) : visit)),
  );
}

export function visitInProgress(visits: StoredJobVisit[]): StoredJobVisit | null {
  return (
    visits.find(
      (visit) =>
        visitStatus(visit) === 'in_progress' || (visit.arrivalTime && !visit.departureTime),
    ) ?? null
  );
}

export function visitsEligibleForLaunch(visits: StoredJobVisit[]): StoredJobVisit[] {
  return visits.filter((visit) => visitStatus(visit) === 'scheduled');
}

export function activeOnSiteVisit(visits: StoredJobVisit[]): StoredJobVisit | null {
  const open = visitInProgress(visits);
  if (open) return open;
  return nextScheduledVisit(visits);
}

export function syncJobOnSiteFields(visits: StoredJobVisit[]): {
  arrivalTime: string;
  departureTime: string;
} {
  const active =
    activeOnSiteVisit(visits) ??
    [...sortVisitsTimeline(visits)].reverse().find((visit) => visit.arrivalTime || visit.departureTime);
  return {
    arrivalTime: active?.arrivalTime ?? '',
    departureTime: active?.departureTime ?? '',
  };
}

export function migrateLegacyOnSiteToVisits(
  visits: StoredJobVisit[],
  arrivalTime: string,
  departureTime: string,
): StoredJobVisit[] {
  if (!visits.length) return visits;
  if (visits.some((visit) => visit.arrivalTime || visit.departureTime)) return visits;
  if (!arrivalTime && !departureTime) return visits;
  const target = nextScheduledVisit(visits) ?? visits[0];
  return patchVisitInList(visits, target.id, {
    arrivalTime: arrivalTime || undefined,
    departureTime: departureTime || undefined,
  });
}
