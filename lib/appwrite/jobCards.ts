import { ID, Permission, Query, Role } from 'react-native-appwrite';
import { formatAppwriteError } from '../appwriteErrors';
import { appwriteConfig, isAppwriteConfigured, isAppwriteDatabaseConfigured } from './config';
import { getAccount, getDatabases } from './client';
import { deleteJobCardViaAdmin, syncJobCardPermissions } from './adminUsers';
import { JobCard, JobPriority, JobStatus } from '../../types/jobCard';
import type { ClientType } from '../../types/client';
import { parseJobPeopleBlob, serializeJobPeopleBlobForWrite } from '../jobPeople';
import {
  formatMissionTypesDisplay,
  missionTypesForForm,
  primaryMissionType,
} from '../jobMissions';
import { reconcileVisitScheduleLog, type StoredJobSchedule } from '../jobSchedule';
import { formatEquipmentDisplay, formatEquipmentLine, parseEquipmentFromField } from '../jobEquipment';
import {
  legacyFieldsFromMissionScopes,
  missionScopesFromJob,
} from '../jobMissionScopes';
import { missionNotesFromJob } from '../jobVisitNotes';
import { parseStoredVisits, normalizeVisitsList, primaryVisitFields, migrateLegacyOnSiteToVisits, syncJobOnSiteFields } from '../jobVisits';
import {
  formatPartsSummary,
  formatWorkSummary,
  parseWorkReportsFromStorage,
  serializeWorkReportsToStorage,
} from '../jobWorkReports';

const NULLABLE_DATETIMES = [
  'reminderAt',
  'startedAt',
  'finishedAt',
  'technicianSignedAt',
  'lockedAt',
  'submittedAt',
  'reviewedAt',
] as const;

