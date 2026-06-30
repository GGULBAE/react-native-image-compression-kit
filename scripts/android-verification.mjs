#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODE = process.argv[2] ?? 'doctor';
const APP_ANDROID_DIR_ENV = 'RNICK_ANDROID_APP_DIR';
const GRADLE_TASK_ENV = 'RNICK_ANDROID_GRADLE_TASK';

const REQUIRED_FILES = [
  'package.json',
  'RELEASE.md',
  'SECURITY.md',
  'Dockerfile',
  '.dockerignore',
  '.github/workflows/ci.yml',
  '.github/workflows/ios-validation.yml',
  'src/NativeImageCompressionKit.ts',
  'android/build.gradle',
  'android/src/main/java/com/imagecompressionkit/JpegExifMetadata.kt',
  'android/src/main/java/com/imagecompressionkit/ImageCompressionOutput.kt',
  'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt',
  'android/src/main/java/com/imagecompressionkit/ImageCompressionKitPackage.kt',
  'android/src/androidTest/java/com/imagecompressionkit/ImageCompressionKitHeicHeifInstrumentationTest.kt',
  'android/src/test/java/com/imagecompressionkit/JpegExifMetadataTest.kt',
  'android/src/test/java/com/imagecompressionkit/ImageCompressionOutputTest.kt',
  'android/src/test/java/com/imagecompressionkit/ImageCompressionKitModuleTest.kt',
  'android/src/test/assets/heic-heif/source.png',
  'android/src/test/assets/heic-heif/sample.heic',
  'android/src/test/assets/heic-heif/sample.heif',
  'android/src/test/assets/heic-heif/manifest.json',
  'android/src/test/assets/avif/source.png',
  'android/src/test/assets/avif/sample.avif',
  'android/src/test/assets/avif/manifest.json',
  '.github/workflows/android-instrumentation.yml',
  'scripts/consumer-smoke-test.mjs',
  'scripts/docker-android.mjs',
  'scripts/ios-validation.mjs',
  'scripts/generate-avif-fixtures.mjs',
  'scripts/generate-heic-heif-fixtures.mjs',
  'scripts/release-dry-run.mjs',
  'example/Gemfile',
  'example/ios/Podfile',
  'example/ios/ImageCompressionKitExample.xcodeproj/project.pbxproj',
  'example/ios/ImageCompressionKitExample/AppDelegate.swift',
  'example/ios/ImageCompressionKitExample/ExampleImageSource.m',
];

function main() {
  if (MODE === 'doctor') {
    runDoctor();
    return;
  }

  if (MODE === 'codegen') {
    runAndroidAppGradleTask('generateCodegenArtifactsFromSchema');
    return;
  }

  if (MODE === 'build') {
    runAndroidAppGradleTask(process.env[GRADLE_TASK_ENV] ?? 'assembleDebug');
    return;
  }

  fail(`Unknown android verification mode: ${MODE}`);
}

function runDoctor() {
  const checks = [
    checkRequiredFiles(),
    checkPackageMetadata(),
    checkCodegenConfig(),
    checkSpecFile(),
    checkDockerAndroidEnvironment(),
    checkPackageFiles(),
    checkConsumerSmokeTestEnvironment(),
    checkReleaseDryRunChecklist(),
    checkReleaseNotes(),
    checkSecurityPolicy(),
    checkGitHubActionRuntimeVersions(),
    checkAndroidGradleConfig(),
    checkAndroidNativeModule(),
    checkIOSNativeModule(),
    checkIOSHostAppValidation(),
    checkHeicHeifCodecSampleStrategy(),
    checkHeicHeifFixtures(),
    checkAvifFixtures(),
    checkHeicHeifInstrumentationValidation(),
  ];

  const envReport = collectEnvironmentReport();
  const hasRepoFailure = checks.some((check) => !check.ok);

  printSection('Repository checks');
  for (const check of checks) {
    printCheck(check);
  }

  printSection('Local Android build environment');
  for (const check of envReport) {
    printCheck(check);
  }

  if (hasRepoFailure) {
    fail('Android verification doctor found repository configuration issues.');
  }

  const hasEnvironmentGap = envReport.some((check) => !check.ok);

  if (hasEnvironmentGap) {
    console.log('');
    console.log(
      'Android codegen/build execution is not available in this environment yet.'
    );
    console.log(
      'Install a Java runtime, Android SDK, and use a React Native app android folder to run the executable checks.'
    );
  }

  console.log('');
  console.log('Android verification doctor completed.');
}

