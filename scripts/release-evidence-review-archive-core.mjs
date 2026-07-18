import { isDeepStrictEqual } from 'node:util';
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
import {
  extractArtifactZip,
  validateArtifactZipFileNames,
} from './artifact-zip-core.mjs';
import {
  RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE,
  RELEASE_EVIDENCE_REVIEW_RECEIPT_FILE,
  canonicalReleaseEvidenceReviewReceipt,
  validateCanonicalReleaseEvidenceReviewManifestBytes,
  verifyReleaseEvidenceReviewBundle,
} from './release-evidence-review-core.mjs';
import {
  canonicalReleaseEvidenceReviewAttestationReport,
} from './release-evidence-review-attestation-core.mjs';
import { runReleaseEvidenceReviewAttestationVerification } from './verify-release-evidence-review-attestation.mjs';
import { releaseEvidenceDigest, sha256 } from './release-evidence-core.mjs';

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_METADATA_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_IMPORT_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERIFICATION_SCHEMA_VERSION = 1;

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_INDEX_FILE =
  'review-evidence-index.json';
export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_ARTIFACTS_DIR = 'artifacts';
export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_REVIEW_DIR = 'review';
export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_DIR = 'attestation';
export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_REVIEW_ZIP = 'review.zip';
export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_ZIP =
  'attestation.zip';
export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_FILES = Object.freeze([
  'attestation-verification.json',
  'attestation.jsonl',
  'trusted-root.jsonl',
]);

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_METADATA_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'package',
  'version',
  'candidateSha256',
  'reviewer',
  'reviewedAt',
  'repository',
  'workflow',
  'sourceRef',
  'sourceDigest',
  'reviewRun',
  'reviewArtifact',
  'attestationArtifact',
  'attestation',
  'receiptSha256',
  'manifestSha256',
  'evidenceSha256',
  'error',
]);

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_INDEX_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'package',
  'version',
  'candidateSha256',
  'reviewer',
  'reviewedAt',
  'repository',
  'workflow',
  'sourceRef',
  'sourceDigest',
  'reviewRun',
  'reviewArtifact',
  'attestationArtifact',
  'attestation',
  'receiptSha256',
  'manifestSha256',
  'evidenceSha256',
  'files',
  'archiveSha256',
  'error',
]);

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_RUN_FIELDS = Object.freeze([
  'id',
  'url',
  'event',
  'runAttempt',
  'createdAt',
  'completedAt',
]);

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_ARTIFACT_FIELDS = Object.freeze([
  'id',
  'name',
  'digest',
  'size',
  'createdAt',
  'expiresAt',
]);

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_FIELDS = Object.freeze([
  'id',
  'url',
  'verifiedAt',
]);

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_FILE_FIELDS = Object.freeze([
  'path',
  'size',
  'sha256',
]);

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_IMPORT_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'archiveDir',
  'package',
  'version',
  'candidateSha256',
  'reviewRunId',
  'sourceDigest',
  'archiveSha256',
  'receiptSha256',
  'manifestSha256',
  'evidenceSha256',
  'fileCount',
  'checks',
  'error',
]);

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_IMPORT_CHECK_FIELDS = Object.freeze([
  'metadata',
  'reviewArtifact',
  'attestationArtifact',
  'index',
  'review',
  'attestation',
  'targetArchive',
  'verification',
  'atomicWrite',
]);

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERIFICATION_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'archiveDir',
  'package',
  'version',
  'candidateSha256',
  'reviewRunId',
  'sourceDigest',
  'archiveSha256',
  'receiptSha256',
  'manifestSha256',
  'evidenceSha256',
  'fileCount',
  'checks',
  'error',
]);

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERIFICATION_CHECK_FIELDS =
  Object.freeze([
    'layout',
    'index',
    'artifacts',
    'files',
    'review',
    'attestation',
    'targetArchive',
  ]);

