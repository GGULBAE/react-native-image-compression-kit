import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  RELEASE_EVIDENCE_POLICIES,
  sha256,
  verifyReleaseEvidenceArchive,
} from './release-evidence-core.mjs';
import {
  RELEASE_EVIDENCE_POLICY_CHECK_FIELDS,
  RELEASE_EVIDENCE_POLICY_PROMOTION_CHECK_FIELDS,
  RELEASE_EVIDENCE_POLICY_PROMOTION_FIELDS,
  RELEASE_EVIDENCE_POLICY_REPORT_FIELDS,
  canonicalReleaseEvidencePolicyCandidate,
  canonicalReleaseEvidencePolicyPromotion,
  canonicalReleaseEvidencePolicyReport,
  compareReleaseEvidencePolicy,
  createReleaseEvidencePolicyReport,
  inspectReleaseEvidenceAcquisitionBundle,
  promoteReleaseEvidencePolicyCandidate,
  readReleaseEvidencePolicyCandidate,
} from './release-evidence-policy-core.mjs';
import {
  RELEASE_EVIDENCE_SET_FIELDS,
  canonicalReleaseEvidenceSetReport,
  verifyReleaseEvidenceSet,
} from './release-evidence-set-core.mjs';

export const RELEASE_EVIDENCE_REVIEW_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_REVIEW_MANIFEST_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_REVIEW_WORKFLOW_NAME =
  'Release Evidence Policy Review';
export const RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH =
  '.github/workflows/release-evidence-policy-review.yml';

export const RELEASE_EVIDENCE_REVIEW_ACQUISITION_DIR = 'acquisition';
export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_DIR = 'archive-set';
export const RELEASE_EVIDENCE_REVIEW_CANDIDATE_FILE = 'policy-candidate.json';
export const RELEASE_EVIDENCE_REVIEW_DIFF_FILE = 'policy-diff.json';
export const RELEASE_EVIDENCE_REVIEW_EXECUTION_FILE = 'github-execution.json';
export const RELEASE_EVIDENCE_REVIEW_EVENT_FILE =
  'workflow-dispatch-event.json';
export const RELEASE_EVIDENCE_REVIEW_WORKFLOW_FILE =
  'release-evidence-policy-review-workflow.yml';
export const RELEASE_EVIDENCE_REVIEW_PROMOTION_FILE = 'promotion-report.json';
export const RELEASE_EVIDENCE_REVIEW_SET_FILE =
  'release-evidence-set-report.json';
export const RELEASE_EVIDENCE_REVIEW_RECEIPT_FILE = 'review-receipt.json';
export const RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE = 'artifact-manifest.json';

export const RELEASE_EVIDENCE_REVIEW_RECEIPT_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'package',
  'version',
  'candidateSha256',
  'reviewer',
  'reviewedAt',
  'repository',
  'workflow',
  'workflowSha',
  'reviewRunId',
  'reviewRunAttempt',
  'sourceRef',
  'sourceDigest',
  'acquisitionSha256',
  'evidenceSha256',
  'promotionReportSha256',
  'setReportSha256',
  'error',
]);

export const RELEASE_EVIDENCE_REVIEW_EXECUTION_FIELDS = Object.freeze([
  'repository',
  'sourceRef',
  'sourceDigest',
  'workflowName',
  'workflowPath',
  'workflowRef',
  'workflowSha',
  'reviewRunId',
  'reviewRunAttempt',
  'reviewer',
  'reviewedAt',
]);

export const RELEASE_EVIDENCE_REVIEW_EVENT_FIELDS = Object.freeze([
  'eventName',
  'repository',
  'ref',
  'workflow',
  'reviewer',
  'inputs',
]);

export const RELEASE_EVIDENCE_REVIEW_EVENT_INPUT_FIELDS = Object.freeze([
  'repository',
  'workflow',
  'sourceRef',
  'sourceDigest',
  'registryValidationRunId',
  'version',
  'expectedTag',
  'reviewedCandidateSha256',
]);

export const RELEASE_EVIDENCE_REVIEW_MANIFEST_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'files',
  'error',
]);

export const RELEASE_EVIDENCE_REVIEW_MANIFEST_ENTRY_FIELDS = Object.freeze([
  'path',
  'size',
  'sha256',
]);

const SHA256 = /^[0-9a-f]{64}$/;
const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/;
const POSITIVE_DECIMAL = /^[1-9]\d*$/;
const REPOSITORY_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const GITHUB_REF = /^refs\/(?:heads|tags)\/[^\u0000-\u001f\u007f]+$/;
const WORKFLOW_PATH = /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/;
const PACKAGE_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

const TOP_LEVEL_ENTRIES = Object.freeze([
  RELEASE_EVIDENCE_REVIEW_ACQUISITION_DIR,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_DIR,
  RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE,
  RELEASE_EVIDENCE_REVIEW_EXECUTION_FILE,
  RELEASE_EVIDENCE_REVIEW_CANDIDATE_FILE,
  RELEASE_EVIDENCE_REVIEW_DIFF_FILE,
  RELEASE_EVIDENCE_REVIEW_PROMOTION_FILE,
  RELEASE_EVIDENCE_REVIEW_SET_FILE,
  RELEASE_EVIDENCE_REVIEW_RECEIPT_FILE,
  RELEASE_EVIDENCE_REVIEW_EVENT_FILE,
  RELEASE_EVIDENCE_REVIEW_WORKFLOW_FILE,
].sort(compareText));

export function canonicalReleaseEvidenceReviewJson(value) {
  return `${JSON.stringify(value)}\n`;
}

export const canonicalReleaseEvidenceReviewReceipt =
  canonicalReleaseEvidenceReviewJson;
export const canonicalReleaseEvidenceReviewManifest =
  canonicalReleaseEvidenceReviewJson;

export function createReleaseEvidenceReviewReceipt({
  packageName = null,
  version = null,
  candidateSha256 = null,
  reviewer = null,
  reviewedAt = null,
  repository = null,
  workflow = null,
  workflowSha = null,
  reviewRunId = null,
  reviewRunAttempt = null,
  sourceRef = null,
  sourceDigest = null,
  acquisitionSha256 = null,
  evidenceSha256 = null,
  promotionReportSha256 = null,
  setReportSha256 = null,
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: RELEASE_EVIDENCE_REVIEW_SCHEMA_VERSION,
    status,
    package: packageName,
    version,
    candidateSha256,
    reviewer,
    reviewedAt,
    repository,
    workflow,
    workflowSha,
    reviewRunId,
    reviewRunAttempt,
    sourceRef,
    sourceDigest,
    acquisitionSha256,
    evidenceSha256,
    promotionReportSha256,
    setReportSha256,
    error,
  };
}

