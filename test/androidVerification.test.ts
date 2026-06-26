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

  it('documents the HEIC and HEIF real codec sample validation strategy', () => {
    const readmeSource = readProjectFile('README.md');
    const verificationSource = readProjectFile('scripts/android-verification.mjs');

    expect(readmeSource).toContain('## HEIC / HEIF Codec Sample Validation Strategy');
    expect(readmeSource).toContain(
      'This repository now commits tiny HEIC / HEIF samples generated from the repo-owned PNG source.'
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
    expect(readmeSource).toContain('Generated fixtures are committed because they are tiny');
    expect(readmeSource).toContain('android/src/test/assets/heic-heif/');
    expect(readmeSource).toContain(
      'They verify the fixture files and metadata, but they do not boot an emulator.'
    );
    expect(readmeSource).toContain(
      'A separate Android Instrumentation workflow boots an API 35 Google APIs emulator'
    );
    expect(readmeSource).toContain('`pnpm example:android-instrumentation`');
    expect(readmeSource).toContain(
      'committed `sample.heic` and `sample.heif` fixtures through the API 28+ `ImageDecoder` route'
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
    expect(verificationSource).toContain('checkHeicHeifCodecSampleStrategy');
  });

  it('wires HEIC and HEIF emulator instrumentation validation', () => {
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
      'compressesCommittedHeicAndHeifSamplesToJpegPngAndWebp'
    );
    expect(instrumentationSource).toContain(
      'Build.VERSION.SDK_INT >= Build.VERSION_CODES.P'
    );
    expect(instrumentationSource).toContain('heic-heif/sample.heic');
    expect(instrumentationSource).toContain('heic-heif/sample.heif');
    expect(instrumentationSource).toContain('ImageCompressionKitModule(');
    expect(instrumentationSource).toContain('JavaOnlyMap.of');
    expect(instrumentationSource).toContain('OutputCase("jpeg", ::assertJpegSignature)');
    expect(instrumentationSource).toContain('OutputCase("png", ::assertPngSignature)');
    expect(instrumentationSource).toContain('OutputCase("webp", ::assertWebpSignature)');
    expect(instrumentationSource).toContain(
      'assertBitmapDimensions(outputFile, width = 16, height = 12)'
    );
    expect(workflowSource).toContain('name: Android Instrumentation');
    expect(workflowSource).toContain('reactivecircus/android-emulator-runner@v2');
    expect(workflowSource).toContain('api-level: 35');
    expect(workflowSource).toContain('target: google_apis');
    expect(workflowSource).toContain('script: pnpm example:android-instrumentation');
    expect(verificationSource).toContain('checkHeicHeifInstrumentationValidation');
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

  it('verifies the Android module supports file and content JPEG, PNG, WebP, GIF, HEIC, and HEIF sources', () => {
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
    expect(moduleSource).toContain('UnsupportedInputFormat.fromMimeType(contentMimeType)');
    expect(moduleSource).toContain('UnsupportedInputFormat.fromFileExtension(fileExtension)');
    expect(moduleSource).toContain('InputFormat.fromFileExtension(fileExtension)');
    expect(moduleSource).toContain('Build.VERSION.SDK_INT >= Build.VERSION_CODES.P');
    expect(moduleSource).toContain('Build.VERSION.SDK_INT >= Build.VERSION_CODES.O');
    expect(moduleSource).toContain('decodeHeicHeifBitmapWithImageDecoder');
    expect(moduleSource).toContain('decodeBitmapFactory(inputSource)');
    expect(moduleSource).toContain('mimeType = "image/jpeg"');
    expect(moduleSource).toContain('mimeType = "image/png"');
    expect(moduleSource).toContain('mimeType = "image/webp"');
    expect(moduleSource).toContain('mimeType = "image/heic"');
    expect(moduleSource).toContain('mimeType = "image/heif"');
    expect(moduleSource).toContain('mimeType = "image/avif"');
    expect(moduleSource).toContain('mimeType = "image/gif"');
    expect(moduleSource).toContain(
      'Android MVP supports JPEG, PNG, WebP, GIF, HEIC, and HEIF input only.'
    );
    expect(moduleSource).toContain('createCompressionResult(');
    expect(moduleSource).toContain('outputFormat');
    expect(moduleSource).not.toContain('BitmapFactory.decodeFile');
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
    expect(combinedSource).toContain('SUPPORTED_INPUT_FORMATS');
    expect(combinedSource).toContain('HEIC_FORMAT');
    expect(combinedSource).toContain('HEIF_FORMAT');
    expect(combinedSource).toContain('output = outputFormat != null');
    expect(combinedSource).toContain('Non-JPEG output does not preserve source EXIF metadata.');
    expect(combinedSource).toContain(
      'supports JPEG, PNG, WebP, GIF, HEIC, and HEIF input with JPEG, PNG, and WebP output only'
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
      'PNG, WebP, GIF, HEIC, and HEIF sources are decoded without copying EXIF metadata.'
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
      'capabilitiesExposeJpegPngWebpGifHeicHeifInputsAndJpegPngWebpOutputsOnly'
    );
    expect(testSource).toContain('assertHeicHeifCapabilityNotes');
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
      'compressImageRejectsUnsupportedImageFileExtensionsAtModuleBoundary'
    );
    expect(testSource).toContain(
      'compressImageRejectsUnsupportedContentMimeTypesAtModuleBoundary'
    );
    expect(testSource).toContain(
      'compressImageTreatsHeicAndHeifSourcesAsDecodeCandidatesOnSupportedSdk'
    );
    expect(testSource).toContain('compressImageRejectsHeicAndHeifBeforeAndroidO');
    expect(testSource).toContain(
      'compressImageSeparatesUnsupportedFormatFromDecodeFailure'
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
