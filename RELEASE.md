# Release Notes

## v0.2.7

Status: published to npm on July 2, 2026, tagged as `v0.2.7`.

This release keeps Android runtime behavior unchanged while adding iOS
HEIC/HEIF input support to the existing iOS ImageIO-backed static decode path.
HEIC and HEIF inputs are decoded as static images and then routed through the
existing JPEG, PNG, or runtime-gated WebP output paths.

### Goals

- Support HEIC/HEIF input on iOS through ImageIO static image decode.
- Reuse the existing iOS resize, JPEG quality, JPEG `output.maxBytes`, PNG output, runtime-gated WebP output, and runtime-available WebP `output.maxBytes` paths.
- Report iOS HEIC and HEIF capabilities as `input=true` and `output=false`.
- Keep HEIC/HEIF output, iOS AVIF input/output, Live Photo/depth/burst/animation handling, iOS metadata preservation, and Android runtime behavior outside this release.
- Align README guidance, TypeScript native-unavailable messaging, native error surfaces, source-level expectations, Android verification doctor expectations, and iOS host-app smoke validation with the new iOS HEIC/HEIF input path.

### Included

- `package.json` version bump to `0.2.7`.
- iOS `compressImage()` now accepts HEIC and HEIF source data for JPEG and PNG output.
- iOS HEIC/HEIF input is decoded through ImageIO with `CGImageSourceCreateImageAtIndex` as a static image before resize and output encoding.
- HEIC/HEIF input to JPEG output keeps resize, `output.quality`, and JPEG `output.maxBytes` behavior.
- HEIC/HEIF input to PNG output keeps resize behavior and re-encodes without copying source metadata.
- HEIC/HEIF input can be re-encoded to runtime-available WebP output when ImageIO advertises a WebP destination type.
- iOS `getImageCompressionCapabilities()` reports HEIC `input=true` / `output=false` and HEIF `input=true` / `output=false`, with notes that HEIC/HEIF output remains unimplemented.
- The iOS unsupported-input error surface now lists JPEG, PNG, GIF, WebP, HEIC, and HEIF input as supported and leaves AVIF on the unsupported path.
- The iOS host-app smoke validates `compress-heic-to-jpeg`, `compress-heif-to-jpeg`, `compress-heic-to-png`, `compress-heif-to-png`, and capability-gated HEIC/HEIF to WebP output when WebP output is available.
- The iOS host-app smoke removes HEIC and HEIF from the unsupported-input rejection loop and keeps AVIF input rejected with `ERR_UNSUPPORTED_FORMAT`.
- TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF/WebP/HEIC/HEIF input with JPEG, PNG, and runtime-gated ImageIO-backed WebP output in version `0.2.7`.
- README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the iOS HEIC/HEIF input path.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.7` and GitHub Release `v0.2.7`.

### Not Included

- Android runtime behavior changes.
- HEIC/HEIF output on iOS.
- AVIF input or output on iOS.
- Live Photo, depth, burst, or animation handling.
- iOS metadata preservation.
- New public TypeScript API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm example:ios:smoke
```

Release commit validation before npm publish:

- Commit: `0cb815e3e584f53688e264398b61028ba307eca9`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28564636404>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28564636383>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28564636447>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_PASS` with JPEG, PNG, GIF, WebP, HEIC, and HEIF input coverage, HEIC/HEIF capability reporting, AVIF input rejection, and capability-gated WebP output behavior.

Completed after npm publish and GitHub Release creation:

- `npm publish --tag latest` published `react-native-image-compression-kit@0.2.7`.
- npm package: `react-native-image-compression-kit@0.2.7`
- Git tag: `v0.2.7`
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.7>.

## v0.2.6

Status: published to npm on July 2, 2026 at 03:36:53 UTC (12:36:53 KST), tagged as `v0.2.6`.

This release keeps Android runtime behavior unchanged while adding iOS WebP
target-size `output.maxBytes` support to the runtime-gated ImageIO-backed WebP
output path introduced in `0.2.5`.

### Goals

- Support `output.format: 'webp'` with `output.maxBytes` on iOS runtimes that advertise ImageIO WebP destination encoding.
- Reuse the existing iOS target-size quality search for both JPEG and runtime-available WebP output.
- Keep WebP output unavailable runtimes on the existing capability-gated `ERR_NOT_IMPLEMENTED` path.
- Align iOS capability reporting, README guidance, TypeScript native-unavailable messaging, source-level expectations, and host-app smoke validation with runtime-gated WebP target-size support.

### Included

- `package.json` version bump to `0.2.6`.
- iOS WebP output now accepts `output.maxBytes` when ImageIO advertises a WebP destination type.
- iOS target-size encoding now shares one quality-search helper for JPEG and runtime-available WebP output.
- WebP target-size compression treats `quality` as the upper quality bound and returns the highest WebP quality that fits under `maxBytes`, or the smallest generated output when the target cannot be reached.
- iOS PNG output still rejects `output.maxBytes` with `ERR_NOT_IMPLEMENTED`.
- iOS runtimes without ImageIO WebP destination support still reject `output.format: 'webp'` before any WebP target-size work.
- iOS WebP capability notes now state that runtime-available WebP output supports target-size `maxBytes` by adjusting WebP quality.
- The iOS host-app smoke now follows the WebP output capability: it validates `compress-webp-to-webp-max-bytes` with `byteSize <= maxBytes` when WebP output is available, and keeps `reject-webp-output-unavailable` / `reject-webp-output` when it is not.
- The example app enables the Max bytes input for WebP output on platforms where WebP output is currently reported as available.
- TypeScript native-unavailable messaging now mentions iOS JPEG and runtime-available WebP target-size `maxBytes` in version `0.2.6`.
- README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the iOS WebP target-size path.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.6` and GitHub Release `v0.2.6`.

### Not Included

