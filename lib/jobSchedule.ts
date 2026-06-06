import type { JobCard, JobStatus } from '../types/jobCard';
import { formatDate } from '../utils/formatDate';
import { visitLinkLabel } from './jobVisitLink';
import {
  computeActualVisitDurationMinutes,
  formatVisitOnSiteStamp,
} from './visitDuration';
import {
  defaultVisitNumberLabel,
  ensureVisitShape,
  nextScheduledVisit,
  normalizeVisitsList,
  parseStoredVisits,
  patchVisitInList,
  primaryVisitFields,
  visitInProgress,
  visitStatus,
  type StoredJobVisit,
} from './jobVisits';

export type { StoredJobVisit };

export type ScheduleLogAction = 'rescheduled' | 'done' | 'added' | 'launched';

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
  /** Stamped at launch / finish (HH:mm). */
  arrivalTime?: string;
  departureTime?: string;
  actualDurationMinutes?: number;
  plannedDurationMinutes?: number;
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
            entry.action === 'rescheduled' ||
            entry.action === 'done' ||
            entry.action === 'added' ||
            entry.action === 'launched'
              ? entry.action
              : undefined,
          visitId: typeof entry.visitId === 'string' && entry.visitId.trim() ? entry.visitId.trim() : undefined,
          arrivalTime:
            typeof entry.arrivalTime === 'string' && entry.arrivalTime.trim() ? entry.arrivalTime.trim() : undefined,
          departureTime:
            typeof entry.departureTime === 'string' && entry.departureTime.trim()
              ? entry.departureTime.trim()
              : undefined,
          actualDurationMinutes:
            typeof entry.actualDurationMinutes === 'number' && Number.isFinite(entry.actualDurationMinutes)
              ? entry.actualDurationMinutes
              : undefined,
          plannedDurationMinutes:
            typeof entry.plannedDurationMinutes === 'number' && Number.isFinite(entry.plannedDurationMinutes)
              ? entry.plannedDurationMinutes
              : undefined,
        } satisfies ScheduleLogEntry))
        .filter((entry) => entry.toDate || entry.action === 'done' || entry.action === 'launched')
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

export function resolveScheduleLogOnSiteFields(
  entry: ScheduleLogEntry,
  visits?: StoredJobVisit[],
): Pick<ScheduleLogEntry, 'arrivalTime' | 'departureTime' | 'plannedDurationMinutes' | 'actualDurationMinutes'> {
  const visit = entry.visitId && visits?.length ? visits.find((v) => v.id === entry.visitId) : undefined;
  const arrival = entry.arrivalTime ?? visit?.arrivalTime;
  const departure = entry.departureTime ?? visit?.departureTime;
  const planned = entry.plannedDurationMinutes ?? visit?.durationMinutes;
  const actual =
    entry.actualDurationMinutes ??
    computeActualVisitDurationMinutes(arrival, departure) ??
    undefined;
  return {
    arrivalTime: arrival,
    departureTime: departure,
    plannedDurationMinutes: planned,
    actualDurationMinutes: actual ?? undefined,
  };
}

export function formatScheduleLogOnSiteDetail(
  entry: ScheduleLogEntry,
  visits?: StoredJobVisit[],
): string {
  if (entry.action === 'launched') {
    const arrived = entry.arrivalTime?.trim();
    return arrived ? `arrived ${arrived}` : '';
  }
  const resolved = resolveScheduleLogOnSiteFields(entry, visits);
  return formatVisitOnSiteStamp(
    resolved.arrivalTime,
    resolved.departureTime,
    resolved.plannedDurationMinutes,
  );
}

export function formatScheduleLogVisitLabel(
  entry: ScheduleLogEntry,
  visits?: StoredJobVisit[],
): string {
  if (!entry.visitId || !visits?.length) return '';
  const label = visitLinkLabel(visits, entry.visitId);
  return label === 'Visit' || label === 'General' ? '' : label;
}

