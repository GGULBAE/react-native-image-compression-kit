import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  FORBIDDEN_PACKAGE_FILES,
  REGISTRY_REPORT_SCHEMA_VERSION,
  REQUIRED_PACKAGE_FILES,
  canonicalRegistryReport,
} from './registry-smoke-core.mjs';
import { validateReadmeStatus } from './readme-status-validator.mjs';

export const REGISTRY_BUNDLE_SCHEMA_VERSION = 1;
export const REGISTRY_VERIFICATION_SCHEMA_VERSION = 1;

export const REGISTRY_BUNDLE_FILES = Object.freeze({
  manifest: 'bundle-manifest.json',
  report: 'registry-provenance.json',
  stdout: 'stdout.json',
  tarball: 'package.tgz',
});

export const REGISTRY_REPORT_FIELDS = Object.freeze([
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
  'fileCount',
  'packageSize',
  'unpackedSize',
  'readmeStatus',
  'forbiddenFiles',
  'registryInstallSmoke',
  'error',
]);

export const REGISTRY_BUNDLE_MANIFEST_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
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
  'fileCount',
  'packageSize',
  'unpackedSize',
  'error',
]);

export const REGISTRY_VERIFICATION_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'artifactDir',
  'package',
  'version',
  'expectedTag',
  'reportSha256',
  'tarballIntegrity',
  'tarballShasum',
  'checks',
  'error',
]);

const VERIFICATION_CHECK_FIELDS = Object.freeze([
  'manifest',
  'report',
  'stdout',
  'tarball',
  'packageContents',
  'readme',
]);

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function tarballIntegrity(value) {
  return `sha512-${createHash('sha512').update(value).digest('base64')}`;
}

export function tarballShasum(value) {
  return createHash('sha1').update(value).digest('hex');
}

export function canonicalBundleManifest(manifest) {
  return `${JSON.stringify(manifest)}\n`;
}

export function canonicalVerificationReport(report) {
  return `${JSON.stringify(report)}\n`;
}

export function createRegistryBundleManifest(report, tarballBytes) {
  const reportBytes = canonicalRegistryReport(report);
  const integrity = tarballIntegrity(tarballBytes);
  const shasum = tarballShasum(tarballBytes);

  assert(report.integrity === integrity, 'Tarball integrity does not match the registry report.');
  assert(report.shasum === shasum, 'Tarball shasum does not match the registry report.');
  assert(report.packageSize === tarballBytes.length, 'Tarball byte size does not match the registry report.');

  return {
    schemaVersion: REGISTRY_BUNDLE_SCHEMA_VERSION,
    status: report.status,
    package: report.package,
    version: report.resolvedVersion,
    expectedTag: report.expectedTag,
    reportFile: REGISTRY_BUNDLE_FILES.report,
    reportSha256: sha256(reportBytes),
    stdoutFile: REGISTRY_BUNDLE_FILES.stdout,
    stdoutSha256: sha256(reportBytes),
    tarballFile: REGISTRY_BUNDLE_FILES.tarball,
    tarballIntegrity: integrity,
    tarballShasum: shasum,
    fileCount: report.fileCount,
    packageSize: report.packageSize,
    unpackedSize: report.unpackedSize,
    error: report.error,
  };
}

