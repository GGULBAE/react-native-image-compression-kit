import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
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
  getIOSSmokePassReplayFixtureDifferences,
  getIOSSmokePassReplayFixtureValidationDifferences,
  validateIOSSmokePassReplayFixture,
} from '../scripts/ios-smoke-pass-replay-fixture.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI_PATH = 'scripts/refresh-ios-smoke-pass-replay.mjs';
const FAKE_PASS_PAYLOAD = Object.freeze({
  platform: 'ios',
  jpegResultBytes: 321,
  jpegPreserveResultBytes: 322,
  pngResultBytes: 323,
  gifResultBytes: 324,
  webpResultBytes: 325,
  heicResultBytes: 326,
  heifResultBytes: 327,
  avifResultBytes: 328,
  jpegToPngResultBytes: 329,
  pngToPngResultBytes: 330,
  gifToPngResultBytes: 331,
  webpToPngResultBytes: 332,
  heicToPngResultBytes: 333,
  heifToPngResultBytes: 334,
  avifToPngResultBytes: 335,
  webpOutputAvailable: false,
  avifInputAvailable: true,
  targetSizeResultBytes: 336,
  unsupportedInputs: [],
  unsupportedOutputs: ['webp', 'heic', 'heif', 'avif'],
});
const FAKE_SOURCE_PREFIX =
  'iOS host-app smoke\tRun iOS host-app smoke\t2026-07-10T08:00:00.1234567Z 2026-07-10 08:00:00.120 Df ImageCompressionKitExample[20000:abcd] (ImageCompressionKitExample.debug.dylib) RNICK_IOS_SMOKE_PASS ';