- Android runtime behavior changes.
- Animated WebP preservation.
- GIF output on iOS.
- iOS HEIC, HEIF, or AVIF input.
- iOS HEIC, HEIF, or AVIF output.
- iOS metadata preservation.
- New public TypeScript API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm example:ios:smoke
```

Candidate implementation validation before release promotion:

- Commit: `bd4003f18b705416b8d662ca837d8746656fe706`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28561479567>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28561479544>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28561479519>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS reject-webp-output-unavailable`, `RNICK_IOS_SMOKE_STEP_PASS reject-webp-output`, and `RNICK_IOS_SMOKE_PASS` with `webpOutputAvailable: false`, `targetSizeResultBytes: 996`, `unsupportedInputs: ['heic', 'heif', 'avif']`, and `unsupportedOutputs: ['webp', 'heic', 'heif', 'avif']`.
- The `compress-webp-to-webp-max-bytes` success branch remains capability-gated for iOS runtimes that report WebP `output=true`.
- Local pre-publish gate completed successfully before npm publish: `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, and `pnpm pack --dry-run`.

Completed after npm publish and GitHub Release creation:

- `npm publish --tag latest` published `react-native-image-compression-kit@0.2.6`.
- `npm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json` confirmed version `0.2.6`, `latest` dist-tag `0.2.6`, registry tarball URL, integrity `sha512-WbGBG6LnOHEKaWSVhSG0dC+fe8PTs5DxQUAw+kmI69MhHZCLlGfsDNBmYGs4YYQKCsGT7peglmBWVPwduD9ILg==`, shasum `3d978c4650c854dbd18115fb9062e909b9eb63f3`, and publish timestamp `2026-07-02T03:36:53.452Z`.
- npm package: `react-native-image-compression-kit@0.2.6`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.6.tgz`
- npm integrity: `sha512-WbGBG6LnOHEKaWSVhSG0dC+fe8PTs5DxQUAw+kmI69MhHZCLlGfsDNBmYGs4YYQKCsGT7peglmBWVPwduD9ILg==`
- npm shasum: `3d978c4650c854dbd18115fb9062e909b9eb63f3`
- Git tag: `v0.2.6`
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.6>.
- Registry tarball dry-run confirmed 49 files, 44.6 kB package size, and 193.1 kB unpacked size.
- External registry install smoke installed `react-native-image-compression-kit@0.2.6` with `npm install --ignore-scripts --legacy-peer-deps`, confirmed package version `0.2.6`, verified required runtime files, and confirmed development-only verification files were absent.

## v0.2.5

Status: published to npm on July 2, 2026 at 02:14:56 UTC (11:14:56 KST), tagged as `v0.2.5`.

This release keeps Android runtime behavior unchanged while adding a
runtime-gated iOS ImageIO-backed WebP output path to the existing iOS
JPEG/PNG/GIF/WebP input and JPEG/PNG output MVP.

### Goals

- Verify that iOS can advertise WebP destination support through ImageIO before enabling WebP output.
- Implement iOS WebP output for JPEG, PNG, static first-frame GIF, and static first-frame WebP input when the runtime supports WebP destination encoding.
- Keep iOS WebP target-size `maxBytes`, animated WebP preservation, HEIC/HEIF/AVIF input, and Android runtime behavior outside this candidate.
- Align iOS capability reporting, README guidance, TypeScript native-unavailable messaging, source-level expectations, and host-app smoke validation with runtime-gated WebP output support.

### Included

- `package.json` version bump to `0.2.5`.
- iOS `compressImage()` now accepts `output.format: 'webp'` when ImageIO advertises a WebP destination type through `CGImageDestinationCopyTypeIdentifiers()`.
- iOS WebP output is encoded with ImageIO `CGImageDestinationCreateWithData`, `CGImageDestinationAddImage`, and `CGImageDestinationFinalize`.
- WebP output keeps existing iOS resize behavior, honors `output.quality`, writes `.webp` cache files, and re-encodes without copying source metadata under `safe` and `strip`.
- JPEG, PNG, GIF, and WebP input can be re-encoded to WebP output on runtimes that advertise an ImageIO WebP destination type.
- The GitHub Actions iOS Validation runner with Xcode 16.4 and the iPhoneSimulator18.5 SDK currently does not advertise a WebP destination type, so WebP reports `input=true` and `output=false` there.
- iOS WebP output rejects `output.maxBytes` with `ERR_NOT_IMPLEMENTED` because target-size WebP compression remains outside this candidate.
- iOS `getImageCompressionCapabilities()` reports WebP `input=true` and runtime WebP `output=true` only when ImageIO destination encoding is available.
- The iOS host-app smoke now follows the WebP output capability: it validates `compress-jpeg-to-webp`, `compress-png-to-webp`, `compress-gif-to-webp`, `compress-webp-to-webp`, and `reject-webp-max-bytes` when WebP output is available, and validates `reject-webp-output-unavailable` / `reject-webp-output` when it is not.
- TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF/WebP input with JPEG, PNG, and runtime-gated ImageIO-backed WebP output in version `0.2.5`.
- README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the runtime-gated iOS WebP output path.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.5` and GitHub Release `v0.2.5`.

### Not Included

- Android runtime behavior changes.
- WebP target-size `maxBytes` on iOS.
- Animated WebP preservation.
- GIF output on iOS.
- iOS HEIC, HEIF, or AVIF input.
- iOS HEIC, HEIF, or AVIF output.
- iOS metadata preservation.
- New public TypeScript API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm example:ios:smoke
```

Candidate implementation validation before release promotion:

- Commit: `231e86ddd30662df9797e3e7051c3fd5b9526922`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28559336635>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28559336634>.
- iOS Validation initially failed on this commit because the GitHub Actions iOS runtime reported WebP `output=false`; that finding drove the capability-gated smoke update below.

Release commit validation before npm publish:

- Commit: `e5f69c971d3eaa872419be8736f123e6d69b5985`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28559877269>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28559877253>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28559877256>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS reject-webp-output-unavailable`, `RNICK_IOS_SMOKE_STEP_PASS reject-webp-output`, and `RNICK_IOS_SMOKE_PASS` with `webpOutputAvailable: false`, `webpResultBytes: 836`, `webpToPngResultBytes: 248`, `unsupportedInputs: ['heic', 'heif', 'avif']`, and `unsupportedOutputs: ['webp', 'heic', 'heif', 'avif']`.
- Local pre-publish gate completed successfully before npm publish: `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, and `pnpm pack --dry-run`.

