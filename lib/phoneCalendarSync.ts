import AsyncStorage from '@react-native-async-storage/async-storage';
import type { JobCard } from '../types/jobCard';
import { addDaysIso } from '../utils/calendarGrid';
import { formatEquipmentList } from './jobEquipment';
import {
  createAllDayCalendarEvent,
  createCalendarEvent,
  ensureCalendarPermission,
  removeCalendarEvent,
  updateCalendarEvent,
} from './calendar';
import { getLebanonHolidays, type LebanonHoliday, formatHolidayPhoneTitle } from './lebanonHolidays';
import {
  collectVisitCalendarEventIds,
  ensureVisitShape,
  normalizeVisitsList,
  patchVisitInList,
  resolveVisitLocation,
  visitToDate,
  visitsForPhoneCalendar,
  type StoredJobVisit,
} from './jobVisits';

const LOCAL_JOB_EVENTS_KEY = 'mybaladi.phoneCalendar.jobEvents';
const HOLIDAY_EVENTS_KEY = 'mybaladi.phoneCalendar.holidayEvents';
export const JOBS_SYNC_ACTIVE_KEY = 'mybaladi.phoneCalendar.jobsSyncActive';

export type PhoneCalendarSyncResult = {
  jobsSynced: number;
  holidaysSynced: number;
  permissionDenied: boolean;
};

export type PhoneCalendarUnsyncResult = {
  jobsRemoved: number;
  holidaysRemoved: number;
};

type HolidayRange = {
  holidays: LebanonHoliday[];
  startDate: string;
  endDate: string;
  name: string;
};

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function holidayEventDates(group: HolidayRange): { startDate: Date; endDate: Date } {
  const startDate = parseIsoLocal(group.startDate);
  if (group.startDate === group.endDate) {
    return { startDate, endDate: startDate };
  }
  const [y, m, d] = group.endDate.split('-').map(Number);
  return { startDate, endDate: new Date(y, m - 1, d) };
}

function holidayRangeKey(startDate: string, endDate: string): string {
  return startDate === endDate ? startDate : `${startDate}_${endDate}`;
}

function groupConsecutiveHolidays(holidays: LebanonHoliday[]): HolidayRange[] {
  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  const groups: HolidayRange[] = [];

  for (const holiday of sorted) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.name === holiday.name &&
      addDaysIso(last.endDate, 1) === holiday.date
    ) {
      last.holidays.push(holiday);
      last.endDate = holiday.date;
      continue;
    }
    groups.push({
      holidays: [holiday],
      startDate: holiday.date,
      endDate: holiday.date,
      name: holiday.name,
    });
  }

  return groups;
}

function visitLocalEventKey(jobId: string, visitId: string): string {
  return `${jobId}:${visitId}`;
}

export function collectJobCalendarEventIds(job: JobCard): string[] {
  const ids = new Set<string>();
  if (job.calendarEventId?.trim()) ids.add(job.calendarEventId.trim());
  for (const id of collectVisitCalendarEventIds(job.visits ?? [])) ids.add(id);
  return [...ids];
}

function resolveVisitsForSync(job: JobCard): StoredJobVisit[] {
  const visits = normalizeVisitsList(job.visits ?? []);
  if (visits.length) return visits;
  if (!job.scheduledDate) return [];
  return [
    ensureVisitShape({
      date: job.scheduledDate,
      time: job.scheduledTime ?? null,
      status: 'scheduled',
    }),
  ];
}

function resolveVisitEventId(
  job: JobCard,
  visit: StoredJobVisit,
  localEvents: Record<string, string>,
): string | null {
  if (visit.calendarEventId?.trim()) return visit.calendarEventId.trim();
  const localKey = visitLocalEventKey(job.id, visit.id);
  if (localEvents[localKey]) return localEvents[localKey];
  const scheduled = visitsForPhoneCalendar(resolveVisitsForSync(job));
  if (
    job.calendarEventId?.trim() &&
    scheduled.length === 1 &&
    scheduled[0].id === visit.id
  ) {
    return job.calendarEventId.trim();
  }
  if (job.calendarEventId?.trim() && !job.visits?.length) {
    return job.calendarEventId.trim();
  }
  return null;
}

function visitEventTitle(job: JobCard, visit: StoredJobVisit, index: number): string {
  const label = visit.label?.trim() || `Visit ${index + 1}`;
  return `[${job.reference}] ${job.clientName} · ${label}`;
}