function runAndroidAppGradleTask(taskName) {
  const appAndroidDir = process.env[APP_ANDROID_DIR_ENV];

  if (!appAndroidDir) {
    fail(
      `${APP_ANDROID_DIR_ENV} is required. Point it to a React Native app android directory, then rerun this command.`
    );
  }

  const resolvedAppAndroidDir = path.resolve(appAndroidDir);

  if (!existsSync(resolvedAppAndroidDir) || !statSync(resolvedAppAndroidDir).isDirectory()) {
    fail(`${APP_ANDROID_DIR_ENV} does not point to a directory: ${resolvedAppAndroidDir}`);
  }

  const gradleCommand = resolveGradleCommand(resolvedAppAndroidDir);

  if (!gradleCommand) {
    fail(
      `No Gradle executable found. Expected ${path.join(
        resolvedAppAndroidDir,
        'gradlew'
      )} or a gradle command on PATH.`
    );
  }

  const result = spawnSync(gradleCommand.command, [...gradleCommand.args, taskName], {
    cwd: resolvedAppAndroidDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function checkRequiredFiles() {
  const missing = REQUIRED_FILES.filter((filePath) => !existsSync(path.join(ROOT, filePath)));

  return {
    ok: missing.length === 0,
    label: 'required Android/codegen files exist',
    detail: missing.length === 0 ? 'all expected files are present' : `missing: ${missing.join(', ')}`,
  };
}

function checkPackageMetadata() {
  const packageJson = readJson('package.json');
  const readmeContents = readText('README.md');
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
  const checks = [
    packageJson.name === 'react-native-image-compression-kit',
    packageJson.version === '0.2.0',
    packageJson.license === 'MIT',
    packageJson.repository?.type === 'git',
    packageJson.repository?.url ===
      'git+https://github.com/GGULBAE/react-native-image-compression-kit.git',
    packageJson.bugs?.url ===
      'https://github.com/GGULBAE/react-native-image-compression-kit/issues',
    packageJson.homepage ===
      'https://github.com/GGULBAE/react-native-image-compression-kit#readme',
    packageJson.main === 'lib/index.js',
    packageJson.types === 'lib/index.d.ts',
    packageJson.exports?.['.']?.types === './lib/index.d.ts',
    packageJson.exports?.['.']?.default === './lib/index.js',
    packageJson.peerDependencies?.['react-native'] === '>=0.73 <1.0',
    expectedKeywords.every((keyword) => packageJson.keywords?.includes(keyword)),
    readmeContents.includes('public `0.1.x` package is distributed under'),
    readmeContents.includes('The current repository package metadata is `0.2.0` for the iOS native JPEG MVP candidate'),
    readmeContents.includes('The `0.2.0` candidate adds an iOS native MVP with JPEG/PNG input'),
    readmeContents.includes('Development scripts, Android JVM tests, instrumentation tests, and codec fixtures are intentionally excluded from the publish tarball.'),
    readmeContents.includes('Install from npm:'),
    readmeContents.includes('- [x] Public npm release.'),
  ];

  return {
    ok: checks.every(Boolean),
    label: 'npm package metadata is publish-ready for v0.2.0 candidate',
    detail: checks.every(Boolean)
      ? 'name, version, license, repository, bugs, homepage, exports, peer dependency, keywords, and README publish status are aligned'
      : 'expected package.json publish metadata or README release-status guidance is missing/mismatched',
  };
}

function checkCodegenConfig() {
  const packageJson = readJson('package.json');
  const config = packageJson.codegenConfig;
  const ok =
    config?.name === 'RNImageCompressionKitSpec' &&
    config?.type === 'modules' &&
    config?.jsSrcsDir === 'src' &&
    config?.android?.javaPackageName === 'com.imagecompressionkit';

  return {
    ok,
    label: 'package.json codegenConfig matches Android TurboModule setup',
    detail: ok
      ? 'RNImageCompressionKitSpec modules config targets com.imagecompressionkit'
      : 'expected codegenConfig.name/type/jsSrcsDir/android.javaPackageName to match the native module',
  };
}

function checkSpecFile() {
  const contents = readText('src/NativeImageCompressionKit.ts');
  const ok =
    contents.includes('export interface Spec extends TurboModule') &&
    contents.includes("TurboModuleRegistry.get<Spec>('ImageCompressionKit')");

  return {
    ok,
    label: 'TurboModule spec shape is codegen-compatible',
    detail: ok
      ? 'Spec extends TurboModule and registers ImageCompressionKit'
      : 'expected a Spec interface and TurboModuleRegistry.get<Spec>(...)',
  };
}

function checkDockerAndroidEnvironment() {
  const packageJson = readJson('package.json');
  const dockerfileContents = readText('Dockerfile');
  const dockerIgnoreContents = readText('.dockerignore');
  const dockerScriptContents = readText('scripts/docker-android.mjs');
  const readmeContents = readText('README.md');
  const expectedScripts = {
    'docker:android:build': 'node scripts/docker-android.mjs build',
    'docker:android:verify': 'node scripts/docker-android.mjs verify',
    'docker:android:example:typecheck': 'node scripts/docker-android.mjs example:typecheck',
    'docker:android:example:codegen': 'node scripts/docker-android.mjs example:codegen',
    'docker:android:example:android-unit-test':
      'node scripts/docker-android.mjs example:android-unit-test',
    'docker:android:example:build': 'node scripts/docker-android.mjs example:build',
    'docker:android:ci': 'node scripts/docker-android.mjs ci',
    'docker:android:shell': 'node scripts/docker-android.mjs shell',
  };
  const scriptChecks = Object.entries(expectedScripts).map(
    ([name, command]) => packageJson.scripts?.[name] === command
  );
  const expectedSnippets = [
    [dockerfileContents, 'FROM eclipse-temurin:21-jdk-jammy'],
    [dockerfileContents, 'ARG NODE_VERSION=24.11.1'],
    [dockerfileContents, 'ARG PNPM_VERSION=11.7.0'],
    [dockerfileContents, 'ARG ANDROID_PLATFORM=android-36'],
    [dockerfileContents, 'ARG ANDROID_BUILD_TOOLS_VERSION=36.0.0'],
    [dockerfileContents, 'ARG ANDROID_LEGACY_BUILD_TOOLS_VERSION=35.0.0'],
    [dockerfileContents, 'ARG ANDROID_NDK_VERSION=27.1.12297006'],
    [dockerfileContents, 'ARG ANDROID_CMAKE_VERSION=3.22.1'],
    [dockerfileContents, 'ANDROID_HOME=/opt/android-sdk'],
    [dockerfileContents, 'GRADLE_OPTS=-Dorg.gradle.vfs.watch=false'],
    [dockerfileContents, 'npm install -g "pnpm@${PNPM_VERSION}"'],
    [dockerfileContents, 'sdkmanager --install'],
    [dockerfileContents, '"platforms;${ANDROID_PLATFORM}"'],
    [dockerfileContents, '"build-tools;${ANDROID_BUILD_TOOLS_VERSION}"'],
    [dockerfileContents, '"build-tools;${ANDROID_LEGACY_BUILD_TOOLS_VERSION}"'],
    [dockerfileContents, '"cmake;${ANDROID_CMAKE_VERSION}"'],
    [dockerfileContents, '"ndk;${ANDROID_NDK_VERSION}"'],
    [dockerfileContents, 'WORKDIR /workspace'],
    [dockerIgnoreContents, 'node_modules/'],
    [dockerIgnoreContents, 'android/build/'],
    [dockerIgnoreContents, 'example/android/build/'],
    [dockerScriptContents, 'RNICK_ANDROID_DOCKER_PLATFORM'],
    [dockerScriptContents, 'linux/amd64'],
    [dockerScriptContents, 'pnpm install --frozen-lockfile'],
    [dockerScriptContents, 'example:android-unit-test'],
    [dockerScriptContents, '${VOLUME_PREFIX}-node-modules:/workspace/node_modules'],
    [dockerScriptContents, '${VOLUME_PREFIX}-pnpm-store:/pnpm/store'],
    [dockerScriptContents, '${VOLUME_PREFIX}-gradle-home:/root/.gradle'],
    [dockerScriptContents, 'GRADLE_OPTS=-Dorg.gradle.vfs.watch=false'],
    [readmeContents, '## Docker Android Build/Test Environment'],
    [readmeContents, 'Node.js 24, pnpm 11.7.0, Temurin JDK 21'],
    [readmeContents, 'Android SDK platform 36, Android build tools 36.0.0'],
    [readmeContents, 'Android build tools 35.0.0 for React Native/AGP compatibility'],
    [readmeContents, 'CMake 3.22.1'],
    [readmeContents, 'Android NDK 27.1.12297006'],
    [readmeContents, 'pnpm docker:android:build'],
    [readmeContents, 'pnpm docker:android:ci'],
    [readmeContents, 'pnpm docker:android:example:android-unit-test'],
    [readmeContents, 'linux/amd64'],
    [readmeContents, 'disables Gradle VFS watching'],
    [readmeContents, 'named Docker volumes'],
    [readmeContents, 'does not run an Android emulator'],
  ];
  const missing = expectedSnippets
    .filter(([contents, snippet]) => !contents.includes(snippet))
    .map(([, snippet]) => snippet);

  return {
    ok: scriptChecks.every(Boolean) && missing.length === 0,
    label: 'Docker Android build/test environment is documented and wired',
    detail:
      scriptChecks.every(Boolean) && missing.length === 0
        ? 'Dockerfile, docker runner scripts, package commands, .dockerignore, and README Docker guidance are present'
        : `missing snippets or package scripts: ${[
            ...missing,
            ...Object.entries(expectedScripts)
              .filter(([name, command]) => packageJson.scripts?.[name] !== command)
              .map(([name]) => name),
          ].join(' | ')}`,
  };
}

function checkPackageFiles() {
  const packageJson = readJson('package.json');
  const files = packageJson.files ?? [];
  const requiredEntries = [
    'android/build.gradle',
    'android/src/main',
    'ios',
    'lib',
    'src',
    'README.md',
    'SECURITY.md',
    'LICENSE',
  ];
  const forbiddenEntries = ['android', 'android/src', 'scripts'];
  const hasRequiredEntries = requiredEntries.every((entry) => files.includes(entry));
  const excludesDevelopmentEntries = forbiddenEntries.every((entry) => !files.includes(entry));

  return {
    ok: hasRequiredEntries && excludesDevelopmentEntries,
    label: 'npm package file globs avoid development-only files',
    detail:
      hasRequiredEntries && excludesDevelopmentEntries
        ? 'publish entries include runtime native source, JS build output, Codegen source, README, SECURITY, and LICENSE without Android tests, fixtures, or repo scripts'
        : 'expected package.json files to include runtime source and docs, without android, android/src, or scripts',
  };
}

function checkConsumerSmokeTestEnvironment() {
  const packageJson = readJson('package.json');
  const smokeScriptContents = readText('scripts/consumer-smoke-test.mjs');
  const ciContents = readText('.github/workflows/ci.yml');
  const readmeContents = readText('README.md');
  const expectedSnippets = [
    [smokeScriptContents, "run('pnpm', ['pack', '--pack-destination', packDir], ROOT)"],
    [smokeScriptContents, "run('pnpm', ['install', '--ignore-scripts'], consumerDir)"],
    [smokeScriptContents, "run('pnpm', ['typecheck'], consumerDir)"],
    [smokeScriptContents, "'react-native-image-compression-kit': tarballSpecifier"],
    [smokeScriptContents, "const REACT_NATIVE_VERSION = '0.86.0'"],
    [smokeScriptContents, 'lib/index.d.ts'],
    [smokeScriptContents, 'compressImage(options)'],
    [smokeScriptContents, 'getImageCompressionCapabilities()'],
    [ciContents, 'name: Run package consumer smoke test'],
    [ciContents, 'run: pnpm smoke:consumer'],
    [readmeContents, 'pnpm smoke:consumer'],
    [readmeContents, 'separate temporary React Native consumer project'],
    [readmeContents, 'typechecks imports from `react-native-image-compression-kit`'],
    [readmeContents, 'without publishing to npm'],
  ];
  const missing = expectedSnippets
    .filter(([contents, snippet]) => !contents.includes(snippet))
    .map(([, snippet]) => snippet);
  const hasScript =
    packageJson.scripts?.['smoke:consumer'] ===
    'pnpm build && node scripts/consumer-smoke-test.mjs';

  return {
    ok: hasScript && missing.length === 0,
    label: 'package consumer smoke test is wired',
    detail:
      hasScript && missing.length === 0
        ? 'package script, packed-tarball consumer installer, CI step, and README guidance are present'
        : `missing snippets or package script: ${[
            ...missing,
            ...(hasScript ? [] : ['package.json smoke:consumer script']),
          ].join(' | ')}`,
  };
}

function checkReleaseDryRunChecklist() {
  const packageJson = readJson('package.json');
  const releaseScriptContents = readText('scripts/release-dry-run.mjs');
  const readmeContents = readText('README.md');
  const expectedSnippets = [
    [
      releaseScriptContents,
      'Release dry run only validates publish readiness. It does not publish to npm.',
    ],
    [releaseScriptContents, "args: ['verify']"],
    [releaseScriptContents, "args: ['example:typecheck']"],
    [releaseScriptContents, "args: ['diff', '--check']"],
    [releaseScriptContents, "args: ['pack', '--dry-run']"],
    [releaseScriptContents, "args: ['smoke:consumer']"],
    [releaseScriptContents, "args: ['publish', '--dry-run', '--no-git-checks']"],
    [readmeContents, '## Release Dry Run Checklist'],
    [readmeContents, 'Actual npm publishing requires an authenticated npm registry session and is intentionally outside the dry-run checklist.'],
    [readmeContents, 'pnpm release:dry-run'],
    [readmeContents, 'pnpm verify'],
    [readmeContents, 'pnpm example:typecheck'],
    [readmeContents, 'git diff --check'],
    [readmeContents, 'pnpm pack --dry-run'],
    [readmeContents, 'pnpm smoke:consumer'],
    [readmeContents, 'pnpm publish --dry-run --no-git-checks'],
    [readmeContents, 'successful GitHub Actions CI run'],
  ];
  const missing = expectedSnippets
    .filter(([contents, snippet]) => !contents.includes(snippet))
    .map(([, snippet]) => snippet);
  const hasScript =
    packageJson.scripts?.['release:dry-run'] === 'node scripts/release-dry-run.mjs';

  return {
    ok: hasScript && missing.length === 0,
    label: 'release dry-run checklist is documented and wired',
    detail:
      hasScript && missing.length === 0
        ? 'package script, dry-run command sequence, README checklist, and non-publish boundary are present'
        : `missing snippets or package script: ${[
            ...missing,
            ...(hasScript ? [] : ['package.json release:dry-run script']),
          ].join(' | ')}`,
  };
}

function checkReleaseNotes() {
  const releaseContents = readText('RELEASE.md');
  const readmeContents = readText('README.md');
  const packageJson = readJson('package.json');
  const releaseSnippets = [
    '## v0.2.0',
    'Status: release candidate in progress. Not published to npm and not tagged.',
    'replacing the iOS',
    'package stub with a native iOS JPEG compression MVP',
    'Implement iOS native `compressImage()` for local JPEG and PNG input.',
    'Support iOS JPEG output with `output.quality`, optional resize, and cache-file result metadata.',
    'Report iOS runtime capabilities for JPEG input/output, PNG input, metadata policies, target-size compression, and cancellation.',
    'Align README guidance, TypeScript native-unavailable messaging, and test expectations with the implemented iOS MVP.',
    '`package.json` version bump to `0.2.0`.',
    'iOS `compressImage()` reads `file://` and best-effort `content://` source URIs.',
    'iOS input detection accepts JPEG and PNG only, rejecting other formats with `ERR_UNSUPPORTED_FORMAT`.',
    'iOS output supports JPEG only, rejecting unsupported output formats with `ERR_NOT_IMPLEMENTED`.',
    'iOS resize supports `contain`, `cover`, and `stretch`.',
    'iOS `output.quality` supports integer quality values from `0` to `100`, defaulting to `80`.',
    "iOS `metadata: 'safe'` and `metadata: 'strip'` are accepted",
    "iOS `metadata: 'preserve'` and `output.maxBytes` reject with `ERR_NOT_IMPLEMENTED`.",
    "iOS `getImageCompressionCapabilities()` reports `metadataPolicies: ['safe', 'strip']`",
    'README iOS support matrix, public API guidance, roadmap, installation status, and release dry-run wording updates.',
    'Focused TypeScript and source-level native foundation test expectation updates for the `0.2.0` candidate.',
    'Android runtime behavior changes.',
    'HEIC / HEIF / AVIF / GIF / WebP input on iOS.',
    'iOS target-size compression.',
    'iOS metadata preservation.',
    'npm publish.',
    'Git tag creation.',
    'Before publishing `v0.2.0`, confirm the working tree and branch are correct',
    'pnpm pack --dry-run',
    'native smoke test that links the pod and compresses a JPEG and PNG source to',
    '## v0.1.2',
    'Status: published to npm on June 30, 2026 at 02:18:30 UTC (11:18:30 KST), tagged as `v0.1.2`.',
    'This patch keeps Android runtime behavior unchanged',
    'Clarify that iOS ships a native package stub and iOS compression is not implemented.',
    'Preserve a stable iOS `ERR_NOT_IMPLEMENTED` compression failure',
    'Make iOS capability reporting show no supported input formats, output formats, metadata policies, target-size compression, or cancellation.',
    'Update the TypeScript native-unavailable message',
    'Publish package metadata for `0.1.2` after the release candidate passed local and GitHub Actions validation.',
    '### Published Artifacts',
    'npm package: `react-native-image-compression-kit@0.1.2`',
    'npm integrity: `sha512-OOHIV4Lnmu+16/W8iGMZriiYXLbB9nIVV0vBz4dd3erW3meaSqV28JkWpc/5FetIz0HcLU/4Pfgq8eTZ8fIY6g==`',
    'Git tag: `v0.1.2`',
    'GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.2`',
    'Published tarball size: 35.3 kB package size, 146.8 kB unpacked size, 49 files.',
    'iOS stub `compressImage()` error message aligned to the package-stub state.',
    'iOS `getImageCompressionCapabilities()` reports `metadataPolicies: []`',
    'TypeScript `ERR_NATIVE_MODULE_UNAVAILABLE` message distinguishes install/linking failure',
    'README iOS stub behavior guidance and release dry-run wording updates.',
    '`package.json` version bump to `0.1.2`.',
    'Focused test and Android verification doctor expectation updates for the `0.1.2` release.',
    'iOS compression implementation.',
    'Android runtime behavior changes.',
    'git tag -a v0.1.2 -m "v0.1.2"',
    'git push origin v0.1.2',
    'npm pack react-native-image-compression-kit@0.1.2',
    '### Post-publish Verification',
    '`npm publish --tag latest` published `react-native-image-compression-kit@0.1.2`.',
    '`latest` dist-tag `0.1.2`',
    'publish timestamp `2026-06-30T02:18:30.591Z`',
    'The published tarball includes the README, iOS native stub, built JS',
    'Published tarball inspection confirmed the iOS `ERR_NOT_IMPLEMENTED` message',
    'fresh temporary consumer project installed `react-native-image-compression-kit@0.1.2`',
    'GitHub Release `v0.1.2` was created at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.2`.',
    '## v0.1.1',
    'Status: prepared for a docs-only npm patch release.',
    'This patch corrects the README content that appears on the npm package page',
    'Android MVP is published',
    'iOS remains a',
    'package stub and iOS compression is not implemented',
    'Remove stale README wording that said the package had not been published to npm.',
    'Replace React Native and TypeScript badge values',
    'Bump package metadata to `0.1.1`',
    'README status, badges, public API wording, installation wording, and release checklist wording updates.',
    '`package.json` version bump to `0.1.1`.',
    'git tag -a v0.1.1 -m "v0.1.1"',
    'git push origin v0.1.1',
    'npm pack react-native-image-compression-kit@0.1.1',
    '### Post-publish Verification',
    '`pnpm publish --no-git-checks` published `react-native-image-compression-kit@0.1.1`.',
    '`latest` dist-tag `0.1.1`',
    'publish timestamp `2026-06-29T07:18:19.684Z`',
    'npm integrity: `sha512-pnLxeyn/JVKykGbOKrS9GYoU+pKr/oq4nffdHPn97ycjOw//RD6Yd6BGUPNuRcVoqnS17QsYgGx2c5JXWQq4BA==`',
    '49 files, 35.1 kB package size, and 144.8 kB unpacked size',
    'corrected README status, Android MVP published badge, Android MVP / iOS stub platform badge',
    'Published README verification found no stale',
    'fresh temporary consumer project installed `react-native-image-compression-kit@0.1.1`',
    '## v0.1.0',
    'Status: published to npm on June 27, 2026 at 10:51:55 UTC (19:51:55 KST), tagged as `v0.1.0`.',
    'published as',
    '### Published Artifacts',
    'npm package: `react-native-image-compression-kit@0.1.0`',
    'npm integrity: `sha512-W8kaa3eKdWVLHCGeApdOqNMfeD7np42OcgjGCUZAQDZqzx86diybRtEqK+MJtX73Yt4wLcVKOtb62sPtLJLk9g==`',
    'GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.0`',
    'Published tarball size: 34.2 kB package size, 142.2 kB unpacked size, 48 files.',
    'Android MVP only',
    'file://` and `content://',
    'JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input',
    'GIF input is decoded as a static first frame',
    'HEIC / HEIF input is SDK-gated',
    'Android 14+ AVIF input',
    'JPEG, PNG, and WebP output',
    'Target-size compression with maxBytes for JPEG and WebP output',
    'Metadata policies preserve, safe, and strip',
    'iOS compression is not implemented',
    'AVIF output is not implemented',
    'HEIC / HEIF output is not implemented',
    'GIF output and animation preservation are not implemented',
    '### Release Checklist',
    'git status --short --branch',
    'pnpm release:dry-run',
    'GitHub Actions CI success',
    'git tag -a v0.1.0 -m "v0.1.0"',
    'git push origin v0.1.0',
    '### Publish Commands',
    'pnpm login --registry=https://registry.npmjs.org/',
    'pnpm whoami',
    'pnpm publish --otp 123456',
    'pnpm view react-native-image-compression-kit version dist.integrity',
    '### Post-publish Security Review',
    'contains no `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, `postpack`, `publish`, or `postpublish` lifecycle scripts',
    'forbidden-file scan found no `.env*`, `.npmrc`, key files, debug keystore, Android test directories, example app files, or repository scripts',
    '`pnpm audit --prod` reported no known vulnerabilities',
    '### External Install Smoke',
    'Installed `react-native-image-compression-kit@0.1.0` from the npm registry with `pnpm install --ignore-scripts`',
    'Confirmed dependency resolution with `pnpm list react-native-image-compression-kit react-native react --depth 0`',
    'Typechecked imports for `compressImage`, `getImageCompressionCapabilities`, `ImageCompressionKitError`, `CompressionOptions`, `CompressionResult`, and `ImageCompressionCapabilities`',
    '`pnpm typecheck` completed successfully in the external consumer project',
    'The GitHub Release was created from this note',
    'gh release create v0.1.0 --title "v0.1.0" --notes-file RELEASE.md',
  ];
  const readmeSnippets = [
    'See [RELEASE.md](RELEASE.md) for the v0.2.0 candidate notes, v0.1.2 published patch notes, v0.1.1 docs-only patch notes, v0.1.0 published artifact details, tag checklist, and post-publish security review.',
    'reviewed release notes',
    'Tag, npm publish, and post-publish security review commands are documented in `RELEASE.md`',
  ];
  const missing = [
    ...releaseSnippets
      .filter((snippet) => !releaseContents.includes(snippet))
      .map((snippet) => `RELEASE.md ${snippet}`),
    ...readmeSnippets
      .filter((snippet) => !readmeContents.includes(snippet))
      .map((snippet) => `README.md ${snippet}`),
  ];
  const ok = packageJson.version === '0.2.0' && missing.length === 0;

  return {
    ok,
    label: 'v0.2.0 candidate notes and previous release notes are current',
    detail: ok
      ? 'RELEASE.md documents the release scope, non-goals, validation gate, previous tag commands, and previous npm publish steps'
      : `missing release notes snippets or version mismatch: ${[
          ...missing,
          ...(packageJson.version === '0.2.0' ? [] : ['package.json version 0.2.0']),
        ].join(' | ')}`,
  };
}

function checkSecurityPolicy() {
  const securityContents = readText('SECURITY.md');
  const readmeContents = readText('README.md');
  const expectedSnippets = [
    [securityContents, '# Security Policy'],
    [securityContents, '| 0.1.x | Yes |'],
    [securityContents, 'Please do not include exploit details, secrets, private keys, or sensitive'],
    [securityContents, 'The npm package is intended to avoid install-time code execution.'],
    [securityContents, '`preinstall`, `install`, `postinstall`, `prepare`'],
    [securityContents, 'Development-only scripts, tests,'],
    [securityContents, 'fixtures, example apps, build directories, credentials, `.npmrc`, `.env*`, keys,'],
    [securityContents, 'pnpm release:dry-run'],
    [securityContents, 'pnpm audit --prod'],
    [securityContents, 'npm pack react-native-image-compression-kit@<version>'],
    [readmeContents, '## Security'],
    [readmeContents, 'See [SECURITY.md](SECURITY.md) for supported versions, vulnerability reporting guidance, and package security hygiene.'],
    [readmeContents, 'Published packages should not run install-time lifecycle scripts'],
  ];
  const missing = expectedSnippets
    .filter(([contents, snippet]) => !contents.includes(snippet))
    .map(([, snippet]) => snippet);

  return {
    ok: missing.length === 0,
    label: 'security policy and package hygiene guidance are documented',
    detail:
      missing.length === 0
        ? 'SECURITY.md and README document reporting, supported versions, install-time script avoidance, tarball exclusions, and audit checks'
        : `missing security documentation snippets: ${missing.join(' | ')}`,
  };
}

function checkGitHubActionRuntimeVersions() {
  const ciContents = readText('.github/workflows/ci.yml');
  const instrumentationContents = readText('.github/workflows/android-instrumentation.yml');
  const readmeContents = readText('README.md');
  const expectedWorkflowSnippets = [
    'uses: actions/checkout@v7',
    'uses: actions/setup-java@v5',
    'uses: android-actions/setup-android@v4',
    'uses: pnpm/action-setup@v6',
    'uses: actions/setup-node@v6',
    'uses: gradle/actions/setup-gradle@v6',
  ];
  const deprecatedWorkflowSnippets = [
    'uses: actions/checkout@v4',
    'uses: actions/setup-java@v4',
    'uses: android-actions/setup-android@v3',
    'uses: pnpm/action-setup@v4',
    'uses: actions/setup-node@v4',
    'uses: gradle/actions/setup-gradle@v4',
  ];
  const readmeSnippets = [
    'Node 24 runtime-compatible majors',
    '`actions/checkout@v7`',
    '`actions/setup-node@v6`',
    '`actions/setup-java@v5`',
    '`android-actions/setup-android@v4`',
    '`pnpm/action-setup@v6`',
    '`gradle/actions/setup-gradle@v6`',
  ];
  const missing = [
    ...expectedWorkflowSnippets
      .filter((snippet) => !ciContents.includes(snippet))
      .map((snippet) => `.github/workflows/ci.yml ${snippet}`),
    ...expectedWorkflowSnippets
      .filter((snippet) => !instrumentationContents.includes(snippet))
      .map((snippet) => `.github/workflows/android-instrumentation.yml ${snippet}`),
    ...readmeSnippets
      .filter((snippet) => !readmeContents.includes(snippet))
      .map((snippet) => `README.md ${snippet}`),
  ];
  const deprecated = deprecatedWorkflowSnippets.filter(
    (snippet) => ciContents.includes(snippet) || instrumentationContents.includes(snippet)
  );

  return {
    ok: missing.length === 0 && deprecated.length === 0,
    label: 'GitHub Actions use Node 24 runtime-compatible action majors',
    detail:
      missing.length === 0 && deprecated.length === 0
        ? 'CI and Android instrumentation workflows avoid action majors that target the deprecated Node 20 runtime'
        : `missing or deprecated snippets: ${[...missing, ...deprecated].join(' | ')}`,
  };
}

function checkAndroidGradleConfig() {
  const contents = readText('android/build.gradle');
  const expectedSnippets = [
    'apply plugin: "com.android.library"',
    'apply plugin: "com.facebook.react"',
    'apply plugin: "org.jetbrains.kotlin.android"',
    'build/generated/source/codegen/java',
    'testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"',
    'androidTest.assets.srcDirs += ["src/test/assets"]',
    'unitTests.returnDefaultValues = true',
    'unitTests.includeAndroidResources = true',
    'implementation "com.facebook.react:react-android"',
    'implementation "androidx.exifinterface:exifinterface:1.4.2"',
    'testImplementation "junit:junit:4.13.2"',
    'testImplementation "org.robolectric:robolectric:4.16.1"',
    'androidTestImplementation "junit:junit:4.13.2"',
    'androidTestImplementation "androidx.test:core:1.6.1"',
    'androidTestImplementation "androidx.test:runner:1.6.2"',
    'androidTestImplementation "androidx.test.ext:junit:1.2.1"',
  ];
  const missing = expectedSnippets.filter((snippet) => !contents.includes(snippet));

  return {
    ok: missing.length === 0,
    label: 'Android Gradle config supports React Native codegen compilation',
    detail: missing.length === 0 ? 'required Gradle plugins, generated source path, and React dependency are present' : `missing snippets: ${missing.join(' | ')}`,
  };
}

function checkAndroidNativeModule() {
  const moduleContents = readText(
    'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
  );
  const metadataContents = readText(
    'android/src/main/java/com/imagecompressionkit/JpegExifMetadata.kt'
  );
  const outputContents = readText(
    'android/src/main/java/com/imagecompressionkit/ImageCompressionOutput.kt'
  );
  const metadataTestContents = readText(
    'android/src/test/java/com/imagecompressionkit/JpegExifMetadataTest.kt'
  );
  const outputTestContents = readText(
    'android/src/test/java/com/imagecompressionkit/ImageCompressionOutputTest.kt'
  );
  const moduleTestContents = readText(
    'android/src/test/java/com/imagecompressionkit/ImageCompressionKitModuleTest.kt'
  );
  const packageJson = readJson('package.json');
  const contents = [
    moduleContents,
    metadataContents,
    outputContents,
    metadataTestContents,
    outputTestContents,
    moduleTestContents,
  ].join('\n');
  const expectedSnippets = [
    'NativeImageCompressionKitSpec',
    'BitmapFactory.decodeStream',
    'ImageDecoder.decodeBitmap',
    'createImageDecoderSource(inputSource)',
    'decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE',
    'openInputStream(inputSource.uri)',
    'OpenableColumns.SIZE',
    'InputFormat.fromMimeType(bounds?.mimeType) ?: inputFormatHint',
    'readInputFormatHint(inputSource)',
    'readUnsupportedInputMimeTypeHint(inputSource)',
    'queryContentMimeType(inputSource.uri)',
    'usesAvifDecodePath',
    'InputFormat.fromFileExtension(fileExtension)',
    'Build.VERSION.SDK_INT >= Build.VERSION_CODES.P',
    'Build.VERSION.SDK_INT >= Build.VERSION_CODES.O',
    'Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE',
    'decodeHeicHeifBitmapWithImageDecoder',
    'decodeAvifBitmapWithImageDecoder',
    'decodeBitmapFactory(inputSource)',
    'mimeType = "image/jpeg"',
    'mimeType = "image/png"',
    'mimeType = "image/webp"',
    'mimeType = "image/heic"',
    'mimeType = "image/heif"',
    'mimeType = "image/avif"',
    'mimeType = "image/gif"',
    'readExifOrientation(inputSource)',
    'applyExifOrientation(bitmap, exifOrientation)',
    'ExifInterface.TAG_ORIENTATION',
    'Matrix',
    'resizeBitmap(orientedBitmap, resize)',
    'readMaxBytes(output)',
    'encodeBitmapToTargetSize',
    'supportsTargetSizeCompression", true',
    'ImageCompressionOutput.createOutputFile',
    'ImageCompressionOutput.createResultMetadata',
    'ImageCompressionOutput.maxBytesValidationError',
    'OutputFormat.fromValue',
    'PNG_FORMAT',
    'WEBP_FORMAT',
    'Bitmap.CompressFormat.PNG',
    'Bitmap.CompressFormat.WEBP_LOSSY',
    'Bitmap.CompressFormat.WEBP',
    'pngFormatNotes',
    'webpFormatNotes',
    'gifFormatNotes',
    'heicHeifFormatNotes',
    'avifFormatNotes',
    'SUPPORTED_INPUT_FORMATS',
    'HEIC_FORMAT',
    'HEIF_FORMAT',
    'AVIF_FORMAT',
    'output = outputFormat != null',
    'supports JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input with JPEG, PNG, and WebP output only',
    'readMetadataPolicy(options)',
    'MetadataPolicy.PRESERVE',
    'createCopiedExifMetadata',
    'JpegExifMetadata.read',
    'JpegExifMetadata.write',
    'SAFE_EXIF_TAGS',
    'PRESERVED_EXIF_TAGS',
    'ExifInterface.TAG_GPS_LATITUDE',
    'ExifInterface.TAG_CAMERA_OWNER_NAME',
    'ExifInterface.TAG_MAKER_NOTE',
    'Metadata safe copies privacy-filtered JPEG source EXIF attributes.',
    'PNG, WebP, GIF, HEIC, HEIF, and AVIF sources are decoded without copying EXIF metadata.',
    'heicHeifFormatNotes("HEIC")',
    'heicHeifFormatNotes("HEIF")',
    '$formatLabel input is supported on Android 8.0+ when device HEIF decode codecs are present.',
    'Android API 28+ uses ImageDecoder for $formatLabel input.',
    'Android API 26-27 attempts a guarded BitmapFactory HEIF decode fallback.',
    '$formatLabel inputs are decoded without copying EXIF metadata.',
    '$formatLabel output is not implemented.',
    'AVIF input is supported on Android 14+ for baseline still images.',
    'Android API 34+ uses ImageDecoder for AVIF input.',
    'AVIF inputs are decoded without copying EXIF metadata.',
    'AVIF output is not implemented.',
    'Android MVP decodes GIF file:// and content:// sources as a static first frame.',
    'Animated GIF preservation is not implemented.',
    'GIF output is not implemented.',
    'outputExif.setAttribute(',
    'ExifInterface.TAG_ORIENTATION',
    'pushString(METADATA_POLICY_SAFE)',
    'pushString(METADATA_POLICY_STRIP)',
    'pushString(METADATA_POLICY_PRESERVE)',
    'Bitmap.createScaledBitmap',
    'ResizeMode.COVER',
    'Bitmap.CompressFormat.JPEG',
    'safeMetadataCopiesAllowlistedExifAndFiltersSensitiveTags',
    'preserveMetadataCopiesSensitiveExifButNormalizesOutputGeometry',
    'nullMetadataLeavesOutputExifUntouchedForStripPolicy',
    'outputFormatsCreateMatchingResultFormatAndFileExtensions',
    'encodedOutputsContainExpectedByteSignaturesAndResultMetadataMatchesFile',
    'capabilitiesExposeJpegPngWebpGifHeicHeifAvifInputsAndJpegPngWebpOutputsOnly',
    'assertHeicHeifCapabilityNotes',
    'assertAvifCapabilityNotes',
    'pngRejectsMaxBytesButWebpAndJpegAllowIt',
    'outputFormatsMapToAndroidCompressFormatsAndQualityRules',
    'ImageCompressionOutput.encodeBitmap',
    'BitmapFactory.decodeByteArray',
    'GraphicsMode.Mode.NATIVE',
    'compressImageCreatesJpegPngAndWebpOutputsWithExpectedResultMetadata',
    'compressImageRejectsPngMaxBytesAtModuleBoundary',
    'compressImageAppliesExifOrientationBeforeResizeModesAndNormalizesOutputExif',
    'compressImageReadsContentUriJpegLikeFileUriAndReportsMetadata',
    'compressImageRejectsUnreadableContentUriAtModuleBoundary',
    'compressImageRejectsAvifFileBeforeAndroidU',
    'compressImageRejectsAvifContentMimeBeforeAndroidU',
    'compressImageTreatsHeicAndHeifSourcesAsDecodeCandidatesOnSupportedSdk',
    'compressImageTreatsAvifSourcesAsDecodeCandidatesOnSupportedSdk',
    'compressImageRejectsHeicAndHeifBeforeAndroidO',
    'compressImageSeparatesSupportedFormatDecodeFailures',
    'compressImageAcceptsGifFileAndContentSourcesAsStaticFrameWithAllImplementedOutputs',
    'compressImageResizesGifSourceAcrossModes',
    'compressImageHonorsJpegAndWebpMaxBytesForGifSource',
    'compressImageIgnoresMetadataPoliciesForGifSource',
    'compressImageAcceptsPngAndWebpFileAndContentSourcesWithAllImplementedOutputs',
    'compressImageResizesPngAndWebpSourcesAcrossModes',
    'compressImageHonorsJpegAndWebpMaxBytesForPngAndWebpSources',
    'compressImageIgnoresMetadataPoliciesForPngAndWebpSources',
    'compressImageHonorsJpegAndWebpMaxBytesAndReportsFileMetadata',
    'compressImageFallsBackWhenMaxBytesIsTooSmallAndReportsConsistentMetadata',
    'module.compressImage(',
    'RecordingPromise',
    'JavaOnlyMap.of',
    'org.robolectric.Shadows.shadowOf',
    'registerInputStreamSupplier',
    'ByteArrayInputStream',
    'sourceUri = contentUri.toString()',
    'assertResultMetadataMatchesBytes',
    'UnsupportedSourceCase',
    'TestMimeTypeContentProvider',
    'ShadowContentResolver.registerProviderInternal',
    'createSampleGifFile',
    'SAMPLE_GIF_BASE64',
    'Base64.getMimeDecoder().decode',
    'assertTopLeftPixelNear',
    'createEncodedImageFile',
    'SourceFormatCase',
    'assertNoCopiedExifMetadata',
    'metadataPolicies = listOf("preserve", "safe", "strip")',
    'ImageCompressionKitModule.ERR_FILE_ACCESS',
    'ExifInterface.ORIENTATION_ROTATE_90',
    'resizeOptions(',
    'mode = "contain"',
    'mode = "cover"',
    'mode = "stretch"',
    'metadata = "safe"',
    'assertNormalizedOutputExif',
    'ExifInterface.ORIENTATION_NORMAL',
    'ExifInterface.TAG_PIXEL_X_DIMENSION',
    'createPatternJpegFile',
    'calculateAchievableTargetBytes',
    'assertResultMetadataMatchesFile',
    'OutputFormat.JPEG',
    'OutputFormat.WEBP',
    '"maxBytes"',
    'assertPngSignature',
    'assertWebpSignature',
    'assertGifSignature',
    '"RIFF"',
    '"WEBP"',
    'RobolectricTestRunner',
    'ERR_UNSUPPORTED_FORMAT',
    'ImageCompressionKitModule.ERR_DECODE_FAILED',
    'Android MVP could not decode the source image.',
    'Android AVIF input requires Android 14+ platform decoder support.',
  ];
  const missing = expectedSnippets.filter((snippet) => !contents.includes(snippet));
  const hasUnitTestScript =
    packageJson.scripts?.['example:android-unit-test'] ===
    'RNICK_ANDROID_APP_DIR=example/android RNICK_ANDROID_GRADLE_TASK=:react-native-image-compression-kit:testDebugUnitTest pnpm android:build';

  return {
    ok: missing.length === 0 && hasUnitTestScript,
    label: 'Android Kotlin module matches generated spec and Android image MVP path',
    detail:
      missing.length === 0 && hasUnitTestScript
        ? 'module extends generated spec and contains JPEG/PNG/WebP/GIF/HEIC/HEIF/AVIF decode paths, SDK-gated unsupported input boundaries, JPEG orient/metadata, resize, target-size, JPEG/PNG/WebP output encode path, and module-level file/content URI tests'
        : `missing snippets: ${[
            ...missing,
            ...(hasUnitTestScript ? [] : ['package.json example:android-unit-test script']),
          ].join(' | ')}`,
  };
}

function checkIOSNativeModule() {
  const iosContents = readText('ios/RCTImageCompressionKit.mm');
  const podspecContents = readText('react-native-image-compression-kit.podspec');
  const expectedSnippets = [
    '#import <ImageIO/ImageIO.h>',
    '#import <UIKit/UIKit.h>',
    'RCTImageCompressionKitUnsupportedFormatCode = @"ERR_UNSUPPORTED_FORMAT"',
    'RCTImageCompressionKitNotImplementedCode = @"ERR_NOT_IMPLEMENTED"',
    'RCTImageCompressionKitJpegFormat = @"jpeg"',
    'RCTImageCompressionKitPngFormat = @"png"',
    'RCTImageCompressionKitDefaultMetadataPolicy = @"safe"',
    'RCTImageCompressionKitStripMetadataPolicy = @"strip"',
    'RCTImageCompressionKitPreserveMetadataPolicy = @"preserve"',
    'iOS MVP supports JPEG input and JPEG output through UIKit/ImageIO.',
    'iOS MVP supports PNG input with JPEG output conversion.',
    'iOS MVP supports JPEG and PNG input with JPEG output only.',
    'iOS MVP supports JPEG output only. Call getImageCompressionCapabilities() before selecting a platform output format.',
    'iOS MVP does not support output.maxBytes yet. Call getImageCompressionCapabilities() and omit maxBytes on iOS.',
    'iOS MVP does not support metadata preserve yet. Use safe or strip metadata on iOS.',
    'Compression output.quality must be an integer from 0 to 100.',
    'Compression resize.mode must be one of: contain, cover, stretch.',
    'iOS MVP supports file:// and content:// image URIs only.',
    'iOS MVP could not read the source image URI.',
    'iOS MVP could not decode the source image.',
    'iOS MVP could not encode JPEG output.',
    'CGImageSourceCreateWithData',
    'UIImage imageWithData',
    'UIImageJPEGRepresentation',
    'UIGraphicsImageRenderer',
    'NSCachesDirectory',
    'ImageCompressionKit',
    'RCTImageCompressionKitRenderImage',
    'RCTImageCompressionKitResizeModeContain',
    'RCTImageCompressionKitResizeModeCover',
    'RCTImageCompressionKitResizeModeStretch',
    'RCTImageCompressionKitReadSourceData',
    'RCTImageCompressionKitIsSupportedInputType',
    '@"metadataPolicies" : @[RCTImageCompressionKitDefaultMetadataPolicy, RCTImageCompressionKitStripMetadataPolicy]',
    '@"supportsTargetSizeCompression" : @NO',
    '@"supportsCancellation" : @NO',
  ];
  const missing = expectedSnippets.filter((snippet) => !iosContents.includes(snippet));
  const podspecIncludesIOS =
    podspecContents.includes('s.platforms = { :ios => "13.4" }') &&
    podspecContents.includes('s.source_files = "ios/**/*.{h,m,mm}"');

  return {
    ok: missing.length === 0 && podspecIncludesIOS,
    label: 'iOS native module implements the JPEG MVP path',
    detail:
      missing.length === 0 && podspecIncludesIOS
        ? 'iOS source includes file/content URI reads, JPEG/PNG input detection, resize, quality-based JPEG output, explicit unsupported-option errors, and iOS capability reporting'
        : `missing snippets: ${[
            ...missing,
            ...(podspecIncludesIOS ? [] : ['podspec iOS platform/source_files']),
          ].join(' | ')}`,
  };
}

function checkIOSHostAppValidation() {
  const packageJson = readJson('package.json');
  const examplePackageJson = readJson('example/package.json');
  const readmeContents = readText('README.md');
  const releaseContents = readText('RELEASE.md');
  const workflowContents = readText('.github/workflows/ios-validation.yml');
  const validationScriptContents = readText('scripts/ios-validation.mjs');
  const appContents = readText('example/src/App.tsx');
  const iosModuleContents = readText('example/ios/ImageCompressionKitExample/ExampleImageSource.m');
  const projectContents = readText('example/ios/ImageCompressionKitExample.xcodeproj/project.pbxproj');
  const podfileContents = readText('example/ios/Podfile');
  const gemfileContents = readText('example/Gemfile');
  const expectedScripts = {
    'example:ios': 'pnpm --filter image-compression-kit-example ios',
    'example:ios:pods': 'node scripts/ios-validation.mjs pods',
    'example:ios:build': 'node scripts/ios-validation.mjs build',
    'example:ios:smoke': 'node scripts/ios-validation.mjs smoke',
  };
  const expectedSnippets = [
    [examplePackageJson, '@react-native-community/cli-platform-ios'],
    [examplePackageJson, 'react-native run-ios'],
    [readmeContents, '## iOS Host-App Validation'],
    [readmeContents, 'pnpm example:ios:pods'],
    [readmeContents, 'pnpm example:ios:build'],
    [readmeContents, 'pnpm example:ios:smoke'],
    [readmeContents, 'RNICK_IOS_SMOKE_PASS'],
    [readmeContents, "metadataPolicies: ['safe', 'strip']"],
    [readmeContents, 'WebP, HEIC, HEIF, AVIF, and GIF inputs reject with `ERR_UNSUPPORTED_FORMAT`'],
    [readmeContents, 'The separate `.github/workflows/ios-validation.yml` workflow runs on a macOS runner'],
    [releaseContents, 'Validate the iOS MVP through a React Native iOS host app'],
    [releaseContents, 'React Native iOS example host app under `example/ios`.'],
    [releaseContents, 'iOS example `ExampleImageSource` native module for generated JPEG, PNG, GIF, WebP, HEIC, HEIF, and AVIF smoke fixtures.'],
    [releaseContents, '`scripts/ios-validation.mjs` with `pods`, `build`, and `smoke` modes.'],
    [releaseContents, '`pnpm example:ios:pods`, `pnpm example:ios:build`, and `pnpm example:ios:smoke` scripts.'],
    [releaseContents, 'GitHub Actions iOS Validation workflow that runs the host-app smoke on a macOS runner.'],
    [releaseContents, 'RNICK_IOS_SMOKE_PASS'],
    [workflowContents, 'name: iOS Validation'],
    [workflowContents, 'runs-on: macos-latest'],
    [workflowContents, 'run: pnpm example:ios:smoke'],
    [validationScriptContents, 'RNICK_IOS_SMOKE_PASS'],
    [validationScriptContents, 'RNICK_IOS_SMOKE_FAIL'],
    [validationScriptContents, 'xcodebuild'],
    [validationScriptContents, "['exec', 'pod', 'install']"],
    [validationScriptContents, 'ImageCompressionKitExample.xcworkspace'],
    [validationScriptContents, 'simctl'],
    [validationScriptContents, 'RNICK_IOS_SMOKE'],
    [appContents, 'runIOSHostAppSmokeValidation'],
    [appContents, 'RNICK_IOS_SMOKE_START'],
    [appContents, 'RNICK_IOS_SMOKE_PASS'],
    [appContents, 'copySamplePngToCache'],
    [appContents, 'copyUnsupportedImageToCache'],
    [appContents, "const unsupportedInputs = ['webp', 'heic', 'heif', 'avif', 'gif']"],
    [appContents, "const unsupportedOutputs = ['png', 'webp', 'heic', 'heif', 'avif'] as const"],
    [appContents, 'Expected output.maxBytes to be unimplemented on iOS.'],
    [appContents, "Expected metadata: 'preserve' to be unimplemented on iOS."],
    [iosModuleContents, 'RCT_EXPORT_MODULE();'],
    [iosModuleContents, 'isSmokeTestEnabled'],
    [iosModuleContents, 'copySampleJpegToCache'],
    [iosModuleContents, 'copySamplePngToCache'],
    [iosModuleContents, 'copyUnsupportedImageToCache'],
    [iosModuleContents, 'RNICK_IOS_SMOKE'],
    [iosModuleContents, 'UIImageJPEGRepresentation'],
    [iosModuleContents, 'PNGDataWithActions'],
    [iosModuleContents, '"gif"'],
    [iosModuleContents, '"webp"'],
    [iosModuleContents, '"heic"'],
    [iosModuleContents, '"heif"'],
    [iosModuleContents, '"avif"'],
    [projectContents, 'ExampleImageSource.m in Sources'],
    [podfileContents, 'use_native_modules!'],
    [podfileContents, 'use_react_native!'],
    [gemfileContents, "gem 'cocoapods'"],
  ];
  const missing = expectedSnippets
    .filter(([contents, snippet]) => {
      const haystack =
        typeof contents === 'string' ? contents : JSON.stringify(contents);
      return !haystack.includes(snippet);
    })
    .map(([, snippet]) => snippet);
  const missingScripts = Object.entries(expectedScripts)
    .filter(([name, command]) => packageJson.scripts?.[name] !== command)
    .map(([name]) => name);

  return {
    ok: missing.length === 0 && missingScripts.length === 0,
    label: 'iOS host-app validation is documented and wired',
    detail:
      missing.length === 0 && missingScripts.length === 0
        ? 'example iOS app, fixture module, smoke script, package commands, README guidance, release notes, and macOS workflow are present'
        : `missing snippets or scripts: ${[...missing, ...missingScripts].join(' | ')}`,
  };
}

function checkHeicHeifCodecSampleStrategy() {
  const contents = readText('README.md');
  const expectedSnippets = [
    '## HEIC / HEIF / AVIF Codec Sample Validation Strategy',
    'This repository now commits tiny HEIC / HEIF / AVIF samples generated from repo-owned PNG sources.',
    'Use `android/src/test/assets/heic-heif/source.png`',
    'Track source and generated output metadata',
    '`android/src/test/assets/heic-heif/manifest.json`',
    'committed sample files',
    '`pnpm fixtures:heic-heif:check`',
    '`pnpm fixtures:heic-heif`',
    'heif-enc --quality 80 source.png -o sample.heic',
    '`pnpm fixtures:avif:check`',
    '`pnpm fixtures:avif`',
    'heif-enc --quality 80 --avif source.png -o sample.avif',
    'Generated fixtures are committed because they are tiny',
    'android/src/test/assets/heic-heif/',
    'They verify the fixture files and metadata, but they do not boot an emulator.',
    'A separate Android Instrumentation workflow enables KVM permissions, boots an API 35 Google APIs emulator with an extended boot timeout',
    '`pnpm example:android-instrumentation`',
    'committed `sample.heic`, `sample.heif`, and `sample.avif` fixtures through their `ImageDecoder` routes',
    'Manual codec validation beyond CI should use a codec-backed Android device or emulator',
    'file:///data/data/com.imagecompressionkit.example/files/rnick-codec/sample.heic',
    'API 26-27 should still be checked separately for the guarded `BitmapFactory` fallback',
    'For AVIF manual validation, use an API 34+ device or emulator',
  ];
  const missing = expectedSnippets.filter((snippet) => !contents.includes(snippet));

  return {
    ok: missing.length === 0,
    label: 'README documents HEIC/HEIF/AVIF codec sample validation strategy',
    detail:
      missing.length === 0
        ? 'fixture generation, instrumentation codec validation, and manual codec boundaries are documented'
        : `missing snippets: ${missing.join(' | ')}`,
  };
}

function checkHeicHeifInstrumentationValidation() {
  const packageJson = readJson('package.json');
  const gradleContents = readText('android/build.gradle');
  const testContents = readText(
    'android/src/androidTest/java/com/imagecompressionkit/ImageCompressionKitHeicHeifInstrumentationTest.kt'
  );
  const workflowContents = readText('.github/workflows/android-instrumentation.yml');
  const readmeContents = readText('README.md');
  const checks = [
    packageJson.scripts?.['example:android-instrumentation'] ===
      'RNICK_ANDROID_APP_DIR=example/android RNICK_ANDROID_GRADLE_TASK=:react-native-image-compression-kit:connectedDebugAndroidTest pnpm android:build',
    gradleContents.includes('testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"'),
    gradleContents.includes('androidTest.assets.srcDirs += ["src/test/assets"]'),
    gradleContents.includes('androidTestImplementation "androidx.test.ext:junit:1.2.1"'),
    testContents.includes('compressesCommittedHeicHeifAndAvifSamplesToJpegPngAndWebp'),
    testContents.includes('Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE'),
    testContents.includes('heic-heif/sample.heic'),
    testContents.includes('heic-heif/sample.heif'),
    testContents.includes('avif/sample.avif'),
    testContents.includes('ImageCompressionKitModule('),
    testContents.includes('JavaOnlyMap.of'),
    testContents.includes('OutputCase("jpeg", ::assertJpegSignature)'),
    testContents.includes('OutputCase("png", ::assertPngSignature)'),
    testContents.includes('OutputCase("webp", ::assertWebpSignature)'),
    testContents.includes('assertBitmapDimensions(outputFile, width = 16, height = 12)'),
    workflowContents.includes('name: Android Instrumentation'),
    workflowContents.includes('HEIC/HEIF/AVIF emulator validation'),
    workflowContents.includes('Enable KVM group permissions'),
    workflowContents.includes('reactivecircus/android-emulator-runner@v2'),
    workflowContents.includes('api-level: 35'),
    workflowContents.includes('target: google_apis'),
    workflowContents.includes('emulator-boot-timeout: 1200'),
    workflowContents.includes('script: pnpm example:android-instrumentation'),
    readmeContents.includes('Android Instrumentation workflow'),
    readmeContents.includes('enables KVM permissions'),
    readmeContents.includes('extended boot timeout'),
    readmeContents.includes('pnpm example:android-instrumentation'),
    readmeContents.includes('API 35 Google APIs emulator'),
  ];

  return {
    ok: checks.every(Boolean),
    label: 'HEIC/HEIF/AVIF emulator instrumentation validation is wired',
    detail: checks.every(Boolean)
      ? 'androidTest assets, API 34+ codec sample assertions, package script, KVM/boot-timeout workflow setup, and README are present'
      : 'expected androidTest setup, package script, workflow snippets, or README documentation are missing/mismatched',
  };
}

function checkAvifFixtures() {
  const manifest = readJson('android/src/test/assets/avif/manifest.json');
  const packageJson = readJson('package.json');
  const scriptContents = readText('scripts/generate-avif-fixtures.mjs');
  const source = manifest.source;
  const sourcePath = source?.path;
  const sourceBytes = sourcePath ? readBinary(sourcePath) : null;
  const sourceDimensions = sourceBytes ? readPngDimensions(sourceBytes) : null;
  const sourceHash = sourceBytes ? sha256(sourceBytes) : null;
  const fixture = manifest.generatedFixtures?.[0];
  const fixturePath = fixture?.targetPath;
  const fixtureBytes = fixturePath ? readBinary(fixturePath) : null;
  const checks = [
    manifest.schemaVersion === 1,
    manifest.description?.includes('AVIF fixture'),
    source?.format === 'png',
    sourcePath === 'android/src/test/assets/avif/source.png',
    source?.byteSize === sourceBytes?.length,
    source?.sha256 === sourceHash,
    source?.dimensions?.width === sourceDimensions?.width,
    source?.dimensions?.height === sourceDimensions?.height,
    source?.provenance?.owner === 'react-native-image-compression-kit',
    source?.provenance?.license === 'MIT',
    Array.isArray(manifest.generatedFixtures),
    manifest.generatedFixtures?.length === 1,
    fixture?.format === 'avif',
    fixture?.sourcePath === sourcePath,
    fixturePath === 'android/src/test/assets/avif/sample.avif',
    fixture?.byteSize === fixtureBytes?.length,
    fixture?.sha256 === (fixtureBytes ? sha256(fixtureBytes) : null),
    fixture?.dimensions?.width === sourceDimensions?.width,
    fixture?.dimensions?.height === sourceDimensions?.height,
    fixture?.generationCommand?.includes('heif-enc --quality 80 --avif source.png -o sample.avif'),
    fixture?.provenance?.generator === 'libheif heif-enc',
    fixture?.provenance?.generatorVersion === '1.23.0',
    fixture?.provenance?.license === 'MIT',
    packageJson.scripts?.['fixtures:avif'] === 'node scripts/generate-avif-fixtures.mjs',
    packageJson.scripts?.['fixtures:avif:check'] ===
      'node scripts/generate-avif-fixtures.mjs --check',
    scriptContents.includes('heif-enc'),
    scriptContents.includes('--avif'),
    scriptContents.includes('validateCommittedFixture'),
    scriptContents.includes('AVIF fixture manifest OK'),
  ];

  return {
    ok: checks.every(Boolean),
    label: 'AVIF fixture manifest and committed sample are consistent',
    detail: checks.every(Boolean)
      ? 'source PNG metadata, committed AVIF hash, package scripts, and generator checks are consistent'
      : 'expected AVIF source metadata, fixture metadata, package scripts, or generator snippets are missing/mismatched',
  };
}

function checkHeicHeifFixtures() {
  const manifest = readJson('android/src/test/assets/heic-heif/manifest.json');
  const packageJson = readJson('package.json');
  const scriptContents = readText('scripts/generate-heic-heif-fixtures.mjs');
  const source = manifest.source;
  const sourcePath = source?.path;
  const sourceBytes = sourcePath ? readBinary(sourcePath) : null;
  const sourceDimensions = sourceBytes ? readPngDimensions(sourceBytes) : null;
  const sourceHash = sourceBytes ? sha256(sourceBytes) : null;
  const generatedFixtures = manifest.generatedFixtures ?? [];
  const expectedFormats = generatedFixtures.map((fixture) => fixture.format).sort().join(',');
  const fixtureChecks = generatedFixtures.map((fixture) => {
    const expectedFileName = `sample.${fixture.format}`;
    const expectedTargetPath = `android/src/test/assets/heic-heif/${expectedFileName}`;
    const targetPath = typeof fixture.targetPath === 'string' ? fixture.targetPath : '';
    const targetExists = targetPath.length > 0 && existsSync(path.join(ROOT, targetPath));
    const targetBytes = targetExists ? readBinary(targetPath) : null;
    const targetSha256 = targetBytes ? sha256(targetBytes) : null;

    return [
      fixture.sourcePath === sourcePath,
      targetPath === expectedTargetPath,
      typeof fixture.byteSize === 'number',
      fixture.byteSize === targetBytes?.length,
      typeof fixture.sha256 === 'string',
      fixture.sha256 === targetSha256,
      fixture.dimensions?.width === sourceDimensions?.width,
      fixture.dimensions?.height === sourceDimensions?.height,
      fixture.provenance?.generator === 'libheif heif-enc',
      fixture.provenance?.generatorVersion === '1.23.0',
      fixture.provenance?.source === 'repo-owned source.png',
      fixture.provenance?.license === 'MIT',
      fixture.provenance?.status === 'committed fixture generated from repo-owned source',
      typeof fixture.generationCommand === 'string' &&
        fixture.generationCommand.includes(
          `heif-enc --quality 80 source.png -o ${expectedFileName}`
        ),
    ].every(Boolean);
  });
  const checks = [
    manifest.schemaVersion === 1,
    manifest.description?.includes('committed samples'),
    source?.format === 'png',
    sourcePath === 'android/src/test/assets/heic-heif/source.png',
    source?.byteSize === sourceBytes?.length,
    source?.sha256 === sourceHash,
    source?.dimensions?.width === sourceDimensions?.width,
    source?.dimensions?.height === sourceDimensions?.height,
    source?.provenance?.owner === 'react-native-image-compression-kit',
    typeof source?.provenance?.license === 'string',
    expectedFormats === 'heic,heif',
    fixtureChecks.length === 2,
    fixtureChecks.every(Boolean),
    packageJson.scripts?.['fixtures:heic-heif'] ===
      'node scripts/generate-heic-heif-fixtures.mjs',
    packageJson.scripts?.['fixtures:heic-heif:check'] ===
      'node scripts/generate-heic-heif-fixtures.mjs --check',
    scriptContents.includes('heif-enc'),
    scriptContents.includes('CHECK_ONLY'),
    scriptContents.includes('readPngDimensions'),
    scriptContents.includes('validateCommittedFixture'),
    scriptContents.includes('byteSize must be recorded for committed binary fixtures'),
  ];

  return {
    ok: checks.every(Boolean),
    label: 'HEIC/HEIF fixture manifest and committed samples are consistent',
    detail:
      checks.every(Boolean)
        ? 'source PNG metadata, committed fixture hashes, package scripts, and generator checks are consistent'
        : 'expected source PNG metadata, committed fixture metadata, package scripts, or generator snippets are missing/mismatched',
  };
}

function collectEnvironmentReport() {
  const java = runCommand('java', ['-version']);
  const androidSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const gradle =
    resolveGradleCommand(path.join(ROOT, 'example/android')) ??
    resolveGradleCommand(path.join(ROOT, 'android'));

  return [
    {
      ok: java.status === 0,
      label: 'Java runtime available',
      detail: java.status === 0 ? firstLine(java.stderr || java.stdout) : 'java -version failed or Java is not installed',
    },
    {
      ok: Boolean(androidSdk && existsSync(androidSdk)),
      label: 'Android SDK path available',
      detail: androidSdk ? androidSdk : 'ANDROID_HOME or ANDROID_SDK_ROOT is not set',
    },
    {
      ok: Boolean(gradle),
      label: 'Gradle executable available',
      detail: gradle ? gradle.display : 'no local gradlew or gradle command found',
    },
  ];
}

function resolveGradleCommand(cwd) {
  const wrapperName = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
  const wrapperPath = path.join(cwd, wrapperName);

  if (existsSync(wrapperPath)) {
    return {
      command: wrapperPath,
      args: [],
      display: wrapperPath,
    };
  }

  const gradle = runCommand('gradle', ['--version']);
  if (gradle.status === 0) {
    return {
      command: 'gradle',
      args: [],
      display: 'gradle on PATH',
    };
  }

  return null;
}

function runCommand(command, args) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function readText(filePath) {
  return readFileSync(path.join(ROOT, filePath), 'utf8');
}

function readBinary(filePath) {
  return readFileSync(path.join(ROOT, filePath));
}

function readPngDimensions(bytes) {
  const pngSignature = '89504e470d0a1a0a';

  if (bytes.subarray(0, 8).toString('hex') !== pngSignature) {
    return null;
  }
  if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
    return null;
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function printSection(title) {
  console.log('');
  console.log(title);
}

function printCheck(check) {
  console.log(`${check.ok ? 'OK' : 'MISSING'} ${check.label}: ${check.detail}`);
}

function firstLine(value) {
  return value.split(/\r?\n/).find((line) => line.trim().length > 0) ?? 'available';
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

main();
