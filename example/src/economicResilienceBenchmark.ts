import {
  compressImage,
  getImageCompressionCapabilities,
  removeCompressionOutput,
  type CompressionOptions,
  type CompressionResult,
  type ImageCompressionCapabilities,
} from 'react-native-image-compression-kit';
import type {
  EvidenceImageInspection,
  ExampleImageSourceModule,
} from './exampleNative';
import { createChunkedNativeLogMessages } from './nativeBenchmarkLog';

export const ECONOMIC_RESILIENCE_ID = 'kit-only-12mp-jpeg-v1';
export const ECONOMIC_RESILIENCE_WARMUP_ITERATIONS = 2;
export const ECONOMIC_RESILIENCE_MEASURED_ITERATIONS = 10;
export const ECONOMIC_RESILIENCE_REPRESENTATIVE_ITERATION = 10;
export const ECONOMIC_RESILIENCE_CHUNK_MARKER =
  'RNICK_ECONOMIC_RESILIENCE_CHUNK';
export const ECONOMIC_RESILIENCE_PASS_MARKER =
  'RNICK_ECONOMIC_RESILIENCE_PASS';
export const ECONOMIC_RESILIENCE_FIXTURE = {
  id: 'kit-only-12mp-v1',
  file: 'kit-only-12mp-v1.jpg',
  mediaType: 'image/jpeg',
  width: 4000,
  height: 3000,
  pixelCount: 12_000_000,
  orientation: 1,
  orientationEncoding: 'implicit-default-no-exif-orientation',
  byteSize: 1_721_333,
  maximumFixtureByteSize: 8_000_000,
  sha256: 'bdcf4e083f1860d8829898211e4b1c428a80dfd53dceca697c6f7e4a4901bfcc',
} as const;
export const ECONOMIC_RESILIENCE_OPERATION = {
  resize: { maxWidth: 1600, maxHeight: 1200, mode: 'contain' },
  output: { format: 'jpeg', quality: 90, maxBytes: 500_000 },
  metadata: 'strip',
} as const satisfies Omit<CompressionOptions, 'source'>;

type NativePlatform = 'android' | 'ios';
type NativeArchitecture = 'legacy' | 'new';

type ResilienceSample = {
  phase: 'warmup' | 'measured';
  iteration: number;
  elapsedMs: number;
  result: Omit<CompressionResult, 'uri'>;
  sourceToOutputByteDifference: number;
  outputInspection: Required<EvidenceImageInspection>;
  cleanup: {
    packageOutputRemoved: true;
    existsAfterRemoval: false;
    residualByteSize: 0;
  };
};

export type EconomicResiliencePayload = {
  schemaVersion: 1;
  scenarioId: typeof ECONOMIC_RESILIENCE_ID;
  implementation: { name: 'react-native-image-compression-kit' };
  platform: NativePlatform;
  architecture: NativeArchitecture;
  jsEngine: 'hermes' | 'jsc';
  fixture: typeof ECONOMIC_RESILIENCE_FIXTURE & {
    sourceUri: string;
    inspection: Required<EvidenceImageInspection>;
    remainsAfterRun: true;
  };
  operation: typeof ECONOMIC_RESILIENCE_OPERATION;
  capabilities: ImageCompressionCapabilities;
  timing: {
    clock: 'performance.now' | 'Date.now';
    boundary: 'compressImage-call-only';
    warmupIterations: typeof ECONOMIC_RESILIENCE_WARMUP_ITERATIONS;
    measuredIterations: typeof ECONOMIC_RESILIENCE_MEASURED_ITERATIONS;
  };
  representative: {
    measuredIteration: typeof ECONOMIC_RESILIENCE_REPRESENTATIVE_ITERATION;
    stagedOutputUri: string;
    inspection: Required<EvidenceImageInspection>;
  };
  samples: ResilienceSample[];
  cleanup: {
    attemptedPackageOutputs: number;
    removedPackageOutputs: number;
    residualPackageOutputs: number;
    residualPackageOutputBytes: number;
  };
};

type Dependencies = {
  compress: typeof compressImage;
  removeOutput: typeof removeCompressionOutput;
  capabilities: typeof getImageCompressionCapabilities;
  now: () => number;
  clock: 'performance.now' | 'Date.now';
  createCaptureId: () => string;
};

