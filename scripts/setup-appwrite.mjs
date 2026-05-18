import { spawnSync } from 'node:child_process';

spawnSync('node', ['--env-file=.env', 'scripts/appwrite/cli.mjs', 'sync'], {
  stdio: 'inherit',
  shell: true,
});
