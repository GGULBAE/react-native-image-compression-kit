import {
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  RELEASE_EVIDENCE_CHECK_FIELDS,
  RELEASE_EVIDENCE_POLICIES,
  verifyReleaseEvidenceArchive,
} from './release-evidence-core.mjs';

export const RELEASE_EVIDENCE_SET_SCHEMA_VERSION = 1;
export const RELEASE_EVIDENCE_SET_RESULT_FIELDS = Object.freeze([
  'version',
  'status',
  'evidenceSha256',
  'sourceDigest',
  'checks',
  'error',
]);
export const RELEASE_EVIDENCE_SET_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'archiveRoot',
  'versions',
  'results',
  'error',
]);

export const DEFAULT_RELEASE_EVIDENCE_VERSIONS = Object.freeze(
  Object.keys(RELEASE_EVIDENCE_POLICIES).sort((left, right) =>
    left.localeCompare(right, 'en', { numeric: true })
  )
);

export function canonicalReleaseEvidenceSetReport(report) {
  return `${JSON.stringify(report)}\n`;
}

export function createReleaseEvidenceSetReport({
  archiveRoot = null,
  versions = [],
  results = [],
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: RELEASE_EVIDENCE_SET_SCHEMA_VERSION,
    status,
    archiveRoot,
    versions: [...versions],
    results: results.map((result) => ({
      version: result.version,
      status: result.status,
      evidenceSha256: result.evidenceSha256 ?? null,
      sourceDigest: result.sourceDigest ?? null,
      checks: Object.fromEntries(
        RELEASE_EVIDENCE_CHECK_FIELDS.map((field) => [
          field,
          result.checks?.[field] === true,
        ])
      ),
      error: result.error ?? null,
    })),
    error,
  };
}

export function verifyReleaseEvidenceSet(
  { archiveRoot, versions = DEFAULT_RELEASE_EVIDENCE_VERSIONS },
  dependencies = {}
) {
  const resolvedRoot = archiveRoot ? path.resolve(archiveRoot) : null;
  let selectedVersions = [];
  const results = [];

  try {
    assert(archiveRoot, 'Missing release evidence archive root.');
    assert(Array.isArray(versions), 'Release evidence versions must be an array.');
    assert(versions.length > 0, 'At least one release evidence version is required.');
    selectedVersions = [...versions];
    assert(
      new Set(selectedVersions).size === selectedVersions.length,
      'Release evidence versions must not contain duplicates.'
    );
    for (const version of selectedVersions) {
      assert(
        RELEASE_EVIDENCE_POLICIES[version],
        `No committed release evidence policy exists for version ${version}.`
      );
    }

    const verifyArchive =
      dependencies.verifyArchive ?? verifyReleaseEvidenceArchive;
    for (const version of selectedVersions) {
      const verification = verifyArchive({
        archiveDir: path.join(resolvedRoot, version),
        expectedVersion: version,
      });
      results.push({
        version,
        status: verification.status,
        evidenceSha256: verification.evidenceSha256,
        sourceDigest: verification.sourceDigest,
        checks: verification.checks,
        error: verification.error,
      });
    }
    const failed = results.filter((result) => result.status !== 'passed');
    assert(
      failed.length === 0,
      `Release evidence regression failed for: ${failed
        .map((result) => result.version)
        .join(', ')}.`
    );
    return createReleaseEvidenceSetReport({
      archiveRoot: resolvedRoot,
      versions: selectedVersions,
      results,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    return createReleaseEvidenceSetReport({
      archiveRoot: resolvedRoot,
      versions: selectedVersions,
      results,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function writeReleaseEvidenceSetReportAtomic(
  filePath,
  report,
  operations = {}
) {
  const mkdir = operations.mkdir ?? mkdirSync;
  const writeFile = operations.writeFile ?? writeFileSync;
  const rename = operations.rename ?? renameSync;
  const remove = operations.remove ?? rmSync;
  const destination = path.resolve(filePath);
  const directory = path.dirname(destination);
  const temporary = path.join(
    directory,
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`
  );

  mkdir(directory, { recursive: true });
  try {
    writeFile(temporary, canonicalReleaseEvidenceSetReport(report), {
      encoding: 'utf8',
      flag: 'wx',
    });
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { force: true });
    throw error;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