const FAKE_SOURCE_LINE = `${FAKE_SOURCE_PREFIX}${JSON.stringify(FAKE_PASS_PAYLOAD)}`;
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
    const fixture = createFakeFixture();
    const expected = {
      schemaVersion: 1,
      provenance: {
        ...FAKE_PROVENANCE_INPUT,
        jobName: 'iOS host-app smoke',
        stepName: 'Run iOS host-app smoke',
        logTimestamp: '2026-07-10T08:00:00.1234567Z',
        sourceLineSha256:
          '24963b407b241f17726a343278f906af59f6cac3ca749c2e790fe1497ad5c957',
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
    expect(formatIOSSmokePassReplayFixture(createFakeFixture())).toBe(
      formatIOSSmokePassReplayFixture(fixture)
    );
  });

  it('rejects missing, duplicate, malformed, semantic-invalid, and hash-mismatched source lines', () => {
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
    expect(() =>
      createIOSSmokePassReplayFixture({
        logText: FAKE_SOURCE_LINE.replace(
          '"jpegResultBytes":321',
          '"jpegResultBytes":0'
        ),
        ...FAKE_PROVENANCE_INPUT,
      })
    ).toThrow(
      'RNICK_IOS_SMOKE_PASS payload contract is invalid; differences: payload.jpegResultBytes.'
    );

    const fixture = createFakeFixture();
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

  it('reports deterministic comparison and semantic validation differences', () => {
    const expected = createFakeFixture();
    const actual = {
      ...expected,
      schemaVersion: 2,
      provenance: {
        ...expected.provenance,
        workflowName: 'Previous iOS Validation',
        sourceLineSha256: '0'.repeat(64),
      },
      sourceLine: `${FAKE_SOURCE_LINE} `,
    };

    expect(getIOSSmokePassReplayFixtureDifferences(expected, actual)).toEqual([
      'schemaVersion',
      'provenance.workflowName',
      'provenance.sourceLineSha256',
      'sourceLine',
    ]);

    const invalidPayloadSourceLine = FAKE_SOURCE_LINE.replace(
      '"platform":"ios"',
      '"platform":"android"'
    );
    const invalidPayloadFixture = {
      ...expected,
      provenance: {
        ...expected.provenance,
        sourceLineSha256: sha256(invalidPayloadSourceLine),
      },
      sourceLine: invalidPayloadSourceLine,
    };
    expect(
      getIOSSmokePassReplayFixtureValidationDifferences(invalidPayloadFixture)
    ).toEqual(['payload.platform']);
  });

  it('refreshes deterministic fixture files from a fake local log without network access', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'rnick-ios-pass-replay-'));

    try {
      const logPath = join(tempDir, 'actions.log');
      const firstOutput = join(tempDir, 'first.json');
      const secondOutput = join(tempDir, 'second.json');
      writeFileSync(logPath, FAKE_LOG);

      const firstResult = runReplayCli({ logPath, outputPath: firstOutput });
      const secondResult = runReplayCli({ logPath, outputPath: secondOutput });

      expect(firstResult.status).toBe(0);
      expect(firstResult.stderr).toBe('');
      expect(firstResult.stdout).toContain(firstOutput);
      expect(secondResult.status).toBe(0);
      expect(secondResult.stderr).toBe('');

      const firstSource = readFileSync(firstOutput, 'utf8');
      const secondSource = readFileSync(secondOutput, 'utf8');
      expect(firstSource).toBe(secondSource);
      expect(firstSource).toBe(
        formatIOSSmokePassReplayFixture(createFakeFixture())
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

  it('checks a current fake-log artifact without modifying it', () => {
    withTempFixture('rnick-ios-pass-check-', ({ logPath, outputPath }) => {
      writeFileSync(logPath, FAKE_LOG);
      expect(runReplayCli({ logPath, outputPath }).status).toBe(0);

      const before = snapshotFile(outputPath);
      const result = runReplayCli({ mode: 'check', logPath, outputPath });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `iOS PASS replay fixture is current: ${outputPath}\n`
      );
      expectFileUnchanged(outputPath, before);
    });
  });

  it('rejects stale provenance without modifying the artifact', () => {
    withTempFixture('rnick-ios-pass-stale-', ({ logPath, outputPath }) => {
      writeFileSync(logPath, FAKE_LOG);
      writeFileSync(
        outputPath,
        formatIOSSmokePassReplayFixture(
          createIOSSmokePassReplayFixture({
            logText: FAKE_LOG,
            ...FAKE_PROVENANCE_INPUT,
            workflowName: 'Previous iOS Validation',
          })
        )
      );

      const before = snapshotFile(outputPath);
      const result = runReplayCli({ mode: 'check', logPath, outputPath });

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(
        'Fixture artifact is stale; differences: provenance.workflowName.'
      );
      expectFileUnchanged(outputPath, before);
    });
  });

  it('rejects source-line drift and reports its digest without modifying the artifact', () => {
    withTempFixture('rnick-ios-pass-source-', ({ logPath, outputPath }) => {
      const previousLog = FAKE_LOG.replaceAll(
        '2026-07-10T08:00:00.1234567Z',
        '2026-07-09T08:00:00.1234567Z'
      );
      writeFileSync(logPath, FAKE_LOG);
      writeFileSync(
        outputPath,
        formatIOSSmokePassReplayFixture(
          createIOSSmokePassReplayFixture({
            logText: previousLog,
            ...FAKE_PROVENANCE_INPUT,
          })
        )
      );

      const before = snapshotFile(outputPath);
      const result = runReplayCli({ mode: 'check', logPath, outputPath });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('provenance.logTimestamp');
      expect(result.stderr).toContain('provenance.sourceLineSha256');
      expect(result.stderr).toContain('sourceLine');
      expectFileUnchanged(outputPath, before);
    });
  });

  it.each([
    ['missing', undefined, 'Fixture artifact not found:'],
    ['malformed', '{not-json}\n', 'Fixture artifact JSON is invalid:'],
    [
      'invalid schema',
      `${JSON.stringify({ schemaVersion: 2, provenance: {}, sourceLine: '' })}\n`,
      'Fixture artifact is invalid; differences: schemaVersion, provenance.schema',
    ],
  ])('rejects a %s artifact without creating or modifying it', (_, source, error) => {
    withTempFixture('rnick-ios-pass-invalid-', ({ logPath, outputPath }) => {
      writeFileSync(logPath, FAKE_LOG);
      if (source !== undefined) {
        writeFileSync(outputPath, source);
      }

      const before = source === undefined ? null : snapshotFile(outputPath);
      const result = runReplayCli({ mode: 'check', logPath, outputPath });

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(
        'iOS PASS replay fixture check failed:'
      );
      expect(result.stderr).toContain(error);
      if (before) {
        expectFileUnchanged(outputPath, before);
      } else {
        expect(() => statSync(outputPath)).toThrow();
      }
    });
  });

  it('rejects noncanonical artifact bytes without modifying them', () => {
    withTempFixture('rnick-ios-pass-format-', ({ logPath, outputPath }) => {
      writeFileSync(logPath, FAKE_LOG);
      writeFileSync(outputPath, JSON.stringify(createFakeFixture()));

      const before = snapshotFile(outputPath);
      const result = runReplayCli({ mode: 'check', logPath, outputPath });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'Fixture artifact is stale; differences: canonicalFormat.'
      );
      expectFileUnchanged(outputPath, before);
    });
  });

  it('audits the committed artifact without a source log or file writes', () => {
    const artifactPath = join(
      ROOT,
      'test/fixtures/ios-smoke-pass-ci-replay.json'
    );
    const before = snapshotFile(artifactPath);
    const result = runReplayCli({ mode: 'audit', outputPath: artifactPath });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(
      `iOS PASS replay fixture audit passed: ${artifactPath}\n`
    );
    expectFileUnchanged(artifactPath, before);
  });

  it('snapshots current check and audit JSON stdout contracts', () => {
    withTempFixture('rnick-ios-pass-json-current-', ({ logPath, outputPath }) => {
      writeFileSync(logPath, FAKE_LOG);
      writeFileSync(outputPath, formatIOSSmokePassReplayFixture(createFakeFixture()));
      const before = snapshotFile(outputPath);

      const checkResult = runReplayCli({
        mode: 'check',
        logPath,
        outputPath,
        json: true,
      });
      const auditResult = runReplayCli({
        mode: 'audit',
        outputPath,
        json: true,
      });

      expectJSONResult(checkResult, outputPath, {
        schemaVersion: 1,
        mode: 'check',
        status: 'current',
        artifactPath: '<artifact>',
        differences: [],
        error: null,
      });
      expectJSONResult(auditResult, outputPath, {
        schemaVersion: 1,
        mode: 'audit',
        status: 'current',
        artifactPath: '<artifact>',
        differences: [],
        error: null,
      });
      expectFileUnchanged(outputPath, before);
    });
  });

  it('snapshots stale check JSON stdout without modifying the artifact', () => {
    withTempFixture('rnick-ios-pass-json-stale-', ({ logPath, outputPath }) => {
      writeFileSync(logPath, FAKE_LOG);
      writeFileSync(
        outputPath,
        formatIOSSmokePassReplayFixture(
          createIOSSmokePassReplayFixture({
            logText: FAKE_LOG,
            ...FAKE_PROVENANCE_INPUT,
            workflowName: 'Previous iOS Validation',
          })
        )
      );
      const before = snapshotFile(outputPath);
      const result = runReplayCli({
        mode: 'check',
        logPath,
        outputPath,
        json: true,
      });

      expectJSONResult(
        result,
        outputPath,
        {
          schemaVersion: 1,
          mode: 'check',
          status: 'stale',
          artifactPath: '<artifact>',
          differences: ['provenance.workflowName'],
          error:
            'Fixture artifact is stale; differences: provenance.workflowName.',
        },
        1
      );
      expectFileUnchanged(outputPath, before);
    });
  });

  it.each([
    {
      name: 'noncanonical',
      source: () => JSON.stringify(createFakeFixture()),
      expected: {
        status: 'stale',
        differences: ['canonicalFormat'],
        error: 'Fixture artifact is stale; differences: canonicalFormat.',
      },
    },
    {
      name: 'missing',
      source: () => undefined,
      expected: {
        status: 'invalid',
        differences: [],
        error: 'Fixture artifact not found: <artifact>.',
      },
    },
    {
      name: 'malformed',
      source: () => '{not-json}\n',
      expected: {
        status: 'invalid',
        differences: [],
        error: 'Fixture artifact JSON is invalid: <artifact>.',
      },
    },
    {
      name: 'schema-invalid',
      source: () => {
        const fixture = { ...createFakeFixture(), schemaVersion: 2 };
        return `${JSON.stringify(fixture, null, 2)}\n`;
      },
      expected: {
        status: 'invalid',
        differences: ['schemaVersion'],
        error:
          'Fixture artifact is invalid; differences: schemaVersion. iOS smoke PASS replay fixture schemaVersion must be 1.',
      },
    },
    {
      name: 'payload-invalid',
      source: () => formatInvalidPayloadFixture(),
      expected: {
        status: 'invalid',
        differences: ['payload.platform'],
        error:
          'Fixture artifact is invalid; differences: payload.platform. RNICK_IOS_SMOKE_PASS payload contract is invalid; differences: payload.platform.',
      },
    },
  ])('snapshots $name audit JSON stdout without file writes', ({ source, expected }) => {
    withTempFixture('rnick-ios-pass-json-audit-', ({ outputPath }) => {
      const artifactSource = source();
      if (artifactSource !== undefined) {
        writeFileSync(outputPath, artifactSource);
      }
      const before = artifactSource === undefined ? null : snapshotFile(outputPath);
      const result = runReplayCli({
        mode: 'audit',
        outputPath,
        json: true,
      });

      expectJSONResult(
        result,
        outputPath,
        {
          schemaVersion: 1,
          mode: 'audit',
          status: expected.status,
          artifactPath: '<artifact>',
          differences: expected.differences,
          error: expected.error,
        },
        1
      );
      if (before) {
        expectFileUnchanged(outputPath, before);
      } else {
        expect(() => statSync(outputPath)).toThrow();
      }
    });
  });

  it('rejects conflicting CLI modes and pins text and JSON stream behavior', () => {
    const artifactPath = join(ROOT, 'test/fixtures/ios-smoke-pass-ci-replay.json');
    const textResult = runRawCli([
      '--check',
      '--audit',
      '--output',
      artifactPath,
    ]);
    expect(textResult.status).toBe(1);
    expect(textResult.stdout).toBe('');
    expect(textResult.stderr).toBe(
      'iOS PASS replay fixture check failed: --check and --audit cannot be used together.\n'
    );

    const jsonResult = runRawCli([
      '--check',
      '--audit',
      '--json',
      '--output',
      artifactPath,
    ]);
    expectJSONResult(
      jsonResult,
      artifactPath,
      {
        schemaVersion: 1,
        mode: 'check',
        status: 'invalid',
        artifactPath: '<artifact>',
        differences: [],
        error: '--check and --audit cannot be used together.',
      },
      1
    );

    const auditSourceResult = runRawCli([
      '--audit',
      '--json',
      '--log-file',
      '/tmp/actions.log',
      '--output',
      artifactPath,
    ]);
    expectJSONResult(
      auditSourceResult,
      artifactPath,
      {
        schemaVersion: 1,
        mode: 'audit',
        status: 'invalid',
        artifactPath: '<artifact>',
        differences: [],
        error: '--audit cannot be combined with source options: --log-file.',
      },
      1
    );

    const refreshJsonResult = runRawCli([
      '--json',
      '--output',
      artifactPath,
    ]);
    expectJSONResult(
      refreshJsonResult,
      artifactPath,
      {
        schemaVersion: 1,
        mode: 'refresh',
        status: 'invalid',
        artifactPath: '<artifact>',
        differences: [],
        error: '--json requires --check or --audit.',
      },
      1
    );
  });

  it.each([
    ['missing', 'no PASS line', 'found 0'],
    ['duplicate', `${FAKE_SOURCE_LINE}\n${FAKE_SOURCE_LINE}`, 'found 2'],
  ])('rejects a %s PASS source line in the CLI fake log', (_, logText, error) => {
    withTempFixture('rnick-ios-pass-replay-error-', ({ logPath, outputPath }) => {
      writeFileSync(logPath, logText);
      const result = runReplayCli({ logPath, outputPath });

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(
        'iOS PASS replay fixture refresh failed:'
      );
      expect(result.stderr).toContain(error);
    });
  });
});

