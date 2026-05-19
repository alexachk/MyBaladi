import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

async function ensurePermission(): Promise<boolean> {
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

export async function createCalendarEvent(input: {
  title: string;
  notes?: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  alarmMinutesBefore?: number;
}): Promise<string | null> {
  const granted = await ensurePermission();
  if (!granted) return null;

  const calendarId = await pickWritableCalendar();
  if (!calendarId) return null;

  const endDate =
    input.endDate ?? new Date(input.startDate.getTime() + 60 * 60 * 1000); // default 1h

  const eventId = await Calendar.createEventAsync(calendarId, {
    title: input.title,
    notes: input.notes,
    location: input.location,
    startDate: input.startDate,
    endDate,
    alarms:
      input.alarmMinutesBefore !== undefined
        ? [{ relativeOffset: -Math.abs(input.alarmMinutesBefore) }]
        : undefined,
  });
  return eventId;
}

export async function removeCalendarEvent(eventId: string | null | undefined) {
  if (!eventId) return;
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    // ignore
  }
}
