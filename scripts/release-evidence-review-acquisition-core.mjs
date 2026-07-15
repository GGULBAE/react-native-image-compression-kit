import {
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  extractArtifactZip,
  validateArtifactZipFileNames,
} from './artifact-zip-core.mjs';
import {
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_FILES,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES,
  canonicalReleaseEvidenceReviewArchiveMetadata,
  createReleaseEvidenceReviewArchiveMetadata,
  importReleaseEvidenceReviewArchive,
} from './release-evidence-review-archive-core.mjs';
import {
  RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE,
  RELEASE_EVIDENCE_REVIEW_RECEIPT_FILE,
  canonicalReleaseEvidenceReviewReceipt,
  validateCanonicalReleaseEvidenceReviewManifestBytes,
} from './release-evidence-review-core.mjs';
import { canonicalReleaseEvidenceReviewAttestationReport } from './release-evidence-review-attestation-core.mjs';
import { releaseEvidenceDigest, sha256 } from './release-evidence-core.mjs';

export const RELEASE_EVIDENCE_REVIEW_ACQUISITION_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_REVIEW_ACQUISITION_REPORT_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_REVIEW_ACQUISITION_MANIFEST_FILE =
  'review-acquisition-manifest.json';
export const RELEASE_EVIDENCE_REVIEW_ACQUISITION_METADATA_FILE =
  'review-evidence-metadata.json';
export const RELEASE_EVIDENCE_REVIEW_ACQUISITION_ARTIFACTS_DIR = 'artifacts';
export const RELEASE_EVIDENCE_REVIEW_ACQUISITION_REVIEW_ZIP = 'review.zip';
export const RELEASE_EVIDENCE_REVIEW_ACQUISITION_ATTESTATION_ZIP =
  'attestation.zip';

export const RELEASE_EVIDENCE_REVIEW_ACQUISITION_MANIFEST_FIELDS =
  Object.freeze([
    'schemaVersion',
    'status',
    'package',
    'version',
    'candidateSha256',
    'reviewer',
    'reviewedAt',
    'acquiredAt',
    'repository',
    'workflow',
    'sourceRef',
    'sourceDigest',
    'runId',
    'runAttempt',
    'reviewArtifact',
    'attestationArtifact',
    'attestation',
    'metadataFile',
    'metadataSha256',
    'files',
    'acquisitionSha256',
    'error',
  ]);

export const RELEASE_EVIDENCE_REVIEW_ACQUISITION_REPORT_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'outputDir',
  'package',
  'version',
  'candidateSha256',
  'reviewer',
  'repository',
  'runId',
  'sourceDigest',
  'acquisitionSha256',
  'archiveSha256',
  'checks',
  'error',
]);

export const RELEASE_EVIDENCE_REVIEW_ACQUISITION_CHECK_FIELDS = Object.freeze([
  'inputs',
  'run',
  'artifacts',
  'review',
  'attestation',
  'metadata',
  'manifest',
  'handoff',
  'atomicWrite',
]);

export const RELEASE_EVIDENCE_REVIEW_ACQUISITION_FILE_FIELDS = Object.freeze([
  'path',
  'size',
  'sha256',
]);

const FULL_SHA = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const WORKFLOW = /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/;
const GITHUB_REF = /^refs\/(?:heads|tags)\/[^\u0000-\u001f\u007f]+$/;
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;

export function canonicalReleaseEvidenceReviewAcquisitionManifest(manifest) {
  return `${JSON.stringify(manifest)}\n`;
}

export function canonicalReleaseEvidenceReviewAcquisitionReport(report) {
  return `${JSON.stringify(report)}\n`;
}

