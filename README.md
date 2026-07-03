<h1 align="center">React Native Image Compression Kit</h1>

<p align="center">
  Compress any supported image. Return it in the format you choose.
</p>

<p align="center">
  A React Native image compression MVP with Android broad-format support, iOS JPEG metadata preserve, iOS JPEG/PNG/GIF/WebP/HEIC/HEIF input, runtime-gated iOS AVIF input and WebP output support, and TypeScript exports.
</p>

<p align="center">
  <img alt="Status: v0.2.13 candidate" src="https://img.shields.io/badge/Status-v0.2.13%20candidate-blue" />
  <img alt="Platforms: Android MVP | iOS JPEG metadata preserve" src="https://img.shields.io/badge/Platforms-Android%20MVP%20%7C%20iOS%20JPEG%20metadata%20preserve-green" />
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

Version `0.2.13` is an unpublished release candidate for `react-native-image-compression-kit`. It hardens iOS `metadata: 'preserve'` for JPEG source to JPEG output by normalizing preserved orientation and pixel dimension metadata after resize and `output.maxBytes` paths while keeping the latest published npm package at `0.2.12`, with GitHub Release [v0.2.12](https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.12).

Android includes a published image compression MVP for `file://` and `content://` JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF inputs, JPEG EXIF orientation correction, optional resize, metadata `preserve` / privacy-filtered `safe` / `strip` handling for JPEG source to JPEG output, and JPEG, PNG, or WebP output encoding. GIF input is decoded as a static first frame. HEIC / HEIF input is Android SDK and device-codec dependent: API 28+ uses `ImageDecoder`, API 26-27 attempts a guarded `BitmapFactory` fallback, and earlier Android versions reject HEIC / HEIF with `ERR_UNSUPPORTED_FORMAT`. AVIF input is Android 14+ only and uses `ImageDecoder`. The current iOS JPEG/PNG/GIF/WebP/HEIC/HEIF/AVIF MVP supports `file://` and `content://` JPEG, PNG, GIF, WebP, HEIC, HEIF, or runtime-available AVIF input, optional resize, quality-based JPEG output, target-size JPEG output with `output.maxBytes`, PNG output, runtime ImageIO-backed WebP output with target-size `output.maxBytes` when `CGImageDestination` advertises WebP destination support, cache-file results, `metadata: 'preserve'` for JPEG source to JPEG output with output orientation and pixel dimension metadata normalized after rendering, and `safe` / `strip` metadata policies that re-encode without copying source metadata. GIF, WebP, HEIC, HEIF, and runtime-available AVIF input are decoded as static images through ImageIO on iOS. iOS `getImageCompressionCapabilities()` reports JPEG input/output, PNG input/output, GIF input with no GIF output, WebP input with runtime-gated WebP output, HEIC input with no HEIC output, HEIF input with no HEIF output, AVIF input only when `CGImageSourceCopyTypeIdentifiers()` advertises an AVIF source type and no AVIF output, `metadataPolicies: ['preserve', 'safe', 'strip']`, target-size compression support for JPEG output and runtime-available WebP output, and no cancellation. The GitHub Actions iOS Validation runner with Xcode 16.4 and the iPhoneSimulator18.5 SDK currently reports WebP `output=false` because ImageIO does not advertise a WebP destination type there; AVIF input is capability-gated the same way and rejects with `ERR_UNSUPPORTED_FORMAT` when ImageIO does not advertise AVIF source support. GIF output, GIF animation preservation, animated WebP preservation, animated AVIF preservation, HEIC / HEIF output, AVIF output, and metadata preservation outside JPEG source to JPEG output are not implemented yet.

## Current Implementation Scope

The current implementation is intentionally small:

- Runtime compression is implemented on Android and on the current iOS JPEG/PNG/GIF/WebP/HEIC/HEIF/runtime-available AVIF MVP surface.
- Android supports `file://` and `content://` local URI input. iOS supports `file://` and best-effort `content://` local URI input through Foundation URL loading.
- JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input. GIF input is static first-frame only, Android HEIC / HEIF input depends on Android SDK and device codec support, iOS HEIC / HEIF input uses static ImageIO decode, Android AVIF input requires Android 14+ baseline image support, and iOS AVIF input requires runtime ImageIO AVIF source support.
- iOS input is currently JPEG, PNG, static ImageIO GIF, static ImageIO WebP, static ImageIO HEIC, static ImageIO HEIF, and runtime-available static ImageIO AVIF.
- Android output is JPEG, PNG, and WebP. iOS output is JPEG, PNG, and WebP only when ImageIO advertises a WebP destination type at runtime.
- Quality-based compression for JPEG, Android WebP output, and runtime-available iOS WebP output. PNG output ignores `quality`.
- Target-size compression with `maxBytes` for Android JPEG and WebP output, iOS JPEG output, and runtime-available iOS WebP output. Android and iOS PNG output reject `maxBytes`.
- JPEG EXIF orientation correction before resize and selected output encoding.
- Optional resize with `maxWidth`, `maxHeight`, and `contain`, `cover`, or `stretch` mode.
- Android supports metadata `preserve`, privacy-filtered `safe`, and `strip` policies for JPEG source to JPEG output. PNG/WebP/GIF/HEIC/HEIF/AVIF sources and PNG/WebP output do not preserve source EXIF metadata. iOS supports `preserve` only for JPEG source to JPEG output; `safe` and `strip` re-encode without copying source metadata, and non-JPEG preserve requests reject with `ERR_NOT_IMPLEMENTED`.
- Output file written to the platform app cache directory.
- `CompressionResult` returns `uri`, `format`, final `width`, final `height`, `byteSize`, `originalByteSize`, and `compressionRatio`.

The following remain planned and are not implemented in the MVP:

- AVIF output.
- HEIC / HEIF output.
- GIF output and GIF/WebP animation preservation.
- Metadata support for non-JPEG formats and broader iOS metadata preservation.

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
- Target file size compression with `maxBytes`. Android MVP support is implemented for JPEG and WebP output; iOS support is implemented for JPEG output and runtime-available WebP output, while iOS PNG output intentionally rejects `maxBytes`.
- Optional resize during compression. Android MVP and iOS JPEG/PNG/GIF/WebP/HEIC/HEIF/runtime-available AVIF MVP support is implemented.
- Output format selection. Android MVP supports JPEG, PNG, WebP, static first-frame GIF, SDK-gated HEIC / HEIF, and Android 14+ AVIF input with JPEG, PNG, and WebP output. iOS MVP supports JPEG, PNG, and runtime-gated ImageIO-backed WebP output from JPEG, PNG, static GIF, static WebP, static HEIC, static HEIF, and runtime-available static AVIF input.
- Automatic EXIF orientation correction. Android MVP support is implemented for JPEG input.
- Metadata preservation and stripping policies. Android MVP supports `preserve`, `safe`, and `strip` for JPEG source to JPEG output. iOS supports `preserve` for JPEG source to JPEG output, plus `safe` and `strip` no-copy re-encode behavior.
- Alpha-channel handling.
- Local URI input and output.
- Compression statistics.
- Cancellation.
- Runtime capability inspection.
- Android and iOS support. Android has the broader MVP; iOS currently supports JPEG/PNG/GIF/WebP/HEIC/HEIF/runtime-available AVIF input to JPEG, PNG, or runtime-gated ImageIO-backed WebP output, with GIF, WebP, HEIC, HEIF, and AVIF decoded as static ImageIO images.
- React Native New Architecture-first design.

## Planned Format Support

The table below describes planned input and output support. Actual availability may depend on platform codecs and will be reported through runtime capability APIs.

| Format | Planned input | Planned output | Notes |
|---|---:|---:|---|
| JPEG | Yes | Yes | Lossy compression |
| PNG | Yes | Yes | Lossless compression |
| WebP | Yes | Yes | Lossy and lossless |
| HEIC / HEIF | Yes | Optional / later | Android input implemented with SDK and codec gating; iOS input implemented as static ImageIO decode |
| AVIF | Yes | Later | Android input implemented on API 34+ with ImageDecoder; iOS input is runtime-gated by ImageIO AVIF source support |
| GIF | Yes | Later | Static first-frame support before animation preservation |

