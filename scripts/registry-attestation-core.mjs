import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  REGISTRY_BUNDLE_MANIFEST_FIELDS,
  REGISTRY_BUNDLE_SCHEMA_VERSION,
  canonicalBundleManifest,
} from './registry-provenance-core.mjs';

export const REGISTRY_ATTESTATION_SCHEMA_VERSION = 1;
export const GITHUB_ACTIONS_OIDC_ISSUER =
  'https://token.actions.githubusercontent.com';
export const SLSA_PROVENANCE_V1 = 'https://slsa.dev/provenance/v1';
export const GITHUB_WORKFLOW_BUILD_TYPE =
  'https://actions.github.io/buildtypes/workflow/v1';
export const PINNED_GITHUB_TRUSTED_ROOT_SHA256 =
  '65ca537f6ed8a47fd0e560c421baa1f6c1efb8b25fc200d8c5c02c0e92eb2b9c';

export const REGISTRY_ATTESTATION_REPORT_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'subject',
  'subjectSha256',
  'repository',
  'signerWorkflow',
  'sourceRef',
  'sourceDigest',
  'oidcIssuer',
  'predicateType',
  'verifiedTimestamps',
  'error',
]);

export const REGISTRY_ATTESTATION_TIMESTAMP_FIELDS = Object.freeze([
  'type',
  'uri',
  'timestamp',
]);

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function createRegistryAttestationReport({
  status = 'failed',
  subject = null,
  subjectSha256 = null,
  repository = null,
  signerWorkflow = null,
  sourceRef = null,
  sourceDigest = null,
  oidcIssuer = GITHUB_ACTIONS_OIDC_ISSUER,
  predicateType = SLSA_PROVENANCE_V1,
  verifiedTimestamps = [],
  error = null,
} = {}) {
  return {
    schemaVersion: REGISTRY_ATTESTATION_SCHEMA_VERSION,
    status,
    subject,
    subjectSha256,
    repository,
    signerWorkflow,
    sourceRef,
    sourceDigest,
    oidcIssuer,
    predicateType,
    verifiedTimestamps: verifiedTimestamps.map((timestamp) => ({
      type: timestamp.type,
      uri: timestamp.uri,
      timestamp: timestamp.timestamp,
    })),
    error,
  };
}

export function canonicalRegistryAttestationReport(report) {
  return `${JSON.stringify(report)}\n`;
}

