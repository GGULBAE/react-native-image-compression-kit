import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImage, type CompressionOptions } from '../src';
import {
  resetNativeModuleForTesting,
  setNativeModuleForTesting,
  type NativeImageCompressionKitModule,
} from '../src/nativeModule';

const validResult = {
  uri: 'file:///tmp/output.jpg',
  format: 'jpeg' as const,
  width: 100,
  height: 100,
  byteSize: 10_000,
  originalByteSize: 20_000,
  compressionRatio: 0.5,
};

function mockNativeModule(): NativeImageCompressionKitModule {
  return {
    compressImage: vi.fn().mockResolvedValue(validResult),
    getImageCompressionCapabilities: vi.fn(),
  };
}

async function expectInvalidOptions(
  options: unknown,
  code = 'ERR_INVALID_OPTIONS'
): Promise<void> {
  const nativeModule = mockNativeModule();
  setNativeModuleForTesting(nativeModule);

  await expect(compressImage(options as CompressionOptions)).rejects.toMatchObject(
    { code }
  );
  expect(nativeModule.compressImage).not.toHaveBeenCalled();
}

afterEach(() => {
  resetNativeModuleForTesting();
  vi.restoreAllMocks();
});

describe('compressImage validation', () => {
  it('requires source.uri', async () => {
    await expectInvalidOptions({
      source: {},
      output: { format: 'jpeg', quality: 80 },
    });

    await expectInvalidOptions({
      source: { uri: '   ' },
      output: { format: 'jpeg', quality: 80 },
    });
  });

  it('rejects remote URLs and inline data URIs', async () => {
    await expectInvalidOptions(
      {
        source: { uri: 'https://example.com/input.jpg' },
        output: { format: 'jpeg', quality: 80 },
      },
      'ERR_UNSUPPORTED_SOURCE'
    );

    await expectInvalidOptions(
      {
        source: { uri: 'data:image/png;base64,AAAA' },
        output: { format: 'png' },
      },
      'ERR_UNSUPPORTED_SOURCE'
    );
  });

  it('accepts local file and Android content URIs', async () => {
    const nativeModule = mockNativeModule();
    setNativeModuleForTesting(nativeModule);

    await compressImage({
      source: { uri: 'file:///tmp/input.jpg' },
      output: { format: 'jpeg', quality: 80 },
    });

    await compressImage({
      source: { uri: 'content://media/external/images/1' },
      output: { format: 'webp', maxBytes: 500_000 },
    });

    expect(nativeModule.compressImage).toHaveBeenCalledTimes(2);
  });

  it('requires output.format to be a planned output format', async () => {
    await expectInvalidOptions({
      source: { uri: 'file:///tmp/input.gif' },
      output: { format: 'gif' },
    });

    await expectInvalidOptions({
      source: { uri: 'file:///tmp/input.jpg' },
      output: { format: 'bmp' },
    });
  });

  it('validates quality and target byte options', async () => {
    await expectInvalidOptions({
      source: { uri: 'file:///tmp/input.jpg' },
      output: { format: 'jpeg', quality: -1 },
    });

    await expectInvalidOptions({
      source: { uri: 'file:///tmp/input.jpg' },
      output: { format: 'jpeg', quality: 101 },
    });

    await expectInvalidOptions({
      source: { uri: 'file:///tmp/input.jpg' },
      output: { format: 'jpeg', quality: 80.5 },
    });

    await expectInvalidOptions({
      source: { uri: 'file:///tmp/input.jpg' },
      output: { format: 'webp', maxBytes: 0 },
    });

    await expectInvalidOptions({
      source: { uri: 'file:///tmp/input.jpg' },
      output: { format: 'webp', maxBytes: 80.5 },
    });
  });

  it('validates resize dimensions and mode', async () => {
    await expectInvalidOptions({
      source: { uri: 'file:///tmp/input.jpg' },
      resize: {},
      output: { format: 'jpeg', quality: 80 },
    });

    await expectInvalidOptions({
      source: { uri: 'file:///tmp/input.jpg' },
      resize: { maxWidth: -1 },
      output: { format: 'jpeg', quality: 80 },
    });

    await expectInvalidOptions({
      source: { uri: 'file:///tmp/input.jpg' },
      resize: { maxHeight: 800, mode: 'inside' },
      output: { format: 'jpeg', quality: 80 },
    });
  });

  it('validates metadata policies', async () => {
    await expectInvalidOptions({
      source: { uri: 'file:///tmp/input.jpg' },
      output: { format: 'jpeg', quality: 80 },
      metadata: 'keep-location',
    });
  });
});
