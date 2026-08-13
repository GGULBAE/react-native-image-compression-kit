---
description: Reproducible source-tree evidence for large-photo byte, visual-integrity, and output-lifecycle contracts.
---

# Economic resilience evidence

<EconomicResilienceArchive />

The scenario asks a practical integration question: when an application sends
a large JPEG through the package, which byte, visual, and file-lifecycle facts
can be reproduced without turning one hosted runner into a universal economic
claim?

<div class="economic-contract-grid">
  <article>
    <span>Input contract</span>
    <strong>12 MP JPEG</strong>
    <p>Project-generated 4,000 × 3,000 fixture with a fixed SHA-256 identity.</p>
  </article>
  <article>
    <span>Output request</span>
    <strong>1,600 × 1,200</strong>
    <p>Contain resize, JPEG quality 90, metadata strip, and a 500,000 B ceiling.</p>
  </article>
  <article>
    <span>Lifecycle gate</span>
    <strong>0 B residual</strong>
    <p>Two warmups and ten measured package outputs must leave zero residual bytes.</p>
  </article>
</div>

These values define the fixture and acceptance plan. The archive displays them
as observations only after Android and iOS artifacts from the same accepted
workflow run are stored and independently replayed.

## What a capture must prove

<div class="economic-proof-flow" aria-label="Economic resilience evidence verification flow">
  <article><span>1</span><strong>Bind</strong><p>Exact master SHA, workflow_dispatch run, attempt, environment, and capabilities.</p></article>
  <article><span>2</span><strong>Inspect</strong><p>Source and output bytes, JPEG geometry, stripped metadata, and cleanup state.</p></article>
  <article><span>3</span><strong>Replay</strong><p>Portable FFmpeg schema 3 SSIM plus an explicit vertical-flip control.</p></article>
  <article><span>4</span><strong>Limit</strong><p>Keep source/output difference separate from transfer, storage, and currency claims.</p></article>
</div>

Each platform artifact must contain exactly six regular, non-symlink files
whose hard-link count is exactly one:
`economic-resilience.json`, `environment.json`, `fixture-manifest.json`,
`source.jpg`, `output.jpg`, and `visual-agreement.json`. Android and iOS must
carry byte-identical source and fixture-manifest files and identify the same
full source SHA, workflow run ID, and run attempt.
The retained run must resolve to `refs/heads/master`; the importer derives this
identity from GitHub rather than accepting a caller-supplied branch constant.

The visual gate independently decodes the retained JPEGs. Both the captured
and replayed reports must satisfy contain geometry, upright SSIM of at least
0.90, and an upright-over-vertical-flip margin of at least 0.02. Schema 3 pins
the full-range JPEG conversion, limited-range `yuv444p` comparison surface,
Lanczos scaler, and a maximum replay score tolerance of 0.001.

## Economic claim boundary

| Field | Archive meaning | What it does not establish |
| --- | --- | --- |
| Source bytes | Bytes of the retained fixture entering this package call | Upstream transfer volume |
| Output bytes | Bytes of measured iteration 10 | Bytes accepted or retained by a production backend |
| Signed byte difference | `source bytes - output bytes` for this one operation | Avoided transfer or storage |
| `source-remains` | The source still exists after the package run | App-owned source replacement |
| `matchedTransferBaseline: null` | No matched current-pipeline transfer baseline was measured | Transfer savings |
| `costSavingsClaim: null` | No price and retention model is bound to the capture | Currency savings |
| Raw timing samples | Environment-specific call-only observations | A platform comparison or speed ranking |

The signed byte difference can be useful when planning a measurement, but it
is not money. A defensible cost estimate still needs accepted-output counts,
an app-owned retention boundary, a matched transfer baseline, and dated prices.
Use the [byte economics guide](../guide/byte-economics.md) to model those inputs
separately.

## Append-only archive layout

Captures are addressed by the full source SHA. There is no mutable `latest`
alias, and importing the same SHA twice is rejected.

```text
website/public/evidence/economic-resilience/
├── index.json
└── source-tree/
    └── <40-character-source-sha>/
        ├── capture-set.json
        ├── run-metadata.json
        ├── artifact-metadata.json
        ├── artifacts/
        │   ├── android.zip
        │   └── ios.zip
        ├── android/  # exact six-file artifact
        └── ios/      # exact six-file artifact
```

The archive verifier rejects path traversal, linked files or directories,
unexpected assets, SHA-to-directory mismatches, overwrites, unindexed capture
directories, and index entries without a corresponding capture directory.

## Import and verify

Run the independent verifier before reviewing an archive change:

```bash
pnpm import:public-economic-resilience-evidence -- \
  --run-id <successful-master-workflow-run-id>

pnpm verify:public-economic-resilience-evidence
pnpm verify:public-economic-resilience-evolution -- --base <base-commit-sha>
```

The importer queries the GitHub run and artifact APIs itself, downloads the two
artifacts by immutable ID, binds their API digest and size, and retains both
original ZIPs beside the exact six extracted files. It verifies bounded ZIP
member inventories and CRCs, rechecks cross-platform identity, refuses
replacement, and uses a recoverable journal for capture/index publication.
The verifier rechecks ZIP-to-file equality and replays every retained platform
bundle using local `zipinfo`, `unzip`, FFmpeg, and ffprobe tools. CI also compares
the base revision so every earlier capture and retained byte remains unchanged;
for each new suffix entry, it reacquires the GitHub run and artifacts and
requires the retained metadata and ZIP bytes to match the API response exactly.

For the native capture boundary and raw-sample format, see the
[12 MP benchmark methodology](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/benchmarks/README.md#12-mp-kit-only-economic-resilience).
