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
import { buildMockJobs, LEGACY_JOB_IDS } from './mockJobsData.mjs';
import { purgeLegacyMocks } from './purgeMocks.mjs';
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
    startedAt: null,
    finishedAt: null,
    reminderAt: null,
    technicianSignatureId: null,
    clientSignatureId: null,
    clientSignatureName: null,
    signatureVisitId: null,
    technicianSignedAt: null,
    lockedAt: null,
    lockedBy: null,
    notificationId: null,
    calendarEventId: null,
    submittedById: null,
    submittedAt: null,
    reviewedById: null,
    reviewedByName: null,
    reviewedAt: null,
    reviewNote: null,
  };

  if (job.clientType) data.clientType = job.clientType;
  if (job.companyId) data.companyId = job.companyId;
  if (job.personId) data.personId = job.personId;

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

  console.log(`Seeding ${jobs.length} demo job card → ${APPWRITE.databaseId}`);
  console.log(`Technician: ${techEmail} (${tech.$id})`);
  console.log(`Supervisor: ${supEmail} (${sup.$id})\n`);

  const purged = await purgeLegacyMocks(databases, APPWRITE.databaseId, {
    jobs: LEGACY_JOB_IDS,
  });
  if (purged) console.log(`Purged ${purged} legacy demo job(s).\n`);

  for (const job of jobs) {
    await upsertJob(databases, job, tech.$id, ownerName);
  }

  const visitDate = jobs[0]?.scheduledDate ?? '';
  console.log(`\nDone — 1 job (${jobs[0]?.reference}). Visit on ${visitDate} at 09:00.`);
  console.log('Pull to refresh in the app.');
}

main().catch((err) => {
  console.error('\nSeed jobs failed:', err.message ?? err);
  process.exit(1);
});
