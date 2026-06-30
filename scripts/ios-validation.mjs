#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
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
const SMOKE_TIMEOUT_MS = Number(process.env.RNICK_IOS_SMOKE_TIMEOUT_MS ?? '180000');

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
    mustRun('bundle', ['exec', 'pod', 'install'], {
      cwd: IOS_DIR,
      env,
    });
    return;
  }

  mustRun('pod', ['install'], {
    cwd: IOS_DIR,
    failureHint:
      'Install CocoaPods or Bundler. The example/Gemfile pins the supported CocoaPods toolchain.',
  });
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
  const deadline = Date.now() + 60000;

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
    [`Metro did not become ready on port ${METRO_PORT}.`, child.rnickOutput]
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

function runSmoke(udid, metroProcess, setLogProcess) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let settled = false;
    const timeout = setTimeout(() => {
      finish(
        reject,
        new Error(`Timed out waiting for RNICK_IOS_SMOKE_PASS after ${SMOKE_TIMEOUT_MS}ms.`)
      );
    }, SMOKE_TIMEOUT_MS);

    const onData = (chunk) => {
      const text = chunk.toString();
      buffer += text;

      if (text.length > 0) {
        process.stdout.write(text);
      }

      if (buffer.includes('RNICK_IOS_SMOKE_FAIL')) {
        finish(reject, new Error(`iOS smoke failed:\n${buffer}`));
      } else if (buffer.includes('RNICK_IOS_SMOKE_PASS')) {
        finish(resolve);
      }
    };

    const finish = (callback, error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      metroProcess.stdout.off('data', onData);
      metroProcess.stderr.off('data', onData);

      if (error) {
        callback(error);
      } else {
        callback();
      }
    };

    metroProcess.stdout.on('data', onData);
    metroProcess.stderr.on('data', onData);

    const logProcess = spawn(
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
    logProcess.stdout.on('data', onData);
    logProcess.stderr.on('data', onData);

    mustRun('xcrun', [
      'simctl',
      'launch',
      '--terminate-running-process',
      udid,
      BUNDLE_ID,
    ], {
      env: {
        SIMCTL_CHILD_RNICK_IOS_SMOKE: '1',
      },
    });
  });
}

function mustRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });

  if (result.status !== 0) {
    throw commandError(command, args, result, options.failureHint);
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
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
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

function pathExists(value) {
  return spawnSync('test', ['-e', value]).status === 0;
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
