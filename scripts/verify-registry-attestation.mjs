#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GITHUB_ACTIONS_OIDC_ISSUER,
  PINNED_GITHUB_TRUSTED_ROOT_SHA256,
  SLSA_PROVENANCE_V1,
  canonicalRegistryAttestationReport,
  createRegistryAttestationReport,
  sha256,
  validateRegistryAttestationEvidence,
  writeRegistryAttestationReportAtomic,
} from './registry-attestation-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const BLOCKED_PROXY = 'http://127.0.0.1:9';

export function parseRegistryAttestationArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--manifest': 'manifestPath',
    '--attestation-bundle': 'attestationBundle',
    '--trusted-root': 'trustedRoot',
    '--expect-repository': 'expectedRepository',
    '--expect-workflow': 'expectedWorkflow',
    '--expect-ref': 'expectedRef',
    '--expect-head-sha': 'expectedHeadSha',
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

export function buildGhAttestationVerifyArgs({
  manifestPath,
  attestationBundle,
  trustedRoot,
  expectedRepository,
  expectedWorkflow,
  expectedRef,
  expectedHeadSha,
}) {
  return [
    'attestation',
    'verify',
    path.resolve(manifestPath),
    '--bundle',
    path.resolve(attestationBundle),
    '--custom-trusted-root',
    path.resolve(trustedRoot),
    '--repo',
    expectedRepository,
    '--signer-workflow',
    expectedWorkflow,
    '--source-ref',
    expectedRef,
    '--source-digest',
    expectedHeadSha,
    '--cert-oidc-issuer',
    GITHUB_ACTIONS_OIDC_ISSUER,
    '--predicate-type',
    SLSA_PROVENANCE_V1,
    '--deny-self-hosted-runners',
    '--format',
    'json',
  ];
}

