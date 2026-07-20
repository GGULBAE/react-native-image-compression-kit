# Capabilities and fallbacks

Call `getImageCompressionCapabilities()` at runtime. Availability can differ by
Android API/device codecs and iOS ImageIO destinations.

| Capability | Android | iOS |
| --- | --- | --- |
| JPEG/PNG input | Yes | Yes |
| WebP input | Yes | Static ImageIO decode |
| GIF input | Static first frame | Static first frame |
| HEIC/HEIF input | SDK/device gated | Static ImageIO decode |
| AVIF input | Android 14+ platform decoder | Runtime ImageIO source gated |
| JPEG/PNG output | Yes | Yes |
| WebP output | Yes | Runtime ImageIO destination gated |
| HEIC/HEIF/AVIF output | Not implemented | Not implemented |
| Target size | JPEG, WebP | JPEG, runtime-available WebP |
| Animation preservation | Not implemented | Not implemented |
| Decode-time downsampling | Yes | Yes |
| Maximum concurrent operations | 2 | 2 |
| Cancellation | Yes | Yes |

Both platforms currently report:

```ts
{
  maxConcurrentOperations: 2,
  supportsDecodeDownsampling: true,
  supportsCancellation: true,
  resourceLimits: {
    maxSourceDimension: 32_768,
    maxSourcePixels: 100_000_000,
    maxWorkingPixels: 25_000_000,
  },
}
```

These limits are applied before full decode. Large sources can still be
processed when resize bounds permit decode-time downsampling below the working
pixel limit.

## Fallback pattern

```ts
const capabilities = await getImageCompressionCapabilities();

function canOutput(format: 'jpeg' | 'png' | 'webp') {
  return capabilities.formats.some(
    item => item.format === format && item.output
  );
}

const format = canOutput('webp') ? 'webp' : 'jpeg';
```

Do not infer output support from the input extension. Do not assume another
device with the same platform has an identical codec set.

## Metadata fallback

`preserve` is intentionally narrow: JPEG source to JPEG output. Prefer `safe`
for a privacy-filtered/default result and `strip` when the application does not
need metadata. See [metadata details](./files-metadata.md).
