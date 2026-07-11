#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  createIOSSmokePassReplayFixture,
  formatIOSSmokePassReplayFixture,
  getIOSSmokePassReplayFixtureDifferences,
  getIOSSmokePassReplayFixtureValidationDifferences,
  validateIOSSmokePassReplayFixture,
} from './ios-smoke-pass-replay-fixture.mjs';

const DEFAULT_OUTPUT = 'test/fixtures/ios-smoke-pass-ci-replay.json';
const IOS_SMOKE_PASS_REPLAY_REPORT_SCHEMA_VERSION = 1;
const rawArgs = process.argv.slice(2);
const requestedJson = rawArgs.includes('--json');
const requestedMode = inferMode(rawArgs);
const fallbackArtifactPath = resolveOutputPathFromRawArgs(rawArgs);

try {
  const options = parseArgs(rawArgs);
  validateModeOptions(options);

  if (options.help) {
    printHelp();
  } else if (options.audit) {
    emitResult(auditFixture(options), options);
  } else if (options.check) {
    emitResult(checkFixture(options), options);
  } else {
    refreshFixture(options);
  }
} catch (error) {
  const failure = normalizeFailure(error, {
    mode: requestedMode,
    artifactPath: fallbackArtifactPath,
  });

  if (requestedJson) {
    process.stdout.write(`${JSON.stringify(failure.report)}\n`);
  } else {
    console.error(
      `iOS PASS replay fixture ${failure.report.mode} failed: ${failure.report.error}`
    );
  }
  process.exitCode = 1;
}

function refreshFixture(options) {
  const outputPath = resolveOutputPath(options);
  const fixture = createFixtureFromOptions(options);

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, formatIOSSmokePassReplayFixture(fixture));
  process.stdout.write(`Wrote iOS PASS replay fixture: ${outputPath}\n`);
}

function checkFixture(options) {
  const outputPath = resolveOutputPath(options);
  const expectedFixture = createFixtureFromOptions(options);
  const expectedSource = formatIOSSmokePassReplayFixture(expectedFixture);
  const { source: actualSource, fixture: actualFixture } = readArtifact(
    outputPath,
    'check'
  );
  const differences = mergeDifferences(
    getIOSSmokePassReplayFixtureDifferences(expectedFixture, actualFixture),
    getIOSSmokePassReplayFixtureValidationDifferences(actualFixture)
  );

  try {
    validateIOSSmokePassReplayFixture(actualFixture);
  } catch (error) {
    throw createFailure({
      mode: 'check',
      status: 'invalid',
      artifactPath: outputPath,
      differences,
      error: `Fixture artifact is invalid${formatDifferences(differences)} ${error.message}`,
    });
  }

  if (actualSource !== expectedSource) {
    if (differences.length === 0) {
      differences.push('canonicalFormat');
    }

    throw createFailure({
      mode: 'check',
      status: 'stale',
      artifactPath: outputPath,
      differences,
      error: `Fixture artifact is stale${formatDifferences(differences)}`,
    });
  }

  return createReport({
    mode: 'check',
    status: 'current',
    artifactPath: outputPath,
  });
}

function auditFixture(options) {
  const outputPath = resolveOutputPath(options);
  const { source, fixture } = readArtifact(outputPath, 'audit');
  const differences = getIOSSmokePassReplayFixtureValidationDifferences(
    fixture
  );

  try {
    validateIOSSmokePassReplayFixture(fixture);
  } catch (error) {
    throw createFailure({
      mode: 'audit',
      status: 'invalid',
      artifactPath: outputPath,
      differences,
      error: `Fixture artifact is invalid${formatDifferences(differences)} ${error.message}`,
    });
  }

  if (source !== formatIOSSmokePassReplayFixture(fixture)) {
    differences.push('canonicalFormat');
    throw createFailure({
      mode: 'audit',
      status: 'stale',
      artifactPath: outputPath,
      differences,
      error: `Fixture artifact is stale${formatDifferences(differences)}`,
    });
  }

  return createReport({
    mode: 'audit',
    status: 'current',
    artifactPath: outputPath,
  });
}

