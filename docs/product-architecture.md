# Product architecture

React Native Image Compression Kit keeps a small TypeScript API in front of
bounded, platform-native image pipelines. This document records the system
boundary and the decisions that should remain true when implementations evolve.
It describes product behavior; the separate
[verification architecture](verification-architecture.md) explains repository
and release authority.

## System boundary

The package accepts a local application-accessible image URI and returns a new
cache-file URI plus measured output metadata. It owns validation, capability
reporting, decode, transform, encode, cancellation, and cleanup during that
operation.

The application remains responsible for acquiring permissions, choosing an
image, downloading remote content, moving successful cache files into durable
storage, uploading them, and deciding when to release them. The package exposes
a constrained removal primitive for its own generated cache outputs; it does
not expose arbitrary filesystem deletion. Network URLs and inline data URIs are
rejected before native dispatch.

The public surface is deliberately narrow:

- `compressImage(options, control?)` performs one operation;
- `getImageCompressionCapabilities()` reports runtime-dependent behavior;
- `removeCompressionOutput(uri)` releases one package-owned cache output;
- stable result, option, capability, and error types describe the boundary.

## Request lifecycle

1. **Normalize in TypeScript.** The API validates the local URI, resize bounds,
   format, quality, target bytes, and metadata policy. Defaults are applied
   before crossing the React Native bridge.
2. **Bind cancellation.** A unique operation ID connects an `AbortSignal` to
   the native operation. Abort before dispatch, while queued, or while running
   settles the JavaScript promise with `ERR_CANCELLED`.
3. **Resolve the native module.** The package supports the generated Codegen
   module and falls back through TurboModule and Legacy `NativeModules`
   resolution. A missing module fails with rebuild guidance.
4. **Validate platform capability and source.** Native code parses the request,
   resolves the local source, inspects type and dimensions, and rejects
   unsupported work before expensive allocation where possible.
5. **Decode and transform.** Resize requests use platform decode-time
   downsampling before orientation normalization, crop/contain/stretch geometry,
   and transparency handling.
6. **Prepare metadata and encode.** Metadata policy is explicit. Target-size
   search uses the selected quality as an upper bound for supported lossy
   outputs.
7. **Publish a completed cache file.** Encoding is written transactionally. A
   failed or cancelled operation removes temporary or newly completed output
   rather than resolving a partial file.
8. **Return observed metadata.** The result reports URI, format, dimensions,
   byte sizes, and compression ratio from the completed output.
9. **Release explicitly.** When the application is done, native ownership
   checks allow idempotent removal of that generated output while rejecting
   foreign files, traversal, symlinks, and directories.

Cancellation is cooperative across the bridge and native stages. It prevents a
late native result from resettling the JavaScript promise, but applications
should not treat it as a hard real-time interruption guarantee inside a
platform codec call.

## Platform pipelines

| Stage | Android | iOS |
| --- | --- | --- |
| Scheduling | Fixed two-worker executor with a bounded queue | `NSOperationQueue` with a maximum of two concurrent operations |
| Source access | `file://` and `content://` through `ContentResolver` | `file://` and best-effort local `content://` resolution |
| Inspection/decode | Bounds inspection, `BitmapFactory` or gated `ImageDecoder`, decode sampling | ImageIO source inspection and thumbnail downsampling |
| Transform | Bitmap orientation, resize geometry, alpha/opaque output policy | Core Graphics/UIKit orientation, resize geometry, alpha/opaque output policy |
| Encode | Platform JPEG, PNG, and WebP paths | ImageIO/Core Graphics JPEG, PNG, and runtime-gated WebP paths |
| Publish | Temporary sibling file renamed only after encode validation | Atomic `NSData` write to a unique cache path |

Both platforms expose the same named safety limits: 32,768 pixels on either
source axis, 100,000,000 source pixels, 25,000,000 working pixels, and a maximum
of two active operations. These are public capability values, not suggestions.
Unsafe work rejects with `ERR_RESOURCE_LIMIT`.

Codec support is not inferred from a file extension or platform name. Android
API level and device codecs affect decoding; iOS ImageIO source and destination
registries affect AVIF input and WebP output. Applications should branch on
`getImageCompressionCapabilities()` at runtime.