export function formatScheduleLogEntry(entry: ScheduleLogEntry, visits?: StoredJobVisit[]): string {
  const visit = formatScheduleLogVisitLabel(entry, visits);
  const visitPrefix = visit ? `${visit} · ` : '';
  const when = formatScheduleWhen(entry.toDate || entry.fromDate, entry.toTime ?? entry.fromTime);
  const onSite = formatScheduleLogOnSiteDetail(entry, visits);

  if (entry.action === 'done') {
    return onSite
      ? `${visitPrefix}Visit done · ${when} · ${onSite}`
      : `${visitPrefix}Visit done · ${when}`;
  }
  if (entry.action === 'launched') {
    return onSite
      ? `${visitPrefix}Visit launched · ${when} · ${onSite}`
      : `${visitPrefix}Visit launched · ${when}`;
  }
  if (entry.action === 'added') {
    return `${visitPrefix}Visit added · ${formatScheduleWhen(entry.toDate, entry.toTime)}`;
  }
  if (entry.action === 'rescheduled') {
    return `${visitPrefix}Rescheduled · ${formatScheduleWhen(entry.fromDate, entry.fromTime)} → ${formatScheduleWhen(entry.toDate, entry.toTime)}`;
  }
  return `${visitPrefix}${formatScheduleWhen(entry.fromDate, entry.fromTime)} → ${formatScheduleWhen(entry.toDate, entry.toTime)}`;
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

/** Rows shown under “Schedule history”. */
export function scheduleLogForDisplay(log: ScheduleLogEntry[] = []): ScheduleLogEntry[] {
  return log;
}

/** Activity rows for one visit (launch, complete, reschedule…). */
export function scheduleLogForVisit(
  log: ScheduleLogEntry[] | undefined,
  visitId: string,
): ScheduleLogEntry[] {
  return (log ?? []).filter((entry) => entry.visitId === visitId);
}

/** Rebuild missing launch/done rows from visit on-site fields (legacy saves skipped scheduleLog). */
export function reconcileVisitScheduleLog(
  visits: StoredJobVisit[],
  log: ScheduleLogEntry[] = [],
): ScheduleLogEntry[] {
  const next = [...log];
  const hasEntry = (visitId: string, action: ScheduleLogAction) =>
    next.some((entry) => entry.visitId === visitId && entry.action === action);

  for (const visit of normalizeVisitsList(visits)) {
    const visitLog = next.filter((entry) => entry.visitId === visit.id);
    if (visitLog.length > 0) continue;

    const status = visitStatus(visit);
    const stamp = visit.completedAt ?? new Date().toISOString();

    if (
      (status === 'in_progress' || visit.arrivalTime) &&
      visit.arrivalTime &&
      !hasEntry(visit.id, 'launched')
    ) {
      next.push({
        at: stamp,
        userId: 'system',
        userName: 'System',
        fromDate: visit.date,
        fromTime: visit.time,
        toDate: visit.date,
        toTime: visit.time,
        action: 'launched',
        visitId: visit.id,
        arrivalTime: visit.arrivalTime,
        plannedDurationMinutes: visit.durationMinutes,
      });
    }

    if (status === 'done' && !hasEntry(visit.id, 'done')) {
      next.push({
        at: stamp,
        userId: 'system',
        userName: 'System',
        fromDate: visit.date,
        fromTime: visit.time,
        toDate: visit.date,
        toTime: visit.time,
        action: 'done',
        visitId: visit.id,
        arrivalTime: visit.arrivalTime,
        departureTime: visit.departureTime,
        actualDurationMinutes:
          computeActualVisitDurationMinutes(visit.arrivalTime, visit.departureTime) ?? undefined,
        plannedDurationMinutes: visit.durationMinutes,
      });
    }
  }

  return next;
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

/** Remove the latest launch row for a visit (stop / undo mistaken launch). */
export function removeLaunchedLogForVisit(
  log: ScheduleLogEntry[],
  visitId: string,
): ScheduleLogEntry[] {
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry.action === 'launched' && entry.visitId === visitId) {
      return [...log.slice(0, i), ...log.slice(i + 1)];
    }
  }
  return log;
}

function resolveVisits(job: Pick<JobCard, 'scheduledDate' | 'scheduledTime' | 'visits'>): StoredJobVisit[] {
  return normalizeVisitsList(
    job.visits?.length
      ? job.visits
      : parseStoredVisits(null, job.scheduledDate, job.scheduledTime ?? null),
  );
}

export function schedulePayloadFromVisits(
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
    label: defaultVisitNumberLabel(visits),
    status: 'scheduled',
    durationMinutes: from.durationMinutes,
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
  newVisit: StoredJobVisit,
  actor: { id: string; name: string },
): Pick<
  JobCard,
  'scheduledDate' | 'scheduledTime' | 'initialScheduledDate' | 'initialScheduledTime' | 'scheduleLog' | 'visits'
