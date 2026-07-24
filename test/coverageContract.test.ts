import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COVERAGE_EXCLUDE,
  COVERAGE_INCLUDE,
  COVERAGE_THRESHOLDS,
} from '../coverage.config';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VITEST_CLI = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');

describe('coverage regression gate', () => {
  it('gates every metric at the rounded measured baseline', () => {
    expect(COVERAGE_THRESHOLDS).toEqual({
      statements: 94,
      branches: 83,
      functions: 98,
      lines: 94,
    });
    expect(COVERAGE_INCLUDE).toEqual(
      expect.arrayContaining([
        'src/api.ts',
        'src/nativeModule.ts',
        'scripts/*-core.mjs',
        'scripts/registry-health-report.mjs',
      ])
    );
    expect(COVERAGE_EXCLUDE).toEqual(
      expect.arrayContaining([
        'src/NativeImageCompressionKit.ts',
        'src/index.ts',
        '**/generated/**',
        'test/fixtures/**',
        'evidence/**',
        'scripts/verify-*.mjs',
      ])
    );
    expect(readFileSync(path.join(ROOT, '.gitignore'), 'utf8')).toMatch(
      /^coverage\/$/m
    );
  });

  it('fails a mutation that drops executable coverage below threshold', () => {
    const fixtureRoot = mkdtempSync(
      path.join(os.tmpdir(), 'rnick-coverage-threshold-')
    );
    const configFile = path.join(fixtureRoot, 'vitest.config.mjs');
    const sourceFile = path.join(fixtureRoot, 'source.mjs');
    const testFile = path.join(fixtureRoot, 'threshold.test.mjs');

    try {
      writeFileSync(
        sourceFile,
        `export function choose(value) {
  if (value) return 'covered';
  return 'uncovered';
}
`,
        'utf8'
      );
      writeFileSync(
        testFile,
        `it('covers one branch', async () => {
  const { choose } = await import('./source.mjs');
  expect(choose(true)).toBe('covered');
});
`,
        'utf8'
      );
      writeFileSync(
        configFile,
        `export default {
  root: ${JSON.stringify(fixtureRoot)},
  test: {
    globals: true,
    include: ['threshold.test.mjs'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text'],
      reportsDirectory: 'coverage',
      include: ['source.mjs'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
};
`,
        'utf8'
      );

      const result = spawnSync(
        process.execPath,
        [VITEST_CLI, 'run', '--config', configFile],
        {
          cwd: ROOT,
          encoding: 'utf8',
        }
      );

      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(
        /Coverage for (?:branches|lines|statements).*does not meet global threshold/
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