const SHA256 = /^[0-9a-f]{64}$/;
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES = Object.freeze({
  '0.2.55': Object.freeze({
    package: 'react-native-image-compression-kit',
    candidateSha256:
      'aade4a8057bbb8f6b3dc92690b3d9cc5e3b57352a5734396e3921a143a449f8d',
    reviewer: 'GGULBAE',
    reviewedAt: '2026-07-15T05:03:59Z',
    repository: 'GGULBAE/react-native-image-compression-kit',
    workflow:
      'GGULBAE/react-native-image-compression-kit/.github/workflows/release-evidence-policy-review.yml',
    sourceRef: 'refs/heads/master',
    sourceDigest: '2782a6e34c70660a6c44a6189c39304317072a22',
    reviewRun: Object.freeze({
      id: 29390495773,
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29390495773',
      event: 'workflow_dispatch',
      runAttempt: 1,
      createdAt: '2026-07-15T05:03:59Z',
      completedAt: '2026-07-15T05:04:40Z',
    }),
    reviewArtifact: Object.freeze({
      id: 8333046539,
      name: 'release-evidence-policy-review-0.2.55-29390495773',
      digest:
        'sha256:f1ea6c9c2498e4d773a6cc5f6b49d39d9bfacba8bd40ec76c5364c7d3c21c836',
      size: 285466,
      createdAt: '2026-07-15T05:04:37Z',
      expiresAt: '2026-10-13T05:04:01Z',
    }),
    attestationArtifact: Object.freeze({
      id: 8333046693,
      name: 'release-evidence-policy-review-attestation-0.2.55-29390495773',
      digest:
        'sha256:05ab03d322d15e97cc733e3d0325f6dbb7a468197245ea9c6738241e2477f4d6',
      size: 15751,
      createdAt: '2026-07-15T05:04:37Z',
      expiresAt: '2026-10-13T05:04:01Z',
    }),
    attestation: Object.freeze({
      id: 35388408,
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/attestations/35388408',
      verifiedAt: '2026-07-15T05:04:29.000Z',
    }),
    receiptSha256:
      '45ddefa85cba6a9fed62cb1c187dd0bab2246b72ba66a803b1282e4eac07efad',
    manifestSha256:
      '48cfd454b636cf1911b7d19dae996e7ead2797247d2b974687bb02aeebb439ff',
    evidenceSha256:
      'e890e90e322ab6205517950466476a9b9430fa3307b2eacbc3ede0234e3f5e78',
    archiveSha256:
      'f63924d58ef18c94379b102949e6870e838a014ac883b7c9c03fca5abc6b56dd',
  }),
  '0.2.62': Object.freeze({
    package: 'react-native-image-compression-kit',
    candidateSha256:
      '0af980676b08f73b62b2e785dd39320d9ce1c55bfac58df43ebf6b87eb102cdc',
    reviewer: 'GGULBAE',
    reviewedAt: '2026-07-17T06:49:02Z',
    repository: 'GGULBAE/react-native-image-compression-kit',
    workflow:
      'GGULBAE/react-native-image-compression-kit/.github/workflows/release-evidence-policy-review.yml',
    sourceRef: 'refs/heads/master',
    sourceDigest: 'dd63305e33a4a0e3f9c8eb40a0cfa3a3eb68c7d2',
    reviewRun: Object.freeze({
      id: 29561132321,
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29561132321',
      event: 'workflow_dispatch',
      runAttempt: 1,
      createdAt: '2026-07-17T06:49:02Z',
      completedAt: '2026-07-17T06:49:43Z',
    }),
    reviewArtifact: Object.freeze({
      id: 8399292402,
      name: 'release-evidence-policy-review-0.2.62-29561132321',
      digest:
        'sha256:26c2880f1ed325cbd55956b02bc8558a692a2fecd47b2502be10ca89a7d57855',
      size: 342228,
      createdAt: '2026-07-17T06:49:39Z',
      expiresAt: '2026-10-15T06:49:03Z',
    }),
    attestationArtifact: Object.freeze({
      id: 8399292698,
      name: 'release-evidence-policy-review-attestation-0.2.62-29561132321',
      digest:
        'sha256:e6e3b25ea56fe52be16f86e8d5cb7bfc65c8c673f383d03f190682e1546501ae',
      size: 15618,
      createdAt: '2026-07-17T06:49:40Z',
      expiresAt: '2026-10-15T06:49:03Z',
    }),
    attestation: Object.freeze({
      id: 35780183,
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/attestations/35780183',
      verifiedAt: '2026-07-17T06:49:29.000Z',
    }),
    receiptSha256:
      '4d05d0fec2ec9d43575336a1b0fd4d17059f87b4db8879afeefeacd4d5d6cd2f',
    manifestSha256:
      'fd6f036f2f878031679c2c4dcf711c58f886883f8711bc1ad66be7970fdaef91',
    evidenceSha256:
      'e5a23c12d99362d5ec3c882de3acfb161b6644e9777b16dc036e0d675cf511a6',
    archiveSha256:
      '49ce812d70e53a62581b2ad5dda8e67a920d815506f885afb5267c68b2bd041d',
  }),
  '0.3.0': Object.freeze({
    package: 'react-native-image-compression-kit',
    candidateSha256:
      'eba4fb1e1b4cdcef03bc4d109fcb1b0d3a461cc56a389fbcdb89e182b7b033d9',
    reviewer: 'GGULBAE',
    reviewedAt: '2026-07-18T12:27:50Z',
    repository: 'GGULBAE/react-native-image-compression-kit',
    workflow:
      'GGULBAE/react-native-image-compression-kit/.github/workflows/release-evidence-policy-review.yml',
    sourceRef: 'refs/heads/master',
    sourceDigest: '1c0a24601e2a59484dfa6a665a1cf09680d947d7',
    reviewRun: Object.freeze({
      id: 29644362987,
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29644362987',
      event: 'workflow_dispatch',
      runAttempt: 1,
      createdAt: '2026-07-18T12:27:50Z',
      completedAt: '2026-07-18T12:28:33Z',
    }),
    reviewArtifact: Object.freeze({
      id: 8429583977,
      name: 'release-evidence-policy-review-0.3.0-29644362987',
      digest:
        'sha256:77549a36e83d742306ee5f5701957d2f935169fd30aee7cd91ccc576e97a9d1e',
      size: 425974,
      createdAt: '2026-07-18T12:28:28Z',
      expiresAt: '2026-10-16T12:27:51Z',
    }),
    attestationArtifact: Object.freeze({
      id: 8429584119,
      name: 'release-evidence-policy-review-attestation-0.3.0-29644362987',
      digest:
        'sha256:1a00d909bbbad69fc1635bb14cd970fc9b0c8804f17f12ef5943b63d4f68fb2a',
      size: 15644,
      createdAt: '2026-07-18T12:28:29Z',
      expiresAt: '2026-10-16T12:27:51Z',
    }),
    attestation: Object.freeze({
      id: 35960166,
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/attestations/35960166',
      verifiedAt: '2026-07-18T12:28:18.000Z',
    }),
    receiptSha256:
      'd56d0b10a50ad92cc20abcdc5287fe2b74e4a024e3d268ee7a183180e33861e1',
    manifestSha256:
      'b43ea462d90d3c67f6af5ab9f14083839d72f5d5a7cc5a972a3c2b5895111dc5',
    evidenceSha256:
      '201d16d7845212fa115674deacb6766ea03b2d6982a43036f40f110ee652550e',
    archiveSha256:
      '582f69b6fae5282bfe6fc758fceee24e37ffe63243cc60108c2e248261d69b72',
  }),
});

