#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectDocumentation } from './docs-semantic-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODE = process.argv[2] ?? 'doctor';
const APP_ANDROID_DIR_ENV = 'RNICK_ANDROID_APP_DIR';
const GRADLE_TASK_ENV = 'RNICK_ANDROID_GRADLE_TASK';

const REQUIRED_FILES = [
  'package.json',
  'README.md',
  'RELEASE.md',
  'SECURITY.md',
  'docs/release-evidence/README.md',
  'docs/release-evidence/registry-provenance.md',
  'docs/release-evidence/policy-review.md',
  'docs/release-evidence/review-archive.md',
  'docs/release-evidence/acquisition.md',
  'docs/supply-chain/action-pins.md',
  'docs/releases/0.2-history.md',
  'docs/verification-architecture.md',
  'scripts/docs-semantic-core.mjs',
  'scripts/verify-docs.mjs',
  'Dockerfile',
  '.dockerignore',
  '.github/workflows/ci.yml',
  '.github/workflows/ios-validation.yml',
  '.github/workflows/action-pin-review.yml',
  '.github/workflows/release-evidence-policy-review.yml',
  '.github/actions-lock.json',
  '.github/dependabot.yml',
  'src/NativeImageCompressionKit.ts',
  'ios/RCTImageCompressionImageDecoder.h',
  'ios/RCTImageCompressionImageDecoder.mm',
  'ios/RCTImageCompressionImageEncoder.h',
  'ios/RCTImageCompressionImageEncoder.mm',
  'ios/RCTImageCompressionImageTransformer.h',
  'ios/RCTImageCompressionImageTransformer.mm',
  'ios/RCTImageCompressionInput.h',
  'ios/RCTImageCompressionInputInspector.mm',
  'ios/RCTImageCompressionIOSCapabilities.h',
  'ios/RCTImageCompressionIOSCapabilities.mm',
  'ios/RCTImageCompressionJpegMetadata.h',
  'ios/RCTImageCompressionJpegMetadata.mm',
  'ios/RCTImageCompressionOutput.h',
  'ios/RCTImageCompressionOutput.mm',
  'ios/RCTImageCompressionPipeline.h',
  'ios/RCTImageCompressionPipeline.mm',
  'ios/RCTImageCompressionDefaultPipeline.mm',
  'ios/RCTImageCompressionRequest.h',
  'ios/RCTImageCompressionRequest.mm',
  'ios/RCTImageCompressionSourceResolver.mm',
  'ios/RCTImageCompressionUIKitImageDecoder.mm',
  'ios/RCTImageCompressionUIKitImageEncoder.mm',
  'ios/RCTImageCompressionUIKitImageTransformer.mm',
  'android/build.gradle',
  'android/src/main/java/com/imagecompressionkit/AndroidBitmapTransformer.kt',
  'android/src/main/java/com/imagecompressionkit/AndroidImageDecoder.kt',
  'android/src/main/java/com/imagecompressionkit/AndroidImageSourceResolver.kt',
  'android/src/main/java/com/imagecompressionkit/AndroidCompressionRequest.kt',
  'android/src/main/java/com/imagecompressionkit/AndroidAvifOutputHelper.kt',
  'android/src/main/java/com/imagecompressionkit/AndroidAvifOutputPrototype.kt',
  'android/src/main/java/com/imagecompressionkit/JpegExifMetadata.kt',
  'android/src/main/java/com/imagecompressionkit/ImageCompressionOutput.kt',
  'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt',
  'android/src/main/java/com/imagecompressionkit/ImageCompressionKitPackage.kt',
  'android/src/androidTest/java/com/imagecompressionkit/ImageCompressionKitHeicHeifInstrumentationTest.kt',
  'android/src/test/java/com/imagecompressionkit/AndroidAvifOutputHelperTest.kt',
  'android/src/test/java/com/imagecompressionkit/AndroidBitmapTransformerTest.kt',
  'android/src/test/java/com/imagecompressionkit/AndroidImageDecoderTest.kt',
  'android/src/test/java/com/imagecompressionkit/AndroidImageSourceResolverTest.kt',
  'android/src/test/java/com/imagecompressionkit/AndroidCompressionRequestParserTest.kt',
  'android/src/test/java/com/imagecompressionkit/AndroidAvifOutputPrototypeTest.kt',
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
  'scripts/registry-smoke-test.mjs',
  'scripts/docker-android.mjs',
  'scripts/ios-smoke-contract.mjs',
  'scripts/ios-smoke-pass-replay-fixture.mjs',
  'scripts/refresh-ios-smoke-pass-replay.mjs',
  'scripts/ios-validation.mjs',
  'scripts/generate-avif-fixtures.mjs',
  'scripts/generate-heic-heif-fixtures.mjs',
  'scripts/release-dry-run.mjs',
  'scripts/release-evidence-core.mjs',
  'scripts/verify-release-evidence.mjs',
  'scripts/release-evidence-import-core.mjs',
  'scripts/import-release-evidence.mjs',
  'scripts/release-evidence-acquisition-core.mjs',
  'scripts/github-attestation-transport.mjs',
  'scripts/release-evidence-acquisition-github.mjs',
  'scripts/acquire-release-evidence.mjs',
  'scripts/refresh-release-evidence-acquisition-fixtures.mjs',
  'scripts/release-evidence-policy-core.mjs',
  'scripts/prepare-release-evidence-policy.mjs',
  'scripts/promote-release-evidence-policy.mjs',
  'scripts/release-evidence-review-core.mjs',
  'scripts/review-release-evidence-policy.mjs',
  'scripts/verify-release-evidence-review.mjs',
  'scripts/release-evidence-review-attestation-core.mjs',
  'scripts/verify-release-evidence-review-attestation.mjs',
  'scripts/artifact-zip-core.mjs',
  'scripts/release-evidence-review-archive-core.mjs',
  'scripts/import-release-evidence-review-archive.mjs',
  'scripts/verify-release-evidence-review-archive.mjs',
  'scripts/release-evidence-review-archive-set-core.mjs',
  'scripts/verify-release-evidence-review-archive-set.mjs',
  'scripts/release-evidence-review-acquisition-core.mjs',
  'scripts/release-evidence-review-acquisition-github.mjs',
  'scripts/acquire-release-evidence-review.mjs',
  'scripts/check-release-evidence-review-acquisition-fixture.mjs',
  'scripts/release-evidence-set-core.mjs',
  'scripts/verify-release-evidence-set.mjs',
  'scripts/workflow-supply-chain-core.mjs',
  'scripts/verify-workflow-supply-chain.mjs',
  'scripts/action-pin-provenance-core.mjs',
  'scripts/action-pin-attestation-core.mjs',
  'scripts/github-attestation-cli.mjs',
  'scripts/action-pin-review-github.mjs',
  'scripts/review-action-pin.mjs',
  'scripts/verify-action-pin-provenance.mjs',
  'scripts/verify-action-pin-attestation.mjs',
  'test/releaseDryRun.test.mjs',
  'test/docsSemantic.test.mjs',
  'test/packageContract.test.ts',
  'test/androidSourceContract.test.ts',
  'test/iosSourceContract.test.ts',
  'test/ios-native/RCTImageCompressionImageEncoderTests.mm',
  'test/ios-native/RCTImageCompressionOutputTests.mm',
  'test/ios-native/RCTImageCompressionPipelineTests.mm',
  'test/ios-native/RCTImageCompressionJpegMetadataTests.mm',
  'test/ios-native/RCTImageCompressionImageTransformerTests.mm',
  'test/verificationArchitecture.test.ts',
  'test/releaseEvidence.test.mjs',
  'test/releaseEvidenceImport.test.mjs',
  'test/releaseEvidenceAcquisition.test.mjs',
  'test/githubAttestationTransport.test.mjs',
  'test/releaseEvidencePolicy.test.mjs',
  'test/releaseEvidenceReview.test.mjs',
  'test/releaseEvidenceReviewArchive.test.mjs',
  'test/releaseEvidenceReviewArchiveSet.test.mjs',
  'test/releaseEvidenceReviewAcquisition.test.mjs',
  'test/releaseEvidenceSet.test.mjs',
  'test/workflowSupplyChain.test.mjs',
  'test/actionPinProvenance.test.mjs',
  'test/actionPinAttestation.test.mjs',
  'test/fixtures/action-pin-review/action-pin-provenance.json',
  'test/fixtures/action-pin-review/artifact-manifest.json',
  'test/fixtures/action-pin-review/action-pin-review-workflow.yml',
  'test/fixtures/action-pin-review/github-execution.json',
  'test/fixtures/action-pin-review/workflow-dispatch-event.json',
  'test/fixtures/action-pin-review/baseline-actions-lock.json',
  'test/fixtures/action-pin-review/candidate-actions-lock.json',
  'test/fixtures/action-pin-review/tag-reference.json',
  'test/fixtures/action-pin-attestation/attestation-verification.json',
  'test/fixtures/action-pin-attestation/attestation.jsonl',
  'test/fixtures/action-pin-attestation/trusted-root.jsonl',
  'test/fixtures/github/action-pin-review-workflow-dispatch.json',
  'evidence/npm/0.2.50/release-evidence-index.json',
  'evidence/npm/0.2.50/provenance/bundle-manifest.json',
  'evidence/npm/0.2.50/provenance/package.tgz',
  'evidence/npm/0.2.50/provenance/registry-provenance.json',
  'evidence/npm/0.2.50/provenance/stdout.json',
  'evidence/npm/0.2.50/attestation/attestation-verification.json',
  'evidence/npm/0.2.50/attestation/attestation.jsonl',
  'evidence/npm/0.2.50/attestation/trusted-root.jsonl',
  'evidence/npm/0.2.55/release-evidence-index.json',
  'evidence/npm/0.2.55/provenance/bundle-manifest.json',
  'evidence/npm/0.2.55/provenance/package.tgz',
  'evidence/npm/0.2.55/provenance/registry-provenance.json',
  'evidence/npm/0.2.55/provenance/stdout.json',
  'evidence/npm/0.2.55/attestation/attestation-verification.json',
  'evidence/npm/0.2.55/attestation/attestation.jsonl',
  'evidence/npm/0.2.55/attestation/trusted-root.jsonl',
  'evidence/npm/0.2.62/release-evidence-index.json',
  'evidence/npm/0.2.62/provenance/bundle-manifest.json',
  'evidence/npm/0.2.62/provenance/package.tgz',
  'evidence/npm/0.2.62/provenance/registry-provenance.json',
  'evidence/npm/0.2.62/provenance/stdout.json',
  'evidence/npm/0.2.62/attestation/attestation-verification.json',
  'evidence/npm/0.2.62/attestation/attestation.jsonl',
  'evidence/npm/0.2.62/attestation/trusted-root.jsonl',
  'evidence/npm/0.3.0/release-evidence-index.json',
  'evidence/npm/0.3.0/provenance/bundle-manifest.json',
  'evidence/npm/0.3.0/provenance/package.tgz',
  'evidence/npm/0.3.0/provenance/registry-provenance.json',
  'evidence/npm/0.3.0/provenance/stdout.json',
  'evidence/npm/0.3.0/attestation/attestation-verification.json',
  'evidence/npm/0.3.0/attestation/attestation.jsonl',
  'evidence/npm/0.3.0/attestation/trusted-root.jsonl',
  'evidence/reviews/0.2.55/review-evidence-index.json',
  'evidence/reviews/0.2.55/artifacts/review.zip',
  'evidence/reviews/0.2.55/artifacts/attestation.zip',
  'evidence/reviews/0.2.55/review/review-receipt.json',
  'evidence/reviews/0.2.55/review/artifact-manifest.json',
  'evidence/reviews/0.2.55/review/archive-set/0.2.55/release-evidence-index.json',
  'evidence/reviews/0.2.55/attestation/attestation-verification.json',
  'evidence/reviews/0.2.55/attestation/attestation.jsonl',
  'evidence/reviews/0.2.55/attestation/trusted-root.jsonl',
  'evidence/reviews/0.2.62/review-evidence-index.json',
  'evidence/reviews/0.2.62/artifacts/review.zip',
  'evidence/reviews/0.2.62/artifacts/attestation.zip',
  'evidence/reviews/0.2.62/review/review-receipt.json',
  'evidence/reviews/0.2.62/review/artifact-manifest.json',
  'evidence/reviews/0.2.62/review/archive-set/0.2.62/release-evidence-index.json',
  'evidence/reviews/0.2.62/attestation/attestation-verification.json',
  'evidence/reviews/0.2.62/attestation/attestation.jsonl',
  'evidence/reviews/0.2.62/attestation/trusted-root.jsonl',
  'evidence/reviews/0.3.0/review-evidence-index.json',
  'evidence/reviews/0.3.0/artifacts/review.zip',
  'evidence/reviews/0.3.0/artifacts/attestation.zip',
  'evidence/reviews/0.3.0/review/review-receipt.json',
  'evidence/reviews/0.3.0/review/artifact-manifest.json',
  'evidence/reviews/0.3.0/review/archive-set/0.3.0/release-evidence-index.json',
  'evidence/reviews/0.3.0/attestation/attestation-verification.json',
  'evidence/reviews/0.3.0/attestation/attestation.jsonl',
  'evidence/reviews/0.3.0/attestation/trusted-root.jsonl',
  'test/fixtures/release-evidence-acquisition/0.2.50/provenance.zip',
  'test/fixtures/release-evidence-acquisition/0.2.50/attestation.zip',
  'test/fixtures/release-evidence-acquisition/0.2.55/provenance.zip',
  'test/fixtures/release-evidence-acquisition/0.2.55/attestation.zip',
  'test/fixtures/release-evidence-acquisition/0.2.62/provenance.zip',
  'test/fixtures/release-evidence-acquisition/0.2.62/attestation.zip',
  'test/fixtures/release-evidence-acquisition/0.3.0/provenance.zip',
  'test/fixtures/release-evidence-acquisition/0.3.0/attestation.zip',
  'test/iosSmokeLifecycle.test.mjs',
  'test/iosSmokeCliTimeout.test.mjs',
  'test/iosSmokeContract.test.mjs',
  'test/iosSmokePassReplayFixture.test.mjs',
  'test/iosSmokeSummaryCli.test.mjs',
  'test/ios-native/RCTImageCompressionRequestTests.mm',
  'test/ios-native/RCTImageCompressionInputTests.mm',
  'test/ios-native/RCTImageCompressionImageDecoderTests.mm',
  'test/fixtures/ios-smoke-pass-ci-replay.json',
  'vitest.config.ts',
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
    checkDocumentationSemantics(),
    checkCodegenConfig(),
    checkSpecFile(),
    checkPackageFiles(),
    checkAndroidGradleConfig(),
    checkAndroidRuntimeAuthorities(),
    checkIOSRuntimeAuthorities(),
    checkIOSInputAuthorities(),
    checkIOSImageDecoderAuthorities(),
    checkIOSImageTransformerAuthorities(),
    checkIOSJpegMetadataAuthorities(),
    checkIOSImageEncoderAuthorities(),
    checkIOSOutputAuthorities(),
    checkIOSPipelineAuthorities(),
    checkHeicHeifFixtures(),
    checkAvifFixtures(),
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

function checkDocumentationSemantics() {
  const packageJson = readJson('package.json');
  const report = inspectDocumentation(ROOT);
  const packageChecks = [
    packageJson.name === 'react-native-image-compression-kit',
    packageJson.license === 'MIT',
    packageJson.repository?.url ===
      'git+https://github.com/GGULBAE/react-native-image-compression-kit.git',
    packageJson.exports?.['.']?.types === './lib/index.d.ts',
    packageJson.exports?.['.']?.default === './lib/index.js',
    packageJson.exports?.['./package.json'] === './package.json',
    packageJson.peerDependencies?.['react-native'] === '>=0.73 <1.0',
    packageJson.scripts?.['docs:check'] === 'node scripts/verify-docs.mjs',
  ];
  const ok = report.ok && packageChecks.every(Boolean);

  return {
    ok,
    label: 'package metadata and documentation semantics are aligned',
    detail: ok
      ? `release target ${report.status.releaseTarget} ${report.status.releaseState}, published npm latest ${report.status.publishedNpmLatest} checked ${report.status.registryCheckedAt}, package/README/RELEASE aligned to the manifest, required headings/links/commands/files, local anchors, README limits, and npm exclusions passed`
      : `semantic documentation mismatch: ${[
          ...report.errors,
          ...(packageChecks.every(Boolean) ? [] : ['package metadata contract']),
        ].join(' | ')}`,
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
  const forbiddenEntries = ['android', 'android/src', '.github', 'scripts', 'evidence'];
  const hasRequiredEntries = requiredEntries.every((entry) => files.includes(entry));
  const excludesDevelopmentEntries = forbiddenEntries.every((entry) => !files.includes(entry));

  return {
    ok: hasRequiredEntries && excludesDevelopmentEntries,
    label: 'npm package file globs avoid development-only files',
    detail:
      hasRequiredEntries && excludesDevelopmentEntries
        ? 'publish entries include runtime native source, JS build output, Codegen source, README, SECURITY, and LICENSE without workflows, locks, Android tests, fixtures, repo scripts, or release evidence'
        : 'expected package.json files to include runtime source and docs, without android, android/src, .github, scripts, or evidence',
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

function checkAndroidRuntimeAuthorities() {
  const transformerContents = readText(
    'android/src/main/java/com/imagecompressionkit/AndroidBitmapTransformer.kt'
  );
  const decoderContents = readText(
    'android/src/main/java/com/imagecompressionkit/AndroidImageDecoder.kt'
  );
  const sourceResolverContents = readText(
    'android/src/main/java/com/imagecompressionkit/AndroidImageSourceResolver.kt'
  );
  const requestContents = readText(
    'android/src/main/java/com/imagecompressionkit/AndroidCompressionRequest.kt'
  );
  const moduleContents = readText(
    'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
  );
  const packageContents = readText(
    'android/src/main/java/com/imagecompressionkit/ImageCompressionKitPackage.kt'
  );
  const packageJson = readJson('package.json');
  const testAuthorities = [
    {
      file: 'android/src/test/java/com/imagecompressionkit/AndroidBitmapTransformerTest.kt',
      minimum: 5,
      required: [
        'appliesAllEightExifOrientations',
        'keepsIdentityAndNoUpscaleRequestsAsSameBitmap',
        'centerCropUsesTheCenteredSourceRegion',
        'recyclesOriginalRotatedScaledAndCroppedBitmapsExactlyOnce',
      ],
    },
    {
      file: 'android/src/test/java/com/imagecompressionkit/AndroidImageSourceResolverTest.kt',
      minimum: 4,
      required: [
        'readsFileSizeExtensionAndStream',
        'readsContentMimeExtensionAndCountedSizeWithClosedStreams',
        'preservesStableErrorsForUnreadableFileAndContentSources',
      ],
    },
    {
      file: 'android/src/test/java/com/imagecompressionkit/AndroidImageDecoderTest.kt',
      minimum: 4,
      required: [
        'decodesJpegIntoImmutableInputInfoInStableSourceOrder',
        'rejectsUnavailablePlatformFormatsBeforeOpeningDecodeStreams',
        'treatsSupportedHeifAndAvifInputsAsDecodeCandidates',
      ],
    },
    {
      file: 'android/src/test/java/com/imagecompressionkit/AndroidCompressionRequestParserTest.kt',
      minimum: 5,
      required: [
        'parsesDefaultsIntoImmutableTypedRequest',
        'rejectsInvalidValuesWithStableErrorContracts',
        'mapsMalformedReadableMapTypesToStableNativeFailure',
      ],
    },
    {
      file: 'android/src/test/java/com/imagecompressionkit/ImageCompressionKitModuleTest.kt',
      minimum: 20,
      required: [
        'compressImageCreatesJpegPngAndWebpOutputsWithExpectedResultMetadata',
        'compressImageAppliesExifOrientationBeforeResizeModesAndNormalizesOutputExif',
        'compressImageHonorsJpegAndWebpMaxBytesAndReportsFileMetadata',
      ],
    },
    {
      file: 'android/src/test/java/com/imagecompressionkit/ImageCompressionOutputTest.kt',
      minimum: 5,
      required: [
        'encodedOutputsContainExpectedByteSignaturesAndResultMetadataMatchesFile',
        'capabilitiesExposeJpegPngWebpGifHeicHeifAvifInputsAndJpegPngWebpOutputsOnly',
      ],
    },
    {
      file: 'android/src/test/java/com/imagecompressionkit/JpegExifMetadataTest.kt',
      minimum: 3,
      required: [
        'safeMetadataCopiesAllowlistedExifAndFiltersSensitiveTags',
        'preserveMetadataCopiesSensitiveExifButNormalizesOutputGeometry',
      ],
    },
    {
      file: 'android/src/test/java/com/imagecompressionkit/AndroidAvifOutputHelperTest.kt',
      minimum: 9,
      required: [
        'helperUsesInjectedMuxedDecodeBackSuccessForPassedSmokeContract',
        'helperUsesInjectedValidatorForDecodeBackFailureBlocker',
      ],
    },
    {
      file: 'android/src/test/java/com/imagecompressionkit/AndroidAvifOutputPrototypeTest.kt',
      minimum: 9,
      required: [
        'avifSignatureRecognizesFtypAvifOrAvisBrandOnly',
        'productionWiringScaffoldBlocksHelperEntryBeforeAvifOutputCanBeEnabled',
      ],
    },
    {
      file: 'android/src/androidTest/java/com/imagecompressionkit/ImageCompressionKitHeicHeifInstrumentationTest.kt',
      minimum: 3,
      required: [
        'compressesCommittedHeicHeifAndAvifSamplesToJpegPngAndWebp',
        'attemptsAndroidAvifOutputEncodeDecodeBackSmoke',
      ],
    },
  ];
  const authorityViolations = testAuthorities.flatMap((authority) => {
    const names = extractKotlinTestNames(readText(authority.file));
    return [
      ...(names.length < authority.minimum
        ? [`${authority.file}: expected at least ${authority.minimum} tests, found ${names.length}`]
        : []),
      ...authority.required
        .filter((name) => !names.includes(name))
        .map((name) => `${authority.file}: missing test ${name}`),
    ];
  });
  const compressStart = moduleContents.indexOf('override fun compressImage');
  const capabilitiesStart = moduleContents.indexOf(
    'override fun getImageCompressionCapabilities',
    compressStart
  );
  const compressLineCount =
    compressStart >= 0 && capabilitiesStart > compressStart
      ? moduleContents
          .slice(compressStart, capabilitiesStart)
          .split(/\r?\n/u).length
      : Number.POSITIVE_INFINITY;
  const structureChecks = [
    {
      ok: requestContents.includes(
        'internal data class AndroidCompressionRequest('
      ),
      name: 'typed Android compression request',
    },
    {
      ok: requestContents.includes(
        'internal object AndroidCompressionRequestParser'
      ),
      name: 'Android request parser boundary',
    },
    {
      ok: moduleContents.includes(
        'AndroidCompressionRequestParser.parse(options)'
      ),
      name: 'module request parser delegation',
    },
    {
      ok: sourceResolverContents.includes(
        'internal class AndroidImageSourceResolver('
      ) && sourceResolverContents.includes(
        'private val contentResolver: ContentResolver'
      ),
      name: 'ContentResolver-injected Android image source boundary',
    },
    {
      ok: decoderContents.includes(
        'internal data class AndroidImageInputInfo('
      ) && decoderContents.includes('internal class AndroidImageDecoder('),
      name: 'typed Android image decoder boundary',
    },
    {
      ok: moduleContents.includes('imageDecoder.decode('),
      name: 'module image decoder delegation',
    },
    {
      ok:
        transformerContents.includes(
          'internal data class AndroidBitmapTransformationResult('
        ) &&
        transformerContents.includes(
          'internal data class AndroidBitmapDimensions('
        ) &&
        transformerContents.includes('internal class AndroidBitmapTransformer(') &&
        transformerContents.includes('internal class AndroidBitmapOwnership('),
      name: 'typed Android bitmap transform and ownership boundary',
    },
    {
      ok: moduleContents.includes('bitmapTransformer.transform('),
      name: 'module bitmap transformer delegation',
    },
    {
      ok: moduleContents.split(/\r?\n/u).length <= 400,
      name: 'module source size boundary',
    },
    {
      ok: compressLineCount <= 70,
      name: 'compressImage orchestration size boundary',
    },
    {
      ok:
        !/contentResolver\.(?:query|getType|openInputStream|openAssetFileDescriptor)\(/u.test(
          moduleContents
        ) &&
        !moduleContents.includes('BitmapFactory') &&
        !/(?:import android\.graphics\.ImageDecoder|\bImageDecoder\.(?:decodeBitmap|createSource)\()/u.test(
          moduleContents
        ),
      name: 'source access and decode APIs isolated from module',
    },
    {
      ok: !/(?:Bitmap\.(?:createBitmap|createScaledBitmap)|\bMatrix\(|ExifInterface\.|\.recycle\()/u.test(
        moduleContents
      ),
      name: 'bitmap transforms isolated from module',
    },
    {
      ok: !/options\.(?:hasKey|isNull|getMap|getString|getDouble)\(/u.test(
        moduleContents
      ),
      name: 'ReadableMap access isolated to request parser',
    },
    {
      ok: /class ImageCompressionKitModule\([\s\S]*\)\s*:\s*NativeImageCompressionKitSpec\(reactContext\)/u.test(
        moduleContents
      ),
      name: 'generated module inheritance',
    },
    {
      ok: moduleContents.includes('override fun getName(): String = NAME'),
      name: 'module name override',
    },
    {
      ok: /const val NAME\s*=\s*"ImageCompressionKit"/u.test(moduleContents),
      name: 'stable module name',
    },
    {
      ok: packageContents.includes(
        'class ImageCompressionKitPackage : TurboReactPackage()'
      ),
      name: 'React package registration',
    },
    {
      ok: packageContents.includes('ImageCompressionKitModule(reactContext)'),
      name: 'module construction',
    },
    {
      ok:
        packageJson.scripts?.['example:android-unit-test'] ===
        'RNICK_ANDROID_APP_DIR=example/android RNICK_ANDROID_GRADLE_TASK=:react-native-image-compression-kit:testDebugUnitTest pnpm android:build',
      name: 'Android unit-test command',
    },
  ];
  const structureViolations = structureChecks
    .filter((check) => !check.ok)
    .map((check) => check.name);
  const violations = [...structureViolations, ...authorityViolations];

  return {
    ok: violations.length === 0,
    label: 'Android module wiring and executable test authorities are present',
    detail:
      violations.length === 0
        ? 'generated module registration is aligned and Kotlin unit/instrumentation authorities cover runtime behavior'
        : `contract violations: ${violations.join(' | ')}`,
  };
}

function extractKotlinTestNames(contents) {
  return [...contents.matchAll(/@Test[\s\S]*?\bfun\s+(\w+)\s*\(/gu)].map(
    (match) => match[1]
  );
}

function checkIOSRuntimeAuthorities() {
  const requestHeader = readText('ios/RCTImageCompressionRequest.h');
  const requestParser = readText('ios/RCTImageCompressionRequest.mm');
  const moduleContents = readText('ios/RCTImageCompressionKit.mm');
  const pipelineCore = readText('ios/RCTImageCompressionPipeline.mm');
  const defaultPipeline = readText(
    'ios/RCTImageCompressionDefaultPipeline.mm'
  );
  const nativeTests = readText(
    'test/ios-native/RCTImageCompressionRequestTests.mm'
  );
  const validationRunner = readText('scripts/ios-validation.mjs');
  const packageJson = readJson('package.json');
  const nativeTestNames = [
    ...nativeTests.matchAll(/static void (Test\w+)\(void\)/gu),
  ].map((match) => match[1]);
  const requiredNativeTests = [
    'TestParsesDefaultsIntoImmutableRequest',
    'TestParsesMetadataAndResizeMatrix',
    'TestRejectsMissingAndMalformedRequiredOptions',
    'TestRejectsInvalidQualityAndMaxBytes',
    'TestRejectsUnsupportedOutputAndStaticCombinations',
    'TestRejectsInvalidMetadataAndResizeMatrix',
  ];
  const methodStart = moduleContents.indexOf(
    '- (void)compressImageWithDictionary:'
  );
  const methodEnd = moduleContents.indexOf(
    '- (void)getImageCompressionCapabilities:',
    methodStart
  );
  const methodLineCount =
    methodStart >= 0 && methodEnd > methodStart
      ? moduleContents.slice(methodStart, methodEnd).split(/\r?\n/u).length
      : Number.POSITIVE_INFINITY;
  const structureChecks = [
    {
      ok: requestHeader.includes(
        '@interface RCTImageCompressionRequest : NSObject'
      ),
      name: 'immutable request model',
    },
    {
      ok: requestHeader.includes(
        '@interface RCTImageCompressionRequestParser : NSObject'
      ),
      name: 'request parser boundary',
    },
    {
      ok:
        requestHeader.includes(
          '@property (nonatomic, copy, readonly) NSString *sourceURI;'
        ) &&
        requestHeader.includes(
          '@property (nonatomic, readonly) RCTImageCompressionKitResizeOptions resizeOptions;'
        ),
      name: 'readonly request fields',
    },
    {
      ok:
        /\[\s*RCTImageCompressionRequestParser\s+parseOptions:options/u.test(
          defaultPipeline
        ) && pipelineCore.includes('self.requestParser('),
      name: 'default pipeline parser composition',
    },
    {
      ok: (moduleContents.match(/options\[@/gu) ?? []).length === 2,
      name: 'raw option access isolated from bridge',
    },
    {
      ok: moduleContents.split(/\r?\n/u).length <= 1_100,
      name: 'iOS bridge source size boundary',
    },
    {
      ok: methodLineCount <= 190,
      name: 'iOS compression orchestration size boundary',
    },
    {
      ok:
        !/#import <(?:UIKit|ImageIO|React)/u.test(requestParser) &&
        !/\b(?:RCTPromise|UIImage|CGImage)\b/u.test(requestParser) &&
        !requestParser.includes('[NSData dataWithContentsOf') &&
        !requestParser.includes('writeToFile:'),
      name: 'Foundation-only parser dependencies',
    },
    {
      ok:
        nativeTestNames.length === 6 &&
        requiredNativeTests.every((name) => nativeTestNames.includes(name)),
      name: 'table-driven native request test authority',
    },
    {
      ok:
        packageJson.scripts?.['example:ios:request-parser-test'] ===
        'node scripts/ios-validation.mjs request-parser-test',
      name: 'iOS request parser native-test command',
    },
    {
      ok:
        validationRunner.includes("if (mode === 'request-parser-test')") &&
        /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);/u.test(
          validationRunner
        ),
      name: 'native tests integrated into iOS smoke',
    },
  ];
  const violations = structureChecks
    .filter((check) => !check.ok)
    .map((check) => check.name)
    .filter(Boolean);

  return {
    ok: violations.length === 0,
    label: 'iOS request parser boundary and native-test authority are present',
    detail:
      violations.length === 0
        ? 'immutable Foundation-only request parsing is isolated, bridge size limits hold, and the smoke runner executes six native test groups'
        : `contract violations: ${violations.join(' | ')}`,
  };
}

function checkIOSInputAuthorities() {
  const inputHeader = readText('ios/RCTImageCompressionInput.h');
  const sourceResolver = readText(
    'ios/RCTImageCompressionSourceResolver.mm'
  );
  const inputInspector = readText(
    'ios/RCTImageCompressionInputInspector.mm'
  );
  const moduleContents = readText('ios/RCTImageCompressionKit.mm');
  const pipelineCore = readText('ios/RCTImageCompressionPipeline.mm');
  const defaultPipeline = readText(
    'ios/RCTImageCompressionDefaultPipeline.mm'
  );
  const nativeTests = readText(
    'test/ios-native/RCTImageCompressionInputTests.mm'
  );
  const validationRunner = readText('scripts/ios-validation.mjs');
  const packageJson = readJson('package.json');
  const nativeTestNames = [
    ...nativeTests.matchAll(/static void (Test\w+)\(void\)/gu),
  ].map((match) => match[1]);
  const requiredNativeTests = [
    'TestResolvesFileAndContentSourcesWithImmutableBytes',
    'TestRejectsUnsupportedSourceSchemesWithoutLoading',
    'TestClosesSecurityScopeForUnreadableAndEmptySources',
    'TestClosesSecurityScopeWhenLoaderThrows',
    'TestDefaultResolverReadsFileData',
    'TestClassifiesSupportedTypeIdentifierMatrix',
    'TestRejectsUnavailableAndSignatureOnlyAVIF',
    'TestRejectsUnknownAndUninspectableFormats',
    'TestPreservesSignatureClassificationOrder',
    'TestDefaultImageIOLoaderInspectsPNG',
    'TestInputLoaderComposesResolverAndInspector',
  ];
  const methodStart = moduleContents.indexOf(
    '- (void)compressImageWithDictionary:'
  );
  const methodEnd = moduleContents.indexOf(
    '- (void)getImageCompressionCapabilities:',
    methodStart
  );
  const methodLineCount =
    methodStart >= 0 && methodEnd > methodStart
      ? moduleContents.slice(methodStart, methodEnd).split(/\r?\n/u).length
      : Number.POSITIVE_INFINITY;
  const boundaryIdentifiers = [
    '@interface RCTImageCompressionSource : NSObject',
    '@interface RCTImageCompressionSourceResolver : NSObject',
    '@interface RCTImageCompressionInputInspection : NSObject',
    '@interface RCTImageCompressionInputInspector : NSObject',
    '@interface RCTImageCompressionInputLoader : NSObject',
  ];
  const directInputAPIs =
    /(?:startAccessingSecurityScopedResource|dataWithContentsOfURL|RCTImageCompressionKit(?:SourceURL|ReadSourceData|ImageType|LooksLikeAVIFData|IsSupportedInputType|IsJpegType))/u;
  const structureChecks = [
    {
      ok: boundaryIdentifiers.every((identifier) =>
        inputHeader.includes(identifier)
      ),
      name: 'immutable source and input boundary models',
    },
    {
      ok:
        /\[\s*RCTImageCompressionInputLoader\s+defaultLoader\]/u.test(
          defaultPipeline
        ) &&
        defaultPipeline.includes('loadSourceURI:sourceURI') &&
        defaultPipeline.includes('defaultAVIFInputAvailable') &&
        pipelineCore.includes('self.inputLoader('),
      name: 'default pipeline input loader composition',
    },
    {
      ok: !directInputAPIs.test(moduleContents),
      name: 'source acquisition and inspection APIs isolated from bridge',
    },
    {
      ok:
        !/#import <(?:ImageIO|UIKit|React)/u.test(sourceResolver) &&
        !/\b(?:RCTPromise|UIImage|CGImage)\b/u.test(sourceResolver),
      name: 'Foundation-only source resolver dependencies',
    },
    {
      ok:
        !/#import <(?:UIKit|React)/u.test(inputInspector) &&
        !/(?:startAccessingSecurityScopedResource|dataWithContentsOfURL|writeToFile:)/u.test(
          inputInspector
        ),
      name: 'ImageIO inspector excludes source and render dependencies',
    },
    {
      ok: moduleContents.split(/\r?\n/u).length <= 850,
      name: 'iOS bridge source size boundary after input extraction',
    },
    {
      ok: methodLineCount <= 140,
      name: 'iOS compression orchestration size after input extraction',
    },
    {
      ok:
        nativeTestNames.length === 11 &&
        requiredNativeTests.every((name) => nativeTestNames.includes(name)),
      name: 'table-driven native input test authority',
    },
    {
      ok:
        packageJson.scripts?.['example:ios:input-test'] ===
        'node scripts/ios-validation.mjs input-test',
      name: 'iOS input native-test command',
    },
    {
      ok:
        validationRunner.includes("if (mode === 'input-test')") &&
        /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);/u.test(
          validationRunner
        ),
      name: 'input tests integrated into iOS smoke',
    },
  ];
  const violations = structureChecks
    .filter((check) => !check.ok)
    .map((check) => check.name);

  return {
    ok: violations.length === 0,
    label: 'iOS source resolver, input inspector, and native tests are present',
    detail:
      violations.length === 0
        ? 'source lifecycle and ImageIO format inspection are isolated, bridge limits hold, and eleven native groups cover resolver/inspector behavior'
        : `contract violations: ${violations.join(' | ')}`,
  };
}

function checkIOSImageDecoderAuthorities() {
  const decoderHeader = readText('ios/RCTImageCompressionImageDecoder.h');
  const decoderCore = readText('ios/RCTImageCompressionImageDecoder.mm');
  const uiKitDecoder = readText(
    'ios/RCTImageCompressionUIKitImageDecoder.mm'
  );
  const capabilities = readText(
    'ios/RCTImageCompressionIOSCapabilities.mm'
  );
  const moduleContents = readText('ios/RCTImageCompressionKit.mm');
  const pipelineCore = readText('ios/RCTImageCompressionPipeline.mm');
  const defaultPipeline = readText(
    'ios/RCTImageCompressionDefaultPipeline.mm'
  );
  const nativeTests = readText(
    'test/ios-native/RCTImageCompressionImageDecoderTests.mm'
  );
  const validationRunner = readText('scripts/ios-validation.mjs');
  const packageJson = readJson('package.json');
  const nativeTestNames = [
    ...nativeTests.matchAll(/static void (Test\w+)\(void\)/gu),
  ].map((match) => match[1]);
  const requiredNativeTests = [
    'TestRoutesStaticAndFirstFrameFormats',
    'TestRejectsMissingAndInvalidDecodedImages',
    'TestRejectsWhenExecutorDoesNotRunOperation',
    'TestRunsDecodeAndValidationInsideExecutor',
    'TestRetainsDecodedImageAndCopiesErrors',
    'TestClearsExistingErrorOnSuccess',
  ];
  const methodStart = moduleContents.indexOf(
    '- (void)compressImageWithDictionary:'
  );
  const methodEnd = moduleContents.indexOf(
    '- (void)getImageCompressionCapabilities:',
    methodStart
  );
  const methodLineCount =
    methodStart >= 0 && methodEnd > methodStart
      ? moduleContents.slice(methodStart, methodEnd).split(/\r?\n/u).length
      : Number.POSITIVE_INFINITY;
  const boundaryIdentifiers = [
    '@interface RCTImageCompressionImageDecodeError : NSObject',
    '@interface RCTImageCompressionDecodedImage : NSObject',
    '@interface RCTImageCompressionImageDecoder : NSObject',
    'RCTImageCompressionOrdinaryImageDecoder',
    'RCTImageCompressionFirstFrameImageDecoder',
    'RCTImageCompressionDecodedImageValidator',
    'RCTImageCompressionImageDecodeExecutor',
  ];
  const forbiddenDecoderDependencies =
    /(?:RCTImageCompressionKit(?:Render|Encode|SourceImageProperties)|UIGraphicsImageRenderer|CGImageDestination|maxBytes|metadataPolicy|writeToFile:)/u;
  const directDecodeAPIs =
    /(?:\[UIImage\s+imageWithData:|CGImageSourceCreateImageAtIndex|RCTImageCompressionKitDecodeImage)/u;
  const structureChecks = [
    {
      ok: boundaryIdentifiers.every((identifier) =>
        decoderHeader.includes(identifier)
      ),
      name: 'immutable decoded image and error boundary models',
    },
    {
      ok:
        !/#import <(?:UIKit|ImageIO|React)/u.test(decoderCore) &&
        decoderCore.includes('input.shouldDecodeFirstFrame') &&
        decoderCore.includes('RCTImageCompressionKitDecodeFailedCode') &&
        decoderCore.includes(
          '@"iOS MVP could not decode the source image."'
        ),
      name: 'Foundation-only injected decoder orchestration',
    },
    {
      ok:
        uiKitDecoder.includes('CGImageSourceCopyPropertiesAtIndex') &&
        uiKitDecoder.includes('CGImageSourceCreateThumbnailAtIndex') &&
        uiKitDecoder.includes('kCGImageSourceThumbnailMaxPixelSize') &&
        uiKitDecoder.includes('RCTImageCompressionKitMaxSourcePixels') &&
        uiKitDecoder.includes('RCTImageCompressionKitMaxWorkingPixels') &&
        !/(?:#import <UIKit|\bUIImage\s+imageWithData|dispatch_get_main_queue)/u.test(
          uiKitDecoder
        ),
      name: 'background ImageIO downsampling and resource limits',
    },
    {
      ok: !forbiddenDecoderDependencies.test(
        `${decoderCore}\n${uiKitDecoder}`
      ),
      name: 'decoder excludes render metadata and encoder ownership',
    },
    {
      ok:
        defaultPipeline.includes(
          '[RCTImageCompressionImageDecoder defaultDecoder]'
        ) &&
        defaultPipeline.includes(
          '[decoder decodeInput:input resizeOptions:resizeOptions error:error]'
        ) &&
        pipelineCore.includes(
          'RCTImageCompressionDecodedImage *decodedImage = self.imageDecoder('
        ) &&
        !directDecodeAPIs.test(moduleContents),
      name: 'default pipeline decoder composition without bridge decode APIs',
    },
    {
      ok:
        moduleContents.includes(
          'RCTImageCompressionIOSFormatCapabilities('
        ) &&
        capabilities.includes(
          'NSArray<NSDictionary *> *RCTImageCompressionIOSFormatCapabilities('
        ) &&
        capabilities.includes('RCTImageCompressionKitGifFormat'),
      name: 'unchanged iOS capability projection boundary',
    },
    {
      ok: moduleContents.split(/\r?\n/u).length <= 720,
      name: 'iOS bridge source size boundary after decoder extraction',
    },
    {
      ok: methodLineCount <= 140,
      name: 'iOS compression orchestration size after decoder extraction',
    },
    {
      ok:
        nativeTestNames.length === 6 &&
        requiredNativeTests.every((name) => nativeTestNames.includes(name)),
      name: 'table-driven native image decoder test authority',
    },
    {
      ok:
        packageJson.scripts?.['example:ios:decoder-test'] ===
        'node scripts/ios-validation.mjs decoder-test',
      name: 'iOS image decoder native-test command',
    },
    {
      ok:
        validationRunner.includes("if (mode === 'decoder-test')") &&
        /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);\s*runImageDecoderTests\(\);/u.test(
          validationRunner
        ),
      name: 'image decoder tests integrated into iOS smoke',
    },
  ];
  const violations = structureChecks
    .filter((check) => !check.ok)
    .map((check) => check.name);

  return {
    ok: violations.length === 0,
    label: 'iOS image decoder boundary and native tests are present',
    detail:
      violations.length === 0
        ? 'decode routing, main-thread execution, immutable errors/results, bridge limits, and six native groups are aligned'
        : `contract violations: ${violations.join(' | ')}`,
  };
}

function checkIOSImageTransformerAuthorities() {
  const transformerHeader = readText(
    'ios/RCTImageCompressionImageTransformer.h'
  );
  const transformerCore = readText(
    'ios/RCTImageCompressionImageTransformer.mm'
  );
  const uiKitTransformer = readText(
    'ios/RCTImageCompressionUIKitImageTransformer.mm'
  );
  const moduleContents = readText('ios/RCTImageCompressionKit.mm');
  const pipelineCore = readText('ios/RCTImageCompressionPipeline.mm');
  const defaultPipeline = readText(
    'ios/RCTImageCompressionDefaultPipeline.mm'
  );
  const nativeTests = readText(
    'test/ios-native/RCTImageCompressionImageTransformerTests.mm'
  );
  const validationRunner = readText('scripts/ios-validation.mjs');
  const packageJson = readJson('package.json');
  const nativeTestNames = [
    ...nativeTests.matchAll(/static void (Test\w+)\(void\)/gu),
  ].map((match) => match[1]);
  const requiredNativeTests = [
    'TestCalculatesGeometryMatrix',
    'TestForwardsOpaqueAndTransparentRendererRequests',
    'TestRunsPixelGeometryAndRendererInsideExecutor',
    'TestRejectsMissingRenderAndSkippedExecutor',
    'TestRetainsImmutableRequestResultAndErrorModels',
    'TestClearsExistingErrorOnSuccess',
  ];
  const requiredGeometryCases = [
    'no-resize-landscape',
    'contain-landscape',
    'contain-portrait',
    'width-only',
    'height-only',
    'stretch-both',
    'cover-landscape-center-crop',
    'cover-portrait-center-crop',
    'cover-no-upscale',
  ];
  const methodStart = moduleContents.indexOf(
    '- (void)compressImageWithDictionary:'
  );
  const methodEnd = moduleContents.indexOf(
    '- (void)getImageCompressionCapabilities:',
    methodStart
  );
  const methodLineCount =
    methodStart >= 0 && methodEnd > methodStart
      ? moduleContents.slice(methodStart, methodEnd).split(/\r?\n/u).length
      : Number.POSITIVE_INFINITY;
  const boundaryIdentifiers = [
    '@interface RCTImageCompressionImageGeometry : NSObject',
    '@interface RCTImageCompressionImageTransformRequest : NSObject',
    '@interface RCTImageCompressionImageTransformError : NSObject',
    '@interface RCTImageCompressionTransformedImage : NSObject',
    '@interface RCTImageCompressionImageTransformer : NSObject',
    'RCTImageCompressionImagePixelSizeProvider',
    'RCTImageCompressionImageRenderer',
    'RCTImageCompressionImageTransformExecutor',
  ];
  const forbiddenTransformerDependencies =
    /(?:RCTImageCompression(?:Input|Source)|metadataPolicy|CGImageDestination|maxBytes|writeToFile:|RCTImageCompressionKitEncode)/u;
  const directRenderAPIs =
    /(?:UIGraphicsImageRenderer|drawInRect:|RCTImageCompressionKit(?:ContainSize|CoverSize|StretchSize|RenderImage))/u;
  const structureChecks = [
    {
      ok: boundaryIdentifiers.every((identifier) =>
        transformerHeader.includes(identifier)
      ),
      name: 'immutable transform request geometry result and error models',
    },
    {
      ok:
        !/#import <(?:UIKit|ImageIO|React)/u.test(transformerCore) &&
        transformerCore.includes(
          'RCTImageCompressionImageGeometryCalculate('
        ) &&
        transformerCore.includes(
          'RCTImageCompressionKitImageTransformFailedCode'
        ),
      name: 'Foundation-only injected geometry orchestration',
    },
    {
      ok:
        uiKitTransformer.includes('CGBitmapContextCreate(') &&
        uiKitTransformer.includes('CGContextDrawImage(') &&
        uiKitTransformer.includes(
          'CGContextSetRGBFillColor(context, 1.0, 1.0, 1.0, 1.0)'
        ) &&
        uiKitTransformer.includes('CGContextClearRect(') &&
        !/(?:#import <UIKit|UIGraphicsImageRenderer|dispatch_get_main_queue)/u.test(
          uiKitTransformer
        ),
      name: 'background CoreGraphics renderer defaults',
    },
    {
      ok: !forbiddenTransformerDependencies.test(
        `${transformerCore}\n${uiKitTransformer}`
      ),
      name: 'transformer excludes source metadata encoder and output ownership',
    },
    {
      ok:
        defaultPipeline.includes(
          '[RCTImageCompressionImageTransformer defaultTransformer]'
        ) &&
        defaultPipeline.includes(
          '[transformer transformRequest:request error:nil]'
        ) &&
        pipelineCore.includes('self.imageTransformer(transformRequest)') &&
        !directRenderAPIs.test(moduleContents),
      name: 'default pipeline transformer composition without bridge render APIs',
    },
    {
      ok: moduleContents.split(/\r?\n/u).length <= 540,
      name: 'iOS bridge source size boundary after transformer extraction',
    },
    {
      ok: methodLineCount <= 140,
      name: 'iOS compression orchestration size after transformer extraction',
    },
    {
      ok:
        nativeTestNames.length === 6 &&
        requiredNativeTests.every((name) => nativeTestNames.includes(name)) &&
        requiredGeometryCases.every((name) =>
          nativeTests.includes(`"${name}"`)
        ),
      name: 'table-driven native image transformer test authority',
    },
    {
      ok:
        packageJson.scripts?.['example:ios:transformer-test'] ===
        'node scripts/ios-validation.mjs transformer-test',
      name: 'iOS image transformer native-test command',
    },
    {
      ok:
        validationRunner.includes("if (mode === 'transformer-test')") &&
        /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);\s*runImageDecoderTests\(\);\s*runImageTransformerTests\(\);/u.test(
          validationRunner
        ),
      name: 'image transformer tests integrated into iOS smoke',
    },
  ];
  const violations = structureChecks
    .filter((check) => !check.ok)
    .map((check) => check.name);

  return {
    ok: violations.length === 0,
    label: 'iOS image transformer boundary and native tests are present',
    detail:
      violations.length === 0
        ? 'geometry, renderer background, main-thread execution, immutable models, bridge limits, and six native groups are aligned'
        : `contract violations: ${violations.join(' | ')}`,
  };
}

function checkIOSJpegMetadataAuthorities() {
  const metadataHeader = readText('ios/RCTImageCompressionJpegMetadata.h');
  const metadataCore = readText('ios/RCTImageCompressionJpegMetadata.mm');
  const moduleContents = readText('ios/RCTImageCompressionKit.mm');
  const pipelineCore = readText('ios/RCTImageCompressionPipeline.mm');
  const defaultPipeline = readText(
    'ios/RCTImageCompressionDefaultPipeline.mm'
  );
  const nativeTests = readText(
    'test/ios-native/RCTImageCompressionJpegMetadataTests.mm'
  );
  const validationRunner = readText('scripts/ios-validation.mjs');
  const packageJson = readJson('package.json');
  const nativeTestNames = [
    ...nativeTests.matchAll(/static void (Test\w+)\(void\)/gu),
  ].map((match) => match[1]);
  const requiredNativeTests = [
    'TestRejectsUnsupportedPreserveCombinations',
    'TestReadsSourcePropertiesOnlyForSupportedPreserve',
    'TestBuildsQualityOnlyPropertiesForSafeAndStrip',
    'TestNormalizesPreservedMetadataWithoutMutatingSource',
    'TestHandlesMissingAndMalformedSourceProperties',
    'TestUsesDefaultImageIOReaderAndImmutableModels',
    'TestClearsExistingErrorOnSuccess',
  ];
  const methodStart = moduleContents.indexOf(
    '- (void)compressImageWithDictionary:'
  );
  const methodEnd = moduleContents.indexOf(
    '- (void)getImageCompressionCapabilities:',
    methodStart
  );
  const methodLineCount =
    methodStart >= 0 && methodEnd > methodStart
      ? moduleContents.slice(methodStart, methodEnd).split(/\r?\n/u).length
      : Number.POSITIVE_INFINITY;
  const boundaryIdentifiers = [
    '@interface RCTImageCompressionJpegMetadataRequest : NSObject',
    '@interface RCTImageCompressionJpegMetadataError : NSObject',
    '@interface RCTImageCompressionJpegMetadataResult : NSObject',
    '@interface RCTImageCompressionJpegMetadata : NSObject',
    'RCTImageCompressionJpegSourcePropertyReader',
  ];
  const requiredMetadataProperties = [
    'kCGImageDestinationLossyCompressionQuality',
    'kCGImagePropertyPixelWidth',
    'kCGImagePropertyPixelHeight',
    'kCGImagePropertyOrientation',
    'kCGImagePropertyTIFFOrientation',
    'kCGImagePropertyExifPixelXDimension',
    'kCGImagePropertyExifPixelYDimension',
  ];
  const forbiddenMetadataDependencies =
    /(?:CGImageDestinationCreateWithData|CGImageDestinationAddImage|CGImageDestinationFinalize|UIImage|maxBytes|writeToFile:|RCTPromise)/u;
  const directMetadataAPIs =
    /(?:RCTImageCompressionKitSourceImageProperties|RCTImageCompressionKitJpegDestinationProperties|CGImageSourceCreateWithData|CGImageSourceCopyPropertiesAtIndex|kCGImageProperty(?:PixelWidth|PixelHeight|Orientation|TIFFDictionary|ExifDictionary))/u;
  const structureChecks = [
    {
      ok: boundaryIdentifiers.every((identifier) =>
        metadataHeader.includes(identifier)
      ),
      name: 'immutable JPEG metadata request result and error models',
    },
    {
      ok:
        !/#import <(?:UIKit|React)/u.test(metadataCore) &&
        metadataCore.includes('CGImageSourceCreateWithData') &&
        metadataCore.includes('CGImageSourceCopyPropertiesAtIndex') &&
        requiredMetadataProperties.every((property) =>
          metadataCore.includes(property)
        ),
      name: 'ImageIO source reader and destination property normalization',
    },
    {
      ok: !forbiddenMetadataDependencies.test(metadataCore),
      name: 'metadata boundary excludes encoder render and output ownership',
    },
    {
      ok:
        defaultPipeline.includes(
          '[RCTImageCompressionJpegMetadata defaultMetadata]'
        ) &&
        defaultPipeline.includes('[metadata prepareRequest:request error:error]') &&
        pipelineCore.includes('self.metadataPreparer(') &&
        !directMetadataAPIs.test(moduleContents),
      name: 'default pipeline metadata composition without bridge property APIs',
    },
    {
      ok: moduleContents.split(/\r?\n/u).length <= 500,
      name: 'iOS bridge source size boundary after metadata extraction',
    },
    {
      ok: methodLineCount <= 140,
      name: 'iOS compression orchestration size after metadata extraction',
    },
    {
      ok:
        nativeTestNames.length === 7 &&
        requiredNativeTests.every((name) => nativeTestNames.includes(name)),
      name: 'table-driven native JPEG metadata test authority',
    },
    {
      ok:
        packageJson.scripts?.['example:ios:metadata-test'] ===
        'node scripts/ios-validation.mjs metadata-test',
      name: 'iOS JPEG metadata native-test command',
    },
    {
      ok:
        validationRunner.includes("if (mode === 'metadata-test')") &&
        /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);\s*runImageDecoderTests\(\);\s*runImageTransformerTests\(\);\s*runJpegMetadataTests\(\);/u.test(
          validationRunner
        ),
      name: 'JPEG metadata tests integrated into iOS smoke',
    },
  ];
  const violations = structureChecks
    .filter((check) => !check.ok)
    .map((check) => check.name);

  return {
    ok: violations.length === 0,
    label: 'iOS JPEG metadata boundary and native tests are present',
    detail:
      violations.length === 0
        ? 'preserve policy, ImageIO reads, normalized destination properties, bridge limits, and seven native groups are aligned'
        : `contract violations: ${violations.join(' | ')}`,
  };
}

function checkIOSImageEncoderAuthorities() {
  const encoderHeader = readText('ios/RCTImageCompressionImageEncoder.h');
  const encoderCore = readText('ios/RCTImageCompressionImageEncoder.mm');
  const uiKitEncoder = readText(
    'ios/RCTImageCompressionUIKitImageEncoder.mm'
  );
  const moduleContents = readText('ios/RCTImageCompressionKit.mm');
  const pipelineCore = readText('ios/RCTImageCompressionPipeline.mm');
  const defaultPipeline = readText(
    'ios/RCTImageCompressionDefaultPipeline.mm'
  );
  const nativeTests = readText(
    'test/ios-native/RCTImageCompressionImageEncoderTests.mm'
  );
  const validationRunner = readText('scripts/ios-validation.mjs');
  const packageJson = readJson('package.json');
  const nativeTestNames = [
    ...nativeTests.matchAll(/static void (Test\w+)\(void\)/gu),
  ].map((match) => match[1]);
  const requiredNativeTests = [
    'TestRoutesFormatMatrixInsideExecutor',
    'TestReturnsQualityCapWhenWithinTarget',
    'TestFindsHighestQualityWithinTarget',
    'TestReturnsSmallestOutputWhenTargetCannotBeMet',
    'TestRejectsMissingOutputsAndSkippedExecutor',
    'TestCopiesImmutableRequestResultAndErrorModels',
    'TestClearsExistingErrorOnSuccess',
    'TestCancelsTargetSizeSearchWithStableError',
  ];
  const methodStart = moduleContents.indexOf(
    '- (void)compressImageWithDictionary:'
  );
  const methodEnd = moduleContents.indexOf(
    '- (void)getImageCompressionCapabilities:',
    methodStart
  );
  const methodLineCount =
    methodStart >= 0 && methodEnd > methodStart
      ? moduleContents.slice(methodStart, methodEnd).split(/\r?\n/u).length
      : Number.POSITIVE_INFINITY;
  const boundaryIdentifiers = [
    '@interface RCTImageCompressionImageEncodeRequest : NSObject',
    '@interface RCTImageCompressionImageEncodeError : NSObject',
    '@interface RCTImageCompressionEncodedImage : NSObject',
    '@interface RCTImageCompressionImageEncoder : NSObject',
    'RCTImageCompressionJpegImageEncoder',
    'RCTImageCompressionPngImageEncoder',
    'RCTImageCompressionWebPImageEncoder',
    'RCTImageCompressionImageEncodeExecutor',
  ];
  const platformEncoderAPIs = [
    '@"public.png"',
    'CGImageDestinationCopyTypeIdentifiers',
    'CGImageDestinationCreateWithData',
    'CGImageDestinationAddImage',
    'CGImageDestinationFinalize',
    'org.webmproject.webp',
    'public.webp',
    'destinationPropertiesForQuality:quality',
  ];
  const forbiddenEncoderDependencies =
    /(?:RCTImageCompression(?:Input|ImageDecoder|ImageTransformer)|UIGraphicsImageRenderer|writeToFile:|NSCachesDirectory|RCTPromise)/u;
  const directEncoderAPIs =
    /(?:CGImageDestination|UIImagePNGRepresentation|RCTImageCompressionKitEncode(?:Jpeg|Png|WebP|QualityOutput|ToTargetSize)|while \(low <= high\))/u;
  const structureChecks = [
    {
      ok: boundaryIdentifiers.every((identifier) =>
        encoderHeader.includes(identifier)
      ),
      name: 'immutable image encode request result and error models',
    },
    {
      ok:
        !/#import <(?:UIKit|ImageIO|React)/u.test(encoderCore) &&
        encoderCore.includes('RCTImageCompressionKitMinQuality') &&
        encoderCore.includes('while (low <= high)'),
      name: 'Foundation-only injected format routing and target-size search',
    },
    {
      ok: platformEncoderAPIs.every((api) => uiKitEncoder.includes(api)),
      name: 'background ImageIO codec and WebP availability defaults',
    },
    {
      ok: !forbiddenEncoderDependencies.test(
        `${encoderCore}\n${uiKitEncoder}`
      ),
      name: 'encoder excludes source decode transform and output-file ownership',
    },
    {
      ok:
        defaultPipeline.includes(
          '[RCTImageCompressionImageEncoder defaultEncoder]'
        ) &&
        defaultPipeline.includes('[encoder encodeRequest:request error:error]') &&
        defaultPipeline.includes(
          '[RCTImageCompressionImageEncoder defaultWebPOutputAvailable]'
        ) &&
        pipelineCore.includes('self.imageEncoder(encodeRequest, &encodeError)') &&
        !directEncoderAPIs.test(moduleContents),
      name: 'default pipeline encoder composition without bridge codec or search APIs',
    },
    {
      ok: moduleContents.split(/\r?\n/u).length <= 380,
      name: 'iOS bridge source size boundary after encoder extraction',
    },
    {
      ok: methodLineCount <= 140,
      name: 'iOS compression orchestration size after encoder extraction',
    },
    {
      ok:
        nativeTestNames.length === 8 &&
        requiredNativeTests.every((name) => nativeTestNames.includes(name)),
      name: 'table-driven native image encoder test authority',
    },
    {
      ok:
        packageJson.scripts?.['example:ios:encoder-test'] ===
        'node scripts/ios-validation.mjs encoder-test',
      name: 'iOS image encoder native-test command',
    },
    {
      ok:
        validationRunner.includes("if (mode === 'encoder-test')") &&
        /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);\s*runImageDecoderTests\(\);\s*runImageTransformerTests\(\);\s*runJpegMetadataTests\(\);\s*runImageEncoderTests\(\);/u.test(
          validationRunner
        ),
      name: 'image encoder tests integrated into iOS smoke',
    },
  ];
  const violations = structureChecks
    .filter((check) => !check.ok)
    .map((check) => check.name);

  return {
    ok: violations.length === 0,
    label: 'iOS image encoder boundary and native tests are present',
    detail:
      violations.length === 0
        ? 'format routing, WebP availability, target-size search, codec defaults, bridge limits, and seven native groups are aligned'
        : `contract violations: ${violations.join(' | ')}`,
  };
}

function checkIOSOutputAuthorities() {
  const outputHeader = readText('ios/RCTImageCompressionOutput.h');
  const outputCore = readText('ios/RCTImageCompressionOutput.mm');
  const moduleContents = readText('ios/RCTImageCompressionKit.mm');
  const pipelineCore = readText('ios/RCTImageCompressionPipeline.mm');
  const defaultPipeline = readText(
    'ios/RCTImageCompressionDefaultPipeline.mm'
  );
  const podspec = readText('react-native-image-compression-kit.podspec');
  const nativeTests = readText(
    'test/ios-native/RCTImageCompressionOutputTests.mm'
  );
  const validationRunner = readText('scripts/ios-validation.mjs');
  const packageJson = readJson('package.json');
  const nativeTestNames = [
    ...nativeTests.matchAll(/static void (Test\w+)\(void\)/gu),
  ].map((match) => match[1]);
  const requiredNativeTests = [
    'TestBuildsFormatPathsAndPersistsBytes',
    'TestReusesExistingDirectoryAndFallsBackToTemporaryPath',
    'TestProjectsResultMetricsAndZeroSourceRatio',
    'TestRejectsDirectoryCreationFailureWithStableError',
    'TestRejectsWriteFailureMatrixWithStableErrors',
    'TestCopiesImmutableRequestResultAndErrorModels',
    'TestClearsExistingErrorOnSuccess',
  ];
  const methodStart = moduleContents.indexOf(
    '- (void)compressImageWithDictionary:'
  );
  const methodEnd = moduleContents.indexOf(
    '- (void)getImageCompressionCapabilities:',
    methodStart
  );
  const methodLineCount =
    methodStart >= 0 && methodEnd > methodStart
      ? moduleContents.slice(methodStart, methodEnd).split(/\r?\n/u).length
      : Number.POSITIVE_INFINITY;
  const boundaryIdentifiers = [
    '@interface RCTImageCompressionOutputRequest : NSObject',
    '@interface RCTImageCompressionOutputError : NSObject',
    '@interface RCTImageCompressionOutputResult : NSObject',
    '@interface RCTImageCompressionOutput : NSObject',
    'RCTImageCompressionOutputCacheDirectoryProvider',
    'RCTImageCompressionOutputPathExists',
    'RCTImageCompressionOutputDirectoryCreator',
    'RCTImageCompressionOutputClock',
    'RCTImageCompressionOutputUUIDProvider',
    'RCTImageCompressionOutputFileWriter',
  ];
  const defaultOutputAPIs = [
    'NSCachesDirectory',
    'createDirectoryAtPath:path',
    'NSDataWritingAtomic',
    '[NSDate date].timeIntervalSince1970',
    '[NSUUID UUID].UUIDString',
  ];
  const forbiddenOutputDependencies =
    /(?:UIImage|CGImageDestination|UIGraphicsImageRenderer|metadataPolicy|maxBytes|RCTPromise)/u;
  const directOutputAPIs =
    /(?:NSCachesDirectory|createDirectoryAtPath|writeToFile:|RCTImageCompressionKitOutputPath|RCTImageCompressionKitResult|compressionRatio\s*=)/u;
  const structureChecks = [
    {
      ok: boundaryIdentifiers.every((identifier) =>
        outputHeader.includes(identifier)
      ),
      name: 'immutable output request result error and injected owner models',
    },
    {
      ok:
        !/#import <(?:UIKit|ImageIO|React)/u.test(outputCore) &&
        defaultOutputAPIs.every((api) => outputCore.includes(api)) &&
        outputCore.includes('dictionaryRepresentation'),
      name: 'Foundation-only cache path atomic writer and result projection defaults',
    },
    {
      ok: !forbiddenOutputDependencies.test(outputCore),
      name: 'output owner excludes codec transform metadata and bridge ownership',
    },
    {
      ok:
        defaultPipeline.includes('[RCTImageCompressionOutput defaultOutput]') &&
        defaultPipeline.includes('[output persistRequest:request error:error]') &&
        pipelineCore.includes('self.outputWriter(outputRequest, &outputError)') &&
        !directOutputAPIs.test(moduleContents),
      name: 'default pipeline output composition without bridge path write or result APIs',
    },
    {
      ok: moduleContents.split(/\r?\n/u).length <= 360,
      name: 'iOS bridge source size boundary after output extraction',
    },
    {
      ok: methodLineCount <= 140,
      name: 'iOS compression orchestration size after output extraction',
    },
    {
      ok:
        nativeTestNames.length === 7 &&
        requiredNativeTests.every((name) => nativeTestNames.includes(name)),
      name: 'table-driven native output test authority',
    },
    {
      ok:
        packageJson.scripts?.['example:ios:output-test'] ===
        'node scripts/ios-validation.mjs output-test',
      name: 'iOS output native-test command',
    },
    {
      ok:
        validationRunner.includes("if (mode === 'output-test')") &&
        /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);\s*runImageDecoderTests\(\);\s*runImageTransformerTests\(\);\s*runJpegMetadataTests\(\);\s*runImageEncoderTests\(\);\s*runOutputTests\(\);/u.test(
          validationRunner
        ),
      name: 'output tests integrated into iOS smoke',
    },
    {
      ok: podspec.includes('"ios/RCTImageCompressionOutput.h"'),
      name: 'output header remains private in pod package surface',
    },
  ];
  const violations = structureChecks
    .filter((check) => !check.ok)
    .map((check) => check.name);

  return {
    ok: violations.length === 0,
    label: 'iOS output persistence boundary and native tests are present',
    detail:
      violations.length === 0
        ? 'cache paths, atomic writes, stable errors, result projection, bridge limits, and seven native groups are aligned'
        : `contract violations: ${violations.join(' | ')}`,
  };
}

function checkIOSPipelineAuthorities() {
  const pipelineHeader = readText('ios/RCTImageCompressionPipeline.h');
  const pipelineCore = readText('ios/RCTImageCompressionPipeline.mm');
  const defaultPipeline = readText(
    'ios/RCTImageCompressionDefaultPipeline.mm'
  );
  const moduleContents = readText('ios/RCTImageCompressionKit.mm');
  const podspec = readText('react-native-image-compression-kit.podspec');
  const nativeTests = readText(
    'test/ios-native/RCTImageCompressionPipelineTests.mm'
  );
  const validationRunner = readText('scripts/ios-validation.mjs');
  const packageJson = readJson('package.json');
  const nativeTestNames = [
    ...nativeTests.matchAll(/static void (Test\w+)\(void\)/gu),
  ].map((match) => match[1]);
  const requiredNativeTests = [
    'TestRunsSuccessStagesAndForwardsRequests',
    'TestForwardsFailureMatrixWithoutRunningDownstreamStages',
    'TestUsesInjectedRuntimeCapabilityProviders',
    'TestConvertsExceptionStageMatrixToNativeFailure',
    'TestCopiesImmutableRequestResultAndErrorModels',
    'TestClearsExistingErrorAndNotifiesResolution',
  ];
  const methodStart = moduleContents.indexOf(
    '- (void)compressImageWithDictionary:'
  );
  const methodEnd = moduleContents.indexOf(
    '- (void)getImageCompressionCapabilities:',
    methodStart
  );
  const methodLineCount =
    methodStart >= 0 && methodEnd > methodStart
      ? moduleContents.slice(methodStart, methodEnd).split(/\r?\n/u).length
      : Number.POSITIVE_INFINITY;
  const boundaryIdentifiers = [
    '@interface RCTImageCompressionPipelineRequest : NSObject',
    '@interface RCTImageCompressionPipelineResult : NSObject',
    '@interface RCTImageCompressionPipelineError : NSObject',
    '@interface RCTImageCompressionPipeline : NSObject',
    'RCTImageCompressionPipelineRuntimeAvailability',
    'RCTImageCompressionPipelineRequestParser',
    'RCTImageCompressionPipelineInputLoader',
    'RCTImageCompressionPipelineMetadataPreparer',
    'RCTImageCompressionPipelineImageDecoder',
    'RCTImageCompressionPipelineImageTransformer',
    'RCTImageCompressionPipelineImageEncoder',
    'RCTImageCompressionPipelineOutputWriter',
    'RCTImageCompressionPipelineStageObserver',
  ];
  const injectedStageCalls = [
    'self.requestParser(',
    'self.inputLoader(',
    'self.metadataPreparer(',
    'self.imageDecoder(',
    'self.imageTransformer(',
    'self.imageEncoder(',
    'self.outputWriter(',
  ];
  const defaultOwners = [
    'RCTImageCompressionInputLoader defaultLoader',
    'RCTImageCompressionJpegMetadata defaultMetadata',
    'RCTImageCompressionImageDecoder defaultDecoder',
    'RCTImageCompressionImageTransformer defaultTransformer',
    'RCTImageCompressionImageEncoder defaultEncoder',
    'RCTImageCompressionOutput defaultOutput',
  ];
  const directPipelineOwners =
    /(?:defaultLoader|defaultDecoder|defaultTransformer|defaultMetadata|defaultEncoder|defaultOutput|loadSourceURI:|decodeInput:|transformRequest:|encodeRequest:|persistRequest:|CGImageSource|RNICK_IOS_SMOKE_NATIVE)/u;
  const directComponentImports =
    /#import "RCTImageCompression(?:Input|ImageDecoder|ImageTransformer|JpegMetadata|ImageEncoder)\.h"/u;
  const structureChecks = [
    {
      ok: boundaryIdentifiers.every((identifier) =>
        pipelineHeader.includes(identifier)
      ),
      name: 'immutable pipeline request result error and injected stage models',
    },
    {
      ok:
        !/#import <(?:UIKit|ImageIO|React)/u.test(pipelineCore) &&
        injectedStageCalls.every((call) => pipelineCore.includes(call)) &&
        pipelineCore.includes('self.webPOutputAvailability') &&
        pipelineCore.includes('self.avifInputAvailability') &&
        pipelineCore.includes('self.stageObserver(') &&
        pipelineCore.includes('RCTImageCompressionKitNativeOperationFailedCode'),
      name: 'Foundation-only injected pipeline orchestration',
    },
    {
      ok:
        defaultPipeline.includes('CGImageSourceCopyTypeIdentifiers') &&
        defaultPipeline.includes('RNICK_IOS_SMOKE_NATIVE %@') &&
        defaultOwners.every((owner) => defaultPipeline.includes(owner)),
      name: 'default component capability and smoke observer composition',
    },
    {
      ok:
        moduleContents.includes(
          '[RCTImageCompressionPipeline defaultPipeline]'
        ) &&
        moduleContents.includes('executeRequest:request') &&
        moduleContents.includes('cancellationCheck:^BOOL') &&
        /operation\.resolve\(result\.dictionaryRepresentation\);\s*\[pipeline notifyResolved\];/u.test(
          moduleContents
        ) &&
        !directComponentImports.test(moduleContents) &&
        !directPipelineOwners.test(moduleContents),
      name: 'thin bridge pipeline promise adapter without stage composition',
    },
    {
      ok:
        moduleContents.includes(
          '[RCTImageCompressionPipeline defaultWebPOutputAvailable]'
        ) &&
        moduleContents.includes(
          '[RCTImageCompressionPipeline defaultAVIFInputAvailable]'
        ),
      name: 'capability endpoint uses pipeline runtime providers',
    },
    {
      ok:
        moduleContents.split(/\r?\n/u).length <= 360 &&
        methodLineCount <= 145 &&
        pipelineCore.split(/\r?\n/u).length <= 350 &&
        defaultPipeline.split(/\r?\n/u).length <= 160,
      name: 'bridge and pipeline source size boundaries',
    },
    {
      ok:
        nativeTestNames.length === 6 &&
        requiredNativeTests.every((name) => nativeTestNames.includes(name)),
      name: 'table-driven native pipeline integration authority',
    },
    {
      ok:
        packageJson.scripts?.['example:ios:pipeline-test'] ===
        'node scripts/ios-validation.mjs pipeline-test',
      name: 'iOS pipeline native-test command',
    },
    {
      ok:
        validationRunner.includes("if (mode === 'pipeline-test')") &&
        /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);\s*runImageDecoderTests\(\);\s*runImageTransformerTests\(\);\s*runJpegMetadataTests\(\);\s*runImageEncoderTests\(\);\s*runOutputTests\(\);\s*runPipelineTests\(\);/u.test(
          validationRunner
        ),
      name: 'pipeline tests integrated into iOS smoke',
    },
    {
      ok: podspec.includes('"ios/RCTImageCompressionPipeline.h"'),
      name: 'pipeline header remains private in pod package surface',
    },
  ];
  const violations = structureChecks
    .filter((check) => !check.ok)
    .map((check) => check.name);

  return {
    ok: violations.length === 0,
    label: 'iOS compression pipeline boundary and native tests are present',
    detail:
      violations.length === 0
        ? 'stage order, runtime providers, stable failure forwarding, smoke observation, thin bridge limits, and six native groups are aligned'
        : `contract violations: ${violations.join(' | ')}`,
  };
}

function checkAvifFixtures() {
  const manifest = readJson('android/src/test/assets/avif/manifest.json');
  const packageJson = readJson('package.json');
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
  ];

  return {
    ok: checks.every(Boolean),
    label: 'AVIF fixture manifest and committed sample are consistent',
    detail: checks.every(Boolean)
      ? 'source PNG metadata, committed AVIF hash, and package commands are consistent'
      : 'expected AVIF source metadata, fixture metadata, or package commands are missing/mismatched',
  };
}

function checkHeicHeifFixtures() {
  const manifest = readJson('android/src/test/assets/heic-heif/manifest.json');
  const packageJson = readJson('package.json');
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
  ];

  return {
    ok: checks.every(Boolean),
    label: 'HEIC/HEIF fixture manifest and committed samples are consistent',
    detail:
      checks.every(Boolean)
        ? 'source PNG metadata, committed fixture hashes, and package commands are consistent'
        : 'expected source PNG metadata, committed fixture metadata, or package commands are missing/mismatched',
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
