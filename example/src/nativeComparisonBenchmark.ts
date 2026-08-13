import ImageResizer from '@bam.tech/react-native-image-resizer';
import {
  Image as CompressorImage,
  getImageMetaData,
} from 'react-native-compressor';
import {
  compressImage,
  type CompressionResult,
} from 'react-native-image-compression-kit';
import type { ExampleImageSourceModule } from './exampleNative';
import {
  NATIVE_COMPARISON_OPERATION,
  runNativeComparisonBenchmarkCore,
  type NativeComparisonAdapter,
  type NativeComparisonResult,
} from './nativeComparisonBenchmarkCore';

export const NATIVE_COMPARISON_IMPLEMENTATION_VERSIONS = {
  'react-native-image-compression-kit': '0.4.1',
  'react-native-compressor': '1.19.4',
  'bam-image-resizer': '3.0.11',
} as const;

export async function runNativeComparisonBenchmark(
  sampleModule: ExampleImageSourceModule,
  platform: 'android' | 'ios'
) {
  const [sourceUri, architecture] = await Promise.all([
    sampleModule.copySampleJpegToCache(),
    sampleModule.getReactNativeArchitecture(),
  ]);
  return runNativeComparisonBenchmarkCore(
    { sourceUri, platform, architecture },
    createNativeComparisonAdapters()
  );
}

function createNativeComparisonAdapters(): NativeComparisonAdapter[] {
  return [
    {
      id: 'react-native-image-compression-kit',
      version:
        NATIVE_COMPARISON_IMPLEMENTATION_VERSIONS[
          'react-native-image-compression-kit'
        ],
      compress: (sourceUri) =>
        compressImage({
          source: { uri: sourceUri },
          resize: NATIVE_COMPARISON_OPERATION.resize,
          output: NATIVE_COMPARISON_OPERATION.output,
          metadata: 'strip',
        }),
      inspect: async (output) => normalizeKitResult(output as CompressionResult),
    },
    {
      id: 'react-native-compressor',
      version:
        NATIVE_COMPARISON_IMPLEMENTATION_VERSIONS['react-native-compressor'],
      compress: (sourceUri) =>
        CompressorImage.compress(sourceUri, {
          compressionMethod: 'manual',
          maxWidth: NATIVE_COMPARISON_OPERATION.resize.maxWidth,
          maxHeight: NATIVE_COMPARISON_OPERATION.resize.maxHeight,
          quality: NATIVE_COMPARISON_OPERATION.output.quality / 100,
          input: 'uri',
          output: 'jpg',
          returnableOutputType: 'uri',
        }),
      inspect: async (output) => {
        const uri = String(output);
        const metadata = await getImageMetaData(uri);
        return {
          uri,
          format: 'jpeg',
          width: metadata.ImageWidth,
          height: metadata.ImageHeight,
          byteSize: Math.round(metadata.size),
        };
      },
    },
    {
      id: 'bam-image-resizer',
      version: NATIVE_COMPARISON_IMPLEMENTATION_VERSIONS['bam-image-resizer'],
      compress: (sourceUri) =>
        ImageResizer.createResizedImage(
          sourceUri,
          NATIVE_COMPARISON_OPERATION.resize.maxWidth,
          NATIVE_COMPARISON_OPERATION.resize.maxHeight,
          'JPEG',
          NATIVE_COMPARISON_OPERATION.output.quality,
          0,
          null,
          false,
          { mode: 'contain', onlyScaleDown: true }
        ),
      inspect: async (output) => {
        const result = output as {
          uri: string;
          width: number;
          height: number;
          size: number;
        };
        return {
          uri: result.uri,
          format: 'jpeg',
          width: result.width,
          height: result.height,
          byteSize: result.size,
        };
      },
    },
  ];
}

function normalizeKitResult(result: CompressionResult): NativeComparisonResult {
  return {
    uri: result.uri,
    format: 'jpeg',
    width: result.width,
    height: result.height,
    byteSize: result.byteSize,
  };
}
