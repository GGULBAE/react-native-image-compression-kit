#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getReadmeStatusViolations,
  validateReadmeStatus,
} from './readme-status-validator.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

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
  'Status: v0.2.14 candidate',
  'v0.2.14%20candidate',
  'Version `0.2.14` is an unpublished release candidate for `react-native-image-compression-kit`',
  'latest published npm package is `0.2.13`',
  'The `0.2.14` package metadata is prepared as an unpublished AVIF output capability/error surface candidate',
  'version `0.2.14` is the unpublished AVIF output capability/error surface candidate',
  'v0.2.14 AVIF output capability/error surface candidate notes',
  'Status: v0.2.14 published',
  'v0.2.14%20published',
  'Version `0.2.14` is published for `react-native-image-compression-kit`',
  'The `0.2.14` package metadata is published for `react-native-image-compression-kit`',
  'Status: v0.2.15 published',
  'v0.2.15%20published',
  'Version `0.2.15` is published for `react-native-image-compression-kit`',
  'The `0.2.15` package metadata is published for `react-native-image-compression-kit`',
  'Status: v0.2.15 candidate',
  'v0.2.15%20candidate',
  'Version `0.2.15` is an unpublished release candidate for `react-native-image-compression-kit`',
  'It documents the AVIF output feasibility spike and keeps runtime AVIF output unsupported until platform-specific encoder paths can be validated.',
  'The `0.2.15` package metadata is prepared as an unpublished AVIF output feasibility candidate for `react-native-image-compression-kit`',
  'Status: v0.2.16 candidate',
  'v0.2.16%20candidate',
  'Version `0.2.16` is an unpublished release candidate for `react-native-image-compression-kit`',
  'It adds an internal Android AVIF output encoder route prototype and keeps runtime AVIF output unsupported until byte-signature, decode-back, metadata, and target-size behavior are validated.',
  'The `0.2.16` package metadata is prepared as an unpublished Android AVIF output encoder route prototype candidate for `react-native-image-compression-kit`',
  'Status: v0.2.16 published',
  'v0.2.16%20published',
  'Version `0.2.16` is published for `react-native-image-compression-kit`',
  'The `0.2.16` package metadata is published for `react-native-image-compression-kit`',
  'Status: v0.2.17 candidate',
  'v0.2.17%20candidate',
  'Version `0.2.17` is an unpublished release candidate for `react-native-image-compression-kit`',
  'latest published npm package is `0.2.14`',
  'GitHub Release [v0.2.14]',
  'The `0.2.17` package metadata is prepared as an unpublished Android AVIF output encode/decode-back smoke candidate for `react-native-image-compression-kit`',
  'version `0.2.17` is the unpublished Android AVIF output encode/decode-back smoke candidate',
  'v0.2.17 Android AVIF output encode/decode-back smoke candidate notes',
  'Status: v0.2.18 candidate',
  'v0.2.18%20candidate',
  'Version `0.2.18` is an unpublished docs-only npm README correction candidate for `react-native-image-compression-kit`',
  'The latest published npm package is `0.2.17`',
  'npm `latest` remains `0.2.17`',
  'The `0.2.18` package metadata is prepared as an unpublished docs-only npm README correction candidate for `react-native-image-compression-kit`',
  'version `0.2.18` is the unpublished docs-only npm package-page README correction candidate',
  'v0.2.18 docs-only npm README correction candidate notes',
  'Status: v0.2.18 published',
  'v0.2.18%20published',
  'Version `0.2.18` is published as a docs-only npm README correction for `react-native-image-compression-kit`',
  'The `0.2.18` package metadata is published as a docs-only npm README correction for `react-native-image-compression-kit`',
  'v0.2.18 published docs-only npm README correction release notes',
  'Status: v0.2.19 candidate',
  'v0.2.19%20candidate',
  'Version `0.2.19` is an unpublished AVIF output production gate candidate for `react-native-image-compression-kit`',
  'npm `latest` remains `0.2.18`',
  'Version `0.2.18` remains the latest published npm package and docs-only package-page README correction.',
  'No npm publish, git tag, or GitHub Release is part of the v0.2.19 candidate.',
  'The `0.2.19` package metadata is prepared as an unpublished AVIF output production gate candidate for `react-native-image-compression-kit`',
  'version `0.2.19` is the unpublished AVIF output production gate candidate',
  'v0.2.19 AVIF output production gate candidate notes',
  'Status: v0.2.47 candidate',
  'v0.2.47%20candidate',
  'Version `0.2.47` is an unpublished iOS PASS replay automation gate candidate for `react-native-image-compression-kit`.',
  'No npm publish, git tag, or GitHub Release is part of the v0.2.47 candidate.',
  'The `0.2.47` package metadata is prepared as an unpublished iOS PASS replay automation gate candidate for `react-native-image-compression-kit`',
  'Version `0.2.47` is the unpublished iOS PASS replay automation gate candidate.',
  'The v0.2.47 candidate fixes semantic PASS payload validation',
  'The current v0.2.47 iOS PASS replay automation gate candidate notes',
  'Status: v0.2.48 candidate',
  'v0.2.48%20candidate',
  'Version `0.2.48` is an unpublished registry provenance and manual CI gate candidate for `react-native-image-compression-kit`',
  'No npm publish, dist-tag change, git tag, or GitHub Release is part of this candidate.',
  'The repository is preparing `0.2.48` as an unpublished registry provenance and manual CI gate candidate.',
  'Version `0.2.48` is the unpublished registry provenance and manual CI gate candidate.',
  'The v0.2.48 candidate adds a canonical registry provenance report',
  'The v0.2.48 registry provenance and manual CI gate candidate notes',
  'Status: v0.2.50 candidate',
  'v0.2.50%20candidate',
  'Version `0.2.50` is an unpublished GitHub artifact attestation and offline identity verification candidate for `react-native-image-compression-kit`',
  'npm `latest` remains the published `0.2.48` release',
  'The candidate attests the canonical `bundle-manifest.json`',
  'on candidate implementation commit `5217c91555ac30bd3b6a2882f49600c386f8271d`',
  'The v0.2.50 candidate adds GitHub OIDC artifact attestation',
  'The repository package metadata is `0.2.50` for the unpublished GitHub artifact attestation and offline identity verification candidate',
  'included in the candidate pack tarball',
  'Version `0.2.50` is the unpublished GitHub artifact attestation and offline identity verification candidate.',
  'The v0.2.50 GitHub artifact attestation and offline identity verification candidate notes',
  'Status: v0.2.55 candidate',
  'v0.2.55%20candidate',
  'Version `0.2.55` is the unpublished Action Pin artifact GitHub OIDC attestation and offline signer verification candidate.',
  'npm `latest` remains `0.2.50`',
  'no npm publish, dist-tag change, git tag, or GitHub Release is part of this candidate',
  'The repository package metadata is `0.2.55` for the unpublished Action Pin artifact GitHub OIDC attestation and offline signer verification candidate.',
  'Version `0.2.55` is the unpublished Action Pin artifact GitHub OIDC attestation and offline signer verification candidate.',
  'The v0.2.55 Action Pin artifact GitHub OIDC attestation and offline signer verification candidate notes',
  'Status: v0.2.56 candidate',
  'v0.2.56%20candidate',
  'Version `0.2.56` is the unpublished release evidence archive import automation and multi-version regression gate candidate.',
  'The repository package metadata is `0.2.56` for the unpublished release evidence archive import automation and multi-version regression gate candidate; npm `latest` remains v0.2.55.',
  'The v0.2.56 release evidence archive import automation and multi-version regression gate candidate notes',
  'Status: v0.2.57 candidate',
  'v0.2.57%20candidate',
  'Version `0.2.57` is the unpublished Registry Validation artifact acquisition and canonical metadata handoff candidate.',
  'The repository package metadata is `0.2.57` for the unpublished Registry Validation artifact acquisition and canonical metadata handoff candidate; npm `latest` remains v0.2.55.',
  'The v0.2.57 Registry Validation artifact acquisition and canonical metadata handoff candidate notes',
  'Status: v0.2.58 candidate',
  'v0.2.58%20candidate',
  'Version `0.2.58` is the unpublished release evidence policy candidate and reviewed promotion gate candidate.',
  'The repository package metadata is `0.2.58` for the unpublished release evidence policy candidate and reviewed promotion gate candidate; npm `latest` remains v0.2.55.',
  'The v0.2.58 release evidence policy candidate and reviewed promotion gate candidate notes',
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

    console.log('Packed README release status check completed.');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export function getPackedReadmeStatusViolations(readmeContents) {
  return getReadmeStatusViolations(readmeContents, {
    forbiddenSnippets: STALE_PACKED_README_SNIPPETS,
  });
}

export function validatePackedReadmeStatus(readmeContents) {
  try {
    validateReadmeStatus(readmeContents, {
      forbiddenSnippets: STALE_PACKED_README_SNIPPETS,
    });
  } catch (error) {
    const staleSnippets = getPackedReadmeStatusViolations(readmeContents);
    throw new Error(
      `Packed README contains stale package-page status snippets: ${staleSnippets.join(' | ')}`,
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
