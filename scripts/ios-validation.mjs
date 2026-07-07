#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const EXAMPLE_DIR = path.join(ROOT, 'example');
const IOS_DIR = path.join(EXAMPLE_DIR, 'ios');
const DERIVED_DATA_DIR = path.join(IOS_DIR, 'build');
const REACT_NATIVE_CLI = path.join(EXAMPLE_DIR, 'node_modules', 'react-native', 'cli.js');
const WORKSPACE = path.join(IOS_DIR, 'ImageCompressionKitExample.xcworkspace');
const SCHEME = 'ImageCompressionKitExample';
const BUNDLE_ID = 'com.imagecompressionkit.example';
const METRO_PORT = Number(process.env.RNICK_IOS_METRO_PORT ?? '8081');
const METRO_READY_TIMEOUT_MS = Number(
  process.env.RNICK_IOS_METRO_READY_TIMEOUT_MS ?? '180000'
);
const SMOKE_TIMEOUT_MS = Number(process.env.RNICK_IOS_SMOKE_TIMEOUT_MS ?? '180000');
const SMOKE_MAX_ATTEMPTS = parsePositiveInteger(
  process.env.RNICK_IOS_SMOKE_ATTEMPTS,
  2
);
const SMOKE_LOG_STREAM_WARMUP_MS = parsePositiveInteger(
  process.env.RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS,
  1000
);
const SMOKE_DIAGNOSTIC_LOG_WINDOW =
  process.env.RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW ?? '10m';
const POD_INSTALL_MAX_ATTEMPTS = parsePositiveInteger(
  process.env.RNICK_IOS_POD_INSTALL_ATTEMPTS,
  2
);
const POD_INSTALL_CLEANUP_PATHS = [
  path.join(IOS_DIR, 'Pods'),
  WORKSPACE,
  path.join(IOS_DIR, 'Podfile.lock'),
];

const mode = process.argv[2] ?? 'smoke';

async function main() {
  if (mode === 'env') {
    checkIOSBuildEnvironment();
    return;
  }

  if (mode === 'pods') {
    checkIOSBuildEnvironment();
    runPodInstall();
    return;
  }

  if (mode === 'build') {
    checkIOSBuildEnvironment();
    ensurePodsInstalled();
    const simulator = selectSimulator();
    bootSimulator(simulator.udid);
    runXcodeBuild(simulator.udid);
    return;
  }

  if (mode === 'smoke') {
    checkIOSBuildEnvironment();
    ensurePackageJSBuild();
    ensurePodsInstalled();
    const simulator = selectSimulator();
    bootSimulator(simulator.udid);

    let metroProcess;
    let logProcess;

    try {
      metroProcess = startMetro();
      await waitForMetro(metroProcess);
      runXcodeBuild(simulator.udid);
      installApp(simulator.udid);
      await runSmoke(simulator.udid, metroProcess, (nextLogProcess) => {
        logProcess = nextLogProcess;
      });
    } finally {
      stopProcess(logProcess);
      stopProcess(metroProcess);
    }
    return;
  }

  throw new Error(`Unknown iOS validation mode: ${mode}`);
}

function ensurePackageJSBuild() {
  mustRun('pnpm', ['build']);
}

function checkIOSBuildEnvironment() {
  mustRun('xcodebuild', ['-version'], {
    failureHint:
      'Install full Xcode and run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.',
  });
  mustRun('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path'], {
    failureHint: 'Install an Xcode iOS simulator SDK.',
  });
}

function runPodInstall() {
  if (hasCommand('bundle')) {
    const env = bundlerEnv();

    mustRun('bundle', ['install'], {
      cwd: EXAMPLE_DIR,
      env,
    });
    runPodInstallWithRetry('bundle', ['exec', 'pod', 'install'], {
      cwd: IOS_DIR,
      env,
    });
    return;
  }

  runPodInstallWithRetry('pod', ['install'], {
    cwd: IOS_DIR,
    failureHint:
      'Install CocoaPods or Bundler. The example/Gemfile pins the supported CocoaPods toolchain.',
  });
}

