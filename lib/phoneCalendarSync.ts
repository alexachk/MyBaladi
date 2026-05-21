import AsyncStorage from '@react-native-async-storage/async-storage';
import type { JobCard } from '../types/jobCard';
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

export type PhoneCalendarSyncResult = {
  jobsSynced: number;
  holidaysSynced: number;
  permissionDenied: boolean;
};

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

async function saveLocalJobEvent(jobId: string, eventId: string) {
  const map = await loadLocalJobEvents();
  map[jobId] = eventId;
  await AsyncStorage.setItem(LOCAL_JOB_EVENTS_KEY, JSON.stringify(map));
}

async function loadHolidayEvents(): Promise<Record<number, Record<string, string>>> {
  try {
    const raw = await AsyncStorage.getItem(HOLIDAY_EVENTS_KEY);
    return raw ? (JSON.parse(raw) as Record<number, Record<string, string>>) : {};
  } catch {
    return {};
  }
}

async function saveHolidayEvent(year: number, date: string, eventId: string) {
  const map = await loadHolidayEvents();
  if (!map[year]) map[year] = {};
  map[year][date] = eventId;
  await AsyncStorage.setItem(HOLIDAY_EVENTS_KEY, JSON.stringify(map));
}

async function resolveJobEventId(
  job: JobCard,
  localEvents: Record<string, string>,
): Promise<string | null> {
  return job.calendarEventId ?? localEvents[job.id] ?? null;
}

async function upsertJobEvent(job: JobCard, existingEventId: string | null): Promise<string | null> {
  const startDate = jobStartDate(job);
  if (!startDate) return null;

  const payload = {
    title: jobEventTitle(job),
    notes: jobEventNotes(job),
    location: job.siteAddress || undefined,
    startDate,
    alarmMinutesBefore: 60,
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

async function upsertHolidayEvent(
  holiday: LebanonHoliday,
  existingEventId: string | null,
): Promise<string | null> {
  const [y, m, d] = holiday.date.split('-').map(Number);
  const startDate = new Date(y, m - 1, d);
  const title = formatHolidayPhoneTitle(holiday);

  if (existingEventId) {
    try {
      await updateCalendarEvent(existingEventId, {
        title,
        notes: 'عطلة رسمية لبنانية · Lebanese public holiday · MyBaladi',
        startDate,
        allDay: true,
      });
      return existingEventId;
    } catch {
      await removeCalendarEvent(existingEventId);
    }
  }

  return createAllDayCalendarEvent({
    title,
    notes: 'عطلة رسمية لبنانية · Lebanese public holiday · MyBaladi',
    startDate,
  });
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
    const owner = job.assigneeId ?? job.technicianId ?? '';
    if (owner === userId) {
      if (job.calendarEventId !== eventId) {
        await updateJobCard(job.id, { calendarEventId: eventId });
      }
    } else {
      await saveLocalJobEvent(job.id, eventId);
    }
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
    const yearStore = holidayStore[year] ?? {};

    for (const holiday of holidays) {
      const existingId = yearStore[holiday.date] ?? null;
      const eventId = await upsertHolidayEvent(holiday, existingId);
      if (!eventId) continue;
      holidaysSynced += 1;
      await saveHolidayEvent(year, holiday.date, eventId);
    }
  }

  return { holidaysSynced, permissionDenied: false };
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