export function canonicalReleaseEvidenceReviewArchiveJson(value) {
  return `${JSON.stringify(value)}\n`;
}

export const canonicalReleaseEvidenceReviewArchiveMetadata =
  canonicalReleaseEvidenceReviewArchiveJson;
export const canonicalReleaseEvidenceReviewArchiveIndex =
  canonicalReleaseEvidenceReviewArchiveJson;
export const canonicalReleaseEvidenceReviewArchiveImportReport =
  canonicalReleaseEvidenceReviewArchiveJson;
export const canonicalReleaseEvidenceReviewArchiveVerification =
  canonicalReleaseEvidenceReviewArchiveJson;

export function createReleaseEvidenceReviewArchiveMetadata({
  version,
  expectedPolicy,
}) {
  const policy =
    expectedPolicy ?? RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES[version];
  assert(policy, `No committed review archive policy exists for version ${version}.`);
  return {
    schemaVersion: RELEASE_EVIDENCE_REVIEW_ARCHIVE_METADATA_SCHEMA_VERSION,
    status: 'passed',
    package: policy.package,
    version,
    candidateSha256: policy.candidateSha256,
    reviewer: policy.reviewer,
    reviewedAt: policy.reviewedAt,
    repository: policy.repository,
    workflow: policy.workflow,
    sourceRef: policy.sourceRef,
    sourceDigest: policy.sourceDigest,
    reviewRun: { ...policy.reviewRun },
    reviewArtifact: { ...policy.reviewArtifact },
    attestationArtifact: { ...policy.attestationArtifact },
    attestation: { ...policy.attestation },
    receiptSha256: policy.receiptSha256,
    manifestSha256: policy.manifestSha256,
    evidenceSha256: policy.evidenceSha256,
    error: null,
  };
}

export function createReleaseEvidenceReviewArchiveImportReport({
  archiveDir = null,
  packageName = null,
  version = null,
  candidateSha256 = null,
  reviewRunId = null,
  sourceDigest = null,
  archiveSha256 = null,
  receiptSha256 = null,
  manifestSha256 = null,
  evidenceSha256 = null,
  fileCount = 0,
  checks = {},
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: RELEASE_EVIDENCE_REVIEW_ARCHIVE_IMPORT_SCHEMA_VERSION,
    status,
    archiveDir,
    package: packageName,
    version,
    candidateSha256,
    reviewRunId,
    sourceDigest,
    archiveSha256,
    receiptSha256,
    manifestSha256,
    evidenceSha256,
    fileCount,
    checks: orderedChecks(RELEASE_EVIDENCE_REVIEW_ARCHIVE_IMPORT_CHECK_FIELDS, checks),
    error,
  };
}

export function createReleaseEvidenceReviewArchiveVerification({
  archiveDir = null,
  packageName = null,
  version = null,
  candidateSha256 = null,
  reviewRunId = null,
  sourceDigest = null,
  archiveSha256 = null,
  receiptSha256 = null,
  manifestSha256 = null,
  evidenceSha256 = null,
  fileCount = 0,
  checks = {},
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERIFICATION_SCHEMA_VERSION,
    status,
    archiveDir,
    package: packageName,
    version,
    candidateSha256,
    reviewRunId,
    sourceDigest,
    archiveSha256,
    receiptSha256,
    manifestSha256,
    evidenceSha256,
    fileCount,
    checks: orderedChecks(
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERIFICATION_CHECK_FIELDS,
      checks
    ),
    error,
  };
}

