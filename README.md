<h1 align="center">React Native Image Compression Kit</h1>

<p align="center">
  Compress any supported image. Return it in the format you choose.
</p>

<p align="center">
  A React Native image compression MVP with Android broad-format support, iOS JPEG metadata preserve, iOS JPEG/PNG/GIF/WebP/HEIC/HEIF input, runtime-gated iOS AVIF input and WebP output support, and TypeScript exports.
</p>

<p align="center">
  <img alt="Status: v0.2.48 release" src="https://img.shields.io/badge/Status-v0.2.48%20release-brightgreen" />
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

Version `0.2.48` is the registry provenance and manual CI gate release for `react-native-image-compression-kit`. It keeps Android/iOS runtime behavior and the public API unchanged. It extends the post-publish registry smoke with exact version/dist-tag agreement, real tarball README status, integrity/shasum, required/forbidden package contents, and clean consumer install/typecheck evidence in one stable canonical JSON report.

Version `0.2.47` is published to npm as the `latest` iOS PASS replay automation gate release for `react-native-image-compression-kit`. It keeps Android and iOS runtime behavior unchanged, keeps AVIF output disabled, and turns the committed PASS replay fixture into an explicit local and CI quality gate. `validateIOSSmokePassPayload()` now enforces the exact capability-selected field order, `platform: 'ios'`, positive safe-integer `*ResultBytes` values, boolean WebP-output/AVIF-input flags, and duplicate-free capability-consistent unsupported format arrays. `validateIOSSmokePassReplayFixture()` applies that semantic contract in addition to the existing fixture schema, provenance, source-line, and SHA-256 checks. `scripts/refresh-ios-smoke-pass-replay.mjs` retains refresh and text-mode check behavior, adds source-log-free `--audit`, and emits stable machine-readable `schemaVersion`, `mode`, `status`, `artifactPath`, `differences`, and `error` fields through `--check --json` and `--audit --json`. Check and audit paths remain read-only and network-free. `pnpm verify` and the iOS Validation workflow now run the standalone audit, while Vitest pins payload-invalid, current, stale, noncanonical, missing, malformed, schema-invalid, flag-conflict, stdout/stderr, and no-write contracts.

The committed replay artifact keeps workflow `iOS Validation`, [run 28928015548](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28928015548), head SHA `c6981c3b6b06e5e6e34f42147a94e4299a0f82b2`, and source-line SHA-256 `c20c9e72f2b9f3159d7db56c7c811a3ecb81555a9d9e90350d2e155e6f832dc6`. When it becomes stale, download or export a newer successful iOS Validation job log separately, then run the offline refresh command below. The CLI performs no GitHub or other network requests.

```bash
pnpm fixtures:ios-pass-replay -- \
  --log-file /path/to/ios-validation.log \
  --workflow-name "iOS Validation" \
  --run-id 28928015548 \
  --run-url https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28928015548 \
  --head-sha c6981c3b6b06e5e6e34f42147a94e4299a0f82b2
```

The command extracts exactly one complete PASS source line, derives its job, step, and timestamp, recalculates SHA-256 over the exact UTF-8 line without a trailing newline, and regenerates the structured JSON fields before the documented local verification gates are run.

Use the same local log and provenance to verify the committed artifact without modifying it:

```bash
pnpm fixtures:ios-pass-replay:check -- \
  --log-file /path/to/ios-validation.log \
  --workflow-name "iOS Validation" \
  --run-id 28928015548 \
  --run-url https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28928015548 \
  --head-sha c6981c3b6b06e5e6e34f42147a94e4299a0f82b2
```

Append `--json` to the check command when automation needs the stable report schema instead of human-readable text. The report fields are ordered as `schemaVersion`, `mode`, `status`, `artifactPath`, `differences`, and `error`; `status` is `current`, `stale`, or `invalid`. A current report exits `0`, while stale and invalid reports exit `1` and still write exactly one JSON object to stdout with no human prefix.

Audit the committed artifact without retaining or passing the original Actions log:

```bash
pnpm fixtures:ios-pass-replay:audit -- --json
```

Audit mode validates canonical JSON, fixture schema, provenance fields, the exact source-line SHA-256, and the capability-driven PASS payload contract owned by `scripts/ios-smoke-contract.mjs` and `scripts/ios-smoke-pass-replay-fixture.mjs`. Check additionally compares the artifact with a supplied local log and provenance. Check and audit modes perform no writes; refresh, check, and audit perform no GitHub or other network requests.

Registry verification confirmed both npm `version` and `dist-tags.latest` at `0.2.47`. The real 51-file registry tarball retained the registry-independent `Status: v0.2.47 release` package README, contained no guarded stale-status snippets or development-only files, and passed clean consumer installation and public API typechecking. No git tag or GitHub Release was created as part of this npm-only promotion.

Run `pnpm smoke:registry -- --version <published-version> --expect-tag latest --json --report-file registry-provenance.json` to reproduce registry evidence. `--json` writes exactly one canonical object to stdout, and `--report-file` atomically writes the same bytes with fixed fields from `schemaVersion` through `error`. The manual **Registry Validation** workflow runs the same gate, appends the evidence to the GitHub Step Summary, and uploads both the provenance report and captured stdout.

The Android `compressImage()` scaffold still rejects `output.format: 'avif'` with `ERR_NOT_IMPLEMENTED` before source access or helper entry, keeps `avif.output=false`, and leaves metadata preserve, target-size, and animated AVIF production semantics disabled.

Android includes a published image compression MVP for `file://` and `content://` JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF inputs, JPEG EXIF orientation correction, optional resize, metadata `preserve` / privacy-filtered `safe` / `strip` handling for JPEG source to JPEG output, and JPEG, PNG, or WebP output encoding. GIF input is decoded as a static first frame. HEIC / HEIF input is Android SDK and device-codec dependent: API 28+ uses `ImageDecoder`, API 26-27 attempts a guarded `BitmapFactory` fallback, and earlier Android versions reject HEIC / HEIF with `ERR_UNSUPPORTED_FORMAT`. AVIF input is Android 14+ only and uses `ImageDecoder`. Android `getImageCompressionCapabilities()` reports AVIF `input=true`, AVIF `output=false`, and notes that selecting `output.format: 'avif'` rejects with `ERR_NOT_IMPLEMENTED`. Android AVIF output remains disabled until the MediaCodec image/avif encode/decode-back smoke produces a complete AVIF file with ftyp avif/avis signature and ImageDecoder decode-back validation.

The current iOS JPEG/PNG/GIF/WebP/HEIC/HEIF/AVIF MVP supports `file://` and `content://` JPEG, PNG, GIF, WebP, HEIC, HEIF, or runtime-available AVIF input, optional resize, quality-based JPEG output, target-size JPEG output with `output.maxBytes`, PNG output, runtime ImageIO-backed WebP output with target-size `output.maxBytes` when `CGImageDestination` advertises WebP destination support, cache-file results, `metadata: 'preserve'` for JPEG source to JPEG output with output orientation and pixel dimension metadata normalized after rendering, and `safe` / `strip` metadata policies that re-encode without copying source metadata. GIF, WebP, HEIC, HEIF, and runtime-available AVIF input are decoded as static images through ImageIO on iOS. iOS `getImageCompressionCapabilities()` reports JPEG input/output, PNG input/output, GIF input with no GIF output, WebP input with runtime-gated WebP output, HEIC input with no HEIC output, HEIF input with no HEIF output, AVIF input only when `CGImageSourceCopyTypeIdentifiers()` advertises an AVIF source type, AVIF output always false, and notes that selecting `output.format: 'avif'` rejects with `ERR_NOT_IMPLEMENTED`; future iOS AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation.

