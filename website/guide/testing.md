# Testing and mocking

Wrap the small public API behind an application service when tests need stable
fixtures. Mock the package at the module boundary rather than importing its
internal native module.

```ts
import { vi } from 'vitest';

vi.mock('react-native-image-compression-kit', () => ({
  getImageCompressionCapabilities: vi.fn().mockResolvedValue({
    platform: 'android',
    formats: [
      {
        format: 'jpeg',
        input: true,
        output: true,
        supportsAlpha: false,
        supportsAnimation: false,
      },
    ],
    metadataPolicies: ['preserve', 'safe', 'strip'],
    supportsTargetSizeCompression: true,
    supportsCancellation: true,
    maxConcurrentOperations: 2,
    supportsDecodeDownsampling: true,
    resourceLimits: {
      maxSourceDimension: 32_768,
      maxSourcePixels: 100_000_000,
      maxWorkingPixels: 25_000_000,
    },
  }),
  compressImage: vi.fn().mockResolvedValue({
    uri: 'file:///tmp/result.jpg',
    format: 'jpeg',
    width: 1200,
    height: 800,
    byteSize: 240000,
    originalByteSize: 1200000,
    compressionRatio: 0.2,
  }),
}));
```

Keep at least one real native integration lane for URI access, codec
capabilities, metadata, and output-file behavior. JavaScript mocks cannot prove
those contracts.
