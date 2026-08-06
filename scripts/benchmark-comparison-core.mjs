import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseChunkedNativePayload } from './benchmark-core.mjs';

export const NATIVE_COMPARISON_MARKER = 'RNICK_BENCHMARK_COMPARISON_PASS';
export const NATIVE_COMPARISON_CHUNK_MARKER =
  'RNICK_BENCHMARK_COMPARISON_CHUNK';

export function parseNativeComparisonPayload(contents) {
  return parseChunkedNativePayload(contents, {
    passMarker: NATIVE_COMPARISON_MARKER,
    chunkMarker: NATIVE_COMPARISON_CHUNK_MARKER,
  });
}

export function summarizeComparisonSamples(samples) {
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

export function inspectComparisonPlan(plan) {
  const errors = [];
  if (plan?.schemaVersion !== 1) errors.push('plan schemaVersion must be 1');
  if (!validIdentifier(plan?.planId)) errors.push('planId must be a lowercase identifier');
  if (!validIdentifier(plan?.benchmarkId)) {
    errors.push('plan benchmarkId must be a lowercase identifier');
  }
  errors.push(...inspectFixture(plan?.fixture).map((error) => `plan ${error}`));
  errors.push(...inspectOperation(plan?.operation).map((error) => `plan ${error}`));
  if (!Array.isArray(plan?.implementations) || plan.implementations.length < 2) {
    errors.push('plan must contain at least two implementations');
  } else {
    const ids = new Set();
    for (const implementation of plan.implementations) {
      if (!validIdentifier(implementation?.id)) {
        errors.push('plan implementation ID is invalid');
      } else if (ids.has(implementation.id)) {
        errors.push(`plan implementation ID is duplicated: ${implementation.id}`);
      }
      ids.add(implementation?.id);
      if (!validPackageName(implementation?.package)) {
        errors.push(`plan package is invalid for ${implementation?.id ?? 'unknown'}`);
      }
      if (!exactSemver(implementation?.version)) {
        errors.push(`plan version must be exact for ${implementation?.id ?? 'unknown'}`);
      }
      if (!githubRepository(implementation?.repository)) {
        errors.push(`plan repository is invalid for ${implementation?.id ?? 'unknown'}`);
      }
      if (
        implementation?.sourceCommit !== 'workspace' &&
        !/^[0-9a-f]{40}$/.test(implementation?.sourceCommit ?? '')
      ) {
        errors.push(`plan sourceCommit is invalid for ${implementation?.id ?? 'unknown'}`);
      }
      if (implementation?.license !== 'MIT') {
        errors.push(`plan license must be MIT for ${implementation?.id ?? 'unknown'}`);
      }
      if (
        implementation?.sourceCommit !== 'workspace' &&
        !/^sha512-[A-Za-z0-9+/]+=*$/.test(implementation?.registryIntegrity ?? '')
      ) {
        errors.push(
          `plan registry integrity is invalid for ${implementation?.id ?? 'unknown'}`
        );
      }
    }
  }
  if (!Array.isArray(plan?.supportDependencies)) {
    errors.push('plan supportDependencies must be an array');
  } else {
    for (const dependency of plan.supportDependencies) {
      if (
        !validPackageName(dependency?.package) ||
        !exactSemver(dependency?.version) ||
        !githubRepository(dependency?.repository) ||
        dependency?.license !== 'MIT' ||
        !/^sha512-[A-Za-z0-9+/]+=*$/.test(dependency?.registryIntegrity ?? '')
      ) {
        errors.push('plan support dependency is invalid');
      }
    }
  }
  return errors;
}

export function inspectNativeComparisonPayload(payload, plan) {
  const errors = inspectComparisonPlan(plan);
  if (payload?.schemaVersion !== 1) errors.push('native schemaVersion must be 1');
  if (payload?.benchmarkId !== plan?.benchmarkId) {
    errors.push('native benchmarkId does not match plan');
  }
  if (payload?.planId !== plan?.planId) errors.push('native planId does not match plan');
  if (!['android', 'ios'].includes(payload?.platform)) {
    errors.push('native platform must be android or ios');
  }
  if (!['legacy', 'new'].includes(payload?.architecture)) {
    errors.push('native architecture must be legacy or new');
  }
  if (!validIdentifier(payload?.fixture?.id) || !nonEmpty(payload?.fixture?.sourceUri)) {
    errors.push('native fixture id and sourceUri are required');
  }
  if (payload?.fixture?.id !== plan?.fixture?.id) {
    errors.push('native fixture id does not match plan');
  }
  if (JSON.stringify(payload?.operation) !== JSON.stringify(plan?.operation)) {
    errors.push('native operation does not match plan');
  }
  if (payload?.schedule?.strategy !== 'rotating-round-robin') {
    errors.push('native schedule must use rotating-round-robin');
  }
  const planIds = plan?.implementations?.map(({ id }) => id) ?? [];
  if (JSON.stringify(payload?.schedule?.baseOrder) !== JSON.stringify(planIds)) {
    errors.push('native schedule baseOrder does not match plan');
  }
  if (!positiveInteger(payload?.warmupIterations)) {
    errors.push('native warmupIterations must be a positive integer');
  }
  if (!positiveInteger(payload?.measuredIterations)) {
    errors.push('native measuredIterations must be a positive integer');
  }
  errors.push(...inspectImplementations(payload, plan));
  return errors;
}

export function buildComparisonEvidence({
  payload,
  plan,
  sourceCommit,
  capturedAt,
  runtime,
  device,
  runUrl,
  sourceAsset,
  planAsset,
}) {
  const errors = inspectNativeComparisonPayload(payload, plan);
  if (errors.length > 0) throw new Error(errors.join(' | '));
  return {
    schemaVersion: 1,
    status: 'passed',
    benchmarkId: payload.benchmarkId,
    plan: {
      id: payload.planId,
      file: planAsset.file,
      byteSize: planAsset.byteSize,
      sha256: planAsset.sha256,
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
    schedule: payload.schedule,
    warmupIterations: payload.warmupIterations,
    measuredIterations: payload.measuredIterations,
    implementations: payload.implementations.map((result) => ({
      ...plan.implementations.find(({ id }) => id === result.id),
      samples: result.samples,
      summary: summarizeComparisonSamples(result.samples),
    })),
  };
}

export function inspectComparisonEvidence(root, evidence) {
  const errors = [];
  if (evidence?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (evidence?.status !== 'passed') errors.push('status must be passed');
  if (!validIdentifier(evidence?.benchmarkId)) {
    errors.push('benchmarkId must be a lowercase identifier');
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

  const plan = readVerifiedJsonAsset(root, evidence?.plan, 'plan', errors);
  const fixture = evidence?.fixture;
  verifyAsset(root, fixture, 'fixture', errors);
  if (!validIdentifier(fixture?.id)) errors.push('fixture id is invalid');

  if (plan) {
    errors.push(...inspectComparisonPlan(plan));
    if (evidence?.benchmarkId !== plan.benchmarkId) {
      errors.push('benchmarkId does not match plan');
    }
    if (evidence?.plan?.id !== plan.planId) errors.push('plan ID does not match plan file');
    if (JSON.stringify(evidence?.operation) !== JSON.stringify(plan.operation)) {
      errors.push('operation does not match plan');
    }
    const payload = {
      schemaVersion: evidence?.schemaVersion,
      benchmarkId: evidence?.benchmarkId,
      planId: evidence?.plan?.id,
      platform: environment?.platform,
      architecture: environment?.architecture,
      fixture: { id: fixture?.id, sourceUri: 'file://verified-fixture' },
      operation: evidence?.operation,
      schedule: evidence?.schedule,
      warmupIterations: evidence?.warmupIterations,
      measuredIterations: evidence?.measuredIterations,
      implementations: evidence?.implementations,
    };
    errors.push(...inspectNativeComparisonPayload(payload, plan));
    for (const implementation of evidence?.implementations ?? []) {
      const expected = plan.implementations.find(({ id }) => id === implementation.id);
      for (const field of [
        'package',
        'version',
        'repository',
        'sourceCommit',
        'license',
        'registryIntegrity',
      ]) {
        if (implementation?.[field] !== expected?.[field]) {
          errors.push(`implementation ${implementation?.id ?? 'unknown'} ${field} drifted`);
        }
      }
      try {
        const expectedSummary = summarizeComparisonSamples(implementation.samples);
        if (JSON.stringify(implementation.summary) !== JSON.stringify(expectedSummary)) {
          errors.push(`implementation ${implementation.id} summary drifted`);
        }
      } catch (error) {
        errors.push(error.message);
      }
    }
  }

  return {
    schemaVersion: 1,
    status: errors.length === 0 ? 'passed' : 'failed',
    benchmarkId: evidence?.benchmarkId ?? null,
    planId: evidence?.plan?.id ?? null,
    platform: environment?.platform ?? null,
    implementations:
      errors.length === 0
        ? evidence.implementations.map(({ id, version, summary }) => ({
            id,
            version,
            summary,
          }))
        : null,
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}

function inspectImplementations(payload, plan) {
  const errors = [];
  if (!Array.isArray(payload?.implementations)) {
    return ['native implementations must be an array'];
  }
  if (payload.implementations.length !== (plan?.implementations?.length ?? 0)) {
    errors.push('native implementation count does not match plan');
  }
  const positionsByIteration = new Map();
  for (let index = 0; index < payload.implementations.length; index += 1) {
    const implementation = payload.implementations[index];
    const expected = plan?.implementations?.[index];
    if (
      implementation?.id !== expected?.id ||
      implementation?.version !== expected?.version
    ) {
      errors.push(`native implementation ${index + 1} does not match plan`);
    }
    let samples = [];
    try {
      samples = validateSamples(implementation?.samples);
    } catch (error) {
      errors.push(`${implementation?.id ?? 'unknown'} ${error.message}`);
    }
    if (
      positiveInteger(payload?.measuredIterations) &&
      samples.length !== payload.measuredIterations
    ) {
      errors.push(`${implementation?.id ?? 'unknown'} sample count is invalid`);
    }
    if (
      samples.some(
        ({ result }) =>
          result.width !== plan?.fixture?.expectedOutput?.width ||
          result.height !== plan?.fixture?.expectedOutput?.height
      )
    ) {
      errors.push(
        `${implementation?.id ?? 'unknown'} sample dimensions do not match plan`
      );
    }
    samples.forEach((sample, sampleIndex) => {
      if (sample.iteration !== sampleIndex + 1) {
        errors.push(`${implementation.id} sample iterations must be sequential`);
      }
      const positions = positionsByIteration.get(sample.iteration) ?? [];
      positions.push(sample.position);
      positionsByIteration.set(sample.iteration, positions);
    });
  }
  const expectedPositions = Array.from(
    { length: plan?.implementations?.length ?? 0 },
    (_, index) => index + 1
  );
  for (const positions of positionsByIteration.values()) {
    if (JSON.stringify([...positions].sort(numberSort)) !== JSON.stringify(expectedPositions)) {
      errors.push('native schedule positions must form one permutation per iteration');
      break;
    }
  }
  return errors;
}

function validateSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('samples must be a non-empty array');
  }
  for (const sample of samples) {
    if (!positiveInteger(sample?.iteration) || !positiveInteger(sample?.position)) {
      throw new Error('sample iteration and position must be positive integers');
    }
    if (!Number.isFinite(sample?.elapsedMs) || sample.elapsedMs <= 0) {
      throw new Error(`sample ${sample?.iteration ?? 'unknown'} elapsedMs must be positive`);
    }
    const result = sample?.result;
    if (
      result?.format !== 'jpeg' ||
      !positiveInteger(result?.width) ||
      !positiveInteger(result?.height) ||
      !positiveInteger(result?.byteSize)
    ) {
      throw new Error(`sample ${sample.iteration} result is invalid`);
    }
  }
  return samples;
}

function readVerifiedJsonAsset(root, asset, label, errors) {
  const resolved = verifyAsset(root, asset, label, errors);
  if (!resolved) return null;
  try {
    return JSON.parse(readFileSync(resolved, 'utf8'));
  } catch (error) {
    errors.push(`${label} JSON is invalid: ${error.message}`);
    return null;
  }
}

function verifyAsset(root, asset, label, errors) {
  if (!positiveInteger(asset?.byteSize)) errors.push(`${label} byteSize is invalid`);
  if (!/^[0-9a-f]{64}$/.test(asset?.sha256 ?? '')) {
    errors.push(`${label} SHA-256 is invalid`);
  }
  const resolved = resolveAsset(root, asset?.file);
  if (!resolved || !existsSync(resolved)) {
    errors.push(`${label} file is missing`);
    return null;
  }
  const bytes = readFileSync(resolved);
  if (statSync(resolved).size !== asset.byteSize) errors.push(`${label} byte size mismatch`);
  if (sha256(bytes) !== asset.sha256) errors.push(`${label} SHA-256 mismatch`);
  return resolved;
}

function inspectOperation(operation) {
  const errors = [];
  if (
    !positiveInteger(operation?.resize?.maxWidth) ||
    !positiveInteger(operation?.resize?.maxHeight) ||
    operation?.resize?.mode !== 'contain'
  ) {
    errors.push('operation resize must be contain with positive bounds');
  }
  if (
    operation?.output?.format !== 'jpeg' ||
    !Number.isInteger(operation?.output?.quality) ||
    operation.output.quality < 0 ||
    operation.output.quality > 100
  ) {
    errors.push('operation output must be JPEG with quality from 0 to 100');
  }
  return errors;
}

function inspectFixture(fixture) {
  const errors = [];
  if (
    !validIdentifier(fixture?.id) ||
    !positiveInteger(fixture?.width) ||
    !positiveInteger(fixture?.height)
  ) {
    errors.push('fixture identity and source dimensions are invalid');
  }
  if (
    !positiveInteger(fixture?.expectedOutput?.width) ||
    !positiveInteger(fixture?.expectedOutput?.height) ||
    fixture.expectedOutput.width > fixture?.width ||
    fixture.expectedOutput.height > fixture?.height
  ) {
    errors.push('fixture expected output dimensions are invalid');
  }
  return errors;
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

function validPackageName(value) {
  return /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(value ?? '');
}

function githubRepository(value) {
  return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value ?? '');
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