export function createReleaseEvidenceReviewAcquisitionReport({
  outputDir = null,
  packageName = null,
  version = null,
  candidateSha256 = null,
  reviewer = null,
  repository = null,
  runId = null,
  sourceDigest = null,
  acquisitionSha256 = null,
  archiveSha256 = null,
  checks = {},
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: RELEASE_EVIDENCE_REVIEW_ACQUISITION_REPORT_SCHEMA_VERSION,
    status,
    outputDir,
    package: packageName,
    version,
    candidateSha256,
    reviewer,
    repository,
    runId,
    sourceDigest,
    acquisitionSha256,
    archiveSha256,
    checks: Object.fromEntries(
      RELEASE_EVIDENCE_REVIEW_ACQUISITION_CHECK_FIELDS.map((field) => [
        field,
        checks[field] === true,
      ])
    ),
    error,
  };
}

export function validateReleaseEvidenceReviewAcquisitionInputs({
  repository,
  workflowPath,
  sourceRef,
  sourceDigest,
  runId,
  version,
  outputDir,
  releaseArchiveRoot,
}) {
  assert(
    typeof repository === 'string' && REPOSITORY.test(repository),
    'Repository must be explicit owner/name.'
  );
  assert(
    typeof workflowPath === 'string' && WORKFLOW.test(workflowPath),
    'Workflow path must be an explicit .github/workflows/*.yml path.'
  );
  assert(
    typeof sourceRef === 'string' && GITHUB_REF.test(sourceRef),
    'Source ref must be an explicit refs/heads/* or refs/tags/* value.'
  );
  assert(
    typeof sourceDigest === 'string' && FULL_SHA.test(sourceDigest),
    'Source digest must be an explicit lowercase 40-character commit SHA.'
  );
  assert(
    Number.isSafeInteger(runId) && runId > 0,
    'Release Evidence Policy Review run ID must be an explicit positive integer.'
  );
  assert(typeof version === 'string' && version.length > 0, 'Version must be explicit.');
  assert(
    typeof outputDir === 'string' && outputDir.length > 0,
    'Output directory must be explicit.'
  );
  assert(
    typeof releaseArchiveRoot === 'string' && releaseArchiveRoot.length > 0,
    'Release archive root must be explicit for importer handoff.'
  );
  const policy = RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES[version];
  assert(policy, `No committed review archive policy exists for version ${version}.`);
  assert(policy.repository === repository, 'Repository does not match the committed review policy.');
  assert(
    policy.workflow === `${repository}/${workflowPath}`,
    'Workflow does not match the committed review policy.'
  );
  assert(policy.sourceRef === sourceRef, 'Source ref does not match the committed review policy.');
  assert(
    policy.sourceDigest === sourceDigest,
    'Source digest does not match the committed review policy.'
  );
  assert(policy.reviewRun.id === runId, 'Run ID does not match the committed review policy.');
}

