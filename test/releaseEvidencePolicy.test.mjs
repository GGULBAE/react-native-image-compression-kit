import {
  cpSync,
  mkdirSync,
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
  RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FILE,
  RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE,
  canonicalReleaseEvidenceAcquisitionManifest,
} from '../scripts/release-evidence-acquisition-core.mjs';
import {
  RELEASE_EVIDENCE_FILE_PATHS,
  RELEASE_EVIDENCE_POLICIES,
  releaseEvidenceDigest,
  sha256,
} from '../scripts/release-evidence-core.mjs';
import {
  canonicalReleaseEvidenceImportMetadata,
  createReleaseEvidenceImportMetadata,
} from '../scripts/release-evidence-import-core.mjs';
import {
  RELEASE_EVIDENCE_POLICY_CANDIDATE_FIELDS,
  RELEASE_EVIDENCE_POLICY_CHANGE_FIELDS,
  RELEASE_EVIDENCE_POLICY_CHECK_FIELDS,
  RELEASE_EVIDENCE_POLICY_PROMOTION_CHECK_FIELDS,
  RELEASE_EVIDENCE_POLICY_PROMOTION_FIELDS,
  RELEASE_EVIDENCE_POLICY_REPORT_FIELDS,
  canonicalReleaseEvidencePolicyCandidate,
  canonicalReleaseEvidencePolicyPromotion,
  canonicalReleaseEvidencePolicyReport,
  compareReleaseEvidencePolicy,
  prepareReleaseEvidencePolicyCandidate,
  promoteReleaseEvidencePolicyCandidate,
  readReleaseEvidencePolicyCandidate,
  writeReleaseEvidencePolicyPromotionAtomic,
  writeReleaseEvidencePolicyReportAtomic,
} from '../scripts/release-evidence-policy-core.mjs';
import { parseReleaseEvidencePolicyArgs } from '../scripts/prepare-release-evidence-policy.mjs';
import { parseReleaseEvidencePolicyPromotionArgs } from '../scripts/promote-release-evidence-policy.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const EVIDENCE_ROOT = path.join(ROOT, 'evidence', 'npm');
const VERSION = '0.2.55';
const REVIEWED_AT = '2026-07-15T04:00:00Z';

function createAcquisitionFixture(parent, version = VERSION) {
  const policy = RELEASE_EVIDENCE_POLICIES[version];
  const acquisitionDir = path.join(parent, `acquisition-${version}`);
  mkdirSync(path.join(acquisitionDir, 'provenance'), { recursive: true });
  mkdirSync(path.join(acquisitionDir, 'attestation'), { recursive: true });
  for (const relativePath of RELEASE_EVIDENCE_FILE_PATHS) {
    cpSync(
      path.join(EVIDENCE_ROOT, version, relativePath),
      path.join(acquisitionDir, relativePath)
    );
  }
  const metadata = createReleaseEvidenceImportMetadata({ version });
  const metadataBytes = Buffer.from(
    canonicalReleaseEvidenceImportMetadata(metadata),
    'utf8'
  );
  writeFileSync(
    path.join(acquisitionDir, RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE),
    metadataBytes
  );
  const filePaths = [
    RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE,
    ...RELEASE_EVIDENCE_FILE_PATHS,
  ];
  const files = filePaths.map((relativePath) => {
    const bytes = readFileSync(path.join(acquisitionDir, relativePath));
    return { path: relativePath, size: bytes.length, sha256: sha256(bytes) };
  });
  const manifest = {
    schemaVersion: 1,
    status: 'passed',
    package: policy.package,
    version,
    expectedTag: policy.expectedTag,
    repository: policy.repository,
    workflow: policy.workflow,
    sourceRef: policy.sourceRef,
    sourceDigest: policy.sourceDigest,
    runId: policy.registryValidationRun.id,
    runAttempt: 1,
    provenanceArtifact: { ...policy.provenanceArtifact },
    attestationArtifact: { ...policy.attestationArtifact },
    attestation: { ...policy.attestation },
    metadataFile: RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE,
    metadataSha256: sha256(metadataBytes),
    files,
    acquisitionSha256: releaseEvidenceDigest(files),
    error: null,
  };
  writeFileSync(
    path.join(acquisitionDir, RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FILE),
    canonicalReleaseEvidenceAcquisitionManifest(manifest)
  );
  return acquisitionDir;
}

