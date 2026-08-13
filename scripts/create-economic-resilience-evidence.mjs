#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  ECONOMIC_RESILIENCE_ASSET_FILES,
  buildEconomicResilienceEvidence,
  inspectEconomicResilienceEvidence,
  parseNativeEconomicResiliencePayload,
} from './economic-resilience-evidence-core.mjs';

const options = parseArgs(process.argv.slice(2));
for (const field of [
  'platform',
  'packageVersion',
  'sourceSha',
  'runId',
  'runAttempt',
  'runUrl',
  'log',
  'source',
  'output',
  'fixtureManifest',
  'visualAgreement',
  'environment',
  'destination',
]) {
  if (!options[field]) throw new Error(`--${toFlag(field)} is required`);
}
if (!['android', 'ios'].includes(options.platform)) {
  throw new Error('--platform must be android or ios');
}

const inputPaths = Object.fromEntries(
  ['log', 'source', 'output', 'fixtureManifest', 'visualAgreement', 'environment'].map(
    (field) => [field, secureInputFile(options[field], `--${toFlag(field)}`)]
  )
);
const payload = parseNativeEconomicResiliencePayload(
  readFileSync(inputPaths.log, 'utf8')
);
if (payload.platform !== options.platform) {
  throw new Error('native economic resilience platform does not match --platform');
}
const sourceBytes = readFileSync(inputPaths.source);
const outputBytes = readFileSync(inputPaths.output);
const fixtureManifest = readJson(inputPaths.fixtureManifest);
const visualAgreement = readJson(inputPaths.visualAgreement);
const environment = readJson(inputPaths.environment);
const evidence = buildEconomicResilienceEvidence({
  payload,
  packageVersion: options.packageVersion,
  sourceCommit: options.sourceSha,
  runId: positiveInteger(options.runId, '--run-id'),
  runAttempt: positiveInteger(options.runAttempt, '--run-attempt'),
  capturedAt: options.capturedAt ?? new Date().toISOString(),
  runUrl: options.runUrl,
  environment,
  fixtureManifest,
  sourceBytes,
  outputBytes,
  visualAgreement,
});

const preparedDestination = secureDestinationRoot(options.destination);
const destinationRoot = preparedDestination.path;
const destination = path.join(destinationRoot, 'economic-resilience');
if (pathEntryExists(destination)) {
  if (preparedDestination.created) rmdirSync(destinationRoot);
  throw new Error(`economic resilience evidence already exists: ${destination}`);
}
const temporary = mkdtempSync(path.join(destinationRoot, '.economic-resilience.tmp-'));
try {
  cpSync(inputPaths.source, path.join(temporary, 'source.jpg'), { errorOnExist: true });
  cpSync(inputPaths.output, path.join(temporary, 'output.jpg'), { errorOnExist: true });
  cpSync(inputPaths.fixtureManifest, path.join(temporary, 'fixture-manifest.json'), {
    errorOnExist: true,
  });
  cpSync(inputPaths.visualAgreement, path.join(temporary, 'visual-agreement.json'), {
    errorOnExist: true,
  });
  writeFileSync(
    path.join(temporary, 'environment.json'),
    `${JSON.stringify(evidence.environment, null, 2)}\n`,
    { flag: 'wx' }
  );
  writeFileSync(
    path.join(temporary, 'economic-resilience.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    { flag: 'wx' }
  );
  const actualFiles = readdirSync(temporary).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(ECONOMIC_RESILIENCE_ASSET_FILES)) {
    throw new Error('economic resilience builder wrote an unexpected asset set');
  }
  const report = inspectEconomicResilienceEvidence(temporary, evidence);
  if (report.status !== 'passed') throw new Error(report.error);
  if (pathEntryExists(destination)) {
    throw new Error(`economic resilience evidence appeared during creation: ${destination}`);
  }
  renameSync(temporary, destination);
  process.stdout.write(`${JSON.stringify(report)}\n`);
} catch (error) {
  if (existsSync(temporary)) rmSync(temporary, { recursive: true, force: true });
  if (preparedDestination.created && existsSync(destinationRoot)) {
    rmdirSync(destinationRoot);
  }
  throw error;
}

function secureInputFile(value, flag) {
  const requested = path.resolve(value);
  const status = lstatSync(requested);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(`${flag} must be a regular non-symlink file`);
  }
  // macOS exposes /tmp as an ancestor alias for /private/tmp. Canonicalize
  // ancestors while still rejecting a symlink at the final file component.
  return realpathSync(requested);
}

function secureDestinationRoot(value) {
  const requested = path.resolve(value);
  let created = false;
  if (!existsSync(requested)) {
    const parent = path.dirname(requested);
    const parentStatus = lstatSync(parent);
    if (!parentStatus.isDirectory() || parentStatus.isSymbolicLink()) {
      throw new Error('--destination parent must be a regular non-symlink directory');
    }
    mkdirSync(requested);
    created = true;
  }
  const status = lstatSync(requested);
  if (!status.isDirectory() || status.isSymbolicLink()) {
    if (created) rmdirSync(requested);
    throw new Error('--destination must be a regular non-symlink directory');
  }
  return { path: realpathSync(requested), created };
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function pathEntryExists(candidate) {
  try {
    lstatSync(candidate);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function parseArgs(args) {
  const parsed = {};
  const normalizedArgs = args.filter((value) => value !== '--');
  for (let index = 0; index < normalizedArgs.length; index += 2) {
    const flag = normalizedArgs[index];
    const value = normalizedArgs[index + 1];
    if (!flag?.startsWith('--') || !value) {
      throw new Error(`invalid argument: ${flag ?? ''}`);
    }
    parsed[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] =
      value;
  }
  return parsed;
}

function toFlag(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function positiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive safe integer`);
  }
  return parsed;
}
