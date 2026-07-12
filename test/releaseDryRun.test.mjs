import { describe, expect, it } from 'vitest';
import {
  getPackedReadmeStatusViolations,
  validatePackedReadmeStatus,
} from '../scripts/release-dry-run.mjs';

const V047_CANDIDATE_SNIPPETS = [
  'Status: v0.2.47 candidate',
  'v0.2.47%20candidate',
  'Version `0.2.47` is an unpublished iOS PASS replay automation gate candidate for `react-native-image-compression-kit`.',
  'No npm publish, git tag, or GitHub Release is part of the v0.2.47 candidate.',
  'The `0.2.47` package metadata is prepared as an unpublished iOS PASS replay automation gate candidate for `react-native-image-compression-kit`',
  'Version `0.2.47` is the unpublished iOS PASS replay automation gate candidate.',
  'The v0.2.47 candidate fixes semantic PASS payload validation',
  'The current v0.2.47 iOS PASS replay automation gate candidate notes',
];

const V048_CANDIDATE_SNIPPETS = [
  'Status: v0.2.48 candidate',
  'v0.2.48%20candidate',
  'Version `0.2.48` is an unpublished registry provenance and manual CI gate candidate for `react-native-image-compression-kit`',
  'No npm publish, dist-tag change, git tag, or GitHub Release is part of this candidate.',
  'The repository is preparing `0.2.48` as an unpublished registry provenance and manual CI gate candidate.',
  'Version `0.2.48` is the unpublished registry provenance and manual CI gate candidate.',
  'The v0.2.48 candidate adds a canonical registry provenance report',
  'The v0.2.48 registry provenance and manual CI gate candidate notes',
];

describe('release dry-run packed README status guard', () => {
  it.each(V047_CANDIDATE_SNIPPETS)(
    'rejects the v0.2.47 candidate snippet %s',
    (candidateSnippet) => {
      const packedReadme = `# Package\n\n${candidateSnippet}\n`;

      expect(getPackedReadmeStatusViolations(packedReadme)).toContain(
        candidateSnippet
      );
      expect(() => validatePackedReadmeStatus(packedReadme)).toThrow(
        candidateSnippet
      );
    }
  );

  it('accepts registry-independent v0.2.47 release wording', () => {
    const packedReadme = [
      'Status: v0.2.47 release',
      'Version `0.2.47` is the iOS PASS replay automation gate release.',
      'The `0.2.47` package metadata defines the iOS PASS replay automation gate release.',
    ].join('\n');

    expect(getPackedReadmeStatusViolations(packedReadme)).toEqual([]);
    expect(() => validatePackedReadmeStatus(packedReadme)).not.toThrow();
  });

  it.each(V048_CANDIDATE_SNIPPETS)(
    'rejects the v0.2.48 candidate snippet %s',
    (candidateSnippet) => {
      const packedReadme = `# Package\n\n${candidateSnippet}\n`;

      expect(getPackedReadmeStatusViolations(packedReadme)).toContain(
        candidateSnippet
      );
      expect(() => validatePackedReadmeStatus(packedReadme)).toThrow(
        candidateSnippet
      );
    }
  );

  it('accepts registry-independent v0.2.48 release wording', () => {
    const packedReadme = [
      'Status: v0.2.48 release',
      'Version `0.2.48` is the registry provenance and manual CI gate release.',
      'The `0.2.48` package metadata defines the registry provenance release.',
    ].join('\n');

    expect(getPackedReadmeStatusViolations(packedReadme)).toEqual([]);
    expect(() => validatePackedReadmeStatus(packedReadme)).not.toThrow();
  });
});
