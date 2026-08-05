import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  buildBenchmarkEvidence,
  inspectBenchmarkEvidence,
  inspectNativeBenchmarkPayload,
  parseNativeBenchmarkPayload,
  summarizeBenchmarkSamples,
} from '../scripts/benchmark-core.mjs';

const SOURCE_COMMIT = 'a'.repeat(40);

describe('native benchmark evidence', () => {
  it('fails clearly when the native marker is missing or malformed', () => {
    expect(() => parseNativeBenchmarkPayload('unrelated log')).toThrow(
      'RNICK_BENCHMARK_PASS payload is missing'
    );
    expect(() =>
      parseNativeBenchmarkPayload('RNICK_BENCHMARK_PASS {not-json}')
    ).toThrow('RNICK_BENCHMARK_PASS payload is invalid');
  });

  it('parses the final native marker and summarizes distributions deterministically', () => {
    const payload = createPayload();
    const older = { ...payload, platform: 'ios' };
    const parsed = parseNativeBenchmarkPayload(
      `RNICK_BENCHMARK_PASS ${JSON.stringify(older)}\n` +
        `RNICK_BENCHMARK_PASS ${JSON.stringify(payload)}\n`
    );

    expect(parsed.platform).toBe('android');
    expect(summarizeBenchmarkSamples(payload.samples)).toEqual({
      elapsedMs: { min: 1, median: 5.5, p95: 10, max: 10 },
      outputBytes: { min: 101, median: 105.5, max: 110 },
      dimensions: [{ width: 200, height: 320, count: 10 }],
    });
  });

  it('summarizes odd sample counts and multiple output dimensions', () => {
    const samples = createPayload().samples.slice(0, 3);
    samples[2].result.width = 320;
    samples[2].result.height = 200;
    expect(summarizeBenchmarkSamples(samples)).toMatchObject({
      elapsedMs: { min: 1, median: 2, p95: 3, max: 3 },
      outputBytes: { min: 101, median: 102, max: 103 },
      dimensions: [
        { width: 200, height: 320, count: 2 },
        { width: 320, height: 200, count: 1 },
      ],
    });
  });

  it('accepts a schema-valid result tied to its fixture and workflow run', () => {
    const fixture = createEvidenceFixture();
    expect(inspectNativeBenchmarkPayload(fixture.payload)).toEqual([]);
    expect(inspectBenchmarkEvidence(fixture.root, fixture.evidence)).toMatchObject({
      status: 'passed',
      benchmarkId: 'jpeg-resize-q80',
      platform: 'android',
      measuredIterations: 10,
      error: null,
    });
  });

  it('rejects malformed native samples before evidence is built', () => {
    expect(inspectNativeBenchmarkPayload({ ...createPayload(), samples: [] }).join(' | '))
      .toContain('samples must be a non-empty array');

    const invalidIteration = createPayload();
    invalidIteration.samples[0].iteration = 0;
    expect(inspectNativeBenchmarkPayload(invalidIteration).join(' | ')).toContain(
      'sample iteration must be a positive integer'
    );

    const invalidElapsed = createPayload();
    invalidElapsed.samples[0].elapsedMs = Number.NaN;
    expect(inspectNativeBenchmarkPayload(invalidElapsed).join(' | ')).toContain(
      'elapsedMs must be positive'
    );

    const invalidRatio = createPayload();
    invalidRatio.samples[1].result.compressionRatio = 0.1;
    expect(inspectNativeBenchmarkPayload(invalidRatio).join(' | ')).toContain(
      'compressionRatio is inconsistent'
    );

    const invalidResult = createPayload();
    invalidResult.samples[0].result.format = 'png';
    expect(inspectNativeBenchmarkPayload(invalidResult).join(' | ')).toContain(
      'sample 1 result is invalid'
    );

    const missingSample = createPayload();
    missingSample.samples.pop();
    expect(inspectNativeBenchmarkPayload(missingSample).join(' | ')).toContain(
      'sample count must match measuredIterations'
    );

    expect(() =>
      buildBenchmarkEvidence({
        payload: invalidElapsed,
        packageVersion: '0.4.0',
        sourceCommit: SOURCE_COMMIT,
        capturedAt: '2026-08-05T00:00:00.000Z',
        runtime: 'Android 15 / API 35',
        device: 'Google Pixel 6',
        runUrl:
          'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/1',
        sourceAsset: { file: 'source.jpg', byteSize: 1_000, sha256: 'b'.repeat(64) },
      })
    ).toThrow('elapsedMs must be positive');
  });

  it('rejects digest, provenance, environment, iteration, and summary drift', () => {
    const fixture = createEvidenceFixture();
    fixture.evidence.fixture.sha256 = '0'.repeat(64);
    fixture.evidence.runUrl = 'local://benchmark';
    fixture.evidence.environment.architecture = 'unknown';
    fixture.evidence.samples[1].iteration = 4;
    fixture.evidence.summary.elapsedMs.median = 0;

    const report = inspectBenchmarkEvidence(fixture.root, fixture.evidence);
    expect(report.status).toBe('failed');
    expect(report.error).toContain('fixture SHA-256 mismatch');
    expect(report.error).toContain('capture workflow run');
    expect(report.error).toContain('architecture must be legacy or new');
    expect(report.error).toContain('sample iterations must be sequential from 1');
    expect(report.error).toContain('summary does not match the raw samples');
  });

  it('does not allow fixture paths to escape the evidence directory', () => {
    const fixture = createEvidenceFixture();
    fixture.evidence.fixture.file = '../source.jpg';
    expect(inspectBenchmarkEvidence(fixture.root, fixture.evidence).error).toContain(
      'fixture file is missing'
    );
  });

  it('reports incomplete identity, operation, environment, and iteration metadata', () => {
    const fixture = createEvidenceFixture();
    Object.assign(fixture.evidence, {
      schemaVersion: 2,
      status: 'failed',
      benchmarkId: 'Invalid ID',
      sourceCommit: 'short',
      capturedAt: 'not-a-date',
      warmupIterations: 0,
      measuredIterations: 0,
      samples: [],
    });
    fixture.evidence.implementation = { name: 'other', version: '^0.4.0' };
    fixture.evidence.environment = {
      platform: 'web',
      runtime: '',
      device: '',
      architecture: 'unknown',
    };
    fixture.evidence.fixture = {
      id: 'Invalid fixture',
      file: '/tmp/source.jpg',
      byteSize: 0,
      sha256: 'invalid',
    };
    fixture.evidence.operation = {
      resize: { maxWidth: 0, maxHeight: 0, mode: 'unknown' },
      output: { format: 'png', quality: 101 },
      metadata: 'unknown',
    };

    const error = inspectBenchmarkEvidence(fixture.root, fixture.evidence).error;
    expect(error).toContain('schemaVersion must be 1');
    expect(error).toContain('implementation version must be an exact semantic version');
    expect(error).toContain('environment runtime and device are required');
    expect(error).toContain('operation resize is invalid');
    expect(error).toContain('operation output must be JPEG');
    expect(error).toContain('samples must be a non-empty array');
  });

  it('creates and verifies a canonical artifact, then fails closed on mutation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'rnick-benchmark-cli-'));
    const source = path.join(root, 'input.jpg');
    const log = path.join(root, 'native.log');
    const artifact = path.join(root, 'artifact');
    writeFileSync(source, Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(998, 1)]));
    writeFileSync(
      log,
      `RNICK_BENCHMARK_PASS ${JSON.stringify(createPayload())}\n`
    );

    const create = spawnSync(
      process.execPath,
      [
        'scripts/create-benchmark-evidence.mjs',
        '--platform',
        'android',
        '--package-version',
        '0.4.0',
        '--source-sha',
        SOURCE_COMMIT,
        '--runtime',
        'Android 15 / API 35',
        '--device',
        'Google Pixel 6',
        '--source',
        source,
        '--log',
        log,
        '--destination',
        artifact,
        '--run-url',
        'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/1',
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    );
    expect(create.status, create.stderr).toBe(0);
    expect(JSON.parse(create.stdout)).toMatchObject({ status: 'passed' });

    const verify = runVerifier(artifact);
    expect(verify.status, verify.stderr).toBe(0);
    expect(JSON.parse(verify.stdout)).toMatchObject({ status: 'passed' });

    const evidencePath = path.join(artifact, 'benchmark.json');
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    evidence.samples[0].elapsedMs = 0;
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    const mutated = runVerifier(artifact);
    expect(mutated.status).toBe(1);
    expect(JSON.parse(mutated.stdout)).toMatchObject({
      status: 'failed',
    });
    expect(mutated.stdout).toContain('elapsedMs must be positive');
  });
});

function createEvidenceFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rnick-benchmark-'));
  const source = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    Buffer.alloc(998, 1),
  ]);
  writeFileSync(path.join(root, 'source.jpg'), source);
  const payload = createPayload();
  const evidence = buildBenchmarkEvidence({
    payload,
    packageVersion: '0.4.0',
    sourceCommit: SOURCE_COMMIT,
    capturedAt: '2026-08-05T00:00:00.000Z',
    runtime: 'Android 15 / API 35',
    device: 'Google Pixel 6',
    runUrl:
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/1',
    sourceAsset: {
      file: 'source.jpg',
      byteSize: source.length,
      sha256: createHash('sha256').update(source).digest('hex'),
    },
  });
  return { root, payload, evidence };
}

function createPayload() {
  return {
    schemaVersion: 1,
    benchmarkId: 'jpeg-resize-q80',
    implementation: { name: 'react-native-image-compression-kit' },
    platform: 'android',
    architecture: 'new',
    fixture: {
      id: 'bundled-jpeg',
      sourceUri: 'file:///tmp/source.jpg',
    },
    operation: {
      resize: { maxWidth: 320, maxHeight: 320, mode: 'contain' },
      output: { format: 'jpeg', quality: 80 },
      metadata: 'strip',
    },
    warmupIterations: 2,
    measuredIterations: 10,
    samples: Array.from({ length: 10 }, (_, index) => {
      const byteSize = 101 + index;
      return {
        iteration: index + 1,
        elapsedMs: index + 1,
        result: {
          format: 'jpeg',
          width: 200,
          height: 320,
          byteSize,
          originalByteSize: 1_000,
          compressionRatio: byteSize / 1_000,
        },
      };
    }),
  };
}

function runVerifier(artifact) {
  return spawnSync(
    process.execPath,
    [
      'scripts/verify-benchmark-evidence.mjs',
      '--artifact-dir',
      artifact,
    ],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
}
