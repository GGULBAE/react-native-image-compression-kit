# Release Evidence Acquisition

Acquisition is the only boundary here that contacts GitHub. It requires an
existing authenticated `gh` session, retains no token or signed download URL,
and never selects a latest run.

## Registry Validation artifacts

```bash
pnpm acquire:release-evidence -- \
  --repository GGULBAE/react-native-image-compression-kit \
  --workflow .github/workflows/registry-validation.yml \
  --source-ref refs/tags/v0.2.62 \
  --source-digest 43c157728ef345528053e2508e9aa9292457a55b \
  --run-id 29558617089 \
  --version 0.2.62 \
  --expected-tag latest \
  --output-dir /tmp/release-evidence-0.2.62 \
  --report-file /tmp/release-evidence-0.2.62-report.json \
  --json
```

The command validates the repository/workflow/ref/source/run/version/tag tuple,
requires a completed successful `workflow_dispatch`, selects exactly the two
version-qualified artifacts by immutable artifact ID, matches GitHub SHA-256,
size, creation, expiration, repository, and run metadata, then validates the
downloaded ZIP bytes. It never infers a run.

GitHub's current attestation response may expose a signed `bundle_url` instead
of an inline bundle. The network client resolves that transport through
`gh attestation download` using the exact manifest bytes, then retains the
existing byte-equality check against the downloaded attestation artifact. No
token or signed URL is retained.

Run `29558617089` selected provenance artifact `8398387031` with digest
`sha256:f76ff92c8e142a3bb2734dc60f7b332473201ee0d7350b41acf11e1c8e78bc99`
and attestation artifact `8398387418` with digest
`sha256:84608ed6f02ee9681dda8006e42f243af67e1e045231392a0e1dd9af8c8ec893`.
The canonical acquisition SHA-256 is
`ede6acc0c69c1d2e00cabffba73cd3b6a5133c7f88186c22cc86f1f2a1edd829`;
the importer handoff produced evidence SHA-256
`e5a23c12d99362d5ec3c882de3acfb161b6644e9777b16dc036e0d675cf511a6`.

The output is exposed only after the existing offline importer accepts the
staged canonical metadata and artifacts. Duplicate destinations and any
validation, write, handoff, or rename failure fail closed.

Import the accepted canonical bundle into the repository archive:

```bash
pnpm import:release-evidence -- \
  --version 0.2.62 \
  --provenance-artifact-dir /tmp/release-evidence-0.2.62/provenance \
  --attestation-artifact-dir /tmp/release-evidence-0.2.62/attestation \
  --metadata-file /tmp/release-evidence-0.2.62/release-evidence-metadata.json \
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
  --source-digest dd63305e33a4a0e3f9c8eb40a0cfa3a3eb68c7d2 \
  --run-id 29561132321 \
  --version 0.2.62 \
  --output-dir /tmp/review-acquisition-0.2.62 \
  --release-archive-root evidence/npm \
  --json \
  --report-file /tmp/review-acquisition-0.2.62.json
```

The selected review artifact is ID `8399292402`, 342,228 bytes, GitHub digest
`sha256:26c2880f1ed325cbd55956b02bc8558a692a2fecd47b2502be10ca89a7d57855`.
The attestation artifact is ID `8399292698`, 15,618 bytes, digest
`sha256:e6e3b25ea56fe52be16f86e8d5cb7bfc65c8c673f383d03f190682e1546501ae`.
They expire at `2026-10-15T06:49:03Z`.

As with registry acquisition, a bundle-less GitHub attestation response is
resolved with `gh attestation download` against the exact review manifest
bytes. The downloaded bundle must then equal the retained attestation ZIP
entry byte-for-byte; no token or signed URL is retained.

The canonical directory contains `review-evidence-metadata.json`, exact
`artifacts/review.zip` and `artifacts/attestation.zip`, and
`review-acquisition-manifest.json`. Authenticated acquisition at
`2026-07-17T06:53:06.508Z` produced metadata SHA-256
`67093793f6092b3f898c44c67bf6d2a71ee4c71874bd904890b8124bc596b08f`
and acquisition SHA-256
`6357a742bede4abf1e8274819c565ed774ac2c9d2f465b64f851c44981e19aac`.
Importer handoff reproduced archive SHA-256
`49ce812d70e53a62581b2ad5dda8e67a920d815506f885afb5267c68b2bd041d`.

Verify the retained-ZIP fixture and handoff without network access:

```bash
pnpm fixtures:release-evidence-review-acquisition:check
```

After acquisition, continue with [Policy review](policy-review.md) or import the
approved result through [Review archive](review-archive.md).
