# Review Evidence Archive

The repository-owned archives under `evidence/reviews/0.2.55/`,
`evidence/reviews/0.2.62/`, `evidence/reviews/0.3.0/`, and
`evidence/reviews/0.4.0/` preserve both exact
GitHub artifact ZIPs and every extracted review/attestation byte. Replay does
not reject an already retained archive based on the current clock.

## Import

```bash
pnpm import:release-evidence-review -- \
  --version 0.4.0 \
  --metadata-file /path/to/review-evidence-metadata.json \
  --review-artifact-zip /path/to/review.zip \
  --attestation-artifact-zip /path/to/attestation.zip \
  --archive-dir evidence/reviews/0.4.0 \
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
  --version 0.4.0 \
  --json

pnpm verify:release-evidence-review-archive-set -- --json
```

The single-archive verifier proves ZIP/extracted correspondence, canonical
index and file digests, receipt/manifest/promotion/set identity, offline GitHub
signer verification, and byte equality between the rehearsed archive and
`evidence/npm/0.4.0`. The set verifier checks retained review versions v0.2.55,
v0.2.62, v0.3.0, and v0.4.0 in stable order and is part of `pnpm verify`.

## Retained identity and digests

- Review run: `29738926758`, attempt 1
- Source: `7b0754a60a9497969fe75b4058dad0c4eb614159`
- Reviewer/time: `GGULBAE`, `2026-07-20T11:32:47Z`
- Review artifact: `8459514238`, digest
  `sha256:87387a9636844a65bdc1a8433fb0b9aada6087b287c77d8363e98c435d489203`
- Attestation artifact: `8459514536`, digest
  `sha256:f4916546d99ffb3a34269a7ff487c82088e6bb949fa0329da598e9c32c9e32f9`
- Attestation: `36142406`
- Candidate SHA-256:
  `7b97603d98f667c73a1e6120b721e161861a73626ade212a82c9df86caf98090`
- Receipt SHA-256:
  `e99462b2be858e7028e282969889474487887f4a31a632f6c080afccc3ef176d`
- Target evidence SHA-256:
  `d6ab0b806fd1c5d5605faeafe2d9809b4a665193219694a416c154f833bc2558`
- Aggregate archive SHA-256:
  `58a9c63441d0ec9364df1b72addd0d947152973a92aa7ec7ef08e5c01d9b3106`
- Canonical index SHA-256:
  `026a03f377cbbf4a4f50c770d59eee1e715736807a3340924de139e3b31dd53c`

Use [Acquisition](acquisition.md) to reproduce the exact importer inputs while
the GitHub artifacts remain available.
