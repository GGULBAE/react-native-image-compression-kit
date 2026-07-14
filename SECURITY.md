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

For the current retained v0.2.55 evidence, run the complete trust-chain replay
without npm, GitHub, Sigstore, or other network access:

```bash
pnpm verify:release-evidence -- --version 0.2.55
```

The historical v0.2.50 archive remains replayable by passing `--version 0.2.50`.
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
