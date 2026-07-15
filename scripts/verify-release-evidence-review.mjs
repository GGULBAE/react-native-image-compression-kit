#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalReleaseEvidenceReviewReceipt,
  createReleaseEvidenceReviewReceipt,
  verifyReleaseEvidenceReviewBundle,
  writeReleaseEvidenceReviewReceiptAtomic,
} from './release-evidence-review-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export function parseReleaseEvidenceReviewVerificationArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--artifact-dir': 'bundleDir',
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

export function runReleaseEvidenceReviewVerification(options, dependencies = {}) {
  return verifyReleaseEvidenceReviewBundle(
    {
      bundleDir: options.bundleDir,
      expectations: {
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
      },
    },
    dependencies
  );
}

function main() {
  let options = {};
  let receipt;
  try {
    options = parseReleaseEvidenceReviewVerificationArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    receipt = runReleaseEvidenceReviewVerification(options);
  } catch (error) {
    receipt = createReleaseEvidenceReviewReceipt({
      packageName: options.packageName ?? null,
      version: options.version ?? null,
      candidateSha256: options.candidateSha256 ?? null,
      reviewer: options.reviewer ?? null,
      repository: options.repository ?? null,
      workflow: options.workflow ?? null,
      reviewRunId: options.reviewRunId ?? null,
      reviewRunAttempt: options.reviewRunAttempt
        ? Number(options.reviewRunAttempt)
        : null,
      sourceRef: options.sourceRef ?? null,
      sourceDigest: options.sourceDigest ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (options.reportFile) {
    try {
      writeReleaseEvidenceReviewReceiptAtomic(options.reportFile, receipt);
    } catch (error) {
      receipt = createReleaseEvidenceReviewReceipt({
        packageName: receipt.package,
        version: receipt.version,
        candidateSha256: receipt.candidateSha256,
        reviewer: receipt.reviewer,
        reviewedAt: receipt.reviewedAt,
        repository: receipt.repository,
        workflow: receipt.workflow,
        workflowSha: receipt.workflowSha,
        reviewRunId: receipt.reviewRunId,
        reviewRunAttempt: receipt.reviewRunAttempt,
        sourceRef: receipt.sourceRef,
        sourceDigest: receipt.sourceDigest,
        acquisitionSha256: receipt.acquisitionSha256,
        evidenceSha256: receipt.evidenceSha256,
        promotionReportSha256: receipt.promotionReportSha256,
        setReportSha256: receipt.setReportSha256,
        error: `Could not write review verification report atomically: ${error.message}`,
      });
    }
  }
  process.stdout.write(canonicalReleaseEvidenceReviewReceipt(receipt));
  if (!options.json && receipt.status !== 'passed') process.stderr.write(`${receipt.error}\n`);
  if (receipt.status !== 'passed') process.exitCode = 1;
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}.`);
  return value;
}

function usage() {
  return `Usage: pnpm verify:release-evidence-review -- --artifact-dir <path> --expect-package <name> --expect-version <version> --expect-candidate-sha256 <sha256> --expect-reviewer <actor> --expect-repository <owner/repo> --expect-workflow <owner/repo/.github/workflows/file.yml> --expect-ref <refs/...> --expect-head-sha <sha> --expect-run-id <id> --expect-run-attempt <n>\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
