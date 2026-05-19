import { APPWRITE } from './config.mjs';
import { PLATFORMS } from './schema.mjs';

/**
 * Registers project platforms via the Appwrite Console API.
 *
 * The Projects/Platforms endpoints are not part of the regular server SDK
 * (because they're console-scoped). We hit the REST API directly with the
 * admin API key + `X-Appwrite-Mode: admin`. This works on Appwrite Cloud
 * when the API key has the `projects.read` and `projects.write` scopes.
 *
 * If the key lacks those scopes, we print a clear console URL so the user
 * can register the platform once manually.
 */

const ADMIN_HEADERS = () => ({
  'Content-Type': 'application/json',
  'X-Appwrite-Project': APPWRITE.projectId,
  'X-Appwrite-Key': APPWRITE.apiKey,
  'X-Appwrite-Mode': 'admin',
  'X-Appwrite-Response-Format': '1.6.0',
});

async function listPlatforms() {
  const url = `${APPWRITE.endpoint}/projects/${APPWRITE.projectId}/platforms`;
  const res = await fetch(url, { method: 'GET', headers: ADMIN_HEADERS() });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`listPlatforms ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function createPlatform(platform) {
  const url = `${APPWRITE.endpoint}/projects/${APPWRITE.projectId}/platforms`;
  const body = {
    type: platform.type,
    name: platform.name,
  };
  if (platform.key) body.key = platform.key;
  if (platform.store) body.store = platform.store;
  if (platform.hostname) body.hostname = platform.hostname;

  const res = await fetch(url, {
    method: 'POST',
    headers: ADMIN_HEADERS(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`createPlatform ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function consoleUrl() {
  // Map fra.cloud.appwrite.io → cloud.appwrite.io for the console host.
  return `https://cloud.appwrite.io/console/project-${APPWRITE.projectId}/settings/platforms`;
}

function printManualInstructions(reason) {
  console.log('\n  Could not register platforms automatically.');
  if (reason) console.log(`  Reason: ${reason}`);
  console.log(`  Open: ${consoleUrl()}`);
  console.log('  Add the following platforms (Add platform → New Android/Apple app):');
  for (const p of PLATFORMS) {
    console.log(`    - ${p.type.padEnd(20)} name="${p.name}"  key=${p.key}`);
  }
}

export async function syncPlatforms() {
  console.log('\n— Platforms —');

  let existing;
  try {
    const res = await listPlatforms();
    existing = new Set((res.platforms ?? []).map((p) => `${p.type}::${p.key}`));
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      printManualInstructions(
        'API key lacks projects.read/write scope (cloud console endpoint).',
      );
      return;
    }
    printManualInstructions(err.message);
    return;
  }

  for (const platform of PLATFORMS) {
    const id = `${platform.type}::${platform.key}`;
    if (existing.has(id)) {
      console.log(`  skip ${platform.type}: ${platform.key}`);
      continue;
    }
    try {
      await createPlatform(platform);
      console.log(`  + ${platform.type}: ${platform.key}`);
    } catch (err) {
      console.log(`  ! failed to create ${platform.type}: ${platform.key} — ${err.message}`);
      printManualInstructions();
      return;
    }
  }
}