Both platforms keep metadata='preserve', output.maxBytes, and animated AVIF preservation unsupported for AVIF output until explicitly designed and tested. The capabilities also report `metadataPolicies: ['preserve', 'safe', 'strip']`, target-size compression support for JPEG output and runtime-available WebP output, and no cancellation. The v0.2.17 Android AVIF output smoke keeps AVIF output disabled while attempting a repo-owned 16x12 Bitmap to static AVIF cache-file encode through an API 34+ `MediaCodec` `image/avif` route, validating `ftyp` `avif` / `avis` signature bytes and `ImageDecoder` decode-back dimensions when a file is produced. The v0.2.20 candidate keeps that smoke disabled-by-contract and adds production-decision fields: `blockerCode`, `outputCanBeEnabled=false`, and `productionDecision`. If the SDK is too old, the emulator has no encoder, the codec route fails, the muxer rejects the stream, the result has invalid `ftyp` `avif` / `avis` signature bytes, or `ImageDecoder` decode-back fails, instrumentation records an explicit blocker code (`sdk_unavailable`, `no_image_avif_encoder`, `codec_failure`, `invalid_signature`, or `decode_back_failure`) and capability reporting remains `output=false`. The v0.2.21 candidate adds `AndroidAvifOutputProductionScaffold` at the Android `compressImage()` output boundary, so AVIF output requests parse metadata and `output.maxBytes` but reject before source access or MediaCodec encode/decode-back helper entry while capability reporting remains `output=false`. The v0.2.22 candidate extracts the encode/decode-back implementation into `AndroidAvifOutputHelper`, adds explicit helper input/output/result types, and keeps the scaffold's `willEnterEncodeDecodeBackHelper=false` boundary before source access. The v0.2.23 candidate adds `AndroidAvifOutputHelperDependencies` so tests can inject encoder, muxer, output-file, and validation behavior for fake encoded bytes, invalid signatures, decode-back failures, and codec failures while `compressImage()` and capability reporting still keep AVIF output disabled. The v0.2.24 candidate adds an injected muxed success contract that fixes helper success expectations for `byteSize`, `signatureValid`, `decodeBackValid`, `blockerCode=null`, and `PRODUCTION_DECISION_SMOKE_PASSED_KEEP_DISABLED` while production capability reporting remains `avif.output=false`. The v0.2.25 candidate adds a direct-output success contract that fixes the direct encoder output route, output path, byte size, `blockerCode=null`, production decision, and muxer-skip expectation when direct fake AVIF bytes pass decode-back validation. The v0.2.26 candidate fixes helper `details` ordering across direct, muxed, invalid signature, decode-back failure, and codec failure paths so the injectable validation seam, dependency details, and route blockers remain stable for production-wiring diagnostics. The v0.2.27 candidate fixes blocked-route details for `sdk_unavailable` and `no_image_avif_encoder` paths and proves the smoke adapter preserves blocked helper `blockerCode`, `details`, and `outputCanBeEnabled=false`. The v0.2.28 candidate fixes helper temp-file lifecycle expectations for direct, muxed, invalid-signature, and decode-back validation paths so returned `outputFilePath`/`byteSize` always describe the chosen final validation file while intermediate direct files are not reported as muxed/failure results. The v0.2.29 candidate fixes helper validation-result provenance expectations so direct and muxed validation details each carry file name, byte size, signature result, decode-back result, and exact encoder -> direct validation -> muxer -> final validation ordering after direct failure. The v0.2.30 candidate hardens iOS smoke retry and timeout diagnostics around `RNICK_IOS_SMOKE_PASS` so CI logs explain simulator/app/log state before a timeout-only retry or final failure. The v0.2.31 candidate fixes those iOS smoke retry and diagnostic contracts in simulator-free Node-level tests before further CI hardening. The v0.2.32 candidate fixes the CLI timeout assembly and retry warning order with fake launch/log stream/Metro/unified-log fixtures. The v0.2.33 candidate fixes iOS smoke process lifecycle cleanup with fake EventEmitter Metro/log stream fixtures. The v0.2.34 candidate fixes iOS smoke log stream error output, snapshot state, and timeout diagnostics fixture coverage. The v0.2.35 candidate fixes iOS smoke diagnostics packed log artifact and GitHub Step Summary fixture coverage. The v0.2.36 candidate fixes iOS smoke artifact failure-path dry-run fixture coverage. The v0.2.37 candidate fixes iOS smoke diagnostics artifact schema snapshot coverage. The v0.2.38 candidate fixes iOS smoke PASS payload schema snapshot coverage. The v0.2.39 candidate fixes iOS WebP-output available PASS payload schema snapshot coverage. The v0.2.40 release fixes iOS AVIF-input unavailable PASS payload schema snapshot coverage. The v0.2.41 candidate fixes iOS PASS payload schema matrix helper coverage. The v0.2.42 candidate fixes iOS PASS payload CI log replay fixture coverage. The v0.2.43 candidate fixes replay fixture source provenance and refresh guidance. The still-open production gates are production wiring, byte-signature validation, ImageDecoder decode-back validation, explicit metadata preserve behavior, `output.maxBytes` semantics, and animated AVIF boundaries.

The v0.2.44 candidate fixes replay fixture source-line SHA-256 integrity and missing/duplicate PASS-line rejection.

The v0.2.45 candidate fixes structured replay artifact ownership and deterministic offline refresh coverage.

The v0.2.46 candidate fixes read-only offline replay artifact freshness checking and concise drift reporting.

The v0.2.47 release fixes semantic PASS payload validation, standalone replay artifact auditing, stable JSON reports, and local/CI audit gating.

The v0.2.48 release adds a canonical registry provenance report, exact version/dist-tag validation, shared README status validation, offline failure fixtures, atomic report writes, and a manual Registry Validation workflow.

The GitHub Actions iOS Validation runner currently uses Xcode 26.5 and the iPhoneSimulator26.5 SDK, and reports WebP `output=false` because ImageIO does not advertise a WebP destination type there; AVIF input is capability-gated the same way and rejects with `ERR_UNSUPPORTED_FORMAT` when ImageIO does not advertise AVIF source support. GIF output, GIF animation preservation, animated WebP preservation, animated AVIF preservation, HEIC / HEIF output, AVIF output, and metadata preservation outside JPEG source to JPEG output are not implemented yet.

## Current Implementation Scope

The current implementation is intentionally small:

- Runtime compression is implemented on Android and on the current iOS JPEG/PNG/GIF/WebP/HEIC/HEIF/runtime-available AVIF MVP surface.
- Android supports `file://` and `content://` local URI input. iOS supports `file://` and best-effort `content://` local URI input through Foundation URL loading.
- JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input. GIF input is static first-frame only, Android HEIC / HEIF input depends on Android SDK and device codec support, iOS HEIC / HEIF input uses static ImageIO decode, Android AVIF input requires Android 14+ baseline image support, and iOS AVIF input requires runtime ImageIO AVIF source support.
- iOS input is currently JPEG, PNG, static ImageIO GIF, static ImageIO WebP, static ImageIO HEIC, static ImageIO HEIF, and runtime-available static ImageIO AVIF.
- Android output is JPEG, PNG, and WebP. iOS output is JPEG, PNG, and WebP only when ImageIO advertises a WebP destination type at runtime. HEIC, HEIF, and AVIF output reject with `ERR_NOT_IMPLEMENTED` on both platforms.
- Quality-based compression for JPEG, Android WebP output, and runtime-available iOS WebP output. PNG output ignores `quality`.
- Target-size compression with `maxBytes` for Android JPEG and WebP output, iOS JPEG output, and runtime-available iOS WebP output. Android and iOS PNG output reject `maxBytes`.
- JPEG EXIF orientation correction before resize and selected output encoding.
- Optional resize with `maxWidth`, `maxHeight`, and `contain`, `cover`, or `stretch` mode.
- Android supports metadata `preserve`, privacy-filtered `safe`, and `strip` policies for JPEG source to JPEG output. PNG/WebP/GIF/HEIC/HEIF/AVIF sources and PNG/WebP output do not preserve source EXIF metadata. iOS supports `preserve` only for JPEG source to JPEG output; `safe` and `strip` re-encode without copying source metadata, and non-JPEG preserve requests reject with `ERR_NOT_IMPLEMENTED`.
- Output file written to the platform app cache directory.
- `CompressionResult` returns `uri`, `format`, final `width`, final `height`, `byteSize`, `originalByteSize`, and `compressionRatio`.

The following remain planned and are not implemented in the MVP:

- AVIF output; selecting `output.format: 'avif'` currently rejects with `ERR_NOT_IMPLEMENTED`.
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

Current Android MVP support is narrower than the planned table: JPEG, PNG, WebP, static first-frame GIF, SDK-gated HEIC, SDK-gated HEIF, and Android 14+ AVIF input are implemented, and JPEG, PNG, and WebP output are implemented. Current iOS MVP support is narrower again: JPEG, PNG, static ImageIO GIF, static ImageIO WebP, static ImageIO HEIC, static ImageIO HEIF, and runtime-available static ImageIO AVIF input are implemented, JPEG output is implemented with quality, resize, and target-size compression, PNG output is implemented without target-size compression, and WebP output is implemented with quality and target-size compression through ImageIO when the runtime advertises a WebP destination type. GIF output, GIF animation preservation, animated WebP preservation, animated AVIF preservation, HEIC / HEIF output, and AVIF output remain planned; HEIC, HEIF, and AVIF output selections reject with `ERR_NOT_IMPLEMENTED`. HEIC / HEIF inputs on Android versions below 8.0, AVIF inputs on Android versions below 14, and AVIF inputs on iOS runtimes without ImageIO AVIF source support reject as `ERR_UNSUPPORTED_FORMAT`. Corrupt supported-format inputs, including corrupt GIF, HEIC / HEIF, and AVIF candidates on supported SDKs or runtimes, reject as `ERR_DECODE_FAILED`.

