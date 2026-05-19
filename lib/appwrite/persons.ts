import { ID, Query } from 'react-native-appwrite';
import { appwriteConfig, isAppwriteDatabaseConfigured } from './config';
import { getDatabases } from './client';
import { buildFullName, type Person } from '../../types/client';

const COLLECTION_ID = 'persons';

interface PersonDoc {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  firstName: string;
  lastName?: string;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  companyId?: string;
  createdBy?: string;
}

function toPerson(doc: PersonDoc): Person {
  return {
    id: doc.$id,
    firstName: doc.firstName,
    lastName: doc.lastName ?? '',
    fullName: doc.fullName,
    email: doc.email ?? '',
    phone: doc.phone ?? '',
    address: doc.address ?? '',
    notes: doc.notes ?? '',
    companyId: doc.companyId ?? '',
    createdBy: doc.createdBy ?? '',
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt,
  };
}

export async function listPersons(): Promise<Person[]> {
  if (!isAppwriteDatabaseConfigured()) return [];
  const response = await getDatabases().listDocuments({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    queries: [Query.orderAsc('fullName'), Query.limit(500)],
  });
  return response.documents.map((d) => toPerson(d as unknown as PersonDoc));
}

export type PersonInput = Omit<Person, 'id' | 'fullName' | 'createdAt' | 'updatedAt'>;

export async function createPerson(input: PersonInput): Promise<Person> {
  const doc = await getDatabases().createDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: ID.unique(),
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() ?? '',
      fullName: buildFullName(input.firstName, input.lastName ?? ''),
      email: input.email?.trim() ?? '',
      phone: input.phone?.trim() ?? '',
      address: input.address?.trim() ?? '',
      notes: input.notes?.trim() ?? '',
      companyId: input.companyId ?? '',
      createdBy: input.createdBy ?? '',
    },
  });
  return toPerson(doc as unknown as PersonDoc);
}

export async function updatePerson(id: string, updates: Partial<PersonInput>): Promise<Person> {
  const data: Record<string, unknown> = { ...updates };
  if (updates.firstName !== undefined || updates.lastName !== undefined) {
    data.fullName = buildFullName(updates.firstName ?? '', updates.lastName ?? '');
  }
  const doc = await getDatabases().updateDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: id,
    data,
  });
  return toPerson(doc as unknown as PersonDoc);
}

export async function deletePerson(id: string): Promise<void> {
  await getDatabases().deleteDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: id,
  });
}
