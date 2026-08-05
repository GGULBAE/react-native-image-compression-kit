import {
  compressImage,
  type CompressionOptions,
  type CompressionResult,
} from 'react-native-image-compression-kit';
import type { ExampleImageSourceModule } from './exampleNative';

export const NATIVE_BENCHMARK_ID = 'jpeg-resize-q80';
export const NATIVE_BENCHMARK_WARMUP_ITERATIONS = 2;
export const NATIVE_BENCHMARK_MEASURED_ITERATIONS = 10;
export const NATIVE_BENCHMARK_OPERATION = {
  resize: { maxWidth: 320, maxHeight: 320, mode: 'contain' },
  output: { format: 'jpeg', quality: 80 },
  metadata: 'strip',
} satisfies Omit<CompressionOptions, 'source'>;

type BenchmarkSample = {
  iteration: number;
  elapsedMs: number;
  result: Omit<CompressionResult, 'uri'>;
};

type NativeBenchmarkPayload = {
  schemaVersion: 1;
  benchmarkId: typeof NATIVE_BENCHMARK_ID;
  implementation: { name: 'react-native-image-compression-kit' };
  platform: 'android' | 'ios';
  architecture: 'legacy' | 'new';
  fixture: { id: 'bundled-jpeg'; sourceUri: string };
  operation: typeof NATIVE_BENCHMARK_OPERATION;
  warmupIterations: number;
  measuredIterations: number;
  samples: BenchmarkSample[];
};

type BenchmarkDependencies = {
  compress: typeof compressImage;
  now: () => number;
};

export async function runNativeBenchmark(
  sampleModule: ExampleImageSourceModule,
  platform: 'android' | 'ios',
  dependencies: BenchmarkDependencies = {
    compress: compressImage,
    now: defaultClock,
  }
): Promise<{ payload: NativeBenchmarkPayload; log: string }> {
  const [sourceUri, architecture] = await Promise.all([
    sampleModule.copySampleJpegToCache(),
    sampleModule.getReactNativeArchitecture(),
  ]);
  const options: CompressionOptions = {
    source: { uri: sourceUri },
    ...NATIVE_BENCHMARK_OPERATION,
  };

  for (let iteration = 0; iteration < NATIVE_BENCHMARK_WARMUP_ITERATIONS; iteration += 1) {
    await dependencies.compress(options);
  }

  const samples: BenchmarkSample[] = [];
  for (
    let iteration = 1;
    iteration <= NATIVE_BENCHMARK_MEASURED_ITERATIONS;
    iteration += 1
  ) {
    const startedAt = dependencies.now();
    const result = await dependencies.compress(options);
    const elapsedMs = dependencies.now() - startedAt;
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
      throw new Error('Native benchmark clock must advance for every sample.');
    }
    if (result.format !== 'jpeg') {
      throw new Error(`Native benchmark expected JPEG, received ${result.format}.`);
    }
    const { uri: _uri, ...resultMetrics } = result;
    samples.push({ iteration, elapsedMs, result: resultMetrics });
  }

  const payload: NativeBenchmarkPayload = {
    schemaVersion: 1,
    benchmarkId: NATIVE_BENCHMARK_ID,
    implementation: { name: 'react-native-image-compression-kit' },
    platform,
    architecture,
    fixture: { id: 'bundled-jpeg', sourceUri },
    operation: NATIVE_BENCHMARK_OPERATION,
    warmupIterations: NATIVE_BENCHMARK_WARMUP_ITERATIONS,
    measuredIterations: NATIVE_BENCHMARK_MEASURED_ITERATIONS,
    samples,
  };

  return {
    payload,
    log: `RNICK_BENCHMARK_PASS ${JSON.stringify(payload)}`,
  };
}

function defaultClock(): number {
  const runtime = globalThis as unknown as {
    performance?: { now: () => number };
  };
  return runtime.performance?.now() ?? Date.now();
}
