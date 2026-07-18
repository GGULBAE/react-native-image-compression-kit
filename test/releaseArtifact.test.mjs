import { describe, expect, it } from 'vitest';
import {
  inspectNpmAttestations,
  inspectPublicationState,
  inspectReleaseArtifact,
  normalizeNpmViewPublicationState,
} from '../scripts/release-artifact-core.mjs';

const validArtifact = {
  expectedVersion: '0.3.0',
  packageVersion: '0.3.0',
  tarballPackageVersion: '0.3.0',
  expectedSourceSha: 'a'.repeat(40),
  actualSourceSha: 'a'.repeat(40),
  sourceBranch: 'master',
  releaseState: 'release',
  npmLatest: '0.3.0',
  tarballFile: 'react-native-image-compression-kit-0.3.0.tgz',
  tarballSize: 1024,
  tarballSha256: 'b'.repeat(64),
  tarballIntegrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
  inventory: [
    'package/package.json',
    'package/README.md',
    'package/CHANGELOG.md',
    'package/SECURITY.md',
    'package/LICENSE',
    'package/lib/index.js',
    'package/lib/index.d.ts',
    'package/react-native-image-compression-kit.podspec',
  ],
  worktreeClean: true,
};

describe('release artifact contract', () => {
  it('accepts one exact release-state tarball from master', () => {
    expect(inspectReleaseArtifact(validArtifact)).toMatchObject({
      status: 'passed',
      version: '0.3.0',
      sourceSha: 'a'.repeat(40),
      error: null,
    });
  });

  it.each([
    ['wrong version', { packageVersion: '0.3.1' }, 'package version'],
    ['wrong source', { actualSourceSha: 'c'.repeat(40) }, 'checked-out source'],
    ['candidate', { releaseState: 'candidate' }, 'release state'],
    ['stale latest', { npmLatest: '0.2.62' }, 'release-ready npm latest'],
    ['wrong branch', { sourceBranch: 'feature' }, 'source branch'],
    ['dirty source', { worktreeClean: false }, 'worktree must be clean'],
    [
      'forbidden path',
      { inventory: [...validArtifact.inventory, 'package/website/index.md'] },
      'forbidden paths',
    ],
  ])('rejects %s', (_label, mutation, message) => {
    const report = inspectReleaseArtifact({ ...validArtifact, ...mutation });
    expect(report.status).toBe('failed');
    expect(report.error).toContain(message);
  });

  it('publishes an absent version and resumes only an identical registry artifact', () => {
    const absent = inspectPublicationState({
      expectedVersion: '0.3.0',
      artifactIntegrity: validArtifact.tarballIntegrity,
    });
    expect(absent).toMatchObject({ status: 'passed', action: 'publish' });

    const resume = inspectPublicationState({
      expectedVersion: '0.3.0',
      artifactIntegrity: validArtifact.tarballIntegrity,
      registryVersion: '0.3.0',
      registryIntegrity: validArtifact.tarballIntegrity,
    });
    expect(resume).toMatchObject({ status: 'passed', action: 'resume' });

    const mismatch = inspectPublicationState({
      expectedVersion: '0.3.0',
      artifactIntegrity: validArtifact.tarballIntegrity,
      registryVersion: '0.3.0',
      registryIntegrity: 'sha512-mismatch',
    });
    expect(mismatch).toMatchObject({ status: 'failed', action: 'blocked' });
  });

  it('normalizes npm 11 object and npm 12 single-item array publication output', () => {
    const publication = {
      version: '0.3.0',
      'dist.integrity': validArtifact.tarballIntegrity,
    };
    const expected = {
      exists: true,
      version: '0.3.0',
      integrity: validArtifact.tarballIntegrity,
    };

    expect(normalizeNpmViewPublicationState(publication)).toEqual(expected);
    expect(normalizeNpmViewPublicationState([publication])).toEqual(expected);
  });

  it('rejects ambiguous or incomplete npm publication output', () => {
    const publication = {
      version: '0.3.0',
      'dist.integrity': validArtifact.tarballIntegrity,
    };

    expect(() => normalizeNpmViewPublicationState([])).toThrow('exactly one publication');
    expect(() => normalizeNpmViewPublicationState([publication, publication])).toThrow(
      'exactly one publication'
    );
    expect(() => normalizeNpmViewPublicationState({ version: '0.3.0' })).toThrow(
      'SHA-512 SRI'
    );
  });

  it('requires exact npm SLSA provenance metadata', () => {
    const attestation = {
      url: 'https://registry.npmjs.org/-/npm/v1/attestations/react-native-image-compression-kit@0.3.0',
      provenance: { predicateType: 'https://slsa.dev/provenance/v1' },
    };
    const identity = {
      packageName: 'react-native-image-compression-kit',
      version: '0.3.0',
    };

    expect(inspectNpmAttestations(attestation, identity)).toMatchObject({ status: 'passed' });
    expect(inspectNpmAttestations([attestation], identity)).toMatchObject({ status: 'passed' });
    expect(inspectNpmAttestations([], identity)).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('exactly one attestation'),
    });
  });
});
