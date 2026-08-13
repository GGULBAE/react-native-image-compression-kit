#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  calculateContainDimensions,
  createDemoVisualAgreementReport,
  parseFfmpegFrameDimensions,
  parseFfmpegSsim,
  PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT,
  PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE,
} from './demo-visual-agreement-core.mjs';

const options = parseArgs(process.argv.slice(2));
for (const field of [
  'source',
  'output',
  'report',
  'resizeMode',
  'maxWidth',
  'maxHeight',
]) {
  if (!options[field]) throw new Error(`--${field} is required`);
}
if (options.resizeMode !== 'contain') {
  throw new Error('--resize-mode must be contain');
}
if (
  options.comparisonProfile !== undefined &&
  options.comparisonProfile !== PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE
) {
  throw new Error('--comparison-profile is unsupported');
}
const maxWidth = positiveInteger(options.maxWidth, '--max-width');
const maxHeight = positiveInteger(options.maxHeight, '--max-height');
const source = path.resolve(options.source);
const output = path.resolve(options.output);
const sourceDimensions = inspectAutoOrientedDimensions(source);
const outputDimensions = inspectDimensions(output);
const portable =
  options.comparisonProfile === PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE;
const sourceColorRange = portable ? inspectColorRange(source) : undefined;
const outputColorRange = portable ? inspectColorRange(output) : undefined;
if (portable && (sourceColorRange !== 'pc' || outputColorRange !== 'pc')) {
  throw new Error(
    '--comparison-profile requires full-range source and output JPEG frames'
  );
}
const expectedDimensions = calculateContainDimensions({
  sourceWidth: sourceDimensions.width,
  sourceHeight: sourceDimensions.height,
  maxWidth,
  maxHeight,
});
const uprightSimilarity = measureSimilarity(
  source,
  output,
  expectedDimensions,
  false,
  options.comparisonProfile
);
const verticalFlipSimilarity = measureSimilarity(
  source,
  output,
  expectedDimensions,
  true,
  options.comparisonProfile
);
const report = createDemoVisualAgreementReport({
  sourceBytes: readFileSync(source),
  outputBytes: readFileSync(output),
  sourceWidth: sourceDimensions.width,
  sourceHeight: sourceDimensions.height,
  width: outputDimensions.width,
  height: outputDimensions.height,
  resizeMode: options.resizeMode,
  maxWidth,
  maxHeight,
  uprightSimilarity,
  verticalFlipSimilarity,
  comparisonProfile: options.comparisonProfile,
  sourceColorRange,
  outputColorRange,
});
writeFileSync(path.resolve(options.report), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report)}\n`);
if (report.status !== 'passed') process.exit(1);

function inspectAutoOrientedDimensions(file) {
  const result = mustRun('ffmpeg', [
    '-hide_banner',
    '-nostdin',
    '-i', file,
    '-vf', 'showinfo',
    '-frames:v', '1',
    '-f', 'null',
    '-',
  ]);
  return parseFfmpegFrameDimensions(result.stderr);
}

function inspectDimensions(file) {
  const result = mustRun('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'json',
    file,
  ]);
  const stream = JSON.parse(result.stdout).streams?.[0];
  if (!Number.isInteger(stream?.width) || !Number.isInteger(stream?.height)) {
    throw new Error('ffprobe did not return output dimensions');
  }
  return { width: stream.width, height: stream.height };
}

function inspectColorRange(file) {
  const result = mustRun('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=color_range',
    '-of', 'json',
    file,
  ]);
  const colorRange = JSON.parse(result.stdout).streams?.[0]?.color_range;
  if (typeof colorRange !== 'string' || colorRange.length === 0) {
    throw new Error('ffprobe did not return an input color range');
  }
  return colorRange;
}

function measureSimilarity(
  source,
  output,
  { width, height },
  flipVertically,
  comparisonProfile
) {
  const rangeContract =
    comparisonProfile === PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE
      ? `:in_range=${PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.inputColorRange}` +
        `:out_range=${PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.comparisonColorRange}`
      : '';
  const scaler = portableValue(
    comparisonProfile,
    PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.scaler,
    'lanczos'
  );
  const pixelFormat = portableValue(
    comparisonProfile,
    PORTABLE_DEMO_VISUAL_AGREEMENT_CONTRACT.pixelFormat,
    'yuv444p'
  );
  const referenceFilters = [
    `scale=${width}:${height}:flags=${scaler}${rangeContract}`,
    ...(flipVertically ? ['vflip'] : []),
    `format=${pixelFormat}`,
  ].join(',');
  const result = mustRun('ffmpeg', [
    '-hide_banner',
    '-nostdin',
    '-i', source,
    '-i', output,
    '-filter_complex',
    `[0:v]${referenceFilters}[reference];` +
      `[1:v]scale=${width}:${height}:flags=${scaler}${rangeContract},format=${pixelFormat}[candidate];` +
      '[reference][candidate]ssim',
    '-frames:v', '1',
    '-f', 'null',
    '-',
  ]);
  return parseFfmpegSsim(result.stderr);
}

function portableValue(profile, portable, legacy) {
  return profile === PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE
    ? portable
    : legacy;
}

function mustRun(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr.trim()}`);
  }
  return result;
}

function positiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith('--') || !value) {
      throw new Error(`invalid argument: ${flag ?? ''}`);
    }
    parsed[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  return parsed;
}
