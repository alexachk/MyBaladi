import { ID, Permission, Query, Role } from 'react-native-appwrite';
import { appwriteConfig, isAppwriteConfigured, isAppwriteDatabaseConfigured } from './config';
import { getAccount, getDatabases } from './client';
import { listPersonnel } from './adminUsers';
import { getManagerReadersForAssignees } from '../orgHierarchy';
import { JobCard, JobPriority, JobStatus } from '../../types/jobCard';
import type { ClientType } from '../../types/client';
import { parseJobPeopleBlob, serializeJobPeopleBlob } from '../jobPeople';
import {
  formatMissionTypesDisplay,
  missionTypesForForm,
  primaryMissionType,
} from '../jobMissions';
import { type StoredJobSchedule } from '../jobSchedule';
import { formatEquipmentDisplay, parseEquipmentFromField } from '../jobEquipment';
import { parseStoredVisits, normalizeVisitsList, primaryVisitFields, migrateLegacyOnSiteToVisits, syncJobOnSiteFields } from '../jobVisits';
import {
  formatPartsSummary,
  formatWorkSummary,
  parseWorkReportsFromStorage,
  serializeWorkReportsToStorage,
} from '../jobWorkReports';

const NULLABLE_DATETIMES = ['reminderAt', 'startedAt', 'finishedAt', 'lockedAt'] as const;
const STRING_FIELDS = [
  'reference',
  'clientName',
  'siteAddress',
  'contactName',
  'contactPhone',
  'missionType',
  'equipment',
  'technicianName',
  'scheduledDate',
  'arrivalTime',
  'departureTime',
  'workPerformed',
  'partsUsed',
  'notes',
  'personId',
  'companyId',
  'parentJobId',
  'assigneeId',
  'assigneeName',
  'scheduledTime',
  'technicianSignatureId',
  'clientSignatureId',
  'clientSignatureName',
  'lockedBy',
  'notificationId',
  'calendarEventId',
] as const;

