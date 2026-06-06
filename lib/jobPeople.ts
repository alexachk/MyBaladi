import { normalizeMissionTypes } from './jobMissions';
import { normalizeEquipmentEntries } from './jobEquipment';
import { parseStoredAssignees, serializeAssignees, type StoredJobAssignee } from './jobAssignees';
import { parseStoredJobContacts, type StoredJobContact } from './jobContacts';
import { parseStoredSchedule, type StoredJobSchedule } from './jobSchedule';
import { parseStoredMissionScopes, type StoredMissionScope } from './jobMissionScopes';
import { legacyMissionNotesFromScopes, parseStoredVisitNotes, type StoredVisitNote } from './jobVisitNotes';
import {
  compactAttachmentVisitLinks,
  parseAttachmentVisitLinks,
  type AttachmentVisitLinks,
} from './jobCardAttachments';
import type { StoredJobVisit } from './jobVisits';

export interface JobPeopleBlob {
  team: StoredJobAssignee[];
  contacts: StoredJobContact[];
  missions: string[];
  equipment: string[];
  missionScopes?: StoredMissionScope[];
  missionNotes?: StoredVisitNote[];
  schedule?: StoredJobSchedule;
  attachmentVisitLinks?: AttachmentVisitLinks;
}

const EMPTY_BLOB: JobPeopleBlob = { team: [], contacts: [], missions: [], equipment: [] };

function needsPeopleWrapper(blob: JobPeopleBlob): boolean {
  return (
    blob.contacts.length > 0 ||
    blob.missions.length > 1 ||
    blob.equipment.length > 0 ||
    (blob.missionScopes?.length ?? 0) > 0 ||
    (blob.missionNotes?.length ?? 0) > 0 ||
    Boolean(blob.schedule) ||
    Object.keys(blob.attachmentVisitLinks ?? {}).length > 0
  );
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
    return { team: parseStoredAssignees(raw), contacts: [], missions: [], equipment: [] };
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
      equipment: Array.isArray(row.equipment)
        ? normalizeEquipmentEntries(
            row.equipment
              .filter((value): value is string => typeof value === 'string')
              .map((name) => ({ key: 'stored', name })),
          )
        : [],
      missionScopes: parseStoredMissionScopes(row.missionScopes),
      missionNotes: (() => {
        const parsed = parseStoredVisitNotes(row.missionNotes);
        if (parsed.length) return parsed;
        if (Array.isArray(row.missionScopes)) {
          return legacyMissionNotesFromScopes(
            row.missionScopes as Array<{ visitId: string | null; note?: string; notes?: unknown }>,
          );
        }
        return [];
      })(),
      schedule: parseStoredSchedule(row.schedule),
      attachmentVisitLinks: parseAttachmentVisitLinks(row.attV),
    };
  }
  return EMPTY_BLOB;
}

function compactContacts(contacts: StoredJobContact[]): StoredJobContact[] {
  return contacts.map((contact) => ({
    ...contact,
    firstName: contact.firstName.slice(0, 64),
    lastName: contact.lastName.slice(0, 64),
    contactPhones: contact.contactPhones.slice(0, 2),
    contactEmails: contact.contactEmails.slice(0, 2),
  }));
}

function compactVisit(visit: StoredJobVisit, stripGeo = false): StoredJobVisit {
  const row: StoredJobVisit = {
    id: visit.id,
    date: visit.date,
    time: visit.time ?? null,
    status: visit.status,
  };
  if (visit.label) row.label = visit.label.slice(0, 48);
  if (visit.location) row.location = visit.location.slice(0, 160);
  if (!stripGeo) {
    if (visit.latitude !== undefined) row.latitude = visit.latitude;
    if (visit.longitude !== undefined) row.longitude = visit.longitude;
  }
  if (visit.arrivalTime) row.arrivalTime = visit.arrivalTime;
  if (visit.departureTime) row.departureTime = visit.departureTime;
  if (visit.completedAt) row.completedAt = visit.completedAt;
  if (visit.rescheduledToId) row.rescheduledToId = visit.rescheduledToId;
  if (visit.followUpOfVisitId) row.followUpOfVisitId = visit.followUpOfVisitId;
  if (visit.calendarEventId) row.calendarEventId = visit.calendarEventId;
  if (visit.technicianSignatureId) row.technicianSignatureId = visit.technicianSignatureId;
  if (visit.clientSignatureId) row.clientSignatureId = visit.clientSignatureId;
  if (visit.clientSignatureName) row.clientSignatureName = visit.clientSignatureName.slice(0, 64);
  if (visit.technicianSignedAt) row.technicianSignedAt = visit.technicianSignedAt;
  if (visit.lockedAt) row.lockedAt = visit.lockedAt;
  if (visit.lockedBy) row.lockedBy = visit.lockedBy;
  return row;
}

function compactSchedule(schedule: StoredJobSchedule | undefined, stripGeo = false): StoredJobSchedule | undefined {
  if (!schedule) return undefined;
  return {
    initialDate: schedule.initialDate,
    initialTime: schedule.initialTime,
    log: schedule.log.slice(-12),
    visits: schedule.visits.map((visit) => compactVisit(visit, stripGeo)),
  };
}

function buildPayload(blob: JobPeopleBlob, options: { compactContacts?: boolean; stripGeo?: boolean; dropLog?: boolean }): string {
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
  const contacts = options.compactContacts ? compactContacts(blob.contacts) : blob.contacts;
  let schedule = compactSchedule(blob.schedule, options.stripGeo);
  if (options.dropLog && schedule) {
    schedule = { ...schedule, log: [] };
  }
  const payload: Record<string, unknown> = {
    team: blob.team,
    contacts,
    missions: blob.missions,
  };
  if (blob.equipment.length) payload.equipment = blob.equipment;
  if (blob.missionScopes?.length) payload.missionScopes = blob.missionScopes;
  if (blob.missionNotes?.length) payload.missionNotes = blob.missionNotes;
  if (schedule) payload.schedule = schedule;
  const attV = compactAttachmentVisitLinks(blob.attachmentVisitLinks ?? {});
  if (Object.keys(attV).length) payload.attV = attV;
  return JSON.stringify(payload);
}

export function serializeJobPeopleBlob(blob: JobPeopleBlob): string {
  return buildPayload(blob, {});
}

/** Fit team/contacts/visits JSON into Appwrite `assignees` column (2000 chars on current plan). */
export function serializeJobPeopleBlobForWrite(blob: JobPeopleBlob, maxChars = 2000): string {
  const attempts = [
    {},
    { compactContacts: true },
    { compactContacts: true, stripGeo: true },
    { compactContacts: true, stripGeo: true, dropLog: true },
  ];
  for (const options of attempts) {
    const json = buildPayload(blob, options);
    if (json.length <= maxChars) return json;
  }
  const json = buildPayload(blob, { compactContacts: true, stripGeo: true, dropLog: true });
  throw new Error(
    `Job contacts/visits data is too large (${json.length} chars, max ${maxChars}). Remove extra site contacts or visits.`,
  );
}