function runPodInstallWithRetry(command, args, options) {
  for (let attempt = 1; attempt <= POD_INSTALL_MAX_ATTEMPTS; attempt += 1) {
    console.log(
      `Running CocoaPods install (attempt ${attempt}/${POD_INSTALL_MAX_ATTEMPTS})...`
    );
    const result = runCommand(command, args, {
      ...options,
      capture: true,
      printOutput: true,
    });

    if (result.status === 0) {
      return;
    }

    const output = commandOutput(result);
    const shouldRetry =
      isCocoaPodsNullByteError(output) && attempt < POD_INSTALL_MAX_ATTEMPTS;

    if (shouldRetry) {
      console.warn(
        [
          'CocoaPods failed with `pathname contains null byte`.',
          'Treating this as an external CocoaPods path-resolution flake and retrying after cleaning generated pod artifacts.',
        ].join('\n')
      );
      printPodInstallDiagnostics(options.env);
      cleanPodInstallArtifacts();
      continue;
    }

    printPodInstallDiagnostics(options.env);
    throw commandError(command, args, result, options.failureHint);
  }
}

function isCocoaPodsNullByteError(output) {
  return /pathname contains null byte/i.test(output);
}

function cleanPodInstallArtifacts() {
  for (const artifactPath of POD_INSTALL_CLEANUP_PATHS) {
    if (!pathExists(artifactPath)) {
      continue;
    }

    rmSync(artifactPath, { recursive: true, force: true });
    console.warn(`Removed generated CocoaPods artifact: ${path.relative(ROOT, artifactPath)}`);
  }
}

function printPodInstallDiagnostics(env = {}) {
  console.warn(
    [
      'iOS pod install diagnostics:',
      `- node: ${process.version}`,
      `- platform: ${process.platform} ${process.arch}`,
      `- cwd: ${IOS_DIR}`,
      `- BUNDLE_GEMFILE: ${env.BUNDLE_GEMFILE ?? process.env.BUNDLE_GEMFILE ?? '(unset)'}`,
      `- BUNDLE_PATH: ${env.BUNDLE_PATH ?? process.env.BUNDLE_PATH ?? '(unset)'}`,
      `- ruby: ${optionalCommandOutput('ruby', ['--version'])}`,
      `- bundle: ${optionalCommandOutput('bundle', ['--version'], { cwd: EXAMPLE_DIR, env })}`,
      `- cocoapods via bundle: ${optionalCommandOutput('bundle', ['exec', 'pod', '--version'], { cwd: IOS_DIR, env })}`,
      `- cocoapods global: ${optionalCommandOutput('pod', ['--version'], { cwd: IOS_DIR })}`,
      `- pnpm: ${optionalCommandOutput('pnpm', ['--version'])}`,
    ].join('\n')
  );
}

function bundlerEnv() {
  return {
    BUNDLE_APP_CONFIG: path.join(EXAMPLE_DIR, '.bundle'),
    BUNDLE_FORCE_RUBY_PLATFORM: '1',
    BUNDLE_GEMFILE: path.join(EXAMPLE_DIR, 'Gemfile'),
    BUNDLE_PATH: path.join(EXAMPLE_DIR, 'vendor', 'bundle'),
  };
}

function ensurePodsInstalled() {
  if (!pathExists(WORKSPACE)) {
    runPodInstall();
  }
}

function selectSimulator() {
  const result = mustRun('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], {
    capture: true,
  });
  const parsed = JSON.parse(result.stdout);
  const devices = Object.entries(parsed.devices ?? {}).flatMap(([runtime, entries]) =>
    entries.map((entry) => ({ ...entry, runtime }))
  );
  const simulator = devices.find(
    (device) => device.name.includes('iPhone') && device.runtime.includes('iOS')
  );

  if (!simulator) {
    throw new Error('No available iPhone simulator was found.');
  }

  return simulator;
}