export function validateReleaseEvidenceReviewRunResponse(response, expectations) {
  assertRecord(response, 'GitHub workflow run response');
  const { repository, workflowPath, sourceRef, sourceDigest, runId } = expectations;
  assert(response.id === runId, `GitHub returned unexpected run ID ${response.id}.`);
  assert(
    response.html_url === `https://github.com/${repository}/actions/runs/${runId}`,
    'GitHub workflow run URL does not match the explicit repository and run ID.'
  );
  assert(response.event === 'workflow_dispatch', 'GitHub run event must be workflow_dispatch.');
  assert(response.status === 'completed', 'GitHub workflow run must be completed.');
  assert(response.conclusion === 'success', 'GitHub workflow run conclusion must be success.');
  assert(response.path === workflowPath, 'GitHub workflow run path does not match --workflow.');
  assert(response.head_sha === sourceDigest, 'GitHub workflow run head SHA does not match --source-digest.');
  assert(
    sourceRef === `refs/heads/${response.head_branch}` ||
      sourceRef === `refs/tags/${response.head_branch}`,
    'GitHub workflow run head branch does not match --source-ref.'
  );
  assertRecord(response.repository, 'GitHub workflow run repository');
  assertRecord(response.head_repository, 'GitHub workflow run head repository');
  assert(response.repository.full_name === repository, 'GitHub workflow run repository does not match --repository.');
  assert(response.head_repository.full_name === repository, 'GitHub workflow run head repository does not match --repository.');
  assert(
    Number.isSafeInteger(response.repository.id) && response.repository.id > 0,
    'GitHub workflow run repository ID must be a positive integer.'
  );
  assert(
    response.repository.id === response.head_repository.id,
    'GitHub workflow run head repository ID does not match the repository ID.'
  );
  assert(
    Number.isSafeInteger(response.run_attempt) && response.run_attempt > 0,
    'GitHub workflow run attempt must be a positive integer.'
  );
  assertRecord(response.actor, 'GitHub workflow run actor');
  assertRecord(response.triggering_actor, 'GitHub workflow run triggering actor');
  assert(
    typeof response.actor.login === 'string' && response.actor.login.length > 0,
    'GitHub workflow run actor login is missing.'
  );
  assert(
    response.triggering_actor.login === response.actor.login,
    'GitHub workflow run triggering actor does not match the run actor.'
  );
  const createdAt = requireIsoTimestamp(response.created_at, 'run created_at');
  const completedAt = requireIsoTimestamp(response.updated_at, 'run updated_at');
  assert(Date.parse(completedAt) >= Date.parse(createdAt), 'GitHub workflow run completed before it was created.');
  return {
    id: response.id,
    url: response.html_url,
    event: response.event,
    runAttempt: response.run_attempt,
    createdAt,
    completedAt,
    repositoryId: response.repository.id,
    reviewer: response.actor.login,
  };
}

export function selectReleaseEvidenceReviewArtifacts({
  artifactsResponse,
  version,
  run,
  sourceDigest,
  acquiredAt,
}) {
  assertRecord(artifactsResponse, 'GitHub artifacts response');
  assert(Array.isArray(artifactsResponse.artifacts), 'GitHub artifacts response artifacts must be an array.');
  assert(
    Number.isSafeInteger(artifactsResponse.total_count) &&
      artifactsResponse.total_count === artifactsResponse.artifacts.length,
    'GitHub artifacts response total_count must match the artifact array.'
  );
  const names = {
    review: `release-evidence-policy-review-${version}-${run.id}`,
    attestation: `release-evidence-policy-review-attestation-${version}-${run.id}`,
  };
  validateArtifactZipFileNames(
    artifactsResponse.artifacts.map((artifact) => artifact?.name),
    Object.values(names)
  );
  const selected = {};
  for (const artifact of artifactsResponse.artifacts) {
    const key = artifact.name === names.review ? 'review' : 'attestation';
    selected[key] = normalizeArtifact(artifact, {
      run,
      sourceDigest,
      acquiredAt,
    });
  }
  return selected;
}

