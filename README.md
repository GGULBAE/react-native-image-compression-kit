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

- Package version: `0.4.0`
- npm latest: `0.3.0`
- Release state: `candidate`
- Registry checked at: `2026-07-20`
<!-- package-status:end -->

Version 0.4.0 is an unpublished candidate. It moves large image work to bounded
background workers, downsamples resize requests during decode, rejects unsafe
work before full decode, supports cancellation, and publishes only complete
transactional cache files. npm `latest` remains 0.3.0; publishing, tags, and a
GitHub Release are outside this candidate goal.

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

Android 23+ and iOS 13.4+ are supported. The package declares React Native
`>=0.73 <1.0`. The v0.3.0 release matrix verifies React Native 0.73.11 Legacy,
React Native 0.86.0 Legacy and New Architecture, and Expo 57.0.7 with React
Native 0.86.0 New Architecture on both platforms. Versions between the tested
endpoints are accepted by the peer range but are not individually release
tested. Expo requires a development build or prebuild; Expo Go and Snack
cannot load this custom native module. See the
[exact compatibility evidence](https://ggulbae.github.io/react-native-image-compression-kit/reference/compatibility).

See the [installation guide](https://ggulbae.github.io/react-native-image-compression-kit/guide/installation)
for Bare React Native, Expo development-build, rebuild, and URI integration
steps.

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

### `compressImage(options, control?)`

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

interface CompressionControl {
  signal: CompressionAbortSignal;
}
```

The optional second argument accepts either an `AbortSignal` directly or a
`CompressionControl` object. Aborts before dispatch, while queued, or while
running reject with `ERR_CANCELLED`; aborting after completion is a no-op.

```ts
const controller = new AbortController();
const compression = compressImage(options, { signal: controller.signal });
controller.abort();
await compression;
```

### `getImageCompressionCapabilities()`

Returns the current platform's input/output format availability, metadata
policies, target-size and cancellation support, bounded concurrency,
decode-downsampling support, and named source/working pixel limits. Check it at
runtime; codec support is not identical across Android versions, devices, and
iOS runtimes.

### Other exports

- `ImageCompressionKitError`
- `ImageCompressionKitErrorCode`
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
| Decode downsampling | `BitmapFactory.inSampleSize` / `ImageDecoder` target | ImageIO thumbnail |
| Concurrent operations | Maximum 2 | Maximum 2 |
| Cancellation | Yes | Yes |

Important limitations:

- HEIC, HEIF, and AVIF output reject with `ERR_NOT_IMPLEMENTED`.
- GIF output and animation preservation for GIF/WebP/AVIF are not implemented.
- `metadata: 'preserve'` is supported only for JPEG source to JPEG output.
- Android `safe` copies a privacy-filtered JPEG EXIF allowlist. iOS `safe` and
  `strip` re-encode without copying source metadata.
- JPEG orientation is rendered into pixels before resize/encode; preserved
  output orientation and dimensions are normalized.
- Sources above 32,768 pixels on either axis or 100,000,000 total pixels reject
  with `ERR_RESOURCE_LIMIT`. Work requiring more than 25,000,000 decoded pixels
  must provide smaller resize bounds.
- JPEG output flattens transparency onto white on both platforms. PNG and WebP
  alpha capability reflects decode-back validation.
- Failed and cancelled operations remove temporary/partial cache files; a
  successful returned cache file retains the existing application ownership
  contract.
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
pnpm example:ios:large-image-test
pnpm example:ios:metadata-test
pnpm example:ios:transformer-test
pnpm docs:check
pnpm site:check
pnpm site:build
pnpm fixtures:compatibility:check
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

- [User guides and native-result demo](https://ggulbae.github.io/react-native-image-compression-kit/)

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

See [SECURITY.md](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/SECURITY.md)
for supported versions, private vulnerability reporting, package prohibitions,
and repository-only execution procedures.

## Contributing and support

- [Contribution guide](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/CONTRIBUTING.md)
- [Support policy](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/SUPPORT.md)
- [Code of Conduct](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/CODE_OF_CONDUCT.md)
- [Changelog](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/CHANGELOG.md)
- [GitHub Discussions](https://github.com/GGULBAE/react-native-image-compression-kit/discussions)

## License

MIT License. See [LICENSE](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/LICENSE).
