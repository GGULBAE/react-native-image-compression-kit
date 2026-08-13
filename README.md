<h1 align="center">React Native Image Compression Kit</h1>

<p align="center">
  Control image bytes before upload without giving up native runtime safety.
</p>

<p align="center">
  <img alt="Platforms: Android and iOS" src="https://img.shields.io/badge/Platforms-Android%20%7C%20iOS-green" />
  <img alt="TypeScript: API available" src="https://img.shields.io/badge/TypeScript-API%20available-3178c6" />
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow" />
</p>

<p align="center">
  <a href="https://ggulbae.github.io/react-native-image-compression-kit/guide/byte-economics">📊 Why bytes matter</a>
  · <a href="#quick-start">⚡ Quick start</a>
  · <a href="https://ggulbae.github.io/react-native-image-compression-kit/reference/api">🧭 API</a>
</p>

One native boundary for upload bytes, app-owned image files, resource limits,
metadata, cancellation, and output ownership.

<!-- package-status:start -->
## Current status

- Package version: `0.4.1`
- Release target: `0.4.1`
- Published npm latest: `0.4.0`
- Release state: `candidate`
- Registry checked at: `2026-08-13`
<!-- package-status:end -->

Version 0.4.1 is a source candidate; npm `latest` remains 0.4.0. The candidate
fixes an iOS pixel-orientation defect in the ImageIO/CoreGraphics path and adds
the backward-compatible `removeCompressionOutput(uri)` lifecycle API. The
published 0.4.0 package can vertically invert orientation-bearing iOS inputs;
do not treat its iOS walkthrough as successful visual-integrity evidence.

## Why this package

