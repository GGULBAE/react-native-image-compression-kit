# Release Notes

This file keeps the current release work and the most recent release evidence.
Complete prior notes are preserved in [0.2 release history](docs/releases/0.2-history.md).

## v0.4.0

<!-- release-status:start -->
- Package version: `0.4.0`
- npm latest: `0.3.0`
- Release state: `candidate`
- Registry checked at: `2026-07-20`
<!-- release-status:end -->

- Scope: large-image resilience, non-blocking native work, bounded concurrency,
  decode-time downsampling, resource limits, cancellation, transactional
  outputs, and alpha contract validation

This candidate preserves existing `compressImage(options)` usage while adding
an optional AbortSignal-compatible control. Android and iOS now limit native
compression to two concurrent operations, reject unsafe source/working sizes
before full decode, and clean incomplete outputs on every failure or
cancellation path. iOS codec work is ImageIO/CoreGraphics-based and no longer
runs on the main queue.

### Included

- Stable `ERR_CANCELLED` and `ERR_RESOURCE_LIMIT` public/native contracts.
- `BitmapFactory.inSampleSize`, `ImageDecoder.setTargetSize`, and ImageIO
  thumbnail downsampling sized for contain, cover, stretch, and orientation.
- Operation-specific temporary output plus atomic publication and cleanup.
- Additive runtime capability fields for concurrency, downsampling, and named
  limits.
- 48MP, dimension overflow, queued/running cancellation, settle-once,
  target-search cancellation, cleanup, and alpha decode-back coverage.

### Not included

- Batch compression, progress events, new output codecs, animation
  preservation, remote/data inputs, publication, dist-tags, tags, or GitHub
  Releases.

### Candidate validation

```bash
pnpm verify
pnpm example:typecheck
pnpm smoke:consumer
pnpm docs:check
pnpm site:check
pnpm site:build
pnpm fixtures:compatibility:check
pnpm example:android-unit-test
pnpm example:android-instrumentation
pnpm example:ios:large-image-test
git diff --check
pnpm pack --dry-run
```

## v0.3.0

- Package version: `0.3.0`
- npm latest: `0.3.0`
- Release state: `release`
- Registry checked at: `2026-07-18`

- Scope: public support contract, user documentation and native-result demo,
  compatibility evidence, community health, protected repository settings,
  OIDC trusted publishing, and an exact-artifact public launch

The release keeps native compression and output behavior unchanged. It adds the
public surfaces and operational controls required for a reproducible open
source launch. The exact Android/iOS compatibility matrix and public Pages
deployment are green. npm `0.3.0` was published from exact protected source
`f8ad71f14ac50dac9dc433a46ee4e9a6d7e1bca7` through OIDC trusted publishing,
and the immutable [v0.3.0 GitHub Release](https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.3.0)
contains the matching tarball, checksum, provenance metadata, and registry
consumer-smoke manifest.

### Included

- Android 23+, iOS 13.4+, React Native architecture, Node, Bare React Native,
  and Expo development-build compatibility contracts backed by release gates.
- A VitePress public site, typed integration guides, an option-to-code builder,
  and traceable Android/iOS native-result demo artifacts.
- Targeted example-app presentation refactoring without native pipeline changes.
- Contribution, support, governance, issue, pull request, security-reporting,
  changelog, and discoverability surfaces.
- Protected branch/tag and repository-setting audits.
- One-tarball OIDC npm trusted publishing, registry verification, immutable
  GitHub Release, and existing release-evidence handoff.
- A launch kit that is ready for separately approved public announcements.

### Not included

- New codecs, native compression behavior, cancellation, progress, or browser
  compression.
- Expo Go, App Store/Play Store distribution, v1.0 stability, paid marketing,
  tracking analytics, Changesets, or semantic-release.
- Rewriting historical release-evidence policy, digests, or archives.

### Release validation

- Exact compatibility evidence:
  [run 29639654333](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29639654333)
  passed React Native 0.73.11 Legacy, React Native 0.86.0 Legacy/New, and Expo
  57.0.7 development-build consumers on Android and iOS.
