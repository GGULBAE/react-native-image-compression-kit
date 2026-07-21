import { spawnSync } from 'node:child_process';
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
import { verifyRegistryHealth } from '../scripts/registry-health-core.mjs';
import {
  REGISTRY_HEALTH_CHECK_FIELDS,
  REGISTRY_HEALTH_REPORT_FIELDS,
  canonicalRegistryHealthReport,
  createRegistryHealthReport,
  writeRegistryHealthReportAtomic,
} from '../scripts/registry-health-report.mjs';
import { canonicalRegistryReport } from '../scripts/registry-smoke-core.mjs';
import {
  parseRegistryHealthArgs,
} from '../scripts/verify-registry-health.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const VERSION = '0.4.0';
const EVIDENCE_DIR = path.join(ROOT, 'evidence', 'npm', VERSION);
const PROVENANCE_DIR = path.join(EVIDENCE_DIR, 'provenance');
const CLI = path.join(ROOT, 'scripts', 'verify-registry-health.mjs');

const fixture = Object.freeze({
  releaseStatusBytes: readFileSync(path.join(ROOT, 'docs', 'release-status.json')),
  evidenceIndexBytes: readFileSync(
    path.join(EVIDENCE_DIR, 'release-evidence-index.json')
  ),
  evidenceReportBytes: readFileSync(
    path.join(PROVENANCE_DIR, 'registry-provenance.json')
  ),
  evidenceManifestBytes: readFileSync(
    path.join(PROVENANCE_DIR, 'bundle-manifest.json')
  ),
  evidenceTarballBytes: readFileSync(path.join(PROVENANCE_DIR, 'package.tgz')),
  liveReportBytes: readFileSync(
    path.join(PROVENANCE_DIR, 'registry-provenance.json')
  ),
  liveTarballBytes: readFileSync(path.join(PROVENANCE_DIR, 'package.tgz')),
});

function inputs(overrides = {}) {
  return {
    ...fixture,
    ...overrides,
  };
}

function liveReport(overrides = {}) {
  const report = JSON.parse(fixture.evidenceReportBytes.toString('utf8'));
  Object.assign(report, overrides);
  return Buffer.from(canonicalRegistryReport(report), 'utf8');
}

function expectDrift(overrides, field) {
  const report = verifyRegistryHealth(
    inputs({ liveReportBytes: liveReport(overrides) })
  );
  expect(report.status).toBe('failed');
  expect(report.drift.map((entry) => entry.field)).toContain(field);
  return report;
}

