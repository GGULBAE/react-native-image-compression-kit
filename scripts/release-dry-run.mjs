#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getReadmeStatusViolations,
  validateReadmeStatus,
} from './readme-status-validator.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const PACKAGE_VERSION = JSON.parse(
  readFileSync(path.join(ROOT, 'package.json'), 'utf8')
).version;

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
    name: 'Check packed README current status',
    run: checkPackedReadmeStatus,
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

function main() {
  console.log('Release dry run only validates publish readiness. It does not publish to npm.');

  for (const step of STEPS) {
    console.log(`\n> ${step.name}`);
    if (step.run) {
      step.run();
    } else {
      run(step.command, step.args);
    }
  }

  console.log('\nRelease dry run completed.');
}

function checkPackedReadmeStatus() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'rnick-release-readme-'));

  try {
    run('pnpm', ['pack', '--pack-destination', tempDir]);
    const tarballPath = findPackedTarball(tempDir);
    const readmeContents = extractTarballFile(tarballPath, 'package/README.md');

    try {
      validatePackedReadmeStatus(readmeContents);
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }

    console.log('Packed README current status check completed.');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export function getPackedReadmeStatusViolations(
  readmeContents,
  { version = PACKAGE_VERSION } = {}
) {
  return getReadmeStatusViolations(readmeContents, {
    version,
    requireStatusBlock: true,
  });
}

export function validatePackedReadmeStatus(
  readmeContents,
  { version = PACKAGE_VERSION } = {}
) {
  try {
    validateReadmeStatus(readmeContents, {
      version,
      requireStatusBlock: true,
    });
  } catch (error) {
    const violations = getPackedReadmeStatusViolations(readmeContents, {
      version,
    });
    throw new Error(
      `Packed README current status blocks release: ${violations.join(' | ')}`,
      { cause: error }
    );
  }
}

function findPackedTarball(directory) {
  const tarballs = readdirSync(directory)
    .filter((fileName) => /^react-native-image-compression-kit-.*\.tgz$/.test(fileName))
    .sort();

  if (tarballs.length !== 1) {
    fail(`Expected exactly one packed tarball in ${directory}, found ${tarballs.length}.`);
  }

  return path.join(directory, tarballs[0]);
}

function extractTarballFile(tarballPath, filePath) {
  const result = spawnSync('tar', ['-xOf', tarballPath, filePath], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    fail(result.error.message);
  }

  if (result.status !== 0) {
    fail(result.stderr || `Could not extract ${filePath} from ${tarballPath}.`);
  }

  return result.stdout;
}

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

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main();
}
