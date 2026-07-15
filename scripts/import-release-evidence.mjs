#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalReleaseEvidenceImportReport,
  createReleaseEvidenceImportReport,
  importReleaseEvidenceArchive,
} from './release-evidence-import-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_ARCHIVE_ROOT = path.join(ROOT, 'evidence', 'npm');

export function parseReleaseEvidenceImportArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--version': 'version',
    '--provenance-artifact-dir': 'provenanceArtifactDir',
    '--attestation-artifact-dir': 'attestationArtifactDir',
    '--metadata-file': 'metadataFile',
    '--archive-root': 'archiveRoot',
    '--archive-dir': 'archiveDir',
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
    options = parseReleaseEvidenceImportArgs(process.argv.slice(2));
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
    report = importReleaseEvidenceArchive({
      provenanceArtifactDir: options.provenanceArtifactDir,
      attestationArtifactDir: options.attestationArtifactDir,
      metadataFile: options.metadataFile,
      archiveDir,
      expectedVersion: options.version,
    });
  } catch (error) {
    report = createReleaseEvidenceImportReport({
      archiveDir: options.archiveDir ? path.resolve(options.archiveDir) : null,
      version: options.version ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const canonical = canonicalReleaseEvidenceImportReport(report);
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
  return `Usage: pnpm import:release-evidence -- --version <version> --provenance-artifact-dir <path> --attestation-artifact-dir <path> --metadata-file <metadata.json>\n\nOptions:\n  --version <value>                    Select the committed release evidence policy.\n  --provenance-artifact-dir <path>     Downloaded four-file Registry provenance artifact.\n  --attestation-artifact-dir <path>    Downloaded three-file attestation artifact.\n  --metadata-file <path>               Canonical explicit GitHub run/artifact metadata.\n  --archive-root <path>                Create <path>/<version>; defaults to evidence/npm.\n  --archive-dir <path>                 Create one explicit archive directory.\n  --json                               Emit exactly one canonical JSON object to stdout.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
