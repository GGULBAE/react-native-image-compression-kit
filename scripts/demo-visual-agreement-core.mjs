import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const DEMO_VISUAL_AGREEMENT_ALGORITHM =
  'ffmpeg-auto-oriented-contain-ssim-v2';
export const PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT = Object.freeze({
  profile: 'jpeg-full-range-to-limited-yuv444p-v1',
  inputColorRange: 'pc',
  comparisonColorRange: 'tv',
  pixelFormat: 'yuv444p',
  scaler: 'lanczos',
  scoreTolerance: 0.001,
});
export const PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE =
  PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.profile;
export const PORTABLE_DEMO_VISUAL_AGREEMENT_ALGORITHM =
  'ffmpeg-auto-oriented-contain-limited-range-ssim-v3';
export const PORTABLE_DEMO_VISUAL_AGREEMENT_REPLAY_TOLERANCE =
  PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.scoreTolerance;
export const DEMO_VISUAL_AGREEMENT_THRESHOLD = 0.9;
export const DEMO_VISUAL_AGREEMENT_MARGIN = 0.02;

const DEMO_VISUAL_OUTCOMES = new Set(['passed', 'failed']);
const LEGACY_DEMO_VISUAL_AGREEMENT_ALGORITHM =
  'ffmpeg-auto-oriented-ssim-v1';
const PORTABLE_DEMO_VISUAL_AGREEMENT_FIELDS = [
  'schemaVersion',
  'status',
  'algorithm',
  'comparisonProfile',
  'inputColorRange',
  'comparisonColorRange',
  'comparisonPixelFormat',
  'comparisonScaler',
  'scoreTolerance',
  'sourceColorRange',
  'outputColorRange',
  'resizeMode',
  'maxWidth',
  'maxHeight',
  'sourceWidth',
  'sourceHeight',
  'expectedWidth',
  'expectedHeight',
  'width',
  'height',
  'uprightSimilarity',
  'verticalFlipSimilarity',
  'minimumSimilarity',
  'minimumOrientationMargin',
  'checks',
  'sourceSha256',
  'outputSha256',
].sort();
const DEMO_VISUAL_AGREEMENT_CHECK_FIELDS = [
  'geometry',
  'minimumSimilarity',
  'orientationMargin',
].sort();

