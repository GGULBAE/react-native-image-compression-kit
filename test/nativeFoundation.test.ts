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

  it('keeps the iOS package stub explicit about unavailable compression', () => {
    const iosStubSource = readProjectFile('ios/RCTImageCompressionKit.mm');

    expect(iosStubSource).toContain(
      'RCTImageCompressionKitNotImplementedCode = @"ERR_NOT_IMPLEMENTED"'
    );
    expect(iosStubSource).toContain(
      'iOS compression is not implemented in react-native-image-compression-kit yet.'
    );
    expect(iosStubSource).toContain(
      'No iOS input or output formats are available in v0.1.x.'
    );
    expect(iosStubSource).toContain('@"metadataPolicies" : @[]');
    expect(iosStubSource).toContain(
      '@"supportsTargetSizeCompression" : @NO'
    );
    expect(iosStubSource).toContain('@"supportsCancellation" : @NO');
  });
});