const DEFAULT_CLOCK = selectEconomicResilienceClock();
const DEFAULT_DEPENDENCIES: Dependencies = {
  compress: compressImage,
  removeOutput: removeCompressionOutput,
  capabilities: getImageCompressionCapabilities,
  now: DEFAULT_CLOCK.now,
  clock: DEFAULT_CLOCK.clock,
  createCaptureId: defaultCaptureId,
};

export function selectEconomicResilienceClock(
  runtime: {
    performance?: { now?: unknown };
    Date?: { now?: unknown };
  } = globalThis as unknown as {
    performance?: { now?: unknown };
    Date?: { now?: unknown };
  }
): Pick<Dependencies, 'now' | 'clock'> {
  if (typeof runtime.performance?.now === 'function') {
    const performanceNow = runtime.performance.now as () => number;
    return {
      now: () => performanceNow.call(runtime.performance),
      clock: 'performance.now',
    };
  }
  if (typeof runtime.Date?.now !== 'function') {
    throw new Error('No supported economic resilience clock is available.');
  }
  const dateNow = runtime.Date.now as () => number;
  return { now: () => dateNow.call(runtime.Date), clock: 'Date.now' };
}

export async function runEconomicResilienceBenchmark(
  sampleModule: ExampleImageSourceModule,
  platform: NativePlatform,
  dependencies: Dependencies = DEFAULT_DEPENDENCIES
): Promise<{ payload: EconomicResiliencePayload; logs: string[] }> {
  const [sourceUri, architecture, capabilities] = await Promise.all([
    sampleModule.copyEconomicResilienceJpegToCache(),
    sampleModule.getReactNativeArchitecture(),
    dependencies.capabilities(),
  ]);
  const sourceInspection = requireExistingJpeg(
    await sampleModule.inspectEvidenceImage(sourceUri),
    'source'
  );
  assertSourceFixture(sourceInspection);
  assertCapabilities(capabilities, platform);
  const compressionOptions: CompressionOptions = {
    source: { uri: sourceUri },
    ...ECONOMIC_RESILIENCE_OPERATION,
  };

  const samples: ResilienceSample[] = [];
  let stagedRepresentative: EconomicResiliencePayload['representative'] | null = null;
  let removedPackageOutputs = 0;
  let residualPackageOutputs = 0;
  let residualPackageOutputBytes = 0;

  const totalIterations =
    ECONOMIC_RESILIENCE_WARMUP_ITERATIONS +
    ECONOMIC_RESILIENCE_MEASURED_ITERATIONS;
  for (let absoluteIndex = 1; absoluteIndex <= totalIterations; absoluteIndex += 1) {
    const phase =
      absoluteIndex <= ECONOMIC_RESILIENCE_WARMUP_ITERATIONS
        ? 'warmup'
        : 'measured';
    const iteration =
      phase === 'warmup'
        ? absoluteIndex
        : absoluteIndex - ECONOMIC_RESILIENCE_WARMUP_ITERATIONS;
    const startedAt = dependencies.now();
    const result = await dependencies.compress(compressionOptions);
    let elapsedMs = 0;
    let outputInspection: Required<EvidenceImageInspection> | null = null;
    let primaryError: unknown = null;
    try {
      const finishedAt = dependencies.now();
      elapsedMs = finishedAt - startedAt;
      if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
        throw new Error('Economic resilience clock must advance for every sample.');
      }
      outputInspection = requireExistingJpeg(
        await sampleModule.inspectEvidenceImage(result.uri),
        `${phase} output ${iteration}`
      );
      assertCompressionResult(result, outputInspection);

      if (
        phase === 'measured' &&
        iteration === ECONOMIC_RESILIENCE_REPRESENTATIVE_ITERATION
      ) {
        const stagedOutputUri =
          await sampleModule.copyEconomicResilienceOutputForEvidence(result.uri);
        const stagedInspection = requireExistingJpeg(
          await sampleModule.inspectEvidenceImage(stagedOutputUri),
          'representative staged output'
        );
        if (!sameInspection(outputInspection, stagedInspection)) {
          throw new Error('Representative staged output does not match iteration 10.');
        }
        stagedRepresentative = {
          measuredIteration: ECONOMIC_RESILIENCE_REPRESENTATIVE_ITERATION,
          stagedOutputUri,
          inspection: stagedInspection,
        };
      }
    } catch (error) {
      primaryError = error;
    }

    const cleanupErrors: unknown[] = [];
    try {
      await dependencies.removeOutput(result.uri);
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      const removedInspection = await sampleModule.inspectEvidenceImage(result.uri);
      if (removedInspection.exists || removedInspection.byteSize !== 0) {
        residualPackageOutputs += 1;
        residualPackageOutputBytes += removedInspection.byteSize;
        cleanupErrors.push(
          new Error(`${phase} output ${iteration} remained after removal.`)
        );
      }
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length === 0) {
      removedPackageOutputs += 1;
    }
    if (primaryError !== null || cleanupErrors.length > 0) {
      throw combinedIterationError({
        phase,
        iteration,
        primaryError,
        cleanupErrors,
      });
    }
    if (!outputInspection) {
      throw new Error(`${phase} output ${iteration} inspection is missing.`);
    }
    samples.push({
      phase,
      iteration,
      elapsedMs,
      result: withoutUri(result),
      sourceToOutputByteDifference:
        result.originalByteSize - result.byteSize,
      outputInspection,
      cleanup: {
        packageOutputRemoved: true,
        existsAfterRemoval: false,
        residualByteSize: 0,
      },
    });
  }

  if (
    removedPackageOutputs !== totalIterations ||
    residualPackageOutputs !== 0 ||
    residualPackageOutputBytes !== 0
  ) {
    throw new Error('Every package-owned output must be removed before PASS.');
  }
  const sourceAfterRun = requireExistingJpeg(
    await sampleModule.inspectEvidenceImage(sourceUri),
    'source after run'
  );
  if (!sameInspection(sourceInspection, sourceAfterRun)) {
    throw new Error('Source fixture must remain unchanged after the run.');
  }
  if (!stagedRepresentative) {
    throw new Error('Measured iteration 10 must be staged for host verification.');
  }

  const payload: EconomicResiliencePayload = {
    schemaVersion: 1,
    scenarioId: ECONOMIC_RESILIENCE_ID,
    implementation: { name: 'react-native-image-compression-kit' },
    platform,
    architecture,
    jsEngine: detectJsEngine(),
    fixture: {
      ...ECONOMIC_RESILIENCE_FIXTURE,
      sourceUri,
      inspection: sourceAfterRun,
      remainsAfterRun: true,
    },
    operation: ECONOMIC_RESILIENCE_OPERATION,
    capabilities,
    timing: {
      clock: dependencies.clock,
      boundary: 'compressImage-call-only',
      warmupIterations: ECONOMIC_RESILIENCE_WARMUP_ITERATIONS,
      measuredIterations: ECONOMIC_RESILIENCE_MEASURED_ITERATIONS,
    },
    representative: stagedRepresentative,
    samples,
    cleanup: {
      attemptedPackageOutputs: totalIterations,
      removedPackageOutputs,
      residualPackageOutputs,
      residualPackageOutputBytes,
    },
  };
  return {
    payload,
    logs: createChunkedNativeLogMessages(
      payload,
      dependencies.createCaptureId(),
      {
        chunk: ECONOMIC_RESILIENCE_CHUNK_MARKER,
        pass: ECONOMIC_RESILIENCE_PASS_MARKER,
      }
    ),
  };
}

