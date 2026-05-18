import { ID, Permission, Query, Role } from 'react-native-appwrite';
import { appwriteConfig } from './config';
import { getAccount, getDatabases } from './client';
import { isAppwriteConfigured, isAppwriteDatabaseConfigured } from './config';
import { JobCard, JobPriority, JobStatus } from '../../types/jobCard';

interface JobCardDocument extends Record<string, unknown> {
  reference: string;
  clientName: string;
  siteAddress: string;
  contactName: string;
  contactPhone: string;
  missionType: string;
  equipment: string;
  technicianName: string;
  technicianId: string;
  scheduledDate: string;
  arrivalTime: string;
  departureTime: string;
  workPerformed: string;
  partsUsed: string;
  notes: string;
  status: JobStatus;
  priority: JobPriority;
}

function documentToJobCard(doc: { $id: string; $createdAt: string; $updatedAt: string } & JobCardDocument): JobCard {
  return {
    id: doc.$id,
    reference: doc.reference,
    clientName: doc.clientName,
    siteAddress: doc.siteAddress ?? '',
    contactName: doc.contactName ?? '',
    contactPhone: doc.contactPhone ?? '',
    missionType: doc.missionType ?? '',
    equipment: doc.equipment ?? '',
    technicianName: doc.technicianName,
    scheduledDate: doc.scheduledDate ?? '',
    arrivalTime: doc.arrivalTime ?? '',
    departureTime: doc.departureTime ?? '',
    workPerformed: doc.workPerformed ?? '',
    partsUsed: doc.partsUsed ?? '',
    notes: doc.notes ?? '',
    status: doc.status,
    priority: doc.priority,
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt,
  };
}

function jobCardToDocument(
  job: Omit<JobCard, 'id' | 'createdAt' | 'updatedAt'>,
  technicianId: string,
): JobCardDocument {
  return {
    reference: job.reference,
    clientName: job.clientName,
    siteAddress: job.siteAddress,
    contactName: job.contactName,
    contactPhone: job.contactPhone,
    missionType: job.missionType,
    equipment: job.equipment,
    technicianName: job.technicianName,
    technicianId,
    scheduledDate: job.scheduledDate,
    arrivalTime: job.arrivalTime,
    departureTime: job.departureTime,
    workPerformed: job.workPerformed,
    partsUsed: job.partsUsed,
    notes: job.notes,
    status: job.status,
    priority: job.priority,
  };
}

function userPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

export async function fetchJobCardsFromAppwrite(userId: string): Promise<JobCard[]> {
  if (!isAppwriteDatabaseConfigured()) return [];

  const databases = getDatabases();
  const response = await databases.listDocuments({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobCardsCollectionId,
    queries: [
      Query.equal('technicianId', userId),
      Query.orderDesc('$updatedAt'),
      Query.limit(100),
    ],
  });

  return response.documents.map((doc) =>
    documentToJobCard(doc as typeof doc & JobCardDocument),
  );
}

export async function createJobCardInAppwrite(
  job: Omit<JobCard, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string,
): Promise<JobCard> {
  const databases = getDatabases();
  const doc = await databases.createDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobCardsCollectionId,
    documentId: ID.unique(),
    data: jobCardToDocument(job, userId),
    permissions: userPermissions(userId),
  });

  return documentToJobCard(doc as typeof doc & JobCardDocument);
}

export async function updateJobCardInAppwrite(
  id: string,
  updates: Partial<JobCard>,
): Promise<void> {
  const databases = getDatabases();
  const { id: _id, createdAt, updatedAt, ...data } = updates;
  await databases.updateDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobCardsCollectionId,
    documentId: id,
    data,
  });
}

export async function deleteJobCardFromAppwrite(id: string): Promise<void> {
  const databases = getDatabases();
  await databases.deleteDocument({
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
