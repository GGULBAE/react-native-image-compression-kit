<h1 align="center">React Native Image Compression Kit</h1>

<p align="center">
  Native-first image compression, resize, and format conversion for React Native.
</p>

<p align="center">
  <img alt="Platforms: Android and iOS" src="https://img.shields.io/badge/Platforms-Android%20%7C%20iOS-green" />
  <img alt="TypeScript: API available" src="https://img.shields.io/badge/TypeScript-API%20available-3178c6" />
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow" />
</p>

Compress supported local images to JPEG, PNG, or WebP, with optional resize,
quality, target-size, and metadata controls. Use the runtime capability API to
handle platform codec differences before compression.

<!-- package-status:start -->
## Current status

- Package version: `0.2.62`
- npm latest: `0.2.55`
- Release state: `candidate`
- Registry checked at: `2026-07-16`
<!-- package-status:end -->

The current candidate keeps the public API and image output behavior unchanged
while isolating iOS request, input, decode, resize/render, JPEG metadata, and
output encoder/persistence ownership plus pipeline orchestration behind
executable native contracts.

## Installation

```bash
npm install react-native-image-compression-kit
```

Or with pnpm:

```bash
pnpm add react-native-image-compression-kit
```

For iOS, install pods after adding the package:

```bash
cd ios && pod install
```

React Native `>=0.73 <1.0` is supported. The package is New
Architecture/Codegen ready.

## Quick start

```ts
import {
  compressImage,
  getImageCompressionCapabilities,
} from 'react-native-image-compression-kit';

const capabilities = await getImageCompressionCapabilities();
const canWriteWebP = capabilities.formats.some(
  ({ format, output }) => format === 'webp' && output
);

const result = await compressImage({
  source: { uri: imageUri },
  resize: {
    maxWidth: 2048,
    maxHeight: 2048,
    mode: 'contain',
  },
  output: {
    format: canWriteWebP ? 'webp' : 'jpeg',
    quality: 80,
  },
  metadata: 'safe',
});

console.log(result.uri, result.byteSize, result.width, result.height);
```

Input must be a local URI accessible to the native app. Android supports
`file://` and `content://`; iOS supports `file://` and best-effort local
`content://` loading.

## Public API

### `compressImage(options)`

Returns `Promise<CompressionResult>`.

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

### `getImageCompressionCapabilities()`

Returns the current platform's input/output format availability, metadata
policies, target-size support, and cancellation support. Check it at runtime;
codec support is not identical across Android versions, devices, and iOS
runtimes.

### Other exports

- `ImageCompressionKitError`
- `IMAGE_FORMATS`, `OUTPUT_FORMATS`, `METADATA_POLICIES`, `RESIZE_MODES`
- Public TypeScript types for options, results, formats, resize, metadata, and
  capabilities

## Compression examples

### Quality and resize

```ts
const result = await compressImage({
  source: { uri: imageUri },
  resize: { maxWidth: 1600, maxHeight: 1600, mode: 'contain' },
  output: { format: 'jpeg', quality: 82 },
  metadata: 'safe',
});
```

### Target size

```ts
const result = await compressImage({
  source: { uri: imageUri },
  output: { format: 'webp', quality: 90, maxBytes: 500_000 },
  metadata: 'strip',
});
```

`quality` is the upper bound when used with `maxBytes`. The native pipeline
searches for the highest supported quality under the target. It returns the
smallest generated result if the target cannot be reached. PNG does not support
`maxBytes`.

### Format conversion

```ts
const result = await compressImage({
  source: { uri: heicUri },
  output: { format: 'jpeg', quality: 85 },
  metadata: 'safe',
});
```

### Error handling

```ts
import {
  compressImage,
  ImageCompressionKitError,
} from 'react-native-image-compression-kit';

try {
  await compressImage(options);
} catch (error) {
  if (error instanceof ImageCompressionKitError) {
    console.warn(error.code, error.message);
  }
}
```

## Platform capabilities and limitations

| Capability | Android | iOS |
| --- | --- | --- |
| JPEG/PNG/WebP input | Yes | Yes; WebP is static ImageIO decode |
| GIF input | Static first frame | Static ImageIO decode |
| HEIC/HEIF input | SDK/device codec gated | Static ImageIO decode |
| AVIF input | Android 14+ (`ImageDecoder`) | Runtime ImageIO source gated |
| JPEG output | Yes | Yes |
| PNG output | Yes | Yes |
| WebP output | Yes | Runtime ImageIO destination gated |
| HEIC/HEIF/AVIF output | Not implemented | Not implemented |
| `maxBytes` | JPEG and WebP | JPEG and runtime-available WebP |
| Resize modes | `contain`, `cover`, `stretch` | `contain`, `cover`, `stretch` |
| Cancellation | Not implemented | Not implemented |

Important limitations:

- HEIC, HEIF, and AVIF output reject with `ERR_NOT_IMPLEMENTED`.
- GIF output and animation preservation for GIF/WebP/AVIF are not implemented.
- `metadata: 'preserve'` is supported only for JPEG source to JPEG output.
- Android `safe` copies a privacy-filtered JPEG EXIF allowlist. iOS `safe` and
  `strip` re-encode without copying source metadata.
- JPEG orientation is rendered into pixels before resize/encode; preserved
  output orientation and dimensions are normalized.
- Capability checks should drive fallbacks for SDK-, device-, and
  runtime-dependent codecs.

## Development verification

```bash
pnpm verify
pnpm example:typecheck
pnpm example:ios:decoder-test
pnpm example:ios:encoder-test
pnpm example:ios:output-test
pnpm example:ios:pipeline-test
pnpm example:ios:metadata-test
pnpm example:ios:transformer-test
pnpm docs:check
git diff --check
pnpm pack --dry-run
```

`pnpm verify` runs TypeScript checks, Vitest, the build, offline fixture and
release-evidence replay gates, workflow pin checks, and the Android repository
doctor. `pnpm docs:check` is network-free and validates the repository status
manifest, aligned README/RELEASE blocks, required documentation structure,
local links/anchors, and npm package exclusions.

For release-oriented changes, also run:

```bash
pnpm smoke:consumer
pnpm release:dry-run
```

The release dry run never publishes. Its shared state matrix blocks a
`candidate` and permits `release` only after the manifest and document mirrors
are aligned.

## Repository documentation

Operational material is repository-only and is not included in the npm
tarball:

- [Release evidence operations](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/README.md)
- [Registry provenance](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/registry-provenance.md)
- [Policy review](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/policy-review.md)
- [Review archive](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/review-archive.md)
- [Evidence acquisition](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/acquisition.md)
- [GitHub Action pins](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/supply-chain/action-pins.md)
- [Release status manifest](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-status.json)
- [Repository verification architecture](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/verification-architecture.md)
- [Current and recent release work](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/RELEASE.md)
- [Complete 0.2 release history](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/releases/0.2-history.md)

## Security

See [SECURITY.md](SECURITY.md) for supported versions, vulnerability reporting,
package prohibitions, and links to repository-only execution procedures.

## License

MIT License. See [LICENSE](./LICENSE).