> {
  const visits = resolveVisits(job);
  const visit = ensureVisitShape({
    ...newVisit,
    status: 'scheduled',
    label: newVisit.label?.trim() || defaultVisitNumberLabel(visits),
    followUpOfVisitId: newVisit.followUpOfVisitId?.trim() || undefined,
  });
  const updatedVisits = [...visits, visit];

  const schedule = appendScheduleLog(resolveStoredSchedule({ ...job, visits: updatedVisits }), {
    userId: actor.id,
    userName: actor.name,
    fromDate: '',
    fromTime: null,
    toDate: visit.date,
    toTime: visit.time,
    action: 'added',
    visitId: visit.id,
  });

  return schedulePayloadFromVisits({ ...job, scheduleLog: schedule.log }, updatedVisits);
}

export function canDeleteVisitFromTimeline(
  visits: StoredJobVisit[],
  visitId: string,
): { ok: true } | { ok: false; reason: string } {
  if (visits.length <= 1) {
    return { ok: false, reason: 'Keep at least one visit on this job card.' };
  }
  const target = visits.find((visit) => visit.id === visitId);
  if (!target) return { ok: false, reason: 'Visit not found.' };
  const status = visitStatus(target);
  if (status === 'in_progress') {
    return { ok: false, reason: 'Stop the visit before removing it.' };
  }
  if (status === 'done') {
    return {
      ok: false,
      reason: 'Completed visits stay in history. Undo from schedule history if needed.',
    };
  }
  if (status === 'rescheduled') {
    return { ok: false, reason: 'This visit was rescheduled — remove the new visit instead.' };
  }
  if (visits.some((visit) => visit.rescheduledToId === visitId)) {
    return {
      ok: false,
      reason: 'Remove the new visit created by reschedule first.',
    };
  }
  if (status !== 'scheduled') {
    return { ok: false, reason: 'Only planned visits can be removed.' };
  }
  return { ok: true };
}

export function buildDeleteVisitUpdates(
  job: Pick<
    JobCard,
    | 'scheduledDate'
    | 'scheduledTime'
    | 'initialScheduledDate'
    | 'initialScheduledTime'
    | 'scheduleLog'
    | 'visits'
    | 'status'
    | 'startedAt'
    | 'finishedAt'
  >,
  visitId: string,
): Pick<
  JobCard,
  | 'scheduledDate'
  | 'scheduledTime'
  | 'initialScheduledDate'
  | 'initialScheduledTime'
  | 'scheduleLog'
  | 'visits'
  | 'status'
  | 'startedAt'
  | 'finishedAt'
  | 'arrivalTime'
  | 'departureTime'
