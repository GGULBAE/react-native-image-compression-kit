import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FILE,
  RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE,
  canonicalReleaseEvidenceAcquisitionManifest,
} from '../scripts/release-evidence-acquisition-core.mjs';
import {
  RELEASE_EVIDENCE_FILE_PATHS,
  RELEASE_EVIDENCE_POLICIES,
  releaseEvidenceDigest,
  sha256,
} from '../scripts/release-evidence-core.mjs';
import {
  canonicalReleaseEvidenceImportMetadata,
  createReleaseEvidenceImportMetadata,
} from '../scripts/release-evidence-import-core.mjs';
import {
  canonicalReleaseEvidencePolicyCandidate,
  prepareReleaseEvidencePolicyCandidate,
  writeReleaseEvidencePolicyReportAtomic,
} from '../scripts/release-evidence-policy-core.mjs';
import {
  RELEASE_EVIDENCE_REVIEW_EVENT_FIELDS,
  RELEASE_EVIDENCE_REVIEW_EVENT_INPUT_FIELDS,
  RELEASE_EVIDENCE_REVIEW_EXECUTION_FIELDS,
  RELEASE_EVIDENCE_REVIEW_MANIFEST_ENTRY_FIELDS,
  RELEASE_EVIDENCE_REVIEW_MANIFEST_FIELDS,
  RELEASE_EVIDENCE_REVIEW_RECEIPT_FIELDS,
  RELEASE_EVIDENCE_REVIEW_WORKFLOW_NAME,
  RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH,
  canonicalReleaseEvidenceReviewManifest,
  canonicalReleaseEvidenceReviewReceipt,
  createReleaseEvidenceReviewBundle,
  createReleaseEvidenceReviewEvent,
  createReleaseEvidenceReviewExecution,
  verifyReleaseEvidenceReviewBundle,
  writeReleaseEvidenceReviewReceiptAtomic,
} from '../scripts/release-evidence-review-core.mjs';
import {
  RELEASE_EVIDENCE_REVIEW_ATTESTATION_CHECK_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ATTESTATION_FIELDS,
  validateReleaseEvidenceReviewAttestationEvidence,
} from '../scripts/release-evidence-review-attestation-core.mjs';
import {
  GITHUB_ACTIONS_OIDC_ISSUER,
  GITHUB_WORKFLOW_BUILD_TYPE,
  SLSA_PROVENANCE_V1,
} from '../scripts/registry-attestation-core.mjs';
import { parseReleaseEvidenceReviewArgs } from '../scripts/review-release-evidence-policy.mjs';
import { parseReleaseEvidenceReviewVerificationArgs } from '../scripts/verify-release-evidence-review.mjs';
import {
  parseReleaseEvidenceReviewAttestationArgs,
  runReleaseEvidenceReviewAttestationVerification,
} from '../scripts/verify-release-evidence-review-attestation.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const EVIDENCE_ROOT = path.join(ROOT, 'evidence', 'npm');
const VERSION = '0.2.55';
const PACKAGE = 'react-native-image-compression-kit';
const CANDIDATE_SHA256 =
  'aade4a8057bbb8f6b3dc92690b3d9cc5e3b57352a5734396e3921a143a449f8d';
const REVIEW_REPOSITORY = 'GGULBAE/react-native-image-compression-kit';
const REVIEW_REF = 'refs/heads/master';
const REVIEW_SHA = 'a'.repeat(40);
const REVIEW_RUN_ID = '30000000001';
const REVIEWER = 'fixture-reviewer';
const REVIEWED_AT = '2026-07-15T04:00:00.000Z';

