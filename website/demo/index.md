# Native result demo

This page is an evidence viewer, not a browser compressor. Every published
result must come from the repository's Android or iOS example app and be linked
to a manifest with source, options, environment, byte metrics, and SHA-256
digests.

::: warning Candidate capture
The v0.3.0 public-launch branch is preparing the first versioned Android and iOS
capture set. No unverified output is presented as package evidence.
:::

## Evidence contract

Each capture records:

- library version and exact source commit;
- platform, OS/API level, and device or simulator;
- input and output SHA-256;
- compression options, format, dimensions, and byte counts;
- capture timestamp and reproduction command.

Native codecs can produce different bytes across OS and device versions. The
manifest makes a result traceable and replayable in its recorded environment;
it does not claim cross-runtime bit-for-bit determinism.

## Planned reference cases

<div class="result-grid">
  <article class="result-card">
    <h3>Android · JPEG target size</h3>
    <p>Bundled input → resized JPEG with a byte ceiling and safe metadata.</p>
    <dl><dt>Status</dt><dd>Capture pending</dd><dt>Authority</dt><dd>Example app + manifest</dd></dl>
  </article>
  <article class="result-card">
    <h3>iOS · WebP fallback</h3>
    <p>Runtime capability check chooses WebP or a documented JPEG fallback.</p>
    <dl><dt>Status</dt><dd>Capture pending</dd><dt>Authority</dt><dd>Example app + manifest</dd></dl>
  </article>
</div>

Until capture completes, use the [capability matrix](../guide/capabilities.md)
and run the [example app](https://github.com/GGULBAE/react-native-image-compression-kit/tree/master/example)
against the bundled deterministic sample.
