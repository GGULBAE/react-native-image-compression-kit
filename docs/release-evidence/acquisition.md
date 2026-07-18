# Release Evidence Acquisition

Acquisition is the only boundary here that contacts GitHub. It requires an
existing authenticated `gh` session, retains no token or signed download URL,
and never selects a latest run.

## Registry Validation artifacts

```bash
pnpm acquire:release-evidence -- \
  --repository GGULBAE/react-native-image-compression-kit \
  --workflow .github/workflows/registry-validation.yml \
  --source-ref refs/tags/v0.3.0 \
  --source-digest f8ad71f14ac50dac9dc433a46ee4e9a6d7e1bca7 \
  --run-id 29643434413 \
  --version 0.3.0 \
  --expected-tag latest \
  --output-dir /tmp/release-evidence-0.3.0 \
  --report-file /tmp/release-evidence-0.3.0-report.json \
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

Run `29643434413` selected provenance artifact `8429308868` with digest
`sha256:039964a14923ea9f51af8a9568cdea0d1c7cdbbcc3954147f6b59d8054fdb997`
and attestation artifact `8429308948` with digest
`sha256:1d3826a6e17c102a1ab2bb053ae24a996051e464e496bb853ca002d9e6975274`.
The canonical acquisition SHA-256 is
`2673b6f7d755f1aff913ac0f796a1515149d3cd5a8e16acfd21759b71e3c11f0`;
the importer handoff produced evidence SHA-256
`201d16d7845212fa115674deacb6766ea03b2d6982a43036f40f110ee652550e`.

The output is exposed only after the existing offline importer accepts the
staged canonical metadata and artifacts. Duplicate destinations and any
validation, write, handoff, or rename failure fail closed.

Import the accepted canonical bundle into the repository archive:

```bash
pnpm import:release-evidence -- \
  --version 0.3.0 \
  --provenance-artifact-dir /tmp/release-evidence-0.3.0/provenance \
  --attestation-artifact-dir /tmp/release-evidence-0.3.0/attestation \
  --metadata-file /tmp/release-evidence-0.3.0/release-evidence-metadata.json \
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
  --source-ref refs/heads/master \
  --source-digest 1c0a24601e2a59484dfa6a665a1cf09680d947d7 \
  --run-id 29644362987 \
  --version 0.3.0 \
  --output-dir /tmp/review-acquisition-0.3.0 \
  --release-archive-root evidence/npm \
  --json \
  --report-file /tmp/review-acquisition-0.3.0.json
```

The selected review artifact is ID `8429583977`, 425,974 bytes, GitHub digest
`sha256:77549a36e83d742306ee5f5701957d2f935169fd30aee7cd91ccc576e97a9d1e`.
The attestation artifact is ID `8429584119`, 15,644 bytes, digest
`sha256:1a00d909bbbad69fc1635bb14cd970fc9b0c8804f17f12ef5943b63d4f68fb2a`.
They expire at `2026-10-16T12:27:51Z`.

Policy-review acquisition uses the same exact-subject transport boundary with
`artifact-manifest.json` as its temporary subject name. The normalized bundle
must equal the retained attestation ZIP entry byte-for-byte; transport URLs and
credentials never enter canonical metadata, manifests, reports, or archives.

The canonical directory contains `review-evidence-metadata.json`, exact
`artifacts/review.zip` and `artifacts/attestation.zip`, and
`review-acquisition-manifest.json`. Authenticated acquisition at
`2026-07-18T12:31:17.937Z` produced metadata SHA-256
`efaf74032b7433547e0429ebdf8d7764dfa3aae638536ad57bcd59fa04edd03e`
and acquisition SHA-256
`cd1adb2ff31a5b803251f79f66228c879bfb7543a9a264bae3636568bcc62255`.
Importer handoff reproduced archive SHA-256
`582f69b6fae5282bfe6fc758fceee24e37ffe63243cc60108c2e248261d69b72`.

Verify the retained-ZIP fixture and handoff without network access:

```bash
pnpm fixtures:release-evidence-review-acquisition:check
```

After acquisition, continue with [Policy review](policy-review.md) or import the
approved result through [Review archive](review-archive.md).
