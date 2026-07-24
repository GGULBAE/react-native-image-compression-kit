import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  compressImage,
  getImageCompressionCapabilities,
  type CompressionResult,
  type ImageCompressionCapabilities,
  type ImageCompressionKitErrorCode,
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
  supportsCancellation: true,
  maxConcurrentOperations: 2,
  supportsDecodeDownsampling: true,
  resourceLimits: {
    maxSourceDimension: 32_768,
    maxSourcePixels: 100_000_000,
    maxWorkingPixels: 25_000_000,
  },
};

const publicErrorCode: ImageCompressionKitErrorCode = 'ERR_INVALID_OPTIONS';

function mockNativeModule(
  overrides: Partial<NativeImageCompressionKitModule> = {}
): NativeImageCompressionKitModule {
  return {
    compressImage: vi.fn().mockResolvedValue(result),
    cancelCompression: vi.fn(),
    getImageCompressionCapabilities: vi.fn().mockResolvedValue(capabilities),
    ...overrides,
  };
}

afterEach(() => {
  resetNativeModuleForTesting();
  vi.restoreAllMocks();
});

describe('compressImage', () => {
  it('exports the stable public error-code union from the package root', () => {
    expect(publicErrorCode).toBe('ERR_INVALID_OPTIONS');
  });

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

    expect(nativeModule.compressImage).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: expect.stringMatching(/^rnick-/),
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
      })
    );
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

    expect(nativeModule.compressImage).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: expect.stringMatching(/^rnick-/),
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
      })
    );
  });

  it('normalizes preflight, queued, and running aborts to ERR_CANCELLED', async () => {
    const preflight = new AbortController();
    const nativeModule = mockNativeModule();
    setNativeModuleForTesting(nativeModule);
    preflight.abort();

    await expect(
      compressImage(
        {
          source: { uri: 'file:///tmp/input.jpg' },
          output: { format: 'jpeg' },
        },
        preflight.signal
      )
    ).rejects.toMatchObject({ code: 'ERR_CANCELLED' });
    expect(nativeModule.compressImage).not.toHaveBeenCalled();

    let resolveNative: ((value: CompressionResult) => void) | undefined;
    const runningModule = mockNativeModule({
      compressImage: vi.fn(
        () =>
          new Promise<CompressionResult>((resolve) => {
            resolveNative = resolve;
          })
      ),
    });
    setNativeModuleForTesting(runningModule);
    const running = new AbortController();
    const compression = compressImage(
      {
        source: { uri: 'file:///tmp/input.jpg' },
        output: { format: 'jpeg' },
      },
      { signal: running.signal }
    );
    const operationId = (runningModule.compressImage as ReturnType<typeof vi.fn>)
      .mock.calls[0][0].operationId;
    running.abort();

    await expect(compression).rejects.toMatchObject({ code: 'ERR_CANCELLED' });
    expect(runningModule.cancelCompression).toHaveBeenCalledWith(operationId);
    resolveNative?.(result);
    running.abort();
    expect(runningModule.cancelCompression).toHaveBeenCalledTimes(1);
  });

  it('keeps cancellation deterministic when the native cancel signal throws', async () => {
    const nativeModule = mockNativeModule({
      compressImage: vi.fn(() => new Promise<CompressionResult>(() => undefined)),
      cancelCompression: vi.fn(() => {
        throw new Error('bridge invalidating');
      }),
    });
    setNativeModuleForTesting(nativeModule);
    const controller = new AbortController();
    const compression = compressImage(
      {
        source: { uri: 'file:///tmp/input.jpg' },
        output: { format: 'jpeg' },
      },
      controller.signal
    );

    controller.abort(new Error('user navigated away'));

    await expect(compression).rejects.toMatchObject({
      code: 'ERR_CANCELLED',
      message: 'Image compression was cancelled: user navigated away',
    });
    expect(nativeModule.cancelCompression).toHaveBeenCalledTimes(1);
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
        'Native module ImageCompressionKit is unavailable. Rebuild the React Native app after installing react-native-image-compression-kit. Android runtime compression supports JPEG/PNG/WebP/GIF/HEIC/HEIF/AVIF input with JPEG, PNG, and WebP output. iOS runtime compression supports JPEG/PNG/GIF/WebP/HEIC/HEIF input and runtime-available ImageIO AVIF input with JPEG, PNG, and runtime-gated ImageIO-backed WebP output. HEIC, HEIF, and AVIF output remain unsupported and reject with ERR_NOT_IMPLEMENTED; AVIF output stays gated until encoder/destination support, decode-back validation, metadata preserve, output.maxBytes, and animation boundaries are explicitly designed and tested.',
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
          "iOS MVP supports AVIF input when ImageIO source decoding is available, but AVIF output is not implemented. Supported output formats are JPEG, PNG, and runtime-available WebP. Future AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation; metadata='preserve', output.maxBytes, and animated AVIF preservation remain unsupported for AVIF output. output.format: 'avif' rejects with ERR_NOT_IMPLEMENTED.",
      }),
    });
    setNativeModuleForTesting(nativeModule);

    await expect(
      compressImage({
        source: { uri: 'file:///tmp/input.jpg' },
        output: { format: 'avif', quality: 80 },
      })
    ).rejects.toMatchObject({
      code: 'ERR_NOT_IMPLEMENTED',
      message:
        "iOS MVP supports AVIF input when ImageIO source decoding is available, but AVIF output is not implemented. Supported output formats are JPEG, PNG, and runtime-available WebP. Future AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation; metadata='preserve', output.maxBytes, and animated AVIF preservation remain unsupported for AVIF output. output.format: 'avif' rejects with ERR_NOT_IMPLEMENTED.",
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

  it('normalizes native capability failures through the public error contract', async () => {
    const nativeModule = mockNativeModule({
      getImageCompressionCapabilities: vi.fn().mockRejectedValue(
        Object.assign(new Error('capability probe failed'), {
          code: 'ERR_NATIVE_OPERATION_FAILED',
        })
      ),
    });
    setNativeModuleForTesting(nativeModule);

    await expect(getImageCompressionCapabilities()).rejects.toMatchObject({
      code: 'ERR_NATIVE_OPERATION_FAILED',
      message: 'capability probe failed',
    });
  });
});
