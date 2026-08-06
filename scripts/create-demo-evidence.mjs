#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { inspectMp4 } from './demo-evidence-core.mjs';
import {
  inspectGuidedDemoPayload,
  parseGuidedDemoPayload,
} from './guided-demo-core.mjs';

const options = parseArgs(process.argv.slice(2));
for (const field of [
  'platform',
  'packageVersion',
  'sourceSha',
  'runtime',
  'device',
  'source',
  'output',
  'screenshot',
  'recording',
  'captureMethod',
  'log',
  'destination',
  'runUrl',
]) {
  if (!options[field]) throw new Error(`--${toFlag(field)} is required`);
}
if (!['android', 'ios'].includes(options.platform)) {
  throw new Error('--platform must be android or ios');
}
if (!/^\d+\.\d+\.\d+$/.test(options.packageVersion)) {
  throw new Error('--package-version must be an exact semantic version');
}
if (!/^[0-9a-f]{40}$/.test(options.sourceSha)) {
  throw new Error('--source-sha must be a lowercase full commit SHA');
}

const log = readFileSync(path.resolve(options.log), 'utf8');
const payload = parseDemoPayload(log);
const guidedPayload = parseGuidedDemoPayload(log);
if (payload.platform !== options.platform || payload.schemaVersion !== 1) {
  throw new Error('native demo payload platform or schema does not match the request');
}
if (payload.result?.format !== 'jpeg') {
  throw new Error(`native demo expected JPEG output, received ${payload.result?.format}`);
}
if (
  !Number.isInteger(payload.result?.byteSize) ||
  payload.result.byteSize <= 0 ||
  !Number.isInteger(payload.result?.originalByteSize) ||
  payload.result.originalByteSize <= 0
) {
  throw new Error('native demo result byte metrics must be positive integers');
}
if (
  payload.result.byteSize >= payload.result.originalByteSize ||
  payload.result.compressionRatio >= 1
) {
  throw new Error('native demo output must be smaller than its deterministic source');
}
const guidedReport = inspectGuidedDemoPayload(guidedPayload, {
  platform: options.platform,
  options: payload.options,
  result: nativeResultMetrics(payload.result),
});
if (guidedReport.status !== 'passed') {
  throw new Error(guidedReport.error);
}

const destination = path.resolve(options.destination);
mkdirSync(destination, { recursive: true });
const assetPaths = {
  source: path.join(destination, 'source.jpg'),
  output: path.join(destination, 'output.jpg'),
  screenshot: path.join(destination, 'screen.png'),
  recording: path.join(destination, 'recording.mp4'),
};
cpSync(path.resolve(options.source), assetPaths.source);
cpSync(path.resolve(options.output), assetPaths.output);
cpSync(path.resolve(options.screenshot), assetPaths.screenshot);
cpSync(path.resolve(options.recording), assetPaths.recording);

const assets = Object.fromEntries(
  Object.entries(assetPaths).map(([name, filePath]) => [
    name,
    {
      file: path.basename(filePath),
      byteSize: statSync(filePath).size,
      sha256: sha256(readFileSync(filePath)),
    },
  ])
);
if (assets.source.byteSize !== payload.result.originalByteSize) {
  throw new Error('copied source byte size does not match the native result');
}
if (assets.output.byteSize !== payload.result.byteSize) {
  throw new Error('copied output byte size does not match the native result');
}
if (!isPng(readFileSync(assetPaths.screenshot))) {
  throw new Error('captured screen is not a PNG file');
}
const recordingReport = inspectMp4(readFileSync(assetPaths.recording));
if (recordingReport.status !== 'passed') {
  throw new Error(`captured walkthrough is not a valid timed MP4: ${recordingReport.error}`);
}
if (
  recordingReport.durationSeconds < 18 ||
  recordingReport.durationSeconds > 30
) {
  throw new Error('captured walkthrough duration must be between 18 and 30 seconds');
}
assets.recording.durationSeconds = roundMilliseconds(recordingReport.durationSeconds);
assets.recording.captureMethod = options.captureMethod;

const evidence = {
  schemaVersion: 2,
  status: 'passed',
  packageVersion: options.packageVersion,
  sourceCommit: options.sourceSha,
  capturedAt: options.capturedAt ?? new Date().toISOString(),
  platform: options.platform,
  runtime: options.runtime,
  device: options.device,
  runUrl: options.runUrl,
  sourceUriKind: payload.sourceUri.startsWith('file://') ? 'file' : 'content',
  options: payload.options,
  result: {
    format: payload.result.format,
    width: payload.result.width,
    height: payload.result.height,
    byteSize: payload.result.byteSize,
    originalByteSize: payload.result.originalByteSize,
    compressionRatio: payload.result.compressionRatio,
  },
  walkthrough: guidedPayload,
  assets,
};
writeFileSync(
  path.join(destination, 'manifest.json'),
  `${JSON.stringify(evidence, null, 2)}\n`
);
process.stdout.write(`${JSON.stringify(evidence)}\n`);

function parseDemoPayload(contents) {
  const matches = [...contents.matchAll(/RNICK_DEMO_PASS (\{.+\})/g)];
  if (matches.length === 0) throw new Error('RNICK_DEMO_PASS payload is missing');
  try {
    return JSON.parse(matches.at(-1)[1]);
  } catch (error) {
    throw new Error(`RNICK_DEMO_PASS payload is invalid: ${error.message}`);
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function isPng(bytes) {
  return bytes.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
}

function nativeResultMetrics(result) {
  return {
    format: result.format,
    width: result.width,
    height: result.height,
    byteSize: result.byteSize,
    originalByteSize: result.originalByteSize,
    compressionRatio: result.compressionRatio,
  };
}

function roundMilliseconds(value) {
  return Math.round(value * 1_000) / 1_000;
}

function parseArgs(args) {
  const parsed = {};
  const normalizedArgs = args.filter((value) => value !== '--');
  for (let index = 0; index < normalizedArgs.length; index += 2) {
    const flag = normalizedArgs[index];
    const value = normalizedArgs[index + 1];
    if (!flag?.startsWith('--') || !value) throw new Error(`invalid argument: ${flag ?? ''}`);
    parsed[toCamel(flag.slice(2))] = value;
  }
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toFlag(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
