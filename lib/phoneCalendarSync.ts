import AsyncStorage from '@react-native-async-storage/async-storage';
import type { JobCard } from '../types/jobCard';
import { addDaysIso } from '../utils/calendarGrid';
import {
  createAllDayCalendarEvent,
  createCalendarEvent,
  ensureCalendarPermission,
  removeCalendarEvent,
  updateCalendarEvent,
} from './calendar';
import { getLebanonHolidays, type LebanonHoliday, formatHolidayPhoneTitle } from './lebanonHolidays';

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

function jobStartDate(job: JobCard): Date | null {
  if (!job.scheduledDate) return null;
  const [y, m, d] = job.scheduledDate.split('-').map(Number);
  if (job.scheduledTime) {
    const [hh, mm] = job.scheduledTime.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm);
  }
  return new Date(y, m - 1, d, 9, 0);
}

function jobEventTitle(job: JobCard): string {
  return `[${job.reference}] ${job.clientName}`;
}

function jobEventNotes(job: JobCard): string {
  const lines = [
    job.missionType,
    job.equipment ? `Equipment: ${job.equipment}` : '',
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

async function resolveJobEventId(
  job: JobCard,
  localEvents: Record<string, string>,
): Promise<string | null> {
  return job.calendarEventId ?? localEvents[job.id] ?? null;
}

function jobAlarmMinutesBefore(job: JobCard, startDate: Date): number | undefined {
  if (!job.reminderAt) return 60;
  const minutes = Math.round((startDate.getTime() - new Date(job.reminderAt).getTime()) / 60000);
  return minutes > 0 ? minutes : undefined;
}

async function upsertJobEvent(job: JobCard, existingEventId: string | null): Promise<string | null> {
  const startDate = jobStartDate(job);
  if (!startDate) return null;

  const payload = {
    title: jobEventTitle(job),
    notes: jobEventNotes(job),
    location: job.siteAddress || undefined,
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

async function persistJobCalendarEventId(
  job: JobCard,
  userId: string,
  eventId: string,
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<void>,
): Promise<void> {
  const owner = job.assigneeId ?? job.technicianId ?? '';
  if (owner === userId) {
    if (job.calendarEventId !== eventId) {
      await updateJobCard(job.id, { calendarEventId: eventId });
    }
    return;
  }
  await saveLocalJobEvent(job.id, eventId);
}

export async function syncSingleJobToPhoneCalendar(
  job: JobCard,
  userId: string,
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<void>,
): Promise<string | null> {
  if (!job.scheduledDate) return null;

  const granted = await ensureCalendarPermission();
  if (!granted) return null;

  const localEvents = await loadLocalJobEvents();
  const existingId = await resolveJobEventId(job, localEvents);
  const eventId = await upsertJobEvent(job, existingId);
  if (!eventId) return null;

  await persistJobCalendarEventId(job, userId, eventId, updateJobCard);
  return eventId;
}

export async function syncJobsToPhoneCalendar(
  jobs: JobCard[],
  userId: string,
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<void>,
): Promise<Pick<PhoneCalendarSyncResult, 'jobsSynced' | 'permissionDenied'>> {
  const granted = await ensureCalendarPermission();
  if (!granted) return { jobsSynced: 0, permissionDenied: true };

  const scheduled = jobs.filter((j) => j.scheduledDate);
  const localEvents = await loadLocalJobEvents();
  let jobsSynced = 0;

  for (const job of scheduled) {
    const existingId = await resolveJobEventId(job, localEvents);
    const eventId = await upsertJobEvent(job, existingId);
    if (!eventId) continue;

    jobsSynced += 1;
    await persistJobCalendarEventId(job, userId, eventId, updateJobCard);
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
    const eventId = job.calendarEventId ?? localEvents[job.id];
    if (!eventId || removedEventIds.has(eventId)) {
      delete localEvents[job.id];
      continue;
    }

    await removeCalendarEvent(eventId);
    removedEventIds.add(eventId);
    jobsRemoved += 1;

    const owner = job.assigneeId ?? job.technicianId ?? '';
    if (owner === userId && job.calendarEventId) {
      await updateJobCard(job.id, { calendarEventId: null });
    }
    delete localEvents[job.id];
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
