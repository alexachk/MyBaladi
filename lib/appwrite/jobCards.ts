import { ID, Permission, Query, Role } from 'react-native-appwrite';
import { appwriteConfig, isAppwriteConfigured, isAppwriteDatabaseConfigured } from './config';
import { getAccount, getDatabases } from './client';
import { JobCard, JobPriority, JobStatus } from '../../types/jobCard';
import type { ClientType } from '../../types/client';

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
  return {
    id: doc.$id,
    reference: str(doc.reference),
    clientName: str(doc.clientName),
    siteAddress: str(doc.siteAddress),
    contactName: str(doc.contactName),
    contactPhone: str(doc.contactPhone),
    missionType: str(doc.missionType),
    equipment: str(doc.equipment),
    technicianName: str(doc.technicianName),
    scheduledDate: str(doc.scheduledDate),
    arrivalTime: str(doc.arrivalTime),
    departureTime: str(doc.departureTime),
    workPerformed: str(doc.workPerformed),
    partsUsed: str(doc.partsUsed),
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
    scheduledTime: nullableStr(doc.scheduledTime),
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

  for (const key of NULLABLE_DATETIMES) {
    if (job[key] !== undefined) {
      const value = job[key];
      out[key] = value || null;
    }
  }

  if (technicianId) out.technicianId = technicianId;

  return out;
}

function userPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
    Permission.read(Role.label('admin')),
    Permission.update(Role.label('admin')),
    Permission.delete(Role.label('admin')),
  ];
}

export async function fetchJobCardsFromAppwrite(
  userId: string,
  options: { all?: boolean } = {},
): Promise<JobCard[]> {
  if (!isAppwriteDatabaseConfigured()) return [];

  const queries = [Query.orderDesc('$updatedAt'), Query.limit(200)];
  if (!options.all) queries.unshift(Query.equal('technicianId', userId));

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
  const doc = await getDatabases().createDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobCardsCollectionId,
    documentId: ID.unique(),
    data: normalizeForWrite(job, userId),
    permissions: userPermissions(userId),
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
