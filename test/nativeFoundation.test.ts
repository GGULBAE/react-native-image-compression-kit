import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';
import {
  NATIVE_MODULE_NAME,
  type NativeImageCompressionKitModule,
} from '../src/nativeModule';

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
});