/** Must match `scripts/appwrite/schema.mjs` sizes for job_cards. */
const FIELD_MAX = {
  contactPhone: 128,
  missionType: 64,
  equipment: 256,
  assignees: 2000,
  workPerformed: 5000,
  partsUsed: 2000,
  notes: 2000,
} as const;
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
  'signatureVisitId',
  'lockedBy',
  'notificationId',
  'calendarEventId',
  'submittedById',
  'reviewedById',
  'reviewedByName',
  'reviewNote',
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
  const missionScopes = people.missionScopes?.length ? people.missionScopes : undefined;
  const legacyFromScopes = missionScopes ? legacyFieldsFromMissionScopes(missionScopes) : null;
  const missionTypes = legacyFromScopes?.missionTypes.length
    ? legacyFromScopes.missionTypes
    : people.missions.length
      ? people.missions
      : missionTypesForForm(str(doc.missionType));
  const workReport = parseWorkReportsFromStorage(str(doc.workPerformed), str(doc.partsUsed));
  const equipmentLines = legacyFromScopes?.equipmentItems.length
    ? legacyFromScopes.equipmentItems
    : people.equipment.length
      ? people.equipment.map((name) => ({ name, quantity: null as number | null }))
      : parseEquipmentFromField(str(doc.equipment)).map((name) => ({ name, quantity: null }));
  const equipmentItems = equipmentLines.map((line) => formatEquipmentLine(line));
  const visitsRaw = people.schedule?.visits?.length
    ? normalizeVisitsList(people.schedule.visits)
    : parseStoredVisits(null, str(doc.scheduledDate), nullableStr(doc.scheduledTime));
  const visits = migrateLegacyOnSiteToVisits(visitsRaw, str(doc.arrivalTime), str(doc.departureTime));
  const scheduleLog = reconcileVisitScheduleLog(visits, people.schedule?.log ?? []);
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
    missionScopes: missionScopes ?? missionScopesFromJob({
      missionTypes,
      missionType: str(doc.missionType),
      equipmentItems,
      equipment: str(doc.equipment),
      assignees: people.team,
      assigneeId: nullableStr(doc.assigneeId),
      assigneeName: nullableStr(doc.assigneeName),
    }),
    missionNotes: people.missionNotes?.length
      ? people.missionNotes
      : missionNotesFromJob({ missionScopes: missionScopes ?? [] }),
    equipment: formatEquipmentDisplay(equipmentLines) || str(doc.equipment),
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
    assignees: legacyFromScopes?.assignees.length ? legacyFromScopes.assignees : people.team,
    jobContacts: people.contacts,
    initialScheduledDate: people.schedule?.initialDate || str(doc.scheduledDate) || null,
    initialScheduledTime: people.schedule?.initialTime ?? nullableStr(doc.scheduledTime),
    scheduleLog,
    visits,
    technicianId: nullableStr(doc.technicianId),
    scheduledTime: primaryVisit.scheduledTime ?? nullableStr(doc.scheduledTime),
    reminderAt: nullableDate(doc.reminderAt),
    startedAt: nullableDate(doc.startedAt),
    finishedAt: nullableDate(doc.finishedAt),
    technicianSignatureId: nullableStr(doc.technicianSignatureId),
    clientSignatureId: nullableStr(doc.clientSignatureId),
    clientSignatureName: nullableStr(doc.clientSignatureName),
    signatureVisitId: nullableStr(doc.signatureVisitId),
    technicianSignedAt: nullableDate(doc.technicianSignedAt),
    lockedAt: nullableDate(doc.lockedAt),
    lockedBy: nullableStr(doc.lockedBy),
    notificationId: nullableStr(doc.notificationId),
    calendarEventId: nullableStr(doc.calendarEventId),
    reviewStatus:
      doc.reviewStatus === 'submitted' ||
      doc.reviewStatus === 'approved' ||
      doc.reviewStatus === 'rejected'
        ? doc.reviewStatus
        : 'none',
    submittedById: nullableStr(doc.submittedById),
    submittedAt: nullableDate(doc.submittedAt),
    reviewedById: nullableStr(doc.reviewedById),
    reviewedByName: nullableStr(doc.reviewedByName),
    reviewedAt: nullableDate(doc.reviewedAt),
    reviewNote: nullableStr(doc.reviewNote),
    reviewBypassed: Boolean(doc.reviewBypassed),
    photoIds: Array.isArray(doc.photoIds) ? doc.photoIds : [],
    documentIds: Array.isArray(doc.documentIds) ? doc.documentIds : [],
    attachmentVisitLinks: people.attachmentVisitLinks ?? {},
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
  if (job.reviewStatus !== undefined) out.reviewStatus = job.reviewStatus ?? 'none';
  if (job.reviewBypassed !== undefined) out.reviewBypassed = Boolean(job.reviewBypassed);
  if (job.clientType === 'person' || job.clientType === 'company') {
    out.clientType = job.clientType;
  }
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
  if (
    job.assignees !== undefined ||
    job.jobContacts !== undefined ||
    job.missionTypes !== undefined ||
    job.missionScopes !== undefined ||
    job.missionNotes !== undefined ||
    job.visits !== undefined ||
    job.scheduleLog !== undefined ||
    job.initialScheduledDate !== undefined ||
    job.initialScheduledTime !== undefined ||
    job.scheduledDate !== undefined ||
    job.scheduledTime !== undefined ||
    job.equipmentItems !== undefined ||
    job.attachmentVisitLinks !== undefined ||
    job.photoIds !== undefined ||
    job.documentIds !== undefined
  ) {
    const scopes =
      job.missionScopes ??
      missionScopesFromJob({
        missionTypes: job.missionTypes,
        missionType: typeof job.missionType === 'string' ? job.missionType : '',
        equipmentItems: job.equipmentItems,
        equipment: typeof job.equipment === 'string' ? job.equipment : '',
        assignees: job.assignees,
        assigneeId: job.assigneeId ?? null,
        assigneeName: job.assigneeName ?? null,
      });
    const legacy = legacyFieldsFromMissionScopes(scopes);
    out.assignees = serializeJobPeopleBlobForWrite(
      {
        team: job.assignees ?? legacy.assignees,
        contacts: job.jobContacts ?? [],
        missions: job.missionTypes ?? legacy.missionTypes,
        equipment: job.equipmentItems ?? legacy.equipmentItems.map((line) => formatEquipmentLine(line)),
        missionScopes: scopes,
        missionNotes: job.missionNotes ?? missionNotesFromJob({ missionScopes: scopes }),
        schedule: buildScheduleBlobForWrite(job),
        attachmentVisitLinks: job.attachmentVisitLinks,
      },
      FIELD_MAX.assignees,
    );
    if (job.missionTypes === undefined) {
      out.missionType = formatMissionTypesDisplay(legacy.missionTypes).slice(0, FIELD_MAX.missionType);
    }
    if (job.equipmentItems === undefined) {
      out.equipment = formatEquipmentDisplay(legacy.equipmentItems).slice(0, 256);
    }
  }
  if (typeof out.contactPhone === 'string') {
    out.contactPhone = out.contactPhone.slice(0, FIELD_MAX.contactPhone);
  }
  if (typeof out.workPerformed === 'string' && out.workPerformed.length > FIELD_MAX.workPerformed) {
    throw new Error('Work report is too large. Remove attachments or shorten entries.');
  }
  if (typeof out.partsUsed === 'string' && out.partsUsed.length > FIELD_MAX.partsUsed) {
    throw new Error('Parts list is too long.');
  }
  if (typeof out.notes === 'string') {
    out.notes = out.notes.slice(0, FIELD_MAX.notes);
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

/**
 * Document ACL the signed-in client may set (no label:admin, no other user:*).
 * @see Appwrite 401 "Permissions must be one of: (any, users, user:<self>, …)"
 */
/** ACL the signed-in client may set on create (no label:* or other users). */
export function clientCreatePermissions(creatorId: string) {
  if (!creatorId) return [];
  return [
    Permission.read(Role.user(creatorId)),
    Permission.update(Role.user(creatorId)),
    Permission.delete(Role.user(creatorId)),
  ];
}

/** Document owner for ACL sync (creator / lead / assignee). */
export function jobOwnerUserId(
  job: Pick<JobCard, 'technicianId' | 'assigneeId' | 'assignees'>,
): string {
  if (job.technicianId) return job.technicianId;
  if (job.assigneeId) return job.assigneeId;
  const lead = job.assignees?.find((row) => row.role === 'Lead' && row.userId);
  if (lead?.userId) return lead.userId;
  return job.assignees?.find((row) => row.userId)?.userId ?? '';
}

function assigneeIdsFromJob(job: Pick<JobCard, 'assignees' | 'assigneeId'>): string[] {
  const ids = new Set<string>();
  for (const row of job.assignees ?? []) {
    if (row.userId) ids.add(row.userId);
  }
  if (job.assigneeId) ids.add(job.assigneeId);
  return [...ids];
}

export async function applyJobCardPermissions(
  documentId: string,
  ownerId: string,
  job: Pick<JobCard, 'technicianId' | 'assignees' | 'assigneeId'>,
): Promise<void> {
  const resolvedOwner = jobOwnerUserId(job) || ownerId;
  if (!resolvedOwner || !isAppwriteDatabaseConfigured()) return;
  await syncJobCardPermissions({
    documentId,
    ownerId: resolvedOwner,
    assigneeIds: assigneeIdsFromJob(job),
  });
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
  const creatorId = (await getCurrentUserId()) ?? userId;
  if (!creatorId) {
    throw new Error('Sign in required to save a job card.');
  }

  let created: JobCard;
  try {
    const doc = await getDatabases().createDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.jobCardsCollectionId,
      documentId: ID.unique(),
      data: normalizeForWrite(job, creatorId),
      permissions: clientCreatePermissions(creatorId),
    });
    created = documentToJobCard(doc as unknown as JobCardDocBase);
  } catch (error) {
    throw new Error(formatAppwriteError(error));
  }

  void applyJobCardPermissions(created.id, creatorId, job).catch(() => undefined);
  return created;
}

