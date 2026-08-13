import { createHash } from 'node:crypto';

export const DEMO_VISUAL_AGREEMENT_ALGORITHM =
  'ffmpeg-auto-oriented-contain-ssim-v2';
export const DEMO_VISUAL_AGREEMENT_THRESHOLD = 0.9;
export const DEMO_VISUAL_AGREEMENT_MARGIN = 0.02;

const DEMO_VISUAL_OUTCOMES = new Set(['passed', 'failed']);
const LEGACY_DEMO_VISUAL_AGREEMENT_ALGORITHM =
  'ffmpeg-auto-oriented-ssim-v1';

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
}) {
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
    schemaVersion: 2,
    status: deriveOutcome(checks),
    algorithm: DEMO_VISUAL_AGREEMENT_ALGORITHM,
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
  if (report?.schemaVersion !== 2) errors.push('schemaVersion must be 2');
  if (!DEMO_VISUAL_OUTCOMES.has(report?.status)) {
    errors.push('status must be passed or failed');
  }
  if (report?.algorithm !== DEMO_VISUAL_AGREEMENT_ALGORITHM) {
    errors.push('algorithm is unsupported');
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
