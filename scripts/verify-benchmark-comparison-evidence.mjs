#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { inspectComparisonEvidence } from './benchmark-comparison-core.mjs';

const artifactDir = path.resolve(process.argv[2] === '--' ? process.argv[3] : process.argv[2] ?? '');
if (!artifactDir || !existsSync(artifactDir)) {
  throw new Error('usage: verify-benchmark-comparison-evidence <artifact-dir>');
}
const evidencePath = path.join(artifactDir, 'benchmark-comparison.json');
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
const report = inspectComparisonEvidence(artifactDir, evidence);
process.stdout.write(`${JSON.stringify(report)}\n`);
if (report.status !== 'passed') process.exitCode = 1;
