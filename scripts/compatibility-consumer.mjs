#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  selectCompatibilityLane,
  validateCompatibilityMatrix,
} from './compatibility-matrix-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const packageJson = readJson(path.join(root, 'package.json'));
const manifest = readJson(path.join(root, 'docs/compatibility-matrix.json'));
const report = validateCompatibilityMatrix(manifest, packageJson);
if (!report.ok) {
  fail(`invalid compatibility matrix:\n- ${report.errors.join('\n- ')}`);
}
if (!args.lane || !args.platform || !args.tgz) {
  fail('usage: compatibility-consumer --lane <id> --platform <android|ios> --tgz <package.tgz>');
}

const lane = selectCompatibilityLane(manifest, args.lane, args.platform);
const sourceTgz = path.resolve(args.tgz);
if (!existsSync(sourceTgz)) fail(`package tarball does not exist: ${sourceTgz}`);

const workRoot = args.workDir
  ? path.resolve(args.workDir)
  : mkdtempSync(path.join(os.tmpdir(), `rnick-${lane.id}-${args.platform}-`));
mkdirSync(workRoot, { recursive: true });
const copiedTgz = path.join(workRoot, path.basename(sourceTgz));
cpSync(sourceTgz, copiedTgz);

let succeeded = false;
try {
  const app = lane.kind === 'expo' ? prepareExpoApp(lane) : prepareBareApp(lane);
  installAndTypecheck(app, copiedTgz);
  buildNative(app, lane, args.platform);
  process.stdout.write(
    `${JSON.stringify({
      schemaVersion: 1,
      status: 'passed',
      lane: lane.id,
      kind: lane.kind,
      platform: args.platform,
      reactNative: lane.reactNative,
      architecture: lane.architecture,
      packageVersion: packageJson.version,
    })}\n`
  );
  succeeded = true;
} finally {
  if (
    succeeded &&
    !args.workDir &&
    process.env.RNICK_KEEP_COMPATIBILITY_APP !== '1'
  ) {
    rmSync(workRoot, { recursive: true, force: true });
  } else {
    process.stderr.write(`Compatibility consumer retained at ${workRoot}\n`);
  }
}

function prepareBareApp(lane) {
  const appName = 'RNICKCompatibility';
  run(
    'npx',
    [
      '--yes',
      `@react-native-community/cli@${lane.cli}`,
      'init',
      appName,
      '--version',
      lane.reactNative,
      '--skip-install',
      '--skip-git-init',
    ],
    workRoot
  );
  const appRoot = path.join(workRoot, appName);
  if (!existsSync(path.join(appRoot, 'package.json'))) {
    fail(`React Native CLI did not create ${appRoot}`);
  }
  return { appName, appRoot };
}

function prepareExpoApp(lane) {
  const appName = 'RNICKExpoCompatibility';
  const appRoot = path.join(workRoot, appName);
  mkdirSync(appRoot, { recursive: true });
  writeFileSync(
    path.join(appRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'rnick-expo-compatibility',
        version: '1.0.0',
        private: true,
        main: 'index.js',
        dependencies: {
          expo: lane.expo,
          react: lane.react,
          'react-native': lane.reactNative,
        },
        devDependencies: {
          '@types/react': '^19.2.0',
          typescript: '^5.9.3',
        },
      },
      null,
      2
    )}\n`
  );
  writeFileSync(
    path.join(appRoot, 'app.json'),
    `${JSON.stringify(
      {
        expo: {
          name: appName,
          slug: 'rnick-expo-compatibility',
          version: '1.0.0',
          newArchEnabled: lane.architecture === 'new',
          ios: { bundleIdentifier: 'com.rnick.expocompatibility' },
          android: { package: 'com.rnick.expocompatibility' },
        },
      },
      null,
      2
    )}\n`
  );
  writeFileSync(
    path.join(appRoot, 'index.js'),
    "import { registerRootComponent } from 'expo';\nimport App from './App';\nregisterRootComponent(App);\n"
  );
  writeFileSync(
    path.join(appRoot, 'tsconfig.json'),
    `${JSON.stringify({ extends: 'expo/tsconfig.base', compilerOptions: { strict: true } }, null, 2)}\n`
  );
  writeConsumerApp(path.join(appRoot, 'App.tsx'));
  return { appName, appRoot, expo: true };
}

function installAndTypecheck(app, tgz) {
  run('npm', ['install', '--no-audit', '--no-fund'], app.appRoot);
  run(
    'npm',
    ['install', '--save-exact', '--no-audit', '--no-fund', `file:${tgz}`],
    app.appRoot
  );
  writeConsumerApp(path.join(app.appRoot, 'App.tsx'));
  run('npx', ['tsc', '--noEmit'], app.appRoot);
}

function writeConsumerApp(destination) {
  writeFileSync(
    destination,
    `import React from 'react';