export async function updateJobCardInAppwrite(
  id: string,
  updates: Partial<JobCard>,
): Promise<void> {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = updates;
  try {
    await getDatabases().updateDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.jobCardsCollectionId,
      documentId: id,
      data: normalizeForWrite(rest),
    });
  } catch (error) {
    throw new Error(formatAppwriteError(error));
  }
}

export async function deleteJobCardFromAppwrite(
  id: string,
  job?: Pick<
    JobCard,
    | 'technicianId'
    | 'assignees'
    | 'assigneeId'
    | 'reviewStatus'
    | 'status'
    | 'lockedAt'
  >,
): Promise<void> {
  const attempt = () =>
    getDatabases().deleteDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.jobCardsCollectionId,
      documentId: id,
    });

  try {
    await attempt();
    return;
  } catch (clientError) {
    if (!job) {
      throw new Error(formatAppwriteError(clientError));
    }
    const ownerId = jobOwnerUserId(job) || job.technicianId;
    if (!ownerId) {
      throw new Error(formatAppwriteError(clientError));
    }
    try {
      await deleteJobCardViaAdmin({
        documentId: id,
        ownerId,
        assigneeIds: assigneeIdsFromJob(job),
        reviewStatus: job.reviewStatus,
        status: job.status,
        lockedAt: job.lockedAt,
      });
      return;
    } catch (adminError) {
      try {
        await applyJobCardPermissions(id, ownerId, job);
        await attempt();
        return;
      } catch {
        const message =
          adminError instanceof Error
            ? adminError.message
            : formatAppwriteError(adminError);
        throw new Error(message);
      }
    }
  }
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
