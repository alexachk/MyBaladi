#!/usr/bin/env node
import { ID, Query, Users } from 'node-appwrite';
import { createAdminClient } from './client.mjs';

const PASSWORD = 'MyBaladi123!';

const accounts = [
  {
    email: 'level3@mybaladi.test',
    firstName: 'Test',
    lastName: 'Level 3',
    position: 'Operations Manager',
  },
  {
    email: 'level2@mybaladi.test',
    firstName: 'Test',
    lastName: 'Level 2',
    position: 'Supervisor',
    managerEmail: 'level3@mybaladi.test',
  },
  {
    email: 'level1@mybaladi.test',
    firstName: 'Test',
    lastName: 'Level 1',
    position: 'Technician',
    managerEmail: 'level2@mybaladi.test',
  },
];

async function findUserByEmail(users, email) {
  const list = await users.list([Query.equal('email', email)]);
  return list.users[0] ?? null;
}

async function main() {
  const users = new Users(createAdminClient());
  const byEmail = new Map();

  for (const spec of accounts) {
    let user = await findUserByEmail(users, spec.email);
    if (!user) {
      user = await users.create(
        ID.unique(),
        spec.email,
        undefined,
        PASSWORD,
        `${spec.firstName} ${spec.lastName}`,
      );
      console.log(`Created  ${spec.email}`);
    } else {
      console.log(`Exists  ${spec.email}`);
    }
    byEmail.set(spec.email, user);
  }

  for (const spec of accounts) {
    const user = byEmail.get(spec.email);
    const manager = spec.managerEmail ? byEmail.get(spec.managerEmail) : null;
    const managerId = manager ? manager.$id : '';

    await users.updatePrefs(user.$id, {
      ...(user.prefs ?? {}),
      firstName: spec.firstName,
      lastName: spec.lastName,
      position: spec.position,
      managerId,
      contactPhones: JSON.stringify([]),
      contactEmails: JSON.stringify([]),
    });

    console.log(`Updated  ${spec.email}  →  ${spec.position}`);
  }

  console.log(`\nPassword (all accounts): ${PASSWORD}`);
  console.log('\nLevel 3 · Operations Manager  level3@mybaladi.test');
  console.log('Level 2 · Supervisor          level2@mybaladi.test  (reports to L3)');
  console.log('Level 1 · Technician          level1@mybaladi.test  (reports to L2)');
}

main().catch((err) => {
  console.error('\nFailed:', err.message ?? err);
  process.exit(1);
});
