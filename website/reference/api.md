# Public API

## `compressImage(options)`

Returns `Promise<CompressionResult>` and rejects with
`ImageCompressionKitError`.

```ts
interface CompressionOptions {
  source: { uri: string };
  resize?: {
    maxWidth?: number;
    maxHeight?: number;
    mode?: 'contain' | 'cover' | 'stretch';
  };
  output: {
    format: 'jpeg' | 'png' | 'webp' | 'heic' | 'heif' | 'avif';
    quality?: number;
    maxBytes?: number;
  };
  metadata?: 'preserve' | 'safe' | 'strip';
}
```

`source.uri` must be non-empty and local. `quality` is an integer from 0 to
100 and defaults to 80 in the native request. `maxBytes` is a positive integer.
Resize dimensions are positive integers; `mode` defaults to `contain`.
Metadata defaults to `safe`.

```ts
interface CompressionResult {
  uri: string;
  format: 'jpeg' | 'png' | 'webp' | 'heic' | 'heif' | 'avif';
  width: number;
  height: number;
  byteSize: number;
  originalByteSize: number;
  compressionRatio: number;
}
```

`compressionRatio` is output bytes divided by source bytes.

## `getImageCompressionCapabilities()`

Returns `Promise<ImageCompressionCapabilities>` with the current platform,
format-specific input/output flags, alpha/animation flags, metadata policies,
target-size support, cancellation support, and explanatory notes.

## Errors

- `ImageCompressionKitError` is the runtime error class.
- `ImageCompressionKitErrorCode` is the public TypeScript union for stable
  error codes.

## Constants and types

- `IMAGE_FORMATS`
- `OUTPUT_FORMATS`
- `METADATA_POLICIES`
- `RESIZE_MODES`
- Public option, result, capability, format, resize, and metadata types

See [errors and troubleshooting](../guide/errors.md) and
[capabilities](../guide/capabilities.md) before building an application
fallback.