function requireExistingJpeg(
  inspection: EvidenceImageInspection,
  label: string
): Required<EvidenceImageInspection> {
  if (
    inspection.exists !== true ||
    !Number.isInteger(inspection.byteSize) ||
    inspection.byteSize <= 0 ||
    !/^[0-9a-f]{64}$/.test(inspection.sha256 ?? '') ||
    inspection.mediaType !== 'image/jpeg' ||
    !Number.isInteger(inspection.width) ||
    (inspection.width ?? 0) <= 0 ||
    !Number.isInteger(inspection.height) ||
    (inspection.height ?? 0) <= 0
  ) {
    throw new Error(`${label} must be an existing, hashed, decodable JPEG.`);
  }
  return inspection as Required<EvidenceImageInspection>;
}

function assertSourceFixture(inspection: Required<EvidenceImageInspection>): void {
  if (
    inspection.byteSize !== ECONOMIC_RESILIENCE_FIXTURE.byteSize ||
    inspection.sha256 !== ECONOMIC_RESILIENCE_FIXTURE.sha256 ||
    inspection.width !== ECONOMIC_RESILIENCE_FIXTURE.width ||
    inspection.height !== ECONOMIC_RESILIENCE_FIXTURE.height ||
    inspection.byteSize > ECONOMIC_RESILIENCE_FIXTURE.maximumFixtureByteSize
  ) {
    throw new Error('Copied source does not match the immutable 12 MP fixture.');
  }
}

