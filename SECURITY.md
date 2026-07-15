# Security Policy

## Supported Versions

Security fixes are provided for the latest published minor release line.

| Version | Supported |
| --- | --- |
| 0.2.x | Yes |
| 0.1.x | No |
| < 0.1.0 | No |

## Reporting a Vulnerability

Please do not include exploit details, secrets, private keys, or sensitive
sample images in public issues. If GitHub private vulnerability reporting is
available for this repository, use it first. Otherwise, open a minimal public
issue asking for private coordination and include only the affected version and
high-level impact.

The maintainer should acknowledge security reports within 7 days and coordinate
a fix, release, or disclosure timeline based on severity and reproducibility.

## Package Security Hygiene

The npm package is intended to avoid install-time code execution. Published
packages should not define `preinstall`, `install`, `postinstall`, `prepare`,
or other lifecycle scripts that execute during consumer installation.

Published tarballs should include only runtime native source, TypeScript
sources, built JavaScript and declaration files, package metadata, README,
license, podspec, and React Native config. Development-only scripts, tests,
fixtures, example apps, build directories, credentials, `.npmrc`, `.env*`, keys,
and debug keystores must stay out of the tarball.

## GitHub Actions Supply Chain

Every remote Action under `.github/workflows/` must use a lowercase full
40-character commit SHA rather than a mutable tag, branch, or short SHA. Keep the
reviewed release tag as an inline comment, and keep `.github/actions-lock.json`
aligned with the exact workflows, Action repositories, versions, SHAs, and usage
counts.

Run the network-free gate before accepting workflow dependency changes:

```bash
pnpm verify:workflow-supply-chain -- --json
```

The verifier reads only committed files and must not call GitHub, resolve tags,
or update pins. Weekly Dependabot `github-actions` updates are review inputs, not
authority to bypass the lock: the full SHA, release-tag comment, every affected
workflow occurrence, and the canonical lock must change together. The lock,
Dependabot configuration, workflow verification scripts, and tests remain
repository-only and outside the npm package.

Before accepting a proposed Action SHA change, run the manual **Action Pin
Review** workflow against the candidate ref and a trusted baseline ref. Its
networked resolver must prove that the reviewed Git tag reaches the exact
candidate commit, including one explicit dereference for an annotated tag. The
review rejects unregistered Actions, repository substitution, major-version
downgrade, candidate lock disagreement, malformed Git objects, and final commit
mismatch. It does not update pins or merge a Dependabot PR.

Download the resulting artifact and replay it without credentials or network
access:

```bash
pnpm verify:action-pin-provenance -- \
  --artifact-dir /path/to/action-pin-review \
  --json
```

Download the separate Action Pin attestation artifact from the same successful
manual run and verify the GitHub signer identity with network access blocked:

```bash
pnpm verify:action-pin-attestation -- \
  --artifact-dir /path/to/action-pin-review \
  --attestation-bundle /path/to/action-pin-attestation/attestation.jsonl \
  --trusted-root /path/to/action-pin-attestation/trusted-root.jsonl \
  --json
```

The artifact must retain canonical baseline/candidate locks, canonical
`github-execution.json`, normalized `workflow_dispatch` event evidence, the exact reviewed workflow definition,
tag-reference evidence, optional annotated-tag evidence, a canonical
`artifact-manifest.json`, and the digest-bound provenance report. The report
must bind source repository/ref/head SHA, workflow name/path/ref/SHA, run ID and
attempt, candidate lock SHA-256, workflow-definition SHA-256, and manifest
SHA-256. The manifest must list every evidence path, byte size, and SHA-256 and
must reject traversal, links, duplicate/missing/additional files, size drift,
and digest drift before report replay. The offline core and verifier must contain
no GitHub request or command execution path. Action review artifacts, fixtures,
resolver scripts, and reports remain repository/CI evidence and must not enter the npm package.
The attestation verifier must first reproduce this provenance report, then bind
the exact `artifact-manifest.json` SHA-256 and cross-check its source
repository/ref/head SHA and workflow path/SHA against the GitHub OIDC signer
certificate and SLSA statement. It must use only the downloaded bundle and
pinned trusted root, reject self-hosted runner evidence and wrong
subject/repository/workflow/ref/source SHA, and perform no attestation download
or trusted-root refresh. The provenance artifact and the separate three-file
attestation artifact are repository/CI security evidence and must not enter the
npm package.

## Release Evidence Retention

