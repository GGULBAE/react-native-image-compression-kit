import { createHash } from 'node:crypto';
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
  parseCanonicalWorkflowActionLock,
  validateWorkflowActionLock,
} from './workflow-supply-chain-core.mjs';

export const ACTION_PIN_PROVENANCE_SCHEMA_VERSION = 2;
export const ACTION_PIN_ARTIFACT_MANIFEST_SCHEMA_VERSION = 1;
export const ACTION_PIN_WORKFLOW_NAME = 'Action Pin Review';
export const ACTION_PIN_WORKFLOW_PATH = '.github/workflows/action-pin-review.yml';
export const ACTION_PIN_BASELINE_LOCK_FILE = 'baseline-actions-lock.json';
export const ACTION_PIN_CANDIDATE_LOCK_FILE = 'candidate-actions-lock.json';
export const ACTION_PIN_TAG_REFERENCE_FILE = 'tag-reference.json';
export const ACTION_PIN_ANNOTATED_TAG_FILE = 'annotated-tag.json';
export const ACTION_PIN_GITHUB_EVENT_FILE = 'workflow-dispatch-event.json';
export const ACTION_PIN_EXECUTION_FILE = 'github-execution.json';
export const ACTION_PIN_WORKFLOW_FILE = 'action-pin-review-workflow.yml';
export const ACTION_PIN_ARTIFACT_MANIFEST_FILE = 'artifact-manifest.json';
export const ACTION_PIN_PROVENANCE_REPORT_FILE = 'action-pin-provenance.json';

export const ACTION_PIN_PROVENANCE_REPORT_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'action',
  'repository',
  'releaseTag',
  'proposedSha',
  'baselineVersion',
  'baselineSha',
  'candidateVersion',
  'candidateSha',
  'tagObjectType',
  'tagObjectSha',
  'resolvedCommitSha',
  'resolution',
  'sourceRepository',
  'sourceRef',
  'sourceHeadSha',
  'workflowName',
  'workflowPath',
  'workflowRef',
  'workflowSha',
  'runId',
  'runAttempt',
  'evidence',
  'checks',
  'error',
]);

export const ACTION_PIN_PROVENANCE_EVIDENCE_FIELDS = Object.freeze([
  'artifactManifestFile',
  'artifactManifestSha256',
  'baselineLockFile',
  'baselineLockSha256',
  'candidateLockFile',
  'candidateLockSha256',
  'executionFile',
  'executionSha256',
  'githubEventFile',
  'githubEventSha256',
  'workflowFile',
  'workflowSha256',
  'tagReferenceFile',
  'tagReferenceSha256',
  'annotatedTagFile',
  'annotatedTagSha256',
]);

export const ACTION_PIN_PROVENANCE_CHECK_FIELDS = Object.freeze([
  'inputs',
  'execution',
  'event',
  'registration',
  'repository',
  'releaseTag',
  'noDowngrade',
  'candidateLock',
  'workflow',
  'tagReference',
  'dereference',
  'commit',
  'manifest',
]);

export const ACTION_PIN_EXECUTION_FIELDS = Object.freeze([
  'sourceRepository',
  'sourceRef',
  'sourceHeadSha',
  'workflowName',
  'workflowPath',
  'workflowRef',
  'workflowSha',
  'runId',
  'runAttempt',
]);

export const ACTION_PIN_GITHUB_EVENT_FIELDS = Object.freeze([
  'eventName',
  'repository',
  'ref',
  'workflow',
  'inputs',
]);

export const ACTION_PIN_GITHUB_EVENT_INPUT_FIELDS = Object.freeze([
  'action',
  'repository',
  'releaseTag',
  'proposedSha',
  'baselineRef',
]);

export const ACTION_PIN_ARTIFACT_MANIFEST_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'files',
  'error',
]);

export const ACTION_PIN_ARTIFACT_MANIFEST_ENTRY_FIELDS = Object.freeze([
  'path',
  'size',
  'sha256',
]);

export const ACTION_PIN_TAG_REFERENCE_FIELDS = Object.freeze([
  'repository',
  'tag',
  'ref',
  'url',
  'objectType',
  'objectSha',
  'objectUrl',
]);

export const ACTION_PIN_ANNOTATED_TAG_FIELDS = Object.freeze([
  'repository',
  'tag',
  'sha',
  'url',
  'objectType',
  'objectSha',
  'objectUrl',
]);

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/;
const ACTION_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/;
const REPOSITORY_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const RELEASE_TAG = /^v(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,2}(?:-[0-9A-Za-z.-]+)?$/;
const GITHUB_REF = /^refs\/(?:heads|tags)\/[^\u0000-\u001f\u007f]+$/;
const POSITIVE_DECIMAL = /^[1-9]\d*$/;
const SHA256 = /^[0-9a-f]{64}$/;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalActionPinJson(value) {
  return `${JSON.stringify(value)}\n`;
}

