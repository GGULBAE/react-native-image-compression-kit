#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDocumentation } from './docs-semantic-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  const report = validateDocumentation(root);
  console.log(
    `Documentation verification passed: ${report.status.packageVersion} ${report.status.releaseState}, npm latest ${report.status.npmLatest} checked ${report.status.registryCheckedAt}, README/RELEASE aligned to docs/release-status.json, ${report.markdownFiles.length} Markdown files.`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
