#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import {
  linkSync,
  lstatSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { parseNativeEconomicResiliencePayload } from './economic-resilience-evidence-core.mjs';

const options = parseArgs(process.argv.slice(2));
for (const field of [
  'platform',
  'runtime',
  'osBuild',
  'device',
  'deviceKind',
  'abi',
  'reactNativeVersion',
  'nativeLog',
  'buildType',
  'runnerLabel',
  'runnerOs',
  'runnerArch',
  'runnerName',
  'imageOs',
  'imageVersion',
  'node',
  'ffmpeg',
  'ffprobe',
  'primaryToolchain',
  'platformSdk',
  'output',
]) {
  if (!options[field]) throw new Error(`--${toFlag(field)} is required`);
}
const nativeLog = secureInputFile(options.nativeLog, '--native-log');
const output = secureOutputFile(options.output);
const payload = parseNativeEconomicResiliencePayload(readFileSync(nativeLog, 'utf8'));
if (payload.platform !== options.platform) {
  throw new Error('native payload platform does not match --platform');
}
const environment = {
  platform: options.platform,
  runtime: options.runtime,
  osBuild: options.osBuild,
  device: options.device,
  deviceKind: options.deviceKind,
  abi: options.abi,
  reactNativeArchitecture: payload.architecture,
  reactNativeVersion: options.reactNativeVersion,
  jsEngine: payload.jsEngine,
  buildType: options.buildType,
  runner: {
    label: options.runnerLabel,
    os: options.runnerOs,
    arch: options.runnerArch,
    name: options.runnerName,
    imageOS: options.imageOs,
    imageVersion: options.imageVersion,
  },
  toolchain: {
    node: options.node,
    ffmpeg: options.ffmpeg,
    ffprobe: options.ffprobe,
    primary: options.primaryToolchain,
    platformSdk: options.platformSdk,
  },
};
if (containsUnknown(environment)) {
  throw new Error('environment values must be explicit and must not be unknown');
}
writeOutputAtomic(output, `${JSON.stringify(environment, null, 2)}\n`);

function secureInputFile(value, flag) {
  const requested = path.resolve(value);
  const status = lstatSync(requested);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(`${flag} must be a regular non-symlink file`);
  }
  return realpathSync(requested);
}

function secureOutputFile(value) {
  const requested = path.resolve(value);
  const requestedParent = path.dirname(requested);
  const requestedParentStatus = lstatSync(requestedParent);
  const parent = realpathSync(requestedParent);
  const status = lstatSync(parent);
  if (
    !requestedParentStatus.isDirectory() ||
    requestedParentStatus.isSymbolicLink() ||
    !status.isDirectory() ||
    status.isSymbolicLink()
  ) {
    throw new Error('--output parent must resolve to a regular directory');
  }
  const destination = path.join(parent, path.basename(requested));
  try {
    lstatSync(destination);
    throw new Error('--output must not already exist');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return destination;
}

function writeOutputAtomic(destination, contents) {
  const temporary = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    writeFileSync(temporary, contents, { flag: 'wx', mode: 0o600 });
    linkSync(temporary, destination);
  } finally {
    try {
      unlinkSync(temporary);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

function containsUnknown(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    return value.trim() === '' || /^(?:unknown|null|undefined|n\/a)$/i.test(value.trim());
  }
  if (typeof value === 'object') return Object.values(value).some(containsUnknown);
  return false;
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
