import {
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { REGISTRY_BUNDLE_FILES } from './registry-provenance-core.mjs';
import {
  RELEASE_EVIDENCE_ATTESTATION_FILES,
  RELEASE_EVIDENCE_FILE_PATHS,
  RELEASE_EVIDENCE_POLICIES,
  releaseEvidenceDigest,
  sha256,
} from './release-evidence-core.mjs';
import {
  canonicalReleaseEvidenceImportMetadata,
  createReleaseEvidenceImportMetadata,
  importReleaseEvidenceArchive,
} from './release-evidence-import-core.mjs';

export const RELEASE_EVIDENCE_ACQUISITION_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_ACQUISITION_REPORT_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FILE =
  'acquisition-manifest.json';
export const RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE =
  'release-evidence-metadata.json';
export const RELEASE_EVIDENCE_ACQUISITION_PROVENANCE_DIR = 'provenance';
export const RELEASE_EVIDENCE_ACQUISITION_ATTESTATION_DIR = 'attestation';

export const RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'package',
  'version',
  'expectedTag',
  'repository',
  'workflow',
  'sourceRef',
  'sourceDigest',
  'runId',
  'runAttempt',
  'provenanceArtifact',
  'attestationArtifact',
  'attestation',
  'metadataFile',
  'metadataSha256',
  'files',
  'acquisitionSha256',
  'error',
]);

export const RELEASE_EVIDENCE_ACQUISITION_REPORT_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'outputDir',
  'package',
  'version',
  'expectedTag',
  'repository',
  'runId',
  'sourceDigest',
  'acquisitionSha256',
  'evidenceSha256',
  'checks',
  'error',
]);

export const RELEASE_EVIDENCE_ACQUISITION_CHECK_FIELDS = Object.freeze([
  'inputs',
  'run',
  'artifacts',
  'provenance',
  'attestation',
  'metadata',
  'manifest',
  'handoff',
  'atomicWrite',
]);

export const RELEASE_EVIDENCE_ACQUISITION_FILE_FIELDS = Object.freeze([
  'path',
  'size',
  'sha256',
]);

const FULL_SHA = /^[0-9a-f]{40}$/;
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function canonicalReleaseEvidenceAcquisitionManifest(manifest) {
  return `${JSON.stringify(manifest)}\n`;
}

export function canonicalReleaseEvidenceAcquisitionReport(report) {
  return `${JSON.stringify(report)}\n`;
}

export function createReleaseEvidenceAcquisitionReport({
  outputDir = null,
  packageName = null,
  version = null,
  expectedTag = null,
  repository = null,
  runId = null,
  sourceDigest = null,
  acquisitionSha256 = null,
  evidenceSha256 = null,
  checks = {},
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: RELEASE_EVIDENCE_ACQUISITION_REPORT_SCHEMA_VERSION,
    status,
    outputDir,
    package: packageName,
    version,
    expectedTag,
    repository,
    runId,
    sourceDigest,
    acquisitionSha256,
    evidenceSha256,
    checks: Object.fromEntries(
      RELEASE_EVIDENCE_ACQUISITION_CHECK_FIELDS.map((field) => [
        field,
        checks[field] === true,
      ])
    ),
    error,
  };
}

export function validateReleaseEvidenceAcquisitionInputs({
  repository,
  workflowPath,
  sourceRef,
  sourceDigest,
  runId,
  version,
  expectedTag,
  outputDir,
}) {
  assert(
    typeof repository === 'string' && REPOSITORY.test(repository),
    'Repository must be explicit owner/name.'
  );
  assert(
    typeof workflowPath === 'string' &&
      /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(workflowPath),
    'Workflow path must be an explicit .github/workflows/*.yml path.'
  );
  assert(
    typeof sourceRef === 'string' && /^refs\/(heads|tags)\/.+/.test(sourceRef),
    'Source ref must be an explicit refs/heads/* or refs/tags/* value.'
  );
  assert(
    typeof sourceDigest === 'string' && FULL_SHA.test(sourceDigest),
    'Source digest must be an explicit lowercase 40-character commit SHA.'
  );
  assert(
    Number.isSafeInteger(runId) && runId > 0,
    'Registry Validation run ID must be an explicit positive integer.'
  );
  assert(
    typeof version === 'string' && version.length > 0,
    'Version must be explicit.'
  );
  assert(
    typeof expectedTag === 'string' && expectedTag.length > 0,
    'Expected tag must be explicit.'
  );
  assert(
    typeof outputDir === 'string' && outputDir.length > 0,
    'Output directory must be explicit.'
  );
  assert(
    RELEASE_EVIDENCE_POLICIES[version],
    `No committed release evidence policy exists for version ${version}.`
  );
}

