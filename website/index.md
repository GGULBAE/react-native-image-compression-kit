---
layout: home
title: React Native Image Compression Kit
titleTemplate: false
hero:
  name: React Native Image Compression Kit
  text: Control image bytes before upload
  tagline: Bound upload payloads and app-owned image files with explicit native capabilities, resource limits, cancellation, metadata policy, and output ownership.
  image:
    src: /logo.svg
    alt: Image Compression Kit logo
  actions:
    - theme: brand
      text: Understand the cost boundary
      link: /guide/byte-economics
    - theme: alt
      text: Install in 60 seconds
      link: /guide/installation
    - theme: alt
      text: Read the API
      link: /reference/api
features:
  - icon: 📤
    title: Bound upload bytes
    details: Target an accepted JPEG or WebP byte budget before the first hop.
  - icon: 📱
    title: Reclaim owned outputs
    details: Publish one verified cache file and explicitly release it after use.
  - icon: 🛡️
    title: Keep native work predictable
    details: Query capabilities, bound resources, cancel cleanly, and apply metadata policy.
---

## Why device-side bytes matter

Ericsson reports that average mobile data traffic reached **22 GB per active
smartphone per month at the end of 2025** and forecasts mobile data traffic,
excluding fixed wireless access, to reach **328 EB per month in 2031**. This is
market context—not a package savings claim.
[Review the source and forecast limits](https://www.ericsson.com/en/reports-and-papers/mobility-report/dataforecasts/mobile-traffic-forecast).

Image cost has two surfaces: bytes that move from the device and app-owned
files that remain in queues, outputs, caches, and residual storage.

<picture class="byte-economics-picture">
  <source media="(max-width: 640px)" srcset="/byte-economics-mobile.svg" />
  <img class="byte-economics-image" src="/byte-economics.svg" alt="Upload economics for moving bytes and device-storage economics for app-owned bytes at rest" />
</picture>

<div class="byte-cost-grid">
  <article>
    <span class="byte-cost-icon" aria-hidden="true">📤</span>
    <p class="eyebrow">Upload</p>
    <strong class="byte-cost-value">≈ 3.5 TB</strong>
    <p>1M accepted images · 4 MB → 500 KB</p>
  </article>
  <article>
    <span class="byte-cost-icon" aria-hidden="true">📱</span>
    <p class="eyebrow">App-owned queue</p>
    <strong class="byte-cost-value">800 → 100 MB</strong>
    <p>200 replaceable staging images</p>
  </article>
  <article>
    <span class="byte-cost-icon" aria-hidden="true">🛡️</span>
    <p class="eyebrow">Accurate boundary</p>
    <strong class="byte-cost-value">Source unchanged</strong>
    <p>Gallery files are never removed</p>
  </article>
</div>

<p class="scenario-note">The figures are decimal-unit arithmetic examples, not measured performance or guaranteed cost reduction. Source and output can temporarily coexist; copied or durable files remain the host application's responsibility.</p>

## A small, explicit boundary

<div class="boundary-flow">
  <article><span aria-hidden="true">1️⃣</span><strong>Check</strong><p>Ask the runtime for codecs, policies, and limits.</p></article>
  <article><span aria-hidden="true">2️⃣</span><strong>Bound</strong><p>Compress under byte, pixel, metadata, and cancellation rules.</p></article>
  <article><span aria-hidden="true">3️⃣</span><strong>Release</strong><p>Upload the verified result, then remove the owned cache output.</p></article>
</div>

<div class="launch-proof">
  <article><strong>Android 23+</strong><span>File and content URIs with device-gated codecs.</span></article>
  <article><strong>iOS 13.4+</strong><span>ImageIO-backed input and runtime-gated WebP output.</span></article>
  <article><strong>Expo dev build</strong><span>Custom native code requires prebuild; Expo Go is unsupported.</span></article>
</div>

> Current release: **0.4.0** is published on npm `latest`. The immutable tag,
> GitHub Release, registry provenance, and retained evidence all bind the same
> verified artifact and source.

## Evidence, not adjectives

<picture class="evidence-scorecard-picture">
  <source media="(max-width: 640px)" srcset="/evidence-scorecard-mobile.svg" />
  <img class="evidence-scorecard-image" src="/evidence-scorecard.svg" alt="v0.4.0 evidence snapshot: two of two byte-budget fixtures passed, zero residual-output target, two recorded runtime capability captures, 96 percent fewer planned decoded pixels, zero of seven named sensitive fields retained, and eight of eight packed-consumer platform builds passed." />
</picture>

The scorecard separates measured fixture and release evidence from broader
claims the project does not yet make. Review the [metric definitions and
interpretation limits](./reference/evidence.md) before comparing results.

## Install

```bash
npm install react-native-image-compression-kit
```

```ts
import {
  compressImage,
  getImageCompressionCapabilities,
  removeCompressionOutput,
} from 'react-native-image-compression-kit';

const capabilities = await getImageCompressionCapabilities();
const canWriteWebP = capabilities.formats.some(
  item => item.format === 'webp' && item.output
);

const result = await compressImage({
  source: { uri: imageUri },
  resize: { maxWidth: 2048, maxHeight: 2048, mode: 'contain' },
  output: {
    format: canWriteWebP ? 'webp' : 'jpeg',
    quality: 90,
    maxBytes: 500_000,
  },
  metadata: 'safe',
});

try {
  const accepted = result.byteSize <= 500_000;
  if (!accepted) throw new Error('Image did not meet the upload policy');
  await upload(result.uri);
} finally {
  await removeCompressionOutput(result.uri);
}
```

The source must be a local URI available to native code. Remote URLs and data
URIs are intentionally outside the package scope.

<OptionBuilder />

## From problem to integration

Start with [the byte economics and measurement guide](./guide/byte-economics.md)
to decide what your application should measure. Then choose a
[compression recipe](./guide/recipes.md), build a request with the option
builder above, and confirm [runtime capabilities](./guide/capabilities.md).

The [native result explorer](./demo/index.md) remains reproducible evidence that
the Android and iOS example apps execute the contract. It is supporting proof,
not the product's reason to exist, and it does not substitute a browser codec
for the native pipeline.
