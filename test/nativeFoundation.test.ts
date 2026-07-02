import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import packageJson from '../package.json';
import {
  NATIVE_MODULE_NAME,
  type NativeImageCompressionKitModule,
} from '../src/nativeModule';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readProjectFile(filePath: string): string {
  return readFileSync(path.join(ROOT, filePath), 'utf8');
}

describe('native module foundation', () => {
  it('declares the codegen configuration for a TurboModule library', () => {
    expect(packageJson.codegenConfig).toEqual({
      name: 'RNImageCompressionKitSpec',
      type: 'modules',
      jsSrcsDir: 'src',
      outputDir: {
        ios: 'ios/generated',
        android: 'android/generated',
      },
      android: {
        javaPackageName: 'com.imagecompressionkit',
      },
      ios: {
        modulesProvider: {
          ImageCompressionKit: 'RCTImageCompressionKit',
        },
      },
    });
  });

  it('keeps the JS bridge module name aligned with the native stubs', () => {
    expect(NATIVE_MODULE_NAME).toBe('ImageCompressionKit');
  });

  it('keeps the codegen module contract promise-based', () => {
    const moduleShape = {
      compressImage: async () => ({
        uri: 'file:///tmp/output.jpg',
        format: 'jpeg' as const,
        width: 100,
        height: 100,
        byteSize: 1_000,
        originalByteSize: 2_000,
        compressionRatio: 0.5,
      }),
      getImageCompressionCapabilities: async () => ({
        platform: 'unknown' as const,
        formats: [],
        metadataPolicies: ['preserve', 'safe', 'strip'],
        supportsTargetSizeCompression: false,
        supportsCancellation: false,
      }),
    } satisfies NativeImageCompressionKitModule;

    expect(typeof moduleShape.compressImage).toBe('function');
    expect(typeof moduleShape.getImageCompressionCapabilities).toBe('function');
  });

  it('keeps the iOS native MVP explicit about supported compression', () => {
    const iosSource = readProjectFile('ios/RCTImageCompressionKit.mm');

    expect(iosSource).toContain(
      'RCTImageCompressionKitUnsupportedFormatCode = @"ERR_UNSUPPORTED_FORMAT"'
    );
    expect(iosSource).toContain('CGImageSourceCreateWithData');
    expect(iosSource).toContain('CGImageSourceCreateImageAtIndex');
    expect(iosSource).toContain('RCT_EXPORT_MODULE(ImageCompressionKit)');
    expect(iosSource).toContain(
      'compressImage:(JS::NativeImageCompressionKit::NativeCompressionOptions &)options'
    );
    expect(iosSource).toContain('compressImageWithDictionary:optionsMap');
    expect(iosSource).toContain('dispatch_get_main_queue()');
    expect(iosSource).toContain('RNICK_IOS_SMOKE_NATIVE');
    expect(iosSource).toContain('UIImageJPEGRepresentation');
    expect(iosSource).toContain('UIImagePNGRepresentation');
    expect(iosSource).toContain('CGImageDestinationCopyTypeIdentifiers');
    expect(iosSource).toContain('CGImageDestinationCreateWithData');
    expect(iosSource).toContain('CGImageDestinationAddImage');
    expect(iosSource).toContain('CGImageDestinationFinalize');
    expect(iosSource).toContain('kCGImageDestinationLossyCompressionQuality');
    expect(iosSource).toContain('RCTImageCompressionKitEncodeWebP');
    expect(iosSource).toContain(
      'iOS MVP supports JPEG, PNG, GIF, WebP, HEIC, and HEIF input only. GIF, WebP, HEIC, and HEIF input are decoded as static images through ImageIO.'
    );
    expect(iosSource).toContain('RCTImageCompressionKitIsHeicHeifType');
    expect(iosSource).toContain(
      'iOS MVP supports JPEG, PNG, and WebP output only. Call getImageCompressionCapabilities() before selecting a platform output format.'
    );
    expect(iosSource).toContain(
      'iOS MVP supports output.maxBytes for JPEG and runtime-available WebP output only.'
    );
    expect(iosSource).toContain('RCTImageCompressionKitReadMaxBytes');
    expect(iosSource).toContain('Compression output.maxBytes must be a positive integer.');
    expect(iosSource).toContain('RCTImageCompressionKitEncodeToTargetSize');
    expect(iosSource).toContain('RCTImageCompressionKitEncodeQualityOutput');
    expect(iosSource).toContain('bestWithinTargetData');
    expect(iosSource).toContain(
      '@"metadataPolicies" : @[RCTImageCompressionKitDefaultMetadataPolicy, RCTImageCompressionKitStripMetadataPolicy]'
    );
    expect(iosSource).toContain('@"supportsTargetSizeCompression" : @YES');
    expect(iosSource).toContain('@"supportsCancellation" : @NO');
  });
});
