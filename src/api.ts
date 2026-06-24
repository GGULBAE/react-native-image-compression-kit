import { normalizeNativeError } from './errors';
import { getNativeModule } from './nativeModule';
import type {
  CompressionOptions,
  CompressionResult,
  ImageCompressionCapabilities,
} from './types';
import { normalizeCompressionOptions } from './validation';

export async function compressImage(
  options: CompressionOptions
): Promise<CompressionResult> {
  const normalizedOptions = normalizeCompressionOptions(options);

  try {
    return await getNativeModule().compressImage(normalizedOptions);
  } catch (error) {
    throw normalizeNativeError(error);
  }
}

export async function getImageCompressionCapabilities(): Promise<ImageCompressionCapabilities> {
  try {
    return await getNativeModule().getImageCompressionCapabilities();
  } catch (error) {
    throw normalizeNativeError(error);
  }
}
