import { ID, Query } from 'react-native-appwrite';
import { appwriteConfig, isAppwriteDatabaseConfigured } from './config';
import { getDatabases } from './client';
import { listPersonnel, syncJobRecapPermissions } from './adminUsers';
import { clientCreatePermissions } from './jobCards';
import { formatAppwriteError } from '../appwriteErrors';
import { getManagerReadersForJob } from '../orgHierarchy';
import { isSavedRecapForHistory, type JobRecap, type RecapDeliveryMode } from '../jobRecaps';
import { deleteAttachment } from './storage';

interface RecapDoc {
  $id: string;
  $createdAt: string;
  [key: string]: unknown;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableStr(value: unknown): string | null {
  return typeof value === 'string' && value.length ? value : null;
}

function docToRecap(doc: RecapDoc): JobRecap {
  return {
    id: doc.$id,
    jobId: str(doc.jobId),
    jobReference: str(doc.jobReference),
    clientName: str(doc.clientName),
    fileId: str(doc.fileId),
    fileName: str(doc.fileName),
    technicianId: nullableStr(doc.technicianId),
    technicianName: str(doc.technicianName),
    generatedById: str(doc.generatedById),
    generatedByName: str(doc.generatedByName),
    optionsJson: str(doc.optionsJson),
    summary: str(doc.summary),
    clientSignatureId: nullableStr(doc.clientSignatureId),
    clientSignatureName: str(doc.clientSignatureName),
    signedAt: nullableStr(doc.signedAt),
    emailedTo: str(doc.emailedTo),
    emailedAt: nullableStr(doc.emailedAt),
    createdBy: str(doc.createdBy),
    createdAt: doc.$createdAt,
    deliveryMode: parseDeliveryMode(doc.deliveryMode),
  };
}

function parseDeliveryMode(value: unknown): RecapDeliveryMode | null {
  if (value === 'save' || value === 'share' || value === 'email') return value;
  return null;
}

export interface CreateJobRecapInput {
  jobId: string;
  jobReference: string;
  clientName: string;
  fileId: string;
  fileName: string;
  technicianId: string | null;
  technicianName: string;
  generatedById: string;
  generatedByName: string;
  optionsJson: string;
  summary: string;
  clientSignatureId?: string | null;
  clientSignatureName?: string;
  signedAt?: string | null;
  emailedTo?: string;
  emailedAt?: string | null;
  deliveryMode: RecapDeliveryMode;
}

async function managerReadersForRecap(
  generatedById: string,
  technicianId: string | null,
): Promise<string[]> {
  try {
    const personnel = await listPersonnel();
    const members = personnel.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      labels: p.labels,
      position: p.position,
      managerId: p.managerId ?? '',
      contactPhones: p.contactPhones ?? [],
      contactEmails: p.contactEmails ?? [],
    }));
    const readers = getManagerReadersForJob(generatedById, technicianId, members);
    if (technicianId) readers.push(technicianId);
    return [...new Set(readers.filter((id) => id && id !== generatedById))];
  } catch {
    return [];
  }
}

export async function createJobRecap(input: CreateJobRecapInput): Promise<JobRecap> {
  let doc;
  try {
    doc = await getDatabases().createDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobRecapsCollectionId,
    documentId: ID.unique(),
    data: {
      jobId: input.jobId,
      jobReference: input.jobReference.slice(0, 64),
      clientName: input.clientName.slice(0, 256),
      fileId: input.fileId,
      fileName: input.fileName.slice(0, 256),
      technicianId: input.technicianId ?? '',
      technicianName: input.technicianName.slice(0, 128),
      generatedById: input.generatedById,
      generatedByName: input.generatedByName.slice(0, 128),
      optionsJson: input.optionsJson.slice(0, 4000),
      summary: input.summary.slice(0, 1000),
      clientSignatureId: input.clientSignatureId ?? '',
      clientSignatureName: (input.clientSignatureName ?? '').slice(0, 128),
      signedAt: input.signedAt ?? null,
      emailedTo: (input.emailedTo ?? '').slice(0, 512),
      emailedAt: input.emailedAt ?? null,
      createdBy: input.generatedById,
      deliveryMode: input.deliveryMode,
    },
    permissions: clientCreatePermissions(input.generatedById),
  });
  } catch (error) {
    throw new Error(formatAppwriteError(error));
  }

  const recap = docToRecap(doc as unknown as RecapDoc);
  const readerIds = await managerReadersForRecap(input.generatedById, input.technicianId);
  void syncJobRecapPermissions({
    documentId: recap.id,
    ownerId: input.generatedById,
    readerIds,
  }).catch(() => undefined);

  return recap;
}

export async function updateJobRecap(
  id: string,
  patch: Partial<Pick<JobRecap, 'emailedTo' | 'emailedAt' | 'clientSignatureId' | 'clientSignatureName' | 'signedAt'>>,
): Promise<void> {
  await getDatabases().updateDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobRecapsCollectionId,
    documentId: id,
    data: patch,
  });
}

export async function listRecapsForJob(jobId: string): Promise<JobRecap[]> {
  if (!isAppwriteDatabaseConfigured()) return [];
  const response = await getDatabases().listDocuments({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobRecapsCollectionId,
    queries: [Query.equal('jobId', jobId), Query.orderDesc('$createdAt'), Query.limit(100)],
  });
  return response.documents
    .map((doc) => docToRecap(doc as unknown as RecapDoc))
    .filter(isSavedRecapForHistory);
}

export async function deleteJobRecap(recap: Pick<JobRecap, 'id' | 'fileId'>): Promise<void> {
  await deleteAttachment(recap.fileId);
  try {
    await getDatabases().deleteDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.jobRecapsCollectionId,
      documentId: recap.id,
    });
  } catch (error) {
    throw new Error(formatAppwriteError(error));
  }
}

/** All recaps the user may read — for KPI aggregation. */
export async function listRecapsForStats(
  options: { all?: boolean; visibleUserIds?: string[] | null } = {},
): Promise<JobRecap[]> {
  if (!isAppwriteDatabaseConfigured()) return [];
  const queries = [Query.orderDesc('$createdAt'), Query.limit(1000)];
  if (!options.all && options.visibleUserIds?.length) {
    const ids = [...new Set(options.visibleUserIds)];
    queries.unshift(
      Query.or(
        ids.flatMap((id) => [
          Query.equal('technicianId', id),
          Query.equal('generatedById', id),
        ]),
      ),
    );
  }
  const response = await getDatabases().listDocuments({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobRecapsCollectionId,
    queries,
  });
  return response.documents.map((doc) => docToRecap(doc as unknown as RecapDoc));
}
