import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  collectMarkdownLinkViolations,
  inspectDocumentation,
  inspectStatusContract,
  parseCurrentStatus,
  parseHeadings,
  parseReleaseStatus,
  RELEASE_STATE_MATRIX,
  RELEASE_STATUS_END,
  RELEASE_STATUS_MANIFEST_PATH,
  RELEASE_STATUS_START,
  STATUS_END,
  STATUS_START,
  validateReleaseStatusManifest,
} from '../scripts/docs-semantic-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const REPOSITORY_MANIFEST = JSON.parse(
  readFileSync(path.join(ROOT, RELEASE_STATUS_MANIFEST_PATH), 'utf8')
);

function statusBlock({
  packageVersion = '1.2.3',
  npmLatest = '1.2.2',
  releaseState = 'candidate',
  registryCheckedAt = '2030-01-02',
  documentName = 'README',
} = {}) {
  const releaseDocument = documentName === 'RELEASE';
  return [
    releaseDocument ? RELEASE_STATUS_START : STATUS_START,
    '- Package version: `' + packageVersion + '`',
    '- npm latest: `' + npmLatest + '`',
    '- Release state: `' + releaseState + '`',
    '- Registry checked at: `' + registryCheckedAt + '`',
    releaseDocument ? RELEASE_STATUS_END : STATUS_END,
  ].join('\n');
}

function statusContract(releaseState, overrides = {}) {
  const packageVersion = overrides.packageVersion ?? '1.2.3';
  const manifest = {
    schemaVersion: 1,
    npmLatest: '1.2.2',
    releaseState,
    registryCheckedAt: '2030-01-02',
    ...overrides.manifest,
  };
  const shared = { packageVersion, ...manifest };
  return inspectStatusContract({
    packageVersion,
    manifest,
    documents: [
      {
        documentName: 'README',
        contents: statusBlock({ ...shared, ...overrides.readme }),
      },
      {
        documentName: 'RELEASE',
        contents: statusBlock({
          ...shared,
          ...overrides.release,
          documentName: 'RELEASE',
        }),
        startMarker: RELEASE_STATUS_START,
        endMarker: RELEASE_STATUS_END,
        markerName: 'release-status',
      },
    ],
  });
}

