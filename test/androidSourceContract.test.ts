import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readText(filePath: string): string {
  return readFileSync(path.join(ROOT, filePath), 'utf8');
}

function readJson(filePath: string): any {
  return JSON.parse(readText(filePath));
}

function kotlinTestNames(filePath: string): string[] {
  return [...readText(filePath).matchAll(/@Test[\s\S]*?\bfun\s+(\w+)\s*\(/g)].map(
    (match) => match[1]
  );
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function pngDimensions(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function expectFixtureManifest(
  manifestPath: string,
  expectedFormats: string[]
): void {
  const manifest = readJson(manifestPath);
  const sourceBytes = readFileSync(path.join(ROOT, manifest.source.path));
  const dimensions = pngDimensions(sourceBytes);

  expect(manifest).toMatchObject({
    schemaVersion: 1,
    source: {
      format: 'png',
      byteSize: sourceBytes.length,
      sha256: sha256(sourceBytes),
      dimensions,
      provenance: {
        owner: 'react-native-image-compression-kit',
        license: 'MIT',
      },
    },
  });
  expect(
    manifest.generatedFixtures.map((fixture: any) => fixture.format).sort()
  ).toEqual([...expectedFormats].sort());

  for (const fixture of manifest.generatedFixtures) {
    const fixtureBytes = readFileSync(path.join(ROOT, fixture.targetPath));
    expect(fixture).toMatchObject({
      sourcePath: manifest.source.path,
      byteSize: fixtureBytes.length,
      sha256: sha256(fixtureBytes),
      dimensions,
      provenance: {
        generator: 'libheif heif-enc',
        generatorVersion: '1.23.0',
        license: 'MIT',
      },
    });
    expect(path.extname(fixture.targetPath)).toBe(`.${fixture.format}`);
    expect(fixture.generationCommand).toContain('heif-enc');
  }
}

describe('Android source contract', () => {
  it('registers the generated TurboModule through one package', () => {
    const moduleSource = readText(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );
    const packageSource = readText(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitPackage.kt'
    );

    expect(moduleSource).toMatch(
      /class ImageCompressionKitModule\([\s\S]*\)\s*:\s*NativeImageCompressionKitSpec\(reactContext\)/
    );
    expect(moduleSource).toContain('override fun getName(): String = NAME');
    expect(moduleSource).toMatch(/const val NAME\s*=\s*"ImageCompressionKit"/);
    expect(packageSource).toContain('class ImageCompressionKitPackage : BaseReactPackage()');
    expect(packageSource).toContain('ImageCompressionKitModule(reactContext)');
    expect(packageSource).toContain('ImageCompressionKitModule.NAME');
  });

  it('keeps Gradle, Codegen, and executable Android commands aligned', () => {
    const gradle = readText('android/build.gradle');

    for (const plugin of [
      'com.android.library',
      'com.facebook.react',
      'org.jetbrains.kotlin.android',
    ]) {
      expect(gradle).toContain(`apply plugin: "${plugin}"`);
    }
    expect(gradle).toContain('namespace "com.imagecompressionkit"');
    expect(gradle).toContain('build/generated/source/codegen/java');
    expect(gradle).toContain(
      'testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"'
    );
    expect(gradle).toContain('androidTest.assets.srcDirs += ["src/test/assets"]');
    expect(packageJson.codegenConfig.android.javaPackageName).toBe(
      'com.imagecompressionkit'
    );
    expect(packageJson.scripts['example:android-unit-test']).toContain(
      ':react-native-image-compression-kit:testDebugUnitTest'
    );
    expect(packageJson.scripts['example:android-instrumentation']).toContain(
      ':react-native-image-compression-kit:connectedDebugAndroidTest'
    );
  });

  it('delegates Android behavior to Kotlin unit and instrumentation suites', () => {
    const authorities = [
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

    for (const authority of authorities) {
      const names = kotlinTestNames(authority.file);
      expect(names.length, authority.file).toBeGreaterThanOrEqual(authority.minimum);
      expect(names, authority.file).toEqual(
        expect.arrayContaining(authority.required)
      );
    }
  });

  it('binds emulator validation to the platform fixtures and commands', () => {
    const workflow = readText('.github/workflows/android-instrumentation.yml');

    expect(workflow).toContain('run: pnpm example:codegen');
    expect(workflow).toContain('api-level: 35');
    expect(workflow).toContain('pnpm example:android-instrumentation');
    expectFixtureManifest('android/src/test/assets/avif/manifest.json', ['avif']);
    expectFixtureManifest('android/src/test/assets/heic-heif/manifest.json', [
      'heic',
      'heif',
    ]);
  });
});
