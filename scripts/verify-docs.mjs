#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDocumentation } from './docs-semantic-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  const report = validateDocumentation(root);
  console.log(
    `Documentation verification passed: release target ${report.status.releaseTarget} ${report.status.releaseState}, published npm latest ${report.status.publishedNpmLatest} checked ${report.status.registryCheckedAt}, package/README/RELEASE aligned to docs/release-status.json, ${report.markdownFiles.length} Markdown files.`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