- Exact native demo evidence:
  [run 29639654302](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29639654302)
  produced the checked Android/iOS assets and digest manifest.
- Public Pages evidence:
  [run 29641396874](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29641396874)
  built, audited, and deployed the public documentation site from protected
  `master`.
- Exact publication evidence:
  [run 29641603870](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29641603870)
  passed source/artifact preflight and all eight compatibility lanes, then
  published the 58,780-byte tarball with npm OIDC provenance. Its continuation
  stopped after npm 12 returned an unrecognized array-shaped registry response;
  no package, tag, dist-tag, or Release asset was replaced.
- Exact registry evidence:
  [run 29643434413](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29643434413)
  independently confirmed SHA-512 integrity, SLSA provenance metadata,
  `latest` resolution, the 79-file inventory, packed README status, and a fresh
  registry consumer install from immutable tag `v0.3.0`. The matching retained
  evidence archive is replayed by `pnpm verify:release-evidence -- --version
  0.3.0`.
- Policy-review evidence:
  [run 29644362987](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29644362987)
  reviewed the exact v0.3.0 candidate, rehearsed the complete four-version
  archive set, and attested the canonical review manifest. The retained review
  archive replays offline through `pnpm verify:release-evidence-review-archive
  -- --version 0.3.0`.

```bash
pnpm verify
pnpm example:typecheck
pnpm docs:check
pnpm site:check
pnpm site:build
pnpm fixtures:compatibility:check
pnpm release:dry-run
git diff --check
pnpm pack --dry-run
```

`pnpm release:dry-run` must pass without publishing. The trusted release remains
fail-closed unless package, README, RELEASE, registry state, protected source
SHA, and exact tarball identity stay aligned.

The first post-publish continuation exposed an npm 12 transport-shape change:
multi-field exact-version `npm view --json` responses are single-item arrays.
The release artifact was already published correctly; the follow-up repository
fix normalizes npm 11 object and npm 12 array responses and keeps polling until
the semantic publication action is `resume`.

## v0.2.62

- Package version: `0.2.62`
- npm latest: `0.2.62`
- Release state: `release`
- Registry checked at: `2026-07-17`

- Scope: documentation information architecture, semantic status gates,
  repository verification contract decomposition, Android request parsing, and
  source/decode/bitmap-transform boundary extraction, plus iOS request and
  source/inspection, image-decoder, resize/render, JPEG metadata, and output
  encoder/persistence and pipeline orchestration ownership boundaries

This work separates the npm user README from repository-only release
operations. It adds a network-free documentation gate for semantic status,
required headings/links/commands, file existence, internal Markdown links and
anchors, README size, and npm package exclusions.

The packed README stale validator reads only the marked current-status block.
Historical candidate text outside that block is ignored. The shared state
matrix blocks `candidate` and permits `release`; Android doctor consumes the
same semantic result instead of matching release procedure sentences.

The repository-only [release status manifest](docs/release-status.json) is the
authority for npm latest, release state, and the registry check date. Package
version remains authoritative in `package.json`; the README and this release
block are validated mirrors.

Repository verification is split by contract instead of one Android-named
umbrella test. Package shape, documentation, Android wiring, iOS wiring, and
workflow supply chain each have an explicit authority. Native behavior remains
owned by Kotlin unit/instrumentation tests and the iOS host-app smoke gates;
doctor checks their structure and presence without copying implementation
sentences.

The Android bridge now delegates `ReadableMap` parsing and validation to an
immutable typed request boundary. Output selection, metadata, target-size,
resize, and source URI validation retain their existing error codes and
messages. File/content source access and platform decode now flow through a
ContentResolver-injected source resolver and typed decoder result. Decode
order and EXIF orientation remain unchanged. Orientation and resize now flow
through a typed bitmap transformer whose ownership scope releases original,
rotated, scaled, and cropped bitmaps exactly once. Metadata copy and encode
behavior are unchanged.