export function calculateContainDimensions({
  sourceWidth,
  sourceHeight,
  maxWidth,
  maxHeight,
}) {
  if (
    !positiveInteger(sourceWidth) ||
    !positiveInteger(sourceHeight) ||
    !positiveInteger(maxWidth) ||
    !positiveInteger(maxHeight)
  ) {
    return { width: null, height: null };
  }
  const scale = Math.min(
    1,
    maxWidth / sourceWidth,
    maxHeight / sourceHeight
  );
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export function createDemoVisualAgreementReport({
  sourceBytes,
  outputBytes,
  sourceWidth,
  sourceHeight,
  width,
  height,
  resizeMode,
  maxWidth,
  maxHeight,
  uprightSimilarity,
  verticalFlipSimilarity,
  comparisonProfile,
  sourceColorRange,
  outputColorRange,
}) {
  if (
    comparisonProfile !== undefined &&
    comparisonProfile !== PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE
  ) {
    throw new Error('comparisonProfile is unsupported');
  }
  const portable =
    comparisonProfile === PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE;
  const expected = calculateContainDimensions({
    sourceWidth,
    sourceHeight,
    maxWidth,
    maxHeight,
  });
  const roundedUprightSimilarity = roundSix(uprightSimilarity);
  const roundedVerticalFlipSimilarity = roundSix(verticalFlipSimilarity);
  const checks = deriveChecks({
    expected,
    width,
    height,
    resizeMode,
    uprightSimilarity: roundedUprightSimilarity,
    verticalFlipSimilarity: roundedVerticalFlipSimilarity,
  });
  return {
    schemaVersion: portable ? 3 : 2,
    status: deriveOutcome(checks),
    algorithm: portable
      ? PORTABLE_DEMO_VISUAL_AGREEMENT_ALGORITHM
      : DEMO_VISUAL_AGREEMENT_ALGORITHM,
    ...(portable
      ? {
          comparisonProfile,
          inputColorRange:
            PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.inputColorRange,
          comparisonColorRange:
            PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.comparisonColorRange,
          comparisonPixelFormat:
            PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.pixelFormat,
          comparisonScaler:
            PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.scaler,
          scoreTolerance:
            PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.scoreTolerance,
          sourceColorRange,
          outputColorRange,
        }
      : {}),
    resizeMode,
    maxWidth,
    maxHeight,
    sourceWidth,
    sourceHeight,
    expectedWidth: expected.width,
    expectedHeight: expected.height,
    width,
    height,
    uprightSimilarity: roundedUprightSimilarity,
    verticalFlipSimilarity: roundedVerticalFlipSimilarity,
    minimumSimilarity: DEMO_VISUAL_AGREEMENT_THRESHOLD,
    minimumOrientationMargin: DEMO_VISUAL_AGREEMENT_MARGIN,
    checks,
    sourceSha256: sha256(sourceBytes),
    outputSha256: sha256(outputBytes),
  };
}

export function inspectDemoVisualAgreement(
  report,
  { sourceBytes, outputBytes, resizeOptions } = {}
) {
  if (report?.schemaVersion === 1) {
    return inspectLegacyDemoVisualAgreement(report, { sourceBytes, outputBytes });
  }
  const errors = [];
  if (
    report?.schemaVersion === 3 &&
    !exactKeys(report, PORTABLE_DEMO_VISUAL_AGREEMENT_FIELDS)
  ) {
    errors.push('portable visual agreement fields drifted');
  }
  if (
    report?.schemaVersion === 3 &&
    !exactKeys(report?.checks, DEMO_VISUAL_AGREEMENT_CHECK_FIELDS)
  ) {
    errors.push('portable visual agreement check fields drifted');
  }
  const modernContract = report?.schemaVersion === 2
    ? {
        algorithm: DEMO_VISUAL_AGREEMENT_ALGORITHM,
        comparisonProfile: undefined,
      }
    : report?.schemaVersion === 3
      ? {
          algorithm: PORTABLE_DEMO_VISUAL_AGREEMENT_ALGORITHM,
          comparisonProfile: PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE,
          inputColorRange:
            PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.inputColorRange,
          comparisonColorRange:
            PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.comparisonColorRange,
          comparisonPixelFormat:
            PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.pixelFormat,
          comparisonScaler:
            PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.scaler,
          scoreTolerance:
            PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.scoreTolerance,
        }
      : null;
  if (modernContract === null) errors.push('schemaVersion must be 2 or 3');
  if (!DEMO_VISUAL_OUTCOMES.has(report?.status)) {
    errors.push('status must be passed or failed');
  }
  if (report?.algorithm !== modernContract?.algorithm) {
    errors.push('algorithm is unsupported');
  }
  if (report?.comparisonProfile !== modernContract?.comparisonProfile) {
    errors.push('comparison profile does not match the visual schema');
  }
  for (const field of [
    'inputColorRange',
    'comparisonColorRange',
    'comparisonPixelFormat',
    'comparisonScaler',
    'scoreTolerance',
  ]) {
    if (report?.[field] !== modernContract?.[field]) {
      errors.push(`${field} does not match the visual schema`);
    }
  }
  if (
    report?.schemaVersion === 3 &&
    (report?.sourceColorRange !== 'pc' || report?.outputColorRange !== 'pc')
  ) {
    errors.push('portable visual inputs must be full-range JPEG frames');
  }
  if (report?.resizeMode !== 'contain') {
    errors.push('resizeMode must be contain');
  }
  for (const field of [
    'maxWidth',
    'maxHeight',
    'sourceWidth',
    'sourceHeight',
    'expectedWidth',
    'expectedHeight',
    'width',
    'height',
  ]) {
    if (!positiveInteger(report?.[field])) {
      errors.push(`${field} must be a positive integer`);
    }
  }
  for (const field of ['uprightSimilarity', 'verticalFlipSimilarity']) {
    if (!unitInterval(report?.[field])) {
      errors.push(`${field} must be between 0 and 1`);
    }
  }
  if (report?.minimumSimilarity !== DEMO_VISUAL_AGREEMENT_THRESHOLD) {
    errors.push('minimum similarity drifted');
  }
  if (report?.minimumOrientationMargin !== DEMO_VISUAL_AGREEMENT_MARGIN) {
    errors.push('orientation margin drifted');
  }

  const expected = calculateContainDimensions({
    sourceWidth: report?.sourceWidth,
    sourceHeight: report?.sourceHeight,
    maxWidth: report?.maxWidth,
    maxHeight: report?.maxHeight,
  });
  if (
    report?.expectedWidth !== expected.width ||
    report?.expectedHeight !== expected.height
  ) {
    errors.push('expected dimensions do not match contain geometry');
  }
  const derivedChecks = deriveChecks({
    expected,
    width: report?.width,
    height: report?.height,
    resizeMode: report?.resizeMode,
    uprightSimilarity: report?.uprightSimilarity,
    verticalFlipSimilarity: report?.verticalFlipSimilarity,
  });
  for (const [check, expectedValue] of Object.entries(derivedChecks)) {
    if (report?.checks?.[check] !== expectedValue) {
      errors.push(`${check} check does not match the measured values`);
    }
  }
  const outcome = deriveOutcome(derivedChecks);
  if (report?.status !== outcome) {
    errors.push('status does not match the derived visual outcome');
  }
  if (resizeOptions !== undefined) {
    if (
      resizeOptions?.mode !== report?.resizeMode ||
      resizeOptions?.maxWidth !== report?.maxWidth ||
      resizeOptions?.maxHeight !== report?.maxHeight
    ) {
      errors.push('resize contract does not match the native request');
    }
  }
  if (report?.sourceSha256 !== sha256(sourceBytes)) {
    errors.push('source SHA-256 mismatch');
  }
  if (report?.outputSha256 !== sha256(outputBytes)) {
    errors.push('output SHA-256 mismatch');
  }
  return {
    status: errors.length === 0 ? 'passed' : 'failed',
    agreementStatus: errors.length === 0 ? outcome : null,
    error: errors.length === 0 ? null : errors.join(' | '),
  };
}

export function comparePortableDemoVisualAgreement(
  captured,
  replayed
) {
  const exactFields = [
    'schemaVersion',
    'status',
    'algorithm',
    'comparisonProfile',
    'inputColorRange',
    'comparisonColorRange',
    'comparisonPixelFormat',
    'comparisonScaler',
    'scoreTolerance',
    'sourceColorRange',
    'outputColorRange',
    'resizeMode',
    'maxWidth',
    'maxHeight',
    'sourceWidth',
    'sourceHeight',
    'expectedWidth',
    'expectedHeight',
    'width',
    'height',
    'minimumSimilarity',
    'minimumOrientationMargin',
    'checks',
    'sourceSha256',
    'outputSha256',
  ];
  const stableCaptured = Object.fromEntries(
    exactFields.map((field) => [field, captured?.[field]])
  );
  const stableReplayed = Object.fromEntries(
    exactFields.map((field) => [field, replayed?.[field]])
  );
  const uprightDelta = absoluteDelta(
    captured?.uprightSimilarity,
    replayed?.uprightSimilarity
  );
  const verticalFlipDelta = absoluteDelta(
    captured?.verticalFlipSimilarity,
    replayed?.verticalFlipSimilarity
  );
  const outcomesPassed = [captured, replayed].every(
    (report) =>
      report?.status === 'passed' &&
      report?.checks?.geometry === true &&
      report?.checks?.minimumSimilarity === true &&
      report?.checks?.orientationMargin === true
  );
  const measurementsMatch =
    uprightDelta !== null &&
    verticalFlipDelta !== null &&
    uprightDelta <= PORTABLE_DEMO_VISUAL_AGREEMENT_REPLAY_TOLERANCE &&
    verticalFlipDelta <= PORTABLE_DEMO_VISUAL_AGREEMENT_REPLAY_TOLERANCE;
  const stableFieldsMatch = isDeepStrictEqual(stableCaptured, stableReplayed);
  const portableSchema =
    captured?.schemaVersion === 3 &&
    replayed?.schemaVersion === 3 &&
    captured?.comparisonProfile === PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE &&
    replayed?.comparisonProfile === PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE;
  const exactShapes =
    exactKeys(captured, PORTABLE_DEMO_VISUAL_AGREEMENT_FIELDS) &&
    exactKeys(replayed, PORTABLE_DEMO_VISUAL_AGREEMENT_FIELDS) &&
    exactKeys(captured?.checks, DEMO_VISUAL_AGREEMENT_CHECK_FIELDS) &&
    exactKeys(replayed?.checks, DEMO_VISUAL_AGREEMENT_CHECK_FIELDS);
  const status =
    portableSchema &&
    exactShapes &&
    outcomesPassed &&
    stableFieldsMatch &&
    measurementsMatch
      ? 'passed'
      : 'failed';
  return {
    status,
    mode: 'portable-tolerance',
    measurementMatch: measurementsMatch,
    outcomesPassed,
    exactShapes,
    stableFieldsMatch,
    tolerance: PORTABLE_DEMO_VISUAL_AGREEMENT_REPLAY_TOLERANCE,
    uprightSimilarityDelta: uprightDelta,
    verticalFlipSimilarityDelta: verticalFlipDelta,
    error:
      status === 'passed'
        ? null
        : 'portable visual replay fields or measurements differ beyond the allowed contract',
  };
}

export function parseFfmpegSsim(stderr) {
  const matches = [...String(stderr).matchAll(/\bAll:([0-9]+(?:\.[0-9]+)?)/gu)];
  if (matches.length === 0) {
    throw new Error('ffmpeg SSIM summary is missing');
  }
  const value = Number(matches.at(-1)[1]);
  if (!unitInterval(value)) {
    throw new Error('ffmpeg SSIM summary is invalid');
  }
  return value;
}

export function parseFfmpegFrameDimensions(stderr) {
  const matches = [
    ...String(stderr).matchAll(/\b(?:s|size):(\d+)x(\d+)\b/gu),
  ];
  if (matches.length === 0) {
    throw new Error('ffmpeg auto-oriented frame dimensions are missing');
  }
  const width = Number(matches.at(-1)[1]);
  const height = Number(matches.at(-1)[2]);
  if (!positiveInteger(width) || !positiveInteger(height)) {
    throw new Error('ffmpeg auto-oriented frame dimensions are invalid');
  }
  return { width, height };
}

function deriveChecks({
  expected,
  width,
  height,
  resizeMode,
  uprightSimilarity,
  verticalFlipSimilarity,
}) {
  return {
    geometry:
      resizeMode === 'contain' &&
      positiveInteger(expected.width) &&
      positiveInteger(expected.height) &&
      width === expected.width &&
      height === expected.height,
    minimumSimilarity:
      unitInterval(uprightSimilarity) &&
      uprightSimilarity >= DEMO_VISUAL_AGREEMENT_THRESHOLD,
    orientationMargin:
      unitInterval(uprightSimilarity) &&
      unitInterval(verticalFlipSimilarity) &&
      uprightSimilarity >=
        verticalFlipSimilarity + DEMO_VISUAL_AGREEMENT_MARGIN,
  };
}

function deriveOutcome(checks) {
  return Object.values(checks).every((value) => value === true)
    ? 'passed'
    : 'failed';
}

function inspectLegacyDemoVisualAgreement(
  report,
  { sourceBytes, outputBytes } = {}
) {
  const errors = [];
  if (report?.status !== 'passed') errors.push('legacy status must be passed');
  if (report?.algorithm !== LEGACY_DEMO_VISUAL_AGREEMENT_ALGORITHM) {
    errors.push('legacy algorithm is unsupported');
  }
  if (!positiveInteger(report?.width) || !positiveInteger(report?.height)) {
    errors.push('legacy dimensions must be positive integers');
  }
  if (
    !unitInterval(report?.uprightSimilarity) ||
    report.uprightSimilarity < DEMO_VISUAL_AGREEMENT_THRESHOLD
  ) {
    errors.push('legacy upright similarity is below the minimum');
  }
  if (
    !unitInterval(report?.verticalFlipSimilarity) ||
    !unitInterval(report?.uprightSimilarity) ||
    report.uprightSimilarity <
      report.verticalFlipSimilarity + DEMO_VISUAL_AGREEMENT_MARGIN
  ) {
    errors.push('legacy upright similarity does not beat the vertical-flip control');
  }
  if (report?.minimumSimilarity !== DEMO_VISUAL_AGREEMENT_THRESHOLD) {
    errors.push('legacy minimum similarity drifted');
  }
  if (report?.minimumOrientationMargin !== DEMO_VISUAL_AGREEMENT_MARGIN) {
    errors.push('legacy orientation margin drifted');
  }
  if (report?.sourceSha256 !== sha256(sourceBytes)) {
    errors.push('source SHA-256 mismatch');
  }
  if (report?.outputSha256 !== sha256(outputBytes)) {
    errors.push('output SHA-256 mismatch');
  }
  return {
    status: errors.length === 0 ? 'passed' : 'failed',
    agreementStatus: errors.length === 0 ? 'passed' : null,
    error: errors.length === 0 ? null : errors.join(' | '),
  };
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function unitInterval(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes ?? Buffer.alloc(0)).digest('hex');
}

function roundSix(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function absoluteDelta(left, right) {
  if (!unitInterval(left) || !unitInterval(right)) return null;
  const leftMicrounits = Math.round(left * 1_000_000);
  const rightMicrounits = Math.round(right * 1_000_000);
  return Math.abs(leftMicrounits - rightMicrounits) / 1_000_000;
}

function exactKeys(value, expected) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isDeepStrictEqual(Object.keys(value).sort(), expected)
  );
}