describe('read-only registry health verifier', () => {
  it('replays the committed fixture offline with one stable canonical schema', () => {
    const report = verifyRegistryHealth(inputs());

    expect(Object.keys(report)).toEqual(REGISTRY_HEALTH_REPORT_FIELDS);
    expect(Object.keys(report.checks)).toEqual(REGISTRY_HEALTH_CHECK_FIELDS);
    expect(report).toMatchObject({
      status: 'passed',
      package: 'react-native-image-compression-kit',
      requestedVersion: VERSION,
      resolvedVersion: VERSION,
      expectedTag: 'latest',
      tagVersion: VERSION,
      publishedAt: '2026-07-20T09:55:07.344Z',
      tarballSha256:
        'c3aaaedcaecd1bb56e78cd04a3a6a8044291ff3f80bcd1be87b084fd831816f4',
      evidenceTarballSha256:
        'c3aaaedcaecd1bb56e78cd04a3a6a8044291ff3f80bcd1be87b084fd831816f4',
      packageSize: 68633,
      fileCount: 83,
      unpackedSize: 330574,
      readmeStatus: 'passed',
      forbiddenFiles: [],
      registryInstallSmoke: true,
      checks: Object.fromEntries(
        REGISTRY_HEALTH_CHECK_FIELDS.map((field) => [field, true])
      ),
      drift: [],
      error: null,
    });
    const canonical = canonicalRegistryHealthReport(report);
    expect(canonical.trim().split('\n')).toHaveLength(1);
    expect(JSON.parse(canonical)).toEqual(report);

    const coreSource = readFileSync(
      path.join(ROOT, 'scripts', 'registry-health-core.mjs'),
      'utf8'
    );
    for (const forbidden of [
      'node:child_process',
      'node:http',
      'node:https',
      'fetch(',
      'gh api',
    ]) {
      expect(coreSource).not.toContain(forbidden);
    }
  });

  it('rejects latest pointing to a different version', () => {
    expectDrift({ tagVersion: '0.3.0' }, 'tagVersion');
  });

  it('rejects a live resolved version mismatch', () => {
    expectDrift({ resolvedVersion: '0.3.0' }, 'resolvedVersion');
  });

  it('rejects an SRI mismatch', () => {
    expectDrift({ integrity: 'sha512-d3Jvbmc=' }, 'integrity');
  });

  it('rejects a shasum mismatch', () => {
    expectDrift({ shasum: '0'.repeat(40) }, 'shasum');
  });

  it('rejects a tarball SHA-256 mismatch', () => {
    const tarball = Buffer.from(fixture.liveTarballBytes);
    tarball[tarball.length - 1] ^= 1;
    const report = verifyRegistryHealth(inputs({ liveTarballBytes: tarball }));

    expect(report.status).toBe('failed');
    expect(report.drift.map(({ field }) => field)).toContain('tarballSha256');
  });

  it('rejects a packed size mismatch', () => {
    expectDrift({ packageSize: 68634 }, 'packageSize');
  });

  it('rejects a file count mismatch', () => {
    expectDrift({ fileCount: 84 }, 'fileCount');
  });

  it('rejects an unpacked size mismatch', () => {
    expectDrift({ unpackedSize: 330575 }, 'unpackedSize');
  });

  it('rejects a published timestamp mismatch', () => {
    expectDrift({ publishedAt: '2026-07-20T09:55:08.344Z' }, 'publishedAt');
  });

  it('rejects a README validation failure', () => {
    const report = expectDrift(
      {
        status: 'failed',
        readmeStatus: 'failed',
        error: 'fixture README failure',
      },
      'readmeStatus'
    );
    expect(report.checks.readme).toBe(false);
  });

  it('rejects a consumer install/typecheck failure', () => {
    const report = expectDrift(
      {
        status: 'failed',
        registryInstallSmoke: false,
        error: 'fixture consumer failure',
      },
      'registryInstallSmoke'
    );
    expect(report.checks.consumer).toBe(false);
  });

  it('rejects a missing evidence file', () => {
    const report = verifyRegistryHealth(
      inputs({ evidenceManifestBytes: undefined })
    );

    expect(report.status).toBe('failed');
    expect(report.checks.evidenceIndex).toBe(true);
    expect(report.checks.evidenceBundle).toBe(false);
    expect(report.error).toContain('Missing committed registry bundle manifest');
  });

  it('rejects noncanonical, empty, and multiple live JSON values', () => {
    const parsed = JSON.parse(fixture.liveReportBytes.toString('utf8'));
    const cases = [
      Buffer.from(JSON.stringify(parsed, null, 2)),
      Buffer.alloc(0),
      Buffer.concat([fixture.liveReportBytes, fixture.liveReportBytes]),
    ];

    for (const liveReportBytes of cases) {
      const report = verifyRegistryHealth(inputs({ liveReportBytes }));
      expect(report.status).toBe('failed');
      expect(report.checks.liveReport).toBe(false);
      expect(report.error).toMatch(/not canonical JSON|must not be empty|Could not parse/);
    }
  });

  it('rejects incomplete metadata and duplicate result fields', () => {
    for (const overrides of [
      { publishedAt: null },
      { forbiddenFiles: ['example/package.json', 'example/package.json'] },
    ]) {
      const report = verifyRegistryHealth(
        inputs({ liveReportBytes: liveReport(overrides) })
      );
      expect(report.status).toBe('failed');
      expect(report.checks.liveReport).toBe(false);
      expect(report.error).toMatch(/must be non-empty|must not contain duplicates/);
    }
  });

  it('parses CLI paths and emits report bytes identical to stdout offline', () => {
    expect(
      parseRegistryHealthArgs([
        '--release-status', 'status.json',
        '--evidence-root', 'evidence',
        '--live-artifact-dir', 'live',
        '--json',
        '--report-file', 'health.json',
      ])
    ).toEqual({
      releaseStatusFile: 'status.json',
      evidenceRoot: 'evidence',
      liveArtifactDir: 'live',
      json: true,
      reportFile: 'health.json',
    });

    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'rnick-health-cli-'));
    try {
      const reportFile = path.join(tempDir, 'registry-health.json');
      const result = spawnSync(
        process.execPath,
        [
          CLI,
          '--live-artifact-dir', PROVENANCE_DIR,
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
          },
        }
      );
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout.trim().split('\n')).toHaveLength(1);
      expect(readFileSync(reportFile, 'utf8')).toBe(result.stdout);
      expect(JSON.parse(result.stdout).status).toBe('passed');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('writes atomically without exposing a temporary report as success', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'rnick-health-atomic-'));
    const reportFile = path.join(tempDir, 'registry-health.json');
    const report = verifyRegistryHealth(inputs());

    try {
      writeRegistryHealthReportAtomic(reportFile, report);
      expect(readFileSync(reportFile, 'utf8')).toBe(
        canonicalRegistryHealthReport(report)
      );

      writeFileSync(reportFile, 'previous-complete-report\n', 'utf8');
      expect(() =>
        writeRegistryHealthReportAtomic(reportFile, createRegistryHealthReport(), {
          rename() {
            throw new Error('fixture rename failure');
          },
        })
      ).toThrow('fixture rename failure');
      expect(readFileSync(reportFile, 'utf8')).toBe('previous-complete-report\n');
      expect(readdirSync(tempDir)).toEqual(['registry-health.json']);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