interface JobCardDocBase {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  status: JobStatus;
  priority: JobPriority;
  clientType?: ClientType | null;
  photoIds?: string[];
  documentIds?: string[];
  [key: string]: unknown;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableStr(value: unknown): string | null {
  if (typeof value === 'string' && value.length) return value;
  return null;
}

function nullableDate(value: unknown): string | null {
  return typeof value === 'string' && value.length ? value : null;
}

function documentToJobCard(doc: JobCardDocBase): JobCard {
  const people = parseJobPeopleBlob(doc.assignees);
  const missionTypes = people.missions.length
    ? people.missions
    : missionTypesForForm(str(doc.missionType));
  const workReport = parseWorkReportsFromStorage(str(doc.workPerformed), str(doc.partsUsed));
  const equipmentItems = people.equipment.length
    ? people.equipment
    : parseEquipmentFromField(str(doc.equipment));
  const visitsRaw = people.schedule?.visits?.length
    ? normalizeVisitsList(people.schedule.visits)
    : parseStoredVisits(null, str(doc.scheduledDate), nullableStr(doc.scheduledTime));
  const visits = migrateLegacyOnSiteToVisits(visitsRaw, str(doc.arrivalTime), str(doc.departureTime));
  const onSite = syncJobOnSiteFields(visits);
  const primaryVisit = primaryVisitFields(visits);

  return {
    id: doc.$id,
    reference: str(doc.reference),
    clientName: str(doc.clientName),
    siteAddress: str(doc.siteAddress),
    contactName: str(doc.contactName),
    contactPhone: str(doc.contactPhone),
    missionType: formatMissionTypesDisplay(missionTypes) || str(doc.missionType),
    missionTypes,
    equipment: formatEquipmentDisplay(equipmentItems) || str(doc.equipment),
    equipmentItems,
    technicianName: str(doc.technicianName),
    scheduledDate: primaryVisit.scheduledDate || str(doc.scheduledDate),
    arrivalTime: onSite.arrivalTime || str(doc.arrivalTime),
    departureTime: onSite.departureTime || str(doc.departureTime),
    workPerformed: formatWorkSummary(workReport, visits) || str(doc.workPerformed),
    partsUsed: formatPartsSummary(workReport, visits) || str(doc.partsUsed),
    workReport,
    notes: str(doc.notes),
    status: doc.status,
    priority: doc.priority,
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt,
    clientType: doc.clientType ?? null,
    personId: nullableStr(doc.personId),
    companyId: nullableStr(doc.companyId),
    parentJobId: nullableStr(doc.parentJobId),
    assigneeId: nullableStr(doc.assigneeId),
    assigneeName: nullableStr(doc.assigneeName),
    assignees: people.team,
    jobContacts: people.contacts,
    initialScheduledDate: people.schedule?.initialDate || str(doc.scheduledDate) || null,
    initialScheduledTime: people.schedule?.initialTime ?? nullableStr(doc.scheduledTime),
    scheduleLog: people.schedule?.log ?? [],
    visits,
    technicianId: nullableStr(doc.technicianId),
    scheduledTime: primaryVisit.scheduledTime ?? nullableStr(doc.scheduledTime),
    reminderAt: nullableDate(doc.reminderAt),
    startedAt: nullableDate(doc.startedAt),
    finishedAt: nullableDate(doc.finishedAt),
    technicianSignatureId: nullableStr(doc.technicianSignatureId),
    clientSignatureId: nullableStr(doc.clientSignatureId),
    clientSignatureName: nullableStr(doc.clientSignatureName),
    lockedAt: nullableDate(doc.lockedAt),
    lockedBy: nullableStr(doc.lockedBy),
    notificationId: nullableStr(doc.notificationId),
    calendarEventId: nullableStr(doc.calendarEventId),
    photoIds: Array.isArray(doc.photoIds) ? doc.photoIds : [],
    documentIds: Array.isArray(doc.documentIds) ? doc.documentIds : [],
  };
}

function normalizeForWrite(
  job: Partial<JobCard>,
  technicianId?: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const key of STRING_FIELDS) {
    if (job[key] !== undefined) {
      const value = job[key];
      out[key] = typeof value === 'string' ? value : value == null ? '' : String(value);
    }
  }

  if (job.status !== undefined) out.status = job.status;
  if (job.priority !== undefined) out.priority = job.priority;
  if (job.clientType !== undefined) out.clientType = job.clientType ?? null;
  if (job.photoIds !== undefined) out.photoIds = job.photoIds ?? [];
  if (job.documentIds !== undefined) out.documentIds = job.documentIds ?? [];
  if (job.workReport !== undefined) {
    const stored = serializeWorkReportsToStorage(job.workReport);
    out.workPerformed = stored.workPerformed;
    out.partsUsed = stored.partsUsed;
  }
  if (job.equipmentItems !== undefined) {
    out.equipment = formatEquipmentDisplay(job.equipmentItems).slice(0, 256);
  }
  if (job.assignees !== undefined || job.jobContacts !== undefined || job.missionTypes !== undefined || job.visits !== undefined || job.equipmentItems !== undefined) {
    out.assignees = serializeJobPeopleBlob({
      team: job.assignees ?? [],
      contacts: job.jobContacts ?? [],
      missions: job.missionTypes ?? missionTypesForForm(typeof job.missionType === 'string' ? job.missionType : ''),
      equipment: job.equipmentItems ?? [],
      schedule: buildScheduleBlobForWrite(job),
    });
  }
  if (job.missionTypes !== undefined) {
    out.missionType =
      primaryMissionType(job.missionTypes) || formatMissionTypesDisplay(job.missionTypes);
  }

  for (const key of NULLABLE_DATETIMES) {
    if (job[key] !== undefined) {
      const value = job[key];
      out[key] = value || null;
    }
  }

