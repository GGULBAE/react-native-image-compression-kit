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
cannot undo the first device-to-server transfer. The directly observable
device-side quantity is:

```text
source-to-output byte delta = max(0, package input bytes − accepted output bytes)
```

Use **accepted output** rather than every generated result. An application may
reject a result because it misses its byte limit, dimensions, visual-quality
policy, format requirement, or another product constraint.

This delta is not automatically the application's incremental saving. The
package input may already have been resized or transcoded by a picker or an
existing upload pipeline. A matched baseline is required for that claim:

```text
incremental transferred-byte reduction
  = current-pipeline transferred bytes − new-pipeline transferred bytes
```

Measure both sides over comparable accepted uploads, including bytes sent by
partial or repeated attempts. Use **prevented upload bytes** only when that
counterfactual has actually been established.

### 📱 App-owned bytes at rest

Mobile applications commonly create or retain their own image files while an
upload is pending:

```text
durable upload queue + package outputs + thumbnails/caches + stale residual files
```

The useful quantity is a snapshot of distinct files, without counting one file
in more than one category:

```text
app-owned image footprint = queue + outputs + caches + residual files
```

This is deliberately narrower than total phone storage. Ownership creates two
different cases:

- A gallery or provider-owned source remains unchanged. Compression creates a
  new cache output, so peak storage can increase until the owned output is
  removed.
- An app-owned staging source may be replaced by an accepted output only when
  the application's retention policy permits deleting that staging file.

## 🧭 What the package controls

| Boundary | Package contract | Product effect to measure |
| --- | --- | --- |
| Output bytes | `maxBytes` searches JPEG or available WebP candidates and reports `originalByteSize` and `byteSize` | Accepted source-to-output delta; incremental transfer change is measured against the current pipeline |
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

### Source-to-output example

```text
1,000,000 images × (4 MB source − 0.5 MB output)
= 3,500,000 MB
= 3.5 TB source-to-output payload delta
```

This is also 350 MB per 100 accepted images. It represents fewer first-hop
bytes only when the same 4 MB package inputs would otherwise have been
uploaded. Retry behavior is intentionally not assumed: compare actual
transferred bytes when the baseline and new pipeline have different retry or
partial-transfer rates.

### App-owned queue example

```text
200 staged images × 4 MB   = 800 MB
200 accepted outputs × 0.5 MB = 100 MB
difference = 700 MB
```

This difference applies only when the application owns the staged originals
and is permitted to replace or delete them. It does not apply to gallery
sources, provider-owned content, or files the application must retain.

## 🧾 Provider price snapshot

The following scenario converts the same arithmetic into provider-specific
storage cost. It is illustrative, not a package savings claim.

**Assumptions:** 1,000,000 accepted objects; 4,000,000 input bytes and 500,000
output bytes per object; one retained copy for a full 30-day month; unchanged
object, request, delivery, and transformation counts; USD before tax; no
enterprise discount, credits, replication, CDN, acceleration, or other account
usage.

| Provider surface | Published price used | 4 MB objects | 0.5 MB objects | Difference under these assumptions | What does not decrease |
| --- | --- | ---: | ---: | ---: | --- |
| AWS S3 Standard, Seoul | $0.025 per binary GB-month for the first 50 TB | $93.13/month | $11.64/month | **$81.49/month** | Standard internet ingress is free; 1M PUT requests cost $4.50 in either case |
| Cloudflare R2 Standard | $0.015 per GB-month after the 10 GB-month free allowance | $59.85/month | $7.35/month | **$52.50/month** | Object and write-operation counts are unchanged; direct R2 egress is free |
| Cloudflare Images storage | $5 per 100,000 stored images per month | $50/month | $50/month | **$0/month** | Stored, delivered, and transformed-image charges are count-based |

The AWS rates come from the
[S3 Seoul public price list published August 7, 2026](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/ap-northeast-2/index.json).
AWS defines S3 storage GB as 2^30 bytes and lists standard internet ingress as
free on the [S3 pricing page](https://aws.amazon.com/s3/pricing/). Cloudflare's
[R2 pricing, updated August 7, 2026](https://developers.cloudflare.com/r2/pricing/),
also rounds usage to billing units and shares its free allowance across account
usage. [Cloudflare Images pricing, updated July 8, 2026](https://developers.cloudflare.com/images/pricing/),
charges by stored, delivered, or uniquely transformed image rather than source
byte size.

Prices, free allowances, regions, and delivery paths change. Recalculate from
the provider bill that applies to the application. Smaller retained objects can
also reduce metered downstream delivery bytes, but that effect is not included
above: it is zero for direct R2 egress and depends on CDN, region, free tier,
cache, and delivery count elsewhere.

## ♻️ Upload, then release the output

> `removeCompressionOutput(uri)` in this example belongs to the 0.4.1 source
> candidate and is not available in npm 0.4.0. The host application must use
> its own file API for successful-output cleanup until the candidate ships.

```ts
import {
  compressImage,
  removeCompressionOutput,
} from 'react-native-image-compression-kit';

const maxUploadBytes = 500_000;

const result = await compressImage({
  source: { uri: localImageUri },
  resize: { maxWidth: 2048, maxHeight: 2048, mode: 'contain' },
  output: { format: 'jpeg', quality: 90, maxBytes: maxUploadBytes },
  metadata: 'safe',
});

try {
  if (result.byteSize > maxUploadBytes) {
    throw new Error('Image did not meet the upload policy');
  }

  const sourceToOutputByteDelta = Math.max(
    0,
    result.originalByteSize - result.byteSize
  );

  await upload(result.uri, { sourceToOutputByteDelta });
} finally {
  await removeCompressionOutput(result.uri);
}
```

`maxBytes` is a target-search contract, not a guarantee that every source can
reach the requested size. The native operation returns the smallest generated
candidate when the target is unreachable. Apply the host application's
acceptance policy before counting the source-to-output delta or uploading the
result. Report incremental transfer reduction only after comparing the bytes
sent by a matched current-pipeline baseline.

## 📊 Measurement plan

| Metric | Definition | Why it matters |
| --- | --- | --- |
| Accepted-output rate | Accepted results ÷ completed compression results | Prevents counting unusable outputs as savings |
| Accepted source-to-output byte delta | Sum of `originalByteSize − byteSize` for accepted outputs, floored at zero | Measures the package input/output difference without inventing a baseline |
| Incremental transferred bytes | Current-pipeline bytes − new-pipeline bytes for comparable accepted uploads | Measures the counterfactual transfer effect, including retry and partial-attempt behavior |
| Retry bytes | Bytes transferred by repeated or partial upload attempts | Shows whether smaller payloads change the retry surface in the real network path |
| Upload latency p50/p95 | Selection-to-server-acceptance time, reported separately from compression time | Separates device work from network effects |
| App-owned queue footprint | Distinct durable queue + generated output + cache + residual files at one snapshot | Measures storage under the host application's control without double counting |
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
- It does not treat a source-to-output byte delta as an incremental transfer
  reduction without a comparable current-pipeline baseline.
- It does not claim lower total phone storage while gallery sources remain.
- It does not treat planned decoded-pixel reduction as measured peak memory.
- It does not generalize two native fixtures into a cross-device success rate.

Use the [product evidence page](../reference/evidence.md) for measured package
fixtures and their interpretation limits. Use this guide to define the product
metrics that must be captured in a real application.