Current Android MVP support is narrower than the planned table: JPEG, PNG, WebP, static first-frame GIF, SDK-gated HEIC, SDK-gated HEIF, and Android 14+ AVIF input are implemented, and JPEG, PNG, and WebP output are implemented. Current iOS MVP support is narrower again: JPEG, PNG, static ImageIO GIF, static ImageIO WebP, static ImageIO HEIC, static ImageIO HEIF, and runtime-available static ImageIO AVIF input are implemented, JPEG output is implemented with quality, resize, and target-size compression, PNG output is implemented without target-size compression, and WebP output is implemented with quality and target-size compression through ImageIO when the runtime advertises a WebP destination type. GIF output, GIF animation preservation, animated WebP preservation, animated AVIF preservation, HEIC / HEIF output, and AVIF output remain planned. HEIC / HEIF inputs on Android versions below 8.0, AVIF inputs on Android versions below 14, and AVIF inputs on iOS runtimes without ImageIO AVIF source support reject as `ERR_UNSUPPORTED_FORMAT`. Corrupt supported-format inputs, including corrupt GIF, HEIC / HEIF, and AVIF candidates on supported SDKs or runtimes, reject as `ERR_DECODE_FAILED`.

Animation preservation for GIF, animated WebP, and animated AVIF is not planned as an initial-version guarantee.

## iOS MVP Behavior

Version `0.2.0` replaces the previous iOS package stub with a native JPEG MVP. Version `0.2.1` extends that iOS JPEG MVP with target-size compression. Version `0.2.2` adds PNG output. Version `0.2.3` adds GIF input decoded as a static first frame. Version `0.2.4` adds WebP input decoded as a static first frame. Version `0.2.5` adds a runtime-gated ImageIO-backed WebP output path. Version `0.2.6` adds target-size `output.maxBytes` support to that runtime-available WebP output path. Version `0.2.7` adds HEIC/HEIF input decoded as static ImageIO images. Version `0.2.10` adds capability-gated AVIF input decoded as a static ImageIO image when the runtime advertises AVIF source support. Version `0.2.12` adds iOS JPEG metadata preserve for JPEG source to JPEG output. Version `0.2.13` is the unpublished candidate that normalizes preserved iOS JPEG orientation and dimension metadata after rendering:

- `compressImage()` accepts `file://` and best-effort `content://` JPEG, PNG, GIF, WebP, HEIC, HEIF, or runtime-available AVIF source URIs.
- JPEG output is encoded with ImageIO `CGImageDestination` into the iOS app cache directory.
- PNG output is encoded with `UIImagePNGRepresentation()` into the iOS app cache directory.
- WebP output is encoded with ImageIO `CGImageDestination` into the iOS app cache directory when `CGImageDestinationCopyTypeIdentifiers()` advertises a WebP destination type.
- On the current GitHub Actions iOS Validation runner with Xcode 16.4 and the iPhoneSimulator18.5 SDK, ImageIO does not advertise a WebP destination type. In that environment WebP reports `input=true` and `output=false`, and `output.format: 'webp'` rejects with `ERR_NOT_IMPLEMENTED`.
- GIF, WebP, HEIC, HEIF, and runtime-available AVIF input are decoded through ImageIO as static images before resize and output encoding; animation preservation is not implemented for animated formats.
- `resize.maxWidth`, `resize.maxHeight`, and `contain`, `cover`, or `stretch` mode are supported before output encoding.
- `output.quality` controls JPEG quality and runtime-available WebP quality from `0` to `100`; when omitted, iOS uses the same default quality of `80`.
- PNG output ignores `quality`.
- `output.maxBytes` is supported for JPEG output and runtime-available WebP output. iOS treats `quality` as the upper quality bound and searches for the highest JPEG or WebP quality that fits under `maxBytes`; if even the lowest quality cannot fit, it returns the smallest generated output. PNG output rejects `maxBytes` with `ERR_NOT_IMPLEMENTED`.
- PNG output preserves alpha where the processed image contains transparency. Runtime-available WebP output uses the processed image alpha as provided by ImageIO. JPEG output still composites alpha over white.
- `metadata: 'preserve'` copies source JPEG metadata only for JPEG source to JPEG output, including resize, quality, and `output.maxBytes` paths. Preserved JPEG output normalizes top-level orientation, TIFF orientation, top-level pixel width/height, and EXIF `PixelXDimension` / `PixelYDimension` to the rendered output. `metadata: 'safe'` and `metadata: 'strip'` re-encode without copying source metadata. Non-JPEG input or non-JPEG output with `preserve` rejects with `ERR_NOT_IMPLEMENTED`.
- AVIF input is enabled only when `CGImageSourceCopyTypeIdentifiers()` advertises an AVIF source type. On runtimes without that support, AVIF input rejects with `ERR_UNSUPPORTED_FORMAT`.
- `getImageCompressionCapabilities()` resolves with `platform: 'ios'`, JPEG `input=true` and `output=true`, PNG `input=true` and `output=true`, GIF `input=true` and `output=false`, WebP `input=true` and WebP `output=true` when the runtime advertises ImageIO WebP destination support, HEIC `input=true` and `output=false`, HEIF `input=true` and `output=false`, AVIF `input=true` only when the runtime advertises ImageIO AVIF source support, AVIF `output=false`, `metadataPolicies: ['preserve', 'safe', 'strip']`, `supportsTargetSizeCompression: true` for JPEG and runtime-available WebP output, and `supportsCancellation: false`.
- If the TypeScript API throws `ERR_NATIVE_MODULE_UNAVAILABLE`, the native module was not found by React Native. Rebuild the app after installing or linking the package; this is separate from platform capability errors returned by the native implementation.

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

The API below is available from the package. Runtime compression succeeds on the Android MVP. As of version `0.2.10`, iOS runtime compression succeeds for JPEG, PNG, static ImageIO GIF, static ImageIO WebP, static ImageIO HEIC, static ImageIO HEIF, or runtime-available static ImageIO AVIF input to JPEG, PNG, or runtime-gated ImageIO-backed WebP output, including JPEG `output.maxBytes` and runtime-available WebP `output.maxBytes`; call `getImageCompressionCapabilities()` to guard platform-specific format, metadata, AVIF source support, and target-size support before compression.

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

Android MVP and iOS JPEG/PNG/GIF/WebP/HEIC/HEIF/runtime-available AVIF MVP resize support `contain`, `cover`, and `stretch`. JPEG EXIF orientation is applied before resize, and the result `width` and `height` describe the final encoded image dimensions after orientation correction and resize.

### 3. Target-size compression

```ts
output: {
  format: 'webp',
  maxBytes: 500_000,
}
```

Target-size compression treats `quality` as the upper quality bound when both `quality` and `maxBytes` are provided. If `quality` is omitted, the native implementation starts from the default quality. Android searches for the highest JPEG or WebP quality that fits under `maxBytes`; iOS searches the same way for JPEG output and for WebP output when ImageIO advertises WebP destination encoding. If even the lowest quality cannot fit, the native implementation returns the smallest generated output instead. Android and iOS PNG output do not support `maxBytes`; iOS HEIC, HEIF, AVIF, and other unsupported outputs also reject `maxBytes`. `maxBytes` is not intended to guarantee an exact byte size for every source image, format, platform, or codec.

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

The iOS JPEG/PNG/GIF/WebP/HEIC/HEIF/runtime-available AVIF MVP supports `preserve` only for JPEG source to JPEG output. It copies source JPEG metadata through resize, quality, and `output.maxBytes` JPEG output paths, then normalizes output orientation and pixel dimension metadata to match the rendered JPEG. `safe` and `strip` re-encode without copying source metadata, so the default `safe` policy is privacy-preserving but narrower than Android's EXIF allowlist. PNG/WebP/GIF/HEIC/HEIF/AVIF sources and PNG/WebP output still reject `preserve` with `ERR_NOT_IMPLEMENTED`.