Animation preservation for GIF, animated WebP, and animated AVIF is not planned as an initial-version guarantee.

## iOS MVP Behavior

Version `0.2.0` replaces the previous iOS package stub with a native JPEG MVP. Version `0.2.1` extends that iOS JPEG MVP with target-size compression. Version `0.2.2` adds PNG output. Version `0.2.3` adds GIF input decoded as a static first frame. Version `0.2.4` adds WebP input decoded as a static first frame. Version `0.2.5` adds a runtime-gated ImageIO-backed WebP output path. Version `0.2.6` adds target-size `output.maxBytes` support to that runtime-available WebP output path. Version `0.2.7` adds HEIC/HEIF input decoded as static ImageIO images. Version `0.2.10` adds capability-gated AVIF input decoded as a static ImageIO image when the runtime advertises AVIF source support. Version `0.2.12` adds iOS JPEG metadata preserve for JPEG source to JPEG output. Version `0.2.13` normalizes preserved iOS JPEG orientation and dimension metadata after rendering. Version `0.2.14` keeps AVIF output unsupported while making capability notes and `ERR_NOT_IMPLEMENTED` messaging explicit:

- `compressImage()` accepts `file://` and best-effort `content://` JPEG, PNG, GIF, WebP, HEIC, HEIF, or runtime-available AVIF source URIs.
- JPEG output is encoded with ImageIO `CGImageDestination` into the iOS app cache directory.
- PNG output is encoded with `UIImagePNGRepresentation()` into the iOS app cache directory.
- WebP output is encoded with ImageIO `CGImageDestination` into the iOS app cache directory when `CGImageDestinationCopyTypeIdentifiers()` advertises a WebP destination type.
- On the current GitHub Actions iOS Validation runner with Xcode 26.5 and the iPhoneSimulator26.5 SDK, ImageIO does not advertise a WebP destination type. In that environment WebP reports `input=true` and `output=false`, and `output.format: 'webp'` rejects with `ERR_NOT_IMPLEMENTED`.
- GIF, WebP, HEIC, HEIF, and runtime-available AVIF input are decoded through ImageIO as static images before resize and output encoding; animation preservation is not implemented for animated formats.
- `resize.maxWidth`, `resize.maxHeight`, and `contain`, `cover`, or `stretch` mode are supported before output encoding.
- `output.quality` controls JPEG quality and runtime-available WebP quality from `0` to `100`; when omitted, iOS uses the same default quality of `80`.
- PNG output ignores `quality`.
- `output.maxBytes` is supported for JPEG output and runtime-available WebP output. iOS treats `quality` as the upper quality bound and searches for the highest JPEG or WebP quality that fits under `maxBytes`; if even the lowest quality cannot fit, it returns the smallest generated output. PNG output rejects `maxBytes` with `ERR_NOT_IMPLEMENTED`.
- PNG output preserves alpha where the processed image contains transparency. Runtime-available WebP output uses the processed image alpha as provided by ImageIO. JPEG output still composites alpha over white.
- `metadata: 'preserve'` copies source JPEG metadata only for JPEG source to JPEG output, including resize, quality, and `output.maxBytes` paths. Preserved JPEG output normalizes top-level orientation, TIFF orientation, top-level pixel width/height, and EXIF `PixelXDimension` / `PixelYDimension` to the rendered output. `metadata: 'safe'` and `metadata: 'strip'` re-encode without copying source metadata. Non-JPEG input or non-JPEG output with `preserve` rejects with `ERR_NOT_IMPLEMENTED`.
- AVIF input is enabled only when `CGImageSourceCopyTypeIdentifiers()` advertises an AVIF source type. On runtimes without that support, AVIF input rejects with `ERR_UNSUPPORTED_FORMAT`.
- AVIF output is not implemented. `output.format: 'avif'` rejects with `ERR_NOT_IMPLEMENTED` even on runtimes that can decode AVIF input.
- `getImageCompressionCapabilities()` resolves with `platform: 'ios'`, JPEG `input=true` and `output=true`, PNG `input=true` and `output=true`, GIF `input=true` and `output=false`, WebP `input=true` and WebP `output=true` when the runtime advertises ImageIO WebP destination support, HEIC `input=true` and `output=false`, HEIF `input=true` and `output=false`, AVIF `input=true` only when the runtime advertises ImageIO AVIF source support, AVIF `output=false`, AVIF notes that say `output.format: 'avif'` rejects with `ERR_NOT_IMPLEMENTED`, `metadataPolicies: ['preserve', 'safe', 'strip']`, `supportsTargetSizeCompression: true` for JPEG and runtime-available WebP output, and `supportsCancellation: false`.
- If the TypeScript API throws `ERR_NATIVE_MODULE_UNAVAILABLE`, the native module was not found by React Native. Rebuild the app after installing or linking the package; this is separate from platform capability errors returned by the native implementation.

Version `0.2.15` does not change iOS runtime behavior. It records that future AVIF output on iOS must be runtime-gated the same way as WebP output: call `CGImageDestinationCopyTypeIdentifiers()`, advertise AVIF `output=true` only when ImageIO returns an AVIF destination type, and otherwise keep `output.format: 'avif'` on the current `ERR_NOT_IMPLEMENTED` path.

Version `0.2.16` also does not change iOS runtime behavior. It narrows the next Android AVIF output question to an internal API 34+ encoder route prototype while keeping iOS AVIF output on the runtime-gated ImageIO destination plan above. Version `0.2.17` again does not change iOS runtime behavior; it only exercises the Android AVIF output smoke attempt and keeps iOS AVIF output on the same future ImageIO destination plan. Version `0.2.19` keeps iOS AVIF output disabled while making the future gate explicit: Future iOS AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation.

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

Runtime capabilities currently expose AVIF with `input=true` and `output=false`, plus notes that describe the Android 14+ `ImageDecoder` route, static image support, no EXIF metadata copy, unsupported animation preservation, `output.format: 'avif'` rejecting with `ERR_NOT_IMPLEMENTED`, and the production gate that keeps Android AVIF output disabled until the MediaCodec image/avif encode/decode-back smoke produces a complete AVIF file with ftyp avif/avis signature and ImageDecoder decode-back validation. The main CI validates the API-gated unsupported boundary, corrupt-candidate decode failure behavior, and AVIF output unsupported messaging, and the separate Android Instrumentation workflow validates committed AVIF sample decoding on an API 35 emulator.

## AVIF Output Feasibility Spike

Version `0.2.15` is a documentation and verification candidate only; it does not enable AVIF output. The spike records these implementation constraints:

- Android platform docs list AVIF baseline image encoder and decoder support on Android 14+, but the current Android implementation encodes through `Bitmap.compress()` and `Bitmap.CompressFormat` exposes JPEG, PNG, WebP, WebP lossless, and WebP lossy with no AVIF enum. Android `ExifInterface` also lists AVIF under readable formats while writable metadata formats remain JPEG, PNG, and WebP. The minimum Android AVIF output implementation therefore needs a separate encoder route, API 34+ device validation, byte-signature and decode-back tests, and explicit metadata and target-size behavior before AVIF can report `output=true`.
- iOS ImageIO destination support is not a compile-time guarantee in this codebase. Future iOS AVIF output must mirror the WebP output path: query `CGImageDestinationCopyTypeIdentifiers()` for AVIF identifiers at runtime, report AVIF `output=true` only when a destination type is present, encode with `CGImageDestination`, and keep `ERR_NOT_IMPLEMENTED` otherwise.
- Current v0.2.15 capability reporting remains unchanged: Android AVIF `input=true` on Android 14+ and `output=false`; iOS AVIF input is runtime source-gated and AVIF output remains `false`.
- Partial implementation criteria: static image output only, no animation preservation, metadata preserve rejected unless explicitly designed, target-size disabled until AVIF quality semantics are validated, and release requires Android instrumentation plus iOS host-app smoke validation.

