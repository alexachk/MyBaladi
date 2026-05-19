import { ID, Query } from 'react-native-appwrite';
import { appwriteConfig, isAppwriteDatabaseConfigured } from './config';
import { getDatabases } from './client';
import type { Company } from '../../types/client';

const COLLECTION_ID = 'companies';

interface CompanyDoc {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  name: string;
  legalName?: string;
  email?: string;
  phone?: string;
  address?: string;
  industry?: string;
  website?: string;
  notes?: string;
  primaryContactId?: string;
  createdBy?: string;
}

function toCompany(doc: CompanyDoc): Company {
  return {
    id: doc.$id,
    name: doc.name,
    legalName: doc.legalName ?? '',
    email: doc.email ?? '',
    phone: doc.phone ?? '',
    address: doc.address ?? '',
    industry: doc.industry ?? '',
    website: doc.website ?? '',
    notes: doc.notes ?? '',
    primaryContactId: doc.primaryContactId ?? '',
    createdBy: doc.createdBy ?? '',
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt,
  };
}

export async function listCompanies(): Promise<Company[]> {
  if (!isAppwriteDatabaseConfigured()) return [];
  const response = await getDatabases().listDocuments({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    queries: [Query.orderAsc('name'), Query.limit(500)],
  });
  return response.documents.map((d) => toCompany(d as unknown as CompanyDoc));
}

export type CompanyInput = Omit<Company, 'id' | 'createdAt' | 'updatedAt'>;

export async function createCompany(input: CompanyInput): Promise<Company> {
  const doc = await getDatabases().createDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: ID.unique(),
    data: {
      name: input.name.trim(),
      legalName: input.legalName?.trim() ?? '',
      email: input.email?.trim() ?? '',
      phone: input.phone?.trim() ?? '',
      address: input.address?.trim() ?? '',
      industry: input.industry?.trim() ?? '',
      website: input.website?.trim() ?? '',
      notes: input.notes?.trim() ?? '',
      primaryContactId: input.primaryContactId ?? '',
      createdBy: input.createdBy ?? '',
    },
  });
  return toCompany(doc as unknown as CompanyDoc);
}

export async function updateCompany(id: string, updates: Partial<CompanyInput>): Promise<Company> {
  const doc = await getDatabases().updateDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: id,
    data: updates as Record<string, unknown>,
  });
  return toCompany(doc as unknown as CompanyDoc);
}

export async function deleteCompany(id: string): Promise<void> {
  await getDatabases().deleteDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: id,
  });
}