`safe` is the default policy. In the Android MVP it copies a privacy-filtered JPEG EXIF allowlist into JPEG output, including common camera, date/time, exposure, lens, and color-space attributes. It excludes GPS/location, owner/serial identifiers, maker note, user comment, image-unique ID, XMP, and other broad free-form metadata.

`strip` removes metadata from the encoded output where possible through JPEG re-encode.

On Android, `preserve` copies supported source EXIF attributes into the output JPEG, including camera, date/time, exposure, lens, GPS, and XMP attributes. Output orientation is set to normal after pixels are transformed, and output EXIF width/height tags are updated to the final encoded dimensions. On iOS, `preserve` copies source JPEG metadata for JPEG source to JPEG output, normalizes output orientation metadata after rendering, and updates output pixel dimension metadata to the rendered JPEG dimensions. ICC color profile preservation remains planned.

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
- [x] iOS JPEG/PNG input to JPEG output MVP.
- [x] iOS JPEG/PNG input to PNG output MVP.
- [x] iOS optional resize and JPEG quality support.
- [x] iOS JPEG target-size compression.
- [x] iOS PNG output.
- [x] iOS GIF static first-frame input support.
- [x] iOS WebP static first-frame input support.
- [x] iOS runtime-gated WebP output path through ImageIO destination support.
- [x] iOS runtime-gated WebP target-size compression.
- [x] iOS HEIC/HEIF static ImageIO input support.
- [x] iOS capability-gated AVIF static ImageIO input support.
- [x] iOS JPEG metadata `preserve` for JPEG source to JPEG output.
- [x] iOS JPEG metadata `preserve` orientation and dimension normalization.
- [x] iOS capability reporting for JPEG/PNG/GIF/WebP/HEIC/HEIF/runtime-available AVIF input, JPEG/PNG/runtime-gated WebP output, metadata policies, target-size support, and cancellation.
- [x] Example application.
- [x] Example metadata policy selector and result summary.
- [x] Example output format selector for JPEG, PNG, and WebP.
- [x] Android HEIC / HEIF input.
- [x] Android HEIC / HEIF emulator/instrumentation validation.
- [x] Android AVIF input.
- [ ] AVIF output.
- [ ] Metadata support for non-JPEG formats and broader iOS metadata preservation.
- [ ] Cancellation and progress.
- [x] Public npm release.

## Installation

The `0.2.13` package metadata is prepared as an unpublished iOS JPEG metadata preserve hardening candidate for `react-native-image-compression-kit`. Repository, issue tracker, homepage, MIT license, React Native peer dependency, CommonJS entrypoint, TypeScript declarations, React Native Codegen source, Android main sources, and iOS native source are included in the publish tarball. Version `0.2.12` remains the latest published npm package. Version `0.1.0` introduced the Android MVP, version `0.1.1` is the published docs-only patch for README/npm package page status, version `0.1.2` is the published iOS-stub clarity patch for native-unavailable messaging, README guidance, and iOS capability reporting, version `0.2.0` is the published iOS native JPEG MVP release, version `0.2.1` is the published iOS JPEG target-size release, version `0.2.2` is the published iOS PNG output release, version `0.2.3` is the published iOS GIF static first-frame input release, version `0.2.4` is the published iOS WebP static first-frame input release, version `0.2.5` is the published iOS runtime-gated WebP output release, version `0.2.6` is the published iOS runtime-gated WebP target-size release, version `0.2.7` is the published iOS HEIC/HEIF static input release, version `0.2.8` is the published post-publish registry smoke automation release, version `0.2.9` is the published docs-only npm package page README correction release, version `0.2.10` is the published iOS AVIF input capability-gated static decode release, version `0.2.11` is the published docs-only npm README correction release, version `0.2.12` is the published iOS JPEG metadata preserve release, and version `0.2.13` is the unpublished iOS JPEG metadata preserve hardening candidate. Development scripts, Android JVM tests, instrumentation tests, and codec fixtures are intentionally excluded from the publish tarball.