The iOS bridge now delegates option parsing and static validation to an
immutable, Foundation-only request boundary. Source URI, output selection,
quality, target size, metadata, and resize defaults/errors are covered by a
table-driven native executable. Runtime WebP availability is still determined
through ImageIO and queried only for WebP output, preserving validation order.
Source URI acquisition now flows through a Foundation-only resolver with
injected data/security-scope hooks, and ImageIO type/signature classification
flows through an immutable input inspector with bridge-provided AVIF runtime
availability. UIImage decode and ImageIO first-frame selection now flow through
an immutable decoder result/error boundary with injected decode, validation,
and main-thread executor hooks. Resize geometry now flows through immutable
transform request, geometry, result, and error models; the UIKit default owns
pixel-size lookup, opaque white versus alpha-preserving backgrounds,
`UIGraphicsImageRenderer`, and main-thread rendering. Capability projection
moved unchanged to a private helper so the bridge stays focused on
orchestration. JPEG metadata preserve eligibility, ImageIO source-property
reading, and destination orientation/dimension normalization now flow through
immutable request/result/error models with an injected source-property reader.
The bridge and encoder no longer manipulate metadata dictionaries directly;
the JPEG metadata result supplies destination properties to the platform
encoder. Format routing and target-size binary search now flow through an
immutable encoder request/result/error boundary with injected JPEG, PNG, WebP,
and synchronous executor hooks. The UIKit/ImageIO default owns codec calls,
WebP destination discovery, and main-thread execution. Cache directory and
extension selection, timestamp/UUID path generation, atomic file writes, and
`CompressionResult` projection now flow through a Foundation-only output owner
with injected filesystem, clock, and identifier hooks. A Foundation-only
compression pipeline now owns the complete request, input, metadata, decode,
transform, encode, and output sequence through injected stage adapters. The
ImageIO-backed default supplies WebP/AVIF runtime providers and the native smoke
stage observer. The bridge is limited to Codegen argument conversion, promise
mapping, and capability projection. Output URI, stable errors, stage order,
metrics, metadata copy, and encoded output behavior are unchanged.

### Included

- `package.json` as the package-version authority, with aligned
  README/RELEASE/SECURITY/Vitest coverage.
- npm-focused README with current support, installation, API examples,
  limitations, verification, and repository documentation links.
- Repository-only release-evidence, Action pin, and historical documentation.
- Repository-only structured release-status manifest and shared publishability
  matrix.
- `pnpm docs:check` in default verification.
- Aligned README/RELEASE marker parsing and current candidate refusal.
- Domain contract suites for package, Android, iOS, documentation, and workflow
  verification, with a repository-only
  [authority matrix](docs/verification-architecture.md).
- Android doctor checks based on module wiring, commands, structured fixture
  metadata, and executable native-test authorities.
- Typed Android compression request parsing with table-driven Kotlin coverage
  for defaults, boundaries, invalid values, and malformed bridge types.
- Typed Android source/decode boundaries with Kotlin characterization coverage
  for file/content access, stream closure, format hints, bounds, EXIF
  orientation, and HEIF/AVIF platform gates.
- Typed Android bitmap transformation and ownership boundaries with
  table-driven coverage for all eight EXIF orientations, contain/cover/stretch,
  no-upscale identity, center crop, and exactly-once recycling.
- Typed iOS compression request parsing with Foundation-only native coverage
  for defaults, required fields, output availability, quality/maxBytes,
  metadata, resize modes/dimensions, and stable error contracts.
- Typed iOS source acquisition and format inspection with native coverage for
  file/content URIs, immutable bytes, security-scope closure, ImageIO type
  aliases, AVIF signatures/runtime availability, and stable errors.
- Typed iOS image-decoder ownership with native coverage for JPEG/PNG ordinary
  decode, GIF/WebP/HEIC/HEIF/AVIF first-frame routing, synchronous executor
  ownership, immutable results/errors, and stable decode failures.
