<h1 align="center">React Native Image Compression Kit</h1>

<p align="center">
  Compress any supported image. Return it in the format you choose.
</p>

<p align="center">
  A planned native image compression and transcoding pipeline for React Native Android and iOS.
</p>

<p align="center">
  <img alt="Status: Android JPEG Input MVP" src="https://img.shields.io/badge/Status-Android%20JPEG%20Input%20MVP-blue" />
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

Android includes a JPEG-input compression MVP for `file://` and `content://` JPEG inputs, EXIF orientation correction, optional resize, metadata `preserve` / privacy-filtered `safe` / `strip` handling for JPEG output, and JPEG, PNG, or WebP output encoding. iOS compression and non-JPEG inputs are not implemented yet.

## Current Implementation Scope

The current implementation is intentionally small:

- Android only.
- `file://` and `content://` local URI input.
- JPEG input only.
- JPEG, PNG, and WebP output.
- Quality-based compression for JPEG and WebP output. PNG output ignores `quality`.
- Target-size compression with `maxBytes` for JPEG and WebP output. PNG output rejects `maxBytes`.
- EXIF orientation correction before resize and selected output encoding.
- Optional resize with `maxWidth`, `maxHeight`, and `contain`, `cover`, or `stretch` mode.
- Metadata `preserve`, privacy-filtered `safe`, and `strip` policies for JPEG re-encode output. PNG and WebP output do not preserve source EXIF metadata.
- Output file written to the Android app cache directory.
- `CompressionResult` returns `uri`, `format`, final `width`, final `height`, `byteSize`, `originalByteSize`, and `compressionRatio`.

The following remain planned and are not implemented in the MVP:

- iOS compression.
- PNG, WebP, HEIC / HEIF, AVIF, and GIF input processing.
- Metadata support for non-JPEG formats and iOS.

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

The following product features are planned or only partially implemented.

- Automatic format detection.
- Quality-based compression.
- Target file size compression with `maxBytes`. Android JPEG-input MVP support is implemented for JPEG and WebP output.
- Optional resize during compression. Android JPEG-input MVP support is implemented.
- Output format selection. Android JPEG-input MVP supports JPEG, PNG, and WebP output.
- Automatic EXIF orientation correction. Android JPEG-input MVP support is implemented.
- Metadata preservation and stripping policies. Android JPEG-input MVP supports `preserve`, `safe`, and `strip` for JPEG output.
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

Current Android MVP support is narrower than the planned table: JPEG input is implemented, and JPEG, PNG, and WebP output are implemented. PNG and WebP input remain planned.

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

### 2. Compression with resize

```ts
resize: {
  maxWidth: 2048,
  maxHeight: 2048,
  mode: 'contain',
},
output: {
  format: 'jpeg',
  quality: 80,
}
```

Android JPEG-input MVP resize supports `contain`, `cover`, and `stretch`. EXIF orientation is applied before resize, and the result `width` and `height` describe the final encoded image dimensions after orientation correction and resize.

### 3. Target-size compression

```ts
output: {
  format: 'webp',
  maxBytes: 500_000,
}
```

Android JPEG-input MVP target-size compression treats `quality` as the upper quality bound when both `quality` and `maxBytes` are provided. If `quality` is omitted, Android starts from the default quality. It searches for the highest JPEG or WebP quality that fits under `maxBytes`; if even the lowest quality cannot fit, it returns the smallest generated output instead. PNG output does not support `maxBytes`. `maxBytes` is not intended to guarantee an exact byte size for every source image, format, platform, or codec.

### 4. Compression with format conversion

```ts
output: {
  format: 'webp',
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

Android JPEG-input MVP currently supports `preserve`, `safe`, and `strip` for JPEG output. EXIF orientation is applied to pixels before encoding, so output orientation metadata is normalized instead of preserving the original rotation flag. PNG and WebP output do not copy source EXIF metadata.

`safe` is the default policy. In the Android JPEG-input MVP it copies a privacy-filtered EXIF allowlist into JPEG output, including common camera, date/time, exposure, lens, and color-space attributes. It excludes GPS/location, owner/serial identifiers, maker note, user comment, image-unique ID, XMP, and other broad free-form metadata.

`strip` removes metadata from the encoded output where possible through JPEG re-encode.

`preserve` copies supported source EXIF attributes into the output JPEG, including camera, date/time, exposure, lens, GPS, and XMP attributes. Output orientation is set to normal after pixels are transformed, and output EXIF width/height tags are updated to the final encoded dimensions. ICC color profile preservation remains planned.

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
- [x] Android JPEG EXIF orientation correction.
- [x] Android JPEG resize support.
- [x] Android JPEG target-size compression.
- [x] Android JPEG input to PNG and WebP output encoding.
- [x] Android JPEG-input output format behavior and byte signature JVM tests.
- [x] Android JPEG-input module-level compression integration JVM tests.
- [x] Android JPEG-input resize/orientation module-level JVM tests.
- [x] Android JPEG/WebP target-size module-level JVM tests.
- [x] Android JPEG metadata `safe` / `strip` policy basics.
- [x] Android JPEG metadata `preserve` EXIF copy.
- [x] Android JPEG metadata `safe` privacy-filtered EXIF copy.
- [x] Android JPEG metadata policy unit tests with real EXIF read/write.
- [x] Example application.
- [x] Example metadata policy selector and result summary.
- [x] Example output format selector for JPEG, PNG, and WebP.
- [ ] PNG and WebP input support.
- [ ] HEIC / HEIF input.
- [ ] AVIF support.
- [ ] Metadata support for non-JPEG formats and iOS.
- [ ] Cancellation and progress.
- [ ] Public npm release.

## Installation

This package has not been published to npm yet. The repository contains an initial TypeScript API scaffold and an Android JPEG-input MVP with EXIF orientation correction, optional resize, JPEG/PNG/WebP output encoding, JPEG/WebP target-size compression, and metadata `preserve` / privacy-filtered `safe` / `strip` handling for JPEG output. iOS compression and broader input format support are not implemented yet.

Planned installation command:

```bash
npm install react-native-image-compression-kit
```

## Example Application

The repository includes an Android React Native example app in `example/`. It links this local package through the pnpm workspace and exercises the Android JPEG-input MVP against a `file://` or `content://` source URI.

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

