import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type NativeImageFormat =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'heic'
  | 'heif'
  | 'avif'
  | 'gif';

export type NativeOutputFormat =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'heic'
  | 'heif'
  | 'avif';

export type NativeMetadataPolicy = 'preserve' | 'safe' | 'strip';
export type NativeResizeMode = 'contain' | 'cover' | 'stretch';

export type NativeCompressionSource = {
  uri: string;
};

export type NativeResizeOptions = {
  maxWidth?: number;
  maxHeight?: number;
  mode: NativeResizeMode;
};

export type NativeOutputOptions = {
  format: NativeOutputFormat;
  quality?: number;
  maxBytes?: number;
};

export type NativeCompressionOptions = {
  operationId: string;
  source: NativeCompressionSource;
  resize?: NativeResizeOptions;
  output: NativeOutputOptions;
  metadata: NativeMetadataPolicy;
};

export type NativeCompressionResult = {
  uri: string;
  format: NativeOutputFormat;
  width: number;
  height: number;
  byteSize: number;
  originalByteSize: number;
  compressionRatio: number;
};

export type NativeFormatCapability = {
  format: NativeImageFormat;
  input: boolean;
  output: boolean;
  supportsAlpha: boolean;
  supportsAnimation: boolean;
  notes?: Array<string>;
};

export type NativeImageCompressionCapabilities = {
  platform: 'android' | 'ios' | 'unknown';
  formats: Array<NativeFormatCapability>;
  metadataPolicies: Array<NativeMetadataPolicy>;
  supportsTargetSizeCompression: boolean;
  supportsCancellation: boolean;
  maxConcurrentOperations: number;
  supportsDecodeDownsampling: boolean;
  resourceLimits: {
    maxSourceDimension: number;
    maxSourcePixels: number;
    maxWorkingPixels: number;
  };
};

export interface Spec extends TurboModule {
  compressImage(
    options: NativeCompressionOptions
  ): Promise<NativeCompressionResult>;
  cancelCompression(operationId: string): void;
  getImageCompressionCapabilities(): Promise<NativeImageCompressionCapabilities>;
}

export default TurboModuleRegistry.get<Spec>('ImageCompressionKit');
