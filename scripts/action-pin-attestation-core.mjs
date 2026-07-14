import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ACTION_PIN_ARTIFACT_MANIFEST_FILE,
  ACTION_PIN_WORKFLOW_PATH,
  sha256,
  validateCanonicalActionPinArtifactManifestBytes,
} from './action-pin-provenance-core.mjs';
import {
  GITHUB_ACTIONS_OIDC_ISSUER,
  PINNED_GITHUB_TRUSTED_ROOT_SHA256,
  SLSA_PROVENANCE_V1,
  validateGitHubAttestationEvidence,
} from './registry-attestation-core.mjs';

export const ACTION_PIN_ATTESTATION_SCHEMA_VERSION = 1;
export const ACTION_PIN_ATTESTATION_REPORT_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'subject',
  'subjectSha256',
  'sourceRepository',
  'signerWorkflow',
  'sourceRef',
  'sourceHeadSha',
  'workflowSha',
  'runId',
  'runAttempt',
  'oidcIssuer',
  'predicateType',
  'verifiedTimestamps',
  'checks',
  'error',
]);
export const ACTION_PIN_ATTESTATION_CHECK_FIELDS = Object.freeze([
  'provenance',
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

export function createActionPinAttestationReport({
  status = 'failed',
  subject = ACTION_PIN_ARTIFACT_MANIFEST_FILE,
  subjectSha256 = null,
  sourceRepository = null,
  signerWorkflow = null,
  sourceRef = null,
  sourceHeadSha = null,
  workflowSha = null,
  runId = null,
  runAttempt = null,
  oidcIssuer = GITHUB_ACTIONS_OIDC_ISSUER,
  predicateType = SLSA_PROVENANCE_V1,
  verifiedTimestamps = [],
  checks = {},
  error = null,
} = {}) {
  return {
    schemaVersion: ACTION_PIN_ATTESTATION_SCHEMA_VERSION,
    status,
    subject,
    subjectSha256,
    sourceRepository,
    signerWorkflow,
    sourceRef,
    sourceHeadSha,
    workflowSha,
    runId,
    runAttempt,
    oidcIssuer,
    predicateType,
    verifiedTimestamps: verifiedTimestamps.map((timestamp) => ({
      type: timestamp.type,
      uri: timestamp.uri,
      timestamp: timestamp.timestamp,
    })),
    checks: Object.fromEntries(
      ACTION_PIN_ATTESTATION_CHECK_FIELDS.map((field) => [
        field,
        checks[field] === true,
      ])
    ),
    error,
  };
}

export function canonicalActionPinAttestationReport(report) {
  return `${JSON.stringify(report)}\n`;
}

export function validateActionPinAttestationEvidence({
  manifestPath,
  manifestBytes,
  trustedRootBytes,
  verificationOutput,
  provenanceReport,
  expectedTrustedRootSha256 = PINNED_GITHUB_TRUSTED_ROOT_SHA256,
}) {
  const signerWorkflow = provenanceReport?.sourceRepository && provenanceReport?.workflowPath
    ? `${provenanceReport.sourceRepository}/${provenanceReport.workflowPath}`
    : null;
  const state = {
    subject: manifestPath ? path.basename(manifestPath) : ACTION_PIN_ARTIFACT_MANIFEST_FILE,
    subjectSha256: manifestBytes ? sha256(manifestBytes) : null,
    sourceRepository: provenanceReport?.sourceRepository ?? null,
    signerWorkflow,
    sourceRef: provenanceReport?.sourceRef ?? null,
    sourceHeadSha: provenanceReport?.sourceHeadSha ?? null,
    workflowSha: provenanceReport?.workflowSha ?? null,
    runId: provenanceReport?.runId ?? null,
    runAttempt: provenanceReport?.runAttempt ?? null,
    checks: {},
  };

  try {
    assert(provenanceReport?.status === 'passed', 'Action pin provenance replay must pass before attestation verification.');
    state.checks.provenance = true;
    assert(
      provenanceReport.workflowPath === ACTION_PIN_WORKFLOW_PATH,
      `Action pin signer workflow path must be ${ACTION_PIN_WORKFLOW_PATH}.`
    );
    assert(
      provenanceReport.evidence?.artifactManifestSha256 === state.subjectSha256,
      'Action pin artifact manifest SHA-256 does not match the provenance execution report.'
    );
    validateCanonicalActionPinArtifactManifestBytes(manifestBytes);
    state.checks.manifest = true;

    const githubReport = validateGitHubAttestationEvidence({
      subjectPath: manifestPath,
      subjectBytes: manifestBytes,
      trustedRootBytes,
      verificationOutput,
      expectedSubjectName: ACTION_PIN_ARTIFACT_MANIFEST_FILE,
      validateSubjectBytes: validateCanonicalActionPinArtifactManifestBytes,
      expectedRepository: provenanceReport.sourceRepository,
      expectedWorkflow: signerWorkflow,
      expectedRef: provenanceReport.sourceRef,
      expectedHeadSha: provenanceReport.sourceHeadSha,
      expectedWorkflowSha: provenanceReport.workflowSha,
      expectedInvocationId: `https://github.com/${provenanceReport.sourceRepository}/actions/runs/${provenanceReport.runId}/attempts/${provenanceReport.runAttempt}`,
      expectedTrustedRootSha256,
    });
    if (githubReport.status !== 'passed') throw new Error(githubReport.error);

    for (const field of ACTION_PIN_ATTESTATION_CHECK_FIELDS) {
      state.checks[field] = true;
    }
    return createActionPinAttestationReport({
      ...state,
      status: 'passed',
      verifiedTimestamps: githubReport.verifiedTimestamps,
      error: null,
    });
  } catch (error) {
    return createActionPinAttestationReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function writeActionPinAttestationReportAtomic(
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
    writeFile(temporary, canonicalActionPinAttestationReport(report), {
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
