import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_ROOT = path.join(ROOT, 'test');

function activeTestFiles(): string[] {
  return readdirSync(TEST_ROOT)
    .filter((fileName) => /\.test\.(?:ts|mjs)$/.test(fileName))
    .sort();
}

describe('repository verification architecture', () => {
  it('uses domain contracts instead of the historical umbrella suite', () => {
    expect(existsSync(path.join(TEST_ROOT, 'androidVerification.test.ts'))).toBe(
      false
    );
    for (const fileName of [
      'packageContract.test.ts',
      'docsSemantic.test.mjs',
      'androidSourceContract.test.ts',
      'iosSourceContract.test.ts',
      'workflowSupplyChain.test.mjs',
    ]) {
      expect(existsSync(path.join(TEST_ROOT, fileName)), fileName).toBe(true);
    }
  });

  it('keeps every active repository test below the size ceiling', () => {
    const oversized = activeTestFiles()
      .map((fileName) => ({
        fileName,
        lines: readFileSync(path.join(TEST_ROOT, fileName), 'utf8').split(/\r?\n/)
          .length,
      }))
      .filter(({ lines }) => lines > 2_000);

    expect(oversized).toEqual([]);
  });

  it('does not make active tests depend on archived release documents', () => {
    const archivedReleasePath = ['docs', 'releases', '0.2-history.md'].join('/');
    const legacyDocsPath = ['docs', 'legacy'].join('/');
    const oldAggregateReader = ['read', 'Repository', 'Docs'].join('');
    const violations = activeTestFiles().flatMap((fileName) => {
      const source = readFileSync(path.join(TEST_ROOT, fileName), 'utf8');
      return [archivedReleasePath, legacyDocsPath, oldAggregateReader]
        .filter((value) => source.includes(value))
        .map((value) => `${fileName}: ${value}`);
    });

    expect(violations).toEqual([]);
  });
});
