import { NativeModules } from 'react-native';

export type IOSJpegMetadataSummary = {
  software: string | null;
  pixelWidth: number | null;
  pixelHeight: number | null;
  orientation: number | null;
  tiffOrientation: number | null;
  exifPixelXDimension: number | null;
  exifPixelYDimension: number | null;
};

export type ExampleImageSourceModule = {
  copySampleJpegToCache: () => Promise<string>;
  copySamplePngToCache?: () => Promise<string>;
  copySampleHeicToCache?: () => Promise<string>;
  copySampleHeifToCache?: () => Promise<string>;
  copySampleAvifToCache?: () => Promise<string>;
  copyUnsupportedImageToCache?: (format: string) => Promise<string>;
  readJpegSoftwareMetadata?: (uri: string) => Promise<string | null>;
  readJpegMetadataSummary?: (uri: string) => Promise<IOSJpegMetadataSummary>;
  isSmokeTestEnabled?: () => Promise<boolean>;
  isDemoCaptureEnabled?: () => Promise<boolean>;
  logSmokeEvent?: (message: string) => Promise<void>;
};

export type IOSSmokeSampleModule = ExampleImageSourceModule & {
  copySamplePngToCache: () => Promise<string>;
  copySampleHeicToCache: () => Promise<string>;
  copySampleHeifToCache: () => Promise<string>;
  copySampleAvifToCache: () => Promise<string>;
  copyUnsupportedImageToCache: (format: string) => Promise<string>;
  readJpegSoftwareMetadata: (uri: string) => Promise<string | null>;
  readJpegMetadataSummary: (uri: string) => Promise<IOSJpegMetadataSummary>;
};

export const SAMPLE_MODULE = NativeModules.ExampleImageSource as
  | ExampleImageSourceModule
  | undefined;
