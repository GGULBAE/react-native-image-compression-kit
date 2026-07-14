import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  GITHUB_ACTIONS_OIDC_ISSUER,
  GITHUB_WORKFLOW_BUILD_TYPE,
  REGISTRY_ATTESTATION_REPORT_FIELDS,
  SLSA_PROVENANCE_V1,
  canonicalRegistryAttestationReport,
  sha256,
  validateRegistryAttestationEvidence,
  writeRegistryAttestationReportAtomic,
} from '../scripts/registry-attestation-core.mjs';
import {
  REGISTRY_BUNDLE_MANIFEST_FIELDS,
  canonicalBundleManifest,
} from '../scripts/registry-provenance-core.mjs';
import {
  buildGhAttestationVerifyArgs,
  parseRegistryAttestationArgs,
  runRegistryAttestationVerification,
} from '../scripts/verify-registry-attestation.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const REPOSITORY = 'GGULBAE/react-native-image-compression-kit';
const WORKFLOW = `${REPOSITORY}/.github/workflows/registry-validation.yml`;
const SOURCE_REF = 'refs/heads/master';
const HEAD_SHA = '4d909b8d170017399d4637712130c5e7beb0041e';
const SUBJECT = 'bundle-manifest.json';
const TRUSTED_ROOT = Buffer.from('fixture trusted root\n');
const TRUSTED_ROOT_SHA256 = sha256(TRUSTED_ROOT);

function manifestFixture() {
  const values = {
    schemaVersion: 1,
    status: 'passed',
    package: 'react-native-image-compression-kit',
    version: '0.2.48',
    expectedTag: 'latest',
    reportFile: 'registry-provenance.json',
    reportSha256: 'a'.repeat(64),
    stdoutFile: 'stdout.json',
    stdoutSha256: 'a'.repeat(64),
    tarballFile: 'package.tgz',
    tarballIntegrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
    tarballShasum: 'b'.repeat(40),
    fileCount: 51,
    packageSize: 66099,
    unpackedSize: 291340,
    error: null,
  };
  expect(Object.keys(values)).toEqual(REGISTRY_BUNDLE_MANIFEST_FIELDS);
  return Buffer.from(canonicalBundleManifest(values));
}