The repository contains an initial TypeScript API scaffold, an Android image MVP with JPEG/PNG/WebP/GIF/HEIC/HEIF/AVIF input, GIF static first-frame decoding, HEIC/HEIF SDK-gated input decoding, Android 14+ AVIF input decoding, JPEG EXIF orientation correction, optional resize, JPEG/PNG/WebP output encoding, JPEG/WebP target-size compression, and metadata `preserve` / privacy-filtered `safe` / `strip` handling for JPEG source to JPEG output. Version `0.2.0` adds an iOS native MVP with JPEG/PNG input, optional resize, quality-based JPEG output, `safe` / `strip` metadata behavior, and iOS capability reporting. Version `0.2.1` adds iOS JPEG target-size compression. Version `0.2.2` adds iOS PNG output. Version `0.2.3` adds iOS GIF input decoded as a static first frame. Version `0.2.4` adds iOS WebP input decoded as a static first frame. Version `0.2.5` adds a runtime-gated iOS WebP output path through ImageIO destination encoding. Version `0.2.6` adds target-size `output.maxBytes` support to that runtime-available WebP output path. Version `0.2.7` adds iOS HEIC/HEIF input decoded as static ImageIO images. Version `0.2.8` adds post-publish registry smoke automation without runtime behavior changes. Version `0.2.9` corrects the packaged npm README without runtime behavior changes. Version `0.2.10` adds iOS AVIF input decoded as a runtime-available static ImageIO image. Version `0.2.11` corrects the packaged npm README without runtime behavior changes. Version `0.2.12` adds iOS JPEG metadata preserve for JPEG source to JPEG output. Version `0.2.13` hardens that iOS preserve path by normalizing output orientation and pixel dimension metadata. HEIC/HEIF output, AVIF output, metadata preservation outside JPEG source to JPEG output, GIF animation preservation, animated AVIF preservation, and animated WebP preservation are not implemented yet.

Install from npm:

```bash
npm install react-native-image-compression-kit
```

## Example Application

The repository includes a React Native example app in `example/`. The Android app links this local package through the pnpm workspace and exercises the Android JPEG/PNG/WebP/GIF/HEIC/HEIF/AVIF input MVP against a `file://` or `content://` source URI. The iOS host app under `example/ios` links the local package through CocoaPods and drives the iOS JPEG/PNG/GIF/WebP/HEIC/HEIF/runtime-available AVIF MVP smoke validation.

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

## iOS Host-App Validation

The repository includes a React Native iOS example host app under `example/ios`. It links the local package through CocoaPods and includes an iOS-only `ExampleImageSource` native module that generates tiny JPEG, PNG, GIF, WebP, HEIC, HEIF, and AVIF smoke fixtures in the simulator cache.

Install the iOS pods:

```bash
pnpm example:ios:pods
```

Build the iOS example app for an available simulator:

```bash
pnpm example:ios:build
```

Run the automated iOS host-app smoke:

```bash
pnpm example:ios:smoke
```

The smoke command requires full Xcode with an iOS simulator SDK, Ruby 3.1 or newer with Bundler or CocoaPods, and an available iPhone simulator. It installs pods when needed, starts Metro, builds the Debug simulator app, installs it, launches it with `RNICK_IOS_SMOKE=1`, and waits for the `RNICK_IOS_SMOKE_PASS` log marker. The example Gemfile pins the CocoaPods validation toolchain to patched ActiveSupport and Concurrent Ruby ranges; that Ruby toolchain is used for local/CI validation only and is excluded from the published npm tarball.

