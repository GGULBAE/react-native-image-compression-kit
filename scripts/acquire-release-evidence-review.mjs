#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE,
} from './release-evidence-review-core.mjs';
import {
  acquireReleaseEvidenceReviewBundle,
  canonicalReleaseEvidenceReviewAcquisitionReport,
  createReleaseEvidenceReviewAcquisitionReport,
  selectReleaseEvidenceReviewArtifacts,
  validateReleaseEvidenceReviewAcquisitionInputs,
  validateReleaseEvidenceReviewRunResponse,
  writeReleaseEvidenceReviewAcquisitionReportAtomic,
} from './release-evidence-review-acquisition-core.mjs';
import { createReleaseEvidenceReviewGitHubClient } from './release-evidence-review-acquisition-github.mjs';
import { sha256 } from './release-evidence-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_RELEASE_ARCHIVE_ROOT = path.join(ROOT, 'evidence', 'npm');

export function parseReleaseEvidenceReviewAcquisitionArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--repository': 'repository',
    '--workflow': 'workflowPath',
    '--source-ref': 'sourceRef',
    '--source-digest': 'sourceDigest',
    '--run-id': 'runId',
    '--version': 'version',
    '--output-dir': 'outputDir',
    '--release-archive-root': 'releaseArchiveRoot',
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
  if (parsed.runId !== undefined) parsed.runId = Number(parsed.runId);
  return parsed;
}

export function runReleaseEvidenceReviewAcquisition(options, dependencies = {}) {
  const normalized = {
    ...options,
    releaseArchiveRoot: options.releaseArchiveRoot
      ? path.resolve(options.releaseArchiveRoot)
      : DEFAULT_RELEASE_ARCHIVE_ROOT,
    acquiredAt: options.acquiredAt ?? (dependencies.now ?? (() => new Date()))().toISOString(),
  };
  validateReleaseEvidenceReviewAcquisitionInputs(normalized);
  if (normalized.reportFile) {
    const output = path.resolve(normalized.outputDir);
    const report = path.resolve(normalized.reportFile);
    if (report === output || report.startsWith(`${output}${path.sep}`)) {
      throw new Error(
        'Acquisition report must be outside the canonical output directory.'
      );
    }
  }
  const github = dependencies.github ?? createReleaseEvidenceReviewGitHubClient(dependencies);
  const runResponse = github.getRun(normalized);
  const run = validateReleaseEvidenceReviewRunResponse(runResponse, normalized);
  const artifactsResponse = github.listArtifacts(normalized);
  const selected = selectReleaseEvidenceReviewArtifacts({
    artifactsResponse,
    version: normalized.version,
    run,
    sourceDigest: normalized.sourceDigest,
    acquiredAt: normalized.acquiredAt,
  });
  const review = github.downloadArtifact({
    ...normalized,
    artifactId: selected.review.id,
  });
  const attestation = github.downloadArtifact({
    ...normalized,
    artifactId: selected.attestation.id,
  });
  const subjectSha256 = sha256(
    review.files.get(RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE)
  );
  const attestationsResponse = github.getAttestations({
    ...normalized,
    subjectSha256,
    subjectBytes: review.files.get(RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE),
  });
  return acquireReleaseEvidenceReviewBundle(
    {
      ...normalized,
      runResponse,
      artifactsResponse,
      attestationsResponse,
      artifactArchives: { review, attestation },
    },
    dependencies
  );
}

function main() {
  let options = {};
  let report;
  let reportHandled = false;
  try {
    options = parseReleaseEvidenceReviewAcquisitionArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    report = runReleaseEvidenceReviewAcquisition(options);
    reportHandled = Boolean(options.reportFile);
  } catch (error) {
    report = createReleaseEvidenceReviewAcquisitionReport({
      outputDir: options.outputDir ? path.resolve(options.outputDir) : null,
      version: options.version ?? null,
      repository: options.repository ?? null,
      runId: Number.isSafeInteger(options.runId) ? options.runId : null,
      sourceDigest: options.sourceDigest ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (options.reportFile && !reportHandled) {
    try {
      writeReleaseEvidenceReviewAcquisitionReportAtomic(options.reportFile, report);
    } catch (error) {
      report = createReleaseEvidenceReviewAcquisitionReport({
        outputDir: report.outputDir,
        packageName: report.package,
        version: report.version,
        candidateSha256: report.candidateSha256,
        reviewer: report.reviewer,
        repository: report.repository,
        runId: report.runId,
        sourceDigest: report.sourceDigest,
        acquisitionSha256: report.acquisitionSha256,
        archiveSha256: report.archiveSha256,
        checks: report.checks,
        error: `Could not write acquisition report atomically: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }
  process.stdout.write(canonicalReleaseEvidenceReviewAcquisitionReport(report));
  if (!options.json && report.status !== 'passed') process.stderr.write(`${report.error}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}.`);
  return value;
}

function usage() {
  return `Usage: pnpm acquire:release-evidence-review -- --repository <owner/repo> --workflow <.github/workflows/file.yml> --source-ref <refs/heads/name> --source-digest <40-char-sha> --run-id <id> --version <version> --output-dir <path> [options]\n\nOptions:\n  --repository <owner/repo>       Explicit source repository.\n  --workflow <path>              Explicit policy review workflow path.\n  --source-ref <ref>             Explicit source ref.\n  --source-digest <sha>          Explicit source commit SHA.\n  --run-id <id>                  Explicit successful workflow_dispatch run ID.\n  --version <version>            Explicit reviewed evidence version.\n  --output-dir <path>            Atomically create the canonical acquisition bundle.\n  --release-archive-root <path>  Existing npm evidence used by importer handoff.\n  --report-file <path>           Atomically write bytes identical to stdout.\n  --json                         Emit exactly one canonical JSON object to stdout.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