## Android AVIF Output Prototype

Version `0.2.16` adds an internal Android AVIF output encoder route prototype without enabling AVIF output. The candidate route is a `MediaCodec image/avif encoder probe`: on Android 14+ it builds an `image/avif` `MediaFormat` with `COLOR_FormatYUV420Flexible` input and asks `MediaCodecList.findEncoderForFormat()` whether a still-image AVIF encoder is available. It also records whether a `video/av01` AV1 encoder exists as fallback evidence, but that fallback is not enough by itself because AVIF output still needs a valid still-image file/container write path.

The prototype is intentionally not wired into `compressImage()` and does not change capability reporting. Android `getImageCompressionCapabilities().formats.avif.output=false` remains the production contract, and selecting `output.format: 'avif'` still rejects with `ERR_NOT_IMPLEMENTED`.

The production gate remains closed until the Android path can:

- Feed processed `Bitmap` pixels into the encoder as YUV420 input.
- Write a complete static `.avif` file from encoder output.
- Assert the result has an `ftyp` box with `avif` or `avis` compatible brand.
- Decode the result with `ImageDecoder` and assert dimensions match the processed bitmap.
- Keep animated AVIF preservation unsupported unless it is explicitly designed.
- Reject or implement `metadata: 'preserve'` for AVIF output with documented metadata behavior.
- Reject or implement `output.maxBytes` for AVIF output with tested quality and size-search semantics.

The v0.2.16 Android instrumentation check runs on an API 35 emulator and verifies the prototype route report and production gate. The v0.2.17 instrumentation check keeps that probe and adds the encode/decode-back smoke below; AVIF output still cannot report `output=true` unless the smoke produces a valid static AVIF file and the remaining production semantics are implemented.

## Android AVIF Output Encode/Decode-Back Smoke

Version `0.2.17` adds an internal Android AVIF output encode/decode-back smoke attempt without enabling AVIF output. The smoke is intentionally not wired into `compressImage()` or output capability reporting.

The internal route is named `MediaCodec image/avif encode/decode-back smoke` so instrumentation logs, release notes, and source checks refer to the same experiment.

On Android 14+ it creates a repo-owned 16x12 ARGB bitmap pattern in instrumentation, probes an `image/avif` encoder with `MediaCodecList.findEncoderForFormat()`, queues YUV420 input through `MediaCodec`, and collects the encoder output. It first validates the direct encoder bytes as a possible AVIF file, then tries to mux the encoded samples with `MediaMuxer.MUXER_OUTPUT_HEIF` and validates the muxed file.

The smoke success criteria are strict: the output must have an `ftyp` box with `avif` or `avis` compatible brand, and `ImageDecoder` must decode it back to 16x12 pixels. Missing encoders, codec failures, muxer/container failures, invalid signatures, or decode-back failures are reported as blockers instead of enabling a partial AVIF output surface.

Current GitHub Android Instrumentation result: the API 35 Google APIs emulator does not expose an `image/avif` encoder through `MediaCodecList.findEncoderForFormat()`. The smoke therefore reports `attempted=false`, `success=false`, `blockerCode=no_image_avif_encoder`, and blocker `No image/avif encoder was discovered through MediaCodecList.findEncoderForFormat().` AVIF output remains disabled.

Android `getImageCompressionCapabilities().formats.avif.output=false` remains the production contract, and selecting `output.format: 'avif'` still rejects with `ERR_NOT_IMPLEMENTED`. `metadata: 'preserve'`, `output.maxBytes`, animated AVIF preservation, and production AVIF output wiring remain non-goals until a later enabling goal explicitly implements them.

Version `0.2.19` keeps AVIF output disabled while making the production gate explicit across Android and iOS capability notes, unsupported-output errors, README guidance, and verification expectations. Android AVIF output remains disabled until the MediaCodec image/avif encode/decode-back smoke produces a complete AVIF file with ftyp avif/avis signature and ImageDecoder decode-back validation. iOS AVIF output remains disabled until ImageIO advertises AVIF destination support and static output validation exists. metadata='preserve', output.maxBytes, and animated AVIF preservation remain unsupported for AVIF output until explicitly designed and tested.

Version `0.2.20` keeps AVIF output disabled and turns the Android smoke into a production-decision preflight. Smoke results now carry `blockerCode`, `outputCanBeEnabled=false`, and `productionDecision`, distinguishing `sdk_unavailable`, `no_image_avif_encoder`, `codec_failure`, `invalid_signature`, and `decode_back_failure` so the next implementation step can decide whether a runtime can safely remain disabled or move toward production wiring.

Version `0.2.21` keeps AVIF output disabled and adds an Android production wiring scaffold at the `compressImage()` output boundary. The scaffold reuses the encode/decode-back helper route as the future production helper, but `willEnterEncodeDecodeBackHelper=false` while `avif.output=false`; AVIF requests continue to reject with `ERR_NOT_IMPLEMENTED` before source access, helper entry, metadata preserve, `output.maxBytes`, or animated AVIF preservation can be treated as implemented.

Version `0.2.22` keeps AVIF output disabled and extracts the Android AVIF encode/decode-back implementation into `AndroidAvifOutputHelper`. The helper owns reusable input, encoded output, sample, file-validation, and result types for future production wiring, while `compressImage()` still rejects `output.format: 'avif'` through the scaffold before source access or helper entry and capability reporting remains `avif.output=false`.

Version `0.2.23` keeps AVIF output disabled and adds an injectable validation seam to `AndroidAvifOutputHelper`. `AndroidAvifOutputHelperDependencies` wraps the default bitmap, encoder, output-file, muxer, and decode-back validator path, while Android JVM tests inject fake encoded bytes, invalid signature results, decode-back failures, and codec failures to prove helper result classification without wiring AVIF output into `compressImage()`.

Version `0.2.24` keeps AVIF output disabled and fixes the injected success contract for `AndroidAvifOutputHelper`. Android JVM tests now inject fake valid AVIF bytes, a muxed output file, and a successful decode-back result so helper success reports `byteSize`, `signatureValid=true`, `decodeBackValid=true`, `blockerCode=null`, and `PRODUCTION_DECISION_SMOKE_PASSED_KEEP_DISABLED` while `compressImage()` and capability reporting still keep AVIF output disabled.

Version `0.2.25` keeps AVIF output disabled and fixes the injected direct-output success contract for `AndroidAvifOutputHelper`. Android JVM tests now inject fake valid direct AVIF bytes plus successful decode-back validation so helper success reports the `MediaCodec image/avif encode/decode-back smoke direct encoder output` route, a direct `.avif` output path, `byteSize`, `blockerCode=null`, and `PRODUCTION_DECISION_SMOKE_PASSED_KEEP_DISABLED`, and proves `muxEncodedSamples` is not called after direct validation success.

Version `0.2.26` keeps AVIF output disabled and fixes the helper validation detail contract for `AndroidAvifOutputHelper`. Android JVM tests now pin direct success, muxed success, invalid signature, decode-back failure, and codec failure `details` ordering so validation results report `INJECTABLE_VALIDATION_SEAM` first, dependency-provided encoder/direct/muxer/validator details next, and route blockers last, while codec failure reports route blockers before the seam and helper-disabled message.

Version `0.2.27` keeps AVIF output disabled and fixes the blocked-route detail contract for `AndroidAvifOutputHelper` and `AndroidAvifOutputPrototype.runEncodeDecodeBackSmoke()`. Android JVM tests now pin below-API-34 and no-image/avif-encoder blocked helper details to route blockers, `INJECTABLE_VALIDATION_SEAM`, and `HELPER_DISABLED_FROM_COMPRESS_IMAGE`, and verify the smoke adapter preserves `blockerCode`, `details`, and `outputCanBeEnabled=false`.

Version `0.2.28` keeps AVIF output disabled and fixes the temp-file lifecycle contract for `AndroidAvifOutputHelper`. Android JVM tests now pin direct success to direct-file-only creation, muxer skip, and direct `outputFilePath`/`byteSize`; pin direct-failure plus muxed-success to the muxed result path while keeping the direct intermediate unreported; and pin invalid-signature/decode-back failures to the final muxed blocker path and final-file `byteSize`.

Version `0.2.29` keeps AVIF output disabled and fixes the validation-result provenance contract for `AndroidAvifOutputHelper`. Android JVM tests now pin direct validation details to the direct file name, byte size, signature result, and decode-back result; pin muxed validation details to the muxed file name, byte size, signature result, and decode-back result; and pin direct failure followed by muxed success or failure to encoder -> direct validation -> muxer -> final validation detail order.

