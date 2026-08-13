# Changelog

Notable user-facing changes are recorded here. The project follows Semantic
Versioning while it is in `0.x`: minor releases may change public contracts,
and patch releases remain backward compatible within the current minor line.

## Unreleased

### Added

- `removeCompressionOutput(uri)` for idempotent deletion of package-owned
  generated cache outputs, with native ownership validation that rejects
  arbitrary files, traversal, symlinks, and directories.
- An iOS SDK privacy manifest declaring no tracking or collected data and the
  C617.1 reason used to inspect package-owned cache output metadata.
- A reproducible kit-only 12 MP JPEG evidence harness with exact environment,
  byte, geometry, visual-agreement, latency, and output-cleanup verification.

### Changed

- The reproducible Android Docker toolchain now includes a checksum-pinned
  GitHub CLI and compiles the instrumentation APK so the full non-emulator
  repository verification lane can run in the container.

### Fixed

- iOS no longer vertically inverts pixels after ImageIO has normalized an
  orientation-bearing input. The default pipeline now verifies EXIF
  orientations 1–8 through decode, transform, and encode, and native demo
  capture fails when the upright output does not beat a vertical-flip control.

## 0.4.0 - 2026-07-20

### Added

- Optional `AbortSignal`/`CompressionControl` cancellation with stable
  `ERR_CANCELLED` normalization across preflight, queued, and running work.
- Decode-time downsampling for resize requests and pre-decode source/working
  pixel limits with stable `ERR_RESOURCE_LIMIT` failures.
- Additive capability fields for bounded concurrency, downsampling, and named
  resource limits.
- Large-image, cancellation-race, output-cleanup, and alpha decode-back native
  coverage.
- Version-specific v0.4.0 GitHub Release notes.

### Changed

- iOS file, decode, transform, encode, and output work runs on a bounded
  background `NSOperationQueue` and uses ImageIO/CoreGraphics instead of
  main-thread UIKit rendering.
- Android compression runs on a two-worker bounded executor instead of the
  React Native module queue.
- Android and iOS publish only fully encoded cache files and remove temporary
  or published output when cancellation wins before settlement.
- JPEG transparency is flattened onto white consistently; PNG/WebP alpha
  capability now matches decode-back validation.
- Release metadata separates the intended release target from the
  registry-observed published npm latest, and Trusted Release selects notes
  from its exact validated version instead of a prior-version hardcode.

### Compatibility

- Existing `compressImage(options)` calls and result fields remain unchanged.
- Small-image resize, crop, metadata, format, and `maxBytes` semantics remain
  compatible; the new control and capability fields are additive.
- HEIC/HEIF/AVIF output, batch APIs, progress events, animation preservation,
  remote URLs, and data URIs remain outside scope.

## 0.3.0 - 2026-07-18

### Added

- Public integration and platform-support documentation.
- A GitHub Pages site with a traceable native before/after evidence contract.
- Community contribution, support, and security-reporting paths.
- Compatibility and trusted-release gates.
- The `ImageCompressionKitErrorCode` public TypeScript export.

### Changed

- The podspec source tag now follows the repository's `v<version>` tag format.
- Package and repository links use the canonical public documentation site.

### Compatibility

- Native compression and output behavior remain unchanged from 0.2.62.
- Android requires API 23 or newer; iOS requires 13.4 or newer.
- Expo requires a development build or prebuild. Expo Go is unsupported.
- The verified release lanes cover React Native 0.73.11 Legacy, React Native
  0.86.0 Legacy/New, and Expo 57.0.7 development builds on Android and iOS.
- Intermediate React Native versions accepted by the `>=0.73 <1.0` peer range
  are not individually release tested.

## 0.2.62 - 2026-07-17

- Split npm-user documentation from repository release-evidence operations.
- Added semantic documentation and current-status gates.
- Preserved release evidence, native behavior, and public API compatibility.

Complete 0.2.x implementation and evidence history is preserved in the
[repository history](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/releases/0.2-history.md)
and [GitHub Releases](https://github.com/GGULBAE/react-native-image-compression-kit/releases).