export function acquireReleaseEvidenceReviewBundle(
  {
    repository,
    workflowPath,
    sourceRef,
    sourceDigest,
    runId,
    version,
    outputDir,
    releaseArchiveRoot,
    reportFile,
    acquiredAt,
    runResponse,
    artifactsResponse,
    attestationsResponse,
    artifactArchives,
  },
  dependencies = {}
) {
  const destination = outputDir ? path.resolve(outputDir) : null;
  const reportDestination = reportFile ? path.resolve(reportFile) : null;
  const state = {
    outputDir: destination,
    packageName: null,
    version: version ?? null,
    candidateSha256: null,
    reviewer: null,
    repository: repository ?? null,
    runId: runId ?? null,
    sourceDigest: sourceDigest ?? null,
    acquisitionSha256: null,
    archiveSha256: null,
    checks: {},
  };
  const operations = fileOperations(dependencies);
  const importArchive = dependencies.importArchive ?? importReleaseEvidenceReviewArchive;
  let temporary = null;
  let handoffArchive = null;
  let reportTemporary = null;
  let outputExposed = false;
  let reportRenameAttempted = false;

  try {
    validateReleaseEvidenceReviewAcquisitionInputs({
      repository,
      workflowPath,
      sourceRef,
      sourceDigest,
      runId,
      version,
      outputDir,
      releaseArchiveRoot,
    });
    assert(!operations.exists(destination), `Review acquisition destination already exists: ${destination}`);
    if (reportDestination) {
      assertPathOutside(reportDestination, destination, 'Acquisition report must be outside the canonical output directory.');
    }
    const acquiredTimestamp = requireIsoTimestamp(acquiredAt, 'acquisition time');
    state.checks.inputs = true;

    const run = validateReleaseEvidenceReviewRunResponse(runResponse, {
      repository,
      workflowPath,
      sourceRef,
      sourceDigest,
      runId,
    });
    state.reviewer = run.reviewer;
    state.checks.run = true;
    const artifacts = selectReleaseEvidenceReviewArtifacts({
      artifactsResponse,
      version,
      run,
      sourceDigest,
      acquiredAt: acquiredTimestamp,
    });
    state.checks.artifacts = true;

    assertRecord(artifactArchives, 'Downloaded artifact archives');
    const reviewArchive = validateReviewArchive(
      artifactArchives.review,
      artifacts.review
    );
    const receipt = parseCanonicalJson(
      reviewArchive.files.get(RELEASE_EVIDENCE_REVIEW_RECEIPT_FILE),
      canonicalReleaseEvidenceReviewReceipt,
      'Review receipt'
    );
    validateReviewReceipt(receipt, {
      repository,
      workflow: `${repository}/${workflowPath}`,
      sourceRef,
      sourceDigest,
      version,
      run,
    });
    state.packageName = receipt.package;
    state.candidateSha256 = receipt.candidateSha256;
    state.checks.review = true;

    const attestationArchive = validateAttestationArchive(
      artifactArchives.attestation,
      artifacts.attestation
    );
    const attestationReport = parseCanonicalJson(
      attestationArchive.files.get('attestation-verification.json'),
      canonicalReleaseEvidenceReviewAttestationReport,
      'Review attestation report'
    );
    const bundle = parseJson(
      attestationArchive.files.get('attestation.jsonl'),
      'Downloaded review attestation bundle'
    );
    const manifestSha256 = sha256(
      reviewArchive.files.get(RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE)
    );
    const attestation = normalizeAttestation(attestationsResponse, {
      bundle,
      report: attestationReport,
      manifestSha256,
      repository,
      workflow: `${repository}/${workflowPath}`,
      sourceRef,
      sourceDigest,
      repositoryId: run.repositoryId,
      receipt,
    });
    state.checks.attestation = true;

    const metadata = createObservedMetadata({
      receipt,
      run,
      artifacts,
      attestation,
      manifestSha256,
    });
    const policy = RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES[version];
    const expectedMetadata = createReleaseEvidenceReviewArchiveMetadata({ version });
    assert(
      isDeepStrictEqual(metadata, expectedMetadata),
      `Acquired GitHub metadata does not match the committed ${version} review archive policy.`
    );
    const metadataBytes = Buffer.from(
      canonicalReleaseEvidenceReviewArchiveMetadata(metadata),
      'utf8'
    );
    state.checks.metadata = true;

    const outputFiles = new Map([
      [RELEASE_EVIDENCE_REVIEW_ACQUISITION_METADATA_FILE, metadataBytes],
      [`${RELEASE_EVIDENCE_REVIEW_ACQUISITION_ARTIFACTS_DIR}/${RELEASE_EVIDENCE_REVIEW_ACQUISITION_REVIEW_ZIP}`, reviewArchive.zipBytes],
      [`${RELEASE_EVIDENCE_REVIEW_ACQUISITION_ARTIFACTS_DIR}/${RELEASE_EVIDENCE_REVIEW_ACQUISITION_ATTESTATION_ZIP}`, attestationArchive.zipBytes],
    ]);
    const files = [...outputFiles]
      .map(([filePath, bytes]) => ({
        path: filePath,
        size: bytes.length,
        sha256: sha256(bytes),
      }))
      .sort((left, right) => left.path.localeCompare(right.path, 'en'));
    const manifest = createAcquisitionManifest({
      metadata,
      run,
      acquiredAt: acquiredTimestamp,
      files,
    });
    state.acquisitionSha256 = manifest.acquisitionSha256;

    operations.mkdir(path.dirname(destination), { recursive: true });
    temporary = temporaryPath(destination, 'review-acquisition');
    operations.mkdir(temporary, { recursive: false });
    operations.mkdir(
      path.join(temporary, RELEASE_EVIDENCE_REVIEW_ACQUISITION_ARTIFACTS_DIR),
      { recursive: false }
    );
    for (const [relativePath, bytes] of outputFiles) {
      operations.writeFile(path.join(temporary, relativePath), bytes, { flag: 'wx' });
    }
    operations.writeFile(
      path.join(temporary, RELEASE_EVIDENCE_REVIEW_ACQUISITION_MANIFEST_FILE),
      canonicalReleaseEvidenceReviewAcquisitionManifest(manifest),
      { encoding: 'utf8', flag: 'wx' }
    );
    state.checks.manifest = true;

    handoffArchive = temporaryPath(destination, 'review-acquisition-handoff');
    const handoff = importArchive(
      {
        metadataFile: path.join(temporary, RELEASE_EVIDENCE_REVIEW_ACQUISITION_METADATA_FILE),
        reviewArtifactZip: path.join(
          temporary,
          RELEASE_EVIDENCE_REVIEW_ACQUISITION_ARTIFACTS_DIR,
          RELEASE_EVIDENCE_REVIEW_ACQUISITION_REVIEW_ZIP
        ),
        attestationArtifactZip: path.join(
          temporary,
          RELEASE_EVIDENCE_REVIEW_ACQUISITION_ARTIFACTS_DIR,
          RELEASE_EVIDENCE_REVIEW_ACQUISITION_ATTESTATION_ZIP
        ),
        archiveDir: handoffArchive,
        releaseArchiveRoot,
        expectedVersion: version,
      },
      dependencies.importerDependencies ?? {}
    );
    assert(handoff?.status === 'passed', `Existing review importer handoff failed: ${handoff?.error ?? 'unknown error'}`);
    assert(
      handoff.archiveSha256 === policy.archiveSha256,
      'Importer handoff archive digest does not match the committed policy.'
    );
    state.archiveSha256 = handoff.archiveSha256;
    state.checks.handoff = true;
    operations.remove(handoffArchive, { recursive: true, force: true });
    handoffArchive = null;

    state.checks.atomicWrite = true;
    const success = createReleaseEvidenceReviewAcquisitionReport({
      ...state,
      status: 'passed',
      error: null,
    });
    if (reportDestination) {
      operations.mkdir(path.dirname(reportDestination), { recursive: true });
      reportTemporary = temporaryPath(reportDestination, 'review-acquisition-report');
      operations.writeFile(
        reportTemporary,
        canonicalReleaseEvidenceReviewAcquisitionReport(success),
        { encoding: 'utf8', flag: 'wx' }
      );
    }
    const renameOutput = dependencies.renameOutput ?? operations.rename;
    renameOutput(temporary, destination);
    temporary = null;
    outputExposed = true;
    if (reportTemporary) {
      reportRenameAttempted = true;
      const renameReport = dependencies.renameReport ?? operations.rename;
      renameReport(reportTemporary, reportDestination);
      reportTemporary = null;
    }
    return success;
  } catch (error) {
    if (temporary) operations.remove(temporary, { recursive: true, force: true });
    if (handoffArchive) operations.remove(handoffArchive, { recursive: true, force: true });
    if (reportTemporary) operations.remove(reportTemporary, { force: true });
    if (outputExposed) operations.remove(destination, { recursive: true, force: true });
    state.checks.atomicWrite = false;
    const failed = createReleaseEvidenceReviewAcquisitionReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
    if (reportDestination && !reportRenameAttempted) {
      try {
        writeReleaseEvidenceReviewAcquisitionReportAtomic(
          reportDestination,
          failed,
          operations
        );
      } catch {
        // Preserve the primary acquisition failure and never leave partial report bytes.
      }
    }
    return failed;
  }
}

