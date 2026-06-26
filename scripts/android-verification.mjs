#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
  'android/src/test/java/com/imagecompressionkit/JpegExifMetadataTest.kt',
  'android/src/test/java/com/imagecompressionkit/ImageCompressionOutputTest.kt',
  'android/src/test/java/com/imagecompressionkit/ImageCompressionKitModuleTest.kt',
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
    'unitTests.returnDefaultValues = true',
    'unitTests.includeAndroidResources = true',
    'implementation "com.facebook.react:react-android"',
    'implementation "androidx.exifinterface:exifinterface:1.4.2"',
    'testImplementation "junit:junit:4.13.2"',
    'testImplementation "org.robolectric:robolectric:4.16.1"',
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
    'openInputStream(inputSource.uri)',
    'OpenableColumns.SIZE',
    'InputFormat.fromMimeType(bounds.mimeType)',
    'readUnsupportedInputMimeTypeHint(inputSource)',
    'queryContentMimeType(inputSource.uri)',
    'UnsupportedInputFormat.fromMimeType(contentMimeType)',
    'UnsupportedInputFormat.fromFileExtension(fileExtension)',
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
    'SUPPORTED_INPUT_FORMATS',
    'output = outputFormat != null',
    'supports JPEG, PNG, WebP, and GIF input with JPEG, PNG, and WebP output only',
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
    'PNG, WebP, and GIF sources are decoded without copying EXIF metadata.',
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
    'capabilitiesExposeJpegPngWebpGifInputsAndJpegPngWebpOutputsOnly',
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
    'compressImageRejectsUnsupportedImageFileExtensionsAtModuleBoundary',
    'compressImageRejectsUnsupportedContentMimeTypesAtModuleBoundary',
    'compressImageSeparatesUnsupportedFormatFromDecodeFailure',
    'compressImageAcceptsGifFileAndContentSourcesAsStaticFirstFrameWithAllImplementedOutputs',
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
    'createAnimatedGifFile',
    'SAMPLE_ANIMATED_GIF_BASE64',
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
        ? 'module extends generated spec and contains JPEG/PNG/WebP/GIF decode, unsupported input error boundaries, JPEG orient/metadata, resize, target-size, JPEG/PNG/WebP output encode path, and module-level file/content URI tests'
        : `missing snippets: ${[
            ...missing,
            ...(hasUnitTestScript ? [] : ['package.json example:android-unit-test script']),
          ].join(' | ')}`,
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