The pod install path treats CocoaPods `pathname contains null byte` as an external path-resolution flake. The example Podfile applies a local CocoaPods pathname workaround for pnpm-symlinked pods, and the validation script retries once by default after removing generated `example/ios/Pods`, `example/ios/ImageCompressionKitExample.xcworkspace`, and `example/ios/Podfile.lock` artifacts. It prints Ruby, Bundler, CocoaPods, pnpm, and bundle path diagnostics before retrying or failing. Override `RNICK_IOS_POD_INSTALL_ATTEMPTS` when a CI image needs a different number of pod install attempts.

Metro startup waits up to 180 seconds by default to tolerate cold macOS CI runners. Override `RNICK_IOS_METRO_READY_TIMEOUT_MS` when a local machine or CI image needs a shorter or longer readiness window.

The smoke path validates the native module link plus runtime behavior from the React Native host app: iOS capabilities report JPEG input/output, PNG input/output, GIF input with no GIF output, WebP input with capability-driven output, HEIC input with no HEIC output, HEIF input with no HEIF output, AVIF input only when ImageIO advertises AVIF source support and no AVIF output, `metadataPolicies: ['preserve', 'safe', 'strip']`, target-size compression support, and no cancellation; JPEG, PNG, GIF, WebP, HEIC, HEIF, and capability-available AVIF fixtures compress to JPEG output; JPEG source metadata is generated with stale TIFF orientation and EXIF pixel dimensions, read, preserved through JPEG output with `metadata: 'preserve'`, resize, quality, and `output.maxBytes`, then read back from the compressed result with orientation normalized to `1` and pixel dimension metadata matching the compressed JPEG; JPEG, PNG, GIF, WebP, HEIC, HEIF, and capability-available AVIF fixtures compress to PNG output; GIF, WebP, HEIC, HEIF, and capability-available AVIF JPEG output run through the `output.maxBytes` path and return `byteSize <= maxBytes` for the smoke target; JPEG `output.maxBytes` succeeds and returns `byteSize <= maxBytes` for the smoke target; PNG `output.maxBytes` rejects with `ERR_NOT_IMPLEMENTED`; JPEG input to PNG output with `metadata: 'preserve'` rejects with `ERR_NOT_IMPLEMENTED`; when ImageIO advertises a WebP destination type, JPEG, PNG, GIF, WebP, HEIC, HEIF, and capability-available AVIF fixtures also compress to WebP output and WebP `output.maxBytes` succeeds with `byteSize <= maxBytes`; when ImageIO does not advertise a WebP destination type, `output.format: 'webp'` rejects with `ERR_NOT_IMPLEMENTED`; when ImageIO does not advertise AVIF source support, AVIF input rejects with `ERR_UNSUPPORTED_FORMAT`; HEIC, HEIF, and AVIF output reject with `ERR_NOT_IMPLEMENTED`; and GIF output remains rejected by TypeScript validation with `ERR_INVALID_OPTIONS`.

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

`pnpm smoke:registry -- --version 0.2.11` validates an already published npm registry package. It runs `npm view`, downloads the registry tarball with `npm pack`, checks required runtime files and forbidden development-only files, installs the published version into a separate temporary React Native consumer project with `npm install --ignore-scripts --legacy-peer-deps`, and runs `npm run typecheck` against public imports from the registry package. This post-publish smoke test intentionally is not part of the default CI or `pnpm release:dry-run`, because it requires an already published npm version. Set `RNICK_REGISTRY_SMOKE_KEEP=1` to keep the temporary project for inspection, `RNICK_REGISTRY_SMOKE_TMPDIR=/path/to/tmp` to choose its parent directory, or `RNICK_REGISTRY_SMOKE_VERSION=0.2.11` to provide the version without CLI arguments.

The separate `.github/workflows/android-instrumentation.yml` workflow enables KVM permissions, boots an API 35 Google APIs emulator with an extended boot timeout, and runs `pnpm example:android-instrumentation`. This workflow validates that the committed HEIC, HEIF, and AVIF fixtures decode on the Android `ImageDecoder` paths and can be compressed to JPEG, PNG, and WebP. It stays separate from the lightweight CI because emulator startup and codec execution are slower and more environment-sensitive than JVM tests.