export function importReleaseEvidenceReviewArchive(
  {
    metadataFile,
    reviewArtifactZip,
    attestationArtifactZip,
    archiveDir,
    releaseArchiveRoot,
    expectedVersion,
    reportFile,
    expectedPolicy,
  } = {},
  dependencies = {}
) {
  const destination = archiveDir ? path.resolve(archiveDir) : null;
  const reportDestination = reportFile ? path.resolve(reportFile) : null;
  const state = importState(destination, expectedVersion);
  const operations = fileOperations(dependencies);
  let temporary = null;
  let reportTemporary = null;
  let archiveExposed = false;

  try {
    assert(metadataFile, 'Missing canonical review archive metadata file.');
    assert(reviewArtifactZip, 'Missing exact review artifact ZIP.');
    assert(attestationArtifactZip, 'Missing exact attestation artifact ZIP.');
    assert(archiveDir, 'Missing review archive destination.');
    assert(releaseArchiveRoot, 'Missing release evidence archive root.');
    assert(expectedVersion, 'Missing --version.');
    assert(
      !operations.exists(destination),
      `Review archive destination already exists: ${destination}`
    );
    if (reportDestination) {
      assertPathOutside(
        reportDestination,
        destination,
        'Import report must be outside the review archive.'
      );
    }

    const policy =
      expectedPolicy ??
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES[expectedVersion];
    assert(
      policy,
      `No committed review archive policy exists for version ${expectedVersion}.`
    );
    const metadata = parseCanonicalMetadata(
      readSecureFile(metadataFile, 'review archive metadata')
    );
    validateMetadata(metadata);
    assert(
      metadata.version === expectedVersion,
      `Expected review archive version ${expectedVersion}, got ${metadata.version}.`
    );
    assert(
      isDeepStrictEqual(
        metadata,
        createReleaseEvidenceReviewArchiveMetadata({
          version: expectedVersion,
          expectedPolicy: policy,
        })
      ),
      `Review archive metadata does not match the committed ${expectedVersion} policy.`
    );
    assignMetadataState(state, metadata);
    state.checks.metadata = true;

    const reviewZipBytes = readSecureFile(
      reviewArtifactZip,
      'review artifact ZIP'
    );
    const reviewFiles = validateReviewArtifactZip(
      reviewZipBytes,
      metadata.reviewArtifact
    );
    state.checks.reviewArtifact = true;
    const attestationZipBytes = readSecureFile(
      attestationArtifactZip,
      'attestation artifact ZIP'
    );
    const attestationFiles = validatePinnedArtifactZip(
      attestationZipBytes,
      metadata.attestationArtifact,
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_FILES,
      'Attestation artifact'
    );
    state.checks.attestationArtifact = true;

    operations.mkdir(path.dirname(destination), { recursive: true });
    temporary = temporaryPath(destination, 'review-archive');
    operations.mkdir(temporary, { recursive: false });
    const artifactsDir = path.join(
      temporary,
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_ARTIFACTS_DIR
    );
    const reviewDir = path.join(
      temporary,
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_REVIEW_DIR
    );
    const attestationDir = path.join(
      temporary,
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_DIR
    );
    operations.mkdir(artifactsDir, { recursive: false });
    operations.mkdir(reviewDir, { recursive: false });
    operations.mkdir(attestationDir, { recursive: false });
    operations.writeFile(
      path.join(artifactsDir, RELEASE_EVIDENCE_REVIEW_ARCHIVE_REVIEW_ZIP),
      reviewZipBytes,
      { flag: 'wx' }
    );
    operations.writeFile(
      path.join(
        artifactsDir,
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_ZIP
      ),
      attestationZipBytes,
      { flag: 'wx' }
    );
    writeExtractedFiles(reviewDir, reviewFiles, operations);
    writeExtractedFiles(attestationDir, attestationFiles, operations);

    const files = createReleaseEvidenceReviewArchiveFiles(temporary);
    const index = createReleaseEvidenceReviewArchiveIndex({ metadata, files });
    assert(
      index.archiveSha256 === policy.archiveSha256,
      'Review archive SHA-256 does not match the committed policy.'
    );
    operations.writeFile(
      path.join(temporary, RELEASE_EVIDENCE_REVIEW_ARCHIVE_INDEX_FILE),
      canonicalReleaseEvidenceReviewArchiveIndex(index),
      { encoding: 'utf8', flag: 'wx' }
    );
    state.archiveSha256 = index.archiveSha256;
    state.fileCount = files.length;
    state.checks.index = true;

    const verifyArchive =
      dependencies.verifyArchive ?? verifyReleaseEvidenceReviewArchive;
    const verification = verifyArchive(
      {
        archiveDir: temporary,
        releaseArchiveRoot,
        expectedVersion,
        expectedPolicy: policy,
      },
      dependencies.verifierDependencies ?? {}
    );
    assert(
      verification?.status === 'passed',
      `Imported review archive verification failed: ${verification?.error ?? 'unknown error'}`
    );
    for (const field of ['review', 'attestation', 'targetArchive']) {
      state.checks[field] = verification.checks[field] === true;
    }
    state.checks.verification = true;
    state.checks.atomicWrite = true;
    const success = createReleaseEvidenceReviewArchiveImportReport({
      ...state,
      status: 'passed',
      error: null,
    });

    if (reportDestination) {
      operations.mkdir(path.dirname(reportDestination), { recursive: true });
      reportTemporary = temporaryPath(reportDestination, 'review-import-report');
      operations.writeFile(
        reportTemporary,
        canonicalReleaseEvidenceReviewArchiveImportReport(success),
        { encoding: 'utf8', flag: 'wx' }
      );
    }
    const renameArchive = dependencies.renameArchive ?? operations.rename;
    renameArchive(temporary, destination);
    temporary = null;
    archiveExposed = true;
    if (reportTemporary) {
      const renameReport = dependencies.renameReport ?? operations.rename;
      renameReport(reportTemporary, reportDestination);
      reportTemporary = null;
    }
    return success;
  } catch (error) {
    if (temporary) operations.remove(temporary, { recursive: true, force: true });
    if (reportTemporary) operations.remove(reportTemporary, { force: true });
    if (archiveExposed) {
      operations.remove(destination, { recursive: true, force: true });
    }
    state.checks.atomicWrite = false;
    return createReleaseEvidenceReviewArchiveImportReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function verifyReleaseEvidenceReviewArchive(
  {
    archiveDir,
    releaseArchiveRoot,
    expectedVersion,
    expectedPolicy,
  } = {},
  dependencies = {}
) {
  const resolved = archiveDir ? path.resolve(archiveDir) : null;
  const state = verificationState(resolved, expectedVersion);
  try {
    assert(archiveDir, 'Missing review archive directory.');
    assert(releaseArchiveRoot, 'Missing release evidence archive root.');
    assert(expectedVersion, 'Missing --version.');
    const policy =
      expectedPolicy ??
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES[expectedVersion];
    assert(
      policy,
      `No committed review archive policy exists for version ${expectedVersion}.`
    );
    const root = validateDirectory(resolved, 'review archive');
    assertExactEntries(
      readdirSync(root).sort(compareText),
      [
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_ARTIFACTS_DIR,
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_DIR,
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_INDEX_FILE,
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_REVIEW_DIR,
      ].sort(compareText),
      'Review archive root'
    );
    const artifactsDir = validateDirectory(
      path.join(root, RELEASE_EVIDENCE_REVIEW_ARCHIVE_ARTIFACTS_DIR),
      'review archive artifacts directory'
    );
    const reviewDir = validateDirectory(
      path.join(root, RELEASE_EVIDENCE_REVIEW_ARCHIVE_REVIEW_DIR),
      'archived review bundle'
    );
    const attestationDir = validateDirectory(
      path.join(root, RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_DIR),
      'archived review attestation'
    );
    assertExactEntries(
      readdirSync(artifactsDir).sort(compareText),
      [
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_ZIP,
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_REVIEW_ZIP,
      ].sort(compareText),
      'Review archive artifacts directory'
    );
    assertExactEntries(
      readdirSync(attestationDir).sort(compareText),
      [...RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_FILES].sort(compareText),
      'Review archive attestation directory'
    );
    state.checks.layout = true;

    const indexBytes = readSecureFile(
      path.join(root, RELEASE_EVIDENCE_REVIEW_ARCHIVE_INDEX_FILE),
      'review evidence index'
    );
    const index = parseCanonicalIndex(indexBytes);
    validateIndex(index);
    assert(
      index.version === expectedVersion,
      `Expected review archive version ${expectedVersion}, got ${index.version}.`
    );
    const metadata = metadataFromIndex(index);
    assert(
      isDeepStrictEqual(
        metadata,
        createReleaseEvidenceReviewArchiveMetadata({
          version: expectedVersion,
          expectedPolicy: policy,
        })
      ),
      `Review evidence index does not match the committed ${expectedVersion} policy.`
    );
    assignMetadataState(state, metadata);
    state.archiveSha256 = index.archiveSha256;
    state.fileCount = index.files.length;
    state.checks.index = true;

    const reviewZipBytes = readSecureFile(
      path.join(artifactsDir, RELEASE_EVIDENCE_REVIEW_ARCHIVE_REVIEW_ZIP),
      'archived review artifact ZIP'
    );
    const reviewFiles = validateReviewArtifactZip(
      reviewZipBytes,
      index.reviewArtifact
    );
    const attestationZipBytes = readSecureFile(
      path.join(artifactsDir, RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_ZIP),
      'archived attestation artifact ZIP'
    );
    const attestationFiles = validatePinnedArtifactZip(
      attestationZipBytes,
      index.attestationArtifact,
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_FILES,
      'Attestation artifact'
    );
    state.checks.artifacts = true;
    assertExtractedFilesEqual(reviewDir, reviewFiles, 'Archived review bundle');
    assertExtractedFilesEqual(
      attestationDir,
      attestationFiles,
      'Archived review attestation'
    );

    const files = createReleaseEvidenceReviewArchiveFiles(root);
    assert(
      isDeepStrictEqual(index.files, files),
      `Review evidence index files do not match the archived bytes: ${describeFileRecordMismatch(index.files, files)}`
    );
    const archiveSha256 = releaseEvidenceDigest(files);
    assert(
      index.archiveSha256 === archiveSha256 &&
        archiveSha256 === policy.archiveSha256,
      'Review archive aggregate SHA-256 does not match the index and committed policy.'
    );
    state.checks.files = true;

    const evidence = verifyArchivedReviewEvidence(
      {
        reviewDir,
        attestationDir,
        releaseArchiveRoot: path.resolve(releaseArchiveRoot),
        metadata,
      },
      dependencies
    );
    state.checks.review = evidence.review;
    state.checks.attestation = evidence.attestation;
    state.checks.targetArchive = evidence.targetArchive;
    return createReleaseEvidenceReviewArchiveVerification({
      ...state,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    return createReleaseEvidenceReviewArchiveVerification({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function createReleaseEvidenceReviewArchiveFiles(directory) {
  const root = validateDirectory(directory, 'review archive staging directory');
  return listRegularFiles(root)
    .filter((file) => file !== RELEASE_EVIDENCE_REVIEW_ARCHIVE_INDEX_FILE)
    .map((relativePath) => {
      const bytes = readSecureFile(
        path.join(root, relativePath),
        `review archive file ${relativePath}`
      );
      return { path: relativePath, size: bytes.length, sha256: sha256(bytes) };
    });
}

export function createReleaseEvidenceReviewArchiveIndex({ metadata, files }) {
  return {
    schemaVersion: RELEASE_EVIDENCE_REVIEW_ARCHIVE_SCHEMA_VERSION,
    status: 'passed',
    package: metadata.package,
    version: metadata.version,
    candidateSha256: metadata.candidateSha256,
    reviewer: metadata.reviewer,
    reviewedAt: metadata.reviewedAt,
    repository: metadata.repository,
    workflow: metadata.workflow,
    sourceRef: metadata.sourceRef,
    sourceDigest: metadata.sourceDigest,
    reviewRun: { ...metadata.reviewRun },
    reviewArtifact: { ...metadata.reviewArtifact },
    attestationArtifact: { ...metadata.attestationArtifact },
    attestation: { ...metadata.attestation },
    receiptSha256: metadata.receiptSha256,
    manifestSha256: metadata.manifestSha256,
    evidenceSha256: metadata.evidenceSha256,
    files: files.map((file) => ({ ...file })),
    archiveSha256: releaseEvidenceDigest(files),
    error: null,
  };
}

export function writeReleaseEvidenceReviewArchiveVerificationAtomic(
  filePath,
  report,
  operations = {}
) {
  const mkdir = operations.mkdir ?? mkdirSync;
  const writeFile = operations.writeFile ?? writeFileSync;
  const rename = operations.rename ?? renameSync;
  const remove = operations.remove ?? rmSync;
  const destination = path.resolve(filePath);
  const temporary = temporaryPath(destination, 'review-archive-verification');
  mkdir(path.dirname(destination), { recursive: true });
  try {
    writeFile(
      temporary,
      canonicalReleaseEvidenceReviewArchiveVerification(report),
      { encoding: 'utf8', flag: 'wx' }
    );
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { force: true });
    throw error;
  }
}

function verifyArchivedReviewEvidence(
  { reviewDir, attestationDir, releaseArchiveRoot, metadata },
  dependencies
) {
  const expectations = expectationsFromMetadata(metadata);
  const verifyReview = dependencies.verifyReview ?? verifyReleaseEvidenceReviewBundle;
  const receipt = verifyReview({ bundleDir: reviewDir, expectations });
  assert(
    receipt?.status === 'passed',
    `Archived review replay failed: ${receipt?.error ?? 'unknown error'}`
  );
  const receiptBytes = readSecureFile(
    path.join(reviewDir, RELEASE_EVIDENCE_REVIEW_RECEIPT_FILE),
    'archived review receipt'
  );
  assert(
    receiptBytes.equals(
      Buffer.from(canonicalReleaseEvidenceReviewReceipt(receipt), 'utf8')
    ),
    'Archived review receipt does not match offline replay.'
  );
  assert(
    sha256(receiptBytes) === metadata.receiptSha256 &&
      receipt.candidateSha256 === metadata.candidateSha256 &&
      receipt.reviewer === metadata.reviewer &&
      receipt.reviewedAt === metadata.reviewedAt &&
      receipt.evidenceSha256 === metadata.evidenceSha256,
    'Archived review receipt does not match the review archive metadata.'
  );
  const manifestPath = path.join(
    reviewDir,
    RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE
  );
  const manifestBytes = readSecureFile(manifestPath, 'archived review manifest');
  validateCanonicalReleaseEvidenceReviewManifestBytes(manifestBytes);
  assert(
    sha256(manifestBytes) === metadata.manifestSha256,
    'Archived review manifest SHA-256 does not match the review archive metadata.'
  );

  const verifyAttestation =
    dependencies.verifyAttestation ??
    ((options) =>
      runReleaseEvidenceReviewAttestationVerification(
        options,
        dependencies.attestationDependencies ?? {}
      ));
  const attestation = verifyAttestation({
    bundleDir: reviewDir,
    attestationBundle: path.join(attestationDir, 'attestation.jsonl'),
    trustedRoot: path.join(attestationDir, 'trusted-root.jsonl'),
    ...expectations,
  });
  assert(
    attestation?.status === 'passed',
    `Archived review attestation verification failed: ${attestation?.error ?? 'unknown error'}`
  );
  const storedAttestationBytes = readSecureFile(
    path.join(attestationDir, 'attestation-verification.json'),
    'archived review attestation report'
  );
  assert(
    storedAttestationBytes.equals(
      Buffer.from(
        canonicalReleaseEvidenceReviewAttestationReport(attestation),
        'utf8'
      )
    ),
    'Archived review attestation report does not match offline replay.'
  );
  assert(
    attestation.subjectSha256 === metadata.manifestSha256 &&
      attestation.repository === metadata.repository &&
      attestation.signerWorkflow === metadata.workflow &&
      attestation.sourceRef === metadata.sourceRef &&
      attestation.sourceDigest === metadata.sourceDigest &&
      attestation.reviewRunId === String(metadata.reviewRun.id) &&
      attestation.reviewRunAttempt === metadata.reviewRun.runAttempt &&
      attestation.reviewer === metadata.reviewer &&
      attestation.candidateSha256 === metadata.candidateSha256 &&
      attestation.verifiedTimestamps.some(
        (timestamp) => timestamp.timestamp === metadata.attestation.verifiedAt
      ),
    'Archived review attestation identity does not match the review archive metadata.'
  );

  assertDirectoriesEqual(
    path.join(reviewDir, 'archive-set', metadata.version),
    path.join(releaseArchiveRoot, metadata.version),
    'Rehearsed target archive does not match repository release evidence.'
  );
  return { review: true, attestation: true, targetArchive: true };
}

function validateReviewArtifactZip(zipBytes, artifact) {
  const files = validatePinnedArtifactZip(
    zipBytes,
    artifact,
    null,
    'Review artifact'
  );
  assert(
    files.has(RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE),
    'Review artifact manifest is missing from the review ZIP.'
  );
  const manifest = validateCanonicalReleaseEvidenceReviewManifestBytes(
    files.get(RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE)
  );
  validateArtifactZipFileNames([...files.keys()], [
    RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE,
    ...manifest.files.map((file) => file.path),
  ]);
  return files;
}

function validatePinnedArtifactZip(
  zipBytes,
  artifact,
  expectedFiles,
  label
) {
  assert(
    zipBytes.length === artifact.size,
    `${label} ZIP size does not match canonical metadata.`
  );
  assert(
    `sha256:${sha256(zipBytes)}` === artifact.digest,
    `${label} ZIP digest does not match canonical metadata.`
  );
  return extractArtifactZip(zipBytes, { expectedFiles });
}

function writeExtractedFiles(destination, files, operations) {
  for (const [relativePath, bytes] of files) {
    const target = path.join(destination, relativePath);
    operations.mkdir(path.dirname(target), { recursive: true });
    operations.writeFile(target, bytes, { flag: 'wx' });
  }
}

function assertExtractedFilesEqual(directory, expectedFiles, label) {
  const root = validateDirectory(directory, label);
  const actualPaths = listRegularFiles(root);
  validateArtifactZipFileNames(actualPaths, [...expectedFiles.keys()]);
  for (const [relativePath, expectedBytes] of expectedFiles) {
    const actual = readSecureFile(
      path.join(root, relativePath),
      `${label} file ${relativePath}`
    );
    assert(
      actual.equals(expectedBytes),
      `${label} file does not match its exact ZIP entry: ${relativePath}`
    );
  }
}

function parseCanonicalMetadata(bytes) {
  const metadata = parseJson(bytes, 'review archive metadata');
  assert(
    bytes.equals(
      Buffer.from(canonicalReleaseEvidenceReviewArchiveMetadata(metadata), 'utf8')
    ),
    'Review archive metadata is not canonical JSON.'
  );
  return metadata;
}

function parseCanonicalIndex(bytes) {
  const index = parseJson(bytes, 'review evidence index');
  assert(
    bytes.equals(
      Buffer.from(canonicalReleaseEvidenceReviewArchiveIndex(index), 'utf8')
    ),
    'Review evidence index is not canonical JSON.'
  );
  return index;
}

function validateMetadata(metadata) {
  assertExactFields(
    metadata,
    RELEASE_EVIDENCE_REVIEW_ARCHIVE_METADATA_FIELDS,
    'Review archive metadata'
  );
  assert(
    metadata.schemaVersion ===
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_METADATA_SCHEMA_VERSION,
    `Unsupported review archive metadata schemaVersion: ${metadata.schemaVersion}`
  );
  validateSharedEvidence(metadata, 'Review archive metadata');
}

function validateIndex(index) {
  assertExactFields(
    index,
    RELEASE_EVIDENCE_REVIEW_ARCHIVE_INDEX_FIELDS,
    'Review evidence index'
  );
  assert(
    index.schemaVersion === RELEASE_EVIDENCE_REVIEW_ARCHIVE_SCHEMA_VERSION,
    `Unsupported review evidence index schemaVersion: ${index.schemaVersion}`
  );
  validateSharedEvidence(index, 'Review evidence index');
  assert(Array.isArray(index.files), 'Review evidence index files must be an array.');
  assert(index.files.length > 0, 'Review evidence index files must not be empty.');
  const paths = [];
  for (const file of index.files) {
    assertRecord(file, 'Review evidence file');
    assertExactFields(
      file,
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_FILE_FIELDS,
      'Review evidence file'
    );
    assert(
      Number.isSafeInteger(file.size) && file.size >= 0,
      `Review evidence file size is invalid: ${file.path}`
    );
    assert(SHA256.test(file.sha256), `Review evidence file SHA-256 is invalid: ${file.path}`);
    paths.push(file.path);
  }
  assert(
    JSON.stringify(paths) === JSON.stringify([...paths].sort(compareText)),
    'Review evidence index file paths must be sorted.'
  );
  validateArtifactZipFileNames(paths);
  assert(SHA256.test(index.archiveSha256), 'Review archive SHA-256 is invalid.');
}

function validateSharedEvidence(value, label) {
  assert(value.status === 'passed', `${label} status must be passed.`);
  assert(value.error === null, `${label} error must be null.`);
  for (const [field, fieldLabel] of [
    ['candidateSha256', 'candidate SHA-256'],
    ['receiptSha256', 'receipt SHA-256'],
    ['manifestSha256', 'manifest SHA-256'],
    ['evidenceSha256', 'evidence SHA-256'],
  ]) {
    assert(SHA256.test(value[field]), `${label} ${fieldLabel} is invalid.`);
  }
  requireIsoTimestamp(value.reviewedAt, `${label} reviewedAt`);
  assertRecord(value.reviewRun, `${label} review run`);
  assertExactFields(
    value.reviewRun,
    RELEASE_EVIDENCE_REVIEW_ARCHIVE_RUN_FIELDS,
    `${label} review run`
  );
  assert(
    Number.isSafeInteger(value.reviewRun.id) && value.reviewRun.id > 0,
    `${label} review run ID must be a positive integer.`
  );
  assert(
    Number.isSafeInteger(value.reviewRun.runAttempt) &&
      value.reviewRun.runAttempt > 0,
    `${label} review run attempt must be a positive integer.`
  );
  requireIsoTimestamp(value.reviewRun.createdAt, `${label} run createdAt`);
  requireIsoTimestamp(value.reviewRun.completedAt, `${label} run completedAt`);
  for (const [artifact, artifactLabel] of [
    [value.reviewArtifact, 'review artifact'],
    [value.attestationArtifact, 'attestation artifact'],
  ]) {
    assertRecord(artifact, `${label} ${artifactLabel}`);
    assertExactFields(
      artifact,
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_ARTIFACT_FIELDS,
      `${label} ${artifactLabel}`
    );
    assert(
      Number.isSafeInteger(artifact.id) && artifact.id > 0,
      `${label} ${artifactLabel} ID must be a positive integer.`
    );
    assert(
      Number.isSafeInteger(artifact.size) && artifact.size > 0,
      `${label} ${artifactLabel} size must be a positive integer.`
    );
    assert(
      SHA256_DIGEST.test(artifact.digest),
      `${label} ${artifactLabel} digest is invalid.`
    );
    requireIsoTimestamp(artifact.createdAt, `${label} ${artifactLabel} createdAt`);
    requireIsoTimestamp(artifact.expiresAt, `${label} ${artifactLabel} expiresAt`);
    assert(
      Date.parse(artifact.expiresAt) > Date.parse(artifact.createdAt),
      `${label} ${artifactLabel} expiration must follow creation.`
    );
  }
  assertRecord(value.attestation, `${label} attestation`);
  assertExactFields(
    value.attestation,
    RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_FIELDS,
    `${label} attestation`
  );
  assert(
    Number.isSafeInteger(value.attestation.id) && value.attestation.id > 0,
    `${label} attestation ID must be a positive integer.`
  );
  requireIsoTimestamp(value.attestation.verifiedAt, `${label} attestation verifiedAt`);
  validateTimeline(value, label);
}

function validateTimeline(value, label) {
  const times = [
    value.reviewRun.createdAt,
    value.reviewedAt,
    value.attestation.verifiedAt,
    value.reviewArtifact.createdAt,
    value.attestationArtifact.createdAt,
    value.reviewRun.completedAt,
  ].map((timestamp) => Date.parse(timestamp));
  for (let index = 1; index < times.length; index += 1) {
    assert(times[index] >= times[index - 1], `${label} timestamps are not chronological.`);
  }
}

function metadataFromIndex(index) {
  return Object.fromEntries(
    RELEASE_EVIDENCE_REVIEW_ARCHIVE_METADATA_FIELDS.map((field) => [
      field,
      index[field],
    ])
  );
}

function expectationsFromMetadata(metadata) {
  return {
    packageName: metadata.package,
    version: metadata.version,
    candidateSha256: metadata.candidateSha256,
    reviewer: metadata.reviewer,
    repository: metadata.repository,
    workflow: metadata.workflow,
    sourceRef: metadata.sourceRef,
    sourceDigest: metadata.sourceDigest,
    reviewRunId: String(metadata.reviewRun.id),
    reviewRunAttempt: metadata.reviewRun.runAttempt,
  };
}

function assignMetadataState(state, metadata) {
  state.packageName = metadata.package;
  state.version = metadata.version;
  state.candidateSha256 = metadata.candidateSha256;
  state.reviewRunId = metadata.reviewRun.id;
  state.sourceDigest = metadata.sourceDigest;
  state.receiptSha256 = metadata.receiptSha256;
  state.manifestSha256 = metadata.manifestSha256;
  state.evidenceSha256 = metadata.evidenceSha256;
}

function importState(archiveDir, version) {
  return {
    archiveDir,
    packageName: null,
    version: version ?? null,
    candidateSha256: null,
    reviewRunId: null,
    sourceDigest: null,
    archiveSha256: null,
    receiptSha256: null,
    manifestSha256: null,
    evidenceSha256: null,
    fileCount: 0,
    checks: {},
  };
}

function verificationState(archiveDir, version) {
  return importState(archiveDir, version);
}

function orderedChecks(fields, checks) {
  return Object.fromEntries(fields.map((field) => [field, checks[field] === true]));
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

function listRegularFiles(directory, prefix = '') {
  const files = [];
  for (const entry of readdirSync(directory).sort(compareText)) {
    const absolute = path.join(directory, entry);
    const relative = prefix ? `${prefix}/${entry}` : entry;
    const stats = lstatSync(absolute);
    assert(!stats.isSymbolicLink(), `Review archive must not contain symlinks: ${relative}`);
    if (stats.isDirectory()) {
      files.push(...listRegularFiles(absolute, relative));
    } else {
      assert(stats.isFile(), `Review archive entry must be a regular file: ${relative}`);
      files.push(relative);
    }
  }
  return files;
}

function assertDirectoriesEqual(actualRoot, expectedRoot, message) {
  const actual = validateDirectory(actualRoot, 'rehearsed target archive');
  const expected = validateDirectory(expectedRoot, 'repository release evidence archive');
  const actualFiles = listRegularFiles(actual);
  const expectedFiles = listRegularFiles(expected);
  assert(JSON.stringify(actualFiles) === JSON.stringify(expectedFiles), message);
  for (const relativePath of actualFiles) {
    assert(
      readSecureFile(path.join(actual, relativePath), `rehearsed ${relativePath}`).equals(
        readSecureFile(path.join(expected, relativePath), `repository ${relativePath}`)
      ),
      `${message} File differs: ${relativePath}`
    );
  }
}

function validateDirectory(directory, label) {
  const stats = lstatSync(directory);
  assert(!stats.isSymbolicLink(), `${label} must not be a symbolic link.`);
  assert(stats.isDirectory(), `${label} must be a directory.`);
  return realpathSync(directory);
}

function readSecureFile(filePath, label) {
  const stats = lstatSync(filePath);
  assert(!stats.isSymbolicLink(), `${label} must not be a symbolic link.`);
  assert(stats.isFile(), `${label} must be a regular file.`);
  return readFileSync(realpathSync(filePath));
}

function parseJson(bytes, label) {
  try {
    const value = JSON.parse(bytes.toString('utf8'));
    assertRecord(value, label);
    return value;
  } catch (error) {
    throw new Error(`Could not parse ${label}: ${error.message}`);
  }
}

function requireIsoTimestamp(value, label) {
  assert(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
      Number.isFinite(Date.parse(value)),
    `${label} must be a canonical UTC ISO timestamp.`
  );
  return value;
}

function assertPathOutside(candidate, root, message) {
  const relative = path.relative(root, candidate);
  assert(relative.startsWith('..') && !path.isAbsolute(relative), message);
}

function temporaryPath(destination, label) {
  return path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${label}.${process.pid}.${Date.now()}.tmp`
  );
}

function assertExactEntries(actual, expected, label) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} must contain exactly: ${expected.join(', ')}.`
  );
}

function describeFileRecordMismatch(expected, actual) {
  const count = Math.max(expected.length, actual.length);
  for (let index = 0; index < count; index += 1) {
    if (!isDeepStrictEqual(expected[index], actual[index])) {
      return `record ${index} expected ${JSON.stringify(expected[index] ?? null)}, got ${JSON.stringify(actual[index] ?? null)}.`;
    }
  }
  return 'unknown record drift.';
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

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
