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

type DemoCapture = {
  sourceUri: string;
  capabilities: ImageCompressionCapabilities;
  result: CompressionResult;
  log: string;
};

export async function runNativeDemoCapture(
  sampleModule: ExampleImageSourceModule,
  platform: 'android' | 'ios'
): Promise<DemoCapture> {
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

  const options: CompressionOptions = {
    ...DEMO_CAPTURE_OPTIONS,
    source: { uri: sourceUri },
  };
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
