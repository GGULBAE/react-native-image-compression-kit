#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalReleaseEvidenceReviewArchiveVerification,
  createReleaseEvidenceReviewArchiveVerification,
  verifyReleaseEvidenceReviewArchive,
  writeReleaseEvidenceReviewArchiveVerificationAtomic,
} from './release-evidence-review-archive-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_ARCHIVE_ROOT = path.join(ROOT, 'evidence', 'reviews');
const DEFAULT_RELEASE_ARCHIVE_ROOT = path.join(ROOT, 'evidence', 'npm');

export function parseReleaseEvidenceReviewArchiveVerificationArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--version': 'version',
    '--archive-root': 'archiveRoot',
    '--archive-dir': 'archiveDir',
    '--release-archive-root': 'releaseArchiveRoot',
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
  if (parsed.archiveRoot && parsed.archiveDir) {
    throw new Error('Use either --archive-root or --archive-dir, not both.');
  }
  return parsed;
}

function main() {
  let options = {};
  let report;
  try {
    options = parseReleaseEvidenceReviewArchiveVerificationArgs(
      process.argv.slice(2)
    );
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    const archiveDir = options.archiveDir
      ? path.resolve(options.archiveDir)
      : path.join(
          options.archiveRoot
            ? path.resolve(options.archiveRoot)
            : DEFAULT_ARCHIVE_ROOT,
          options.version ?? ''
        );
    report = verifyReleaseEvidenceReviewArchive({
      archiveDir,
      releaseArchiveRoot: options.releaseArchiveRoot
        ? path.resolve(options.releaseArchiveRoot)
        : DEFAULT_RELEASE_ARCHIVE_ROOT,
      expectedVersion: options.version,
    });
  } catch (error) {
    report = createReleaseEvidenceReviewArchiveVerification({
      archiveDir: options.archiveDir ? path.resolve(options.archiveDir) : null,
      version: options.version ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (options.reportFile) {
    try {
      writeReleaseEvidenceReviewArchiveVerificationAtomic(
        options.reportFile,
        report
      );
    } catch (error) {
      report = createReleaseEvidenceReviewArchiveVerification({
        ...report,
        status: 'failed',
        error: `Could not write review archive verification report atomically: ${error.message}`,
      });
    }
  }
  process.stdout.write(canonicalReleaseEvidenceReviewArchiveVerification(report));
  if (!options.json && report.status !== 'passed') {
    process.stderr.write(`${report.error}\n`);
  }
  if (report.status !== 'passed') process.exitCode = 1;
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function usage() {
  return `Usage: pnpm verify:release-evidence-review-archive -- --version <version> [options]\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
