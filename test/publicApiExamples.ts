import {
  compressImage,
  getImageCompressionCapabilities,
  ImageCompressionKitError,
  type CompressionOptions,
  type CompressionResult,
  type ImageCompressionKitErrorCode,
} from '../src';

declare const imageUri: string;

export async function publicQuickStart(): Promise<CompressionResult> {
  const capabilities = await getImageCompressionCapabilities();
  const canWriteWebP = capabilities.formats.some(
    (item) => item.format === 'webp' && item.output
  );

  return compressImage({
    source: { uri: imageUri },
    resize: { maxWidth: 2048, maxHeight: 2048, mode: 'contain' },
    output: { format: canWriteWebP ? 'webp' : 'jpeg', quality: 80 },
    metadata: 'safe',
  });
}

export async function publicTargetSizeRecipe(): Promise<CompressionResult> {
  const options: CompressionOptions = {
    source: { uri: imageUri },
    output: { format: 'webp', quality: 90, maxBytes: 500_000 },
    metadata: 'strip',
  };

  try {
    return await compressImage(options);
  } catch (error) {
    if (error instanceof ImageCompressionKitError) {
      const code: ImageCompressionKitErrorCode = error.code;
      throw new Error(`${code}: ${error.message}`);
    }
    throw error;
  }
}
