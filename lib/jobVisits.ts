import { newContactKey } from './clientContact';
import type { JobCard } from '../types/jobCard';

export type JobVisitStatus = 'scheduled' | 'done' | 'rescheduled' | 'cancelled';

export interface StoredJobVisit {
  id: string;
  date: string;
  time: string | null;
  label?: string;
  status?: JobVisitStatus;
  completedAt?: string;
  rescheduledToId?: string;
  arrivalTime?: string;
  departureTime?: string;
  calendarEventId?: string;
  /** When set, visit uses this address instead of the job site */
  location?: string;
  latitude?: number;
  longitude?: number;
}

export interface JobVisitEntry {
  key: string;
  scheduledAt: Date | null;
  label: string;
  arrivalAt: Date | null;
  departureAt: Date | null;
  useJobLocation: boolean;
  location: string;
  latitude?: number;
  longitude?: number;
}

export const JOB_VISIT_STATUS_LABELS: Record<JobVisitStatus, string> = {
  scheduled: 'Scheduled',
  done: 'Done',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
};

function parseVisitStatus(value: unknown): JobVisitStatus {
  if (value === 'done' || value === 'rescheduled' || value === 'cancelled' || value === 'scheduled') {
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
    arrivalTime: visit.arrivalTime?.trim() || undefined,
    departureTime: visit.departureTime?.trim() || undefined,
    calendarEventId: visit.calendarEventId?.trim() || undefined,
    location: visit.location?.trim() || undefined,
    latitude: typeof visit.latitude === 'number' ? visit.latitude : undefined,
    longitude: typeof visit.longitude === 'number' ? visit.longitude : undefined,
  };
}

export function normalizeVisitsList(visits: StoredJobVisit[]): StoredJobVisit[] {
  return visits.map((visit) => ensureVisitShape(visit));
}

export function defaultVisitEntry(at: Date | null = new Date()): JobVisitEntry {
  return {
    key: newContactKey('visit'),
    scheduledAt: at,
    label: '',
    arrivalAt: null,
    departureAt: null,
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
    if (!entry.scheduledAt) continue;
    const { date, time } = partsFromDate(entry.scheduledAt);
    const label = entry.label.trim();
    const customLocation = !entry.useJobLocation && entry.location.trim();
    out.push(
      ensureVisitShape({
        id: entry.key,
        date,
        time,
        label: label || undefined,
        status: 'scheduled',
        arrivalTime: entry.arrivalAt ? timePartsFromDate(entry.arrivalAt) : undefined,
        departureTime: entry.departureAt ? timePartsFromDate(entry.departureAt) : undefined,
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
        return ensureVisitShape({
          id,
          date,
          time: time || null,
          label,
          status,
          completedAt,
          rescheduledToId,
          arrivalTime,
          departureTime,
          calendarEventId,
          location,
          latitude,
          longitude,
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
  return visits.map((visit, index) => ({
    key: visit.id,
    scheduledAt: visitToDate(visit),
    label: visit.label ?? (visits.length > 1 ? `Visit ${index + 1}` : ''),
    arrivalAt: timeOnVisitDate(visit.date, visit.arrivalTime),
    departureAt: timeOnVisitDate(visit.date, visit.departureTime),
    useJobLocation: !visit.location?.trim(),
    location: visit.location?.trim() ?? '',
    latitude: visit.latitude,
    longitude: visit.longitude,
  }));
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

export function formatVisitWhen(visit: Pick<StoredJobVisit, 'date' | 'time'>): string {
  if (!visit.date) return '—';
  const [y, m, d] = visit.date.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const label = date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return visit.time ? `${label} · ${visit.time}` : label;
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

export function activeOnSiteVisit(visits: StoredJobVisit[]): StoredJobVisit | null {
  const open = visits.find((visit) => visit.arrivalTime && !visit.departureTime);
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