export function writeReleaseEvidenceReviewAcquisitionReportAtomic(
  filePath,
  report,
  dependencies = {}
) {
  const operations = fileOperations(dependencies);
  const destination = path.resolve(filePath);
  const temporary = temporaryPath(destination, 'review-acquisition-report');
  operations.mkdir(path.dirname(destination), { recursive: true });
  try {
    operations.writeFile(
      temporary,
      canonicalReleaseEvidenceReviewAcquisitionReport(report),
      { encoding: 'utf8', flag: 'wx' }
    );
    const renameReport = dependencies.renameReport ?? operations.rename;
    renameReport(temporary, destination);
  } catch (error) {
    operations.remove(temporary, { force: true });
    throw error;
  }
}

function validateReviewArchive(archive, artifact) {
  const validated = validateDownloadedZip(archive, artifact, 'Review artifact');
  assert(validated.files.has(RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE), 'Review artifact manifest is missing from the review ZIP.');
  const manifest = validateCanonicalReleaseEvidenceReviewManifestBytes(
    validated.files.get(RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE)
  );
  validateArtifactZipFileNames(
    [...validated.files.keys()],
    [RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE, ...manifest.files.map((file) => file.path)]
  );
  return validated;
}

function validateAttestationArchive(archive, artifact) {
  const validated = validateDownloadedZip(archive, artifact, 'Attestation artifact');
  validateArtifactZipFileNames(
    [...validated.files.keys()],
    RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_FILES
  );
  return validated;
}

