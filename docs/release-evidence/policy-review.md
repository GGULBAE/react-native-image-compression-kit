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
  --version 0.2.62 \
  --reviewed-candidate-sha256 0af980676b08f73b62b2e785dd39320d9ce1c55bfac58df43ebf6b87eb102cdc \
  --reviewer GGULBAE \
  --reviewed-at 2026-07-17T06:49:02Z \
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
  --expect-version 0.2.62 \
  --expect-candidate-sha256 0af980676b08f73b62b2e785dd39320d9ce1c55bfac58df43ebf6b87eb102cdc \
  --expect-reviewer GGULBAE \
  --expect-repository GGULBAE/react-native-image-compression-kit \
  --expect-workflow GGULBAE/react-native-image-compression-kit/.github/workflows/release-evidence-policy-review.yml \
  --expect-ref refs/heads/master \
  --expect-head-sha dd63305e33a4a0e3f9c8eb40a0cfa3a3eb68c7d2 \
  --expect-run-id 29561132321 \
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
[29561132321](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29561132321)
passed on commit `dd63305e33a4a0e3f9c8eb40a0cfa3a3eb68c7d2` and produced
[attestation 35780183](https://github.com/GGULBAE/react-native-image-compression-kit/attestations/35780183).
The reviewed candidate SHA-256 is
`0af980676b08f73b62b2e785dd39320d9ce1c55bfac58df43ebf6b87eb102cdc`;
the receipt SHA-256 is
`4d05d0fec2ec9d43575336a1b0fd4d17059f87b4db8879afeefeacd4d5d6cd2f`;
the manifest SHA-256 is
`fd6f036f2f878031679c2c4dcf711c58f886883f8711bc1ad66be7970fdaef91`.
Promotion and set replay produced SHA-256
`f4dda2799cbb885ce5a8a00b5fccab33653c2b86f6217bfcd6e23880f8260521`
and `f2406db5c562aae6c3727ff8bf12d5fbd8da7a09f81ee974b9f9178256b2bdfa`
for the stable v0.2.50, v0.2.55, and v0.2.62 archive set.

See [Review archive](review-archive.md) for durable exact-ZIP retention and
expiration-independent replay.
