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
  --version 0.4.0 \
  --reviewed-candidate-sha256 7b97603d98f667c73a1e6120b721e161861a73626ade212a82c9df86caf98090 \
  --reviewer GGULBAE \
  --reviewed-at 2026-07-20T11:32:47Z \
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
  --expect-version 0.4.0 \
  --expect-candidate-sha256 7b97603d98f667c73a1e6120b721e161861a73626ade212a82c9df86caf98090 \
  --expect-reviewer GGULBAE \
  --expect-repository GGULBAE/react-native-image-compression-kit \
  --expect-workflow GGULBAE/react-native-image-compression-kit/.github/workflows/release-evidence-policy-review.yml \
  --expect-ref refs/heads/codex/v0.4.0-post-release-hardening \
  --expect-head-sha 7b0754a60a9497969fe75b4058dad0c4eb614159 \
  --expect-run-id 29738926758 \
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
[29738926758](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29738926758)
passed on commit `7b0754a60a9497969fe75b4058dad0c4eb614159` and produced
[attestation 36142406](https://github.com/GGULBAE/react-native-image-compression-kit/attestations/36142406).
The reviewed candidate SHA-256 is
`7b97603d98f667c73a1e6120b721e161861a73626ade212a82c9df86caf98090`;
the receipt SHA-256 is
`e99462b2be858e7028e282969889474487887f4a31a632f6c080afccc3ef176d`;
the manifest SHA-256 is
`6192736b4a4f42de397b22086495c74afd7f8451ecd9c5e572860130568e1bb2`.
Promotion and set replay produced SHA-256
`b202754abadd4677cb618532ad1dfca092f5d4341152d78a4a5b7ae23a264b8d`
and `1f1934a24e0fef593b09faf0b23962522674660ff18cf053d025375a931ac89b`
for the stable v0.2.50, v0.2.55, v0.2.62, v0.3.0, and v0.4.0 archive set.

See [Review archive](review-archive.md) for durable exact-ZIP retention and
expiration-independent replay.
