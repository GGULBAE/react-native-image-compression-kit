# Compression recipes

## Resize without upscaling

```ts
const result = await compressImage({
  source: { uri: imageUri },
  resize: { maxWidth: 1600, maxHeight: 1600, mode: 'contain' },
  output: { format: 'jpeg', quality: 82 },
  metadata: 'safe',
});
```

`contain` preserves the aspect ratio inside the bounds. `cover` fills both
bounds and center-crops. `stretch` uses the exact requested dimensions and may
change the aspect ratio. The native implementations do not upscale for
`contain` or `cover`.

## Target a byte budget

```ts
const result = await compressImage({
  source: { uri: imageUri },
  output: { format: 'webp', quality: 90, maxBytes: 500_000 },
  metadata: 'strip',
});
```

For JPEG and available WebP output, `quality` is the upper bound. The native
pipeline searches for the highest generated quality under `maxBytes` and
returns the smallest generated candidate when the target is unreachable. PNG
does not support `maxBytes`.

## Capability-driven conversion

```ts
const capabilities = await getImageCompressionCapabilities();
const webp = capabilities.formats.find(item => item.format === 'webp');

const result = await compressImage({
  source: { uri: imageUri },
  output: {
    format: webp?.output ? 'webp' : 'jpeg',
    quality: 84,
  },
  metadata: 'safe',
});
```

HEIC, HEIF, and AVIF can be runtime-gated inputs, but they are not output
formats in the current native implementation. Selecting them as output rejects
with `ERR_NOT_IMPLEMENTED`.

## Interpret the result

`compressionRatio` is `byteSize / originalByteSize`. A value of `0.25` means
the output uses 25% of the source bytes. Values can exceed `1` when conversion
or settings produce a larger file.