export function createReleaseEvidenceReviewExecution({
  repository,
  sourceRef,
  sourceDigest,
  workflowName,
  workflowPath,
  workflowRef,
  workflowSha,
  reviewRunId,
  reviewRunAttempt,
  reviewer,
  reviewedAt,
} = {}) {
  const execution = {
    repository,
    sourceRef,
    sourceDigest,
    workflowName,
    workflowPath,
    workflowRef,
    workflowSha,
    reviewRunId: String(reviewRunId ?? ''),
    reviewRunAttempt: Number(reviewRunAttempt),
    reviewer,
    reviewedAt,
  };
  validateReleaseEvidenceReviewExecution(execution);
  return execution;
}

export function createReleaseEvidenceReviewEvent({
  eventName,
  event,
  execution,
  request,
} = {}) {
  assert(eventName === 'workflow_dispatch', `Unsupported GitHub event: ${eventName}`);
  assertRecord(event, 'GitHub workflow_dispatch event');
  assertRecord(event.repository, 'GitHub workflow_dispatch repository');
  assertRecord(event.inputs, 'GitHub workflow_dispatch inputs');
  assertRecord(event.sender, 'GitHub workflow_dispatch sender');
  const evidence = {
    eventName,
    repository: event.repository.full_name,
    ref: event.ref,
    workflow: event.workflow,
    reviewer: event.sender.login,
    inputs: {
      repository: event.inputs.repository,
      workflow: event.inputs.workflow,
      sourceRef: event.inputs.source_ref,
      sourceDigest: event.inputs.source_digest,
      registryValidationRunId: String(event.inputs.registry_validation_run_id ?? ''),
      version: event.inputs.version,
      expectedTag: event.inputs.expected_tag,
      reviewedCandidateSha256: event.inputs.reviewed_candidate_sha256,
    },
  };
  validateReleaseEvidenceReviewEvent(evidence, { execution, request });
  return evidence;
}

export function validateReleaseEvidenceReviewExecution(execution) {
  assertExactFields(
    execution,
    RELEASE_EVIDENCE_REVIEW_EXECUTION_FIELDS,
    'Release evidence review execution identity'
  );
  assert(REPOSITORY_NAME.test(execution.repository), 'Invalid review repository.');
  assert(GITHUB_REF.test(execution.sourceRef), 'Invalid review source ref.');
  assert(FULL_COMMIT_SHA.test(execution.sourceDigest), 'Invalid review source digest.');
  assert(
    execution.workflowName === RELEASE_EVIDENCE_REVIEW_WORKFLOW_NAME,
    `Workflow name must be exactly ${RELEASE_EVIDENCE_REVIEW_WORKFLOW_NAME}.`
  );
  assert(
    execution.workflowPath === RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH,
    `Workflow path must be exactly ${RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH}.`
  );
  assert(
    execution.workflowRef ===
      `${execution.repository}/${execution.workflowPath}@${execution.sourceRef}`,
    'Workflow ref does not bind repository, workflow path, and source ref.'
  );
  assert(FULL_COMMIT_SHA.test(execution.workflowSha), 'Invalid workflow SHA.');
  assert(
    execution.workflowSha === execution.sourceDigest,
    'Workflow SHA must equal the reviewed workflow source digest.'
  );
  assert(POSITIVE_DECIMAL.test(execution.reviewRunId), 'Review run ID must be a positive decimal string.');
  assert(
    Number.isSafeInteger(execution.reviewRunAttempt) &&
      execution.reviewRunAttempt > 0,
    'Review run attempt must be a positive safe integer.'
  );
  validateReviewer(execution.reviewer);
  requireIsoTimestamp(execution.reviewedAt, 'Review timestamp');
}

export function validateReleaseEvidenceReviewEvent(
  event,
  { execution, request }
) {
  assertExactFields(event, RELEASE_EVIDENCE_REVIEW_EVENT_FIELDS, 'Release evidence workflow-dispatch event');
  assertExactFields(
    event.inputs,
    RELEASE_EVIDENCE_REVIEW_EVENT_INPUT_FIELDS,
    'Release evidence workflow-dispatch inputs'
  );
  validateReleaseEvidenceReviewExecution(execution);
  validateReviewRequest(request);
  assert(event.eventName === 'workflow_dispatch', 'GitHub event must be workflow_dispatch.');
  assert(event.repository === execution.repository, 'GitHub event repository does not match review execution.');
  assert(event.ref === execution.sourceRef, 'GitHub event ref does not match review execution.');
  assert(event.workflow === execution.workflowPath, 'GitHub event workflow does not match review execution.');
  assert(event.reviewer === execution.reviewer, 'GitHub event actor does not match the reviewer.');
  for (const field of RELEASE_EVIDENCE_REVIEW_EVENT_INPUT_FIELDS) {
    assert(
      event.inputs[field] === request[field],
      `GitHub event ${field} input does not match the review request.`
    );
  }
}

