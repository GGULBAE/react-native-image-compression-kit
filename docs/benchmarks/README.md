# Native benchmark evidence

The native benchmark records repeatable measurements from the same Android and
iOS example applications used by the verified native demo. It exists to make
performance and output-size discussions reproducible, not to claim that one
implementation is universally faster.

## Current boundary

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

## Comparison policy

Future implementation comparisons must use fixed versions and adapters in an
isolated benchmark application. Compare only the shared operation and the same
fixture on the same platform, device, runtime, architecture, warmup policy, and
iteration count. Record unsupported behavior separately instead of assigning a
timing result to it.

Target-size compression, metadata policies, cancellation, runtime capability
reporting, source limits, and transactional output are feature boundaries, not
equivalent timing cases unless every compared implementation supports the same
contract. Publish raw samples and limitations alongside any derived table.