import { Text, View } from 'react-native';
import {
  compressImage,
  getImageCompressionCapabilities,
  type ImageCompressionKitErrorCode,
} from 'react-native-image-compression-kit';

void compressImage;
void getImageCompressionCapabilities;
const publicErrorCode: ImageCompressionKitErrorCode = 'ERR_INVALID_OPTIONS';

export default function App() {
  return React.createElement(View, null, React.createElement(Text, null, publicErrorCode));
}
`
  );
}

function buildNative(app, lane, platform) {
  if (app.expo) {
    run(
      'npx',
      ['expo', 'prebuild', '--platform', platform, '--no-install'],
      app.appRoot,
      { CI: '1' }
    );
  }

  if (platform === 'android') {
    const propertiesPath = path.join(app.appRoot, 'android', 'gradle.properties');
    const properties = readFileSync(propertiesPath, 'utf8');
    const newArch = lane.architecture === 'new' ? 'true' : 'false';
    const updated = /(^|\n)newArchEnabled=.*/.test(properties)
      ? properties.replace(/(^|\n)newArchEnabled=.*/, `$1newArchEnabled=${newArch}`)
      : `${properties.trimEnd()}\nnewArchEnabled=${newArch}\n`;
    writeFileSync(propertiesPath, updated);
    run('./gradlew', ['app:assembleDebug', '--no-daemon', '--stacktrace'], path.join(app.appRoot, 'android'));
    return;
  }

  const iosEnvironment = {
    RCT_NEW_ARCH_ENABLED: lane.architecture === 'new' ? '1' : '0',
    // RN 0.73's template otherwise installs FlipperKit, which is unrelated to
    // this package and cannot compile with current Xcode SDKs.
    NO_FLIPPER: '1',
  };
  const gemfilePath = path.join(app.appRoot, 'Gemfile');
  if (existsSync(gemfilePath)) {
    const gemfile = readFileSync(gemfilePath, 'utf8');
    // Ruby 3.4 moved these stdlib features to bundled gems; older RN CocoaPods locks require them.
    const ruby34CompatibilityGems = [
      ['base64', '0.3.0'],
      ['nkf', '0.3.0'],
    ].filter(([name]) => !new RegExp(`gem ['\"]${name}['\"]`).test(gemfile));
    if (ruby34CompatibilityGems.length > 0) {
      writeFileSync(
        gemfilePath,
        `${gemfile.trimEnd()}\n${ruby34CompatibilityGems
          .map(([name, version]) => `gem '${name}', '${version}'`)
          .join('\n')}\n`
      );
    }
    run('bundle', ['install'], app.appRoot);
    run(
      'bundle',
      ['exec', 'pod', 'install', '--project-directory=ios'],
      app.appRoot,
      iosEnvironment
    );
  } else {
    run('pod', ['install', '--project-directory=ios'], app.appRoot, iosEnvironment);
  }
  const workspace = path.join(app.appRoot, 'ios', `${app.appName}.xcworkspace`);
  run(
    'xcodebuild',
    [
      '-workspace',
      workspace,
      '-scheme',
      app.appName,
      '-sdk',
      'iphonesimulator',
      '-configuration',
      'Debug',
      '-derivedDataPath',
      path.join(workRoot, 'DerivedData'),
      'CODE_SIGNING_ALLOWED=NO',
      'build',
    ],
    app.appRoot,
    iosEnvironment
  );
}

function run(command, commandArgs, cwd, extraEnv = {}) {
  process.stderr.write(`+ (${cwd}) ${command} ${commandArgs.join(' ')}\n`);
  const result = spawnSync(command, commandArgs, {
    cwd,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) fail(`${command} failed to start: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited with status ${result.status}`);
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const value = rawArgs[index];
    if (value === '--') continue;
    if (value === '--lane') parsed.lane = rawArgs[++index];
    else if (value === '--platform') parsed.platform = rawArgs[++index];
    else if (value === '--tgz') parsed.tgz = rawArgs[++index];
    else if (value === '--work-dir') parsed.workDir = rawArgs[++index];
    else fail(`unknown compatibility argument: ${value}`);
  }
  return parsed;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function fail(message) {
  throw new Error(message);
}
