# Review Evidence Archive

The repository-owned archives under `evidence/reviews/0.2.55/`,
`evidence/reviews/0.2.62/`, and `evidence/reviews/0.3.0/` preserve both exact
GitHub artifact ZIPs and every extracted review/attestation byte. Replay does
not reject an already retained archive based on the current clock.

## Import

```bash
pnpm import:release-evidence-review -- \
  --version 0.3.0 \
  --metadata-file /path/to/review-evidence-metadata.json \
  --review-artifact-zip /path/to/review.zip \
  --attestation-artifact-zip /path/to/attestation.zip \
  --archive-dir evidence/reviews/0.3.0 \
  --release-archive-root evidence/npm \
  --json \
  --report-file /tmp/review-import.json
```

Import rejects traversal, absolute/ambiguous paths, duplicate entries,
symlinks, directories, encryption, unsupported compression, missing/additional
files, canonical drift, signer drift, target archive mismatch, and a pre-existing
destination. Staging is fully verified before atomic rename.

## Replay

```bash
pnpm verify:release-evidence-review-archive -- \
  --version 0.3.0 \
  --json

pnpm verify:release-evidence-review-archive-set -- --json
```

The single-archive verifier proves ZIP/extracted correspondence, canonical
index and file digests, receipt/manifest/promotion/set identity, offline GitHub
signer verification, and byte equality between the rehearsed archive and
`evidence/npm/0.3.0`. The set verifier checks retained review versions v0.2.55,
v0.2.62, and v0.3.0 in stable order and is part of `pnpm verify`.

## Retained identity and digests

- Review run: `29644362987`, attempt 1
- Source: `1c0a24601e2a59484dfa6a665a1cf09680d947d7`
- Reviewer/time: `GGULBAE`, `2026-07-18T12:27:50Z`
- Review artifact: `8429583977`, digest
  `sha256:77549a36e83d742306ee5f5701957d2f935169fd30aee7cd91ccc576e97a9d1e`
- Attestation artifact: `8429584119`, digest
  `sha256:1a00d909bbbad69fc1635bb14cd970fc9b0c8804f17f12ef5943b63d4f68fb2a`
- Attestation: `35960166`
- Candidate SHA-256:
  `eba4fb1e1b4cdcef03bc4d109fcb1b0d3a461cc56a389fbcdb89e182b7b033d9`
- Receipt SHA-256:
  `d56d0b10a50ad92cc20abcdc5287fe2b74e4a024e3d268ee7a183180e33861e1`
- Target evidence SHA-256:
  `201d16d7845212fa115674deacb6766ea03b2d6982a43036f40f110ee652550e`
- Aggregate archive SHA-256:
  `582f69b6fae5282bfe6fc758fceee24e37ffe63243cc60108c2e248261d69b72`
- Canonical index SHA-256:
  `f28e3b644d3ba4f6e71f546f52d92d87820ad68a190e4c21051fa2dc8274f9ed`

Use [Acquisition](acquisition.md) to reproduce the exact importer inputs while
the GitHub artifacts remain available.