Repository-owned release evidence under `evidence/npm/<version>/` is a security
verification asset, not package runtime content. It may retain an exact registry
tarball, provenance report, canonical manifest, attestation bundle, trusted root,
and verification report, but the whole `evidence/` tree must remain excluded from
the npm package file list.

Acquire Registry Validation evidence only from an explicitly reviewed run. Never
infer or select the latest run; require repository, workflow, source ref, source
commit, run ID, package version, and expected tag:

```bash
pnpm acquire:release-evidence -- \
  --repository <owner/repo> \
  --workflow .github/workflows/registry-validation.yml \
  --source-ref refs/heads/<branch> \
  --source-digest <40-character-commit-sha> \
  --run-id <registry-validation-run-id> \
  --version <version> \
  --expected-tag <tag> \
  --output-dir /path/to/acquisition \
  --json
```

The acquisition CLI may access GitHub through the existing authenticated `gh`
session, but it must not persist tokens, login state, signed attestation URLs, or
authentication files. It must validate a completed successful workflow-dispatch
run against repository/workflow/ref/head SHA, select exactly the two versioned
artifacts, download each ZIP by artifact ID, and match ZIP byte size/SHA-256 plus
creation and expiration metadata to committed policy. Expired artifacts, unsafe
or duplicate archive paths, missing/additional files, and extracted byte drift
must fail closed.

The manifest subject must select exactly one attestation whose repository ID and
Sigstore bundle equal the downloaded evidence. Only normalized attestation ID and
verified Rekor time may enter canonical metadata; temporary signed download URLs
must not be retained. Network and child-process execution must remain isolated
from the acquisition validation core.

The acquisition destination must be created only after the staged canonical
manifest/metadata and exact artifact directories pass the existing offline
importer. Existing destinations must not be replaced. Validation, write, handoff,
or rename failure must remove staged acquisition and archive data. Verify the
committed exact-ZIP fixtures without network access:

```bash
pnpm fixtures:release-evidence-acquisition:check
```

Acquire Release Evidence Policy Review artifacts through the separate explicit
review acquisition boundary. Never infer a latest review run; require the exact
repository, workflow, source ref, source commit, review run ID, and evidence
version:

```bash
pnpm acquire:release-evidence-review -- \
  --repository <owner/repo> \
  --workflow .github/workflows/release-evidence-policy-review.yml \
  --source-ref refs/heads/<branch> \
  --source-digest <40-character-review-commit-sha> \
  --run-id <review-workflow-run-id> \
  --version <reviewed-evidence-version> \
  --output-dir /path/to/review-acquisition \
  --release-archive-root evidence/npm \
  --json \
  --report-file /path/to/review-acquisition-report.json
```

At acquisition time both artifacts must be unexpired and must match the
committed review policy's artifact IDs, version/run-qualified names, exact byte
sizes, GitHub SHA-256 digests, creation/expiration times, workflow run, source
SHA, and repository IDs. The completed successful `workflow_dispatch` run must
also match repository, workflow, ref, source SHA, attempt, actor, and triggering
actor. After the exact ZIP bytes are retained, expiration-independent replay may
use them without consulting the current clock.

The network adapter may use the existing authenticated `gh` session, but the
validation core must have no command or network path. Do not retain credentials,
tokens, `.npmrc`, login state, or signed artifact/attestation download URLs.
Canonical metadata may retain only normalized public GitHub identity, artifact
records, attestation ID, and verified transparency time.

The acquisition must stage canonical metadata, exact `review.zip` and
`attestation.zip`, and the canonical manifest, then invoke the existing review
archive importer against that staging directory. Do not expose output until the
importer fully replays review, attestation, and byte-identical target archive
evidence. A write, handoff, output rename, or report rename failure must remove
all newly created output and preserve any report that could not be atomically
replaced. Existing acquisition destinations must never be replaced.

Default verification must remain offline and use only the exact retained ZIPs
plus pinned synthetic GitHub response envelopes:

```bash
pnpm fixtures:release-evidence-review-acquisition:check
```

Treat an acquisition bundle as observed evidence, not permission to change the
committed policy or archive set. Prepare a canonical policy candidate and stable
diff first:

```bash
pnpm prepare:release-evidence-policy -- \
  --acquisition-dir /path/to/acquisition \
  --candidate-file /path/to/policy-candidate.json \
  --json \
  --report-file /path/to/candidate-report.json
```

