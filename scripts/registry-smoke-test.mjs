#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootPackageJson = readJson(path.join(ROOT, 'package.json'));
const TEMP_PARENT = process.env.RNICK_REGISTRY_SMOKE_TMPDIR
  ? path.resolve(process.env.RNICK_REGISTRY_SMOKE_TMPDIR)
  : os.tmpdir();
const KEEP_TEMP = process.env.RNICK_REGISTRY_SMOKE_KEEP === '1';
const REACT_VERSION = '19.2.3';
const REACT_NATIVE_VERSION = '0.86.0';
const TYPESCRIPT_VERSION = '^5.8.3';
const TYPES_REACT_VERSION = '^19.2.0';

const options = parseArgs(process.argv.slice(2));
const packageName = options.packageName ?? rootPackageJson.name;
const selector =
  options.version ??
  options.tag ??
  process.env.RNICK_REGISTRY_SMOKE_VERSION ??
  process.env.RNICK_REGISTRY_SMOKE_TAG ??
  rootPackageJson.version;

if (!packageName) {
  fail('Missing package name.');
}

if (!selector) {
  fail('Missing registry version or tag.');
}

mkdirSync(TEMP_PARENT, { recursive: true });

const requestedSpec = `${packageName}@${selector}`;
const registryMetadata = npmView(requestedSpec);
const publishedVersion = String(registryMetadata.version ?? '');

if (!publishedVersion) {
  fail(`Could not resolve published version for ${requestedSpec}.`);
}

if (options.version && publishedVersion !== options.version) {
  fail(`Expected ${options.version}, but npm resolved ${publishedVersion}.`);
}

const publishedSpec = `${packageName}@${publishedVersion}`;
const tempRoot = mkdtempSync(path.join(TEMP_PARENT, 'rnick-registry-smoke-'));
const packDir = path.join(tempRoot, 'pack');
const consumerDir = path.join(tempRoot, 'consumer');

