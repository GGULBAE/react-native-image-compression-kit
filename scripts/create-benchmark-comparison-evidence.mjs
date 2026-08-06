#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  buildComparisonEvidence,
  inspectComparisonEvidence,
  parseNativeComparisonPayload,
} from './benchmark-comparison-core.mjs';

const options = parseArgs(process.argv.slice(2));
for (const field of [
  'platform',
  'sourceSha',
  'runtime',
  'device',
  'source',
  'log',
  'plan',
  'destination',
  'runUrl',
]) {
  if (!options[field]) throw new Error(`--${toFlag(field)} is required`);
}
if (!['android', 'ios'].includes(options.platform)) {
  throw new Error('--platform must be android or ios');
}

const payload = parseNativeComparisonPayload(
  readFileSync(path.resolve(options.log), 'utf8')
);
if (payload.platform !== options.platform) {
  throw new Error('native comparison platform does not match --platform');
}

const destination = path.resolve(options.destination);
mkdirSync(destination, { recursive: true });
const sourceAsset = copyVerifiedAsset(
  path.resolve(options.source),
  path.join(destination, 'source.jpg'),
  'source.jpg'
);
const planAsset = copyVerifiedAsset(
  path.resolve(options.plan),
  path.join(destination, 'comparison-plan.json'),
  'comparison-plan.json'
);
const plan = JSON.parse(readFileSync(path.resolve(options.plan), 'utf8'));

const evidence = buildComparisonEvidence({
  payload,
  plan,
  sourceCommit: options.sourceSha,
  capturedAt: options.capturedAt ?? new Date().toISOString(),
  runtime: options.runtime,
  device: options.device,
  runUrl: options.runUrl,
  sourceAsset,
  planAsset,
});
const report = inspectComparisonEvidence(destination, evidence);
if (report.status !== 'passed') throw new Error(report.error);

const output = path.join(destination, 'benchmark-comparison.json');
if (existsSync(output)) {
  throw new Error(`benchmark comparison evidence already exists: ${output}`);
}
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report)}\n`);

function copyVerifiedAsset(source, destinationPath, file) {
  const sourceBytes = readFileSync(source);
  if (!existsSync(destinationPath)) {
    cpSync(source, destinationPath);
  } else if (!sameDigest(sourceBytes, readFileSync(destinationPath))) {
    throw new Error(`existing destination ${file} does not match source`);
  }
  const bytes = readFileSync(destinationPath);
  return {
    file,
    byteSize: statSync(destinationPath).size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function sameDigest(left, right) {
  return (
    createHash('sha256').update(left).digest('hex') ===
    createHash('sha256').update(right).digest('hex')
  );
}

function parseArgs(args) {
  const parsed = {};
  const normalizedArgs = args.filter((value) => value !== '--');
  for (let index = 0; index < normalizedArgs.length; index += 2) {
    const flag = normalizedArgs[index];
    const value = normalizedArgs[index + 1];
    if (!flag?.startsWith('--') || !value) {
      throw new Error(`invalid argument: ${flag ?? ''}`);
    }
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
