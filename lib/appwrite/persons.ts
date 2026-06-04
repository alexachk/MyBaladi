import { ID, Query } from 'react-native-appwrite';
import { parseStoredAddressEntries, primaryAddressFromEntries } from '../clientAddresses';
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
import { appwriteConfig, isAppwriteDatabaseConfigured } from './config';
import { getDatabases } from './client';
import { deleteClientDocument } from './deleteClientDocument';
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
  contactPhones?: string;
  contactEmails?: string;
  address?: string;
  notes?: string;
  companyId?: string;
  createdBy?: string;
}

function toPerson(doc: PersonDoc): Person {
  const contactPhones = parseStoredPhoneEntries(doc.contactPhones, doc.phone);
  const { emails: contactEmails, addresses: contactAddresses } = parseContactsBlob(
    doc.contactEmails,
    doc.email,
    doc.address,
  );

  return {
    id: doc.$id,
    firstName: doc.firstName,
    lastName: doc.lastName ?? '',
    fullName: doc.fullName,
    email: doc.email ?? primaryEmailFromEntries(contactEmails),
    phone: doc.phone ?? primaryPhoneFromEntries(contactPhones),
    contactPhones,
    contactEmails,
    address: doc.address ?? primaryAddressFromEntries(contactAddresses),
    contactAddresses,
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
  const contactPhones = input.contactPhones ?? parseStoredPhoneEntries('', input.phone);
  const contactEmails = input.contactEmails ?? [];
  const contactAddresses = input.contactAddresses ?? parseStoredAddressEntries('', input.address);

  const doc = await getDatabases().createDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: ID.unique(),
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() ?? '',
      fullName: buildFullName(input.firstName, input.lastName ?? ''),
      email: primaryEmailFromEntries(contactEmails, input.email),
      phone: primaryPhoneFromEntries(contactPhones, input.phone),
      contactPhones: serializePhoneEntries(contactPhones),
      contactEmails: serializeContactsBlob(contactEmails, contactAddresses),
      address: primaryAddressFromEntries(contactAddresses, input.address),
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

  delete data.contactAddresses;

  const doc = await getDatabases().updateDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: id,
    data,
  });
  return toPerson(doc as unknown as PersonDoc);
}

export async function deletePerson(id: string): Promise<void> {
  await deleteClientDocument(COLLECTION_ID, id);
}
