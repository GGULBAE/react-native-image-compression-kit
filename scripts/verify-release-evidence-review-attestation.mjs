#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE,
  verifyReleaseEvidenceReviewBundle,
} from './release-evidence-review-core.mjs';
import {
  canonicalReleaseEvidenceReviewAttestationReport,
  createReleaseEvidenceReviewAttestationReport,
  validateReleaseEvidenceReviewAttestationEvidence,
  writeReleaseEvidenceReviewAttestationReportAtomic,
} from './release-evidence-review-attestation-core.mjs';
import {
  buildOfflineGitHubAttestationVerifyArgs,
  readSecureRegularFile,
  runOfflineGitHubAttestationVerify,
} from './github-attestation-cli.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export function parseReleaseEvidenceReviewAttestationArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--artifact-dir': 'bundleDir',
    '--attestation-bundle': 'attestationBundle',
    '--trusted-root': 'trustedRoot',
    '--expect-package': 'packageName',
    '--expect-version': 'version',
    '--expect-candidate-sha256': 'candidateSha256',
    '--expect-reviewer': 'reviewer',
    '--expect-repository': 'repository',
    '--expect-workflow': 'workflow',
    '--expect-ref': 'sourceRef',
    '--expect-head-sha': 'sourceDigest',
    '--expect-run-id': 'reviewRunId',
    '--expect-run-attempt': 'reviewRunAttempt',
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

export function runReleaseEvidenceReviewAttestationVerification(
  options,
  dependencies = {}
) {
  const readSecure = dependencies.readSecure ?? readSecureRegularFile;
  const runGh = dependencies.runGh ?? runOfflineGitHubAttestationVerify;
  const bundleDir = options.bundleDir ? path.resolve(options.bundleDir) : null;
  const attestationBundle = options.attestationBundle
    ? path.resolve(options.attestationBundle)
    : null;
  const trustedRoot = options.trustedRoot
    ? path.resolve(options.trustedRoot)
    : attestationBundle
      ? path.join(path.dirname(attestationBundle), 'trusted-root.jsonl')
      : null;
  let reviewReceipt;
  try {
    requireOption(bundleDir, '--artifact-dir');
    requireOption(attestationBundle, '--attestation-bundle');
    const expectations = {
      packageName: options.packageName,
      version: options.version,
      candidateSha256: options.candidateSha256,
      reviewer: options.reviewer,
      repository: options.repository,
      workflow: options.workflow,
      sourceRef: options.sourceRef,
      sourceDigest: options.sourceDigest,
      reviewRunId: String(options.reviewRunId ?? ''),
      reviewRunAttempt: Number(options.reviewRunAttempt),
    };
    reviewReceipt = (dependencies.verifyReview ?? verifyReleaseEvidenceReviewBundle)(
      { bundleDir, expectations }
    );
    if (reviewReceipt.status !== 'passed') {
      throw new Error(reviewReceipt.error || 'Release evidence review replay failed.');
    }
    const manifestPath = path.join(bundleDir, RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE);
    const manifestBytes = readSecure(manifestPath, 'review artifact manifest');
    const attestationBytes = readSecure(attestationBundle, 'attestation bundle');
    const trustedRootBytes = readSecure(trustedRoot, 'trusted root');
    const args = buildOfflineGitHubAttestationVerifyArgs({
      subjectPath: manifestPath,
      attestationBundle,
      trustedRoot,
      expectedRepository: reviewReceipt.repository,
      expectedWorkflow: reviewReceipt.workflow,
      expectedRef: reviewReceipt.sourceRef,
      expectedHeadSha: reviewReceipt.sourceDigest,
    });
    const verificationOutput = runGh(args, { attestationBytes, trustedRootBytes });
    return validateReleaseEvidenceReviewAttestationEvidence({
      manifestPath,
      manifestBytes,
      trustedRootBytes,
      verificationOutput,
      reviewReceipt,
      expectedTrustedRootSha256: dependencies.expectedTrustedRootSha256,
    });
  } catch (error) {
    return createReleaseEvidenceReviewAttestationReport({
      repository: reviewReceipt?.repository ?? options.repository ?? null,
      signerWorkflow: reviewReceipt?.workflow ?? options.workflow ?? null,
      sourceRef: reviewReceipt?.sourceRef ?? options.sourceRef ?? null,
      sourceDigest: reviewReceipt?.sourceDigest ?? options.sourceDigest ?? null,
      workflowSha: reviewReceipt?.workflowSha ?? null,
      reviewRunId: reviewReceipt?.reviewRunId ?? options.reviewRunId ?? null,
      reviewRunAttempt:
        reviewReceipt?.reviewRunAttempt ??
        (options.reviewRunAttempt ? Number(options.reviewRunAttempt) : null),
      reviewer: reviewReceipt?.reviewer ?? options.reviewer ?? null,
      candidateSha256:
        reviewReceipt?.candidateSha256 ?? options.candidateSha256 ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function main() {
  let options = {};
  let report;
  try {
    options = parseReleaseEvidenceReviewAttestationArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    report = runReleaseEvidenceReviewAttestationVerification(options);
  } catch (error) {
    report = createReleaseEvidenceReviewAttestationReport({
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (options.reportFile) {
    try {
      writeReleaseEvidenceReviewAttestationReportAtomic(options.reportFile, report);
    } catch (error) {
      report = createReleaseEvidenceReviewAttestationReport({
        ...report,
        status: 'failed',
        error: `Could not write review attestation report atomically: ${error.message}`,
      });
    }
  }
  process.stdout.write(canonicalReleaseEvidenceReviewAttestationReport(report));
  if (!options.json && report.status !== 'passed') process.stderr.write(`${report.error}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

function requireOption(value, flag) {
  if (!value) throw new Error(`Missing ${flag}.`);
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}.`);
  return value;
}

function usage() {
  return `Usage: pnpm verify:release-evidence-review-attestation -- --artifact-dir <path> --attestation-bundle <path> [explicit review expectations]\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