function prepareFixture(parent, dependencies = {}) {
  const acquisitionDir = createAcquisitionFixture(parent);
  const candidateFile = path.join(parent, 'policy-candidate.json');
  const report = prepareReleaseEvidencePolicyCandidate(
    { acquisitionDir, candidateFile },
    dependencies
  );
  return { acquisitionDir, candidateFile, report };
}

function reviewedPromotionOptions(parent, prepared) {
  const candidateSha256 = sha256(readFileSync(prepared.candidateFile));
  return {
    acquisitionDir: prepared.acquisitionDir,
    candidateFile: prepared.candidateFile,
    expectedVersion: VERSION,
    reviewedCandidateSha256: candidateSha256,
    reviewer: 'release-reviewer@example.test',
    reviewedAt: REVIEWED_AT,
    approved: true,
    archiveRoot: path.join(parent, 'archive-set'),
  };
}

function createArchiveSetBase(archiveRoot, includeTarget = false) {
  mkdirSync(archiveRoot, { recursive: true });
  for (const version of Object.keys(RELEASE_EVIDENCE_POLICIES)) {
    if (version === VERSION) continue;
    cpSync(
      path.join(EVIDENCE_ROOT, version),
      path.join(archiveRoot, version),
      { recursive: true }
    );
  }
  if (includeTarget) {
    cpSync(
      path.join(EVIDENCE_ROOT, VERSION),
      path.join(archiveRoot, VERSION),
      { recursive: true }
    );
  }
}

function expectArchivesEqual(actual, expected) {
  expect(readdirSync(actual).sort()).toEqual(readdirSync(expected).sort());
  for (const relativePath of [
    'release-evidence-index.json',
    ...RELEASE_EVIDENCE_FILE_PATHS,
  ]) {
    expect(readFileSync(path.join(actual, relativePath))).toEqual(
      readFileSync(path.join(expected, relativePath))
    );
  }
}