  if (technicianId) out.technicianId = technicianId;

  return out;
}

function buildScheduleBlobForWrite(job: Partial<JobCard>): StoredJobSchedule | undefined {
  const hasScheduleData =
    job.visits !== undefined ||
    job.scheduleLog !== undefined ||
    job.initialScheduledDate !== undefined ||
    job.initialScheduledTime !== undefined ||
    job.scheduledDate !== undefined;

  if (!hasScheduleData) return undefined;

  const visits =
    job.visits ??
    parseStoredVisits(null, job.scheduledDate, job.scheduledTime ?? null);

  if (!visits.length) return undefined;

  const primary = primaryVisitFields(visits);
  const initialDate = job.initialScheduledDate || primary.scheduledDate;
  if (!initialDate) return undefined;

  return {
    initialDate,
    initialTime: job.initialScheduledTime ?? primary.scheduledTime,
    log: job.scheduleLog ?? [],
    visits,
  };
}

function userPermissions(userId: string, extraReaderIds: string[] = []) {
  const perms = [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
    Permission.read(Role.label('admin')),
    Permission.update(Role.label('admin')),
    Permission.delete(Role.label('admin')),
  ];
  for (const readerId of extraReaderIds) {
    if (!readerId || readerId === userId) continue;
    perms.push(Permission.read(Role.user(readerId)));
  }
  return perms;
}

export async function fetchJobCardsFromAppwrite(
  userId: string,
  options: { all?: boolean; visibleUserIds?: string[] | null } = {},
): Promise<JobCard[]> {
  if (!isAppwriteDatabaseConfigured()) return [];

  const queries = [Query.orderDesc('$updatedAt'), Query.limit(500)];

  if (!options.all) {
    const ids = options.visibleUserIds?.length
      ? [...new Set(options.visibleUserIds)]
      : [userId];

    if (ids.length === 1) {
      queries.unshift(
        Query.or([Query.equal('technicianId', ids[0]), Query.equal('assigneeId', ids[0])]),
      );
    } else {
      queries.unshift(
        Query.or(
          ids.flatMap((id) => [
            Query.equal('technicianId', id),
            Query.equal('assigneeId', id),
          ]),
        ),
      );
    }
  }

  const response = await getDatabases().listDocuments({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobCardsCollectionId,
    queries,
  });

  return response.documents.map((doc) => documentToJobCard(doc as unknown as JobCardDocBase));
}

export async function createJobCardInAppwrite(
  job: Omit<JobCard, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string,
): Promise<JobCard> {
  let managerReaders: string[] = [];
  try {
    const personnel = await listPersonnel();
    const members = personnel.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      labels: p.labels,
      position: p.position,
      managerId: p.managerId ?? '',
    }));
    managerReaders = getManagerReadersForAssignees(
      userId,
      job.assignees?.map((a) => a.userId).filter(Boolean) ??
        (job.assigneeId ? [job.assigneeId] : []),
      members,
    );
  } catch {
    // best-effort — owner + admin permissions still apply
  }

  const doc = await getDatabases().createDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobCardsCollectionId,
    documentId: ID.unique(),
    data: normalizeForWrite(job, userId),
    permissions: userPermissions(userId, managerReaders),
  });

  return documentToJobCard(doc as unknown as JobCardDocBase);
}

export async function updateJobCardInAppwrite(
  id: string,
  updates: Partial<JobCard>,
): Promise<void> {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = updates;
  await getDatabases().updateDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobCardsCollectionId,
    documentId: id,
    data: normalizeForWrite(rest),
  });
}

export async function deleteJobCardFromAppwrite(id: string): Promise<void> {
  await getDatabases().deleteDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobCardsCollectionId,
    documentId: id,
  });
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!isAppwriteConfigured()) return null;
  try {
    const user = await getAccount().get();
    return user.$id;
  } catch {
    return null;
  }
}
