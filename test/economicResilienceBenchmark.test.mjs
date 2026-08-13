import { describe, expect, it, vi } from 'vitest';
import {
  ECONOMIC_RESILIENCE_FIXTURE,
  ECONOMIC_RESILIENCE_PASS_MARKER,
  runEconomicResilienceBenchmark,
  selectEconomicResilienceClock,
} from '../example/src/economicResilienceBenchmark.ts';
import { parseNativeEconomicResiliencePayload } from '../scripts/economic-resilience-evidence-core.mjs';

const OUTPUT_SHA = 'a'.repeat(64);
const OUTPUT_BYTES = 240_000;

describe('kit-only 12 MP economic resilience runner', () => {
  it('times only 2 warmups + 10 measured calls, stages #10, and removes all 12 outputs', async () => {
    const harness = createHarness();
    const result = await runEconomicResilienceBenchmark(
      harness.sampleModule,
      'android',
      harness.dependencies
    );

    expect(harness.compress).toHaveBeenCalledTimes(12);
    expect(harness.timingEvents.slice(0, 3)).toEqual([
      'clock',
      'compress',
      'clock',
    ]);
    expect(harness.timingEvents).toEqual(
      Array.from({ length: 12 }, () => ['clock', 'compress', 'clock']).flat()
    );
    expect(harness.removeOutput).toHaveBeenCalledTimes(12);
    expect(harness.stageOutput).toHaveBeenCalledTimes(1);
    expect(harness.stageOutput).toHaveBeenCalledWith('file:///cache/output-12.jpg');
    expect(result.payload.samples.slice(0, 2).map(({ phase, iteration }) => [phase, iteration]))
      .toEqual([['warmup', 1], ['warmup', 2]]);
    expect(result.payload.samples.slice(2).map(({ phase, iteration }) => [phase, iteration]))
      .toEqual(Array.from({ length: 10 }, (_, index) => ['measured', index + 1]));
    expect(result.payload.cleanup).toEqual({
      attemptedPackageOutputs: 12,
      removedPackageOutputs: 12,
      residualPackageOutputs: 0,
      residualPackageOutputBytes: 0,
    });
    expect(result.payload.fixture.remainsAfterRun).toBe(true);
    expect(result.payload.representative).toMatchObject({
      measuredIteration: 10,
      stagedOutputUri: 'file:///cache/staged-output.jpg',
    });
    expect(result.logs.at(-1)).toContain(ECONOMIC_RESILIENCE_PASS_MARKER);
    expect(parseNativeEconomicResiliencePayload(`${result.logs.join('\n')}\n`)).toEqual(
      result.payload
    );
  });

  it('still removes a package output when inspection or acceptance fails', async () => {
    const harness = createHarness({ invalidFirstOutput: true });
    await expect(
      runEconomicResilienceBenchmark(
        harness.sampleModule,
        'android',
        harness.dependencies
      )
    ).rejects.toThrow('primary: warmup output 1 must be an existing, hashed, decodable JPEG');
    expect(harness.removeOutput).toHaveBeenCalledTimes(1);
    expect(harness.removed).toContain('file:///cache/output-1.jpg');
  });

  it('still removes a package output when the post-call clock fails', async () => {
    const harness = createHarness({ failSecondClock: true });
    await expect(
      runEconomicResilienceBenchmark(
        harness.sampleModule,
        'android',
        harness.dependencies
      )
    ).rejects.toThrow('primary: clock failed');
    expect(harness.removeOutput).toHaveBeenCalledTimes(1);
  });

  it('combines primary and cleanup errors and never emits PASS', async () => {
    const harness = createHarness({
      invalidFirstOutput: true,
      failFirstRemoval: true,
      reportFirstResidual: true,
    });
    await expect(
      runEconomicResilienceBenchmark(
        harness.sampleModule,
        'android',
        harness.dependencies
      )
    ).rejects.toThrow(/primary: .* \| cleanup: removal failed \| cleanup: .* remained/);
    expect(harness.removeOutput).toHaveBeenCalledTimes(1);
  });

  it('rejects an output that remains after a resolved cleanup call', async () => {
    const harness = createHarness({ reportFirstResidual: true });
    await expect(
      runEconomicResilienceBenchmark(
        harness.sampleModule,
        'android',
        harness.dependencies
      )
    ).rejects.toThrow('cleanup: warmup output 1 remained after removal');
    expect(harness.removeOutput).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-finite compression ratio before any PASS marker', async () => {
    const harness = createHarness({ invalidCompressionRatio: true });
    await expect(
      runEconomicResilienceBenchmark(
        harness.sampleModule,
        'android',
        harness.dependencies
      )
    ).rejects.toThrow('Compression output does not satisfy the 12 MP acceptance contract');
    expect(harness.removeOutput).toHaveBeenCalledTimes(1);
  });

  it('selects the recorded clock and falls back to Date.now as one bound pair', () => {
    const performanceClock = selectEconomicResilienceClock({
      performance: { now: () => 12.5 },
      Date: { now: () => 99 },
    });
    expect(performanceClock.clock).toBe('performance.now');
    expect(performanceClock.now()).toBe(12.5);

    const dateClock = selectEconomicResilienceClock({
      performance: { now: 'not-a-function' },
      Date: { now: () => 99 },
    });
    expect(dateClock.clock).toBe('Date.now');
    expect(dateClock.now()).toBe(99);
  });
});

