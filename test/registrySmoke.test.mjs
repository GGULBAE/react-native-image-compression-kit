import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  canonicalRegistryReport,
  validateRegistryEvidence,
  writeRegistryReportAtomic,
} from '../scripts/registry-smoke-core.mjs';
import { parseRegistrySmokeArgs } from '../scripts/registry-smoke-test.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(TEST_DIR, 'fixtures', 'registry-smoke');
const evidenceFixture = JSON.parse(
  readFileSync(path.join(FIXTURE_DIR, 'evidence.json'), 'utf8')
);
const readmeFixture = readFileSync(path.join(FIXTURE_DIR, 'README.md'), 'utf8');

function evidence(overrides = {}) {
  return {
    ...structuredClone(evidenceFixture),
    readmeContents: readmeFixture,
    ...overrides,
  };
}

describe('registry provenance report', () => {
  it('returns the fixed successful report schema in stable order', () => {
    const report = validateRegistryEvidence(evidence());

    expect(Object.keys(report)).toEqual([
      'schemaVersion', 'status', 'package', 'requestedVersion',
      'resolvedVersion', 'expectedTag', 'tagVersion', 'publishedAt',
      'tarball', 'integrity', 'shasum', 'fileCount', 'packageSize',
      'unpackedSize', 'readmeStatus', 'forbiddenFiles',
      'registryInstallSmoke', 'error',
    ]);
    expect(report).toMatchObject({
      schemaVersion: 1,
      status: 'passed',
      package: 'react-native-image-compression-kit',
      requestedVersion: '0.2.47',
      resolvedVersion: '0.2.47',
      expectedTag: 'latest',
      tagVersion: '0.2.47',
      publishedAt: '2026-07-11T11:23:46.074Z',
      readmeStatus: 'passed',
      forbiddenFiles: [],
      registryInstallSmoke: true,
      error: null,
    });
    const canonical = canonicalRegistryReport(report);
    expect(canonical.endsWith('\n')).toBe(true);
    expect(canonical.trim().split('\n')).toHaveLength(1);
    expect(JSON.parse(canonical)).toEqual(report);
  });

  it('parses exact version, expected tag, JSON, and report options', () => {
    expect(
      parseRegistrySmokeArgs([
        '--version', '0.2.47', '--expect-tag', 'latest', '--json',
        '--report-file', 'registry-provenance.json',
      ])
    ).toEqual({
      version: '0.2.47',
      expectedTag: 'latest',
      json: true,
      reportFile: 'registry-provenance.json',
    });
    expect(parseRegistrySmokeArgs(['--tag', 'latest'])).toEqual({
      tag: 'latest',
    });
  });

  it('rejects a version/tag mismatch', () => {
    const report = validateRegistryEvidence(evidence({ tagVersion: '0.2.46' }));

    expect(report.status).toBe('failed');
    expect(report.error).toContain('dist-tag latest');
    expect(report.tagVersion).toBe('0.2.46');
  });

  it('rejects stale candidate, unpublished, and no-publish README status', () => {
    for (const [stale, violation] of [
      ['Status: v0.2.47 candidate', 'Status: v0.2.47 candidate'],
      ['Version `0.2.47` is an unpublished registry candidate', 'Version `0.2.47` is an unpublished'],
      ['v0.2.47 no-publish', 'v0.2.47 no-publish'],
    ]) {
      const report = validateRegistryEvidence(
        evidence({ readmeContents: `${readmeFixture}\n${stale}\n` })
      );
      expect(report.status).toBe('failed');
      expect(report.readmeStatus).toBe('failed');
      expect(report.error).toContain(violation);
    }
  });

  it('rejects an integrity mismatch', () => {
    const fixture = evidence();
    fixture.packInfo.integrity = 'sha512-wrong';
    const report = validateRegistryEvidence(fixture);

    expect(report.status).toBe('failed');
    expect(report.error).toContain('integrity does not match');
  });

  it('reports forbidden files', () => {
    const fixture = evidence();
    fixture.packInfo.files.push({ path: 'example/package.json' });
    const report = validateRegistryEvidence(fixture);

    expect(report.status).toBe('failed');
    expect(report.forbiddenFiles).toEqual(['example/package.json']);
    expect(report.error).toContain('development-only files');
  });

  it('rejects a missing required file', () => {
    const fixture = evidence();
    fixture.packInfo.files = fixture.packInfo.files.filter(
      (file) => file.path !== 'lib/index.d.ts'
    );
    const report = validateRegistryEvidence(fixture);

    expect(report.status).toBe('failed');
    expect(report.error).toContain('missing expected files: lib/index.d.ts');
  });

  it('reports a clean-install/typecheck failure', () => {
    const report = validateRegistryEvidence(
      evidence({
        registryInstallSmoke: false,
        installError: 'npm install fixture failure',
      })
    );

    expect(report.status).toBe('failed');
    expect(report.registryInstallSmoke).toBe(false);
    expect(report.error).toBe('npm install fixture failure');
  });

  it('writes canonical JSON atomically and leaves no incomplete report', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'rnick-report-test-'));
    const reportPath = path.join(tempDir, 'registry-provenance.json');
    const report = validateRegistryEvidence(evidence());

    try {
      writeRegistryReportAtomic(reportPath, report);
      expect(readFileSync(reportPath, 'utf8')).toBe(canonicalRegistryReport(report));

      writeFileSync(reportPath, 'previous-complete-report\n', 'utf8');
      expect(() =>
        writeRegistryReportAtomic(reportPath, report, {
          rename() {
            throw new Error('fixture rename failure');
          },
        })
      ).toThrow('fixture rename failure');
      expect(readFileSync(reportPath, 'utf8')).toBe('previous-complete-report\n');
      expect(readdirSync(tempDir)).toEqual(['registry-provenance.json']);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
