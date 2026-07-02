import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  compressImage,
  getImageCompressionCapabilities,
  type CompressionResult,
  type ImageCompressionCapabilities,
} from '../src';
import {
  resetNativeModuleForTesting,
  setNativeModuleForTesting,
  type NativeImageCompressionKitModule,
} from '../src/nativeModule';

const result: CompressionResult = {
  uri: 'file:///tmp/output.webp',
  format: 'webp',
  width: 2048,
  height: 1365,
  byteSize: 482_319,
  originalByteSize: 3_814_220,
  compressionRatio: 0.126,
};

const capabilities: ImageCompressionCapabilities = {
  platform: 'android',
  formats: [
    {
      format: 'jpeg',
      input: true,
      output: true,
      supportsAlpha: false,
      supportsAnimation: false,
    },
    {
      format: 'gif',
      input: true,
      output: false,
      supportsAlpha: true,
      supportsAnimation: false,
      notes: ['Static first-frame support is planned before animation preservation.'],
    },
  ],
  metadataPolicies: ['preserve', 'safe', 'strip'],
  supportsTargetSizeCompression: true,
  supportsCancellation: false,
};

function mockNativeModule(
  overrides: Partial<NativeImageCompressionKitModule> = {}
): NativeImageCompressionKitModule {
  return {
    compressImage: vi.fn().mockResolvedValue(result),
    getImageCompressionCapabilities: vi.fn().mockResolvedValue(capabilities),
    ...overrides,
  };
}

afterEach(() => {
  resetNativeModuleForTesting();
  vi.restoreAllMocks();
});

describe('compressImage', () => {
  it('exports a Promise-based public API and returns the native result', async () => {
    const nativeModule = mockNativeModule();
    setNativeModuleForTesting(nativeModule);

    await expect(
      compressImage({
        source: { uri: 'file:///tmp/input.jpg' },
        output: { format: 'webp', quality: 80 },
      })
    ).resolves.toEqual(result);

    expect(nativeModule.compressImage).toHaveBeenCalledTimes(1);
  });

  it('normalizes defaults before calling the native bridge', async () => {
    const nativeModule = mockNativeModule();
    setNativeModuleForTesting(nativeModule);

    await compressImage({
      source: { uri: 'file:///tmp/input.jpg' },
      resize: {
        maxWidth: 2048,
      },
      output: {
        format: 'webp',
        quality: 80,
        maxBytes: 500_000,
      },
    });

    expect(nativeModule.compressImage).toHaveBeenCalledWith({
      source: { uri: 'file:///tmp/input.jpg' },
      resize: {
        maxWidth: 2048,
        mode: 'contain',
      },
      output: {
        format: 'webp',
        quality: 80,
        maxBytes: 500_000,
      },
      metadata: 'safe',
    });
  });

  it('passes explicit resize mode and metadata policy to native code', async () => {
    const nativeModule = mockNativeModule();
    setNativeModuleForTesting(nativeModule);

    await compressImage({
      source: { uri: 'content://media/external/images/1' },
      resize: {
        maxWidth: 1200,
        maxHeight: 800,
        mode: 'cover',
      },
      output: {
        format: 'jpeg',
        quality: 76,
      },
      metadata: 'strip',
    });

    expect(nativeModule.compressImage).toHaveBeenCalledWith({
      source: { uri: 'content://media/external/images/1' },
      resize: {
        maxWidth: 1200,
        maxHeight: 800,
        mode: 'cover',
      },
      output: {
        format: 'jpeg',
        quality: 76,
      },
      metadata: 'strip',
    });
  });

  it('surfaces unavailable native module errors clearly', async () => {
    setNativeModuleForTesting(null);

    await expect(
      compressImage({
        source: { uri: 'file:///tmp/input.jpg' },
        output: { format: 'jpeg', quality: 80 },
      })
    ).rejects.toMatchObject({
      code: 'ERR_NATIVE_MODULE_UNAVAILABLE',
      message:
        'Native module ImageCompressionKit is unavailable. Rebuild the React Native app after installing react-native-image-compression-kit. Android runtime compression is implemented; iOS runtime compression is implemented for JPEG/PNG/GIF/WebP input with JPEG, PNG, and ImageIO-backed WebP output, including JPEG target-size maxBytes and static first-frame GIF/WebP input, in version 0.2.5.',
    });
  });

  it('maps non-Error native failures to a stable JS error code', async () => {
    const nativeModule = mockNativeModule({
      compressImage: vi.fn().mockRejectedValue({
        message: 'Encoder rejected the selected output format.',
      }),
    });
    setNativeModuleForTesting(nativeModule);

    await expect(
      compressImage({
        source: { uri: 'file:///tmp/input.jpg' },
        output: { format: 'avif', quality: 65 },
      })
    ).rejects.toMatchObject({
      code: 'ERR_NATIVE_OPERATION_FAILED',
      message: 'Encoder rejected the selected output format.',
    });
  });

  it('preserves native not-implemented errors from unsupported platform options', async () => {
    const nativeModule = mockNativeModule({
      compressImage: vi.fn().mockRejectedValue({
        code: 'ERR_NOT_IMPLEMENTED',
        message:
          'iOS MVP supports JPEG, PNG, and WebP output only. Call getImageCompressionCapabilities() before selecting a platform output format.',
      }),
    });
    setNativeModuleForTesting(nativeModule);

    await expect(
      compressImage({
        source: { uri: 'file:///tmp/input.jpg' },
        output: { format: 'jpeg', quality: 80 },
      })
    ).rejects.toMatchObject({
      code: 'ERR_NOT_IMPLEMENTED',
      message:
        'iOS MVP supports JPEG, PNG, and WebP output only. Call getImageCompressionCapabilities() before selecting a platform output format.',
    });
  });

  it('preserves Android MVP native error codes for platform-gated inputs', async () => {
    const nativeModule = mockNativeModule({
      compressImage: vi.fn().mockRejectedValue({
        code: 'ERR_UNSUPPORTED_FORMAT',
        message: 'Android AVIF input requires Android 14+ platform decoder support.',
      }),
    });
    setNativeModuleForTesting(nativeModule);

    await expect(
      compressImage({
        source: { uri: 'file:///tmp/input.avif' },
        output: { format: 'jpeg', quality: 80 },
      })
    ).rejects.toMatchObject({
      code: 'ERR_UNSUPPORTED_FORMAT',
      message: 'Android AVIF input requires Android 14+ platform decoder support.',
    });
  });
});

describe('getImageCompressionCapabilities', () => {
  it('delegates capability inspection to the native bridge', async () => {
    const nativeModule = mockNativeModule();
    setNativeModuleForTesting(nativeModule);

    await expect(getImageCompressionCapabilities()).resolves.toEqual(
      capabilities
    );

    expect(nativeModule.getImageCompressionCapabilities).toHaveBeenCalledTimes(
      1
    );
  });
});
