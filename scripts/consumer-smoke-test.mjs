#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMP_PARENT = process.env.RNICK_CONSUMER_SMOKE_TMPDIR
  ? path.resolve(process.env.RNICK_CONSUMER_SMOKE_TMPDIR)
  : os.tmpdir();
const KEEP_TEMP = process.env.RNICK_CONSUMER_SMOKE_KEEP === '1';
const REACT_VERSION = '19.2.3';
const REACT_NATIVE_VERSION = '0.86.0';
const TYPESCRIPT_VERSION = '^5.8.3';
const TYPES_REACT_VERSION = '^19.2.0';

mkdirSync(TEMP_PARENT, { recursive: true });

const tempRoot = mkdtempSync(path.join(TEMP_PARENT, 'rnick-consumer-smoke-'));
const packDir = path.join(tempRoot, 'pack');
const consumerDir = path.join(tempRoot, 'consumer');

try {
  mkdirSync(packDir, { recursive: true });
  mkdirSync(path.join(consumerDir, 'src'), { recursive: true });

  run('pnpm', ['pack', '--pack-destination', packDir], ROOT);
  const tarballPath = findPackedTarball(packDir);
  console.log(`Packed ${tarballPath}`);

  writeConsumerProject(consumerDir, tarballPath);
  run('pnpm', ['install', '--ignore-scripts'], consumerDir);
  assertInstalledPackageFiles(consumerDir);
  run('pnpm', ['typecheck'], consumerDir);

  console.log('Consumer smoke test completed.');
} finally {
  if (KEEP_TEMP) {
    console.log(`Keeping consumer smoke test directory: ${tempRoot}`);
  } else {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function writeConsumerProject(projectDir, tarballPath) {
  const tarballSpecifier = `file:${toPosixPath(path.relative(projectDir, tarballPath))}`;

  writeJson(path.join(projectDir, 'package.json'), {
    name: 'rnick-consumer-smoke',
    version: '0.0.0',
    private: true,
    scripts: {
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      react: REACT_VERSION,
      'react-native': REACT_NATIVE_VERSION,
      'react-native-image-compression-kit': tarballSpecifier,
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
  uri: 'file:///tmp/rnick-consumer-smoke/source.jpg',
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
  'Native module is intentionally not invoked during the consumer smoke test.'
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

function findPackedTarball(directory) {
  const tarballs = readdirSync(directory)
    .filter((fileName) => /^react-native-image-compression-kit-.*\.tgz$/.test(fileName))
    .sort();

  if (tarballs.length !== 1) {
    fail(`Expected exactly one packed tarball in ${directory}, found ${tarballs.length}.`);
  }

  return path.join(directory, tarballs[0]);
}

function assertInstalledPackageFiles(projectDir) {
  const packageDir = path.join(
    projectDir,
    'node_modules',
    'react-native-image-compression-kit'
  );
  const requiredFiles = [
    'package.json',
    'lib/index.js',
    'lib/index.d.ts',
    'android/build.gradle',
    'ios/RCTImageCompressionKit.h',
    'react-native.config.js',
  ];
  const missing = requiredFiles.filter(
    (filePath) => !existsSync(path.join(packageDir, filePath))
  );
  const forbiddenFiles = [
    'scripts/consumer-smoke-test.mjs',
    'scripts/android-verification.mjs',
    'android/src/androidTest/java/com/imagecompressionkit/ImageCompressionKitHeicHeifInstrumentationTest.kt',
    'android/src/test/assets/heic-heif/sample.heic',
    'android/src/test/assets/avif/sample.avif',
    'android/src/test/java/com/imagecompressionkit/ImageCompressionKitModuleTest.kt',
  ];
  const presentForbiddenFiles = forbiddenFiles.filter((filePath) =>
    existsSync(path.join(packageDir, filePath))
  );

  if (missing.length > 0) {
    fail(`Installed package is missing expected files: ${missing.join(', ')}`);
  }

  if (presentForbiddenFiles.length > 0) {
    fail(`Installed package contains development-only files: ${presentForbiddenFiles.join(', ')}`);
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

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
