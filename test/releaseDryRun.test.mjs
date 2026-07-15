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

const V050_CANDIDATE_SNIPPETS = [
  'Status: v0.2.50 candidate',
  'v0.2.50%20candidate',
  'Version `0.2.50` is an unpublished GitHub artifact attestation and offline identity verification candidate for `react-native-image-compression-kit`',
  'npm `latest` remains the published `0.2.48` release',
  'The candidate attests the canonical `bundle-manifest.json`',
  'on candidate implementation commit `5217c91555ac30bd3b6a2882f49600c386f8271d`',
  'The v0.2.50 candidate adds GitHub OIDC artifact attestation',
  'The repository package metadata is `0.2.50` for the unpublished GitHub artifact attestation and offline identity verification candidate',
  'included in the candidate pack tarball',
  'Version `0.2.50` is the unpublished GitHub artifact attestation and offline identity verification candidate.',
  'The v0.2.50 GitHub artifact attestation and offline identity verification candidate notes',
];

const V055_CANDIDATE_SNIPPETS = [
  'Status: v0.2.55 candidate',
  'v0.2.55%20candidate',
  'Version `0.2.55` is the unpublished Action Pin artifact GitHub OIDC attestation and offline signer verification candidate.',
  'npm `latest` remains `0.2.50`',
  'no npm publish, dist-tag change, git tag, or GitHub Release is part of this candidate',
  'The repository package metadata is `0.2.55` for the unpublished Action Pin artifact GitHub OIDC attestation and offline signer verification candidate.',
  'The v0.2.55 Action Pin artifact GitHub OIDC attestation and offline signer verification candidate notes',
];

const V056_CANDIDATE_SNIPPETS = [
  'Status: v0.2.56 candidate',
  'v0.2.56%20candidate',
  'Version `0.2.56` is the unpublished release evidence archive import automation and multi-version regression gate candidate.',
  'The repository package metadata is `0.2.56` for the unpublished release evidence archive import automation and multi-version regression gate candidate; npm `latest` remains v0.2.55.',
  'The v0.2.56 release evidence archive import automation and multi-version regression gate candidate notes',
];

const V057_CANDIDATE_SNIPPETS = [
  'Status: v0.2.57 candidate',
  'v0.2.57%20candidate',
  'Version `0.2.57` is the unpublished Registry Validation artifact acquisition and canonical metadata handoff candidate.',
  'The repository package metadata is `0.2.57` for the unpublished Registry Validation artifact acquisition and canonical metadata handoff candidate; npm `latest` remains v0.2.55.',
  'The v0.2.57 Registry Validation artifact acquisition and canonical metadata handoff candidate notes',
];

const V058_CANDIDATE_SNIPPETS = [
  'Status: v0.2.58 candidate',
  'v0.2.58%20candidate',
  'Version `0.2.58` is the unpublished release evidence policy candidate and reviewed promotion gate candidate.',
  'The repository package metadata is `0.2.58` for the unpublished release evidence policy candidate and reviewed promotion gate candidate; npm `latest` remains v0.2.55.',
  'The v0.2.58 release evidence policy candidate and reviewed promotion gate candidate notes',
];

const V059_CANDIDATE_SNIPPETS = [
  'Status: v0.2.59 candidate',
  'v0.2.59%20candidate',
  'Version `0.2.59` is the unpublished release evidence policy review receipt and manual promotion rehearsal candidate.',
  'The repository package metadata is `0.2.59` for the unpublished release evidence policy review receipt and manual promotion rehearsal candidate; npm `latest` remains v0.2.55.',
  'The v0.2.59 release evidence policy review receipt and manual promotion rehearsal candidate notes',
];

const V060_CANDIDATE_SNIPPETS = [
  'Status: v0.2.60 candidate',
  'v0.2.60%20candidate',
  'Version `0.2.60` is the unpublished release evidence review archive import and expiration-independent replay gate candidate.',
  'The repository package metadata is `0.2.60` for the unpublished release evidence review archive import and expiration-independent replay gate candidate; npm `latest` remains v0.2.55.',
  'The v0.2.60 release evidence review archive import and expiration-independent replay gate candidate notes',
];

const V061_CANDIDATE_SNIPPETS = [
  'Status: v0.2.61 candidate',
  'v0.2.61%20candidate',
  'Version `0.2.61` is the unpublished review artifact acquisition automation and canonical archive handoff candidate.',
  'The repository package metadata is `0.2.61` for the unpublished review artifact acquisition automation and canonical archive handoff candidate; npm `latest` remains v0.2.55.',
  'The v0.2.61 review artifact acquisition automation and canonical archive handoff candidate notes',
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

  it.each(V050_CANDIDATE_SNIPPETS)(
    'rejects the v0.2.50 candidate snippet %s',
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

  it('accepts registry-independent v0.2.50 release wording', () => {
    const packedReadme = [
      'Status: v0.2.50 release',
      'Version `0.2.50` is the GitHub artifact attestation and offline identity verification release.',
      'The `0.2.50` package metadata defines the provenance attestation release.',
    ].join('\n');

    expect(getPackedReadmeStatusViolations(packedReadme)).toEqual([]);
    expect(() => validatePackedReadmeStatus(packedReadme)).not.toThrow();
  });

  it.each(V055_CANDIDATE_SNIPPETS)(
    'rejects the v0.2.55 candidate snippet %s',
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

  it('accepts registry-independent v0.2.55 release wording', () => {
    const packedReadme = [
      'Status: v0.2.55 release',
      'Version `0.2.55` is the Action Pin artifact GitHub OIDC attestation and offline signer verification release.',
      'The `0.2.55` package metadata defines the Action Pin attestation release.',
    ].join('\n');

    expect(getPackedReadmeStatusViolations(packedReadme)).toEqual([]);
    expect(() => validatePackedReadmeStatus(packedReadme)).not.toThrow();
  });

  it.each(V056_CANDIDATE_SNIPPETS)(
    'rejects the v0.2.56 candidate snippet %s',
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

  it.each(V057_CANDIDATE_SNIPPETS)(
    'rejects the v0.2.57 candidate snippet %s',
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

  it.each(V058_CANDIDATE_SNIPPETS)(
    'rejects the v0.2.58 candidate snippet %s',
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

  it.each(V059_CANDIDATE_SNIPPETS)(
    'rejects the v0.2.59 candidate snippet %s',
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

  it.each(V060_CANDIDATE_SNIPPETS)(
    'rejects the v0.2.60 candidate snippet %s',
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

  it.each(V061_CANDIDATE_SNIPPETS)(
    'rejects the v0.2.61 candidate snippet %s',
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
});