export function selectReleaseEvidenceArtifacts({
  artifactsResponse,
  version,
  runId,
  sourceDigest,
}) {
  assertRecord(artifactsResponse, 'GitHub artifacts response');
  assert(
    Array.isArray(artifactsResponse.artifacts),
    'GitHub artifacts response artifacts must be an array.'
  );
  assert(
    Number.isSafeInteger(artifactsResponse.total_count) &&
      artifactsResponse.total_count === artifactsResponse.artifacts.length,
    'GitHub artifacts response total_count must match the artifact array.'
  );
  const expectedNames = [
    `registry-provenance-${version}`,
    `registry-provenance-attestation-${version}`,
  ];
  const actualNames = artifactsResponse.artifacts
    .map((artifact) => artifact?.name)
    .sort();
  assert(
    JSON.stringify(actualNames) === JSON.stringify([...expectedNames].sort()),
    `Registry Validation run must contain exactly: ${expectedNames.join(', ')}.`
  );

  const selected = {};
  for (const artifact of artifactsResponse.artifacts) {
    validateArtifactResponse(artifact, { runId, sourceDigest });
    const key = artifact.name === expectedNames[0] ? 'provenance' : 'attestation';
    selected[key] = artifact;
  }
  return selected;
}

export function validateReleaseEvidenceRunResponse(response, expectations) {
  return normalizeRun(response, expectations);
}

export function validateArtifactArchiveFileNames(actualFiles, expectedFiles) {
  assert(Array.isArray(actualFiles), 'Artifact archive file names must be an array.');
  assert(
    actualFiles.every(
      (file) =>
        typeof file === 'string' &&
        file.length > 0 &&
        !file.includes('\\') &&
        !file.startsWith('/') &&
        !file.split('/').includes('..')
    ),
    'Artifact archive contains an unsafe path.'
  );
  assert(
    new Set(actualFiles).size === actualFiles.length,
    'Artifact archive contains duplicate file names.'
  );
  assert(
    JSON.stringify([...actualFiles].sort()) ===
      JSON.stringify([...expectedFiles].sort()),
    `Artifact archive must contain exactly: ${[...expectedFiles]
      .sort()
      .join(', ')}.`
  );
}

