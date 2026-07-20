# Immutable GitHub Action Pins

## Policy

Every remote `uses:` declaration under `.github/workflows/` is pinned to a
lowercase full 40-character commit SHA with its reviewed release tag in a
comment. `.github/actions-lock.json` is the canonical repository/version/SHA and
usage-count lock. Weekly Dependabot `github-actions` updates are proposals only.
Minor and patch proposals are grouped with an open-version-PR limit of two;
major updates are intentionally deferred to dedicated reviews. Dependabot does
not replace the tag-to-commit review or authorize a lock change.

Run the network-free gate:

```bash
pnpm verify:workflow-supply-chain -- --json
```

The current lock covers 70 remote `uses:` declarations across ten workflow
files. Lock SHA-256 is
`43122405b320062850f7ada247c0ee0d9e2f59814dc8a846445d1984e43eab68`.

## Manual networked review

Use the **Action Pin Review** workflow or the CLI only for a proposed SHA update.
The resolver proves that the reviewed lightweight or annotated tag reaches the
exact candidate commit and compares a trusted baseline lock to the candidate.
It does not update pins or merge changes.

```bash
pnpm review:action-pin -- \
  --repository GGULBAE/react-native-image-compression-kit \
  --baseline-ref <trusted-ref> \
  --candidate-ref <candidate-ref> \
  --output-dir /tmp/action-pin-review \
  --json
```

The review rejects unregistered Actions, repository substitution, major-version
downgrade, candidate lock disagreement, malformed Git objects, and final commit
mismatch.

## Offline provenance replay

```bash
pnpm verify:action-pin-provenance -- \
  --artifact-dir /path/to/action-pin-review \
  --json

pnpm verify:action-pin-fixture
```

The artifact binds source repository/ref/head SHA, workflow path/ref/SHA, run
ID/attempt, normalized dispatch event, exact reviewed workflow, baseline and
candidate locks, tag-reference/annotated-tag evidence, provenance report, and a
canonical recursive artifact manifest.

Successful Action Pin Review run
[29320049736](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29320049736)
on commit `594ae37169f324cd1e886942385b0b488e07b82d` reviewed annotated
`actions/checkout@v7.0.0`, resolved commit
`9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0`, and produced aggregate evidence
SHA-256 `5591fd319f1cc35b30286bf317ce7f524405364c04d3374ed357c40cc1ad529b`.

## Offline signer verification

```bash
pnpm verify:action-pin-attestation -- \
  --artifact-dir /path/to/action-pin-review \
  --attestation-bundle /path/to/action-pin-attestation/attestation.jsonl \
  --trusted-root /path/to/action-pin-attestation/trusted-root.jsonl \
  --json

pnpm verify:action-pin-attestation-fixture
```

The verifier first reproduces provenance, then binds the exact manifest subject
to GitHub OIDC/SLSA repository, workflow, ref, source commit, invocation, hosted
runner, and transparency identity using only downloaded bytes and the pinned
trusted root. It rejects subject or signer drift and never downloads an
attestation or refreshes trust roots.

Action review artifacts, attestations, fixtures, scripts, workflows, and locks
are repository-only and must not enter the npm package.