try {
  mkdirSync(packDir, { recursive: true });
  mkdirSync(path.join(consumerDir, 'src'), { recursive: true });

  const packInfo = npmPack(publishedSpec, packDir);
  assertPackedTarball(packInfo, registryMetadata, publishedVersion);

  writeConsumerProject(consumerDir, packageName, publishedVersion);
  run('npm', ['install', '--ignore-scripts', '--legacy-peer-deps'], consumerDir);
  assertInstalledPackageFiles(consumerDir, packageName, publishedVersion);
  run('npm', ['run', 'typecheck'], consumerDir);

  console.log(
    JSON.stringify(
      {
        package: publishedSpec,
        tarball: registryMetadata['dist.tarball'],
        integrity: registryMetadata['dist.integrity'],
        shasum: registryMetadata['dist.shasum'],
        fileCount: packInfo.files.length,
        packageSize: packInfo.size,
        unpackedSize: packInfo.unpackedSize,
        registryInstallSmoke: true,
      },
      null,
      2
    )
  );
} finally {
  if (KEEP_TEMP) {
    console.log(`Keeping registry smoke test directory: ${tempRoot}`);
  } else {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') {
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      console.log(`Usage: pnpm smoke:registry -- [--version 0.2.7 | --tag latest]

Options:
  --version <version>  Smoke-test an exact published version.
  --tag <tag>          Resolve and smoke-test a published npm dist-tag.
  --package <name>     Override the package name. Defaults to package.json name.

Environment:
  RNICK_REGISTRY_SMOKE_VERSION  Default exact version when no CLI selector is set.
  RNICK_REGISTRY_SMOKE_TAG      Default dist-tag when no CLI selector is set.
  RNICK_REGISTRY_SMOKE_KEEP=1   Keep the temporary project for inspection.
  RNICK_REGISTRY_SMOKE_TMPDIR   Parent directory for the temporary project.
`);
      process.exit(0);
    }

    if (arg === '--version') {
      parsed.version = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--tag') {
      parsed.tag = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--package') {
      parsed.packageName = readValue(args, index, arg);
      index += 1;
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  if (parsed.version && parsed.tag) {
    fail('Use either --version or --tag, not both.');
  }

  return parsed;
}

function readValue(args, index, flag) {
  const value = args[index + 1];

  if (!value || value.startsWith('--')) {
    fail(`Missing value for ${flag}.`);
  }

  return value;
}

function npmView(spec) {
  return captureJson('npm', [
    'view',
    spec,
    'version',
    'dist.tarball',
    'dist.integrity',
    'dist.shasum',
    'time',
    '--json',
  ]);
}

function npmPack(spec, packDir) {
  const result = captureJson('npm', [
    'pack',
    spec,
    '--pack-destination',
    packDir,
    '--json',
  ]);

  if (!Array.isArray(result) || result.length !== 1) {
    fail(`Expected npm pack to return one tarball entry for ${spec}.`);
  }

  return result[0];
}

function assertPackedTarball(packInfo, registryMetadata, expectedVersion) {
  if (packInfo.name !== packageName) {
    fail(`Expected packed package name ${packageName}, got ${packInfo.name}.`);
  }

  if (packInfo.version !== expectedVersion) {
    fail(`Expected packed version ${expectedVersion}, got ${packInfo.version}.`);
  }

  if (registryMetadata['dist.integrity'] && packInfo.integrity !== registryMetadata['dist.integrity']) {
    fail('Packed tarball integrity does not match npm registry metadata.');
  }

  if (registryMetadata['dist.shasum'] && packInfo.shasum !== registryMetadata['dist.shasum']) {
    fail('Packed tarball shasum does not match npm registry metadata.');
  }

  const filePaths = packInfo.files.map((file) => file.path);
  const requiredFiles = [
    'package.json',
    'README.md',
    'SECURITY.md',
    'LICENSE',
    'lib/index.js',
    'lib/index.d.ts',
    'android/build.gradle',
    'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt',
    'ios/RCTImageCompressionKit.h',
    'ios/RCTImageCompressionKit.mm',
    'react-native-image-compression-kit.podspec',
    'react-native.config.js',
  ];
  const forbiddenFiles = [
    'scripts/consumer-smoke-test.mjs',
    'scripts/registry-smoke-test.mjs',
    'scripts/android-verification.mjs',
    'android/src/androidTest/java/com/imagecompressionkit/ImageCompressionKitHeicHeifInstrumentationTest.kt',
    'android/src/test/assets/heic-heif/sample.heic',
    'android/src/test/assets/avif/sample.avif',
    'android/src/test/java/com/imagecompressionkit/ImageCompressionKitModuleTest.kt',
    'example/package.json',
  ];
  const missing = requiredFiles.filter((filePath) => !filePaths.includes(filePath));
  const presentForbidden = forbiddenFiles.filter((filePath) => filePaths.includes(filePath));

  if (missing.length > 0) {
    fail(`Packed registry tarball is missing expected files: ${missing.join(', ')}`);
  }

  if (presentForbidden.length > 0) {
    fail(`Packed registry tarball contains development-only files: ${presentForbidden.join(', ')}`);
  }
}

function writeConsumerProject(projectDir, dependencyName, dependencyVersion) {
  writeJson(path.join(projectDir, 'package.json'), {
    name: 'rnick-registry-smoke',
    version: '0.0.0',
    private: true,
    scripts: {
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      react: REACT_VERSION,
      'react-native': REACT_NATIVE_VERSION,
      [dependencyName]: dependencyVersion,
    },
    devDependencies: {
      '@types/react': TYPES_REACT_VERSION,
      typescript: TYPESCRIPT_VERSION,
    },
    engines: {
      node: '>=22.11.0',
    },
  });

  writeJson(path.join(projectDir, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      noEmit: true,
      jsx: 'react-jsx',
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      skipLibCheck: true,
    },
    include: ['src'],
  });

  writeFileSync(
    path.join(projectDir, 'src/index.ts'),
    `import {
  IMAGE_FORMATS,
  ImageCompressionKitError,
  METADATA_POLICIES,
  OUTPUT_FORMATS,
  RESIZE_MODES,
  compressImage,
  getImageCompressionCapabilities,
} from 'react-native-image-compression-kit';
import type {
  CompressionOptions,
  CompressionResult,
  CompressionSource,
  FormatCapability,
  ImageCompressionCapabilities,
  ImageFormat,
  MetadataPolicy,
  NormalizedCompressionOptions,
  OutputFormat,
} from 'react-native-image-compression-kit';

const source: CompressionSource = {
  uri: 'file:///tmp/rnick-registry-smoke/source.jpg',
};
const outputFormat: OutputFormat = OUTPUT_FORMATS[0];
const metadataPolicy: MetadataPolicy = METADATA_POLICIES[1];
const options: CompressionOptions = {
  source,
  resize: {
    maxWidth: 320,
    maxHeight: 240,
    mode: RESIZE_MODES[0],
  },
  output: {
    format: outputFormat,
    quality: 82,
    maxBytes: 120_000,
  },
  metadata: metadataPolicy,
};
const normalizedOptions: NormalizedCompressionOptions = {
  ...options,
  resize: {
    maxWidth: 320,
    maxHeight: 240,
    mode: RESIZE_MODES[0],
  },
  metadata: metadataPolicy,
};
const firstCapability: FormatCapability = {
  format: IMAGE_FORMATS[0],
  input: true,
  output: true,
  supportsAlpha: false,
  supportsAnimation: false,
};
const formats: ImageFormat[] = IMAGE_FORMATS.map((format) => format);
const unavailableError = new ImageCompressionKitError(
  'ERR_NATIVE_MODULE_UNAVAILABLE',
  'Native module is intentionally not invoked during the registry smoke test.'
);

async function exercisePublicTypes(): Promise<{
  result: CompressionResult;
  capabilities: ImageCompressionCapabilities;
}> {
  const result = await compressImage(options);
  const capabilities = await getImageCompressionCapabilities();

  return { result, capabilities };
}

void normalizedOptions;
void firstCapability;
void formats;
void unavailableError;
void exercisePublicTypes;
`,
    'utf8'
  );
}

