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
  'android/build.gradle',
  'android/src/main/java/com/imagecompressionkit/AndroidCompressionRequest.kt',
  'android/src/main/java/com/imagecompressionkit/AndroidAvifOutputHelper.kt',
  'android/src/main/java/com/imagecompressionkit/AndroidAvifOutputPrototype.kt',
  'android/src/main/java/com/imagecompressionkit/JpegExifMetadata.kt',
  'android/src/main/java/com/imagecompressionkit/ImageCompressionOutput.kt',
  'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt',
  'android/src/main/java/com/imagecompressionkit/ImageCompressionKitPackage.kt',
  'android/src/androidTest/java/com/imagecompressionkit/ImageCompressionKitHeicHeifInstrumentationTest.kt',
  'android/src/test/java/com/imagecompressionkit/AndroidAvifOutputHelperTest.kt',
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
  'test/verificationArchitecture.test.ts',
  'test/releaseEvidence.test.mjs',
  'test/releaseEvidenceImport.test.mjs',
  'test/releaseEvidenceAcquisition.test.mjs',
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
  'test/fixtures/action-pin-review/annotated-tag.json',
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
  'evidence/reviews/0.2.55/review-evidence-index.json',
  'evidence/reviews/0.2.55/artifacts/review.zip',
  'evidence/reviews/0.2.55/artifacts/attestation.zip',
  'evidence/reviews/0.2.55/review/review-receipt.json',
  'evidence/reviews/0.2.55/review/artifact-manifest.json',
  'evidence/reviews/0.2.55/review/archive-set/0.2.55/release-evidence-index.json',
  'evidence/reviews/0.2.55/attestation/attestation-verification.json',
  'evidence/reviews/0.2.55/attestation/attestation.jsonl',
  'evidence/reviews/0.2.55/attestation/trusted-root.jsonl',
  'test/fixtures/release-evidence-acquisition/0.2.50/provenance.zip',
  'test/fixtures/release-evidence-acquisition/0.2.50/attestation.zip',
  'test/fixtures/release-evidence-acquisition/0.2.55/provenance.zip',
  'test/fixtures/release-evidence-acquisition/0.2.55/attestation.zip',
  'test/iosSmokeLifecycle.test.mjs',
  'test/iosSmokeCliTimeout.test.mjs',
  'test/iosSmokeContract.test.mjs',
  'test/iosSmokePassReplayFixture.test.mjs',
  'test/iosSmokeSummaryCli.test.mjs',
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
    packageJson.peerDependencies?.['react-native'] === '>=0.73 <1.0',
    packageJson.scripts?.['docs:check'] === 'node scripts/verify-docs.mjs',
  ];
  const ok = report.ok && packageChecks.every(Boolean);

  return {
    ok,
    label: 'package metadata and documentation semantics are aligned',
    detail: ok
      ? `package ${report.status.packageVersion} ${report.status.releaseState}, npm latest ${report.status.npmLatest} checked ${report.status.registryCheckedAt}, manifest-aligned README/RELEASE, required headings/links/commands/files, local anchors, README limits, and npm exclusions passed`
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
      ok: moduleContents.split(/\r?\n/u).length <= 1000,
      name: 'module source size boundary',
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
        'class ImageCompressionKitPackage : BaseReactPackage()'
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
