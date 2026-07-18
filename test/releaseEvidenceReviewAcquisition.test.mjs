import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
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
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES,
  canonicalReleaseEvidenceReviewArchiveMetadata,
  createReleaseEvidenceReviewArchiveMetadata,
} from '../scripts/release-evidence-review-archive-core.mjs';
import {
  RELEASE_EVIDENCE_REVIEW_ACQUISITION_CHECK_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ACQUISITION_FILE_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ACQUISITION_MANIFEST_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ACQUISITION_MANIFEST_FILE,
  RELEASE_EVIDENCE_REVIEW_ACQUISITION_METADATA_FILE,
  RELEASE_EVIDENCE_REVIEW_ACQUISITION_REPORT_FIELDS,
  acquireReleaseEvidenceReviewBundle,
  canonicalReleaseEvidenceReviewAcquisitionManifest,
  canonicalReleaseEvidenceReviewAcquisitionReport,
  writeReleaseEvidenceReviewAcquisitionReportAtomic,
} from '../scripts/release-evidence-review-acquisition-core.mjs';
import { createReleaseEvidenceReviewGitHubClient } from '../scripts/release-evidence-review-acquisition-github.mjs';
import {
  parseReleaseEvidenceReviewAcquisitionArgs,
  runReleaseEvidenceReviewAcquisition,
} from '../scripts/acquire-release-evidence-review.mjs';
import {
  REVIEW_ACQUISITION_FIXTURE_VERSION,
  REVIEW_ACQUISITION_FIXTURE_TIME,
  createReleaseEvidenceReviewAcquisitionFixture,
} from '../scripts/check-release-evidence-review-acquisition-fixture.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const CORE = path.join(
  ROOT,
  'scripts',
  'release-evidence-review-acquisition-core.mjs'
);
const CHECKER = path.join(
  ROOT,
  'scripts',
  'check-release-evidence-review-acquisition-fixture.mjs'
);
const VERSION = REVIEW_ACQUISITION_FIXTURE_VERSION;

function temporaryFixture(label) {
  const parent = mkdtempSync(
    path.join(os.tmpdir(), `rnick-review-acquisition-${label}-`)
  );
  return {
    parent,
    fixture: createReleaseEvidenceReviewAcquisitionFixture(parent),
  };
}

function acquireFixture(fixture, dependencies = {}) {
  return acquireReleaseEvidenceReviewBundle(
    {
      ...fixture.options,
      runResponse: fixture.runResponse,
      artifactsResponse: fixture.artifactsResponse,
      attestationsResponse: fixture.attestationsResponse,
      artifactArchives: fixture.archives,
    },
    dependencies
  );
}

