import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  RELEASE_EVIDENCE_ARTIFACT_FIELDS,
  RELEASE_EVIDENCE_ATTESTATION_FIELDS,
  RELEASE_EVIDENCE_ATTESTATION_FILES,
  RELEASE_EVIDENCE_CHECK_FIELDS,
  RELEASE_EVIDENCE_FILE_FIELDS,
  RELEASE_EVIDENCE_FILE_PATHS,
  RELEASE_EVIDENCE_INDEX_FIELDS,
  RELEASE_EVIDENCE_INDEX_FILE,
  RELEASE_EVIDENCE_POLICIES,
  RELEASE_EVIDENCE_RUN_FIELDS,
  RELEASE_EVIDENCE_VERIFICATION_FIELDS,
  canonicalReleaseEvidenceIndex,
  canonicalReleaseEvidenceVerification,
  createReleaseEvidenceIndex,
  createReleaseEvidenceVerification,
  releaseEvidenceDigest,
  verifyReleaseEvidenceArchive,
  writeReleaseEvidenceVerificationAtomic,
} from '../scripts/release-evidence-core.mjs';
import { REGISTRY_BUNDLE_FILES } from '../scripts/registry-provenance-core.mjs';
import { parseReleaseEvidenceArgs } from '../scripts/verify-release-evidence.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const VERSION = '0.2.55';
const ARCHIVE = path.join(ROOT, 'evidence', 'npm', VERSION);
const VERIFIER = path.join(ROOT, 'scripts', 'verify-release-evidence.mjs');

function copiedArchive(label = 'archive') {
  const parent = mkdtempSync(path.join(os.tmpdir(), `rnick-evidence-${label}-`));
  const archiveDir = path.join(parent, VERSION);
  cpSync(ARCHIVE, archiveDir, { recursive: true });
  return { parent, archiveDir };
}

function storedAttestation(archiveDir) {
  return JSON.parse(
    readFileSync(
      path.join(
        archiveDir,
        'attestation',
        'attestation-verification.json'
      ),
      'utf8'
    )
  );
}

function verify(archiveDir, dependencies = {}) {
  return verifyReleaseEvidenceArchive(
    { archiveDir, expectedVersion: VERSION },
    {
      verifyAttestation: () => storedAttestation(archiveDir),
      ...dependencies,
    }
  );
}

function mutateIndex(archiveDir, mutate) {
  const indexPath = path.join(archiveDir, RELEASE_EVIDENCE_INDEX_FILE);
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  mutate(index);
  writeFileSync(indexPath, canonicalReleaseEvidenceIndex(index), 'utf8');
}

