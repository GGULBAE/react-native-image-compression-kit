# Release Evidence Policy Review

Policy preparation and review are network-free. They operate on explicit
acquisition bytes and never edit committed policy or `evidence/npm`.

## Prepare a canonical candidate

```bash
pnpm prepare:release-evidence-policy -- \
  --acquisition-dir /path/to/acquisition \
  --candidate-file /tmp/policy-candidate.json \
  --json \
  --report-file /tmp/policy-diff.json
```

Preparation verifies acquisition and retained release evidence, derives one
canonical immutable version-policy candidate, and emits a stable committed
policy diff. It cannot apply the candidate.

## Reviewed promotion gate

```bash
pnpm promote:release-evidence-policy -- \
  --acquisition-dir /path/to/acquisition \
  --candidate-file /tmp/policy-candidate.json \
  --version 0.3.0 \
  --reviewed-candidate-sha256 eba4fb1e1b4cdcef03bc4d109fcb1b0d3a461cc56a389fbcdb89e182b7b033d9 \
  --reviewer GGULBAE \
  --reviewed-at 2026-07-18T12:27:50Z \
  --archive-root /tmp/rehearsal-evidence \
  --approve \
  --json
```

Promotion requires explicit approval and exact candidate digest/reviewer/time.
It requires the candidate policy to equal the committed immutable version
policy and writes only to an unused archive destination through staged
verification and atomic rename. There is no `--apply` policy option.

## Create and replay a review receipt

```bash
pnpm review:release-evidence-policy -- \
  --acquisition-dir /path/to/acquisition \
  --candidate-file /path/to/policy-candidate.json \
  --policy-report-file /path/to/policy-diff.json \
  --archive-root evidence/npm \
  --bundle-dir /tmp/review-bundle \
  --reviewed-candidate-sha256 <sha256> \
  <explicit-review-and-registry-identity> \
  --json

pnpm verify:release-evidence-review -- \
  --artifact-dir /tmp/review-bundle \
  --expect-package react-native-image-compression-kit \
  --expect-version 0.3.0 \
  --expect-candidate-sha256 eba4fb1e1b4cdcef03bc4d109fcb1b0d3a461cc56a389fbcdb89e182b7b033d9 \
  --expect-reviewer GGULBAE \
  --expect-repository GGULBAE/react-native-image-compression-kit \
  --expect-workflow GGULBAE/react-native-image-compression-kit/.github/workflows/release-evidence-policy-review.yml \
  --expect-ref refs/heads/master \
  --expect-head-sha 1c0a24601e2a59484dfa6a665a1cf09680d947d7 \
  --expect-run-id 29644362987 \
  --expect-run-attempt 1 \
  --json
```

The review bundle contains acquisition, candidate/diff, workflow execution and
dispatch event, exact workflow definition, promotion/set reports, receipt,
complete rehearsal archive set, and a recursive canonical manifest. The
builder replays the complete operation before exposing output.

## Review attestation

```bash
pnpm verify:release-evidence-review-attestation -- \
  --artifact-dir /path/to/review-bundle \
  --attestation-bundle /path/to/attestation.jsonl \
  --trusted-root /path/to/trusted-root.jsonl \
  <explicit-review-expectations> \
  --json
```

Manual Release Evidence Policy Review run
[29644362987](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29644362987)
passed on commit `1c0a24601e2a59484dfa6a665a1cf09680d947d7` and produced
[attestation 35960166](https://github.com/GGULBAE/react-native-image-compression-kit/attestations/35960166).
The reviewed candidate SHA-256 is
`eba4fb1e1b4cdcef03bc4d109fcb1b0d3a461cc56a389fbcdb89e182b7b033d9`;
the receipt SHA-256 is
`d56d0b10a50ad92cc20abcdc5287fe2b74e4a024e3d268ee7a183180e33861e1`;
the manifest SHA-256 is
`b43ea462d90d3c67f6af5ab9f14083839d72f5d5a7cc5a972a3c2b5895111dc5`.
Promotion and set replay produced SHA-256
`0109cb44b9cf62f8fa869dfadd0639ab7c8a6ca6c9907e1c7e30552ab07cfd78`
and `f001ee698c2abe0f3b4cb3b69466e79606d29d95f38dc0f97c308f537d17b812`
for the stable v0.2.50, v0.2.55, v0.2.62, and v0.3.0 archive set.

See [Review archive](review-archive.md) for durable exact-ZIP retention and
expiration-independent replay.