function assertInstalledPackageFiles(projectDir, dependencyName, expectedVersion) {
  const packageDir = path.join(projectDir, 'node_modules', dependencyName);
  const installedPackageJsonPath = path.join(packageDir, 'package.json');

  if (!existsSync(installedPackageJsonPath)) {
    fail(`Installed package is missing package.json at ${installedPackageJsonPath}.`);
  }

  const installedPackageJson = readJson(installedPackageJsonPath);

  if (installedPackageJson.version !== expectedVersion) {
    fail(`Expected installed version ${expectedVersion}, got ${installedPackageJson.version}.`);
  }

  const requiredFiles = [
    'package.json',
    'README.md',
    'SECURITY.md',
    'LICENSE',
    'lib/index.js',
    'lib/index.d.ts',
    'android/build.gradle',
    'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt',
    'ios/RCTImageCompressionKit.h',
    'ios/RCTImageCompressionKit.mm',
    'react-native.config.js',
  ];
  const forbiddenFiles = [
    'scripts/consumer-smoke-test.mjs',
    'scripts/registry-smoke-test.mjs',
    'scripts/android-verification.mjs',
    'android/src/androidTest/java/com/imagecompressionkit/ImageCompressionKitHeicHeifInstrumentationTest.kt',
    'android/src/test/assets/heic-heif/sample.heic',
    'android/src/test/assets/avif/sample.avif',
    'android/src/test/java/com/imagecompressionkit/ImageCompressionKitModuleTest.kt',
    'example/package.json',
  ];
  const missing = requiredFiles.filter(
    (filePath) => !existsSync(path.join(packageDir, filePath))
  );
  const presentForbidden = forbiddenFiles.filter((filePath) =>
    existsSync(path.join(packageDir, filePath))
  );

  if (missing.length > 0) {
    fail(`Installed package is missing expected files: ${missing.join(', ')}`);
  }

  if (presentForbidden.length > 0) {
    fail(`Installed package contains development-only files: ${presentForbidden.join(', ')}`);
  }
}

function captureJson(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    fail(result.error.message);
  }

  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    process.exit(result.status ?? 1);
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`Could not parse JSON output from ${command} ${args.join(' ')}: ${error.message}`);
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    fail(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