export function canonicalActionPinArtifactManifest(value) {
  return `${JSON.stringify(value)}\n`;
}

export function createActionPinProvenanceReport({
  action = null,
  repository = null,
  releaseTag = null,
  proposedSha = null,
  baselineVersion = null,
  baselineSha = null,
  candidateVersion = null,
  candidateSha = null,
  tagObjectType = null,
  tagObjectSha = null,
  resolvedCommitSha = null,
  resolution = null,
  sourceRepository = null,
  sourceRef = null,
  sourceHeadSha = null,
  workflowName = null,
  workflowPath = null,
  workflowRef = null,
  workflowSha = null,
  runId = null,
  runAttempt = null,
  evidence = {},
  checks = {},
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: ACTION_PIN_PROVENANCE_SCHEMA_VERSION,
    status,
    action,
    repository,
    releaseTag,
    proposedSha,
    baselineVersion,
    baselineSha,
    candidateVersion,
    candidateSha,
    tagObjectType,
    tagObjectSha,
    resolvedCommitSha,
    resolution,
    sourceRepository,
    sourceRef,
    sourceHeadSha,
    workflowName,
    workflowPath,
    workflowRef,
    workflowSha,
    runId,
    runAttempt,
    evidence: {
      artifactManifestFile: ACTION_PIN_ARTIFACT_MANIFEST_FILE,
      artifactManifestSha256: evidence.artifactManifestSha256 ?? null,
      baselineLockFile: ACTION_PIN_BASELINE_LOCK_FILE,
      baselineLockSha256: evidence.baselineLockSha256 ?? null,
      candidateLockFile: ACTION_PIN_CANDIDATE_LOCK_FILE,
      candidateLockSha256: evidence.candidateLockSha256 ?? null,
      executionFile: ACTION_PIN_EXECUTION_FILE,
      executionSha256: evidence.executionSha256 ?? null,
      githubEventFile: ACTION_PIN_GITHUB_EVENT_FILE,
      githubEventSha256: evidence.githubEventSha256 ?? null,
      workflowFile: ACTION_PIN_WORKFLOW_FILE,
      workflowSha256: evidence.workflowSha256 ?? null,
      tagReferenceFile: ACTION_PIN_TAG_REFERENCE_FILE,
      tagReferenceSha256: evidence.tagReferenceSha256 ?? null,
      annotatedTagFile:
        evidence.annotatedTagSha256 == null ? null : ACTION_PIN_ANNOTATED_TAG_FILE,
      annotatedTagSha256: evidence.annotatedTagSha256 ?? null,
    },
    checks: Object.fromEntries(
      ACTION_PIN_PROVENANCE_CHECK_FIELDS.map((field) => [
        field,
        checks[field] === true,
      ])
    ),
    error,
  };
}

export function validateActionPinReviewRequest({
  action,
  repository,
  releaseTag,
  proposedSha,
} = {}) {
  assert(ACTION_NAME.test(action), `Invalid Action name: ${action}`);
  assert(REPOSITORY_NAME.test(repository), `Invalid Action repository: ${repository}`);
  assert(RELEASE_TAG.test(releaseTag), `Invalid reviewed release tag: ${releaseTag}`);
  assert(
    FULL_COMMIT_SHA.test(proposedSha),
    `Proposed Action SHA must be a lowercase full 40-character commit SHA; got ${proposedSha}.`
  );
}

export function validateActionPinExecution(execution = {}) {
  assertExactFields(execution, ACTION_PIN_EXECUTION_FIELDS, 'Action pin execution identity');
  assert(
    REPOSITORY_NAME.test(execution.sourceRepository),
    `Invalid source repository: ${execution.sourceRepository}`
  );
  assert(GITHUB_REF.test(execution.sourceRef), `Invalid source ref: ${execution.sourceRef}`);
  assert(
    FULL_COMMIT_SHA.test(execution.sourceHeadSha),
    'Source head SHA must be a lowercase full 40-character commit SHA.'
  );
  assert(
    execution.workflowName === ACTION_PIN_WORKFLOW_NAME,
    `Workflow name must be exactly ${ACTION_PIN_WORKFLOW_NAME}.`
  );
  assert(
    execution.workflowPath === ACTION_PIN_WORKFLOW_PATH,
    `Workflow path must be exactly ${ACTION_PIN_WORKFLOW_PATH}.`
  );
  assert(
    execution.workflowRef ===
      `${execution.sourceRepository}/${execution.workflowPath}@${execution.sourceRef}`,
    'Workflow ref does not bind the source repository, workflow path, and source ref.'
  );
  assert(
    FULL_COMMIT_SHA.test(execution.workflowSha),
    'Workflow SHA must be a lowercase full 40-character commit SHA.'
  );
  assert(POSITIVE_DECIMAL.test(execution.runId), 'GitHub run ID must be a positive decimal string.');
  assert(
    Number.isSafeInteger(execution.runAttempt) && execution.runAttempt > 0,
    'GitHub run attempt must be a positive safe integer.'
  );
}