function createAcquisitionFixture(parent, version = VERSION) {
  const policy = RELEASE_EVIDENCE_POLICIES[version];
  const acquisitionDir = path.join(parent, 'acquisition');
  mkdirSync(path.join(acquisitionDir, 'provenance'), { recursive: true });
  mkdirSync(path.join(acquisitionDir, 'attestation'), { recursive: true });
  for (const relativePath of RELEASE_EVIDENCE_FILE_PATHS) {
    cpSync(
      path.join(EVIDENCE_ROOT, version, relativePath),
      path.join(acquisitionDir, relativePath)
    );
  }
  const metadata = createReleaseEvidenceImportMetadata({ version });
  const metadataBytes = Buffer.from(canonicalReleaseEvidenceImportMetadata(metadata), 'utf8');
  writeFileSync(
    path.join(acquisitionDir, RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE),
    metadataBytes
  );
  const filePaths = [
    RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE,
    ...RELEASE_EVIDENCE_FILE_PATHS,
  ];
  const files = filePaths.map((relativePath) => {
    const bytes = readFileSync(path.join(acquisitionDir, relativePath));
    return { path: relativePath, size: bytes.length, sha256: sha256(bytes) };
  });
  const manifest = {
    schemaVersion: 1,
    status: 'passed',
    package: policy.package,
    version,
    expectedTag: policy.expectedTag,
    repository: policy.repository,
    workflow: policy.workflow,
    sourceRef: policy.sourceRef,
    sourceDigest: policy.sourceDigest,
    runId: policy.registryValidationRun.id,
    runAttempt: 1,
    provenanceArtifact: { ...policy.provenanceArtifact },
    attestationArtifact: { ...policy.attestationArtifact },
    attestation: { ...policy.attestation },
    metadataFile: RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE,
    metadataSha256: sha256(metadataBytes),
    files,
    acquisitionSha256: releaseEvidenceDigest(files),
    error: null,
  };
  writeFileSync(
    path.join(acquisitionDir, RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FILE),
    canonicalReleaseEvidenceAcquisitionManifest(manifest)
  );
  return acquisitionDir;
}

function createReviewFixture(parent, overrides = {}) {
  const acquisitionDir = createAcquisitionFixture(parent);
  const candidateFile = path.join(parent, 'policy-candidate.json');
  const policyReportFile = path.join(parent, 'policy-diff-source.json');
  const prepared = prepareReleaseEvidencePolicyCandidate({ acquisitionDir, candidateFile });
  expect(prepared.status).toBe('passed');
  writeReleaseEvidencePolicyReportAtomic(policyReportFile, prepared);
  const workflowFile = path.join(parent, 'review-workflow.yml');
  writeFileSync(workflowFile, 'name: Release Evidence Policy Review\n');
  const execution = createReleaseEvidenceReviewExecution({
    repository: REVIEW_REPOSITORY,
    sourceRef: REVIEW_REF,
    sourceDigest: REVIEW_SHA,
    workflowName: RELEASE_EVIDENCE_REVIEW_WORKFLOW_NAME,
    workflowPath: RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH,
    workflowRef: `${REVIEW_REPOSITORY}/${RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH}@${REVIEW_REF}`,
    workflowSha: REVIEW_SHA,
    reviewRunId: REVIEW_RUN_ID,
    reviewRunAttempt: 1,
    reviewer: REVIEWER,
    reviewedAt: REVIEWED_AT,
  });
  const policy = RELEASE_EVIDENCE_POLICIES[VERSION];
  const request = {
    repository: policy.repository,
    workflow: policy.workflow.slice(policy.repository.length + 1),
    sourceRef: policy.sourceRef,
    sourceDigest: policy.sourceDigest,
    registryValidationRunId: String(policy.registryValidationRun.id),
    version: VERSION,
    expectedTag: policy.expectedTag,
    reviewedCandidateSha256: CANDIDATE_SHA256,
  };
  const rawEvent = {
    repository: { full_name: REVIEW_REPOSITORY },
    ref: REVIEW_REF,
    workflow: RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH,
    sender: { login: REVIEWER },
    inputs: {
      repository: request.repository,
      workflow: request.workflow,
      source_ref: request.sourceRef,
      source_digest: request.sourceDigest,
      registry_validation_run_id: request.registryValidationRunId,
      version: request.version,
      expected_tag: request.expectedTag,
      reviewed_candidate_sha256: request.reviewedCandidateSha256,
    },
  };
  const githubEvent = createReleaseEvidenceReviewEvent({
    eventName: 'workflow_dispatch',
    event: rawEvent,
    execution,
    request,
  });
  return {
    acquisitionDir,
    candidateFile,
    policyReportFile,
    archiveRoot: EVIDENCE_ROOT,
    bundleDir: path.join(parent, 'review-bundle'),
    reportFile: path.join(parent, 'review-report.json'),
    reviewedCandidateSha256: CANDIDATE_SHA256,
    execution,
    githubEvent,
    workflowFile,
    request,
    ...overrides,
  };
}

