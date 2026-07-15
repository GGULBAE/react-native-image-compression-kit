#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGISTRY_BUNDLE_FILES } from './registry-provenance-core.mjs';
import {
  RELEASE_EVIDENCE_ATTESTATION_FILES,
  sha256,
} from './release-evidence-core.mjs';
import {
  acquireReleaseEvidenceBundle,
  canonicalReleaseEvidenceAcquisitionReport,
  createReleaseEvidenceAcquisitionReport,
  selectReleaseEvidenceArtifacts,
  validateReleaseEvidenceAcquisitionInputs,
  validateReleaseEvidenceRunResponse,
  writeReleaseEvidenceAcquisitionReportAtomic,
} from './release-evidence-acquisition-core.mjs';
import { createReleaseEvidenceGitHubClient } from './release-evidence-acquisition-github.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export function parseReleaseEvidenceAcquisitionArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--repository': 'repository',
    '--workflow': 'workflowPath',
    '--source-ref': 'sourceRef',
    '--source-digest': 'sourceDigest',
    '--run-id': 'runId',
    '--version': 'version',
    '--expected-tag': 'expectedTag',
    '--output-dir': 'outputDir',
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
  if (parsed.runId !== undefined) {
    parsed.runId = Number(parsed.runId);
  }
  return parsed;
}

export function runReleaseEvidenceAcquisition(options, dependencies = {}) {
  validateReleaseEvidenceAcquisitionInputs(options);
  if (options.reportFile) {
    const output = path.resolve(options.outputDir);
    const report = path.resolve(options.reportFile);
    if (report === output || report.startsWith(`${output}${path.sep}`)) {
      throw new Error(
        'Acquisition report file must be outside the canonical output directory.'
      );
    }
  }
  const github =
    dependencies.github ?? createReleaseEvidenceGitHubClient(dependencies);
  const runResponse = github.getRun(options);
  validateReleaseEvidenceRunResponse(runResponse, options);
  const artifactsResponse = github.listArtifacts(options);
  const selected = selectReleaseEvidenceArtifacts({
    artifactsResponse,
    version: options.version,
    runId: options.runId,
    sourceDigest: options.sourceDigest,
  });
  const provenance = github.downloadArtifact({
    ...options,
    artifactId: selected.provenance.id,
    expectedFiles: Object.values(REGISTRY_BUNDLE_FILES),
  });
  const attestation = github.downloadArtifact({
    ...options,
    artifactId: selected.attestation.id,
    expectedFiles: RELEASE_EVIDENCE_ATTESTATION_FILES,
  });
  const subjectSha256 = sha256(
    provenance.files.get(REGISTRY_BUNDLE_FILES.manifest)
  );
  const attestationsResponse = github.getAttestations({
    ...options,
    subjectSha256,
  });

  return acquireReleaseEvidenceBundle(
    {
      ...options,
      runResponse,
      artifactsResponse,
      attestationsResponse,
      artifactArchives: { provenance, attestation },
    },
    dependencies
  );
}

function main() {
  let options = {};
  let report;

  try {
    options = parseReleaseEvidenceAcquisitionArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    report = runReleaseEvidenceAcquisition(options);
  } catch (error) {
    report = createReleaseEvidenceAcquisitionReport({
      outputDir: options.outputDir ? path.resolve(options.outputDir) : null,
      version: options.version ?? null,
      expectedTag: options.expectedTag ?? null,
      repository: options.repository ?? null,
      runId: Number.isSafeInteger(options.runId) ? options.runId : null,
      sourceDigest: options.sourceDigest ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (options.reportFile) {
    try {
      writeReleaseEvidenceAcquisitionReportAtomic(options.reportFile, report);
    } catch (error) {
      report = createReleaseEvidenceAcquisitionReport({
        outputDir: report.outputDir,
        packageName: report.package,
        version: report.version,
        expectedTag: report.expectedTag,
        repository: report.repository,
        runId: report.runId,
        sourceDigest: report.sourceDigest,
        acquisitionSha256: report.acquisitionSha256,
        evidenceSha256: report.evidenceSha256,
        checks: report.checks,
        error: `Could not write acquisition report atomically: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  const canonical = canonicalReleaseEvidenceAcquisitionReport(report);
  if (options.json || report.status === 'passed') {
    process.stdout.write(canonical);
  } else {
    process.stderr.write(`${report.error}\n`);
    process.stdout.write(canonical);
  }
  if (report.status !== 'passed') process.exitCode = 1;
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function usage() {
  return `Usage: pnpm acquire:release-evidence -- --repository <owner/repo> --workflow <.github/workflows/file.yml> --source-ref <refs/heads/name> --source-digest <40-char-sha> --run-id <id> --version <version> --expected-tag <tag> --output-dir <path>\n\nOptions:\n  --repository <owner/repo>  Explicit source repository.\n  --workflow <path>         Explicit Registry Validation workflow path.\n  --source-ref <ref>        Explicit source ref.\n  --source-digest <sha>     Explicit source commit SHA.\n  --run-id <id>             Explicit successful Registry Validation run ID.\n  --version <version>       Explicit published package version.\n  --expected-tag <tag>      Explicit npm dist-tag expectation.\n  --output-dir <path>       Atomically create the canonical acquisition bundle.\n  --report-file <path>      Atomically write the same canonical report.\n  --json                    Emit exactly one canonical JSON object to stdout.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
