import {
  compressImage,
  getImageCompressionCapabilities,
  type CompressionOptions,
  type CompressionResult,
  type ImageCompressionCapabilities,
} from 'react-native-image-compression-kit';
import type { ExampleImageSourceModule } from './exampleNative';

export const DEMO_CAPTURE_OPTIONS: CompressionOptions = {
  source: { uri: '' },
  resize: { maxWidth: 160, maxHeight: 160, mode: 'contain' },
  output: { format: 'jpeg', quality: 76, maxBytes: 8_000 },
  metadata: 'safe',
};

export type DemoCapture = {
  sourceUri: string;
  capabilities: ImageCompressionCapabilities;
  result: CompressionResult;
  log: string;
};

export type PreparedDemoCapture = {
  sourceUri: string;
  capabilities: ImageCompressionCapabilities;
  options: CompressionOptions;
};

export async function prepareNativeDemoCapture(
  sampleModule: ExampleImageSourceModule
): Promise<PreparedDemoCapture> {
  const [sourceUri, capabilities] = await Promise.all([
    sampleModule.copySampleJpegToCache(),
    getImageCompressionCapabilities(),
  ]);
  const jpegOutput = capabilities.formats.some(
    ({ format, output }) => format === 'jpeg' && output
  );
  if (!jpegOutput) {
    throw new Error('The native runtime did not report JPEG output support.');
  }

  return {
    sourceUri,
    capabilities,
    options: {
      ...DEMO_CAPTURE_OPTIONS,
      source: { uri: sourceUri },
    },
  };
}

export async function completeNativeDemoCapture(
  prepared: PreparedDemoCapture,
  platform: 'android' | 'ios'
): Promise<DemoCapture> {
  const { sourceUri, capabilities, options } = prepared;
  const result = await compressImage(options);
  const payload = {
    schemaVersion: 1,
    platform,
    sourceUri,
    options: {
      resize: options.resize,
      output: options.output,
      metadata: options.metadata,
    },
    result,
  };

  return {
    sourceUri,
    capabilities,
    result,
    log: `RNICK_DEMO_PASS ${JSON.stringify(payload)}`,
  };
}

export async function runNativeDemoCapture(
  sampleModule: ExampleImageSourceModule,
  platform: 'android' | 'ios'
): Promise<DemoCapture> {
  const prepared = await prepareNativeDemoCapture(sampleModule);
  return completeNativeDemoCapture(prepared, platform);
}