function assertCapabilities(
  capabilities: ImageCompressionCapabilities,
  platform: NativePlatform
): void {
  const jpeg = capabilities.formats.find(({ format }) => format === 'jpeg');
  if (
    capabilities.platform !== platform ||
    !jpeg?.input ||
    !jpeg.output ||
    !capabilities.supportsTargetSizeCompression ||
    !capabilities.supportsDecodeDownsampling ||
    !capabilities.metadataPolicies.includes('strip') ||
    !Number.isInteger(capabilities.maxConcurrentOperations) ||
    capabilities.maxConcurrentOperations <= 0 ||
    !Number.isInteger(capabilities.resourceLimits?.maxSourceDimension) ||
    capabilities.resourceLimits.maxSourceDimension < 4000 ||
    !Number.isInteger(capabilities.resourceLimits?.maxSourcePixels) ||
    capabilities.resourceLimits.maxSourcePixels < 12_000_000 ||
    !Number.isInteger(capabilities.resourceLimits?.maxWorkingPixels) ||
    capabilities.resourceLimits.maxWorkingPixels < 1_920_000
  ) {
    throw new Error('Runtime capabilities do not support the declared 12 MP case.');
  }
}

function assertCompressionResult(
  result: CompressionResult,
  inspection: Required<EvidenceImageInspection>
): void {
  if (
    result.format !== 'jpeg' ||
    result.width !== 1600 ||
    result.height !== 1200 ||
    result.byteSize <= 0 ||
    result.byteSize > 500_000 ||
    result.originalByteSize !== ECONOMIC_RESILIENCE_FIXTURE.byteSize ||
    !Number.isFinite(result.compressionRatio) ||
    result.compressionRatio <= 0 ||
    Math.abs(result.compressionRatio - result.byteSize / result.originalByteSize) >
      1e-6 ||
    inspection.byteSize !== result.byteSize ||
    inspection.width !== result.width ||
    inspection.height !== result.height
  ) {
    throw new Error('Compression output does not satisfy the 12 MP acceptance contract.');
  }
}

function sameInspection(
  left: Required<EvidenceImageInspection>,
  right: Required<EvidenceImageInspection>
): boolean {
  return (
    left.byteSize === right.byteSize &&
    left.sha256 === right.sha256 &&
    left.mediaType === right.mediaType &&
    left.width === right.width &&
    left.height === right.height
  );
}

function withoutUri(result: CompressionResult): Omit<CompressionResult, 'uri'> {
  const { uri: _uri, ...metrics } = result;
  return metrics;
}

function detectJsEngine(): 'hermes' | 'jsc' {
  const runtime = globalThis as unknown as { HermesInternal?: unknown };
  return runtime.HermesInternal === undefined ? 'jsc' : 'hermes';
}

function defaultCaptureId(): string {
  return `economic-resilience-${Date.now().toString(36)}`;
}

function combinedIterationError({
  phase,
  iteration,
  primaryError,
  cleanupErrors,
}: {
  phase: 'warmup' | 'measured';
  iteration: number;
  primaryError: unknown;
  cleanupErrors: unknown[];
}): Error {
  const details = [
    ...(primaryError === null
      ? []
      : [`primary: ${toErrorMessage(primaryError)}`]),
    ...cleanupErrors.map((error) => `cleanup: ${toErrorMessage(error)}`),
  ];
  return new Error(
    `Economic resilience ${phase} ${iteration} failed; ${details.join(' | ')}`
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
