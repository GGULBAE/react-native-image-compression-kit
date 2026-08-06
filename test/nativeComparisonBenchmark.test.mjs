import { describe, expect, it, vi } from 'vitest';
import { parseNativeComparisonPayload } from '../scripts/benchmark-comparison-core.mjs';
import {
  NATIVE_COMPARISON_PASS_MARKER,
  runNativeComparisonBenchmarkCore,
} from '../example/src/nativeComparisonBenchmarkCore.ts';

describe('native comparison benchmark runner', () => {
  it('balances implementation positions with rotating round-robin scheduling', async () => {
    let clock = 0;
    const adapters = ['kit', 'compressor', 'resizer'].map((id, implementationIndex) => ({
      id,
      version: `${implementationIndex + 1}.0.0`,
      compress: vi.fn(async () => ({ id, implementationIndex })),
      inspect: vi.fn(async () => ({
        uri: `file:///tmp/${id}.jpg`,
        format: 'jpeg',
        width: 200,
        height: 320,
        byteSize: 1_000 + implementationIndex,
      })),
    }));
    const result = await runNativeComparisonBenchmarkCore(
      {
        sourceUri: 'file:///tmp/source.jpg',
        platform: 'android',
        architecture: 'new',
      },
      adapters,
      {
        now: () => ++clock,
        createCaptureId: () => 'comparison-test',
      }
    );

    expect(adapters.map(({ compress }) => compress.mock.calls.length)).toEqual([
      12, 12, 12,
    ]);
    expect(adapters.map(({ inspect }) => inspect.mock.calls.length)).toEqual([
      10, 10, 10,
    ]);
    expect(result.payload.implementations[0].samples.map(({ position }) => position)).toEqual(
      [1, 3, 2, 1, 3, 2, 1, 3, 2, 1]
    );
    expect(result.payload.implementations[1].samples.map(({ position }) => position)).toEqual(
      [2, 1, 3, 2, 1, 3, 2, 1, 3, 2]
    );
    expect(result.logs.at(-1)).toContain(NATIVE_COMPARISON_PASS_MARKER);
    expect(parseNativeComparisonPayload(`${result.logs.join('\n')}\n`)).toEqual(
      result.payload
    );
  });

  it('rejects invalid adapter contracts, clocks, and result metrics', async () => {
    const input = {
      sourceUri: 'file:///tmp/source.jpg',
      platform: 'ios',
      architecture: 'legacy',
    };
    const valid = (id, version = '1.0.0') => ({
      id,
      version,
      compress: vi.fn(async () => id),
      inspect: vi.fn(async () => ({
        uri: `file:///tmp/${id}.jpg`,
        format: 'jpeg',
        width: 200,
        height: 320,
        byteSize: 1_000,
      })),
    });

    await expect(runNativeComparisonBenchmarkCore(input, [valid('only')])).rejects.toThrow(
      'at least two implementations'
    );
    await expect(
      runNativeComparisonBenchmarkCore(input, [valid('Invalid ID'), valid('other')])
    ).rejects.toThrow('Invalid comparison implementation ID');
    await expect(
      runNativeComparisonBenchmarkCore(input, [valid('one', '^1.0.0'), valid('two')])
    ).rejects.toThrow('version must be exact');
    await expect(
      runNativeComparisonBenchmarkCore(input, [valid('same'), valid('same')])
    ).rejects.toThrow('Duplicate comparison implementation ID');

    await expect(
      runNativeComparisonBenchmarkCore(input, [valid('one'), valid('two')], {
        now: () => 1,
        createCaptureId: () => 'clock-test',
      })
    ).rejects.toThrow('clock did not advance');

    const invalidResult = valid('two');
    invalidResult.inspect = vi.fn(async () => ({
      uri: '',
      format: 'png',
      width: 0,
      height: 0,
      byteSize: 0,
    }));
    let clock = 0;
    await expect(
      runNativeComparisonBenchmarkCore(input, [valid('one'), invalidResult], {
        now: () => ++clock,
        createCaptureId: () => 'result-test',
      })
    ).rejects.toThrow('returned invalid JPEG metrics');

    const wrongDimensions = valid('two');
    wrongDimensions.inspect = vi.fn(async () => ({
      uri: 'file:///tmp/two.jpg',
      format: 'jpeg',
      width: 800,
      height: 1280,
      byteSize: 32_496,
    }));
    clock = 0;
    await expect(
      runNativeComparisonBenchmarkCore(input, [valid('one'), wrongDimensions], {
        now: () => ++clock,
        createCaptureId: () => 'dimensions-test',
      })
    ).rejects.toThrow('returned 800x1280; expected 200x320');
  });
});