> {
  const visits = resolveVisits(job);
  const gate = canDeleteVisitFromTimeline(visits, visitId);
  if (!gate.ok) throw new Error(gate.reason);

  const updatedVisits = visits.filter((visit) => visit.id !== visitId);
  const log = (job.scheduleLog ?? []).filter((entry) => entry.visitId !== visitId);
  const payload = schedulePayloadFromVisits({ ...job, scheduleLog: log }, updatedVisits);
  return { ...payload, ...deriveJobStatusAfterVisits(updatedVisits, job) };
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

function remainingScheduledCount(visits: StoredJobVisit[]): number {
  return visits.filter((visit) => visitStatus(visit) === 'scheduled').length;
}

function deriveJobStatusAfterVisits(
  visits: StoredJobVisit[],
  job: Pick<JobCard, 'status' | 'startedAt' | 'finishedAt'>,
): Pick<JobCard, 'status' | 'startedAt' | 'finishedAt' | 'arrivalTime' | 'departureTime'> {
  const stillOpen = visitInProgress(visits);
  const anyDone = visits.some((visit) => visitStatus(visit) === 'done');
  const moreScheduled = remainingScheduledCount(visits);
  const onSite = stillOpen
    ? { arrivalTime: stillOpen.arrivalTime ?? '', departureTime: '' }
    : { arrivalTime: '', departureTime: '' };

  let status: JobStatus;
  if (stillOpen) status = 'in_progress';
  else if (anyDone) status = 'pending_review';
  else if (moreScheduled > 0) status = job.status === 'draft' ? 'draft' : 'planned';
  else status = job.status === 'draft' ? 'draft' : 'planned';

  return {
    status,
    startedAt: stillOpen || anyDone ? job.startedAt : null,
    finishedAt: stillOpen || moreScheduled > 0 ? null : job.finishedAt ?? null,
    ...onSite,
  };
}

/** Remove one schedule-log row and undo its visit/schedule side effects. */
export function buildRemoveScheduleLogEntryUpdates(
  job: Pick<
    JobCard,
    | 'scheduledDate'
    | 'scheduledTime'
    | 'initialScheduledDate'
    | 'initialScheduledTime'
    | 'scheduleLog'
    | 'visits'
    | 'status'
    | 'startedAt'
    | 'finishedAt'
  >,
  logIndex: number,
): Pick<
  JobCard,
  | 'scheduledDate'
  | 'scheduledTime'
  | 'initialScheduledDate'
  | 'initialScheduledTime'
  | 'scheduleLog'
  | 'visits'
  | 'status'
  | 'startedAt'
  | 'finishedAt'
  | 'arrivalTime'
  | 'departureTime'
> {
  const log = [...(job.scheduleLog ?? [])];
  if (logIndex < 0 || logIndex >= log.length) {
    throw new Error('Schedule history entry not found.');
  }

  const entry = log[logIndex];
  let visits = resolveVisits(job);
  const action =
    entry.action ??
    (entry.fromDate && entry.toDate && entry.fromDate !== entry.toDate ? 'rescheduled' : undefined);

  if (action === 'launched' && entry.visitId) {
    log.splice(logIndex, 1);
    for (let i = log.length - 1; i >= 0; i -= 1) {
      if (log[i].visitId === entry.visitId && log[i].action === 'done') {
        log.splice(i, 1);
      }
    }
    const target = visits.find((visit) => visit.id === entry.visitId);
    if (target) {
      visits = patchVisitInList(visits, entry.visitId, {
        status: 'scheduled',
        arrivalTime: undefined,
        departureTime: undefined,
        completedAt: undefined,
      });
    }
    const payload = schedulePayloadFromVisits({ ...job, scheduleLog: log }, visits);
    return { ...payload, ...deriveJobStatusAfterVisits(visits, job) };
  } else if (action === 'done' && entry.visitId) {
    const target = visits.find((visit) => visit.id === entry.visitId);
    if (!target) {
      throw new Error('Visit for this history entry no longer exists.');
    }
    const stillLaunched = log.some(
      (row, i) => i !== logIndex && row.visitId === entry.visitId && row.action === 'launched',
    );
    log.splice(logIndex, 1);
    if (stillLaunched) {
      visits = patchVisitInList(visits, entry.visitId, {
        status: 'in_progress',
        departureTime: undefined,
        completedAt: undefined,
      });
    } else {
      visits = patchVisitInList(visits, entry.visitId, {
        status: 'scheduled',
        arrivalTime: undefined,
        departureTime: undefined,
        completedAt: undefined,
      });
    }
    const payload = schedulePayloadFromVisits({ ...job, scheduleLog: log }, visits);
    return { ...payload, ...deriveJobStatusAfterVisits(visits, job) };
  } else if (action === 'rescheduled' && entry.visitId) {
    const oldVisit = visits.find((visit) => visit.id === entry.visitId);
    if (!oldVisit) {
      throw new Error('Visit for this history entry no longer exists.');
    }
    const followUpId = oldVisit.rescheduledToId;
    if (followUpId) {
      const followUp = visits.find((visit) => visit.id === followUpId);
      if (followUp && visitStatus(followUp) !== 'scheduled') {
        throw new Error('Remove later history first — that visit is already in progress or done.');
      }
      visits = visits.filter((visit) => visit.id !== followUpId);
    }
    visits = patchVisitInList(visits, entry.visitId, {
      status: 'scheduled',
      date: entry.fromDate || oldVisit.date,
      time: entry.fromTime ?? oldVisit.time ?? null,
      rescheduledToId: undefined,
      arrivalTime: undefined,
      departureTime: undefined,
      completedAt: undefined,
    });
  } else if (action === 'added' && entry.visitId) {
    const added = visits.find((visit) => visit.id === entry.visitId);
    if (!added) {
      log.splice(logIndex, 1);
      const payload = schedulePayloadFromVisits({ ...job, scheduleLog: log }, visits);
      return { ...payload, ...deriveJobStatusAfterVisits(visits, job) };
    }
    if (visitStatus(added) !== 'scheduled') {
      throw new Error('Remove later history first — this visit is no longer only scheduled.');
    }
    visits = visits.filter((visit) => visit.id !== entry.visitId);
  } else if (action) {
    throw new Error('This history entry cannot be removed.');
  }

  log.splice(logIndex, 1);
  const payload = schedulePayloadFromVisits({ ...job, scheduleLog: log }, visits);
  return { ...payload, ...deriveJobStatusAfterVisits(visits, job) };
}
