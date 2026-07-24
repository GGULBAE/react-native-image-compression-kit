import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';
import {
  NATIVE_MODULE_NAME,
  type NativeImageCompressionKitModule,
} from '../src/nativeModule';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readProjectFile(filePath: string): string {
  return readFileSync(path.join(ROOT, filePath), 'utf8');
}

function parseDockerArgs(source: string): Record<string, string> {
  return Object.fromEntries(
    [...source.matchAll(/^ARG ([A-Z0-9_]+)=([^\s]+)$/gm)].map((match) => [
      match[1],
      match[2],
    ])
  );
}

describe('npm package contract', () => {
  it('publishes the expected metadata and entry points', () => {
    expect(packageJson).toMatchObject({
      name: 'react-native-image-compression-kit',
      license: 'MIT',
      main: 'lib/index.js',
      types: 'lib/index.d.ts',
      repository: {
        type: 'git',
        url: 'git+https://github.com/GGULBAE/react-native-image-compression-kit.git',
      },
      exports: {
        '.': {
          types: './lib/index.d.ts',
          default: './lib/index.js',
        },
        './package.json': './package.json',
      },
      peerDependencies: { 'react-native': '>=0.73 <1.0' },
    });
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(packageJson.packageManager).toBe('pnpm@11.8.0');
  });

  it('keeps the publish allowlist runtime-only', () => {
    const requiredEntries = [
      'android/build.gradle',
      'android/src/main',
      'ios',
      'lib',
      'src',
      'README.md',
      'SECURITY.md',
      'LICENSE',
      'react-native-image-compression-kit.podspec',
      'react-native.config.js',
    ];
    const forbiddenPrefixes = ['docs', 'evidence', 'scripts', 'test', 'tests'];

    expect(packageJson.files).toEqual(expect.arrayContaining(requiredEntries));
    expect(
      packageJson.files.filter((entry) =>
        forbiddenPrefixes.some(
          (prefix) => entry === prefix || entry.startsWith(`${prefix}/`)
        )
      )
    ).toEqual([]);
    expect(packageJson.scripts).not.toHaveProperty('prepublishOnly');
    expect(packageJson.scripts).not.toHaveProperty('postinstall');
  });

  it('declares one Codegen module contract shared by JavaScript and native platforms', () => {
    expect(packageJson.codegenConfig).toEqual({
      name: 'RNImageCompressionKitSpec',
      type: 'modules',
      jsSrcsDir: 'src',
      outputDir: {
        ios: 'ios/generated',
        android: 'android/generated',
      },
      android: { javaPackageName: 'com.imagecompressionkit' },
      ios: {
        modulesProvider: { ImageCompressionKit: 'RCTImageCompressionKit' },
      },
    });
    expect(NATIVE_MODULE_NAME).toBe('ImageCompressionKit');

    const moduleShape = {
      compressImage: async () => ({
        uri: 'file:///tmp/output.jpg',
        format: 'jpeg' as const,
        width: 100,
        height: 100,
        byteSize: 1_000,
        originalByteSize: 2_000,
        compressionRatio: 0.5,
      }),
      cancelCompression: () => undefined,
      getImageCompressionCapabilities: async () => ({
        platform: 'unknown' as const,
        formats: [],
        metadataPolicies: ['preserve', 'safe', 'strip'],
        supportsTargetSizeCompression: false,
        supportsCancellation: true,
        maxConcurrentOperations: 2,
        supportsDecodeDownsampling: true,
        resourceLimits: {
          maxSourceDimension: 32_768,
          maxSourcePixels: 100_000_000,
          maxWorkingPixels: 25_000_000,
        },
      }),
    } satisfies NativeImageCompressionKitModule;

    expect(Object.keys(moduleShape).sort()).toEqual([
      'cancelCompression',
      'compressImage',
      'getImageCompressionCapabilities',
    ]);
  });

  it('maps public verification commands to their executable owners', () => {
    expect(packageJson.scripts).toMatchObject({
      test: 'vitest run',
      'test:coverage': 'vitest run --coverage',
      'docs:check': 'node scripts/verify-docs.mjs',
      'release:dry-run': 'node scripts/release-dry-run.mjs',
      'android:doctor': 'node scripts/android-verification.mjs doctor',
      'android:codegen': 'node scripts/android-verification.mjs codegen',
      'android:build': 'node scripts/android-verification.mjs build',
      'example:android-unit-test':
        'RNICK_ANDROID_APP_DIR=example/android RNICK_ANDROID_GRADLE_TASK=:react-native-image-compression-kit:testDebugUnitTest pnpm android:build',
      'example:android-instrumentation':
        'RNICK_ANDROID_APP_DIR=example/android RNICK_ANDROID_GRADLE_TASK=:react-native-image-compression-kit:connectedDebugAndroidTest pnpm android:build',
      'example:ios:smoke': 'node scripts/ios-validation.mjs smoke',
      'example:ios:decoder-test':
        'node scripts/ios-validation.mjs decoder-test',
      'example:ios:encoder-test':
        'node scripts/ios-validation.mjs encoder-test',
      'example:ios:metadata-test':
        'node scripts/ios-validation.mjs metadata-test',
      'example:ios:transformer-test':
        'node scripts/ios-validation.mjs transformer-test',
      'example:ios:input-test': 'node scripts/ios-validation.mjs input-test',
      'example:ios:request-parser-test':
        'node scripts/ios-validation.mjs request-parser-test',
      'example:ios:request-test':
        'node scripts/ios-validation.mjs request-parser-test',
      'example:typecheck': 'pnpm --filter image-compression-kit-example typecheck',
      'smoke:consumer': 'pnpm build && node scripts/consumer-smoke-test.mjs',
      'verify:workflow-supply-chain':
        'node scripts/verify-workflow-supply-chain.mjs',
      'fixtures:avif:check': 'node scripts/generate-avif-fixtures.mjs --check',
      'fixtures:heic-heif:check':
        'node scripts/generate-heic-heif-fixtures.mjs --check',
    });

    const verifyCommands = packageJson.scripts.verify.split(' && ');
    expect(verifyCommands).toEqual(
      expect.arrayContaining([
        'pnpm typecheck',
        'pnpm test:coverage',
        'pnpm build',
        'pnpm docs:check',
        'pnpm fixtures:ios-pass-replay:audit',
        'pnpm verify:workflow-supply-chain -- --json',
        'pnpm android:doctor',
      ])
    );
    expect(verifyCommands[0]).toBe('pnpm typecheck');
    expect(verifyCommands).not.toContain('pnpm test');
    expect(verifyCommands[verifyCommands.length - 1]).toBe(
      'pnpm android:doctor'
    );
  });

  it('keeps the reproducible Android container toolchain explicit', () => {
    expect(parseDockerArgs(readProjectFile('Dockerfile'))).toEqual({
      NODE_VERSION: '24.11.1',
      PNPM_VERSION: '11.8.0',
      ANDROID_CMDLINE_TOOLS_VERSION: '12266719',
      ANDROID_PLATFORM: 'android-36',
      ANDROID_BUILD_TOOLS_VERSION: '36.0.0',
      ANDROID_LEGACY_BUILD_TOOLS_VERSION: '35.0.0',
      ANDROID_NDK_VERSION: '27.1.12297006',
      ANDROID_CMAKE_VERSION: '3.22.1',
    });

    const ignoredPaths = new Set(
      readProjectFile('.dockerignore')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
    );
    for (const ignoredPath of [
      '.git/',
      'node_modules/',
      'lib/',
      '*.tgz',
      'android/build/',
      'example/android/app/build/',
      'ios/Pods/',
    ]) {
      expect(ignoredPaths.has(ignoredPath)).toBe(true);
    }

    expect(packageJson.scripts).toMatchObject({
      'docker:android:build': 'node scripts/docker-android.mjs build',
      'docker:android:verify': 'node scripts/docker-android.mjs verify',
      'docker:android:ci': 'node scripts/docker-android.mjs ci',
      'docker:android:shell': 'node scripts/docker-android.mjs shell',
    });
  });

  it('keeps Vitest and its V8 coverage provider on one exact version', () => {
    expect(packageJson.devDependencies.vitest).toBe('4.1.10');
    expect(packageJson.devDependencies['@vitest/coverage-v8']).toBe('4.1.10');
  });
});