Images create cost twice: **📤 while bytes move** and **📱 while app-owned files
remain on the device**. Server-side optimization starts too late to recover the
first upload. Ericsson reports **22 GB/month per active smartphone in 2025**
and forecasts **328 EB/month of mobile data traffic in 2031**; this is market
context, not a package savings claim. [Source and forecast limits](https://www.ericsson.com/en/reports-and-papers/mobility-report/dataforecasts/mobile-traffic-forecast).

<picture>
  <source media="(max-width: 640px)" srcset="https://raw.githubusercontent.com/GGULBAE/react-native-image-compression-kit/master/website/public/byte-economics-mobile.svg" />
  <img src="https://raw.githubusercontent.com/GGULBAE/react-native-image-compression-kit/master/website/public/byte-economics.svg" alt="Two cost surfaces: bytes moving through upload and app-owned bytes remaining in queues, outputs, caches, and residual files" />
</picture>

| | Cost surface | Measure |
| --- | --- | --- |
| 📤 | First upload, retry, and backend ingress bytes | Accepted `source - output` delta; compare a matched baseline for incremental transfer change |
| 📱 | App-owned queue, output, cache, and residual files | `queue + outputs + caches + residual` |

> 💡 **Illustrative scale:** 1M accepted images at 4 MB → 500 KB means a
> **3.5 TB source-to-output delta**. It is fewer first-hop bytes only if the
> same 4 MB inputs would otherwise have been uploaded. A 200-image app-owned queue changes from
> **800 MB → 100 MB** only when the host may replace its own staging files.

> 🛡️ **Boundary:** the package does not shrink or delete gallery sources. A new
> output can temporarily coexist with its source. The figures above are decimal
> arithmetic examples—not benchmarks or guaranteed savings.

The differentiation is the combined contract: byte budget, runtime capability,
bounded work, metadata policy, cancellation, transactional output, and narrow
owned-file cleanup.

<picture>
  <source media="(max-width: 640px)" srcset="https://raw.githubusercontent.com/GGULBAE/react-native-image-compression-kit/master/website/public/evidence-scorecard-mobile.svg" />
  <img src="https://raw.githubusercontent.com/GGULBAE/react-native-image-compression-kit/master/website/public/evidence-scorecard.svg" alt="v0.4.0 evidence snapshot: byte-budget, failure-safety, runtime capability, planned pixels, metadata, and packed-build signals" />
</picture>

<details>
<summary><strong>🔬 View the evidence behind each contract</strong></summary>

| Concern | Contract | Public evidence |
| --- | --- | --- |
| Upload limit | `maxBytes` searches generated JPEG or WebP candidates | Both v0.4.0 fixtures met 8,000 B, but the iOS capture is excluded from combined success because visual orientation failed |
| Large photos | Decode downsampling, pixel limits, two-operation scheduling | 48 MP → 1.92 MP planned decode; this is not measured peak memory |
| Cancellation | `ERR_CANCELLED` without publishing partial output | JS and native suites assert zero residual output at representative boundaries |
| Output lifecycle | Narrow `removeCompressionOutput(uri)` ownership check | 0.4.1 candidate tests owned deletion and foreign/path/directory rejection |
| Metadata | Explicit `preserve`, `safe`, and `strip` | Android safe retained 0/7 named sensitive fields; iOS safe/strip copy no source metadata |
| Integration | Packed tarball installed by fresh consumers | 8/8 release-target platform builds passed for v0.4.0 |

</details>

Read the [product evidence metrics](https://ggulbae.github.io/react-native-image-compression-kit/reference/evidence)
for definitions, decision thresholds, evidence links, and interpretation limits.
For the system and product measurement model, read
[why device-side bytes matter](https://ggulbae.github.io/react-native-image-compression-kit/guide/byte-economics).

## Project direction

The [roadmap](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/ROADMAP.md)
organizes work around integration problems and required evidence rather than
release dates. The
[product architecture](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/product-architecture.md)
records the capability-first native pipeline, bounded-work, cancellation,
metadata, and transactional-output decisions that changes must preserve. For a
shorter user-facing view, see the
[hosted architecture guide](https://ggulbae.github.io/react-native-image-compression-kit/reference/architecture)
and [hosted roadmap](https://ggulbae.github.io/react-native-image-compression-kit/roadmap).

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
`>=0.73 <1.0`. The v0.4.0 release-target matrix verifies React Native 0.73.11 Legacy,
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

> The cleanup call in this example belongs to the 0.4.1 source candidate and
> is not present in npm 0.4.0. The compression and capability calls remain
> valid in 0.4.0; use the host application's file API to clean accepted outputs
> until the candidate is released.

```ts
import {
  compressImage,
  getImageCompressionCapabilities,
  removeCompressionOutput,
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
    quality: 90,
    maxBytes: 500_000,
  },
  metadata: 'safe',
});

const sourceToOutputByteDelta = Math.max(
  0,
  result.originalByteSize - result.byteSize
);

try {
  if (result.byteSize > 500_000) {
    throw new Error('Image did not meet the upload policy');
  }
  await upload(result.uri, { sourceToOutputByteDelta });
} finally {
  await removeCompressionOutput(result.uri);
}
```

Input must be a local URI accessible to the native app. Android supports
`file://` and `content://`; iOS supports `file://` and best-effort local
`content://` loading. Apply the host application's acceptance policy before
upload: an unreachable `maxBytes` target returns the smallest generated
candidate rather than pretending the target was met.

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

### `removeCompressionOutput(uri)` (0.4.1 source candidate)

Deletes a completed cache output returned by `compressImage`. It accepts only a
package-generated `file://` URI in the package output directory, never deletes
recursively, and treats an already-missing valid output as success. A foreign,
source, traversal, symlink, or directory target rejects with
`ERR_INVALID_OPTIONS`; a filesystem deletion failure rejects with
`ERR_FILE_ACCESS`.

```ts
const result = await compressImage(options);

try {
  await upload(result.uri);
} finally {
  await removeCompressionOutput(result.uri);
}
```

Copy or move an output before removal when it must remain available after the
cache lifecycle.

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
- The iOS SDK ships a namespaced privacy manifest declaring no tracking or
  collected data and C617.1 for package-cache file metadata validation.
- JPEG orientation is rendered into pixels before resize/encode; preserved
  output orientation and dimensions are normalized.
- Sources above 32,768 pixels on either axis or 100,000,000 total pixels reject
  with `ERR_RESOURCE_LIMIT`. Work requiring more than 25,000,000 decoded pixels
  must provide smaller resize bounds.
- JPEG output flattens transparency onto white on both platforms. PNG and WebP
  alpha capability reflects decode-back validation.
- Failed and cancelled operations remove temporary/partial cache files. A
  successful result remains application-owned; call
  `removeCompressionOutput(result.uri)` when the package-owned cache output is
  no longer needed.
- Capability checks should drive fallbacks for SDK-, device-, and
  runtime-dependent codecs.

## Development verification

The full repository gate requires `ffmpeg` and `ffprobe` so retained and
newly generated native image evidence can be decoded and visually replayed.
The pinned Docker lane includes both tools.

```bash
pnpm test:coverage
pnpm verify
pnpm example:typecheck
pnpm example:android-unit-test
pnpm example:android-instrumentation-build
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

`pnpm example:android-instrumentation-build` compiles the device-test APK
without requiring an emulator. Run `pnpm example:android-instrumentation` with
an API 34+ device or emulator to execute codec and output-lifecycle tests. When
Java or the Android SDK is unavailable locally, `pnpm docker:android:ci` runs
the repository gate, Codegen, unit tests, instrumentation APK compile, and
example APK build in the pinned container toolchain.

Native demo captures run a deterministic, capture-only walkthrough in the real
Android and iOS example apps: bundled source, selected options, runtime
capabilities, active compression, and the native before/after result. The
evidence contract records the ordered stage timeline, MP4 duration and digest,
exact source SHA, workflow run, runtime, and device.

The hosted recorders may omit repeated frames while a stage is static, so the
workflow normalizes the real captured frames to the separately logged
walkthrough duration with `ffmpeg` and holds the exact final native screenshot
for six seconds. The manifest records that capture method, while validation
reads the actual video track duration rather than trusting the container's
movie header.

The same runs emit
versioned baseline and exact-plan comparison evidence with raw samples, fixture
and plan digests, balanced execution positions, and median/p95 summaries.
They also create a kit-only 12 MP JPEG source-tree evidence bundle that binds source and
output bytes, environment, capabilities, latency samples, visual agreement,
and package-output cleanup. The bundle is an environment-specific observation,
not a speed ranking, cost-savings claim, or real-device benchmark.
Comparison dependencies remain inside the private example application and
outside the published package. See the
[benchmark methodology](docs/benchmarks/README.md) for its timing boundary,
reproduction commands, adapter caveats, and comparison policy.

`pnpm test:coverage` runs the Vitest suite once with V8 coverage. The gate
includes executable TypeScript runtime modules and directly tested pure
`scripts/*-core.mjs` helpers, with rounded measured-baseline thresholds of 94%
statements, 83% branches, 98% functions, and 94% lines. React Native Codegen
and barrel entry wrappers, generated trees, fixtures, retained evidence, and
CLI entry wrappers stay outside that unit-coverage boundary because native,
package, fixture, or subprocess contract tests own them. `pnpm verify` runs
that coverage gate instead of running the same Vitest suite twice, then runs
the build, offline fixture and release-evidence replay gates, workflow supply
chain checks, and the Android repository doctor. `pnpm docs:check` is
network-free and validates the repository status manifest, aligned
README/RELEASE blocks, required documentation structure, local links/anchors,
and npm package exclusions.

For release-oriented changes, also run:

```bash
pnpm smoke:consumer
pnpm release:dry-run
```

The release dry run never publishes. Its shared state matrix blocks a
`candidate` and permits `release` only after package metadata, the release
target, and document mirrors are aligned. The separately tracked published npm
latest remains an observed registry value and is not rewritten before publish.

## Registry monitoring

The weekly [Registry Health workflow](https://github.com/GGULBAE/react-native-image-compression-kit/actions/workflows/registry-health.yml)
runs every Monday at 03:17 UTC, reads `publishedNpmLatest` from
`docs/release-status.json`, runs the real npm registry smoke with npm 12.0.1,
and compares npm `latest`, exact-version metadata, the downloaded tarball,
README/package inventory, and clean consumer install/typecheck with
`evidence/npm/<version>`. It retains manual dispatch and limited pull-request
validation, has only `contents: read`, uses no protected environment, and
creates no provenance or attestation. The manual Registry Validation workflow
is separate: maintainers dispatch it through `npm-production` when fresh
provenance and attestation evidence is required.

Run the same read-only monitor locally without hardcoding the release version:

```bash
health_version="$(node -p "require('./docs/release-status.json').publishedNpmLatest")"
health_dir="$(mktemp -d)"
pnpm smoke:registry -- \
  --version "$health_version" \
  --expect-tag latest \
  --json \
  --artifact-dir "$health_dir/live"
pnpm verify:registry-health -- \
  --live-artifact-dir "$health_dir/live" \
  --json \
  --report-file "$health_dir/registry-health.json"
```

The canonical report compares package name, requested/resolved/tagged version,
publish timestamp, tarball URL, SRI, shasum, SHA-256, packed bytes, file count,
unpacked bytes, README status, forbidden files, and consumer smoke result. A
failure is an investigation signal only: it grants no authority to republish,
change a dist-tag, move a Git tag, or edit a GitHub Release. Inspect the report
drift first, then the release-status handoff and matching evidence archive,
then exact npm metadata and a fresh smoke. A release handoff is complete only
when `docs/release-status.json` and `evidence/npm/<version>` identify the same
published version.

## Repository documentation

Operational material is repository-only and is not included in the npm
tarball:

- [User guides and native-result demo](https://ggulbae.github.io/react-native-image-compression-kit/)
- [Product architecture](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/product-architecture.md)
- [Product evidence metrics](https://ggulbae.github.io/react-native-image-compression-kit/reference/evidence)
- [Roadmap](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/ROADMAP.md)
- [Native benchmark evidence](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/benchmarks/README.md)

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
