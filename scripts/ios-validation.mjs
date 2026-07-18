#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  createIOSValidationConfig,
  createSmokeAttemptLifecycle,
  createSmokeTimeoutErrorFromCLIState,
  formatIOSSmokeDiagnosticsSummary,
  formatSmokeRetryWarningMessages,
  shouldRetrySmokeTimeout,
  tailLines,
} from './ios-smoke-contract.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const EXAMPLE_DIR = path.join(ROOT, 'example');
const IOS_DIR = path.join(EXAMPLE_DIR, 'ios');
const DERIVED_DATA_DIR = path.join(IOS_DIR, 'build');
const REACT_NATIVE_CLI = path.join(EXAMPLE_DIR, 'node_modules', 'react-native', 'cli.js');
const WORKSPACE = path.join(IOS_DIR, 'ImageCompressionKitExample.xcworkspace');
const PODS_PROJECT_FILE = path.join(
  IOS_DIR,
  'Pods',
  'Pods.xcodeproj',
  'project.pbxproj'
);
const PODFILE_LOCK = path.join(IOS_DIR, 'Podfile.lock');
const PODS_MANIFEST_LOCK = path.join(IOS_DIR, 'Pods', 'Manifest.lock');
const SCHEME = 'ImageCompressionKitExample';
const BUNDLE_ID = 'com.imagecompressionkit.example';
const REQUEST_PARSER_SOURCE = path.join(
  ROOT,
  'ios',
  'RCTImageCompressionRequest.mm'
);
const REQUEST_PARSER_TEST_SOURCE = path.join(
  ROOT,
  'test',
  'ios-native',
  'RCTImageCompressionRequestTests.mm'
);
const INPUT_SOURCES = [
  path.join(ROOT, 'ios', 'RCTImageCompressionSourceResolver.mm'),
  path.join(ROOT, 'ios', 'RCTImageCompressionInputInspector.mm'),
];
const INPUT_TEST_SOURCE = path.join(
  ROOT,
  'test',
  'ios-native',
  'RCTImageCompressionInputTests.mm'
);
const IMAGE_DECODER_CORE_SOURCE = path.join(
  ROOT,
  'ios',
  'RCTImageCompressionImageDecoder.mm'
);
const IMAGE_DECODER_TEST_SOURCE = path.join(
  ROOT,
  'test',
  'ios-native',
  'RCTImageCompressionImageDecoderTests.mm'
);
const IMAGE_ENCODER_CORE_SOURCE = path.join(
  ROOT,
  'ios',
  'RCTImageCompressionImageEncoder.mm'
);
const IMAGE_ENCODER_TEST_SOURCE = path.join(
  ROOT,
  'test',
  'ios-native',
  'RCTImageCompressionImageEncoderTests.mm'
);
const OUTPUT_CORE_SOURCE = path.join(
  ROOT,
  'ios',
  'RCTImageCompressionOutput.mm'
);
const OUTPUT_TEST_SOURCE = path.join(
  ROOT,
  'test',
  'ios-native',
  'RCTImageCompressionOutputTests.mm'
);
const PIPELINE_CORE_SOURCE = path.join(
  ROOT,
  'ios',
  'RCTImageCompressionPipeline.mm'
);
const PIPELINE_TEST_SOURCE = path.join(
  ROOT,
  'test',
  'ios-native',
  'RCTImageCompressionPipelineTests.mm'
);
const IMAGE_TRANSFORMER_CORE_SOURCE = path.join(
  ROOT,
  'ios',
  'RCTImageCompressionImageTransformer.mm'
);
const IMAGE_TRANSFORMER_TEST_SOURCE = path.join(
  ROOT,
  'test',
  'ios-native',
  'RCTImageCompressionImageTransformerTests.mm'
);
const JPEG_METADATA_CORE_SOURCE = path.join(
  ROOT,
  'ios',
  'RCTImageCompressionJpegMetadata.mm'
);
const JPEG_METADATA_TEST_SOURCE = path.join(
  ROOT,
  'test',
  'ios-native',
  'RCTImageCompressionJpegMetadataTests.mm'
);
const IOS_VALIDATION_CONFIG = createIOSValidationConfig(process.env);
const METRO_PORT = IOS_VALIDATION_CONFIG.metroPort;
const METRO_READY_TIMEOUT_MS = IOS_VALIDATION_CONFIG.metroReadyTimeoutMs;
const SMOKE_TIMEOUT_MS = IOS_VALIDATION_CONFIG.smokeTimeoutMs;
const SMOKE_MAX_ATTEMPTS = IOS_VALIDATION_CONFIG.smokeMaxAttempts;
const SMOKE_LOG_STREAM_WARMUP_MS = IOS_VALIDATION_CONFIG.smokeLogStreamWarmupMs;
const SMOKE_DIAGNOSTIC_LOG_WINDOW = IOS_VALIDATION_CONFIG.smokeDiagnosticLogWindow;
const POD_INSTALL_MAX_ATTEMPTS = IOS_VALIDATION_CONFIG.podInstallMaxAttempts;
const POD_INSTALL_CLEANUP_PATHS = [
  path.join(IOS_DIR, 'Pods'),
  WORKSPACE,
  path.join(IOS_DIR, 'Podfile.lock'),
];

