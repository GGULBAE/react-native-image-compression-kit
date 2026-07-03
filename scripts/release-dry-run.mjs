#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STALE_PACKED_README_SNIPPETS = [
  'Status: v0.2.10 candidate',
  'v0.2.10%20candidate',
  'Version `0.2.10` is an unpublished release candidate',
  'outside this candidate',
  'As of version `0.2.10` candidate',
  'The `0.2.10` package metadata is prepared as an unpublished AVIF input candidate',
  'version `0.2.10` is the unpublished iOS AVIF input capability-gated static decode candidate',
  'v0.2.10 candidate notes',
  'Status: v0.2.10 release-ready',
  'v0.2.10%20release--ready',
  'Version `0.2.10` is release-ready',
  'It has not been published to npm yet',
  'until that publish happens, the latest published npm package remains `0.2.9`',
  'The `0.2.10` package metadata is release-ready',
  'Version `0.2.10` has not been published to npm yet',
  'version `0.2.10` is the release-ready iOS AVIF input capability-gated static decode release',
  'v0.2.10 release-ready notes',
  'Status: v0.2.10 published',
  'v0.2.10%20published',
  'Version `0.2.10` is published for `react-native-image-compression-kit`',
  'The latest published npm package is `0.2.10`',
  'GitHub Release [v0.2.10]',
  'The `0.2.10` package metadata is published for `react-native-image-compression-kit`',
  'Status: v0.2.11 docs-only correction',
  'v0.2.11%20docs--only',
  'Version `0.2.11` is a docs-only npm README correction for `react-native-image-compression-kit`',
  'The `0.2.11` package metadata is published for `react-native-image-compression-kit`',
  'Status: v0.2.12 published',
  'v0.2.12%20published',
  'Version `0.2.12` is published for `react-native-image-compression-kit`',
  'The latest published npm package is `0.2.12`',
  'The `0.2.12` package metadata is published for `react-native-image-compression-kit`',
  'Status: v0.2.13 published',
  'v0.2.13%20published',
  'Version `0.2.13` is published for `react-native-image-compression-kit`',
  'The `0.2.13` package metadata is published for `react-native-image-compression-kit`',
];

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
    name: 'Check packed README status',
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

function checkPackedReadmeStatus() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'rnick-release-readme-'));

  try {
    run('pnpm', ['pack', '--pack-destination', tempDir]);
    const tarballPath = findPackedTarball(tempDir);
    const readmeContents = extractTarballFile(tarballPath, 'package/README.md');
    const staleSnippets = STALE_PACKED_README_SNIPPETS.filter((snippet) =>
      readmeContents.includes(snippet)
    );

    if (staleSnippets.length > 0) {
      fail(
        `Packed README contains stale package-page status snippets: ${staleSnippets.join(
          ' | '
        )}`
      );
    }

    console.log('Packed README candidate status check completed.');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
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
