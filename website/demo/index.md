# Native result explorer

These are results from the repository's real Android and iOS example apps—not
browser substitutes. Both captures used package `0.4.0` from release source
commit [`6841a88`](https://github.com/GGULBAE/react-native-image-compression-kit/commit/6841a887b2d8b6c9e4823d2708233feeecaa77ea)
in [Native Demo Evidence run 29738858393](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29738858393).

<video class="native-demo-video" controls muted playsinline preload="metadata" poster="/demo/android/screen.png">
  <source src="/demo/native-demo.mp4" type="video/mp4">
  Download the <a href="/react-native-image-compression-kit/demo/native-demo.mp4">5-second native result video</a>.
</video>

The video is a five-second crossfade of the exact screenshots below. It is a
presentation asset, while the platform manifests and their SHA-256 digests are
the verification authority.

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
      <dt>Captured</dt><dd>2026-07-20 11:38:47 UTC</dd>
    </dl>
    <details><summary>SHA-256</summary><dl class="digest-list"><dt>Source</dt><dd><code>5bd83125571f96b575b25f3172630a0a6dd61223ca310b586538c3d5b5f0a830</code></dd><dt>Output</dt><dd><code>1ef3c5b545643617b0cb5449ad1589a7eb6f19b850331fd40e8f47990d9dc0b4</code></dd><dt>Screenshot</dt><dd><code>8481be8e201bde93bef5b4a8b415813142938bc5cce69a3829a53b488e5621d7</code></dd></dl></details>
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
      <dt>Captured</dt><dd>2026-07-20 11:40:53 UTC</dd>
    </dl>
    <details><summary>SHA-256</summary><dl class="digest-list"><dt>Source</dt><dd><code>cf6d942c3fbf81442723bc64cab2d5133044494ad0b1e79d6dc9c280519742f2</code></dd><dt>Output</dt><dd><code>2d67403a25ea1cc262805368e7b2b66e2438e605084f042b43151e3c8b0ddca1</code></dd><dt>Screenshot</dt><dd><code>49395bb269d2dafd180ebde054c79c250ec393685b6993cd55044683256b794d</code></dd></dl></details>
  </article>
</div>

## Verify and reproduce

The merged <a href="/react-native-image-compression-kit/demo/manifest.json">evidence manifest</a>
records the complete options, results, file sizes, digests, source identity, and
presentation-video digest. Verify the checked-in bundle without a network:

```bash
pnpm verify:demo-evidence
```

To recapture from the example apps, dispatch the repository's
[Native Demo Evidence workflow](https://github.com/GGULBAE/react-native-image-compression-kit/actions/workflows/demo-evidence.yml)
with the exact source SHA. Maintainers then merge the downloaded Android and
iOS artifacts with `pnpm merge:demo-evidence`; the
[launch runbook](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/launch/README.md)
keeps the full review procedure.
