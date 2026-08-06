import {
  NATIVE_BENCHMARK_MEASURED_ITERATIONS,
  NATIVE_BENCHMARK_WARMUP_ITERATIONS,
} from './nativeBenchmarkConstants';
import { createChunkedNativeLogMessages } from './nativeBenchmarkLog';

export const NATIVE_COMPARISON_BENCHMARK_ID = 'jpeg-resize-q80';
export const NATIVE_COMPARISON_PLAN_ID = 'native-image-libraries-v1';
export const NATIVE_COMPARISON_CHUNK_MARKER =
  'RNICK_BENCHMARK_COMPARISON_CHUNK';
export const NATIVE_COMPARISON_PASS_MARKER =
  'RNICK_BENCHMARK_COMPARISON_PASS';
export const NATIVE_COMPARISON_OPERATION = {
  resize: { maxWidth: 320, maxHeight: 320, mode: 'contain' },
  output: { format: 'jpeg', quality: 80 },
} as const;
export const NATIVE_COMPARISON_EXPECTED_DIMENSIONS = {
  width: 200,
  height: 320,
} as const;

export type NativeComparisonResult = {
  uri: string;
  format: 'jpeg';
  width: number;
  height: number;
  byteSize: number;
};

export type NativeComparisonAdapter = {
  id: string;
  version: string;
  compress: (sourceUri: string) => Promise<unknown>;
  inspect: (output: unknown) => Promise<NativeComparisonResult>;
};

type ComparisonSample = {
  iteration: number;
  position: number;
  elapsedMs: number;
  result: Omit<NativeComparisonResult, 'uri'>;
};

type ComparisonPayload = {
  schemaVersion: 1;
  benchmarkId: typeof NATIVE_COMPARISON_BENCHMARK_ID;
  planId: typeof NATIVE_COMPARISON_PLAN_ID;
  platform: 'android' | 'ios';
  architecture: 'legacy' | 'new';
  fixture: { id: 'bundled-jpeg'; sourceUri: string };
  operation: typeof NATIVE_COMPARISON_OPERATION;
  schedule: { strategy: 'rotating-round-robin'; baseOrder: string[] };
  warmupIterations: number;
  measuredIterations: number;
  implementations: Array<{
    id: string;
    version: string;
    samples: ComparisonSample[];
  }>;
};

type ComparisonDependencies = {
  now: () => number;
  createCaptureId: () => string;
};

export async function runNativeComparisonBenchmarkCore(
  input: {
    sourceUri: string;
    platform: 'android' | 'ios';
    architecture: 'legacy' | 'new';
  },
  adapters: NativeComparisonAdapter[],
  dependencies: ComparisonDependencies = {
    now: defaultClock,
    createCaptureId: defaultCaptureId,
  }
): Promise<{ payload: ComparisonPayload; logs: string[] }> {
  validateAdapters(adapters);

  for (
    let round = 0;
    round < NATIVE_BENCHMARK_WARMUP_ITERATIONS;
    round += 1
  ) {
    for (const adapter of rotate(adapters, round)) {
      await adapter.compress(input.sourceUri);
    }
  }

  const samplesById = new Map(
    adapters.map((adapter) => [adapter.id, [] as ComparisonSample[]])
  );
  for (
    let iteration = 1;
    iteration <= NATIVE_BENCHMARK_MEASURED_ITERATIONS;
    iteration += 1
  ) {
    const scheduled = rotate(adapters, iteration - 1);
    for (let index = 0; index < scheduled.length; index += 1) {
      const adapter = scheduled[index];
      const startedAt = dependencies.now();
      const output = await adapter.compress(input.sourceUri);
      const elapsedMs = dependencies.now() - startedAt;
      if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
        throw new Error(`Comparison clock did not advance for ${adapter.id}.`);
      }
      const inspected = await adapter.inspect(output);
      validateResult(adapter.id, inspected);
      const { uri: _uri, ...result } = inspected;
      samplesById.get(adapter.id)?.push({
        iteration,
        position: index + 1,
        elapsedMs,
        result,
      });
    }
  }

  const payload: ComparisonPayload = {
    schemaVersion: 1,
    benchmarkId: NATIVE_COMPARISON_BENCHMARK_ID,
    planId: NATIVE_COMPARISON_PLAN_ID,
    platform: input.platform,
    architecture: input.architecture,
    fixture: { id: 'bundled-jpeg', sourceUri: input.sourceUri },
    operation: NATIVE_COMPARISON_OPERATION,
    schedule: {
      strategy: 'rotating-round-robin',
      baseOrder: adapters.map(({ id }) => id),
    },
    warmupIterations: NATIVE_BENCHMARK_WARMUP_ITERATIONS,
    measuredIterations: NATIVE_BENCHMARK_MEASURED_ITERATIONS,
    implementations: adapters.map(({ id, version }) => ({
      id,
      version,
      samples: samplesById.get(id) ?? [],
    })),
  };

  return {
    payload,
    logs: createChunkedNativeLogMessages(
      payload,
      dependencies.createCaptureId(),
      {
        chunk: NATIVE_COMPARISON_CHUNK_MARKER,
        pass: NATIVE_COMPARISON_PASS_MARKER,
      }
    ),
  };
}

function validateAdapters(adapters: NativeComparisonAdapter[]): void {
  if (adapters.length < 2) {
    throw new Error('Native comparison requires at least two implementations.');
  }
  const ids = new Set<string>();
  for (const adapter of adapters) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(adapter.id)) {
      throw new Error(`Invalid comparison implementation ID: ${adapter.id}`);
    }
    if (!/^\d+\.\d+\.\d+$/.test(adapter.version)) {
      throw new Error(`Comparison version must be exact for ${adapter.id}.`);
    }
    if (ids.has(adapter.id)) {
      throw new Error(`Duplicate comparison implementation ID: ${adapter.id}`);
    }
    ids.add(adapter.id);
  }
}

function validateResult(id: string, result: NativeComparisonResult): void {
  if (
    result?.format !== 'jpeg' ||
    !Number.isInteger(result.width) ||
    result.width <= 0 ||
    !Number.isInteger(result.height) ||
    result.height <= 0 ||
    !Number.isInteger(result.byteSize) ||
    result.byteSize <= 0 ||
    typeof result.uri !== 'string' ||
    result.uri.length === 0
  ) {
    throw new Error(`Comparison adapter ${id} returned invalid JPEG metrics.`);
  }
  if (
    result.width !== NATIVE_COMPARISON_EXPECTED_DIMENSIONS.width ||
    result.height !== NATIVE_COMPARISON_EXPECTED_DIMENSIONS.height
  ) {
    throw new Error(
      `Comparison adapter ${id} returned ${result.width}x${result.height}; expected ` +
        `${NATIVE_COMPARISON_EXPECTED_DIMENSIONS.width}x${NATIVE_COMPARISON_EXPECTED_DIMENSIONS.height}.`
    );
  }
}

function rotate<T>(values: T[], offset: number): T[] {
  const normalized = offset % values.length;
  return [...values.slice(normalized), ...values.slice(0, normalized)];
}

function defaultClock(): number {
  const runtime = globalThis as unknown as {
    performance?: { now: () => number };
  };
  return runtime.performance?.now() ?? Date.now();
}

function defaultCaptureId(): string {
  return `comparison-${Date.now().toString(36)}`;
}
