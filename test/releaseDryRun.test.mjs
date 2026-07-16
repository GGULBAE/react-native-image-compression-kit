import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RELEASE_STATUS_MANIFEST_PATH } from '../scripts/docs-semantic-core.mjs';
import {
  getPackedReadmeStatusViolations,
  validatePackedReadmeStatus,
} from '../scripts/release-dry-run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_VERSION = JSON.parse(
  readFileSync(path.join(ROOT, 'package.json'), 'utf8')
).version;
const MANIFEST = JSON.parse(
  readFileSync(path.join(ROOT, RELEASE_STATUS_MANIFEST_PATH), 'utf8')
);

function readmeWithStatus({
  packageVersion = PACKAGE_VERSION,
  npmLatest = MANIFEST.npmLatest,
  releaseState = MANIFEST.releaseState,
  registryCheckedAt = MANIFEST.registryCheckedAt,
  before = '',
  after = '',
} = {}) {
  return [
    '# Package',
    before,
    '<!-- package-status:start -->',
    '## Current status',
    `- Package version: \`${packageVersion}\``,
    `- npm latest: \`${npmLatest}\``,
    `- Release state: \`${releaseState}\``,
    `- Registry checked at: \`${registryCheckedAt}\``,
    '<!-- package-status:end -->',
    after,
  ].join('\n');
}

describe('release dry-run packed README current-status guard', () => {
  it('rejects only the current candidate block', () => {
    const packedReadme = readmeWithStatus({
      after: 'Historical note: a previous package was a candidate.',
    });

    expect(getPackedReadmeStatusViolations(packedReadme)).toEqual([
      `current status declares package version ${PACKAGE_VERSION} as candidate`,
    ]);
    expect(() => validatePackedReadmeStatus(packedReadme)).toThrow(
      `current status declares package version ${PACKAGE_VERSION} as candidate`
    );
  });

  it('allows a manifest-aligned release and ignores historical candidate prose', () => {
    const releaseManifest = { ...MANIFEST, releaseState: 'release' };
    const packedReadme = readmeWithStatus({
      releaseState: 'release',
      before: 'Status: an old version was a candidate',
      after: 'Historical review candidate notes remain archived.',
    });
    const options = { manifest: releaseManifest };

    expect(getPackedReadmeStatusViolations(packedReadme, options)).toEqual([]);
    expect(() => validatePackedReadmeStatus(packedReadme, options)).not.toThrow();
  });

  it('rejects package and manifest mismatches before evaluating publishability', () => {
    const otherVersion = '9.9.9';
    const packageMismatch = readmeWithStatus({ packageVersion: otherVersion });
    const statusMismatch = readmeWithStatus({ releaseState: 'release' });

    expect(getPackedReadmeStatusViolations(packageMismatch)).toEqual([
      `README: Package version expected "${PACKAGE_VERSION}" from package.json, received "${otherVersion}"`,
    ]);
    expect(getPackedReadmeStatusViolations(statusMismatch)).toEqual([
      'README: Release state expected "candidate" from docs/release-status.json, received "release"',
    ]);
  });

  it('rejects missing, duplicate, malformed, and incomplete status fields', () => {
    const missingMarker = '# Package\nHistorical candidate prose';
    const duplicateField = readmeWithStatus().replace(
      `- npm latest: \`${MANIFEST.npmLatest}\``,
      `- npm latest: \`${MANIFEST.npmLatest}\`\n- npm latest: \`${MANIFEST.npmLatest}\``
    );
    const invalidState = readmeWithStatus().replace(
      `- Release state: \`${MANIFEST.releaseState}\``,
      '- Release state: `published`'
    );
    const missingDate = readmeWithStatus().replace(
      `- Registry checked at: \`${MANIFEST.registryCheckedAt}\`\n`,
      ''
    );

    expect(() => validatePackedReadmeStatus(missingMarker)).toThrow(
      'README: expected exactly one ordered package-status marker block'
    );
    expect(() => validatePackedReadmeStatus(duplicateField)).toThrow(
      'README: expected exactly one npm latest field, received 2'
    );
    expect(() => validatePackedReadmeStatus(invalidState)).toThrow(
      'README: Release state expected "candidate" or "release", received "published"'
    );
    expect(() => validatePackedReadmeStatus(missingDate)).toThrow(
      'README: expected exactly one Registry checked at field, received 0'
    );
  });
});
