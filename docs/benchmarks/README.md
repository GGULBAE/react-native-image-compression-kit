# Native benchmark evidence

The native benchmark records repeatable measurements from the same Android and
iOS example applications used by the verified native demo. It exists to make
performance and output-size discussions reproducible, not to claim that one
implementation is universally faster.

## Baseline boundary

Benchmark schema version 1 measures this package with the repository-owned JPEG
fixture on each platform. Every capture performs two unreported warmup runs and
ten sequential measured runs of this common operation:

```ts
await compressImage({
  source: { uri: bundledFixtureUri },
  resize: { maxWidth: 320, maxHeight: 320, mode: 'contain' },
  output: { format: 'jpeg', quality: 80 },
  metadata: 'strip',
});
```

The native payload records every elapsed time and normalized result. The
evidence builder binds it to the exact package version, source commit, workflow
run, fixture digest, runtime, device, and React Native architecture. The
summary contains minimum, median, p95, and maximum elapsed time; minimum,
median, and maximum output bytes; and the observed output dimensions.

Raw payloads travel through bounded, indexed native-log messages so the sample
set does not depend on platform log-entry length limits. The evidence builder
rejects missing, duplicated, inconsistent, or malformed message sequences.

Do not compare Android measurements with iOS measurements. Native codecs,
device classes, simulator behavior, filesystem caches, thermals, and runner
load differ. A result describes only its captured environment.

## Capture and verify

The [Native Demo Evidence workflow](https://github.com/GGULBAE/react-native-image-compression-kit/actions/workflows/demo-evidence.yml)
runs the benchmark after the visible demo result on both platforms. Each
platform artifact contains `benchmark.json`, the exact source fixture, the demo
manifest, input/output images, screenshot, and native log.

After downloading one platform artifact, verify it without network access:

```bash
pnpm verify:benchmark-evidence -- \
  --artifact-dir path/to/native-demo-platform-artifact
```

To create the evidence fragment from a compatible native log, use
`pnpm benchmark:evidence --` with the exact platform, package version, lowercase
40-character source SHA, runtime, device, source file, log, destination, and
GitHub Actions run URL. The React Native architecture is reported by the running
native example module rather than accepted as a CLI claim. The capture scripts
provide the authoritative invocation used by CI.

## Native implementation comparison

The repository-private example application also runs the exact-version plan in
[`benchmarks/native-comparison/implementations.json`](../../benchmarks/native-comparison/implementations.json).
The plan currently contains this package, `react-native-compressor@1.19.4`, and
`@bam.tech/react-native-image-resizer@3.0.11`. The external packages and their
exact native dependencies remain private to the example; they are not runtime
or development dependencies of the published package. Compressor 1.19.4 is the
final pre-Nitro release and is used unpatched because its documented resize
bounds execute consistently through the public API on both captured platforms.

The shared timing boundary is a local JPEG URI resized inside a 320 by 320
contain box and encoded as JPEG quality 80. Each implementation receives two
warmups. Ten measured rounds rotate the starting implementation so every round
contains one sample from every adapter and execution position is balanced over
time. `benchmark-comparison.json` records the raw elapsed times, positions,
output bytes, dimensions, exact versions, source-tag commits, registry
integrities, fixture digest, environment, and a digest of the captured plan.
Every measured result must match the planned 200 by 320 contain geometry for
the bundled 800 by 1280 fixture; any larger, smaller, or rotated output rejects
the native payload and the downloaded artifact.

Only the public compression call is timed. Normalizing an adapter's returned
URI into byte size and dimensions happens after the timer. This matters because
this package and BAM's resizer return those metrics from the compression call,
while `react-native-compressor` exposes a URI and requires a separate metadata
query. Treat small timing differences accordingly.

The common comparison does not claim equivalent metadata behavior.
`react-native-image-compression-kit` is configured with `metadata: "strip"`,
BAM's resizer is configured with `keepMeta: false`, and
`react-native-compressor` does not expose the same metadata-policy switch.
Target-size compression, cancellation, runtime capability reporting, source
limits, and transactional output also remain feature boundaries rather than
timing cases.

On iOS, the React Native 0.86 example builds React Native core and dependency
pods from source. Its prebuilt dependency mode does not expose the `RCT-Folly`
pod target required by the exact published image-resizer podspec. This keeps the
comparator package unpatched and places every adapter in the same built
application; it is an application build constraint, not part of the timed call.

The pinned compressor's Android audio dependency declares
`allowBackup=true`. The example app explicitly preserves
`android:allowBackup="false"` with a manifest-merger override, so adding the
comparison dependency does not weaken the host application's backup boundary.

After downloading one platform artifact, verify the comparison without network
access:

```bash
pnpm verify:benchmark-comparison-evidence -- \
  path/to/native-demo-platform-artifact
```

Do not compare Android measurements with iOS measurements or extrapolate one
runner capture to other devices. Use raw samples and documented limitations,
not a fastest-run or universal-superiority claim. See the
[comparison maintenance guide](../../benchmarks/native-comparison/README.md)
before changing an adapter or version.
