import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Functions } from 'node-appwrite';
import { APPWRITE } from './config.mjs';
import { createAdminClient } from './client.mjs';
import { APPWRITE_FUNCTIONS } from './schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildArchive(functionDir, archivePath) {
  const tmp = join(ROOT, '.tmp');
  if (!existsSync(tmp)) {
    execSync(`mkdir "${tmp}"`, { shell: true });
  }
  if (existsSync(archivePath)) rmSync(archivePath);

  console.log(`  Installing dependencies in ${functionDir}...`);
  execSync('npm install --omit=dev', { cwd: functionDir, stdio: 'inherit' });

  console.log('  Packaging function...');
  const cwd = functionDir.replace(/\\/g, '/');
  const out = archivePath.replace(/\\/g, '/');
  execSync(`tar -czf "${out}" -C "${cwd}" .`, { shell: true });
}

async function waitForDeployment(functions, functionId, deploymentId) {
  for (let i = 0; i < 90; i++) {
    const deployment = await functions.getDeployment(functionId, deploymentId);
    if (deployment.status === 'ready') return deployment;
    if (deployment.status === 'failed') {
      throw new Error(deployment.buildLogs || 'Function deployment failed.');
    }
    console.log(`  Building deployment (${deployment.status})...`);
    await sleep(3000);
  }
  throw new Error('Timed out waiting for function deployment.');
}

async function deployFunction(functions, def) {
  const { id, name, runtime, entrypoint, execute, scopes, timeout, events } = def;
  const functionDir = join(ROOT, 'functions', id.replace(/_/g, '-'));
  const archivePath = join(ROOT, '.tmp', `${id}.tar.gz`);
  const eventList = typeof events === 'function' ? events(APPWRITE.databaseId) : (events ?? []);

  let fn;
  try {
    fn = await functions.get(id);
    console.log(`Function "${id}" exists.`);
    await functions.update(
      id,
      name,
      runtime,
      execute,
      eventList,
      '',
      timeout,
      true,
      true,
      entrypoint,
      '',
      scopes,
    );
  } catch {
    fn = await functions.create(
      id,
      name,
      runtime,
      execute,
      eventList,
      '',
      timeout,
      true,
      true,
      entrypoint,
      '',
      scopes,
    );
    console.log(`Created function "${id}".`);
  }

  buildArchive(functionDir, archivePath);
  const buffer = readFileSync(archivePath);
  const file = new File([buffer], `${id}.tar.gz`, { type: 'application/gzip' });

  console.log(`  Uploading deployment for "${id}"...`);
  const deployment = await functions.createDeployment(id, file, true, entrypoint);
  await waitForDeployment(functions, id, deployment.$id);
  await functions.updateFunctionDeployment(id, deployment.$id);

  console.log(`Function "${id}" deployed (${deployment.$id}).`);
  return fn;
}

export async function syncFunctions() {
  const functions = new Functions(createAdminClient());
  let last = null;
  for (const def of APPWRITE_FUNCTIONS) {
    console.log(`\nSyncing function "${def.id}"...`);
    last = await deployFunction(functions, def);
  }
  return last;
}