export function createWorkflowDispatchEventEvidence({
  eventName,
  event,
  execution,
  action,
  repository,
  releaseTag,
  proposedSha,
  baselineRef,
} = {}) {
  assert(eventName === 'workflow_dispatch', `Unsupported GitHub event: ${eventName}`);
  assertRecord(event, 'GitHub workflow_dispatch event');
  assertRecord(event.repository, 'GitHub workflow_dispatch repository');
  assertRecord(event.inputs, 'GitHub workflow_dispatch inputs');
  const evidence = {
    eventName,
    repository: event.repository.full_name,
    ref: event.ref,
    workflow: event.workflow,
    inputs: {
      action: event.inputs.action,
      repository: event.inputs.repository,
      releaseTag: event.inputs.release_tag,
      proposedSha: event.inputs.proposed_sha,
      baselineRef: event.inputs.baseline_ref,
    },
  };
  validateWorkflowDispatchEventEvidence(evidence, {
    execution,
    action,
    repository,
    releaseTag,
    proposedSha,
    baselineRef,
  });
  return evidence;
}

export function createActionPinEvidenceFiles({
  baselineLockBytes,
  candidateLockBytes,
  execution,
  githubEvent,
  workflowBytes,
  tagReference,
  annotatedTag = null,
} = {}) {
  assert(Buffer.isBuffer(baselineLockBytes), 'baseline Action lock bytes are required.');
  assert(Buffer.isBuffer(candidateLockBytes), 'candidate Action lock bytes are required.');
  assert(Buffer.isBuffer(workflowBytes), 'Action Pin Review workflow bytes are required.');
  return {
    [ACTION_PIN_BASELINE_LOCK_FILE]: baselineLockBytes,
    [ACTION_PIN_CANDIDATE_LOCK_FILE]: candidateLockBytes,
    [ACTION_PIN_EXECUTION_FILE]: Buffer.from(canonicalActionPinJson(execution), 'utf8'),
    [ACTION_PIN_GITHUB_EVENT_FILE]: Buffer.from(canonicalActionPinJson(githubEvent), 'utf8'),
    [ACTION_PIN_WORKFLOW_FILE]: workflowBytes,
    [ACTION_PIN_TAG_REFERENCE_FILE]: Buffer.from(canonicalActionPinJson(tagReference), 'utf8'),
    ...(annotatedTag
      ? {
          [ACTION_PIN_ANNOTATED_TAG_FILE]: Buffer.from(
            canonicalActionPinJson(annotatedTag),
            'utf8'
          ),
        }
      : {}),
  };
}

export function createActionPinArtifactManifest(evidenceFiles) {
  assertRecord(evidenceFiles, 'Action pin evidence files');
  const files = Object.entries(evidenceFiles)
    .sort(([left], [right]) => compareText(left, right))
    .map(([filePath, bytes]) => {
      validateManifestPath(filePath);
      assert(Buffer.isBuffer(bytes), `Evidence file ${filePath} must be bytes.`);
      return { path: filePath, size: bytes.length, sha256: sha256(bytes) };
    });
  assert(files.length > 0, 'Action pin artifact manifest must contain evidence files.');
  const manifest = {
    schemaVersion: ACTION_PIN_ARTIFACT_MANIFEST_SCHEMA_VERSION,
    status: 'passed',
    files,
    error: null,
  };
  validateActionPinArtifactManifest(manifest);
  return manifest;
}

