import {
  REGISTRY_BUNDLE_MANIFEST_FIELDS,
  REGISTRY_REPORT_FIELDS,
  canonicalBundleManifest,
  inspectPackageTarball,
  sha256,
  tarballIntegrity,
  tarballShasum,
} from './registry-provenance-core.mjs';
import {
  FORBIDDEN_PACKAGE_FILES,
  REGISTRY_REPORT_SCHEMA_VERSION,
  REQUIRED_PACKAGE_FILES,
  canonicalRegistryReport,
} from './registry-smoke-core.mjs';
import { validateReadmeStatus } from './readme-status-validator.mjs';
import { createRegistryHealthReport } from './registry-health-report.mjs';

const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SHA1 = /^[0-9a-f]{40}$/;
const SRI = /^sha512-[A-Za-z0-9+/]+={0,2}$/;

const RELEASE_EVIDENCE_INDEX_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'package',
  'version',
  'expectedTag',
  'publishedAt',
  'repository',
  'workflow',
  'sourceRef',
  'sourceDigest',
  'registryValidationRun',
  'provenanceArtifact',
  'attestation',
  'attestationArtifact',
  'files',
  'evidenceSha256',
  'error',
]);

const RELEASE_EVIDENCE_FILE_FIELDS = Object.freeze([
  'path',
  'size',
  'sha256',
]);

export const REGISTRY_HEALTH_EVIDENCE_FILES = Object.freeze({
  index: 'release-evidence-index.json',
  report: 'provenance/registry-provenance.json',
  manifest: 'provenance/bundle-manifest.json',
  tarball: 'provenance/package.tgz',
});