The separate `.github/workflows/ios-validation.yml` workflow runs on a macOS runner and executes `pnpm example:ios:smoke`. It validates pod install, React Native Codegen/autolinking through the iOS host app, simulator build/install/launch, JPEG/PNG/GIF/WebP/HEIC/HEIF/runtime-available AVIF input to JPEG, PNG, and capability-driven WebP runtime compression, iOS capability reporting, JPEG target-size behavior, JPEG source to JPEG output metadata preserve, WebP target-size behavior when ImageIO WebP destination encoding is available, AVIF input rejection when ImageIO AVIF source support is unavailable, and the expected iOS unsupported-option error surface. The workflow inherits the guarded CocoaPods null-byte retry behavior from `scripts/ios-validation.mjs` so one transient CocoaPods path-resolution failure does not immediately fail the validation run.

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

Run the registry-based smoke test after publishing, or dry-run it against the latest published package while iterating on release automation:

```bash
pnpm smoke:registry -- --version 0.2.11
```

This command reads npm registry metadata, downloads the published tarball, verifies required package contents and development-only file exclusions, installs the published package into a clean temporary React Native consumer project, and typechecks public API imports. It does not publish to npm.

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

Actual npm publishing requires an authenticated npm registry session and is intentionally outside the dry-run checklist. See [RELEASE.md](RELEASE.md) for the v0.2.13 iOS JPEG metadata preserve hardening candidate notes, v0.2.12 published iOS JPEG metadata preserve release notes, v0.2.11 docs-only correction notes, v0.2.10 published release notes, v0.2.9 release notes, v0.2.8 release notes, v0.2.7 release notes, v0.2.6 release notes, v0.2.5 release notes, v0.2.4 release notes, v0.2.3 release notes, v0.2.2 release notes, v0.2.1 release notes, v0.2.0 published release notes, v0.1.2 published patch notes, v0.1.1 docs-only patch notes, v0.1.0 published artifact details, tag checklist, and post-publish security review. Before publishing a new version, review the intended version and package metadata, then run the dry-run release gate from the repository root:

```bash
pnpm release:dry-run
```

That command does not publish to npm. It runs the required pre-publish checks in this order:

```bash
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
packed README stale status check
pnpm smoke:consumer
pnpm publish --dry-run --no-git-checks
```

The packed README stale status check packs the package to a temporary directory, extracts `package/README.md`, and fails if stale pre-release status snippets remain. The final `pnpm publish --dry-run --no-git-checks` step exercises the publish packaging path without uploading a package. The `--no-git-checks` flag keeps the dry run usable before the release commit or tag exists; the actual publish decision should still wait for a clean working tree, the intended version, reviewed release notes, a pushed version tag, and a successful GitHub Actions CI run on the pushed release commit. After npm publish, run `pnpm smoke:registry -- --version <published-version>` to verify the real registry tarball and clean consumer install. This registry smoke step is intentionally outside `pnpm release:dry-run` and the default CI because it requires a version that already exists on npm. Tag, npm publish, registry smoke, and post-publish security review commands are documented in `RELEASE.md` and should only be run manually after those checks pass.

### Local Commit Hook

Install the repository git hooks once per clone:

```bash
pnpm hooks:install
```

The `pre-commit` hook runs `git diff --cached --check`, `pnpm verify`, and `pnpm example:typecheck`. Commits should only be created after these checks pass. After each completed development task, keep `README.md` aligned with the current implementation status before committing.

## Contributing

The project is in its initial design phase. Issues and discussions about the proposed API, format priorities, platform behavior, metadata policy, and native implementation strategy are welcome once the repository is ready for public collaboration.

## Security

See [SECURITY.md](SECURITY.md) for supported versions, vulnerability reporting guidance, dependency triage, and package security hygiene. Published packages should not run install-time lifecycle scripts, and release verification should confirm that credentials, `.npmrc`, `.env*`, tests, fixtures, example app files, and debug keystores stay out of the npm tarball.

## License

MIT License. See [LICENSE](./LICENSE).