Version `0.2.30` keeps AVIF output disabled and hardens iOS host-app smoke retry and timeout diagnostics. The iOS smoke runner now supports `RNICK_IOS_SMOKE_ATTEMPTS`, starts the unified log stream before launching the app, retries timeout-only smoke attempts with a fresh launch, and prints simulator state, app container paths, app process lookup, launch output, captured `RNICK_IOS_SMOKE_*` stream tail, Metro output tail, and recent unified logs from `RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW`.

Version `0.2.31` keeps AVIF output disabled and fixes the iOS smoke retry and diagnostic contract in simulator-free Node-level tests. `scripts/ios-smoke-contract.mjs` now owns environment parsing, timeout-only retry decisions, retry warnings, and timeout diagnostic formatting; `test/iosSmokeContract.test.mjs` covers those helpers without launching Xcode, Metro, or a simulator.

Version `0.2.32` keeps AVIF output disabled and fixes CLI-level iOS smoke timeout fixture coverage. `createSmokeTimeoutErrorFromCLIState()` now owns the `runSmokeAttempt` timeout diagnostic input assembly, `formatSmokeRetryWarningMessages()` owns diagnostics-before-retry warning order, and `test/iosSmokeCliTimeout.test.mjs` covers fake launch, log stream, Metro, unified log, app lookup, and process lookup output without launching Xcode, Metro, or a simulator.

Version `0.2.33` keeps AVIF output disabled and fixes iOS smoke process lifecycle fixture coverage. `createSmokeAttemptLifecycle()` now owns Metro/log stream listener cleanup, log process termination, and `setLogProcess(null)` after PASS, FAIL, or timeout settle, while `test/iosSmokeLifecycle.test.mjs` covers those paths with fake EventEmitter fixtures without launching Xcode, Metro, or a simulator.

Version `0.2.34` keeps AVIF output disabled and fixes iOS smoke log stream error fixture coverage. `createSmokeAttemptLifecycle()` now records log process `error` events as `iOS smoke log stream error:` output and smoke-log snapshot state, while `test/iosSmokeLifecycle.test.mjs` proves that state is available to timeout diagnostics without launching Xcode, Metro, or a simulator.

Version `0.2.35` keeps AVIF output disabled and fixes iOS smoke diagnostics packed log artifact coverage. The iOS Validation workflow now writes failed smoke output to `ios-smoke-diagnostics/ios-smoke.log`, generates `ios-smoke-diagnostics/ios-smoke-summary.md`, appends the same ordered marker excerpt to the GitHub Step Summary, and uploads the packed diagnostics artifact without changing the simulator smoke behavior.

Version `0.2.36` keeps AVIF output disabled and fixes iOS smoke artifact failure-path dry-run fixture coverage. `test/iosSmokeSummaryCli.test.mjs` runs `node scripts/ios-validation.mjs summarize-smoke-log` against a fake `ios-smoke.log`, verifies stdout matches `$GITHUB_STEP_SUMMARY`, and pins the failure-only `if: failure()` summary/upload artifact path without forcing a real simulator failure.

Version `0.2.37` keeps AVIF output disabled and fixes iOS smoke diagnostics artifact schema snapshot coverage. `test/iosSmokeContract.test.mjs` now pins the exact `formatIOSSmokeDiagnosticsSummary()` markdown shape for normal, empty, no-marker, and very-long-log fixtures, including fallback text and marker/tail window bounds.

Version `0.2.38` keeps AVIF output disabled and fixes iOS smoke PASS payload schema snapshot coverage. `test/iosSmokeContract.test.mjs` now parses a prefixed `RNICK_IOS_SMOKE_PASS` JSON log fixture, pins the required payload key order and type schema, and covers missing or malformed PASS payload logs without forcing a real simulator run. Version `0.2.39` keeps runtime behavior unchanged and fixes WebP-output available PASS payload schema snapshot coverage, including conditional WebP result byte fields, `webpTargetSizeResultBytes`, and `unsupportedOutputs` excluding `webp`. Version `0.2.40` keeps runtime behavior unchanged and fixes AVIF-input unavailable PASS payload schema snapshot coverage, including conditional omission of `avifResultBytes`, `avifToPngResultBytes`, and `avifToWebPResultBytes` plus `unsupportedInputs` including `avif`. Version `0.2.41` keeps runtime behavior unchanged and fixes iOS PASS payload schema matrix helper coverage, deriving all four WebP output x AVIF input required-field schemas from `IOS_SMOKE_PASS_PAYLOAD_SCHEMA_MATRIX` and shared fixture factory tests. Version `0.2.42` keeps runtime behavior unchanged and fixes iOS PASS payload CI log replay fixture coverage, parsing a successful GitHub Actions iOS Validation `RNICK_IOS_SMOKE_PASS` line with the real job/step/timestamp and unified-log prefixes. Version `0.2.43` keeps runtime behavior unchanged and pins that replay fixture's workflow, run, head SHA, job, step, timestamp, source URL, and refresh procedure.

Version `0.2.44` keeps runtime behavior unchanged and pins the exact GitHub Actions PASS source-line SHA-256, including missing and duplicate source-line rejection, without network access in tests. Version `0.2.45` keeps runtime behavior unchanged and moves provenance/sourceLine into a canonical JSON artifact with deterministic offline refresh CLI coverage. Version `0.2.46` keeps runtime behavior unchanged and adds a read-only offline check for artifact schema, provenance, digest, source-line, and canonical-format drift. Version `0.2.47` keeps runtime behavior unchanged and adds semantic PASS payload validation, standalone artifact audit, stable current/stale/invalid JSON reports, and local/CI quality gates.

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

A separate Android Instrumentation workflow enables KVM permissions, boots an API 35 Google APIs emulator with an extended boot timeout, and runs `pnpm example:android-instrumentation`. That task executes `:react-native-image-compression-kit:connectedDebugAndroidTest`, validates the committed `sample.heic`, `sample.heif`, and `sample.avif` fixtures through their `ImageDecoder` routes, asserts JPEG, PNG, and WebP output success with 16x12 result dimensions and byte-signature checks, and runs the Android AVIF output encode/decode-back smoke while keeping AVIF output capability reporting false.

Manual codec validation beyond CI should use a codec-backed Android device or emulator on API 28+ first, because that also exercises the `ImageDecoder` route through the example app. After installing the example app, copy a fixture into the app-private files directory and paste the resulting file URI into the example screen:

```bash
pnpm example:android
adb shell run-as com.imagecompressionkit.example mkdir -p files/rnick-codec
adb shell run-as com.imagecompressionkit.example sh -c 'cat > files/rnick-codec/sample.heic' < android/src/test/assets/heic-heif/sample.heic
```

Then use `file:///data/data/com.imagecompressionkit.example/files/rnick-codec/sample.heic` as the source URI and verify JPEG, PNG, and WebP outputs. Repeat with `sample.heif`. API 26-27 should still be checked separately for the guarded `BitmapFactory` fallback because emulator/device codec availability can differ from API 28+.

For AVIF manual validation, use an API 34+ device or emulator and repeat the copy/paste flow with `android/src/test/assets/avif/sample.avif`.

## Public API

The API below is available from the package. Runtime compression succeeds on the Android MVP for JPEG, PNG, WebP, GIF, HEIC, HEIF, and Android 14+ AVIF input to JPEG, PNG, or WebP output. On iOS, runtime compression succeeds for JPEG, PNG, static ImageIO GIF, static ImageIO WebP, static ImageIO HEIC, static ImageIO HEIF, or runtime-available static ImageIO AVIF input to JPEG, PNG, or runtime-gated ImageIO-backed WebP output, including JPEG `output.maxBytes` and runtime-available WebP `output.maxBytes`. Call `getImageCompressionCapabilities()` to guard platform-specific format, metadata, AVIF source support, output support, and target-size support before compression; HEIC, HEIF, and AVIF output currently reject with `ERR_NOT_IMPLEMENTED`.

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
- [x] AVIF output feasibility spike.
- [x] Android AVIF output encoder route prototype.
- [x] Android AVIF output encode/decode-back smoke attempt.
- [ ] AVIF output.
- [ ] Metadata support for non-JPEG formats and broader iOS metadata preservation.
- [ ] Cancellation and progress.
- [x] Public npm release.

## Installation

Version `0.2.48` defines the registry provenance and manual CI gate release. Repository, issue tracker, homepage, MIT license, React Native peer dependency, CommonJS entrypoint, TypeScript declarations, React Native Codegen source, Android main sources, and iOS native source remain included in the publish tarball.