export function validateRegistryAttestationEvidence({
  manifestPath,
  manifestBytes,
  trustedRootBytes,
  verificationOutput,
  expectedRepository,
  expectedWorkflow,
  expectedRef,
  expectedHeadSha,
  expectedTrustedRootSha256 = PINNED_GITHUB_TRUSTED_ROOT_SHA256,
}) {
  const subject = manifestPath ? path.basename(manifestPath) : null;
  const subjectSha256 = manifestBytes ? sha256(manifestBytes) : null;
  const state = {
    subject,
    subjectSha256,
    repository: expectedRepository ?? null,
    signerWorkflow: expectedWorkflow ?? null,
    sourceRef: expectedRef ?? null,
    sourceDigest: expectedHeadSha ?? null,
    oidcIssuer: GITHUB_ACTIONS_OIDC_ISSUER,
    predicateType: SLSA_PROVENANCE_V1,
    verifiedTimestamps: [],
  };

  try {
    validateExpectations({
      expectedRepository,
      expectedWorkflow,
      expectedRef,
      expectedHeadSha,
    });
    assert(subject === 'bundle-manifest.json', 'Attestation subject must be bundle-manifest.json.');
    validateCanonicalManifest(manifestBytes);
    assert(
      sha256(trustedRootBytes) === expectedTrustedRootSha256,
      `Trusted root SHA-256 must be ${expectedTrustedRootSha256}.`
    );

    const results = parseVerificationOutput(verificationOutput);
    assert(results.length > 0, 'gh attestation verification returned no results.');
    const timestamps = [];
    for (const [index, result] of results.entries()) {
      timestamps.push(
        ...validateVerificationResult(result, index, {
          subject,
          subjectSha256,
          expectedRepository,
          expectedWorkflow,
          expectedRef,
          expectedHeadSha,
        })
      );
    }
    state.verifiedTimestamps = normalizeTimestamps(timestamps);
    assert(
      state.verifiedTimestamps.length > 0,
      'Attestation verification must include at least one verified timestamp.'
    );

    return createRegistryAttestationReport({
      ...state,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    return createRegistryAttestationReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function writeRegistryAttestationReportAtomic(
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
    writeFile(temporary, canonicalRegistryAttestationReport(report), {
      encoding: 'utf8',
      flag: 'wx',
    });
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { force: true });
    throw error;
  }
}

function validateCanonicalManifest(manifestBytes) {
  assert(Buffer.isBuffer(manifestBytes), 'Manifest bytes are required.');
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Could not parse bundle manifest: ${error.message}`);
  }
  assertRecord(manifest, 'bundle manifest');
  assert(
    JSON.stringify(Object.keys(manifest)) ===
      JSON.stringify(REGISTRY_BUNDLE_MANIFEST_FIELDS),
    `bundle manifest fields must be exactly: ${REGISTRY_BUNDLE_MANIFEST_FIELDS.join(', ')}.`
  );
  assert(
    manifest.schemaVersion === REGISTRY_BUNDLE_SCHEMA_VERSION,
    `Unsupported bundle manifest schemaVersion: ${manifest.schemaVersion}`
  );
  assert(manifest.status === 'passed', 'Attested bundle manifest status must be passed.');
  assert(manifest.error === null, 'Attested bundle manifest error must be null.');
  assert(
    manifestBytes.equals(Buffer.from(canonicalBundleManifest(manifest), 'utf8')),
    'bundle manifest is not canonical JSON.'
  );
}

function validateExpectations({
  expectedRepository,
  expectedWorkflow,
  expectedRef,
  expectedHeadSha,
}) {
  assert(
    typeof expectedRepository === 'string' &&
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(expectedRepository),
    'Expected repository must use owner/repository format.'
  );
  assert(
    typeof expectedWorkflow === 'string' &&
      expectedWorkflow.startsWith(`${expectedRepository}/.github/workflows/`) &&
      /\.ya?ml$/.test(expectedWorkflow),
    'Expected workflow must be a workflow path in the expected repository.'
  );
  assert(
    typeof expectedRef === 'string' && expectedRef.startsWith('refs/'),
    'Expected source ref must start with refs/.'
  );
  assert(
    typeof expectedHeadSha === 'string' && /^[0-9a-f]{40}$/.test(expectedHeadSha),
    'Expected head SHA must be a lowercase 40-character Git commit digest.'
  );
}

function parseVerificationOutput(value) {
  let parsed;
  try {
    parsed =
      typeof value === 'string' || Buffer.isBuffer(value)
        ? JSON.parse(value.toString())
        : value;
  } catch (error) {
    throw new Error(`Could not parse gh attestation verification JSON: ${error.message}`);
  }
  assert(Array.isArray(parsed), 'gh attestation verification JSON must be an array.');
  return parsed;
}

function validateVerificationResult(
  result,
  index,
  {
    subject,
    subjectSha256,
    expectedRepository,
    expectedWorkflow,
    expectedRef,
    expectedHeadSha,
  }
) {
  assertRecord(result, `verification result ${index}`);
  const verification = result.verificationResult;
  assertRecord(verification, `verification result ${index}.verificationResult`);
  const certificate = verification.signature?.certificate;
  assertRecord(certificate, `verification result ${index} certificate`);
  const expectedRepositoryUrl = `https://github.com/${expectedRepository}`;
  const expectedSigner = `https://github.com/${expectedWorkflow}@${expectedRef}`;

  assertEqual(certificate.issuer, GITHUB_ACTIONS_OIDC_ISSUER, 'OIDC issuer');
  assertEqual(certificate.sourceRepositoryURI, expectedRepositoryUrl, 'source repository URI');
  assertEqual(certificate.githubWorkflowRepository, expectedRepository, 'workflow repository');
  assertEqual(certificate.sourceRepositoryRef, expectedRef, 'source repository ref');
  assertEqual(certificate.githubWorkflowRef, expectedRef, 'workflow ref');
  assertEqual(certificate.sourceRepositoryDigest, expectedHeadSha, 'source repository digest');
  assertEqual(certificate.githubWorkflowSHA, expectedHeadSha, 'workflow SHA');
  assertEqual(certificate.buildSignerDigest, expectedHeadSha, 'build signer digest');
  assertEqual(certificate.buildConfigDigest, expectedHeadSha, 'build config digest');
  assertEqual(certificate.subjectAlternativeName, expectedSigner, 'certificate signer workflow');
  assertEqual(certificate.buildSignerURI, expectedSigner, 'build signer URI');
  assertEqual(certificate.buildConfigURI, expectedSigner, 'build config URI');
  assertEqual(certificate.runnerEnvironment, 'github-hosted', 'runner environment');

  const statement = verification.statement;
  assertRecord(statement, `verification result ${index} statement`);
  assertEqual(statement.predicateType, SLSA_PROVENANCE_V1, 'predicate type');
  assert(
    Array.isArray(statement.subject) && statement.subject.length === 1,
    'Attestation statement must contain exactly one subject.'
  );
  assertEqual(statement.subject[0]?.name, subject, 'attestation subject name');
  assertEqual(
    statement.subject[0]?.digest?.sha256,
    subjectSha256,
    'attestation subject SHA-256'
  );

  const buildDefinition = statement.predicate?.buildDefinition;
  assertRecord(buildDefinition, 'SLSA build definition');
  assertEqual(buildDefinition.buildType, GITHUB_WORKFLOW_BUILD_TYPE, 'workflow build type');
  const workflow = buildDefinition.externalParameters?.workflow;
  assertRecord(workflow, 'SLSA workflow parameters');
  assertEqual(workflow.repository, expectedRepositoryUrl, 'SLSA workflow repository');
  assertEqual(workflow.path, workflowPath(expectedWorkflow), 'SLSA workflow path');
  assertEqual(workflow.ref, expectedRef, 'SLSA workflow ref');
  assertEqual(
    buildDefinition.internalParameters?.github?.runner_environment,
    'github-hosted',
    'SLSA runner environment'
  );
  const dependencies = buildDefinition.resolvedDependencies;
  assert(Array.isArray(dependencies), 'SLSA resolved dependencies must be an array.');
  assert(
    dependencies.some(
      (dependency) =>
        dependency?.uri ===
          `git+https://github.com/${expectedRepository}@${expectedRef}` &&
        dependency?.digest?.gitCommit === expectedHeadSha
    ),
    'SLSA resolved dependencies do not contain the expected repository commit.'
  );
  assertEqual(
    statement.predicate?.runDetails?.builder?.id,
    expectedSigner,
    'SLSA builder identity'
  );

  const timestamps = verification.verifiedTimestamps;
  assert(
    Array.isArray(timestamps) && timestamps.length > 0,
    'Attestation verification result must include verified timestamps.'
  );
  for (const timestamp of timestamps) validateTimestamp(timestamp);
  return timestamps;
}

function validateTimestamp(timestamp) {
  assertRecord(timestamp, 'verified timestamp');
  for (const field of REGISTRY_ATTESTATION_TIMESTAMP_FIELDS) {
    assert(
      typeof timestamp[field] === 'string' && timestamp[field].length > 0,
      `verified timestamp ${field} must be a non-empty string.`
    );
  }
  assert(
    Number.isFinite(Date.parse(timestamp.timestamp)),
    'verified timestamp timestamp must be an ISO date.'
  );
}

function normalizeTimestamps(timestamps) {
  const unique = new Map();
  for (const timestamp of timestamps) {
    const normalized = {
      type: timestamp.type,
      uri: timestamp.uri,
      timestamp: new Date(timestamp.timestamp).toISOString(),
    };
    unique.set(JSON.stringify(normalized), normalized);
  }
  return [...unique.values()].sort((left, right) =>
    `${left.timestamp}\0${left.type}\0${left.uri}`.localeCompare(
      `${right.timestamp}\0${right.type}\0${right.uri}`
    )
  );
}

function workflowPath(expectedWorkflow) {
  const marker = '/.github/workflows/';
  return `.github/workflows/${expectedWorkflow.split(marker)[1]}`;
}

function assertRecord(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
}

function assertEqual(actual, expected, label) {
  assert(actual === expected, `${label} must be ${expected}, got ${actual ?? 'nothing'}.`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
