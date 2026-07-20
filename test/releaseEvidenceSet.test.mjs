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
  DEFAULT_RELEASE_EVIDENCE_VERSIONS,
  RELEASE_EVIDENCE_SET_FIELDS,
  RELEASE_EVIDENCE_SET_RESULT_FIELDS,
  canonicalReleaseEvidenceSetReport,
  verifyReleaseEvidenceSet,
  writeReleaseEvidenceSetReportAtomic,
} from '../scripts/release-evidence-set-core.mjs';
import {
  RELEASE_EVIDENCE_CHECK_FIELDS,
  verifyReleaseEvidenceArchive,
} from '../scripts/release-evidence-core.mjs';
import { parseReleaseEvidenceSetArgs } from '../scripts/verify-release-evidence-set.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const ARCHIVE_ROOT = path.join(ROOT, 'evidence', 'npm');
const VERIFIER = path.join(ROOT, 'scripts', 'verify-release-evidence-set.mjs');

function verifyWithStoredAttestation(options) {
  return verifyReleaseEvidenceArchive(options, {
    verifyAttestation: () =>
      JSON.parse(
        readFileSync(
          path.join(
            options.archiveDir,
            'attestation',
            'attestation-verification.json'
          ),
          'utf8'
        )
      ),
  });
}

describe('multi-version release evidence regression', () => {
  it('verifies every committed release evidence policy in stable order', () => {
    const report = verifyReleaseEvidenceSet(
      { archiveRoot: ARCHIVE_ROOT },
      { verifyArchive: verifyWithStoredAttestation }
    );
    expect(DEFAULT_RELEASE_EVIDENCE_VERSIONS).toEqual([
      '0.2.50',
      '0.2.55',
      '0.2.62',
      '0.3.0',
      '0.4.0',
    ]);
    expect(Object.keys(report)).toEqual(RELEASE_EVIDENCE_SET_FIELDS);
    expect(report.status).toBe('passed');
    expect(report.versions).toEqual([
      '0.2.50',
      '0.2.55',
      '0.2.62',
      '0.3.0',
      '0.4.0',
    ]);
    expect(report.results.map((result) => result.version)).toEqual(
      report.versions
    );
    for (const result of report.results) {
      expect(Object.keys(result)).toEqual(RELEASE_EVIDENCE_SET_RESULT_FIELDS);
      expect(result.status).toBe('passed');
      expect(Object.keys(result.checks)).toEqual(RELEASE_EVIDENCE_CHECK_FIELDS);
      expect(Object.values(result.checks).every(Boolean)).toBe(true);
      expect(result.error).toBeNull();
    }
    expect(canonicalReleaseEvidenceSetReport(report).trim().split('\n'))
      .toHaveLength(1);
  });

  it('runs the real blocked-network CLI and writes report bytes identical to stdout', () => {
    const parent = mkdtempSync(
      path.join(os.tmpdir(), 'rnick-evidence-set-cli-')
    );
    try {
      const reportFile = path.join(parent, 'report.json');
      const result = spawnSync(
        process.execPath,
        [
          VERIFIER,
          '--archive-root',
          ARCHIVE_ROOT,
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
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout.trim().split('\n')).toHaveLength(1);
      expect(readFileSync(reportFile, 'utf8')).toBe(result.stdout);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: 'passed',
        versions: ['0.2.50', '0.2.55', '0.2.62', '0.3.0', '0.4.0'],
      });
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('reports the exact failed version while continuing the complete set', () => {
    const parent = mkdtempSync(
      path.join(os.tmpdir(), 'rnick-evidence-set-fail-')
    );
    try {
      const archiveRoot = path.join(parent, 'npm');
      cpSync(ARCHIVE_ROOT, archiveRoot, { recursive: true });
      const tarball = path.join(
        archiveRoot,
        '0.2.50',
        'provenance',
        'package.tgz'
      );
      const bytes = Buffer.from(readFileSync(tarball));
      bytes[0] ^= 0xff;
      writeFileSync(tarball, bytes);
      const report = verifyReleaseEvidenceSet(
        { archiveRoot },
        { verifyArchive: verifyWithStoredAttestation }
      );
      expect(report.status).toBe('failed');
      expect(report.error).toContain('0.2.50');
      expect(report.results).toHaveLength(5);
      expect(report.results[0].status).toBe('failed');
      expect(report.results[1].status).toBe('passed');
      expect(report.results[2].status).toBe('passed');
      expect(report.results[3].status).toBe('passed');
      expect(report.results[4].status).toBe('passed');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects duplicate and unsupported version selections', () => {
    const duplicate = verifyReleaseEvidenceSet({
      archiveRoot: ARCHIVE_ROOT,
      versions: ['0.2.55', '0.2.55'],
    });
    expect(duplicate.status).toBe('failed');
    expect(duplicate.error).toContain('must not contain duplicates');

    const unsupported = verifyReleaseEvidenceSet({
      archiveRoot: ARCHIVE_ROOT,
      versions: ['0.2.56'],
    });
    expect(unsupported.status).toBe('failed');
    expect(unsupported.error).toContain('No committed release evidence policy');
  });

  it('preserves the prior report and removes temporary bytes on atomic failure', () => {
    const parent = mkdtempSync(
      path.join(os.tmpdir(), 'rnick-evidence-set-atomic-')
    );
    try {
      const destination = path.join(parent, 'report.json');
      writeFileSync(destination, 'previous\n');
      const report = verifyReleaseEvidenceSet(
        { archiveRoot: ARCHIVE_ROOT },
        { verifyArchive: verifyWithStoredAttestation }
      );
      expect(() =>
        writeReleaseEvidenceSetReportAtomic(destination, report, {
          rename: () => {
            throw new Error('fixture rename failure');
          },
        })
      ).toThrow('fixture rename failure');
      expect(readFileSync(destination, 'utf8')).toBe('previous\n');
      expect(readdirSync(parent)).toEqual(['report.json']);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('parses repeated version selectors and explicit output paths', () => {
    expect(
      parseReleaseEvidenceSetArgs([
        '--version',
        '0.2.50',
        '--version',
        '0.2.55',
        '--archive-root',
        'evidence/npm',
        '--json',
        '--report-file',
        'report.json',
      ])
    ).toEqual({
      versions: ['0.2.50', '0.2.55'],
      archiveRoot: 'evidence/npm',
      json: true,
      reportFile: 'report.json',
    });
  });
});
