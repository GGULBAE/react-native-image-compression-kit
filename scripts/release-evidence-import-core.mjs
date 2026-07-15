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
import { REGISTRY_BUNDLE_FILES } from './registry-provenance-core.mjs';
import {
  RELEASE_EVIDENCE_ARTIFACT_FIELDS,
  RELEASE_EVIDENCE_ATTESTATION_DIR,
  RELEASE_EVIDENCE_ATTESTATION_FIELDS,
  RELEASE_EVIDENCE_ATTESTATION_FILES,
  RELEASE_EVIDENCE_FILE_PATHS,
  RELEASE_EVIDENCE_INDEX_FILE,
  RELEASE_EVIDENCE_POLICIES,
  RELEASE_EVIDENCE_PROVENANCE_DIR,
  RELEASE_EVIDENCE_RUN_FIELDS,
  canonicalReleaseEvidenceIndex,
  releaseEvidenceDigest,
  sha256,
  verifyReleaseEvidenceArchive,
} from './release-evidence-core.mjs';

export const RELEASE_EVIDENCE_IMPORT_METADATA_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_IMPORT_REPORT_SCHEMA_VERSION = 1;

export const RELEASE_EVIDENCE_IMPORT_METADATA_FIELDS = Object.freeze([
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
  'error',
]);

export const RELEASE_EVIDENCE_IMPORT_REPORT_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'archiveDir',
  'package',
  'version',
  'expectedTag',
  'evidenceSha256',
  'sourceDigest',
  'fileCount',
  'checks',
  'error',
]);

export const RELEASE_EVIDENCE_IMPORT_CHECK_FIELDS = Object.freeze([
  'metadata',
  'provenanceArtifact',
  'attestationArtifact',
  'index',
  'verification',
  'atomicWrite',
]);

export function canonicalReleaseEvidenceImportMetadata(metadata) {
  return `${JSON.stringify(metadata)}\n`;
}

export function canonicalReleaseEvidenceImportReport(report) {
  return `${JSON.stringify(report)}\n`;
}

export function createReleaseEvidenceImportMetadata({ version }) {
  const policy = RELEASE_EVIDENCE_POLICIES[version];
  assert(
    policy,
    `No committed release evidence policy exists for version ${version}.`
  );
  return {
    schemaVersion: RELEASE_EVIDENCE_IMPORT_METADATA_SCHEMA_VERSION,
    status: 'passed',
    package: policy.package,
    version,
    expectedTag: policy.expectedTag,
    publishedAt: policy.publishedAt,
    repository: policy.repository,
    workflow: policy.workflow,
    sourceRef: policy.sourceRef,
    sourceDigest: policy.sourceDigest,
    registryValidationRun: { ...policy.registryValidationRun },
    provenanceArtifact: { ...policy.provenanceArtifact },
    attestation: { ...policy.attestation },
    attestationArtifact: { ...policy.attestationArtifact },
    error: null,
  };
}

export function createReleaseEvidenceImportReport({
  archiveDir = null,
  packageName = null,
  version = null,
  expectedTag = null,
  evidenceSha256 = null,
  sourceDigest = null,
  fileCount = 0,
  checks = {},
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: RELEASE_EVIDENCE_IMPORT_REPORT_SCHEMA_VERSION,
    status,
    archiveDir,
    package: packageName,
    version,
    expectedTag,
    evidenceSha256,
    sourceDigest,
    fileCount,
    checks: Object.fromEntries(
      RELEASE_EVIDENCE_IMPORT_CHECK_FIELDS.map((field) => [
        field,
        checks[field] === true,
      ])
    ),
    error,
  };
}