export function validateActionPinArtifactManifest(manifest) {
  assertExactFields(
    manifest,
    ACTION_PIN_ARTIFACT_MANIFEST_FIELDS,
    'Action pin artifact manifest'
  );
  assert(
    manifest.schemaVersion === ACTION_PIN_ARTIFACT_MANIFEST_SCHEMA_VERSION,
    `Unsupported Action pin artifact manifest schemaVersion: ${manifest.schemaVersion}`
  );
  assert(manifest.status === 'passed', 'Action pin artifact manifest status must be passed.');
  assert(manifest.error === null, 'Action pin artifact manifest error must be null.');
  assert(Array.isArray(manifest.files), 'Action pin artifact manifest files must be an array.');
  assert(manifest.files.length > 0, 'Action pin artifact manifest files must not be empty.');
  const paths = [];
  for (const entry of manifest.files) {
    assertExactFields(
      entry,
      ACTION_PIN_ARTIFACT_MANIFEST_ENTRY_FIELDS,
      'Action pin artifact manifest entry'
    );
    validateManifestPath(entry.path);
    assert(
      Number.isSafeInteger(entry.size) && entry.size >= 0,
      `Artifact manifest size for ${entry.path} must be a non-negative safe integer.`
    );
    assert(SHA256.test(entry.sha256), `Artifact manifest SHA-256 for ${entry.path} is invalid.`);
    paths.push(entry.path);
  }
  const sorted = [...paths].sort(compareText);
  assert(
    JSON.stringify(paths) === JSON.stringify(sorted),
    'Action pin artifact manifest paths must be sorted.'
  );
  assert(new Set(paths).size === paths.length, 'Action pin artifact manifest paths must be unique.');
}