function validateDownloadedZip(archive, artifact, label) {
  assertRecord(archive, `${label} download`);
  assert(Buffer.isBuffer(archive.zipBytes), `${label} ZIP bytes are missing.`);
  assert(archive.zipBytes.length === artifact.size, `${label} ZIP size does not match GitHub metadata.`);
  assert(`sha256:${sha256(archive.zipBytes)}` === artifact.digest, `${label} ZIP digest does not match GitHub metadata.`);
  const files = extractArtifactZip(archive.zipBytes);
  return { zipBytes: archive.zipBytes, files };
}

function validateReviewReceipt(receipt, expectations) {
  assert(receipt.status === 'passed', 'Review receipt status must be passed.');
  assert(receipt.version === expectations.version, 'Review receipt version does not match --version.');
  assert(receipt.repository === expectations.repository, 'Review receipt repository does not match --repository.');
  assert(receipt.workflow === expectations.workflow, 'Review receipt workflow does not match --workflow.');
  assert(receipt.sourceRef === expectations.sourceRef, 'Review receipt source ref does not match --source-ref.');
  assert(receipt.sourceDigest === expectations.sourceDigest, 'Review receipt source digest does not match --source-digest.');
  assert(receipt.reviewRunId === String(expectations.run.id), 'Review receipt run ID does not match --run-id.');
  assert(receipt.reviewRunAttempt === expectations.run.runAttempt, 'Review receipt run attempt does not match GitHub.');
  assert(receipt.reviewer === expectations.run.reviewer, 'Review receipt reviewer does not match the GitHub actor.');
  assert(receipt.reviewedAt === expectations.run.createdAt, 'Review receipt reviewedAt does not match run creation.');
}

