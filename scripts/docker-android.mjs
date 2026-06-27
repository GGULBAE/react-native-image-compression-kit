#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMAGE = process.env.RNICK_ANDROID_DOCKER_IMAGE ?? 'react-native-image-compression-kit-android';
const PLATFORM = process.env.RNICK_ANDROID_DOCKER_PLATFORM ?? 'linux/amd64';
const VOLUME_PREFIX = sanitizeVolumePrefix(
  process.env.RNICK_ANDROID_DOCKER_VOLUME_PREFIX ?? 'rnick-android'
);
const mode = process.argv[2] ?? 'help';
const modeArgs = process.argv.slice(3);

const COMMANDS = {
  verify: 'pnpm verify',
  'example:typecheck': 'pnpm example:typecheck',
  'example:codegen': 'pnpm example:codegen',
  'example:android-unit-test': 'pnpm example:android-unit-test',
  'example:build': 'pnpm example:build',
  ci: [
    'pnpm verify',
    'pnpm example:typecheck',
    'pnpm example:codegen',
    'pnpm example:android-unit-test',
    'pnpm example:build',
  ].join(' && '),
};

if (mode === 'help' || mode === '--help' || mode === '-h') {
  printHelp();
  process.exit(0);
}

if (mode === 'build') {
  runDocker(['build', '--platform', PLATFORM, '-t', IMAGE, '-f', 'Dockerfile', '.']);
} else if (mode === 'shell') {
  runInContainer('bash', { interactive: true, install: false });
} else if (mode === 'run') {
  runInContainer(modeArgs.length > 0 ? shellQuote(modeArgs) : 'bash', {
    interactive: modeArgs.length === 0,
    install: false,
  });
} else if (mode in COMMANDS) {
  runInContainer(COMMANDS[mode], { install: true });
} else {
  fail(`Unknown docker Android mode: ${mode}`);
}

function runInContainer(command, options = { install: false, interactive: false }) {
  const installPrefix = options.install ? 'pnpm install --frozen-lockfile && ' : '';
  const shellCommand = `${installPrefix}${command}`;
  const args = [
    'run',
    '--rm',
    '--platform',
    PLATFORM,
    '-v',
    `${ROOT}:/workspace`,
    '-v',
    `${VOLUME_PREFIX}-node-modules:/workspace/node_modules`,
    '-v',
    `${VOLUME_PREFIX}-pnpm-store:/pnpm/store`,
    '-v',
    `${VOLUME_PREFIX}-gradle-home:/root/.gradle`,
    '-w',
    '/workspace',
    '-e',
    'CI=1',
    '-e',
    'ANDROID_HOME=/opt/android-sdk',
    '-e',
    'ANDROID_SDK_ROOT=/opt/android-sdk',
    '-e',
    'GRADLE_USER_HOME=/root/.gradle',
    '-e',
    'GRADLE_OPTS=-Dorg.gradle.vfs.watch=false',
  ];

  if (options.interactive) {
    args.push('-it');
  }

  args.push(IMAGE, 'bash', '-lc', shellCommand);
  runDocker(args);
}

function runDocker(args) {
  const result = spawnSync('docker', args, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  if (result.error) {
    fail(result.error.message);
  }

  process.exit(result.status ?? 1);
}

function shellQuote(args) {
  return args.map((arg) => `'${arg.replace(/'/g, `'\\''`)}'`).join(' ');
}

function sanitizeVolumePrefix(value) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '-');
}

function printHelp() {
  console.log(`Usage: node scripts/docker-android.mjs <mode>

Modes:
  build                       Build the Android verification Docker image.
  verify                      Run pnpm verify in Docker.
  example:typecheck           Run pnpm example:typecheck in Docker.
  example:codegen             Run pnpm example:codegen in Docker.
  example:android-unit-test   Run pnpm example:android-unit-test in Docker.
  example:build               Run pnpm example:build in Docker.
  ci                          Run verify, typecheck, codegen, unit test, and build in Docker.
  run <command...>            Run a custom command in Docker without installing dependencies first.
  shell                       Open an interactive shell in Docker.

Environment:
  RNICK_ANDROID_DOCKER_IMAGE          Image tag. Defaults to ${IMAGE}.
  RNICK_ANDROID_DOCKER_PLATFORM       Docker platform. Defaults to ${PLATFORM}.
  RNICK_ANDROID_DOCKER_VOLUME_PREFIX  Named volume prefix. Defaults to ${VOLUME_PREFIX}.
`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
