# Native result explorer

These are results from the repository's real Android and iOS example apps—not
browser substitutes. Both captures used package `0.3.0` from source commit
[`e5e1e4e`](https://github.com/GGULBAE/react-native-image-compression-kit/commit/e5e1e4e19d36ff719092accae82811545f166d65)
in [Native Demo Evidence run 29635966139](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29635966139).

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
      <figure><img src="/demo/android/output.jpg" alt="Android compressed output"><figcaption>2,284 B output</figcaption></figure>
    </div>
    <dl>
      <dt>Runtime</dt><dd>Android 15 / API 35</dd>
      <dt>Device</dt><dd>Google sdk_gphone64_x86_64</dd>
      <dt>Output</dt><dd>JPEG · 100 × 160</dd>
      <dt>Ratio</dt><dd>0.169 · 16.9% of source bytes</dd>
      <dt>Captured</dt><dd>2026-07-18 07:40:41 UTC</dd>
    </dl>
    <details><summary>SHA-256</summary><dl class="digest-list"><dt>Source</dt><dd><code>5bd83125571f96b575b25f3172630a0a6dd61223ca310b586538c3d5b5f0a830</code></dd><dt>Output</dt><dd><code>4a6f8facb96cadd1f89cce221d9da0ea986d253678e568931eda86e4098a12b0</code></dd><dt>Screenshot</dt><dd><code>788df778c7c9839e4268b647f0d4a9694fd29ab39f19597537a08840f27038e4</code></dd></dl></details>
  </article>
  <article class="result-card">
    <h3>iOS</h3>
    <img class="result-screen" src="/demo/ios/screen.png" alt="iOS example app showing JPEG compression before and after images with byte metrics">
    <div class="evidence-pair">
      <figure><img src="/demo/ios/source.jpg" alt="iOS source image"><figcaption>3,317 B source</figcaption></figure>
      <figure><img src="/demo/ios/output.jpg" alt="iOS compressed output"><figcaption>2,473 B output</figcaption></figure>
    </div>
    <dl>
      <dt>Runtime</dt><dd>iOS 26.4</dd>
      <dt>Device</dt><dd>iPhone 17 Pro simulator</dd>
      <dt>Output</dt><dd>JPEG · 100 × 160</dd>
      <dt>Ratio</dt><dd>0.746 · 74.6% of source bytes</dd>
      <dt>Captured</dt><dd>2026-07-18 07:45:19 UTC</dd>
    </dl>
    <details><summary>SHA-256</summary><dl class="digest-list"><dt>Source</dt><dd><code>cf6d942c3fbf81442723bc64cab2d5133044494ad0b1e79d6dc9c280519742f2</code></dd><dt>Output</dt><dd><code>668914493228369301a615e7486e95f1abc31e5f9a2b4175c551fe74fa9eaf26</code></dd><dt>Screenshot</dt><dd><code>1efe060a9fb8c3954578ae665bdf1838b5c0ff616693ab1368c179c9c58b3ade</code></dd></dl></details>
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
[Native Demo Evidence workflow](https://github.com/GGULBAE/react-native-image-compression-kit/actions/workflows/native-demo.yml)
with the exact source SHA. Maintainers then merge the downloaded Android and
iOS artifacts with `pnpm merge:demo-evidence`; the
[launch runbook](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/launch/README.md)
keeps the full review procedure.