The `0.2.47` package is published as the npm `latest` iOS PASS replay automation gate release for `react-native-image-compression-kit`.

Version `0.1.0` introduced the Android MVP, version `0.1.1` is the published docs-only patch for README/npm package page status, version `0.1.2` is the published iOS-stub clarity patch for native-unavailable messaging, README guidance, and iOS capability reporting, version `0.2.0` is the published iOS native JPEG MVP release, version `0.2.1` is the published iOS JPEG target-size release, version `0.2.2` is the published iOS PNG output release, version `0.2.3` is the published iOS GIF static first-frame input release, version `0.2.4` is the published iOS WebP static first-frame input release, version `0.2.5` is the published iOS runtime-gated WebP output release, version `0.2.6` is the published iOS runtime-gated WebP target-size release, version `0.2.7` is the published iOS HEIC/HEIF static input release, version `0.2.8` is the published post-publish registry smoke automation release, version `0.2.9` is the published docs-only npm package page README correction release, version `0.2.10` is the published iOS AVIF input capability-gated static decode release, version `0.2.11` is the published docs-only npm README correction release, version `0.2.12` is the published iOS JPEG metadata preserve release, version `0.2.13` is the published iOS JPEG metadata preserve hardening release, version `0.2.14` is the published AVIF output capability/error surface release, version `0.2.15` is the unpublished AVIF output feasibility candidate, version `0.2.16` is the unpublished Android AVIF output encoder route prototype candidate, version `0.2.17` is the published Android AVIF output encode/decode-back smoke release, version `0.2.18` is the published docs-only npm package-page README correction release, version `0.2.19` is the published AVIF output production gate release, version `0.2.20` is the unpublished AVIF output production wiring preflight candidate, version `0.2.21` is the unpublished Android AVIF output production wiring scaffold candidate, version `0.2.22` is the unpublished Android AVIF output production helper extraction candidate, version `0.2.23` is the unpublished Android AVIF output helper injectable validation seam candidate, version `0.2.24` is the unpublished Android AVIF output helper injected success contract candidate, version `0.2.25` is the unpublished Android AVIF output helper direct-output success contract candidate, version `0.2.26` is the unpublished Android AVIF output helper validation detail contract candidate, version `0.2.27` is the unpublished Android AVIF output helper blocked-route detail contract candidate, version `0.2.28` is the unpublished Android AVIF output helper temp-file lifecycle contract candidate, version `0.2.29` is the unpublished Android AVIF output helper validation-result provenance contract candidate, version `0.2.30` is the unpublished iOS smoke retry and diagnostic hardening candidate, version `0.2.31` is the unpublished iOS smoke diagnostic testability hardening candidate, version `0.2.32` is the unpublished iOS smoke timeout CLI fixture coverage candidate, version `0.2.33` is the unpublished iOS smoke process lifecycle fixture coverage candidate, version `0.2.34` is the unpublished iOS smoke log stream error fixture coverage candidate, version `0.2.35` is the unpublished iOS smoke diagnostics packed log artifact coverage candidate, version `0.2.36` is the unpublished iOS smoke artifact failure-path dry-run fixture candidate, version `0.2.37` is the unpublished iOS smoke diagnostics artifact schema snapshot candidate, version `0.2.38` is the published iOS smoke PASS payload schema snapshot release, version `0.2.39` is the unpublished iOS WebP-output available PASS payload schema snapshot candidate, version `0.2.40` is the published iOS AVIF-input unavailable PASS payload schema snapshot release, version `0.2.41` is the unpublished iOS PASS payload schema matrix helper candidate, and version `0.2.42` is the unpublished iOS PASS payload CI log replay fixture candidate. Development scripts, Android JVM tests, instrumentation tests, and codec fixtures are intentionally excluded from the publish tarball.

Version `0.2.43` is the unpublished iOS PASS payload replay fixture provenance candidate. Version `0.2.44` is the unpublished iOS PASS replay fixture source-line integrity digest candidate. Version `0.2.45` is the unpublished iOS PASS replay fixture offline refresh artifact candidate. Version `0.2.46` is the unpublished iOS PASS replay fixture offline check mode candidate. Version `0.2.47` is the iOS PASS replay automation gate release. Version `0.2.48` is the registry provenance and manual CI gate release.

The repository contains an initial TypeScript API scaffold, an Android image MVP with JPEG/PNG/WebP/GIF/HEIC/HEIF/AVIF input, GIF static first-frame decoding, HEIC/HEIF SDK-gated input decoding, Android 14+ AVIF input decoding, JPEG EXIF orientation correction, optional resize, JPEG/PNG/WebP output encoding, JPEG/WebP target-size compression, and metadata `preserve` / privacy-filtered `safe` / `strip` handling for JPEG source to JPEG output.

Version `0.2.0` adds an iOS native MVP with JPEG/PNG input, optional resize, quality-based JPEG output, `safe` / `strip` metadata behavior, and iOS capability reporting. Version `0.2.1` adds iOS JPEG target-size compression. Version `0.2.2` adds iOS PNG output. Version `0.2.3` adds iOS GIF input decoded as a static first frame. Version `0.2.4` adds iOS WebP input decoded as a static first frame. Version `0.2.5` adds a runtime-gated iOS WebP output path through ImageIO destination encoding. Version `0.2.6` adds target-size `output.maxBytes` support to that runtime-available WebP output path. Version `0.2.7` adds iOS HEIC/HEIF input decoded as static ImageIO images. Version `0.2.8` adds post-publish registry smoke automation without runtime behavior changes. Version `0.2.9` corrects the packaged npm README without runtime behavior changes. Version `0.2.10` adds iOS AVIF input decoded as a runtime-available static ImageIO image. Version `0.2.11` corrects the packaged npm README without runtime behavior changes. Version `0.2.12` adds iOS JPEG metadata preserve for JPEG source to JPEG output. Version `0.2.13` hardens that iOS preserve path by normalizing output orientation and pixel dimension metadata. Version `0.2.14` aligns AVIF output unsupported capability notes and `ERR_NOT_IMPLEMENTED` messages without adding AVIF encoding. Version `0.2.15` documents the AVIF output feasibility decision without runtime behavior changes. Version `0.2.16` adds an internal Android AVIF output encoder route prototype without enabling AVIF output. Version `0.2.17` adds an internal Android AVIF output encode/decode-back smoke attempt without enabling AVIF output. Version `0.2.18` corrects the packaged npm README without runtime behavior changes. Version `0.2.19` clarifies the AVIF output production gate, capability notes, and `ERR_NOT_IMPLEMENTED` messages without enabling AVIF output. Version `0.2.20` adds Android AVIF output smoke production-decision blocker codes without enabling AVIF output. Version `0.2.21` adds an Android AVIF output production wiring scaffold without enabling AVIF output. Version `0.2.22` extracts the Android AVIF output encode/decode-back helper boundary without enabling AVIF output. Version `0.2.23` adds injectable Android AVIF output helper validation dependencies without enabling AVIF output. Version `0.2.24` fixes the injected Android AVIF output helper success contract without enabling AVIF output. Version `0.2.25` fixes the injected Android AVIF output helper direct-output success contract without enabling AVIF output. Version `0.2.26` fixes the Android AVIF output helper validation detail ordering contract without enabling AVIF output. Version `0.2.27` fixes the Android AVIF output helper blocked-route detail and smoke adapter contract without enabling AVIF output. Version `0.2.28` fixes the Android AVIF output helper temp-file lifecycle contract without enabling AVIF output. Version `0.2.29` fixes the Android AVIF output helper validation-result provenance contract without enabling AVIF output. Version `0.2.30` hardens iOS smoke retry and timeout diagnostics without enabling AVIF output. Version `0.2.31` hardens simulator-free iOS smoke diagnostic test coverage without enabling AVIF output. Version `0.2.32` hardens CLI-level iOS smoke timeout fixture coverage without enabling AVIF output. Version `0.2.33` hardens iOS smoke process lifecycle fixture coverage without enabling AVIF output. Version `0.2.34` hardens iOS smoke log stream error fixture coverage without enabling AVIF output. Version `0.2.35` hardens iOS smoke diagnostics packed log artifact coverage without enabling AVIF output. Version `0.2.36` hardens iOS smoke artifact failure-path dry-run fixture coverage without enabling AVIF output. Version `0.2.37` hardens iOS smoke diagnostics artifact schema snapshot coverage without enabling AVIF output. Version `0.2.38` hardens iOS smoke PASS payload schema snapshot coverage without enabling AVIF output. Version `0.2.39` hardens iOS WebP-output available PASS payload schema snapshot coverage without enabling AVIF output. Version `0.2.40` hardens iOS AVIF-input unavailable PASS payload schema snapshot coverage without enabling AVIF output. Version `0.2.41` hardens iOS PASS payload schema matrix helper coverage without enabling AVIF output. Version `0.2.42` hardens iOS PASS payload CI log replay fixture coverage without enabling AVIF output. HEIC/HEIF output, AVIF output, metadata preservation outside JPEG source to JPEG output, GIF animation preservation, animated AVIF preservation, and animated WebP preservation are not implemented yet.

