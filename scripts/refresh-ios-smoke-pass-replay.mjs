#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  createIOSSmokePassReplayFixture,
  formatIOSSmokePassReplayFixture,
  getIOSSmokePassReplayFixtureDifferences,
  validateIOSSmokePassReplayFixture,
} from './ios-smoke-pass-replay-fixture.mjs';

const DEFAULT_OUTPUT = 'test/fixtures/ios-smoke-pass-ci-replay.json';
const action = process.argv.slice(2).includes('--check') ? 'check' : 'refresh';

try {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
  } else if (options.check) {
    checkFixture(options);
  } else {
    refreshFixture(options);
  }
} catch (error) {
  console.error(`iOS PASS replay fixture ${action} failed: ${error.message}`);
  process.exitCode = 1;
}

function refreshFixture(options) {
  const outputPath = path.resolve(options.output ?? DEFAULT_OUTPUT);
  const fixture = createFixtureFromOptions(options);

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, formatIOSSmokePassReplayFixture(fixture));
  process.stdout.write(`Wrote iOS PASS replay fixture: ${outputPath}\n`);
}

function checkFixture(options) {
  const outputPath = path.resolve(options.output ?? DEFAULT_OUTPUT);
  const expectedFixture = createFixtureFromOptions(options);
  const expectedSource = formatIOSSmokePassReplayFixture(expectedFixture);
  let actualSource;

  try {
    actualSource = readFileSync(outputPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Fixture artifact not found: ${outputPath}.`);
    }
    throw error;
  }

  let actualFixture;
  try {
    actualFixture = JSON.parse(actualSource);
  } catch {
    throw new Error(`Fixture artifact JSON is invalid: ${outputPath}.`);
  }

  const differences = getIOSSmokePassReplayFixtureDifferences(
    expectedFixture,
    actualFixture
  );

  try {
    validateIOSSmokePassReplayFixture(actualFixture);
  } catch (error) {
    throw new Error(
      `Fixture artifact is invalid${formatDifferences(differences)} ${error.message}`
    );
  }

  if (actualSource !== expectedSource) {
    if (differences.length === 0) {
      differences.push('canonicalFormat');
    }

    throw new Error(`Fixture artifact is stale${formatDifferences(differences)}`);
  }

  process.stdout.write(`iOS PASS replay fixture is current: ${outputPath}\n`);
}

function createFixtureFromOptions(options) {
  const logPath = path.resolve(requireOption(options, 'logFile', '--log-file'));
  const runId = Number(requireOption(options, 'runId', '--run-id'));

  return createIOSSmokePassReplayFixture({
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

    if (arg === '--check') {
      options.check = true;
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

function formatDifferences(differences) {
  return differences.length === 0
    ? ':'
    : `; differences: ${differences.join(', ')}.`;
}

function printHelp() {
  process.stdout.write(`Usage: pnpm fixtures:ios-pass-replay -- \\
  --log-file <downloaded-actions-log> \\
  --workflow-name <workflow> \\
  --run-id <run-id> \\
  --run-url <run-url> \\
  --head-sha <40-character-sha> \\
  [--check] \\
  [--output ${DEFAULT_OUTPUT}]

Reads a local GitHub Actions log, extracts exactly one RNICK_IOS_SMOKE_PASS
source line, derives job/step/timestamp fields, and calculates SHA-256. It writes
a deterministic JSON fixture by default. With --check, it compares the expected
canonical JSON with the existing artifact and never writes a file.
This command performs no network access.
`);
}
