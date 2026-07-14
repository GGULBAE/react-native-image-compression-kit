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
  ACTION_PIN_ARTIFACT_MANIFEST_FILE,
  verifyActionPinProvenanceArtifact,
} from '../scripts/action-pin-provenance-core.mjs';
import {
  ACTION_PIN_ATTESTATION_REPORT_FIELDS,
  canonicalActionPinAttestationReport,
  validateActionPinAttestationEvidence,
  writeActionPinAttestationReportAtomic,
} from '../scripts/action-pin-attestation-core.mjs';
import {
  GITHUB_ACTIONS_OIDC_ISSUER,
  GITHUB_WORKFLOW_BUILD_TYPE,
  SLSA_PROVENANCE_V1,
  sha256,
} from '../scripts/registry-attestation-core.mjs';
import {
  parseActionPinAttestationArgs,
  runActionPinAttestationVerification,
} from '../scripts/verify-action-pin-attestation.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const ARTIFACT_DIR = path.join(TEST_DIR, 'fixtures', 'action-pin-review');
const MANIFEST_PATH = path.join(ARTIFACT_DIR, ACTION_PIN_ARTIFACT_MANIFEST_FILE);
const MANIFEST_BYTES = readFileSync(MANIFEST_PATH);
const PROVENANCE = verifyActionPinProvenanceArtifact({ artifactDir: ARTIFACT_DIR });
const WORKFLOW = `${PROVENANCE.sourceRepository}/${PROVENANCE.workflowPath}`;
const TRUSTED_ROOT = Buffer.from('Action pin fixture trusted root\n');
const TRUSTED_ROOT_SHA256 = sha256(TRUSTED_ROOT);
const BUNDLE = Buffer.from('Action pin fixture Sigstore bundle\n');

