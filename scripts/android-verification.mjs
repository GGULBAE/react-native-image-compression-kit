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
  'scripts/generate-avif-fixtures.mjs',
  'scripts/generate-heic-heif-fixtures.mjs',
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
    checkCodegenConfig(),
    checkSpecFile(),
    checkAndroidGradleConfig(),
    checkAndroidNativeModule(),
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
    'A separate Android Instrumentation workflow boots an API 35 Google APIs emulator',
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
    workflowContents.includes('reactivecircus/android-emulator-runner@v2'),
    workflowContents.includes('api-level: 35'),
    workflowContents.includes('target: google_apis'),
    workflowContents.includes('script: pnpm example:android-instrumentation'),
    readmeContents.includes('Android Instrumentation workflow'),
    readmeContents.includes('pnpm example:android-instrumentation'),
    readmeContents.includes('API 35 Google APIs emulator'),
  ];

  return {
    ok: checks.every(Boolean),
    label: 'HEIC/HEIF/AVIF emulator instrumentation validation is wired',
    detail: checks.every(Boolean)
      ? 'androidTest assets, API 34+ codec sample assertions, package script, workflow, and README are present'
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
  const gradle = resolveGradleCommand(path.join(ROOT, 'android'));

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
