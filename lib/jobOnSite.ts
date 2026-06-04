import type { JobCard } from '../types/jobCard';
import { normalizeAssigneeEntries, type StoredJobAssignee } from './jobAssignees';
import { formatEquipmentLine } from './jobEquipment';
import {
  legacyFieldsFromMissionScopes,
  patchVisitTeamOnMissionScopes,
} from './jobMissionScopes';
import { formatMissionTypesDisplay } from './jobMissions';
import {
  appendScheduleLog,
  removeLaunchedLogForVisit,
  resolveStoredSchedule,
  schedulePayloadFromVisits,
  type ScheduleLogEntry,
} from './jobSchedule';
import { computeActualVisitDurationMinutes } from './visitDuration';
import {
  normalizeVisitsList,
  patchVisitInList,
  visitInProgress,
  visitStatus,
  visitsEligibleForLaunch,
  type StoredJobVisit,
} from './jobVisits';

function resolveVisits(job: Pick<JobCard, 'scheduledDate' | 'scheduledTime' | 'visits'>): StoredJobVisit[] {
  return normalizeVisitsList(
    job.visits?.length
      ? job.visits
      : [{ id: 'legacy', date: job.scheduledDate, time: job.scheduledTime ?? null, status: 'scheduled' }],
  );
}

function timeNow(): string {
  return new Date().toTimeString().slice(0, 5);
}

function remainingScheduledCount(visits: StoredJobVisit[]): number {
  return visits.filter((visit) => visitStatus(visit) === 'scheduled').length;
}

export type LaunchVisitLocationChoice =
  | { mode: 'keep' }
  | { mode: 'job_site' }
  | { mode: 'actual'; location: string; latitude?: number; longitude?: number };

function locationFieldsForLaunch(
  choice: LaunchVisitLocationChoice | undefined,
): Pick<StoredJobVisit, 'location' | 'latitude' | 'longitude'> {
  if (!choice || choice.mode === 'keep') return {};
  if (choice.mode === 'job_site') {
    return { location: undefined, latitude: undefined, longitude: undefined };
  }
  const text = choice.location.trim();
  if (!text) throw new Error('Enter the actual on-site location.');
  return {
    location: text,
    latitude: choice.latitude,
    longitude: choice.longitude,
  };
}

export function buildLaunchVisitUpdates(
  job: Pick<
    JobCard,
    | 'scheduledDate'
    | 'scheduledTime'
    | 'initialScheduledDate'
    | 'initialScheduledTime'
    | 'scheduleLog'
    | 'visits'
    | 'startedAt'
    | 'missionScopes'
    | 'missionTypes'
    | 'missionType'
    | 'equipmentItems'
    | 'equipment'
    | 'assignees'
    | 'assigneeId'
    | 'assigneeName'
  >,
  visitId: string,
  actor: { id: string; name: string },
  confirmedTeam: StoredJobAssignee[],
  locationChoice?: LaunchVisitLocationChoice,
): Pick<
  JobCard,
  | 'status'
  | 'startedAt'
  | 'finishedAt'
  | 'scheduledDate'
  | 'scheduledTime'
  | 'initialScheduledDate'
  | 'initialScheduledTime'
  | 'scheduleLog'
  | 'visits'
  | 'arrivalTime'
  | 'departureTime'
  | 'missionScopes'
  | 'missionTypes'
  | 'missionType'
  | 'equipmentItems'
  | 'assignees'
> {
  const team = normalizeAssigneeEntries(
    confirmedTeam.map((member) => ({
      key: member.userId,
      ...member,
    })),
  );
  if (!team.length) {
    throw new Error('Confirm at least one person on site for this visit.');
  }
  const visits = resolveVisits(job);
  const target = visits.find((visit) => visit.id === visitId);
  if (!target || visitStatus(target) !== 'scheduled') {
    throw new Error('Pick a scheduled visit to launch.');
  }
  if (visitInProgress(visits)) {
    throw new Error('Stop or finish the current visit before launching another.');
  }

  const arrivalTime = timeNow();
  const updatedVisits = patchVisitInList(visits, visitId, {
    status: 'in_progress',
    arrivalTime,
    departureTime: undefined,
    completedAt: undefined,
    ...locationFieldsForLaunch(locationChoice),
  });

  const schedule = resolveStoredSchedule({ ...job, visits: updatedVisits });
  const logEntry: Omit<ScheduleLogEntry, 'at'> = {
    userId: actor.id,
    userName: actor.name,
    fromDate: target.date,
    fromTime: target.time,
    toDate: target.date,
    toTime: target.time,
    action: 'launched',
    visitId,
    arrivalTime,
    plannedDurationMinutes: target.durationMinutes,
  };
  const withLog = appendScheduleLog(schedule, logEntry);
  const payload = schedulePayloadFromVisits({ ...job, scheduleLog: withLog.log }, updatedVisits);
  const active = updatedVisits.find((visit) => visit.id === visitId)!;
  const missionScopes = patchVisitTeamOnMissionScopes(job, visitId, team);
  const legacy = legacyFieldsFromMissionScopes(missionScopes);

  return {
    status: 'in_progress',
    startedAt: job.startedAt ?? new Date().toISOString(),
    finishedAt: null,
    ...payload,
    arrivalTime: active.arrivalTime ?? '',
    departureTime: '',
    missionScopes,
    missionTypes: legacy.missionTypes,
    missionType: formatMissionTypesDisplay(legacy.missionTypes),
    equipmentItems: legacy.equipmentItems.map((line) => formatEquipmentLine(line)),
    assignees: legacy.assignees,
  };
}

