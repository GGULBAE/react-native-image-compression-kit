#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildBenchmarkEvidence,
  inspectBenchmarkEvidence,
  parseNativeBenchmarkPayload,
} from './benchmark-core.mjs';

const options = parseArgs(process.argv.slice(2));
for (const field of [
  'platform',
  'packageVersion',
  'sourceSha',
  'runtime',
  'device',
  'source',
  'log',
  'destination',
  'runUrl',
]) {
  if (!options[field]) throw new Error(`--${toFlag(field)} is required`);
}
if (!['android', 'ios'].includes(options.platform)) {
  throw new Error('--platform must be android or ios');
}
const payload = parseNativeBenchmarkPayload(
  readFileSync(path.resolve(options.log), 'utf8')
);
if (payload.platform !== options.platform) {
  throw new Error('native benchmark platform does not match --platform');
}

const destination = path.resolve(options.destination);
mkdirSync(destination, { recursive: true });
const destinationSource = path.join(destination, 'source.jpg');
const sourceBytes = readFileSync(path.resolve(options.source));
if (!existsSync(destinationSource)) {
  cpSync(path.resolve(options.source), destinationSource);
} else if (
  createHash('sha256').update(readFileSync(destinationSource)).digest('hex') !==
  createHash('sha256').update(sourceBytes).digest('hex')
) {
  throw new Error('existing destination source does not match --source');
}

const evidence = buildBenchmarkEvidence({
  payload,
  packageVersion: options.packageVersion,
  sourceCommit: options.sourceSha,
  capturedAt: options.capturedAt ?? new Date().toISOString(),
  runtime: options.runtime,
  device: options.device,
  runUrl: options.runUrl,
  sourceAsset: {
    file: 'source.jpg',
    byteSize: statSync(destinationSource).size,
    sha256: createHash('sha256')
      .update(readFileSync(destinationSource))
      .digest('hex'),
  },
});
const report = inspectBenchmarkEvidence(destination, evidence);
if (report.status !== 'passed') throw new Error(report.error);

const output = path.join(destination, 'benchmark.json');
if (existsSync(output)) throw new Error(`benchmark evidence already exists: ${output}`);
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report)}\n`);

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
