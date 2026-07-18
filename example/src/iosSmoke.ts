import {
  compressImage,
  getImageCompressionCapabilities,
  type CompressionResult,
  type ImageCompressionCapabilities,
  type ImageFormat,
  type OutputFormat,
} from 'react-native-image-compression-kit';
import {
  SAMPLE_MODULE,
  type ExampleImageSourceModule,
  type IOSSmokeSampleModule,
} from './exampleNative';
import { toErrorState } from './exampleUtils';

const IOS_SMOKE_STEP_TIMEOUT_MS = 30_000;
const IOS_JPEG_METADATA_SOFTWARE = 'RNICK iOS metadata preserve fixture';
const IOS_JPEG_SOURCE_EXIF_WIDTH = 320;
const IOS_JPEG_SOURCE_EXIF_HEIGHT = 200;

export async function emitIOSSmokeLog(message: string): Promise<void> {
  console.log(message);

  try {
    await SAMPLE_MODULE?.logSmokeEvent?.(message);
  } catch {
    // The Metro console log above is still useful when native logging is unavailable.
  }
}

type IOSHostAppSmokeSummary = {
  platform: 'ios';
  jpegResultBytes: number;
  jpegPreserveResultBytes: number;
  pngResultBytes: number;
  gifResultBytes: number;
  webpResultBytes: number;
  heicResultBytes: number;
  heifResultBytes: number;
  avifResultBytes?: number;
  jpegToPngResultBytes: number;
  pngToPngResultBytes: number;
  gifToPngResultBytes: number;
  webpToPngResultBytes: number;
  heicToPngResultBytes: number;
  heifToPngResultBytes: number;
  avifToPngResultBytes?: number;
  webpOutputAvailable: boolean;
  avifInputAvailable: boolean;
  jpegToWebPResultBytes?: number;
  pngToWebPResultBytes?: number;
  gifToWebPResultBytes?: number;
  webpToWebPResultBytes?: number;
  heicToWebPResultBytes?: number;
  heifToWebPResultBytes?: number;
  avifToWebPResultBytes?: number;
  webpTargetSizeResultBytes?: number;
  targetSizeResultBytes: number;
  unsupportedInputs: string[];
  unsupportedOutputs: string[];
};

