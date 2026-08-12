# Why device-side bytes matter

Image compression is not only a visual-quality decision. In an upload product,
it is a boundary that determines how many bytes leave the device and how many
app-owned image files remain while work is queued, retried, completed, or
cancelled.

## 📈 Market context

Ericsson reports a global average of **22 GB of mobile data traffic per active
smartphone per month at the end of 2025** and forecasts mobile data traffic,
excluding fixed wireless access, to reach **328 EB per month in 2031**.
[Read the traffic forecast and its regional caveats](https://www.ericsson.com/en/reports-and-papers/mobility-report/dataforecasts/mobile-traffic-forecast).

Those figures explain why byte-intensive mobile paths deserve attention. They
do not prove how much this package—or any particular application—will save.
Product impact must be calculated from accepted outputs and measured in the
host application's real upload and storage lifecycle.

## 💸 Two cost surfaces

### 📤 Bytes that move

An oversized source can pass through several stages:

```text
device source → first upload → retry → API handling → server transform → storage
```

Server-side compression can reduce later storage or delivery bytes, but it
cannot undo the first device-to-server transfer. The device-side quantity is:

```text
prevented upload bytes = source bytes − accepted output bytes
```

Use **accepted output** rather than every generated result. An application may
reject a result because it misses its byte limit, dimensions, visual-quality
policy, format requirement, or another product constraint.

### 📱 App-owned bytes at rest

Mobile applications commonly create or retain their own image files while an
upload is pending:

```text
durable upload queue + package outputs + thumbnails/caches + stale residual files
```

The useful quantity is:

```text
app-owned image footprint = queue + outputs + caches + residual files
```

This is deliberately narrower than total phone storage. The package does not
shrink or delete a gallery source. Compression creates a new cache output, so
the source and output can coexist and temporarily increase storage during
processing.

## 🧭 What the package controls

| Boundary | Package contract | Product effect to measure |
| --- | --- | --- |
| Output bytes | `maxBytes` searches JPEG or available WebP candidates and reports `originalByteSize` and `byteSize` | Difference between source and accepted upload bytes |
| Runtime support | `getImageCompressionCapabilities()` reports formats, policies, concurrency, and resource limits | Fewer requests that fail after selection or user work |
| Native work | Decode downsampling, source and working-pixel limits, bounded concurrency, and cancellation | Planned work, latency, memory, and cancellation behavior on target devices |
| Transactional files | Failed and cancelled jobs remove partial work; success publishes one verified output | Residual files after failure or cancellation |
| Output ownership | `removeCompressionOutput(uri)` accepts only a package-owned cache output | Output reclamation after upload, copy, or explicit abandonment |
| Metadata | `preserve`, `safe`, and `strip` are explicit policies | Whether accepted outputs meet the application's privacy policy |

The [public API reference](../reference/api.md) defines the exact return values,
errors, and ownership rules. The [output-files guide](./files-metadata.md)
explains what remains the host application's responsibility.

## 🧮 Illustrative scale

The following arithmetic uses decimal units and assumes every output meets the
host application's acceptance policy.

### First-hop upload example

```text
1,000,000 images × (4 MB source − 0.5 MB output)
= 3,500,000 MB
= 3.5 TB fewer first-hop bytes
```

Retries would multiply transferred bytes, but a retry factor is intentionally
not assumed here. Convert prevented bytes into money only with the actual data,
API, transformation, and storage prices that apply to your system.

### App-owned queue example

```text
200 staged images × 4 MB   = 800 MB
200 accepted outputs × 0.5 MB = 100 MB
difference = 700 MB
```

This difference applies only when the application owns the staged originals
and is permitted to replace or delete them. It does not apply to gallery
sources, provider-owned content, or files the application must retain.

## ♻️ Upload, then release the output

```ts
import {
  compressImage,
  removeCompressionOutput,
} from 'react-native-image-compression-kit';

const result = await compressImage({
  source: { uri: localImageUri },
  resize: { maxWidth: 2048, maxHeight: 2048, mode: 'contain' },
  output: { format: 'jpeg', quality: 90, maxBytes: 500_000 },
  metadata: 'safe',
});

const preventedUploadBytes = Math.max(
  0,
  result.originalByteSize - result.byteSize
);

try {
  await upload(result.uri, { preventedUploadBytes });
} finally {
  await removeCompressionOutput(result.uri);
}
```

`maxBytes` is a target-search contract, not a guarantee that every source can
reach the requested size. The native operation returns the smallest generated
candidate when the target is unreachable. Apply the host application's
acceptance policy before counting prevented bytes or uploading the result.

## 📊 Measurement plan

| Metric | Definition | Why it matters |
| --- | --- | --- |
| Accepted-output rate | Accepted results ÷ completed compression results | Prevents counting unusable outputs as savings |
| Prevented upload bytes | Sum of `originalByteSize − byteSize` for accepted outputs, floored at zero | Measures the controlled first-hop payload difference |
| Retry bytes | Bytes transferred by repeated upload attempts | Shows whether smaller payloads reduce the retry surface in the real network path |
| Upload latency p50/p95 | Selection-to-server-acceptance time, reported separately from compression time | Separates device work from network effects |
| App-owned queue footprint | Durable queue + generated outputs + caches + residual files | Measures storage under the host application's control |
| Output reclamation rate | Package outputs removed after upload or abandonment ÷ removable outputs | Detects successful outputs retained longer than policy allows |
| Failure/cancellation residuals | Partial files remaining after failed or cancelled jobs | Should remain zero for the package-owned work boundary |
| Compression latency and memory | Per-device p50/p95 duration and peak memory with source dimensions recorded | Guards against trading network bytes for unacceptable device cost |

Segment results by platform, OS version, device class, source format,
dimensions, network type, and acceptance policy. Do not compare Android and iOS
fixture ratios unless their inputs and execution conditions are actually the
same.

## 🛡️ Honest limits

- It does not claim that every image becomes smaller.
- It does not convert bytes into cloud savings without the host's actual price
  model.
- It does not claim lower total phone storage while gallery sources remain.
- It does not treat planned decoded-pixel reduction as measured peak memory.
- It does not generalize two native fixtures into a cross-device success rate.

Use the [product evidence page](../reference/evidence.md) for measured package
fixtures and their interpretation limits. Use this guide to define the product
metrics that must be captured in a real application.
