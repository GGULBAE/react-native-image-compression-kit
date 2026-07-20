export const IMAGE_FORMATS = [
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'avif',
  'gif',
] as const;

export const OUTPUT_FORMATS = [
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'avif',
] as const;

export const METADATA_POLICIES = ['preserve', 'safe', 'strip'] as const;

export const RESIZE_MODES = ['contain', 'cover', 'stretch'] as const;

export type ImageFormat = (typeof IMAGE_FORMATS)[number];
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
export type MetadataPolicy = (typeof METADATA_POLICIES)[number];
export type ResizeMode = (typeof RESIZE_MODES)[number];

export interface CompressionSource {
  uri: string;
}

export interface ResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  mode?: ResizeMode;
}

export interface OutputOptions {
  format: OutputFormat;
  quality?: number;
  maxBytes?: number;
}

export interface CompressionOptions {
  source: CompressionSource;
  resize?: ResizeOptions;
  output: OutputOptions;
  metadata?: MetadataPolicy;
}

export interface CompressionAbortSignal {
  readonly aborted: boolean;
  readonly reason?: unknown;
  addEventListener(
    type: 'abort',
    listener: () => void,
    options?: { once?: boolean }
  ): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

export interface CompressionControl {
  signal: CompressionAbortSignal;
}

export interface NormalizedResizeOptions
  extends Omit<ResizeOptions, 'mode'> {
  mode: ResizeMode;
}

export interface NormalizedCompressionOptions
  extends Omit<CompressionOptions, 'metadata' | 'resize'> {
  metadata: MetadataPolicy;
  resize?: NormalizedResizeOptions;
}

export interface CompressionResult {
  uri: string;
  format: OutputFormat;
  width: number;
  height: number;
  byteSize: number;
  originalByteSize: number;
  compressionRatio: number;
}

export interface FormatCapability {
  format: ImageFormat;
  input: boolean;
  output: boolean;
  supportsAlpha: boolean;
  supportsAnimation: boolean;
  notes?: string[];
}

export interface ImageCompressionCapabilities {
  platform: 'android' | 'ios' | 'unknown';
  formats: FormatCapability[];
  metadataPolicies: MetadataPolicy[];
  supportsTargetSizeCompression: boolean;
  supportsCancellation: boolean;
  maxConcurrentOperations: number;
  supportsDecodeDownsampling: boolean;
  resourceLimits: ImageCompressionResourceLimits;
}

export interface ImageCompressionResourceLimits {
  maxSourceDimension: number;
  maxSourcePixels: number;
  maxWorkingPixels: number;
}