describe('release evidence policy candidate preparation', () => {
  it('creates one canonical candidate and a stable matching-policy report offline', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-policy-'));
    try {
      const { acquisitionDir, candidateFile, report } = prepareFixture(parent);
      expect(Object.keys(report)).toEqual(RELEASE_EVIDENCE_POLICY_REPORT_FIELDS);
      expect(Object.keys(report.checks)).toEqual(
        RELEASE_EVIDENCE_POLICY_CHECK_FIELDS
      );
      expect(report).toMatchObject({
        status: 'passed',
        acquisitionDir,
        candidateFile,
        version: VERSION,
        policyStatus: 'match',
        changes: [],
        checks: Object.fromEntries(
          RELEASE_EVIDENCE_POLICY_CHECK_FIELDS.map((field) => [field, true])
        ),
        error: null,
      });
      const candidateBytes = readFileSync(candidateFile, 'utf8');
      const candidate = readReleaseEvidencePolicyCandidate(candidateFile);
      expect(Object.keys(candidate)).toEqual(
        RELEASE_EVIDENCE_POLICY_CANDIDATE_FIELDS
      );
      expect(candidateBytes).toBe(
        canonicalReleaseEvidencePolicyCandidate(candidate)
      );
      expect(report.candidateSha256).toBe(sha256(candidateBytes));
      expect(candidate.source.acquisitionSha256).toBe(
        '1545317c2047808f35f253a1387f7a019b2174ca317cbcb6b325b6ac1b797681'
      );
      const canonicalReport = canonicalReleaseEvidencePolicyReport(report);
      expect(canonicalReport.trim().split('\n')).toHaveLength(1);
      const reportFile = path.join(parent, 'policy-report.json');
      writeReleaseEvidencePolicyReportAtomic(reportFile, report);
      expect(readFileSync(reportFile, 'utf8')).toBe(canonicalReport);
      expect(readdirSync(parent).sort()).toEqual([
        'acquisition-0.2.55',
        'policy-candidate.json',
        'policy-report.json',
      ]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('reports committed policy drift and missing policy in stable leaf order', () => {
    const candidatePolicy = RELEASE_EVIDENCE_POLICIES[VERSION];
    const drifted = {
      ...candidatePolicy,
      expectedTag: 'next',
      registryValidationRun: {
        ...candidatePolicy.registryValidationRun,
        id: candidatePolicy.registryValidationRun.id + 1,
      },
    };
    const drift = compareReleaseEvidencePolicy(candidatePolicy, drifted);
    expect(drift.status).toBe('drift');
    expect(drift.changes.map((change) => change.path)).toEqual([
      'expectedTag',
      'registryValidationRun.id',
    ]);
    expect(Object.keys(drift.changes[0])).toEqual(
      RELEASE_EVIDENCE_POLICY_CHANGE_FIELDS
    );
    const missing = compareReleaseEvidencePolicy(candidatePolicy, undefined);
    expect(missing.status).toBe('missing');
    expect(missing.changes[0]).toEqual({
      path: 'package',
      committed: null,
      candidate: candidatePolicy.package,
    });
    expect(missing.changes.at(-1).path).toBe('attestationArtifact.expiresAt');
  });

  it('does not mutate policy/archive state when producing drift or missing reports', () => {
    for (const [name, policies, expectedStatus] of [
      [
        'drift',
        {
          ...RELEASE_EVIDENCE_POLICIES,
          [VERSION]: {
            ...RELEASE_EVIDENCE_POLICIES[VERSION],
            expectedTag: 'next',
          },
        },
        'drift',
      ],
      ['missing', {}, 'missing'],
    ]) {
      const parent = mkdtempSync(
        path.join(os.tmpdir(), `rnick-policy-${name}-`)
      );
      try {
        const archiveRoot = path.join(parent, 'archive-set');
        mkdirSync(archiveRoot);
        const before = JSON.stringify(RELEASE_EVIDENCE_POLICIES);
        const prepared = prepareFixture(parent, { policies });
        expect(prepared.report.status).toBe('passed');
        expect(prepared.report.policyStatus).toBe(expectedStatus);
        expect(prepared.report.changes.length).toBeGreaterThan(0);
        expect(readdirSync(archiveRoot)).toEqual([]);
        expect(JSON.stringify(RELEASE_EVIDENCE_POLICIES)).toBe(before);
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('rejects acquisition drift without leaving a candidate', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-policy-tamper-'));
    try {
      const acquisitionDir = createAcquisitionFixture(parent);
      const candidateFile = path.join(parent, 'candidate.json');
      const metadataFile = path.join(
        acquisitionDir,
        RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE
      );
      writeFileSync(metadataFile, `${readFileSync(metadataFile, 'utf8')} `);
      const report = prepareReleaseEvidencePolicyCandidate({
        acquisitionDir,
        candidateFile,
      });
      expect(report.status).toBe('failed');
      expect(report.error).toContain('drift');
      expect(() => readFileSync(candidateFile)).toThrow();
      expect(readdirSync(parent).some((file) => file.includes('.tmp'))).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('refuses to write a candidate inside the immutable acquisition bundle', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-policy-overlap-'));
    try {
      const acquisitionDir = createAcquisitionFixture(parent);
      const report = prepareReleaseEvidencePolicyCandidate({
        acquisitionDir,
        candidateFile: path.join(acquisitionDir, 'candidate.json'),
      });
      expect(report.status).toBe('failed');
      expect(report.error).toContain('outside the acquisition bundle');
      expect(readdirSync(acquisitionDir).sort()).toEqual([
        'acquisition-manifest.json',
        'attestation',
        'provenance',
        'release-evidence-metadata.json',
      ]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('removes temporary candidate bytes after an atomic rename failure', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-policy-atomic-'));
    try {
      const acquisitionDir = createAcquisitionFixture(parent);
      const candidateFile = path.join(parent, 'candidate.json');
      const report = prepareReleaseEvidencePolicyCandidate(
        { acquisitionDir, candidateFile },
        {
          rename: () => {
            throw new Error('fixture candidate rename failure');
          },
        }
      );
      expect(report.status).toBe('failed');
      expect(report.error).toContain('fixture candidate rename failure');
      expect(readdirSync(parent).sort()).toEqual(['acquisition-0.2.55']);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe('reviewed release evidence policy promotion', () => {
  it('promotes only the reviewed matching candidate through the full archive set', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-promotion-'));
    try {
      const prepared = prepareFixture(parent);
      const options = reviewedPromotionOptions(parent, prepared);
      createArchiveSetBase(options.archiveRoot);
      const report = promoteReleaseEvidencePolicyCandidate(options);
      expect(Object.keys(report)).toEqual(
        RELEASE_EVIDENCE_POLICY_PROMOTION_FIELDS
      );
      expect(Object.keys(report.checks)).toEqual(
        RELEASE_EVIDENCE_POLICY_PROMOTION_CHECK_FIELDS
      );
      expect(report).toMatchObject({
        status: 'passed',
        archiveDir: path.join(options.archiveRoot, VERSION),
        package: 'react-native-image-compression-kit',
        version: VERSION,
        candidateSha256: options.reviewedCandidateSha256,
        reviewer: options.reviewer,
        reviewedAt: REVIEWED_AT,
        evidenceSha256:
          'e890e90e322ab6205517950466476a9b9430fa3307b2eacbc3ede0234e3f5e78',
        setVersions: Object.keys(RELEASE_EVIDENCE_POLICIES),
        checks: Object.fromEntries(
          RELEASE_EVIDENCE_POLICY_PROMOTION_CHECK_FIELDS.map((field) => [
            field,
            true,
          ])
        ),
        error: null,
      });
      expectArchivesEqual(
        path.join(options.archiveRoot, VERSION),
        path.join(EVIDENCE_ROOT, VERSION)
      );
      expect(canonicalReleaseEvidencePolicyPromotion(report).trim().split('\n')).toHaveLength(1);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it.each([
    ['approval', (options) => (options.approved = false), 'explicit --approve'],
    ['digest', (options) => (options.reviewedCandidateSha256 = '0'.repeat(64)), 'does not match'],
    ['reviewer', (options) => (options.reviewer = ''), 'reviewer must be explicit'],
    ['reviewer whitespace', (options) => (options.reviewer = ' reviewer '), 'reviewer must be explicit'],
    ['time', (options) => (options.reviewedAt = 'local-time'), 'canonical UTC'],
    ['early time', (options) => (options.reviewedAt = '2026-07-14T12:00:00Z'), 'must not precede'],
  ])('rejects missing or wrong review %s before archive mutation', (_, mutate, error) => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-'));
    try {
      const prepared = prepareFixture(parent);
      const options = reviewedPromotionOptions(parent, prepared);
      createArchiveSetBase(options.archiveRoot);
      mutate(options);
      const before = readdirSync(options.archiveRoot);
      const report = promoteReleaseEvidencePolicyCandidate(options);
      expect(report.status).toBe('failed');
      expect(report.error).toContain(error);
      expect(readdirSync(options.archiveRoot)).toEqual(before);
      expect(() => readFileSync(path.join(options.archiveRoot, VERSION))).toThrow();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects committed policy drift before archive mutation', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-policy-drift-'));
    try {
      const prepared = prepareFixture(parent);
      const options = reviewedPromotionOptions(parent, prepared);
      createArchiveSetBase(options.archiveRoot);
      const report = promoteReleaseEvidencePolicyCandidate(options, {
        policies: {
          ...RELEASE_EVIDENCE_POLICIES,
          [VERSION]: {
            ...RELEASE_EVIDENCE_POLICIES[VERSION],
            expectedTag: 'next',
          },
        },
      });
      expect(report.status).toBe('failed');
      expect(report.error).toContain('(drift)');
      expect(readdirSync(options.archiveRoot)).toEqual(
        Object.keys(RELEASE_EVIDENCE_POLICIES).filter(
          (version) => version !== VERSION
        )
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects an archive destination that overlaps acquisition input', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-promotion-overlap-'));
    try {
      const prepared = prepareFixture(parent);
      const options = reviewedPromotionOptions(parent, prepared);
      options.archiveRoot = prepared.acquisitionDir;
      const report = promoteReleaseEvidencePolicyCandidate(options);
      expect(report.status).toBe('failed');
      expect(report.error).toContain('must not overlap');
      expect(readdirSync(prepared.acquisitionDir).sort()).toEqual([
        'acquisition-manifest.json',
        'attestation',
        'provenance',
        'release-evidence-metadata.json',
      ]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects a duplicate version and preserves the existing archive', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-duplicate-'));
    try {
      const prepared = prepareFixture(parent);
      const options = reviewedPromotionOptions(parent, prepared);
      createArchiveSetBase(options.archiveRoot, true);
      const before = readFileSync(
        path.join(options.archiveRoot, VERSION, 'release-evidence-index.json')
      );
      const report = promoteReleaseEvidencePolicyCandidate(options);
      expect(report.status).toBe('failed');
      expect(report.error).toContain('already exists');
      expect(
        readFileSync(
          path.join(options.archiveRoot, VERSION, 'release-evidence-index.json')
        )
      ).toEqual(before);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it.each([
    [
      'import',
      {
        importArchive: () => ({ status: 'failed', error: 'fixture import failure' }),
      },
      'fixture import failure',
    ],
    [
      'set',
      {
        verifySet: () => ({ status: 'failed', error: 'fixture set failure' }),
      },
      'fixture set failure',
    ],
    [
      'rename',
      {
        rename: () => {
          throw new Error('fixture promotion rename failure');
        },
      },
      'fixture promotion rename failure',
    ],
  ])('removes staged archive after an atomic %s failure', (_, dependencies, error) => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-promotion-atomic-'));
    try {
      const prepared = prepareFixture(parent);
      const options = reviewedPromotionOptions(parent, prepared);
      createArchiveSetBase(options.archiveRoot);
      const report = promoteReleaseEvidencePolicyCandidate(
        options,
        dependencies
      );
      expect(report.status).toBe('failed');
      expect(report.error).toContain(error);
      expect(readdirSync(options.archiveRoot)).toEqual(
        Object.keys(RELEASE_EVIDENCE_POLICIES).filter(
          (version) => version !== VERSION
        )
      );
      expect(
        readdirSync(options.archiveRoot).some((file) => file.includes('.tmp'))
      ).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe('policy CLI and report contracts', () => {
  it('requires explicit review inputs and has no apply mode', () => {
    expect(
      parseReleaseEvidencePolicyArgs([
        '--acquisition-dir',
        'acquisition',
        '--candidate-file',
        'candidate.json',
        '--report-file',
        'candidate-report.json',
        '--json',
      ])
    ).toEqual({
      acquisitionDir: 'acquisition',
      candidateFile: 'candidate.json',
      reportFile: 'candidate-report.json',
      json: true,
    });
    expect(
      parseReleaseEvidencePolicyPromotionArgs([
        '--acquisition-dir',
        'acquisition',
        '--candidate-file',
        'candidate.json',
        '--version',
        VERSION,
        '--reviewed-candidate-sha256',
        'a'.repeat(64),
        '--reviewer',
        'reviewer',
        '--reviewed-at',
        REVIEWED_AT,
        '--archive-root',
        'archive',
        '--approve',
        '--report-file',
        'promotion-report.json',
        '--json',
      ])
    ).toEqual({
      acquisitionDir: 'acquisition',
      candidateFile: 'candidate.json',
      expectedVersion: VERSION,
      reviewedCandidateSha256: 'a'.repeat(64),
      reviewer: 'reviewer',
      reviewedAt: REVIEWED_AT,
      archiveRoot: 'archive',
      approved: true,
      reportFile: 'promotion-report.json',
      json: true,
    });
    expect(() => parseReleaseEvidencePolicyArgs(['--apply'])).toThrow(
      'Unknown argument: --apply'
    );
    expect(() =>
      parseReleaseEvidencePolicyPromotionArgs(['--apply'])
    ).toThrow('Unknown argument: --apply');
  });

  it('preserves an existing report and removes temporary bytes on rename failure', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-policy-report-'));
    try {
      const destination = path.join(parent, 'report.json');
      writeFileSync(destination, 'previous\n');
      const report = prepareFixture(parent).report;
      for (const writeReport of [
        writeReleaseEvidencePolicyReportAtomic,
        writeReleaseEvidencePolicyPromotionAtomic,
      ]) {
        expect(() =>
          writeReport(destination, report, {
            rename: () => {
              throw new Error('fixture report rename failure');
            },
          })
        ).toThrow('fixture report rename failure');
      }
      expect(readFileSync(destination, 'utf8')).toBe('previous\n');
      expect(readdirSync(parent).some((file) => file.includes('.tmp'))).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