export async function runIOSHostAppSmokeValidation(): Promise<IOSHostAppSmokeSummary> {
  await emitIOSSmokeLog('RNICK_IOS_SMOKE_START');

  const sampleModule = SAMPLE_MODULE;
  assertIOSSmokeSampleModule(sampleModule);
  const copySampleJpegToCache = sampleModule.copySampleJpegToCache;
  const copySamplePngToCache = sampleModule.copySamplePngToCache;
  const copySampleHeicToCache = sampleModule.copySampleHeicToCache;
  const copySampleHeifToCache = sampleModule.copySampleHeifToCache;
  const copySampleAvifToCache = sampleModule.copySampleAvifToCache;
  const copyUnsupportedImageToCache =
    sampleModule.copyUnsupportedImageToCache;
  const readJpegMetadataSummary = sampleModule.readJpegMetadataSummary;

  const capabilities = await runIOSSmokeStep('capabilities', () =>
    getImageCompressionCapabilities()
  );
  assertIOSSmoke(
    capabilities.platform === 'ios',
    `Expected iOS capabilities, received ${capabilities.platform}.`
  );
  assertIOSFormatCapability(capabilities, 'jpeg', true, true);
  assertIOSFormatCapability(capabilities, 'png', true, true);
  assertIOSFormatCapability(capabilities, 'gif', true, false);
  assertIOSFormatCapability(capabilities, 'heic', true, false);
  assertIOSFormatCapability(capabilities, 'heif', true, false);
  const webpCapability = assertIOSFormatCapability(capabilities, 'webp', true);
  const avifCapability = assertIOSFormatCapability(
    capabilities,
    'avif',
    undefined,
    false
  );
  const webpOutputAvailable = webpCapability.output === true;
  const avifInputAvailable = avifCapability.input === true;
  assertIOSSmoke(
    avifCapability.notes?.some((note) =>
      note.includes("output.format: 'avif' rejects with ERR_NOT_IMPLEMENTED")
    ) === true,
    'Expected iOS AVIF capability notes to describe the unsupported AVIF output path.'
  );
  assertIOSSmoke(
    capabilities.metadataPolicies.join(',') === 'preserve,safe,strip',
    `Expected iOS metadata policies preserve,safe,strip, received ${capabilities.metadataPolicies.join(',')}.`
  );
  assertIOSSmoke(
    capabilities.supportsTargetSizeCompression === true,
    'Expected iOS JPEG target-size compression to be supported.'
  );
  assertIOSSmoke(
    capabilities.supportsCancellation === false,
    'Expected iOS cancellation to be unsupported.'
  );

  const jpegUri = await runIOSSmokeStep('copy-jpeg-fixture', () =>
    copySampleJpegToCache()
  );
  const pngUri = await runIOSSmokeStep('copy-png-fixture', () =>
    copySamplePngToCache()
  );
  const gifUri = await runIOSSmokeStep('copy-gif-fixture', () =>
    copyUnsupportedImageToCache('gif')
  );
  const webpUri = await runIOSSmokeStep('copy-webp-fixture', () =>
    copyUnsupportedImageToCache('webp')
  );
  const heicUri = await runIOSSmokeStep('copy-heic-fixture', () =>
    copySampleHeicToCache()
  );
  const heifUri = await runIOSSmokeStep('copy-heif-fixture', () =>
    copySampleHeifToCache()
  );
  const avifUri = await runIOSSmokeStep('copy-avif-fixture', () =>
    copySampleAvifToCache()
  );
  const targetSizeMaxBytes = 1_000;
  const metadataPreserveMaxBytes = 3_000;
  const jpegSourceMetadata = await runIOSSmokeStep(
    'read-jpeg-source-metadata',
    () => readJpegMetadataSummary(jpegUri)
  );
  assertIOSSmoke(
    jpegSourceMetadata.software === IOS_JPEG_METADATA_SOFTWARE,
    `Expected source JPEG metadata software ${IOS_JPEG_METADATA_SOFTWARE}, received ${jpegSourceMetadata.software}.`
  );
  assertIOSSmoke(
    jpegSourceMetadata.tiffOrientation === 6,
    `Expected source JPEG TIFF orientation 6, received ${jpegSourceMetadata.tiffOrientation}.`
  );
  assertIOSSmoke(
    jpegSourceMetadata.exifPixelXDimension === IOS_JPEG_SOURCE_EXIF_WIDTH &&
      jpegSourceMetadata.exifPixelYDimension === IOS_JPEG_SOURCE_EXIF_HEIGHT,
    `Expected source JPEG EXIF dimensions ${IOS_JPEG_SOURCE_EXIF_WIDTH}x${IOS_JPEG_SOURCE_EXIF_HEIGHT}, received ${jpegSourceMetadata.exifPixelXDimension}x${jpegSourceMetadata.exifPixelYDimension}.`
  );
  const jpegResult = await runIOSSmokeStep('compress-jpeg-to-jpeg', () =>
    compressImage({
      source: { uri: jpegUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: { format: 'jpeg', quality: 68 },
      metadata: 'safe',
    })
  );
  const jpegPreserveResult = await runIOSSmokeStep(
    'compress-jpeg-to-jpeg-preserve-metadata',
    () =>
      compressImage({
        source: { uri: jpegUri },
        resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
        output: {
          format: 'jpeg',
          quality: 90,
          maxBytes: metadataPreserveMaxBytes,
        },
        metadata: 'preserve',
      })
  );
  const jpegPreservedMetadata = await runIOSSmokeStep(
    'read-jpeg-preserve-metadata',
    () => readJpegMetadataSummary(jpegPreserveResult.uri)
  );
  const pngResult = await runIOSSmokeStep('compress-png-to-jpeg', () =>
    compressImage({
      source: { uri: pngUri },
      resize: { maxWidth: 18, maxHeight: 12, mode: 'cover' },
      output: { format: 'jpeg', quality: 72 },
      metadata: 'strip',
    })
  );
  const gifResult = await runIOSSmokeStep('compress-gif-to-jpeg', () =>
    compressImage({
      source: { uri: gifUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: {
        format: 'jpeg',
        quality: 74,
        maxBytes: targetSizeMaxBytes,
      },
      metadata: 'safe',
    })
  );
  const webpResult = await runIOSSmokeStep('compress-webp-to-jpeg', () =>
    compressImage({
      source: { uri: webpUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: {
        format: 'jpeg',
        quality: 74,
        maxBytes: targetSizeMaxBytes,
      },
      metadata: 'safe',
    })
  );
  const heicResult = await runIOSSmokeStep('compress-heic-to-jpeg', () =>
    compressImage({
      source: { uri: heicUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: {
        format: 'jpeg',
        quality: 74,
        maxBytes: targetSizeMaxBytes,
      },
      metadata: 'safe',
    })
  );
  const heifResult = await runIOSSmokeStep('compress-heif-to-jpeg', () =>
    compressImage({
      source: { uri: heifUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: {
        format: 'jpeg',
        quality: 74,
        maxBytes: targetSizeMaxBytes,
      },
      metadata: 'safe',
    })
  );
  let avifResult: CompressionResult | undefined;
  if (avifInputAvailable) {
    avifResult = await runIOSSmokeStep('compress-avif-to-jpeg', () =>
      compressImage({
        source: { uri: avifUri },
        resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
        output: {
          format: 'jpeg',
          quality: 74,
          maxBytes: targetSizeMaxBytes,
        },
        metadata: 'safe',
      })
    );
  }

  assertCompressionResult(jpegResult, 'jpeg');
  assertCompressionResult(jpegPreserveResult, 'jpeg');
  assertCompressionResult(pngResult, 'jpeg');
  assertCompressionResult(gifResult, 'jpeg');
  assertCompressionResult(webpResult, 'jpeg');
  assertCompressionResult(heicResult, 'jpeg');
  assertCompressionResult(heifResult, 'jpeg');
  if (avifResult) {
    assertCompressionResult(avifResult, 'jpeg');
  }
  assertIOSSmoke(
    jpegPreserveResult.byteSize <= metadataPreserveMaxBytes,
    `Expected iOS JPEG preserve target-size output <= ${metadataPreserveMaxBytes} bytes, received ${jpegPreserveResult.byteSize}.`
  );
  assertIOSSmoke(
    jpegPreservedMetadata.software === IOS_JPEG_METADATA_SOFTWARE,
    `Expected preserved JPEG metadata software ${IOS_JPEG_METADATA_SOFTWARE}, received ${jpegPreservedMetadata.software}.`
  );
  assertIOSSmoke(
    jpegPreservedMetadata.orientation === 1 &&
      jpegPreservedMetadata.tiffOrientation === 1,
    `Expected preserved JPEG orientation metadata 1/1, received ${jpegPreservedMetadata.orientation}/${jpegPreservedMetadata.tiffOrientation}.`
  );
  assertIOSSmoke(
    jpegPreservedMetadata.pixelWidth === jpegPreserveResult.width &&
      jpegPreservedMetadata.pixelHeight === jpegPreserveResult.height,
    `Expected preserved JPEG pixel metadata ${jpegPreserveResult.width}x${jpegPreserveResult.height}, received ${jpegPreservedMetadata.pixelWidth}x${jpegPreservedMetadata.pixelHeight}.`
  );
  assertIOSSmoke(
    jpegPreservedMetadata.exifPixelXDimension === jpegPreserveResult.width &&
      jpegPreservedMetadata.exifPixelYDimension === jpegPreserveResult.height,
    `Expected preserved JPEG EXIF dimensions ${jpegPreserveResult.width}x${jpegPreserveResult.height}, received ${jpegPreservedMetadata.exifPixelXDimension}x${jpegPreservedMetadata.exifPixelYDimension}.`
  );
  assertIOSSmoke(
    gifResult.byteSize <= targetSizeMaxBytes,
    `Expected iOS GIF target-size output <= ${targetSizeMaxBytes} bytes, received ${gifResult.byteSize}.`
  );
  assertIOSSmoke(
    webpResult.byteSize <= targetSizeMaxBytes,
    `Expected iOS WebP target-size output <= ${targetSizeMaxBytes} bytes, received ${webpResult.byteSize}.`
  );
  assertIOSSmoke(
    heicResult.byteSize <= targetSizeMaxBytes,
    `Expected iOS HEIC target-size output <= ${targetSizeMaxBytes} bytes, received ${heicResult.byteSize}.`
  );
  assertIOSSmoke(
    heifResult.byteSize <= targetSizeMaxBytes,
    `Expected iOS HEIF target-size output <= ${targetSizeMaxBytes} bytes, received ${heifResult.byteSize}.`
  );
  if (avifResult) {
    assertIOSSmoke(
      avifResult.byteSize <= targetSizeMaxBytes,
      `Expected iOS AVIF target-size output <= ${targetSizeMaxBytes} bytes, received ${avifResult.byteSize}.`
    );
  }

  const jpegToPngResult = await runIOSSmokeStep('compress-jpeg-to-png', () =>
    compressImage({
      source: { uri: jpegUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: { format: 'png', quality: 10 },
      metadata: 'safe',
    })
  );
  const pngToPngResult = await runIOSSmokeStep('compress-png-to-png', () =>
    compressImage({
      source: { uri: pngUri },
      resize: { maxWidth: 18, maxHeight: 12, mode: 'cover' },
      output: { format: 'png', quality: 10 },
      metadata: 'strip',
    })
  );
  const gifToPngResult = await runIOSSmokeStep('compress-gif-to-png', () =>
    compressImage({
      source: { uri: gifUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: { format: 'png', quality: 10 },
      metadata: 'strip',
    })
  );
  const webpToPngResult = await runIOSSmokeStep('compress-webp-to-png', () =>
    compressImage({
      source: { uri: webpUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: { format: 'png', quality: 10 },
      metadata: 'strip',
    })
  );
  const heicToPngResult = await runIOSSmokeStep('compress-heic-to-png', () =>
    compressImage({
      source: { uri: heicUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: { format: 'png', quality: 10 },
      metadata: 'strip',
    })
  );
  const heifToPngResult = await runIOSSmokeStep('compress-heif-to-png', () =>
    compressImage({
      source: { uri: heifUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: { format: 'png', quality: 10 },
      metadata: 'strip',
    })
  );
  let avifToPngResult: CompressionResult | undefined;
  if (avifInputAvailable) {
    avifToPngResult = await runIOSSmokeStep('compress-avif-to-png', () =>
      compressImage({
        source: { uri: avifUri },
        resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
        output: { format: 'png', quality: 10 },
        metadata: 'strip',
      })
    );
  }

  assertCompressionResult(jpegToPngResult, 'png');
  assertCompressionResult(pngToPngResult, 'png');
  assertCompressionResult(gifToPngResult, 'png');
  assertCompressionResult(webpToPngResult, 'png');
  assertCompressionResult(heicToPngResult, 'png');
  assertCompressionResult(heifToPngResult, 'png');
  if (avifToPngResult) {
    assertCompressionResult(avifToPngResult, 'png');
  }

  let jpegToWebPResult: CompressionResult | undefined;
  let pngToWebPResult: CompressionResult | undefined;
  let gifToWebPResult: CompressionResult | undefined;
  let webpToWebPResult: CompressionResult | undefined;
  let heicToWebPResult: CompressionResult | undefined;
  let heifToWebPResult: CompressionResult | undefined;
  let avifToWebPResult: CompressionResult | undefined;
  let webpTargetSizeResult: CompressionResult | undefined;

  if (webpOutputAvailable) {
    jpegToWebPResult = await runIOSSmokeStep('compress-jpeg-to-webp', () =>
      compressImage({
        source: { uri: jpegUri },
        resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
        output: { format: 'webp', quality: 72 },
        metadata: 'safe',
      })
    );
    pngToWebPResult = await runIOSSmokeStep('compress-png-to-webp', () =>
      compressImage({
        source: { uri: pngUri },
        resize: { maxWidth: 18, maxHeight: 12, mode: 'cover' },
        output: { format: 'webp', quality: 72 },
        metadata: 'strip',
      })
    );
    gifToWebPResult = await runIOSSmokeStep('compress-gif-to-webp', () =>
      compressImage({
        source: { uri: gifUri },
        resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
        output: { format: 'webp', quality: 72 },
        metadata: 'safe',
      })
    );
    webpToWebPResult = await runIOSSmokeStep('compress-webp-to-webp', () =>
      compressImage({
        source: { uri: webpUri },
        resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
        output: { format: 'webp', quality: 72 },
        metadata: 'strip',
      })
    );
    heicToWebPResult = await runIOSSmokeStep('compress-heic-to-webp', () =>
      compressImage({
        source: { uri: heicUri },
        resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
        output: { format: 'webp', quality: 72 },
        metadata: 'safe',
      })
    );
    heifToWebPResult = await runIOSSmokeStep('compress-heif-to-webp', () =>
      compressImage({
        source: { uri: heifUri },
        resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
        output: { format: 'webp', quality: 72 },
        metadata: 'strip',
      })
    );
    if (avifInputAvailable) {
      avifToWebPResult = await runIOSSmokeStep('compress-avif-to-webp', () =>
        compressImage({
          source: { uri: avifUri },
          resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
          output: { format: 'webp', quality: 72 },
          metadata: 'safe',
        })
      );
    }

    assertCompressionResult(jpegToWebPResult, 'webp');
    assertCompressionResult(pngToWebPResult, 'webp');
    assertCompressionResult(gifToWebPResult, 'webp');
    assertCompressionResult(webpToWebPResult, 'webp');
    assertCompressionResult(heicToWebPResult, 'webp');
    assertCompressionResult(heifToWebPResult, 'webp');
    if (avifToWebPResult) {
      assertCompressionResult(avifToWebPResult, 'webp');
    }

    webpTargetSizeResult = await runIOSSmokeStep(
      'compress-webp-to-webp-max-bytes',
      () =>
        compressImage({
          source: { uri: webpUri },
          resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
          output: {
            format: 'webp',
            quality: 90,
            maxBytes: targetSizeMaxBytes,
          },
          metadata: 'safe',
        })
    );
    assertCompressionResult(webpTargetSizeResult, 'webp');
    assertIOSSmoke(
      webpTargetSizeResult.byteSize <= targetSizeMaxBytes,
      `Expected iOS WebP output target-size <= ${targetSizeMaxBytes} bytes, received ${webpTargetSizeResult.byteSize}.`
    );
  } else {
    await runIOSSmokeStep('reject-webp-output-unavailable', () =>
      expectNativeErrorCode(
        () =>
          compressImage({
            source: { uri: jpegUri },
            output: { format: 'webp', quality: 70 },
            metadata: 'safe',
          }),
        'ERR_NOT_IMPLEMENTED',
        'Expected WebP output to require ImageIO destination support on this iOS runtime.'
      )
    );
  }

  const targetSizeResult = await runIOSSmokeStep(
    'compress-jpeg-to-jpeg-max-bytes',
    () =>
      compressImage({
        source: { uri: jpegUri },
        resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
        output: {
          format: 'jpeg',
          quality: 90,
          maxBytes: targetSizeMaxBytes,
        },
        metadata: 'safe',
      })
  );
  assertCompressionResult(targetSizeResult, 'jpeg');
  assertIOSSmoke(
    targetSizeResult.byteSize <= targetSizeMaxBytes,
    `Expected iOS target-size output <= ${targetSizeMaxBytes} bytes, received ${targetSizeResult.byteSize}.`
  );

  await runIOSSmokeStep('reject-png-max-bytes', () =>
    expectNativeErrorCode(
      () =>
        compressImage({
          source: { uri: pngUri },
          output: { format: 'png', quality: 70, maxBytes: targetSizeMaxBytes },
          metadata: 'safe',
        }),
      'ERR_NOT_IMPLEMENTED',
      'Expected PNG maxBytes to be unsupported on iOS.'
    )
  );

  const unsupportedInputs = avifInputAvailable ? [] : ['avif'];
  if (!avifInputAvailable) {
    await runIOSSmokeStep('reject-avif-input', () =>
      expectNativeErrorCode(
        () =>
          compressImage({
            source: { uri: avifUri },
            output: { format: 'jpeg', quality: 70 },
            metadata: 'safe',
          }),
        'ERR_UNSUPPORTED_FORMAT',
        'Expected AVIF input to require ImageIO source support on this iOS runtime.'
      )
    );
  }

  const unsupportedOutputCases = [
    ...(webpOutputAvailable
      ? []
      : [{ format: 'webp', step: 'reject-webp-output' } as const]),
    { format: 'heic', step: 'reject-heic-output' },
    { format: 'heif', step: 'reject-heif-output' },
    { format: 'avif', step: 'reject-avif-output' },
  ] as const;
  for (const { format, step } of unsupportedOutputCases) {
    await runIOSSmokeStep(step, () =>
      expectNativeErrorCode(
        () =>
          compressImage({
            source: { uri: jpegUri },
            output: { format, quality: 70 },
            metadata: 'safe',
          }),
        'ERR_NOT_IMPLEMENTED',
        `Expected ${format} output to be unimplemented on iOS.`
      )
    );
  }

  await runIOSSmokeStep('reject-gif-output', () =>
    expectNativeErrorCode(
      () =>
        compressImage({
          source: { uri: jpegUri },
          output: { format: 'gif' as OutputFormat, quality: 70 },
          metadata: 'safe',
        }),
      'ERR_INVALID_OPTIONS',
      'Expected GIF output to be rejected before native compression.'
    )
  );

  await runIOSSmokeStep('reject-png-metadata-preserve', () =>
    expectNativeErrorCode(
      () =>
        compressImage({
          source: { uri: jpegUri },
          output: { format: 'png', quality: 70 },
          metadata: 'preserve',
        }),
      'ERR_NOT_IMPLEMENTED',
      "Expected metadata: 'preserve' to require JPEG input and JPEG output on iOS."
    )
  );

  return {
    platform: 'ios',
    jpegResultBytes: jpegResult.byteSize,
    jpegPreserveResultBytes: jpegPreserveResult.byteSize,
    pngResultBytes: pngResult.byteSize,
    gifResultBytes: gifResult.byteSize,
    webpResultBytes: webpResult.byteSize,
    heicResultBytes: heicResult.byteSize,
    heifResultBytes: heifResult.byteSize,
    ...(avifResult ? { avifResultBytes: avifResult.byteSize } : {}),
    jpegToPngResultBytes: jpegToPngResult.byteSize,
    pngToPngResultBytes: pngToPngResult.byteSize,
    gifToPngResultBytes: gifToPngResult.byteSize,
    webpToPngResultBytes: webpToPngResult.byteSize,
    heicToPngResultBytes: heicToPngResult.byteSize,
    heifToPngResultBytes: heifToPngResult.byteSize,
    ...(avifToPngResult
      ? { avifToPngResultBytes: avifToPngResult.byteSize }
      : {}),
    webpOutputAvailable,
    avifInputAvailable,
    ...(jpegToWebPResult
      ? { jpegToWebPResultBytes: jpegToWebPResult.byteSize }
      : {}),
    ...(pngToWebPResult
      ? { pngToWebPResultBytes: pngToWebPResult.byteSize }
      : {}),
    ...(gifToWebPResult
      ? { gifToWebPResultBytes: gifToWebPResult.byteSize }
      : {}),
    ...(webpToWebPResult
      ? { webpToWebPResultBytes: webpToWebPResult.byteSize }
      : {}),
    ...(heicToWebPResult
      ? { heicToWebPResultBytes: heicToWebPResult.byteSize }
      : {}),
    ...(heifToWebPResult
      ? { heifToWebPResultBytes: heifToWebPResult.byteSize }
      : {}),
    ...(avifToWebPResult
      ? { avifToWebPResultBytes: avifToWebPResult.byteSize }
      : {}),
    ...(webpTargetSizeResult
      ? { webpTargetSizeResultBytes: webpTargetSizeResult.byteSize }
      : {}),
    targetSizeResultBytes: targetSizeResult.byteSize,
    unsupportedInputs,
    unsupportedOutputs: unsupportedOutputCases.map(({ format }) => format),
  };
}

function assertIOSSmokeSampleModule(
  module: ExampleImageSourceModule | undefined
): asserts module is IOSSmokeSampleModule {
  if (
    !module?.copySampleJpegToCache ||
    !module.copySamplePngToCache ||
    !module.copySampleHeicToCache ||
    !module.copySampleHeifToCache ||
    !module.copySampleAvifToCache ||
    !module.copyUnsupportedImageToCache ||
    !module.readJpegSoftwareMetadata ||
    !module.readJpegMetadataSummary
  ) {
    throw new Error('iOS smoke sample module methods are unavailable.');
  }
}

async function runIOSSmokeStep<T>(
  name: string,
  action: () => Promise<T>
): Promise<T> {
  await emitIOSSmokeLog(`RNICK_IOS_SMOKE_STEP_START ${name}`);

  try {
    const result = await withIOSSmokeTimeout(name, action());
    await emitIOSSmokeLog(`RNICK_IOS_SMOKE_STEP_PASS ${name}`);
    return result;
  } catch (error) {
    const errorState = toErrorState(error);
    await emitIOSSmokeLog(
      `RNICK_IOS_SMOKE_STEP_FAIL ${name} ${errorState.code} ${errorState.message}`
    );
    throw error;
  }
}

function withIOSSmokeTimeout<T>(name: string, promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject({
        code: 'ERR_IOS_SMOKE_TIMEOUT',
        message: `Timed out while waiting for iOS smoke step: ${name}.`,
      });
    }, IOS_SMOKE_STEP_TIMEOUT_MS);

    promise.then(
      (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function assertIOSFormatCapability(
  capabilities: ImageCompressionCapabilities,
  format: ImageFormat,
  expectedInput?: boolean,
  expectedOutput?: boolean
): ImageCompressionCapabilities['formats'][number] {
  const capability = capabilities.formats.find(
    (candidate) => candidate.format === format
  );

  assertIOSSmoke(!!capability, `Missing ${format} capability.`);
  if (expectedInput !== undefined) {
    assertIOSSmoke(
      capability.input === expectedInput,
      `Expected ${format} input=${expectedInput}, received ${capability.input}.`
    );
  }
  if (expectedOutput !== undefined) {
    assertIOSSmoke(
      capability.output === expectedOutput,
      `Expected ${format} output=${expectedOutput}, received ${capability.output}.`
    );
  }

  return capability;
}

function assertCompressionResult(
  result: CompressionResult,
  format: OutputFormat
): void {
  assertIOSSmoke(result.format === format, `Expected result format ${format}.`);
  assertIOSSmoke(result.uri.startsWith('file://'), 'Expected file:// result URI.');
  assertIOSSmoke(result.width > 0, 'Expected positive result width.');
  assertIOSSmoke(result.height > 0, 'Expected positive result height.');
  assertIOSSmoke(result.byteSize > 0, 'Expected positive result byteSize.');
  assertIOSSmoke(
    result.originalByteSize > 0,
    'Expected positive result originalByteSize.'
  );
}

async function expectNativeErrorCode(
  action: () => Promise<unknown>,
  expectedCode: string,
  message: string
): Promise<void> {
  try {
    await action();
  } catch (error) {
    const errorState = toErrorState(error);
    assertIOSSmoke(
      errorState.code === expectedCode,
      `${message} Received ${errorState.code}: ${errorState.message}`
    );
    return;
  }

  throw new Error(message);
}

function assertIOSSmoke(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
