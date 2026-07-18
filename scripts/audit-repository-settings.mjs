#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditRepositorySettings } from './repository-settings-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(
  readFileSync(path.join(root, 'docs/repository-settings.json'), 'utf8')
);
const repository = contract.repository;
const actual = {
  repository: api(`repos/${repository}`),
  privateVulnerability: api(`repos/${repository}/private-vulnerability-reporting`, true),
  immutableReleases: api(`repos/${repository}/immutable-releases`, true),
  actions: api(`repos/${repository}/actions/permissions`),
  workflowPermissions: api(`repos/${repository}/actions/permissions/workflow`),
  rulesets: api(`repos/${repository}/rulesets`),
  environments: api(`repos/${repository}/environments`).environments,
  community: api(`repos/${repository}/community/profile`),
  pages: api(`repos/${repository}/pages`, true),
};
const report = auditRepositorySettings(contract, actual);
const output = `${JSON.stringify(report)}\n`;
const reportIndex = process.argv.indexOf('--report-file');
if (reportIndex >= 0) {
  const destination = process.argv[reportIndex + 1];
  if (!destination) throw new Error('--report-file requires a path');
  writeFileSync(path.resolve(destination), output);
}
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);

function api(endpoint, allowNotFound = false) {
  const result = spawnSync(
    'gh',
    ['api', endpoint, '-H', 'X-GitHub-Api-Version: 2026-03-10'],
    { cwd: root, encoding: 'utf8' }
  );
  if (allowNotFound && result.status !== 0 && /HTTP 404|Not Found/.test(result.stderr)) {
    return { enabled: false, build_type: null };
  }
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `gh api failed: ${endpoint}`);
  return JSON.parse(result.stdout || '{}');
}
