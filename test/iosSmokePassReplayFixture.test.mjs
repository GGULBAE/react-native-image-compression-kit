import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createIOSSmokePassReplayFixture,
  extractSingleIOSSmokePassSourceLine,
  formatIOSSmokePassReplayFixture,
  validateIOSSmokePassReplayFixture,
} from '../scripts/ios-smoke-pass-replay-fixture.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI_PATH = 'scripts/refresh-ios-smoke-pass-replay.mjs';
const FAKE_SOURCE_LINE =
  'iOS host-app smoke\tRun iOS host-app smoke\t2026-07-10T08:00:00.1234567Z 2026-07-10 08:00:00.120 Df ImageCompressionKitExample[20000:abcd] (ImageCompressionKitExample.debug.dylib) RNICK_IOS_SMOKE_PASS {"platform":"ios","jpegResultBytes":321,"webpOutputAvailable":false,"avifInputAvailable":true,"unsupportedInputs":[],"unsupportedOutputs":["webp","heic","heif","avif"]}';
const FAKE_LOG = [
  'iOS host-app smoke\tRun iOS host-app smoke\t2026-07-10T07:59:59.0000000Z RNICK_IOS_SMOKE_START',
  FAKE_SOURCE_LINE,
  'iOS host-app smoke\tRun iOS host-app smoke\t2026-07-10T08:00:01.0000000Z cleanup complete',
].join('\n');
const FAKE_PROVENANCE_INPUT = Object.freeze({
  workflowName: 'iOS Validation',
  runId: 123456789,
  runUrl:
    'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/123456789',
  headSha: '0123456789abcdef0123456789abcdef01234567',
});

