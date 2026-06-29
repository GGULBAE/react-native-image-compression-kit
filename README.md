<h1 align="center">React Native Image Compression Kit</h1>

<p align="center">
  Compress any supported image. Return it in the format you choose.
</p>

<p align="center">
  A published Android image compression MVP for React Native, with TypeScript exports and an iOS stub.
</p>

<p align="center">
  <img alt="Status: Android MVP published" src="https://img.shields.io/badge/Status-Android%20MVP%20published-blue" />
  <img alt="Platforms: Android MVP | iOS stub" src="https://img.shields.io/badge/Platforms-Android%20MVP%20%7C%20iOS%20stub-green" />
  <img alt="React Native: Codegen ready" src="https://img.shields.io/badge/React%20Native-Codegen%20ready-61dafb" />
  <img alt="TypeScript: API available" src="https://img.shields.io/badge/TypeScript-API%20available-3178c6" />
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow" />
</p>

React Native Image Compression Kit is a native image compression and transcoding pipeline that loads any supported image format, compresses it, and returns it in a supported format selected by the developer.

## Overview

React Native image compression workflows are often split across format-specific or feature-specific modules. Compression, resizing, HEIC conversion, WebP handling, metadata policy, and platform capability checks can become separate decisions instead of one predictable pipeline.

This project is designed to make compression the center of the API. It will combine detect, decode, auto-orient, resize, transcode, and encode steps behind one consistent React Native interface.

Format conversion is treated as part of the compression result. Developers choose the supported output format they want, and the native pipeline handles the work needed to produce it.

## Status

This package is published on npm. The `0.1.0` release introduced the Android image compression MVP, and `0.1.1` is a docs-only patch that corrects README and npm package page status without changing runtime behavior. The TypeScript API contract, React Native Codegen spec, Android native module, Android example app, iOS stub, unit test foundation, and npm package metadata are in place.

Android includes a published image compression MVP for `file://` and `content://` JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF inputs, JPEG EXIF orientation correction, optional resize, metadata `preserve` / privacy-filtered `safe` / `strip` handling for JPEG source to JPEG output, and JPEG, PNG, or WebP output encoding. GIF input is decoded as a static first frame. HEIC / HEIF input is Android SDK and device-codec dependent: API 28+ uses `ImageDecoder`, API 26-27 attempts a guarded `BitmapFactory` fallback, and earlier Android versions reject HEIC / HEIF with `ERR_UNSUPPORTED_FORMAT`. AVIF input is Android 14+ only and uses `ImageDecoder`. iOS is currently a package stub only; iOS compression is not implemented. GIF output, GIF animation preservation, HEIC / HEIF output, AVIF output, and broader input format support are not implemented yet.

## Current Implementation Scope

The current implementation is intentionally small:

- Runtime compression is Android only; iOS is a package stub and compression is not implemented there yet.
- `file://` and `content://` local URI input.
- JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input. GIF input is static first-frame only, HEIC / HEIF input depends on Android SDK and device codec support, and AVIF input requires Android 14+ baseline image support.
- JPEG, PNG, and WebP output.
- Quality-based compression for JPEG and WebP output. PNG output ignores `quality`.
- Target-size compression with `maxBytes` for JPEG and WebP output. PNG output rejects `maxBytes`.
- JPEG EXIF orientation correction before resize and selected output encoding.
- Optional resize with `maxWidth`, `maxHeight`, and `contain`, `cover`, or `stretch` mode.
- Metadata `preserve`, privacy-filtered `safe`, and `strip` policies for JPEG source to JPEG output. PNG/WebP/GIF/HEIC/HEIF/AVIF sources and PNG/WebP output do not preserve source EXIF metadata.
- Output file written to the Android app cache directory.
- `CompressionResult` returns `uri`, `format`, final `width`, final `height`, `byteSize`, `originalByteSize`, and `compressionRatio`.

The following remain planned and are not implemented in the MVP:

- iOS compression.
- AVIF output.
- HEIC / HEIF output.
- GIF output and GIF/WebP animation preservation.
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
- Target file size compression with `maxBytes`. Android MVP support is implemented for JPEG and WebP output.
- Optional resize during compression. Android MVP support is implemented.
- Output format selection. Android MVP supports JPEG, PNG, WebP, static first-frame GIF, SDK-gated HEIC / HEIF, and Android 14+ AVIF input with JPEG, PNG, and WebP output.
- Automatic EXIF orientation correction. Android MVP support is implemented for JPEG input.
- Metadata preservation and stripping policies. Android MVP supports `preserve`, `safe`, and `strip` for JPEG source to JPEG output.
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
| HEIC / HEIF | Yes | Optional / later | Android input implemented with SDK and codec gating |
| AVIF | Yes | Later | Android input implemented on API 34+ with ImageDecoder |
| GIF | Yes | Later | Static first-frame support before animation preservation |

Current Android MVP support is narrower than the planned table: JPEG, PNG, WebP, static first-frame GIF, SDK-gated HEIC, SDK-gated HEIF, and Android 14+ AVIF input are implemented, and JPEG, PNG, and WebP output are implemented. GIF output, GIF animation preservation, animated WebP, HEIC / HEIF output, and AVIF output remain planned. HEIC / HEIF inputs on Android versions below 8.0 and AVIF inputs on Android versions below 14 reject as `ERR_UNSUPPORTED_FORMAT`. Corrupt supported-format inputs, including corrupt GIF, HEIC / HEIF, and AVIF candidates on supported SDKs, reject as `ERR_DECODE_FAILED`.

Animation preservation for GIF, animated WebP, and animated AVIF is not planned as an initial-version guarantee.

## Android HEIC / HEIF Input

