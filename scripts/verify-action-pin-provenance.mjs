#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalActionPinJson,
  createActionPinProvenanceReport,
  verifyActionPinProvenanceArtifact,
  writeActionPinProvenanceReportAtomic,
} from './action-pin-provenance-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export function parseActionPinProvenanceArgs(args) {
  const parsed = {};
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
    if (arg === '--artifact-dir' || arg === '--report-file') {
      const value = readValue(args, index, arg);
      parsed[arg === '--artifact-dir' ? 'artifactDir' : 'reportFile'] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function main() {
  let options = {};
  let report;
  try {
    options = parseActionPinProvenanceArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    if (!options.artifactDir) throw new Error('Missing required --artifact-dir.');
    report = verifyActionPinProvenanceArtifact({
      artifactDir: path.resolve(options.artifactDir),
    });
  } catch (error) {
    report = createActionPinProvenanceReport({
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
        error: `Could not write Action pin verification report atomically: ${
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

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function usage() {
  return `Usage: pnpm verify:action-pin-provenance -- --artifact-dir <path> --json\n\nOptions:\n  --artifact-dir <path>  Canonical Action pin provenance artifact directory.\n  --report-file <path>   Atomically write the reproduced canonical report.\n  --json                 Emit exactly one canonical JSON object to stdout.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
