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
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import {
  RELEASE_EVIDENCE_ACQUISITION_FILE_FIELDS,
  RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FIELDS,
  RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FILE,
  RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE,
  canonicalReleaseEvidenceAcquisitionManifest,
} from './release-evidence-acquisition-core.mjs';
import {
  RELEASE_EVIDENCE_ARTIFACT_FIELDS,
  RELEASE_EVIDENCE_ATTESTATION_FIELDS,
  RELEASE_EVIDENCE_ATTESTATION_FILES,
  RELEASE_EVIDENCE_FILE_PATHS,
  RELEASE_EVIDENCE_POLICIES,
  RELEASE_EVIDENCE_RUN_FIELDS,
  releaseEvidenceDigest,
  sha256,
  verifyReleaseEvidenceArchive,
} from './release-evidence-core.mjs';
import {
  RELEASE_EVIDENCE_IMPORT_METADATA_FIELDS,
  canonicalReleaseEvidenceImportMetadata,
  importReleaseEvidenceArchive,
} from './release-evidence-import-core.mjs';
import {
  verifyReleaseEvidenceSet,
} from './release-evidence-set-core.mjs';
import { REGISTRY_BUNDLE_FILES } from './registry-provenance-core.mjs';

export const RELEASE_EVIDENCE_POLICY_CANDIDATE_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_POLICY_REPORT_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_POLICY_PROMOTION_SCHEMA_VERSION = 1;

export const RELEASE_EVIDENCE_POLICY_FIELDS = Object.freeze([
  'package',
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
]);

export const RELEASE_EVIDENCE_POLICY_CANDIDATE_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'version',
  'policy',
  'source',
  'error',
]);

export const RELEASE_EVIDENCE_POLICY_SOURCE_FIELDS = Object.freeze([
  'acquisitionManifest',
  'acquisitionManifestSha256',
  'acquisitionSha256',
  'metadataFile',
  'metadataSha256',
]);

export const RELEASE_EVIDENCE_POLICY_CHANGE_FIELDS = Object.freeze([
  'path',
  'committed',
  'candidate',
]);

export const RELEASE_EVIDENCE_POLICY_REPORT_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'acquisitionDir',
  'candidateFile',
  'version',
  'candidateSha256',
  'policyStatus',
  'changes',
  'checks',
  'error',
]);

export const RELEASE_EVIDENCE_POLICY_CHECK_FIELDS = Object.freeze([
  'layout',
  'manifest',
  'metadata',
  'evidence',
  'candidate',
  'diff',
  'atomicWrite',
]);

export const RELEASE_EVIDENCE_POLICY_PROMOTION_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'archiveDir',
  'package',
  'version',
  'candidateSha256',
  'reviewer',
  'reviewedAt',
  'evidenceSha256',
  'setVersions',
  'checks',
  'error',
]);

export const RELEASE_EVIDENCE_POLICY_PROMOTION_CHECK_FIELDS = Object.freeze([
  'candidate',
  'review',
  'policy',
  'duplicate',
  'import',
  'set',
  'atomicWrite',
]);

const SHA256 = /^[0-9a-f]{64}$/;
const ACQUISITION_ROOT_ENTRIES = Object.freeze([
  RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FILE,
  'attestation',
  'provenance',
  RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE,
]);
const ACQUISITION_FILE_PATHS = Object.freeze([
  RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE,
  ...RELEASE_EVIDENCE_FILE_PATHS,
]);

export function canonicalReleaseEvidencePolicyCandidate(candidate) {
  return `${JSON.stringify(candidate)}\n`;
}

export function canonicalReleaseEvidencePolicyReport(report) {
  return `${JSON.stringify(report)}\n`;
}

export function canonicalReleaseEvidencePolicyPromotion(report) {
  return `${JSON.stringify(report)}\n`;
}

export function createReleaseEvidencePolicyReport({
  acquisitionDir = null,
  candidateFile = null,
  version = null,
  candidateSha256 = null,
  policyStatus = null,
  changes = [],
  checks = {},
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: RELEASE_EVIDENCE_POLICY_REPORT_SCHEMA_VERSION,
    status,
    acquisitionDir,
    candidateFile,
    version,
    candidateSha256,
    policyStatus,
    changes: changes.map((change) => ({
      path: change.path,
      committed: change.committed,
      candidate: change.candidate,
    })),
    checks: orderedChecks(RELEASE_EVIDENCE_POLICY_CHECK_FIELDS, checks),
    error,
  };
}