Android platform documentation lists [HEIF decode support on Android 8.0+](https://developer.android.com/media/platform/supported-formats) for `.heic` and `.heif` files, while the Java [`ImageDecoder` API](https://developer.android.com/reference/android/graphics/ImageDecoder) is available from API 28 and explicitly supports decoding HEIF into drawable or bitmap outputs. The Android implementation route is:

- Use `ImageDecoder` on API 28+ for HEIC / HEIF input and force software bitmap allocation before resize and output encoding.
- Attempt a guarded `BitmapFactory` HEIF decode fallback on API 26-27, because platform HEIF decode support exists there but remains device codec dependent.
- Reject HEIC / HEIF inputs with `ERR_UNSUPPORTED_FORMAT` below Android 8.0.
- Keep HEIC / HEIF output unsupported unless a later goal explicitly designs it.

Runtime capabilities currently expose HEIC / HEIF with `input=true` and `output=false`, plus notes that describe the Android 8.0+ platform decode condition, the API 28+ `ImageDecoder` route, the API 26-27 guarded `BitmapFactory` fallback, and the unsupported output state. The main CI validates the version-gated structure and rejection boundaries, and the separate Android Instrumentation workflow validates committed HEIC / HEIF sample decoding on an API 35 emulator.

## Android AVIF Input

Android platform documentation lists AVIF baseline image support as mandatory on Android 14+. The Android implementation route is:

- Use `ImageDecoder` on API 34+ for AVIF input and force software bitmap allocation before resize and output encoding.
- Reject AVIF inputs with `ERR_UNSUPPORTED_FORMAT` below Android 14.
- Keep AVIF output unsupported unless a later goal explicitly designs it.

Runtime capabilities currently expose AVIF with `input=true` and `output=false`, plus notes that describe the Android 14+ `ImageDecoder` route, static image support, no EXIF metadata copy, unsupported animation preservation, and unsupported output state. The main CI validates the API-gated unsupported boundary and corrupt-candidate decode failure behavior, and the separate Android Instrumentation workflow validates committed AVIF sample decoding on an API 35 emulator.

## HEIC / HEIF / AVIF Codec Sample Validation Strategy

This repository now commits tiny HEIC / HEIF / AVIF samples generated from repo-owned PNG sources. The fixture paths are:

- Use `android/src/test/assets/heic-heif/source.png`, a repo-owned 16x12 RGB PNG pattern with no user-photo content.
- Track source and generated output metadata in `android/src/test/assets/heic-heif/manifest.json`.
- Validate the source image, manifest fields, and committed sample files with `pnpm fixtures:heic-heif:check`.
- Generate or refresh committed fixtures with `pnpm fixtures:heic-heif`, which uses `heif-enc --quality 80 source.png -o sample.heic` and `heif-enc --quality 80 source.png -o sample.heif`.
- Generated fixtures are committed because they are tiny, repo-owned derivative assets, and covered by MIT provenance in the manifest.
- Store committed fixtures under `android/src/test/assets/heic-heif/` so Android runtime tests can load them without depending on network access.
- When regenerating with a different `libheif` / `heif-enc` version, update byte size, SHA-256, generator version, dimensions, generation command, and license/provenance in the manifest.
- Use `android/src/test/assets/avif/source.png` and `android/src/test/assets/avif/sample.avif` for AVIF runtime validation.
- Validate the AVIF source image, manifest fields, and committed sample file with `pnpm fixtures:avif:check`.
- Generate or refresh the committed AVIF fixture with `pnpm fixtures:avif`, which uses `heif-enc --quality 80 --avif source.png -o sample.avif`.

Current lightweight coverage is intentionally narrower than real codec validation. `pnpm verify`, `pnpm example:android-unit-test`, and the main GitHub Actions CI validate the HEIC / HEIF / AVIF MIME and extension routing, SDK gates, capability notes, corrupt-candidate rejection boundaries, and committed fixture metadata. They verify the fixture files and metadata, but they do not boot an emulator.

A separate Android Instrumentation workflow enables KVM permissions, boots an API 35 Google APIs emulator with an extended boot timeout, and runs `pnpm example:android-instrumentation`. That task executes `:react-native-image-compression-kit:connectedDebugAndroidTest` and validates the committed `sample.heic`, `sample.heif`, and `sample.avif` fixtures through their `ImageDecoder` routes, asserting JPEG, PNG, and WebP output success with 16x12 result dimensions and byte-signature checks.

Manual codec validation beyond CI should use a codec-backed Android device or emulator on API 28+ first, because that also exercises the `ImageDecoder` route through the example app. After installing the example app, copy a fixture into the app-private files directory and paste the resulting file URI into the example screen:

```bash
pnpm example:android
adb shell run-as com.imagecompressionkit.example mkdir -p files/rnick-codec
adb shell run-as com.imagecompressionkit.example sh -c 'cat > files/rnick-codec/sample.heic' < android/src/test/assets/heic-heif/sample.heic
```

Then use `file:///data/data/com.imagecompressionkit.example/files/rnick-codec/sample.heic` as the source URI and verify JPEG, PNG, and WebP outputs. Repeat with `sample.heif`. API 26-27 should still be checked separately for the guarded `BitmapFactory` fallback because emulator/device codec availability can differ from API 28+.

For AVIF manual validation, use an API 34+ device or emulator and repeat the copy/paste flow with `android/src/test/assets/avif/sample.avif`.

## Public API

The API below is available from the published package. Runtime compression currently succeeds on the Android MVP; iOS compression remains a stub and is not implemented yet.

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

Example result:

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

Android MVP resize supports `contain`, `cover`, and `stretch`. JPEG EXIF orientation is applied before resize, and the result `width` and `height` describe the final encoded image dimensions after orientation correction and resize.

### 3. Target-size compression

```ts
output: {
  format: 'webp',
  maxBytes: 500_000,
}
```

Android MVP target-size compression treats `quality` as the upper quality bound when both `quality` and `maxBytes` are provided. If `quality` is omitted, Android starts from the default quality. It searches for the highest JPEG or WebP quality that fits under `maxBytes`; if even the lowest quality cannot fit, it returns the smallest generated output instead. PNG output does not support `maxBytes`. `maxBytes` is not intended to guarantee an exact byte size for every source image, format, platform, or codec.

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

Android MVP currently supports `preserve`, `safe`, and `strip` for JPEG source to JPEG output. JPEG EXIF orientation is applied to pixels before encoding, so output orientation metadata is normalized instead of preserving the original rotation flag. PNG/WebP/GIF/HEIC/HEIF/AVIF sources and PNG/WebP output do not copy source EXIF metadata.

`safe` is the default policy. In the Android MVP it copies a privacy-filtered JPEG EXIF allowlist into JPEG output, including common camera, date/time, exposure, lens, and color-space attributes. It excludes GPS/location, owner/serial identifiers, maker note, user comment, image-unique ID, XMP, and other broad free-form metadata.

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
- [x] Android PNG and WebP input support.
- [x] Android JPEG-input output format behavior and byte signature JVM tests.
- [x] Android JPEG-input module-level compression integration JVM tests.
- [x] Android `content://` JPEG source module-level JVM tests.
- [x] Android PNG/WebP input module-level JVM tests.
- [x] Android PNG/WebP input resize, target-size, and metadata no-copy regression JVM tests.
- [x] Android AVIF unsupported input and HEIC/HEIF SDK-gated decode-boundary JVM tests.
- [x] Android HEIC/HEIF input decode path and capability notes.
- [x] Android HEIC/HEIF real codec sample validation strategy.
- [x] Android HEIC/HEIF committed sample fixtures and manifest metadata.
- [x] Android AVIF input decode path, fixture manifest, and emulator validation.
- [x] Android GIF static first-frame input support.
- [x] Android GIF input module-level JVM tests for file/content URI, resize, target-size, and metadata no-copy behavior.
- [x] Android JPEG-input resize/orientation module-level JVM tests.
- [x] Android JPEG/WebP target-size module-level JVM tests.
- [x] Android JPEG metadata `safe` / `strip` policy basics.
- [x] Android JPEG metadata `preserve` EXIF copy.
- [x] Android JPEG metadata `safe` privacy-filtered EXIF copy.
- [x] Android JPEG metadata policy unit tests with real EXIF read/write.
- [x] Example application.
- [x] Example metadata policy selector and result summary.
- [x] Example output format selector for JPEG, PNG, and WebP.
- [x] Android HEIC / HEIF input.
- [x] Android HEIC / HEIF emulator/instrumentation validation.
- [x] Android AVIF input.
- [ ] AVIF output.
- [ ] Metadata support for non-JPEG formats and iOS.
- [ ] Cancellation and progress.
- [x] Public npm release.

## Installation

The public `0.1.x` package is distributed under `react-native-image-compression-kit`, with repository, issue tracker, homepage, MIT license, React Native peer dependency, CommonJS entrypoint, TypeScript declarations, React Native Codegen source, Android main sources, and the iOS stub included in the packed package. Version `0.1.0` introduced the Android MVP, and version `0.1.1` is a docs-only patch for README/npm package page status. Development scripts, Android JVM tests, instrumentation tests, and codec fixtures are intentionally excluded from the publish tarball.

The repository contains an initial TypeScript API scaffold and an Android image MVP with JPEG/PNG/WebP/GIF/HEIC/HEIF/AVIF input, GIF static first-frame decoding, HEIC/HEIF SDK-gated input decoding, Android 14+ AVIF input decoding, JPEG EXIF orientation correction, optional resize, JPEG/PNG/WebP output encoding, JPEG/WebP target-size compression, and metadata `preserve` / privacy-filtered `safe` / `strip` handling for JPEG source to JPEG output. iOS compression, HEIC/HEIF output, AVIF output, and broader input format support are not implemented yet.

Install from npm:

```bash
npm install react-native-image-compression-kit
```

## Example Application

The repository includes an Android React Native example app in `example/`. It links this local package through the pnpm workspace and exercises the Android JPEG/PNG/WebP/GIF/HEIC/HEIF/AVIF input MVP against a `file://` or `content://` source URI.

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

The example screen copies a bundled `sample.jpg` asset into the app cache and uses that cache file URI by default. You can also paste another local `file://` or `content://` JPEG, PNG, WebP, GIF, HEIC, HEIF, or AVIF URI. The screen calls:

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
pnpm example:android-instrumentation
pnpm example:build
```

These commands require a Java runtime and Android SDK. `pnpm example:android-unit-test` runs Robolectric-backed Android JVM unit tests for the package, including real JPEG EXIF read/write coverage for metadata policies, native-graphics JPEG/PNG/WebP output checks for file byte signatures, and module-level `compressImage` coverage for file URI results, `content://` source parity and read failures, AVIF API-gated decode boundaries, HEIC/HEIF SDK-gated decode boundaries, HEIC/HEIF/AVIF capability notes, corrupt supported-format decode failures, PNG/WebP/GIF input, GIF static first-frame decoding, PNG/WebP/GIF input resize modes, PNG/WebP/GIF input target-size `maxBytes`, PNG/WebP/GIF metadata no-copy behavior, result metadata, resize modes, EXIF orientation normalization, JPEG/WebP target-size `maxBytes`, target-size fallback metadata, and PNG `maxBytes` rejection. `pnpm example:android-instrumentation` requires a connected API 34+ emulator or device and runs the committed HEIC/HEIF/AVIF sample-to-JPEG/PNG/WebP instrumentation test. `pnpm android:doctor` also validates the HEIC/HEIF and AVIF source and committed sample fixture manifests, byte sizes, SHA-256 hashes, and instrumentation wiring. `pnpm example:android` still requires a connected emulator/device.

## Continuous Integration

GitHub Actions runs the repository checks and Android example build on pushes to `master` and pull requests. The lightweight workflow is defined in `.github/workflows/ci.yml`.

The CI job uses Node.js 24, pnpm 11.7.0, Temurin JDK 21, Android SDK platform 36, Android build tools 36.0.0, and Android NDK 27.1.12297006. The GitHub Actions workflow actions are kept on Node 24 runtime-compatible majors: `actions/checkout@v7`, `actions/setup-node@v6`, `actions/setup-java@v5`, `android-actions/setup-android@v4`, `pnpm/action-setup@v6`, and `gradle/actions/setup-gradle@v6`. It enables pnpm and Gradle caching, then runs:

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm example:typecheck
pnpm example:codegen
pnpm example:android-unit-test
pnpm example:build
pnpm smoke:consumer
```

`pnpm example:codegen` runs React Native Codegen through the example app's Android Gradle project. `pnpm example:android-unit-test` runs Robolectric-backed Android JVM unit tests for native metadata policy behavior, native-graphics JPEG/PNG/WebP/GIF input and JPEG/PNG/WebP output format and byte-signature behavior, and module-level `compressImage` file URI, content URI, AVIF API-gated decode boundaries, HEIC/HEIF SDK-gated decode boundaries, HEIC/HEIF/AVIF capability-note structure, corrupt supported-format decode failure, GIF static first-frame decoding, PNG/WebP/GIF input resize, EXIF orientation, target-size, and metadata no-copy integration behavior. `pnpm example:build` assembles the Android debug build, which verifies the package can be compiled inside a real React Native app with the JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input paths and JPEG, PNG, and WebP output paths.

`pnpm smoke:consumer` builds the TypeScript output, creates a `pnpm pack` tarball, installs that tarball into a separate temporary React Native consumer project, and typechecks imports from `react-native-image-compression-kit` against the packed package. This pre-release smoke test verifies the npm package shape without publishing to npm or running Metro/native device builds. Set `RNICK_CONSUMER_SMOKE_KEEP=1` to keep the temporary project for inspection, or `RNICK_CONSUMER_SMOKE_TMPDIR=/path/to/tmp` to choose its parent directory.

The separate `.github/workflows/android-instrumentation.yml` workflow enables KVM permissions, boots an API 35 Google APIs emulator with an extended boot timeout, and runs `pnpm example:android-instrumentation`. This workflow validates that the committed HEIC, HEIF, and AVIF fixtures decode on the Android `ImageDecoder` paths and can be compressed to JPEG, PNG, and WebP. It stays separate from the lightweight CI because emulator startup and codec execution are slower and more environment-sensitive than JVM tests.

## Docker Android Build/Test Environment

The repository includes a Docker-based Android build/test environment for machines that do not have Java, Android SDK, build tools, CMake, or NDK installed locally. The root `Dockerfile` mirrors the lightweight CI environment with Node.js 24, pnpm 11.7.0, Temurin JDK 21, Android SDK platform 36, Android build tools 36.0.0, Android build tools 35.0.0 for React Native/AGP compatibility, CMake 3.22.1, and Android NDK 27.1.12297006.

Build the image:

```bash
pnpm docker:android:build
```

Run the full non-emulator Android verification flow in Docker:

```bash
pnpm docker:android:ci
```

That command installs dependencies inside Docker-managed volumes, then runs:

```bash
pnpm verify
pnpm example:typecheck
pnpm example:codegen
pnpm example:android-unit-test
pnpm example:build
```

You can also run individual Docker-backed checks:

```bash
pnpm docker:android:verify
pnpm docker:android:example:typecheck
pnpm docker:android:example:codegen
pnpm docker:android:example:android-unit-test
pnpm docker:android:example:build
```

The Docker runner uses `linux/amd64` by default so Android SDK build tools behave like the GitHub Actions Linux environment. It bind-mounts the repository at `/workspace`, disables Gradle VFS watching for Docker bind-mount stability, and uses named Docker volumes for `node_modules`, the pnpm store, and the Gradle home cache so container dependencies do not overwrite the host install. Override the image, platform, or volume prefix with `RNICK_ANDROID_DOCKER_IMAGE`, `RNICK_ANDROID_DOCKER_PLATFORM`, or `RNICK_ANDROID_DOCKER_VOLUME_PREFIX` if needed.

Docker covers repository checks, Android Codegen, Android JVM unit tests, and the example Android debug build. It does not run an Android emulator, `pnpm example:android`, or `pnpm example:android-instrumentation`; those still require a connected API 34+ emulator/device or the separate GitHub Actions instrumentation workflow.

## Development Verification

Run the JavaScript and TypeScript checks:

```bash
pnpm verify
```

`pnpm verify` runs type checking, unit tests, the TypeScript build, and the Android verification doctor.

Run the pack-based consumer smoke test before release-oriented changes:

```bash
pnpm smoke:consumer
```

This command builds the package, creates a local tarball with `pnpm pack`, installs it into a separate temporary React Native consumer project, and typechecks public API imports from the packed package.

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
Use `pnpm example:android-instrumentation` only when an API 34+ emulator or device is connected.

`pnpm android:codegen` runs `generateCodegenArtifactsFromSchema` in the app Android project. `pnpm android:build` runs `assembleDebug` by default. To use a different Gradle task:

```bash
RNICK_ANDROID_APP_DIR=/path/to/App/android RNICK_ANDROID_GRADLE_TASK=:app:assembleDebug pnpm android:build
```

The executable Android checks require a Java runtime, Android SDK, and a Gradle wrapper or `gradle` command in the target app. If those are not installed locally, use `pnpm docker:android:build` followed by `pnpm docker:android:ci` to run the non-emulator Android verification flow in the reproducible Docker environment.

## Release Dry Run Checklist

Actual npm publishing requires an authenticated npm registry session and is intentionally outside the dry-run checklist. See [RELEASE.md](RELEASE.md) for the v0.1.1 docs-only patch notes, v0.1.0 published artifact details, tag checklist, and post-publish security review. Before publishing a new version, review the intended version and package metadata, then run the dry-run release gate from the repository root:

```bash
pnpm release:dry-run
```

That command does not publish to npm. It runs the required pre-publish checks in this order:

```bash
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm smoke:consumer
pnpm publish --dry-run --no-git-checks
```

The final `pnpm publish --dry-run --no-git-checks` step exercises the publish packaging path without uploading a package. The `--no-git-checks` flag keeps the dry run usable before the release commit or tag exists; the actual publish decision should still wait for a clean working tree, the intended version, reviewed release notes, a pushed version tag, and a successful GitHub Actions CI run on the pushed release commit. Tag, npm publish, and post-publish security review commands are documented in `RELEASE.md` and should only be run manually after those checks pass.

### Local Commit Hook

Install the repository git hooks once per clone:

```bash
pnpm hooks:install
```

The `pre-commit` hook runs `git diff --cached --check`, `pnpm verify`, and `pnpm example:typecheck`. Commits should only be created after these checks pass. After each completed development task, keep `README.md` aligned with the current implementation status before committing.

## Contributing

The project is in its initial design phase. Issues and discussions about the proposed API, format priorities, platform behavior, metadata policy, and native implementation strategy are welcome once the repository is ready for public collaboration.

## Security

See [SECURITY.md](SECURITY.md) for supported versions, vulnerability reporting guidance, and package security hygiene. Published packages should not run install-time lifecycle scripts, and release verification should confirm that credentials, `.npmrc`, `.env*`, tests, fixtures, example app files, and debug keystores stay out of the npm tarball.

## License

MIT License. See [LICENSE](./LICENSE).