Preparation must revalidate the exact acquisition layout, canonical
manifest/metadata, every recorded file digest, aggregate acquisition digest,
manifest/metadata identity, and the complete offline provenance/attestation
replay. It may write only the explicit candidate/report outputs. `match`,
`missing`, and `drift` are review results; none may edit policy source or evidence
archives. Policy source changes require a normal reviewed Git commit.

Promotion requires a separate explicit approval bound to the exact candidate
bytes:

```bash
pnpm promote:release-evidence-policy -- \
  --acquisition-dir /path/to/acquisition \
  --candidate-file /path/to/policy-candidate.json \
  --version <version> \
  --reviewed-candidate-sha256 <candidate-sha256> \
  --reviewer <reviewer-identity> \
  --reviewed-at <UTC-ISO-timestamp> \
  --archive-root /path/to/evidence/npm \
  --approve \
  --json
```

The promotion gate must regenerate and byte-compare the candidate, require the
reviewed digest, a whitespace/control-free reviewer identity, a canonical review
time not earlier than Registry Validation completion, and explicit approval;
require exact agreement with committed
policy, and reject duplicate versions. The importer and entire committed archive
set must pass against a hidden staged version before one final rename. Missing
approval, policy drift, import/set failure, or rename failure must leave the
archive set unchanged. Neither preparation nor promotion provides `--apply` or
uses npm, GitHub, Sigstore, or another network service.

For a durable human-review decision, use the manual `Release Evidence Policy
Review` workflow with the exact candidate digest. The workflow must require the
Registry Validation repository/workflow/ref/source SHA/run ID/version/tag and
must never select a latest run. Treat `github.actor` from the normalized
`workflow_dispatch` event as the reviewer only when it agrees with the canonical
execution record, workflow repository/path/ref/SHA, review source commit, run
ID/attempt, and GitHub run start time.

The workflow may acquire immutable artifacts and create a GitHub attestation,
but reviewed promotion must execute only below a temporary archive-set copy.
It must omit the target from copied baselines, invoke the existing digest-bound
promotion gate to reconstruct that target, verify every committed policy
version together, repeat the promotion offline, and byte-compare the result.
It must never edit policy source, `evidence/npm`, npm state, a Git ref, or a
GitHub Release.

The atomic review artifact must contain the exact acquisition bundle, candidate,
stable diff, GitHub execution identity, normalized event, exact workflow bytes,
promotion report, complete set report, review receipt, and full rehearsed
archive set. Its `artifact-manifest.json` must recursively bind every regular
file by path, size, and SHA-256. Symlinks, unsafe paths, missing/additional
files, identity drift, candidate/acquisition mismatch, policy drift, duplicate
target, replay failure, or final rename failure must leave no success bundle or
receipt.

Verify a downloaded review artifact and attestation without network access:

```bash
pnpm verify:release-evidence-review -- \
  --artifact-dir /path/to/review-artifact \
  --expect-package react-native-image-compression-kit \
  --expect-version <version> \
  --expect-candidate-sha256 <sha256> \
  --expect-reviewer <github-actor> \
  --expect-repository <owner/repo> \
  --expect-workflow <owner/repo/.github/workflows/release-evidence-policy-review.yml> \
  --expect-ref <refs/heads/name> \
  --expect-head-sha <review-workflow-commit> \
  --expect-run-id <run-id> \
  --expect-run-attempt <attempt> \
  --json

pnpm verify:release-evidence-review-attestation -- \
  --artifact-dir /path/to/review-artifact \
  --attestation-bundle /path/to/attestation.jsonl \
  --trusted-root /path/to/trusted-root.jsonl \
  <the-same-explicit-review-expectations> \
  --json
```

Only the recursive manifest is attested. Offline verification must require the
exact subject digest, repository, signer workflow, source ref/digest, workflow
digest, run invocation, GitHub-hosted runner policy, SLSA predicate, and pinned
trusted root. Review artifacts, receipts, summaries, and attestations must not
contain credentials, npm tokens, OTPs, `.npmrc`, GitHub tokens, signed download
URLs, or automatic login state.

Preserve an approved review after GitHub artifact expiration by importing the
exact artifact ZIPs into a repository-owned review archive. The importer is
network-free and requires canonical metadata, both exact ZIPs, and an explicit
unused destination:

```bash
pnpm import:release-evidence-review -- \
  --version <version> \
  --metadata-file /path/to/review-metadata.json \
  --review-artifact-zip /path/to/review-artifact.zip \
  --attestation-artifact-zip /path/to/review-attestation.zip \
  --archive-dir evidence/reviews/<version> \
  --release-archive-root evidence/npm \
  --json
```

