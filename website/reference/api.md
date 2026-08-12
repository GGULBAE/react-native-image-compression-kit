# Public API

This API is intentionally small because it controls one system boundary: the
bytes, native work, metadata, cancellation state, and file ownership of an
image before the host application uploads or retains it.

## 🧭 Problem → API contract

| Product problem | API boundary | Result the host can observe |
| --- | --- | --- |
| 📤 Upload exceeds policy | `compressImage()` with `output.maxBytes` for JPEG or available WebP | Source/output bytes, ratio, dimensions, format, and owned URI |
| 📱 Devices differ | `getImageCompressionCapabilities()` | Runtime support, policies, concurrency, downsampling, and limits |
| ⏹️ Work becomes obsolete | `AbortSignal` passed to `compressImage()` | Stable `ERR_CANCELLED` without a published partial output |
| ♻️ Output is no longer needed | `removeCompressionOutput(uri)` | Narrow, idempotent removal of the package-owned cache result |

The economic model has two separate quantities:

```text
prevented upload bytes = source bytes − accepted output bytes
app-owned image footprint = upload queue + outputs + caches + residual files
```

Only count an output after the host application's size, dimensions, format, and
quality policy accepts it. The package does not shrink or delete gallery
sources, and a source plus its new output can temporarily increase device
storage. See [why device-side bytes matter](../guide/byte-economics.md) for
worked arithmetic, lifecycle boundaries, and a measurement plan.

## `compressImage(options, control?)`

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

`control` may be an `AbortSignal` directly or `{ signal }`. Cancellation before
native dispatch, while queued, or between native stages rejects with
`ERR_CANCELLED`. Completion removes the abort listener, so later aborts are a
no-op.

```ts
const controller = new AbortController();
const pending = compressImage(options, controller.signal);
controller.abort();
await pending;
```

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

When `maxBytes` is present, the native pipeline searches generated candidates
under the requested target. If it cannot reach the target, it returns the
smallest generated candidate rather than claiming success. The host application
decides whether that result is acceptable before upload.

## `getImageCompressionCapabilities()`

Returns `Promise<ImageCompressionCapabilities>` with the current platform,
format-specific input/output flags, alpha/animation flags, metadata policies,
target-size support, cancellation support, `maxConcurrentOperations`,
`supportsDecodeDownsampling`, named `resourceLimits`, and explanatory notes.

## `removeCompressionOutput(uri)`

Returns `Promise<void>` and removes only a completed package-owned cache output
returned by `compressImage`.

- Only generated `file://` outputs directly inside the package cache directory
  are accepted.
- An already-missing valid output is a successful no-op.
- Foreign files, source files, path traversal, symlinks, and directories reject
  with `ERR_INVALID_OPTIONS`.
- A filesystem deletion failure rejects with `ERR_FILE_ACCESS`.

The method never removes directories recursively and does not maintain a global
output registry. Use it after upload, copy, or abandonment to keep successful
temporary outputs from becoming long-lived app-owned storage. The host remains
responsible for copied or moved results and all other application files.

## Errors

- `ImageCompressionKitError` is the runtime error class.
- `ImageCompressionKitErrorCode` is the public TypeScript union for stable
  error codes.

## Constants and types

- `IMAGE_FORMATS`
- `OUTPUT_FORMATS`
- `METADATA_POLICIES`
- `RESIZE_MODES`
- Public option, cancellation-control, result, capability, resource-limit,
  format, resize, and metadata types

See [errors and troubleshooting](../guide/errors.md) and
[capabilities](../guide/capabilities.md) before building an application
fallback.