function createHarness({
  invalidFirstOutput = false,
  failFirstRemoval = false,
  reportFirstResidual = false,
  invalidCompressionRatio = false,
  failSecondClock = false,
} = {}) {
  let outputIndex = 0;
  let clock = 0;
  const timingEvents = [];
  const removed = new Set();
  const sourceUri = 'file:///cache/source.jpg';
  const stagedUri = 'file:///cache/staged-output.jpg';
  const compress = vi.fn(async () => {
    timingEvents.push('compress');
    outputIndex += 1;
    return {
      uri: `file:///cache/output-${outputIndex}.jpg`,
      format: 'jpeg',
      width: 1600,
      height: 1200,
      byteSize: OUTPUT_BYTES,
      originalByteSize: ECONOMIC_RESILIENCE_FIXTURE.byteSize,
      compressionRatio: invalidCompressionRatio
        ? Number.NaN
        : OUTPUT_BYTES / ECONOMIC_RESILIENCE_FIXTURE.byteSize,
    };
  });
  const removeOutput = vi.fn(async (uri) => {
    if (failFirstRemoval && uri.endsWith('output-1.jpg')) {
      throw new Error('removal failed');
    }
    removed.add(uri);
  });
  const stageOutput = vi.fn(async () => stagedUri);
  const inspectEvidenceImage = vi.fn(async (uri) => {
    if (uri === sourceUri) return sourceInspection();
    if (uri === stagedUri) return outputInspection();
    if (invalidFirstOutput && uri.endsWith('output-1.jpg') && !removed.has(uri)) {
      return { exists: true, byteSize: 0 };
    }
    if (removed.has(uri) && !(reportFirstResidual && uri.endsWith('output-1.jpg'))) {
      return { exists: false, byteSize: 0 };
    }
    return outputInspection();
  });
  return {
    compress,
    removeOutput,
    stageOutput,
    removed,
    timingEvents,
    sampleModule: {
      copySampleJpegToCache: vi.fn(async () => sourceUri),
      copyEconomicResilienceJpegToCache: vi.fn(async () => sourceUri),
      copyEconomicResilienceOutputForEvidence: stageOutput,
      inspectEvidenceImage,
      getReactNativeArchitecture: vi.fn(async () => 'new'),
    },
    dependencies: {
      compress,
      removeOutput,
      capabilities: vi.fn(async () => capabilities()),
      now: () => {
        timingEvents.push('clock');
        clock += 1;
        if (failSecondClock && clock === 2) throw new Error('clock failed');
        return clock;
      },
      clock: 'performance.now',
      createCaptureId: () => 'economic-resilience-test',
    },
  };
}

function sourceInspection() {
  return {
    exists: true,
    byteSize: ECONOMIC_RESILIENCE_FIXTURE.byteSize,
    sha256: ECONOMIC_RESILIENCE_FIXTURE.sha256,
    mediaType: 'image/jpeg',
    width: 4000,
    height: 3000,
  };
}

function outputInspection() {
  return {
    exists: true,
    byteSize: OUTPUT_BYTES,
    sha256: OUTPUT_SHA,
    mediaType: 'image/jpeg',
    width: 1600,
    height: 1200,
  };
}

function capabilities() {
  return {
    platform: 'android',
    formats: ['jpeg', 'png', 'webp', 'heic', 'heif', 'avif', 'gif'].map(
      (format) => ({
        format,
        input: true,
        output: ['jpeg', 'png', 'webp'].includes(format),
        supportsAlpha: format !== 'jpeg',
        supportsAnimation: false,
        notes: [`${format} runtime evidence`],
      })
    ),
    metadataPolicies: ['preserve', 'safe', 'strip'],
    supportsTargetSizeCompression: true,
    supportsCancellation: true,
    maxConcurrentOperations: 2,
    supportsDecodeDownsampling: true,
    resourceLimits: {
      maxSourceDimension: 16_384,
      maxSourcePixels: 48_000_000,
      maxWorkingPixels: 16_000_000,
    },
  };
}