export function buildFinishVisitUpdates(
  job: Pick<
    JobCard,
    | 'scheduledDate'
    | 'scheduledTime'
    | 'initialScheduledDate'
    | 'initialScheduledTime'
    | 'scheduleLog'
    | 'visits'
    | 'startedAt'
    | 'finishedAt'
  >,
  actor: { id: string; name: string },
  visitId?: string,
): Pick<
  JobCard,
  | 'status'
  | 'finishedAt'
  | 'scheduledDate'
  | 'scheduledTime'
  | 'initialScheduledDate'
  | 'initialScheduledTime'
  | 'scheduleLog'
  | 'visits'
  | 'arrivalTime'
  | 'departureTime'
> {
  const visits = resolveVisits(job);
  const target =
    (visitId ? visits.find((visit) => visit.id === visitId) : null) ?? visitInProgress(visits);
  if (!target) {
    throw new Error('No visit in progress to finish.');
  }
  const status = visitStatus(target);
  if (status !== 'in_progress' && !(target.arrivalTime && !target.departureTime)) {
    throw new Error('Launch a visit before finishing on site.');
  }

  const departureTime = timeNow();
  let updatedVisits = patchVisitInList(visits, target.id, {
    status: 'done',
    departureTime,
    completedAt: new Date().toISOString(),
  });

  const schedule = resolveStoredSchedule({ ...job, visits: updatedVisits });
  const logEntry: Omit<ScheduleLogEntry, 'at'> = {
    userId: actor.id,
    userName: actor.name,
    fromDate: target.date,
    fromTime: target.time,
    toDate: target.date,
    toTime: target.time,
    action: 'done',
    visitId: target.id,
    arrivalTime: target.arrivalTime,
    departureTime,
    actualDurationMinutes:
      computeActualVisitDurationMinutes(target.arrivalTime, departureTime) ?? undefined,
    plannedDurationMinutes: target.durationMinutes,
  };
  const withLog = appendScheduleLog(schedule, logEntry);
  updatedVisits = withLog.visits;
  const payload = schedulePayloadFromVisits({ ...job, scheduleLog: withLog.log }, updatedVisits);

  const moreScheduled = remainingScheduledCount(updatedVisits);
  const active = updatedVisits.find((visit) => visit.id === target.id)!;

  return {
    status: moreScheduled > 0 ? 'planned' : 'pending_review',
    finishedAt: moreScheduled > 0 ? null : job.finishedAt ?? new Date().toISOString(),
    ...payload,
    arrivalTime: active.arrivalTime ?? '',
    departureTime: active.departureTime ?? '',
  };
}

/** Undo a mistaken launch — visit returns to scheduled, job back to planned. */
export function buildStopVisitUpdates(
  job: Pick<
    JobCard,
    | 'scheduledDate'
    | 'scheduledTime'
    | 'initialScheduledDate'
    | 'initialScheduledTime'
    | 'scheduleLog'
    | 'visits'
    | 'startedAt'
    | 'finishedAt'
  >,
  visitId?: string,
): Pick<
  JobCard,
  | 'status'
  | 'startedAt'
  | 'finishedAt'
  | 'scheduledDate'
  | 'scheduledTime'
  | 'initialScheduledDate'
  | 'initialScheduledTime'
  | 'scheduleLog'
  | 'visits'
  | 'arrivalTime'
  | 'departureTime'
> {
  const visits = resolveVisits(job);
  const target =
    (visitId ? visits.find((visit) => visit.id === visitId) : null) ?? visitInProgress(visits);
  if (!target) {
    throw new Error('No active visit to stop.');
  }

  let updatedVisits = patchVisitInList(visits, target.id, {
    status: 'scheduled',
    arrivalTime: undefined,
    departureTime: undefined,
    completedAt: undefined,
  });

  const stillOpen = visitInProgress(updatedVisits);
  const anyDone = updatedVisits.some((visit) => visitStatus(visit) === 'done');
  const log = removeLaunchedLogForVisit(job.scheduleLog ?? [], target.id);
  const payload = schedulePayloadFromVisits({ ...job, scheduleLog: log }, updatedVisits);
  const onSite = stillOpen
    ? {
        arrivalTime: stillOpen.arrivalTime ?? '',
        departureTime: '',
      }
    : { arrivalTime: '', departureTime: '' };

  return {
    status: stillOpen ? 'in_progress' : anyDone ? 'pending_review' : 'planned',
    startedAt: stillOpen || anyDone ? job.startedAt : null,
    finishedAt: stillOpen || remainingScheduledCount(updatedVisits) > 0 ? null : job.finishedAt,
    ...payload,
    ...onSite,
  };
}

export { visitsEligibleForLaunch, visitInProgress };