Completed after npm publish and GitHub Release creation:

- `npm publish --tag latest` published `react-native-image-compression-kit@0.2.5`.
- `npm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json` confirmed version `0.2.5`, `latest` dist-tag `0.2.5`, registry tarball URL, integrity `sha512-VfEgaHsOjYUKrKUJT8bxdXLJY1upFZEIu4IytQEYO1+URjN4YcXL3Ru1bbaLBAOyFeziK8Ciba7FlZxf/r2RvQ==`, shasum `3795f231b2cca37a1f82cbd333beac3854f67185`, and publish timestamp `2026-07-02T02:14:56.213Z`.
- npm package: `react-native-image-compression-kit@0.2.5`
- Git tag: `v0.2.5`
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.5>.
- External registry install smoke installed `react-native-image-compression-kit@0.2.5` with `npm install --ignore-scripts --legacy-peer-deps`, confirmed package version `0.2.5`, verified required runtime files, and confirmed development-only verification files were absent.

## v0.2.4

Status: published to npm on July 2, 2026 at 01:03:13 UTC (10:03:13 KST), tagged as `v0.2.4`.

This release keeps Android runtime behavior unchanged while adding iOS WebP
static first-frame input to the existing iOS JPEG/PNG/GIF input and JPEG/PNG
output MVP.

### Goals

- Implement iOS WebP input without changing the public TypeScript API.
- Decode WebP input as a static first frame and route it through the existing iOS resize, JPEG quality, JPEG target-size `maxBytes`, PNG output, and metadata no-copy behavior.
- Align iOS capability reporting, README guidance, TypeScript native-unavailable messaging, source-level expectations, and host-app smoke validation with the new WebP input support.

### Included

- `package.json` version bump to `0.2.4`.
- iOS `compressImage()` now accepts WebP input for JPEG and PNG output.
- iOS WebP input is decoded with ImageIO as a static first frame through `CGImageSourceCreateImageAtIndex`.
- WebP input to JPEG output keeps resize, `output.quality`, and JPEG `output.maxBytes` behavior.
- WebP input to PNG output keeps resize behavior and re-encodes without copying source metadata.
- iOS `safe` and `strip` metadata policies continue to re-encode without copying source metadata.
- iOS `getImageCompressionCapabilities()` reports WebP `input=true` and `output=false`.
- iOS WebP format notes state that WebP input is static first-frame only and that WebP output and animation preservation are not implemented.
- The iOS host-app smoke validates `compress-webp-to-jpeg` and `compress-webp-to-png`, and removes WebP from the unsupported-input rejection loop.
- The iOS host-app smoke keeps `reject-webp-output` as an `ERR_NOT_IMPLEMENTED` native output capability check because WebP output is not implemented on iOS.
- TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF/WebP input and static first-frame GIF/WebP support.
- README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the implemented iOS WebP input path.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.4` and GitHub Release `v0.2.4`.

### Not Included

- Android runtime behavior changes.
- WebP output on iOS.
- Animated WebP preservation.
- iOS HEIC, HEIF, or AVIF input.
- iOS HEIC, HEIF, or AVIF output.
- iOS metadata preservation.
- New public API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm example:ios:smoke
```

Candidate implementation validation before release promotion:

- Commit: `7bad5ac9032aaaf8147e67572a20cda046b87c50`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28500059159>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28500059163>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28500059174>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-webp-to-jpeg`, `RNICK_IOS_SMOKE_STEP_PASS compress-webp-to-png`, `RNICK_IOS_SMOKE_STEP_PASS reject-webp-output`, and `RNICK_IOS_SMOKE_PASS` with `webpResultBytes: 836`, `webpToPngResultBytes: 248`, `unsupportedInputs: ['heic', 'heif', 'avif']`, and `unsupportedOutputs: ['webp', 'heic', 'heif', 'avif']`.

Release commit validation before npm publish:

- Commit: `e62557b99a1ebf3bcbd879af21fc2ccc163d11a2`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28557446734>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28557446741>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28557446723>.
- `pnpm release:dry-run` completed successfully before npm publish, including `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, `pnpm pack --dry-run`, packed consumer smoke, and `pnpm publish --dry-run --no-git-checks`.

Completed after npm publish and GitHub Release creation:

- `pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.4`.
- `npm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json` confirmed version `0.2.4`, `latest` dist-tag `0.2.4`, registry tarball URL, integrity, shasum, and publish timestamp `2026-07-02T01:03:13.919Z`.
- npm package: `react-native-image-compression-kit@0.2.4`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.4.tgz`
- npm integrity: `sha512-f6cqSgAbvx0jg7soLOgiCWsc+e1MwpTN6/mV7T5yKbLsU64ENMmBvR6PBiW2s8KU2UxDCTUDVXU4SBRK/eC62A==`
- npm shasum: `5fca25a4a94937e59b089b46599705af77cf2ba0`
- `npm pack react-native-image-compression-kit@0.2.4 --json` confirmed the published tarball contains 49 files, 44.0 kB package size, and 186.9 kB unpacked size.
- The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.
- A fresh temporary consumer project installed `react-native-image-compression-kit@0.2.4` from the npm registry with `pnpm install --ignore-scripts` and completed `pnpm typecheck`.
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.4>.

## v0.2.3

Status: published to npm on July 1, 2026 at 06:09:45 UTC (15:09:45 KST), tagged as `v0.2.3`.

This release keeps Android runtime behavior unchanged while adding iOS GIF
static first-frame input to the existing iOS JPEG/PNG input and JPEG/PNG output
MVP.

### Goals

- Implement iOS GIF input without changing the public TypeScript API.
- Decode GIF input as a static first frame and route it through the existing iOS resize, JPEG quality, JPEG target-size `maxBytes`, PNG output, and metadata no-copy behavior.
- Align iOS capability reporting, README guidance, TypeScript native-unavailable messaging, source-level expectations, and host-app smoke validation with the new GIF input support.

### Included

- `package.json` version bump to `0.2.3`.
- iOS `compressImage()` now accepts GIF input for JPEG and PNG output.
- iOS GIF input is decoded with ImageIO as a static first frame through `CGImageSourceCreateImageAtIndex`.
- GIF input to JPEG output keeps resize, `output.quality`, and JPEG `output.maxBytes` behavior.
- GIF input to PNG output keeps resize behavior and re-encodes without copying source metadata.
- iOS `safe` and `strip` metadata policies continue to re-encode without copying source metadata.
- iOS `getImageCompressionCapabilities()` reports GIF `input=true` and `output=false`.
- iOS GIF format notes state that GIF input is static first-frame only and that GIF output and animation preservation are not implemented.
- The iOS host-app smoke validates `compress-gif-to-jpeg` and `compress-gif-to-png`, and removes GIF from the unsupported-input rejection loop.
- The iOS host-app smoke keeps `reject-gif-output` as an `ERR_INVALID_OPTIONS` TypeScript validation check because GIF output is not part of the public output format surface.
- TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF input and static first-frame GIF support.
- README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the implemented iOS GIF input path.

### Not Included

- Android runtime behavior changes.
- GIF output.
- GIF animation preservation.
- Animated WebP handling.
- iOS WebP, HEIC, HEIF, or AVIF input.
- iOS WebP, HEIC, HEIF, or AVIF output.
- iOS metadata preservation.
- New public API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm example:ios:smoke
```

Actual implementation validation before the release commit:

- Commit: `62a1c3fb4763f5977592c8e7c917246ce6be2fe2`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28493712854>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28493712886>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28493712935>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-gif-to-jpeg`, `RNICK_IOS_SMOKE_STEP_PASS compress-gif-to-png`, `RNICK_IOS_SMOKE_STEP_PASS reject-gif-output`, and `RNICK_IOS_SMOKE_PASS` with `gifResultBytes: 840`, `gifToPngResultBytes: 331`, and `unsupportedInputs: ['webp', 'heic', 'heif', 'avif']`.

Release commit validation before npm publish:

- Commit: `8d2394dfaf4b5ba5bc322fd766328624b7abc92d`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28496763807>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28496763836>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28496763804>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-gif-to-jpeg`, `RNICK_IOS_SMOKE_STEP_PASS compress-gif-to-png`, `RNICK_IOS_SMOKE_STEP_PASS reject-gif-output`, and `RNICK_IOS_SMOKE_PASS` with `gifResultBytes: 840`, `gifToPngResultBytes: 331`, and `unsupportedInputs: ['webp', 'heic', 'heif', 'avif']`.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, use a current passkey or one-time password:

```bash
pnpm whoami
pnpm publish --tag latest
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json
npm pack react-native-image-compression-kit@0.2.3 --json
```

Completed after npm publish and GitHub Release creation:

- `pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.3`.
- `pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json` confirmed version `0.2.3`, `latest` dist-tag `0.2.3`, registry tarball URL, integrity, shasum, and publish timestamp `2026-07-01T06:09:45.481Z`.
- npm package: `react-native-image-compression-kit@0.2.3`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.3.tgz`
- npm integrity: `sha512-ns/m3ZmUdTyT+kVWjCWEzWMVE0Ydu9VtWkm361pg6TEpufEN6ImV9tK9e7iSmlwjvmeZESlUiduGdAr/7rJEXQ==`
- npm shasum: `d420053faf7d4e460c4cd41c99fb489c6d017dbd`
- `npm pack react-native-image-compression-kit@0.2.3 --json` confirmed the published tarball contains 49 files, 43.7 kB package size, and 185.0 kB unpacked size.
- The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.3>.

## v0.2.2

Status: published to npm on June 30, 2026 at 10:50:12 UTC (19:50:12 KST), tagged as `v0.2.2`.

This release keeps Android runtime behavior unchanged while adding PNG output
to the existing iOS JPEG/PNG input MVP.

### Goals

- Implement iOS PNG output without changing the public TypeScript API.
- Keep iOS PNG behavior aligned with Android where applicable: PNG output ignores `quality`, preserves alpha where the processed image contains transparency, and rejects `output.maxBytes`.
- Align iOS capability reporting, README guidance, source-level expectations, and host-app smoke validation with the new PNG output support.

### Included

- `package.json` version bump to `0.2.2`.
- iOS `compressImage()` now accepts `output.format: 'png'` for JPEG and PNG input.
- iOS PNG output is encoded with `UIImagePNGRepresentation()` into the app cache directory.
- iOS PNG output keeps resize support and ignores `output.quality`.
- iOS PNG output rejects `output.maxBytes` with `ERR_NOT_IMPLEMENTED`.
- iOS `getImageCompressionCapabilities()` reports PNG `input=true` and `output=true`.
- iOS format notes now state that PNG output preserves alpha where possible and does not support target-size `maxBytes`.
- The iOS host-app smoke validates JPEG-to-PNG and PNG-to-PNG output, plus PNG `maxBytes` rejection.
- TypeScript native-unavailable messaging now mentions iOS JPEG/PNG output support.
- README iOS limitation, public API, target-size mode, roadmap, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the implemented iOS PNG output path.

### Not Included

- Android runtime behavior changes.
- iOS WebP, HEIC, HEIF, AVIF, or GIF output.
- WebP, HEIC, HEIF, AVIF, or GIF input on iOS.
- iOS metadata preservation.
- New public API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
```

Actual implementation validation before the release commit:

- Commit: `8ff9345a882243459bb6c1d44a2b4c1802296370`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28436846165>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28436846207>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28436846121>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-jpeg-to-png`, `RNICK_IOS_SMOKE_STEP_PASS compress-png-to-png`, `RNICK_IOS_SMOKE_STEP_PASS reject-png-max-bytes`, and `RNICK_IOS_SMOKE_PASS` with `jpegToPngResultBytes: 805`, `pngToPngResultBytes: 672`, and `unsupportedOutputs` excluding `png`.

Release commit validation before npm publish:

- Commit: `8b00f730a9a9d4e37afe78434943ec69556dba80`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28438265776>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28438265781>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28438265837>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-jpeg-to-png`, `RNICK_IOS_SMOKE_STEP_PASS compress-png-to-png`, `RNICK_IOS_SMOKE_STEP_PASS reject-png-max-bytes`, and `RNICK_IOS_SMOKE_PASS` with `jpegToPngResultBytes: 805`, `pngToPngResultBytes: 672`, and `unsupportedOutputs` excluding `png`.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, use a current passkey or one-time password:

```bash
pnpm whoami
pnpm publish --tag latest
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity time --json
npm pack react-native-image-compression-kit@0.2.2
```

Completed after npm publish:

- `pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.2`.
- `pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json` confirmed version `0.2.2`, `latest` dist-tag `0.2.2`, registry tarball URL, integrity, shasum, and publish timestamp `2026-06-30T10:50:12.131Z`.
- npm package: `react-native-image-compression-kit@0.2.2`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.2.tgz`
- npm integrity: `sha512-E7fzlLfMxAJhQim1xFbX9b5aEIFDtifHNYNlk7IM5+LrDgtINAR4moUe8MrPglfjJ/zpZAxcDH5eL6IlFzgzlQ==`
- npm shasum: `0bf7a4c554745d557e31787a78869895945d46df`
- `npm pack react-native-image-compression-kit@0.2.2 --json` confirmed the published tarball contains 49 files, 43.2 kB package size, and 182.2 kB unpacked size.
- The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.2>.

## v0.2.1

Status: published to npm on June 30, 2026 at 09:37:20 UTC (18:37:20 KST), tagged as `v0.2.1`.

This release keeps Android runtime behavior unchanged while adding iOS JPEG
target-size compression to the existing iOS JPEG MVP.

### Goals

- Implement iOS JPEG output `output.maxBytes` without changing the public TypeScript API.
- Keep iOS target-size semantics aligned with Android: treat `quality` as the upper quality bound, search for the highest JPEG quality that fits under `maxBytes`, and return the smallest generated JPEG if the target cannot be reached.
- Align iOS capability reporting, README guidance, source-level expectations, and host-app smoke validation with the new JPEG target-size support.

### Included

- `package.json` version bump to `0.2.1`.
- iOS `compressImage()` now accepts `output.maxBytes` for JPEG output.
- iOS JPEG target-size compression validates `maxBytes` as a positive integer and encodes JPEG candidates across the allowed quality range.
- iOS `getImageCompressionCapabilities()` reports `supportsTargetSizeCompression: true`.
- iOS format notes now state that JPEG output supports `maxBytes` by adjusting JPEG quality.
- The iOS host-app smoke validates a JPEG target-size case and asserts `byteSize <= maxBytes`.
- TypeScript native-unavailable messaging now mentions iOS JPEG target-size support.
- README iOS limitation, public API, target-size mode, roadmap, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the implemented iOS JPEG target-size path.

### Not Included

- Android runtime behavior changes.
- iOS PNG, WebP, HEIC, HEIF, AVIF, or GIF output.
- WebP, HEIC, HEIF, AVIF, or GIF input on iOS.
- iOS metadata preservation.
- New public API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
```

Actual implementation validation before the release commit:

- Commit: `ab85c398e4aa266dc98bd7eb4f20ae59dcdebd78`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432011263>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432011301>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432011306>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-jpeg-to-jpeg-max-bytes` and `RNICK_IOS_SMOKE_PASS` with `targetSizeResultBytes: 996` for `maxBytes: 1000`.

Release commit validation before npm publish:

- Commit: `fee74b895e471a2132b3f233dad7b9a5797c237f`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432929488>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432929458>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432929468>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-jpeg-to-jpeg-max-bytes` and `RNICK_IOS_SMOKE_PASS` with `targetSizeResultBytes: 996` for `maxBytes: 1000`.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, use a current passkey or one-time password:

```bash
pnpm whoami
pnpm publish --tag latest
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity time --json
npm pack react-native-image-compression-kit@0.2.1
```

Completed after npm publish:

- `pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.1`.
- `npm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json` confirmed version `0.2.1`, `latest` dist-tag `0.2.1`, registry tarball URL, integrity, shasum, and publish timestamp `2026-06-30T09:37:20.896Z`.
- npm package: `react-native-image-compression-kit@0.2.1`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.1.tgz`
- npm integrity: `sha512-4gJD35dySJmtRKHfUW23iLNbFrv7R8ow1trLOl7BHQXduHIP49+AuSYewexTa39vGnl/pniANpMVwFEUgVtZlA==`
- npm shasum: `8b5bd26e2fe46b9b6b340b72a656beb41ad798f9`
- `npm pack react-native-image-compression-kit@0.2.1 --json` confirmed the published tarball contains 49 files, 42.9 kB package size, and 180.5 kB unpacked size.
- The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.1>.

## v0.2.0

Status: published to npm on June 30, 2026 at 07:04:03 UTC (16:04:03 KST), tagged as `v0.2.0`.

This release keeps Android runtime behavior unchanged while replacing the iOS
package stub with a native iOS JPEG compression MVP.

### Goals

- Implement iOS native `compressImage()` for local JPEG and PNG input.
- Support iOS JPEG output with `output.quality`, optional resize, and cache-file result metadata.
- Report iOS runtime capabilities for JPEG input/output, PNG input, metadata policies, target-size compression, and cancellation.
- Align README guidance, TypeScript native-unavailable messaging, and test expectations with the implemented iOS MVP.
- Validate the iOS MVP through a React Native iOS host app, not only source-level checks.

### Included

- `package.json` version bump to `0.2.0`.
- iOS `compressImage()` reads `file://` and best-effort `content://` source URIs.
- iOS input detection accepts JPEG and PNG only, rejecting other formats with `ERR_UNSUPPORTED_FORMAT`.
- iOS output supports JPEG only, rejecting unsupported output formats with `ERR_NOT_IMPLEMENTED`.
- iOS resize supports `contain`, `cover`, and `stretch`.
- iOS `output.quality` supports integer quality values from `0` to `100`, defaulting to `80`.
- iOS `metadata: 'safe'` and `metadata: 'strip'` are accepted and re-encode without copying source metadata.
- iOS `metadata: 'preserve'` and `output.maxBytes` reject with `ERR_NOT_IMPLEMENTED`.
- iOS `getImageCompressionCapabilities()` reports `metadataPolicies: ['safe', 'strip']`, JPEG `input=true` and `output=true`, PNG `input=true` and `output=false`, `supportsTargetSizeCompression: false`, and `supportsCancellation: false`.
- README iOS support matrix, public API guidance, roadmap, installation status, and release dry-run wording updates.
- Focused TypeScript and source-level native foundation test expectation updates for the `0.2.0` release.
- React Native iOS example host app under `example/ios`.
- iOS example `ExampleImageSource` native module for generated JPEG, PNG, GIF, WebP, HEIC, HEIF, and AVIF smoke fixtures.
- `scripts/ios-validation.mjs` with `pods`, `build`, and `smoke` modes.
- `pnpm example:ios:pods`, `pnpm example:ios:build`, and `pnpm example:ios:smoke` scripts.
- GitHub Actions iOS Validation workflow that runs the host-app smoke on a macOS runner.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.0` and GitHub Release `v0.2.0`.

### Not Included

- Android runtime behavior changes.
- HEIC / HEIF / AVIF / GIF / WebP input on iOS.
- PNG, WebP, HEIC, HEIF, AVIF, or GIF output on iOS.
- iOS target-size compression.
- iOS metadata preservation.

### Published Artifacts

- npm package: `react-native-image-compression-kit@0.2.0`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.0.tgz`
- npm integrity: `sha512-YUsh/bwcU/ScsWu5RGQT/CEZaQ6dL9xCgoYfHOHalJkEeWicv9lT7HqEGhle84EUTLL8a8T3vefw+fso7kPj6Q==`
- Git tag: `v0.2.0`
- GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.0`
- Published tarball size: 41.1 kB package size, 176.1 kB unpacked size, 49 files.

### Release Checklist

The `v0.2.0` release completed these checks before npm publish:

```bash
git status --short --branch
```

Release validation gate:

```bash
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
```

If an iOS build environment is available, also run a host-app iOS build or
native smoke test that links the pod and compresses a JPEG and PNG source to
JPEG output.

```bash
pnpm example:ios:pods
pnpm example:ios:build
pnpm example:ios:smoke
```

The iOS host-app smoke should produce `RNICK_IOS_SMOKE_PASS` after validating
capability reporting, JPEG and PNG to JPEG runtime compression, unsupported
WebP/HEIC/HEIF/AVIF/GIF input errors, unsupported non-JPEG output errors,
`output.maxBytes`, and `metadata: 'preserve'`.

Actual iOS host-app validation result for the implementation candidate:

- Date: June 30, 2026 UTC.
- Commit: `5bf0bcc6045175b3fe9efa9a2b5867fc32a63cc3`.
- GitHub Actions iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28424614173>.
- Environment: macOS GitHub Actions runner, Xcode 26.5, iPhoneSimulator 26.5 SDK, iPhone 17 Pro simulator on iOS 26.4.1.
- Native install/build evidence: CocoaPods installed 76 pods, React Native autolinked `react-native-image-compression-kit`, and `xcodebuild` completed with `BUILD SUCCEEDED`.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_PASS` with `jpegResultBytes: 946`, `pngResultBytes: 1034`, `unsupportedInputs: ['webp', 'heic', 'heif', 'avif', 'gif']`, and `unsupportedOutputs: ['png', 'webp', 'heic', 'heif', 'avif']`.
- Same-commit CI evidence: CI passed at <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28424614148> and Android Instrumentation passed at <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28424614133>.
- Release documentation evidence: CI passed at <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28425030936>, Android Instrumentation passed at <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28425030943>, and iOS Validation passed at <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28425030985>.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, use a current passkey or one-time password:

```bash
pnpm whoami
pnpm publish --tag latest
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity time --json
npm pack react-native-image-compression-kit@0.2.0
```

### Post-publish Verification

Completed after npm publish:

- `pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.0`.
- `pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity time --json` confirmed version `0.2.0`, `latest` dist-tag `0.2.0`, registry tarball URL, integrity, and publish timestamp `2026-06-30T07:04:03.022Z`.
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.0.tgz`
- npm integrity: `sha512-YUsh/bwcU/ScsWu5RGQT/CEZaQ6dL9xCgoYfHOHalJkEeWicv9lT7HqEGhle84EUTLL8a8T3vefw+fso7kPj6Q==`
- `npm pack react-native-image-compression-kit@0.2.0` confirmed the published tarball contains 49 files, 41.1 kB package size, 176.1 kB unpacked size, and shasum `850a32e69d3c398e58b129ea330bc3d5a27eb5fd`.
- The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.
- A fresh temporary consumer project installed `react-native-image-compression-kit@0.2.0` from the npm registry with `pnpm install --ignore-scripts` and completed `pnpm typecheck` against public imports and types.
- GitHub Release `v0.2.0` was created at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.0`.

## v0.1.2

Status: published to npm on June 30, 2026 at 02:18:30 UTC (11:18:30 KST), tagged as `v0.1.2`.

This patch keeps Android runtime behavior unchanged while making the iOS stub
experience explicit across native errors, TypeScript fallback errors, README
guidance, and runtime capability reporting.

### Purpose

