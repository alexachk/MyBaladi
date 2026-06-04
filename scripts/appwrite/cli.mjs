#!/usr/bin/env node
/**
 * Appwrite admin CLI — all backend schema/config changes go through here.
 *
 *   npm run appwrite:sync                 Apply schema to Appwrite (idempotent)
 *   npm run appwrite:status               Check remote schema vs local definition
 *   npm run appwrite:set-admin <email>    Grant the 'admin' label to a user
 *   npm run appwrite:unset-admin <email>  Remove the 'admin' label from a user
 *   npm run appwrite:list-admins          Show every user that has the admin label
 *   npm run appwrite:set-app-dev <email>  Grant the 'app-dev' label + App Dev role
 *   npm run appwrite:unset-app-dev <email> Remove the 'app-dev' label
 *   npm run appwrite:list-app-devs        Show every user with the app-dev label
 */

import { Databases, Query, Storage, Users } from 'node-appwrite';
import { createAdminClient } from './client.mjs';
import { APPWRITE } from './config.mjs';
import { syncFunctions } from './sync-functions.mjs';
import { syncPlatforms } from './sync-platforms.mjs';
import { getSchemaStatus, syncSchema, syncStorage } from './sync-schema.mjs';

const ADMIN_LABEL = 'admin';
const APP_DEV_LABEL = 'appdev';
const command = process.argv[2] ?? 'sync';
const arg = process.argv[3];

async function runStatus() {
  const databases = new Databases(createAdminClient());
  const summary = await getSchemaStatus(databases);

  console.log(`\nAppwrite status — ${APPWRITE.projectId}`);
  console.log(`Database:   ${APPWRITE.databaseId}\n`);

  let allOk = true;
  for (const row of summary) {
    const status = row.present ? 'OK' : 'MISSING';
    console.log(`  ${row.id.padEnd(16)} ${status.padEnd(8)} attrs=${row.expected - row.missing.length}/${row.expected}  indexes=${row.indexes.length}`);
    if (!row.present || row.missing.length) {
      allOk = false;
      if (row.missing.length) console.log(`    missing: ${row.missing.join(', ')}`);
    }
  }

  console.log(allOk ? '\nSchema is in sync.' : '\nRun: npm run appwrite:sync');
}

async function runSync() {
  const databases = new Databases(createAdminClient());
  const storage = new Storage(createAdminClient());
  await syncSchema(databases);
  await syncStorage(storage);
  await syncPlatforms();

  console.log('\nFunctions:');
  await syncFunctions();
}

async function findUserByEmail(users, email) {
  const list = await users.list([Query.equal('email', email)]);
  if (!list.users.length) {
    throw new Error(`No user found with email: ${email}`);
  }
  return list.users[0];
}

async function runSetAdmin() {
  if (!arg) {
    console.error('Usage: appwrite:set-admin <email>');
    process.exit(1);
  }
  const users = new Users(createAdminClient());
  const user = await findUserByEmail(users, arg);
  const next = Array.from(new Set([...(user.labels ?? []), ADMIN_LABEL]));
  await users.updateLabels(user.$id, next);
  console.log(`\nGranted admin to ${user.email} (${user.$id})`);
  console.log(`Labels: ${next.join(', ')}`);
}

async function runUnsetAdmin() {
  if (!arg) {
    console.error('Usage: appwrite:unset-admin <email>');
    process.exit(1);
  }
  const users = new Users(createAdminClient());
  const user = await findUserByEmail(users, arg);
  const next = (user.labels ?? []).filter((l) => l !== ADMIN_LABEL);
  await users.updateLabels(user.$id, next);
  console.log(`\nRevoked admin from ${user.email} (${user.$id})`);
  console.log(`Labels: ${next.length ? next.join(', ') : '(none)'}`);
}

async function runListAdmins() {
  const users = new Users(createAdminClient());
  const list = await users.list();
  const admins = list.users.filter((u) => (u.labels ?? []).includes(ADMIN_LABEL));
  if (!admins.length) {
    console.log('\nNo admins yet. Grant one with: npm run appwrite:set-admin <email>');
    return;
  }
  console.log(`\nAdministrators (${admins.length}):`);
  for (const u of admins) console.log(`  ${u.email}  ${u.name ? `· ${u.name}` : ''}  [${u.$id}]`);
}

async function runSetAppDev() {
  if (!arg) {
    console.error('Usage: appwrite:set-app-dev <email>');
    process.exit(1);
  }
  const users = new Users(createAdminClient());
  const user = await findUserByEmail(users, arg);
  const next = Array.from(new Set([...(user.labels ?? []), APP_DEV_LABEL]));
  await users.updateLabels(user.$id, next);
  const prefs = { ...(user.prefs ?? {}), position: 'App Dev' };
  await users.updatePrefs(user.$id, prefs);
  console.log(`\nGranted App Dev to ${user.email} (${user.$id})`);
  console.log(`Labels: ${next.join(', ')}`);
  console.log(`Position: ${prefs.position}`);
}

async function runUnsetAppDev() {
  if (!arg) {
    console.error('Usage: appwrite:unset-app-dev <email>');
    process.exit(1);
  }
  const users = new Users(createAdminClient());
  const user = await findUserByEmail(users, arg);
  const next = (user.labels ?? []).filter((l) => l !== APP_DEV_LABEL);
  await users.updateLabels(user.$id, next);
  console.log(`\nRevoked App Dev from ${user.email} (${user.$id})`);
  console.log(`Labels: ${next.length ? next.join(', ') : '(none)'}`);
}

async function runListAppDevs() {
  const users = new Users(createAdminClient());
  const list = await users.list();
  const devs = list.users.filter((u) => (u.labels ?? []).includes(APP_DEV_LABEL));
  if (!devs.length) {
    console.log('\nNo App Dev users yet. Grant one with: npm run appwrite:set-app-dev <email>');
    return;
  }
  console.log(`\nApp Dev (${devs.length}):`);
  for (const u of devs) {
    const position = u.prefs?.position ?? '';
    console.log(`  ${u.email}  ${u.name ? `· ${u.name}` : ''}  ${position ? `· ${position}` : ''}  [${u.$id}]`);
  }
}

async function runSyncFunctions() {
  console.log('\nFunctions:');
  await syncFunctions();
}

const handlers = {
  sync: runSync,
  'sync-functions': runSyncFunctions,
  status: runStatus,
  'set-admin': runSetAdmin,
  'unset-admin': runUnsetAdmin,
  'list-admins': runListAdmins,
  'set-app-dev': runSetAppDev,
  'unset-app-dev': runUnsetAppDev,
  'list-app-devs': runListAppDevs,
};

async function main() {
  const handler = handlers[command];
  if (!handler) {
    console.error(
      `Unknown command: ${command}\nUsage: sync | status | set-admin <email> | unset-admin <email> | list-admins | set-app-dev <email> | unset-app-dev <email> | list-app-devs`,
    );
    process.exit(1);
  }
  await handler();
}

main().catch((err) => {
  console.error('\nAppwrite CLI failed:', err.message ?? err);
  process.exit(1);
});
