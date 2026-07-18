#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRepositorySettingsContract } from './repository-settings-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(
  readFileSync(path.join(root, 'docs/repository-settings.json'), 'utf8')
);
const report = validateRepositorySettingsContract(contract);
if (!report.ok) {
  console.error(`Repository settings contract failed:\n- ${report.errors.join('\n- ')}`);
  process.exit(1);
}
console.log('Repository settings contract passed: metadata, community, security, Actions, rulesets, environments, and Pages are explicit.');
