#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_RELEASE_EVIDENCE_VERSIONS,
  canonicalReleaseEvidenceSetReport,
  createReleaseEvidenceSetReport,
  verifyReleaseEvidenceSet,
  writeReleaseEvidenceSetReportAtomic,
} from './release-evidence-set-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_ARCHIVE_ROOT = path.join(ROOT, 'evidence', 'npm');

export function parseReleaseEvidenceSetArgs(args) {
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
    if (arg === '--archive-root' || arg === '--report-file') {
      parsed[arg === '--archive-root' ? 'archiveRoot' : 'reportFile'] =
        readValue(args, index, arg);
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
    options = parseReleaseEvidenceSetArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    report = verifyReleaseEvidenceSet({
      archiveRoot: options.archiveRoot
        ? path.resolve(options.archiveRoot)
        : DEFAULT_ARCHIVE_ROOT,
      versions:
        options.versions.length > 0
          ? options.versions
          : DEFAULT_RELEASE_EVIDENCE_VERSIONS,
    });
  } catch (error) {
    report = createReleaseEvidenceSetReport({
      archiveRoot: options.archiveRoot ? path.resolve(options.archiveRoot) : null,
      versions: options.versions ?? [],
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (options.reportFile) {
    try {
      writeReleaseEvidenceSetReportAtomic(options.reportFile, report);
    } catch (error) {
      report = createReleaseEvidenceSetReport({
        archiveRoot: report.archiveRoot,
        versions: report.versions,
        results: report.results,
        error: `Could not write release evidence set report atomically: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  const canonical = canonicalReleaseEvidenceSetReport(report);
  if (options.json || report.status === 'passed') {
    process.stdout.write(canonical);
  } else {
    process.stderr.write(`${report.error}\n`);
    process.stdout.write(canonical);
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
  return `Usage: pnpm verify:release-evidence-set -- [--version <version> ...]\n\nOptions:\n  --version <value>       Verify one selected version; repeat for multiple versions.\n  --archive-root <path>   Read version archives below this path; defaults to evidence/npm.\n  --json                  Emit exactly one canonical JSON object to stdout.\n  --report-file <path>    Atomically write the same verification report.\n\nWith no --version flags, the committed policies are verified in order: ${DEFAULT_RELEASE_EVIDENCE_VERSIONS.join(', ')}.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