function createFakeFixture() {
  return createIOSSmokePassReplayFixture({
    logText: FAKE_LOG,
    ...FAKE_PROVENANCE_INPUT,
  });
}

function formatInvalidPayloadFixture() {
  const fixture = createFakeFixture();
  const sourceLine = fixture.sourceLine.replace(
    '"platform":"ios"',
    '"platform":"android"'
  );
  const invalidFixture = {
    ...fixture,
    provenance: {
      ...fixture.provenance,
      sourceLineSha256: sha256(sourceLine),
    },
    sourceLine,
  };
  return `${JSON.stringify(invalidFixture, null, 2)}\n`;
}

function runReplayCli({
  mode = 'refresh',
  logPath,
  outputPath,
  json = false,
}) {
  const sourceArgs =
    mode === 'audit'
      ? []
      : [
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
        ];
  return runRawCli([
    ...(mode === 'check' ? ['--check'] : []),
    ...(mode === 'audit' ? ['--audit'] : []),
    ...(json ? ['--json'] : []),
    ...sourceArgs,
    '--output',
    outputPath,
  ]);
}

function runRawCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, '--', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function expectJSONResult(result, outputPath, expected, status = 0) {
  expect(result.status).toBe(status);
  expect(result.stderr).toBe('');
  expect(result.stdout.replaceAll(outputPath, '<artifact>')).toBe(
    `${JSON.stringify(expected)}\n`
  );
}

function withTempFixture(prefix, callback) {
  const tempDir = mkdtempSync(join(tmpdir(), prefix));

  try {
    callback({
      tempDir,
      logPath: join(tempDir, 'actions.log'),
      outputPath: join(tempDir, 'fixture.json'),
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function snapshotFile(filePath) {
  return {
    source: readFileSync(filePath, 'utf8'),
    modified: statSync(filePath).mtimeMs,
  };
}

function expectFileUnchanged(filePath, before) {
  expect(readFileSync(filePath, 'utf8')).toBe(before.source);
  expect(statSync(filePath).mtimeMs).toBe(before.modified);
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
