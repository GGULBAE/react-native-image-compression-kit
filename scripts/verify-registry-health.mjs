#!/usr/bin/env node

import {
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REGISTRY_HEALTH_EVIDENCE_FILES,
  verifyRegistryHealth,
} from './registry-health-core.mjs';
import {
  canonicalRegistryHealthReport,
  createRegistryHealthReport,
  writeRegistryHealthReportAtomic,
} from './registry-health-report.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export function parseRegistryHealthArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--release-status': 'releaseStatusFile',
    '--evidence-root': 'evidenceRoot',
    '--live-artifact-dir': 'liveArtifactDir',
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

export function runRegistryHealthFromFiles(options) {
  const releaseStatusFile = path.resolve(
    options.releaseStatusFile ?? path.join(ROOT, 'docs', 'release-status.json')
  );
  const evidenceRoot = path.resolve(
    options.evidenceRoot ?? path.join(ROOT, 'evidence', 'npm')
  );
  assert(options.liveArtifactDir, 'Missing --live-artifact-dir.');
  const liveArtifactDir = path.resolve(options.liveArtifactDir);
  const releaseStatusBytes = readRegularFile(releaseStatusFile, 'release status');
  const releaseStatus = parseJsonObject(releaseStatusBytes, 'release status');
  const version = releaseStatus.publishedNpmLatest;
  assert(
    typeof version === 'string' &&
      /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version),
    'release status publishedNpmLatest must be a semantic version.'
  );
  const evidenceDir = path.join(evidenceRoot, version);

  return verifyRegistryHealth({
    releaseStatusBytes,
    evidenceIndexBytes: readRegularFile(
      path.join(evidenceDir, REGISTRY_HEALTH_EVIDENCE_FILES.index),
      'release evidence index'
    ),
    evidenceReportBytes: readRegularFile(
      path.join(evidenceDir, REGISTRY_HEALTH_EVIDENCE_FILES.report),
      'committed registry provenance report'
    ),
    evidenceManifestBytes: readRegularFile(
      path.join(evidenceDir, REGISTRY_HEALTH_EVIDENCE_FILES.manifest),
      'committed registry bundle manifest'
    ),
    evidenceTarballBytes: readRegularFile(
      path.join(evidenceDir, REGISTRY_HEALTH_EVIDENCE_FILES.tarball),
      'committed registry tarball'
    ),
    liveReportBytes: readRegularFile(
      path.join(liveArtifactDir, 'registry-provenance.json'),
      'live registry report'
    ),
    liveTarballBytes: readRegularFile(
      path.join(liveArtifactDir, 'package.tgz'),
      'live registry tarball'
    ),
  });
}

function main() {
  let options = {};
  let report;

  try {
    options = parseRegistryHealthArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    report = runRegistryHealthFromFiles(options);
  } catch (error) {
    report = createRegistryHealthReport({
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (options.reportFile) {
    try {
      writeRegistryHealthReportAtomic(options.reportFile, report);
    } catch (error) {
      report = createRegistryHealthReport({
        ...reportValues(report),
        checks: report.checks,
        drift: report.drift,
        error: `Could not write registry health report atomically: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  const canonical = canonicalRegistryHealthReport(report);
  if (options.json || report.status === 'passed') {
    process.stdout.write(canonical);
  } else {
    process.stderr.write(`${report.error}\n`);
    process.stdout.write(canonical);
  }
  if (report.status !== 'passed') process.exitCode = 1;
}

function reportValues(report) {
  return {
    packageName: report.package,
    requestedVersion: report.requestedVersion,
    resolvedVersion: report.resolvedVersion,
    expectedTag: report.expectedTag,
    tagVersion: report.tagVersion,
    publishedAt: report.publishedAt,
    tarball: report.tarball,
    integrity: report.integrity,
    shasum: report.shasum,
    tarballSha256: report.tarballSha256,
    evidenceTarballSha256: report.evidenceTarballSha256,
    packageSize: report.packageSize,
    fileCount: report.fileCount,
    unpackedSize: report.unpackedSize,
    readmeStatus: report.readmeStatus,
    forbiddenFiles: report.forbiddenFiles,
    registryInstallSmoke: report.registryInstallSmoke,
  };
}

function readRegularFile(filePath, label) {
  let stats;
  try {
    stats = lstatSync(filePath);
  } catch (error) {
    throw new Error(`Missing ${label}: ${filePath} (${error.code ?? error.message})`);
  }
  assert(!stats.isSymbolicLink(), `${label} must not be a symbolic link: ${filePath}`);
  assert(stats.isFile(), `${label} must be a regular file: ${filePath}`);
  return readFileSync(realpathSync(filePath));
}

function parseJsonObject(bytes, label) {
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Could not parse ${label}: ${error.message}`);
  }
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
  return value;
}

function usage() {
  return `Usage: pnpm verify:registry-health -- --live-artifact-dir <path> [--json] [--report-file <path>]\n\nOptions:\n  --release-status <path>    Read publishedNpmLatest from this status manifest.\n  --evidence-root <path>     Read evidence/npm/<version> from this archive root.\n  --live-artifact-dir <path> Read registry-provenance.json and package.tgz from live smoke.\n  --json                     Emit exactly one canonical JSON object to stdout.\n  --report-file <path>       Atomically write the same canonical report bytes.\n`;
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
