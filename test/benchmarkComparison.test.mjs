import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  buildComparisonEvidence,
  inspectComparisonEvidence,
  inspectComparisonPlan,
  inspectNativeComparisonPayload,
  parseNativeComparisonPayload,
  summarizeComparisonSamples,
} from '../scripts/benchmark-comparison-core.mjs';

const PLAN_PATH = 'benchmarks/native-comparison/implementations.json';
const SOURCE_SHA = 'a'.repeat(40);

describe('native comparison benchmark evidence', () => {
  it('pins one workspace implementation and two external MIT implementations', () => {
    const plan = readPlan();
    expect(inspectComparisonPlan(plan)).toEqual([]);
    expect(plan.implementations).toMatchObject([
      {
        id: 'react-native-image-compression-kit',
        version: '0.4.1',
        sourceCommit: 'workspace',
        license: 'MIT',
      },
      {
        id: 'react-native-compressor',
        version: '1.19.4',
        sourceCommit: 'fdda5a45e43113b9d615a876a46a90bae0e153e3',
        license: 'MIT',
      },
      {
        id: 'bam-image-resizer',
        version: '3.0.11',
        sourceCommit: 'd085f0652257d780b643da5e99369451d6a48330',
        license: 'MIT',
      },
    ]);

    const rootPackage = JSON.parse(readFileSync('package.json', 'utf8'));
    const examplePackage = JSON.parse(readFileSync('example/package.json', 'utf8'));
    expect(rootPackage.version).toBe(plan.implementations[0].version);
    for (const implementation of plan.implementations.slice(1)) {
      expect(examplePackage.dependencies[implementation.package]).toBe(
        implementation.version
      );
      expect(rootPackage.dependencies ?? {}).not.toHaveProperty(implementation.package);
      expect(rootPackage.devDependencies ?? {}).not.toHaveProperty(
        implementation.package
      );
    }
    for (const dependency of plan.supportDependencies) {
      expect(examplePackage.dependencies[dependency.package]).toBe(dependency.version);
    }

    const podfile = readFileSync('example/ios/Podfile', 'utf8');
    expect(podfile).toContain("ENV['RCT_USE_RN_DEP'] = '0'");
    expect(podfile).toContain("ENV['RCT_USE_PREBUILT_RNCORE'] = '0'");

    const androidManifest = readFileSync(
      'example/android/app/src/main/AndroidManifest.xml',
      'utf8'
    );
    expect(androidManifest).toContain(
      'xmlns:tools="http://schemas.android.com/tools"'
    );
    expect(androidManifest).toContain('android:allowBackup="false"');
    expect(androidManifest).toContain('tools:replace="android:allowBackup"');
  });

  it('round-trips the final bounded comparison marker and summarizes samples', () => {
    const payload = createPayload();
    const older = { ...payload, platform: 'ios' };
    const parsed = parseNativeComparisonPayload(
      createChunkedLog(older, 'comparison-old') +
        createChunkedLog(payload, 'comparison-current')
    );
    expect(parsed).toEqual(payload);
    expect(summarizeComparisonSamples(payload.implementations[0].samples)).toEqual({
      elapsedMs: { min: 1, median: 5.5, p95: 10, max: 10 },
      outputBytes: { min: 101, median: 105.5, max: 110 },
      dimensions: [{ width: 200, height: 320, count: 10 }],
    });

    const varied = structuredClone(payload.implementations[0].samples.slice(0, 3));
    varied[0].result = { ...varied[0].result, width: 320, height: 200 };
    expect(summarizeComparisonSamples(varied)).toMatchObject({
      elapsedMs: { median: 2, p95: 3 },
      outputBytes: { median: 102 },
      dimensions: [
        { width: 200, height: 320, count: 2 },
        { width: 320, height: 200, count: 1 },
      ],
    });
  });

  it('rejects missing, malformed, incomplete, duplicated, and inconsistent chunks', () => {
    expect(() => parseNativeComparisonPayload('')).toThrow('payload is missing');
    expect(() =>
      parseNativeComparisonPayload(
        'RNICK_BENCHMARK_COMPARISON_PASS comparison-a 0\n'
      )
    ).toThrow('chunk count is invalid');
    expect(() =>
      parseNativeComparisonPayload(
        'RNICK_BENCHMARK_COMPARISON_CHUNK comparison-a 1/1 {bad}\n' +
          'RNICK_BENCHMARK_COMPARISON_PASS comparison-a 1\n'
      )
    ).toThrow('payload is invalid');
    expect(() =>
      parseNativeComparisonPayload(
        'RNICK_BENCHMARK_COMPARISON_CHUNK comparison-a 1/2 {}\n' +
          'RNICK_BENCHMARK_COMPARISON_PASS comparison-a 2\n'
      )
    ).toThrow('payload is incomplete');
    expect(() =>
      parseNativeComparisonPayload(
        'RNICK_BENCHMARK_COMPARISON_CHUNK comparison-a 1/2 {\n' +
          'RNICK_BENCHMARK_COMPARISON_CHUNK comparison-a 1/2 }\n' +
          'RNICK_BENCHMARK_COMPARISON_PASS comparison-a 2\n'
      )
    ).toThrow('chunk sequence is invalid');
    expect(() =>
      parseNativeComparisonPayload(
        'RNICK_BENCHMARK_COMPARISON_CHUNK comparison-a 1/3 {\n' +
          'RNICK_BENCHMARK_COMPARISON_CHUNK comparison-a 2/3 }\n' +
          'RNICK_BENCHMARK_COMPARISON_PASS comparison-a 2\n'
      )
    ).toThrow('chunk sequence is invalid');
  });

  it('accepts a plan-matched payload with one position permutation per iteration', () => {
    const plan = readPlan();
    const payload = createPayload();
    expect(inspectNativeComparisonPayload(payload, plan)).toEqual([]);

    const fixture = createEvidenceFixture();
    expect(inspectComparisonEvidence(fixture.root, fixture.evidence)).toMatchObject({
      status: 'passed',
      benchmarkId: 'jpeg-resize-q80',
      planId: 'native-image-libraries-v1',
      platform: 'android',
      error: null,
    });
  });

  it('fails closed on identity, operation, schedule, sample, and summary drift', () => {
    const plan = readPlan();
    const payload = createPayload();
    payload.planId = 'different-plan';
    payload.operation.output.quality = 79;
    payload.schedule.strategy = 'fixed';
    payload.schedule.baseOrder.reverse();
    payload.implementations[0].version = '0.4.1';
    payload.implementations[1].samples[0].position = 1;
    payload.implementations[1].samples[0].result.width = 800;
    payload.implementations[1].samples[0].result.height = 1280;
    payload.implementations[2].samples.pop();
    const error = inspectNativeComparisonPayload(payload, plan).join(' | ');
    expect(error).toContain('planId does not match plan');
    expect(error).toContain('operation does not match plan');
    expect(error).toContain('rotating-round-robin');
    expect(error).toContain('baseOrder does not match plan');
    expect(error).toContain('does not match plan');
    expect(error).toContain('sample count is invalid');
    expect(error).toContain('sample dimensions do not match plan');
    expect(error).toContain('positions must form one permutation');

    const fixture = createEvidenceFixture();
    fixture.evidence.implementations[0].summary.elapsedMs.median = 0;
    fixture.evidence.implementations[1].repository = 'https://example.com/drift';
    fixture.evidence.runUrl = 'local://comparison';
    const report = inspectComparisonEvidence(fixture.root, fixture.evidence);
    expect(report.status).toBe('failed');
    expect(report.error).toContain('capture workflow run');
    expect(report.error).toContain('repository drifted');
    expect(report.error).toContain('summary drifted');
  });

  it('rejects invalid plan metadata and malformed native values', () => {
    const plan = readPlan();
    Object.assign(plan, {
      schemaVersion: 2,
      planId: 'Invalid Plan',
      benchmarkId: 'Invalid Benchmark',
      fixture: { id: 'Invalid Fixture', width: 0, height: 0, expectedOutput: {} },
      operation: { resize: {}, output: {} },
      supportDependencies: [{}],
    });
    Object.assign(plan.implementations[0], {
      id: 'Invalid ID',
      package: 'Invalid Package',
      version: '^0.4.0',
      repository: 'http://example.com',
      sourceCommit: 'short',
      license: 'Apache-2.0',
      registryIntegrity: 'bad',
    });
    plan.implementations[1].id = plan.implementations[2].id;
    const planErrors = inspectComparisonPlan(plan).join(' | ');
    expect(planErrors).toContain('schemaVersion');
    expect(planErrors).toContain('planId');
    expect(planErrors).toContain('fixture identity');
    expect(planErrors).toContain('operation resize');
    expect(planErrors).toContain('implementation ID is duplicated');
    expect(planErrors).toContain('support dependency is invalid');

    const validPlan = readPlan();
    const payload = createPayload();
    payload.schemaVersion = 2;
    payload.platform = 'web';
    payload.architecture = 'unknown';
    payload.fixture = { id: 'Invalid ID', sourceUri: '' };
    payload.warmupIterations = 0;
    payload.measuredIterations = 0;
    payload.implementations[0].samples[0] = {
      iteration: 0,
      position: 0,
      elapsedMs: Number.NaN,
      result: { format: 'png', width: 0, height: 0, byteSize: 0 },
    };
    const payloadErrors = inspectNativeComparisonPayload(payload, validPlan).join(' | ');
    expect(payloadErrors).toContain('schemaVersion');
    expect(payloadErrors).toContain('platform');
    expect(payloadErrors).toContain('architecture');
    expect(payloadErrors).toContain('sourceUri');
    expect(payloadErrors).toContain('warmupIterations');
    expect(payloadErrors).toContain('iteration and position');

    const missingImplementations = createPayload();
    delete missingImplementations.implementations;
    expect(
      inspectNativeComparisonPayload(missingImplementations, validPlan).join(' | ')
    ).toContain('implementations must be an array');

    const invalidElapsed = createPayload();
    invalidElapsed.implementations[0].samples[0].elapsedMs = 0;
    expect(inspectNativeComparisonPayload(invalidElapsed, validPlan).join(' | ')).toContain(
      'elapsedMs must be positive'
    );

    const invalidResult = createPayload();
    invalidResult.implementations[0].samples[0].result.format = 'png';
    expect(inspectNativeComparisonPayload(invalidResult, validPlan).join(' | ')).toContain(
      'result is invalid'
    );

    const nonSequential = createPayload();
    nonSequential.implementations[0].samples[0].iteration = 2;
    expect(inspectNativeComparisonPayload(nonSequential, validPlan).join(' | ')).toContain(
      'sample iterations must be sequential'
    );
  });

  it('rejects malformed evidence metadata and unreportable summaries', () => {
    const fixture = createEvidenceFixture();
    Object.assign(fixture.evidence, {
      schemaVersion: 2,
      status: 'failed',
      benchmarkId: 'Invalid Benchmark',
      sourceCommit: 'short',
      capturedAt: 'not-a-date',
      runUrl: 'local://comparison',
      environment: {
        platform: 'web',
        runtime: '',
        device: '',
        architecture: 'unknown',
      },
    });
    fixture.evidence.fixture.id = 'Invalid Fixture';
    fixture.evidence.implementations[0].samples = [];
    const report = inspectComparisonEvidence(fixture.root, fixture.evidence);
    expect(report).toMatchObject({
      status: 'failed',
      implementations: null,
    });
    expect(report.error).toContain('schemaVersion must be 1');
    expect(report.error).toContain('status must be passed');
    expect(report.error).toContain('sourceCommit');
    expect(report.error).toContain('capturedAt');
    expect(report.error).toContain('runtime and device');
    expect(report.error).toContain('samples must be a non-empty array');
  });

  it('rejects plan and fixture digest, path, byte-size, and JSON mutations', () => {
    const fixture = createEvidenceFixture();
    fixture.evidence.plan.sha256 = '0'.repeat(64);
    fixture.evidence.fixture.byteSize += 1;
    let report = inspectComparisonEvidence(fixture.root, fixture.evidence);
    expect(report.error).toContain('plan SHA-256 mismatch');
    expect(report.error).toContain('fixture byte size mismatch');

    fixture.evidence.plan.file = '../plan.json';
    fixture.evidence.fixture.file = '/tmp/source.jpg';
    report = inspectComparisonEvidence(fixture.root, fixture.evidence);
    expect(report.error).toContain('plan file is missing');
    expect(report.error).toContain('fixture file is missing');

    const malformed = createEvidenceFixture();
    writeFileSync(path.join(malformed.root, 'comparison-plan.json'), '{bad');
    malformed.evidence.plan.byteSize = statSync(
      path.join(malformed.root, 'comparison-plan.json')
    ).size;
    malformed.evidence.plan.sha256 = digest(
      readFileSync(path.join(malformed.root, 'comparison-plan.json'))
    );
    expect(inspectComparisonEvidence(malformed.root, malformed.evidence).error).toContain(
      'plan JSON is invalid'
    );
  });

  it('creates and verifies a canonical comparison artifact, then detects mutation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'rnick-comparison-cli-'));
    const source = path.join(root, 'input.jpg');
    const log = path.join(root, 'native.log');
    const artifact = path.join(root, 'artifact');
    writeFileSync(source, Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(998)]));
    writeFileSync(log, createChunkedLog(createPayload(), 'comparison-cli'));

    const create = spawnSync(
      process.execPath,
      [
        'scripts/create-benchmark-comparison-evidence.mjs',
        '--platform',
        'android',
        '--source-sha',
        SOURCE_SHA,
        '--runtime',
        'Android 15 / API 35',
        '--device',
        'Google Pixel 6',
        '--source',
        source,
        '--log',
        log,
        '--plan',
        PLAN_PATH,
        '--destination',
        artifact,
        '--run-url',
        'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/1',
        '--captured-at',
        '2026-08-06T00:00:00.000Z',
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    );
    expect(create.status, create.stderr).toBe(0);
    expect(JSON.parse(create.stdout)).toMatchObject({ status: 'passed' });

    const verify = runVerifier(artifact);
    expect(verify.status, verify.stderr).toBe(0);
    expect(JSON.parse(verify.stdout)).toMatchObject({ status: 'passed' });

    const evidencePath = path.join(artifact, 'benchmark-comparison.json');
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    evidence.implementations[0].samples[0].elapsedMs = 0;
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    const mutated = runVerifier(artifact);
    expect(mutated.status).toBe(1);
    expect(JSON.parse(mutated.stdout).error).toContain('elapsedMs must be positive');
    rmSync(root, { recursive: true, force: true });
  });
});

function createEvidenceFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rnick-comparison-'));
  const sourcePath = path.join(root, 'source.jpg');
  const planPath = path.join(root, 'comparison-plan.json');
  writeFileSync(sourcePath, Buffer.alloc(1_000, 1));
  cpSync(PLAN_PATH, planPath);
  const evidence = buildComparisonEvidence({
    payload: createPayload(),
    plan: readPlan(),
    sourceCommit: SOURCE_SHA,
    capturedAt: '2026-08-06T00:00:00.000Z',
    runtime: 'Android 15 / API 35',
    device: 'Google Pixel 6',
    runUrl:
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/1',
    sourceAsset: asset(sourcePath, 'source.jpg'),
    planAsset: asset(planPath, 'comparison-plan.json'),
  });
  return { root, evidence };
}

function createPayload() {
  const plan = readPlan();
  const count = plan.implementations.length;
  return {
    schemaVersion: 1,
    benchmarkId: plan.benchmarkId,
    planId: plan.planId,
    platform: 'android',
    architecture: 'new',
    fixture: { id: 'bundled-jpeg', sourceUri: 'file:///tmp/source.jpg' },
    operation: structuredClone(plan.operation),
    schedule: {
      strategy: 'rotating-round-robin',
      baseOrder: plan.implementations.map(({ id }) => id),
    },
    warmupIterations: 2,
    measuredIterations: 10,
    implementations: plan.implementations.map((implementation, implementationIndex) => ({
      id: implementation.id,
      version: implementation.version,
      samples: Array.from({ length: 10 }, (_, sampleIndex) => {
        const iteration = sampleIndex + 1;
        const offset = sampleIndex % count;
        return {
          iteration,
          position: ((implementationIndex - offset + count) % count) + 1,
          elapsedMs: iteration + implementationIndex / 10,
          result: {
            format: 'jpeg',
            width: 200,
            height: 320,
            byteSize: 100 + iteration + implementationIndex,
          },
        };
      }),
    })),
  };
}

function createChunkedLog(payload, captureId) {
  const serialized = JSON.stringify(payload);
  const chunks = Array.from({ length: Math.ceil(serialized.length / 480) }, (_, index) =>
    serialized.slice(index * 480, (index + 1) * 480)
  );
  return (
    chunks
      .map(
        (chunk, index) =>
          `RNICK_BENCHMARK_COMPARISON_CHUNK ${captureId} ${index + 1}/${chunks.length} ${chunk}\n`
      )
      .join('') +
    `RNICK_BENCHMARK_COMPARISON_PASS ${captureId} ${chunks.length}\n`
  );
}

function readPlan() {
  return JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
}

function asset(filePath, file) {
  const bytes = readFileSync(filePath);
  return { file, byteSize: bytes.length, sha256: digest(bytes) };
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function runVerifier(artifact) {
  return spawnSync(
    process.execPath,
    ['scripts/verify-benchmark-comparison-evidence.mjs', artifact],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
}
