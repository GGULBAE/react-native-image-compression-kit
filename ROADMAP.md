# Roadmap

This roadmap describes the user problems the project intends to work on and the
evidence required before behavior or compatibility claims change. It is not a
release calendar. No roadmap item is a release promise, and priorities may
change when reproducible user reports, platform behavior, or maintenance risk
changes.

## How priorities are chosen

Work is prioritized when it improves at least one of these outcomes without
weakening the others:

1. predictable integration in a real React Native application;
2. bounded and failure-safe native image processing;
3. accurate capability and compatibility information;
4. reproducible evidence for performance or behavior claims;
5. a small public API that can be maintained across Android, iOS, and React
   Native architecture changes.

A request is not prioritized by format popularity alone. Platform codec
availability, safe resource limits, cancellation behavior, metadata policy,
target-size behavior, and executable tests are part of the same decision.

## Current priorities

### Make integrations easier to diagnose

- Keep Bare React Native and Expo development-build instructions aligned with
  fresh-consumer verification.
- Turn reproducible source URI, codec, metadata, and build failures into focused
  troubleshooting recipes and regression tests.
- Preserve stable error codes so applications can implement useful fallbacks.

Success means a report identifies the platform, runtime capability, input,
options, and failure boundary well enough for another person to reproduce it.

### Keep compatibility claims current

- Refresh the declared React Native and Expo verification lanes when supported
  toolchains change.
- Test both Legacy and New Architecture boundaries where the compatibility
  claim requires them.
- Keep accepted peer-version ranges distinct from versions exercised by a
  fresh native build.

Success means every compatibility row points to an executable consumer build,
not an inference from package metadata.

### Broaden representative benchmark scenarios

- Add fixed high-resolution JPEG, alpha PNG, HEIC/HEIF input, orientation and
  metadata, target-size, and resource-limit scenarios incrementally.
- Record raw samples, dimensions, output bytes, runtime, device, implementation
  version, and failure behavior.
- Describe measured trade-offs for the exact plan and environment instead of
  making universal performance claims.

Success means another maintainer can reproduce or independently reject each
measured claim from retained evidence.

### Maintain failure-safe processing and delivery

- Treat dependency advisories, malformed image inputs, partial outputs, queue
  pressure, and cancellation races as regression-sensitive behavior.
- Keep release, registry, and workflow supply-chain checks fail-closed.
- Prefer focused fixes with bounded regression tests over broad dependency or
  policy exceptions.

Success means a failed or cancelled request does not return a partial cache
file, and repository checks explain why a risky change is blocked.

## Evidence-gated candidates

These ideas are open for design, but implementation should start only after a
concrete use case and acceptance evidence are agreed in GitHub Discussions or
an issue.

### HEIC, HEIF, or AVIF output

Any output codec proposal must define and test:

- runtime encoder or destination capability detection;
- static encode and decode-back validation on supported OS versions;
- alpha, orientation, color, and metadata behavior;
- `output.maxBytes` semantics or an explicit rejection contract;
- cancellation, resource limits, and transactional output cleanup;
- behavior on devices where input decoding exists but output encoding does not.

Until those conditions are met, capabilities continue to report these outputs
as unavailable and requests reject with `ERR_NOT_IMPLEMENTED`.

### Broader metadata preservation

Proposals beyond JPEG-to-JPEG preservation must identify the metadata fields,
privacy policy, orientation normalization, platform parity, and fixtures that
make the result observable. Silent best-effort copying is not an acceptable
contract.

### Additional local source adapters

New URI or asset adapters need a real integration case, clear ownership of
permissions and temporary files, byte-size inspection before full decode, and
tests on both architectures of the affected platform.

## Deferred work

- Animated GIF, WebP, or AVIF preservation and animated output.
- A JavaScript or WebAssembly image-processing fallback.
- New public options that duplicate behavior already expressible through
  resize, output, metadata, capabilities, and cancellation.
- Output codecs that cannot be capability-gated and verified on the platform.

Deferred means there is no active implementation plan. A reproducible user
problem may move an item back to evidence-gated design; it does not guarantee
acceptance or a release date.

## Non-goals

- Fetching remote images or decoding inline data URIs.
- Providing an image picker, editor UI, upload client, CDN, or persistent media
  library.
- Taking ownership of returned cache files beyond the documented application
  lifecycle contract.
- Claiming that one implementation is universally faster or produces better
  quality from a single device or runner measurement.
- Weakening resource, metadata, security, or release checks to make a format or
  environment appear supported.

## How to propose a change

Start with [GitHub Discussions](https://github.com/GGULBAE/react-native-image-compression-kit/discussions)
for design exploration, or use an issue form for a reproducible bug or
compatibility regression. Include:

- the application problem and current workaround;
- React Native or Expo version, architecture, platform, and OS/API level;
- relevant `getImageCompressionCapabilities()` output;
- a minimal local input description and compression options;
- the observable result that would make the change successful;
- risks or behavior the proposal must not change.

Implementation should follow only after the scope, non-goals, and required
tests are clear. See the [product architecture](docs/product-architecture.md)
and [contribution guide](CONTRIBUTING.md) before opening a pull request.
