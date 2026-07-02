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
  'example/ios/cocoapods_pathname_workaround.rb',
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
    packageJson.version === '0.2.7',
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
    readmeContents.includes('The latest npm `latest` dist-tag is `react-native-image-compression-kit@0.2.7`'),
    readmeContents.includes('GitHub Release [v0.2.7]'),
    readmeContents.includes('The `0.2.7` package is published for `react-native-image-compression-kit`'),
    readmeContents.includes('version `0.2.0` is the published iOS native JPEG MVP release'),
    readmeContents.includes('version `0.2.1` is the published iOS JPEG target-size release'),
    readmeContents.includes('version `0.2.2` is the published iOS PNG output release'),
    readmeContents.includes('version `0.2.3` is the published iOS GIF static first-frame input release'),
    readmeContents.includes('version `0.2.4` is the published iOS WebP static first-frame input release'),
    readmeContents.includes('version `0.2.5` is the published iOS runtime-gated WebP output release'),
    readmeContents.includes('version `0.2.6` is the published iOS runtime-gated WebP target-size release'),
    readmeContents.includes('version `0.2.7` is the published iOS HEIC/HEIF static input release'),
    readmeContents.includes('Development scripts, Android JVM tests, instrumentation tests, and codec fixtures are intentionally excluded from the publish tarball.'),
    readmeContents.includes('Install from npm:'),
    readmeContents.includes('- [x] Public npm release.'),
  ];

  return {
    ok: checks.every(Boolean),
    label: 'npm package metadata and README status are aligned for the v0.2.7 release',
    detail: checks.every(Boolean)
      ? 'name, version, license, repository, bugs, homepage, exports, peer dependency, keywords, and README publish status are aligned'
      : 'expected package.json release metadata or README published-status guidance is missing/mismatched',
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
    '## v0.2.7',
    'Status: published to npm on July 2, 2026, tagged as `v0.2.7`.',
    'This release keeps Android runtime behavior unchanged while adding iOS',
    'HEIC/HEIF input support to the existing iOS ImageIO-backed static decode path',
    'Support HEIC/HEIF input on iOS through ImageIO static image decode.',
    'Reuse the existing iOS resize, JPEG quality, JPEG `output.maxBytes`, PNG output, runtime-gated WebP output, and runtime-available WebP `output.maxBytes` paths.',
    'Report iOS HEIC and HEIF capabilities as `input=true` and `output=false`.',
    '`package.json` version bump to `0.2.7`.',
    'iOS `compressImage()` now accepts HEIC and HEIF source data for JPEG and PNG output.',
    'iOS HEIC/HEIF input is decoded through ImageIO with `CGImageSourceCreateImageAtIndex` as a static image before resize and output encoding.',
    'HEIC/HEIF input to JPEG output keeps resize, `output.quality`, and JPEG `output.maxBytes` behavior.',
    'HEIC/HEIF input can be re-encoded to runtime-available WebP output when ImageIO advertises a WebP destination type.',
    'iOS `getImageCompressionCapabilities()` reports HEIC `input=true` / `output=false` and HEIF `input=true` / `output=false`',
    'The iOS unsupported-input error surface now lists JPEG, PNG, GIF, WebP, HEIC, and HEIF input as supported and leaves AVIF on the unsupported path.',
    'The iOS host-app smoke validates `compress-heic-to-jpeg`, `compress-heif-to-jpeg`, `compress-heic-to-png`, `compress-heif-to-png`',
    'The iOS host-app smoke removes HEIC and HEIF from the unsupported-input rejection loop and keeps AVIF input rejected with `ERR_UNSUPPORTED_FORMAT`.',
    'TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF/WebP/HEIC/HEIF input with JPEG, PNG, and runtime-gated ImageIO-backed WebP output in version `0.2.7`.',
    'HEIC/HEIF output on iOS.',
    'AVIF input or output on iOS.',
    'Live Photo, depth, burst, or animation handling.',
    'Release commit validation before npm publish:',
    'Commit: `0cb815e3e584f53688e264398b61028ba307eca9`.',
    'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28564636404>.',
    'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28564636383>.',
    'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28564636447>.',
    'Completed after npm publish and GitHub Release creation:',
    '`npm publish --tag latest` published `react-native-image-compression-kit@0.2.7`.',
    'Git tag: `v0.2.7`',
    'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.7>.',
    '## v0.2.6',
    'Status: published to npm on July 2, 2026 at 03:36:53 UTC (12:36:53 KST), tagged as `v0.2.6`.',
    'adding iOS WebP',
    'target-size `output.maxBytes` support to the runtime-gated ImageIO-backed WebP',
    "Support `output.format: 'webp'` with `output.maxBytes` on iOS runtimes that advertise ImageIO WebP destination encoding.",
    'Reuse the existing iOS target-size quality search for both JPEG and runtime-available WebP output.',
    'Keep WebP output unavailable runtimes on the existing capability-gated `ERR_NOT_IMPLEMENTED` path.',
    '`package.json` version bump to `0.2.6`.',
    'iOS WebP output now accepts `output.maxBytes` when ImageIO advertises a WebP destination type.',
    'iOS target-size encoding now shares one quality-search helper for JPEG and runtime-available WebP output.',
    'WebP target-size compression treats `quality` as the upper quality bound and returns the highest WebP quality that fits under `maxBytes`',
    'iOS PNG output still rejects `output.maxBytes` with `ERR_NOT_IMPLEMENTED`.',
    'iOS runtimes without ImageIO WebP destination support still reject `output.format: \'webp\'` before any WebP target-size work.',
    'iOS WebP capability notes now state that runtime-available WebP output supports target-size `maxBytes` by adjusting WebP quality.',
    'The iOS host-app smoke now follows the WebP output capability: it validates `compress-webp-to-webp-max-bytes`',
    'The example app enables the Max bytes input for WebP output on platforms where WebP output is currently reported as available.',
    'TypeScript native-unavailable messaging now mentions iOS JPEG and runtime-available WebP target-size `maxBytes` in version `0.2.6`.',
    'README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.',
    'Source-level tests and the Android verification doctor expectations are updated for the iOS WebP target-size path.',
    'npm package publication under the `latest` dist-tag.',
    'Git tag `v0.2.6` and GitHub Release `v0.2.6`.',
    'Before npm publish:',
    'Candidate implementation validation before release promotion:',
    'Commit: `bd4003f18b705416b8d662ca837d8746656fe706`.',
    'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28561479567>.',
    'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28561479544>.',
    'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28561479519>.',
    'RNICK_IOS_SMOKE_STEP_PASS reject-webp-output-unavailable',
    'RNICK_IOS_SMOKE_STEP_PASS reject-webp-output',
    'webpOutputAvailable: false',
    'targetSizeResultBytes: 996',
    "unsupportedOutputs: ['webp', 'heic', 'heif', 'avif']",
    'The `compress-webp-to-webp-max-bytes` success branch remains capability-gated',
    'Local pre-publish gate completed successfully before npm publish',
    'Completed after npm publish and GitHub Release creation:',
    '`npm publish --tag latest` published `react-native-image-compression-kit@0.2.6`.',
    '`latest` dist-tag `0.2.6`',
    'publish timestamp `2026-07-02T03:36:53.452Z`',
    'npm package: `react-native-image-compression-kit@0.2.6`',
    'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.6.tgz`',
    'npm integrity: `sha512-WbGBG6LnOHEKaWSVhSG0dC+fe8PTs5DxQUAw+kmI69MhHZCLlGfsDNBmYGs4YYQKCsGT7peglmBWVPwduD9ILg==`',
    'npm shasum: `3d978c4650c854dbd18115fb9062e909b9eb63f3`',
    'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.6>.',
    'Registry tarball dry-run confirmed 49 files, 44.6 kB package size, and 193.1 kB unpacked size.',
    'External registry install smoke installed `react-native-image-compression-kit@0.2.6`',
    '## v0.2.5',
    'Status: published to npm on July 2, 2026 at 02:14:56 UTC (11:14:56 KST), tagged as `v0.2.5`.',
    'adding iOS',
    'runtime-gated iOS ImageIO-backed WebP output path to the existing iOS',
    'Verify that iOS can advertise WebP destination support through ImageIO before enabling WebP output.',
    'Implement iOS WebP output for JPEG, PNG, static first-frame GIF, and static first-frame WebP input when the runtime supports WebP destination encoding.',
    '`package.json` version bump to `0.2.5`.',
    "iOS `compressImage()` now accepts `output.format: 'webp'` when ImageIO advertises a WebP destination type through `CGImageDestinationCopyTypeIdentifiers()`.",
    'iOS WebP output is encoded with ImageIO `CGImageDestinationCreateWithData`, `CGImageDestinationAddImage`, and `CGImageDestinationFinalize`.',
    'WebP output keeps existing iOS resize behavior, honors `output.quality`, writes `.webp` cache files, and re-encodes without copying source metadata under `safe` and `strip`.',
    'JPEG, PNG, GIF, and WebP input can be re-encoded to WebP output on runtimes that advertise an ImageIO WebP destination type.',
    'The GitHub Actions iOS Validation runner with Xcode 16.4 and the iPhoneSimulator18.5 SDK currently does not advertise a WebP destination type',
    'iOS WebP output rejects `output.maxBytes` with `ERR_NOT_IMPLEMENTED` because target-size WebP compression remains outside this candidate.',
    'iOS `getImageCompressionCapabilities()` reports WebP `input=true` and runtime WebP `output=true` only when ImageIO destination encoding is available.',
    'The iOS host-app smoke now follows the WebP output capability',
    'TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF/WebP input with JPEG, PNG, and runtime-gated ImageIO-backed WebP output in version `0.2.5`.',
    'README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.',
    'npm package publication under the `latest` dist-tag.',
    'Git tag `v0.2.5` and GitHub Release `v0.2.5`.',
    'Android runtime behavior changes.',
    'WebP target-size `maxBytes` on iOS.',
    'Animated WebP preservation.',
    'iOS HEIC, HEIF, or AVIF input.',
    'Candidate implementation validation before release promotion:',
    'Release commit validation before npm publish:',
    'Completed after npm publish and GitHub Release creation:',
    'npm publish --tag latest',
    'react-native-image-compression-kit@0.2.5',
    'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.5>.',
    'External registry install smoke installed `react-native-image-compression-kit@0.2.5`',
    '## v0.2.4',
    'Status: published to npm on July 2, 2026 at 01:03:13 UTC (10:03:13 KST), tagged as `v0.2.4`.',
    'adding iOS WebP',
    'static first-frame input to the existing iOS JPEG/PNG/GIF input and JPEG/PNG',
    'Implement iOS WebP input without changing the public TypeScript API.',
    'Decode WebP input as a static first frame and route it through the existing iOS resize, JPEG quality, JPEG target-size `maxBytes`, PNG output, and metadata no-copy behavior.',
    '`package.json` version bump to `0.2.4`.',
    'iOS `compressImage()` now accepts WebP input for JPEG and PNG output.',
    'iOS WebP input is decoded with ImageIO as a static first frame through `CGImageSourceCreateImageAtIndex`.',
    'WebP input to JPEG output keeps resize, `output.quality`, and JPEG `output.maxBytes` behavior.',
    'WebP input to PNG output keeps resize behavior and re-encodes without copying source metadata.',
    'iOS `getImageCompressionCapabilities()` reports WebP `input=true` and `output=false`.',
    'The iOS host-app smoke validates `compress-webp-to-jpeg` and `compress-webp-to-png`, and removes WebP from the unsupported-input rejection loop.',
    'The iOS host-app smoke keeps `reject-webp-output` as an `ERR_NOT_IMPLEMENTED` native output capability check because WebP output is not implemented on iOS.',
    'TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF/WebP input and static first-frame GIF/WebP support.',
    'README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.',
    'Android runtime behavior changes.',
    'npm package publication under the `latest` dist-tag.',
    'Git tag `v0.2.4` and GitHub Release `v0.2.4`.',
    'WebP output on iOS.',
    'Animated WebP preservation.',
    'iOS HEIC, HEIF, or AVIF input.',
    'Before npm publish:',
    'Candidate implementation validation before release promotion:',
    'Commit: `7bad5ac9032aaaf8147e67572a20cda046b87c50`.',
    'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28500059159>.',
    'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28500059163>.',
    'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28500059174>.',
    'RNICK_IOS_SMOKE_STEP_PASS compress-webp-to-jpeg',
    'RNICK_IOS_SMOKE_STEP_PASS compress-webp-to-png',
    'RNICK_IOS_SMOKE_STEP_PASS reject-webp-output',
    'webpResultBytes: 836',
    'webpToPngResultBytes: 248',
    "unsupportedInputs: ['heic', 'heif', 'avif']",
    "unsupportedOutputs: ['webp', 'heic', 'heif', 'avif']",
    'Release commit validation before npm publish:',
    'Commit: `e62557b99a1ebf3bcbd879af21fc2ccc163d11a2`.',
    'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28557446734>.',
    'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28557446741>.',
    'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28557446723>.',
    '`pnpm release:dry-run` completed successfully before npm publish, including `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, `pnpm pack --dry-run`, packed consumer smoke, and `pnpm publish --dry-run --no-git-checks`.',
    'Completed after npm publish and GitHub Release creation:',
    '`pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.4`.',
    '`latest` dist-tag `0.2.4`',
    'publish timestamp `2026-07-02T01:03:13.919Z`',
    'npm package: `react-native-image-compression-kit@0.2.4`',
    'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.4.tgz`',
    'npm integrity: `sha512-f6cqSgAbvx0jg7soLOgiCWsc+e1MwpTN6/mV7T5yKbLsU64ENMmBvR6PBiW2s8KU2UxDCTUDVXU4SBRK/eC62A==`',
    'npm shasum: `5fca25a4a94937e59b089b46599705af77cf2ba0`',
    'contains 49 files, 44.0 kB package size, and 186.9 kB unpacked size',
    'The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.',
    'fresh temporary consumer project installed `react-native-image-compression-kit@0.2.4`',
    'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.4>.',
    '## v0.2.3',
    'Status: published to npm on July 1, 2026 at 06:09:45 UTC (15:09:45 KST), tagged as `v0.2.3`.',
    'adding iOS GIF',
    'static first-frame input to the existing iOS JPEG/PNG input and JPEG/PNG output',
    '`package.json` version bump to `0.2.3`.',
    'iOS `compressImage()` now accepts GIF input for JPEG and PNG output.',
    'iOS GIF input is decoded with ImageIO as a static first frame through `CGImageSourceCreateImageAtIndex`.',
    'GIF input to JPEG output keeps resize, `output.quality`, and JPEG `output.maxBytes` behavior.',
    'GIF input to PNG output keeps resize behavior and re-encodes without copying source metadata.',
    'iOS `getImageCompressionCapabilities()` reports GIF `input=true` and `output=false`.',
    'The iOS host-app smoke validates `compress-gif-to-jpeg` and `compress-gif-to-png`, and removes GIF from the unsupported-input rejection loop.',
    'The iOS host-app smoke keeps `reject-gif-output` as an `ERR_INVALID_OPTIONS` TypeScript validation check because GIF output is not part of the public output format surface.',
    'TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF input and static first-frame GIF support.',
    'README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.',
    '### Release Checklist',
    'Before npm publish:',
    'Actual implementation validation before the release commit:',
    'Commit: `62a1c3fb4763f5977592c8e7c917246ce6be2fe2`.',
    'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28493712854>.',
    'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28493712886>.',
    'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28493712935>.',
    'RNICK_IOS_SMOKE_STEP_PASS compress-gif-to-jpeg',
    'RNICK_IOS_SMOKE_STEP_PASS compress-gif-to-png',
    'RNICK_IOS_SMOKE_STEP_PASS reject-gif-output',
    'gifResultBytes: 840',
    'gifToPngResultBytes: 331',
    "unsupportedInputs: ['webp', 'heic', 'heif', 'avif']",
    'Release commit validation before npm publish:',
    'Commit: `8d2394dfaf4b5ba5bc322fd766328624b7abc92d`.',
    'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28496763807>.',
    'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28496763836>.',
    'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28496763804>.',
    'npm pack react-native-image-compression-kit@0.2.3 --json',
    'Completed after npm publish and GitHub Release creation:',
    '`pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.3`.',
    '`latest` dist-tag `0.2.3`',
    'publish timestamp `2026-07-01T06:09:45.481Z`',
    'npm package: `react-native-image-compression-kit@0.2.3`',
    'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.3.tgz`',
    'npm integrity: `sha512-ns/m3ZmUdTyT+kVWjCWEzWMVE0Ydu9VtWkm361pg6TEpufEN6ImV9tK9e7iSmlwjvmeZESlUiduGdAr/7rJEXQ==`',
    'npm shasum: `d420053faf7d4e460c4cd41c99fb489c6d017dbd`',
    'contains 49 files, 43.7 kB package size, and 185.0 kB unpacked size',
    'The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.',
    'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.3>.',
    '## v0.2.2',
    'Status: published to npm on June 30, 2026 at 10:50:12 UTC (19:50:12 KST), tagged as `v0.2.2`.',
    'adding PNG output',
    'to the existing iOS JPEG/PNG input MVP',
    '`package.json` version bump to `0.2.2`.',
    "iOS `compressImage()` now accepts `output.format: 'png'` for JPEG and PNG input.",
    'iOS PNG output is encoded with `UIImagePNGRepresentation()` into the app cache directory.',
    'iOS PNG output rejects `output.maxBytes` with `ERR_NOT_IMPLEMENTED`.',
    'iOS `getImageCompressionCapabilities()` reports PNG `input=true` and `output=true`.',
    'The iOS host-app smoke validates JPEG-to-PNG and PNG-to-PNG output, plus PNG `maxBytes` rejection.',
    'TypeScript native-unavailable messaging now mentions iOS JPEG/PNG output support.',
    'New public API surface.',
    '### Release Checklist',
    'Actual implementation validation before the release commit:',
    'Commit: `8ff9345a882243459bb6c1d44a2b4c1802296370`.',
    'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28436846165>.',
    'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28436846207>.',
    'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28436846121>.',
    'RNICK_IOS_SMOKE_STEP_PASS compress-jpeg-to-png',
    'RNICK_IOS_SMOKE_STEP_PASS compress-png-to-png',
    'RNICK_IOS_SMOKE_STEP_PASS reject-png-max-bytes',
    'jpegToPngResultBytes: 805',
    'pngToPngResultBytes: 672',
    'unsupportedOutputs` excluding `png`',
    'Release commit validation before npm publish:',
    'Commit: `8b00f730a9a9d4e37afe78434943ec69556dba80`.',
    'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28438265776>.',
    'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28438265781>.',
    'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28438265837>.',
    'npm pack react-native-image-compression-kit@0.2.2',
    '`pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.2`.',
    '`latest` dist-tag `0.2.2`',
    'publish timestamp `2026-06-30T10:50:12.131Z`',
    'npm package: `react-native-image-compression-kit@0.2.2`',
    'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.2.tgz`',
    'npm integrity: `sha512-E7fzlLfMxAJhQim1xFbX9b5aEIFDtifHNYNlk7IM5+LrDgtINAR4moUe8MrPglfjJ/zpZAxcDH5eL6IlFzgzlQ==`',
    'npm shasum: `0bf7a4c554745d557e31787a78869895945d46df`',
    'contains 49 files, 43.2 kB package size, and 182.2 kB unpacked size',
    'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.2>.',
    '## v0.2.1',
    'Status: published to npm on June 30, 2026 at 09:37:20 UTC (18:37:20 KST), tagged as `v0.2.1`.',
    'adding iOS JPEG',
    'target-size compression to the existing iOS JPEG MVP',
    '`package.json` version bump to `0.2.1`.',
    'iOS `compressImage()` now accepts `output.maxBytes` for JPEG output.',
    'iOS JPEG target-size compression validates `maxBytes` as a positive integer',
    'iOS `getImageCompressionCapabilities()` reports `supportsTargetSizeCompression: true`.',
    'TypeScript native-unavailable messaging now mentions iOS JPEG target-size support.',
    'New public API surface.',
    'Actual implementation validation before the release commit:',
    'Commit: `ab85c398e4aa266dc98bd7eb4f20ae59dcdebd78`.',
    'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432011263>.',
    'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432011301>.',
    'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432011306>.',
    'Release commit validation before npm publish:',
    'Commit: `fee74b895e471a2132b3f233dad7b9a5797c237f`.',
    'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432929488>.',
    'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432929458>.',
    'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432929468>.',
    'RNICK_IOS_SMOKE_STEP_PASS compress-jpeg-to-jpeg-max-bytes',
    'targetSizeResultBytes: 996',
    'npm pack react-native-image-compression-kit@0.2.1',
    '`pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.1`.',
    '`latest` dist-tag `0.2.1`',
    'npm package: `react-native-image-compression-kit@0.2.1`',
    'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.1.tgz`',
    'npm integrity: `sha512-4gJD35dySJmtRKHfUW23iLNbFrv7R8ow1trLOl7BHQXduHIP49+AuSYewexTa39vGnl/pniANpMVwFEUgVtZlA==`',
    'npm shasum: `8b5bd26e2fe46b9b6b340b72a656beb41ad798f9`',
    'contains 49 files, 42.9 kB package size, and 180.5 kB unpacked size',
    'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.1>.',
    '## v0.2.0',
    'Status: published to npm on June 30, 2026 at 07:04:03 UTC (16:04:03 KST), tagged as `v0.2.0`.',
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
    'Focused TypeScript and source-level native foundation test expectation updates for the `0.2.0` release.',
    'npm package publication under the `latest` dist-tag.',
    'Git tag `v0.2.0` and GitHub Release `v0.2.0`.',
    'Android runtime behavior changes.',
    'HEIC / HEIF / AVIF / GIF / WebP input on iOS.',
    'iOS target-size compression.',
    'iOS metadata preservation.',
    '### Published Artifacts',
    'npm package: `react-native-image-compression-kit@0.2.0`',
    'npm integrity: `sha512-YUsh/bwcU/ScsWu5RGQT/CEZaQ6dL9xCgoYfHOHalJkEeWicv9lT7HqEGhle84EUTLL8a8T3vefw+fso7kPj6Q==`',
    'Git tag: `v0.2.0`',
    'GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.0`',
    'Published tarball size: 41.1 kB package size, 176.1 kB unpacked size, 49 files.',
    'The `v0.2.0` release completed these checks before npm publish',
    'pnpm pack --dry-run',
    'native smoke test that links the pod and compresses a JPEG and PNG source to',
    'Actual iOS host-app validation result for the implementation candidate:',
    'GitHub Actions iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28424614173>.',
    'Runtime smoke evidence: `RNICK_IOS_SMOKE_PASS` with `jpegResultBytes: 946`, `pngResultBytes: 1034`',
    "unsupportedInputs: ['webp', 'heic', 'heif', 'avif', 'gif']",
    '### Publish Commands',
    'pnpm publish --tag latest',
    'npm pack react-native-image-compression-kit@0.2.0',
    '### Post-publish Verification',
    '`pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.0`.',
    '`latest` dist-tag `0.2.0`',
    'publish timestamp `2026-06-30T07:04:03.022Z`',
    'shasum `850a32e69d3c398e58b129ea330bc3d5a27eb5fd`',
    'fresh temporary consumer project installed `react-native-image-compression-kit@0.2.0`',
    'GitHub Release `v0.2.0` was created at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.0`.',
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
    'See [RELEASE.md](RELEASE.md) for the v0.2.7 release notes, v0.2.6 release notes, v0.2.5 release notes, v0.2.4 release notes, v0.2.3 release notes, v0.2.2 release notes, v0.2.1 release notes, v0.2.0 published release notes, v0.1.2 published patch notes, v0.1.1 docs-only patch notes, v0.1.0 published artifact details, tag checklist, and post-publish security review.',
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
  const ok = packageJson.version === '0.2.7' && missing.length === 0;

  return {
    ok,
    label: 'v0.2.7 release notes and previous release notes are current',
    detail: ok
      ? 'RELEASE.md documents the release scope, non-goals, validation checklist, published artifacts, and previous npm publish steps'
      : `missing release notes snippets or version mismatch: ${[
          ...missing,
          ...(packageJson.version === '0.2.7' ? [] : ['package.json version 0.2.7']),
        ].join(' | ')}`,
  };
}

