#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STEPS = [
  {
    name: 'Verify package',
    command: 'pnpm',
    args: ['verify'],
  },
  {
    name: 'Typecheck example app',
    command: 'pnpm',
    args: ['example:typecheck'],
  },
  {
    name: 'Check diff whitespace',
    command: 'git',
    args: ['diff', '--check'],
  },
  {
    name: 'Inspect package tarball',
    command: 'pnpm',
    args: ['pack', '--dry-run'],
  },
  {
    name: 'Run packed consumer smoke test',
    command: 'pnpm',
    args: ['smoke:consumer'],
  },
  {
    name: 'Run publish dry run',
    command: 'pnpm',
    args: ['publish', '--dry-run', '--no-git-checks'],
  },
];

console.log('Release dry run only validates publish readiness. It does not publish to npm.');

for (const step of STEPS) {
  console.log(`\n> ${step.name}`);
  run(step.command, step.args);
}

console.log('\nRelease dry run completed.');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    fail(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
