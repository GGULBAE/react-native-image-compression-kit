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

The current lock covers 74 remote `uses:` declarations across 11 workflow
files. Lock SHA-256 is
`e2ce24d41d13feb828f75f7e6abef2a14dfdb8ca8ff9a16e8f211182234af40c`.

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

### 2026-07-23 grouped update review

Candidate commit `7551b905d113adb7f29e222688a3e2f500f337fe` replaced the
failing Dependabot proposal with a lock-aligned review of three grouped
updates. All runs used candidate lock SHA-256
`e2ce24d41d13feb828f75f7e6abef2a14dfdb8ca8ff9a16e8f211182234af40c`
and workflow definition SHA-256
`18eddbf323d63e7f297d7840d25c3d0219aa58d96fdd27f6b0e630bf43fb3452`.

- [Run 29982355928](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29982355928)
  reviewed lightweight `actions/checkout@v7` at
  `3d3c42e5aac5ba805825da76410c181273ba90b1`. Review artifact ID
  `8553670914` has transport digest
  `sha256:91ef486eba2264830a5b4679bcf9029d8515233114a3d4be11871d6277ab4095`;
  attestation artifact ID `8553671118` has transport digest
  `sha256:44371ededd203f090d482b9a2025000d11ebf0faf150777c37ecae19646796cb`.
  The attested manifest SHA-256 is
  `9cbf07421dc4abb6931cfd44adacc63a4c8244c51fa1c077aa2c8f4bda03fdbc`.
- [Run 29982364265](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29982364265)
  reviewed annotated `actions/attest@v4` at
  `f7c74d28b9d84cb8768d0b8ca14a4bac6ef463e6`, through tag object
  `36051bcae73b7c2a8a6945a48cbf80953c6baa35`. Review artifact ID
  `8553674268` has transport digest
  `sha256:70323296846c81c6cb3bff6b484e32dd65292fea9bfe845cdf2e1e54da480bbe`;
  attestation artifact ID `8553674460` has transport digest
  `sha256:00f579637d018fd0631d58052bde277cc78411bde7c93b5b6c1be3d41842df35`.
  The attested manifest SHA-256 is
  `93517833659709fc24ff349f470d1b9d3d3582b581c020b4999edd0f1ddc1059`.
- [Run 29982365319](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29982365319)
  reviewed lightweight `actions/setup-java@v5` at
  `03ad4de0992f5dab5e18fcb136590ce7c4a0ac95`. Review artifact ID
  `8553677889` has transport digest
  `sha256:4c67a63e2310cc0cb68664a6f3a57d748783cb5f10a95db9c32e763ffe9cb56a`;
  attestation artifact ID `8553678074` has transport digest
  `sha256:b020c96ffc1e6db8f948b326d65232705f3d0e74dbcea2b1cc22d4da113f29c4`.
  The attested manifest SHA-256 is
  `1c4c87063d6053dc000e7e12a5bc6d3b282adc8c81b618ae2cc7c1f1eaeea559`.

Both offline verifiers reproduced every downloaded run's stored provenance and
attestation report byte-for-byte.

### 2026-07-23 pnpm security refresh

[Run 29984647874](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29984647874)
rebound the committed fixture to source commit
`51d1068ce3759fc869f1963282fbfb383599908d` after the reviewed pnpm CLI moved
from 11.7.0 to 11.8.0. The lock and reviewed lightweight
`actions/checkout@v7` commit were unchanged. Review artifact ID `8554522936`
has transport digest
`sha256:b948756263716a25e09e6fbd651ddbaaa7b9eea013a742358a468a472a1a6501`;
attestation artifact ID `8554523133` has transport digest
`sha256:c1d9e716f66d7cce7cdc0f8b3fa2a893a523e4d38df2091f22f235328546ad95`.
The workflow definition SHA-256 is
`da029fda42252d2b4ab45b522d316f6a22ac59a6a298898f4abfb0e73b317528`,
and the attested manifest SHA-256 is
`381c721bdff291c22131a502b3ac34b725d1caca9e8c8b3fc2d6a739277cda51`.

The committed review and attestation fixtures now come from run
`29984647874`. Both offline verifiers reproduced the downloaded reports
byte-for-byte, and the pinned trusted-root SHA-256 remains
`65ca537f6ed8a47fd0e560c421baa1f6c1efb8b25fc200d8c5c02c0e92eb2b9c`.

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
