#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCompatibilityMatrix } from './compatibility-matrix-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(
  readFileSync(path.join(root, 'docs/compatibility-matrix.json'), 'utf8')
);
const report = validateCompatibilityMatrix(manifest, packageJson);

if (!report.ok) {
  console.error(`Compatibility matrix verification failed:\n- ${report.errors.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `Compatibility matrix verification passed: ${report.lanes.length} exact lanes cover RN floor/current, Legacy/New Architecture, Android/iOS, Node floor, and Expo development builds.`
);
