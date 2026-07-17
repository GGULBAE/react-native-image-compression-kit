# Review Evidence Archive

The repository-owned archives under `evidence/reviews/0.2.55/` and
`evidence/reviews/0.2.62/` preserve both exact GitHub artifact ZIPs and every
extracted review/attestation byte. Replay does not reject an already retained
archive based on the current clock.

## Import

```bash
pnpm import:release-evidence-review -- \
  --version 0.2.62 \
  --metadata-file /path/to/review-evidence-metadata.json \
  --review-artifact-zip /path/to/review.zip \
  --attestation-artifact-zip /path/to/attestation.zip \
  --archive-dir evidence/reviews/0.2.62 \
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
  --version 0.2.62 \
  --json

pnpm verify:release-evidence-review-archive-set -- --json
```

The single-archive verifier proves ZIP/extracted correspondence, canonical
index and file digests, receipt/manifest/promotion/set identity, offline GitHub
signer verification, and byte equality between the rehearsed archive and
`evidence/npm/0.2.62`. The set verifier checks retained review versions
v0.2.55 and v0.2.62 in stable order and is part of `pnpm verify`.

## Retained identity and digests

- Review run: `29561132321`, attempt 1
- Source: `dd63305e33a4a0e3f9c8eb40a0cfa3a3eb68c7d2`
- Reviewer/time: `GGULBAE`, `2026-07-17T06:49:02Z`
- Review artifact: `8399292402`, digest
  `sha256:26c2880f1ed325cbd55956b02bc8558a692a2fecd47b2502be10ca89a7d57855`
- Attestation artifact: `8399292698`, digest
  `sha256:e6e3b25ea56fe52be16f86e8d5cb7bfc65c8c673f383d03f190682e1546501ae`
- Attestation: `35780183`
- Candidate SHA-256:
  `0af980676b08f73b62b2e785dd39320d9ce1c55bfac58df43ebf6b87eb102cdc`
- Receipt SHA-256:
  `4d05d0fec2ec9d43575336a1b0fd4d17059f87b4db8879afeefeacd4d5d6cd2f`
- Target evidence SHA-256:
  `e5a23c12d99362d5ec3c882de3acfb161b6644e9777b16dc036e0d675cf511a6`
- Aggregate archive SHA-256:
  `49ce812d70e53a62581b2ad5dda8e67a920d815506f885afb5267c68b2bd041d`
- Canonical index SHA-256:
  `653f6b6e073831ffe69b09c9a86bd529bdb05d98e617d710043f7228c567be6f`

Use [Acquisition](acquisition.md) to reproduce the exact importer inputs while
the GitHub artifacts remain available.
