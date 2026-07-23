import { spawnSync } from 'node:child_process';
import {
  cpSync,
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
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERIFICATION_CHECK_FIELDS,
  verifyReleaseEvidenceReviewArchive,
} from '../scripts/release-evidence-review-archive-core.mjs';
import {
  DEFAULT_RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERSIONS,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_RESULT_FIELDS,
  canonicalReleaseEvidenceReviewArchiveSetReport,
  verifyReleaseEvidenceReviewArchiveSet,
  writeReleaseEvidenceReviewArchiveSetReportAtomic,
} from '../scripts/release-evidence-review-archive-set-core.mjs';
import { parseReleaseEvidenceReviewArchiveSetArgs } from '../scripts/verify-release-evidence-review-archive-set.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const ARCHIVE_ROOT = path.join(ROOT, 'evidence', 'reviews');
const RELEASE_ARCHIVE_ROOT = path.join(ROOT, 'evidence', 'npm');
const VERIFIER = path.join(
  ROOT,
  'scripts',
  'verify-release-evidence-review-archive-set.mjs'
);

function verifyWithStoredAttestation(options) {
  return verifyReleaseEvidenceReviewArchive(options, {
    verifyAttestation: () =>
      JSON.parse(
        readFileSync(
          path.join(
            options.archiveDir,
            'attestation',
            'attestation-verification.json'
          )
        )
      ),
  });
}

describe('release evidence review archive regression set', () => {
  it(
    'verifies every committed review archive in stable order',
    () => {
      const report = verifyReleaseEvidenceReviewArchiveSet(
        {
          archiveRoot: ARCHIVE_ROOT,
          releaseArchiveRoot: RELEASE_ARCHIVE_ROOT,
        },
        { verifyArchive: verifyWithStoredAttestation }
      );
      expect(DEFAULT_RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERSIONS).toEqual([
        '0.2.55',
        '0.2.62',
        '0.3.0',
        '0.4.0',
      ]);
      expect(Object.keys(report)).toEqual(
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_FIELDS
      );
      expect(report.status).toBe('passed');
      expect(report.versions).toEqual([
        '0.2.55',
        '0.2.62',
        '0.3.0',
        '0.4.0',
      ]);
      expect(report.results).toHaveLength(4);
      for (const result of report.results) {
        expect(Object.keys(result)).toEqual(
          RELEASE_EVIDENCE_REVIEW_ARCHIVE_SET_RESULT_FIELDS
        );
        expect(Object.keys(result.checks)).toEqual(
          RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERIFICATION_CHECK_FIELDS
        );
        expect(Object.values(result.checks).every(Boolean)).toBe(true);
      }
      expect(
        canonicalReleaseEvidenceReviewArchiveSetReport(report)
          .trim()
          .split('\n')
      ).toHaveLength(1);
    },
    30_000
  );

  it('runs the real blocked-network set CLI with report bytes equal to stdout', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-set-cli-'));
    try {
      const archiveRoot = path.join(parent, 'reviews');
      cpSync(ARCHIVE_ROOT, archiveRoot, { recursive: true });
      const reportFile = path.join(parent, 'report.json');
      const result = spawnSync(
        process.execPath,
        [
          VERIFIER,
          '--archive-root',
          archiveRoot,
          '--release-archive-root',
          RELEASE_ARCHIVE_ROOT,
          '--json',
          '--report-file',
          reportFile,
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
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout.trim().split('\n')).toHaveLength(1);
      expect(readFileSync(reportFile, 'utf8')).toBe(result.stdout);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: 'passed',
        versions: ['0.2.55', '0.2.62', '0.3.0', '0.4.0'],
      });
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }, 15_000);

  it('reports a failed archive without hiding completed results', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-set-fail-'));
    try {
      const archiveRoot = path.join(parent, 'reviews');
      cpSync(ARCHIVE_ROOT, archiveRoot, { recursive: true });
      const target = path.join(
        archiveRoot,
        '0.2.55',
        'review',
        'review-receipt.json'
      );
      const bytes = Buffer.from(readFileSync(target));
      bytes[0] ^= 0xff;
      writeFileSync(target, bytes);
      const report = verifyReleaseEvidenceReviewArchiveSet(
        {
          archiveRoot,
          releaseArchiveRoot: RELEASE_ARCHIVE_ROOT,
        },
        { verifyArchive: verifyWithStoredAttestation }
      );
      expect(report.status).toBe('failed');
      expect(report.error).toContain('0.2.55');
      expect(report.results).toHaveLength(4);
      expect(report.results[0].status).toBe('failed');
      expect(report.results[1].status).toBe('passed');
      expect(report.results[2].status).toBe('passed');
      expect(report.results[3].status).toBe('passed');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects duplicate and unsupported version selectors', () => {
    const duplicate = verifyReleaseEvidenceReviewArchiveSet({
      archiveRoot: ARCHIVE_ROOT,
      releaseArchiveRoot: RELEASE_ARCHIVE_ROOT,
      versions: ['0.2.55', '0.2.55'],
    });
    expect(duplicate.status).toBe('failed');
    expect(duplicate.error).toContain('must not contain duplicates');

    const unsupported = verifyReleaseEvidenceReviewArchiveSet({
      archiveRoot: ARCHIVE_ROOT,
      releaseArchiveRoot: RELEASE_ARCHIVE_ROOT,
      versions: ['0.2.59'],
    });
    expect(unsupported.status).toBe('failed');
    expect(unsupported.error).toContain('No committed review archive policy');
  });

  it('preserves an existing set report on atomic rename failure', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-set-report-'));
    try {
      const destination = path.join(parent, 'report.json');
      writeFileSync(destination, 'previous\n');
      const report = verifyReleaseEvidenceReviewArchiveSet(
        {
          archiveRoot: ARCHIVE_ROOT,
          releaseArchiveRoot: RELEASE_ARCHIVE_ROOT,
        },
        { verifyArchive: verifyWithStoredAttestation }
      );
      expect(() =>
        writeReleaseEvidenceReviewArchiveSetReportAtomic(destination, report, {
          rename: () => {
            throw new Error('fixture set report rename failure');
          },
        })
      ).toThrow('fixture set report rename failure');
      expect(readFileSync(destination, 'utf8')).toBe('previous\n');
      expect(readdirSync(parent)).toEqual(['report.json']);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('parses repeated explicit versions and archive roots', () => {
    expect(
      parseReleaseEvidenceReviewArchiveSetArgs([
        '--version',
        '0.2.55',
        '--archive-root',
        'evidence/reviews',
        '--release-archive-root',
        'evidence/npm',
        '--report-file',
        'report.json',
        '--json',
      ])
    ).toEqual({
      versions: ['0.2.55'],
      archiveRoot: 'evidence/reviews',
      releaseArchiveRoot: 'evidence/npm',
      reportFile: 'report.json',
      json: true,
    });
  });
});
