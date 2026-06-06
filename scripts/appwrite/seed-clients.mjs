#!/usr/bin/env node
import { Databases } from 'node-appwrite';
import { createAdminClient } from './client.mjs';
import { APPWRITE } from './config.mjs';
import {
  LEGACY_COMPANY_IDS,
  LEGACY_PERSON_IDS,
  MOCK_COMPANIES,
  MOCK_PERSONS,
} from './mockClientsData.mjs';
import { purgeLegacyMocks } from './purgeMocks.mjs';

const COMPANIES = 'companies';
const PERSONS = 'persons';
const CREATED_BY = 'seed';

function buildFullName(firstName, lastName) {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ') || firstName?.trim() || '';
}

function serializePhones(phones) {
  return JSON.stringify(phones ?? []);
}

function serializeContactsBlob(emails, addresses) {
  return JSON.stringify({ v: 2, emails: emails ?? [], addresses: addresses ?? [] });
}

function serializeWebsites(websites) {
  return JSON.stringify(websites ?? []);
}

function primaryAddress(addresses, fallback = '') {
  return addresses?.[0]?.text?.trim() || fallback;
}

function primaryWebsite(websites, fallback = '') {
  return websites?.[0]?.url?.trim() || fallback;
}

async function upsertDocument(databases, collectionId, documentId, data) {
  try {
    await databases.getDocument(APPWRITE.databaseId, collectionId, documentId);
    await databases.updateDocument(APPWRITE.databaseId, collectionId, documentId, data);
    console.log(`Updated  ${collectionId}/${documentId}`);
  } catch (err) {
    if (err.code === 404) {
      await databases.createDocument(APPWRITE.databaseId, collectionId, documentId, data);
      console.log(`Created  ${collectionId}/${documentId}`);
      return;
    }
    throw err;
  }
}

function companyPayload(company) {
  return {
    name: company.name,
    legalName: company.legalName ?? '',
    email: company.email ?? '',
    phone: company.phone ?? '',
    contactPhones: serializePhones(company.contactPhones),
    contactEmails: serializeContactsBlob(company.contactEmails, company.contactAddresses),
    address: primaryAddress(company.contactAddresses, company.address ?? ''),
    industry: company.industry ?? '',
    website: primaryWebsite(company.contactWebsites, company.website ?? ''),
    contactWebsites: serializeWebsites(company.contactWebsites),
    notes: company.notes ?? '',
    primaryContactId: company.primaryContactId ?? '',
    createdBy: CREATED_BY,
  };
}

function personPayload(person) {
  return {
    firstName: person.firstName,
    lastName: person.lastName ?? '',
    fullName: buildFullName(person.firstName, person.lastName),
    email: person.email ?? '',
    phone: person.phone ?? '',
    contactPhones: serializePhones(person.contactPhones),
    contactEmails: serializeContactsBlob(person.contactEmails, person.contactAddresses),
    address: primaryAddress(person.contactAddresses, person.address ?? ''),
    notes: person.notes ?? '',
    companyId: person.companyId ?? '',
    createdBy: CREATED_BY,
  };
}

async function main() {
  const databases = new Databases(createAdminClient());

  console.log(`Seeding sample clients → database ${APPWRITE.databaseId}\n`);

  const purged = await purgeLegacyMocks(databases, APPWRITE.databaseId, {
    companies: LEGACY_COMPANY_IDS,
    persons: LEGACY_PERSON_IDS,
  });
  if (purged) console.log(`Purged ${purged} legacy demo client(s).\n`);

  for (const company of MOCK_COMPANIES) {
    await upsertDocument(databases, COMPANIES, company.id, companyPayload(company));
  }

  for (const person of MOCK_PERSONS) {
    await upsertDocument(databases, PERSONS, person.id, personPayload(person));
  }

  console.log(`\nDone — ${MOCK_COMPANIES.length} companies, ${MOCK_PERSONS.length} persons.`);
  console.log('Pull to refresh in the app to load them.');
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message ?? err);
  process.exit(1);
});
