import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Functions, Runtime } from 'node-appwrite';
import { createAdminClient } from './client.mjs';
import { ADMIN_USERS_FUNCTION } from './schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const FUNCTION_DIR = join(ROOT, 'functions/admin-users');
const ARCHIVE = join(ROOT, '.tmp/admin-users.tar.gz');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildArchive() {
  const tmp = join(ROOT, '.tmp');
  if (!existsSync(tmp)) {
    execSync(`mkdir "${tmp}"`, { shell: true });
  }
  if (existsSync(ARCHIVE)) rmSync(ARCHIVE);

  console.log('  Installing function dependencies...');
  execSync('npm install --omit=dev', { cwd: FUNCTION_DIR, stdio: 'inherit' });

  console.log('  Packaging function...');
  const cwd = FUNCTION_DIR.replace(/\\/g, '/');
  const out = ARCHIVE.replace(/\\/g, '/');
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

export async function syncFunctions() {
  const functions = new Functions(createAdminClient());
  const { id, name, runtime, entrypoint, execute, scopes, timeout } = ADMIN_USERS_FUNCTION;

  let fn;
  try {
    fn = await functions.get(id);
    console.log(`Function "${id}" exists.`);
  } catch {
    fn = await functions.create(
      id,
      name,
      runtime,
      execute,
      [],
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

  buildArchive();
  const buffer = readFileSync(ARCHIVE);
  const file = new File([buffer], 'admin-users.tar.gz', { type: 'application/gzip' });

  console.log('  Uploading deployment...');
  const deployment = await functions.createDeployment(id, file, true, entrypoint);
  await waitForDeployment(functions, id, deployment.$id);
  await functions.updateFunctionDeployment(id, deployment.$id);

  console.log(`Function "${id}" deployed (${deployment.$id}).`);
  return fn;
}