function normalizeArtifact(artifact, { run, sourceDigest, acquiredAt }) {
  assertRecord(artifact, 'GitHub artifact');
  assert(Number.isSafeInteger(artifact.id) && artifact.id > 0, 'GitHub artifact ID must be a positive integer.');
  assert(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0, 'GitHub artifact size must be a positive integer.');
  assert(SHA256_DIGEST.test(artifact.digest), 'GitHub artifact digest must be a sha256 digest.');
  assert(artifact.expired === false, `GitHub artifact ${artifact.name} is expired.`);
  const createdAt = requireIsoTimestamp(artifact.created_at, `${artifact.name} created_at`);
  const expiresAt = requireIsoTimestamp(artifact.expires_at, `${artifact.name} expires_at`);
  assert(Date.parse(createdAt) >= Date.parse(run.createdAt), `${artifact.name} was created before the workflow run.`);
  assert(Date.parse(createdAt) <= Date.parse(run.completedAt), `${artifact.name} was created after the workflow run completed.`);
  assert(Date.parse(expiresAt) > Date.parse(createdAt), `${artifact.name} expiration must follow creation.`);
  assert(Date.parse(expiresAt) > Date.parse(acquiredAt), `${artifact.name} is expired at acquisition time.`);
  assertRecord(artifact.workflow_run, `${artifact.name} workflow run`);
  assert(artifact.workflow_run.id === run.id, `${artifact.name} run ID does not match --run-id.`);
  assert(artifact.workflow_run.head_sha === sourceDigest, `${artifact.name} head SHA does not match --source-digest.`);
  assert(artifact.workflow_run.repository_id === run.repositoryId, `${artifact.name} repository ID does not match the workflow run.`);
  assert(artifact.workflow_run.head_repository_id === run.repositoryId, `${artifact.name} head repository ID does not match the workflow run.`);
  return {
    id: artifact.id,
    name: artifact.name,
    digest: artifact.digest,
    size: artifact.size_in_bytes,
    createdAt,
    expiresAt,
  };
}

function normalizeAttestation(
  response,
  { bundle, report, manifestSha256, repository, workflow, sourceRef, sourceDigest, repositoryId, receipt }
) {
  assertRecord(response, 'GitHub attestations response');
  assert(Array.isArray(response.attestations), 'GitHub attestations must be an array.');
  const matches = response.attestations.filter(
    (entry) => entry?.repository_id === repositoryId && isDeepStrictEqual(entry.bundle, bundle)
  );
  assert(matches.length === 1, 'Expected exactly one GitHub attestation matching the downloaded bundle.');
  const id = attestationIdFromBundleUrl(matches[0].bundle_url);
  assertRecord(report, 'Review attestation report');
  assert(report.status === 'passed', 'Review attestation report status must be passed.');
  assert(report.subject === RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE, `Attestation subject must be ${RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE}.`);
  assert(report.subjectSha256 === manifestSha256, 'Attestation subject digest does not match the review manifest.');
  assert(report.repository === repository, 'Attestation repository does not match --repository.');
  assert(report.signerWorkflow === workflow, 'Attestation signer workflow does not match --workflow.');
  assert(report.sourceRef === sourceRef, 'Attestation source ref does not match --source-ref.');
  assert(report.sourceDigest === sourceDigest, 'Attestation source digest does not match --source-digest.');
  assert(report.workflowSha === receipt.workflowSha, 'Attestation workflow digest does not match the review receipt.');
  assert(report.reviewRunId === receipt.reviewRunId, 'Attestation run ID does not match the review receipt.');
  assert(report.reviewRunAttempt === receipt.reviewRunAttempt, 'Attestation run attempt does not match the review receipt.');
  assert(report.reviewer === receipt.reviewer, 'Attestation reviewer does not match the review receipt.');
  assert(report.candidateSha256 === receipt.candidateSha256, 'Attestation candidate digest does not match the review receipt.');
  assert(Array.isArray(report.verifiedTimestamps), 'Attestation verified timestamps must be an array.');
  const rekor = report.verifiedTimestamps.filter(
    (entry) => entry?.type === 'Tlog' && entry?.uri === 'https://rekor.sigstore.dev'
  );
  assert(rekor.length === 1, 'Attestation must contain exactly one verified Rekor timestamp.');
  return {
    id,
    url: `https://github.com/${repository}/attestations/${id}`,
    verifiedAt: requireIsoTimestamp(rekor[0].timestamp, 'attestation verified timestamp'),
  };
}

