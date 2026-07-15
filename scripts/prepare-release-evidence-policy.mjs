#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalReleaseEvidencePolicyReport,
  createReleaseEvidencePolicyReport,
  prepareReleaseEvidencePolicyCandidate,
  writeReleaseEvidencePolicyReportAtomic,
} from './release-evidence-policy-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export function parseReleaseEvidencePolicyArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--acquisition-dir': 'acquisitionDir',
    '--candidate-file': 'candidateFile',
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

function main() {
  let options = {};
  let report;

  try {
    options = parseReleaseEvidencePolicyArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    assertDistinctOutputs(options);
    report = prepareReleaseEvidencePolicyCandidate({
      acquisitionDir: options.acquisitionDir,
      candidateFile: options.candidateFile,
    });
  } catch (error) {
    report = createReleaseEvidencePolicyReport({
      acquisitionDir: options.acquisitionDir
        ? path.resolve(options.acquisitionDir)
        : null,
      candidateFile: options.candidateFile
        ? path.resolve(options.candidateFile)
        : null,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (options.reportFile) {
    try {
      writeReleaseEvidencePolicyReportAtomic(options.reportFile, report);
    } catch (error) {
      report = createReleaseEvidencePolicyReport({
        acquisitionDir: report.acquisitionDir,
        candidateFile: report.candidateFile,
        version: report.version,
        candidateSha256: report.candidateSha256,
        policyStatus: report.policyStatus,
        changes: report.changes,
        checks: report.checks,
        error: `Could not write policy candidate report atomically: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  process.stdout.write(canonicalReleaseEvidencePolicyReport(report));
  if (!options.json && report.status !== 'passed') {
    process.stderr.write(`${report.error}\n`);
  }
  if (report.status !== 'passed') process.exitCode = 1;
}

function assertDistinctOutputs(options) {
  if (
    options.candidateFile &&
    options.reportFile &&
    path.resolve(options.candidateFile) === path.resolve(options.reportFile)
  ) {
    throw new Error('Policy candidate and report destinations must differ.');
  }
  if (options.acquisitionDir && options.reportFile) {
    const acquisition = path.resolve(options.acquisitionDir);
    const report = path.resolve(options.reportFile);
    if (
      report === acquisition ||
      report.startsWith(`${acquisition}${path.sep}`)
    ) {
      throw new Error('Policy candidate report must be outside the acquisition bundle.');
    }
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
  return `Usage: pnpm prepare:release-evidence-policy -- --acquisition-dir <path> --candidate-file <candidate.json>\n\nOptions:\n  --acquisition-dir <path>  Canonical Registry Validation acquisition bundle.\n  --candidate-file <path>   Atomically create the canonical policy candidate.\n  --report-file <path>      Atomically write the canonical diff report.\n  --json                    Emit exactly one canonical JSON object to stdout.\n\nThis command never changes committed policy or the release evidence archive.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
