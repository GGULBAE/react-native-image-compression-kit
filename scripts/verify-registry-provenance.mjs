#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalVerificationReport,
  createRegistryVerificationReport,
  verifyRegistryProvenanceBundle,
  writeVerificationReportAtomic,
} from './registry-provenance-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export function parseRegistryProvenanceArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--artifact-dir': 'artifactDir',
    '--expect-package': 'expectedPackage',
    '--expect-version': 'expectedVersion',
    '--expect-tag': 'expectedTag',
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
    options = parseRegistryProvenanceArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    report = verifyRegistryProvenanceBundle(options);
  } catch (error) {
    report = createRegistryVerificationReport({
      artifactDir: options.artifactDir ? path.resolve(options.artifactDir) : null,
      packageName: options.expectedPackage ?? null,
      version: options.expectedVersion ?? null,
      expectedTag: options.expectedTag ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (options.reportFile) {
    try {
      writeVerificationReportAtomic(options.reportFile, report);
    } catch (error) {
      report = createRegistryVerificationReport({
        artifactDir: report.artifactDir,
        packageName: report.package,
        version: report.version,
        expectedTag: report.expectedTag,
        reportSha256: report.reportSha256,
        integrity: report.tarballIntegrity,
        shasum: report.tarballShasum,
        checks: report.checks,
        error: `Could not write verification report atomically: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  const canonical = canonicalVerificationReport(report);
  if (options.json || report.status === 'passed') {
    process.stdout.write(canonical);
  } else {
    process.stderr.write(`${report.error}\n`);
    process.stdout.write(canonical);
  }
  if (report.status !== 'passed') process.exitCode = 1;
}

function usage() {
  return `Usage: pnpm verify:registry-provenance -- --artifact-dir <path> --expect-package <name> --expect-version <version> --expect-tag <tag>\n\nOptions:\n  --artifact-dir <path>     Read the fixed Registry Validation artifact bundle.\n  --expect-package <name>   Require the package and tarball package.json name.\n  --expect-version <value>  Require requested, resolved, tagged, and packed version.\n  --expect-tag <tag>        Require the recorded expected dist-tag.\n  --json                    Emit exactly one canonical JSON object to stdout.\n  --report-file <path>      Atomically write the same verification report.\n`;
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