export function createReleaseEvidencePolicyPromotionReport({
  archiveDir = null,
  packageName = null,
  version = null,
  candidateSha256 = null,
  reviewer = null,
  reviewedAt = null,
  evidenceSha256 = null,
  setVersions = [],
  checks = {},
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: RELEASE_EVIDENCE_POLICY_PROMOTION_SCHEMA_VERSION,
    status,
    archiveDir,
    package: packageName,
    version,
    candidateSha256,
    reviewer,
    reviewedAt,
    evidenceSha256,
    setVersions: [...setVersions],
    checks: orderedChecks(RELEASE_EVIDENCE_POLICY_PROMOTION_CHECK_FIELDS, checks),
    error,
  };
}

export function compareReleaseEvidencePolicy(candidatePolicy, committedPolicy) {
  validatePolicyShape(candidatePolicy, 'candidate policy');
  if (committedPolicy === undefined || committedPolicy === null) {
    return {
      status: 'missing',
      changes: diffValues(undefined, candidatePolicy),
    };
  }
  const changes = diffValues(committedPolicy, candidatePolicy);
  return {
    status: changes.length === 0 ? 'match' : 'drift',
    changes,
  };
}

export function prepareReleaseEvidencePolicyCandidate(
  { acquisitionDir, candidateFile },
  dependencies = {}
) {
  const resolvedAcquisition = acquisitionDir
    ? path.resolve(acquisitionDir)
    : null;
  const resolvedCandidate = candidateFile ? path.resolve(candidateFile) : null;
  const state = {
    acquisitionDir: resolvedAcquisition,
    candidateFile: resolvedCandidate,
    version: null,
    candidateSha256: null,
    policyStatus: null,
    changes: [],
    checks: {},
  };
  const operations = fileOperations(dependencies);
  let temporary = null;

  try {
    assert(acquisitionDir, 'Missing acquisition bundle directory.');
    assert(candidateFile, 'Missing policy candidate destination.');
    assertPathOutside(
      resolvedCandidate,
      resolvedAcquisition,
      'Policy candidate destination must be outside the acquisition bundle.'
    );
    assert(
      !operations.exists(resolvedCandidate),
      `Policy candidate destination already exists: ${resolvedCandidate}`
    );

    const inspection = inspectReleaseEvidenceAcquisitionBundle(
      { acquisitionDir: resolvedAcquisition },
      dependencies
    );
    Object.assign(state.checks, inspection.checks);
    const candidate = inspection.candidate;
    const candidateBytes = Buffer.from(
      canonicalReleaseEvidencePolicyCandidate(candidate),
      'utf8'
    );
    state.version = candidate.version;
    state.candidateSha256 = sha256(candidateBytes);
    state.checks.candidate = true;

    const policies = dependencies.policies ?? RELEASE_EVIDENCE_POLICIES;
    const comparison = compareReleaseEvidencePolicy(
      candidate.policy,
      policies[candidate.version]
    );
    state.policyStatus = comparison.status;
    state.changes = comparison.changes;
    state.checks.diff = true;

    const directory = path.dirname(resolvedCandidate);
    operations.mkdir(directory, { recursive: true });
    temporary = temporaryPath(resolvedCandidate, 'candidate');
    operations.writeFile(temporary, candidateBytes, { flag: 'wx' });
    operations.rename(temporary, resolvedCandidate);
    temporary = null;
    state.checks.atomicWrite = true;

    return createReleaseEvidencePolicyReport({
      ...state,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    if (temporary) operations.remove(temporary, { force: true });
    return createReleaseEvidencePolicyReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function promoteReleaseEvidencePolicyCandidate(
  {
    acquisitionDir,
    candidateFile,
    expectedVersion,
    reviewedCandidateSha256,
    reviewer,
    reviewedAt,
    approved,
    archiveRoot,
  },
  dependencies = {}
) {
  const destination =
    archiveRoot && expectedVersion
      ? path.resolve(archiveRoot, expectedVersion)
      : null;
  const state = {
    archiveDir: destination,
    packageName: null,
    version: expectedVersion ?? null,
    candidateSha256: null,
    reviewer: reviewer ?? null,
    reviewedAt: reviewedAt ?? null,
    evidenceSha256: null,
    setVersions: [],
    checks: {},
  };
  const operations = fileOperations(dependencies);
  let stagedArchive = null;

  try {
    assert(acquisitionDir, 'Missing acquisition bundle directory.');
    assert(candidateFile, 'Missing reviewed policy candidate file.');
    assert(expectedVersion, 'Missing explicit promotion version.');
    assert(archiveRoot, 'Missing explicit release evidence archive root.');
    assertNoPathOverlap(
      destination,
      path.resolve(acquisitionDir),
      'Promotion archive and acquisition bundle must not overlap.'
    );
    assertPathOutside(
      path.resolve(candidateFile),
      destination,
      'Reviewed candidate must be outside the promotion archive.'
    );

    const inspection = inspectReleaseEvidenceAcquisitionBundle(
      { acquisitionDir: path.resolve(acquisitionDir) },
      dependencies
    );
    const candidateBytes = readSecureFile(
      path.resolve(candidateFile),
      'reviewed policy candidate'
    );
    const candidate = parseCanonicalCandidate(candidateBytes);
    assert(
      isDeepStrictEqual(candidate, inspection.candidate),
      'Reviewed policy candidate does not match the acquisition bundle.'
    );
    assert(
      candidate.version === expectedVersion,
      `Expected reviewed candidate version ${expectedVersion}, got ${candidate.version}.`
    );
    state.packageName = candidate.policy.package;
    state.version = candidate.version;
    state.candidateSha256 = sha256(candidateBytes);
    state.checks.candidate = true;

    assert(approved === true, 'Promotion requires explicit --approve.');
    assert(
      typeof reviewedCandidateSha256 === 'string' &&
        SHA256.test(reviewedCandidateSha256),
      'Reviewed candidate SHA-256 must be an explicit lowercase 64-character digest.'
    );
    assert(
      reviewedCandidateSha256 === state.candidateSha256,
      'Reviewed candidate SHA-256 does not match the candidate bytes.'
    );
    assert(
      typeof reviewer === 'string' &&
        reviewer.length > 0 &&
        reviewer === reviewer.trim() &&
        !/[\u0000-\u001f\u007f]/.test(reviewer),
      'Promotion reviewer must be explicit.'
    );
    requireIsoTimestamp(reviewedAt, 'Promotion reviewedAt');
    assert(
      Date.parse(reviewedAt) >=
        Date.parse(candidate.policy.registryValidationRun.completedAt),
      'Promotion review timestamp must not precede Registry Validation completion.'
    );
    state.checks.review = true;

    const policies = dependencies.policies ?? RELEASE_EVIDENCE_POLICIES;
    const comparison = compareReleaseEvidencePolicy(
      candidate.policy,
      policies[candidate.version]
    );
    assert(
      comparison.status === 'match',
      `Reviewed candidate is not the committed ${candidate.version} policy (${comparison.status}).`
    );
    state.checks.policy = true;

    assert(
      !operations.exists(destination),
      `Release evidence archive version already exists: ${destination}`
    );
    state.checks.duplicate = true;
    const root = path.resolve(archiveRoot);
    operations.mkdir(root, { recursive: true });
    stagedArchive = temporaryPath(destination, 'promotion');

    const importArchive =
      dependencies.importArchive ?? importReleaseEvidenceArchive;
    const imported = importArchive({
      provenanceArtifactDir: path.join(acquisitionDir, 'provenance'),
      attestationArtifactDir: path.join(acquisitionDir, 'attestation'),
      metadataFile: path.join(
        acquisitionDir,
        RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE
      ),
      archiveDir: stagedArchive,
      expectedVersion,
      expectedPolicy: candidate.policy,
    });
    assert(
      imported?.status === 'passed',
      `Reviewed candidate import failed: ${imported?.error ?? 'unknown error'}`
    );
    state.evidenceSha256 = imported.evidenceSha256;
    state.checks.import = true;

    const versions = Object.keys(policies).sort(compareVersions);
    const verifyArchive =
      dependencies.verifyArchive ?? verifyReleaseEvidenceArchive;
    const verifySet = dependencies.verifySet ?? verifyReleaseEvidenceSet;
    const setReport = verifySet(
      { archiveRoot: root, versions },
      {
        verifyArchive({ archiveDir, expectedVersion: selectedVersion }) {
          return verifyArchive({
            archiveDir:
              selectedVersion === candidate.version
                ? stagedArchive
                : archiveDir,
            expectedVersion: selectedVersion,
            expectedPolicy: policies[selectedVersion],
          });
        },
      }
    );
    assert(
      setReport?.status === 'passed',
      `Release evidence set verification failed: ${setReport?.error ?? 'unknown error'}`
    );
    state.setVersions = [...setReport.versions];
    state.checks.set = true;

    operations.rename(stagedArchive, destination);
    stagedArchive = null;
    state.checks.atomicWrite = true;
    return createReleaseEvidencePolicyPromotionReport({
      ...state,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    if (stagedArchive) {
      operations.remove(stagedArchive, { recursive: true, force: true });
    }
    return createReleaseEvidencePolicyPromotionReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function inspectReleaseEvidenceAcquisitionBundle(
  { acquisitionDir },
  dependencies = {}
) {
  const root = validateDirectory(acquisitionDir, 'acquisition bundle');
  assertExactEntries(
    readdirSync(root),
    ACQUISITION_ROOT_ENTRIES,
    'Acquisition bundle'
  );
  assertExactEntries(
    readdirSync(path.join(root, 'provenance')),
    Object.values(REGISTRY_BUNDLE_FILES),
    'Acquisition provenance directory'
  );
  assertExactEntries(
    readdirSync(path.join(root, 'attestation')),
    RELEASE_EVIDENCE_ATTESTATION_FILES,
    'Acquisition attestation directory'
  );
  const checks = { layout: true };

  const manifestBytes = readSecureFile(
    path.join(root, RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FILE),
    'acquisition manifest'
  );
  const manifest = parseJson(manifestBytes, 'acquisition manifest');
  assertExactFields(
    manifest,
    RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FIELDS,
    'Acquisition manifest'
  );
  assert(
    manifestBytes.equals(
      Buffer.from(canonicalReleaseEvidenceAcquisitionManifest(manifest), 'utf8')
    ),
    'Acquisition manifest is not canonical JSON.'
  );
  assert(manifest.status === 'passed', 'Acquisition manifest status must be passed.');
  assert(manifest.error === null, 'Acquisition manifest error must be null.');
  assert(
    manifest.metadataFile === RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE,
    'Acquisition manifest metadata file is not canonical.'
  );
  assert(Array.isArray(manifest.files), 'Acquisition manifest files must be an array.');
  assert(
    manifest.files.length === ACQUISITION_FILE_PATHS.length,
    `Acquisition manifest must describe exactly ${ACQUISITION_FILE_PATHS.length} files.`
  );
  assert(
    JSON.stringify(manifest.files.map((file) => file.path)) ===
      JSON.stringify(ACQUISITION_FILE_PATHS),
    'Acquisition manifest file order or paths are not canonical.'
  );
  for (const file of manifest.files) {
    assertExactFields(file, RELEASE_EVIDENCE_ACQUISITION_FILE_FIELDS, 'Acquisition file');
    const bytes = readSecureFile(
      path.join(root, file.path),
      `acquisition file ${file.path}`
    );
    assert(bytes.length === file.size, `Acquisition file size drift: ${file.path}`);
    assert(sha256(bytes) === file.sha256, `Acquisition file digest drift: ${file.path}`);
  }
  assert(
    releaseEvidenceDigest(manifest.files) === manifest.acquisitionSha256,
    'Acquisition aggregate SHA-256 does not match its file records.'
  );
  checks.manifest = true;

  const metadataBytes = readSecureFile(
    path.join(root, RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE),
    'acquisition metadata'
  );
  const metadata = parseJson(metadataBytes, 'acquisition metadata');
  assertExactFields(
    metadata,
    RELEASE_EVIDENCE_IMPORT_METADATA_FIELDS,
    'Acquisition metadata'
  );
  assert(
    metadataBytes.equals(
      Buffer.from(canonicalReleaseEvidenceImportMetadata(metadata), 'utf8')
    ),
    'Acquisition metadata is not canonical JSON.'
  );
  assert(sha256(metadataBytes) === manifest.metadataSha256, 'Acquisition metadata SHA-256 does not match the manifest.');
  assert(metadata.status === 'passed', 'Acquisition metadata status must be passed.');
  assert(metadata.error === null, 'Acquisition metadata error must be null.');
  assertMetadataMatchesManifest(metadata, manifest);
  checks.metadata = true;

  const policy = policyFromMetadata(metadata);
  const candidate = {
    schemaVersion: RELEASE_EVIDENCE_POLICY_CANDIDATE_SCHEMA_VERSION,
    status: 'passed',
    version: metadata.version,
    policy,
    source: {
      acquisitionManifest: RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FILE,
      acquisitionManifestSha256: sha256(manifestBytes),
      acquisitionSha256: manifest.acquisitionSha256,
      metadataFile: RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE,
      metadataSha256: manifest.metadataSha256,
    },
    error: null,
  };

  const handoff = dependencies.inspectionArchivePath
    ? path.resolve(dependencies.inspectionArchivePath(root))
    : temporaryPath(
        path.join(path.dirname(root), path.basename(root)),
        'candidate-handoff'
      );
  const importArchive =
    dependencies.importArchiveForInspection ?? importReleaseEvidenceArchive;
  try {
    const imported = importArchive({
      provenanceArtifactDir: path.join(root, 'provenance'),
      attestationArtifactDir: path.join(root, 'attestation'),
      metadataFile: path.join(root, RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE),
      archiveDir: handoff,
      expectedVersion: metadata.version,
      expectedPolicy: policy,
    });
    assert(
      imported?.status === 'passed',
      `Acquisition evidence replay failed: ${imported?.error ?? 'unknown error'}`
    );
    checks.evidence = true;
  } finally {
    rmSync(handoff, { recursive: true, force: true });
  }

  return { candidate, manifest, metadata, checks };
}

export function readReleaseEvidencePolicyCandidate(filePath) {
  return parseCanonicalCandidate(
    readSecureFile(path.resolve(filePath), 'policy candidate')
  );
}

export function writeReleaseEvidencePolicyReportAtomic(filePath, report, operations = {}) {
  writeCanonicalAtomic(
    filePath,
    canonicalReleaseEvidencePolicyReport(report),
    operations
  );
}

export function writeReleaseEvidencePolicyPromotionAtomic(filePath, report, operations = {}) {
  writeCanonicalAtomic(
    filePath,
    canonicalReleaseEvidencePolicyPromotion(report),
    operations
  );
}

function parseCanonicalCandidate(bytes) {
  const candidate = parseJson(bytes, 'policy candidate');
  assertExactFields(
    candidate,
    RELEASE_EVIDENCE_POLICY_CANDIDATE_FIELDS,
    'Policy candidate'
  );
  assert(
    bytes.equals(
      Buffer.from(canonicalReleaseEvidencePolicyCandidate(candidate), 'utf8')
    ),
    'Policy candidate is not canonical JSON.'
  );
  assert(
    candidate.schemaVersion === RELEASE_EVIDENCE_POLICY_CANDIDATE_SCHEMA_VERSION,
    `Unsupported policy candidate schemaVersion: ${candidate.schemaVersion}`
  );
  assert(candidate.status === 'passed', 'Policy candidate status must be passed.');
  assert(candidate.error === null, 'Policy candidate error must be null.');
  assert(typeof candidate.version === 'string' && candidate.version.length > 0, 'Policy candidate version is missing.');
  validatePolicyShape(candidate.policy, 'policy candidate');
  assertExactFields(candidate.source, RELEASE_EVIDENCE_POLICY_SOURCE_FIELDS, 'Policy candidate source');
  for (const field of [
    'acquisitionManifestSha256',
    'acquisitionSha256',
    'metadataSha256',
  ]) {
    assert(SHA256.test(candidate.source[field]), `Policy candidate ${field} must be SHA-256.`);
  }
  return candidate;
}

function policyFromMetadata(metadata) {
  return {
    package: metadata.package,
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
  };
}

function validatePolicyShape(policy, label) {
  assertRecord(policy, label);
  assertExactFields(policy, RELEASE_EVIDENCE_POLICY_FIELDS, label);
  assertExactFields(policy.registryValidationRun, RELEASE_EVIDENCE_RUN_FIELDS, `${label} run`);
  assertExactFields(policy.provenanceArtifact, RELEASE_EVIDENCE_ARTIFACT_FIELDS, `${label} provenance artifact`);
  assertExactFields(policy.attestation, RELEASE_EVIDENCE_ATTESTATION_FIELDS, `${label} attestation`);
  assertExactFields(policy.attestationArtifact, RELEASE_EVIDENCE_ARTIFACT_FIELDS, `${label} attestation artifact`);
}

function assertMetadataMatchesManifest(metadata, manifest) {
  const pairs = [
    ['package', metadata.package, manifest.package],
    ['version', metadata.version, manifest.version],
    ['expectedTag', metadata.expectedTag, manifest.expectedTag],
    ['repository', metadata.repository, manifest.repository],
    ['workflow', metadata.workflow, manifest.workflow],
    ['sourceRef', metadata.sourceRef, manifest.sourceRef],
    ['sourceDigest', metadata.sourceDigest, manifest.sourceDigest],
    ['runId', metadata.registryValidationRun.id, manifest.runId],
    ['provenanceArtifact', metadata.provenanceArtifact, manifest.provenanceArtifact],
    ['attestationArtifact', metadata.attestationArtifact, manifest.attestationArtifact],
    ['attestation', metadata.attestation, manifest.attestation],
  ];
  for (const [field, left, right] of pairs) {
    assert(isDeepStrictEqual(left, right), `Acquisition metadata ${field} does not match the manifest.`);
  }
}

function diffValues(committed, candidate, prefix = '') {
  if (isDeepStrictEqual(committed, candidate)) return [];
  if (isPlainObject(candidate)) {
    const candidateKeys = Object.keys(candidate);
    const extraKeys = isPlainObject(committed)
      ? Object.keys(committed)
          .filter((key) => !candidateKeys.includes(key))
          .sort()
      : [];
    return [...candidateKeys, ...extraKeys].flatMap((key) =>
      diffValues(
        isPlainObject(committed) ? committed[key] : undefined,
        candidate[key],
        prefix ? `${prefix}.${key}` : key
      )
    );
  }
  return [
    {
      path: prefix,
      committed: committed === undefined ? null : committed,
      candidate: candidate === undefined ? null : candidate,
    },
  ];
}

function writeCanonicalAtomic(filePath, contents, operations = {}) {
  const ops = fileOperations(operations);
  const destination = path.resolve(filePath);
  const directory = path.dirname(destination);
  const temporary = temporaryPath(destination, 'report');
  ops.mkdir(directory, { recursive: true });
  try {
    ops.writeFile(temporary, contents, { encoding: 'utf8', flag: 'wx' });
    ops.rename(temporary, destination);
  } catch (error) {
    ops.remove(temporary, { force: true });
    throw error;
  }
}

function fileOperations(dependencies) {
  return {
    exists: dependencies.exists ?? existsSync,
    mkdir: dependencies.mkdir ?? mkdirSync,
    rename: dependencies.rename ?? renameSync,
    remove: dependencies.remove ?? rmSync,
    writeFile: dependencies.writeFile ?? writeFileSync,
  };
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

function assertExactEntries(actual, expected, label) {
  assert(
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()),
    `${label} must contain exactly: ${[...expected].sort().join(', ')}.`
  );
}

function assertExactFields(value, fields, label) {
  assertRecord(value, label);
  assert(
    JSON.stringify(Object.keys(value)) === JSON.stringify(fields),
    `${label} fields must be exactly: ${fields.join(', ')}.`
  );
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function requireIsoTimestamp(value, label) {
  assert(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().startsWith(value.replace(/Z$/, '')),
    `${label} must be a canonical UTC ISO timestamp.`
  );
  return value;
}

function orderedChecks(fields, checks) {
  return Object.fromEntries(
    fields.map((field) => [field, checks[field] === true])
  );
}

function temporaryPath(destination, label) {
  return path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.${label}.tmp`
  );
}

function compareVersions(left, right) {
  return left.localeCompare(right, 'en', { numeric: true });
}

function assertPathOutside(candidate, directory, message) {
  if (candidate === directory || candidate.startsWith(`${directory}${path.sep}`)) {
    throw new Error(message);
  }
}

function assertNoPathOverlap(left, right, message) {
  const overlaps =
    left === right ||
    left.startsWith(`${right}${path.sep}`) ||
    right.startsWith(`${left}${path.sep}`);
  if (overlaps) throw new Error(message);
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function assertRecord(value, label) {
  assert(isPlainObject(value), `${label} must be an object.`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