describe('iOS PASS replay fixture artifact', () => {
  it('creates and formats the exact deterministic fixture schema from a fake log', () => {
    const fixture = createIOSSmokePassReplayFixture({
      logText: FAKE_LOG,
      ...FAKE_PROVENANCE_INPUT,
    });
    const expected = {
      schemaVersion: 1,
      provenance: {
        ...FAKE_PROVENANCE_INPUT,
        jobName: 'iOS host-app smoke',
        stepName: 'Run iOS host-app smoke',
        logTimestamp: '2026-07-10T08:00:00.1234567Z',
        sourceLineSha256:
          '750b1447232eb0efb5c7da86ae1ea7a13416024b861b39d5ca4ccbe1d0a04900',
      },
      sourceLine: FAKE_SOURCE_LINE,
    };

    expect(fixture).toEqual(expected);
    expect(Object.keys(fixture)).toEqual([
      'schemaVersion',
      'provenance',
      'sourceLine',
    ]);
    expect(Object.keys(fixture.provenance)).toEqual([
      'workflowName',
      'runId',
      'runUrl',
      'headSha',
      'jobName',
      'stepName',
      'logTimestamp',
      'sourceLineSha256',
    ]);
    expect(validateIOSSmokePassReplayFixture(fixture)).toBe(fixture);
    expect(formatIOSSmokePassReplayFixture(fixture)).toBe(
      `${JSON.stringify(expected, null, 2)}\n`
    );
    expect(
      formatIOSSmokePassReplayFixture(
        createIOSSmokePassReplayFixture({
          logText: FAKE_LOG,
          ...FAKE_PROVENANCE_INPUT,
        })
      )
    ).toBe(formatIOSSmokePassReplayFixture(fixture));
  });

  it('rejects missing, duplicate, malformed, and hash-mismatched source lines', () => {
    expect(() => extractSingleIOSSmokePassSourceLine('no PASS line')).toThrow(
      'Expected exactly one RNICK_IOS_SMOKE_PASS source line, found 0.'
    );
    expect(() =>
      extractSingleIOSSmokePassSourceLine(
        `${FAKE_SOURCE_LINE}\n${FAKE_SOURCE_LINE}`
      )
    ).toThrow(
      'Expected exactly one RNICK_IOS_SMOKE_PASS source line, found 2.'
    );
    expect(() =>
      createIOSSmokePassReplayFixture({
        logText: FAKE_SOURCE_LINE.replace('{"platform"', 'not-json'),
        ...FAKE_PROVENANCE_INPUT,
      })
    ).toThrow('RNICK_IOS_SMOKE_PASS source line payload must be JSON.');

    const fixture = createIOSSmokePassReplayFixture({
      logText: FAKE_LOG,
      ...FAKE_PROVENANCE_INPUT,
    });
    const mismatched = {
      ...fixture,
      provenance: {
        ...fixture.provenance,
        sourceLineSha256: '0'.repeat(64),
      },
    };
    expect(() => validateIOSSmokePassReplayFixture(mismatched)).toThrow(
      'fixture.provenance.sourceLineSha256 does not match the PASS source line.'
    );
    expect(() =>
      createIOSSmokePassReplayFixture({
        logText: FAKE_LOG,
        ...FAKE_PROVENANCE_INPUT,
        runUrl: 'https://example.com/actions/runs/123456789',
      })
    ).toThrow(
      'provenance.runUrl must be an HTTPS GitHub Actions URL for provenance.runId.'
    );
  });

  it('refreshes deterministic fixture files from a fake local log without network access', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'rnick-ios-pass-replay-'));

    try {
      const logPath = join(tempDir, 'actions.log');
      const firstOutput = join(tempDir, 'first.json');
      const secondOutput = join(tempDir, 'second.json');
      writeFileSync(logPath, FAKE_LOG);

      const firstResult = runRefreshCli(logPath, firstOutput);
      const secondResult = runRefreshCli(logPath, secondOutput);

      expect(firstResult.status).toBe(0);
      expect(firstResult.stderr).toBe('');
      expect(firstResult.stdout).toContain(firstOutput);
      expect(secondResult.status).toBe(0);
      expect(secondResult.stderr).toBe('');

      const firstSource = readFileSync(firstOutput, 'utf8');
      const secondSource = readFileSync(secondOutput, 'utf8');
      expect(firstSource).toBe(secondSource);
      expect(firstSource).toBe(
        formatIOSSmokePassReplayFixture(
          createIOSSmokePassReplayFixture({
            logText: FAKE_LOG,
            ...FAKE_PROVENANCE_INPUT,
          })
        )
      );

      const cliSource = readFileSync(join(ROOT, CLI_PATH), 'utf8');
      expect(cliSource).not.toMatch(
        /node:(?:child_process|http|https|net|tls)/
      );
      expect(cliSource).not.toContain('fetch(');
      expect(cliSource).not.toContain('gh run');
      expect(cliSource).toContain('This command performs no network access.');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.each([
    ['missing', 'no PASS line', 'found 0'],
    ['duplicate', `${FAKE_SOURCE_LINE}\n${FAKE_SOURCE_LINE}`, 'found 2'],
  ])('rejects a %s PASS source line in the CLI fake log', (_, logText, error) => {
    const tempDir = mkdtempSync(join(tmpdir(), 'rnick-ios-pass-replay-error-'));

    try {
      const logPath = join(tempDir, 'actions.log');
      const outputPath = join(tempDir, 'fixture.json');
      writeFileSync(logPath, logText);

      const result = runRefreshCli(logPath, outputPath);

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(
        'iOS PASS replay fixture refresh failed:'
      );
      expect(result.stderr).toContain(error);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

function runRefreshCli(logPath, outputPath) {
  return spawnSync(
    process.execPath,
    [
      CLI_PATH,
      '--',
      '--log-file',
      logPath,
      '--workflow-name',
      FAKE_PROVENANCE_INPUT.workflowName,
      '--run-id',
      String(FAKE_PROVENANCE_INPUT.runId),
      '--run-url',
      FAKE_PROVENANCE_INPUT.runUrl,
      '--head-sha',
      FAKE_PROVENANCE_INPUT.headSha,
      '--output',
      outputPath,
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
    }
  );
}
