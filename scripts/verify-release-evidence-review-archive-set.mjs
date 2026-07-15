#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERSIONS,
  canonicalReleaseEvidenceReviewArchiveSetReport,
  createReleaseEvidenceReviewArchiveSetReport,
  verifyReleaseEvidenceReviewArchiveSet,
  writeReleaseEvidenceReviewArchiveSetReportAtomic,
} from './release-evidence-review-archive-set-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_ARCHIVE_ROOT = path.join(ROOT, 'evidence', 'reviews');
const DEFAULT_RELEASE_ARCHIVE_ROOT = path.join(ROOT, 'evidence', 'npm');

export function parseReleaseEvidenceReviewArchiveSetArgs(args) {
  const parsed = { versions: [] };
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
    if (arg === '--version') {
      parsed.versions.push(readValue(args, index, arg));
      index += 1;
      continue;
    }
    if (
      arg === '--archive-root' ||
      arg === '--release-archive-root' ||
      arg === '--report-file'
    ) {
      const field =
        arg === '--archive-root'
          ? 'archiveRoot'
          : arg === '--release-archive-root'
            ? 'releaseArchiveRoot'
            : 'reportFile';
      parsed[field] = readValue(args, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function main() {
  let options = { versions: [] };
  let report;
  try {
    options = parseReleaseEvidenceReviewArchiveSetArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    report = verifyReleaseEvidenceReviewArchiveSet({
      archiveRoot: options.archiveRoot
        ? path.resolve(options.archiveRoot)
        : DEFAULT_ARCHIVE_ROOT,
      releaseArchiveRoot: options.releaseArchiveRoot
        ? path.resolve(options.releaseArchiveRoot)
        : DEFAULT_RELEASE_ARCHIVE_ROOT,
      versions:
        options.versions.length > 0
          ? options.versions
          : DEFAULT_RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERSIONS,
    });
  } catch (error) {
    report = createReleaseEvidenceReviewArchiveSetReport({
      archiveRoot: options.archiveRoot ? path.resolve(options.archiveRoot) : null,
      versions: options.versions ?? [],
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (options.reportFile) {
    try {
      writeReleaseEvidenceReviewArchiveSetReportAtomic(
        options.reportFile,
        report
      );
    } catch (error) {
      report = createReleaseEvidenceReviewArchiveSetReport({
        archiveRoot: report.archiveRoot,
        versions: report.versions,
        results: report.results,
        error: `Could not write review archive set report atomically: ${error.message}`,
      });
    }
  }
  process.stdout.write(canonicalReleaseEvidenceReviewArchiveSetReport(report));
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
  return `Usage: pnpm verify:release-evidence-review-archive-set -- [--version <version> ...]\n\nWith no selectors, verifies: ${DEFAULT_RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERSIONS.join(', ')}.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
