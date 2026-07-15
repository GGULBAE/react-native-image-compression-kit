import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE,
  RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH,
  validateCanonicalReleaseEvidenceReviewManifestBytes,
} from './release-evidence-review-core.mjs';
import {
  GITHUB_ACTIONS_OIDC_ISSUER,
  PINNED_GITHUB_TRUSTED_ROOT_SHA256,
  SLSA_PROVENANCE_V1,
  sha256,
  validateGitHubAttestationEvidence,
} from './registry-attestation-core.mjs';

export const RELEASE_EVIDENCE_REVIEW_ATTESTATION_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_REVIEW_ATTESTATION_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'subject',
  'subjectSha256',
  'repository',
  'signerWorkflow',
  'sourceRef',
  'sourceDigest',
  'workflowSha',
  'reviewRunId',
  'reviewRunAttempt',
  'reviewer',
  'candidateSha256',
  'oidcIssuer',
  'predicateType',
  'verifiedTimestamps',
  'checks',
  'error',
]);
export const RELEASE_EVIDENCE_REVIEW_ATTESTATION_CHECK_FIELDS = Object.freeze([
  'review',
  'manifest',
  'subject',
  'repository',
  'workflow',
  'ref',
  'sourceDigest',
  'workflowDigest',
  'invocation',
  'signature',
]);

export function createReleaseEvidenceReviewAttestationReport({
  status = 'failed',
  subject = RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE,
  subjectSha256 = null,
  repository = null,
  signerWorkflow = null,
  sourceRef = null,
  sourceDigest = null,
  workflowSha = null,
  reviewRunId = null,
  reviewRunAttempt = null,
  reviewer = null,
  candidateSha256 = null,
  oidcIssuer = GITHUB_ACTIONS_OIDC_ISSUER,
  predicateType = SLSA_PROVENANCE_V1,
  verifiedTimestamps = [],
  checks = {},
  error = null,
} = {}) {
  return {
    schemaVersion: RELEASE_EVIDENCE_REVIEW_ATTESTATION_SCHEMA_VERSION,
    status,
    subject,
    subjectSha256,
    repository,
    signerWorkflow,
    sourceRef,
    sourceDigest,
    workflowSha,
    reviewRunId,
    reviewRunAttempt,
    reviewer,
    candidateSha256,
    oidcIssuer,
    predicateType,
    verifiedTimestamps: verifiedTimestamps.map((timestamp) => ({
      type: timestamp.type,
      uri: timestamp.uri,
      timestamp: timestamp.timestamp,
    })),
    checks: Object.fromEntries(
      RELEASE_EVIDENCE_REVIEW_ATTESTATION_CHECK_FIELDS.map((field) => [
        field,
        checks[field] === true,
      ])
    ),
    error,
  };
}

export function canonicalReleaseEvidenceReviewAttestationReport(report) {
  return `${JSON.stringify(report)}\n`;
}

export function validateReleaseEvidenceReviewAttestationEvidence({
  manifestPath,
  manifestBytes,
  trustedRootBytes,
  verificationOutput,
  reviewReceipt,
  expectedTrustedRootSha256 = PINNED_GITHUB_TRUSTED_ROOT_SHA256,
}) {
  const state = {
    subject: manifestPath ? path.basename(manifestPath) : RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE,
    subjectSha256: manifestBytes ? sha256(manifestBytes) : null,
    repository: reviewReceipt?.repository ?? null,
    signerWorkflow: reviewReceipt?.workflow ?? null,
    sourceRef: reviewReceipt?.sourceRef ?? null,
    sourceDigest: reviewReceipt?.sourceDigest ?? null,
    workflowSha: reviewReceipt?.workflowSha ?? null,
    reviewRunId: reviewReceipt?.reviewRunId ?? null,
    reviewRunAttempt: reviewReceipt?.reviewRunAttempt ?? null,
    reviewer: reviewReceipt?.reviewer ?? null,
    candidateSha256: reviewReceipt?.candidateSha256 ?? null,
    checks: {},
  };
  try {
    assert(reviewReceipt?.status === 'passed', 'Release evidence review replay must pass before attestation verification.');
    state.checks.review = true;
    assert(
      reviewReceipt.workflow === `${reviewReceipt.repository}/${RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH}`,
      `Review signer workflow must be ${RELEASE_EVIDENCE_REVIEW_WORKFLOW_PATH}.`
    );
    validateCanonicalReleaseEvidenceReviewManifestBytes(manifestBytes);
    state.checks.manifest = true;
    const githubReport = validateGitHubAttestationEvidence({
      subjectPath: manifestPath,
      subjectBytes: manifestBytes,
      trustedRootBytes,
      verificationOutput,
      expectedSubjectName: RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE,
      validateSubjectBytes: validateCanonicalReleaseEvidenceReviewManifestBytes,
      expectedRepository: reviewReceipt.repository,
      expectedWorkflow: reviewReceipt.workflow,
      expectedRef: reviewReceipt.sourceRef,
      expectedHeadSha: reviewReceipt.sourceDigest,
      expectedWorkflowSha: reviewReceipt.workflowSha,
      expectedInvocationId: `https://github.com/${reviewReceipt.repository}/actions/runs/${reviewReceipt.reviewRunId}/attempts/${reviewReceipt.reviewRunAttempt}`,
      expectedTrustedRootSha256,
    });
    if (githubReport.status !== 'passed') throw new Error(githubReport.error);
    for (const field of RELEASE_EVIDENCE_REVIEW_ATTESTATION_CHECK_FIELDS) {
      state.checks[field] = true;
    }
    return createReleaseEvidenceReviewAttestationReport({
      ...state,
      status: 'passed',
      verifiedTimestamps: githubReport.verifiedTimestamps,
      error: null,
    });
  } catch (error) {
    return createReleaseEvidenceReviewAttestationReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function writeReleaseEvidenceReviewAttestationReportAtomic(
  filePath,
  report,
  operations = {}
) {
  const mkdir = operations.mkdir ?? mkdirSync;
  const writeFile = operations.writeFile ?? writeFileSync;
  const rename = operations.rename ?? renameSync;
  const remove = operations.remove ?? rmSync;
  const destination = path.resolve(filePath);
  const temporary = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`
  );
  mkdir(path.dirname(destination), { recursive: true });
  try {
    writeFile(temporary, canonicalReleaseEvidenceReviewAttestationReport(report), {
      encoding: 'utf8',
      flag: 'wx',
    });
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { force: true });
    throw error;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