- Typed iOS resize/render ownership with exact geometry tables for no-resize,
  contain, cover, stretch, width-only, height-only, portrait/landscape,
  no-upscale, and center crop; injected renderer tests preserve opaque/alpha
  policy, synchronous executor ownership, immutable models, and stable failure
  classification.
- Typed iOS JPEG metadata ownership with native coverage for preserve
  eligibility, exact unsupported errors, safe/strip quality-only properties,
  ImageIO reads, TIFF/EXIF orientation and dimension normalization, malformed
  or missing source properties, immutable models, and unchanged source data.
- Typed iOS output encoder ownership with native coverage for JPEG/PNG/WebP
  routing, metadata forwarding, synchronous executor ownership, quality-cap
  short circuit, exact target-size probe order, unreachable targets, missing
  candidates, immutable models, and stable encode failures.
- Typed iOS output persistence ownership with native coverage for cache and
  temporary-directory paths, JPEG/PNG/WebP extensions, clock/UUID naming,
  atomic writer delegation, immutable models, stable directory/write errors,
  output URI, byte metrics, and zero-source compression ratio.
- Typed iOS pipeline orchestration with native coverage for exact success
  stage order, every stage failure and downstream short circuit, underlying
  error forwarding, runtime WebP/AVIF providers, native exception mapping,
  immutable models, and post-promise resolution notification.

### Not included

- npm publish, dist-tag changes, git tags, or GitHub Releases.
- Registry/review policy, digest, `evidence/npm`, or `evidence/reviews` changes.
- Workflow structure changes, acquisition bundle verification, native
  compression behavior/public API changes, or AVIF output changes.

### Validation

```bash
pnpm verify
pnpm example:typecheck
pnpm example:ios:decoder-test
pnpm example:ios:encoder-test
pnpm example:ios:output-test
pnpm example:ios:pipeline-test
pnpm example:ios:metadata-test
pnpm example:ios:transformer-test
pnpm example:ios:input-test
pnpm example:ios:request-test
pnpm example:ios:build
pnpm example:ios:smoke
pnpm fixtures:release-evidence-review-acquisition:check
pnpm docs:check
git diff --check
pnpm pack --dry-run
```

Package inspection must show no `docs/`, `evidence/`, `scripts/`, or `test/`
entries. `pnpm release:dry-run` stops for `candidate` and continues for a
manifest-aligned `release` after a reviewed status update.

## Recent release-evidence work

- [v0.2.62 registry provenance](docs/release-evidence/registry-provenance.md)
  retains exact tag-ref Registry Validation run `29558617089`; the linked
  [policy review](docs/release-evidence/policy-review.md) and
  [durable archive](docs/release-evidence/review-archive.md) retain exact review
  run `29561132321`, attestation, ZIPs, and offline replay.
- [v0.2.61](docs/releases/0.2-history.md#v0261) added authenticated review
  artifact acquisition and canonical importer handoff.
- [v0.2.60](docs/releases/0.2-history.md#v0260) retained the review archive for
  expiration-independent replay.
- [v0.2.59](docs/releases/0.2-history.md#v0259) added the reviewed policy receipt,
  promotion rehearsal bundle, and signer attestation.
- [v0.2.58](docs/releases/0.2-history.md#v0258) added canonical policy candidate
  preparation and reviewed promotion.
- [v0.2.57](docs/releases/0.2-history.md#v0257) added authenticated Registry
  Validation artifact acquisition.
- [v0.2.56](docs/releases/0.2-history.md#v0256) added release-evidence archive
  import and multi-version replay.
- [v0.2.55](docs/releases/0.2-history.md#v0255) established the retained Action
  Pin attestation/release evidence baseline.

## History index

All earlier `0.2.x` and `0.1.x` entries, including exact runs, artifact IDs,
digests, validation commands, publication results, and non-goals, are indexed by
their version headings in [docs/releases/0.2-history.md](docs/releases/0.2-history.md).
