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

export const ACTION_PIN_PROVENANCE_SCHEMA_VERSION = 1;
export const ACTION_PIN_BASELINE_LOCK_FILE = 'baseline-actions-lock.json';
export const ACTION_PIN_CANDIDATE_LOCK_FILE = 'candidate-actions-lock.json';
export const ACTION_PIN_TAG_REFERENCE_FILE = 'tag-reference.json';
export const ACTION_PIN_ANNOTATED_TAG_FILE = 'annotated-tag.json';
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
  'evidence',
  'checks',
  'error',
]);

export const ACTION_PIN_PROVENANCE_EVIDENCE_FIELDS = Object.freeze([
  'baselineLockFile',
  'baselineLockSha256',
  'candidateLockFile',
  'candidateLockSha256',
  'tagReferenceFile',
  'tagReferenceSha256',
  'annotatedTagFile',
  'annotatedTagSha256',
]);

export const ACTION_PIN_PROVENANCE_CHECK_FIELDS = Object.freeze([
  'inputs',
  'registration',
  'repository',
  'releaseTag',
  'noDowngrade',
  'candidateLock',
  'tagReference',
  'dereference',
  'commit',
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

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalActionPinJson(value) {
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
    evidence: {
      baselineLockFile: ACTION_PIN_BASELINE_LOCK_FILE,
      baselineLockSha256: evidence.baselineLockSha256 ?? null,
      candidateLockFile: ACTION_PIN_CANDIDATE_LOCK_FILE,
      candidateLockSha256: evidence.candidateLockSha256 ?? null,
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

export function reviewActionPin({
  action,
  repository,
  releaseTag,
  proposedSha,
  baselineLockBytes,
  candidateLockBytes,
  tagReference,
  annotatedTag = null,
} = {}) {
  const state = {
    action: action ?? null,
    repository: repository ?? null,
    releaseTag: releaseTag ?? null,
    proposedSha: proposedSha ?? null,
    checks: {},
    evidence: {
      baselineLockSha256: Buffer.isBuffer(baselineLockBytes)
        ? sha256(baselineLockBytes)
        : null,
      candidateLockSha256: Buffer.isBuffer(candidateLockBytes)
        ? sha256(candidateLockBytes)
        : null,
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
    state.checks.inputs = true;

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

    validateTagReference(tagReference, repository, releaseTag);
    state.tagObjectType = tagReference.objectType;
    state.tagObjectSha = tagReference.objectSha;
    state.checks.tagReference = true;

    if (tagReference.objectType === 'commit') {
      assert(annotatedTag === null, 'A lightweight tag must not include annotated-tag evidence.');
      state.resolution = 'lightweight';
      state.resolvedCommitSha = tagReference.objectSha;
    } else {
      validateAnnotatedTag(
        annotatedTag,
        repository,
        releaseTag,
        tagReference.objectSha
      );
      state.resolution = 'annotated';
      state.resolvedCommitSha = annotatedTag.objectSha;
    }
    state.checks.dereference = true;

    assert(
      state.resolvedCommitSha === proposedSha,
      `Release tag ${releaseTag} resolves to ${state.resolvedCommitSha}, not proposed SHA ${proposedSha}.`
    );
    state.checks.commit = true;

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
  const expectedFiles = [
    ACTION_PIN_BASELINE_LOCK_FILE,
    ACTION_PIN_CANDIDATE_LOCK_FILE,
    ACTION_PIN_PROVENANCE_REPORT_FILE,
    ACTION_PIN_TAG_REFERENCE_FILE,
    ...(storedReport.evidence.annotatedTagFile ? [ACTION_PIN_ANNOTATED_TAG_FILE] : []),
  ].sort(compareText);
  const actualFiles = readdirSync(directory).sort(compareText);
  assert(
    JSON.stringify(actualFiles) === JSON.stringify(expectedFiles),
    `Action pin provenance artifact files must be exactly: ${expectedFiles.join(', ')}.`
  );

  const baselineLockBytes = readSecureFile(
    path.join(directory, ACTION_PIN_BASELINE_LOCK_FILE),
    'baseline Action lock'
  );
  const candidateLockBytes = readSecureFile(
    path.join(directory, ACTION_PIN_CANDIDATE_LOCK_FILE),
    'candidate Action lock'
  );
  const tagReference = parseCanonicalEvidence(
    readSecureFile(
      path.join(directory, ACTION_PIN_TAG_REFERENCE_FILE),
      'tag-reference evidence'
    ),
    ACTION_PIN_TAG_REFERENCE_FIELDS,
    'tag-reference evidence'
  );
  const annotatedTag = storedReport.evidence.annotatedTagFile
    ? parseCanonicalEvidence(
        readSecureFile(
          path.join(directory, ACTION_PIN_ANNOTATED_TAG_FILE),
          'annotated-tag evidence'
        ),
        ACTION_PIN_ANNOTATED_TAG_FIELDS,
        'annotated-tag evidence'
      )
    : null;

  const reproduced = reviewActionPin({
    action: storedReport.action,
    repository: storedReport.repository,
    releaseTag: storedReport.releaseTag,
    proposedSha: storedReport.proposedSha,
    baselineLockBytes,
    candidateLockBytes,
    tagReference,
    annotatedTag,
  });
  assert(
    canonicalActionPinJson(reproduced) === reportBytes.toString('utf8'),
    'Action pin provenance report does not match its bundled evidence.'
  );
  return reproduced;
}

export function writeActionPinProvenanceArtifactAtomic(
  directoryPath,
  { baselineLockBytes, candidateLockBytes, tagReference, annotatedTag = null, report },
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

  mkdir(parent, { recursive: true });
  mkdir(temporary);
  try {
    writeFile(path.join(temporary, ACTION_PIN_BASELINE_LOCK_FILE), baselineLockBytes, {
      flag: 'wx',
    });
    writeFile(path.join(temporary, ACTION_PIN_CANDIDATE_LOCK_FILE), candidateLockBytes, {
      flag: 'wx',
    });
    writeFile(
      path.join(temporary, ACTION_PIN_TAG_REFERENCE_FILE),
      canonicalActionPinJson(tagReference),
      { encoding: 'utf8', flag: 'wx' }
    );
    if (annotatedTag) {
      writeFile(
        path.join(temporary, ACTION_PIN_ANNOTATED_TAG_FILE),
        canonicalActionPinJson(annotatedTag),
        { encoding: 'utf8', flag: 'wx' }
      );
    }
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

export function writeActionPinProvenanceReportAtomic(
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
  assertRecord(value, 'tag-reference evidence');
  assertExactFields(value, ACTION_PIN_TAG_REFERENCE_FIELDS, 'tag-reference evidence');
  assert(value.repository === repository, 'Tag reference repository does not match the reviewed repository.');
  assert(value.tag === releaseTag, 'Tag reference release tag does not match the reviewed tag.');
  assert(value.ref === `refs/tags/${releaseTag}`, 'Tag reference name is not exact.');
  assert(
    value.url === githubTagReferenceUrl(repository, releaseTag),
    'Tag reference source URL does not match the reviewed repository and tag.'
  );
  assert(
    value.objectType === 'commit' || value.objectType === 'tag',
    `Tag reference must target a commit or annotated tag; got ${value.objectType}.`
  );
  assert(FULL_COMMIT_SHA.test(value.objectSha), 'Tag reference object SHA is not a full commit SHA.');
  const expectedObjectUrl = githubGitObjectUrl(
    repository,
    value.objectType === 'tag' ? 'tags' : 'commits',
    value.objectSha
  );
  assert(value.objectUrl === expectedObjectUrl, 'Tag reference object URL is not exact.');
}

function validateAnnotatedTag(value, repository, releaseTag, tagObjectSha) {
  assertRecord(value, 'annotated-tag evidence');
  assertExactFields(value, ACTION_PIN_ANNOTATED_TAG_FIELDS, 'annotated-tag evidence');
  assert(value.repository === repository, 'Annotated tag repository does not match the reviewed repository.');
  assert(value.tag === releaseTag, 'Annotated tag name does not match the reviewed tag.');
  assert(value.sha === tagObjectSha, 'Annotated tag SHA does not match the tag reference object.');
  assert(
    value.url === githubGitObjectUrl(repository, 'tags', tagObjectSha),
    'Annotated tag source URL is not exact.'
  );
  assert(
    value.objectType === 'commit',
    `Annotated tag dereference must resolve directly to a commit; got ${value.objectType}.`
  );
  assert(FULL_COMMIT_SHA.test(value.objectSha), 'Annotated tag commit SHA is not a full commit SHA.');
  assert(
    value.objectUrl === githubGitObjectUrl(repository, 'commits', value.objectSha),
    'Annotated tag commit URL is not exact.'
  );
}

function parseCanonicalReport(bytes) {
  const report = parseJson(bytes, 'Action pin provenance report');
  assertRecord(report, 'Action pin provenance report');
  assertExactFields(
    report,
    ACTION_PIN_PROVENANCE_REPORT_FIELDS,
    'Action pin provenance report'
  );
  assert(
    report.schemaVersion === ACTION_PIN_PROVENANCE_SCHEMA_VERSION,
    `Unsupported Action pin provenance schemaVersion: ${report.schemaVersion}`
  );
  assertExactFields(
    report.evidence,
    ACTION_PIN_PROVENANCE_EVIDENCE_FIELDS,
    'Action pin provenance evidence'
  );
  assertExactFields(
    report.checks,
    ACTION_PIN_PROVENANCE_CHECK_FIELDS,
    'Action pin provenance checks'
  );
  assert(
    bytes.equals(Buffer.from(canonicalActionPinJson(report), 'utf8')),
    'Action pin provenance report is not canonical JSON.'
  );
  return report;
}

function parseCanonicalEvidence(bytes, fields, label) {
  const value = parseJson(bytes, label);
  assertRecord(value, label);
  assertExactFields(value, fields, label);
  assert(
    bytes.equals(Buffer.from(canonicalActionPinJson(value), 'utf8')),
    `${label} is not canonical JSON.`
  );
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
