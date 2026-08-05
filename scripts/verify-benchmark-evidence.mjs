#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { inspectBenchmarkEvidence } from './benchmark-core.mjs';

const options = parseArgs(process.argv.slice(2));
if (!options.artifactDir) throw new Error('--artifact-dir is required');

const artifactDir = path.resolve(options.artifactDir);
const evidence = JSON.parse(
  readFileSync(path.join(artifactDir, 'benchmark.json'), 'utf8')
);
const report = inspectBenchmarkEvidence(artifactDir, evidence);
const serialized = `${JSON.stringify(report)}\n`;
if (options.reportFile) writeFileSync(path.resolve(options.reportFile), serialized);
process.stdout.write(serialized);
if (report.status !== 'passed') process.exitCode = 1;

function parseArgs(args) {
  const parsed = {};
  const normalizedArgs = args.filter((value) => value !== '--');
  for (let index = 0; index < normalizedArgs.length; index += 2) {
    const flag = normalizedArgs[index];
    const value = normalizedArgs[index + 1];
    if (!flag?.startsWith('--') || !value) {
      throw new Error(`invalid argument: ${flag ?? ''}`);
    }
    parsed[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  return parsed;
}
