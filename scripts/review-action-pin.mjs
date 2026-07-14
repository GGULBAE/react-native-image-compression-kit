#!/usr/bin/env node

import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalActionPinJson,
  createActionPinArtifactManifest,
  createActionPinEvidenceFiles,
  createActionPinProvenanceReport,
  createWorkflowDispatchEventEvidence,
  reviewActionPin,
  validateActionPinExecution,
  validateActionPinReviewRequest,
  writeActionPinProvenanceArtifactAtomic,
  writeActionPinProvenanceReportAtomic,
} from './action-pin-provenance-core.mjs';
import { resolveGitHubActionTag } from './action-pin-review-github.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export function parseActionPinReviewArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--action': 'action',
    '--repository': 'repository',
    '--release-tag': 'releaseTag',
    '--proposed-sha': 'proposedSha',
    '--baseline-ref': 'baselineRef',
    '--baseline-lock': 'baselineLock',
    '--candidate-lock': 'candidateLock',
    '--source-repository': 'sourceRepository',
    '--source-ref': 'sourceRef',
    '--source-head-sha': 'sourceHeadSha',
    '--workflow-name': 'workflowName',
    '--workflow-path': 'workflowPath',
    '--workflow-ref': 'workflowRef',
    '--workflow-sha': 'workflowSha',
    '--workflow-file': 'workflowFile',
    '--run-id': 'runId',
    '--run-attempt': 'runAttempt',
    '--event-name': 'eventName',
    '--github-event': 'githubEvent',
    '--artifact-dir': 'artifactDir',
    '--report-file': 'reportFile',
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (valueFlags[arg]) {
      parsed[valueFlags[arg]] = readValue(args, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

export async function runActionPinReview(options, dependencies = {}) {
  for (const [field, flag] of [
    ['action', '--action'],
    ['repository', '--repository'],
    ['releaseTag', '--release-tag'],
    ['proposedSha', '--proposed-sha'],
    ['baselineRef', '--baseline-ref'],
    ['sourceRepository', '--source-repository'],
    ['sourceRef', '--source-ref'],
    ['sourceHeadSha', '--source-head-sha'],
    ['workflowName', '--workflow-name'],
    ['workflowPath', '--workflow-path'],
    ['workflowRef', '--workflow-ref'],
    ['workflowSha', '--workflow-sha'],
    ['workflowFile', '--workflow-file'],
    ['runId', '--run-id'],
    ['runAttempt', '--run-attempt'],
    ['eventName', '--event-name'],
    ['githubEvent', '--github-event'],
  ]) {
    requireValue(options[field], flag);
  }
  validateActionPinReviewRequest(options);
  const execution = executionFromOptions(options);
  validateActionPinExecution(execution);

  const baselineLockPath = path.resolve(
    options.baselineLock ?? path.join(ROOT, '.github', 'actions-lock.json')
  );
  const candidateLockPath = path.resolve(
    options.candidateLock ?? path.join(ROOT, '.github', 'actions-lock.json')
  );
  const workflowPath = path.resolve(options.workflowFile);
  const githubEventPath = path.resolve(options.githubEvent);
  const baselineLockBytes = readSecureFile(baselineLockPath, 'baseline Action lock');
  const candidateLockBytes = readSecureFile(candidateLockPath, 'candidate Action lock');
  const workflowBytes = readSecureFile(workflowPath, 'Action Pin Review workflow definition');
  const rawEvent = parseEventJson(
    readSecureFile(githubEventPath, 'GitHub workflow_dispatch event')
  );
  const githubEvent = createWorkflowDispatchEventEvidence({
    eventName: options.eventName,
    event: rawEvent,
    execution,
    action: options.action,
    repository: options.repository,
    releaseTag: options.releaseTag,
    proposedSha: options.proposedSha,
    baselineRef: options.baselineRef,
  });
  const resolver = dependencies.resolveTag ?? resolveGitHubActionTag;
  const { tagReference, annotatedTag } = await resolver({
    repository: options.repository,
    releaseTag: options.releaseTag,
  });
  const artifactManifest = createActionPinArtifactManifest(
    createActionPinEvidenceFiles({
      baselineLockBytes,
      candidateLockBytes,
      execution,
      githubEvent,
      workflowBytes,
      tagReference,
      annotatedTag,
    })
  );
  const report = reviewActionPin({
    action: options.action,
    repository: options.repository,
    releaseTag: options.releaseTag,
    proposedSha: options.proposedSha,
    baselineRef: options.baselineRef,
    baselineLockBytes,
    candidateLockBytes,
    execution,
    githubEvent,
    workflowBytes,
    tagReference,
    annotatedTag,
    artifactManifest,
  });

  if (options.artifactDir) {
    writeActionPinProvenanceArtifactAtomic(options.artifactDir, {
      baselineLockBytes,
      candidateLockBytes,
      execution,
      githubEvent,
      workflowBytes,
      tagReference,
      annotatedTag,
      artifactManifest,
      report,
    });
  }
  return report;
}

async function main() {
  let options = {};
  let report;
  try {
    options = parseActionPinReviewArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    report = await runActionPinReview(options);
  } catch (error) {
    report = createActionPinProvenanceReport({
      action: options.action ?? null,
      repository: options.repository ?? null,
      releaseTag: options.releaseTag ?? null,
      proposedSha: options.proposedSha ?? null,
      ...executionForFailure(options),
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (options.reportFile) {
    try {
      writeActionPinProvenanceReportAtomic(options.reportFile, report);
    } catch (error) {
      report = createActionPinProvenanceReport({
        ...report,
        status: 'failed',
        error: `Could not write Action pin provenance report atomically: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  process.stdout.write(canonicalActionPinJson(report));
  if (!options.json && report.status !== 'passed') {
    process.stderr.write(`${report.error}\n`);
  }
  if (report.status !== 'passed') process.exitCode = 1;
}

function executionFromOptions(options) {
  return {
    sourceRepository: options.sourceRepository,
    sourceRef: options.sourceRef,
    sourceHeadSha: options.sourceHeadSha,
    workflowName: options.workflowName,
    workflowPath: options.workflowPath,
    workflowRef: options.workflowRef,
    workflowSha: options.workflowSha,
    runId: options.runId,
    runAttempt: Number(options.runAttempt),
  };
}

function executionForFailure(options) {
  const execution = executionFromOptions(options);
  return Object.fromEntries(
    Object.entries(execution).map(([field, value]) => [
      field,
      field === 'runAttempt' && !Number.isSafeInteger(value) ? null : value ?? null,
    ])
  );
}

function parseEventJson(bytes) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Could not parse GitHub workflow_dispatch event: ${error.message}`);
  }
}

function readSecureFile(filePath, label) {
  const stats = lstatSync(filePath);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${label} must be a regular file, not a symbolic link.`);
  }
  return readFileSync(realpathSync(filePath));
}

function requireValue(value, flag) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required ${flag}.`);
  }
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function usage() {
  return `Usage: pnpm review:action-pin -- --action <owner/repo[/path]> --repository <owner/repo> --release-tag <vN> --proposed-sha <40-char-sha> --baseline-ref <ref> --source-repository <owner/repo> --source-ref <refs/heads/name> --source-head-sha <40-char-sha> --workflow-name "Action Pin Review" --workflow-path .github/workflows/action-pin-review.yml --workflow-ref <owner/repo/path@ref> --workflow-sha <40-char-sha> --workflow-file <path> --run-id <id> --run-attempt <n> --event-name workflow_dispatch --github-event <path> --artifact-dir <path> --json\n\nOptions:\n  --baseline-lock <path>  Reviewed base-branch canonical lock; defaults to .github/actions-lock.json.\n  --candidate-lock <path>  Candidate canonical lock; defaults to .github/actions-lock.json.\n  --artifact-dir <path>    Atomically create the canonical provenance artifact directory.\n  --report-file <path>     Atomically write the canonical report separately.\n  --json                   Emit exactly one canonical JSON object to stdout.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}
