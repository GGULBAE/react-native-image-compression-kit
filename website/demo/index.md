# Native walkthrough explorer

These are results from the repository's real Android and iOS example apps—not
browser substitutes. Both captures used package `0.4.0` from exact source
commit [`11b91af`](https://github.com/GGULBAE/react-native-image-compression-kit/commit/11b91af66322d7b98b46481739c54825b406ef0c)
in [Native Demo Evidence run 31078379910](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/31078379910).

## Guided walkthroughs

<div class="result-grid">
  <article class="result-card">
    <h3>Android · 28.2 seconds</h3>
    <video class="native-demo-video" controls muted playsinline preload="metadata" poster="/demo/android/screen.png">
      <source src="/demo/android/recording.mp4" type="video/mp4">
      Download the <a href="/react-native-image-compression-kit/demo/android/recording.mp4">Android native walkthrough</a>.
    </video>
  </article>
  <article class="result-card">
    <h3>iOS · 26.6 seconds</h3>
    <video class="native-demo-video" controls muted playsinline preload="metadata" poster="/demo/ios/screen.png">
      <source src="/demo/ios/recording.mp4" type="video/mp4">
      Download the <a href="/react-native-image-compression-kit/demo/ios/recording.mp4">iOS native walkthrough</a>.
    </video>
  </article>
</div>

Each recording shows the capture-only app moving through the real Source,
Options, Capability, Compress, and Result stages. The hosted recorders capture
native frames, `ffmpeg` aligns them to the independently logged walkthrough
timeline, and the final six seconds hold the exact native result screenshot.
The manifest and SHA-256 digests remain the verification authority.

## Shared compression request

```ts
await compressImage({
  source: { uri: bundledLocalFileUri },
  resize: { maxWidth: 160, maxHeight: 160, mode: 'contain' },
  output: { format: 'jpeg', quality: 76, maxBytes: 8_000 },
  metadata: 'safe',
});
```

Native codecs can produce different bytes across OS and device versions. These
captures are traceable and replayable in their recorded environments; they do
not claim cross-runtime bit-for-bit determinism.

## Platform evidence

<div class="result-grid">
  <article class="result-card">
    <h3>Android</h3>
    <img class="result-screen" src="/demo/android/screen.png" alt="Android example app showing JPEG compression before and after images with byte metrics">
    <div class="evidence-pair">
      <figure><img src="/demo/android/source.jpg" alt="Android source image"><figcaption>13,543 B source</figcaption></figure>
      <figure><img src="/demo/android/output.jpg" alt="Android compressed output"><figcaption>2,264 B output</figcaption></figure>
    </div>
    <dl>
      <dt>Runtime</dt><dd>Android 15 / API 35</dd>
      <dt>Device</dt><dd>Google sdk_gphone64_x86_64</dd>
      <dt>Output</dt><dd>JPEG · 100 × 160</dd>
      <dt>Ratio</dt><dd>0.167 · 16.7% of source bytes</dd>
      <dt>Captured</dt><dd>2026-08-06 06:54:27 UTC</dd>
    </dl>
    <details><summary>SHA-256</summary><dl class="digest-list"><dt>Source</dt><dd><code>5bd83125571f96b575b25f3172630a0a6dd61223ca310b586538c3d5b5f0a830</code></dd><dt>Output</dt><dd><code>1ef3c5b545643617b0cb5449ad1589a7eb6f19b850331fd40e8f47990d9dc0b4</code></dd><dt>Screenshot</dt><dd><code>27b276a47f8972e89b49590b762fcb99137c73798fbde1ab45c1a1c34600908c</code></dd><dt>Recording</dt><dd><code>89c0a7cd3a921bbec9c6a796689048fe525e2dd709b0d8b12211fdb62d739847</code></dd></dl></details>
  </article>
  <article class="result-card">
    <h3>iOS</h3>
    <img class="result-screen" src="/demo/ios/screen.png" alt="iOS example app showing JPEG compression before and after images with byte metrics">
    <div class="evidence-pair">
      <figure><img src="/demo/ios/source.jpg" alt="iOS source image"><figcaption>3,317 B source</figcaption></figure>
      <figure><img src="/demo/ios/output.jpg" alt="iOS compressed output"><figcaption>2,353 B output</figcaption></figure>
    </div>
    <dl>
      <dt>Runtime</dt><dd>iOS 26.4</dd>
      <dt>Device</dt><dd>iPhone 17 Pro simulator</dd>
      <dt>Output</dt><dd>JPEG · 100 × 160</dd>
      <dt>Ratio</dt><dd>0.709 · 70.9% of source bytes</dd>
      <dt>Captured</dt><dd>2026-08-06 07:03:57 UTC</dd>
    </dl>
    <details><summary>SHA-256</summary><dl class="digest-list"><dt>Source</dt><dd><code>cf6d942c3fbf81442723bc64cab2d5133044494ad0b1e79d6dc9c280519742f2</code></dd><dt>Output</dt><dd><code>2d67403a25ea1cc262805368e7b2b66e2438e605084f042b43151e3c8b0ddca1</code></dd><dt>Screenshot</dt><dd><code>6f6797b717979bb0e4461ef6868f8ea2e1ba284b72e6633d3b8a82a377109e8d</code></dd><dt>Recording</dt><dd><code>09413ceedf6bb4774c35ec68f010a9d677e7737d8b07ceef8ae0aaeea45281e8</code></dd></dl></details>
  </article>
</div>

## Verify and reproduce

The merged <a href="/react-native-image-compression-kit/demo/manifest.json">evidence manifest</a>
records the complete options, results, file sizes, digests, source identity, and
per-platform walkthrough timeline. Verify the checked-in bundle without a
network:

```bash
pnpm verify:demo-evidence
```

To recapture from the example apps, dispatch the repository's
[Native Demo Evidence workflow](https://github.com/GGULBAE/react-native-image-compression-kit/actions/workflows/demo-evidence.yml)
with the exact source SHA. Maintainers then merge the downloaded Android and
iOS artifacts with `pnpm merge:demo-evidence`; the
[launch runbook](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/launch/README.md)
keeps the full review procedure.