export function reviewActionPin({
  action,
  repository,
  releaseTag,
  proposedSha,
  baselineRef,
  baselineLockBytes,
  candidateLockBytes,
  execution,
  githubEvent,
  workflowBytes,
  tagReference,
  annotatedTag = null,
  artifactManifest,
} = {}) {
  const state = {
    action: action ?? null,
    repository: repository ?? null,
    releaseTag: releaseTag ?? null,
    proposedSha: proposedSha ?? null,
    ...executionState(execution),
    checks: {},
    evidence: {
      artifactManifestSha256: artifactManifest
        ? sha256(canonicalActionPinArtifactManifest(artifactManifest))
        : null,
      baselineLockSha256: Buffer.isBuffer(baselineLockBytes)
        ? sha256(baselineLockBytes)
        : null,
      candidateLockSha256: Buffer.isBuffer(candidateLockBytes)
        ? sha256(candidateLockBytes)
        : null,
      executionSha256: execution
        ? sha256(canonicalActionPinJson(execution))
        : null,
      githubEventSha256: githubEvent
        ? sha256(canonicalActionPinJson(githubEvent))
        : null,
      workflowSha256: Buffer.isBuffer(workflowBytes) ? sha256(workflowBytes) : null,
      tagReferenceSha256: tagReference
        ? sha256(canonicalActionPinJson(tagReference))
        : null,
      annotatedTagSha256: annotatedTag
        ? sha256(canonicalActionPinJson(annotatedTag))
        : null,
    },
  };

  try {
    validateActionPinReviewRequest({ action, repository, releaseTag, proposedSha });
    assert(typeof baselineRef === 'string' && baselineRef.length > 0, 'Baseline ref is required.');
    state.checks.inputs = true;

    validateActionPinExecution(execution);
    state.checks.execution = true;

    validateWorkflowDispatchEventEvidence(githubEvent, {
      execution,
      action,
      repository,
      releaseTag,
      proposedSha,
      baselineRef,
    });
    state.checks.event = true;

    const baselineLock = parseLock(baselineLockBytes, 'baseline Action lock');
    const candidateLock = parseLock(candidateLockBytes, 'candidate Action lock');
    const baselineAction = baselineLock.actions.find((entry) => entry.action === action);
    const candidateAction = candidateLock.actions.find((entry) => entry.action === action);
    assert(baselineAction, `Action ${action} is not registered in the baseline lock.`);
    assert(candidateAction, `Action ${action} is not registered in the candidate lock.`);
    state.baselineVersion = baselineAction.version;
    state.baselineSha = baselineAction.sha;
    state.candidateVersion = candidateAction.version;
    state.candidateSha = candidateAction.sha;
    state.checks.registration = true;

    const actionSegments = action.split('/');
    const actionRepository = `${actionSegments[0]}/${actionSegments[1]}`;
    assert(repository === actionRepository, `Repository ${repository} does not own Action ${action}.`);
    assert(
      baselineAction.repository === repository && candidateAction.repository === repository,
      `Action ${action} repository changed from the reviewed repository ${repository}.`
    );
    state.checks.repository = true;

    assert(
      candidateAction.version === releaseTag,
      `Candidate lock release tag ${candidateAction.version} does not match reviewed tag ${releaseTag}.`
    );
    state.checks.releaseTag = true;

    assert(
      releaseMajor(candidateAction.version) >= releaseMajor(baselineAction.version),
      `Action ${action} major version may not downgrade from ${baselineAction.version} to ${candidateAction.version}.`
    );
    state.checks.noDowngrade = true;

    assert(
      candidateAction.sha === proposedSha,
      `Candidate lock SHA ${candidateAction.sha} does not match proposed SHA ${proposedSha}.`
    );
    state.checks.candidateLock = true;

    assert(Buffer.isBuffer(workflowBytes) && workflowBytes.length > 0, 'Workflow definition bytes are required.');
    assert(
      candidateLock.workflows.includes(execution.workflowPath),
      `Candidate lock does not register workflow ${execution.workflowPath}.`
    );
    state.checks.workflow = true;

    validateTagReference(tagReference, repository, releaseTag);
    state.tagObjectType = tagReference.objectType;
    state.tagObjectSha = tagReference.objectSha;
    state.checks.tagReference = true;

    if (tagReference.objectType === 'commit') {
      assert(annotatedTag === null, 'A lightweight tag must not include annotated-tag evidence.');
      state.resolution = 'lightweight';
      state.resolvedCommitSha = tagReference.objectSha;
    } else {
      validateAnnotatedTag(annotatedTag, repository, releaseTag, tagReference.objectSha);
      state.resolution = 'annotated';
      state.resolvedCommitSha = annotatedTag.objectSha;
    }
    state.checks.dereference = true;

    assert(
      state.resolvedCommitSha === proposedSha,
      `Release tag ${releaseTag} resolves to ${state.resolvedCommitSha}, not proposed SHA ${proposedSha}.`
    );
    state.checks.commit = true;

    const evidenceFiles = createActionPinEvidenceFiles({
      baselineLockBytes,
      candidateLockBytes,
      execution,
      githubEvent,
      workflowBytes,
      tagReference,
      annotatedTag,
    });
    const expectedManifest = createActionPinArtifactManifest(evidenceFiles);
    validateActionPinArtifactManifest(artifactManifest);
    assert(
      canonicalActionPinArtifactManifest(artifactManifest) ===
        canonicalActionPinArtifactManifest(expectedManifest),
      'Action pin artifact manifest does not match the reviewed evidence files.'
    );
    state.checks.manifest = true;

    return createActionPinProvenanceReport({
      ...state,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    return createActionPinProvenanceReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function verifyActionPinProvenanceArtifact({ artifactDir } = {}) {
  const directory = validateDirectory(artifactDir, 'Action pin provenance artifact');
  const reportBytes = readSecureFile(
    path.join(directory, ACTION_PIN_PROVENANCE_REPORT_FILE),
    'Action pin provenance report'
  );
  const storedReport = parseCanonicalReport(reportBytes);
  const manifestBytes = readSecureFile(
    path.join(directory, ACTION_PIN_ARTIFACT_MANIFEST_FILE),
    'Action pin artifact manifest'
  );
  const artifactManifest = parseCanonicalManifest(manifestBytes);
  assert(
    sha256(manifestBytes) === storedReport.evidence.artifactManifestSha256,
    'Action pin artifact manifest SHA-256 does not match the provenance report.'
  );

  const expectedEvidencePaths = expectedEvidenceFilePaths(
    storedReport.evidence.annotatedTagFile !== null
  );
  const manifestPaths = artifactManifest.files.map((entry) => entry.path);
  assert(
    JSON.stringify(manifestPaths) === JSON.stringify(expectedEvidencePaths),
    `Action pin artifact manifest evidence paths must be exactly: ${expectedEvidencePaths.join(', ')}.`
  );
  const expectedFiles = [
    ACTION_PIN_ARTIFACT_MANIFEST_FILE,
    ACTION_PIN_PROVENANCE_REPORT_FILE,
    ...manifestPaths,
  ].sort(compareText);
  const actualFiles = readdirSync(directory).sort(compareText);
  assert(
    JSON.stringify(actualFiles) === JSON.stringify(expectedFiles),
    `Action pin provenance artifact files must be exactly: ${expectedFiles.join(', ')}.`
  );

  const evidence = {};
  for (const entry of artifactManifest.files) {
    const bytes = readSecureFile(
      resolveManifestFile(directory, entry.path),
      `Action pin evidence ${entry.path}`
    );
    assert(
      bytes.length === entry.size,
      `Action pin evidence ${entry.path} size does not match the artifact manifest.`
    );
    assert(
      sha256(bytes) === entry.sha256,
      `Action pin evidence ${entry.path} SHA-256 does not match the artifact manifest.`
    );
    evidence[entry.path] = bytes;
  }

  const baselineLockBytes = evidence[ACTION_PIN_BASELINE_LOCK_FILE];
  const candidateLockBytes = evidence[ACTION_PIN_CANDIDATE_LOCK_FILE];
  const execution = parseCanonicalEvidence(
    evidence[ACTION_PIN_EXECUTION_FILE],
    ACTION_PIN_EXECUTION_FIELDS,
    'GitHub execution identity evidence'
  );
  const githubEvent = parseCanonicalEvidence(
    evidence[ACTION_PIN_GITHUB_EVENT_FILE],
    ACTION_PIN_GITHUB_EVENT_FIELDS,
    'workflow-dispatch event evidence'
  );
  assertExactFields(
    githubEvent.inputs,
    ACTION_PIN_GITHUB_EVENT_INPUT_FIELDS,
    'workflow-dispatch event inputs'
  );
  const workflowBytes = evidence[ACTION_PIN_WORKFLOW_FILE];
  const tagReference = parseCanonicalEvidence(
    evidence[ACTION_PIN_TAG_REFERENCE_FILE],
    ACTION_PIN_TAG_REFERENCE_FIELDS,
    'tag-reference evidence'
  );
  const annotatedTag = storedReport.evidence.annotatedTagFile
    ? parseCanonicalEvidence(
        evidence[ACTION_PIN_ANNOTATED_TAG_FILE],
        ACTION_PIN_ANNOTATED_TAG_FIELDS,
        'annotated-tag evidence'
      )
    : null;

  const reproduced = reviewActionPin({
    action: storedReport.action,
    repository: storedReport.repository,
    releaseTag: storedReport.releaseTag,
    proposedSha: storedReport.proposedSha,
    baselineRef: githubEvent.inputs.baselineRef,
    baselineLockBytes,
    candidateLockBytes,
    execution,
    githubEvent,
    workflowBytes,
    tagReference,
    annotatedTag,
    artifactManifest,
  });
  assert(
    canonicalActionPinJson(reproduced) === reportBytes.toString('utf8'),
    'Action pin provenance report does not match its bundled evidence.'
  );
  return reproduced;
}

export function writeActionPinProvenanceArtifactAtomic(
  directoryPath,
  {
    baselineLockBytes,
    candidateLockBytes,
    execution,
    githubEvent,
    workflowBytes,
    tagReference,
    annotatedTag = null,
    artifactManifest,
    report,
  },
  operations = {}
) {
  const mkdir = operations.mkdir ?? mkdirSync;
  const writeFile = operations.writeFile ?? writeFileSync;
  const rename = operations.rename ?? renameSync;
  const remove = operations.remove ?? rmSync;
  const destination = path.resolve(directoryPath);
  const parent = path.dirname(destination);
  const temporary = path.join(
    parent,
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`
  );
  const evidenceFiles = createActionPinEvidenceFiles({
    baselineLockBytes,
    candidateLockBytes,
    execution,
    githubEvent,
    workflowBytes,
    tagReference,
    annotatedTag,
  });
  const expectedManifest = createActionPinArtifactManifest(evidenceFiles);
  assert(
    canonicalActionPinArtifactManifest(artifactManifest) ===
      canonicalActionPinArtifactManifest(expectedManifest),
    'Refusing to write an Action pin artifact with a mismatched manifest.'
  );
  assert(
    report.evidence.artifactManifestSha256 ===
      sha256(canonicalActionPinArtifactManifest(artifactManifest)),
    'Refusing to write an Action pin artifact whose report does not bind the manifest.'
  );

  mkdir(parent, { recursive: true });
  mkdir(temporary);
  try {
    for (const entry of artifactManifest.files) {
      writeFile(path.join(temporary, entry.path), evidenceFiles[entry.path], { flag: 'wx' });
    }
    writeFile(
      path.join(temporary, ACTION_PIN_ARTIFACT_MANIFEST_FILE),
      canonicalActionPinArtifactManifest(artifactManifest),
      { encoding: 'utf8', flag: 'wx' }
    );
    writeFile(
      path.join(temporary, ACTION_PIN_PROVENANCE_REPORT_FILE),
      canonicalActionPinJson(report),
      { encoding: 'utf8', flag: 'wx' }
    );
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { recursive: true, force: true });
    throw error;
  }
}

export function writeActionPinProvenanceReportAtomic(filePath, report, operations = {}) {
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
    writeFile(temporary, canonicalActionPinJson(report), {
      encoding: 'utf8',
      flag: 'wx',
    });
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { force: true });
    throw error;
  }
}

function validateWorkflowDispatchEventEvidence(
  value,
  { execution, action, repository, releaseTag, proposedSha, baselineRef }
) {
  assertExactFields(value, ACTION_PIN_GITHUB_EVENT_FIELDS, 'workflow-dispatch event evidence');
  assertExactFields(
    value.inputs,
    ACTION_PIN_GITHUB_EVENT_INPUT_FIELDS,
    'workflow-dispatch event inputs'
  );
  assert(value.eventName === 'workflow_dispatch', 'GitHub event must be workflow_dispatch.');
  assert(value.repository === execution.sourceRepository, 'GitHub event repository does not match source repository.');
  assert(value.ref === execution.sourceRef, 'GitHub event ref does not match source ref.');
  assert(value.workflow === execution.workflowPath, 'GitHub event workflow does not match workflow path.');
  assert(value.inputs.action === action, 'GitHub event Action input does not match the review request.');
  assert(value.inputs.repository === repository, 'GitHub event repository input does not match the reviewed Action repository.');
  assert(value.inputs.releaseTag === releaseTag, 'GitHub event release tag input does not match the review request.');
  assert(value.inputs.proposedSha === proposedSha, 'GitHub event proposed SHA input does not match the review request.');
  assert(value.inputs.baselineRef === baselineRef, 'GitHub event baseline ref input does not match the review request.');
}

function expectedEvidenceFilePaths(hasAnnotatedTag) {
  return [
    ACTION_PIN_BASELINE_LOCK_FILE,
    ACTION_PIN_CANDIDATE_LOCK_FILE,
    ACTION_PIN_EXECUTION_FILE,
    ACTION_PIN_GITHUB_EVENT_FILE,
    ACTION_PIN_WORKFLOW_FILE,
    ACTION_PIN_TAG_REFERENCE_FILE,
    ...(hasAnnotatedTag ? [ACTION_PIN_ANNOTATED_TAG_FILE] : []),
  ].sort(compareText);
}

function executionState(execution) {
  return Object.fromEntries(
    ACTION_PIN_EXECUTION_FIELDS.map((field) => [field, execution?.[field] ?? null])
  );
}

function parseLock(bytes, label) {
  assert(Buffer.isBuffer(bytes), `${label} bytes are required.`);
  try {
    const lock = parseCanonicalWorkflowActionLock(bytes);
    validateWorkflowActionLock(lock);
    return lock;
  } catch (error) {
    throw new Error(`${label} is invalid: ${error.message}`);
  }
}

function validateTagReference(value, repository, releaseTag) {
  assertExactFields(value, ACTION_PIN_TAG_REFERENCE_FIELDS, 'tag-reference evidence');
  assert(value.repository === repository, 'Tag reference repository does not match the reviewed repository.');
  assert(value.tag === releaseTag, 'Tag reference release tag does not match the reviewed tag.');
  assert(value.ref === `refs/tags/${releaseTag}`, 'Tag reference name is not exact.');
  assert(value.url === githubTagReferenceUrl(repository, releaseTag), 'Tag reference source URL does not match the reviewed repository and tag.');
  assert(value.objectType === 'commit' || value.objectType === 'tag', `Tag reference must target a commit or annotated tag; got ${value.objectType}.`);
  assert(FULL_COMMIT_SHA.test(value.objectSha), 'Tag reference object SHA is not a full commit SHA.');
  const expectedObjectUrl = githubGitObjectUrl(
    repository,
    value.objectType === 'tag' ? 'tags' : 'commits',
    value.objectSha
  );
  assert(value.objectUrl === expectedObjectUrl, 'Tag reference object URL is not exact.');
}

function validateAnnotatedTag(value, repository, releaseTag, tagObjectSha) {
  assertExactFields(value, ACTION_PIN_ANNOTATED_TAG_FIELDS, 'annotated-tag evidence');
  assert(value.repository === repository, 'Annotated tag repository does not match the reviewed repository.');
  assert(value.tag === releaseTag, 'Annotated tag name does not match the reviewed tag.');
  assert(value.sha === tagObjectSha, 'Annotated tag SHA does not match the tag reference object.');
  assert(value.url === githubGitObjectUrl(repository, 'tags', tagObjectSha), 'Annotated tag source URL is not exact.');
  assert(value.objectType === 'commit', `Annotated tag dereference must resolve directly to a commit; got ${value.objectType}.`);
  assert(FULL_COMMIT_SHA.test(value.objectSha), 'Annotated tag commit SHA is not a full commit SHA.');
  assert(value.objectUrl === githubGitObjectUrl(repository, 'commits', value.objectSha), 'Annotated tag commit URL is not exact.');
}

function parseCanonicalReport(bytes) {
  const report = parseJson(bytes, 'Action pin provenance report');
  assertExactFields(report, ACTION_PIN_PROVENANCE_REPORT_FIELDS, 'Action pin provenance report');
  assert(
    report.schemaVersion === ACTION_PIN_PROVENANCE_SCHEMA_VERSION,
    `Unsupported Action pin provenance schemaVersion: ${report.schemaVersion}`
  );
  assertExactFields(report.evidence, ACTION_PIN_PROVENANCE_EVIDENCE_FIELDS, 'Action pin provenance evidence');
  assertExactFields(report.checks, ACTION_PIN_PROVENANCE_CHECK_FIELDS, 'Action pin provenance checks');
  assert(bytes.equals(Buffer.from(canonicalActionPinJson(report), 'utf8')), 'Action pin provenance report is not canonical JSON.');
  return report;
}

function parseCanonicalManifest(bytes) {
  const manifest = parseJson(bytes, 'Action pin artifact manifest');
  validateActionPinArtifactManifest(manifest);
  assert(
    bytes.equals(Buffer.from(canonicalActionPinArtifactManifest(manifest), 'utf8')),
    'Action pin artifact manifest is not canonical JSON.'
  );
  return manifest;
}

export function validateCanonicalActionPinArtifactManifestBytes(bytes) {
  return parseCanonicalManifest(bytes);
}

function parseCanonicalEvidence(bytes, fields, label) {
  const value = parseJson(bytes, label);
  assertExactFields(value, fields, label);
  assert(bytes.equals(Buffer.from(canonicalActionPinJson(value), 'utf8')), `${label} is not canonical JSON.`);
  return value;
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Could not parse ${label}: ${error.message}`);
  }
}

function releaseMajor(version) {
  return Number(version.slice(1).split('.')[0]);
}

function githubTagReferenceUrl(repository, releaseTag) {
  return `https://api.github.com/repos/${repository}/git/ref/tags/${encodeURIComponent(releaseTag)}`;
}

function githubGitObjectUrl(repository, objectKind, sha) {
  return `https://api.github.com/repos/${repository}/git/${objectKind}/${sha}`;
}

function validateDirectory(directoryPath, label) {
  assert(typeof directoryPath === 'string' && directoryPath.length > 0, `${label} path is required.`);
  const resolved = path.resolve(directoryPath);
  const stats = lstatSync(resolved);
  assert(!stats.isSymbolicLink(), `${label} must not be a symbolic link.`);
  assert(stats.isDirectory(), `${label} must be a directory.`);
  return realpathSync(resolved);
}

function resolveManifestFile(directory, filePath) {
  validateManifestPath(filePath);
  const resolved = path.resolve(directory, filePath);
  assert(path.dirname(resolved) === directory, `Artifact manifest path escapes the artifact directory: ${filePath}`);
  return resolved;
}

function validateManifestPath(filePath) {
  assert(typeof filePath === 'string' && filePath.length > 0, 'Artifact manifest path must be a non-empty string.');
  assert(!filePath.includes('\\'), `Artifact manifest path must use POSIX separators: ${filePath}`);
  assert(!path.posix.isAbsolute(filePath), `Artifact manifest path must be relative: ${filePath}`);
  assert(path.posix.normalize(filePath) === filePath, `Artifact manifest path is noncanonical or traverses directories: ${filePath}`);
  assert(!filePath.split('/').includes('..'), `Artifact manifest path traverses directories: ${filePath}`);
  assert(!filePath.includes('/'), `Artifact manifest evidence paths must be flat filenames: ${filePath}`);
  assert(filePath !== ACTION_PIN_ARTIFACT_MANIFEST_FILE && filePath !== ACTION_PIN_PROVENANCE_REPORT_FILE, `Artifact manifest may list evidence files only: ${filePath}`);
}

function readSecureFile(filePath, label) {
  assert(existsSync(filePath), `${label} is missing.`);
  const stats = lstatSync(filePath);
  assert(!stats.isSymbolicLink(), `${label} must not be a symbolic link.`);
  assert(stats.isFile(), `${label} must be a regular file.`);
  return readFileSync(realpathSync(filePath));
}

function assertExactFields(value, fields, label) {
  assertRecord(value, label);
  assert(
    JSON.stringify(Object.keys(value)) === JSON.stringify(fields),
    `${label} fields must be exactly: ${fields.join(', ')}.`
  );
}

function assertRecord(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
