#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { inspectDemoEvidence } from './demo-evidence-core.mjs';

const root = path.resolve(import.meta.dirname, '..', 'website', 'public', 'demo');
const manifestPath = path.join(root, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('Native demo evidence manifest is missing.');
  process.exit(1);
}
const report = inspectDemoEvidence(
  root,
  JSON.parse(readFileSync(manifestPath, 'utf8'))
);
process.stdout.write(`${JSON.stringify(report)}\n`);
if (report.status !== 'passed') process.exit(1);
