import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const NATIVE_BENCHMARK_MARKER = 'RNICK_BENCHMARK_PASS';

export function parseNativeBenchmarkPayload(contents) {
  const matches = [
    ...contents.matchAll(new RegExp(`${NATIVE_BENCHMARK_MARKER} (\\{.+\\})`, 'g')),
  ];
  if (matches.length === 0) {
    throw new Error(`${NATIVE_BENCHMARK_MARKER} payload is missing`);
  }

  try {
    return JSON.parse(matches.at(-1)[1]);
  } catch (error) {
    throw new Error(`${NATIVE_BENCHMARK_MARKER} payload is invalid: ${error.message}`);
  }
}

export function summarizeBenchmarkSamples(samples) {
  const normalized = validateSamples(samples);
  const elapsed = normalized.map(({ elapsedMs }) => elapsedMs).sort(numberSort);
  const outputBytes = normalized
    .map(({ result }) => result.byteSize)
    .sort(numberSort);
  const dimensions = new Map();

  for (const { result } of normalized) {
    const key = `${result.width}x${result.height}`;
    dimensions.set(key, {
      width: result.width,
      height: result.height,
      count: (dimensions.get(key)?.count ?? 0) + 1,
    });
  }

  return {
    elapsedMs: {
      min: roundMetric(elapsed[0]),
      median: roundMetric(median(elapsed)),
      p95: roundMetric(nearestRank(elapsed, 0.95)),
      max: roundMetric(elapsed.at(-1)),
    },
    outputBytes: {
      min: outputBytes[0],
      median: roundMetric(median(outputBytes)),
      max: outputBytes.at(-1),
    },
    dimensions: [...dimensions.values()].sort((left, right) =>
      `${left.width}x${left.height}`.localeCompare(`${right.width}x${right.height}`)
    ),
  };
}

export function buildBenchmarkEvidence({
  payload,
  packageVersion,
  sourceCommit,
  capturedAt,
  runtime,
  device,
  runUrl,
  sourceAsset,
}) {
  const errors = inspectNativeBenchmarkPayload(payload);
  if (errors.length > 0) {
    throw new Error(errors.join(' | '));
  }

  return {
    schemaVersion: 1,
    status: 'passed',
    benchmarkId: payload.benchmarkId,
    implementation: {
      ...payload.implementation,
      version: packageVersion,
    },
    sourceCommit,
    capturedAt,
    runUrl,
    environment: {
      platform: payload.platform,
      runtime,
      device,
      architecture: payload.architecture,
    },
    fixture: {
      id: payload.fixture.id,
      file: sourceAsset.file,
      byteSize: sourceAsset.byteSize,
      sha256: sourceAsset.sha256,
    },
    operation: payload.operation,
    warmupIterations: payload.warmupIterations,
    measuredIterations: payload.measuredIterations,
    samples: payload.samples,
    summary: summarizeBenchmarkSamples(payload.samples),
  };
}

