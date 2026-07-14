#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalReleaseEvidenceVerification,
  createReleaseEvidenceVerification,
  verifyReleaseEvidenceArchive,
  writeReleaseEvidenceVerificationAtomic,
} from './release-evidence-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_ARCHIVE_ROOT = path.join(ROOT, 'evidence', 'npm');

export function parseReleaseEvidenceArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--version': 'version',
    '--archive-root': 'archiveRoot',
    '--archive-dir': 'archiveDir',
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
    options = parseReleaseEvidenceArgs(process.argv.slice(2));
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
    report = verifyReleaseEvidenceArchive({
      archiveDir,
      expectedVersion: options.version,
    });
  } catch (error) {
    report = createReleaseEvidenceVerification({
      archiveDir: options.archiveDir ? path.resolve(options.archiveDir) : null,
      version: options.version ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (options.reportFile) {
    try {
      writeReleaseEvidenceVerificationAtomic(options.reportFile, report);
    } catch (error) {
      report = createReleaseEvidenceVerification({
        archiveDir: report.archiveDir,
        packageName: report.package,
        version: report.version,
        expectedTag: report.expectedTag,
        evidenceSha256: report.evidenceSha256,
        provenanceReportSha256: report.provenanceReportSha256,
        manifestSha256: report.manifestSha256,
        attestationReportSha256: report.attestationReportSha256,
        sourceDigest: report.sourceDigest,
        checks: report.checks,
        error: `Could not write release evidence verification report atomically: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  const canonical = canonicalReleaseEvidenceVerification(report);
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
  return `Usage: pnpm verify:release-evidence -- --version <version>\n\nOptions:\n  --version <value>       Select a committed release evidence policy and archive.\n  --archive-root <path>   Read <path>/<version>; defaults to evidence/npm.\n  --archive-dir <path>    Read one explicit version archive directory.\n  --json                  Emit exactly one canonical JSON object to stdout.\n  --report-file <path>    Atomically write the same verification report.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
