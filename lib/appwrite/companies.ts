import { ID, Query } from 'react-native-appwrite';
import { primaryAddressFromEntries, parseStoredAddressEntries } from '../clientAddresses';
import {
  parseContactsBlob,
  serializeContactsBlob,
} from '../clientContactStorage';
import {
  parseStoredPhoneEntries,
  primaryEmailFromEntries,
  primaryPhoneFromEntries,
  serializePhoneEntries,
} from '../clientContact';
import {
  parseStoredWebsiteEntries,
  primaryWebsiteFromEntries,
  serializeWebsiteEntries,
} from '../clientWebsites';
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
  contactPhones?: string;
  contactEmails?: string;
  address?: string;
  industry?: string;
  website?: string;
  contactWebsites?: string;
  notes?: string;
  primaryContactId?: string;
  createdBy?: string;
}

function toCompany(doc: CompanyDoc): Company {
  const contactPhones = parseStoredPhoneEntries(doc.contactPhones, doc.phone);
  const { emails: contactEmails, addresses: contactAddresses } = parseContactsBlob(
    doc.contactEmails,
    doc.email,
    doc.address,
  );

  const contactWebsites = parseStoredWebsiteEntries(doc.contactWebsites, doc.website);

  return {
    id: doc.$id,
    name: doc.name,
    legalName: doc.legalName ?? '',
    email: doc.email ?? primaryEmailFromEntries(contactEmails),
    phone: doc.phone ?? primaryPhoneFromEntries(contactPhones),
    contactPhones,
    contactEmails,
    address: doc.address ?? primaryAddressFromEntries(contactAddresses),
    contactAddresses,
    industry: doc.industry ?? '',
    website: doc.website ?? primaryWebsiteFromEntries(contactWebsites),
    contactWebsites,
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
  const contactPhones = input.contactPhones ?? parseStoredPhoneEntries('', input.phone);
  const contactEmails = input.contactEmails ?? [];
  const contactAddresses = input.contactAddresses ?? parseStoredAddressEntries('', input.address);
  const contactWebsites = input.contactWebsites ?? parseStoredWebsiteEntries('', input.website);

  const doc = await getDatabases().createDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: ID.unique(),
    data: {
      name: input.name.trim(),
      legalName: input.legalName?.trim() ?? '',
      email: primaryEmailFromEntries(contactEmails, input.email),
      phone: primaryPhoneFromEntries(contactPhones, input.phone),
      contactPhones: serializePhoneEntries(contactPhones),
      contactEmails: serializeContactsBlob(contactEmails, contactAddresses),
      address: primaryAddressFromEntries(contactAddresses, input.address),
      industry: input.industry?.trim() ?? '',
      website: primaryWebsiteFromEntries(contactWebsites, input.website),
      contactWebsites: serializeWebsiteEntries(contactWebsites),
      notes: input.notes?.trim() ?? '',
      primaryContactId: input.primaryContactId ?? '',
      createdBy: input.createdBy ?? '',
    },
  });
  return toCompany(doc as unknown as CompanyDoc);
}

export async function updateCompany(id: string, updates: Partial<CompanyInput>): Promise<Company> {
  const data: Record<string, unknown> = { ...updates };

  if (updates.contactPhones !== undefined) {
    data.contactPhones = serializePhoneEntries(updates.contactPhones);
    data.phone = primaryPhoneFromEntries(updates.contactPhones, String(updates.phone ?? ''));
  }

  if (updates.contactEmails !== undefined || updates.contactAddresses !== undefined) {
    const emails = updates.contactEmails ?? [];
    const addresses = updates.contactAddresses ?? [];
    data.contactEmails = serializeContactsBlob(emails, addresses);
    data.email = primaryEmailFromEntries(emails, String(updates.email ?? ''));
    data.address = primaryAddressFromEntries(addresses, String(updates.address ?? ''));
  }

  if (updates.contactWebsites !== undefined) {
    data.contactWebsites = serializeWebsiteEntries(updates.contactWebsites);
    data.website = primaryWebsiteFromEntries(updates.contactWebsites, String(updates.website ?? ''));
  }

  delete data.contactAddresses;

  const doc = await getDatabases().updateDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: id,
    data,
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