function createObservedMetadata({
  receipt,
  run,
  artifacts,
  attestation,
  manifestSha256,
}) {
  return {
    schemaVersion: 1,
    status: 'passed',
    package: receipt.package,
    version: receipt.version,
    candidateSha256: receipt.candidateSha256,
    reviewer: receipt.reviewer,
    reviewedAt: receipt.reviewedAt,
    repository: receipt.repository,
    workflow: receipt.workflow,
    sourceRef: receipt.sourceRef,
    sourceDigest: receipt.sourceDigest,
    reviewRun: {
      id: run.id,
      url: run.url,
      event: run.event,
      runAttempt: run.runAttempt,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
    },
    reviewArtifact: { ...artifacts.review },
    attestationArtifact: { ...artifacts.attestation },
    attestation,
    receiptSha256: sha256(Buffer.from(canonicalReleaseEvidenceReviewReceipt(receipt), 'utf8')),
    manifestSha256,
    evidenceSha256: receipt.evidenceSha256,
    error: null,
  };
}

function createAcquisitionManifest({ metadata, run, acquiredAt, files }) {
  const metadataFile = files.find(
    (file) => file.path === RELEASE_EVIDENCE_REVIEW_ACQUISITION_METADATA_FILE
  );
  assert(metadataFile, 'Review acquisition metadata digest is missing.');
  return {
    schemaVersion: RELEASE_EVIDENCE_REVIEW_ACQUISITION_SCHEMA_VERSION,
    status: 'passed',
    package: metadata.package,
    version: metadata.version,
    candidateSha256: metadata.candidateSha256,
    reviewer: metadata.reviewer,
    reviewedAt: metadata.reviewedAt,
    acquiredAt,
    repository: metadata.repository,
    workflow: metadata.workflow,
    sourceRef: metadata.sourceRef,
    sourceDigest: metadata.sourceDigest,
    runId: run.id,
    runAttempt: run.runAttempt,
    reviewArtifact: { ...metadata.reviewArtifact },
    attestationArtifact: { ...metadata.attestationArtifact },
    attestation: { ...metadata.attestation },
    metadataFile: RELEASE_EVIDENCE_REVIEW_ACQUISITION_METADATA_FILE,
    metadataSha256: metadataFile.sha256,
    files,
    acquisitionSha256: releaseEvidenceDigest(files),
    error: null,
  };
}

function parseCanonicalJson(bytes, canonicalize, label) {
  const value = parseJson(bytes, label);
  assert(
    bytes.equals(Buffer.from(canonicalize(value), 'utf8')),
    `${label} is not canonical JSON.`
  );
  return value;
}

function parseJson(bytes, label) {
  assert(Buffer.isBuffer(bytes), `${label} bytes are missing.`);
  try {
    return JSON.parse(bytes.toString('utf8').trim());
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function attestationIdFromBundleUrl(bundleUrl) {
  let parsed;
  try {
    parsed = new URL(bundleUrl);
  } catch {
    throw new Error('GitHub attestation bundle URL is invalid.');
  }
  assert(parsed.protocol === 'https:', 'GitHub attestation bundle URL must use HTTPS.');
  const match = parsed.pathname.match(/^\/attestations\/\d+\/\d{4}\/\d{2}\/\d{2}\/(\d+)\.json\.sn$/);
  assert(match, 'GitHub attestation bundle URL does not contain an attestation ID.');
  const id = Number(match[1]);
  assert(Number.isSafeInteger(id) && id > 0, 'GitHub attestation ID must be a positive integer.');
  return id;
}

function requireIsoTimestamp(value, label) {
  assert(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString() ===
        (value.includes('.') ? value : value.replace('Z', '.000Z')),
    `${label} must be a canonical UTC ISO timestamp.`
  );
  return value;
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

function temporaryPath(destination, label) {
  return path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${label}.${process.pid}.${Date.now()}.tmp`
  );
}

function assertPathOutside(candidate, root, message) {
  assert(candidate !== root && !candidate.startsWith(`${root}${path.sep}`), message);
}

function assertRecord(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
