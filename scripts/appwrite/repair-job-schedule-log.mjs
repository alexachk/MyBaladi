#!/usr/bin/env node
/**
 * Backfill missing scheduleLog rows from visit on-site fields.
 *
 *   node --env-file=.env scripts/appwrite/repair-job-schedule-log.mjs
 *   node --env-file=.env scripts/appwrite/repair-job-schedule-log.mjs mock-job-tomorrow
 */
import { Databases } from 'node-appwrite';
import { createAdminClient } from './client.mjs';
import { APPWRITE } from './config.mjs';
import { serializeAssigneesForWrite } from './seedJobSerialization.mjs';

const COLLECTION = 'job_cards';
const DEFAULT_JOB_ID = 'mock-job-tomorrow';

function visitStatus(visit) {
  return visit.status ?? 'scheduled';
}

function reconcileVisitScheduleLog(visits, log = []) {
  const next = [...log];
  const hasEntry = (visitId, action) =>
    next.some((entry) => entry.visitId === visitId && entry.action === action);

  for (const visit of visits) {
    const status = visitStatus(visit);
    const stamp = visit.completedAt ?? new Date().toISOString();

    if (
      (status === 'in_progress' || visit.arrivalTime) &&
      visit.arrivalTime &&
      !hasEntry(visit.id, 'launched')
    ) {
      next.push({
        at: stamp,
        userId: 'system',
        userName: 'System',
        fromDate: visit.date,
        fromTime: visit.time ?? null,
        toDate: visit.date,
        toTime: visit.time ?? null,
        action: 'launched',
        visitId: visit.id,
        arrivalTime: visit.arrivalTime,
        plannedDurationMinutes: visit.durationMinutes,
      });
    }

    if (status === 'done' && !hasEntry(visit.id, 'done')) {
      next.push({
        at: stamp,
        userId: 'system',
        userName: 'System',
        fromDate: visit.date,
        fromTime: visit.time ?? null,
        toDate: visit.date,
        toTime: visit.time ?? null,
        action: 'done',
        visitId: visit.id,
        arrivalTime: visit.arrivalTime,
        departureTime: visit.departureTime,
        plannedDurationMinutes: visit.durationMinutes,
      });
    }
  }

  return next;
}

async function main() {
  const jobId = process.argv[2]?.trim() || DEFAULT_JOB_ID;
  const databases = new Databases(createAdminClient());
  const doc = await databases.getDocument(APPWRITE.databaseId, COLLECTION, jobId);

  let blob;
  try {
    blob = JSON.parse(doc.assignees || '[]');
  } catch {
    throw new Error(`Job ${jobId}: assignees blob is not JSON.`);
  }

  if (!blob.schedule?.visits?.length) {
    console.log(`Job ${jobId}: no visits in schedule blob — nothing to repair.`);
    return;
  }

  const before = blob.schedule.log?.length ?? 0;
  const reconciled = reconcileVisitScheduleLog(blob.schedule.visits, blob.schedule.log ?? []);
  const after = reconciled.length;

  if (after === before) {
    console.log(`Job ${jobId}: schedule log already complete (${before} entries).`);
    return;
  }

  blob.schedule.log = reconciled;
  const assignees = serializeAssigneesForWrite(blob);

  await databases.updateDocument(APPWRITE.databaseId, COLLECTION, jobId, { assignees });
  console.log(`Repaired ${jobId}: schedule log ${before} → ${after} entries.`);
  console.log(JSON.stringify(reconciled, null, 2));
}

main().catch((err) => {
  console.error('\nRepair failed:', err.message ?? err);
  process.exit(1);
});