function bootSimulator(udid) {
  const boot = spawnSync('xcrun', ['simctl', 'boot', udid], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (
    boot.status !== 0 &&
    !`${boot.stdout}\n${boot.stderr}`.includes('Unable to boot device in current state: Booted')
  ) {
    throw commandError('xcrun', ['simctl', 'boot', udid], boot);
  }

  mustRun('xcrun', ['simctl', 'bootstatus', udid, '-b']);
}

function runXcodeBuild(udid) {
  mustRun('xcodebuild', [
    '-workspace',
    WORKSPACE,
    '-scheme',
    SCHEME,
    '-configuration',
    'Debug',
    '-sdk',
    'iphonesimulator',
    '-destination',
    `id=${udid}`,
    '-derivedDataPath',
    DERIVED_DATA_DIR,
    'build',
  ]);
}

function installApp(udid) {
  const appPath = path.join(
    DERIVED_DATA_DIR,
    'Build',
    'Products',
    'Debug-iphonesimulator',
    `${SCHEME}.app`
  );

  mustRun('xcrun', ['simctl', 'install', udid, appPath]);
}

function startMetro() {
  const child = spawn(
    process.execPath,
    [
      REACT_NATIVE_CLI,
      'start',
      '--port',
      String(METRO_PORT),
    ],
    {
      cwd: EXAMPLE_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  child.rnickOutput = '';

  const appendOutput = (chunk, stream) => {
    const text = chunk.toString();
    child.rnickOutput = `${child.rnickOutput}${text}`.slice(-8000);
    stream.write(chunk);
  };

  child.stdout.on('data', (chunk) => {
    appendOutput(chunk, process.stdout);
  });
  child.stderr.on('data', (chunk) => {
    appendOutput(chunk, process.stderr);
  });
  child.on('error', (error) => {
    child.rnickError = error;
    process.stderr.write(`${error.message}\n`);
  });

  return child;
}

async function waitForMetro(child) {
  const deadline = Date.now() + METRO_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (await isMetroReady()) {
      return;
    }

    if (child.rnickError) {
      throw new Error(`Metro failed to start: ${child.rnickError.message}`);
    }

    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        [
          `Metro exited before becoming ready: code=${child.exitCode} signal=${child.signalCode}.`,
          child.rnickOutput,
        ]
          .filter(Boolean)
          .join('\n')
      );
    }

    await delay(1000);
  }

  throw new Error(
    [
      `Metro did not become ready on port ${METRO_PORT} after ${METRO_READY_TIMEOUT_MS}ms.`,
      child.rnickOutput,
    ]
      .filter(Boolean)
      .join('\n')
  );
}

function isMetroReady() {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host: '127.0.0.1',
        port: METRO_PORT,
        path: '/status',
        timeout: 1000,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          resolve(body.includes('packager-status:running'));
        });
      }
    );
    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function runSmoke(udid, metroProcess, setLogProcess) {
  for (let attempt = 1; attempt <= SMOKE_MAX_ATTEMPTS; attempt += 1) {
    try {
      await runSmokeAttempt(udid, metroProcess, setLogProcess, attempt);
      return;
    } catch (error) {
      if (!error.rnickSmokeTimeout || attempt >= SMOKE_MAX_ATTEMPTS) {
        throw error;
      }

      console.warn(error.message);
      console.warn(
        [
          `iOS smoke attempt ${attempt}/${SMOKE_MAX_ATTEMPTS} timed out before RNICK_IOS_SMOKE_PASS.`,
          'Retrying after terminating the app so the next attempt gets a fresh launch and log stream.',
        ].join('\n')
      );
      optionalCommandOutput('xcrun', ['simctl', 'terminate', udid, BUNDLE_ID]);
      await delay(2000);
    }
  }
}

