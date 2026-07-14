#!/usr/bin/env node

import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalActionPinJson,
  createActionPinProvenanceReport,
  reviewActionPin,
  validateActionPinReviewRequest,
  writeActionPinProvenanceArtifactAtomic,
  writeActionPinProvenanceReportAtomic,
} from './action-pin-provenance-core.mjs';
import { resolveGitHubActionTag } from './action-pin-review-github.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export function parseActionPinReviewArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--action': 'action',
    '--repository': 'repository',
    '--release-tag': 'releaseTag',
    '--proposed-sha': 'proposedSha',
    '--baseline-lock': 'baselineLock',
    '--candidate-lock': 'candidateLock',
    '--artifact-dir': 'artifactDir',
    '--report-file': 'reportFile',
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (valueFlags[arg]) {
      parsed[valueFlags[arg]] = readValue(args, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

export async function runActionPinReview(options, dependencies = {}) {
  requireValue(options.action, '--action');
  requireValue(options.repository, '--repository');
  requireValue(options.releaseTag, '--release-tag');
  requireValue(options.proposedSha, '--proposed-sha');
  validateActionPinReviewRequest(options);
  const baselineLockPath = path.resolve(
    options.baselineLock ?? path.join(ROOT, '.github', 'actions-lock.json')
  );
  const candidateLockPath = path.resolve(
    options.candidateLock ?? path.join(ROOT, '.github', 'actions-lock.json')
  );
  const baselineLockBytes = readSecureFile(baselineLockPath, 'baseline Action lock');
  const candidateLockBytes = readSecureFile(candidateLockPath, 'candidate Action lock');
  const resolver = dependencies.resolveTag ?? resolveGitHubActionTag;
  const { tagReference, annotatedTag } = await resolver({
    repository: options.repository,
    releaseTag: options.releaseTag,
  });
  const report = reviewActionPin({
    action: options.action,
    repository: options.repository,
    releaseTag: options.releaseTag,
    proposedSha: options.proposedSha,
    baselineLockBytes,
    candidateLockBytes,
    tagReference,
    annotatedTag,
  });

  if (options.artifactDir) {
    writeActionPinProvenanceArtifactAtomic(options.artifactDir, {
      baselineLockBytes,
      candidateLockBytes,
      tagReference,
      annotatedTag,
      report,
    });
  }
  return report;
}

async function main() {
  let options = {};
  let report;
  try {
    options = parseActionPinReviewArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    report = await runActionPinReview(options);
  } catch (error) {
    report = createActionPinProvenanceReport({
      action: options.action ?? null,
      repository: options.repository ?? null,
      releaseTag: options.releaseTag ?? null,
      proposedSha: options.proposedSha ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (options.reportFile) {
    try {
      writeActionPinProvenanceReportAtomic(options.reportFile, report);
    } catch (error) {
      report = createActionPinProvenanceReport({
        ...report,
        status: 'failed',
        error: `Could not write Action pin provenance report atomically: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  process.stdout.write(canonicalActionPinJson(report));
  if (!options.json && report.status !== 'passed') {
    process.stderr.write(`${report.error}\n`);
  }
  if (report.status !== 'passed') process.exitCode = 1;
}

function readSecureFile(filePath, label) {
  const stats = lstatSync(filePath);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${label} must be a regular file, not a symbolic link.`);
  }
  return readFileSync(realpathSync(filePath));
}

function requireValue(value, flag) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required ${flag}.`);
  }
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function usage() {
  return `Usage: pnpm review:action-pin -- --action <owner/repo[/path]> --repository <owner/repo> --release-tag <vN> --proposed-sha <40-char-sha> --artifact-dir <path> --json\n\nOptions:\n  --baseline-lock <path>  Reviewed base-branch canonical lock; defaults to .github/actions-lock.json.\n  --candidate-lock <path>  Candidate canonical lock; defaults to .github/actions-lock.json.\n  --artifact-dir <path>    Atomically create the canonical provenance artifact directory.\n  --report-file <path>     Atomically write the canonical report separately.\n  --json                   Emit exactly one canonical JSON object to stdout.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}