## Architectural decisions

### Native image work, small JavaScript boundary

**Decision:** decode, pixel transforms, encoding, and output persistence run in
native code on bounded background workers.

**Reason:** platform codecs and URI access are the authoritative behavior, while
large pixel buffers must stay off the JavaScript thread.

**Trade-off:** installation requires a native rebuild, so Expo Go and Snack are
outside the supported runtime boundary.

### Capability-first format handling

**Decision:** a format appearing in TypeScript types does not imply that every
runtime can read or write it. Capability records are the source for application
fallbacks, and unsupported output remains an explicit error.

This capability-first rule applies to documentation and compatibility claims as
well as runtime branching.

**Reason:** codec availability differs across Android SDK/device combinations
and iOS ImageIO runtimes.

**Trade-off:** applications perform a capability check instead of relying on a
single static platform matrix.

### Bounded work before convenience

**Decision:** concurrency, queueing, source dimensions, source pixels, and
working pixels are bounded. Decode-time downsampling is used when a resize can
make a large but valid source safe.

**Reason:** predictable rejection is safer than process termination caused by
unbounded allocation.

**Trade-off:** some images reject with `ERR_RESOURCE_LIMIT` even if a particular
device might process them under ideal conditions.

### Transactional cache output

**Decision:** the promise resolves only after a complete cache file is
published. Failures and cancellation clean temporary or late output files.

**Reason:** callers should never receive a path to a partial encode.

**Trade-off:** the pipeline may require temporary disk space near the final
output size while an operation completes.

### Constrained output removal

**Decision:** `removeCompressionOutput(uri)` accepts only a direct generated
file in the package output cache directory. Missing valid outputs are
idempotent; recursive directory deletion and arbitrary paths are rejected.

**Reason:** applications need a portable way to close the cache lifecycle
without granting a broad delete primitive to the bridge.

**Trade-off:** copied, moved, renamed, source, and application-owned files must
be managed by the application instead.

### Explicit metadata policy

**Decision:** `preserve`, `safe`, and `strip` are observable policies. Preserve
is intentionally limited to JPEG input converted to JPEG output; orientation is
rendered into pixels and normalized in retained metadata.

**Reason:** implicit metadata copying can leak location/device data and can
conflict with transformed dimensions.

**Trade-off:** cross-format preservation rejects instead of silently producing
a best-effort result.

### Static-image scope

**Decision:** animated inputs are processed as a static first frame where the
platform supports them; animation preservation and animated output are not
implemented.

**Reason:** animation introduces frame timing, disposal, memory, target-size,
metadata, and cancellation contracts that are distinct from static images.

**Trade-off:** callers needing animation must select a different pipeline.

## Verification ownership

| Contract | Authoritative verification |
| --- | --- |
| TypeScript validation, bridge settlement, errors | Vitest unit and contract tests with coverage thresholds |
| Android parsing, limits, decode, transform, metadata, encode, cleanup | JVM unit tests plus hosted instrumentation and example builds |
| iOS parsing, limits, decode, transform, metadata, encode, cleanup | Objective-C++ executable smoke suites and hosted example builds |
| Legacy/New Architecture and React Native/Expo compatibility | Fresh consumers installing the packed tarball |
| Runtime capability and native result walkthrough | Android/iOS capture workflows with validated evidence manifests |
| Performance observations | Versioned fixture/plan evidence with raw samples and environment identity |
| Package and release contents | Pack, consumer smoke, provenance, attestation, and registry replay gates |

Unit coverage intentionally does not stand in for platform codec execution.
Likewise, one native runner measurement does not establish universal
performance or device compatibility.

## Change rules

A change to formats, limits, metadata, scheduling, source access, cancellation,
or returned files must:

1. state the user problem and affected platform/runtime boundary;
2. preserve stable behavior outside the declared scope;
3. update capabilities and limitations before making a support claim;
4. add the lowest-level deterministic test and the relevant executable native
   or consumer check;
5. define cleanup and error behavior, including cancellation races;
6. update README, website, compatibility, and roadmap material where the public
   decision changes.

New codecs and public API shapes should begin in GitHub Discussions or a focused
issue. See the [roadmap](../ROADMAP.md) for the evidence expected before a
candidate becomes implementation work.
