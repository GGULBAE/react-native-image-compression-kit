import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import packageJson from '../package.json';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readProjectFile(filePath: string): string {
  return readFileSync(path.join(ROOT, filePath), 'utf8');
}

function extractKotlinArray(source: string, arrayName: string): string {
  const match = source.match(
    new RegExp(`private val ${arrayName} = arrayOf\\(([\\s\\S]*?)\\n    \\)`)
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
    expect(packageJson.scripts.verify).toContain('pnpm android:doctor');
  });

  it('verifies the Android module supports file and content JPEG sources', () => {
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );

    expect(moduleSource).toContain('"file" ->');
    expect(moduleSource).toContain('"content" ->');
    expect(moduleSource).toContain('reactContext.contentResolver.openInputStream');
    expect(moduleSource).toContain('OpenableColumns.SIZE');
    expect(moduleSource).toContain('BitmapFactory.decodeStream');
    expect(moduleSource).toContain('hasJpegHeader');
    expect(moduleSource).toContain('createCompressionResult(originalByteSize');
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

    expect(moduleSource).toContain('readMaxBytes(output)');
    expect(moduleSource).toContain('output.maxBytes must be a positive integer');
    expect(moduleSource).toContain('didEncode = encodeJpeg(');
    expect(moduleSource).toContain('maxBytes,');
    expect(moduleSource).toContain('copiedExifMetadata');
    expect(moduleSource).toContain('encodeJpegToTargetSize');
    expect(moduleSource).toContain('bestWithinTargetQuality');
    expect(moduleSource).toContain('supportsTargetSizeCompression", true');
    expect(moduleSource).not.toContain('does not implement target-size compression yet');
  });

  it('verifies the Android module handles JPEG metadata policies explicitly', () => {
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );

    expect(moduleSource).toContain('readMetadataPolicy(options)');
    expect(moduleSource).toContain('MetadataPolicy.SAFE');
    expect(moduleSource).toContain('MetadataPolicy.STRIP');
    expect(moduleSource).toContain('MetadataPolicy.PRESERVE');
    expect(moduleSource).toContain('createCopiedExifMetadata');
    expect(moduleSource).toContain('writeCopiedExifMetadata');
    expect(moduleSource).toContain('SAFE_EXIF_TAGS');
    expect(moduleSource).toContain('PRESERVED_EXIF_TAGS');
    expect(moduleSource).toContain('outputExif.setAttribute(');
    expect(moduleSource).toContain('ExifInterface.TAG_ORIENTATION');
    expect(moduleSource).toContain('ExifInterface.ORIENTATION_NORMAL.toString()');
    expect(moduleSource).toContain('ExifInterface.TAG_PIXEL_X_DIMENSION');
    expect(moduleSource).toContain('ExifInterface.TAG_PIXEL_Y_DIMENSION');
    expect(moduleSource).toContain('pushString(METADATA_POLICY_PRESERVE)');
    expect(moduleSource).toContain('pushString(METADATA_POLICY_SAFE)');
    expect(moduleSource).toContain('pushString(METADATA_POLICY_STRIP)');
    expect(moduleSource).not.toContain('does not implement metadata preservation yet');
    expect(moduleSource).toContain('without preserving source EXIF metadata');
  });

  it('verifies the Android module uses a privacy-filtered safe metadata allowlist', () => {
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );
    const safeExifTags = extractKotlinArray(moduleSource, 'SAFE_EXIF_TAGS');
    const preservedExifTags = extractKotlinArray(
      moduleSource,
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

    expect(moduleSource).toContain(
      'Metadata safe copies privacy-filtered source EXIF attributes.'
    );
    expect(moduleSource).toContain(
      'Metadata safe excludes GPS/location, owner/serial, maker note, user comment, and XMP.'
    );
  });
});
