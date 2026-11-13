---
layout: home
title: React Native Image Compression Kit
titleTemplate: false
---

<ProjectIntro />

::: warning Release status
**npm latest: 0.4.0 · source candidate: 0.4.1.** The published iOS renderer can
vertically invert output pixels. The candidate fixes orientation and adds
package-owned output cleanup. The comparison above is a recorded source-tree
result, not a claim that those fixes are in npm. [Review the release notes](./changelog.md).
:::

## One request, a local output

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

Get back a cache URI, dimensions, and byte counts. Your source image stays
unchanged. [Install, rebuild, and handle the result](./guide/quick-start.md).

## Control the parts your app depends on

<div class="integration-contracts">
  <article><span class="eyebrow">01 / Upload policy</span><h3>Work toward a byte budget</h3><p>Set a JPEG or WebP target with <code>maxBytes</code>. Check the returned size before upload; an unreachable target returns the smallest candidate.</p></article>
  <article><span class="eyebrow">02 / Native behavior</span><h3>Ask the runtime first</h3><p>Discover codecs and limits on the device. Decode downsampling, two-operation scheduling, and cancellation keep native work bounded.</p></article>
  <article><span class="eyebrow">03 / File lifecycle</span><h3>Keep ownership explicit</h3><p>Choose a metadata policy. Upload or preserve the new cache file, then remove the temporary output. Gallery sources are never deleted.</p></article>
</div>

## Find your next step

| Your task | Start here |
| --- | --- |
| Add compression to an app | [Quick start](./guide/quick-start.md) |
| Compare native output or generate request code | [Interactive demo](./demo/index.md) |
| Decide whether this fits your pipeline | [Pipeline selection guide](./guide/choosing-an-image-pipeline.md) |
| Estimate your own transfer and storage scenario | [Byte economics calculator](./guide/byte-economics.md) |
| Check supported formats and framework versions | [Capabilities](./guide/capabilities.md) · [Compatibility](./reference/compatibility.md) |

## Open source, with a clear scope

MIT licensed and built around a small TypeScript API. The package processes
local images on Android and iOS; it does not provide a picker, upload client,
or browser codec. Expo requires a development build; Expo Go is unsupported.

Explore the [architecture](./reference/architecture.md) and
[roadmap](./roadmap.md), ask an integration question in
[Discussions](https://github.com/GGULBAE/react-native-image-compression-kit/discussions),
or follow the [contribution guide](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/CONTRIBUTING.md)
to report a reproducible bug or improve the docs.