describe('committed release evidence archive', () => {
  it('keeps one canonical index plus the exact seven evidence files', () => {
    expect(readdirSync(ARCHIVE).sort()).toEqual(
      ['attestation', RELEASE_EVIDENCE_INDEX_FILE, 'provenance'].sort()
    );
    expect(readdirSync(path.join(ARCHIVE, 'provenance')).sort()).toEqual(
      Object.values(REGISTRY_BUNDLE_FILES).sort()
    );
    expect(readdirSync(path.join(ARCHIVE, 'attestation')).sort()).toEqual(
      [...RELEASE_EVIDENCE_ATTESTATION_FILES].sort()
    );

    const indexBytes = readFileSync(
      path.join(ARCHIVE, RELEASE_EVIDENCE_INDEX_FILE),
      'utf8'
    );
    const index = JSON.parse(indexBytes);
    expect(Object.keys(index)).toEqual(RELEASE_EVIDENCE_INDEX_FIELDS);
    expect(Object.keys(index.registryValidationRun)).toEqual(
      RELEASE_EVIDENCE_RUN_FIELDS
    );
    expect(Object.keys(index.provenanceArtifact)).toEqual(
      RELEASE_EVIDENCE_ARTIFACT_FIELDS
    );
    expect(Object.keys(index.attestation)).toEqual(
      RELEASE_EVIDENCE_ATTESTATION_FIELDS
    );
    expect(Object.keys(index.attestationArtifact)).toEqual(
      RELEASE_EVIDENCE_ARTIFACT_FIELDS
    );
    expect(index.files).toHaveLength(7);
    expect(index.files.map((file) => file.path)).toEqual(
      RELEASE_EVIDENCE_FILE_PATHS
    );
    expect(index.files.every((file) =>
      JSON.stringify(Object.keys(file)) ===
      JSON.stringify(RELEASE_EVIDENCE_FILE_FIELDS)
    )).toBe(true);
    expect(indexBytes).toBe(canonicalReleaseEvidenceIndex(index));
    expect(index.evidenceSha256).toBe(releaseEvidenceDigest(index.files));
    expect(index).toEqual(
      createReleaseEvidenceIndex({ version: VERSION, files: index.files })
    );
  });

  it('verifies layout, bytes, provenance, identity, and timestamps offline', () => {
    const result = verify(ARCHIVE);
    expect(Object.keys(result)).toEqual(RELEASE_EVIDENCE_VERIFICATION_FIELDS);
    expect(Object.keys(result.checks)).toEqual(RELEASE_EVIDENCE_CHECK_FIELDS);
    expect(result).toMatchObject({
      status: 'passed',
      package: 'react-native-image-compression-kit',
      version: VERSION,
      expectedTag: 'latest',
      evidenceSha256:
        'e890e90e322ab6205517950466476a9b9430fa3307b2eacbc3ede0234e3f5e78',
      provenanceReportSha256:
        'aebc75fef227d5c740f6decff008f6e8e5454b845367c58d8a0f5fe5ae3280cd',
      manifestSha256:
        '45677e0204b46a3f388b5cdb5ac7cfa83269dd03479854c25d7ef203582fe2af',
      attestationReportSha256:
        '095756820c5305d50173225edc56d510a724cf95390a7f45f0e179f2207b3ce4',
      sourceDigest: '194e9387406f71763bc0d617ece0d7d58e235e29',
      checks: Object.fromEntries(
        RELEASE_EVIDENCE_CHECK_FIELDS.map((field) => [field, true])
      ),
      error: null,
    });
    expect(canonicalReleaseEvidenceVerification(result).trim().split('\n')).toHaveLength(1);
  });

  it('keeps the previous v0.2.50 release evidence archive replayable', () => {
    const version = '0.2.50';
    const archiveDir = path.join(ROOT, 'evidence', 'npm', version);
    const result = verifyReleaseEvidenceArchive(
      { archiveDir, expectedVersion: version },
      {
        verifyAttestation: () => storedAttestation(archiveDir),
      }
    );
    expect(result).toMatchObject({
      status: 'passed',
      version,
      evidenceSha256:
        '1548695379c92cfb3ab679292ac173dd2148e174371d559ec0512b12e796a149',
      sourceDigest: '2b198c5f6125de6ad5bae76fc835ff5b935984f0',
      checks: Object.fromEntries(
        RELEASE_EVIDENCE_CHECK_FIELDS.map((field) => [field, true])
      ),
    });
  });

  it('parses the version selector and explicit fixture paths', () => {
    expect(
      parseReleaseEvidenceArgs([
        '--version', VERSION,
        '--archive-root', 'evidence/npm',
        '--json',
        '--report-file', 'release-evidence-verification.json',
      ])
    ).toEqual({
      version: VERSION,
      archiveRoot: 'evidence/npm',
      json: true,
      reportFile: 'release-evidence-verification.json',
    });
    expect(() =>
      parseReleaseEvidenceArgs([
        '--version', VERSION,
        '--archive-root', 'root',
        '--archive-dir', 'archive',
      ])
    ).toThrow('Use either --archive-root or --archive-dir');
  });

  it('runs the real GitHub CLI replay with network proxies blocked and writes identical bytes', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-evidence-cli-'));
    try {
      const reportFile = path.join(parent, 'verification.json');
      const result = spawnSync(
        process.execPath,
        [
          VERIFIER,
          '--version', VERSION,
          '--archive-dir', ARCHIVE,
          '--json',
          '--report-file', reportFile,
        ],
        {
          cwd: ROOT,
          encoding: 'utf8',
          env: {
            ...process.env,
            HTTP_PROXY: 'http://127.0.0.1:9',
            HTTPS_PROXY: 'http://127.0.0.1:9',
            ALL_PROXY: 'http://127.0.0.1:9',
            NO_PROXY: '',
            GH_PROMPT_DISABLED: '1',
            GH_NO_UPDATE_NOTIFIER: '1',
          },
        }
      );
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout.trim().split('\n')).toHaveLength(1);
      expect(readFileSync(reportFile, 'utf8')).toBe(result.stdout);
      expect(JSON.parse(result.stdout).checks.attestation).toBe(true);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects a missing file and any additional file', () => {
    for (const mode of ['missing', 'extra']) {
      const { parent, archiveDir } = copiedArchive(mode);
      try {
        if (mode === 'missing') {
          unlinkSync(path.join(archiveDir, 'provenance', 'stdout.json'));
        } else {
          writeFileSync(
            path.join(archiveDir, 'attestation', 'unexpected.txt'),
            'unexpected\n'
          );
        }
        const result = verify(archiveDir);
        expect(result.status).toBe('failed');
        expect(result.error).toContain('must contain exactly');
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('rejects evidence byte tampering and a different trusted root', () => {
    for (const relativePath of [
      'provenance/package.tgz',
      'attestation/trusted-root.jsonl',
    ]) {
      const { parent, archiveDir } = copiedArchive('tamper');
      try {
        const target = path.join(archiveDir, relativePath);
        const bytes = readFileSync(target);
        const tampered = Buffer.from(bytes);
        tampered[0] ^= 0xff;
        writeFileSync(target, tampered);
        const result = verify(archiveDir);
        expect(result.status).toBe('failed');
        expect(result.error).toContain('archived bytes');
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('rejects wrong run, artifact, attestation, commit, workflow, and timestamp policy', () => {
    const mutations = [
      ['registryValidationRun', (index) => { index.registryValidationRun.id += 1; }],
      ['provenanceArtifact', (index) => { index.provenanceArtifact.digest = `sha256:${'0'.repeat(64)}`; }],
      ['attestation', (index) => { index.attestation.id += 1; }],
      ['sourceDigest', (index) => { index.sourceDigest = '0'.repeat(40); }],
      ['workflow', (index) => { index.workflow = 'GGULBAE/react-native-image-compression-kit/.github/workflows/other.yml'; }],
      ['attestation', (index) => { index.attestation.verifiedAt = '2026-07-14T06:07:07.000Z'; }],
      ['attestationArtifact', (index) => { index.attestationArtifact.expiresAt = '2026-10-13T06:06:31Z'; }],
    ];
    for (const [field, mutate] of mutations) {
      const { parent, archiveDir } = copiedArchive(`policy-${field}`);
      try {
        mutateIndex(archiveDir, mutate);
        const result = verify(archiveDir);
        expect(result.status).toBe('failed');
        expect(result.error).toContain(`index ${field}`);
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('rejects unsupported versions before trusting an archive', () => {
    const result = verifyReleaseEvidenceArchive({
      archiveDir: ARCHIVE,
      expectedVersion: '0.2.49',
    });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('No committed release evidence policy');
    expect(RELEASE_EVIDENCE_POLICIES['0.2.49']).toBeUndefined();
  });

  it('removes a temporary report and preserves the prior report on atomic failure', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-evidence-atomic-'));
    try {
      const destination = path.join(parent, 'verification.json');
      writeFileSync(destination, 'previous\n');
      const report = createReleaseEvidenceVerification({
        archiveDir: ARCHIVE,
        packageName: 'react-native-image-compression-kit',
        version: VERSION,
      });
      expect(() =>
        writeReleaseEvidenceVerificationAtomic(destination, report, {
          rename: () => {
            throw new Error('fixture rename failure');
          },
        })
      ).toThrow('fixture rename failure');
      expect(readFileSync(destination, 'utf8')).toBe('previous\n');
      expect(readdirSync(parent)).toEqual(['verification.json']);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
