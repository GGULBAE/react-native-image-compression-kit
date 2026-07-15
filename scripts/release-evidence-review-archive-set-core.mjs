import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERIFICATION_CHECK_FIELDS,
  verifyReleaseEvidenceReviewArchive,
} from './release-evidence-review-archive-core.mjs';

export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'archiveRoot',
  'versions',
  'results',
  'error',
]);
export const RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_RESULT_FIELDS = Object.freeze([
  'version',
  'status',
  'archiveSha256',
  'reviewRunId',
  'sourceDigest',
  'checks',
  'error',
]);

export const DEFAULT_RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERSIONS = Object.freeze(
  Object.keys(RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES).sort(compareVersions)
);

export function canonicalReleaseEvidenceReviewArchiveSetReport(report) {
  return `${JSON.stringify(report)}\n`;
}

export function createReleaseEvidenceReviewArchiveSetReport({
  archiveRoot = null,
  versions = [],
  results = [],
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_SCHEMA_VERSION,
    status,
    archiveRoot,
    versions: [...versions],
    results: results.map((result) => ({
      version: result.version,
      status: result.status,
      archiveSha256: result.archiveSha256 ?? null,
      reviewRunId: result.reviewRunId ?? null,
      sourceDigest: result.sourceDigest ?? null,
      checks: Object.fromEntries(
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERIFICATION_CHECK_FIELDS.map(
          (field) => [field, result.checks?.[field] === true]
        )
      ),
      error: result.error ?? null,
    })),
    error,
  };
}

export function verifyReleaseEvidenceReviewArchiveSet(
  {
    archiveRoot,
    releaseArchiveRoot,
    versions = DEFAULT_RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERSIONS,
  } = {},
  dependencies = {}
) {
  const resolvedRoot = archiveRoot ? path.resolve(archiveRoot) : null;
  const resolvedReleaseRoot = releaseArchiveRoot
    ? path.resolve(releaseArchiveRoot)
    : null;
  let selectedVersions = [];
  const results = [];
  try {
    assert(archiveRoot, 'Missing review archive root.');
    assert(releaseArchiveRoot, 'Missing release evidence archive root.');
    assert(Array.isArray(versions), 'Review archive versions must be an array.');
    assert(versions.length > 0, 'At least one review archive version is required.');
    selectedVersions = [...versions];
    assert(
      new Set(selectedVersions).size === selectedVersions.length,
      'Review archive versions must not contain duplicates.'
    );
    for (const version of selectedVersions) {
      assert(
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES[version],
        `No committed review archive policy exists for version ${version}.`
      );
    }

    const verifyArchive =
      dependencies.verifyArchive ?? verifyReleaseEvidenceReviewArchive;
    for (const version of selectedVersions) {
      const verification = verifyArchive(
        {
          archiveDir: path.join(resolvedRoot, version),
          releaseArchiveRoot: resolvedReleaseRoot,
          expectedVersion: version,
        },
        dependencies.verifierDependencies ?? {}
      );
      results.push({
        version,
        status: verification.status,
        archiveSha256: verification.archiveSha256,
        reviewRunId: verification.reviewRunId,
        sourceDigest: verification.sourceDigest,
        checks: verification.checks,
        error: verification.error,
      });
    }
    const failed = results.filter((result) => result.status !== 'passed');
    assert(
      failed.length === 0,
      `Review archive regression failed for: ${failed
        .map((result) => result.version)
        .join(', ')}.`
    );
    return createReleaseEvidenceReviewArchiveSetReport({
      archiveRoot: resolvedRoot,
      versions: selectedVersions,
      results,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    return createReleaseEvidenceReviewArchiveSetReport({
      archiveRoot: resolvedRoot,
      versions: selectedVersions,
      results,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function writeReleaseEvidenceReviewArchiveSetReportAtomic(
  filePath,
  report,
  operations = {}
) {
  const mkdir = operations.mkdir ?? mkdirSync;
  const writeFile = operations.writeFile ?? writeFileSync;
  const rename = operations.rename ?? renameSync;
  const remove = operations.remove ?? rmSync;
  const destination = path.resolve(filePath);
  const temporary = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`
  );
  mkdir(path.dirname(destination), { recursive: true });
  try {
    writeFile(
      temporary,
      canonicalReleaseEvidenceReviewArchiveSetReport(report),
      { encoding: 'utf8', flag: 'wx' }
    );
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { force: true });
    throw error;
  }
}

function compareVersions(left, right) {
  return left.localeCompare(right, 'en', { numeric: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
