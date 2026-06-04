#!/usr/bin/env node
/**
 * Seed demo job cards (uses mock client IDs from seed-clients).
 *
 *   npm run appwrite:seed-clients   # first
 *   npm run appwrite:seed-jobs
 *
 * Optional .env:
 *   APPWRITE_SEED_EMAIL=level1@mybaladi.test   — owner / technician (default)
 *   APPWRITE_SEED_SUPERVISOR_EMAIL=level2@mybaladi.test
 */
import { Databases, Permission, Query, Role, Users } from 'node-appwrite';
import { createAdminClient } from './client.mjs';
import { APPWRITE } from './config.mjs';
import { buildMockJobs } from './mockJobsData.mjs';
import { serializeAssigneesForWrite, serializeWorkReport } from './seedJobSerialization.mjs';

const COLLECTION = 'job_cards';
const DEFAULT_TECH_EMAIL = 'level1@mybaladi.test';
const DEFAULT_SUP_EMAIL = 'level2@mybaladi.test';

async function findUserByEmail(users, email) {
  const list = await users.list([Query.equal('email', email)]);
  return list.users[0] ?? null;
}

function jobPermissions(ownerId) {
  return [
    Permission.read(Role.user(ownerId)),
    Permission.update(Role.user(ownerId)),
    Permission.delete(Role.user(ownerId)),
    Permission.read(Role.users()),
    Permission.read(Role.label('admin')),
    Permission.update(Role.label('admin')),
    Permission.delete(Role.label('admin')),
  ];
}

function jobDocument(job, ownerId, ownerName) {
  const { workPerformed, partsUsed } = serializeWorkReport(job.workReport ?? {});
  const assignees = serializeAssigneesForWrite({
    team: job.people?.team ?? [{ userId: ownerId, name: ownerName, role: 'Lead' }],
    contacts: job.people?.contacts ?? [],
    missions: job.people?.missions ?? [],
    equipment: job.people?.equipment ?? [],
    missionScopes: job.people?.missionScopes ?? [],
    missionNotes: job.people?.missionNotes ?? [],
    schedule: job.people?.schedule,
  });

  const primaryAssignee = job.people?.team?.[0];

  const data = {
    reference: job.reference,
    clientName: job.clientName,
    siteAddress: job.siteAddress ?? '',
    contactName: job.contactName ?? '',
    contactPhone: job.contactPhone ?? '',
    missionType: job.missionType ?? '',
    equipment: (job.people?.equipment ?? []).join(' · ').slice(0, 256),
    technicianName: ownerName,
    technicianId: ownerId,
    assigneeId: primaryAssignee?.userId ?? ownerId,
    assigneeName: primaryAssignee?.name ?? ownerName,
    assignees,
    scheduledDate: job.scheduledDate ?? '',
    scheduledTime: job.scheduledTime ?? '',
    arrivalTime: '',
    departureTime: '',
    workPerformed,
    partsUsed,
    notes: job.notes ?? '',
    status: job.status,
    priority: job.priority,
    reviewStatus: job.reviewStatus ?? 'none',
    reviewBypassed: false,
    photoIds: [],
    documentIds: [],
  };

  if (job.clientType) data.clientType = job.clientType;
  if (job.companyId) data.companyId = job.companyId;
  if (job.personId) data.personId = job.personId;
  if (job.startedAt) data.startedAt = job.startedAt;
  if (job.finishedAt) data.finishedAt = job.finishedAt;
  if (job.submittedById) data.submittedById = job.submittedById;
  if (job.submittedAt) data.submittedAt = job.submittedAt;
  if (job.reviewedById) data.reviewedById = job.reviewedById;
  if (job.reviewedByName) data.reviewedByName = job.reviewedByName;
  if (job.reviewedAt) data.reviewedAt = job.reviewedAt;
  if (job.reviewNote) data.reviewNote = job.reviewNote;
  if (job.clientSignatureName) data.clientSignatureName = job.clientSignatureName;
  if (job.lockedAt) data.lockedAt = job.lockedAt;
  if (job.lockedBy) data.lockedBy = job.lockedBy;

  return data;
}

async function upsertJob(databases, job, ownerId, ownerName) {
  const data = jobDocument(job, ownerId, ownerName);
  const permissions = jobPermissions(ownerId);

  try {
    await databases.getDocument(APPWRITE.databaseId, COLLECTION, job.id);
    await databases.updateDocument(APPWRITE.databaseId, COLLECTION, job.id, data);
    console.log(`Updated  ${COLLECTION}/${job.id}  ${job.reference}  [${job.status}]`);
  } catch (err) {
    if (err.code === 404) {
      await databases.createDocument(
        APPWRITE.databaseId,
        COLLECTION,
        job.id,
        data,
        permissions,
      );
      console.log(`Created  ${COLLECTION}/${job.id}  ${job.reference}  [${job.status}]`);
      return;
    }
    throw err;
  }
}

async function main() {
  const techEmail = process.env.APPWRITE_SEED_EMAIL?.trim() || DEFAULT_TECH_EMAIL;
  const supEmail = process.env.APPWRITE_SEED_SUPERVISOR_EMAIL?.trim() || DEFAULT_SUP_EMAIL;

  const client = createAdminClient();
  const users = new Users(client);
  const databases = new Databases(client);

  const tech = await findUserByEmail(users, techEmail);
  if (!tech) {
    throw new Error(
      `No Appwrite user for ${techEmail}. Run: npm run appwrite:create-test-accounts`,
    );
  }
  const sup = (await findUserByEmail(users, supEmail)) ?? tech;
  const ownerName = tech.name?.trim() || 'Demo Technician';
  const supName = sup.name?.trim() || 'Demo Supervisor';

  const jobs = buildMockJobs({
    ownerId: tech.$id,
    ownerName,
    supervisorId: sup.$id,
    supervisorName: supName,
  });

  console.log(`Seeding ${jobs.length} demo job cards → ${APPWRITE.databaseId}`);
  console.log(`Technician: ${techEmail} (${tech.$id})`);
  console.log(`Supervisor: ${supEmail} (${sup.$id})\n`);

  for (const job of jobs) {
    await upsertJob(databases, job, tech.$id, ownerName);
  }

  console.log(`\nDone — ${jobs.length} jobs. Pull to refresh in the app.`);
  console.log('References: JC-20990101-001 … 007 (demo series).');
}

main().catch((err) => {
  console.error('\nSeed jobs failed:', err.message ?? err);
  process.exit(1);
});