function verificationFixture() {
  const signer = `https://github.com/${WORKFLOW}@${PROVENANCE.sourceRef}`;
  return [
    {
      attestation: { mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json' },
      verificationResult: {
        mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
        signature: {
          certificate: {
            subjectAlternativeName: signer,
            issuer: GITHUB_ACTIONS_OIDC_ISSUER,
            githubWorkflowSHA: PROVENANCE.workflowSha,
            githubWorkflowRepository: PROVENANCE.sourceRepository,
            githubWorkflowRef: PROVENANCE.sourceRef,
            buildSignerURI: signer,
            buildSignerDigest: PROVENANCE.workflowSha,
            runnerEnvironment: 'github-hosted',
            sourceRepositoryURI: `https://github.com/${PROVENANCE.sourceRepository}`,
            sourceRepositoryDigest: PROVENANCE.sourceHeadSha,
            sourceRepositoryRef: PROVENANCE.sourceRef,
            buildConfigURI: signer,
            buildConfigDigest: PROVENANCE.workflowSha,
          },
        },
        verifiedTimestamps: [
          {
            type: 'Tlog',
            uri: 'https://rekor.sigstore.dev',
            timestamp: '2026-07-14T12:34:56+09:00',
          },
        ],
        statement: {
          _type: 'https://in-toto.io/Statement/v1',
          subject: [
            {
              name: ACTION_PIN_ARTIFACT_MANIFEST_FILE,
              digest: { sha256: sha256(MANIFEST_BYTES) },
            },
          ],
          predicateType: SLSA_PROVENANCE_V1,
          predicate: {
            buildDefinition: {
              buildType: GITHUB_WORKFLOW_BUILD_TYPE,
              externalParameters: {
                workflow: {
                  path: PROVENANCE.workflowPath,
                  ref: PROVENANCE.sourceRef,
                  repository: `https://github.com/${PROVENANCE.sourceRepository}`,
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
                  uri: `git+https://github.com/${PROVENANCE.sourceRepository}@${PROVENANCE.sourceRef}`,
                  digest: { gitCommit: PROVENANCE.sourceHeadSha },
                },
              ],
            },
            runDetails: {
              builder: { id: signer },
              metadata: {
                invocationId: `https://github.com/${PROVENANCE.sourceRepository}/actions/runs/${PROVENANCE.runId}/attempts/${PROVENANCE.runAttempt}`,
              },
            },
          },
        },
      },
    },
  ];
}

function validate(overrides = {}) {
  return validateActionPinAttestationEvidence({
    manifestPath: MANIFEST_PATH,
    manifestBytes: MANIFEST_BYTES,
    trustedRootBytes: TRUSTED_ROOT,
    verificationOutput: verificationFixture(),
    provenanceReport: PROVENANCE,
    expectedTrustedRootSha256: TRUSTED_ROOT_SHA256,
    ...overrides,
  });
}

describe('Action pin artifact attestation', () => {
  it('cross-checks the fixed provenance execution identity with the signer', () => {
    const report = validate();
    expect(Object.keys(report)).toEqual(ACTION_PIN_ATTESTATION_REPORT_FIELDS);
    expect(report.status).toBe('passed');
    expect(report.subject).toBe(ACTION_PIN_ARTIFACT_MANIFEST_FILE);
    expect(report.subjectSha256).toBe(PROVENANCE.evidence.artifactManifestSha256);
    expect(report.sourceRepository).toBe(PROVENANCE.sourceRepository);
    expect(report.signerWorkflow).toBe(WORKFLOW);
    expect(report.sourceRef).toBe(PROVENANCE.sourceRef);
    expect(report.sourceHeadSha).toBe(PROVENANCE.sourceHeadSha);
    expect(report.workflowSha).toBe(PROVENANCE.workflowSha);
    expect(report.runId).toBe(PROVENANCE.runId);
    expect(Object.values(report.checks)).toEqual(Array(10).fill(true));
  });

  it('rejects wrong subject, repository, workflow, ref, and source SHA fixtures', () => {
    const cases = [
      [
        (fixture) => { fixture[0].verificationResult.statement.subject[0].digest.sha256 = '0'.repeat(64); },
        'attestation subject SHA-256',
      ],
      [
        (fixture) => { fixture[0].verificationResult.signature.certificate.sourceRepositoryURI = 'https://github.com/other/repository'; },
        'source repository URI',
      ],
      [
        (fixture) => { fixture[0].verificationResult.signature.certificate.subjectAlternativeName = `https://github.com/${PROVENANCE.sourceRepository}/.github/workflows/other.yml@${PROVENANCE.sourceRef}`; },
        'certificate signer workflow',
      ],
      [
        (fixture) => { fixture[0].verificationResult.signature.certificate.sourceRepositoryRef = 'refs/heads/other'; },
        'source repository ref',
      ],
      [
        (fixture) => { fixture[0].verificationResult.signature.certificate.sourceRepositoryDigest = '0'.repeat(40); },
        'source repository digest',
      ],
      [
        (fixture) => { fixture[0].verificationResult.statement.predicate.runDetails.metadata.invocationId = `https://github.com/${PROVENANCE.sourceRepository}/actions/runs/1/attempts/1`; },
        'SLSA invocation ID',
      ],
    ];
    for (const [mutate, message] of cases) {
      const fixture = verificationFixture();
      mutate(fixture);
      const report = validate({ verificationOutput: fixture });
      expect(report.status).toBe('failed');
      expect(report.error).toContain(message);
    }
  });

  it('rejects a provenance-to-manifest digest mismatch', () => {
    const report = validate({
      provenanceReport: {
        ...PROVENANCE,
        evidence: {
          ...PROVENANCE.evidence,
          artifactManifestSha256: '0'.repeat(64),
        },
      },
    });
    expect(report.status).toBe('failed');
    expect(report.error).toContain('provenance execution report');
  });

  it('separates offline gh execution and rejects bundle tampering', () => {
    const options = {
      artifactDir: ARTIFACT_DIR,
      attestationBundle: 'fixture/attestation.jsonl',
      trustedRoot: 'fixture/trusted-root.jsonl',
    };
    const dependencies = {
      verifyProvenance: () => PROVENANCE,
      readSecure(_filePath, label) {
        if (label === 'Action pin artifact manifest') return MANIFEST_BYTES;
        if (label === 'trusted root') return TRUSTED_ROOT;
        return Buffer.from(BUNDLE);
      },
      runGh(_args, { attestationBytes }) {
        if (!attestationBytes.equals(BUNDLE)) throw new Error('offline bundle signature verification failed');
        return JSON.stringify(verificationFixture());
      },
      expectedTrustedRootSha256: TRUSTED_ROOT_SHA256,
    };
    expect(runActionPinAttestationVerification(options, dependencies).status).toBe('passed');

    const tampered = runActionPinAttestationVerification(options, {
      ...dependencies,
      readSecure(_filePath, label) {
        if (label === 'Action pin artifact manifest') return MANIFEST_BYTES;
        if (label === 'trusted root') return TRUSTED_ROOT;
        return Buffer.concat([BUNDLE, Buffer.from('tampered')]);
      },
    });
    expect(tampered.status).toBe('failed');
    expect(tampered.error).toContain('offline bundle signature verification failed');
  });

  it('parses the offline CLI contract', () => {
    expect(parseActionPinAttestationArgs([
      '--artifact-dir', 'action-pin-review',
      '--attestation-bundle', 'action-pin-attestation/attestation.jsonl',
      '--trusted-root', 'action-pin-attestation/trusted-root.jsonl',
      '--json',
      '--report-file', 'action-pin-attestation/attestation-verification.json',
    ])).toEqual({
      artifactDir: 'action-pin-review',
      attestationBundle: 'action-pin-attestation/attestation.jsonl',
      trustedRoot: 'action-pin-attestation/trusted-root.jsonl',
      json: true,
      reportFile: 'action-pin-attestation/attestation-verification.json',
    });
  });

  it('writes exactly one canonical report atomically', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-action-pin-attestation-'));
    const reportPath = path.join(parent, 'attestation-verification.json');
    const report = validate();
    try {
      writeActionPinAttestationReportAtomic(reportPath, report);
      expect(readFileSync(reportPath, 'utf8')).toBe(canonicalActionPinAttestationReport(report));
      writeFileSync(reportPath, 'previous-complete-report\n');
      expect(() => writeActionPinAttestationReportAtomic(reportPath, report, {
        rename() { throw new Error('fixture rename failure'); },
      })).toThrow('fixture rename failure');
      expect(readFileSync(reportPath, 'utf8')).toBe('previous-complete-report\n');
      expect(readdirSync(parent)).toEqual(['attestation-verification.json']);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('keeps the gh verifier offline in the shared command layer', () => {
    const source = readFileSync(path.join(ROOT, 'scripts', 'github-attestation-cli.mjs'), 'utf8');
    for (const snippet of [
      "'--bundle'",
      "'--custom-trusted-root'",
      "'--deny-self-hosted-runners'",
      'HTTP_PROXY: BLOCKED_PROXY',
      'HTTPS_PROXY: BLOCKED_PROXY',
      'ALL_PROXY: BLOCKED_PROXY',
      "NO_PROXY: ''",
    ]) expect(source).toContain(snippet);
    for (const forbidden of ["'attestation', 'download'", "'attestation', 'trusted-root'", 'fetch(', 'node:http', 'node:https']) {
      expect(source).not.toContain(forbidden);
    }
  });
});