Version `0.2.43` hardens iOS PASS payload replay fixture provenance and refresh guidance without enabling AVIF output. Version `0.2.44` hardens iOS PASS replay fixture source-line SHA-256 integrity without enabling AVIF output. Version `0.2.45` adds the structured replay artifact and offline deterministic refresh CLI without enabling AVIF output. Version `0.2.46` adds read-only offline artifact freshness checking without enabling AVIF output. Version `0.2.47` adds semantic payload validation, standalone audit mode, machine-readable reports, and local/CI audit gating without enabling AVIF output. Version `0.2.48` adds registry provenance reporting and a manual validation gate without enabling AVIF output.

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

The smoke command requires full Xcode with an iOS simulator SDK, Ruby 3.1 or newer with Bundler or CocoaPods, and an available iPhone simulator. It installs pods when needed, starts Metro, builds the Debug simulator app, installs it, launches it with `RNICK_IOS_SMOKE=1`, and waits for the `RNICK_IOS_SMOKE_PASS` log marker. By default the smoke runner tries two timeout-only attempts through `RNICK_IOS_SMOKE_ATTEMPTS=2`, warms the unified log stream before launch with `RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS=1000`, and collects recent diagnostics from `RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW=10m` when a pass marker is not observed. The example Gemfile pins the CocoaPods validation toolchain to patched ActiveSupport and Concurrent Ruby ranges; that Ruby toolchain is used for local/CI validation only and is excluded from the published npm tarball.

The pod install path treats CocoaPods `pathname contains null byte` as an external path-resolution flake. The example Podfile applies a local CocoaPods pathname workaround for pnpm-symlinked pods, and the validation script retries once by default after removing generated `example/ios/Pods`, `example/ios/ImageCompressionKitExample.xcworkspace`, and `example/ios/Podfile.lock` artifacts. It prints Ruby, Bundler, CocoaPods, pnpm, and bundle path diagnostics before retrying or failing. Override `RNICK_IOS_POD_INSTALL_ATTEMPTS` when a CI image needs a different number of pod install attempts.

When an iOS smoke attempt times out waiting for `RNICK_IOS_SMOKE_PASS`, the validation script now prints an `iOS smoke diagnostics:` block before retrying or failing. That block includes simulator state, app and data container lookup, app process lookup, launch output, the captured `RNICK_IOS_SMOKE_*` stream tail, Metro output tail, and a recent unified log tail filtered to `RNICK_IOS_SMOKE_*` messages or the `ImageCompressionKitExample` process.

On GitHub Actions failure, `.github/workflows/ios-validation.yml` captures the full smoke command output in `ios-smoke-diagnostics/ios-smoke.log`, generates `ios-smoke-diagnostics/ios-smoke-summary.md`, appends the same `formatIOSSmokeDiagnosticsSummary()` excerpt to `$GITHUB_STEP_SUMMARY`, and uploads the packed diagnostics directory as the `ios-smoke-diagnostics` artifact. The workflow uploads the `ios-smoke-diagnostics` artifact only through `if: failure()` steps, so successful smoke runs do not upload the diagnostic artifact.

The retry, timeout diagnostic, process lifecycle, log stream error, packed diagnostics summary, artifact markdown schema, PASS payload schema, WebP-output available PASS payload schema, AVIF-input unavailable PASS payload schema, and `summarize-smoke-log` CLI stdout/`$GITHUB_STEP_SUMMARY` dry-run contracts are also covered without Xcode, Metro, or a simulator by `test/iosSmokeContract.test.mjs`, `test/iosSmokePassReplayFixture.test.mjs`, `test/iosSmokeSummaryCli.test.mjs`, `test/iosSmokeCliTimeout.test.mjs`, and `test/iosSmokeLifecycle.test.mjs`. The Node-level Vitest suites validate `scripts/ios-smoke-contract.mjs` defaults and overrides for `RNICK_IOS_SMOKE_ATTEMPTS`, `RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS`, and `RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW`, timeout-only retry decisions, diagnostic formatting, packed diagnostics summary marker extraction and log-tail ordering, exact `formatIOSSmokeDiagnosticsSummary()` markdown schema snapshots for normal, empty, no-marker, and very-long-log fixtures, exact `RNICK_IOS_SMOKE_PASS` payload schema snapshots for platform, result byte, capability, target-size, and unsupported format fields, exact WebP-output available `RNICK_IOS_SMOKE_PASS` payload schema snapshots for conditional WebP output byte fields and `webpTargetSizeResultBytes`, exact AVIF-input unavailable `RNICK_IOS_SMOKE_PASS` payload schema snapshots for omitted `avifResultBytes`, `avifToPngResultBytes`, and `avifToWebPResultBytes`, matrix-driven `RNICK_IOS_SMOKE_PASS` payload schema snapshots for WebP output x AVIF input combinations, shared PASS payload fixture factory coverage, reusable semantic payload validator coverage across exact field order, positive result bytes, capability booleans, and unsupported-format consistency, successful GitHub Actions iOS Validation PASS log replay fixture coverage, missing or malformed PASS payload log handling, missing conditional WebP and AVIF payload field handling, `unsupportedInputs` including `avif` when AVIF input is unavailable, `unsupportedOutputs` excluding `webp` when WebP output is available, `summarize-smoke-log` CLI stdout/`$GITHUB_STEP_SUMMARY` parity from a fake `ios-smoke.log`, CLI timeout input assembly from fake launch/log stream/Metro/unified-log output, diagnostics-before-retry warning order, fake EventEmitter Metro/log stream listener cleanup plus log process stop and `setLogProcess(null)` after PASS, FAIL, and timeout settle paths, and log stream error output/snapshot/timeout diagnostics propagation.

The CI replay fixture artifact coverage validates `test/fixtures/ios-smoke-pass-ci-replay.json`, its canonical JSON formatting, workflow, run, head SHA, job, step, timestamp, source URL, exact PASS source line, SHA-256, and semantic payload contract. Fake-log CLI coverage proves refresh is deterministic, check/audit are no-write and network-free, JSON stdout is stable for current/stale/invalid results, and conflicting modes fail without ambiguous output.

Metro startup waits up to 180 seconds by default to tolerate cold macOS CI runners. Override `RNICK_IOS_METRO_READY_TIMEOUT_MS` when a local machine or CI image needs a shorter or longer readiness window.

The smoke path validates the native module link plus runtime behavior from the React Native host app: iOS capabilities report JPEG input/output, PNG input/output, GIF input with no GIF output, WebP input with capability-driven output, HEIC input with no HEIC output, HEIF input with no HEIF output, AVIF input only when ImageIO advertises AVIF source support and no AVIF output, `metadataPolicies: ['preserve', 'safe', 'strip']`, target-size compression support, and no cancellation; JPEG, PNG, GIF, WebP, HEIC, HEIF, and capability-available AVIF fixtures compress to JPEG output; JPEG source metadata is generated with stale TIFF orientation and source-size EXIF pixel dimensions, read, preserved through JPEG output with `metadata: 'preserve'`, resize, quality, and `output.maxBytes`, then read back from the compressed result with orientation normalized to `1` and pixel dimension metadata matching the compressed JPEG; JPEG, PNG, GIF, WebP, HEIC, HEIF, and capability-available AVIF fixtures compress to PNG output; GIF, WebP, HEIC, HEIF, and capability-available AVIF JPEG output run through the `output.maxBytes` path and return `byteSize <= maxBytes` for the smoke target; JPEG `output.maxBytes` succeeds and returns `byteSize <= maxBytes` for the smoke target; PNG `output.maxBytes` rejects with `ERR_NOT_IMPLEMENTED`; JPEG input to PNG output with `metadata: 'preserve'` rejects with `ERR_NOT_IMPLEMENTED`; when ImageIO advertises a WebP destination type, JPEG, PNG, GIF, WebP, HEIC, HEIF, and capability-available AVIF fixtures also compress to WebP output and WebP `output.maxBytes` succeeds with `byteSize <= maxBytes`; when ImageIO does not advertise a WebP destination type, `output.format: 'webp'` rejects with `ERR_NOT_IMPLEMENTED`; when ImageIO does not advertise AVIF source support, AVIF input rejects with `ERR_UNSUPPORTED_FORMAT`; HEIC, HEIF, and AVIF output reject with `ERR_NOT_IMPLEMENTED`; and GIF output remains rejected by TypeScript validation with `ERR_INVALID_OPTIONS`.

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

