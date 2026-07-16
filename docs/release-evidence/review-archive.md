# Review Evidence Archive

The repository-owned archive under `evidence/reviews/0.2.55/` preserves both
exact GitHub artifact ZIPs and every extracted review/attestation byte. Replay
does not reject an already retained archive based on the current clock.

## Import

```bash
pnpm import:release-evidence-review -- \
  --version 0.2.55 \
  --metadata-file /path/to/review-evidence-metadata.json \
  --review-artifact-zip /path/to/review.zip \
  --attestation-artifact-zip /path/to/attestation.zip \
  --archive-dir evidence/reviews/0.2.55 \
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
  --version 0.2.55 \
  --json

pnpm verify:release-evidence-review-archive-set -- --json
```

The single-archive verifier proves ZIP/extracted correspondence, canonical
index and file digests, receipt/manifest/promotion/set identity, offline GitHub
signer verification, and byte equality between the rehearsed archive and
`evidence/npm/0.2.55`. The set verifier discovers supported retained review
versions in stable order and is part of `pnpm verify`.

## Retained identity and digests

- Review run: `29390495773`, attempt 1
- Source: `2782a6e34c70660a6c44a6189c39304317072a22`
- Reviewer/time: `GGULBAE`, `2026-07-15T05:03:59Z`
- Review artifact: `8333046539`, digest
  `sha256:f1ea6c9c2498e4d773a6cc5f6b49d39d9bfacba8bd40ec76c5364c7d3c21c836`
- Attestation artifact: `8333046693`, digest
  `sha256:05ab03d322d15e97cc733e3d0325f6dbb7a468197245ea9c6738241e2477f4d6`
- Attestation: `35388408`
- Candidate SHA-256:
  `aade4a8057bbb8f6b3dc92690b3d9cc5e3b57352a5734396e3921a143a449f8d`
- Receipt SHA-256:
  `45ddefa85cba6a9fed62cb1c187dd0bab2246b72ba66a803b1282e4eac07efad`
- Target evidence SHA-256:
  `e890e90e322ab6205517950466476a9b9430fa3307b2eacbc3ede0234e3f5e78`
- Aggregate archive SHA-256:
  `f63924d58ef18c94379b102949e6870e838a014ac883b7c9c03fca5abc6b56dd`
- Canonical index SHA-256:
  `b43a294a9ab7f1a7b99305a6ecc2c363ec0c472857b9579338bfb68e100fe19f`

Use [Acquisition](acquisition.md) to reproduce the exact importer inputs while
the GitHub artifacts remain available.
