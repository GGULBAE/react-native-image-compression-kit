# Your first compressed image

Start with one local image and a JPEG output. Add byte targets, format
fallbacks, and cancellation when the basic integration is working.

Requires Android 23+ or iOS 13.4+ and a rebuilt native application.

::: warning Published package and source candidate
npm `latest` is **0.4.0**. It has a known iOS orientation defect that can
vertically invert output pixels. The **0.4.1 source candidate** fixes it and
adds `removeCompressionOutput`, but is not published. Validate iOS output
orientation before shipping an integration; see the [release notes](../changelog.md).
:::

## 1. Install and rebuild the native app

```bash
npm install react-native-image-compression-kit
```

Follow the [Bare React Native](./installation.md#bare-react-native) or
[Expo development build](./installation.md#expo-development-build) instructions
to install pods where needed and rebuild. A Metro reload is not enough.
Expo Go and Snack cannot load the native module.

## 2. Compress a local image

Pass an image URI returned by your picker or camera. The function below uses
APIs available in the published package:

```ts
import { compressImage } from 'react-native-image-compression-kit';

async function compressLocalImage(localImageUri: string) {
  return compressImage({
    source: { uri: localImageUri },
    resize: { maxWidth: 1600, maxHeight: 1600, mode: 'contain' },
    output: { format: 'jpeg', quality: 82 },
    metadata: 'safe',
  });
}
```

The result contains `uri`, `width`, `height`, `byteSize`, `originalByteSize`,
`format`, and `compressionRatio`. It points to a **new cache file**; the source
is unchanged. A smaller output is not guaranteed for every input.

Android accepts app-readable `file://` and `content://` URIs. On iOS, prefer a
local `file://` URI. Remote URLs, `data:` URIs, and cloud-only assets must be
materialized locally by the host app first. See [picker integration](./integration.md).

## 3. Apply your upload policy

For JPEG or supported WebP output, add `maxBytes` to the output options. An
unreachable target returns the smallest generated candidate, so **check
`result.byteSize` before uploading**. PNG does not support `maxBytes`.

```ts
const output = { format: 'jpeg', quality: 82, maxBytes: 500_000 } as const;
```

Keep ownership of the cache file explicit. Upload or copy it, then remove the
temporary output using your app's file API. Clean it up when you reject it for
exceeding the upload policy too. The 0.4.1 candidate offers
[`removeCompressionOutput`](../reference/api.md#removecompressionoutputuri-041-source-candidate)
for package-owned output cleanup; that API is not in npm 0.4.0.

## Choose your next step

| You need to… | Continue with |
| --- | --- |
| Support a gallery or camera picker | [Image picker integration](./integration.md) |
| Choose WebP with a JPEG fallback | [Capabilities and fallbacks](./capabilities.md) |
| Set a byte budget or cancel work | [Compression recipes](./recipes.md) |
| Understand file ownership and privacy | [Output files and metadata](./files-metadata.md) |
| Diagnose a native build or URI error | [Errors and troubleshooting](./errors.md) |
| Inspect real native outputs | [Native result demo](../demo/index.md) |
