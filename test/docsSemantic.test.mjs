import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  collectMarkdownLinkViolations,
  inspectDocumentation,
  parseCurrentStatus,
  parseHeadings,
} from '../scripts/docs-semantic-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('documentation semantic gate', () => {
  it('accepts the repository v0.2.62 candidate documentation', () => {
    const report = inspectDocumentation(ROOT);

    expect(report.errors).toEqual([]);
    expect(report.status).toMatchObject({
      packageVersion: '0.2.62',
      npmLatest: '0.2.55',
      releaseState: 'candidate',
    });
    expect(report.markdownFiles).toContain(
      'docs/release-evidence/registry-provenance.md'
    );
  });

  it('parses only the marked current-status block', () => {
    const readme = [
      'Historical Status: v0.2.61 candidate',
      '<!-- package-status:start -->',
      '## Current status',
      '- Package version: `0.2.62`',
      '- npm latest: `0.2.55`',
      '- Release state: `release`',
      '<!-- package-status:end -->',
      'Historical Version `0.2.58` is a candidate.',
    ].join('\n');

    expect(parseCurrentStatus(readme)).toMatchObject({
      packageVersion: '0.2.62',
      npmLatest: '0.2.55',
      releaseState: 'release',
    });
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