describe('documentation semantic gate', () => {
  it('accepts repository documentation aligned to package.json and the status manifest', () => {
    const report = inspectDocumentation(ROOT);

    expect(report.errors).toEqual([]);
    expect(report.status).toMatchObject({
      packageVersion: PACKAGE_JSON.version,
      npmLatest: REPOSITORY_MANIFEST.npmLatest,
      releaseState: REPOSITORY_MANIFEST.releaseState,
      registryCheckedAt: REPOSITORY_MANIFEST.registryCheckedAt,
    });
    expect(report.releaseStatus).toMatchObject({
      packageVersion: report.status.packageVersion,
      npmLatest: report.status.npmLatest,
      releaseState: report.status.releaseState,
      registryCheckedAt: report.status.registryCheckedAt,
    });
    expect(report.manifest).toEqual(REPOSITORY_MANIFEST);
    expect(report.manifest).not.toHaveProperty('packageVersion');
    expect(
      PACKAGE_JSON.files.some(
        (entry) => entry === 'docs' || entry.startsWith('docs/')
      )
    ).toBe(false);
    expect(report.markdownFiles).toContain(
      'docs/release-evidence/registry-provenance.md'
    );
    expect(report.markdownFiles).toContain('docs/verification-architecture.md');
  });

  it('parses only marked README and RELEASE status blocks', () => {
    const readme = [
      'Historical Status: v1.2.1 candidate',
      statusBlock({ releaseState: 'release' }),
      'Historical Version `1.1.0` is a candidate.',
    ].join('\n');
    const release = [
      '# Release notes',
      statusBlock({ releaseState: 'release', documentName: 'RELEASE' }),
      'Historical candidate prose.',
    ].join('\n');

    expect(parseCurrentStatus(readme)).toMatchObject({
      packageVersion: '1.2.3',
      npmLatest: '1.2.2',
      releaseState: 'release',
      registryCheckedAt: '2030-01-02',
    });
    expect(parseReleaseStatus(release)).toMatchObject(
      parseCurrentStatus(readme)
    );
  });

  it('accepts the candidate to release transition when both mirrors change together', () => {
    expect(RELEASE_STATE_MATRIX).toEqual({
      candidate: { publishable: false },
      release: { publishable: true },
    });
    expect(statusContract('candidate')).toMatchObject({ ok: true, errors: [] });
    expect(statusContract('release')).toMatchObject({ ok: true, errors: [] });
  });

  it('accepts the release to candidate regression only when both mirrors change together', () => {
    const released = statusContract('release');
    const regressed = statusContract('candidate');

    expect(released.ok).toBe(true);
    expect(regressed.ok).toBe(true);
    expect(released.status.releaseState).toBe('release');
    expect(regressed.status.releaseState).toBe('candidate');
  });

  it('reports package, manifest, README, and RELEASE mismatches with expected and actual values', () => {
    const report = statusContract('candidate', {
      readme: { packageVersion: '1.2.4', releaseState: 'release' },
      release: {
        npmLatest: '1.2.1',
        releaseState: 'release',
        registryCheckedAt: '2030-01-03',
      },
    });

    expect(report.errors).toEqual([
      'README: Package version expected "1.2.3" from package.json, received "1.2.4"',
      'README: Release state expected "candidate" from docs/release-status.json, received "release"',
      'RELEASE: npm latest expected "1.2.2" from docs/release-status.json, received "1.2.1"',
      'RELEASE: Release state expected "candidate" from docs/release-status.json, received "release"',
      'RELEASE: Registry checked at expected "2030-01-02" from docs/release-status.json, received "2030-01-03"',
    ]);
  });

  it('rejects invalid manifests and keeps package version out of the manifest schema', () => {
    expect(() =>
      validateReleaseStatusManifest({
        ...REPOSITORY_MANIFEST,
        packageVersion: PACKAGE_JSON.version,
      })
    ).toThrow('unexpected [packageVersion]');
    expect(() =>
      validateReleaseStatusManifest({
        ...REPOSITORY_MANIFEST,
        releaseState: 'published',
      })
    ).toThrow('releaseState expected "candidate" or "release"');
    expect(() =>
      validateReleaseStatusManifest({
        ...REPOSITORY_MANIFEST,
        registryCheckedAt: '2030-02-31',
      })
    ).toThrow('registryCheckedAt expected YYYY-MM-DD');
  });

  it('rejects missing, duplicate, reversed, and malformed document status blocks', () => {
    const valid = statusBlock();
    const duplicate = `${valid}\n${valid}`;
    const reversed = `${STATUS_END}\n${valid.replace(STATUS_END, '')}`;
    const releaseValid = statusBlock({ documentName: 'RELEASE' });
    const invalidState = valid.replace(
      '- Release state: `candidate`',
      '- Release state: `published`'
    );

    expect(() => parseCurrentStatus('# no marker')).toThrow(
      'README: expected exactly one ordered package-status marker block'
    );
    expect(() => parseCurrentStatus(duplicate)).toThrow(
      'received start=2, end=2'
    );
    expect(() => parseCurrentStatus(reversed)).toThrow(
      'received start=1, end=1'
    );
    expect(() => parseReleaseStatus('# no release marker')).toThrow(
      'RELEASE: expected exactly one ordered release-status marker block'
    );
    expect(() => parseReleaseStatus(`${releaseValid}\n${releaseValid}`)).toThrow(
      'received start=2, end=2'
    );
    expect(() => parseCurrentStatus(invalidState)).toThrow(
      'README: Release state expected "candidate" or "release", received "published"'
    );
  });

  it('does not hardcode current status values in status gate source or tests', () => {
    const statusFiles = [
      'scripts/docs-semantic-core.mjs',
      'scripts/readme-status-validator.mjs',
      'scripts/release-dry-run.mjs',
      'scripts/verify-docs.mjs',
      'test/docsSemantic.test.mjs',
      'test/releaseDryRun.test.mjs',
    ];
    const sources = statusFiles.map((filePath) => readFileSync(path.join(ROOT, filePath), 'utf8'));
    const forbiddenIdentifier = ['EXPECTED', 'NPM', 'LATEST'].join('_');

    for (const source of sources) {
      expect(source).not.toContain(forbiddenIdentifier);
      expect(source).not.toContain(`'${REPOSITORY_MANIFEST.npmLatest}'`);
    }
    expect(readFileSync(path.join(ROOT, 'scripts/android-verification.mjs'), 'utf8')).not.toMatch(
      /packageJson\.version\s*===\s*['"]/u
    );
  });

  it('detects missing local targets and anchors without network access', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'rnick-docs-'));
    try {
      mkdirSync(path.join(root, 'docs'));
      writeFileSync(
        path.join(root, 'README.md'),
        '# Root\n\n[good](docs/page.md#target) [bad](docs/page.md#missing) [gone](docs/gone.md) [web](https://example.com)\n'
      );
      writeFileSync(path.join(root, 'docs/page.md'), '# Page\n\n## Target\n');

      expect(
        collectMarkdownLinkViolations(root, ['README.md', 'docs/page.md'])
      ).toEqual([
        'README.md: missing anchor docs/page.md#missing',
        'README.md: missing link target docs/gone.md',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses deterministic GitHub-style duplicate heading anchors', () => {
    expect(parseHeadings('# Name\n\n## A.B\n\n## A.B')).toEqual([
      { text: 'Name', anchor: 'name' },
      { text: 'A.B', anchor: 'ab' },
      { text: 'A.B', anchor: 'ab-1' },
    ]);
  });
});