export function runRegistryAttestationVerification(options, dependencies = {}) {
  const readSecure = dependencies.readSecure ?? readSecureRegularFile;
  const runGh = dependencies.runGh ?? runGhAttestationVerify;
  const manifestPath = options.manifestPath
    ? path.resolve(options.manifestPath)
    : null;
  const attestationBundle = options.attestationBundle
    ? path.resolve(options.attestationBundle)
    : null;
  const trustedRoot = options.trustedRoot
    ? path.resolve(options.trustedRoot)
    : attestationBundle
      ? path.join(path.dirname(attestationBundle), 'trusted-root.jsonl')
      : null;
  const reportState = {
    subject: manifestPath ? path.basename(manifestPath) : null,
    subjectSha256: null,
    repository: options.expectedRepository ?? null,
    signerWorkflow: options.expectedWorkflow ?? null,
    sourceRef: options.expectedRef ?? null,
    sourceDigest: options.expectedHeadSha ?? null,
  };

  try {
    requireOption(manifestPath, '--manifest');
    requireOption(attestationBundle, '--attestation-bundle');
    requireOption(options.expectedRepository, '--expect-repository');
    requireOption(options.expectedWorkflow, '--expect-workflow');
    requireOption(options.expectedRef, '--expect-ref');
    requireOption(options.expectedHeadSha, '--expect-head-sha');

    const manifestBytes = readSecure(manifestPath, 'manifest');
    reportState.subjectSha256 = sha256(manifestBytes);
    const attestationBytes = readSecure(
      attestationBundle,
      'attestation bundle'
    );
    const trustedRootBytes = readSecure(trustedRoot, 'trusted root');
    const ghOptions = {
      manifestPath,
      attestationBundle,
      trustedRoot,
      expectedRepository: options.expectedRepository,
      expectedWorkflow: options.expectedWorkflow,
      expectedRef: options.expectedRef,
      expectedHeadSha: options.expectedHeadSha,
    };
    const verificationOutput = runGh(
      buildGhAttestationVerifyArgs(ghOptions),
      { attestationBytes, trustedRootBytes }
    );
    return validateRegistryAttestationEvidence({
      manifestPath,
      manifestBytes,
      trustedRootBytes,
      verificationOutput,
      expectedRepository: options.expectedRepository,
      expectedWorkflow: options.expectedWorkflow,
      expectedRef: options.expectedRef,
      expectedHeadSha: options.expectedHeadSha,
      expectedTrustedRootSha256:
        dependencies.expectedTrustedRootSha256 ??
        PINNED_GITHUB_TRUSTED_ROOT_SHA256,
    });
  } catch (error) {
    return createRegistryAttestationReport({
      ...reportState,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function main() {
  let options = {};
  let report;

  try {
    options = parseRegistryAttestationArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    report = runRegistryAttestationVerification(options);
  } catch (error) {
    report = createRegistryAttestationReport({
      subject: options.manifestPath
        ? path.basename(options.manifestPath)
        : null,
      repository: options.expectedRepository ?? null,
      signerWorkflow: options.expectedWorkflow ?? null,
      sourceRef: options.expectedRef ?? null,
      sourceDigest: options.expectedHeadSha ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (options.reportFile) {
    try {
      writeRegistryAttestationReportAtomic(options.reportFile, report);
    } catch (error) {
      report = createRegistryAttestationReport({
        subject: report.subject,
        subjectSha256: report.subjectSha256,
        repository: report.repository,
        signerWorkflow: report.signerWorkflow,
        sourceRef: report.sourceRef,
        sourceDigest: report.sourceDigest,
        oidcIssuer: report.oidcIssuer,
        predicateType: report.predicateType,
        verifiedTimestamps: report.verifiedTimestamps,
        error: `Could not write attestation verification report atomically: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  const canonical = canonicalRegistryAttestationReport(report);
  if (options.json || report.status === 'passed') {
    process.stdout.write(canonical);
  } else {
    process.stderr.write(`${report.error}\n`);
    process.stdout.write(canonical);
  }
  if (report.status !== 'passed') process.exitCode = 1;
}

function runGhAttestationVerify(args) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      HTTP_PROXY: BLOCKED_PROXY,
      HTTPS_PROXY: BLOCKED_PROXY,
      ALL_PROXY: BLOCKED_PROXY,
      NO_PROXY: '',
      GH_PROMPT_DISABLED: '1',
      GH_NO_UPDATE_NOTIFIER: '1',
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `gh attestation verify failed (${result.status ?? 1}): ${(
        result.stderr || result.stdout || ''
      ).trim()}`
    );
  }
  return result.stdout;
}

function readSecureRegularFile(filePath, label) {
  const stats = lstatSync(filePath);
  if (stats.isSymbolicLink()) {
    throw new Error(`${label} must not be a symbolic link.`);
  }
  if (!stats.isFile()) {
    throw new Error(`${label} must be a regular file.`);
  }
  return readFileSync(realpathSync(filePath));
}

function requireOption(value, flag) {
  if (!value) throw new Error(`Missing ${flag}.`);
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function usage() {
  return `Usage: pnpm verify:registry-attestation -- --manifest <bundle-manifest.json> --attestation-bundle <attestation.jsonl> --expect-repository <owner/repo> --expect-workflow <owner/repo/.github/workflows/file.yml> --expect-ref <refs/...> --expect-head-sha <sha>\n\nOptions:\n  --manifest <path>             Canonical provenance bundle manifest to verify.\n  --attestation-bundle <path>   Downloaded Sigstore attestation JSONL.\n  --trusted-root <path>         Pinned trusted_root.jsonl; defaults beside the attestation bundle.\n  --expect-repository <value>   Require the source repository identity.\n  --expect-workflow <value>     Require the exact signer workflow path.\n  --expect-ref <value>          Require the exact source ref.\n  --expect-head-sha <value>     Require the exact source Git commit.\n  --json                        Emit exactly one canonical JSON object to stdout.\n  --report-file <path>          Atomically write the same canonical JSON report.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