export function acquireReleaseEvidenceBundle(
  {
    repository,
    workflowPath,
    sourceRef,
    sourceDigest,
    runId,
    version,
    expectedTag,
    outputDir,
    runResponse,
    artifactsResponse,
    attestationsResponse,
    artifactArchives,
  },
  dependencies = {}
) {
  const destination = outputDir ? path.resolve(outputDir) : null;
  const state = {
    outputDir: destination,
    packageName: null,
    version: version ?? null,
    expectedTag: expectedTag ?? null,
    repository: repository ?? null,
    runId: runId ?? null,
    sourceDigest: sourceDigest ?? null,
    acquisitionSha256: null,
    evidenceSha256: null,
    checks: {},
  };
  const operations = {
    exists: dependencies.exists ?? existsSync,
    mkdir: dependencies.mkdir ?? mkdirSync,
    rename: dependencies.rename ?? renameSync,
    remove: dependencies.remove ?? rmSync,
    writeFile: dependencies.writeFile ?? writeFileSync,
  };
  const importArchive =
    dependencies.importArchive ?? importReleaseEvidenceArchive;
  let temporary = null;
  let handoffArchive = null;

  try {
    validateReleaseEvidenceAcquisitionInputs({
      repository,
      workflowPath,
      sourceRef,
      sourceDigest,
      runId,
      version,
      expectedTag,
      outputDir,
    });
    assert(
      !operations.exists(destination),
      `Release evidence acquisition destination already exists: ${destination}`
    );
    const policy = RELEASE_EVIDENCE_POLICIES[version];
    state.checks.inputs = true;

    const run = validateReleaseEvidenceRunResponse(runResponse, {
      repository,
      workflowPath,
      sourceRef,
      sourceDigest,
      runId,
    });
    state.checks.run = true;
    const selectedArtifacts = selectReleaseEvidenceArtifacts({
      artifactsResponse,
      version,
      runId,
      sourceDigest,
    });
    const normalizedArtifacts = {
      provenance: normalizeArtifact(selectedArtifacts.provenance),
      attestation: normalizeArtifact(selectedArtifacts.attestation),
    };
    state.checks.artifacts = true;

    assertRecord(artifactArchives, 'Downloaded artifact archives');
    const provenance = validateDownloadedArtifact(
      artifactArchives.provenance,
      normalizedArtifacts.provenance,
      Object.values(REGISTRY_BUNDLE_FILES),
      'Provenance artifact'
    );
    const provenanceReport = parseJsonFile(
      provenance.files,
      REGISTRY_BUNDLE_FILES.report,
      'Registry provenance report'
    );
    validateProvenanceReport(provenanceReport, {
      version,
      expectedTag,
      packageName: policy.package,
    });
    state.packageName = provenanceReport.package;
    state.checks.provenance = true;

    const attestationArchive = validateDownloadedArtifact(
      artifactArchives.attestation,
      normalizedArtifacts.attestation,
      RELEASE_EVIDENCE_ATTESTATION_FILES,
      'Attestation artifact'
    );
    const attestationReport = parseJsonFile(
      attestationArchive.files,
      'attestation-verification.json',
      'Attestation verification report'
    );
    const downloadedBundles = parseJsonLinesBytes(
      attestationArchive.files.get('attestation.jsonl'),
      'Downloaded attestation bundles'
    );
    const manifestSha256 = sha256(
      provenance.files.get(REGISTRY_BUNDLE_FILES.manifest)
    );
    const attestation = normalizeAttestation(attestationsResponse, {
      downloadedBundles,
      expectedAttestationId: policy.attestation.id,
      attestationReport,
      manifestSha256,
      repository,
      workflow: `${repository}/${workflowPath}`,
      sourceRef,
      sourceDigest,
      repositoryId: run.repositoryId,
    });
    state.checks.attestation = true;

    const metadata = createObservedMetadata({
      provenanceReport,
      repository,
      workflowPath,
      sourceRef,
      sourceDigest,
      version,
      expectedTag,
      run,
      provenanceArtifact: normalizedArtifacts.provenance,
      attestationArtifact: normalizedArtifacts.attestation,
      attestation,
    });
    const expectedMetadata = createReleaseEvidenceImportMetadata({ version });
    assert(
      isDeepStrictEqual(metadata, expectedMetadata),
      `Acquired GitHub metadata does not match the committed ${version} release evidence policy.`
    );
    const metadataBytes = Buffer.from(
      canonicalReleaseEvidenceImportMetadata(metadata),
      'utf8'
    );
    state.checks.metadata = true;

    const outputFiles = createOutputFiles({
      metadataBytes,
      provenanceFiles: provenance.files,
      attestationFiles: attestationArchive.files,
    });
    const files = [...outputFiles].map(([filePath, bytes]) => ({
      path: filePath,
      size: bytes.length,
      sha256: sha256(bytes),
    }));
    const manifest = createAcquisitionManifest({
      metadata,
      run,
      files,
    });
    state.acquisitionSha256 = manifest.acquisitionSha256;

    const parent = path.dirname(destination);
    operations.mkdir(parent, { recursive: true });
    temporary = path.join(
      parent,
      `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`
    );
    handoffArchive = path.join(
      parent,
      `.${path.basename(destination)}.${process.pid}.${Date.now()}.handoff.tmp`
    );
    operations.mkdir(temporary, { recursive: false });
    operations.mkdir(
      path.join(temporary, RELEASE_EVIDENCE_ACQUISITION_PROVENANCE_DIR),
      { recursive: false }
    );
    operations.mkdir(
      path.join(temporary, RELEASE_EVIDENCE_ACQUISITION_ATTESTATION_DIR),
      { recursive: false }
    );
    for (const [relativePath, bytes] of outputFiles) {
      operations.writeFile(path.join(temporary, relativePath), bytes, {
        flag: 'wx',
      });
    }
    operations.writeFile(
      path.join(temporary, RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FILE),
      canonicalReleaseEvidenceAcquisitionManifest(manifest),
      { encoding: 'utf8', flag: 'wx' }
    );
    state.checks.manifest = true;

    const handoff = importArchive({
      provenanceArtifactDir: path.join(
        temporary,
        RELEASE_EVIDENCE_ACQUISITION_PROVENANCE_DIR
      ),
      attestationArtifactDir: path.join(
        temporary,
        RELEASE_EVIDENCE_ACQUISITION_ATTESTATION_DIR
      ),
      metadataFile: path.join(
        temporary,
        RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE
      ),
      archiveDir: handoffArchive,
      expectedVersion: version,
    });
    assert(
      handoff?.status === 'passed',
      `Existing importer handoff failed: ${handoff?.error ?? 'unknown error'}`
    );
    state.evidenceSha256 = handoff.evidenceSha256;
    state.checks.handoff = true;
    operations.remove(handoffArchive, { recursive: true, force: true });
    handoffArchive = null;

    operations.rename(temporary, destination);
    temporary = null;
    state.checks.atomicWrite = true;
    return createReleaseEvidenceAcquisitionReport({
      ...state,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    if (handoffArchive) {
      operations.remove(handoffArchive, { recursive: true, force: true });
    }
    if (temporary) {
      operations.remove(temporary, { recursive: true, force: true });
    }
    return createReleaseEvidenceAcquisitionReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function writeReleaseEvidenceAcquisitionReportAtomic(
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
    writeFile(
      temporary,
      canonicalReleaseEvidenceAcquisitionReport(report),
      { encoding: 'utf8', flag: 'wx' }
    );
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { force: true });
    throw error;
  }
}

function normalizeRun(
  response,
  { repository, workflowPath, sourceRef, sourceDigest, runId }
) {
  assertRecord(response, 'GitHub workflow run response');
  assert(response.id === runId, `GitHub returned unexpected run ID ${response.id}.`);
  assert(
    response.html_url ===
      `https://github.com/${repository}/actions/runs/${runId}`,
    'GitHub workflow run URL does not match the explicit repository and run ID.'
  );
  assert(response.event === 'workflow_dispatch', 'GitHub run event must be workflow_dispatch.');
  assert(response.status === 'completed', 'GitHub workflow run must be completed.');
  assert(response.conclusion === 'success', 'GitHub workflow run conclusion must be success.');
  assert(response.path === workflowPath, 'GitHub workflow run path does not match --workflow.');
  assert(response.head_sha === sourceDigest, 'GitHub workflow run head SHA does not match --source-digest.');
  assertRecord(response.repository, 'GitHub workflow run repository');
  assertRecord(response.head_repository, 'GitHub workflow run head repository');
  assert(response.repository.full_name === repository, 'GitHub workflow run repository does not match --repository.');
  assert(response.head_repository.full_name === repository, 'GitHub workflow run head repository does not match --repository.');
  assert(
    sourceRef === `refs/heads/${response.head_branch}` ||
      sourceRef === `refs/tags/${response.head_branch}`,
    'GitHub workflow run head branch does not match --source-ref.'
  );
  assert(
    Number.isSafeInteger(response.run_attempt) && response.run_attempt > 0,
    'GitHub workflow run attempt must be a positive integer.'
  );
  assert(
    Number.isSafeInteger(response.repository.id) && response.repository.id > 0,
    'GitHub workflow run repository ID must be a positive integer.'
  );
  assert(
    response.head_repository.id === response.repository.id,
    'GitHub workflow run head repository ID does not match the repository ID.'
  );
  const createdAt = requireIsoTimestamp(response.created_at, 'run created_at');
  const completedAt = requireIsoTimestamp(response.updated_at, 'run updated_at');
  assert(
    Date.parse(completedAt) >= Date.parse(createdAt),
    'GitHub workflow run completed before it was created.'
  );
  return {
    id: response.id,
    url: response.html_url,
    event: response.event,
    createdAt,
    completedAt,
    runAttempt: response.run_attempt,
    repositoryId: response.repository.id,
  };
}

function validateArtifactResponse(artifact, { runId, sourceDigest }) {
  assertRecord(artifact, 'GitHub artifact');
  assert(Number.isSafeInteger(artifact.id) && artifact.id > 0, 'GitHub artifact ID must be a positive integer.');
  assert(typeof artifact.name === 'string' && artifact.name.length > 0, 'GitHub artifact name is missing.');
  assert(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0, 'GitHub artifact size must be a positive integer.');
  assert(SHA256_DIGEST.test(artifact.digest), 'GitHub artifact digest must be a sha256 digest.');
  assert(artifact.expired === false, `GitHub artifact ${artifact.name} is expired.`);
  requireIsoTimestamp(artifact.created_at, `${artifact.name} created_at`);
  requireIsoTimestamp(artifact.expires_at, `${artifact.name} expires_at`);
  assert(
    Date.parse(artifact.expires_at) > Date.parse(artifact.created_at),
    `GitHub artifact ${artifact.name} expiration must follow creation.`
  );
  assertRecord(artifact.workflow_run, `${artifact.name} workflow run`);
  assert(artifact.workflow_run.id === runId, `${artifact.name} run ID does not match --run-id.`);
  assert(artifact.workflow_run.head_sha === sourceDigest, `${artifact.name} head SHA does not match --source-digest.`);
}

function normalizeArtifact(artifact) {
  return {
    id: artifact.id,
    name: artifact.name,
    digest: artifact.digest,
    size: artifact.size_in_bytes,
    createdAt: artifact.created_at,
    expiresAt: artifact.expires_at,
  };
}

function validateDownloadedArtifact(archive, artifact, expectedFiles, label) {
  assertRecord(archive, `${label} download`);
  assert(Buffer.isBuffer(archive.zipBytes), `${label} ZIP bytes are missing.`);
  assert(
    archive.zipBytes.length === artifact.size,
    `${label} ZIP size does not match GitHub metadata.`
  );
  assert(
    `sha256:${sha256(archive.zipBytes)}` === artifact.digest,
    `${label} ZIP digest does not match GitHub metadata.`
  );
  assert(
    archive.files instanceof Map,
    `${label} extracted files must be a Map.`
  );
  validateArtifactArchiveFileNames([...archive.files.keys()], expectedFiles);
  for (const [file, bytes] of archive.files) {
    assert(Buffer.isBuffer(bytes), `${label} extracted file ${file} is not bytes.`);
  }
  return archive;
}

function validateProvenanceReport(
  report,
  { version, expectedTag, packageName }
) {
  assertRecord(report, 'Registry provenance report');
  assert(report.status === 'passed', 'Registry provenance report status must be passed.');
  assert(report.package === packageName, 'Registry provenance package does not match the committed policy.');
  assert(report.requestedVersion === version, 'Registry provenance requested version does not match --version.');
  assert(report.resolvedVersion === version, 'Registry provenance resolved version does not match --version.');
  assert(report.expectedTag === expectedTag, 'Registry provenance expected tag does not match --expected-tag.');
  assert(report.tagVersion === version, 'Registry provenance tag version does not match --version.');
  requireIsoTimestamp(report.publishedAt, 'registry publishedAt');
}

function normalizeAttestation(
  response,
  {
    downloadedBundles,
    expectedAttestationId,
    attestationReport,
    manifestSha256,
    repository,
    workflow,
    sourceRef,
    sourceDigest,
    repositoryId,
  }
) {
  assertRecord(response, 'GitHub attestations response');
  assert(Array.isArray(response.attestations), 'GitHub attestations must be an array.');
  const matches = response.attestations.filter(
    (attestation) =>
      attestation &&
      attestation.repository_id === repositoryId &&
      attestation.attestation_id === expectedAttestationId
  );
  assert(
    matches.length === 1,
    'Expected exactly one GitHub attestation matching the committed attestation ID.'
  );
  const selected = matches[0];
  assert(
    Number.isSafeInteger(selected.attestation_id) && selected.attestation_id > 0,
    'GitHub attestation ID must be a positive integer.'
  );
  const id = selected.attestation_id;
  const downloadedMatches = downloadedBundles.filter((bundle) =>
    isDeepStrictEqual(selected.bundle, bundle)
  );
  assert(
    downloadedMatches.length === 1,
    'Expected the committed GitHub attestation bundle exactly once in the downloaded JSONL artifact.'
  );

  assertRecord(attestationReport, 'Attestation verification report');
  assert(attestationReport.status === 'passed', 'Attestation verification report status must be passed.');
  assert(attestationReport.subject === 'bundle-manifest.json', 'Attestation subject must be bundle-manifest.json.');
  assert(attestationReport.subjectSha256 === manifestSha256, 'Attestation subject digest does not match the provenance manifest.');
  assert(attestationReport.repository === repository, 'Attestation repository does not match --repository.');
  assert(attestationReport.signerWorkflow === workflow, 'Attestation signer workflow does not match --workflow.');
  assert(attestationReport.sourceRef === sourceRef, 'Attestation source ref does not match --source-ref.');
  assert(attestationReport.sourceDigest === sourceDigest, 'Attestation source digest does not match --source-digest.');
  assert(
    Array.isArray(attestationReport.verifiedTimestamps),
    'Attestation verified timestamps must be an array.'
  );
  const tlog = attestationReport.verifiedTimestamps.filter(
    (entry) => entry?.type === 'Tlog' && entry?.uri === 'https://rekor.sigstore.dev'
  );
  assert(tlog.length === 1, 'Attestation must contain exactly one verified Rekor timestamp.');
  const verifiedAt = requireIsoTimestamp(
    tlog[0].timestamp,
    'attestation verified timestamp'
  );
  return {
    id,
    url: `https://github.com/${repository}/attestations/${id}`,
    verifiedAt,
  };
}

function createObservedMetadata({
  provenanceReport,
  repository,
  workflowPath,
  sourceRef,
  sourceDigest,
  version,
  expectedTag,
  run,
  provenanceArtifact,
  attestationArtifact,
  attestation,
}) {
  return {
    schemaVersion: 1,
    status: 'passed',
    package: provenanceReport.package,
    version,
    expectedTag,
    publishedAt: provenanceReport.publishedAt,
    repository,
    workflow: `${repository}/${workflowPath}`,
    sourceRef,
    sourceDigest,
    registryValidationRun: {
      id: run.id,
      url: run.url,
      event: run.event,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
    },
    provenanceArtifact,
    attestation,
    attestationArtifact,
    error: null,
  };
}

function createOutputFiles({ metadataBytes, provenanceFiles, attestationFiles }) {
  const files = new Map([
    [RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE, metadataBytes],
  ]);
  for (const relativePath of RELEASE_EVIDENCE_FILE_PATHS) {
    const [directory, file] = relativePath.split('/');
    const source =
      directory === RELEASE_EVIDENCE_ACQUISITION_PROVENANCE_DIR
        ? provenanceFiles
        : attestationFiles;
    files.set(relativePath, source.get(file));
  }
  return files;
}

function createAcquisitionManifest({ metadata, run, files }) {
  const metadataFile = files.find(
    (file) => file.path === RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE
  );
  assert(metadataFile, 'Acquisition metadata file digest is missing.');
  return {
    schemaVersion: RELEASE_EVIDENCE_ACQUISITION_SCHEMA_VERSION,
    status: 'passed',
    package: metadata.package,
    version: metadata.version,
    expectedTag: metadata.expectedTag,
    repository: metadata.repository,
    workflow: metadata.workflow,
    sourceRef: metadata.sourceRef,
    sourceDigest: metadata.sourceDigest,
    runId: run.id,
    runAttempt: run.runAttempt,
    provenanceArtifact: { ...metadata.provenanceArtifact },
    attestationArtifact: { ...metadata.attestationArtifact },
    attestation: { ...metadata.attestation },
    metadataFile: RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE,
    metadataSha256: metadataFile.sha256,
    files,
    acquisitionSha256: releaseEvidenceDigest(files),
    error: null,
  };
}

function parseJsonFile(files, file, label) {
  assert(files.has(file), `${label} file is missing.`);
  return parseJsonBytes(files.get(file), label);
}

function parseJsonBytes(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8').trim());
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function parseJsonLinesBytes(bytes, label) {
  const lines = bytes
    .toString('utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  assert(lines.length > 0, `${label} must contain at least one JSON record.`);
  return lines.map((line, index) => {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error(
        `${label} line ${index + 1} is not valid JSON: ${error.message}`
      );
    }
    assertRecord(parsed, `${label} line ${index + 1}`);
    return parsed;
  });
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

function assertRecord(value, label) {
  assert(
    value && typeof value === 'object' && !Array.isArray(value),
    `${label} must be an object.`
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
