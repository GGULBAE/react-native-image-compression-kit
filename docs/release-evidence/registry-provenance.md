# Registry Provenance and Release Evidence

## Published baseline

npm `version` and `dist-tags.latest` are `0.2.55`, published at
`2026-07-14T12:41:56.173Z`. The validated 51-file registry tarball was 75,022
bytes with integrity
`sha512-942yS0LCt6Che8zP+ZGNCl7AKA/h4oMEYO4TT1u2F+JIDM0vC3X16y8zStHQE4gIVmYscH8h37fOw/c5RuJbpw==`
and shasum `525221309be1eda6fc2fdd80b5e2b9da13faf645`.

Two earlier publish CLI calls stopped at the pre-write EOTP gate. The npm-only
promotion used one successful `npm publish --tag latest`; no manual dist-tag,
git tag, or GitHub Release was created.

## Networked registry smoke

Run only after the exact version is published:

```bash
pnpm smoke:registry -- \
  --version 0.2.55 \
  --expect-tag latest \
  --json \
  --artifact-dir registry-validation
```

The command validates registry metadata, downloads the real tarball, checks
integrity/shasum and package contents, installs it into a clean temporary React
Native consumer, and atomically writes exactly:

- `registry-provenance.json`
- byte-identical `stdout.json`
- `package.tgz`
- `bundle-manifest.json`

## Offline provenance verification

```bash
pnpm verify:registry-provenance -- \
  --artifact-dir /path/to/registry-validation \
  --expect-package react-native-image-compression-kit \
  --expect-version 0.2.55 \
  --expect-tag latest \
  --json
```

The verifier parses the archive in memory, rejects traversal, links, duplicate
or unsupported entries, validates canonical JSON and every declared digest and
size, and performs no npm, GitHub, or other network request.

Successful Registry Validation run
[29333540614](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29333540614)
on commit `194e9387406f71763bc0d617ece0d7d58e235e29` attested manifest
SHA-256 `45677e0204b46a3f388b5cdb5ac7cfa83269dd03479854c25d7ef203582fe2af`
as [attestation 35257248](https://github.com/GGULBAE/react-native-image-compression-kit/attestations/35257248).
The provenance artifact digest is
`sha256:7463b03ff6294b5017d9b3cad05d4c3ea87b542398a5cb70f503cea148dca826`;
the attestation artifact digest is
`sha256:545c63da880d9d91f9ade1cf40ce36a366634c11ff524b87579e6b0fd6d8e28f`.

## Offline attestation verification

```bash
pnpm verify:registry-attestation -- \
  --manifest /path/to/registry-validation/bundle-manifest.json \
  --attestation-bundle /path/to/registry-attestation/attestation.jsonl \
  --trusted-root /path/to/registry-attestation/trusted-root.jsonl \
  --expect-repository GGULBAE/react-native-image-compression-kit \
  --expect-workflow GGULBAE/react-native-image-compression-kit/.github/workflows/registry-validation.yml \
  --expect-ref refs/heads/master \
  --expect-head-sha 194e9387406f71763bc0d617ece0d7d58e235e29 \
  --json
```

The pinned trusted-root SHA-256 is
`65ca537f6ed8a47fd0e560c421baa1f6c1efb8b25fc200d8c5c02c0e92eb2b9c`.
Blocked-network replay reproduced the canonical report at SHA-256
`095756820c5305d50173225edc56d510a724cf95390a7f45f0e179f2207b3ce4`
under UTC and Asia/Seoul.

## Repository-owned archive

The v0.2.50 and v0.2.55 archives live under `evidence/npm/<version>/`. Replay
one version or the complete supported set:

```bash
pnpm verify:release-evidence -- --version 0.2.55
pnpm verify:release-evidence-set -- --json
```

The v0.2.55 index pins Registry Validation run `29333540614`, source commit
`194e9387406f71763bc0d617ece0d7d58e235e29`, attestation `35257248`, every
retained file, and aggregate evidence SHA-256
`e890e90e322ab6205517950466476a9b9430fa3307b2eacbc3ede0234e3f5e78`.
With no selectors the set verifier checks v0.2.50 and v0.2.55 in stable order.

See [Acquisition](acquisition.md) for authenticated artifact download and
canonical importer handoff.
