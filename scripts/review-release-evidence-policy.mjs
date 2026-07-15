#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalReleaseEvidenceReviewReceipt,
  createReleaseEvidenceReviewBundle,
  createReleaseEvidenceReviewEvent,
  createReleaseEvidenceReviewExecution,
  createReleaseEvidenceReviewReceipt,
} from './release-evidence-review-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export function parseReleaseEvidenceReviewArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--acquisition-dir': 'acquisitionDir',
    '--candidate-file': 'candidateFile',
    '--policy-report-file': 'policyReportFile',
    '--archive-root': 'archiveRoot',
    '--bundle-dir': 'bundleDir',
    '--report-file': 'reportFile',
    '--reviewed-candidate-sha256': 'reviewedCandidateSha256',
    '--review-repository': 'reviewRepository',
    '--review-source-ref': 'reviewSourceRef',
    '--review-source-digest': 'reviewSourceDigest',
    '--review-workflow-name': 'reviewWorkflowName',
    '--review-workflow-path': 'reviewWorkflowPath',
    '--review-workflow-ref': 'reviewWorkflowRef',
    '--review-workflow-sha': 'reviewWorkflowSha',
    '--review-run-id': 'reviewRunId',
    '--review-run-attempt': 'reviewRunAttempt',
    '--reviewer': 'reviewer',
    '--reviewed-at': 'reviewedAt',
    '--event-name': 'eventName',
    '--github-event': 'githubEvent',
    '--workflow-file': 'workflowFile',
    '--registry-repository': 'registryRepository',
    '--registry-workflow': 'registryWorkflow',
    '--registry-source-ref': 'registrySourceRef',
    '--registry-source-digest': 'registrySourceDigest',
    '--registry-run-id': 'registryRunId',
    '--version': 'version',
    '--expected-tag': 'expectedTag',
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

export function runReleaseEvidenceReview(options, dependencies = {}) {
  const execution = createReleaseEvidenceReviewExecution({
    repository: options.reviewRepository,
    sourceRef: options.reviewSourceRef,
    sourceDigest: options.reviewSourceDigest,
    workflowName: options.reviewWorkflowName,
    workflowPath: options.reviewWorkflowPath,
    workflowRef: options.reviewWorkflowRef,
    workflowSha: options.reviewWorkflowSha,
    reviewRunId: options.reviewRunId,
    reviewRunAttempt: options.reviewRunAttempt,
    reviewer: options.reviewer,
    reviewedAt: options.reviewedAt,
  });
  const request = {
    repository: options.registryRepository,
    workflow: options.registryWorkflow,
    sourceRef: options.registrySourceRef,
    sourceDigest: options.registrySourceDigest,
    registryValidationRunId: String(options.registryRunId ?? ''),
    version: options.version,
    expectedTag: options.expectedTag,
    reviewedCandidateSha256: options.reviewedCandidateSha256,
  };
  const eventBytes = (dependencies.readFile ?? readFileSync)(
    path.resolve(options.githubEvent)
  );
  const event = JSON.parse(eventBytes.toString('utf8'));
  const githubEvent = createReleaseEvidenceReviewEvent({
    eventName: options.eventName,
    event,
    execution,
    request,
  });
  return createReleaseEvidenceReviewBundle(
    {
      acquisitionDir: options.acquisitionDir,
      candidateFile: options.candidateFile,
      policyReportFile: options.policyReportFile,
      archiveRoot: options.archiveRoot,
      bundleDir: options.bundleDir,
      reportFile: options.reportFile,
      reviewedCandidateSha256: options.reviewedCandidateSha256,
      execution,
      githubEvent,
      workflowFile: options.workflowFile,
      request,
    },
    dependencies.core ?? {}
  );
}

function main() {
  let options = {};
  let receipt;
  try {
    options = parseReleaseEvidenceReviewArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    receipt = runReleaseEvidenceReview(options);
  } catch (error) {
    receipt = createReleaseEvidenceReviewReceipt({
      packageName: null,
      version: options.version ?? null,
      candidateSha256: options.reviewedCandidateSha256 ?? null,
      reviewer: options.reviewer ?? null,
      reviewedAt: options.reviewedAt ?? null,
      repository: options.reviewRepository ?? null,
      workflow:
        options.reviewRepository && options.reviewWorkflowPath
          ? `${options.reviewRepository}/${options.reviewWorkflowPath}`
          : null,
      workflowSha: options.reviewWorkflowSha ?? null,
      reviewRunId: options.reviewRunId ?? null,
      reviewRunAttempt: options.reviewRunAttempt
        ? Number(options.reviewRunAttempt)
        : null,
      sourceRef: options.reviewSourceRef ?? null,
      sourceDigest: options.reviewSourceDigest ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  process.stdout.write(canonicalReleaseEvidenceReviewReceipt(receipt));
  if (!options.json && receipt.status !== 'passed') {
    process.stderr.write(`${receipt.error}\n`);
  }
  if (receipt.status !== 'passed') process.exitCode = 1;
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}.`);
  return value;
}

function usage() {
  return `Usage: pnpm review:release-evidence-policy -- --acquisition-dir <path> --candidate-file <path> --policy-report-file <path> --archive-root <path> --bundle-dir <path> --reviewed-candidate-sha256 <sha256> [review identity and Registry Validation inputs]\n\nCreates one atomic, self-contained review bundle after replaying reviewed promotion in a temporary archive set. It never changes committed policy or evidence/npm.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
