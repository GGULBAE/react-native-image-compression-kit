<h1 align="center">React Native Image Compression Kit</h1>

<p align="center">
  Compress any supported image. Return it in the format you choose.
</p>

<p align="center">
  A planned native image compression and transcoding pipeline for React Native Android and iOS.
</p>

<p align="center">
  <img alt="Status: Android JPEG MVP" src="https://img.shields.io/badge/Status-Android%20JPEG%20MVP-blue" />
  <img alt="Platforms: Android | iOS" src="https://img.shields.io/badge/Platforms-Android%20%7C%20iOS-green" />
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-planned-61dafb" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-planned-3178c6" />
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow" />
</p>

React Native Image Compression Kit is a native image compression and transcoding pipeline that loads any supported image format, compresses it, and returns it in a supported format selected by the developer.

## Overview

React Native image compression workflows are often split across format-specific or feature-specific modules. Compression, resizing, HEIC conversion, WebP handling, metadata policy, and platform capability checks can become separate decisions instead of one predictable pipeline.

This project is designed to make compression the center of the API. It will combine detect, decode, auto-orient, resize, transcode, and encode steps behind one consistent React Native interface.

Format conversion is treated as part of the compression result. Developers choose the supported output format they want, and the native pipeline handles the work needed to produce it.

## Status

This project is currently in the design and early Android MVP phase. The TypeScript API contract, React Native Codegen spec, Android native module, Android example app, iOS stub, and unit test foundation are in place, and the package is not available on npm yet.

Android includes a narrow JPEG quality compression MVP for `file://` JPEG inputs and JPEG output. iOS compression and non-JPEG codecs are not implemented yet.

## Current Implementation Scope

The current implementation is intentionally small:

- Android only.
- `file://` local URI input only.
- JPEG input only.
- JPEG output only.
- Quality-based compression only.
- Output file written to the Android app cache directory.
- `CompressionResult` returns `uri`, `format`, `width`, `height`, `byteSize`, `originalByteSize`, and `compressionRatio`.

The following remain planned and are not implemented in the MVP:

- iOS compression.
- `content://` URI support.
- PNG, WebP, HEIC / HEIF, AVIF, and GIF processing.
- Resize.
- EXIF orientation correction.
- Metadata preservation, safe stripping, or full stripping.
- Target-size compression with `maxBytes`.

## Why

Image handling in React Native can become fragmented when compression, HEIC conversion, WebP processing, resizing, and metadata handling live in separate tools. That fragmentation can lead to:

- Different APIs for different formats.
- Platform-specific behavior that is difficult to predict.
- Limited support for target file size compression.
- Image processing logic coupled too tightly to upload logic.
- Extra application code for capability checks and fallback paths.

React Native Image Compression Kit aims to provide one native-first API for image compression while staying composable with any uploader or storage layer.

## Core Concept

```text
Supported input image
        ↓
Detect and decode
        ↓
Auto-orient
        ↓
Resize when needed
        ↓
Compress
        ↓
Encode in selected format
        ↓
Local output URI
```

Any supported image in. A compressed image out, in your chosen supported format.

## Planned Features

The following product features are planned. They are not fully implemented yet.

- Automatic format detection.
- Quality-based compression.
- Target file size compression with `maxBytes`.
- Optional resize during compression.
- Output format selection.
- Automatic EXIF orientation correction.
- Metadata preservation and stripping policies.
- Alpha-channel handling.
- Local URI input and output.
- Compression statistics.
- Cancellation.
- Runtime capability inspection.
- Android and iOS support.
- React Native New Architecture-first design.

## Planned Format Support

The table below describes planned input and output support. Actual availability may depend on platform codecs and will be reported through runtime capability APIs.

| Format | Planned input | Planned output | Notes |
|---|---:|---:|---|
| JPEG | Yes | Yes | Lossy compression |
| PNG | Yes | Yes | Lossless compression |
| WebP | Yes | Yes | Lossy and lossless |
| HEIC / HEIF | Yes | Optional / later | Platform and codec dependent |
| AVIF | Yes | Yes | Planned codec integration |
| GIF | Yes | Later | Static first-frame support before animation preservation |

Animation preservation for GIF, animated WebP, and animated AVIF is not planned as an initial-version guarantee.

## Proposed API

The API below is proposed and is not available in a published package yet.

```ts
import { compressImage } from 'react-native-image-compression-kit';

const result = await compressImage({
  source: {
    uri: imageUri,
  },

  resize: {
    maxWidth: 2048,
    maxHeight: 2048,
    mode: 'contain',
  },

  output: {
    format: 'webp',
    quality: 80,
    maxBytes: 500_000,
  },

  metadata: 'safe',
});
```

Example proposed result:

```ts
{
  uri: 'file:///...',
  format: 'webp',
  width: 2048,
  height: 1365,
  byteSize: 482_319,
  originalByteSize: 3_814_220,
  compressionRatio: 0.126,
}
```

## Compression Modes

### 1. Quality-based compression

```ts
output: {
  format: 'jpeg',
  quality: 80,
}
```

### 2. Target-size compression

```ts
output: {
  format: 'webp',
  maxBytes: 500_000,
}
```

`maxBytes` is planned as a target upper bound that the encoder will try to satisfy within practical limits. It is not intended to guarantee an exact byte size for every source image, format, platform, or codec.

### 3. Compression with format conversion

```ts
output: {
  format: 'avif',
  quality: 65,
}
```

## Metadata Policy

The proposed API includes three metadata policies:

```ts
metadata: 'preserve'
metadata: 'safe'
metadata: 'strip'
```

`preserve` is planned to keep source metadata when the selected output format and platform support it.

`safe` is planned as the default privacy-aware policy. It should keep orientation and color-related information while removing location data and unnecessary personal metadata.

`strip` is planned to remove metadata from the encoded output where possible.

## Design Principles

- Compression first.
- One decode and encode pipeline.
- Native processing.
- Predictable output.
- Explicit capability reporting.
- No silent animation loss.
- No silent alpha-channel loss.
- Safe defaults.
- Composable with any uploader.

The target architecture avoids moving full pixel data through JavaScript. Native code should do decode, transform, compress, and encode work, then return a local output URI and result metadata to JavaScript.

## Non-goals

This project is not intended to handle:

- Uploading images.
- Remote image downloading.
- Rendering or caching images.
- Replacing an image picker.
- Supporting every existing image format or camera RAW format.
- Providing a full image editor.
- Guaranteeing identical encoded bytes across Android and iOS.
- CDN optimization, lazy loading, gallery UI, or photo management workflows.

## Roadmap

- [x] Repository and API design.
- [x] Initial TypeScript public API contract.
- [x] Unit test foundation for API and validation.
- [x] React Native Codegen and native module foundation.
- [x] Android JPEG to JPEG quality compression MVP.
- [x] Example application.
- [ ] JPEG, PNG, and WebP compression.
- [ ] HEIC / HEIF input.
- [ ] AVIF support.
- [ ] Target-size compression.
- [ ] Metadata policies.
- [ ] Cancellation and progress.
- [ ] Public npm release.

## Installation

This package has not been published to npm yet. The repository contains an initial TypeScript API scaffold and a narrow Android JPEG quality compression MVP. iOS compression and broader format support are not implemented yet.

Planned installation command:

```bash
npm install react-native-image-compression-kit
```

## Example Application

The repository includes an Android React Native example app in `example/`. It links this local package through the pnpm workspace and exercises the Android JPEG MVP against a `file://` source URI.

Install dependencies from the repository root:

```bash
pnpm install
```

Start Metro:

```bash
pnpm example:start
```

In another terminal, run the Android app:

```bash
pnpm example:android
```

The example screen copies a bundled `sample.jpg` asset into the app cache and uses that cache file URI by default. You can also paste another local `file://` JPEG URI. The screen calls:

```ts
compressImage({
  source: { uri },
  output: {
    format: 'jpeg',
    quality,
  },
});
```

It displays the compressed output URI, compressed byte size, original byte size, compression ratio, and native error code/message when the call fails.

Android Codegen and native build checks can also be run through the example app:

```bash
pnpm example:codegen
pnpm example:build
```

These commands require a Java runtime, Android SDK, and a connected emulator/device or otherwise valid Android build environment.

## Development Verification

Run the JavaScript and TypeScript checks:

```bash
pnpm verify
```

`pnpm verify` runs type checking, unit tests, the TypeScript build, and the Android verification doctor.

To run only the Android repository checks:

```bash
pnpm android:doctor
```

Android Codegen and native compilation require a React Native app build environment. React Native Codegen is run through the React Native app build, so point the verification scripts at an app's Android project:

```bash
RNICK_ANDROID_APP_DIR=/path/to/App/android pnpm android:codegen
RNICK_ANDROID_APP_DIR=/path/to/App/android pnpm android:build
```

`pnpm android:codegen` runs `generateCodegenArtifactsFromSchema` in the app Android project. `pnpm android:build` runs `assembleDebug` by default. To use a different Gradle task:

```bash
RNICK_ANDROID_APP_DIR=/path/to/App/android RNICK_ANDROID_GRADLE_TASK=:app:assembleDebug pnpm android:build
```

The executable Android checks require a Java runtime, Android SDK, and a Gradle wrapper or `gradle` command in the target app.

## Contributing

The project is in its initial design phase. Issues and discussions about the proposed API, format priorities, platform behavior, metadata policy, and native implementation strategy are welcome once the repository is ready for public collaboration.

## License

MIT License. See [LICENSE](./LICENSE).