function checkSecurityPolicy() {
  const securityContents = readText('SECURITY.md');
  const readmeContents = readText('README.md');
  const expectedSnippets = [
    [securityContents, '# Security Policy'],
    [securityContents, '| 0.2.x | Yes |'],
    [securityContents, '| 0.1.x | No |'],
    [securityContents, 'Please do not include exploit details, secrets, private keys, or sensitive'],
    [securityContents, 'The npm package is intended to avoid install-time code execution.'],
    [securityContents, '`preinstall`, `install`, `postinstall`, `prepare`'],
    [securityContents, 'Development-only scripts, tests,'],
    [securityContents, 'fixtures, example apps, build directories, credentials, `.npmrc`, `.env*`, keys,'],
    [securityContents, 'pnpm release:dry-run'],
    [securityContents, 'pnpm audit --prod'],
    [securityContents, 'npm pack react-native-image-compression-kit@<version>'],
    [securityContents, '## Dependency Triage'],
    [securityContents, 'validation toolchain'],
    [securityContents, 'The `example/Gemfile` Ruby dependencies are used for local and GitHub Actions'],
    [securityContents, 'Ruby 3.1 or newer'],
    [securityContents, 'pins ActiveSupport'],
    [securityContents, 'Concurrent Ruby to patched minimum versions'],
    [securityContents, '### v0.2.0 Post-Release Alert Classification'],
    [securityContents, 'no npm runtime advisories from'],
    [securityContents, 'Alerts #2, #3, and #4'],
    [securityContents, 'activesupport >= 7.2.3.1'],
    [securityContents, 'Alerts #5, #6, and #7'],
    [securityContents, 'concurrent-ruby >= 1.3.7'],
    [readmeContents, '## Security'],
    [readmeContents, 'See [SECURITY.md](SECURITY.md) for supported versions, vulnerability reporting guidance, dependency triage, and package security hygiene.'],
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
        ? 'SECURITY.md and README document reporting, supported versions, dependency triage, install-time script avoidance, tarball exclusions, and audit checks'
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
    'RCTImageCompressionKitWebPFormat = @"webp"',
    'RCTImageCompressionKitGifFormat = @"gif"',
    'RCTImageCompressionKitHeicFormat = @"heic"',
    'RCTImageCompressionKitHeifFormat = @"heif"',
    'RCTImageCompressionKitAvifFormat = @"avif"',
    'RCTImageCompressionKitDefaultMetadataPolicy = @"safe"',
    'RCTImageCompressionKitStripMetadataPolicy = @"strip"',
    'RCTImageCompressionKitPreserveMetadataPolicy = @"preserve"',
    'iOS MVP supports JPEG input and JPEG output through UIKit/ImageIO.',
    'iOS MVP supports PNG input and PNG output through UIKit/ImageIO.',
    'PNG output preserves alpha where the processed image contains transparency.',
    'PNG output ignores quality and does not support target-size maxBytes.',
    'iOS MVP decodes GIF input as a static first frame through ImageIO.',
    'GIF input can be re-encoded to JPEG or PNG output without copying source metadata.',
    'Animated GIF preservation and GIF output are not implemented.',
    'iOS MVP decodes WebP input as a static first frame through ImageIO.',
    'WebP input can be re-encoded to JPEG, PNG, or WebP output without copying source metadata.',
    'WebP output uses ImageIO CGImageDestination when the runtime advertises a WebP destination type.',
    'Runtime-available WebP output supports target-size maxBytes by adjusting WebP quality.',
    'Animated WebP preservation is not implemented.',
    'iOS MVP decodes %@ input as a static image through ImageIO.',
    '%@ input can be re-encoded to JPEG or PNG output without copying source metadata.',
    '%@ input can also be re-encoded to runtime-available WebP output.',
    '%@ output is not implemented.',
    'iOS MVP supports JPEG, PNG, static GIF, static WebP, static HEIC, and static HEIF input with JPEG, PNG, or runtime ImageIO-backed WebP output only.',
    'RCT_EXPORT_MODULE(ImageCompressionKit)',
    'compressImage:(JS::NativeImageCompressionKit::NativeCompressionOptions &)options',
    'compressImageWithDictionary:optionsMap',
    'iOS MVP supports JPEG, PNG, and WebP output only. Call getImageCompressionCapabilities() before selecting a platform output format.',
    'iOS MVP requires ImageIO WebP destination support for WebP output on this runtime.',
    'iOS MVP supports output.maxBytes for JPEG and runtime-available WebP output only.',
    'RCTImageCompressionKitReadMaxBytes',
    'Compression output.maxBytes must be a positive integer.',
    'RCTImageCompressionKitEncodeToTargetSize',
    'RCTImageCompressionKitEncodeQualityOutput',
    'bestWithinTargetData',
    'RCTImageCompressionKitWebPOutputTypeIdentifier',
    'RCTImageCompressionKitCanEncodeWebP',
    'CGImageDestinationCopyTypeIdentifiers',
    'CGImageDestinationCreateWithData',
    'CGImageDestinationAddImage',
    'CGImageDestinationFinalize',
    'kCGImageDestinationLossyCompressionQuality',
    'RCTImageCompressionKitEncodeWebP',
    'iOS MVP does not support metadata preserve yet. Use safe or strip metadata on iOS.',
    'Compression output.quality must be an integer from 0 to 100.',
    'Compression resize.mode must be one of: contain, cover, stretch.',
    'iOS MVP supports file:// and content:// image URIs only.',
    'iOS MVP could not read the source image URI.',
    'iOS MVP supports JPEG, PNG, GIF, WebP, HEIC, and HEIF input only. GIF, WebP, HEIC, and HEIF input are decoded as static images through ImageIO.',
    'iOS MVP could not decode the source image.',
    'iOS MVP could not encode %@ output.',
    'CGImageSourceCreateWithData',
    'CGImageSourceCreateImageAtIndex',
    'RCTImageCompressionKitDecodeImage',
    'RCTImageCompressionKitIsGifType',
    'RCTImageCompressionKitIsWebPType',
    'RCTImageCompressionKitIsHeicType',
    'RCTImageCompressionKitIsHeifType',
    'RCTImageCompressionKitIsHeicHeifType',
    'RCTImageCompressionKitShouldDecodeFirstFrame',
    'com.compuserve.gif',
    'public.gif',
    'org.webmproject.webp',
    'public.webp',
    'public.heic',
    'public.heics',
    'org.iso.heic',
    'org.iso.heics',
    'public.heif',
    'public.heifs',
    'org.iso.heif',
    'org.iso.heifs',
    'UIImage imageWithData',
    'UIImageJPEGRepresentation',
    'UIImagePNGRepresentation',
    'UIGraphicsImageRenderer',
    'dispatch_get_main_queue()',
    'RNICK_IOS_SMOKE_NATIVE',
    'NSCachesDirectory',
    'ImageCompressionKit',
    'RCTImageCompressionKitRenderImage',
    'RCTImageCompressionKitResizeModeContain',
    'RCTImageCompressionKitResizeModeCover',
    'RCTImageCompressionKitResizeModeStretch',
    'RCTImageCompressionKitReadSourceData',
    'RCTImageCompressionKitIsSupportedInputType',
    '@"metadataPolicies" : @[RCTImageCompressionKitDefaultMetadataPolicy, RCTImageCompressionKitStripMetadataPolicy]',
    '@"supportsTargetSizeCompression" : @YES',
    '@"supportsCancellation" : @NO',
  ];
  const missing = expectedSnippets.filter((snippet) => !iosContents.includes(snippet));
  const podspecIncludesIOS =
    podspecContents.includes('s.platforms = { :ios => "13.4" }') &&
    podspecContents.includes('s.source_files = "ios/**/*.{h,m,mm}"');

  return {
    ok: missing.length === 0 && podspecIncludesIOS,
    label: 'iOS native module implements the JPEG/PNG/GIF/WebP/HEIC/HEIF MVP path',
    detail:
      missing.length === 0 && podspecIncludesIOS
        ? 'iOS source includes file/content URI reads, JPEG/PNG/GIF/WebP/HEIC/HEIF input detection, static ImageIO GIF/WebP/HEIC/HEIF decode, resize, quality-based and target-size JPEG output, PNG output, ImageIO-backed WebP output, explicit unsupported-option errors, and iOS capability reporting'
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
  const podfileWorkaroundContents = readText('example/ios/cocoapods_pathname_workaround.rb');
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
    [readmeContents, 'pathname contains null byte'],
    [readmeContents, 'local CocoaPods pathname workaround for pnpm-symlinked pods'],
    [readmeContents, 'RNICK_IOS_POD_INSTALL_ATTEMPTS'],
    [readmeContents, 'RNICK_IOS_METRO_READY_TIMEOUT_MS'],
    [readmeContents, "metadataPolicies: ['safe', 'strip']"],
    [readmeContents, 'GIF input with no GIF output, WebP input with capability-driven output'],
    [readmeContents, 'HEIC input with no HEIC output, HEIF input with no HEIF output'],
    [readmeContents, 'JPEG, PNG, GIF, WebP, HEIC, and HEIF fixtures compress to JPEG output'],
    [readmeContents, 'JPEG, PNG, GIF, WebP, HEIC, and HEIF fixtures compress to PNG output'],
    [readmeContents, 'when ImageIO advertises a WebP destination type, JPEG, PNG, GIF, WebP, HEIC, and HEIF fixtures also compress to WebP output and WebP `output.maxBytes` succeeds with `byteSize <= maxBytes`'],
    [readmeContents, 'GIF, WebP, HEIC, and HEIF JPEG output run through the `output.maxBytes` path'],
    [readmeContents, 'when ImageIO does not advertise a WebP destination type, `output.format: \'webp\'` rejects with `ERR_NOT_IMPLEMENTED`'],
    [readmeContents, 'AVIF input rejects with `ERR_UNSUPPORTED_FORMAT`'],
    [readmeContents, 'HEIC, HEIF, and AVIF output reject with `ERR_NOT_IMPLEMENTED`'],
    [readmeContents, 'GIF output remains rejected by TypeScript validation with `ERR_INVALID_OPTIONS`'],
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
    [validationScriptContents, 'POD_INSTALL_MAX_ATTEMPTS'],
    [validationScriptContents, 'pathname contains null byte'],
    [validationScriptContents, 'cleanPodInstallArtifacts'],
    [validationScriptContents, 'iOS pod install diagnostics:'],
    [validationScriptContents, 'RNICK_IOS_METRO_READY_TIMEOUT_MS'],
    [validationScriptContents, 'METRO_READY_TIMEOUT_MS'],
    [validationScriptContents, 'xcodebuild'],
    [validationScriptContents, "['exec', 'pod', 'install']"],
    [validationScriptContents, 'ImageCompressionKitExample.xcworkspace'],
    [validationScriptContents, 'simctl'],
    [validationScriptContents, 'RNICK_IOS_SMOKE'],
    [validationScriptContents, '--rnick-ios-smoke'],
    [appContents, 'runIOSHostAppSmokeValidation'],
    [appContents, 'emitIOSSmokeLog'],
    [appContents, 'RNICK_IOS_SMOKE_START'],
    [appContents, 'RNICK_IOS_SMOKE_STEP_START'],
    [appContents, 'ERR_IOS_SMOKE_TIMEOUT'],
    [appContents, 'RNICK_IOS_SMOKE_PASS'],
    [appContents, 'copySamplePngToCache'],
    [appContents, 'copySampleHeicToCache'],
    [appContents, 'copySampleHeifToCache'],
    [appContents, 'copy-gif-fixture'],
    [appContents, 'copy-webp-fixture'],
    [appContents, 'copy-heic-fixture'],
    [appContents, 'copy-heif-fixture'],
    [appContents, 'copyUnsupportedImageToCache'],
    [appContents, "assertIOSFormatCapability(capabilities, 'gif', true, false)"],
    [appContents, "assertIOSFormatCapability(capabilities, 'webp', true)"],
    [appContents, "assertIOSFormatCapability(capabilities, 'heic', true, false)"],
    [appContents, "assertIOSFormatCapability(capabilities, 'heif', true, false)"],
    [appContents, 'webpOutputAvailable'],
    [appContents, 'compress-gif-to-jpeg'],
    [appContents, 'compress-gif-to-png'],
    [appContents, 'compress-webp-to-jpeg'],
    [appContents, 'compress-webp-to-png'],
    [appContents, 'compress-heic-to-jpeg'],
    [appContents, 'compress-heif-to-jpeg'],
    [appContents, 'compress-heic-to-png'],
    [appContents, 'compress-heif-to-png'],
    [appContents, 'compress-jpeg-to-webp'],
    [appContents, 'compress-png-to-webp'],
    [appContents, 'compress-gif-to-webp'],
    [appContents, 'compress-webp-to-webp'],
    [appContents, 'compress-heic-to-webp'],
    [appContents, 'compress-heif-to-webp'],
    [appContents, 'reject-webp-output-unavailable'],
    [appContents, 'reject-gif-output'],
    [appContents, 'compress-webp-to-webp-max-bytes'],
    [appContents, 'gifResultBytes'],
    [appContents, 'gifToPngResultBytes'],
    [appContents, 'webpResultBytes'],
    [appContents, 'webpToPngResultBytes'],
    [appContents, 'heicResultBytes'],
    [appContents, 'heifResultBytes'],
    [appContents, 'heicToPngResultBytes'],
    [appContents, 'heifToPngResultBytes'],
    [appContents, 'jpegToWebPResultBytes'],
    [appContents, 'pngToWebPResultBytes'],
    [appContents, 'gifToWebPResultBytes'],
    [appContents, 'webpToWebPResultBytes'],
    [appContents, 'heicToWebPResultBytes'],
    [appContents, 'heifToWebPResultBytes'],
    [appContents, 'webpTargetSizeResultBytes'],
    [appContents, "const unsupportedInputs = ['avif']"],
    [appContents, 'const unsupportedOutputCases = ['],
    [appContents, 'Expected iOS JPEG target-size compression to be supported.'],
    [appContents, 'compress-jpeg-to-jpeg-max-bytes'],
    [appContents, 'compress-jpeg-to-png'],
    [appContents, 'compress-png-to-png'],
    [appContents, 'reject-png-max-bytes'],
    [appContents, 'Expected iOS GIF target-size output <= ${targetSizeMaxBytes} bytes'],
    [appContents, 'Expected iOS WebP output target-size <= ${targetSizeMaxBytes} bytes'],
    [appContents, 'Expected iOS HEIC target-size output <= ${targetSizeMaxBytes} bytes'],
    [appContents, 'Expected iOS HEIF target-size output <= ${targetSizeMaxBytes} bytes'],
    [appContents, 'Expected GIF output to be rejected before native compression.'],
    [appContents, 'Expected iOS target-size output <= ${targetSizeMaxBytes} bytes'],
    [appContents, 'Expected PNG maxBytes to be unsupported on iOS.'],
    [appContents, "Expected metadata: 'preserve' to be unimplemented on iOS."],
    [iosModuleContents, 'RCT_EXPORT_MODULE();'],
    [iosModuleContents, 'isSmokeTestEnabled'],
    [iosModuleContents, 'copySampleJpegToCache'],
    [iosModuleContents, 'copySamplePngToCache'],
    [iosModuleContents, 'copySampleHeicToCache'],
    [iosModuleContents, 'copySampleHeifToCache'],
    [iosModuleContents, 'copyUnsupportedImageToCache'],
    [iosModuleContents, 'logSmokeEvent'],
    [iosModuleContents, 'RNICK_IOS_SMOKE'],
    [iosModuleContents, '--rnick-ios-smoke'],
    [iosModuleContents, 'NSLog'],
    [iosModuleContents, 'UIImageJPEGRepresentation'],
    [iosModuleContents, 'PNGDataWithActions'],
    [iosModuleContents, '"gif"'],
    [iosModuleContents, '"webp"'],
    [iosModuleContents, '"heic"'],
    [iosModuleContents, '"heif"'],
    [iosModuleContents, '"avif"'],
    [projectContents, 'ExampleImageSource.m in Sources'],
    [podfileContents, "require_relative './cocoapods_pathname_workaround'"],
    [podfileContents, 'use_native_modules!'],
    [podfileContents, 'use_react_native!'],
    [podfileWorkaroundContents, 'module RNICKCocoaPodsPathnameWorkaround'],
    [podfileWorkaroundContents, 'base_path.cleanpath'],
    [podfileWorkaroundContents, 'Pod::Project.prepend'],
    [gemfileContents, "ruby '>= 3.1.0'"],
    [gemfileContents, "gem 'cocoapods'"],
    [gemfileContents, "gem 'activesupport', '>= 7.2.3.1'"],
    [gemfileContents, "gem 'concurrent-ruby', '>= 1.3.7'"],
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