- Clarify that iOS ships a native package stub and iOS compression is not implemented.
- Preserve a stable iOS `ERR_NOT_IMPLEMENTED` compression failure with a message that points developers to capability checks.
- Make iOS capability reporting show no supported input formats, output formats, metadata policies, target-size compression, or cancellation.
- Update the TypeScript native-unavailable message so missing native module errors no longer imply that Android is unimplemented.
- Publish package metadata for `0.1.2` after the release candidate passed local and GitHub Actions validation.

### Published Artifacts

- npm package: `react-native-image-compression-kit@0.1.2`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.1.2.tgz`
- npm integrity: `sha512-OOHIV4Lnmu+16/W8iGMZriiYXLbB9nIVV0vBz4dd3erW3meaSqV28JkWpc/5FetIz0HcLU/4Pfgq8eTZ8fIY6g==`
- Git tag: `v0.1.2`
- GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.2`
- Published tarball size: 35.3 kB package size, 146.8 kB unpacked size, 49 files.

### Included

- iOS stub `compressImage()` error message aligned to the package-stub state.
- iOS `getImageCompressionCapabilities()` reports `metadataPolicies: []`, format `input=false`, format `output=false`, `supportsTargetSizeCompression: false`, and `supportsCancellation: false`.
- TypeScript `ERR_NATIVE_MODULE_UNAVAILABLE` message distinguishes install/linking failure from the expected iOS stub `ERR_NOT_IMPLEMENTED` path.
- README iOS stub behavior guidance and release dry-run wording updates.
- `package.json` version bump to `0.1.2`.
- Focused test and Android verification doctor expectation updates for the `0.1.2` release.

### Not Included

- iOS compression implementation.
- Android runtime behavior changes.
- New supported input or output formats.

### Pre-publish Checklist

Before publishing `v0.1.2`, confirm the working tree and branch are correct:

```bash
git status --short --branch
```

Run the release-candidate verification gate:

```bash
pnpm verify
pnpm example:typecheck
git diff --check
```

For packaging validation before promotion, also run:

```bash
pnpm release:dry-run
```

After local validation, commit the prepared patch, push the release commit, and
wait for GitHub Actions CI success on the pushed commit.

Only after the release commit and CI are confirmed, create and push the
annotated tag:

```bash
git tag -a v0.1.2 -m "v0.1.2"
git push origin v0.1.2
```

Do not run the tag commands as part of local candidate preparation. They are a
manual promotion step after validation and CI are green.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, pass a current one-time password:

```bash
pnpm login --registry=https://registry.npmjs.org/
pnpm whoami
pnpm publish --otp 123456
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version dist.integrity time --json
npm pack react-native-image-compression-kit@0.1.2
```

### Post-publish Verification

Completed after npm publish:

- `npm publish --tag latest` published `react-native-image-compression-kit@0.1.2`.
- `pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity time --json` confirmed version `0.1.2`, `latest` dist-tag `0.1.2`, registry tarball URL, integrity, and publish timestamp `2026-06-30T02:18:30.591Z`.
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.1.2.tgz`
- npm integrity: `sha512-OOHIV4Lnmu+16/W8iGMZriiYXLbB9nIVV0vBz4dd3erW3meaSqV28JkWpc/5FetIz0HcLU/4Pfgq8eTZ8fIY6g==`
- `npm pack react-native-image-compression-kit@0.1.2` confirmed the published tarball contains 49 files, 35.3 kB package size, and 146.8 kB unpacked size.
- The published tarball includes the README, iOS native stub, built JS, TypeScript declarations, Codegen source, Android runtime source, package metadata, SECURITY, and LICENSE.
- Published tarball inspection confirmed the iOS `ERR_NOT_IMPLEMENTED` message, `metadataPolicies: []`, no iOS input/output format support notes, and TypeScript native-unavailable message are present.
- A fresh temporary consumer project installed `react-native-image-compression-kit@0.1.2` from the npm registry with `pnpm install --ignore-scripts` and completed `pnpm typecheck` against public imports and types.
- GitHub Release `v0.1.2` was created at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.2`.

## v0.1.1

Status: prepared for a docs-only npm patch release. This preparation does not
publish to npm, create a git tag, or push commits.

This patch corrects the README content that appears on the npm package page
after the Android `0.1.0` release. It aligns the first-screen project status
with the real registry state: the Android MVP is published, while iOS remains a
package stub and iOS compression is not implemented.

### Purpose

- Remove stale README wording that said the package had not been published to npm.
- Replace React Native and TypeScript badge values that still described those surfaces as planned.
- Make the README first screen clear that Android MVP runtime compression is published and iOS is stubbed/not implemented.
- Bump package metadata to `0.1.1` so the next npm publish can update the package page with corrected docs.
- Keep the `v0.1.0` release notes as the source for the original Android MVP artifact details.

### Included

- README status, badges, public API wording, installation wording, and release checklist wording updates.
- `package.json` version bump to `0.1.1`.
- `RELEASE.md` entry for this docs-only patch release.
- Repository verification expectations updated for the `0.1.1` preparation state.

### Not Included

- Android runtime behavior changes.
- iOS compression implementation.
- New native APIs or package exports.
- npm publish, git tag creation, or git push.

### Pre-publish Checklist

Before publishing `v0.1.1`, confirm the working tree and branch are correct:

```bash
git status --short --branch
```

Confirm the registry state and intended version:

```bash
pnpm view react-native-image-compression-kit version versions time --json
```

Run the release dry-run gate:

```bash
pnpm release:dry-run
```

After local validation, commit the prepared docs-only release, push the release
commit, and wait for GitHub Actions CI success on the pushed commit.

Only after the release commit and CI are confirmed, create and push the
annotated tag:

```bash
git tag -a v0.1.1 -m "v0.1.1"
git push origin v0.1.1
```

Do not run the tag commands as part of local dry-run preparation. They are a
manual promotion step after validation and CI are green.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, pass a current one-time password:

```bash
pnpm login --registry=https://registry.npmjs.org/
pnpm whoami
pnpm publish --otp 123456
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version dist.integrity time --json
npm pack react-native-image-compression-kit@0.1.1
```

### Post-publish Verification

Completed after npm publish:

- `pnpm publish --no-git-checks` published `react-native-image-compression-kit@0.1.1`.
- `npm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity time --json` confirmed version `0.1.1`, `latest` dist-tag `0.1.1`, registry tarball URL, integrity, and publish timestamp `2026-06-29T07:18:19.684Z`.
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.1.1.tgz`
- npm integrity: `sha512-pnLxeyn/JVKykGbOKrS9GYoU+pKr/oq4nffdHPn97ycjOw//RD6Yd6BGUPNuRcVoqnS17QsYgGx2c5JXWQq4BA==`
- `npm pack react-native-image-compression-kit@0.1.1` confirmed the published tarball contains 49 files, 35.1 kB package size, and 144.8 kB unpacked size.
- The published tarball and a fresh registry install both include the corrected README status, Android MVP published badge, Android MVP / iOS stub platform badge, React Native Codegen-ready badge, TypeScript API-available badge, and iOS stub/not implemented wording.
- Published README verification found no stale `has not been published to npm yet`, `React%20Native-planned`, or `TypeScript-planned` snippets.
- A fresh temporary consumer project installed `react-native-image-compression-kit@0.1.1` from the npm registry with `pnpm install --ignore-scripts` and completed `pnpm typecheck` against public imports and types.

## v0.1.0

Status: published to npm on June 27, 2026 at 10:51:55 UTC (19:51:55 KST), tagged as `v0.1.0`.

This release note describes the first public package release for
`react-native-image-compression-kit`, published as
`react-native-image-compression-kit@0.1.0`. It should stay aligned with the
Android MVP implementation and the README.

### Published Artifacts

- npm package: `react-native-image-compression-kit@0.1.0`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.1.0.tgz`
- npm integrity: `sha512-W8kaa3eKdWVLHCGeApdOqNMfeD7np42OcgjGCUZAQDZqzx86diybRtEqK+MJtX73Yt4wLcVKOtb62sPtLJLk9g==`
- Git tag: `v0.1.0`
- GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.0`
- Published tarball size: 34.2 kB package size, 142.2 kB unpacked size, 48 files.

### Included

- Android MVP only. iOS exports the package stub, but iOS compression is not implemented.
- TypeScript API exports, validation, React Native Codegen spec, and Android native module wiring.
- `file://` and `content://` local URI sources.
- JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input.
- GIF input is decoded as a static first frame.
- HEIC / HEIF input is SDK-gated: Android API 28+ uses ImageDecoder, Android API 26-27 attempts a guarded BitmapFactory fallback, and lower API levels reject as unsupported.
- Android 14+ AVIF input through the platform ImageDecoder path for baseline still images.
- JPEG EXIF orientation correction before resize and output encoding.
- Resize with `contain`, `cover`, and `stretch`.
- JPEG, PNG, and WebP output.
- Quality handling for JPEG and WebP output; PNG output ignores quality.
- Target-size compression with maxBytes for JPEG and WebP output; PNG output rejects maxBytes.
- Metadata policies preserve, safe, and strip for JPEG source to JPEG output.
- Runtime capability reporting through `getImageCompressionCapabilities()`.
- Package metadata, pack dry-run, consumer smoke test, and npm publish dry-run checks.

### Not Included

- iOS compression is not implemented.
- AVIF output is not implemented.
- HEIC / HEIF output is not implemented.
- GIF output and animation preservation are not implemented.
- Animated WebP and animated AVIF preservation are not implemented.
- Metadata support for non-JPEG formats and iOS is not implemented.
- Cancellation and progress callbacks are not implemented.

### Release Checklist

The `v0.1.0` release completed these checks before npm publish:

- Confirm `package.json` still has version `0.1.0`.
- Review this v0.1.0 release note and README release status for consistency with the implemented Android MVP.
- Confirm the working tree and branch are correct:

```bash
git status --short --branch
```

- Run the release dry-run gate:

```bash
pnpm release:dry-run
```

- Push the release commit and wait for GitHub Actions CI success on `master`.
- Keep the Android Instrumentation workflow result in mind for codec-backed HEIC / HEIF / AVIF validation.
- Only after the release commit and CI are confirmed, create and push the annotated tag:

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

Do not run the tag commands as part of the dry-run checklist. They are a manual
promotion step after local validation and GitHub Actions CI are green.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, pass a current one-time password:

```bash
pnpm login --registry=https://registry.npmjs.org/
pnpm whoami
pnpm publish --otp 123456
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version dist.integrity
```

### Post-publish Security Review

Completed after npm publish:

- `pnpm view react-native-image-compression-kit version dist.tarball dist.integrity time --json` confirmed version `0.1.0`, registry tarball URL, integrity, and publish timestamp.
- `npm pack react-native-image-compression-kit@0.1.0` confirmed the published tarball contains 48 files and excludes development-only scripts, tests, fixtures, example app files, build directories, and debug keystores.
- The published `package.json` contains no `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, `postpack`, `publish`, or `postpublish` lifecycle scripts.
- Registry tarball forbidden-file scan found no `.env*`, `.npmrc`, key files, debug keystore, Android test directories, example app files, or repository scripts.
- Registry tarball secret-like string scan found no npm tokens, GitHub tokens, auth tokens, private key blocks, passwords, or broad secret markers.
- `pnpm audit --prod` reported no known vulnerabilities.

### External Install Smoke

Completed after npm publish and GitHub Release creation:

- Created a fresh temporary consumer project outside this repository.
- Installed `react-native-image-compression-kit@0.1.0` from the npm registry with `pnpm install --ignore-scripts`.
- Confirmed dependency resolution with `pnpm list react-native-image-compression-kit react-native react --depth 0`.
- Typechecked imports for `compressImage`, `getImageCompressionCapabilities`, `ImageCompressionKitError`, `CompressionOptions`, `CompressionResult`, and `ImageCompressionCapabilities`.
- `pnpm typecheck` completed successfully in the external consumer project.

The GitHub Release was created from this note:

```bash
gh release create v0.1.0 --title "v0.1.0" --notes-file RELEASE.md
```
