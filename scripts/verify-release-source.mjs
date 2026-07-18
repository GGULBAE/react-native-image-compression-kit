#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectReleaseSource } from './release-source-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = parseArgs(process.argv.slice(2));
if (!options.sourceSha || !options.masterSha || !options.checkRuns) {
  throw new Error(
    'usage: verify-release-source --source-sha <sha> --master-sha <sha> --check-runs <file> [--report-file <file>]'
  );
}

const contract = readJson(path.join(root, 'docs/repository-settings.json'));
const checkResponse = readJson(path.resolve(options.checkRuns));
const report = inspectReleaseSource({
  expectedSourceSha: options.sourceSha,
  checkedOutSha: run('git', ['rev-parse', 'HEAD']).trim(),
  masterSha: options.masterSha,
  requiredChecks: contract.branchRuleset.requiredStatusChecks,
  checkRuns: checkResponse.check_runs,
});
const output = `${JSON.stringify(report)}\n`;
if (options.reportFile) writeFileSync(path.resolve(options.reportFile), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);

function parseArgs(args) {
  const parsed = {};
  const fields = {
    '--source-sha': 'sourceSha',
    '--master-sha': 'masterSha',
    '--check-runs': 'checkRuns',
    '--report-file': 'reportFile',
  };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--') continue;
    const field = fields[args[index]];
    if (!field) throw new Error(`unknown release-source argument: ${args[index]}`);
    parsed[field] = args[++index];
  }
  return parsed;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `${command} exited with ${result.status}`);
  return result.stdout;
}
