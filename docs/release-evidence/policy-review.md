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
  --version 0.2.55 \
  --reviewed-candidate-sha256 <sha256> \
  --reviewer <identity> \
  --reviewed-at <UTC-ISO> \
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
  --expect-version 0.2.55 \
  --expect-candidate-sha256 <sha256> \
  --expect-reviewer GGULBAE \
  --expect-repository GGULBAE/react-native-image-compression-kit \
  --expect-workflow GGULBAE/react-native-image-compression-kit/.github/workflows/release-evidence-policy-review.yml \
  --expect-ref refs/heads/master \
  --expect-head-sha 2782a6e34c70660a6c44a6189c39304317072a22 \
  --expect-run-id 29390495773 \
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
[29390495773](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29390495773)
passed on commit `2782a6e34c70660a6c44a6189c39304317072a22` and produced
[attestation 35388408](https://github.com/GGULBAE/react-native-image-compression-kit/attestations/35388408).
The reviewed candidate SHA-256 is
`aade4a8057bbb8f6b3dc92690b3d9cc5e3b57352a5734396e3921a143a449f8d`;
the receipt SHA-256 is
`45ddefa85cba6a9fed62cb1c187dd0bab2246b72ba66a803b1282e4eac07efad`;
the manifest SHA-256 is
`48cfd454b636cf1911b7d19dae996e7ead2797247d2b974687bb02aeebb439ff`.

See [Review archive](review-archive.md) for durable exact-ZIP retention and
expiration-independent replay.