function verificationFixture() {
  const manifestBytes = manifestFixture();
  const subjectSha256 = sha256(manifestBytes);
  const signer = `https://github.com/${WORKFLOW}@${SOURCE_REF}`;
  return [
    {
      attestation: { mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json' },
      verificationResult: {
        mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
        signature: {
          certificate: {
            subjectAlternativeName: signer,
            issuer: GITHUB_ACTIONS_OIDC_ISSUER,
            githubWorkflowSHA: HEAD_SHA,
            githubWorkflowRepository: REPOSITORY,
            githubWorkflowRef: SOURCE_REF,
            buildSignerURI: signer,
            buildSignerDigest: HEAD_SHA,
            runnerEnvironment: 'github-hosted',
            sourceRepositoryURI: `https://github.com/${REPOSITORY}`,
            sourceRepositoryDigest: HEAD_SHA,
            sourceRepositoryRef: SOURCE_REF,
            buildConfigURI: signer,
            buildConfigDigest: HEAD_SHA,
          },
        },
        verifiedTimestamps: [
          {
            type: 'Tlog',
            uri: 'https://rekor.sigstore.dev',
            timestamp: '2026-07-12T15:22:51+09:00',
          },
        ],
        statement: {
          _type: 'https://in-toto.io/Statement/v1',
          subject: [
            {
              name: SUBJECT,
              digest: { sha256: subjectSha256 },
            },
          ],
          predicateType: SLSA_PROVENANCE_V1,
          predicate: {
            buildDefinition: {
              buildType: GITHUB_WORKFLOW_BUILD_TYPE,
              externalParameters: {
                workflow: {
                  path: '.github/workflows/registry-validation.yml',
                  ref: SOURCE_REF,
                  repository: `https://github.com/${REPOSITORY}`,
                },
              },
              internalParameters: {
                github: {
                  event_name: 'workflow_dispatch',
                  runner_environment: 'github-hosted',
                },
              },
              resolvedDependencies: [
                {
                  uri: `git+https://github.com/${REPOSITORY}@${SOURCE_REF}`,
                  digest: { gitCommit: HEAD_SHA },
                },
              ],
            },
            runDetails: {
              builder: { id: signer },
              metadata: {
                invocationId: 'https://github.com/example/actions/runs/1/attempts/1',
              },
            },
          },
        },
      },
    },
  ];
}

function validate(overrides = {}) {
  return validateRegistryAttestationEvidence({
    manifestPath: SUBJECT,
    manifestBytes: manifestFixture(),
    trustedRootBytes: TRUSTED_ROOT,
    verificationOutput: verificationFixture(),
    expectedRepository: REPOSITORY,
    expectedWorkflow: WORKFLOW,
    expectedRef: SOURCE_REF,
    expectedHeadSha: HEAD_SHA,
    expectedTrustedRootSha256: TRUSTED_ROOT_SHA256,
    ...overrides,
  });
}

describe('registry provenance attestation', () => {
  it('returns the fixed successful report with signed identity and timestamps', () => {
    const report = validate();

    expect(Object.keys(report)).toEqual(REGISTRY_ATTESTATION_REPORT_FIELDS);
    expect(report).toEqual({
      schemaVersion: 1,
      status: 'passed',
      subject: SUBJECT,
      subjectSha256: sha256(manifestFixture()),
      repository: REPOSITORY,
      signerWorkflow: WORKFLOW,
      sourceRef: SOURCE_REF,
      sourceDigest: HEAD_SHA,
      oidcIssuer: GITHUB_ACTIONS_OIDC_ISSUER,
      predicateType: SLSA_PROVENANCE_V1,
      verifiedTimestamps: [
        {
          type: 'Tlog',
          uri: 'https://rekor.sigstore.dev',
          timestamp: '2026-07-12T06:22:51.000Z',
        },
      ],
      error: null,
    });
  });

  it('parses the exact CLI policy options and builds the offline gh command', () => {
    const args = [
      '--manifest', 'registry-validation/bundle-manifest.json',
      '--attestation-bundle', 'registry-attestation/attestation.jsonl',
      '--expect-repository', REPOSITORY,
      '--expect-workflow', WORKFLOW,
      '--expect-ref', SOURCE_REF,
      '--expect-head-sha', HEAD_SHA,
      '--json',
      '--report-file', 'attestation-verification.json',
    ];
    const parsed = parseRegistryAttestationArgs(args);
    expect(parsed).toEqual({
      manifestPath: 'registry-validation/bundle-manifest.json',
      attestationBundle: 'registry-attestation/attestation.jsonl',
      expectedRepository: REPOSITORY,
      expectedWorkflow: WORKFLOW,
      expectedRef: SOURCE_REF,
      expectedHeadSha: HEAD_SHA,
      json: true,
      reportFile: 'attestation-verification.json',
    });

    const ghArgs = buildGhAttestationVerifyArgs({
      ...parsed,
      trustedRoot: 'registry-attestation/trusted-root.jsonl',
    });
    expect(ghArgs).toContain('--bundle');
    expect(ghArgs).toContain('--custom-trusted-root');
    expect(ghArgs).toContain('--signer-workflow');
    expect(ghArgs).toContain('--source-ref');
    expect(ghArgs).toContain('--source-digest');
    expect(ghArgs).toContain('--cert-oidc-issuer');
    expect(ghArgs).toContain('--deny-self-hosted-runners');
    expect(ghArgs).toContain('--format');
    expect(ghArgs).toContain('json');
  });

  it('rejects a subject digest mismatch', () => {
    const fixture = verificationFixture();
    fixture[0].verificationResult.statement.subject[0].digest.sha256 = '0'.repeat(64);
    const report = validate({ verificationOutput: fixture });
    expect(report.status).toBe('failed');
    expect(report.error).toContain('attestation subject SHA-256');
  });

  it('rejects a repository mismatch', () => {
    const fixture = verificationFixture();
    fixture[0].verificationResult.signature.certificate.sourceRepositoryURI =
      'https://github.com/other/repository';
    const report = validate({ verificationOutput: fixture });
    expect(report.status).toBe('failed');
    expect(report.error).toContain('source repository URI');
  });

  it('rejects a signer workflow mismatch', () => {
    const fixture = verificationFixture();
    fixture[0].verificationResult.signature.certificate.subjectAlternativeName =
      `https://github.com/${REPOSITORY}/.github/workflows/other.yml@${SOURCE_REF}`;
    const report = validate({ verificationOutput: fixture });
    expect(report.status).toBe('failed');
    expect(report.error).toContain('certificate signer workflow');
  });

  it('rejects source ref and head SHA mismatches', () => {
    for (const [field, value, message] of [
      ['sourceRepositoryRef', 'refs/heads/other', 'source repository ref'],
      ['sourceRepositoryDigest', '0'.repeat(40), 'source repository digest'],
    ]) {
      const fixture = verificationFixture();
      fixture[0].verificationResult.signature.certificate[field] = value;
      const report = validate({ verificationOutput: fixture });
      expect(report.status).toBe('failed');
      expect(report.error).toContain(message);
    }
  });

  it('rejects OIDC issuer and predicate type mismatches', () => {
    for (const [mutate, message] of [
      [
        (fixture) => {
          fixture[0].verificationResult.signature.certificate.issuer =
            'https://issuer.example.invalid';
        },
        'OIDC issuer',
      ],
      [
        (fixture) => {
          fixture[0].verificationResult.statement.predicateType =
            'https://example.invalid/predicate';
        },
        'predicate type',
      ],
    ]) {
      const fixture = verificationFixture();
      mutate(fixture);
      const report = validate({ verificationOutput: fixture });
      expect(report.status).toBe('failed');
      expect(report.error).toContain(message);
    }
  });

  it('rejects self-hosted runner evidence', () => {
    const fixture = verificationFixture();
    fixture[0].verificationResult.signature.certificate.runnerEnvironment =
      'self-hosted';
    fixture[0].verificationResult.statement.predicate.buildDefinition.internalParameters.github.runner_environment =
      'self-hosted';
    const report = validate({ verificationOutput: fixture });
    expect(report.status).toBe('failed');
    expect(report.error).toContain('runner environment');
  });

  it('rejects missing verified timestamps', () => {
    const fixture = verificationFixture();
    fixture[0].verificationResult.verifiedTimestamps = [];
    const report = validate({ verificationOutput: fixture });
    expect(report.status).toBe('failed');
    expect(report.error).toContain('verified timestamps');
  });

  it('rejects malformed verification JSON and multiple subjects', () => {
    const malformed = validate({ verificationOutput: '{not-json' });
    expect(malformed.status).toBe('failed');
    expect(malformed.error).toContain('Could not parse gh attestation');

    const fixture = verificationFixture();
    fixture[0].verificationResult.statement.subject.push({
      name: 'unexpected.txt',
      digest: { sha256: '0'.repeat(64) },
    });
    const multiple = validate({ verificationOutput: fixture });
    expect(multiple.status).toBe('failed');
    expect(multiple.error).toContain('exactly one subject');
  });

  it('rejects noncanonical manifest JSON and an unpinned trusted root', () => {
    const prettyManifest = Buffer.from(
      `${JSON.stringify(JSON.parse(manifestFixture()), null, 2)}\n`
    );
    expect(validate({ manifestBytes: prettyManifest }).error).toContain(
      'not canonical JSON'
    );
    expect(
      validate({ trustedRootBytes: Buffer.from('untrusted root') }).error
    ).toContain('Trusted root SHA-256');
  });

  it('separates gh execution and reports command failure without network', () => {
    const report = runRegistryAttestationVerification(
      {
        manifestPath: 'bundle-manifest.json',
        attestationBundle: 'attestation.jsonl',
        expectedRepository: REPOSITORY,
        expectedWorkflow: WORKFLOW,
        expectedRef: SOURCE_REF,
        expectedHeadSha: HEAD_SHA,
      },
      {
        readSecure(_filePath, label) {
          if (label === 'manifest') return manifestFixture();
          if (label === 'trusted root') return TRUSTED_ROOT;
          return Buffer.from('fixture attestation bundle\n');
        },
        runGh() {
          throw new Error('fixture gh command failure');
        },
        expectedTrustedRootSha256: TRUSTED_ROOT_SHA256,
      }
    );
    expect(report.status).toBe('failed');
    expect(report.error).toBe('fixture gh command failure');
  });

  it('uses injected offline gh output for a successful command path', () => {
    let capturedArgs;
    const report = runRegistryAttestationVerification(
      {
        manifestPath: 'bundle-manifest.json',
        attestationBundle: 'attestation.jsonl',
        expectedRepository: REPOSITORY,
        expectedWorkflow: WORKFLOW,
        expectedRef: SOURCE_REF,
        expectedHeadSha: HEAD_SHA,
      },
      {
        readSecure(_filePath, label) {
          if (label === 'manifest') return manifestFixture();
          if (label === 'trusted root') return TRUSTED_ROOT;
          return Buffer.from('fixture attestation bundle\n');
        },
        runGh(args) {
          capturedArgs = args;
          return JSON.stringify(verificationFixture());
        },
        expectedTrustedRootSha256: TRUSTED_ROOT_SHA256,
      }
    );
    expect(report.status).toBe('passed');
    expect(capturedArgs).toContain('--custom-trusted-root');
  });

  it('writes exactly one canonical verifier object atomically', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-attestation-report-'));
    const reportPath = path.join(parent, 'attestation-verification.json');
    const report = validate();
    try {
      writeRegistryAttestationReportAtomic(reportPath, report);
      const contents = readFileSync(reportPath, 'utf8');
      expect(contents).toBe(canonicalRegistryAttestationReport(report));
      expect(contents.trim().split('\n')).toHaveLength(1);

      writeFileSync(reportPath, 'previous-complete-report\n', 'utf8');
      expect(() =>
        writeRegistryAttestationReportAtomic(reportPath, report, {
          rename() {
            throw new Error('fixture rename failure');
          },
        })
      ).toThrow('fixture rename failure');
      expect(readFileSync(reportPath, 'utf8')).toBe('previous-complete-report\n');
      expect(readdirSync(parent)).toEqual(['attestation-verification.json']);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('pins the shared no-network gh invocation in source', () => {
    const source = readFileSync(
      path.join(ROOT, 'scripts', 'github-attestation-cli.mjs'),
      'utf8'
    );
    for (const snippet of [
      "'--bundle'",
      "'--custom-trusted-root'",
      "'--deny-self-hosted-runners'",
      "HTTP_PROXY: BLOCKED_PROXY",
      "HTTPS_PROXY: BLOCKED_PROXY",
      "ALL_PROXY: BLOCKED_PROXY",
      "NO_PROXY: ''",
    ]) {
      expect(source).toContain(snippet);
    }
    for (const forbidden of [
      "'attestation', 'download'",
      "'attestation', 'trusted-root'",
      'fetch(',
      'node:http',
      'node:https',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
