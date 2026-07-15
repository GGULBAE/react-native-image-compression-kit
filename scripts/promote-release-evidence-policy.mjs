#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalReleaseEvidencePolicyPromotion,
  createReleaseEvidencePolicyPromotionReport,
  promoteReleaseEvidencePolicyCandidate,
  writeReleaseEvidencePolicyPromotionAtomic,
} from './release-evidence-policy-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export function parseReleaseEvidencePolicyPromotionArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--acquisition-dir': 'acquisitionDir',
    '--candidate-file': 'candidateFile',
    '--version': 'expectedVersion',
    '--reviewed-candidate-sha256': 'reviewedCandidateSha256',
    '--reviewer': 'reviewer',
    '--reviewed-at': 'reviewedAt',
    '--archive-root': 'archiveRoot',
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
    if (arg === '--approve') {
      parsed.approved = true;
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

function main() {
  let options = {};
  let report;

  try {
    options = parseReleaseEvidencePolicyPromotionArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    assertReportOutsideArchive(options);
    report = promoteReleaseEvidencePolicyCandidate(options);
  } catch (error) {
    report = createReleaseEvidencePolicyPromotionReport({
      archiveDir:
        options.archiveRoot && options.expectedVersion
          ? path.resolve(options.archiveRoot, options.expectedVersion)
          : null,
      version: options.expectedVersion ?? null,
      reviewer: options.reviewer ?? null,
      reviewedAt: options.reviewedAt ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (options.reportFile) {
    try {
      writeReleaseEvidencePolicyPromotionAtomic(options.reportFile, report);
    } catch (error) {
      report = createReleaseEvidencePolicyPromotionReport({
        archiveDir: report.archiveDir,
        packageName: report.package,
        version: report.version,
        candidateSha256: report.candidateSha256,
        reviewer: report.reviewer,
        reviewedAt: report.reviewedAt,
        evidenceSha256: report.evidenceSha256,
        setVersions: report.setVersions,
        checks: report.checks,
        error: `Could not write policy promotion report atomically: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  process.stdout.write(canonicalReleaseEvidencePolicyPromotion(report));
  if (!options.json && report.status !== 'passed') {
    process.stderr.write(`${report.error}\n`);
  }
  if (report.status !== 'passed') process.exitCode = 1;
}

function assertReportOutsideArchive(options) {
  if (!options.reportFile || !options.archiveRoot || !options.expectedVersion) {
    return;
  }
  const archive = path.resolve(options.archiveRoot, options.expectedVersion);
  const report = path.resolve(options.reportFile);
  if (report === archive || report.startsWith(`${archive}${path.sep}`)) {
    throw new Error('Promotion report must be outside the version archive.');
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
  return `Usage: pnpm promote:release-evidence-policy -- --acquisition-dir <path> --candidate-file <candidate.json> --version <version> --reviewed-candidate-sha256 <sha256> --reviewer <identity> --reviewed-at <UTC-ISO> --archive-root <path> --approve\n\nOptions:\n  --acquisition-dir <path>           Canonical acquisition bundle used by the candidate.\n  --candidate-file <path>            Reviewed canonical policy candidate.\n  --version <version>                 Explicit version to promote.\n  --reviewed-candidate-sha256 <hex>   Exact reviewed candidate byte digest.\n  --reviewer <identity>               Explicit reviewer identity recorded in the report.\n  --reviewed-at <UTC-ISO>             Explicit canonical review timestamp.\n  --archive-root <path>               Existing release evidence set root.\n  --approve                           Required explicit promotion approval.\n  --report-file <path>                Atomically write the canonical promotion report.\n  --json                              Emit exactly one canonical JSON object to stdout.\n\nPromotion requires the reviewed candidate to equal the committed policy. There is no --apply mode for policy source changes.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