export function importReleaseEvidenceArchive(
  {
    provenanceArtifactDir,
    attestationArtifactDir,
    metadataFile,
    archiveDir,
    expectedVersion,
  },
  dependencies = {}
) {
  const destination = archiveDir ? path.resolve(archiveDir) : null;
  const state = {
    archiveDir: destination,
    packageName: null,
    version: expectedVersion ?? null,
    expectedTag: null,
    evidenceSha256: null,
    sourceDigest: null,
    fileCount: 0,
    checks: {},
  };
  const operations = {
    exists: dependencies.exists ?? existsSync,
    mkdir: dependencies.mkdir ?? mkdirSync,
    rename: dependencies.rename ?? renameSync,
    remove: dependencies.remove ?? rmSync,
    writeFile: dependencies.writeFile ?? writeFileSync,
  };
  let temporary = null;

  try {
    assert(provenanceArtifactDir, 'Missing provenance artifact directory.');
    assert(attestationArtifactDir, 'Missing attestation artifact directory.');
    assert(metadataFile, 'Missing GitHub metadata file.');
    assert(archiveDir, 'Missing release evidence archive destination.');
    assert(expectedVersion, 'Missing --version.');
    assert(
      !operations.exists(destination),
      `Release evidence archive destination already exists: ${destination}`
    );

    const metadataBytes = readSecureFile(metadataFile, 'GitHub metadata file');
    const metadata = parseCanonicalMetadata(metadataBytes);
    validateMetadata(metadata);
    assert(
      metadata.version === expectedVersion,
      `Expected metadata version ${expectedVersion}, got ${metadata.version}.`
    );
    const expectedMetadata = createReleaseEvidenceImportMetadata({
      version: expectedVersion,
    });
    assert(
      JSON.stringify(metadata) === JSON.stringify(expectedMetadata),
      `GitHub metadata does not match the committed ${expectedVersion} release evidence policy.`
    );
    state.packageName = metadata.package;
    state.version = metadata.version;
    state.expectedTag = metadata.expectedTag;
    state.sourceDigest = metadata.sourceDigest;
    state.checks.metadata = true;

    const provenanceFiles = readExactArtifact(
      provenanceArtifactDir,
      Object.values(REGISTRY_BUNDLE_FILES),
      'Provenance artifact'
    );
    state.checks.provenanceArtifact = true;
    const attestationFiles = readExactArtifact(
      attestationArtifactDir,
      RELEASE_EVIDENCE_ATTESTATION_FILES,
      'Attestation artifact'
    );
    state.checks.attestationArtifact = true;

    const parent = path.dirname(destination);
    operations.mkdir(parent, { recursive: true });
    temporary = path.join(
      parent,
      `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`
    );
    operations.mkdir(temporary, { recursive: false });
    const provenanceDestination = path.join(
      temporary,
      RELEASE_EVIDENCE_PROVENANCE_DIR
    );
    const attestationDestination = path.join(
      temporary,
      RELEASE_EVIDENCE_ATTESTATION_DIR
    );
    operations.mkdir(provenanceDestination, { recursive: false });
    operations.mkdir(attestationDestination, { recursive: false });

    for (const [file, bytes] of provenanceFiles) {
      operations.writeFile(path.join(provenanceDestination, file), bytes, {
        flag: 'wx',
      });
    }
    for (const [file, bytes] of attestationFiles) {
      operations.writeFile(path.join(attestationDestination, file), bytes, {
        flag: 'wx',
      });
    }

    const files = RELEASE_EVIDENCE_FILE_PATHS.map((relativePath) => {
      const bytes = readFileSync(path.join(temporary, relativePath));
      return {
        path: relativePath,
        size: bytes.length,
        sha256: sha256(bytes),
      };
    });
    const index = createIndexFromMetadata(metadata, files);
    operations.writeFile(
      path.join(temporary, RELEASE_EVIDENCE_INDEX_FILE),
      canonicalReleaseEvidenceIndex(index),
      { encoding: 'utf8', flag: 'wx' }
    );
    state.evidenceSha256 = index.evidenceSha256;
    state.fileCount = files.length;
    state.checks.index = true;

    const verifyArchive =
      dependencies.verifyArchive ?? verifyReleaseEvidenceArchive;
    const verification = verifyArchive({
      archiveDir: temporary,
      expectedVersion,
    });
    assert(
      verification?.status === 'passed',
      `Imported archive verification failed: ${verification?.error ?? 'unknown error'}`
    );
    assert(
      verification.evidenceSha256 === index.evidenceSha256,
      'Imported archive verification returned a different evidence SHA-256.'
    );
    state.checks.verification = true;

    operations.rename(temporary, destination);
    temporary = null;
    state.checks.atomicWrite = true;
    return createReleaseEvidenceImportReport({
      ...state,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    if (temporary) {
      operations.remove(temporary, { recursive: true, force: true });
    }
    return createReleaseEvidenceImportReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function createIndexFromMetadata(metadata, files) {
  return {
    schemaVersion: 1,
    status: 'passed',
    package: metadata.package,
    version: metadata.version,
    expectedTag: metadata.expectedTag,
    publishedAt: metadata.publishedAt,
    repository: metadata.repository,
    workflow: metadata.workflow,
    sourceRef: metadata.sourceRef,
    sourceDigest: metadata.sourceDigest,
    registryValidationRun: { ...metadata.registryValidationRun },
    provenanceArtifact: { ...metadata.provenanceArtifact },
    attestation: { ...metadata.attestation },
    attestationArtifact: { ...metadata.attestationArtifact },
    files,
    evidenceSha256: releaseEvidenceDigest(files),
    error: null,
  };
}

function readExactArtifact(directoryPath, expectedFiles, label) {
  const directory = validateDirectory(directoryPath, label);
  const actual = readdirSync(directory).sort();
  const expected = [...expectedFiles].sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} must contain exactly: ${expected.join(', ')}.`
  );
  return expectedFiles.map((file) => [
    file,
    readSecureFile(path.join(directory, file), `${label} file ${file}`),
  ]);
}

function parseCanonicalMetadata(bytes) {
  let metadata;
  try {
    metadata = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Could not parse GitHub metadata: ${error.message}`);
  }
  assertRecord(metadata, 'GitHub metadata');
  assert(
    bytes.equals(
      Buffer.from(canonicalReleaseEvidenceImportMetadata(metadata), 'utf8')
    ),
    'GitHub metadata is not canonical JSON.'
  );
  return metadata;
}

function validateMetadata(metadata) {
  assertExactFields(
    metadata,
    RELEASE_EVIDENCE_IMPORT_METADATA_FIELDS,
    'GitHub metadata'
  );
  assert(
    metadata.schemaVersion === RELEASE_EVIDENCE_IMPORT_METADATA_SCHEMA_VERSION,
    `Unsupported GitHub metadata schemaVersion: ${metadata.schemaVersion}`
  );
  assert(metadata.status === 'passed', 'GitHub metadata status must be passed.');
  assert(metadata.error === null, 'GitHub metadata error must be null.');
  assertRecord(metadata.registryValidationRun, 'registry validation run');
  assertExactFields(
    metadata.registryValidationRun,
    RELEASE_EVIDENCE_RUN_FIELDS,
    'registry validation run'
  );
  for (const [value, label] of [
    [metadata.provenanceArtifact, 'provenance artifact'],
    [metadata.attestationArtifact, 'attestation artifact'],
  ]) {
    assertRecord(value, label);
    assertExactFields(value, RELEASE_EVIDENCE_ARTIFACT_FIELDS, label);
  }
  assertRecord(metadata.attestation, 'attestation');
  assertExactFields(
    metadata.attestation,
    RELEASE_EVIDENCE_ATTESTATION_FIELDS,
    'attestation'
  );
}

function validateDirectory(directoryPath, label) {
  const stats = lstatSync(directoryPath);
  assert(!stats.isSymbolicLink(), `${label} must not be a symbolic link.`);
  assert(stats.isDirectory(), `${label} must be a directory.`);
  return realpathSync(directoryPath);
}

function readSecureFile(filePath, label) {
  const stats = lstatSync(filePath);
  assert(!stats.isSymbolicLink(), `${label} must not be a symbolic link.`);
  assert(stats.isFile(), `${label} must be a regular file.`);
  return readFileSync(realpathSync(filePath));
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
