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
  --source-digest 194e9387406f71763bc0d617ece0d7d58e235e29 \
  --run-id 29333540614 \
  --version 0.2.55 \
  --expected-tag latest \
  --output-dir /tmp/release-evidence-0.2.55 \
  --json
```

The command validates the repository/workflow/ref/source/run/version/tag tuple,
requires a completed successful `workflow_dispatch`, selects exactly the two
version-qualified artifacts by immutable artifact ID, matches GitHub SHA-256,
size, creation, expiration, repository, and run metadata, then validates the
downloaded ZIP bytes. It never infers a run.

The output is exposed only after the existing offline importer accepts the
staged canonical metadata and artifacts. Duplicate destinations and any
validation, write, handoff, or rename failure fail closed.

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
  --source-digest 2782a6e34c70660a6c44a6189c39304317072a22 \
  --run-id 29390495773 \
  --version 0.2.55 \
  --output-dir /tmp/review-acquisition-0.2.55 \
  --release-archive-root evidence/npm \
  --json \
  --report-file /tmp/review-acquisition-0.2.55.json
```

The selected review artifact is ID `8333046539`, 285,466 bytes, GitHub digest
`sha256:f1ea6c9c2498e4d773a6cc5f6b49d39d9bfacba8bd40ec76c5364c7d3c21c836`.
The attestation artifact is ID `8333046693`, 15,751 bytes, digest
`sha256:05ab03d322d15e97cc733e3d0325f6dbb7a468197245ea9c6738241e2477f4d6`.
Both record creation `2026-07-15T05:04:37Z` and expiration
`2026-10-13T05:04:01Z`.

The canonical directory contains `review-evidence-metadata.json`, exact
`artifacts/review.zip` and `artifacts/attestation.zip`, and
`review-acquisition-manifest.json`. Authenticated acquisition at
`2026-07-15T06:51:05.525Z` produced metadata SHA-256
`6e4074a785ba2b596fdf336d1990eb522d30237927f75c56abfb27a4ba726d4c`
and acquisition SHA-256
`b2cae5664d149cbc2c3a7202dc580b7c8008520d50050ce7e7bbf822e7285c7c`.
Importer handoff reproduced archive SHA-256
`f63924d58ef18c94379b102949e6870e838a014ac883b7c9c03fca5abc6b56dd`.

Verify the retained-ZIP fixture and handoff without network access:

```bash
pnpm fixtures:release-evidence-review-acquisition:check
```

After acquisition, continue with [Policy review](policy-review.md) or import the
approved result through [Review archive](review-archive.md).
