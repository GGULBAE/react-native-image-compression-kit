# Choosing an image pipeline

Choose by contract, not a speed rank. An image pipeline is a good fit when its
documented behavior matches the host application's acceptance, privacy,
cancellation, and file-lifecycle rules on the devices that matter.

This guide compares pipeline shapes and verification questions. It does not
rank package popularity, general image quality, or universal performance.

## Start with the host requirement

Write the acceptance policy before selecting a library:

| Requirement | Decision question | Evidence to keep |
| --- | --- | --- |
| Upload byte limit | Must the device search for an accepted encoded size, or is a dimension/quality setting sufficient? | Input and accepted-output bytes, target-attainment rate, rejection reason |
| Metadata policy | Must metadata be preserved, filtered, or removed? Does the rule vary by format or platform? | Output metadata inspection against named sensitive fields |
| Cancellation | Can navigation, replacement, or abandonment make in-flight work obsolete? | Stable cancellation result and residual-file check |
| Runtime capability | Can codec availability differ across OS versions or device images? | Runtime capability response from supported device lanes |
| Output ownership | Who owns the generated file, how long may it remain, and which API may remove it? | URI ownership, cleanup outcome, queue-retention rule |
| Resource boundary | What source pixels, dimensions, concurrency, memory, and latency can the app accept? | Per-device fixture dimensions, p50/p95 time, peak-memory measurement |

A picker, camera, or existing upload layer may already resize or transcode its
output. Measure the bytes and metadata that actually enter the candidate
pipeline rather than assuming the gallery original is the package input.

## Compare pipeline shapes

Several categories can be reasonable. Their scopes overlap, so verify the
current documentation and behavior instead of inferring a contract from a
category name.

| Pipeline shape | Usually fits when | Add explicit host checks for |
| --- | --- | --- |
| Platform image manipulation API | The app needs a small set of crop, rotate, resize, or encode operations and owns the acceptance logic | Output bytes, codec availability, metadata, cancellation, temporary files |
| Focused image resizer | Geometry and a predictable output format are the primary controls | Hard byte limits, privacy policy, abort behavior, output reclamation |
| Broader media compressor | One integration must also cover media beyond still images | Per-media contracts, native dependency surface, result validation, ownership |
| Contract-driven upload image pipeline | The app needs target-byte search plus explicit capability, metadata, cancellation, and owned-output rules | Product acceptance after the search, picker/upload integration, real-device limits |
| Server-authoritative transform | The server owns canonical formats, derivatives, and delivery policy | First-hop device bytes, offline queue size, upload retries, local privacy boundary |

Composition is normal. For example, a picker may acquire the source, a native
image stage may prepare an upload, and a server may still create canonical
delivery variants. Assign one owner to every temporary file and one acceptance
gate to every handoff.

## Contract checklist for this package

Use the following table to decide whether React Native Image Compression Kit
matches the required boundary. These are scoped contracts, not claims that
other pipelines lack them.

| Need | Package contract | Host responsibility |
| --- | --- | --- |
| Target bytes | `output.maxBytes` searches generated JPEG or runtime-available WebP candidates and returns the smallest candidate when the target is unreachable | Apply an acceptance policy before upload; record target misses |
| Metadata | `preserve`, `safe`, and `strip` are explicit; preserve is limited to supported JPEG-to-JPEG paths | Select the policy required by the product and inspect representative outputs |
| Cancellation | `AbortSignal` rejects queued or running work with `ERR_CANCELLED`; transactional work must not publish a partial output | Treat cancellation as an expected outcome and measure abandoned workflow behavior |
| Runtime capability | `getImageCompressionCapabilities()` reports current formats, policies, concurrency, downsampling, and resource limits | Gate UI and fallbacks from the runtime response rather than the platform name alone |
| Output ownership | A successful result is a package-owned cache output; the 0.4.1 source candidate adds narrow `removeCompressionOutput(uri)` cleanup | npm 0.4.0 callers use their own file API; never pass gallery/provider files to package cleanup |
| Evidence | Native fixtures bind results to platform, package version, source commit, options, bytes, dimensions, assets, and hashes | Re-run representative app fixtures and keep release state distinct from source-candidate evidence |

Read the [API contract](../reference/api.md),
[capability guide](./capabilities.md), and
[output-file and metadata guide](./files-metadata.md) before integration.

## Verify before choosing

A useful comparison controls more than elapsed time:

1. Pin the exact source or package version and native dependency graph.
2. Use the same input fixture, resize geometry, output format, and quality rule
   within each platform comparison.
3. Record warmups, raw samples, execution order, environment, and device class.
4. Validate output dimensions, byte size, orientation, metadata, and visual
   agreement before interpreting timing.
5. Exercise invalid input, unreachable byte targets, cancellation, and cleanup.
6. Keep Android and iOS results separate unless their fixtures and environments
   are genuinely comparable.

One runner capture cannot establish a universal speed or quality order. The
[product evidence page](../reference/evidence.md) states what the repository's
current fixtures measure and what they do not.

## Make the decision reversible

Wrap the selected pipeline behind an application-owned adapter. Keep the
acceptance policy and measurements outside the package-specific call so a
fixture can exercise the same product contract after an upgrade or migration.

At minimum, persist non-sensitive operational measurements for accepted-output
rate, target misses, transferred bytes in matched cohorts, cancellation,
latency, and app-owned residual files. The
[byte-economics guide](./byte-economics.md) explains why source-to-output bytes
must remain separate from an incremental transfer claim.

## Scope boundaries

React Native Image Compression Kit processes local still-image URIs. It does
not acquire media, fetch remote URLs, upload files, edit video or audio, manage
gallery/provider originals, or define the host application's retention and
privacy policy. If those are primary requirements, compose a broader pipeline
or select a tool whose documented scope owns them directly.
