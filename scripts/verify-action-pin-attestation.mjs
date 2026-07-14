#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTION_PIN_ARTIFACT_MANIFEST_FILE,
  verifyActionPinProvenanceArtifact,
} from './action-pin-provenance-core.mjs';
import {
  canonicalActionPinAttestationReport,
  createActionPinAttestationReport,
  validateActionPinAttestationEvidence,
  writeActionPinAttestationReportAtomic,
} from './action-pin-attestation-core.mjs';
import {
  buildOfflineGitHubAttestationVerifyArgs,
  readSecureRegularFile,
  runOfflineGitHubAttestationVerify,
} from './github-attestation-cli.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export function parseActionPinAttestationArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--artifact-dir': 'artifactDir',
    '--attestation-bundle': 'attestationBundle',
    '--trusted-root': 'trustedRoot',
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

export function runActionPinAttestationVerification(options, dependencies = {}) {
  const verifyProvenance = dependencies.verifyProvenance ?? verifyActionPinProvenanceArtifact;
  const readSecure = dependencies.readSecure ?? readSecureRegularFile;
  const runGh = dependencies.runGh ?? runOfflineGitHubAttestationVerify;
  const artifactDir = options.artifactDir ? path.resolve(options.artifactDir) : null;
  const attestationBundle = options.attestationBundle
    ? path.resolve(options.attestationBundle)
    : null;
  const trustedRoot = options.trustedRoot
    ? path.resolve(options.trustedRoot)
    : attestationBundle
      ? path.join(path.dirname(attestationBundle), 'trusted-root.jsonl')
      : null;
  let provenanceReport;

  try {
    requireOption(artifactDir, '--artifact-dir');
    requireOption(attestationBundle, '--attestation-bundle');
    provenanceReport = verifyProvenance({ artifactDir });
    if (provenanceReport.status !== 'passed') {
      throw new Error(provenanceReport.error || 'Action pin provenance replay failed.');
    }
    const manifestPath = path.join(artifactDir, ACTION_PIN_ARTIFACT_MANIFEST_FILE);
    const manifestBytes = readSecure(manifestPath, 'Action pin artifact manifest');
    const attestationBytes = readSecure(attestationBundle, 'attestation bundle');
    const trustedRootBytes = readSecure(trustedRoot, 'trusted root');
    const expectedWorkflow = `${provenanceReport.sourceRepository}/${provenanceReport.workflowPath}`;
    const args = buildOfflineGitHubAttestationVerifyArgs({
      subjectPath: manifestPath,
      attestationBundle,
      trustedRoot,
      expectedRepository: provenanceReport.sourceRepository,
      expectedWorkflow,
      expectedRef: provenanceReport.sourceRef,
      expectedHeadSha: provenanceReport.sourceHeadSha,
    });
    const verificationOutput = runGh(args, { attestationBytes, trustedRootBytes });
    return validateActionPinAttestationEvidence({
      manifestPath,
      manifestBytes,
      trustedRootBytes,
      verificationOutput,
      provenanceReport,
      expectedTrustedRootSha256: dependencies.expectedTrustedRootSha256,
    });
  } catch (error) {
    return createActionPinAttestationReport({
      sourceRepository: provenanceReport?.sourceRepository ?? null,
      signerWorkflow: provenanceReport?.sourceRepository && provenanceReport?.workflowPath
        ? `${provenanceReport.sourceRepository}/${provenanceReport.workflowPath}`
        : null,
      sourceRef: provenanceReport?.sourceRef ?? null,
      sourceHeadSha: provenanceReport?.sourceHeadSha ?? null,
      workflowSha: provenanceReport?.workflowSha ?? null,
      runId: provenanceReport?.runId ?? null,
      runAttempt: provenanceReport?.runAttempt ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function main() {
  let options = {};
  let report;
  try {
    options = parseActionPinAttestationArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    report = runActionPinAttestationVerification(options);
  } catch (error) {
    report = createActionPinAttestationReport({
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (options.reportFile) {
    try {
      writeActionPinAttestationReportAtomic(options.reportFile, report);
    } catch (error) {
      report = createActionPinAttestationReport({
        ...report,
        status: 'failed',
        error: `Could not write Action pin attestation report atomically: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }
  process.stdout.write(canonicalActionPinAttestationReport(report));
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
  return `Usage: pnpm verify:action-pin-attestation -- --artifact-dir <path> --attestation-bundle <path> [options]\n\nOptions:\n  --artifact-dir <path>         Canonical Action pin provenance artifact directory.\n  --attestation-bundle <path>   Downloaded Sigstore bundle JSONL.\n  --trusted-root <path>         Pinned GitHub trusted-root JSONL (defaults beside bundle).\n  --report-file <path>          Atomically write the canonical verification report.\n  --json                        Emit exactly one canonical JSON object to stdout.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
