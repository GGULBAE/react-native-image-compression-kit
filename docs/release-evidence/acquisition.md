# Release Evidence Acquisition

Acquisition is the only boundary here that contacts GitHub. It requires an
existing authenticated `gh` session, retains no token or signed download URL,
and never selects a latest run.

## Registry Validation artifacts

```bash
pnpm acquire:release-evidence -- \
  --repository GGULBAE/react-native-image-compression-kit \
  --workflow .github/workflows/registry-validation.yml \
  --source-ref refs/heads/master \
  --source-digest 6841a887b2d8b6c9e4823d2708233feeecaa77ea \
  --run-id 29737871213 \
  --version 0.4.0 \
  --expected-tag latest \
  --output-dir /tmp/release-evidence-0.4.0 \
  --report-file /tmp/release-evidence-0.4.0-report.json \
  --json
```

The command validates the repository/workflow/ref/source/run/version/tag tuple,
requires a completed successful `workflow_dispatch`, selects exactly the two
version-qualified artifacts by immutable artifact ID, matches GitHub SHA-256,
size, creation, expiration, repository, and run metadata, then validates the
downloaded ZIP bytes. It never infers a run.

GitHub's attestation response may expose either an inline bundle or a signed
`bundle_url`. Registry and policy-review acquisition share one exact-subject
transport boundary. Before accepting either form, it requires the requested
SHA-256 to match the exact manifest bytes, at least one API attestation, a
positive repository ID, and an HTTPS bundle URL containing one attestation ID.
Multiple inline bundles are sanitized for the downstream exact retained-bundle
match; multiple URL-only responses fail closed because they cannot be selected
without exposing ambiguous transport. The boundary returns only
`repository_id`, `attestation_id`, and the parsed bundle; the raw URL, its query
token, and unrelated API fields are discarded.

For a bundle-less response, the boundary runs `gh attestation download` against
the exact manifest in a private temporary directory. It requires exactly one
regular JSONL file and exactly one non-empty JSON record, then applies the same
JSON-object validation used for an inline bundle. Missing subjects, duplicate
attestations, duplicate JSONL files or records, invalid JSON, and command
failure all fail closed. The temporary subject and download directory are
removed on success and every failure path. A retained JSONL artifact may contain
multiple exact-subject records, such as GitHub's automatic Release attestation
alongside Registry Validation provenance. The acquisition core selects the
committed attestation ID and requires its normalized bundle exactly once in the
retained JSONL bytes.

Run `29737871213` selected provenance artifact `8459139656` with digest
`sha256:1a931104adbad66300fb6e5b43e8e344acbb3f5b8aee73dd07aef9ff319244cb`
and attestation artifact `8459140075` with digest
`sha256:4158a78f03e2fcd222ad6698d1d9379b890e3e4e301dbcb82104f0ee195e705e`.
The canonical acquisition SHA-256 is
`a7a69bc2f4d51e5bd9847a026dd32f46231c63274f2a7b649240ac272a8bc569`;
the importer handoff produced evidence SHA-256
`d6ab0b806fd1c5d5605faeafe2d9809b4a665193219694a416c154f833bc2558`.

The output is exposed only after the existing offline importer accepts the
staged canonical metadata and artifacts. Duplicate destinations and any
validation, write, handoff, or rename failure fail closed.

Import the accepted canonical bundle into the repository archive:

```bash
pnpm import:release-evidence -- \
  --version 0.4.0 \
  --provenance-artifact-dir /tmp/release-evidence-0.4.0/provenance \
  --attestation-artifact-dir /tmp/release-evidence-0.4.0/attestation \
  --metadata-file /tmp/release-evidence-0.4.0/release-evidence-metadata.json \
  --archive-root evidence/npm \
  --json
```

Verify the exact committed acquisition fixtures without network access:

```bash
pnpm fixtures:release-evidence-acquisition:check
```

## Policy-review artifacts

```bash
pnpm acquire:release-evidence-review -- \
  --repository GGULBAE/react-native-image-compression-kit \
  --workflow .github/workflows/release-evidence-policy-review.yml \
  --source-ref refs/heads/codex/v0.4.0-post-release-hardening \
  --source-digest 7b0754a60a9497969fe75b4058dad0c4eb614159 \
  --run-id 29738926758 \
  --version 0.4.0 \
  --output-dir /tmp/review-acquisition-0.4.0 \
  --release-archive-root evidence/npm \
  --json \
  --report-file /tmp/review-acquisition-0.4.0.json
```

The selected review artifact is ID `8459514238`, 525,825 bytes, GitHub digest
`sha256:87387a9636844a65bdc1a8433fb0b9aada6087b287c77d8363e98c435d489203`.
The attestation artifact is ID `8459514536`, 16,145 bytes, digest
`sha256:f4916546d99ffb3a34269a7ff487c82088e6bb949fa0329da598e9c32c9e32f9`.
They expire at `2026-10-18T11:32:49Z`.

Policy-review acquisition uses the same exact-subject transport boundary with
`artifact-manifest.json` as its temporary subject name. The normalized bundle
must equal the retained attestation ZIP entry byte-for-byte; transport URLs and
credentials never enter canonical metadata, manifests, reports, or archives.

The canonical directory contains `review-evidence-metadata.json`, exact
`artifacts/review.zip` and `artifacts/attestation.zip`, and
`review-acquisition-manifest.json`. Authenticated acquisition at
`2026-07-20T11:35:19.581Z` produced metadata SHA-256
`3e6205c7d3c23876e84584bce758ba3e4c84c89cbe1e06dc8898a1ea3890e014`
and acquisition SHA-256
`c3bf801729a34ff644361bdfd86916d0b58e37efb1c5c9388f87ebc023a0e649`.
Importer handoff reproduced archive SHA-256
`58a9c63441d0ec9364df1b72addd0d947152973a92aa7ec7ef08e5c01d9b3106`.

Verify the retained-ZIP fixture and handoff without network access:

```bash
pnpm fixtures:release-evidence-review-acquisition:check
```

After acquisition, continue with [Policy review](policy-review.md) or import the
approved result through [Review archive](review-archive.md).