function readArtifact(outputPath, mode) {
  let source;
  try {
    source = readFileSync(outputPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw createFailure({
        mode,
        status: 'invalid',
        artifactPath: outputPath,
        error: `Fixture artifact not found: ${outputPath}.`,
      });
    }
    throw error;
  }

  let fixture;
  try {
    fixture = JSON.parse(source);
  } catch {
    throw createFailure({
      mode,
      status: 'invalid',
      artifactPath: outputPath,
      error: `Fixture artifact JSON is invalid: ${outputPath}.`,
    });
  }

  return { source, fixture };
}

function createFixtureFromOptions(options) {
  const logPath = path.resolve(requireOption(options, 'logFile', '--log-file'));
  const runId = Number(requireOption(options, 'runId', '--run-id'));

  return createIOSSmokePassReplayFixture({
    logText: readFileSync(logPath, 'utf8'),
    workflowName: requireOption(options, 'workflowName', '--workflow-name'),
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

    if (arg === '--audit') {
      options.audit = true;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
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

function validateModeOptions(options) {
  if (options.help) {
    return;
  }

  if (options.check && options.audit) {
    throw new Error('--check and --audit cannot be used together.');
  }

  if (options.json && !options.check && !options.audit) {
    throw new Error('--json requires --check or --audit.');
  }

  if (options.audit) {
    const sourceFlags = [
      ['logFile', '--log-file'],
      ['workflowName', '--workflow-name'],
      ['runId', '--run-id'],
      ['runUrl', '--run-url'],
      ['headSha', '--head-sha'],
    ]
      .filter(([key]) => options[key])
      .map(([, flag]) => flag);

    if (sourceFlags.length > 0) {
      throw new Error(
        `--audit cannot be combined with source options: ${sourceFlags.join(', ')}.`
      );
    }
  }
}

function emitResult(report, options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return;
  }

  const message =
    report.mode === 'check'
      ? `iOS PASS replay fixture is current: ${report.artifactPath}`
      : `iOS PASS replay fixture audit passed: ${report.artifactPath}`;
  process.stdout.write(`${message}\n`);
}

function createReport({
  mode,
  status,
  artifactPath,
  differences = [],
  error = null,
}) {
  return {
    schemaVersion: IOS_SMOKE_PASS_REPLAY_REPORT_SCHEMA_VERSION,
    mode,
    status,
    artifactPath,
    differences,
    error,
  };
}

function createFailure({
  mode,
  status,
  artifactPath,
  differences = [],
  error,
}) {
  const failure = new Error(error);
  failure.report = createReport({
    mode,
    status,
    artifactPath,
    differences,
    error,
  });
  return failure;
}

function normalizeFailure(error, { mode, artifactPath }) {
  if (error?.report) {
    return error;
  }

  return createFailure({
    mode,
    status: 'invalid',
    artifactPath,
    error: error instanceof Error ? error.message : String(error),
  });
}

function requireOption(options, key, flag) {
  const value = options[key];
  if (!value) {
    throw new Error(`${flag} is required.`);
  }
  return value;
}

function inferMode(args) {
  if (args.includes('--check')) {
    return 'check';
  }
  if (args.includes('--audit')) {
    return 'audit';
  }
  return 'refresh';
}

function resolveOutputPath(options) {
  return path.resolve(options.output ?? DEFAULT_OUTPUT);
}

function resolveOutputPathFromRawArgs(args) {
  const outputIndex = args.lastIndexOf('--output');
  const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  return path.resolve(
    output && !output.startsWith('--') ? output : DEFAULT_OUTPUT
  );
}

function mergeDifferences(...groups) {
  return [...new Set(groups.flat())];
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
  [--json] \\
  [--output ${DEFAULT_OUTPUT}]

       pnpm fixtures:ios-pass-replay:audit -- \\
  [--json] \\
  [--output ${DEFAULT_OUTPUT}]

Reads a local GitHub Actions log, extracts exactly one RNICK_IOS_SMOKE_PASS
source line, derives job/step/timestamp fields, validates the capability-driven
payload contract, and calculates SHA-256. It writes a deterministic JSON fixture
by default. With --check, it compares the expected canonical JSON with the
existing artifact. With --audit, it validates the existing artifact without a
source log. The command never writes a file in check or audit mode. With
--json, check and audit results use the stable schemaVersion/mode/status/
artifactPath/differences/
error report fields. This command performs no network access.
`);
}