After npm publication, `pnpm smoke:registry -- --version <published-version> --expect-tag latest --json --report-file registry-provenance.json` validates the requested registry package. It runs `npm view`, requires `latest` to resolve the exact requested version, downloads the registry tarball with `npm pack`, checks integrity/shasum, real tarball README status, required runtime files and forbidden development-only files, installs the published version into a separate temporary React Native consumer project with `npm install --ignore-scripts --legacy-peer-deps`, and runs `npm run typecheck` against public imports from the registry package. The canonical report fields are `schemaVersion`, `status`, `package`, `requestedVersion`, `resolvedVersion`, `expectedTag`, `tagVersion`, `publishedAt`, `tarball`, `integrity`, `shasum`, `fileCount`, `packageSize`, `unpackedSize`, `readmeStatus`, `forbiddenFiles`, `registryInstallSmoke`, and `error`. This post-publish smoke test intentionally is not part of the default CI or `pnpm release:dry-run`, because it requires an already published npm version. Set `RNICK_REGISTRY_SMOKE_KEEP=1` to keep the temporary project for inspection, `RNICK_REGISTRY_SMOKE_TMPDIR=/path/to/tmp` to choose its parent directory, or `RNICK_REGISTRY_SMOKE_VERSION=<published-version>` to provide the version without CLI arguments.

The workflow-dispatch-only `.github/workflows/registry-validation.yml` provides the networked manual gate without adding npm registry access to `pnpm verify`. It accepts an exact version and expected dist-tag, writes the canonical provenance report plus captured stdout, verifies those files match, adds a compact GitHub Step Summary, uploads `registry-provenance-<version>`, and fails the job when the report status is not `passed`.

The separate `.github/workflows/android-instrumentation.yml` workflow enables KVM permissions, boots an API 35 Google APIs emulator with an extended boot timeout, and runs `pnpm example:android-instrumentation`. This workflow validates that the committed HEIC, HEIF, and AVIF fixtures decode on the Android `ImageDecoder` paths and can be compressed to JPEG, PNG, and WebP; it also runs the Android AVIF output encode/decode-back smoke and asserts AVIF output capability reporting remains false. It stays separate from the lightweight CI because emulator startup and codec execution are slower and more environment-sensitive than JVM tests.

The separate `.github/workflows/ios-validation.yml` workflow runs on a macOS runner, executes `pnpm fixtures:ios-pass-replay:audit -- --json`, and then executes `pnpm example:ios:smoke`. The audit fails before simulator work when the committed artifact is malformed, noncanonical, provenance/hash-invalid, or payload-contract-invalid. The host-app smoke validates pod install, React Native Codegen/autolinking, simulator build/install/launch, JPEG/PNG/GIF/WebP/HEIC/HEIF/runtime-available AVIF input to JPEG, PNG, and capability-driven WebP runtime compression, iOS capability reporting, JPEG target-size behavior, JPEG source to JPEG output metadata preserve, WebP target-size behavior when ImageIO WebP destination encoding is available, AVIF input rejection when ImageIO AVIF source support is unavailable, and the expected iOS unsupported-option error surface. The workflow inherits the guarded CocoaPods null-byte retry behavior and the timeout-only smoke retry/diagnostic behavior from `scripts/ios-validation.mjs` so one transient CocoaPods path-resolution failure or one missing `RNICK_IOS_SMOKE_PASS` log observation does not immediately fail the validation run.

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

`pnpm verify` runs type checking, unit tests, the TypeScript build, `pnpm fixtures:ios-pass-replay:audit`, and the Android verification doctor.

Run the pack-based consumer smoke test before release-oriented changes:

```bash
pnpm smoke:consumer
```

This command builds the package, creates a local tarball with `pnpm pack`, installs it into a separate temporary React Native consumer project, and typechecks public API imports from the packed package.

For a published npm version, run the registry-based provenance smoke:

```bash
pnpm smoke:registry -- --version <published-version> --expect-tag latest --json --report-file registry-provenance.json
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

The v0.2.48 registry provenance and manual CI gate release notes are in [RELEASE.md](RELEASE.md).

Actual npm publishing requires an authenticated npm registry session and is intentionally outside the dry-run checklist. See [RELEASE.md](RELEASE.md) for the v0.2.42 iOS PASS payload CI log replay fixture candidate notes, v0.2.41 iOS PASS payload schema matrix helper candidate notes, v0.2.40 iOS AVIF-input unavailable PASS payload schema snapshot release notes, v0.2.39 iOS WebP-output available PASS payload schema snapshot candidate notes, v0.2.38 iOS smoke PASS payload schema snapshot release notes, v0.2.37 iOS smoke diagnostics artifact schema snapshot candidate notes, v0.2.36 iOS smoke artifact failure-path dry-run fixture candidate notes, v0.2.35 iOS smoke diagnostics packed log artifact coverage candidate notes, v0.2.34 iOS smoke log stream error fixture coverage candidate notes, v0.2.33 iOS smoke process lifecycle fixture coverage candidate notes, v0.2.32 iOS smoke timeout CLI fixture coverage candidate notes, v0.2.31 iOS smoke diagnostic testability hardening candidate notes, v0.2.30 iOS smoke retry and diagnostic hardening candidate notes, v0.2.29 Android AVIF output helper validation-result provenance contract candidate notes, v0.2.28 Android AVIF output helper temp-file lifecycle contract candidate notes, v0.2.27 Android AVIF output helper blocked-route detail contract candidate notes, v0.2.26 Android AVIF output helper validation detail contract candidate notes, v0.2.25 Android AVIF output helper direct-output success contract candidate notes, v0.2.24 Android AVIF output helper injected success contract candidate notes, v0.2.23 Android AVIF output helper injectable validation seam candidate notes, v0.2.22 Android AVIF output production helper extraction candidate notes, v0.2.21 Android AVIF output production wiring scaffold candidate notes, v0.2.20 AVIF output production wiring preflight candidate notes, v0.2.19 published AVIF output production gate release notes, v0.2.18 docs-only npm README correction release notes, v0.2.17 published Android AVIF output encode/decode-back smoke release notes, v0.2.16 Android AVIF output encoder route prototype candidate notes, v0.2.15 AVIF output feasibility candidate notes, v0.2.14 published AVIF output capability/error surface release notes, v0.2.13 published iOS JPEG metadata preserve hardening release notes, v0.2.12 published iOS JPEG metadata preserve release notes, v0.2.11 docs-only correction notes, v0.2.10 published release notes, v0.2.9 release notes, v0.2.8 release notes, v0.2.7 release notes, v0.2.6 release notes, v0.2.5 release notes, v0.2.4 release notes, v0.2.3 release notes, v0.2.2 release notes, v0.2.1 release notes, v0.2.0 published release notes, v0.1.2 published patch notes, v0.1.1 docs-only patch notes, v0.1.0 published artifact details, tag checklist, and post-publish security review. Before publishing a new version, review the intended version and package metadata, then run the dry-run release gate from the repository root:

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

The packed README stale status check packs the package to a temporary directory, extracts `package/README.md`, and fails if stale pre-release status snippets remain. The final `pnpm publish --dry-run --no-git-checks` step exercises the publish packaging path without uploading a package. The `--no-git-checks` flag keeps the dry run usable before the release commit exists; the actual publish decision should still wait for a clean working tree, the intended version, reviewed release notes, and successful GitHub Actions CI, Android Instrumentation, and iOS Validation runs on the pushed release commit. Git tags and GitHub Releases are separate work and are not required by this npm promotion. After npm publish, run `pnpm smoke:registry -- --version <published-version>` to verify the real registry tarball and clean consumer install. This registry smoke step is intentionally outside `pnpm release:dry-run` and the default CI because it requires a version that already exists on npm. npm publish, registry smoke, and post-publish security review commands are documented in `RELEASE.md` and should only be run manually after those checks pass.

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
