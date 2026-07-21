import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const REGISTRY_HEALTH_SCHEMA_VERSION = 1;

export const REGISTRY_HEALTH_CHECK_FIELDS = Object.freeze([
  'releaseStatus',
  'evidenceIndex',
  'evidenceBundle',
  'liveReport',
  'identity',
  'tarball',
  'readme',
  'consumer',
]);

export const REGISTRY_HEALTH_REPORT_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'package',
  'requestedVersion',
  'resolvedVersion',
  'expectedTag',
  'tagVersion',
  'publishedAt',
  'tarball',
  'integrity',
  'shasum',
  'tarballSha256',
  'evidenceTarballSha256',
  'packageSize',
  'fileCount',
  'unpackedSize',
  'readmeStatus',
  'forbiddenFiles',
  'registryInstallSmoke',
  'checks',
  'drift',
  'error',
]);

export const REGISTRY_HEALTH_DRIFT_FIELDS = Object.freeze([
  'field',
  'expected',
  'actual',
]);

export function createRegistryHealthReport({
  status = 'failed',
  packageName = null,
  requestedVersion = null,
  resolvedVersion = null,
  expectedTag = 'latest',
  tagVersion = null,
  publishedAt = null,
  tarball = null,
  integrity = null,
  shasum = null,
  tarballSha256 = null,
  evidenceTarballSha256 = null,
  packageSize = null,
  fileCount = null,
  unpackedSize = null,
  readmeStatus = 'not-run',
  forbiddenFiles = [],
  registryInstallSmoke = false,
  checks = {},
  drift = [],
  error = null,
} = {}) {
  return {
    schemaVersion: REGISTRY_HEALTH_SCHEMA_VERSION,
    status,
    package: packageName,
    requestedVersion,
    resolvedVersion,
    expectedTag,
    tagVersion,
    publishedAt,
    tarball,
    integrity,
    shasum,
    tarballSha256,
    evidenceTarballSha256,
    packageSize,
    fileCount,
    unpackedSize,
    readmeStatus,
    forbiddenFiles,
    registryInstallSmoke,
    checks: Object.fromEntries(
      REGISTRY_HEALTH_CHECK_FIELDS.map((field) => [field, checks[field] === true])
    ),
    drift: drift.map(({ field, expected, actual }) => ({
      field,
      expected,
      actual,
    })),
    error,
  };
}

export function canonicalRegistryHealthReport(report) {
  validateRegistryHealthReport(report);
  return `${JSON.stringify(report)}\n`;
}

export function validateRegistryHealthReport(report) {
  assertRecord(report, 'registry health report');
  assertExactFields(report, REGISTRY_HEALTH_REPORT_FIELDS, 'registry health report');
  assert(
    report.schemaVersion === REGISTRY_HEALTH_SCHEMA_VERSION,
    `Unsupported registry health schemaVersion: ${report.schemaVersion}`
  );
  assert(
    report.status === 'passed' || report.status === 'failed',
    'Registry health status must be passed or failed.'
  );
  assertRecord(report.checks, 'registry health checks');
  assertExactFields(
    report.checks,
    REGISTRY_HEALTH_CHECK_FIELDS,
    'registry health checks'
  );
  assert(
    Object.values(report.checks).every((value) => typeof value === 'boolean'),
    'Registry health checks must be booleans.'
  );
  assert(Array.isArray(report.drift), 'Registry health drift must be an array.');
  const driftFields = [];
  for (const entry of report.drift) {
    assertRecord(entry, 'registry health drift entry');
    assertExactFields(entry, REGISTRY_HEALTH_DRIFT_FIELDS, 'registry health drift entry');
    assert(
      typeof entry.field === 'string' && entry.field.length > 0,
      'Registry health drift field must be a non-empty string.'
    );
    driftFields.push(entry.field);
  }
  assert(
    new Set(driftFields).size === driftFields.length,
    'Registry health drift must not contain duplicate fields.'
  );
  assert(
    Array.isArray(report.forbiddenFiles) &&
      report.forbiddenFiles.every(
        (value) => typeof value === 'string' && value.length > 0
      ),
    'Registry health forbiddenFiles must be a non-empty string array when present.'
  );
  assert(
    new Set(report.forbiddenFiles).size === report.forbiddenFiles.length,
    'Registry health forbiddenFiles must not contain duplicates.'
  );
  assert(
    report.error === null ||
      (typeof report.error === 'string' && report.error.length > 0),
    'Registry health error must be null or a non-empty string.'
  );
}

export function writeRegistryHealthReportAtomic(filePath, report, operations = {}) {
  const mkdir = operations.mkdir ?? mkdirSync;
  const writeFile = operations.writeFile ?? writeFileSync;
  const rename = operations.rename ?? renameSync;
  const remove = operations.remove ?? rmSync;
  const destination = path.resolve(filePath);
  const directory = path.dirname(destination);
  const temporary = path.join(
    directory,
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`
  );

  mkdir(directory, { recursive: true });
  try {
    writeFile(temporary, canonicalRegistryHealthReport(report), {
      encoding: 'utf8',
      flag: 'wx',
    });
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { force: true });
    throw error;
  }
}

function assertExactFields(value, fields, label) {
  assert(
    JSON.stringify(Object.keys(value)) === JSON.stringify(fields),
    `${label} fields must be exactly: ${fields.join(', ')}.`
  );
}

function assertRecord(value, label) {
  assert(
    value && typeof value === 'object' && !Array.isArray(value),
    `${label} must be an object.`
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
