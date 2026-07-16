import { describe, expect, it } from 'vitest';
import {
  getPackedReadmeStatusViolations,
  validatePackedReadmeStatus,
} from '../scripts/release-dry-run.mjs';

function readmeWithStatus({
  packageVersion = '0.2.62',
  npmLatest = '0.2.55',
  releaseState = 'candidate',
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
    '<!-- package-status:end -->',
    after,
  ].join('\n');
}

describe('release dry-run packed README current-status guard', () => {
  it('rejects only the current v0.2.62 candidate block', () => {
    const packedReadme = readmeWithStatus({
      after: 'Historical note: Version `0.2.61` was a candidate.',
    });

    expect(getPackedReadmeStatusViolations(packedReadme)).toEqual([
      'current status declares package version 0.2.62 as candidate',
    ]);
    expect(() => validatePackedReadmeStatus(packedReadme)).toThrow(
      'current status declares package version 0.2.62 as candidate'
    );
  });

  it('ignores historical candidate prose outside a release current-status block', () => {
    const packedReadme = readmeWithStatus({
      releaseState: 'release',
      before: 'Status: v0.2.47 candidate',
      after:
        'The v0.2.61 review artifact acquisition automation candidate notes remain historical.',
    });

    expect(getPackedReadmeStatusViolations(packedReadme)).toEqual([]);
    expect(() => validatePackedReadmeStatus(packedReadme)).not.toThrow();
  });

  it('rejects a current-status version that differs from package metadata', () => {
    const packedReadme = readmeWithStatus({
      packageVersion: '0.2.61',
      releaseState: 'release',
    });

    expect(getPackedReadmeStatusViolations(packedReadme)).toEqual([
      'current status package version 0.2.61 does not match 0.2.62',
    ]);
  });

  it('rejects missing, duplicate, or malformed status fields', () => {
    const missingMarker = '# Package\nStatus: v0.2.62 candidate';
    const duplicateField = readmeWithStatus().replace(
      '- npm latest: `0.2.55`',
      '- npm latest: `0.2.55`\n- npm latest: `0.2.55`'
    );

    expect(() => validatePackedReadmeStatus(missingMarker)).toThrow(
      'exactly one ordered package-status marker block'
    );
    expect(() => validatePackedReadmeStatus(duplicateField)).toThrow(
      'exactly one npm latest field'
    );
  });
});