function runSmokeAttempt(udid, metroProcess, setLogProcess, attempt) {
  return new Promise((resolve, reject) => {
    let markerBuffer = '';
    let smokeLogOutput = '';
    let launchOutput = '';
    let logProcess;
    let settled = false;
    const timeout = setTimeout(() => {
      finish(
        reject,
        createSmokeTimeoutError({
          udid,
          attempt,
          smokeLogOutput,
          launchOutput,
          metroProcess,
        })
      );
    }, SMOKE_TIMEOUT_MS);

    const onData = (chunk, { smokeLog = false } = {}) => {
      const text = chunk.toString();
      markerBuffer += text;

      if (smokeLog) {
        smokeLogOutput += text;
      }

      if (text.length > 0) {
        process.stdout.write(text);
      }

      if (markerBuffer.includes('RNICK_IOS_SMOKE_FAIL')) {
        finish(reject, new Error(`iOS smoke failed:\n${markerBuffer}`));
      } else if (markerBuffer.includes('RNICK_IOS_SMOKE_PASS')) {
        finish(resolve);
      }
    };
    const onMetroData = (chunk) => {
      onData(chunk);
    };
    const onSmokeLogData = (chunk) => {
      onData(chunk, { smokeLog: true });
    };

    const finish = (callback, error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      metroProcess.stdout.off('data', onMetroData);
      metroProcess.stderr.off('data', onMetroData);
      logProcess?.stdout.off('data', onSmokeLogData);
      logProcess?.stderr.off('data', onSmokeLogData);
      stopProcess(logProcess);
      setLogProcess(null);

      if (error) {
        callback(error);
      } else {
        callback();
      }
    };

    console.log(
      `Starting iOS smoke attempt ${attempt}/${SMOKE_MAX_ATTEMPTS} with ` +
        `timeout=${SMOKE_TIMEOUT_MS}ms, logWarmup=${SMOKE_LOG_STREAM_WARMUP_MS}ms, ` +
        `diagnosticLogWindow=${SMOKE_DIAGNOSTIC_LOG_WINDOW}.`
    );

    metroProcess.stdout.on('data', onMetroData);
    metroProcess.stderr.on('data', onMetroData);

    logProcess = spawn(
      'xcrun',
      [
        'simctl',
        'spawn',
        udid,
        'log',
        'stream',
        '--style',
        'compact',
        '--predicate',
        'eventMessage CONTAINS "RNICK_IOS_SMOKE_"',
      ],
      {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    setLogProcess(logProcess);
    logProcess.stdout.on('data', onSmokeLogData);
    logProcess.stderr.on('data', onSmokeLogData);
    logProcess.on('error', (error) => {
      onData(Buffer.from(`iOS smoke log stream error: ${error.message}\n`));
    });

    delay(SMOKE_LOG_STREAM_WARMUP_MS)
      .then(() => {
        const launchResult = mustRun(
          'xcrun',
          [
            'simctl',
            'launch',
            '--terminate-running-process',
            udid,
            BUNDLE_ID,
            '--rnick-ios-smoke',
          ],
          {
            capture: true,
            printOutput: true,
            env: {
              SIMCTL_CHILD_RNICK_IOS_SMOKE: '1',
            },
          }
        );
        launchOutput = commandOutput(launchResult);
      })
      .catch((error) => {
        finish(reject, error);
      });
  });
}

function createSmokeTimeoutError({
  udid,
  attempt,
  smokeLogOutput,
  launchOutput,
  metroProcess,
}) {
  const diagnostics = [
    `Timed out waiting for RNICK_IOS_SMOKE_PASS after ${SMOKE_TIMEOUT_MS}ms.`,
    `iOS smoke attempt: ${attempt}/${SMOKE_MAX_ATTEMPTS}`,
    'iOS smoke diagnostics:',
    `- simulator: ${simulatorSummary(udid)}`,
    `- app container: ${optionalCommandOutput('xcrun', ['simctl', 'get_app_container', udid, BUNDLE_ID, 'app'])}`,
    `- app data container: ${optionalCommandOutput('xcrun', ['simctl', 'get_app_container', udid, BUNDLE_ID, 'data'])}`,
    `- app process lookup: ${optionalCommandOutput('xcrun', ['simctl', 'spawn', udid, 'pgrep', '-fl', SCHEME])}`,
    `- launch output:\n${indentBlock(launchOutput.trim() || '(no launch output captured)')}`,
    `- captured RNICK_IOS_SMOKE stream tail:\n${indentBlock(tailLines(smokeLogOutput, 120) || '(no RNICK_IOS_SMOKE lines captured)')}`,
    `- Metro output tail:\n${indentBlock(tailLines(metroProcess.rnickOutput ?? '', 120) || '(no Metro output captured)')}`,
    `- unified log tail (${SMOKE_DIAGNOSTIC_LOG_WINDOW}):\n${indentBlock(recentIOSSmokeLogs(udid))}`,
  ];
  const error = new Error(diagnostics.join('\n'));
  error.rnickSmokeTimeout = true;
  return error;
}

function simulatorSummary(udid) {
  const result = runCommand('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], {
    capture: true,
  });

  if (result.status !== 0) {
    return optionalCommandOutput('xcrun', ['simctl', 'list', 'devices', 'available']);
  }

  try {
    const parsed = JSON.parse(result.stdout);
    for (const [runtime, devices] of Object.entries(parsed.devices ?? {})) {
      const simulator = devices.find((device) => device.udid === udid);
      if (simulator) {
        return `${simulator.name} (${udid}) runtime=${runtime} state=${simulator.state} available=${simulator.isAvailable}`;
      }
    }
  } catch (error) {
    return `unable to parse simctl JSON: ${error.message}`;
  }

  return `simulator ${udid} was not found in simctl available devices`;
}

function recentIOSSmokeLogs(udid) {
  const logs = optionalCommandOutput('xcrun', [
    'simctl',
    'spawn',
    udid,
    'log',
    'show',
    '--style',
    'compact',
    '--last',
    SMOKE_DIAGNOSTIC_LOG_WINDOW,
    '--predicate',
    `eventMessage CONTAINS "RNICK_IOS_SMOKE_" OR process == "${SCHEME}"`,
  ]);
  return tailLines(logs, 160) || '(no matching unified log entries captured)';
}

function mustRun(command, args, options = {}) {
  const result = runCommand(command, args, options);

  if (result.status !== 0) {
    throw commandError(command, args, result, options.failureHint);
  }

  return result;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: options.capture ? 'pipe' : 'inherit',
  });

  if (options.printOutput) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }

    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
  }

  return result;
}

function hasCommand(command) {
  const result = spawnSync(command, ['--version'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'ignore',
  });
  return result.status === 0;
}

function commandError(command, args, result, hint) {
  const output = commandOutput(result);
  return new Error(
    [
      `Command failed: ${command} ${args.join(' ')}`,
      output.trim(),
      hint ? `Hint: ${hint}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  );
}

function commandOutput(result) {
  return [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n');
}

function pathExists(value) {
  return spawnSync('test', ['-e', value]).status === 0;
}

function optionalCommandOutput(command, args, options = {}) {
  const result = runCommand(command, args, {
    ...options,
    capture: true,
  });

  if (result.status !== 0) {
    return result.error?.message ?? `unavailable (exit ${result.status ?? 'unknown'})`;
  }

  return commandOutput(result).trim() || '(no output)';
}

function parsePositiveInteger(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultValue;
  }

  return parsed;
}

function tailLines(value, maxLines) {
  return value
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-maxLines)
    .join('\n');
}

function indentBlock(value) {
  return value
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join('\n');
}

function stopProcess(child) {
  if (child && !child.killed) {
    child.kill('SIGTERM');
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
