---
layout: home
title: React Native Image Compression Kit
titleTemplate: false
hero:
  name: React Native Image Compression Kit
  text: Predictable native image compression
  tagline: Resize, transcode, target a byte budget, and control metadata with explicit Android and iOS capabilities.
  image:
    src: /logo.svg
    alt: Image Compression Kit logo
  actions:
    - theme: brand
      text: Install in 60 seconds
      link: /guide/installation
    - theme: alt
      text: Explore native results
      link: /demo/
    - theme: alt
      text: View on GitHub
      link: https://github.com/GGULBAE/react-native-image-compression-kit
features:
  - title: Capability before assumption
    details: Query input and output support at runtime instead of assuming codecs behave identically across devices.
  - title: Target-size compression
    details: Ask JPEG or WebP output to search for the highest available quality under a byte limit.
  - title: Large-image resilience
    details: Decode resize requests near their target size on bounded background workers with explicit cancellation and resource limits.
  - title: Metadata by policy
    details: Choose preserve, safe, or strip with documented platform-specific privacy behavior.
  - title: Small public API
    details: One compression operation, optional AbortSignal control, one capability query, typed results, and stable error codes.
---

<div class="launch-proof">
  <article><strong>Android 23+</strong><span>File and content URIs with device-gated codecs.</span></article>
  <article><strong>iOS 13.4+</strong><span>ImageIO-backed input and runtime-gated WebP output.</span></article>
  <article><strong>Expo dev build</strong><span>Custom native code requires prebuild; Expo Go is unsupported.</span></article>
</div>

> Release status: **0.4.0 candidate**. The current npm `latest` release remains
> **0.3.0** while native and compatibility validation completes.

## Install

```bash
npm install react-native-image-compression-kit
```

```ts
import {
  compressImage,
  getImageCompressionCapabilities,
} from 'react-native-image-compression-kit';

const capabilities = await getImageCompressionCapabilities();
const canWriteWebP = capabilities.formats.some(
  item => item.format === 'webp' && item.output
);

const result = await compressImage({
  source: { uri: imageUri },
  resize: { maxWidth: 2048, maxHeight: 2048, mode: 'contain' },
  output: { format: canWriteWebP ? 'webp' : 'jpeg', quality: 80 },
  metadata: 'safe',
});
```

The source must be a local URI available to native code. Remote URLs and data
URIs are intentionally outside the package scope.

<OptionBuilder />

## What this site demonstrates

The [native result explorer](./demo/index.md) presents artifacts produced by
the Android and iOS example apps, including options, byte counts, dimensions,
platform information, and digests. It does not substitute a browser codec for
the package's native pipeline.

Start with the [installation guide](./guide/installation.md), then choose a
[recipe](./guide/recipes.md) and review the
[capability matrix](./guide/capabilities.md).
