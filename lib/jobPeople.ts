import { normalizeMissionTypes } from './jobMissions';
import { parseStoredAssignees, serializeAssignees, type StoredJobAssignee } from './jobAssignees';
import { parseStoredJobContacts, type StoredJobContact } from './jobContacts';
import { parseStoredSchedule, type StoredJobSchedule } from './jobSchedule';

export interface JobPeopleBlob {
  team: StoredJobAssignee[];
  contacts: StoredJobContact[];
  missions: string[];
  schedule?: StoredJobSchedule;
}

const EMPTY_BLOB: JobPeopleBlob = { team: [], contacts: [], missions: [] };

function needsPeopleWrapper(blob: JobPeopleBlob): boolean {
  return blob.contacts.length > 0 || blob.missions.length > 1 || Boolean(blob.schedule);
}

export function parseJobPeopleBlob(raw: unknown): JobPeopleBlob {
  if (!raw) return EMPTY_BLOB;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return EMPTY_BLOB;
    try {
      return parseJobPeopleBlob(JSON.parse(trimmed));
    } catch {
      return EMPTY_BLOB;
    }
  }
  if (Array.isArray(raw)) {
    return { team: parseStoredAssignees(raw), contacts: [], missions: [] };
  }
  if (typeof raw === 'object' && raw) {
    const row = raw as Record<string, unknown>;
    return {
      team: parseStoredAssignees(row.team ?? row.assignees ?? []),
      contacts: parseStoredJobContacts(row.contacts ?? []),
      missions: normalizeMissionTypes(
        Array.isArray(row.missions)
          ? row.missions.filter((value): value is string => typeof value === 'string')
          : [],
      ),
      schedule: parseStoredSchedule(row.schedule),
    };
  }
  return EMPTY_BLOB;
}

export function serializeJobPeopleBlob(blob: JobPeopleBlob): string {
  if (!needsPeopleWrapper(blob)) {
    return serializeAssignees(
      blob.team.map((entry, index) => ({
        key: `a-${index}`,
        userId: entry.userId,
        name: entry.name,
        role: entry.role,
      })),
    );
  }
  const payload: Record<string, unknown> = {
    team: blob.team,
    contacts: blob.contacts,
    missions: blob.missions,
  };
  if (blob.schedule) payload.schedule = blob.schedule;
  return JSON.stringify(payload);
}
