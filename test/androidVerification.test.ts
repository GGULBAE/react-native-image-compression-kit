import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import packageJson from '../package.json';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readProjectFile(filePath: string): string {
  return readFileSync(path.join(ROOT, filePath), 'utf8');
}

function readProjectBinary(filePath: string): Buffer {
  return readFileSync(path.join(ROOT, filePath));
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function readPngDimensions(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function extractKotlinArray(source: string, arrayName: string): string {
  const match = source.match(
    new RegExp(`(?:private\\s+)?val ${arrayName} = arrayOf\\(([\\s\\S]*?)\\n  \\)`)
  );

  if (!match) {
    throw new Error(`Could not find Kotlin array ${arrayName}.`);
  }

  return match[1] ?? '';
}

describe('Android verification scripts', () => {
  it('declares npm publish-ready package metadata', () => {
    const readmeSource = readProjectFile('README.md');
    const expectedKeywords = [
      'react-native',
      'image',
      'image-processing',
      'compression',
      'resize',
      'transcode',
      'jpeg',
      'png',
      'webp',
      'heic',
      'heif',
      'avif',
    ];

    expect(packageJson.name).toBe('react-native-image-compression-kit');
    expect(packageJson.version).toBe('0.2.0');
    expect(packageJson.license).toBe('MIT');
    expect(packageJson.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/GGULBAE/react-native-image-compression-kit.git',
    });
    expect(packageJson.bugs).toEqual({
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/issues',
    });
    expect(packageJson.homepage).toBe(
      'https://github.com/GGULBAE/react-native-image-compression-kit#readme'
    );
    expect(packageJson.main).toBe('lib/index.js');
    expect(packageJson.types).toBe('lib/index.d.ts');
    expect(packageJson.exports['.']).toEqual({
      types: './lib/index.d.ts',
      default: './lib/index.js',
    });
    expect(packageJson.peerDependencies['react-native']).toBe('>=0.73 <1.0');
    expect(packageJson.files).toContain('README.md');
    expect(packageJson.files).toContain('SECURITY.md');
    expect(packageJson.files).toContain('LICENSE');

    for (const keyword of expectedKeywords) {
      expect(packageJson.keywords).toContain(keyword);
    }

    expect(readmeSource).toContain(
      'The public `0.2.0` package is distributed under'
    );
    expect(readmeSource).toContain(
      'version `0.2.0` is the published iOS native JPEG MVP release'
    );
    expect(readmeSource).toContain(
      'Version `0.2.0` adds an iOS native MVP with JPEG/PNG input'
    );
    expect(readmeSource).toContain(
      'Development scripts, Android JVM tests, instrumentation tests, and codec fixtures are intentionally excluded from the publish tarball.'
    );
    expect(readmeSource).toContain('Install from npm:');
    expect(readmeSource).toContain('- [x] Public npm release.');
  });

  it('exposes repository and app-backed Android verification commands', () => {
    expect(packageJson.scripts['android:doctor']).toBe(
      'node scripts/android-verification.mjs doctor'
    );
    expect(packageJson.scripts['android:codegen']).toBe(
      'node scripts/android-verification.mjs codegen'
    );
    expect(packageJson.scripts['android:build']).toBe(
      'node scripts/android-verification.mjs build'
    );
    expect(packageJson.scripts['example:android-unit-test']).toBe(
      'RNICK_ANDROID_APP_DIR=example/android RNICK_ANDROID_GRADLE_TASK=:react-native-image-compression-kit:testDebugUnitTest pnpm android:build'
    );
    expect(packageJson.scripts['example:android-instrumentation']).toBe(
      'RNICK_ANDROID_APP_DIR=example/android RNICK_ANDROID_GRADLE_TASK=:react-native-image-compression-kit:connectedDebugAndroidTest pnpm android:build'
    );
    expect(packageJson.scripts.verify).toContain('pnpm android:doctor');
  });

  it('defines the Docker Android build and test environment', () => {
    const dockerfileSource = readProjectFile('Dockerfile');
    const dockerIgnoreSource = readProjectFile('.dockerignore');
    const dockerScriptSource = readProjectFile('scripts/docker-android.mjs');
    const readmeSource = readProjectFile('README.md');

    expect(packageJson.scripts['docker:android:build']).toBe(
      'node scripts/docker-android.mjs build'
    );
    expect(packageJson.scripts['docker:android:verify']).toBe(
      'node scripts/docker-android.mjs verify'
    );
    expect(packageJson.scripts['docker:android:example:typecheck']).toBe(
      'node scripts/docker-android.mjs example:typecheck'
    );
    expect(packageJson.scripts['docker:android:example:codegen']).toBe(
      'node scripts/docker-android.mjs example:codegen'
    );
    expect(packageJson.scripts['docker:android:example:android-unit-test']).toBe(
      'node scripts/docker-android.mjs example:android-unit-test'
    );
    expect(packageJson.scripts['docker:android:example:build']).toBe(
      'node scripts/docker-android.mjs example:build'
    );
    expect(packageJson.scripts['docker:android:ci']).toBe(
      'node scripts/docker-android.mjs ci'
    );
    expect(packageJson.scripts['docker:android:shell']).toBe(
      'node scripts/docker-android.mjs shell'
    );

    expect(dockerfileSource).toContain('FROM eclipse-temurin:21-jdk-jammy');
    expect(dockerfileSource).toContain('ARG NODE_VERSION=24.11.1');
    expect(dockerfileSource).toContain('ARG PNPM_VERSION=11.7.0');
    expect(dockerfileSource).toContain('ARG ANDROID_PLATFORM=android-36');
    expect(dockerfileSource).toContain('ARG ANDROID_BUILD_TOOLS_VERSION=36.0.0');
    expect(dockerfileSource).toContain('ARG ANDROID_LEGACY_BUILD_TOOLS_VERSION=35.0.0');
    expect(dockerfileSource).toContain('ARG ANDROID_NDK_VERSION=27.1.12297006');
    expect(dockerfileSource).toContain('ARG ANDROID_CMAKE_VERSION=3.22.1');
    expect(dockerfileSource).toContain('ANDROID_HOME=/opt/android-sdk');
    expect(dockerfileSource).toContain('GRADLE_OPTS=-Dorg.gradle.vfs.watch=false');
    expect(dockerfileSource).toContain('npm install -g "pnpm@${PNPM_VERSION}"');
    expect(dockerfileSource).toContain('sdkmanager --install');
    expect(dockerfileSource).toContain('"platforms;${ANDROID_PLATFORM}"');
    expect(dockerfileSource).toContain('"build-tools;${ANDROID_BUILD_TOOLS_VERSION}"');
    expect(dockerfileSource).toContain('"build-tools;${ANDROID_LEGACY_BUILD_TOOLS_VERSION}"');
    expect(dockerfileSource).toContain('"cmake;${ANDROID_CMAKE_VERSION}"');
    expect(dockerfileSource).toContain('"ndk;${ANDROID_NDK_VERSION}"');
    expect(dockerfileSource).toContain('WORKDIR /workspace');

    expect(dockerIgnoreSource).toContain('node_modules/');
    expect(dockerIgnoreSource).toContain('android/build/');
    expect(dockerIgnoreSource).toContain('example/android/build/');

    expect(dockerScriptSource).toContain('RNICK_ANDROID_DOCKER_PLATFORM');
    expect(dockerScriptSource).toContain('linux/amd64');
    expect(dockerScriptSource).toContain('pnpm install --frozen-lockfile');
    expect(dockerScriptSource).toContain('example:android-unit-test');
    expect(dockerScriptSource).toContain('${VOLUME_PREFIX}-node-modules:/workspace/node_modules');
    expect(dockerScriptSource).toContain('${VOLUME_PREFIX}-pnpm-store:/pnpm/store');
    expect(dockerScriptSource).toContain('${VOLUME_PREFIX}-gradle-home:/root/.gradle');
    expect(dockerScriptSource).toContain('GRADLE_OPTS=-Dorg.gradle.vfs.watch=false');

    expect(readmeSource).toContain('## Docker Android Build/Test Environment');
    expect(readmeSource).toContain('Node.js 24, pnpm 11.7.0, Temurin JDK 21');
    expect(readmeSource).toContain('Android SDK platform 36, Android build tools 36.0.0');
    expect(readmeSource).toContain(
      'Android build tools 35.0.0 for React Native/AGP compatibility'
    );
    expect(readmeSource).toContain('CMake 3.22.1');
    expect(readmeSource).toContain('Android NDK 27.1.12297006');
    expect(readmeSource).toContain('pnpm docker:android:build');
    expect(readmeSource).toContain('pnpm docker:android:ci');
    expect(readmeSource).toContain('pnpm docker:android:example:android-unit-test');
    expect(readmeSource).toContain('linux/amd64');
    expect(readmeSource).toContain('disables Gradle VFS watching');
    expect(readmeSource).toContain('named Docker volumes');
    expect(readmeSource).toContain('does not run an Android emulator');
  });

  it('keeps development-only files out of npm package file globs', () => {
    expect(packageJson.files).toContain('android/build.gradle');
    expect(packageJson.files).toContain('android/src/main');
    expect(packageJson.files).not.toContain('android');
    expect(packageJson.files).not.toContain('android/src');
    expect(packageJson.files).not.toContain('scripts');
  });

  it('wires the packed package consumer smoke test', () => {
    const smokeScriptSource = readProjectFile('scripts/consumer-smoke-test.mjs');
    const ciWorkflowSource = readProjectFile('.github/workflows/ci.yml');
    const readmeSource = readProjectFile('README.md');

    expect(packageJson.scripts['smoke:consumer']).toBe(
      'pnpm build && node scripts/consumer-smoke-test.mjs'
    );
    expect(smokeScriptSource).toContain(
      "run('pnpm', ['pack', '--pack-destination', packDir], ROOT)"
    );
    expect(smokeScriptSource).toContain(
      "run('pnpm', ['install', '--ignore-scripts'], consumerDir)"
    );
    expect(smokeScriptSource).toContain("run('pnpm', ['typecheck'], consumerDir)");
    expect(smokeScriptSource).toContain(
      "'react-native-image-compression-kit': tarballSpecifier"
    );
    expect(smokeScriptSource).toContain("const REACT_NATIVE_VERSION = '0.86.0'");
    expect(smokeScriptSource).toContain('lib/index.d.ts');
    expect(smokeScriptSource).toContain('development-only files');
    expect(smokeScriptSource).toContain('scripts/consumer-smoke-test.mjs');
    expect(smokeScriptSource).toContain('android/src/test/assets/heic-heif/sample.heic');
    expect(smokeScriptSource).toContain('compressImage(options)');
    expect(smokeScriptSource).toContain('getImageCompressionCapabilities()');
    expect(ciWorkflowSource).toContain('name: Run package consumer smoke test');
    expect(ciWorkflowSource).toContain('run: pnpm smoke:consumer');
    expect(readmeSource).toContain('pnpm smoke:consumer');
    expect(readmeSource).toContain('separate temporary React Native consumer project');
    expect(readmeSource).toContain(
      'typechecks imports from `react-native-image-compression-kit`'
    );
    expect(readmeSource).toContain('without publishing to npm');
  });

  it('documents and wires the release dry-run checklist', () => {
    const releaseScriptSource = readProjectFile('scripts/release-dry-run.mjs');
    const readmeSource = readProjectFile('README.md');

    expect(packageJson.scripts['release:dry-run']).toBe(
      'node scripts/release-dry-run.mjs'
    );
    expect(releaseScriptSource).toContain(
      'Release dry run only validates publish readiness. It does not publish to npm.'
    );
    expect(releaseScriptSource).toContain("args: ['verify']");
    expect(releaseScriptSource).toContain("args: ['example:typecheck']");
    expect(releaseScriptSource).toContain("args: ['diff', '--check']");
    expect(releaseScriptSource).toContain("args: ['pack', '--dry-run']");
    expect(releaseScriptSource).toContain("args: ['smoke:consumer']");
    expect(releaseScriptSource).toContain(
      "args: ['publish', '--dry-run', '--no-git-checks']"
    );
    expect(readmeSource).toContain('## Release Dry Run Checklist');
    expect(readmeSource).toContain(
      'Actual npm publishing requires an authenticated npm registry session and is intentionally outside the dry-run checklist.'
    );
    expect(readmeSource).toContain('pnpm release:dry-run');
    expect(readmeSource).toContain('pnpm verify');
    expect(readmeSource).toContain('pnpm example:typecheck');
    expect(readmeSource).toContain('git diff --check');
    expect(readmeSource).toContain('pnpm pack --dry-run');
    expect(readmeSource).toContain('pnpm smoke:consumer');
    expect(readmeSource).toContain('pnpm publish --dry-run --no-git-checks');
    expect(readmeSource).toContain('successful GitHub Actions CI run');
  });

  it('documents and guards iOS host-app validation stability', () => {
    const readmeSource = readProjectFile('README.md');
    const gemfileSource = readProjectFile('example/Gemfile');
    const validationScriptSource = readProjectFile('scripts/ios-validation.mjs');

    expect(packageJson.scripts['example:ios:pods']).toBe(
      'node scripts/ios-validation.mjs pods'
    );
    expect(packageJson.scripts['example:ios:build']).toBe(
      'node scripts/ios-validation.mjs build'
    );
    expect(packageJson.scripts['example:ios:smoke']).toBe(
      'node scripts/ios-validation.mjs smoke'
    );
    expect(readmeSource).toContain('## iOS Host-App Validation');
    expect(readmeSource).toContain('pnpm example:ios:smoke');
    expect(readmeSource).toContain('RNICK_IOS_SMOKE_PASS');
    expect(readmeSource).toContain('Ruby 3.1 or newer');
    expect(readmeSource).toContain('patched ActiveSupport and Concurrent Ruby ranges');
    expect(readmeSource).toContain('pathname contains null byte');
    expect(readmeSource).toContain('RNICK_IOS_POD_INSTALL_ATTEMPTS');
    expect(gemfileSource).toContain("ruby '>= 3.1.0'");
    expect(gemfileSource).toContain("gem 'activesupport', '>= 7.2.3.1'");
    expect(gemfileSource).toContain("gem 'concurrent-ruby', '>= 1.3.7'");
    expect(validationScriptSource).toContain('POD_INSTALL_MAX_ATTEMPTS');
    expect(validationScriptSource).toContain('pathname contains null byte');
    expect(validationScriptSource).toContain('cleanPodInstallArtifacts');
    expect(validationScriptSource).toContain('iOS pod install diagnostics:');
  });

  it('documents the v0.2.0 release notes and previous release notes', () => {
    const releaseSource = readProjectFile('RELEASE.md');
    const readmeSource = readProjectFile('README.md');

    expect(packageJson.version).toBe('0.2.0');
    expect(releaseSource).toContain('## v0.2.0');
    expect(releaseSource).toContain(
      'Status: published to npm on June 30, 2026 at 07:04:03 UTC (16:04:03 KST), tagged as `v0.2.0`.'
    );
    expect(releaseSource).toContain('replacing the iOS');
    expect(releaseSource).toContain(
      'package stub with a native iOS JPEG compression MVP'
    );
    expect(releaseSource).toContain(
      'Implement iOS native `compressImage()` for local JPEG and PNG input.'
    );
    expect(releaseSource).toContain(
      'Support iOS JPEG output with `output.quality`, optional resize, and cache-file result metadata.'
    );
    expect(releaseSource).toContain(
      'Report iOS runtime capabilities for JPEG input/output, PNG input, metadata policies, target-size compression, and cancellation.'
    );
    expect(releaseSource).toContain(
      'Align README guidance, TypeScript native-unavailable messaging, and test expectations with the implemented iOS MVP.'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.2.0`.'
    );
    expect(releaseSource).toContain(
      'iOS `compressImage()` reads `file://` and best-effort `content://` source URIs.'
    );
    expect(releaseSource).toContain(
      'iOS input detection accepts JPEG and PNG only, rejecting other formats with `ERR_UNSUPPORTED_FORMAT`.'
    );
    expect(releaseSource).toContain(
      'iOS output supports JPEG only, rejecting unsupported output formats with `ERR_NOT_IMPLEMENTED`.'
    );
    expect(releaseSource).toContain(
      'iOS resize supports `contain`, `cover`, and `stretch`.'
    );
    expect(releaseSource).toContain(
      'iOS `output.quality` supports integer quality values from `0` to `100`, defaulting to `80`.'
    );
    expect(releaseSource).toContain(
      "iOS `metadata: 'safe'` and `metadata: 'strip'` are accepted"
    );
    expect(releaseSource).toContain(
      "iOS `metadata: 'preserve'` and `output.maxBytes` reject with `ERR_NOT_IMPLEMENTED`."
    );
    expect(releaseSource).toContain(
      "iOS `getImageCompressionCapabilities()` reports `metadataPolicies: ['safe', 'strip']`"
    );
    expect(releaseSource).toContain(
      'README iOS support matrix, public API guidance, roadmap, installation status, and release dry-run wording updates.'
    );
    expect(releaseSource).toContain(
      'Focused TypeScript and source-level native foundation test expectation updates for the `0.2.0` release.'
    );
    expect(releaseSource).toContain(
      'npm package publication under the `latest` dist-tag.'
    );
    expect(releaseSource).toContain(
      'Git tag `v0.2.0` and GitHub Release `v0.2.0`.'
    );
    expect(releaseSource).toContain('Android runtime behavior changes.');
    expect(releaseSource).toContain(
      'HEIC / HEIF / AVIF / GIF / WebP input on iOS.'
    );
    expect(releaseSource).toContain('iOS target-size compression.');
    expect(releaseSource).toContain('iOS metadata preservation.');
    expect(releaseSource).toContain('### Published Artifacts');
    expect(releaseSource).toContain(
      'npm package: `react-native-image-compression-kit@0.2.0`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-YUsh/bwcU/ScsWu5RGQT/CEZaQ6dL9xCgoYfHOHalJkEeWicv9lT7HqEGhle84EUTLL8a8T3vefw+fso7kPj6Q==`'
    );
    expect(releaseSource).toContain('Git tag: `v0.2.0`');
    expect(releaseSource).toContain(
      'GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.0`'
    );
    expect(releaseSource).toContain(
      'Published tarball size: 41.1 kB package size, 176.1 kB unpacked size, 49 files.'
    );
    expect(releaseSource).toContain(
      'The `v0.2.0` release completed these checks before npm publish'
    );
    expect(releaseSource).toContain('pnpm pack --dry-run');
    expect(releaseSource).toContain(
      'native smoke test that links the pod and compresses a JPEG and PNG source to'
    );
    expect(releaseSource).toContain(
      'Actual iOS host-app validation result for the implementation candidate:'
    );
    expect(releaseSource).toContain(
      'GitHub Actions iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28424614173>.'
    );
    expect(releaseSource).toContain(
      'Runtime smoke evidence: `RNICK_IOS_SMOKE_PASS` with `jpegResultBytes: 946`, `pngResultBytes: 1034`'
    );
    expect(releaseSource).toContain(
      "unsupportedInputs: ['webp', 'heic', 'heif', 'avif', 'gif']"
    );
    expect(releaseSource).toContain('### Publish Commands');
    expect(releaseSource).toContain('pnpm publish --tag latest');
    expect(releaseSource).toContain(
      'npm pack react-native-image-compression-kit@0.2.0'
    );
    expect(releaseSource).toContain('### Post-publish Verification');
    expect(releaseSource).toContain(
      '`pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.0`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.2.0`');
    expect(releaseSource).toContain(
      'publish timestamp `2026-06-30T07:04:03.022Z`'
    );
    expect(releaseSource).toContain(
      'shasum `850a32e69d3c398e58b129ea330bc3d5a27eb5fd`'
    );
    expect(releaseSource).toContain(
      'fresh temporary consumer project installed `react-native-image-compression-kit@0.2.0`'
    );
    expect(releaseSource).toContain(
      'GitHub Release `v0.2.0` was created at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.0`.'
    );
    expect(releaseSource).toContain('## v0.1.2');
    expect(releaseSource).toContain(
      'Status: published to npm on June 30, 2026 at 02:18:30 UTC (11:18:30 KST), tagged as `v0.1.2`.'
    );
    expect(releaseSource).toContain(
      'This patch keeps Android runtime behavior unchanged'
    );
    expect(releaseSource).toContain(
      'Clarify that iOS ships a native package stub and iOS compression is not implemented.'
    );
    expect(releaseSource).toContain(
      'Preserve a stable iOS `ERR_NOT_IMPLEMENTED` compression failure'
    );
    expect(releaseSource).toContain(
      'Make iOS capability reporting show no supported input formats, output formats, metadata policies, target-size compression, or cancellation.'
    );
    expect(releaseSource).toContain(
      'Update the TypeScript native-unavailable message'
    );
    expect(releaseSource).toContain(
      'Publish package metadata for `0.1.2` after the release candidate passed local and GitHub Actions validation.'
    );
    expect(releaseSource).toContain('### Published Artifacts');
    expect(releaseSource).toContain(
      'npm package: `react-native-image-compression-kit@0.1.2`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-OOHIV4Lnmu+16/W8iGMZriiYXLbB9nIVV0vBz4dd3erW3meaSqV28JkWpc/5FetIz0HcLU/4Pfgq8eTZ8fIY6g==`'
    );
    expect(releaseSource).toContain('Git tag: `v0.1.2`');
    expect(releaseSource).toContain(
      'GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.2`'
    );
    expect(releaseSource).toContain(
      'Published tarball size: 35.3 kB package size, 146.8 kB unpacked size, 49 files.'
    );
    expect(releaseSource).toContain(
      'iOS stub `compressImage()` error message aligned to the package-stub state.'
    );
    expect(releaseSource).toContain(
      'iOS `getImageCompressionCapabilities()` reports `metadataPolicies: []`'
    );
    expect(releaseSource).toContain(
      'TypeScript `ERR_NATIVE_MODULE_UNAVAILABLE` message distinguishes install/linking failure'
    );
    expect(releaseSource).toContain(
      'README iOS stub behavior guidance and release dry-run wording updates.'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.1.2`.'
    );
    expect(releaseSource).toContain(
      'Focused test and Android verification doctor expectation updates for the `0.1.2` release.'
    );
    expect(releaseSource).toContain('iOS compression implementation.');
    expect(releaseSource).toContain('Android runtime behavior changes.');
    expect(releaseSource).toContain('git tag -a v0.1.2 -m "v0.1.2"');
    expect(releaseSource).toContain('git push origin v0.1.2');
    expect(releaseSource).toContain(
      'npm pack react-native-image-compression-kit@0.1.2'
    );
    expect(releaseSource).toContain('### Post-publish Verification');
    expect(releaseSource).toContain(
      '`npm publish --tag latest` published `react-native-image-compression-kit@0.1.2`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.1.2`');
    expect(releaseSource).toContain(
      'publish timestamp `2026-06-30T02:18:30.591Z`'
    );
    expect(releaseSource).toContain(
      'The published tarball includes the README, iOS native stub, built JS'
    );
    expect(releaseSource).toContain(
      'Published tarball inspection confirmed the iOS `ERR_NOT_IMPLEMENTED` message'
    );
    expect(releaseSource).toContain(
      'fresh temporary consumer project installed `react-native-image-compression-kit@0.1.2`'
    );
    expect(releaseSource).toContain(
      'GitHub Release `v0.1.2` was created at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.2`.'
    );
    expect(releaseSource).toContain('## v0.1.1');
    expect(releaseSource).toContain(
      'Status: prepared for a docs-only npm patch release.'
    );
    expect(releaseSource).toContain(
      'This patch corrects the README content that appears on the npm package page'
    );
    expect(releaseSource).toContain('Android MVP is published');
    expect(releaseSource).toContain('iOS remains a');
    expect(releaseSource).toContain(
      'package stub and iOS compression is not implemented'
    );
    expect(releaseSource).toContain(
      'Remove stale README wording that said the package had not been published to npm.'
    );
    expect(releaseSource).toContain(
      'Replace React Native and TypeScript badge values'
    );
    expect(releaseSource).toContain('Bump package metadata to `0.1.1`');
    expect(releaseSource).toContain(
      'README status, badges, public API wording, installation wording, and release checklist wording updates.'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.1.1`.'
    );
    expect(releaseSource).toContain('Android runtime behavior changes.');
    expect(releaseSource).toContain('npm publish, git tag creation, or git push.');
    expect(releaseSource).toContain('git tag -a v0.1.1 -m "v0.1.1"');
    expect(releaseSource).toContain('git push origin v0.1.1');
    expect(releaseSource).toContain(
      'npm pack react-native-image-compression-kit@0.1.1'
    );
    expect(releaseSource).toContain('### Post-publish Verification');
    expect(releaseSource).toContain(
      '`pnpm publish --no-git-checks` published `react-native-image-compression-kit@0.1.1`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.1.1`');
    expect(releaseSource).toContain(
      'publish timestamp `2026-06-29T07:18:19.684Z`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-pnLxeyn/JVKykGbOKrS9GYoU+pKr/oq4nffdHPn97ycjOw//RD6Yd6BGUPNuRcVoqnS17QsYgGx2c5JXWQq4BA==`'
    );
    expect(releaseSource).toContain(
      '49 files, 35.1 kB package size, and 144.8 kB unpacked size'
    );
    expect(releaseSource).toContain(
      'corrected README status, Android MVP published badge, Android MVP / iOS stub platform badge'
    );
    expect(releaseSource).toContain(
      'Published README verification found no stale'
    );
    expect(releaseSource).toContain(
      'fresh temporary consumer project installed `react-native-image-compression-kit@0.1.1`'
    );
    expect(releaseSource).toContain('## v0.1.0');
    expect(releaseSource).toContain(
      'Status: published to npm on June 27, 2026 at 10:51:55 UTC (19:51:55 KST), tagged as `v0.1.0`.'
    );
    expect(releaseSource).toContain('published as');
    expect(releaseSource).toContain('### Published Artifacts');
    expect(releaseSource).toContain(
      'npm package: `react-native-image-compression-kit@0.1.0`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-W8kaa3eKdWVLHCGeApdOqNMfeD7np42OcgjGCUZAQDZqzx86diybRtEqK+MJtX73Yt4wLcVKOtb62sPtLJLk9g==`'
    );
    expect(releaseSource).toContain(
      'GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.0`'
    );
    expect(releaseSource).toContain(
      'Published tarball size: 34.2 kB package size, 142.2 kB unpacked size, 48 files.'
    );
    expect(releaseSource).toContain('Android MVP only');
    expect(releaseSource).toContain('file://` and `content://');
    expect(releaseSource).toContain(
      'JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input'
    );
    expect(releaseSource).toContain(
      'GIF input is decoded as a static first frame'
    );
    expect(releaseSource).toContain('HEIC / HEIF input is SDK-gated');
    expect(releaseSource).toContain('Android 14+ AVIF input');
    expect(releaseSource).toContain('JPEG, PNG, and WebP output');
    expect(releaseSource).toContain(
      'Target-size compression with maxBytes for JPEG and WebP output'
    );
    expect(releaseSource).toContain(
      'Metadata policies preserve, safe, and strip'
    );
    expect(releaseSource).toContain('iOS compression is not implemented');
    expect(releaseSource).toContain('AVIF output is not implemented');
    expect(releaseSource).toContain('HEIC / HEIF output is not implemented');
    expect(releaseSource).toContain(
      'GIF output and animation preservation are not implemented'
    );
    expect(releaseSource).toContain('### Release Checklist');
    expect(releaseSource).toContain('git status --short --branch');
    expect(releaseSource).toContain('pnpm release:dry-run');
    expect(releaseSource).toContain('GitHub Actions CI success');
    expect(releaseSource).toContain('git tag -a v0.1.0 -m "v0.1.0"');
    expect(releaseSource).toContain('git push origin v0.1.0');
    expect(releaseSource).toContain('### Publish Commands');
    expect(releaseSource).toContain(
      'pnpm login --registry=https://registry.npmjs.org/'
    );
    expect(releaseSource).toContain('pnpm whoami');
    expect(releaseSource).toContain('pnpm publish --otp 123456');
    expect(releaseSource).toContain(
      'pnpm view react-native-image-compression-kit version dist.integrity'
    );
    expect(releaseSource).toContain('### Post-publish Security Review');
    expect(releaseSource).toContain(
      'contains no `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, `postpack`, `publish`, or `postpublish` lifecycle scripts'
    );
    expect(releaseSource).toContain(
      'forbidden-file scan found no `.env*`, `.npmrc`, key files, debug keystore, Android test directories, example app files, or repository scripts'
    );
    expect(releaseSource).toContain(
      '`pnpm audit --prod` reported no known vulnerabilities'
    );
    expect(releaseSource).toContain('### External Install Smoke');
    expect(releaseSource).toContain(
      'Installed `react-native-image-compression-kit@0.1.0` from the npm registry with `pnpm install --ignore-scripts`'
    );
    expect(releaseSource).toContain(
      'Confirmed dependency resolution with `pnpm list react-native-image-compression-kit react-native react --depth 0`'
    );
    expect(releaseSource).toContain(
      'Typechecked imports for `compressImage`, `getImageCompressionCapabilities`, `ImageCompressionKitError`, `CompressionOptions`, `CompressionResult`, and `ImageCompressionCapabilities`'
    );
    expect(releaseSource).toContain(
      '`pnpm typecheck` completed successfully in the external consumer project'
    );
    expect(releaseSource).toContain(
      'The GitHub Release was created from this note'
    );
    expect(releaseSource).toContain(
      'gh release create v0.1.0 --title "v0.1.0" --notes-file RELEASE.md'
    );
    expect(readmeSource).toContain(
      'See [RELEASE.md](RELEASE.md) for the v0.2.0 published release notes, v0.1.2 published patch notes, v0.1.1 docs-only patch notes, v0.1.0 published artifact details, tag checklist, and post-publish security review.'
    );
    expect(readmeSource).toContain('reviewed release notes');
    expect(readmeSource).toContain(
      'Tag, npm publish, and post-publish security review commands are documented in `RELEASE.md`'
    );
  });

  it('documents security policy and package hygiene expectations', () => {
    const securitySource = readProjectFile('SECURITY.md');
    const readmeSource = readProjectFile('README.md');

    expect(securitySource).toContain('# Security Policy');
    expect(securitySource).toContain('| 0.2.x | Yes |');
    expect(securitySource).toContain('| 0.1.x | No |');
    expect(securitySource).toContain(
      'Please do not include exploit details, secrets, private keys, or sensitive'
    );
    expect(securitySource).toContain(
      'The npm package is intended to avoid install-time code execution.'
    );
    expect(securitySource).toContain(
      '`preinstall`, `install`, `postinstall`, `prepare`'
    );
    expect(securitySource).toContain(
      'Development-only scripts, tests,'
    );
    expect(securitySource).toContain(
      'fixtures, example apps, build directories, credentials, `.npmrc`, `.env*`, keys,'
    );
    expect(securitySource).toContain('## Dependency Triage');
    expect(securitySource).toContain('dependency as npm runtime');
    expect(securitySource).toContain('validation toolchain');
    expect(securitySource).toContain(
      'The `example/Gemfile` Ruby dependencies are used for local and GitHub Actions'
    );
    expect(securitySource).toContain('Ruby 3.1 or newer');
    expect(securitySource).toContain('pins ActiveSupport');
    expect(securitySource).toContain('Concurrent Ruby to patched minimum versions');
    expect(securitySource).toContain(
      '### v0.2.0 Post-Release Alert Classification'
    );
    expect(securitySource).toContain('no npm runtime advisories from');
    expect(securitySource).toContain('Alerts #2, #3, and #4');
    expect(securitySource).toContain('activesupport >= 7.2.3.1');
    expect(securitySource).toContain('Alerts #5, #6, and #7');
    expect(securitySource).toContain('concurrent-ruby >= 1.3.7');
    expect(securitySource).toContain('pnpm release:dry-run');
    expect(securitySource).toContain('pnpm audit --prod');
    expect(securitySource).toContain(
      'npm pack react-native-image-compression-kit@<version>'
    );
    expect(readmeSource).toContain('## Security');
    expect(readmeSource).toContain(
      'See [SECURITY.md](SECURITY.md) for supported versions, vulnerability reporting guidance, dependency triage, and package security hygiene.'
    );
    expect(readmeSource).toContain(
      'Published packages should not run install-time lifecycle scripts'
    );
  });

  it('keeps GitHub Actions on Node 24 runtime-compatible action majors', () => {
    const ciWorkflowSource = readProjectFile('.github/workflows/ci.yml');
    const instrumentationWorkflowSource = readProjectFile(
      '.github/workflows/android-instrumentation.yml'
    );
    const readmeSource = readProjectFile('README.md');
    const expectedActions = [
      'uses: actions/checkout@v7',
      'uses: actions/setup-java@v5',
      'uses: android-actions/setup-android@v4',
      'uses: pnpm/action-setup@v6',
      'uses: actions/setup-node@v6',
      'uses: gradle/actions/setup-gradle@v6',
    ];
    const deprecatedActions = [
      'uses: actions/checkout@v4',
      'uses: actions/setup-java@v4',
      'uses: android-actions/setup-android@v3',
      'uses: pnpm/action-setup@v4',
      'uses: actions/setup-node@v4',
      'uses: gradle/actions/setup-gradle@v4',
    ];

    for (const action of expectedActions) {
      expect(ciWorkflowSource).toContain(action);
      expect(instrumentationWorkflowSource).toContain(action);
    }

    for (const action of deprecatedActions) {
      expect(ciWorkflowSource).not.toContain(action);
      expect(instrumentationWorkflowSource).not.toContain(action);
    }

    expect(instrumentationWorkflowSource).toContain(
      'uses: reactivecircus/android-emulator-runner@v2'
    );
    expect(readmeSource).toContain('Node 24 runtime-compatible majors');
    expect(readmeSource).toContain('`actions/checkout@v7`');
    expect(readmeSource).toContain('`actions/setup-node@v6`');
    expect(readmeSource).toContain('`actions/setup-java@v5`');
    expect(readmeSource).toContain('`android-actions/setup-android@v4`');
    expect(readmeSource).toContain('`pnpm/action-setup@v6`');
    expect(readmeSource).toContain('`gradle/actions/setup-gradle@v6`');
  });

  it('documents the HEIC, HEIF, and AVIF real codec sample validation strategy', () => {
    const readmeSource = readProjectFile('README.md');
    const verificationSource = readProjectFile('scripts/android-verification.mjs');

    expect(readmeSource).toContain('## HEIC / HEIF / AVIF Codec Sample Validation Strategy');
    expect(readmeSource).toContain(
      'This repository now commits tiny HEIC / HEIF / AVIF samples generated from repo-owned PNG sources.'
    );
    expect(readmeSource).toContain('Use `android/src/test/assets/heic-heif/source.png`');
    expect(readmeSource).toContain('Track source and generated output metadata');
    expect(readmeSource).toContain('`android/src/test/assets/heic-heif/manifest.json`');
    expect(readmeSource).toContain('committed sample files');
    expect(readmeSource).toContain('`pnpm fixtures:heic-heif:check`');
    expect(readmeSource).toContain('`pnpm fixtures:heic-heif`');
    expect(readmeSource).toContain(
      'heif-enc --quality 80 source.png -o sample.heic'
    );
    expect(readmeSource).toContain('`pnpm fixtures:avif:check`');
    expect(readmeSource).toContain('`pnpm fixtures:avif`');
    expect(readmeSource).toContain(
      'heif-enc --quality 80 --avif source.png -o sample.avif'
    );
    expect(readmeSource).toContain('Generated fixtures are committed because they are tiny');
    expect(readmeSource).toContain('android/src/test/assets/heic-heif/');
    expect(readmeSource).toContain(
      'They verify the fixture files and metadata, but they do not boot an emulator.'
    );
    expect(readmeSource).toContain(
      'A separate Android Instrumentation workflow enables KVM permissions, boots an API 35 Google APIs emulator with an extended boot timeout'
    );
    expect(readmeSource).toContain('`pnpm example:android-instrumentation`');
    expect(readmeSource).toContain(
      'committed `sample.heic`, `sample.heif`, and `sample.avif` fixtures through their `ImageDecoder` routes'
    );
    expect(readmeSource).toContain(
      'Manual codec validation beyond CI should use a codec-backed Android device or emulator'
    );
    expect(readmeSource).toContain(
      'file:///data/data/com.imagecompressionkit.example/files/rnick-codec/sample.heic'
    );
    expect(readmeSource).toContain(
      'API 26-27 should still be checked separately for the guarded `BitmapFactory` fallback'
    );
    expect(readmeSource).toContain(
      'For AVIF manual validation, use an API 34+ device or emulator'
    );
    expect(verificationSource).toContain('checkHeicHeifCodecSampleStrategy');
  });

  it('wires HEIC, HEIF, and AVIF emulator instrumentation validation', () => {
    const gradleSource = readProjectFile('android/build.gradle');
    const instrumentationSource = readProjectFile(
      'android/src/androidTest/java/com/imagecompressionkit/ImageCompressionKitHeicHeifInstrumentationTest.kt'
    );
    const workflowSource = readProjectFile('.github/workflows/android-instrumentation.yml');
    const verificationSource = readProjectFile('scripts/android-verification.mjs');

    expect(gradleSource).toContain(
      'testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"'
    );
    expect(gradleSource).toContain('androidTest.assets.srcDirs += ["src/test/assets"]');
    expect(gradleSource).toContain(
      'androidTestImplementation "androidx.test.ext:junit:1.2.1"'
    );
    expect(instrumentationSource).toContain(
      'compressesCommittedHeicHeifAndAvifSamplesToJpegPngAndWebp'
    );
    expect(instrumentationSource).toContain(
      'Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE'
    );
    expect(instrumentationSource).toContain('heic-heif/sample.heic');
    expect(instrumentationSource).toContain('heic-heif/sample.heif');
    expect(instrumentationSource).toContain('avif/sample.avif');
    expect(instrumentationSource).toContain('ImageCompressionKitModule(');
    expect(instrumentationSource).toContain('JavaOnlyMap.of');
    expect(instrumentationSource).toContain('OutputCase("jpeg", ::assertJpegSignature)');
    expect(instrumentationSource).toContain('OutputCase("png", ::assertPngSignature)');
    expect(instrumentationSource).toContain('OutputCase("webp", ::assertWebpSignature)');
    expect(instrumentationSource).toContain(
      'assertBitmapDimensions(outputFile, width = 16, height = 12)'
    );
    expect(workflowSource).toContain('name: Android Instrumentation');
    expect(workflowSource).toContain('HEIC/HEIF/AVIF emulator validation');
    expect(workflowSource).toContain('Enable KVM group permissions');
    expect(workflowSource).toContain('reactivecircus/android-emulator-runner@v2');
    expect(workflowSource).toContain('api-level: 35');
    expect(workflowSource).toContain('target: google_apis');
    expect(workflowSource).toContain('emulator-boot-timeout: 1200');
    expect(workflowSource).toContain('script: pnpm example:android-instrumentation');
    expect(verificationSource).toContain('checkHeicHeifInstrumentationValidation');
  });

  it('defines the AVIF source fixture manifest and committed sample', () => {
    const manifest = JSON.parse(readProjectFile('android/src/test/assets/avif/manifest.json'));
    const sourceBytes = readProjectBinary(manifest.source.path);
    const sourceDimensions = readPngDimensions(sourceBytes);
    const fixture = manifest.generatedFixtures[0];
    const fixtureBytes = readProjectBinary(fixture.targetPath);
    const generatorSource = readProjectFile('scripts/generate-avif-fixtures.mjs');

    expect(packageJson.scripts['fixtures:avif']).toBe(
      'node scripts/generate-avif-fixtures.mjs'
    );
    expect(packageJson.scripts['fixtures:avif:check']).toBe(
      'node scripts/generate-avif-fixtures.mjs --check'
    );
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.description).toContain('AVIF fixture');
    expect(manifest.source).toMatchObject({
      path: 'android/src/test/assets/avif/source.png',
      format: 'png',
      byteSize: sourceBytes.length,
      sha256: sha256(sourceBytes),
      dimensions: sourceDimensions,
    });
    expect(fixture).toMatchObject({
      format: 'avif',
      sourcePath: manifest.source.path,
      targetPath: 'android/src/test/assets/avif/sample.avif',
      byteSize: fixtureBytes.length,
      sha256: sha256(fixtureBytes),
      provenance: {
        generator: 'libheif heif-enc',
        generatorVersion: '1.23.0',
        source: 'repo-owned source.png',
        license: 'MIT',
        status: 'committed fixture generated from repo-owned source',
      },
    });
    expect(fixture.generationCommand).toContain(
      'heif-enc --quality 80 --avif source.png -o sample.avif'
    );
    expect(manifest.validation.runtimeStatus).toContain('API 34+ emulator instrumentation');
    expect(generatorSource).toContain('--avif');
    expect(generatorSource).toContain('validateCommittedFixture');
    expect(generatorSource).toContain('AVIF fixture manifest OK');
  });

  it('defines the HEIC and HEIF source fixture manifest and committed samples', () => {
    const manifest = JSON.parse(
      readProjectFile('android/src/test/assets/heic-heif/manifest.json')
    );
    const sourceBytes = readProjectBinary(manifest.source.path);
    const sourceDimensions = readPngDimensions(sourceBytes);
    const generatorSource = readProjectFile('scripts/generate-heic-heif-fixtures.mjs');

    expect(packageJson.scripts['fixtures:heic-heif']).toBe(
      'node scripts/generate-heic-heif-fixtures.mjs'
    );
    expect(packageJson.scripts['fixtures:heic-heif:check']).toBe(
      'node scripts/generate-heic-heif-fixtures.mjs --check'
    );
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.source).toMatchObject({
      path: 'android/src/test/assets/heic-heif/source.png',
      format: 'png',
      byteSize: sourceBytes.length,
      sha256: sha256(sourceBytes),
      dimensions: sourceDimensions,
    });
    expect(manifest.source.provenance).toMatchObject({
      owner: 'react-native-image-compression-kit',
      license: 'MIT',
    });
    expect(manifest.description).toContain('committed samples');
    expect(manifest.generatedFixtures.map((fixture: { format: string }) => fixture.format)).toEqual([
      'heic',
      'heif',
    ]);
    manifest.generatedFixtures.forEach(
      (fixture: {
        format: string;
        sourcePath: string;
        targetPath: string;
        generationCommand: string;
        byteSize: number;
        sha256: string;
        provenance: {
          generator: string;
          generatorVersion: string;
          source: string;
          license: string;
          status: string;
        };
      }) => {
        const fixtureBytes = readProjectBinary(fixture.targetPath);

        expect(fixture.sourcePath).toBe(manifest.source.path);
        expect(fixture.targetPath).toBe(
          `android/src/test/assets/heic-heif/sample.${fixture.format}`
        );
        expect(fixture.generationCommand).toContain(
          `heif-enc --quality 80 source.png -o sample.${fixture.format}`
        );
        expect(fixture.byteSize).toBe(fixtureBytes.length);
        expect(fixture.sha256).toBe(sha256(fixtureBytes));
        expect(fixture.provenance).toMatchObject({
          generator: 'libheif heif-enc',
          generatorVersion: '1.23.0',
          source: 'repo-owned source.png',
          license: 'MIT',
          status: 'committed fixture generated from repo-owned source',
        });
      }
    );
    expect(manifest.validation.runtimeStatus).toContain('binary fixtures are committed');
    expect(generatorSource).toContain('heif-enc');
    expect(generatorSource).toContain('CHECK_ONLY');
    expect(generatorSource).toContain('readPngDimensions');
    expect(generatorSource).toContain('validateCommittedFixture');
    expect(generatorSource).toContain(
      'byteSize must be recorded for committed binary fixtures'
    );
  });

  it('verifies the Android module supports file and content JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF sources', () => {
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );

    expect(moduleSource).toContain('"file" ->');
    expect(moduleSource).toContain('"content" ->');
    expect(moduleSource).toContain('reactContext.contentResolver.openInputStream');
    expect(moduleSource).toContain('OpenableColumns.SIZE');
    expect(moduleSource).toContain('BitmapFactory.decodeStream');
    expect(moduleSource).toContain('ImageDecoder.decodeBitmap');
    expect(moduleSource).toContain('createImageDecoderSource(inputSource)');
    expect(moduleSource).toContain('decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE');
    expect(moduleSource).toContain('InputFormat.fromMimeType(bounds?.mimeType) ?: inputFormatHint');
    expect(moduleSource).toContain('readInputFormatHint(inputSource)');
    expect(moduleSource).toContain('readUnsupportedInputMimeTypeHint(inputSource)');
    expect(moduleSource).toContain('queryContentMimeType(inputSource.uri)');
    expect(moduleSource).toContain('usesAvifDecodePath');
    expect(moduleSource).toContain('InputFormat.fromFileExtension(fileExtension)');
    expect(moduleSource).toContain('Build.VERSION.SDK_INT >= Build.VERSION_CODES.P');
    expect(moduleSource).toContain('Build.VERSION.SDK_INT >= Build.VERSION_CODES.O');
    expect(moduleSource).toContain('Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE');
    expect(moduleSource).toContain('decodeHeicHeifBitmapWithImageDecoder');
    expect(moduleSource).toContain('decodeAvifBitmapWithImageDecoder');
    expect(moduleSource).toContain('decodeBitmapFactory(inputSource)');
    expect(moduleSource).toContain('mimeType = "image/jpeg"');
    expect(moduleSource).toContain('mimeType = "image/png"');
    expect(moduleSource).toContain('mimeType = "image/webp"');
    expect(moduleSource).toContain('mimeType = "image/heic"');
    expect(moduleSource).toContain('mimeType = "image/heif"');
    expect(moduleSource).toContain('mimeType = "image/avif"');
    expect(moduleSource).toContain('mimeType = "image/gif"');
    expect(moduleSource).toContain(
      'Android MVP supports JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input only.'
    );
    expect(moduleSource).toContain('createCompressionResult(');
    expect(moduleSource).toContain('outputFormat');
    expect(moduleSource).not.toContain('BitmapFactory.decodeFile');
  });

  it('verifies the iOS native module implements the JPEG MVP path', () => {
    const iosSource = readProjectFile('ios/RCTImageCompressionKit.mm');
    const podspecSource = readProjectFile(
      'react-native-image-compression-kit.podspec'
    );

    expect(iosSource).toContain('#import <ImageIO/ImageIO.h>');
    expect(iosSource).toContain('#import <UIKit/UIKit.h>');
    expect(iosSource).toContain(
      'RCTImageCompressionKitUnsupportedFormatCode = @"ERR_UNSUPPORTED_FORMAT"'
    );
    expect(iosSource).toContain(
      'RCTImageCompressionKitNotImplementedCode = @"ERR_NOT_IMPLEMENTED"'
    );
    expect(iosSource).toContain('RCTImageCompressionKitJpegFormat = @"jpeg"');
    expect(iosSource).toContain('RCTImageCompressionKitPngFormat = @"png"');
    expect(iosSource).toContain(
      'RCTImageCompressionKitDefaultMetadataPolicy = @"safe"'
    );
    expect(iosSource).toContain(
      'RCTImageCompressionKitStripMetadataPolicy = @"strip"'
    );
    expect(iosSource).toContain(
      'RCTImageCompressionKitPreserveMetadataPolicy = @"preserve"'
    );
    expect(iosSource).toContain(
      'iOS MVP supports JPEG input and JPEG output through UIKit/ImageIO.'
    );
    expect(iosSource).toContain(
      'iOS MVP supports PNG input with JPEG output conversion.'
    );
    expect(iosSource).toContain(
      'iOS MVP supports JPEG and PNG input with JPEG output only.'
    );
    expect(iosSource).toContain(
      'iOS MVP supports JPEG output only. Call getImageCompressionCapabilities() before selecting a platform output format.'
    );
    expect(iosSource).toContain('RCTImageCompressionKitReadMaxBytes');
    expect(iosSource).toContain(
      'Compression output.maxBytes must be a positive integer.'
    );
    expect(iosSource).toContain('RCTImageCompressionKitEncodeJpegToTargetSize');
    expect(iosSource).toContain('bestWithinTargetData');
    expect(iosSource).toContain(
      'iOS MVP does not support metadata preserve yet. Use safe or strip metadata on iOS.'
    );
    expect(iosSource).toContain(
      'Compression output.quality must be an integer from 0 to 100.'
    );
    expect(iosSource).toContain(
      'Compression resize.mode must be one of: contain, cover, stretch.'
    );
    expect(iosSource).toContain(
      'iOS MVP supports file:// and content:// image URIs only.'
    );
    expect(iosSource).toContain('iOS MVP could not read the source image URI.');
    expect(iosSource).toContain('iOS MVP could not decode the source image.');
    expect(iosSource).toContain('iOS MVP could not encode JPEG output.');
    expect(iosSource).toContain('CGImageSourceCreateWithData');
    expect(iosSource).toContain('UIImage imageWithData');
    expect(iosSource).toContain('UIImageJPEGRepresentation');
    expect(iosSource).toContain('UIGraphicsImageRenderer');
    expect(iosSource).toContain('NSCachesDirectory');
    expect(iosSource).toContain('RCTImageCompressionKitRenderImage');
    expect(iosSource).toContain('RCTImageCompressionKitResizeModeContain');
    expect(iosSource).toContain('RCTImageCompressionKitResizeModeCover');
    expect(iosSource).toContain('RCTImageCompressionKitResizeModeStretch');
    expect(iosSource).toContain('RCTImageCompressionKitReadSourceData');
    expect(iosSource).toContain('RCTImageCompressionKitIsSupportedInputType');
    expect(iosSource).toContain(
      '@"metadataPolicies" : @[RCTImageCompressionKitDefaultMetadataPolicy, RCTImageCompressionKitStripMetadataPolicy]'
    );
    expect(iosSource).toContain('@"supportsTargetSizeCompression" : @YES');
    expect(iosSource).toContain('@"supportsCancellation" : @NO');
    expect(podspecSource).toContain('s.platforms = { :ios => "13.4" }');
    expect(podspecSource).toContain('s.source_files = "ios/**/*.{h,m,mm}"');
  });

  it('verifies the Android module applies EXIF orientation before resize', () => {
    const gradleSource = readProjectFile('android/build.gradle');
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );

    expect(gradleSource).toContain(
      'androidx.exifinterface:exifinterface:1.4.2'
    );
    expect(moduleSource).toContain('readExifOrientation(inputSource)');
    expect(moduleSource).toContain('ExifInterface.TAG_ORIENTATION');
    expect(moduleSource).toContain(
      'applyExifOrientation(bitmap, exifOrientation)'
    );
    expect(
      moduleSource.indexOf('applyExifOrientation(bitmap, exifOrientation)')
    ).toBeLessThan(moduleSource.indexOf('resizeBitmap(orientedBitmap, resize)'));
    expect(moduleSource).toContain('Matrix');
    expect(moduleSource).toContain('ExifInterface.ORIENTATION_ROTATE_90');
    expect(moduleSource).toContain('ExifInterface.ORIENTATION_TRANSVERSE');
    expect(moduleSource).toContain('ExifInterface.ORIENTATION_NORMAL');
  });

  it('verifies the Android module implements JPEG resize modes', () => {
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );

    expect(moduleSource).toContain('readResizeOptions');
    expect(moduleSource).toContain('resizeBitmap(orientedBitmap, resize)');
    expect(moduleSource).toContain('ResizeMode.CONTAIN');
    expect(moduleSource).toContain('ResizeMode.COVER');
    expect(moduleSource).toContain('ResizeMode.STRETCH');
    expect(moduleSource).toContain('Bitmap.createScaledBitmap');
    expect(moduleSource).toContain('centerCropBitmap');
    expect(moduleSource).toContain('outputDimensions');
    expect(moduleSource).not.toContain('does not implement resize yet');
  });

  it('verifies the Android module implements JPEG target-size compression', () => {
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );
    const outputSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionOutput.kt'
    );
    const combinedSource = `${moduleSource}\n${outputSource}`;

    expect(moduleSource).toContain('readMaxBytes(output)');
    expect(moduleSource).toContain('output.maxBytes must be a positive integer');
    expect(moduleSource).toContain('didEncode = ImageCompressionOutput.encodeBitmap(');
    expect(moduleSource).toContain('maxBytes,');
    expect(moduleSource).toContain('copiedExifMetadata');
    expect(combinedSource).toContain('encodeBitmapToTargetSize');
    expect(combinedSource).toContain('bestWithinTargetQuality');
    expect(moduleSource).toContain('supportsTargetSizeCompression", true');
    expect(combinedSource).toContain(
      'supports output.maxBytes for JPEG and WebP output only'
    );
    expect(moduleSource).not.toContain('does not implement target-size compression yet');
  });

  it('verifies the Android module implements PNG and WebP output encoding', () => {
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );
    const outputSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionOutput.kt'
    );
    const combinedSource = `${moduleSource}\n${outputSource}`;

    expect(combinedSource).toContain('ImageCompressionOutput.createOutputFile');
    expect(combinedSource).toContain('ImageCompressionOutput.createResultMetadata');
    expect(combinedSource).toContain('ImageCompressionOutput.maxBytesValidationError');
    expect(combinedSource).toContain('OutputFormat.fromValue');
    expect(combinedSource).toContain('PNG_FORMAT');
    expect(combinedSource).toContain('WEBP_FORMAT');
    expect(combinedSource).toContain('Bitmap.CompressFormat.PNG');
    expect(combinedSource).toContain('Bitmap.CompressFormat.WEBP_LOSSY');
    expect(combinedSource).toContain('Bitmap.CompressFormat.WEBP');
    expect(combinedSource).toContain('outputFormat.fileExtension');
    expect(combinedSource).toContain('format = outputFormat.value');
    expect(combinedSource).toContain('pngFormatNotes');
    expect(combinedSource).toContain('webpFormatNotes');
    expect(combinedSource).toContain('gifFormatNotes');
    expect(combinedSource).toContain('heicHeifFormatNotes');
    expect(combinedSource).toContain('avifFormatNotes');
    expect(combinedSource).toContain('SUPPORTED_INPUT_FORMATS');
    expect(combinedSource).toContain('HEIC_FORMAT');
    expect(combinedSource).toContain('HEIF_FORMAT');
    expect(combinedSource).toContain('AVIF_FORMAT');
    expect(combinedSource).toContain('output = outputFormat != null');
    expect(combinedSource).toContain('Non-JPEG output does not preserve source EXIF metadata.');
    expect(combinedSource).toContain(
      'supports JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input with JPEG, PNG, and WebP output only'
    );
    expect(combinedSource).not.toContain('PNG and WebP input remain planned.');
  });

  it('verifies the Android module handles JPEG metadata policies explicitly', () => {
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );
    const metadataSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/JpegExifMetadata.kt'
    );
    const outputSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionOutput.kt'
    );
    const combinedSource = `${moduleSource}\n${metadataSource}\n${outputSource}`;

    expect(combinedSource).toContain('readMetadataPolicy(options)');
    expect(combinedSource).toContain('MetadataPolicy.SAFE');
    expect(combinedSource).toContain('MetadataPolicy.STRIP');
    expect(combinedSource).toContain('MetadataPolicy.PRESERVE');
    expect(combinedSource).toContain('createCopiedExifMetadata');
    expect(combinedSource).toContain('JpegExifMetadata.read');
    expect(combinedSource).toContain('JpegExifMetadata.write');
    expect(combinedSource).toContain('SAFE_EXIF_TAGS');
    expect(combinedSource).toContain('PRESERVED_EXIF_TAGS');
    expect(combinedSource).toContain('outputExif.setAttribute(');
    expect(combinedSource).toContain('ExifInterface.TAG_ORIENTATION');
    expect(combinedSource).toContain('ExifInterface.ORIENTATION_NORMAL.toString()');
    expect(combinedSource).toContain('ExifInterface.TAG_PIXEL_X_DIMENSION');
    expect(combinedSource).toContain('ExifInterface.TAG_PIXEL_Y_DIMENSION');
    expect(combinedSource).toContain('pushString(METADATA_POLICY_PRESERVE)');
    expect(combinedSource).toContain('pushString(METADATA_POLICY_SAFE)');
    expect(combinedSource).toContain('pushString(METADATA_POLICY_STRIP)');
    expect(combinedSource).not.toContain('does not implement metadata preservation yet');
    expect(combinedSource).toContain('without preserving source metadata');
    expect(combinedSource).toContain(
      'PNG, WebP, GIF, HEIC, HEIF, and AVIF sources are decoded without copying EXIF metadata.'
    );
    expect(combinedSource).toContain('heicHeifFormatNotes("HEIC")');
    expect(combinedSource).toContain('heicHeifFormatNotes("HEIF")');
    expect(combinedSource).toContain(
      '$formatLabel input is supported on Android 8.0+ when device HEIF decode codecs are present.'
    );
    expect(combinedSource).toContain(
      'Android API 28+ uses ImageDecoder for $formatLabel input.'
    );
    expect(combinedSource).toContain(
      'Android API 26-27 attempts a guarded BitmapFactory HEIF decode fallback.'
    );
    expect(combinedSource).toContain(
      '$formatLabel inputs are decoded without copying EXIF metadata.'
    );
    expect(combinedSource).toContain('$formatLabel output is not implemented.');
    expect(combinedSource).toContain(
      'AVIF input is supported on Android 14+ for baseline still images.'
    );
    expect(combinedSource).toContain('Android API 34+ uses ImageDecoder for AVIF input.');
    expect(combinedSource).toContain('AVIF inputs are decoded without copying EXIF metadata.');
    expect(combinedSource).toContain('AVIF output is not implemented.');
    expect(combinedSource).toContain(
      'Android MVP decodes GIF file:// and content:// sources as a static first frame.'
    );
    expect(combinedSource).toContain('Animated GIF preservation is not implemented.');
    expect(combinedSource).toContain('GIF output is not implemented.');
  });

  it('verifies the Android module uses a privacy-filtered safe metadata allowlist', () => {
    const metadataSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/JpegExifMetadata.kt'
    );
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );
    const outputSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionOutput.kt'
    );
    const combinedSource = `${moduleSource}\n${outputSource}`;
    const safeExifTags = extractKotlinArray(metadataSource, 'SAFE_EXIF_TAGS');
    const preservedExifTags = extractKotlinArray(
      metadataSource,
      'PRESERVED_EXIF_TAGS'
    );

    [
      'ExifInterface.TAG_MAKE',
      'ExifInterface.TAG_MODEL',
      'ExifInterface.TAG_DATETIME_ORIGINAL',
      'ExifInterface.TAG_EXPOSURE_TIME',
      'ExifInterface.TAG_F_NUMBER',
      'ExifInterface.TAG_LENS_MODEL',
    ].forEach((tag) => {
      expect(safeExifTags).toContain(tag);
    });

    [
      'ExifInterface.TAG_GPS_LATITUDE',
      'ExifInterface.TAG_GPS_LONGITUDE',
      'ExifInterface.TAG_CAMERA_OWNER_NAME',
      'ExifInterface.TAG_BODY_SERIAL_NUMBER',
      'ExifInterface.TAG_LENS_SERIAL_NUMBER',
      'ExifInterface.TAG_MAKER_NOTE',
      'ExifInterface.TAG_USER_COMMENT',
      'ExifInterface.TAG_XMP',
    ].forEach((tag) => {
      expect(safeExifTags).not.toContain(tag);
      expect(preservedExifTags).toContain(tag);
    });

    expect(combinedSource).toContain(
      'Metadata safe copies privacy-filtered JPEG source EXIF attributes.'
    );
    expect(combinedSource).toContain(
      'Metadata safe excludes GPS/location, owner/serial, maker note, user comment, and XMP.'
    );
  });

  it('verifies the Android metadata policy runtime unit test exists', () => {
    const gradleSource = readProjectFile('android/build.gradle');
    const testSource = readProjectFile(
      'android/src/test/java/com/imagecompressionkit/JpegExifMetadataTest.kt'
    );

    expect(gradleSource).toContain('testImplementation "junit:junit:4.13.2"');
    expect(gradleSource).toContain('unitTests.returnDefaultValues = true');
    expect(gradleSource).toContain('unitTests.includeAndroidResources = true');
    expect(gradleSource).toContain(
      'testImplementation "org.robolectric:robolectric:4.16.1"'
    );
    expect(testSource).toContain(
      'safeMetadataCopiesAllowlistedExifAndFiltersSensitiveTags'
    );
    expect(testSource).toContain(
      'preserveMetadataCopiesSensitiveExifButNormalizesOutputGeometry'
    );
    expect(testSource).toContain('nullMetadataLeavesOutputExifUntouchedForStripPolicy');
    expect(testSource).toContain('Base64.getMimeDecoder().decode(SAMPLE_JPEG_BASE64)');
    expect(testSource).toContain('RobolectricTestRunner');
    expect(testSource).toContain('JpegExifMetadata.write(metadata, outputFile)');
    expect(testSource).toContain('ExifInterface.TAG_GPS_LATITUDE');
    expect(testSource).toContain('ExifInterface.ORIENTATION_NORMAL');
  });

  it('verifies the Android output format runtime unit test exists', () => {
    const testSource = readProjectFile(
      'android/src/test/java/com/imagecompressionkit/ImageCompressionOutputTest.kt'
    );

    expect(testSource).toContain(
      'outputFormatsCreateMatchingResultFormatAndFileExtensions'
    );
    expect(testSource).toContain(
      'encodedOutputsContainExpectedByteSignaturesAndResultMetadataMatchesFile'
    );
    expect(testSource).toContain(
      'capabilitiesExposeJpegPngWebpGifHeicHeifAvifInputsAndJpegPngWebpOutputsOnly'
    );
    expect(testSource).toContain('assertHeicHeifCapabilityNotes');
    expect(testSource).toContain('assertAvifCapabilityNotes');
    expect(testSource).toContain('pngRejectsMaxBytesButWebpAndJpegAllowIt');
    expect(testSource).toContain(
      'outputFormatsMapToAndroidCompressFormatsAndQualityRules'
    );
    expect(testSource).toContain('OutputFormat.JPEG to ".jpg"');
    expect(testSource).toContain('OutputFormat.PNG to ".png"');
    expect(testSource).toContain('OutputFormat.WEBP to ".webp"');
    expect(testSource).toContain('ImageCompressionOutput.encodeBitmap');
    expect(testSource).toContain('BitmapFactory.decodeByteArray');
    expect(testSource).toContain('GraphicsMode.Mode.NATIVE');
    expect(testSource).toContain('assertPngSignature');
    expect(testSource).toContain('assertWebpSignature');
    expect(testSource).toContain('"RIFF"');
    expect(testSource).toContain('"WEBP"');
    expect(testSource).toContain('Bitmap.CompressFormat.WEBP_LOSSY');
    expect(testSource).toContain('ImageCompressionOutput.MAX_BYTES_UNSUPPORTED_MESSAGE');
    expect(testSource).toContain('RobolectricTestRunner');
  });

  it('verifies the Android module-level compression integration test exists', () => {
    const testSource = readProjectFile(
      'android/src/test/java/com/imagecompressionkit/ImageCompressionKitModuleTest.kt'
    );

    expect(testSource).toContain(
      'compressImageCreatesJpegPngAndWebpOutputsWithExpectedResultMetadata'
    );
    expect(testSource).toContain('compressImageRejectsPngMaxBytesAtModuleBoundary');
    expect(testSource).toContain(
      'compressImageAppliesExifOrientationBeforeResizeModesAndNormalizesOutputExif'
    );
    expect(testSource).toContain(
      'compressImageReadsContentUriJpegLikeFileUriAndReportsMetadata'
    );
    expect(testSource).toContain(
      'compressImageRejectsUnreadableContentUriAtModuleBoundary'
    );
    expect(testSource).toContain(
      'compressImageRejectsAvifFileBeforeAndroidU'
    );
    expect(testSource).toContain(
      'compressImageRejectsAvifContentMimeBeforeAndroidU'
    );
    expect(testSource).toContain(
      'compressImageTreatsHeicAndHeifSourcesAsDecodeCandidatesOnSupportedSdk'
    );
    expect(testSource).toContain(
      'compressImageTreatsAvifSourcesAsDecodeCandidatesOnSupportedSdk'
    );
    expect(testSource).toContain('compressImageRejectsHeicAndHeifBeforeAndroidO');
    expect(testSource).toContain(
      'compressImageSeparatesSupportedFormatDecodeFailures'
    );
    expect(testSource).toContain(
      'compressImageAcceptsGifFileAndContentSourcesAsStaticFrameWithAllImplementedOutputs'
    );
    expect(testSource).toContain('compressImageResizesGifSourceAcrossModes');
    expect(testSource).toContain(
      'compressImageHonorsJpegAndWebpMaxBytesForGifSource'
    );
    expect(testSource).toContain('compressImageIgnoresMetadataPoliciesForGifSource');
    expect(testSource).toContain(
      'compressImageAcceptsPngAndWebpFileAndContentSourcesWithAllImplementedOutputs'
    );
    expect(testSource).toContain(
      'compressImageResizesPngAndWebpSourcesAcrossModes'
    );
    expect(testSource).toContain(
      'compressImageHonorsJpegAndWebpMaxBytesForPngAndWebpSources'
    );
    expect(testSource).toContain(
      'compressImageIgnoresMetadataPoliciesForPngAndWebpSources'
    );
    expect(testSource).toContain(
      'compressImageHonorsJpegAndWebpMaxBytesAndReportsFileMetadata'
    );
    expect(testSource).toContain(
      'compressImageFallsBackWhenMaxBytesIsTooSmallAndReportsConsistentMetadata'
    );
    expect(testSource).toContain('ImageCompressionKitModule(');
    expect(testSource).toContain('module.compressImage(');
    expect(testSource).toContain('JavaOnlyMap.of');
    expect(testSource).toContain('RecordingPromise');
    expect(testSource).toContain('Uri.fromFile(sourceFile).toString()');
    expect(testSource).toContain('org.robolectric.Shadows.shadowOf');
    expect(testSource).toContain('registerInputStreamSupplier');
    expect(testSource).toContain('ByteArrayInputStream');
    expect(testSource).toContain('sourceUri = contentUri.toString()');
    expect(testSource).toContain('assertResultMetadataMatchesBytes');
    expect(testSource).toContain('UnsupportedSourceCase');
    expect(testSource).toContain('TestMimeTypeContentProvider');
    expect(testSource).toContain('ShadowContentResolver.registerProviderInternal');
    expect(testSource).toContain('createSampleGifFile');
    expect(testSource).toContain('SAMPLE_GIF_BASE64');
    expect(testSource).toContain('Base64.getMimeDecoder().decode');
    expect(testSource).toContain('assertTopLeftPixelNear');
    expect(testSource).toContain('createEncodedImageFile');
    expect(testSource).toContain('SourceFormatCase');
    expect(testSource).toContain('assertNoCopiedExifMetadata');
    expect(testSource).toContain('metadataPolicies = listOf("preserve", "safe", "strip")');
    expect(testSource).toContain('ImageCompressionKitModule.ERR_FILE_ACCESS');
    expect(testSource).toContain('ExifInterface.ORIENTATION_ROTATE_90');
    expect(testSource).toContain('resizeOptions(');
    expect(testSource).toContain('mode = "contain"');
    expect(testSource).toContain('mode = "cover"');
    expect(testSource).toContain('mode = "stretch"');
    expect(testSource).toContain('metadata = "safe"');
    expect(testSource).toContain('assertNormalizedOutputExif');
    expect(testSource).toContain('ExifInterface.ORIENTATION_NORMAL');
    expect(testSource).toContain('ExifInterface.TAG_PIXEL_X_DIMENSION');
    expect(testSource).toContain('createPatternJpegFile');
    expect(testSource).toContain('calculateAchievableTargetBytes');
    expect(testSource).toContain('assertResultMetadataMatchesFile');
    expect(testSource).toContain('OutputFormat.JPEG');
    expect(testSource).toContain('OutputFormat.WEBP');
    expect(testSource).toContain('"maxBytes"');
    expect(testSource).toContain('ImageCompressionKitModule.ERR_INVALID_OPTIONS');
    expect(testSource).toContain('ImageCompressionOutput.MAX_BYTES_UNSUPPORTED_MESSAGE');
    expect(testSource).toContain('ImageCompressionKitModule.ERR_DECODE_FAILED');
    expect(testSource).toContain('Android MVP could not decode the source image.');
    expect(testSource).toContain('ERR_UNSUPPORTED_FORMAT');
    expect(testSource).toContain('GraphicsMode.Mode.NATIVE');
    expect(testSource).toContain('assertJpegSignature');
    expect(testSource).toContain('assertPngSignature');
    expect(testSource).toContain('assertWebpSignature');
    expect(testSource).toContain('assertGifSignature');
    expect(testSource).toContain('"RIFF"');
    expect(testSource).toContain('"WEBP"');
  });
});