function jobEventNotes(job: JobCard): string {
  const equipmentText = job.equipmentItems?.length
    ? formatEquipmentList(job.equipmentItems)
    : job.equipment;
  const lines = [
    job.missionType,
    equipmentText ? `Equipment:\n${equipmentText}` : '',
    job.assigneeName ? `Assignee: ${job.assigneeName}` : '',
    job.notes ? job.notes : '',
  ].filter(Boolean);
  return lines.join('\n');
}

async function loadLocalJobEvents(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_JOB_EVENTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function saveLocalJobEvents(map: Record<string, string>) {
  await AsyncStorage.setItem(LOCAL_JOB_EVENTS_KEY, JSON.stringify(map));
}

async function saveLocalJobEvent(jobId: string, eventId: string) {
  const map = await loadLocalJobEvents();
  map[jobId] = eventId;
  await saveLocalJobEvents(map);
}

async function loadHolidayEvents(): Promise<Record<number, Record<string, string>>> {
  try {
    const raw = await AsyncStorage.getItem(HOLIDAY_EVENTS_KEY);
    return raw ? (JSON.parse(raw) as Record<number, Record<string, string>>) : {};
  } catch {
    return {};
  }
}

async function saveHolidayEvents(map: Record<number, Record<string, string>>) {
  await AsyncStorage.setItem(HOLIDAY_EVENTS_KEY, JSON.stringify(map));
}

function resolveHolidayEventId(
  group: HolidayRange,
  yearStore: Record<string, string>,
): string | null {
  const key = holidayRangeKey(group.startDate, group.endDate);
  if (yearStore[key]) return yearStore[key];

  for (const holiday of group.holidays) {
    if (yearStore[holiday.date]) return yearStore[holiday.date];
  }

  for (const [storeKey, eventId] of Object.entries(yearStore)) {
    if (storeKey.includes('_')) {
      const [start, end] = storeKey.split('_');
      if (group.startDate >= start && group.endDate <= end) return eventId;
    }
  }

  return null;
}

function jobAlarmMinutesBefore(job: JobCard, startDate: Date): number | undefined {
  if (!job.reminderAt) return 60;
  const minutes = Math.round((startDate.getTime() - new Date(job.reminderAt).getTime()) / 60000);
  return minutes > 0 ? minutes : undefined;
}

async function upsertVisitEvent(
  job: JobCard,
  visit: StoredJobVisit,
  index: number,
  existingEventId: string | null,
): Promise<string | null> {
  const startDate = visitToDate(visit);
  if (!startDate) return null;

  const payload = {
    title: visitEventTitle(job, visit, index),
    notes: jobEventNotes(job),
    location: resolveVisitLocation(visit, job.siteAddress) || undefined,
    startDate,
    alarmMinutesBefore: jobAlarmMinutesBefore(job, startDate),
  };

  if (existingEventId) {
    try {
      await updateCalendarEvent(existingEventId, payload);
      return existingEventId;
    } catch {
      await removeCalendarEvent(existingEventId);
    }
  }

  return createCalendarEvent(payload);
}

async function upsertHolidayRange(
  group: HolidayRange,
  existingEventId: string | null,
): Promise<string | null> {
  const { startDate, endDate } = holidayEventDates(group);
  const holiday = group.holidays[0];
  const title = formatHolidayPhoneTitle(holiday);
  const notes = 'عطلة رسمية لبنانية · Lebanese public holiday · MyBaladi';
  const payload = {
    title,
    notes,
    startDate,
    endDate,
    allDay: true as const,
  };

  if (existingEventId) {
    try {
      await updateCalendarEvent(existingEventId, payload);
      return existingEventId;
    } catch {
      await removeCalendarEvent(existingEventId);
    }
  }

  return createAllDayCalendarEvent(payload);
}

export async function isPhoneCalendarJobsSyncActive(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(JOBS_SYNC_ACTIVE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function markPhoneCalendarJobsSyncActive(): Promise<void> {
  await AsyncStorage.setItem(JOBS_SYNC_ACTIVE_KEY, 'true');
}

export async function clearPhoneCalendarJobsSyncActive(): Promise<void> {
  await AsyncStorage.removeItem(JOBS_SYNC_ACTIVE_KEY);
}

async function persistVisitCalendarEventIds(
  job: JobCard,
  visits: StoredJobVisit[],
  userId: string,
  localEvents: Record<string, string>,
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<void>,
): Promise<void> {
  for (const visit of visits) {
    const localKey = visitLocalEventKey(job.id, visit.id);
    if (visit.calendarEventId) {
      localEvents[localKey] = visit.calendarEventId;
    } else {
      delete localEvents[localKey];
    }
  }
  delete localEvents[job.id];

  const owner = job.assigneeId ?? job.technicianId ?? '';
  if (owner === userId) {
    await updateJobCard(job.id, {
      visits,
      scheduleLog: job.scheduleLog,
      initialScheduledDate: job.initialScheduledDate,
      initialScheduledTime: job.initialScheduledTime,
      scheduledDate: job.scheduledDate,
      scheduledTime: job.scheduledTime,
      calendarEventId: null,
    });
  }
}

export async function syncSingleJobToPhoneCalendar(
  job: JobCard,
  userId: string,
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<void>,
): Promise<string | null> {
  if (!job.scheduledDate && !job.visits?.length) return null;

  const granted = await ensureCalendarPermission();
  if (!granted) return null;

  let visits = resolveVisitsForSync(job);
  const scheduledVisits = visitsForPhoneCalendar(visits);
  const scheduledIds = new Set(scheduledVisits.map((visit) => visit.id));
  const localEvents = await loadLocalJobEvents();
  let synced = 0;

  for (const visit of visits) {
    if (scheduledIds.has(visit.id)) continue;
    const staleEventId = resolveVisitEventId(job, visit, localEvents);
    if (!staleEventId) continue;
    await removeCalendarEvent(staleEventId);
    visits = patchVisitInList(visits, visit.id, { calendarEventId: undefined });
    delete localEvents[visitLocalEventKey(job.id, visit.id)];
    if (job.calendarEventId === staleEventId) {
      delete localEvents[job.id];
    }
  }

  for (let index = 0; index < scheduledVisits.length; index += 1) {
    const visit = scheduledVisits[index];
    const existingId = resolveVisitEventId({ ...job, visits }, visit, localEvents);
    const eventId = await upsertVisitEvent(job, visit, index, existingId);
    if (!eventId) continue;
    visits = patchVisitInList(visits, visit.id, { calendarEventId: eventId });
    synced += 1;
  }

  if (synced === 0 && scheduledVisits.length === 0) {
    const legacyId = job.calendarEventId ?? localEvents[job.id] ?? null;
    if (legacyId) {
      await removeCalendarEvent(legacyId);
      delete localEvents[job.id];
      const owner = job.assigneeId ?? job.technicianId ?? '';
      if (owner === userId) {
        await updateJobCard(job.id, {
          calendarEventId: null,
          visits,
          scheduleLog: job.scheduleLog,
          initialScheduledDate: job.initialScheduledDate,
          initialScheduledTime: job.initialScheduledTime,
          scheduledDate: job.scheduledDate,
          scheduledTime: job.scheduledTime,
        });
      }
    }
    await saveLocalJobEvents(localEvents);
    return null;
  }

  await persistVisitCalendarEventIds(job, visits, userId, localEvents, updateJobCard);
  await saveLocalJobEvents(localEvents);
  return synced > 0 ? `synced-${synced}` : null;
}

export async function syncJobsToPhoneCalendar(
  jobs: JobCard[],
  userId: string,
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<void>,
): Promise<Pick<PhoneCalendarSyncResult, 'jobsSynced' | 'permissionDenied'>> {
  const granted = await ensureCalendarPermission();
  if (!granted) return { jobsSynced: 0, permissionDenied: true };

  const scheduled = jobs.filter((j) => j.scheduledDate || j.visits?.length);
  let jobsSynced = 0;

  for (const job of scheduled) {
    const result = await syncSingleJobToPhoneCalendar(job, userId, updateJobCard);
    if (result) jobsSynced += 1;
  }

  if (jobsSynced > 0) {
    await markPhoneCalendarJobsSyncActive();
  }

  return { jobsSynced, permissionDenied: false };
}

export async function syncLebanonHolidaysToPhoneCalendar(
  years: number[],
): Promise<Pick<PhoneCalendarSyncResult, 'holidaysSynced' | 'permissionDenied'>> {
  const granted = await ensureCalendarPermission();
  if (!granted) return { holidaysSynced: 0, permissionDenied: true };

  const holidayStore = await loadHolidayEvents();
  let holidaysSynced = 0;

  for (const year of years) {
    const holidays = getLebanonHolidays(year);
    const groups = groupConsecutiveHolidays(holidays);
    const previousYearStore = holidayStore[year] ?? {};
    const nextYearStore: Record<string, string> = {};
    const keptEventIds = new Set<string>();

    for (const group of groups) {
      const existingId = resolveHolidayEventId(group, previousYearStore);
      const eventId = await upsertHolidayRange(group, existingId);
      if (!eventId) continue;

      holidaysSynced += 1;
      keptEventIds.add(eventId);
      nextYearStore[holidayRangeKey(group.startDate, group.endDate)] = eventId;
    }

    for (const eventId of Object.values(previousYearStore)) {
      if (keptEventIds.has(eventId)) continue;
      await removeCalendarEvent(eventId);
    }

    holidayStore[year] = nextYearStore;
  }

  await saveHolidayEvents(holidayStore);
  return { holidaysSynced, permissionDenied: false };
}

export async function unsyncJobsFromPhoneCalendar(
  jobs: JobCard[],
  userId: string,
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<void>,
): Promise<number> {
  const localEvents = await loadLocalJobEvents();
  const removedEventIds = new Set<string>();
  let jobsRemoved = 0;

  for (const job of jobs) {
    const eventIds = new Set(collectJobCalendarEventIds(job));
    if (localEvents[job.id]) eventIds.add(localEvents[job.id]);
    for (const [key, eventId] of Object.entries(localEvents)) {
      if (key.startsWith(`${job.id}:`)) eventIds.add(eventId);
    }

    if (!eventIds.size) continue;

    for (const eventId of eventIds) {
      if (removedEventIds.has(eventId)) continue;
      await removeCalendarEvent(eventId);
      removedEventIds.add(eventId);
      jobsRemoved += 1;
    }

    const owner = job.assigneeId ?? job.technicianId ?? '';
    if (owner === userId && (job.calendarEventId || job.visits?.some((v) => v.calendarEventId))) {
      const clearedVisits = normalizeVisitsList(job.visits ?? []).map((visit) =>
        ensureVisitShape({ ...visit, calendarEventId: undefined }),
      );
      await updateJobCard(job.id, {
        calendarEventId: null,
        ...(clearedVisits.length ? { visits: clearedVisits } : {}),
      });
    }

    delete localEvents[job.id];
    for (const key of Object.keys(localEvents)) {
      if (key.startsWith(`${job.id}:`)) delete localEvents[key];
    }
  }

  await saveLocalJobEvents(localEvents);
  if (jobsRemoved > 0) {
    await clearPhoneCalendarJobsSyncActive();
  }
  return jobsRemoved;
}

export async function unsyncHolidaysFromPhoneCalendar(years: number[]): Promise<number> {
  const holidayStore = await loadHolidayEvents();
  const removedEventIds = new Set<string>();
  let holidaysRemoved = 0;

  for (const year of years) {
    const yearStore = holidayStore[year] ?? {};
    for (const eventId of Object.values(yearStore)) {
      if (removedEventIds.has(eventId)) continue;
      await removeCalendarEvent(eventId);
      removedEventIds.add(eventId);
      holidaysRemoved += 1;
    }
    delete holidayStore[year];
  }

  await saveHolidayEvents(holidayStore);
  return holidaysRemoved;
}

export async function syncPhoneCalendar(input: {
  jobs: JobCard[];
  userId: string;
  years: number[];
  includeJobs: boolean;
  includeHolidays: boolean;
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<void>;
}): Promise<PhoneCalendarSyncResult> {
  const result: PhoneCalendarSyncResult = {
    jobsSynced: 0,
    holidaysSynced: 0,
    permissionDenied: false,
  };

  if (input.includeJobs) {
    const jobs = await syncJobsToPhoneCalendar(input.jobs, input.userId, input.updateJobCard);
    result.jobsSynced = jobs.jobsSynced;
    result.permissionDenied = jobs.permissionDenied;
    if (jobs.permissionDenied) return result;
  }

  if (input.includeHolidays) {
    const holidays = await syncLebanonHolidaysToPhoneCalendar(input.years);
    result.holidaysSynced = holidays.holidaysSynced;
    result.permissionDenied = holidays.permissionDenied;
  }

  return result;
}

export async function unsyncPhoneCalendar(input: {
  jobs: JobCard[];
  userId: string;
  years: number[];
  includeJobs: boolean;
  includeHolidays: boolean;
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<void>;
}): Promise<PhoneCalendarUnsyncResult> {
  const result: PhoneCalendarUnsyncResult = {
    jobsRemoved: 0,
    holidaysRemoved: 0,
  };

  if (input.includeJobs) {
    result.jobsRemoved = await unsyncJobsFromPhoneCalendar(
      input.jobs,
      input.userId,
      input.updateJobCard,
    );
  }

  if (input.includeHolidays) {
    result.holidaysRemoved = await unsyncHolidaysFromPhoneCalendar(input.years);
  }

  return result;
}