export function verifyRegistryHealth({
  releaseStatusBytes,
  evidenceIndexBytes,
  evidenceReportBytes,
  evidenceManifestBytes,
  evidenceTarballBytes,
  liveReportBytes,
  liveTarballBytes,
} = {}) {
  const state = {
    packageName: null,
    requestedVersion: null,
    resolvedVersion: null,
    expectedTag: 'latest',
    tagVersion: null,
    publishedAt: null,
    tarball: null,
    integrity: null,
    shasum: null,
    tarballSha256: null,
    evidenceTarballSha256: null,
    packageSize: null,
    fileCount: null,
    unpackedSize: null,
    readmeStatus: 'not-run',
    forbiddenFiles: [],
    registryInstallSmoke: false,
    checks: {},
    drift: [],
  };

  try {
    const releaseStatus = parseJsonObject(
      requireBytes(releaseStatusBytes, 'release status'),
      'release status'
    );
    const version = releaseStatus.publishedNpmLatest;
    assert(
      typeof version === 'string' && SEMVER.test(version),
      'release status publishedNpmLatest must be a non-empty semantic version.'
    );
    state.requestedVersion = version;
    state.checks.releaseStatus = true;

    const indexBytes = requireBytes(evidenceIndexBytes, 'release evidence index');
    const index = parseCanonicalJson(
      indexBytes,
      (value) => `${JSON.stringify(value)}\n`,
      'release evidence index'
    );
    validateEvidenceIndex(index, version);
    state.packageName = index.package;
    state.expectedTag = index.expectedTag;
    state.publishedAt = index.publishedAt;
    state.evidenceTarballSha256 = fileEntry(
      index,
      REGISTRY_HEALTH_EVIDENCE_FILES.tarball
    ).sha256;
    state.checks.evidenceIndex = true;

    const reportBytes = requireBytes(
      evidenceReportBytes,
      'committed registry provenance report'
    );
    const manifestBytes = requireBytes(
      evidenceManifestBytes,
      'committed registry bundle manifest'
    );
    const evidenceTarball = requireBytes(
      evidenceTarballBytes,
      'committed registry tarball'
    );
    validateIndexedFile(index, REGISTRY_HEALTH_EVIDENCE_FILES.report, reportBytes);
    validateIndexedFile(index, REGISTRY_HEALTH_EVIDENCE_FILES.manifest, manifestBytes);
    validateIndexedFile(index, REGISTRY_HEALTH_EVIDENCE_FILES.tarball, evidenceTarball);

    const evidenceReport = parseCanonicalJson(
      reportBytes,
      canonicalRegistryReport,
      'committed registry provenance report'
    );
    validateRegistryReport(evidenceReport, 'committed registry provenance report');
    assertPassedRegistryReport(evidenceReport, version, 'committed registry provenance report');
    const manifest = parseCanonicalJson(
      manifestBytes,
      canonicalBundleManifest,
      'committed registry bundle manifest'
    );
    validateBundleManifest(manifest);
    validateEvidenceBundle({
      index,
      report: evidenceReport,
      reportBytes,
      manifest,
      tarballBytes: evidenceTarball,
      version,
    });
    state.checks.evidenceBundle = true;

    const liveBytes = requireBytes(liveReportBytes, 'live registry report');
    const liveReport = parseCanonicalJson(
      liveBytes,
      canonicalRegistryReport,
      'live registry report'
    );
    validateRegistryReport(liveReport, 'live registry report');
    applyLiveReport(state, liveReport);
    state.checks.liveReport = true;

    const liveTarball = requireBytes(liveTarballBytes, 'live registry tarball');
    state.tarballSha256 = sha256(liveTarball);
    addDrift(state, 'tarballSha256', state.evidenceTarballSha256, state.tarballSha256);
    const liveArchive = inspectPackageTarball(liveTarball);
    const livePackageJson = parseJsonObject(
      liveArchive.files.get('package.json'),
      'live tarball package/package.json'
    );
    const liveFiles = [...liveArchive.files.keys()];
    const actualForbiddenFiles = FORBIDDEN_PACKAGE_FILES.filter((filePath) =>
      liveFiles.includes(filePath)
    );
    const missingFiles = REQUIRED_PACKAGE_FILES.filter(
      (filePath) => !liveFiles.includes(filePath)
    );

    compareRegistryReports(state, evidenceReport, liveReport);
    addDrift(
      state,
      'liveTarball.integrity',
      liveReport.integrity,
      tarballIntegrity(liveTarball)
    );
    addDrift(
      state,
      'liveTarball.shasum',
      liveReport.shasum,
      tarballShasum(liveTarball)
    );
    addDrift(
      state,
      'liveTarball.packageSize',
      liveReport.packageSize,
      liveTarball.length
    );
    addDrift(
      state,
      'liveTarball.fileCount',
      liveReport.fileCount,
      liveArchive.fileCount
    );
    addDrift(
      state,
      'liveTarball.unpackedSize',
      liveReport.unpackedSize,
      liveArchive.unpackedSize
    );
    addDrift(
      state,
      'liveTarball.package',
      liveReport.package,
      livePackageJson.name ?? null
    );
    addDrift(
      state,
      'liveTarball.version',
      liveReport.resolvedVersion,
      livePackageJson.version ?? null
    );
    addDrift(
      state,
      'liveTarball.forbiddenFiles',
      liveReport.forbiddenFiles,
      actualForbiddenFiles
    );
    addDrift(state, 'liveTarball.missingRequiredFiles', [], missingFiles);

    let actualReadmeStatus = 'failed';
    const readme = liveArchive.files.get('README.md');
    if (readme) {
      try {
        actualReadmeStatus = validateReadmeStatus(readme.toString('utf8'), {
          version,
        });
      } catch {
        actualReadmeStatus = 'failed';
      }
    }
    addDrift(
      state,
      'liveTarball.readmeStatus',
      liveReport.readmeStatus,
      actualReadmeStatus
    );

    const identityFields = new Set([
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
    ]);
    const tarballFields = new Set([
      'packageSize',
      'fileCount',
      'unpackedSize',
      'tarballSha256',
    ]);
    state.checks.identity = !state.drift.some(({ field }) =>
      identityFields.has(field)
    );
    state.checks.tarball = !state.drift.some(
      ({ field }) =>
        tarballFields.has(field) ||
        (field.startsWith('liveTarball.') &&
          field !== 'liveTarball.readmeStatus')
    );
    state.checks.readme = !state.drift.some(
      ({ field }) => field === 'readmeStatus' || field === 'liveTarball.readmeStatus'
    );
    state.checks.consumer = !state.drift.some(
      ({ field }) => field === 'registryInstallSmoke'
    );

    if (state.drift.length > 0) {
      return createRegistryHealthReport({
        ...state,
        status: 'failed',
        error: `Registry health drift detected in ${state.drift.length} field(s): ${state.drift.map(({ field }) => field).join(', ')}.`,
      });
    }

    return createRegistryHealthReport({
      ...state,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    return createRegistryHealthReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function applyLiveReport(state, report) {
  Object.assign(state, {
    packageName: report.package,
    requestedVersion: report.requestedVersion,
    resolvedVersion: report.resolvedVersion,
    expectedTag: report.expectedTag,
    tagVersion: report.tagVersion,
    publishedAt: report.publishedAt,
    tarball: report.tarball,
    integrity: report.integrity,
    shasum: report.shasum,
    packageSize: report.packageSize,
    fileCount: report.fileCount,
    unpackedSize: report.unpackedSize,
    readmeStatus: report.readmeStatus,
    forbiddenFiles: [...report.forbiddenFiles],
    registryInstallSmoke: report.registryInstallSmoke,
  });
}

function compareRegistryReports(state, expected, actual) {
  for (const field of [
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
    'packageSize',
    'fileCount',
    'unpackedSize',
    'readmeStatus',
    'forbiddenFiles',
    'registryInstallSmoke',
    'error',
  ]) {
    addDrift(state, field, expected[field], actual[field]);
  }
}

function validateEvidenceIndex(index, version) {
  assertExactFields(index, RELEASE_EVIDENCE_INDEX_FIELDS, 'release evidence index');
  assert(index.schemaVersion === 1, 'Unsupported release evidence index schemaVersion.');
  assert(index.status === 'passed', 'Release evidence index status must be passed.');
  assert(index.error === null, 'Release evidence index error must be null.');
  assertNonempty(index.package, 'release evidence index package');
  assert(index.version === version, `Release evidence version must be ${version}.`);
  assert(index.expectedTag === 'latest', 'Release evidence expectedTag must be latest.');
  assertNonempty(index.publishedAt, 'release evidence index publishedAt');
  assert(
    SHA256.test(index.evidenceSha256),
    'Release evidence index evidenceSha256 must be lowercase SHA-256.'
  );
  assert(
    SHA1.test(index.sourceDigest),
    'Release evidence index sourceDigest must be lowercase SHA-1.'
  );
  assert(Array.isArray(index.files), 'Release evidence index files must be an array.');
  const paths = [];
  for (const file of index.files) {
    assertRecord(file, 'release evidence file');
    assertExactFields(file, RELEASE_EVIDENCE_FILE_FIELDS, 'release evidence file');
    assertNonempty(file.path, 'release evidence file path');
    assert(
      Number.isSafeInteger(file.size) && file.size >= 0,
      `Release evidence file ${file.path} size must be a non-negative safe integer.`
    );
    assert(
      SHA256.test(file.sha256),
      `Release evidence file ${file.path} SHA-256 is invalid.`
    );
    paths.push(file.path);
  }
  assert(
    new Set(paths).size === paths.length,
    'Release evidence files must not contain duplicates.'
  );
  for (const required of Object.values(REGISTRY_HEALTH_EVIDENCE_FILES).slice(1)) {
    fileEntry(index, required);
  }
}

function validateRegistryReport(report, label) {
  assertRecord(report, label);
  assertExactFields(report, REGISTRY_REPORT_FIELDS, label);
  assert(
    report.schemaVersion === REGISTRY_REPORT_SCHEMA_VERSION,
    `${label} has an unsupported schemaVersion.`
  );
  assert(
    report.status === 'passed' || report.status === 'failed',
    `${label} status must be passed or failed.`
  );
  for (const field of [
    'package',
    'requestedVersion',
    'resolvedVersion',
    'expectedTag',
    'tagVersion',
    'publishedAt',
    'tarball',
    'integrity',
    'shasum',
    'readmeStatus',
  ]) {
    assertNonempty(report[field], `${label} ${field}`);
  }
  assert(SRI.test(report.integrity), `${label} integrity must be SHA-512 SRI.`);
  assert(SHA1.test(report.shasum), `${label} shasum must be lowercase SHA-1.`);
  for (const field of ['fileCount', 'packageSize', 'unpackedSize']) {
    assert(
      Number.isSafeInteger(report[field]) && report[field] >= 0,
      `${label} ${field} must be a non-negative safe integer.`
    );
  }
  assert(
    Array.isArray(report.forbiddenFiles) &&
      report.forbiddenFiles.every(
        (value) => typeof value === 'string' && value.length > 0
      ),
    `${label} forbiddenFiles must be a string array.`
  );
  assert(
    new Set(report.forbiddenFiles).size === report.forbiddenFiles.length,
    `${label} forbiddenFiles must not contain duplicates.`
  );
  assert(
    typeof report.registryInstallSmoke === 'boolean',
    `${label} registryInstallSmoke must be boolean.`
  );
  assert(
    report.error === null ||
      (typeof report.error === 'string' && report.error.length > 0),
    `${label} error must be null or a non-empty string.`
  );
}

function assertPassedRegistryReport(report, version, label) {
  assert(report.status === 'passed', `${label} status must be passed.`);
  assert(report.error === null, `${label} error must be null.`);
  assert(report.requestedVersion === version, `${label} requestedVersion must be ${version}.`);
  assert(report.resolvedVersion === version, `${label} resolvedVersion must be ${version}.`);
  assert(report.expectedTag === 'latest', `${label} expectedTag must be latest.`);
  assert(report.tagVersion === version, `${label} latest must resolve ${version}.`);
  assert(report.readmeStatus === 'passed', `${label} README status must be passed.`);
  assert(report.forbiddenFiles.length === 0, `${label} forbiddenFiles must be empty.`);
  assert(report.registryInstallSmoke === true, `${label} consumer smoke must be true.`);
}

function validateBundleManifest(manifest) {
  assertRecord(manifest, 'committed registry bundle manifest');
  assertExactFields(
    manifest,
    REGISTRY_BUNDLE_MANIFEST_FIELDS,
    'committed registry bundle manifest'
  );
  assert(manifest.schemaVersion === 1, 'Unsupported committed bundle manifest schemaVersion.');
  assert(manifest.status === 'passed', 'Committed bundle manifest status must be passed.');
  assert(manifest.error === null, 'Committed bundle manifest error must be null.');
  for (const field of [
    'package',
    'version',
    'expectedTag',
    'reportFile',
    'reportSha256',
    'stdoutFile',
    'stdoutSha256',
    'tarballFile',
    'tarballIntegrity',
    'tarballShasum',
  ]) {
    assertNonempty(manifest[field], `committed bundle manifest ${field}`);
  }
  assert(SHA256.test(manifest.reportSha256), 'Committed manifest reportSha256 is invalid.');
  assert(SHA256.test(manifest.stdoutSha256), 'Committed manifest stdoutSha256 is invalid.');
  assert(SRI.test(manifest.tarballIntegrity), 'Committed manifest tarballIntegrity is invalid.');
  assert(SHA1.test(manifest.tarballShasum), 'Committed manifest tarballShasum is invalid.');
  for (const field of ['fileCount', 'packageSize', 'unpackedSize']) {
    assert(
      Number.isSafeInteger(manifest[field]) && manifest[field] >= 0,
      `Committed manifest ${field} must be a non-negative safe integer.`
    );
  }
}

function validateEvidenceBundle({
  index,
  report,
  reportBytes,
  manifest,
  tarballBytes,
  version,
}) {
  assert(index.package === report.package, 'Evidence index package does not match report.');
  assert(index.version === report.resolvedVersion, 'Evidence index version does not match report.');
  assert(index.expectedTag === report.expectedTag, 'Evidence index tag does not match report.');
  assert(index.publishedAt === report.publishedAt, 'Evidence index timestamp does not match report.');
  assert(manifest.package === report.package, 'Evidence manifest package does not match report.');
  assert(manifest.version === version, 'Evidence manifest version does not match release status.');
  assert(manifest.expectedTag === report.expectedTag, 'Evidence manifest tag does not match report.');
  assert(manifest.reportFile === 'registry-provenance.json', 'Evidence manifest reportFile is invalid.');
  assert(manifest.stdoutFile === 'stdout.json', 'Evidence manifest stdoutFile is invalid.');
  assert(manifest.tarballFile === 'package.tgz', 'Evidence manifest tarballFile is invalid.');
  assert(manifest.reportSha256 === sha256(reportBytes), 'Evidence report SHA-256 does not match manifest.');
  assert(manifest.stdoutSha256 === manifest.reportSha256, 'Evidence stdout/report SHA-256 differs.');
  assert(manifest.tarballIntegrity === tarballIntegrity(tarballBytes), 'Evidence tarball SRI differs.');
  assert(manifest.tarballShasum === tarballShasum(tarballBytes), 'Evidence tarball shasum differs.');
  assert(manifest.packageSize === tarballBytes.length, 'Evidence tarball byte size differs.');

  for (const [manifestField, reportField] of [
    ['tarballIntegrity', 'integrity'],
    ['tarballShasum', 'shasum'],
    ['fileCount', 'fileCount'],
    ['packageSize', 'packageSize'],
    ['unpackedSize', 'unpackedSize'],
  ]) {
    assert(
      manifest[manifestField] === report[reportField],
      `Evidence manifest ${manifestField} does not match report ${reportField}.`
    );
  }

  const archive = inspectPackageTarball(tarballBytes);
  assert(archive.fileCount === report.fileCount, 'Evidence tarball file count differs.');
  assert(archive.unpackedSize === report.unpackedSize, 'Evidence tarball unpacked size differs.');
  const packageJson = parseJsonObject(
    archive.files.get('package.json'),
    'evidence tarball package/package.json'
  );
  assert(packageJson.name === report.package, 'Evidence tarball package name differs.');
  assert(packageJson.version === version, 'Evidence tarball package version differs.');
  const files = [...archive.files.keys()];
  const missing = REQUIRED_PACKAGE_FILES.filter((filePath) => !files.includes(filePath));
  const forbidden = FORBIDDEN_PACKAGE_FILES.filter((filePath) => files.includes(filePath));
  assert(missing.length === 0, `Evidence tarball is missing required files: ${missing.join(', ')}.`);
  assert(forbidden.length === 0, `Evidence tarball contains forbidden files: ${forbidden.join(', ')}.`);
  const readme = archive.files.get('README.md');
  assert(readme, 'Evidence tarball is missing README.md.');
  validateReadmeStatus(readme.toString('utf8'), { version });
}

function validateIndexedFile(index, relativePath, bytes) {
  const entry = fileEntry(index, relativePath);
  assert(entry.size === bytes.length, `Indexed size differs for ${relativePath}.`);
  assert(entry.sha256 === sha256(bytes), `Indexed SHA-256 differs for ${relativePath}.`);
}

function fileEntry(index, relativePath) {
  const matches = index.files.filter(({ path }) => path === relativePath);
  assert(matches.length === 1, `Release evidence index must contain ${relativePath} exactly once.`);
  return matches[0];
}

function parseCanonicalJson(bytes, canonicalize, label) {
  const value = parseJsonObject(bytes, label);
  assert(
    bytes.equals(Buffer.from(canonicalize(value), 'utf8')),
    `${label} is not canonical JSON.`
  );
  return value;
}

function parseJsonObject(bytes, label) {
  let value;
  try {
    value = JSON.parse(Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes));
  } catch (error) {
    throw new Error(`Could not parse ${label}: ${error.message}`);
  }
  assertRecord(value, label);
  return value;
}

function requireBytes(value, label) {
  assert(Buffer.isBuffer(value), `Missing ${label}.`);
  assert(value.length > 0, `${label} must not be empty.`);
  return value;
}

function addDrift(state, field, expected, actual) {
  if (sameValue(expected, actual)) return;
  assert(
    !state.drift.some((entry) => entry.field === field),
    `Duplicate registry health drift field: ${field}`
  );
  state.drift.push({ field, expected, actual });
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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

function assertNonempty(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label} must be non-empty.`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
