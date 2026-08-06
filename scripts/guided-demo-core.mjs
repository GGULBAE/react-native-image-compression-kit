export const GUIDED_DEMO_STAGE_ORDER = [
  'source',
  'options',
  'capabilities',
  'compressing',
  'result',
];

const MINIMUM_STAGE_GAPS_MS = [4_500, 3_500, 3_500, 1_500];
const MINIMUM_RESULT_HOLD_MS = 5_500;
const MINIMUM_DURATION_MS = 18_000;
const MAXIMUM_DURATION_MS = 30_000;

export function parseGuidedDemoPayload(contents) {
  const matches = [...contents.matchAll(/RNICK_GUIDED_DEMO_PASS (\{.+\})/g)];
  if (matches.length === 0) {
    throw new Error('RNICK_GUIDED_DEMO_PASS payload is missing');
  }
  try {
    return JSON.parse(matches.at(-1)[1]);
  } catch (error) {
    throw new Error(`RNICK_GUIDED_DEMO_PASS payload is invalid: ${error.message}`);
  }
}

export function inspectGuidedDemoPayload(payload, expected = {}) {
  const errors = [];
  if (payload?.schemaVersion !== 1) errors.push('walkthrough schemaVersion must be 1');
  if (payload?.status !== 'passed') errors.push('walkthrough status must be passed');
  if (!['android', 'ios'].includes(payload?.platform)) {
    errors.push('walkthrough platform must be android or ios');
  }
  if (expected.platform && payload?.platform !== expected.platform) {
    errors.push('walkthrough platform does not match its native case');
  }

  const stages = Array.isArray(payload?.stages) ? payload.stages : [];
  if (stages.length !== GUIDED_DEMO_STAGE_ORDER.length) {
    errors.push('walkthrough must contain exactly five stages');
  }
  for (let index = 0; index < GUIDED_DEMO_STAGE_ORDER.length; index += 1) {
    const stage = stages[index];
    if (stage?.id !== GUIDED_DEMO_STAGE_ORDER[index] || stage?.ordinal !== index) {
      errors.push('walkthrough stage order or ordinal drifted');
      break;
    }
    if (!Number.isInteger(stage?.elapsedMs) || stage.elapsedMs < 0) {
      errors.push('walkthrough stage elapsedMs values must be non-negative integers');
      break;
    }
  }
  if (Number.isInteger(stages[0]?.elapsedMs) && stages[0].elapsedMs > 2_000) {
    errors.push('walkthrough source stage started too late');
  }
  for (let index = 1; index < stages.length; index += 1) {
    const previous = stages[index - 1]?.elapsedMs;
    const current = stages[index]?.elapsedMs;
    if (
      Number.isInteger(previous) &&
      Number.isInteger(current) &&
      current - previous < MINIMUM_STAGE_GAPS_MS[index - 1]
    ) {
      errors.push(`walkthrough stage ${GUIDED_DEMO_STAGE_ORDER[index]} advanced too early`);
    }
  }

  if (
    !Number.isInteger(payload?.durationMs) ||
    payload.durationMs < MINIMUM_DURATION_MS ||
    payload.durationMs > MAXIMUM_DURATION_MS
  ) {
    errors.push('walkthrough duration must be between 18 and 30 seconds');
  }
  const resultElapsedMs = stages.at(-1)?.elapsedMs;
  if (
    Number.isInteger(payload?.durationMs) &&
    Number.isInteger(resultElapsedMs) &&
    payload.durationMs - resultElapsedMs < MINIMUM_RESULT_HOLD_MS
  ) {
    errors.push('walkthrough result stage was not held long enough');
  }
  if (expected.options && !sameJson(payload?.options, expected.options)) {
    errors.push('walkthrough options do not match the native request');
  }
  if (expected.result && !sameJson(payload?.result, expected.result)) {
    errors.push('walkthrough result does not match the native result');
  }

  return {
    status: errors.length === 0 ? 'passed' : 'failed',
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
