import { createHash } from 'node:crypto';
import {
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
import {
  REGISTRY_ATTESTATION_REPORT_FIELDS,
  canonicalRegistryAttestationReport,
} from './registry-attestation-core.mjs';
import {
  REGISTRY_BUNDLE_FILES,
  REGISTRY_REPORT_FIELDS,
  verifyRegistryProvenanceBundle,
} from './registry-provenance-core.mjs';
import { canonicalRegistryReport } from './registry-smoke-core.mjs';
import { runRegistryAttestationVerification } from './verify-registry-attestation.mjs';

export const RELEASE_EVIDENCE_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_VERIFICATION_SCHEMA_VERSION = 1;

export const RELEASE_EVIDENCE_INDEX_FILE = 'release-evidence-index.json';
export const RELEASE_EVIDENCE_PROVENANCE_DIR = 'provenance';
export const RELEASE_EVIDENCE_ATTESTATION_DIR = 'attestation';

export const RELEASE_EVIDENCE_ATTESTATION_FILES = Object.freeze([
  'attestation-verification.json',
  'attestation.jsonl',
  'trusted-root.jsonl',
]);

export const RELEASE_EVIDENCE_FILE_PATHS = Object.freeze([
  ...RELEASE_EVIDENCE_ATTESTATION_FILES.map(
    (file) => `${RELEASE_EVIDENCE_ATTESTATION_DIR}/${file}`
  ),
  ...Object.values(REGISTRY_BUNDLE_FILES)
    .sort()
    .map((file) => `${RELEASE_EVIDENCE_PROVENANCE_DIR}/${file}`),
]);

export const RELEASE_EVIDENCE_INDEX_FIELDS = Object.freeze([
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

export const RELEASE_EVIDENCE_RUN_FIELDS = Object.freeze([
  'id',
  'url',
  'event',
  'createdAt',
  'completedAt',
]);

export const RELEASE_EVIDENCE_ARTIFACT_FIELDS = Object.freeze([
  'id',
  'name',
  'digest',
  'size',
  'createdAt',
  'expiresAt',
]);

export const RELEASE_EVIDENCE_ATTESTATION_FIELDS = Object.freeze([
  'id',
  'url',
  'verifiedAt',
]);

export const RELEASE_EVIDENCE_FILE_FIELDS = Object.freeze([
  'path',
  'size',
  'sha256',
]);

export const RELEASE_EVIDENCE_VERIFICATION_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'archiveDir',
  'package',
  'version',
  'expectedTag',
  'evidenceSha256',
  'provenanceReportSha256',
  'manifestSha256',
  'attestationReportSha256',
  'sourceDigest',
  'checks',
  'error',
]);

export const RELEASE_EVIDENCE_CHECK_FIELDS = Object.freeze([
  'layout',
  'index',
  'files',
  'provenance',
  'attestation',
  'identity',
  'timestamps',
]);

export const RELEASE_EVIDENCE_POLICIES = Object.freeze({
  '0.2.50': Object.freeze({
    package: 'react-native-image-compression-kit',
    expectedTag: 'latest',
    publishedAt: '2026-07-14T06:05:27.963Z',
    repository: 'GGULBAE/react-native-image-compression-kit',
    workflow:
      'GGULBAE/react-native-image-compression-kit/.github/workflows/registry-validation.yml',
    sourceRef: 'refs/heads/master',
    sourceDigest: '2b198c5f6125de6ad5bae76fc835ff5b935984f0',
    registryValidationRun: Object.freeze({
      id: 29310375801,
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29310375801',
      event: 'workflow_dispatch',
      createdAt: '2026-07-14T06:06:29Z',
      completedAt: '2026-07-14T06:07:18Z',
    }),
    provenanceArtifact: Object.freeze({
      id: 8301832057,
      name: 'registry-provenance-0.2.50',
      digest:
        'sha256:031302873239c74234179041e6b3f7ff8d6fe281351dfb93a3f5e4ed9573ec71',
      size: 70382,
      createdAt: '2026-07-14T06:07:14Z',
      expiresAt: '2026-10-12T06:06:31Z',
    }),
    attestation: Object.freeze({
      id: 35201998,
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/attestations/35201998',
      verifiedAt: '2026-07-14T06:07:06.000Z',
    }),
    attestationArtifact: Object.freeze({
      id: 8301832253,
      name: 'registry-provenance-attestation-0.2.50',
      digest:
        'sha256:01a74cc10cb2c89e309d58ddf83f285ada1a3ceb3af70e78b8cd70dc6c627cea',
      size: 15537,
      createdAt: '2026-07-14T06:07:15Z',
      expiresAt: '2026-10-12T06:06:31Z',
    }),
  }),
  '0.2.55': Object.freeze({
    package: 'react-native-image-compression-kit',
    expectedTag: 'latest',
    publishedAt: '2026-07-14T12:41:56.173Z',
    repository: 'GGULBAE/react-native-image-compression-kit',
    workflow:
      'GGULBAE/react-native-image-compression-kit/.github/workflows/registry-validation.yml',
    sourceRef: 'refs/heads/master',
    sourceDigest: '194e9387406f71763bc0d617ece0d7d58e235e29',
    registryValidationRun: Object.freeze({
      id: 29333540614,
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29333540614',
      event: 'workflow_dispatch',
      createdAt: '2026-07-14T12:42:46Z',
      completedAt: '2026-07-14T12:43:37Z',
    }),
    provenanceArtifact: Object.freeze({
      id: 8310985094,
      name: 'registry-provenance-0.2.55',
      digest:
        'sha256:7463b03ff6294b5017d9b3cad05d4c3ea87b542398a5cb70f503cea148dca826',
      size: 76792,
      createdAt: '2026-07-14T12:43:31Z',
      expiresAt: '2026-10-12T12:42:48Z',
    }),
    attestation: Object.freeze({
      id: 35257248,
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/attestations/35257248',
      verifiedAt: '2026-07-14T12:43:21.000Z',
    }),
    attestationArtifact: Object.freeze({
      id: 8310985646,
      name: 'registry-provenance-attestation-0.2.55',
      digest:
        'sha256:545c63da880d9d91f9ade1cf40ce36a366634c11ff524b87579e6b0fd6d8e28f',
      size: 15696,
      createdAt: '2026-07-14T12:43:33Z',
      expiresAt: '2026-10-12T12:42:48Z',
    }),
  }),
  '0.2.62': Object.freeze({
    package: 'react-native-image-compression-kit',
    expectedTag: 'latest',
    publishedAt: '2026-07-17T05:52:59.853Z',
    repository: 'GGULBAE/react-native-image-compression-kit',
    workflow:
      'GGULBAE/react-native-image-compression-kit/.github/workflows/registry-validation.yml',
    sourceRef: 'refs/tags/v0.2.62',
    sourceDigest: '43c157728ef345528053e2508e9aa9292457a55b',
    registryValidationRun: Object.freeze({
      id: 29558617089,
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29558617089',
      event: 'workflow_dispatch',
      createdAt: '2026-07-17T05:55:59Z',
      completedAt: '2026-07-17T05:56:54Z',
    }),
    provenanceArtifact: Object.freeze({
      id: 8398387031,
      name: 'registry-provenance-0.2.62',
      digest:
        'sha256:f76ff92c8e142a3bb2734dc60f7b332473201ee0d7350b41acf11e1c8e78bc99',
      size: 58045,
      createdAt: '2026-07-17T05:56:48Z',
      expiresAt: '2026-10-15T05:56:00Z',
    }),
    attestation: Object.freeze({
      id: 35774740,
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/attestations/35774740',
      verifiedAt: '2026-07-17T05:56:35.000Z',
    }),
    attestationArtifact: Object.freeze({
      id: 8398387418,
      name: 'registry-provenance-attestation-0.2.62',
      digest:
        'sha256:84608ed6f02ee9681dda8006e42f243af67e1e045231392a0e1dd9af8c8ec893',
      size: 15638,
      createdAt: '2026-07-17T05:56:49Z',
      expiresAt: '2026-10-15T05:56:00Z',
    }),
  }),
});

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalReleaseEvidenceFiles(files) {
  return `${JSON.stringify(files)}\n`;
}

export function releaseEvidenceDigest(files) {
  return sha256(canonicalReleaseEvidenceFiles(files));
}

export function canonicalReleaseEvidenceIndex(index) {
  return `${JSON.stringify(index)}\n`;
}

export function canonicalReleaseEvidenceVerification(report) {
  return `${JSON.stringify(report)}\n`;
}

export function createReleaseEvidenceIndex({ version, files, expectedPolicy }) {
  const policy = expectedPolicy ?? RELEASE_EVIDENCE_POLICIES[version];
  assert(policy, `No committed release evidence policy exists for version ${version}.`);
  return {
    schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
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
    files: files.map((file) => ({
      path: file.path,
      size: file.size,
      sha256: file.sha256,
    })),
    evidenceSha256: releaseEvidenceDigest(files),
    error: null,
  };
}

export function createReleaseEvidenceVerification({
  archiveDir = null,
  packageName = null,
  version = null,
  expectedTag = null,
  evidenceSha256 = null,
  provenanceReportSha256 = null,
  manifestSha256 = null,
  attestationReportSha256 = null,
  sourceDigest = null,
  checks = {},
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: RELEASE_EVIDENCE_VERIFICATION_SCHEMA_VERSION,
    status,
    archiveDir,
    package: packageName,
    version,
    expectedTag,
    evidenceSha256,
    provenanceReportSha256,
    manifestSha256,
    attestationReportSha256,
    sourceDigest,
    checks: Object.fromEntries(
      RELEASE_EVIDENCE_CHECK_FIELDS.map((field) => [
        field,
        checks[field] === true,
      ])
    ),
    error,
  };
}

export function verifyReleaseEvidenceArchive(
  { archiveDir, expectedVersion, expectedPolicy },
  dependencies = {}
) {
  const resolvedArchiveDir = archiveDir ? path.resolve(archiveDir) : null;
  const policy =
    expectedPolicy ??
    (expectedVersion ? RELEASE_EVIDENCE_POLICIES[expectedVersion] : null);
  const state = {
    archiveDir: resolvedArchiveDir,
    packageName: policy?.package ?? null,
    version: expectedVersion ?? null,
    expectedTag: policy?.expectedTag ?? null,
    evidenceSha256: null,
    provenanceReportSha256: null,
    manifestSha256: null,
    attestationReportSha256: null,
    sourceDigest: policy?.sourceDigest ?? null,
    checks: {},
  };

  try {
    assert(archiveDir, 'Missing release evidence archive directory.');
    assert(expectedVersion, 'Missing --version.');
    assert(
      policy,
      `No committed release evidence policy exists for version ${expectedVersion}.`
    );

    const root = validateDirectory(resolvedArchiveDir, 'release evidence archive');
    const rootEntries = readdirSync(root).sort();
    const expectedRootEntries = [
      RELEASE_EVIDENCE_ATTESTATION_DIR,
      RELEASE_EVIDENCE_INDEX_FILE,
      RELEASE_EVIDENCE_PROVENANCE_DIR,
    ].sort();
    assertExactEntries(rootEntries, expectedRootEntries, 'Archive root');

    const provenanceDir = validateDirectory(
      path.join(root, RELEASE_EVIDENCE_PROVENANCE_DIR),
      'provenance directory'
    );
    const attestationDir = validateDirectory(
      path.join(root, RELEASE_EVIDENCE_ATTESTATION_DIR),
      'attestation directory'
    );
    assertExactEntries(
      readdirSync(provenanceDir).sort(),
      Object.values(REGISTRY_BUNDLE_FILES).sort(),
      'Provenance directory'
    );
    assertExactEntries(
      readdirSync(attestationDir).sort(),
      [...RELEASE_EVIDENCE_ATTESTATION_FILES].sort(),
      'Attestation directory'
    );
    state.checks.layout = true;

    const indexBytes = readSecureFile(
      path.join(root, RELEASE_EVIDENCE_INDEX_FILE),
      'release evidence index'
    );
    const index = parseCanonicalIndex(indexBytes);
    validateIndexSchema(index);
    assert(
      index.version === expectedVersion,
      `Expected release evidence version ${expectedVersion}, got ${index.version}.`
    );

    const files = RELEASE_EVIDENCE_FILE_PATHS.map((relativePath) => {
      const bytes = readSecureFile(
        path.join(root, relativePath),
        `release evidence file ${relativePath}`
      );
      return {
        path: relativePath,
        size: bytes.length,
        sha256: sha256(bytes),
      };
    });
    const expectedIndex = createReleaseEvidenceIndex({
      version: expectedVersion,
      files,
      expectedPolicy: policy,
    });
    assertIndexMatches(index, expectedIndex);
    state.evidenceSha256 = expectedIndex.evidenceSha256;
    state.packageName = index.package;
    state.version = index.version;
    state.expectedTag = index.expectedTag;
    state.sourceDigest = index.sourceDigest;
    state.checks.index = true;
    state.checks.files = true;

    const verifyProvenance =
      dependencies.verifyProvenance ?? verifyRegistryProvenanceBundle;
    const provenance = verifyProvenance({
      artifactDir: provenanceDir,
      expectedPackage: index.package,
      expectedVersion: index.version,
      expectedTag: index.expectedTag,
    });
    assert(
      provenance?.status === 'passed',
      `Provenance verification failed: ${provenance?.error ?? 'unknown error'}`
    );
    state.provenanceReportSha256 = provenance.reportSha256;
    state.manifestSha256 = sha256(
      readSecureFile(
        path.join(provenanceDir, REGISTRY_BUNDLE_FILES.manifest),
        'bundle manifest'
      )
    );
    state.checks.provenance = true;

    const verifyAttestation =
      dependencies.verifyAttestation ?? runRegistryAttestationVerification;
    const attestation = verifyAttestation({
      manifestPath: path.join(
        provenanceDir,
        REGISTRY_BUNDLE_FILES.manifest
      ),
      attestationBundle: path.join(attestationDir, 'attestation.jsonl'),
      trustedRoot: path.join(attestationDir, 'trusted-root.jsonl'),
      expectedRepository: index.repository,
      expectedWorkflow: index.workflow,
      expectedRef: index.sourceRef,
      expectedHeadSha: index.sourceDigest,
    });
    assert(
      attestation?.status === 'passed',
      `Attestation verification failed: ${attestation?.error ?? 'unknown error'}`
    );
    const storedAttestationBytes = readSecureFile(
      path.join(attestationDir, 'attestation-verification.json'),
      'attestation verification report'
    );
    const storedAttestation = parseCanonicalAttestationReport(
      storedAttestationBytes
    );
    assert(
      storedAttestationBytes.equals(
        Buffer.from(canonicalRegistryAttestationReport(attestation), 'utf8')
      ),
      'Stored attestation verification report does not match offline replay.'
    );
    assert(
      attestation.subjectSha256 === state.manifestSha256,
      'Attestation subject SHA-256 does not match the canonical manifest.'
    );
    state.attestationReportSha256 = sha256(storedAttestationBytes);
    state.checks.attestation = true;

    const registryReportBytes = readSecureFile(
      path.join(provenanceDir, REGISTRY_BUNDLE_FILES.report),
      'registry provenance report'
    );
    const registryReport = parseCanonicalRegistryReport(registryReportBytes);
    assert(
      registryReport.publishedAt === index.publishedAt,
      'Registry publish timestamp does not match the release evidence index.'
    );
    assert(
      storedAttestation.repository === index.repository &&
        storedAttestation.signerWorkflow === index.workflow &&
        storedAttestation.sourceRef === index.sourceRef &&
        storedAttestation.sourceDigest === index.sourceDigest,
      'Stored attestation identity does not match the release evidence index.'
    );
    state.checks.identity = true;

    assert(
      storedAttestation.verifiedTimestamps.some(
        (timestamp) => timestamp.timestamp === index.attestation.verifiedAt
      ),
      'Attestation timestamp does not match the release evidence index.'
    );
    validateTimeline(index);
    state.checks.timestamps = true;

    return createReleaseEvidenceVerification({
      ...state,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    return createReleaseEvidenceVerification({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function writeReleaseEvidenceVerificationAtomic(
  filePath,
  report,
  operations = {}
) {
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
    writeFile(temporary, canonicalReleaseEvidenceVerification(report), {
      encoding: 'utf8',
      flag: 'wx',
    });
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { force: true });
    throw error;
  }
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

function parseCanonicalIndex(bytes) {
  let index;
  try {
    index = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Could not parse release evidence index: ${error.message}`);
  }
  assertRecord(index, 'release evidence index');
  assert(
    bytes.equals(Buffer.from(canonicalReleaseEvidenceIndex(index), 'utf8')),
    'release evidence index is not canonical JSON.'
  );
  return index;
}

function parseCanonicalRegistryReport(bytes) {
  let report;
  try {
    report = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Could not parse registry provenance report: ${error.message}`);
  }
  assertRecord(report, 'registry provenance report');
  assertExactFields(report, REGISTRY_REPORT_FIELDS, 'registry provenance report');
  assert(
    bytes.equals(Buffer.from(canonicalRegistryReport(report), 'utf8')),
    'registry provenance report is not canonical JSON.'
  );
  return report;
}

function parseCanonicalAttestationReport(bytes) {
  let report;
  try {
    report = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Could not parse attestation verification report: ${error.message}`);
  }
  assertRecord(report, 'attestation verification report');
  assertExactFields(
    report,
    REGISTRY_ATTESTATION_REPORT_FIELDS,
    'attestation verification report'
  );
  assert(
    bytes.equals(
      Buffer.from(canonicalRegistryAttestationReport(report), 'utf8')
    ),
    'attestation verification report is not canonical JSON.'
  );
  return report;
}

function validateIndexSchema(index) {
  assertExactFields(index, RELEASE_EVIDENCE_INDEX_FIELDS, 'release evidence index');
  assert(
    index.schemaVersion === RELEASE_EVIDENCE_SCHEMA_VERSION,
    `Unsupported release evidence schemaVersion: ${index.schemaVersion}`
  );
  assert(index.status === 'passed', 'Release evidence index status must be passed.');
  assert(index.error === null, 'Release evidence index error must be null.');
  assertRecord(index.registryValidationRun, 'registry validation run');
  assertExactFields(
    index.registryValidationRun,
    RELEASE_EVIDENCE_RUN_FIELDS,
    'registry validation run'
  );
  for (const [value, label] of [
    [index.provenanceArtifact, 'provenance artifact'],
    [index.attestationArtifact, 'attestation artifact'],
  ]) {
    assertRecord(value, label);
    assertExactFields(value, RELEASE_EVIDENCE_ARTIFACT_FIELDS, label);
  }
  assertRecord(index.attestation, 'attestation');
  assertExactFields(
    index.attestation,
    RELEASE_EVIDENCE_ATTESTATION_FIELDS,
    'attestation'
  );
  assert(Array.isArray(index.files), 'release evidence index files must be an array.');
  assert(
    index.files.length === RELEASE_EVIDENCE_FILE_PATHS.length,
    `release evidence index must describe exactly ${RELEASE_EVIDENCE_FILE_PATHS.length} files.`
  );
  for (const file of index.files) {
    assertRecord(file, 'release evidence file');
    assertExactFields(file, RELEASE_EVIDENCE_FILE_FIELDS, 'release evidence file');
  }
}

function assertIndexMatches(index, expected) {
  for (const field of RELEASE_EVIDENCE_INDEX_FIELDS) {
    assert(
      JSON.stringify(index[field]) === JSON.stringify(expected[field]),
      `Release evidence index ${field} does not match the committed ${index.version} policy or archived bytes.`
    );
  }
}

function validateTimeline(index) {
  const timestamps = [
    ['publishedAt', index.publishedAt],
    ['registryValidationRun.createdAt', index.registryValidationRun.createdAt],
    ['attestation.verifiedAt', index.attestation.verifiedAt],
    ['provenanceArtifact.createdAt', index.provenanceArtifact.createdAt],
    ['attestationArtifact.createdAt', index.attestationArtifact.createdAt],
    ['registryValidationRun.completedAt', index.registryValidationRun.completedAt],
  ];
  const parsed = timestamps.map(([label, value]) => {
    const time = Date.parse(value);
    assert(Number.isFinite(time), `${label} must be a valid timestamp.`);
    return time;
  });
  for (let index = 1; index < parsed.length; index += 1) {
    assert(
      parsed[index] >= parsed[index - 1],
      'Release evidence timestamps are not in chronological order.'
    );
  }
  for (const artifact of [index.provenanceArtifact, index.attestationArtifact]) {
    const expiresAt = Date.parse(artifact.expiresAt);
    assert(Number.isFinite(expiresAt), 'Artifact expiresAt must be a valid timestamp.');
    assert(
      expiresAt > Date.parse(artifact.createdAt),
      'Artifact expiration must be later than artifact creation.'
    );
  }
}

function assertExactEntries(actual, expected, label) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} must contain exactly: ${expected.join(', ')}.`
  );
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