export function createReleaseEvidenceReviewBundle(
  {
    acquisitionDir,
    candidateFile,
    policyReportFile,
    archiveRoot,
    bundleDir,
    reportFile,
    reviewedCandidateSha256,
    execution,
    githubEvent,
    workflowFile,
    request,
  } = {},
  dependencies = {}
) {
  const destination = bundleDir ? path.resolve(bundleDir) : null;
  const resolvedReport = reportFile ? path.resolve(reportFile) : null;
  const state = receiptState(execution);
  let temporary = null;
  let reportTemporary = null;
  let bundleExposed = false;

  try {
    assert(acquisitionDir, 'Missing acquisition bundle directory.');
    assert(candidateFile, 'Missing reviewed policy candidate file.');
    assert(policyReportFile, 'Missing policy diff report file.');
    assert(archiveRoot, 'Missing committed release evidence archive root.');
    assert(bundleDir, 'Missing review bundle destination.');
    assert(workflowFile, 'Missing review workflow definition file.');
    assert(!existsSync(destination), `Review bundle destination already exists: ${destination}`);
    assertPathSeparate(destination, path.resolve(acquisitionDir), 'Review bundle and acquisition bundle must not overlap.');
    assertPathSeparate(destination, path.resolve(archiveRoot), 'Review bundle and committed archive must not overlap.');
    if (resolvedReport) {
      assertPathOutside(resolvedReport, destination, 'Review report must be outside the review bundle.');
      assertPathOutside(resolvedReport, path.resolve(acquisitionDir), 'Review report must be outside the acquisition bundle.');
      assertPathOutside(resolvedReport, path.resolve(archiveRoot), 'Review report must be outside the committed archive.');
    }

    validateReleaseEvidenceReviewExecution(execution);
    validateReviewRequest(request);
    validateReleaseEvidenceReviewEvent(githubEvent, { execution, request });
    Object.assign(state, receiptState(execution));

    const inspectionRoot = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-inspection-'));
    let inspection;
    try {
      inspection = inspectReleaseEvidenceAcquisitionBundle(
        { acquisitionDir: path.resolve(acquisitionDir) },
        {
          inspectionArchivePath: () => path.join(inspectionRoot, 'archive'),
        }
      );
    } finally {
      rmSync(inspectionRoot, { recursive: true, force: true });
    }
    const candidateBytes = readSecureFile(path.resolve(candidateFile), 'reviewed policy candidate');
    const candidate = readReleaseEvidencePolicyCandidate(candidateFile);
    assert(
      isDeepStrictEqual(candidate, inspection.candidate),
      'Reviewed policy candidate does not match the acquisition bundle.'
    );
    const candidateDigest = sha256(candidateBytes);
    state.packageName = candidate.policy.package;
    state.version = candidate.version;
    state.candidateSha256 = candidateDigest;
    assert(
      reviewedCandidateSha256 === candidateDigest,
      'Reviewed candidate SHA-256 does not match the candidate bytes.'
    );
    assert(
      request.reviewedCandidateSha256 === candidateDigest,
      'Workflow-dispatch reviewed candidate SHA-256 does not match the candidate bytes.'
    );
    validateRequestAgainstCandidate(request, candidate);
    assert(
      Date.parse(execution.reviewedAt) >=
        Date.parse(candidate.policy.registryValidationRun.completedAt),
      'Review timestamp must not precede Registry Validation completion.'
    );

    const normalizedDiff = normalizePolicyDiff(
      policyReportFile,
      candidate,
      candidateDigest,
      dependencies.policies ?? RELEASE_EVIDENCE_POLICIES
    );
    assert(
      normalizedDiff.policyStatus === 'match',
      `Reviewed candidate is not the committed ${candidate.version} policy (${normalizedDiff.policyStatus}).`
    );
    const workflowBytes = readSecureFile(path.resolve(workflowFile), 'review workflow definition');
    assert(workflowBytes.length > 0, 'Review workflow definition must not be empty.');

    mkdirSync(path.dirname(destination), { recursive: true });
    temporary = temporaryPath(destination, 'review-bundle');
    mkdirSync(temporary);
    copyDirectorySecure(
      path.resolve(acquisitionDir),
      path.join(temporary, RELEASE_EVIDENCE_REVIEW_ACQUISITION_DIR)
    );
    writeFileSync(
      path.join(temporary, RELEASE_EVIDENCE_REVIEW_CANDIDATE_FILE),
      candidateBytes,
      { flag: 'wx' }
    );
    writeFileSync(
      path.join(temporary, RELEASE_EVIDENCE_REVIEW_DIFF_FILE),
      canonicalReleaseEvidencePolicyReport(normalizedDiff),
      { encoding: 'utf8', flag: 'wx' }
    );
    writeFileSync(
      path.join(temporary, RELEASE_EVIDENCE_REVIEW_EXECUTION_FILE),
      canonicalReleaseEvidenceReviewJson(execution),
      { encoding: 'utf8', flag: 'wx' }
    );
    writeFileSync(
      path.join(temporary, RELEASE_EVIDENCE_REVIEW_EVENT_FILE),
      canonicalReleaseEvidenceReviewJson(githubEvent),
      { encoding: 'utf8', flag: 'wx' }
    );
    writeFileSync(
      path.join(temporary, RELEASE_EVIDENCE_REVIEW_WORKFLOW_FILE),
      workflowBytes,
      { flag: 'wx' }
    );

    const archiveSet = path.join(temporary, RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_DIR);
    prepareArchiveSetSource({
      sourceRoot: path.resolve(archiveRoot),
      destinationRoot: archiveSet,
      targetVersion: candidate.version,
      policies: dependencies.policies ?? RELEASE_EVIDENCE_POLICIES,
      verifyArchive: dependencies.verifyArchive ?? verifyReleaseEvidenceArchive,
    });
    if (dependencies.seedDuplicateTarget === true) {
      copyDirectorySecure(
        path.join(path.resolve(archiveRoot), candidate.version),
        path.join(archiveSet, candidate.version)
      );
    }

    const promote = dependencies.promote ?? promoteReleaseEvidencePolicyCandidate;
    const promotion = promote(
      {
        acquisitionDir: path.join(temporary, RELEASE_EVIDENCE_REVIEW_ACQUISITION_DIR),
        candidateFile: path.join(temporary, RELEASE_EVIDENCE_REVIEW_CANDIDATE_FILE),
        expectedVersion: candidate.version,
        reviewedCandidateSha256: candidateDigest,
        reviewer: execution.reviewer,
        reviewedAt: execution.reviewedAt,
        approved: true,
        archiveRoot: archiveSet,
      },
      dependencies.promotionDependencies ?? {}
    );
    assert(
      promotion?.status === 'passed',
      `Reviewed promotion rehearsal failed: ${promotion?.error ?? 'unknown error'}`
    );
    const normalizedPromotion = normalizePromotionReport(promotion);
    const promotionBytes = Buffer.from(
      canonicalReleaseEvidencePolicyPromotion(normalizedPromotion),
      'utf8'
    );
    writeFileSync(
      path.join(temporary, RELEASE_EVIDENCE_REVIEW_PROMOTION_FILE),
      promotionBytes,
      { flag: 'wx' }
    );

    const verifySet = dependencies.verifySet ?? verifyReleaseEvidenceSet;
    const setReport = verifySet({
      archiveRoot: archiveSet,
      versions: Object.keys(dependencies.policies ?? RELEASE_EVIDENCE_POLICIES).sort(compareVersions),
    });
    assert(
      setReport?.status === 'passed',
      `Release evidence set rehearsal failed: ${setReport?.error ?? 'unknown error'}`
    );
    const normalizedSet = normalizeSetReport(setReport);
    const setBytes = Buffer.from(canonicalReleaseEvidenceSetReport(normalizedSet), 'utf8');
    writeFileSync(
      path.join(temporary, RELEASE_EVIDENCE_REVIEW_SET_FILE),
      setBytes,
      { flag: 'wx' }
    );

    state.acquisitionSha256 = inspection.manifest.acquisitionSha256;
    state.evidenceSha256 = promotion.evidenceSha256;
    state.promotionReportSha256 = sha256(promotionBytes);
    state.setReportSha256 = sha256(setBytes);
    const receipt = createReleaseEvidenceReviewReceipt({
      ...state,
      status: 'passed',
      error: null,
    });
    const receiptBytes = Buffer.from(canonicalReleaseEvidenceReviewReceipt(receipt), 'utf8');
    writeFileSync(
      path.join(temporary, RELEASE_EVIDENCE_REVIEW_RECEIPT_FILE),
      receiptBytes,
      { flag: 'wx' }
    );

    const manifest = createReleaseEvidenceReviewManifest(temporary);
    writeFileSync(
      path.join(temporary, RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE),
      canonicalReleaseEvidenceReviewManifest(manifest),
      { encoding: 'utf8', flag: 'wx' }
    );

    const replay = verifyReleaseEvidenceReviewBundle(
      { bundleDir: temporary, expectations: expectationsFromReceipt(receipt) },
      dependencies.verifierDependencies ?? {}
    );
    assert(
      canonicalReleaseEvidenceReviewReceipt(replay) ===
        canonicalReleaseEvidenceReviewReceipt(receipt),
      `Review bundle self-verification failed: ${replay.error ?? 'receipt mismatch'}`
    );

    if (resolvedReport) {
      mkdirSync(path.dirname(resolvedReport), { recursive: true });
      reportTemporary = temporaryPath(resolvedReport, 'review-report');
      writeFileSync(reportTemporary, receiptBytes, { flag: 'wx' });
    }
    const renameBundle = dependencies.renameBundle ?? renameSync;
    renameBundle(temporary, destination);
    temporary = null;
    bundleExposed = true;
    if (resolvedReport) {
      const renameReport = dependencies.renameReport ?? renameSync;
      renameReport(reportTemporary, resolvedReport);
      reportTemporary = null;
    }
    return receipt;
  } catch (error) {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
    if (reportTemporary) rmSync(reportTemporary, { force: true });
    if (bundleExposed) rmSync(destination, { recursive: true, force: true });
    return createReleaseEvidenceReviewReceipt({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function verifyReleaseEvidenceReviewBundle(
  { bundleDir, expectations } = {},
  dependencies = {}
) {
  const state = {};
  let replayRoot = null;
  let inspectionRoot = null;
  try {
    validateExpectations(expectations);
    const root = validateDirectory(bundleDir, 'release evidence review bundle');
    assertExactEntries(readdirSync(root), TOP_LEVEL_ENTRIES, 'Review bundle');
    const manifestBytes = readSecureFile(
      path.join(root, RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE),
      'review artifact manifest'
    );
    const manifest = validateCanonicalReleaseEvidenceReviewManifestBytes(manifestBytes);
    const actualPaths = listRegularFiles(root)
      .filter((file) => file !== RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE);
    assert(
      JSON.stringify(actualPaths) === JSON.stringify(manifest.files.map((file) => file.path)),
      'Review artifact manifest paths do not exactly match the bundle files.'
    );
    for (const entry of manifest.files) {
      const bytes = readSecureFile(path.join(root, entry.path), `review evidence ${entry.path}`);
      assert(bytes.length === entry.size, `Review evidence size drift: ${entry.path}`);
      assert(sha256(bytes) === entry.sha256, `Review evidence digest drift: ${entry.path}`);
    }

    const receiptBytes = readSecureFile(
      path.join(root, RELEASE_EVIDENCE_REVIEW_RECEIPT_FILE),
      'review receipt'
    );
    const receipt = parseCanonicalReceipt(receiptBytes);
    Object.assign(state, receiptStateFromReceipt(receipt));
    validateReceiptExpectations(receipt, expectations);

    const execution = parseCanonicalObject(
      readSecureFile(path.join(root, RELEASE_EVIDENCE_REVIEW_EXECUTION_FILE), 'review execution identity'),
      RELEASE_EVIDENCE_REVIEW_EXECUTION_FIELDS,
      'Review execution identity'
    );
    const githubEvent = parseCanonicalObject(
      readSecureFile(path.join(root, RELEASE_EVIDENCE_REVIEW_EVENT_FILE), 'review workflow-dispatch event'),
      RELEASE_EVIDENCE_REVIEW_EVENT_FIELDS,
      'Review workflow-dispatch event'
    );
    assertExactFields(
      githubEvent.inputs,
      RELEASE_EVIDENCE_REVIEW_EVENT_INPUT_FIELDS,
      'Review workflow-dispatch inputs'
    );
    const candidateBytes = readSecureFile(
      path.join(root, RELEASE_EVIDENCE_REVIEW_CANDIDATE_FILE),
      'reviewed policy candidate'
    );
    const candidate = readReleaseEvidencePolicyCandidate(
      path.join(root, RELEASE_EVIDENCE_REVIEW_CANDIDATE_FILE)
    );
    assert(
      candidateBytes.equals(Buffer.from(canonicalReleaseEvidencePolicyCandidate(candidate), 'utf8')),
      'Reviewed policy candidate is not canonical JSON.'
    );
    const candidateDigest = sha256(candidateBytes);
    const request = githubEvent.inputs;
    validateReleaseEvidenceReviewEvent(githubEvent, { execution, request });
    validateRequestAgainstCandidate(request, candidate);
    assert(request.reviewedCandidateSha256 === candidateDigest, 'Review event candidate digest does not match candidate bytes.');
    assert(
      Date.parse(execution.reviewedAt) >= Date.parse(candidate.policy.registryValidationRun.completedAt),
      'Review timestamp must not precede Registry Validation completion.'
    );
    const workflowBytes = readSecureFile(
      path.join(root, RELEASE_EVIDENCE_REVIEW_WORKFLOW_FILE),
      'review workflow definition'
    );
    assert(workflowBytes.length > 0, 'Review workflow definition must not be empty.');

    inspectionRoot = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-verify-inspection-'));
    const inspection = inspectReleaseEvidenceAcquisitionBundle(
      { acquisitionDir: path.join(root, RELEASE_EVIDENCE_REVIEW_ACQUISITION_DIR) },
      { inspectionArchivePath: () => path.join(inspectionRoot, 'archive') }
    );
    assert(isDeepStrictEqual(candidate, inspection.candidate), 'Review candidate does not match bundled acquisition evidence.');
    rmSync(inspectionRoot, { recursive: true, force: true });
    inspectionRoot = null;

    const policies = dependencies.policies ?? RELEASE_EVIDENCE_POLICIES;
    const storedDiff = parseCanonicalPolicyDiff(
      readSecureFile(path.join(root, RELEASE_EVIDENCE_REVIEW_DIFF_FILE), 'policy diff report')
    );
    const expectedComparison = compareReleaseEvidencePolicy(candidate.policy, policies[candidate.version]);
    const expectedDiff = createReleaseEvidencePolicyReport({
      acquisitionDir: RELEASE_EVIDENCE_REVIEW_ACQUISITION_DIR,
      candidateFile: RELEASE_EVIDENCE_REVIEW_CANDIDATE_FILE,
      version: candidate.version,
      candidateSha256: candidateDigest,
      policyStatus: expectedComparison.status,
      changes: expectedComparison.changes,
      checks: Object.fromEntries(RELEASE_EVIDENCE_POLICY_CHECK_FIELDS.map((field) => [field, true])),
      status: 'passed',
      error: null,
    });
    assert(
      canonicalReleaseEvidencePolicyReport(storedDiff) === canonicalReleaseEvidencePolicyReport(expectedDiff),
      'Bundled policy diff does not match acquisition and committed policy.'
    );
    assert(expectedComparison.status === 'match', `Bundled candidate policy is ${expectedComparison.status}.`);

    const archiveSet = path.join(root, RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_DIR);
    const storedSetBytes = readSecureFile(path.join(root, RELEASE_EVIDENCE_REVIEW_SET_FILE), 'release evidence set report');
    const storedSet = parseCanonicalSetReport(storedSetBytes);
    const reviewedVersions = [...storedSet.versions];
    assert(
      reviewedVersions.length > 0 &&
        new Set(reviewedVersions).size === reviewedVersions.length,
      'Bundled release evidence set versions must be non-empty and unique.'
    );
    assert(
      JSON.stringify(reviewedVersions) ===
        JSON.stringify([...reviewedVersions].sort(compareVersions)),
      'Bundled release evidence set versions must use stable order.'
    );
    assert(
      reviewedVersions.includes(candidate.version),
      'Bundled release evidence set must contain the reviewed candidate version.'
    );
    const reviewedPolicies = Object.fromEntries(
      reviewedVersions.map((version) => {
        assert(
          policies[version],
          `Bundled release evidence set references an unsupported policy version: ${version}.`
        );
        return [version, policies[version]];
      })
    );
    assertExactEntries(
      readdirSync(archiveSet),
      reviewedVersions,
      'Bundled release evidence archive set'
    );
    const directSet = (dependencies.verifySet ?? verifyReleaseEvidenceSet)({
      archiveRoot: archiveSet,
      versions: reviewedVersions,
    });
    assert(directSet.status === 'passed', `Bundled archive set verification failed: ${directSet.error}`);
    assert(
      canonicalReleaseEvidenceSetReport(normalizeSetReport(directSet)) === storedSetBytes.toString('utf8'),
      'Bundled release evidence set report does not match the archive set.'
    );

    replayRoot = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-replay-'));
    const replaySet = path.join(replayRoot, RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_DIR);
    mkdirSync(replaySet);
    for (const version of reviewedVersions) {
      if (version === candidate.version) continue;
      copyDirectorySecure(path.join(archiveSet, version), path.join(replaySet, version));
    }
    const replayPromotion = (dependencies.promote ?? promoteReleaseEvidencePolicyCandidate)(
      {
        acquisitionDir: path.join(root, RELEASE_EVIDENCE_REVIEW_ACQUISITION_DIR),
        candidateFile: path.join(root, RELEASE_EVIDENCE_REVIEW_CANDIDATE_FILE),
        expectedVersion: candidate.version,
        reviewedCandidateSha256: candidateDigest,
        reviewer: execution.reviewer,
        reviewedAt: execution.reviewedAt,
        approved: true,
        archiveRoot: replaySet,
      },
      {
        ...(dependencies.promotionDependencies ?? {}),
        policies: reviewedPolicies,
      }
    );
    assert(replayPromotion.status === 'passed', `Offline promotion replay failed: ${replayPromotion.error}`);
    const storedPromotionBytes = readSecureFile(
      path.join(root, RELEASE_EVIDENCE_REVIEW_PROMOTION_FILE),
      'promotion report'
    );
    parseCanonicalPromotionReport(storedPromotionBytes);
    assert(
      canonicalReleaseEvidencePolicyPromotion(normalizePromotionReport(replayPromotion)) ===
        storedPromotionBytes.toString('utf8'),
      'Bundled promotion report does not match offline replay.'
    );
    const replaySetReport = (dependencies.verifySet ?? verifyReleaseEvidenceSet)({
      archiveRoot: replaySet,
      versions: reviewedVersions,
    });
    assert(replaySetReport.status === 'passed', `Offline set replay failed: ${replaySetReport.error}`);
    assert(
      canonicalReleaseEvidenceSetReport(normalizeSetReport(replaySetReport)) === storedSetBytes.toString('utf8'),
      'Bundled set report does not match offline replay.'
    );
    assertDirectoriesEqual(
      path.join(replaySet, candidate.version),
      path.join(archiveSet, candidate.version)
    );

    const storedPromotion = JSON.parse(storedPromotionBytes.toString('utf8'));
    const reproducedReceipt = createReleaseEvidenceReviewReceipt({
      packageName: candidate.policy.package,
      version: candidate.version,
      candidateSha256: candidateDigest,
      reviewer: execution.reviewer,
      reviewedAt: execution.reviewedAt,
      repository: execution.repository,
      workflow: `${execution.repository}/${execution.workflowPath}`,
      workflowSha: execution.workflowSha,
      reviewRunId: execution.reviewRunId,
      reviewRunAttempt: execution.reviewRunAttempt,
      sourceRef: execution.sourceRef,
      sourceDigest: execution.sourceDigest,
      acquisitionSha256: inspection.manifest.acquisitionSha256,
      evidenceSha256: storedPromotion.evidenceSha256,
      promotionReportSha256: sha256(storedPromotionBytes),
      setReportSha256: sha256(storedSetBytes),
      status: 'passed',
      error: null,
    });
    assert(
      canonicalReleaseEvidenceReviewReceipt(reproducedReceipt) === receiptBytes.toString('utf8'),
      'Review receipt does not match its bundled evidence.'
    );
    const recreatedManifest = createReleaseEvidenceReviewManifest(root);
    assert(
      canonicalReleaseEvidenceReviewManifest(recreatedManifest) === manifestBytes.toString('utf8'),
      'Review artifact manifest does not match the bundle files.'
    );
    return reproducedReceipt;
  } catch (error) {
    return createReleaseEvidenceReviewReceipt({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (inspectionRoot) rmSync(inspectionRoot, { recursive: true, force: true });
    if (replayRoot) rmSync(replayRoot, { recursive: true, force: true });
  }
}

export function createReleaseEvidenceReviewManifest(directory) {
  const root = validateDirectory(directory, 'release evidence review bundle');
  const files = listRegularFiles(root)
    .filter((file) => file !== RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE)
    .map((file) => {
      validateManifestPath(file);
      const bytes = readSecureFile(path.join(root, file), `review evidence ${file}`);
      return { path: file, size: bytes.length, sha256: sha256(bytes) };
    });
  assert(files.length > 0, 'Review artifact manifest must contain files.');
  const manifest = {
    schemaVersion: RELEASE_EVIDENCE_REVIEW_MANIFEST_SCHEMA_VERSION,
    status: 'passed',
    files,
    error: null,
  };
  validateReleaseEvidenceReviewManifest(manifest);
  return manifest;
}

export function validateReleaseEvidenceReviewManifest(manifest) {
  assertExactFields(
    manifest,
    RELEASE_EVIDENCE_REVIEW_MANIFEST_FIELDS,
    'Release evidence review artifact manifest'
  );
  assert(
    manifest.schemaVersion === RELEASE_EVIDENCE_REVIEW_MANIFEST_SCHEMA_VERSION,
    `Unsupported review artifact manifest schemaVersion: ${manifest.schemaVersion}`
  );
  assert(manifest.status === 'passed', 'Review artifact manifest status must be passed.');
  assert(manifest.error === null, 'Review artifact manifest error must be null.');
  assert(Array.isArray(manifest.files), 'Review artifact manifest files must be an array.');
  assert(manifest.files.length > 0, 'Review artifact manifest files must not be empty.');
  const paths = [];
  for (const entry of manifest.files) {
    assertExactFields(
      entry,
      RELEASE_EVIDENCE_REVIEW_MANIFEST_ENTRY_FIELDS,
      'Review artifact manifest entry'
    );
    validateManifestPath(entry.path);
    assert(
      Number.isSafeInteger(entry.size) && entry.size >= 0,
      `Review artifact size for ${entry.path} must be a non-negative safe integer.`
    );
    assert(SHA256.test(entry.sha256), `Review artifact SHA-256 for ${entry.path} is invalid.`);
    paths.push(entry.path);
  }
  assert(
    JSON.stringify(paths) === JSON.stringify([...paths].sort(compareText)),
    'Review artifact manifest paths must be sorted.'
  );
  assert(new Set(paths).size === paths.length, 'Review artifact manifest paths must be unique.');
}

export function validateCanonicalReleaseEvidenceReviewManifestBytes(bytes) {
  const manifest = parseJson(bytes, 'review artifact manifest');
  validateReleaseEvidenceReviewManifest(manifest);
  assert(
    bytes.equals(Buffer.from(canonicalReleaseEvidenceReviewManifest(manifest), 'utf8')),
    'Review artifact manifest is not canonical JSON.'
  );
  return manifest;
}

export function writeReleaseEvidenceReviewReceiptAtomic(
  filePath,
  receipt,
  operations = {}
) {
  const mkdir = operations.mkdir ?? mkdirSync;
  const writeFile = operations.writeFile ?? writeFileSync;
  const rename = operations.rename ?? renameSync;
  const remove = operations.remove ?? rmSync;
  const destination = path.resolve(filePath);
  const temporary = temporaryPath(destination, 'review-receipt');
  mkdir(path.dirname(destination), { recursive: true });
  try {
    writeFile(temporary, canonicalReleaseEvidenceReviewReceipt(receipt), {
      encoding: 'utf8',
      flag: 'wx',
    });
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { force: true });
    throw error;
  }
}

function normalizePolicyDiff(filePath, candidate, candidateDigest, policies) {
  const stored = parseCanonicalPolicyDiff(readSecureFile(path.resolve(filePath), 'policy diff report'));
  assert(stored.status === 'passed', 'Policy diff report status must be passed.');
  assert(stored.error === null, 'Policy diff report error must be null.');
  assert(stored.version === candidate.version, 'Policy diff version does not match the candidate.');
  assert(stored.candidateSha256 === candidateDigest, 'Policy diff candidate digest does not match the candidate bytes.');
  assert(
    RELEASE_EVIDENCE_POLICY_CHECK_FIELDS.every((field) => stored.checks[field] === true),
    'Policy diff report checks must all pass.'
  );
  const comparison = compareReleaseEvidencePolicy(candidate.policy, policies[candidate.version]);
  assert(stored.policyStatus === comparison.status, 'Policy diff status does not match committed policy.');
  assert(isDeepStrictEqual(stored.changes, comparison.changes), 'Policy diff changes do not match committed policy.');
  return createReleaseEvidencePolicyReport({
    acquisitionDir: RELEASE_EVIDENCE_REVIEW_ACQUISITION_DIR,
    candidateFile: RELEASE_EVIDENCE_REVIEW_CANDIDATE_FILE,
    version: candidate.version,
    candidateSha256: candidateDigest,
    policyStatus: comparison.status,
    changes: comparison.changes,
    checks: Object.fromEntries(RELEASE_EVIDENCE_POLICY_CHECK_FIELDS.map((field) => [field, true])),
    status: 'passed',
    error: null,
  });
}

function parseCanonicalPolicyDiff(bytes) {
  const report = parseCanonicalObject(bytes, RELEASE_EVIDENCE_POLICY_REPORT_FIELDS, 'Policy diff report');
  assertExactFields(report.checks, RELEASE_EVIDENCE_POLICY_CHECK_FIELDS, 'Policy diff checks');
  assert(
    bytes.equals(Buffer.from(canonicalReleaseEvidencePolicyReport(report), 'utf8')),
    'Policy diff report is not canonical JSON.'
  );
  return report;
}

function parseCanonicalPromotionReport(bytes) {
  const report = parseCanonicalObject(bytes, RELEASE_EVIDENCE_POLICY_PROMOTION_FIELDS, 'Promotion report');
  assertExactFields(
    report.checks,
    RELEASE_EVIDENCE_POLICY_PROMOTION_CHECK_FIELDS,
    'Promotion report checks'
  );
  assert(
    bytes.equals(Buffer.from(canonicalReleaseEvidencePolicyPromotion(report), 'utf8')),
    'Promotion report is not canonical JSON.'
  );
  assert(report.status === 'passed' && report.error === null, 'Promotion report must pass.');
  return report;
}

function parseCanonicalSetReport(bytes) {
  const report = parseCanonicalObject(bytes, RELEASE_EVIDENCE_SET_FIELDS, 'Release evidence set report');
  assert(
    bytes.equals(Buffer.from(canonicalReleaseEvidenceSetReport(report), 'utf8')),
    'Release evidence set report is not canonical JSON.'
  );
  assert(report.status === 'passed' && report.error === null, 'Release evidence set report must pass.');
  return report;
}

function parseCanonicalReceipt(bytes) {
  const receipt = parseCanonicalObject(bytes, RELEASE_EVIDENCE_REVIEW_RECEIPT_FIELDS, 'Release evidence review receipt');
  assert(
    receipt.schemaVersion === RELEASE_EVIDENCE_REVIEW_SCHEMA_VERSION,
    `Unsupported release evidence review schemaVersion: ${receipt.schemaVersion}`
  );
  assert(receipt.status === 'passed', 'Review receipt status must be passed.');
  assert(receipt.error === null, 'Review receipt error must be null.');
  assert(
    bytes.equals(Buffer.from(canonicalReleaseEvidenceReviewReceipt(receipt), 'utf8')),
    'Review receipt is not canonical JSON.'
  );
  return receipt;
}

function parseCanonicalObject(bytes, fields, label) {
  const value = parseJson(bytes, label);
  assertExactFields(value, fields, label);
  assert(
    bytes.equals(Buffer.from(canonicalReleaseEvidenceReviewJson(value), 'utf8')),
    `${label} is not canonical JSON.`
  );
  return value;
}

function normalizePromotionReport(report) {
  return {
    ...report,
    archiveDir: `${RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_DIR}/${report.version}`,
  };
}

function normalizeSetReport(report) {
  return { ...report, archiveRoot: RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_DIR };
}

function prepareArchiveSetSource({
  sourceRoot,
  destinationRoot,
  targetVersion,
  policies,
  verifyArchive,
}) {
  const source = validateDirectory(sourceRoot, 'committed release evidence archive root');
  const knownVersions = Object.keys(policies).sort(compareVersions);
  const actualEntries = readdirSync(source).sort(compareVersions);
  for (const entry of actualEntries) {
    assert(knownVersions.includes(entry), `Unknown committed release evidence archive version: ${entry}`);
  }
  mkdirSync(destinationRoot);
  for (const version of knownVersions) {
    if (version === targetVersion) continue;
    const sourceVersion = path.join(source, version);
    assert(existsSync(sourceVersion), `Missing committed baseline archive version: ${version}`);
    const verification = verifyArchive({
      archiveDir: sourceVersion,
      expectedVersion: version,
      expectedPolicy: policies[version],
    });
    assert(verification.status === 'passed', `Committed baseline archive ${version} failed: ${verification.error}`);
    copyDirectorySecure(sourceVersion, path.join(destinationRoot, version));
  }
}

function validateRequestAgainstCandidate(request, candidate) {
  validateReviewRequest(request);
  assert(request.repository === candidate.policy.repository, 'Review request repository does not match candidate policy.');
  assert(
    `${request.repository}/${request.workflow}` === candidate.policy.workflow,
    'Review request workflow does not match candidate policy.'
  );
  assert(request.sourceRef === candidate.policy.sourceRef, 'Review request source ref does not match candidate policy.');
  assert(request.sourceDigest === candidate.policy.sourceDigest, 'Review request source digest does not match candidate policy.');
  assert(
    request.registryValidationRunId === String(candidate.policy.registryValidationRun.id),
    'Review request Registry Validation run does not match candidate policy.'
  );
  assert(request.version === candidate.version, 'Review request version does not match candidate.');
  assert(request.expectedTag === candidate.policy.expectedTag, 'Review request expected tag does not match candidate policy.');
}

function validateReviewRequest(request) {
  assertExactFields(request, RELEASE_EVIDENCE_REVIEW_EVENT_INPUT_FIELDS, 'Release evidence review request');
  assert(REPOSITORY_NAME.test(request.repository), 'Invalid Registry Validation repository.');
  assert(WORKFLOW_PATH.test(request.workflow), 'Invalid Registry Validation workflow path.');
  assert(GITHUB_REF.test(request.sourceRef), 'Invalid Registry Validation source ref.');
  assert(FULL_COMMIT_SHA.test(request.sourceDigest), 'Invalid Registry Validation source digest.');
  assert(POSITIVE_DECIMAL.test(request.registryValidationRunId), 'Registry Validation run ID must be a positive decimal string.');
  assert(PACKAGE_VERSION.test(request.version), 'Invalid reviewed package version.');
  assert(typeof request.expectedTag === 'string' && request.expectedTag.length > 0, 'Expected dist-tag is required.');
  assert(SHA256.test(request.reviewedCandidateSha256), 'Reviewed candidate SHA-256 must be a lowercase 64-character digest.');
}

function receiptState(execution = {}) {
  return {
    packageName: null,
    version: null,
    candidateSha256: null,
    reviewer: execution?.reviewer ?? null,
    reviewedAt: execution?.reviewedAt ?? null,
    repository: execution?.repository ?? null,
    workflow:
      execution?.repository && execution?.workflowPath
        ? `${execution.repository}/${execution.workflowPath}`
        : null,
    workflowSha: execution?.workflowSha ?? null,
    reviewRunId: execution?.reviewRunId ?? null,
    reviewRunAttempt: execution?.reviewRunAttempt ?? null,
    sourceRef: execution?.sourceRef ?? null,
    sourceDigest: execution?.sourceDigest ?? null,
    acquisitionSha256: null,
    evidenceSha256: null,
    promotionReportSha256: null,
    setReportSha256: null,
  };
}

function receiptStateFromReceipt(receipt) {
  return {
    packageName: receipt.package,
    version: receipt.version,
    candidateSha256: receipt.candidateSha256,
    reviewer: receipt.reviewer,
    reviewedAt: receipt.reviewedAt,
    repository: receipt.repository,
    workflow: receipt.workflow,
    workflowSha: receipt.workflowSha,
    reviewRunId: receipt.reviewRunId,
    reviewRunAttempt: receipt.reviewRunAttempt,
    sourceRef: receipt.sourceRef,
    sourceDigest: receipt.sourceDigest,
    acquisitionSha256: receipt.acquisitionSha256,
    evidenceSha256: receipt.evidenceSha256,
    promotionReportSha256: receipt.promotionReportSha256,
    setReportSha256: receipt.setReportSha256,
  };
}

function expectationsFromReceipt(receipt) {
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

function validateExpectations(expectations) {
  assertRecord(expectations, 'Review bundle expectations');
  assert(typeof expectations.packageName === 'string' && expectations.packageName.length > 0, 'Expected package is required.');
  assert(PACKAGE_VERSION.test(expectations.version), 'Expected version is invalid.');
  assert(SHA256.test(expectations.candidateSha256), 'Expected candidate SHA-256 is invalid.');
  validateReviewer(expectations.reviewer);
  assert(REPOSITORY_NAME.test(expectations.repository), 'Expected review repository is invalid.');
  assert(
    expectations.workflow === `${expectations.repository}/${RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH}`,
    'Expected review workflow is invalid.'
  );
  assert(GITHUB_REF.test(expectations.sourceRef), 'Expected review source ref is invalid.');
  assert(FULL_COMMIT_SHA.test(expectations.sourceDigest), 'Expected review source digest is invalid.');
  assert(POSITIVE_DECIMAL.test(String(expectations.reviewRunId)), 'Expected review run ID is invalid.');
  assert(
    Number.isSafeInteger(Number(expectations.reviewRunAttempt)) && Number(expectations.reviewRunAttempt) > 0,
    'Expected review run attempt is invalid.'
  );
}

function validateReceiptExpectations(receipt, expectations) {
  const fields = [
    ['package', 'packageName'],
    ['version', 'version'],
    ['candidateSha256', 'candidateSha256'],
    ['reviewer', 'reviewer'],
    ['repository', 'repository'],
    ['workflow', 'workflow'],
    ['sourceRef', 'sourceRef'],
    ['sourceDigest', 'sourceDigest'],
    ['reviewRunId', 'reviewRunId'],
    ['reviewRunAttempt', 'reviewRunAttempt'],
  ];
  for (const [receiptField, expectationField] of fields) {
    assert(
      String(receipt[receiptField]) === String(expectations[expectationField]),
      `Review receipt ${receiptField} does not match the explicit expectation.`
    );
  }
}

function copyDirectorySecure(sourcePath, destinationPath) {
  const source = validateDirectory(sourcePath, `source directory ${sourcePath}`);
  mkdirSync(destinationPath);
  for (const entry of readdirSync(source).sort(compareText)) {
    const sourceEntry = path.join(source, entry);
    const destinationEntry = path.join(destinationPath, entry);
    const stat = lstatSync(sourceEntry);
    assert(!stat.isSymbolicLink(), `Symbolic links are not allowed: ${sourceEntry}`);
    if (stat.isDirectory()) {
      copyDirectorySecure(sourceEntry, destinationEntry);
    } else {
      assert(stat.isFile(), `Unsupported source entry: ${sourceEntry}`);
      writeFileSync(destinationEntry, readFileSync(sourceEntry), { flag: 'wx' });
    }
  }
}

function assertDirectoriesEqual(actualRoot, expectedRoot) {
  const actualFiles = listRegularFiles(validateDirectory(actualRoot, 'replayed target archive'));
  const expectedFiles = listRegularFiles(validateDirectory(expectedRoot, 'bundled target archive'));
  assert(
    JSON.stringify(actualFiles) === JSON.stringify(expectedFiles),
    'Replayed target archive file layout differs from the bundled archive.'
  );
  for (const file of actualFiles) {
    assert(
      readFileSync(path.join(actualRoot, file)).equals(readFileSync(path.join(expectedRoot, file))),
      `Replayed target archive bytes differ: ${file}`
    );
  }
}

function listRegularFiles(directory) {
  const files = [];
  function visit(current, relative) {
    for (const entry of readdirSync(current).sort(compareText)) {
      const absolute = path.join(current, entry);
      const child = relative ? `${relative}/${entry}` : entry;
      const stat = lstatSync(absolute);
      assert(!stat.isSymbolicLink(), `Symbolic links are not allowed in review bundles: ${child}`);
      if (stat.isDirectory()) visit(absolute, child);
      else {
        assert(stat.isFile(), `Unsupported review bundle entry: ${child}`);
        files.push(child);
      }
    }
  }
  visit(directory, '');
  return files.sort(compareText);
}

function validateDirectory(directory, label) {
  assert(directory, `Missing ${label}.`);
  const resolved = path.resolve(directory);
  const stat = lstatSync(resolved);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), `${label} must be a real directory.`);
  return realpathSync(resolved);
}

function readSecureFile(filePath, label) {
  const resolved = path.resolve(filePath);
  const stat = lstatSync(resolved);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular file.`);
  return readFileSync(resolved);
}

function validateManifestPath(filePath) {
  assert(typeof filePath === 'string' && filePath.length > 0, 'Review manifest path is required.');
  assert(!path.isAbsolute(filePath), `Review manifest path must be relative: ${filePath}`);
  assert(!filePath.includes('\\'), `Review manifest path must use forward slashes: ${filePath}`);
  const normalized = path.posix.normalize(filePath);
  assert(
    normalized === filePath && !filePath.startsWith('../') && filePath !== '..',
    `Unsafe review manifest path: ${filePath}`
  );
  assert(filePath !== RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE, 'Review manifest must not describe itself.');
}

function parseJson(bytes, label) {
  assert(Buffer.isBuffer(bytes), `${label} bytes are required.`);
  try {
    const value = JSON.parse(bytes.toString('utf8'));
    assertRecord(value, label);
    return value;
  } catch (error) {
    throw new Error(`Could not parse ${label}: ${error.message}`);
  }
}

function assertExactFields(value, fields, label) {
  assertRecord(value, label);
  assert(
    JSON.stringify(Object.keys(value)) === JSON.stringify(fields),
    `${label} fields must be exactly: ${fields.join(', ')}.`
  );
}

function assertExactEntries(actual, expected, label) {
  const normalized = [...actual].sort(compareText);
  assert(
    JSON.stringify(normalized) === JSON.stringify([...expected].sort(compareText)),
    `${label} entries must be exactly: ${[...expected].sort(compareText).join(', ')}.`
  );
}

function assertPathOutside(candidate, root, message) {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  assert(
    resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`),
    message
  );
}

function assertPathSeparate(left, right, message) {
  assertPathOutside(left, right, message);
  assertPathOutside(right, left, message);
}

function requireIsoTimestamp(value, label) {
  assert(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().startsWith(value.replace(/Z$/, '')),
    `${label} must be canonical UTC ISO-8601.`
  );
}

function validateReviewer(value) {
  assert(
    typeof value === 'string' &&
      value.length > 0 &&
      value === value.trim() &&
      !/[\u0000-\u001f\u007f]/.test(value),
    'Review actor must be explicit and canonical.'
  );
}

function temporaryPath(destination, label) {
  return path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.${label}.tmp`
  );
}

function compareText(left, right) {
  return left.localeCompare(right, 'en');
}

function compareVersions(left, right) {
  return left.localeCompare(right, 'en', { numeric: true });
}

function assertRecord(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