function expectations(receipt) {
  return {
    packageName: receipt.package,
    version: receipt.version,
    candidateSha256: receipt.candidateSha256,
    reviewer: receipt.reviewer,
    repository: receipt.repository,
    workflow: receipt.workflow,
    sourceRef: receipt.sourceRef,
    sourceDigest: receipt.sourceDigest,
    reviewRunId: receipt.reviewRunId,
    reviewRunAttempt: receipt.reviewRunAttempt,
  };
}

function expectDirectoriesEqual(actual, expected) {
  expect(readdirSync(actual).sort()).toEqual(readdirSync(expected).sort());
  for (const relativePath of [
    'release-evidence-index.json',
    ...RELEASE_EVIDENCE_FILE_PATHS,
  ]) {
    expect(readFileSync(path.join(actual, relativePath))).toEqual(
      readFileSync(path.join(expected, relativePath))
    );
  }
}

describe('release evidence policy review bundle', () => {
  it('creates a canonical standalone receipt, manifest, and promoted archive set offline', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-'));
    try {
      const options = createReviewFixture(parent);
      const evidenceBefore = readFileSync(
        path.join(EVIDENCE_ROOT, VERSION, 'release-evidence-index.json')
      );
      const receipt = createReleaseEvidenceReviewBundle(options);
      expect(Object.keys(receipt)).toEqual(RELEASE_EVIDENCE_REVIEW_RECEIPT_FIELDS);
      expect(receipt).toMatchObject({
        status: 'passed',
        package: PACKAGE,
        version: VERSION,
        candidateSha256: CANDIDATE_SHA256,
        reviewer: REVIEWER,
        reviewedAt: REVIEWED_AT,
        repository: REVIEW_REPOSITORY,
        workflow: `${REVIEW_REPOSITORY}/${RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH}`,
        workflowSha: REVIEW_SHA,
        reviewRunId: REVIEW_RUN_ID,
        reviewRunAttempt: 1,
        sourceRef: REVIEW_REF,
        sourceDigest: REVIEW_SHA,
        acquisitionSha256:
          '1545317c2047808f35f253a1387f7a019b2174ca317cbcb6b325b6ac1b797681',
        evidenceSha256:
          'e890e90e322ab6205517950466476a9b9430fa3307b2eacbc3ede0234e3f5e78',
        error: null,
      });
      const receiptBytes = canonicalReleaseEvidenceReviewReceipt(receipt);
      expect(readFileSync(options.reportFile, 'utf8')).toBe(receiptBytes);
      expect(
        readFileSync(path.join(options.bundleDir, 'review-receipt.json'), 'utf8')
      ).toBe(receiptBytes);
      expect(readFileSync(options.candidateFile, 'utf8')).toBe(
        canonicalReleaseEvidencePolicyCandidate(
          JSON.parse(readFileSync(options.candidateFile, 'utf8'))
        )
      );
      const replay = verifyReleaseEvidenceReviewBundle({
        bundleDir: options.bundleDir,
        expectations: expectations(receipt),
      });
      expect(replay).toEqual(receipt);
      expectDirectoriesEqual(
        path.join(options.bundleDir, 'archive-set', VERSION),
        path.join(EVIDENCE_ROOT, VERSION)
      );
      expect(
        readFileSync(path.join(EVIDENCE_ROOT, VERSION, 'release-evidence-index.json'))
      ).toEqual(evidenceBefore);

      const manifestBytes = readFileSync(
        path.join(options.bundleDir, 'artifact-manifest.json'),
        'utf8'
      );
      const manifest = JSON.parse(manifestBytes);
      expect(Object.keys(manifest)).toEqual(RELEASE_EVIDENCE_REVIEW_MANIFEST_FIELDS);
      expect(Object.keys(manifest.files[0])).toEqual(
        RELEASE_EVIDENCE_REVIEW_MANIFEST_ENTRY_FIELDS
      );
      expect(manifestBytes).toBe(canonicalReleaseEvidenceReviewManifest(manifest));
      expect(manifest.files.map((entry) => entry.path)).toEqual(
        [...manifest.files.map((entry) => entry.path)].sort()
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }, 15_000);

  it('fixes execution and workflow-dispatch event field order', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-fields-'));
    try {
      const options = createReviewFixture(parent);
      expect(Object.keys(options.execution)).toEqual(
        RELEASE_EVIDENCE_REVIEW_EXECUTION_FIELDS
      );
      expect(Object.keys(options.githubEvent)).toEqual(
        RELEASE_EVIDENCE_REVIEW_EVENT_FIELDS
      );
      expect(Object.keys(options.githubEvent.inputs)).toEqual(
        RELEASE_EVIDENCE_REVIEW_EVENT_INPUT_FIELDS
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe('review safety failures', () => {
  it('rejects candidate digest mismatch without exposing a bundle or report', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-digest-'));
    try {
      const options = createReviewFixture(parent, {
        reviewedCandidateSha256: 'b'.repeat(64),
      });
      const receipt = createReleaseEvidenceReviewBundle(options);
      expect(receipt.status).toBe('failed');
      expect(receipt.error).toContain('does not match the candidate bytes');
      expect(() => readFileSync(options.reportFile)).toThrow();
      expect(() => readdirSync(options.bundleDir)).toThrow();
      expect(readdirSync(parent).some((entry) => entry.includes('.tmp'))).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects a candidate that does not match the acquisition bundle', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-acquisition-'));
    try {
      const options = createReviewFixture(parent);
      const candidate = JSON.parse(readFileSync(options.candidateFile, 'utf8'));
      candidate.policy.expectedTag = 'next';
      writeFileSync(
        options.candidateFile,
        canonicalReleaseEvidencePolicyCandidate(candidate)
      );

      const receipt = createReleaseEvidenceReviewBundle(options);
      expect(receipt.status).toBe('failed');
      expect(receipt.error).toContain(
        'Reviewed policy candidate does not match the acquisition bundle.'
      );
      expect(() => readFileSync(options.reportFile)).toThrow();
      expect(() => readdirSync(options.bundleDir)).toThrow();
      expect(readdirSync(parent).some((entry) => entry.includes('.tmp'))).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects policy drift before promotion', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-policy-'));
    try {
      const options = createReviewFixture(parent);
      const policies = {
        ...RELEASE_EVIDENCE_POLICIES,
        [VERSION]: {
          ...RELEASE_EVIDENCE_POLICIES[VERSION],
          expectedTag: 'next',
        },
      };
      const receipt = createReleaseEvidenceReviewBundle(options, { policies });
      expect(receipt.status).toBe('failed');
      expect(receipt.error).toContain('Policy diff status does not match committed policy');
      expect(() => readdirSync(options.bundleDir)).toThrow();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects a duplicate target in the rehearsal archive and cleans staging', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-duplicate-'));
    try {
      const options = createReviewFixture(parent);
      const receipt = createReleaseEvidenceReviewBundle(options, {
        seedDuplicateTarget: true,
      });
      expect(receipt.status).toBe('failed');
      expect(receipt.error).toContain('already exists');
      expect(() => readdirSync(options.bundleDir)).toThrow();
      expect(readdirSync(parent).some((entry) => entry.includes('.tmp'))).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it.each([
    [
      'promotion',
      { promote: () => ({ status: 'failed', error: 'fixture promotion failure' }) },
      'fixture promotion failure',
    ],
    [
      'set',
      { verifySet: () => ({ status: 'failed', error: 'fixture set failure' }) },
      'fixture set failure',
    ],
    [
      'bundle rename',
      { renameBundle: () => { throw new Error('fixture bundle rename failure'); } },
      'fixture bundle rename failure',
    ],
    [
      'report rename',
      { renameReport: () => { throw new Error('fixture report rename failure'); } },
      'fixture report rename failure',
    ],
  ])('leaves no success artifact after %s failure', (_, dependencies, error) => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-atomic-'));
    try {
      const options = createReviewFixture(parent);
      writeFileSync(options.reportFile, 'previous\n');
      const receipt = createReleaseEvidenceReviewBundle(options, dependencies);
      expect(receipt.status).toBe('failed');
      expect(receipt.error).toContain(error);
      expect(readFileSync(options.reportFile, 'utf8')).toBe('previous\n');
      expect(() => readdirSync(options.bundleDir)).toThrow();
      expect(readdirSync(parent).some((entry) => entry.includes('.tmp'))).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects explicit identity drift during offline verification', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-identity-'));
    try {
      const options = createReviewFixture(parent);
      const receipt = createReleaseEvidenceReviewBundle(options);
      expect(receipt.status).toBe('passed');
      for (const [field, value] of [
        ['reviewer', 'different-reviewer'],
        ['reviewRunId', '30000000002'],
        ['workflow', `${REVIEW_REPOSITORY}/.github/workflows/different.yml`],
        ['sourceRef', 'refs/heads/different'],
        ['sourceDigest', 'b'.repeat(40)],
      ]) {
        const expected = { ...expectations(receipt), [field]: value };
        const replay = verifyReleaseEvidenceReviewBundle({
          bundleDir: options.bundleDir,
          expectations: expected,
        });
        expect(replay.status, field).toBe('failed');
      }
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects tampered event bytes through the recursive manifest', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-tamper-'));
    try {
      const options = createReviewFixture(parent);
      const receipt = createReleaseEvidenceReviewBundle(options);
      expect(receipt.status).toBe('passed');
      const eventPath = path.join(options.bundleDir, 'workflow-dispatch-event.json');
      const event = JSON.parse(readFileSync(eventPath, 'utf8'));
      event.reviewer = 'attacker';
      writeFileSync(eventPath, `${JSON.stringify(event)}\n`);
      const replay = verifyReleaseEvidenceReviewBundle({
        bundleDir: options.bundleDir,
        expectations: expectations(receipt),
      });
      expect(replay.status).toBe('failed');
      expect(replay.error).toMatch(/(?:size|digest) drift/);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe('release evidence review artifact attestation', () => {
  let parent;
  let options;
  let receipt;
  let manifestPath;
  let manifestBytes;
  const trustedRoot = Buffer.from('fixture review trusted root\n');
  const attestationBundle = Buffer.from('fixture review attestation\n');

  beforeAll(() => {
    parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-attestation-'));
    options = createReviewFixture(parent);
    receipt = createReleaseEvidenceReviewBundle(options);
    expect(receipt.status).toBe('passed');
    manifestPath = path.join(options.bundleDir, 'artifact-manifest.json');
    manifestBytes = readFileSync(manifestPath);
  });

  afterAll(() => {
    rmSync(parent, { recursive: true, force: true });
  });

  function verificationFixture() {
    const signer = `https://github.com/${receipt.workflow}@${receipt.sourceRef}`;
    return [
      {
        attestation: {
          mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
        },
        verificationResult: {
          mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
          signature: {
            certificate: {
              subjectAlternativeName: signer,
              issuer: GITHUB_ACTIONS_OIDC_ISSUER,
              githubWorkflowSHA: receipt.workflowSha,
              githubWorkflowRepository: receipt.repository,
              githubWorkflowRef: receipt.sourceRef,
              buildSignerURI: signer,
              buildSignerDigest: receipt.workflowSha,
              runnerEnvironment: 'github-hosted',
              sourceRepositoryURI: `https://github.com/${receipt.repository}`,
              sourceRepositoryDigest: receipt.sourceDigest,
              sourceRepositoryRef: receipt.sourceRef,
              buildConfigURI: signer,
              buildConfigDigest: receipt.workflowSha,
            },
          },
          verifiedTimestamps: [
            {
              type: 'Tlog',
              uri: 'https://rekor.sigstore.dev',
              timestamp: '2026-07-15T13:00:00+09:00',
            },
          ],
          statement: {
            _type: 'https://in-toto.io/Statement/v1',
            subject: [
              {
                name: 'artifact-manifest.json',
                digest: { sha256: sha256(manifestBytes) },
              },
            ],
            predicateType: SLSA_PROVENANCE_V1,
            predicate: {
              buildDefinition: {
                buildType: GITHUB_WORKFLOW_BUILD_TYPE,
                externalParameters: {
                  workflow: {
                    path: RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH,
                    ref: receipt.sourceRef,
                    repository: `https://github.com/${receipt.repository}`,
                  },
                },
                internalParameters: {
                  github: {
                    event_name: 'workflow_dispatch',
                    runner_environment: 'github-hosted',
                  },
                },
                resolvedDependencies: [
                  {
                    uri: `git+https://github.com/${receipt.repository}@${receipt.sourceRef}`,
                    digest: { gitCommit: receipt.sourceDigest },
                  },
                ],
              },
              runDetails: {
                builder: { id: signer },
                metadata: {
                  invocationId: `https://github.com/${receipt.repository}/actions/runs/${receipt.reviewRunId}/attempts/${receipt.reviewRunAttempt}`,
                },
              },
            },
          },
        },
      },
    ];
  }

  function validate(overrides = {}) {
    return validateReleaseEvidenceReviewAttestationEvidence({
      manifestPath,
      manifestBytes,
      trustedRootBytes: trustedRoot,
      verificationOutput: verificationFixture(),
      reviewReceipt: receipt,
      expectedTrustedRootSha256: sha256(trustedRoot),
      ...overrides,
    });
  }

  it('binds the manifest signature to reviewer, workflow, source, and invocation', () => {
    const report = validate();
    expect(Object.keys(report)).toEqual(
      RELEASE_EVIDENCE_REVIEW_ATTESTATION_FIELDS
    );
    expect(report.status).toBe('passed');
    expect(report.repository).toBe(receipt.repository);
    expect(report.signerWorkflow).toBe(receipt.workflow);
    expect(report.reviewRunId).toBe(receipt.reviewRunId);
    expect(report.reviewer).toBe(receipt.reviewer);
    expect(report.candidateSha256).toBe(receipt.candidateSha256);
    expect(Object.keys(report.checks)).toEqual(
      RELEASE_EVIDENCE_REVIEW_ATTESTATION_CHECK_FIELDS
    );
    expect(Object.values(report.checks)).toEqual(Array(10).fill(true));
  });

  it('rejects signer workflow, source digest, and invocation drift', () => {
    const cases = [
      [
        (fixture) => {
          fixture[0].verificationResult.signature.certificate.subjectAlternativeName =
            `https://github.com/${receipt.repository}/.github/workflows/other.yml@${receipt.sourceRef}`;
        },
        'certificate signer workflow',
      ],
      [
        (fixture) => {
          fixture[0].verificationResult.signature.certificate.sourceRepositoryDigest =
            'b'.repeat(40);
        },
        'source repository digest',
      ],
      [
        (fixture) => {
          fixture[0].verificationResult.statement.predicate.runDetails.metadata.invocationId =
            `https://github.com/${receipt.repository}/actions/runs/1/attempts/1`;
        },
        'SLSA invocation ID',
      ],
    ];
    for (const [mutate, message] of cases) {
      const fixture = verificationFixture();
      mutate(fixture);
      const report = validate({ verificationOutput: fixture });
      expect(report.status).toBe('failed');
      expect(report.error).toContain(message);
    }
  });

  it('separates offline gh verification and parses explicit CLI expectations', () => {
    const args = [
      '--artifact-dir', options.bundleDir,
      '--attestation-bundle', 'attestation.jsonl',
      '--trusted-root', 'trusted-root.jsonl',
      '--expect-package', PACKAGE,
      '--expect-version', VERSION,
      '--expect-candidate-sha256', CANDIDATE_SHA256,
      '--expect-reviewer', REVIEWER,
      '--expect-repository', REVIEW_REPOSITORY,
      '--expect-workflow', receipt.workflow,
      '--expect-ref', REVIEW_REF,
      '--expect-head-sha', REVIEW_SHA,
      '--expect-run-id', REVIEW_RUN_ID,
      '--expect-run-attempt', '1',
      '--report-file', 'attestation-report.json',
      '--json',
    ];
    const parsed = parseReleaseEvidenceReviewAttestationArgs(args);
    expect(parsed).toMatchObject({
      bundleDir: options.bundleDir,
      candidateSha256: CANDIDATE_SHA256,
      reviewRunId: REVIEW_RUN_ID,
      json: true,
    });
    const report = runReleaseEvidenceReviewAttestationVerification(parsed, {
      verifyReview: () => receipt,
      readSecure(_filePath, label) {
        if (label === 'review artifact manifest') return manifestBytes;
        if (label === 'trusted root') return trustedRoot;
        return attestationBundle;
      },
      runGh(_args, { attestationBytes }) {
        if (!attestationBytes.equals(attestationBundle)) {
          throw new Error('offline review attestation verification failed');
        }
        return JSON.stringify(verificationFixture());
      },
      expectedTrustedRootSha256: sha256(trustedRoot),
    });
    expect(report.status).toBe('passed');
  });
});

describe('review CLI and report contracts', () => {
  it('parses only explicit review and verification inputs and rejects apply', () => {
    const reviewArgs = [
      '--acquisition-dir', 'acquisition', '--candidate-file', 'candidate.json',
      '--policy-report-file', 'diff.json', '--archive-root', 'evidence/npm',
      '--bundle-dir', 'bundle', '--report-file', 'receipt.json',
      '--reviewed-candidate-sha256', CANDIDATE_SHA256,
      '--review-repository', REVIEW_REPOSITORY, '--review-source-ref', REVIEW_REF,
      '--review-source-digest', REVIEW_SHA, '--review-workflow-name', RELEASE_EVIDENCE_REVIEW_WORKFLOW_NAME,
      '--review-workflow-path', RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH,
      '--review-workflow-ref', `${REVIEW_REPOSITORY}/${RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH}@${REVIEW_REF}`,
      '--review-workflow-sha', REVIEW_SHA, '--review-run-id', REVIEW_RUN_ID,
      '--review-run-attempt', '1', '--reviewer', REVIEWER, '--reviewed-at', REVIEWED_AT,
      '--event-name', 'workflow_dispatch', '--github-event', 'event.json',
      '--workflow-file', RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH,
      '--registry-repository', REVIEW_REPOSITORY,
      '--registry-workflow', '.github/workflows/registry-validation.yml',
      '--registry-source-ref', RELEASE_EVIDENCE_POLICIES[VERSION].sourceRef,
      '--registry-source-digest', RELEASE_EVIDENCE_POLICIES[VERSION].sourceDigest,
      '--registry-run-id', String(RELEASE_EVIDENCE_POLICIES[VERSION].registryValidationRun.id),
      '--version', VERSION, '--expected-tag', 'latest', '--json',
    ];
    expect(parseReleaseEvidenceReviewArgs(reviewArgs)).toMatchObject({
      acquisitionDir: 'acquisition',
      candidateFile: 'candidate.json',
      bundleDir: 'bundle',
      reviewedCandidateSha256: CANDIDATE_SHA256,
      reviewRunId: REVIEW_RUN_ID,
      version: VERSION,
      json: true,
    });
    expect(
      parseReleaseEvidenceReviewVerificationArgs([
        '--artifact-dir', 'bundle', '--expect-package', PACKAGE,
        '--expect-version', VERSION, '--expect-candidate-sha256', CANDIDATE_SHA256,
        '--expect-reviewer', REVIEWER, '--expect-repository', REVIEW_REPOSITORY,
        '--expect-workflow', `${REVIEW_REPOSITORY}/${RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH}`,
        '--expect-ref', REVIEW_REF, '--expect-head-sha', REVIEW_SHA,
        '--expect-run-id', REVIEW_RUN_ID, '--expect-run-attempt', '1',
        '--report-file', 'verification.json', '--json',
      ])
    ).toMatchObject({ bundleDir: 'bundle', packageName: PACKAGE, version: VERSION, json: true });
    expect(() => parseReleaseEvidenceReviewArgs(['--apply'])).toThrow('Unknown argument: --apply');
    expect(() => parseReleaseEvidenceReviewVerificationArgs(['--apply'])).toThrow('Unknown argument: --apply');
  });

  it('preserves an existing receipt and removes temporary bytes on rename failure', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-report-'));
    try {
      const file = path.join(parent, 'receipt.json');
      writeFileSync(file, 'previous\n');
      expect(() =>
        writeReleaseEvidenceReviewReceiptAtomic(
          file,
          { status: 'fixture' },
          { rename: () => { throw new Error('fixture receipt rename failure'); } }
        )
      ).toThrow('fixture receipt rename failure');
      expect(readFileSync(file, 'utf8')).toBe('previous\n');
      expect(readdirSync(parent).some((entry) => entry.includes('.tmp'))).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