describe('release evidence review artifact acquisition', () => {
  it('acquires the exact retained ZIPs, canonical metadata, manifest, and importer handoff', () => {
    const { parent, fixture } = temporaryFixture('success');
    try {
      const report = runReleaseEvidenceReviewAcquisition(fixture.options, {
        github: fixture.github,
      });
      expect(Object.keys(report)).toEqual(
        RELEASE_EVIDENCE_REVIEW_ACQUISITION_REPORT_FIELDS
      );
      expect(Object.keys(report.checks)).toEqual(
        RELEASE_EVIDENCE_REVIEW_ACQUISITION_CHECK_FIELDS
      );
      expect(report).toMatchObject({
        status: 'passed',
        package: 'react-native-image-compression-kit',
        version: VERSION,
        reviewer: 'GGULBAE',
        runId: RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES[VERSION].reviewRun.id,
        archiveSha256:
          RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES[VERSION].archiveSha256,
        checks: Object.fromEntries(
          RELEASE_EVIDENCE_REVIEW_ACQUISITION_CHECK_FIELDS.map((field) => [
            field,
            true,
          ])
        ),
        error: null,
      });
      expect(readdirSync(fixture.options.outputDir).sort()).toEqual([
        'artifacts',
        'review-acquisition-manifest.json',
        'review-evidence-metadata.json',
      ]);
      expect(
        readFileSync(
          path.join(
            fixture.options.outputDir,
            RELEASE_EVIDENCE_REVIEW_ACQUISITION_METADATA_FILE
          ),
          'utf8'
        )
      ).toBe(
        canonicalReleaseEvidenceReviewArchiveMetadata(
          createReleaseEvidenceReviewArchiveMetadata({ version: VERSION })
        )
      );
      const manifestBytes = readFileSync(
        path.join(
          fixture.options.outputDir,
          RELEASE_EVIDENCE_REVIEW_ACQUISITION_MANIFEST_FILE
        ),
        'utf8'
      );
      const manifest = JSON.parse(manifestBytes);
      expect(Object.keys(manifest)).toEqual(
        RELEASE_EVIDENCE_REVIEW_ACQUISITION_MANIFEST_FIELDS
      );
      expect(manifest.files).toHaveLength(3);
      for (const file of manifest.files) {
        expect(Object.keys(file)).toEqual(
          RELEASE_EVIDENCE_REVIEW_ACQUISITION_FILE_FIELDS
        );
      }
      expect(manifestBytes).toBe(
        canonicalReleaseEvidenceReviewAcquisitionManifest(manifest)
      );
      expect(manifest.acquiredAt).toBe(REVIEW_ACQUISITION_FIXTURE_TIME);
      expect(manifest.acquisitionSha256).toBe(report.acquisitionSha256);
      expect(
        readFileSync(
          path.join(fixture.options.outputDir, 'artifacts', 'review.zip')
        )
      ).toEqual(fixture.archives.review.zipBytes);
      expect(
        readFileSync(
          path.join(fixture.options.outputDir, 'artifacts', 'attestation.zip')
        )
      ).toEqual(fixture.archives.attestation.zipBytes);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }, 15_000);

  it.each([
    ['conclusion', (fixture) => (fixture.runResponse.conclusion = 'failure')],
    ['workflow', (fixture) => (fixture.runResponse.path = '.github/workflows/ci.yml')],
    ['source SHA', (fixture) => (fixture.runResponse.head_sha = '0'.repeat(40))],
    ['source ref', (fixture) => (fixture.runResponse.head_branch = 'other')],
    ['reviewer', (fixture) => (fixture.runResponse.actor.login = 'other')],
  ])('rejects wrong workflow run %s without exposing output', (_, mutate) => {
    const { parent, fixture } = temporaryFixture('run');
    try {
      mutate(fixture);
      const report = acquireFixture(fixture);
      expect(report.status).toBe('failed');
      expect(report.checks.run).toBe(false);
      expect(existsSync(fixture.options.outputDir)).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it.each([
    ['ID', (artifact) => (artifact.id += 1)],
    ['digest', (artifact) => (artifact.digest = `sha256:${'0'.repeat(64)}`)],
    ['size', (artifact) => (artifact.size_in_bytes += 1)],
    ['creation time', (artifact) => (artifact.created_at = '2026-07-15T05:05:00Z')],
    ['expired flag', (artifact) => (artifact.expired = true)],
    ['expiry time', (artifact) => (artifact.expires_at = REVIEW_ACQUISITION_FIXTURE_TIME)],
  ])('rejects wrong artifact %s and rolls back', (_, mutate) => {
    const { parent, fixture } = temporaryFixture('artifact');
    try {
      mutate(fixture.artifactsResponse.artifacts[0]);
      const report = acquireFixture(fixture);
      expect(report.status).toBe('failed');
      expect(existsSync(fixture.options.outputDir)).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects an exact ZIP digest mismatch before staging output', () => {
    const { parent, fixture } = temporaryFixture('zip');
    try {
      fixture.archives.review.zipBytes = Buffer.from(
        fixture.archives.review.zipBytes
      );
      fixture.archives.review.zipBytes[0] ^= 0xff;
      const report = acquireFixture(fixture);
      expect(report.status).toBe('failed');
      expect(report.error).toContain('ZIP digest');
      expect(existsSync(fixture.options.outputDir)).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it.each([
    ['bundle', (fixture) => (fixture.attestationsResponse.attestations[0].bundle = {})],
    ['ID', (fixture) => {
      fixture.attestationsResponse.attestations[0].attestation_id += 1;
    }],
  ])('rejects attestation %s disagreement', (_, mutate) => {
    const { parent, fixture } = temporaryFixture('attestation');
    try {
      mutate(fixture);
      const report = acquireFixture(fixture);
      expect(report.status).toBe('failed');
      expect(existsSync(fixture.options.outputDir)).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('writes report bytes identical to the canonical stdout object', () => {
    const { parent, fixture } = temporaryFixture('report');
    try {
      fixture.options.reportFile = path.join(parent, 'report.json');
      const report = runReleaseEvidenceReviewAcquisition(fixture.options, {
        github: fixture.github,
      });
      const canonical = canonicalReleaseEvidenceReviewAcquisitionReport(report);
      expect(readFileSync(fixture.options.reportFile, 'utf8')).toBe(canonical);
      expect(canonical.trim().split('\n')).toHaveLength(1);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('removes staged output and handoff after output rename failure', () => {
    const { parent, fixture } = temporaryFixture('output-rename');
    try {
      const report = acquireFixture(fixture, {
        renameOutput: () => {
          throw new Error('fixture output rename failure');
        },
      });
      expect(report.status).toBe('failed');
      expect(report.error).toContain('fixture output rename failure');
      expect(report.checks.handoff).toBe(true);
      expect(report.checks.atomicWrite).toBe(false);
      expect(readdirSync(parent)).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rolls back exposed output and preserves a previous report on report rename failure', () => {
    const { parent, fixture } = temporaryFixture('report-rename');
    try {
      fixture.options.reportFile = path.join(parent, 'report.json');
      writeFileSync(fixture.options.reportFile, 'previous\n');
      const report = acquireFixture(fixture, {
        renameReport: () => {
          throw new Error('fixture report rename failure');
        },
      });
      expect(report.status).toBe('failed');
      expect(report.error).toContain('fixture report rename failure');
      expect(existsSync(fixture.options.outputDir)).toBe(false);
      expect(readFileSync(fixture.options.reportFile, 'utf8')).toBe('previous\n');
      expect(readdirSync(parent)).toEqual(['report.json']);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it.each(['write', 'handoff'])('cleans staging after %s failure', (mode) => {
    const { parent, fixture } = temporaryFixture(mode);
    try {
      const dependencies =
        mode === 'write'
          ? {
              writeFile: () => {
                throw new Error('fixture write failure');
              },
            }
          : {
              importArchive: () => ({
                status: 'failed',
                error: 'fixture handoff failure',
              }),
            };
      const report = acquireFixture(fixture, dependencies);
      expect(report.status).toBe('failed');
      expect(report.error).toContain(`fixture ${mode} failure`);
      expect(report.checks.atomicWrite).toBe(false);
      expect(readdirSync(parent)).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('never replaces an existing acquisition destination', () => {
    const { parent, fixture } = temporaryFixture('duplicate');
    try {
      writeFileSync(fixture.options.outputDir, 'occupied');
      const report = acquireFixture(fixture);
      expect(report.status).toBe('failed');
      expect(report.error).toContain('destination already exists');
      expect(readFileSync(fixture.options.outputDir, 'utf8')).toBe('occupied');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('preserves previous report bytes on standalone atomic rename failure', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-report-'));
    try {
      const reportFile = path.join(parent, 'report.json');
      writeFileSync(reportFile, 'previous\n');
      expect(() =>
        writeReleaseEvidenceReviewAcquisitionReportAtomic(
          reportFile,
          { status: 'fixture' },
          {
            renameReport: () => {
              throw new Error('fixture standalone rename failure');
            },
          }
        )
      ).toThrow('fixture standalone rename failure');
      expect(readFileSync(reportFile, 'utf8')).toBe('previous\n');
      expect(readdirSync(parent)).toEqual(['report.json']);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('requires every trust selector explicitly and has no latest-run option', () => {
    const parsed = parseReleaseEvidenceReviewAcquisitionArgs([
      '--repository',
      'GGULBAE/react-native-image-compression-kit',
      '--workflow',
      '.github/workflows/release-evidence-policy-review.yml',
      '--source-ref',
      'refs/heads/master',
      '--source-digest',
      '1'.repeat(40),
      '--run-id',
      '123',
      '--version',
      VERSION,
      '--output-dir',
      'acquisition',
      '--release-archive-root',
      'evidence/npm',
      '--report-file',
      'report.json',
      '--json',
    ]);
    expect(parsed).toEqual({
      repository: 'GGULBAE/react-native-image-compression-kit',
      workflowPath: '.github/workflows/release-evidence-policy-review.yml',
      sourceRef: 'refs/heads/master',
      sourceDigest: '1'.repeat(40),
      runId: 123,
      version: VERSION,
      outputDir: 'acquisition',
      releaseArchiveRoot: 'evidence/npm',
      reportFile: 'report.json',
      json: true,
    });
    expect(JSON.stringify(parsed)).not.toContain('latest');

    const { parent, fixture } = temporaryFixture('nested-report');
    try {
      fixture.options.reportFile = path.join(
        fixture.options.outputDir,
        'report.json'
      );
      expect(() =>
        runReleaseEvidenceReviewAcquisition(fixture.options, {
          github: fixture.github,
        })
      ).toThrow('must be outside the canonical output directory');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('builds exact gh API requests without a latest selector', () => {
    const subjectBytes = Buffer.from('{"subject":"inline"}\n');
    const subjectSha256 = createHash('sha256')
      .update(subjectBytes)
      .digest('hex');
    const calls = [];
    const zipBytes = readFileSync(
      path.join(ROOT, 'evidence', 'reviews', VERSION, 'artifacts', 'attestation.zip')
    );
    const runCommand = (command, args, { encoding }) => {
      calls.push({ command, args, encoding });
      if (args.at(-1)?.endsWith('/zip')) return zipBytes;
      if (args[1]?.includes('/attestations/sha256:')) {
        return JSON.stringify({
          attestations: [
            {
              repository_id: 123,
              bundle_url:
                'https://example.test/attestations/123/2026/07/17/456.json.sn?signature=secret',
              bundle: { mediaType: 'test' },
            },
          ],
        });
      }
      return JSON.stringify({ ok: true });
    };
    const github = createReleaseEvidenceReviewGitHubClient({ runCommand });
    expect(github.getRun({ repository: 'owner/repo', runId: 123 })).toEqual({ ok: true });
    expect(github.listArtifacts({ repository: 'owner/repo', runId: 123 })).toEqual({ ok: true });
    expect(
      github.getAttestations({
        repository: 'owner/repo',
        subjectSha256,
        subjectBytes,
      })
    ).toEqual({
      attestations: [
        {
          repository_id: 123,
          attestation_id: 456,
          bundle: { mediaType: 'test' },
        },
      ],
    });
    expect(
      github.downloadArtifact({ repository: 'owner/repo', artifactId: 456 }).files.size
    ).toBe(3);
    expect(calls.map((call) => call.args)).toEqual([
      ['api', 'repos/owner/repo/actions/runs/123'],
      ['api', 'repos/owner/repo/actions/runs/123/artifacts'],
      ['api', `repos/owner/repo/attestations/sha256:${subjectSha256}`],
      ['api', 'repos/owner/repo/actions/artifacts/456/zip'],
    ]);
    expect(calls.flatMap((call) => call.args)).not.toContain('latest');
  });

  it('hydrates a bundle URL response through an exact-subject gh download', () => {
    const subjectBytes = Buffer.from('{"subject":"exact"}\n');
    const subjectSha256 = createHash('sha256')
      .update(subjectBytes)
      .digest('hex');
    const bundle = {
      mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
    };
    const calls = [];
    const runCommand = (command, args, options = {}) => {
      calls.push({ command, args, options });
      if (args[0] === 'api') {
        return JSON.stringify({
          attestations: [
            {
              repository_id: 123,
              bundle: null,
              bundle_url:
                'https://example.test/attestations/123/2026/07/17/456.json.sn?signature=secret',
            },
          ],
        });
      }
      if (args[0] === 'attestation' && args[1] === 'download') {
        expect(readFileSync(args[2])).toEqual(subjectBytes);
        writeFileSync(
          path.join(options.cwd, 'sha256-test.jsonl'),
          `${JSON.stringify(bundle)}\n`
        );
        return '';
      }
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    };
    const github = createReleaseEvidenceReviewGitHubClient({ runCommand });
    const response = github.getAttestations({
      repository: 'owner/repo',
      subjectSha256,
      subjectBytes,
    });
    expect(response.attestations).toEqual([
      {
        repository_id: 123,
        attestation_id: 456,
        bundle,
      },
    ]);
    expect(calls[1].args).toEqual([
      'attestation',
      'download',
      expect.any(String),
      '--repo',
      'owner/repo',
      '--limit',
      '2',
    ]);
    expect(calls.some((call) => call.args.includes('latest'))).toBe(false);
  });

  it('keeps validation and default fixture checking offline', () => {
    const source = readFileSync(CORE, 'utf8');
    for (const forbidden of ['node:child_process', 'fetch(', 'gh api', 'https.request']) {
      expect(source).not.toContain(forbidden);
    }
    const result = spawnSync(process.execPath, [CHECKER], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        HTTP_PROXY: 'http://127.0.0.1:9',
        HTTPS_PROXY: 'http://127.0.0.1:9',
        ALL_PROXY: 'http://127.0.0.1:9',
        NO_PROXY: '',
        GH_PROMPT_DISABLED: '1',
      },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(VERSION);
  });
});
