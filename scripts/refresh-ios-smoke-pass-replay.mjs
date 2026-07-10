#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  createIOSSmokePassReplayFixture,
  formatIOSSmokePassReplayFixture,
} from './ios-smoke-pass-replay-fixture.mjs';

const DEFAULT_OUTPUT = 'test/fixtures/ios-smoke-pass-ci-replay.json';

try {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
  } else {
    refreshFixture(options);
  }
} catch (error) {
  console.error(`iOS PASS replay fixture refresh failed: ${error.message}`);
  process.exitCode = 1;
}

function refreshFixture(options) {
  const logPath = path.resolve(requireOption(options, 'logFile', '--log-file'));
  const outputPath = path.resolve(options.output ?? DEFAULT_OUTPUT);
  const runId = Number(requireOption(options, 'runId', '--run-id'));
  const fixture = createIOSSmokePassReplayFixture({
    logText: readFileSync(logPath, 'utf8'),
    workflowName: requireOption(
      options,
      'workflowName',
      '--workflow-name'
    ),
    runId,
    runUrl: requireOption(options, 'runUrl', '--run-url'),
    headSha: requireOption(options, 'headSha', '--head-sha'),
  });

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, formatIOSSmokePassReplayFixture(fixture));
  process.stdout.write(`Wrote iOS PASS replay fixture: ${outputPath}\n`);
}

function parseArgs(args) {
  const options = {};
  const flags = new Map([
    ['--log-file', 'logFile'],
    ['--workflow-name', 'workflowName'],
    ['--run-id', 'runId'],
    ['--run-url', 'runUrl'],
    ['--head-sha', 'headSha'],
    ['--output', 'output'],
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') {
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    const optionName = flags.get(arg);
    if (!optionName) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}.`);
    }

    options[optionName] = value;
    index += 1;
  }

  return options;
}

function requireOption(options, key, flag) {
  const value = options[key];
  if (!value) {
    throw new Error(`${flag} is required.`);
  }
  return value;
}

function printHelp() {
  process.stdout.write(`Usage: pnpm fixtures:ios-pass-replay -- \\
  --log-file <downloaded-actions-log> \\
  --workflow-name <workflow> \\
  --run-id <run-id> \\
  --run-url <run-url> \\
  --head-sha <40-character-sha> \\
  [--output ${DEFAULT_OUTPUT}]

Reads a local GitHub Actions log, extracts exactly one RNICK_IOS_SMOKE_PASS
source line, derives job/step/timestamp fields, calculates SHA-256, and writes
a deterministic JSON fixture. This command performs no network access.
`);
}
