import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export async function ensureCalendarPermission(): Promise<boolean> {
  const current = await Calendar.getCalendarPermissionsAsync();
  if (current.granted) return true;
  const next = await Calendar.requestCalendarPermissionsAsync();
  return next.granted;
}

async function pickWritableCalendar(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((c) => c.allowsModifications);
  if (!writable.length) return null;

  if (Platform.OS === 'ios') {
    const primary = writable.find((c) => c.source?.name === 'iCloud') ?? writable[0];
    return primary.id;
  }

  const owned = writable.find((c) => c.accessLevel === Calendar.CalendarAccessLevel.OWNER);
  return (owned ?? writable[0]).id;
}

type EventInput = {
  title: string;
  notes?: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  alarmMinutesBefore?: number;
};

export async function createCalendarEvent(input: EventInput): Promise<string | null> {
  const granted = await ensureCalendarPermission();
  if (!granted) return null;

  const calendarId = await pickWritableCalendar();
  if (!calendarId) return null;

  const endDate =
    input.endDate ??
    (input.allDay
      ? input.startDate
      : new Date(input.startDate.getTime() + 60 * 60 * 1000));

  const eventId = await Calendar.createEventAsync(calendarId, {
    title: input.title,
    notes: input.notes,
    location: input.location,
    startDate: input.startDate,
    endDate,
    allDay: input.allDay,
    alarms:
      input.alarmMinutesBefore !== undefined
        ? [{ relativeOffset: -Math.abs(input.alarmMinutesBefore) }]
        : undefined,
  });
  return eventId;
}

export async function createAllDayCalendarEvent(input: {
  title: string;
  notes?: string;
  startDate: Date;
  /** Exclusive end (day after last inclusive day). Defaults to start + 1 day. */
  endDate?: Date;
}): Promise<string | null> {
  return createCalendarEvent({
    ...input,
    allDay: true,
  });
}

export async function updateCalendarEvent(eventId: string, input: EventInput): Promise<void> {
  const endDate =
    input.endDate ??
    (input.allDay
      ? input.startDate
      : new Date(input.startDate.getTime() + 60 * 60 * 1000));

  await Calendar.updateEventAsync(eventId, {
    title: input.title,
    notes: input.notes,
    location: input.location,
    startDate: input.startDate,
    endDate,
    allDay: input.allDay,
    alarms:
      input.alarmMinutesBefore !== undefined
        ? [{ relativeOffset: -Math.abs(input.alarmMinutesBefore) }]
        : undefined,
  });
}

export async function removeCalendarEvent(eventId: string | null | undefined) {
  if (!eventId) return;
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    // ignore
  }
}