The example screen copies a bundled `sample.jpg` asset into the app cache and uses that cache file URI by default. You can also paste another local `file://` or `content://` JPEG URI. The screen calls:

```ts
compressImage({
  source: { uri },
  resize: {
    maxWidth,
    maxHeight,
    mode,
  },
  output: {
    format,
    quality,
    maxBytes,
  },
  metadata,
});
```

The example lets you choose JPEG, PNG, or WebP output and `preserve`, `safe`, or `strip` metadata handling before compression. It displays the current native output format capability list, the current native `metadataPolicies` capability list, the selected output format, the selected metadata policy, the compressed output URI, result format, final width and height, compressed byte size, original byte size, compression ratio, the metadata policy used for the latest result, and native error code/message when the call fails.

Android Codegen and native build checks can also be run through the example app:

```bash
pnpm example:codegen
pnpm example:android-unit-test
pnpm example:build
```

These commands require a Java runtime and Android SDK. `pnpm example:android-unit-test` runs Robolectric-backed Android JVM unit tests for the package, including real JPEG EXIF read/write coverage for metadata policies, native-graphics JPEG/PNG/WebP output checks for file byte signatures, and module-level `compressImage` coverage for file URI results, result metadata, resize modes, EXIF orientation normalization, JPEG/WebP target-size `maxBytes`, target-size fallback metadata, and PNG `maxBytes` rejection. `pnpm example:android` still requires a connected emulator/device.

## Continuous Integration

GitHub Actions runs the repository checks and Android example build on pushes to `master` and pull requests. The workflow is defined in `.github/workflows/ci.yml`.

The CI job uses Node.js 24, pnpm 11.7.0, Temurin JDK 21, Android SDK platform 36, Android build tools 36.0.0, and Android NDK 27.1.12297006. It enables pnpm and Gradle caching, then runs:

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm example:typecheck
pnpm example:codegen
pnpm example:android-unit-test
pnpm example:build
```

`pnpm example:codegen` runs React Native Codegen through the example app's Android Gradle project. `pnpm example:android-unit-test` runs Robolectric-backed Android JVM unit tests for native metadata policy behavior, native-graphics JPEG/PNG/WebP output format and byte-signature behavior, and module-level `compressImage` file URI, resize, EXIF orientation, and target-size integration behavior. `pnpm example:build` assembles the Android debug build, which verifies the package can be compiled inside a real React Native app with the JPEG, PNG, and WebP output paths.

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
RNICK_ANDROID_APP_DIR=/path/to/App/android RNICK_ANDROID_GRADLE_TASK=:react-native-image-compression-kit:testDebugUnitTest pnpm android:build
```

For the bundled example app, use `pnpm example:codegen`, `pnpm example:android-unit-test`, and `pnpm example:build`.

`pnpm android:codegen` runs `generateCodegenArtifactsFromSchema` in the app Android project. `pnpm android:build` runs `assembleDebug` by default. To use a different Gradle task:

```bash
RNICK_ANDROID_APP_DIR=/path/to/App/android RNICK_ANDROID_GRADLE_TASK=:app:assembleDebug pnpm android:build
```

The executable Android checks require a Java runtime, Android SDK, and a Gradle wrapper or `gradle` command in the target app.

### Local Commit Hook

Install the repository git hooks once per clone:

```bash
pnpm hooks:install
```

The `pre-commit` hook runs `git diff --cached --check`, `pnpm verify`, and `pnpm example:typecheck`. Commits should only be created after these checks pass. After each completed development task, keep `README.md` aligned with the current implementation status before committing.

## Contributing

The project is in its initial design phase. Issues and discussions about the proposed API, format priorities, platform behavior, metadata policy, and native implementation strategy are welcome once the repository is ready for public collaboration.

## License

MIT License. See [LICENSE](./LICENSE).