export function inspectBenchmarkEvidence(root, evidence) {
  const errors = [];
  if (evidence?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (evidence?.status !== 'passed') errors.push('status must be passed');
  if (!validIdentifier(evidence?.benchmarkId)) {
    errors.push('benchmarkId must be a lowercase identifier');
  }
  if (evidence?.implementation?.name !== 'react-native-image-compression-kit') {
    errors.push('implementation name must be react-native-image-compression-kit');
  }
  if (!exactSemver(evidence?.implementation?.version)) {
    errors.push('implementation version must be an exact semantic version');
  }
  if (!/^[0-9a-f]{40}$/.test(evidence?.sourceCommit ?? '')) {
    errors.push('sourceCommit must be a lowercase full commit SHA');
  }
  if (!Number.isFinite(Date.parse(evidence?.capturedAt ?? ''))) {
    errors.push('capturedAt must be an ISO timestamp');
  }
  if (
    !/^https:\/\/github\.com\/GGULBAE\/react-native-image-compression-kit\/actions\/runs\/\d+$/.test(
      evidence?.runUrl ?? ''
    )
  ) {
    errors.push('runUrl must identify the capture workflow run');
  }

  const environment = evidence?.environment;
  if (!['android', 'ios'].includes(environment?.platform)) {
    errors.push('environment platform must be android or ios');
  }
  if (!nonEmpty(environment?.runtime) || !nonEmpty(environment?.device)) {
    errors.push('environment runtime and device are required');
  }
  if (!['legacy', 'new'].includes(environment?.architecture)) {
    errors.push('environment architecture must be legacy or new');
  }

  const fixture = evidence?.fixture;
  if (!validIdentifier(fixture?.id)) errors.push('fixture id is invalid');
  if (!positiveInteger(fixture?.byteSize)) errors.push('fixture byteSize is invalid');
  if (!/^[0-9a-f]{64}$/.test(fixture?.sha256 ?? '')) {
    errors.push('fixture SHA-256 is invalid');
  }
  const fixturePath = resolveAsset(root, fixture?.file);
  if (!fixturePath || !existsSync(fixturePath)) {
    errors.push('fixture file is missing');
  } else {
    const bytes = readFileSync(fixturePath);
    if (statSync(fixturePath).size !== fixture.byteSize) {
      errors.push('fixture byte size mismatch');
    }
    if (sha256(bytes) !== fixture.sha256) {
      errors.push('fixture SHA-256 mismatch');
    }
  }

  errors.push(...inspectOperation(evidence?.operation));
  if (!positiveInteger(evidence?.warmupIterations)) {
    errors.push('warmupIterations must be a positive integer');
  }
  if (!positiveInteger(evidence?.measuredIterations)) {
    errors.push('measuredIterations must be a positive integer');
  }

  let normalizedSamples = [];
  try {
    normalizedSamples = validateSamples(evidence?.samples);
  } catch (error) {
    errors.push(error.message);
  }
  if (
    positiveInteger(evidence?.measuredIterations) &&
    normalizedSamples.length !== evidence.measuredIterations
  ) {
    errors.push('sample count must match measuredIterations');
  }
  normalizedSamples.forEach((sample, index) => {
    if (sample.iteration !== index + 1) {
      errors.push('sample iterations must be sequential from 1');
    }
    if (fixture?.byteSize !== sample.result.originalByteSize) {
      errors.push(`sample ${sample.iteration} originalByteSize does not match fixture`);
    }
  });

  if (normalizedSamples.length > 0) {
    const expectedSummary = summarizeBenchmarkSamples(normalizedSamples);
    if (JSON.stringify(evidence?.summary) !== JSON.stringify(expectedSummary)) {
      errors.push('summary does not match the raw samples');
    }
  }

  return {
    schemaVersion: 1,
    status: errors.length === 0 ? 'passed' : 'failed',
    benchmarkId: evidence?.benchmarkId ?? null,
    implementation: evidence?.implementation?.name ?? null,
    version: evidence?.implementation?.version ?? null,
    platform: environment?.platform ?? null,
    measuredIterations: evidence?.measuredIterations ?? null,
    summary: errors.length === 0 ? evidence.summary : null,
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}

export function inspectNativeBenchmarkPayload(payload) {
  const errors = [];
  if (payload?.schemaVersion !== 1) errors.push('native schemaVersion must be 1');
  if (!validIdentifier(payload?.benchmarkId)) {
    errors.push('native benchmarkId must be a lowercase identifier');
  }
  if (payload?.implementation?.name !== 'react-native-image-compression-kit') {
    errors.push('native implementation name is invalid');
  }
  if (!['android', 'ios'].includes(payload?.platform)) {
    errors.push('native platform must be android or ios');
  }
  if (!['legacy', 'new'].includes(payload?.architecture)) {
    errors.push('native architecture must be legacy or new');
  }
  if (!validIdentifier(payload?.fixture?.id) || !nonEmpty(payload?.fixture?.sourceUri)) {
    errors.push('native fixture id and sourceUri are required');
  }
  errors.push(...inspectOperation(payload?.operation).map((error) => `native ${error}`));
  if (!positiveInteger(payload?.warmupIterations)) {
    errors.push('native warmupIterations must be a positive integer');
  }
  if (!positiveInteger(payload?.measuredIterations)) {
    errors.push('native measuredIterations must be a positive integer');
  }

  try {
    const samples = validateSamples(payload?.samples);
    if (
      positiveInteger(payload?.measuredIterations) &&
      samples.length !== payload.measuredIterations
    ) {
      errors.push('native sample count must match measuredIterations');
    }
  } catch (error) {
    errors.push(`native ${error.message}`);
  }
  return errors;
}

function inspectOperation(operation) {
  const errors = [];
  if (
    !positiveInteger(operation?.resize?.maxWidth) ||
    !positiveInteger(operation?.resize?.maxHeight) ||
    !['contain', 'cover', 'stretch'].includes(operation?.resize?.mode)
  ) {
    errors.push('operation resize is invalid');
  }
  if (
    operation?.output?.format !== 'jpeg' ||
    !Number.isInteger(operation?.output?.quality) ||
    operation.output.quality < 0 ||
    operation.output.quality > 100
  ) {
    errors.push('operation output must be JPEG with quality from 0 to 100');
  }
  if (!['preserve', 'safe', 'strip'].includes(operation?.metadata)) {
    errors.push('operation metadata policy is invalid');
  }
  return errors;
}

function validateSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('samples must be a non-empty array');
  }
  for (const sample of samples) {
    if (!positiveInteger(sample?.iteration)) {
      throw new Error('sample iteration must be a positive integer');
    }
    if (!Number.isFinite(sample?.elapsedMs) || sample.elapsedMs <= 0) {
      throw new Error(`sample ${sample?.iteration ?? 'unknown'} elapsedMs must be positive`);
    }
    const result = sample?.result;
    if (
      result?.format !== 'jpeg' ||
      !positiveInteger(result?.width) ||
      !positiveInteger(result?.height) ||
      !positiveInteger(result?.byteSize) ||
      !positiveInteger(result?.originalByteSize) ||
      !Number.isFinite(result?.compressionRatio) ||
      result.compressionRatio <= 0
    ) {
      throw new Error(`sample ${sample.iteration} result is invalid`);
    }
    const expectedRatio = result.byteSize / result.originalByteSize;
    if (Math.abs(expectedRatio - result.compressionRatio) > 1e-6) {
      throw new Error(`sample ${sample.iteration} compressionRatio is inconsistent`);
    }
  }
  return samples;
}

function resolveAsset(root, relativePath) {
  if (
    typeof relativePath !== 'string' ||
    relativePath.startsWith('/') ||
    relativePath.includes('..')
  ) {
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  return resolved.startsWith(`${resolvedRoot}${path.sep}`) ? resolved : null;
}

function nearestRank(sortedValues, percentile) {
  return sortedValues[Math.max(0, Math.ceil(percentile * sortedValues.length) - 1)];
}

function median(sortedValues) {
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[middle - 1] + sortedValues[middle]) / 2
    : sortedValues[middle];
}

function roundMetric(value) {
  return Math.round((value + Number.EPSILON) * 1_000) / 1_000;
}

function numberSort(left, right) {
  return left - right;
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function exactSemver(value) {
  return /^\d+\.\d+\.\d+$/.test(value ?? '');
}

function validIdentifier(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? '');
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