export function writeRegistryBundleAtomic(
  artifactDir,
  report,
  tarballBytes,
  operations = {}
) {
  const exists = operations.exists ?? existsSync;
  const mkdir = operations.mkdir ?? mkdirSync;
  const writeFile = operations.writeFile ?? writeFileSync;
  const rename = operations.rename ?? renameSync;
  const remove = operations.remove ?? rmSync;
  const destination = path.resolve(artifactDir);
  const parent = path.dirname(destination);
  const temporary = path.join(
    parent,
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`
  );
  const manifest = createRegistryBundleManifest(report, tarballBytes);
  const reportBytes = canonicalRegistryReport(report);

  mkdir(parent, { recursive: true });
  if (exists(destination)) {
    throw new Error(`Registry provenance artifact directory already exists: ${destination}`);
  }

  try {
    mkdir(temporary, { recursive: false });
    writeFile(path.join(temporary, REGISTRY_BUNDLE_FILES.report), reportBytes, {
      encoding: 'utf8',
      flag: 'wx',
    });
    writeFile(path.join(temporary, REGISTRY_BUNDLE_FILES.stdout), reportBytes, {
      encoding: 'utf8',
      flag: 'wx',
    });
    writeFile(path.join(temporary, REGISTRY_BUNDLE_FILES.tarball), tarballBytes, {
      flag: 'wx',
    });
    writeFile(
      path.join(temporary, REGISTRY_BUNDLE_FILES.manifest),
      canonicalBundleManifest(manifest),
      { encoding: 'utf8', flag: 'wx' }
    );
    rename(temporary, destination);
    return manifest;
  } catch (error) {
    remove(temporary, { recursive: true, force: true });
    throw error;
  }
}

export function createRegistryVerificationReport({
  artifactDir = null,
  packageName = null,
  version = null,
  expectedTag = null,
  reportSha256 = null,
  integrity = null,
  shasum = null,
  checks = {},
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: REGISTRY_VERIFICATION_SCHEMA_VERSION,
    status,
    artifactDir,
    package: packageName,
    version,
    expectedTag,
    reportSha256,
    tarballIntegrity: integrity,
    tarballShasum: shasum,
    checks: Object.fromEntries(
      VERIFICATION_CHECK_FIELDS.map((field) => [field, checks[field] === true])
    ),
    error,
  };
}

export function verifyRegistryProvenanceBundle({
  artifactDir,
  expectedPackage,
  expectedVersion,
  expectedTag,
}) {
  const resolvedArtifactDir = artifactDir ? path.resolve(artifactDir) : null;
  const state = {
    artifactDir: resolvedArtifactDir,
    packageName: expectedPackage ?? null,
    version: expectedVersion ?? null,
    expectedTag: expectedTag ?? null,
    reportSha256: null,
    integrity: null,
    shasum: null,
    checks: {},
  };

  try {
    assert(artifactDir, 'Missing --artifact-dir.');
    assert(expectedPackage, 'Missing --expect-package.');
    assert(expectedVersion, 'Missing --expect-version.');
    assert(expectedTag, 'Missing --expect-tag.');

    const root = validateArtifactRoot(resolvedArtifactDir);
    const entries = readdirSync(root).sort();
    const expectedEntries = Object.values(REGISTRY_BUNDLE_FILES).sort();
    assert(
      JSON.stringify(entries) === JSON.stringify(expectedEntries),
      `Artifact directory must contain exactly: ${expectedEntries.join(', ')}.`
    );

    const manifestBytes = readSecureBundleFile(root, REGISTRY_BUNDLE_FILES.manifest);
    const manifest = parseCanonicalJson(
      manifestBytes,
      canonicalBundleManifest,
      'bundle manifest'
    );
    validateManifestSchema(manifest);
    state.checks.manifest = true;

    for (const [field, expected] of [
      ['reportFile', REGISTRY_BUNDLE_FILES.report],
      ['stdoutFile', REGISTRY_BUNDLE_FILES.stdout],
      ['tarballFile', REGISTRY_BUNDLE_FILES.tarball],
    ]) {
      validateRelativeBundlePath(manifest[field]);
      assert(manifest[field] === expected, `bundle manifest ${field} must be ${expected}.`);
    }

    const reportBytes = readSecureBundleFile(root, manifest.reportFile);
    const stdoutBytes = readSecureBundleFile(root, manifest.stdoutFile);
    const tarballBytes = readSecureBundleFile(root, manifest.tarballFile);
    const report = parseCanonicalJson(
      reportBytes,
      canonicalRegistryReport,
      'registry provenance report'
    );
    validateRegistryReportSchema(report);
    state.reportSha256 = sha256(reportBytes);
    state.packageName = report.package;
    state.version = report.resolvedVersion;
    state.expectedTag = report.expectedTag;
    state.checks.report = true;

    assert(report.status === 'passed', 'Registry provenance report status must be passed.');
    assert(report.error === null, 'Registry provenance report error must be null.');
    assert(report.package === expectedPackage, `Expected package ${expectedPackage}, got ${report.package}.`);
    assert(report.requestedVersion === expectedVersion, `Expected requested version ${expectedVersion}, got ${report.requestedVersion}.`);
    assert(report.resolvedVersion === expectedVersion, `Expected resolved version ${expectedVersion}, got ${report.resolvedVersion}.`);
    assert(report.expectedTag === expectedTag, `Expected dist-tag ${expectedTag}, got ${report.expectedTag}.`);
    assert(report.tagVersion === expectedVersion, `Expected dist-tag ${expectedTag} to resolve ${expectedVersion}, got ${report.tagVersion}.`);
    assert(report.readmeStatus === 'passed', 'Registry provenance README status must be passed.');
    assert(Array.isArray(report.forbiddenFiles) && report.forbiddenFiles.length === 0, 'Registry provenance report contains forbidden files.');
    assert(report.registryInstallSmoke === true, 'Registry consumer install/typecheck evidence must be true.');

    assert(reportBytes.equals(stdoutBytes), 'registry-provenance.json and stdout.json differ.');
    assert(state.reportSha256 === manifest.reportSha256, 'Report SHA-256 does not match bundle manifest.');
    assert(sha256(stdoutBytes) === manifest.stdoutSha256, 'stdout SHA-256 does not match bundle manifest.');
    state.checks.stdout = true;

    state.integrity = tarballIntegrity(tarballBytes);
    state.shasum = tarballShasum(tarballBytes);
    assert(state.integrity === report.integrity, 'Tarball integrity does not match registry report.');
    assert(state.integrity === manifest.tarballIntegrity, 'Tarball integrity does not match bundle manifest.');
    assert(state.shasum === report.shasum, 'Tarball shasum does not match registry report.');
    assert(state.shasum === manifest.tarballShasum, 'Tarball shasum does not match bundle manifest.');
    assert(tarballBytes.length === report.packageSize, 'Tarball byte size does not match registry report.');
    assert(tarballBytes.length === manifest.packageSize, 'Tarball byte size does not match bundle manifest.');
    state.checks.tarball = true;

    validateManifestReportAgreement(manifest, report);
    const archive = inspectPackageTarball(tarballBytes);
    assert(archive.fileCount === report.fileCount, 'Tarball file count does not match registry report.');
    assert(archive.fileCount === manifest.fileCount, 'Tarball file count does not match bundle manifest.');
    assert(archive.unpackedSize === report.unpackedSize, 'Tarball unpacked size does not match registry report.');
    assert(archive.unpackedSize === manifest.unpackedSize, 'Tarball unpacked size does not match bundle manifest.');

    const packageJson = parseJson(archive.files.get('package.json'), 'package/package.json');
    assert(packageJson.name === expectedPackage, `Tarball package name must be ${expectedPackage}.`);
    assert(packageJson.version === expectedVersion, `Tarball package version must be ${expectedVersion}.`);
    const filePaths = [...archive.files.keys()];
    const missing = REQUIRED_PACKAGE_FILES.filter((filePath) => !filePaths.includes(filePath));
    const forbidden = FORBIDDEN_PACKAGE_FILES.filter((filePath) => filePaths.includes(filePath));
    assert(missing.length === 0, `Tarball is missing expected files: ${missing.join(', ')}`);
    assert(forbidden.length === 0, `Tarball contains development-only files: ${forbidden.join(', ')}`);
    state.checks.packageContents = true;

    const readme = archive.files.get('README.md');
    assert(readme, 'Tarball is missing package/README.md.');
    validateReadmeStatus(readme.toString('utf8'), { version: expectedVersion });
    state.checks.readme = true;

    return createRegistryVerificationReport({
      ...state,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    return createRegistryVerificationReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function writeVerificationReportAtomic(filePath, report, operations = {}) {
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
    writeFile(temporary, canonicalVerificationReport(report), {
      encoding: 'utf8',
      flag: 'wx',
    });
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { force: true });
    throw error;
  }
}

export function inspectPackageTarball(tarballBytes) {
  let archive;
  try {
    archive = gunzipSync(tarballBytes);
  } catch (error) {
    throw new Error(`Could not decompress package tarball: ${error.message}`);
  }

  const files = new Map();
  let offset = 0;
  let zeroBlocks = 0;
  let pendingPax = {};
  let globalPax = {};
  let pendingLongPath = null;

  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((byte) => byte === 0)) {
      zeroBlocks += 1;
      if (zeroBlocks === 2) break;
      continue;
    }
    assert(zeroBlocks === 0, 'Tarball contains data after an end-of-archive block.');
    validateTarHeaderChecksum(header);
    const headerSize = parseTarNumber(header.subarray(124, 136), 'size');
    assert(offset + headerSize <= archive.length, 'Tarball entry extends beyond archive bounds.');
    const body = archive.subarray(offset, offset + headerSize);
    offset += Math.ceil(headerSize / 512) * 512;
    assert(offset <= archive.length, 'Tarball padding extends beyond archive bounds.');

    const type = String.fromCharCode(header[156] || 48);
    const headerPath = tarHeaderPath(header);
    if (type === 'x' || type === 'g') {
      const pax = parsePax(body);
      if (type === 'g') globalPax = { ...globalPax, ...pax };
      else pendingPax = pax;
      continue;
    }
    if (type === 'L') {
      pendingLongPath = nulTerminated(body).replace(/\n$/, '');
      continue;
    }
    if (type === 'K') {
      throw new Error('Tarball contains a GNU long link entry.');
    }

    const metadata = { ...globalPax, ...pendingPax };
    const entryPath = metadata.path ?? pendingLongPath ?? headerPath;
    pendingPax = {};
    pendingLongPath = null;
    validateTarPath(entryPath);

    if (type === '1' || type === '2') {
      throw new Error(`Tarball contains a link entry: ${entryPath}`);
    }
    if (type === '5') continue;
    assert(type === '0' || type === '\0' || type === '7', `Tarball contains unsupported entry type ${JSON.stringify(type)} at ${entryPath}.`);
    if (metadata.size != null) {
      assert(Number(metadata.size) === headerSize, `PAX size does not match tar header for ${entryPath}.`);
    }
    assert(entryPath.startsWith('package/'), `Tarball entry is outside package/: ${entryPath}`);
    const packagePath = entryPath.slice('package/'.length);
    assert(packagePath.length > 0, 'Tarball contains an empty package path.');
    assert(!files.has(packagePath), `Tarball contains duplicate file: ${packagePath}`);
    files.set(packagePath, Buffer.from(body));
  }

  assert(zeroBlocks === 2, 'Tarball is missing the two end-of-archive blocks.');
  assert(files.size > 0, 'Tarball contains no package files.');
  return {
    files,
    fileCount: files.size,
    unpackedSize: [...files.values()].reduce((total, value) => total + value.length, 0),
  };
}

function validateArtifactRoot(artifactDir) {
  const stats = lstatSync(artifactDir);
  assert(!stats.isSymbolicLink(), 'Artifact directory must not be a symbolic link.');
  assert(stats.isDirectory(), 'Artifact path must be a directory.');
  return realpathSync(artifactDir);
}

function readSecureBundleFile(root, relativePath) {
  validateRelativeBundlePath(relativePath);
  const resolved = path.resolve(root, ...relativePath.split('/'));
  assert(isWithin(root, resolved), `Bundle path escapes artifact directory: ${relativePath}`);
  const stats = lstatSync(resolved);
  assert(!stats.isSymbolicLink(), `Bundle file must not be a symbolic link: ${relativePath}`);
  assert(stats.isFile(), `Bundle entry must be a regular file: ${relativePath}`);
  const real = realpathSync(resolved);
  assert(isWithin(root, real), `Bundle file resolves outside artifact directory: ${relativePath}`);
  return readFileSync(real);
}

function validateRelativeBundlePath(value) {
  assert(typeof value === 'string' && value.length > 0, 'Bundle file path must be a non-empty string.');
  assert(!value.includes('\\'), `Bundle file path must use POSIX separators: ${value}`);
  assert(!path.posix.isAbsolute(value), `Bundle file path must be relative: ${value}`);
  const parts = value.split('/');
  assert(parts.every((part) => part && part !== '.' && part !== '..'), `Bundle file path contains traversal: ${value}`);
}

function validateManifestSchema(manifest) {
  assertExactFields(manifest, REGISTRY_BUNDLE_MANIFEST_FIELDS, 'bundle manifest');
  assert(manifest.schemaVersion === REGISTRY_BUNDLE_SCHEMA_VERSION, `Unsupported bundle manifest schemaVersion: ${manifest.schemaVersion}`);
  assert(manifest.status === 'passed' || manifest.status === 'failed', 'bundle manifest status must be passed or failed.');
  for (const field of ['package', 'version', 'expectedTag', 'reportFile', 'reportSha256', 'stdoutFile', 'stdoutSha256', 'tarballFile', 'tarballIntegrity', 'tarballShasum']) {
    assert(typeof manifest[field] === 'string' && manifest[field].length > 0, `bundle manifest ${field} must be a non-empty string.`);
  }
  assert(/^[0-9a-f]{64}$/.test(manifest.reportSha256), 'bundle manifest reportSha256 must be lowercase SHA-256.');
  assert(/^[0-9a-f]{64}$/.test(manifest.stdoutSha256), 'bundle manifest stdoutSha256 must be lowercase SHA-256.');
  assert(/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(manifest.tarballIntegrity), 'bundle manifest tarballIntegrity must be sha512 SRI.');
  assert(/^[0-9a-f]{40}$/.test(manifest.tarballShasum), 'bundle manifest tarballShasum must be lowercase SHA-1.');
  for (const field of ['fileCount', 'packageSize', 'unpackedSize']) {
    assert(Number.isSafeInteger(manifest[field]) && manifest[field] >= 0, `bundle manifest ${field} must be a non-negative safe integer.`);
  }
  assert(manifest.error === null || typeof manifest.error === 'string', 'bundle manifest error must be null or a string.');
}

function validateRegistryReportSchema(report) {
  assertExactFields(report, REGISTRY_REPORT_FIELDS, 'registry provenance report');
  assert(report.schemaVersion === REGISTRY_REPORT_SCHEMA_VERSION, `Unsupported registry report schemaVersion: ${report.schemaVersion}`);
  assert(report.status === 'passed' || report.status === 'failed', 'registry provenance status must be passed or failed.');
  for (const field of ['package', 'requestedVersion', 'resolvedVersion', 'expectedTag', 'tagVersion', 'publishedAt', 'tarball', 'integrity', 'shasum', 'readmeStatus']) {
    assert(typeof report[field] === 'string' && report[field].length > 0, `registry provenance ${field} must be a non-empty string.`);
  }
  for (const field of ['fileCount', 'packageSize', 'unpackedSize']) {
    assert(Number.isSafeInteger(report[field]) && report[field] >= 0, `registry provenance ${field} must be a non-negative safe integer.`);
  }
  assert(Array.isArray(report.forbiddenFiles) && report.forbiddenFiles.every((value) => typeof value === 'string'), 'registry provenance forbiddenFiles must be a string array.');
  assert(typeof report.registryInstallSmoke === 'boolean', 'registry provenance registryInstallSmoke must be boolean.');
  assert(report.error === null || typeof report.error === 'string', 'registry provenance error must be null or a string.');
}

function validateManifestReportAgreement(manifest, report) {
  for (const [manifestField, reportField] of [
    ['status', 'status'],
    ['package', 'package'],
    ['version', 'resolvedVersion'],
    ['expectedTag', 'expectedTag'],
    ['tarballIntegrity', 'integrity'],
    ['tarballShasum', 'shasum'],
    ['fileCount', 'fileCount'],
    ['packageSize', 'packageSize'],
    ['unpackedSize', 'unpackedSize'],
    ['error', 'error'],
  ]) {
    assert(manifest[manifestField] === report[reportField], `bundle manifest ${manifestField} does not match registry report ${reportField}.`);
  }
}

function parseCanonicalJson(bytes, canonicalize, label) {
  const value = parseJson(bytes, label);
  const canonical = Buffer.from(canonicalize(value), 'utf8');
  assert(bytes.equals(canonical), `${label} is not canonical JSON.`);
  return value;
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes));
  } catch (error) {
    throw new Error(`Could not parse ${label}: ${error.message}`);
  }
}

function assertExactFields(value, expectedFields, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
  assert(
    JSON.stringify(Object.keys(value)) === JSON.stringify(expectedFields),
    `${label} fields must be exactly: ${expectedFields.join(', ')}.`
  );
}

function tarHeaderPath(header) {
  const name = nulTerminated(header.subarray(0, 100));
  const prefix = nulTerminated(header.subarray(345, 500));
  return prefix ? `${prefix}/${name}` : name;
}

function validateTarPath(value) {
  assert(typeof value === 'string' && value.length > 0, 'Tarball entry path must not be empty.');
  assert(!value.includes('\\'), `Tarball entry path must use POSIX separators: ${value}`);
  assert(!path.posix.isAbsolute(value), `Tarball entry path must be relative: ${value}`);
  const parts = value.split('/').filter(Boolean);
  assert(parts.every((part) => part !== '.' && part !== '..'), `Tarball entry path contains traversal: ${value}`);
}

function validateTarHeaderChecksum(header) {
  const expected = parseTarNumber(header.subarray(148, 156), 'checksum');
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 32 : header[index];
  }
  assert(actual === expected, 'Tarball header checksum mismatch.');
}

function parseTarNumber(bytes, label) {
  assert((bytes[0] & 0x80) === 0, `Tarball ${label} uses unsupported base-256 encoding.`);
  const value = nulTerminated(bytes).trim().replace(/\0/g, '');
  if (!value) return 0;
  assert(/^[0-7]+$/.test(value), `Tarball ${label} is not octal.`);
  const parsed = Number.parseInt(value, 8);
  assert(Number.isSafeInteger(parsed) && parsed >= 0, `Tarball ${label} is out of range.`);
  return parsed;
}

function parsePax(bytes) {
  const text = bytes.toString('utf8');
  const values = {};
  let offset = 0;
  while (offset < text.length) {
    const space = text.indexOf(' ', offset);
    assert(space > offset, 'PAX record is missing a length.');
    const length = Number(text.slice(offset, space));
    assert(Number.isSafeInteger(length) && length > 0, 'PAX record length is invalid.');
    const record = text.slice(space + 1, offset + length);
    assert(record.endsWith('\n'), 'PAX record is missing a newline.');
    const equals = record.indexOf('=');
    assert(equals > 0, 'PAX record is missing an equals sign.');
    values[record.slice(0, equals)] = record.slice(equals + 1, -1);
    offset += length;
  }
  assert(offset === text.length, 'PAX records do not fill the entry.');
  return values;
}

function nulTerminated(bytes) {
  const zero = bytes.indexOf(0);
  return bytes.subarray(0, zero === -1 ? bytes.length : zero).toString('utf8');
}

function isWithin(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