const mode = process.argv[2] ?? 'smoke';

async function main() {
  if (mode === 'summarize-smoke-log') {
    summarizeSmokeLog();
    return;
  }

  if (mode === 'env') {
    checkIOSBuildEnvironment();
    return;
  }

  if (mode === 'pods') {
    checkIOSBuildEnvironment();
    runPodInstall();
    return;
  }

  if (mode === 'request-parser-test') {
    runRequestParserTests();
    return;
  }

  if (mode === 'input-test') {
    runInputTests();
    return;
  }

  if (mode === 'decoder-test') {
    runImageDecoderTests();
    return;
  }

  if (mode === 'encoder-test') {
    runImageEncoderTests();
    return;
  }

  if (mode === 'output-test') {
    runOutputTests();
    return;
  }

  if (mode === 'pipeline-test') {
    runPipelineTests();
    return;
  }

  if (mode === 'transformer-test') {
    runImageTransformerTests();
    return;
  }

  if (mode === 'metadata-test') {
    runJpegMetadataTests();
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
    runRequestParserTests();
    runInputTests();
    runImageDecoderTests();
    runImageTransformerTests();
    runJpegMetadataTests();
    runImageEncoderTests();
    runOutputTests();
    runPipelineTests();
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

function summarizeSmokeLog() {
  const logPath = process.argv[3];
  if (!logPath) {
    throw new Error(
      'Usage: node scripts/ios-validation.mjs summarize-smoke-log <log-file>'
    );
  }

  const summary = formatIOSSmokeDiagnosticsSummary({
    logText: readFileSync(path.resolve(ROOT, logPath), 'utf8'),
  });
  process.stdout.write(`${summary}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
}

function ensurePackageJSBuild() {
  mustRun('pnpm', ['build']);
}

function runRequestParserTests() {
  runNativeTests(
    'RCTImageCompressionRequestTests',
    [REQUEST_PARSER_SOURCE, REQUEST_PARSER_TEST_SOURCE],
    ['Foundation']
  );
}

function runInputTests() {
  runNativeTests(
    'RCTImageCompressionInputTests',
    [...INPUT_SOURCES, INPUT_TEST_SOURCE],
    ['Foundation', 'ImageIO']
  );
}

function runImageDecoderTests() {
  runNativeTests(
    'RCTImageCompressionImageDecoderTests',
    [
      ...INPUT_SOURCES,
      IMAGE_DECODER_CORE_SOURCE,
      IMAGE_DECODER_TEST_SOURCE,
    ],
    ['Foundation', 'ImageIO']
  );
}

function runImageEncoderTests() {
  runNativeTests(
    'RCTImageCompressionImageEncoderTests',
    [
      REQUEST_PARSER_SOURCE,
      IMAGE_ENCODER_CORE_SOURCE,
      IMAGE_ENCODER_TEST_SOURCE,
    ],
    ['Foundation']
  );
}

function runOutputTests() {
  runNativeTests(
    'RCTImageCompressionOutputTests',
    [REQUEST_PARSER_SOURCE, OUTPUT_CORE_SOURCE, OUTPUT_TEST_SOURCE],
    ['Foundation']
  );
}

function runPipelineTests() {
  runNativeTests(
    'RCTImageCompressionPipelineTests',
    [
      REQUEST_PARSER_SOURCE,
      ...INPUT_SOURCES,
      IMAGE_DECODER_CORE_SOURCE,
      IMAGE_TRANSFORMER_CORE_SOURCE,
      JPEG_METADATA_CORE_SOURCE,
      IMAGE_ENCODER_CORE_SOURCE,
      OUTPUT_CORE_SOURCE,
      PIPELINE_CORE_SOURCE,
      PIPELINE_TEST_SOURCE,
    ],
    ['Foundation', 'ImageIO', 'CoreGraphics']
  );
}

function runImageTransformerTests() {
  runNativeTests(
    'RCTImageCompressionImageTransformerTests',
    [IMAGE_TRANSFORMER_CORE_SOURCE, IMAGE_TRANSFORMER_TEST_SOURCE],
    ['Foundation']
  );
}

function runJpegMetadataTests() {
  runNativeTests(
    'RCTImageCompressionJpegMetadataTests',
    [
      REQUEST_PARSER_SOURCE,
      JPEG_METADATA_CORE_SOURCE,
      JPEG_METADATA_TEST_SOURCE,
    ],
    ['Foundation', 'ImageIO', 'CoreGraphics']
  );
}

function runNativeTests(executableName, sourceFiles, frameworks) {
  mustRun('xcrun', ['--sdk', 'macosx', '--show-sdk-path'], {
    failureHint: 'Install Xcode Command Line Tools with the macOS SDK.',
  });

  const buildDirectory = mkdtempSync(
    path.join(tmpdir(), 'rnick-ios-native-tests-')
  );
  const executable = path.join(buildDirectory, executableName);

  try {
    mustRun('xcrun', [
      '--sdk',
      'macosx',
      'clang++',
      '-std=c++17',
      '-fobjc-arc',
      '-fblocks',
      '-I',
      path.join(ROOT, 'ios'),
      ...sourceFiles,
      ...frameworks.flatMap((framework) => ['-framework', framework]),
      '-o',
      executable,
    ]);
    mustRun(executable, []);
  } finally {
    rmSync(buildDirectory, { recursive: true, force: true });
  }
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
  const requiredPodSources = [
    'RCTImageCompressionRequest.mm',
    'RCTImageCompressionSourceResolver.mm',
    'RCTImageCompressionInputInspector.mm',
    'RCTImageCompressionImageDecoder.mm',
    'RCTImageCompressionImageEncoder.mm',
    'RCTImageCompressionImageTransformer.mm',
    'RCTImageCompressionJpegMetadata.mm',
    'RCTImageCompressionUIKitImageDecoder.mm',
    'RCTImageCompressionUIKitImageEncoder.mm',
    'RCTImageCompressionUIKitImageTransformer.mm',
    'RCTImageCompressionIOSCapabilities.mm',
  ];
  const podProjectContents = pathExists(PODS_PROJECT_FILE)
    ? readFileSync(PODS_PROJECT_FILE, 'utf8')
    : '';
  const podSourcesAreCurrent =
    requiredPodSources.every((sourceFile) =>
      podProjectContents.includes(sourceFile)
    );
  const podLocksAreCurrent =
    pathExists(PODFILE_LOCK) &&
    pathExists(PODS_MANIFEST_LOCK) &&
    readFileSync(PODFILE_LOCK, 'utf8') === readFileSync(PODS_MANIFEST_LOCK, 'utf8');

  if (!pathExists(WORKSPACE) || !podSourcesAreCurrent || !podLocksAreCurrent) {
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
      if (
        !shouldRetrySmokeTimeout({
          error,
          attempt,
          maxAttempts: SMOKE_MAX_ATTEMPTS,
        })
      ) {
        throw error;
      }

      for (const warning of formatSmokeRetryWarningMessages({
        error,
        attempt,
        maxAttempts: SMOKE_MAX_ATTEMPTS,
      })) {
        console.warn(warning);
      }
      optionalCommandOutput('xcrun', ['simctl', 'terminate', udid, BUNDLE_ID]);
      await delay(2000);
    }
  }
}

function runSmokeAttempt(udid, metroProcess, setLogProcess, attempt) {
  return new Promise((resolve, reject) => {
    console.log(
      `Starting iOS smoke attempt ${attempt}/${SMOKE_MAX_ATTEMPTS} with ` +
        `timeout=${SMOKE_TIMEOUT_MS}ms, logWarmup=${SMOKE_LOG_STREAM_WARMUP_MS}ms, ` +
        `diagnosticLogWindow=${SMOKE_DIAGNOSTIC_LOG_WINDOW}.`
    );

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
    const lifecycle = createSmokeAttemptLifecycle({
      metroProcess,
      logProcess,
      setLogProcess,
      stopProcess,
      clearAttemptTimeout: () => {
        clearTimeout(timeout);
      },
      writeOutput: (text) => {
        process.stdout.write(text);
      },
      onPass: resolve,
      onFail: reject,
    });
    const timeout = setTimeout(() => {
      const { launchOutput, smokeLogOutput } = lifecycle.snapshot();

      lifecycle.finish(
        reject,
        createSmokeTimeoutErrorFromCLIState({
          config: IOS_VALIDATION_CONFIG,
          attempt,
          udid,
          bundleId: BUNDLE_ID,
          scheme: SCHEME,
          smokeLogOutput,
          launchOutput,
          metroOutput: metroProcess.rnickOutput ?? '',
          simulatorSummary,
          optionalCommandOutput,
          recentIOSSmokeLogs,
        })
      );
    }, SMOKE_TIMEOUT_MS);

    lifecycle.attach();

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
        lifecycle.setLaunchOutput(commandOutput(launchResult));
      })
      .catch((error) => {
        lifecycle.finish(reject, error);
      });
  });
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
