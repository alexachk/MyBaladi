#!/usr/bin/env node
/**
 * Appwrite admin CLI — all backend schema/config changes go through here.
 *
 *   npm run appwrite:sync    Apply schema to Appwrite (idempotent)
 *   npm run appwrite:status  Check remote schema vs local definition
 */

import { Databases } from 'node-appwrite';
import { createAdminClient } from './client.mjs';
import { APPWRITE } from './config.mjs';
import { getSchemaStatus, syncSchema } from './sync-schema.mjs';

const command = process.argv[2] ?? 'sync';

async function runStatus() {
  const databases = new Databases(createAdminClient());
  const { collection, missing, indexes, expected } = await getSchemaStatus(databases);

  console.log(`\nAppwrite status — ${APPWRITE.projectId}`);
  console.log(`Database:   ${APPWRITE.databaseId}`);
  console.log(`Collection: ${collection.$id} (${collection.name})`);
  console.log(`Attributes: ${expected.length - missing.length}/${expected.length}`);
  console.log(`Indexes:    ${indexes.length}/${expected.length}`);

  if (missing.length) {
    console.log('\nMissing attributes:', missing.join(', '));
    console.log('Run: npm run appwrite:sync');
  } else {
    console.log('\nSchema is in sync.');
  }
}

async function runSync() {
  const databases = new Databases(createAdminClient());
  const collection = await syncSchema(databases);
  console.log(`\nDone — ${collection.attributes?.length ?? 0} attributes, ${collection.indexes?.length ?? 0} indexes.`);
}

const handlers = {
  sync: runSync,
  status: runStatus,
};

async function main() {
  const handler = handlers[command];
  if (!handler) {
    console.error(`Unknown command: ${command}\nUsage: appwrite:sync | appwrite:status`);
    process.exit(1);
  }
  await handler();
}

main().catch((err) => {
  console.error('\nAppwrite CLI failed:', err.message ?? err);
  process.exit(1);
});
