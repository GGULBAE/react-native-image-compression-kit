import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RELEASE_STATUS_MANIFEST_PATH } from '../scripts/docs-semantic-core.mjs';
import {
  getPackedReadmeStatusViolations,
  RELEASE_DRY_RUN_STEPS,
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
  releaseTarget = MANIFEST.releaseTarget,
  publishedNpmLatest = MANIFEST.publishedNpmLatest,
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
    `- Release target: \`${releaseTarget}\``,
    `- Published npm latest: \`${publishedNpmLatest}\``,
    `- Release state: \`${releaseState}\``,
    `- Registry checked at: \`${registryCheckedAt}\``,
    '<!-- package-status:end -->',
    after,
  ].join('\n');
}

describe('release dry-run packed README current-status guard', () => {
  it('runs the semantic release-readiness pipeline without a publish step', () => {
    expect(
      RELEASE_DRY_RUN_STEPS.map(({ name, command, args, run }) => ({
        name,
        invocation: run ? 'internal' : [command, ...(args ?? [])].join(' '),
      }))
    ).toEqual([
      { name: 'Verify package', invocation: 'pnpm verify' },
      { name: 'Typecheck example app', invocation: 'pnpm example:typecheck' },
      { name: 'Check diff whitespace', invocation: 'git diff --check' },
      { name: 'Inspect package tarball', invocation: 'pnpm pack --dry-run' },
      { name: 'Check packed README current status', invocation: 'internal' },
      { name: 'Run packed consumer smoke test', invocation: 'pnpm smoke:consumer' },
      {
        name: 'Run publish dry run',
        invocation: 'pnpm publish --dry-run --no-git-checks',
      },
    ]);
    expect(
      RELEASE_DRY_RUN_STEPS.some(
        ({ command, args }) => command === 'pnpm' && args?.[0] === 'publish' && !args.includes('--dry-run')
      )
    ).toBe(false);
  });

  it('rejects only the current candidate block', () => {
    const candidateManifest = { ...MANIFEST, releaseState: 'candidate' };
    const packedReadme = readmeWithStatus({
      releaseState: 'candidate',
      after: 'Historical note: a previous package was a candidate.',
    });
    const options = { manifest: candidateManifest };

    expect(getPackedReadmeStatusViolations(packedReadme, options)).toEqual([
      `current status declares release target ${PACKAGE_VERSION} as candidate`,
    ]);
    expect(() => validatePackedReadmeStatus(packedReadme, options)).toThrow(
      `current status declares release target ${PACKAGE_VERSION} as candidate`
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
    expect(releaseManifest.publishedNpmLatest).not.toBe(releaseManifest.releaseTarget);
  });

  it('rejects package and manifest mismatches before evaluating publishability', () => {
    const otherVersion = '9.9.9';
    const otherReleaseState =
      MANIFEST.releaseState === 'candidate' ? 'release' : 'candidate';
    const packageMismatch = readmeWithStatus({ packageVersion: otherVersion });
    const statusMismatch = readmeWithStatus({ releaseState: otherReleaseState });

    expect(getPackedReadmeStatusViolations(packageMismatch)).toEqual([
      `README: Package version expected "${PACKAGE_VERSION}" from package.json, received "${otherVersion}"`,
    ]);
    expect(getPackedReadmeStatusViolations(statusMismatch)).toEqual([
      `README: Release state expected "${MANIFEST.releaseState}" from docs/release-status.json, received "${otherReleaseState}"`,
    ]);
  });

  it('rejects missing, duplicate, malformed, and incomplete status fields', () => {
    const missingMarker = '# Package\nHistorical candidate prose';
    const duplicateField = readmeWithStatus().replace(
      `- Published npm latest: \`${MANIFEST.publishedNpmLatest}\``,
      `- Published npm latest: \`${MANIFEST.publishedNpmLatest}\`\n- Published npm latest: \`${MANIFEST.publishedNpmLatest}\``
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
      'README: expected exactly one Published npm latest field, received 2'
    );
    expect(() => validatePackedReadmeStatus(invalidState)).toThrow(
      'README: Release state expected "candidate" or "release", received "published"'
    );
    expect(() => validatePackedReadmeStatus(missingDate)).toThrow(
      'README: expected exactly one Registry checked at field, received 0'
    );
  });
});