The metadata must bind the explicit run, source commit, artifact IDs/names,
byte sizes, SHA-256 digests, creation/expiration times, and attestation identity.
The importer validates those recorded expiration times but intentionally does
not reject an already retained archive based on the current clock. Its ZIP
parser must reject traversal, absolute or ambiguous paths, duplicate entries,
symlinks, directories, encryption, unsupported compression, and any
missing/additional entry before extraction.

The archive retains the exact review and attestation ZIP bytes, all extracted
files, and one canonical `review-evidence-index.json`. Its index binds the
review receipt, recursive manifest, target evidence, every retained path/size/
SHA-256, and an aggregate archive SHA-256. Existing destinations are never
replaced. Staging, validation, archive rename, index write, or report rename
failure must remove incomplete outputs and must not leave a success archive or
report.

Replay the retained v0.2.55 review and every supported retained review without
npm, GitHub, Sigstore, or other network access:

```bash
pnpm verify:release-evidence-review-archive -- --version 0.2.55 --json
pnpm verify:release-evidence-review-archive-set -- --json
```

The single-archive verifier must reproduce receipt, manifest, promotion, set,
and signer identity checks, prove exact ZIP/extracted-byte agreement, and
byte-compare the rehearsed v0.2.55 target archive with `evidence/npm/0.2.55/`.
The multi-review set verifier is part of default `pnpm verify`; retained review
ZIPs, extracted files, scripts, tests, and reports remain excluded from the npm
package. They must never contain credentials, npm tokens, OTPs, `.npmrc`,
GitHub tokens, signed download URLs, or authentication files.

To create a new archive from downloaded workflow artifacts, provide the exact
four-file Registry provenance directory, the exact three-file attestation
directory, and an explicit canonical GitHub metadata document:

```bash
pnpm import:release-evidence -- \
  --version <version> \
  --provenance-artifact-dir /path/to/registry-provenance \
  --attestation-artifact-dir /path/to/registry-provenance-attestation \
  --metadata-file /path/to/github-metadata.json \
  --archive-dir evidence/npm/<version> \
  --json
```

The metadata must exactly match the committed immutable version policy. The
importer rejects links, non-regular files, missing/additional files, mismatched
artifact identity, tampered bytes, and existing destinations. It builds and
fully verifies a sibling temporary archive before one atomic rename; any
validation, write, or rename failure removes the temporary archive and leaves
the destination absent or unchanged.

Run every retained trust-chain replay without npm, GitHub, Sigstore, or other
network access:

```bash
pnpm verify:release-evidence-set -- --json
```

The default ordered set contains v0.2.50 and v0.2.55 and continues through the
complete set so every failing version is reported. To replay only the current
retained v0.2.55 evidence, run:

```bash
pnpm verify:release-evidence -- --version 0.2.55
```

The canonical release evidence index and version policy must pin the source run,
artifact and attestation IDs, GitHub artifact archive digests, source commit,
artifact expiration, and every retained file digest. Evidence updates must never
include credentials, npm tokens, OTPs, `.npmrc`, GitHub tokens, or authentication
files.

Before publishing, run:

```bash
pnpm release:dry-run
pnpm audit --prod
```

After publishing, inspect the registry tarball and verify:

```bash
npm pack react-native-image-compression-kit@<version>
pnpm view react-native-image-compression-kit version dist.integrity
```

## Dependency Triage

When GitHub Dependabot or another scanner reports an alert, classify the
dependency as npm runtime, native runtime, example app, validation toolchain, or
development-only before deciding whether it affects package consumers.

The `example/Gemfile` Ruby dependencies are used for local and GitHub Actions
iOS host-app validation only. They are excluded from the published npm tarball,
but should still be kept on patched ranges because they run in CI. The iOS
validation toolchain requires Ruby 3.1 or newer and pins ActiveSupport and
Concurrent Ruby to patched minimum versions.

### v0.2.0 Post-Release Alert Classification

The June 30, 2026 post-release triage found no npm runtime advisories from
`pnpm audit --json`. GitHub Dependabot reported six Ruby alerts in
`example/Gemfile`; all are classified as fixed validation-toolchain alerts, not
published package runtime alerts:

- Alerts #2, #3, and #4: ActiveSupport advisories fixed by requiring
  `activesupport >= 7.2.3.1`.
- Alerts #5, #6, and #7: Concurrent Ruby advisories fixed by requiring
  `concurrent-ruby >= 1.3.7`.
