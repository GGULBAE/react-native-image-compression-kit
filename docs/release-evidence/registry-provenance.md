# Registry Provenance and Release Evidence

## Published baseline

npm `version` and `dist-tags.latest` are `0.4.0`, published at
`2026-07-20T09:55:07.344Z`. The validated 83-file registry tarball was 68,633
bytes with integrity
`sha512-6YayITmHw81daUVeUcJP/6lqPsyo3zliFwhYUmhWn7suOwtnw2PLJjp9oRWsFOoK6Nw1m7bfrMzOj5JMYJaE8A==`
and shasum `05ed1b19b180c9589e1bf34358cf63a0de4472bd`.

The promotion used one successful `npm publish --tag latest`; no separate
dist-tag mutation was required. Immutable tag `v0.4.0` and the GitHub Release
both resolve to source commit
`6841a887b2d8b6c9e4823d2708233feeecaa77ea`.

## Networked registry smoke

Run only after the exact version is published:

```bash
pnpm smoke:registry -- \
  --version 0.4.0 \
  --expect-tag latest \
  --json \
  --artifact-dir registry-validation
```

The command validates registry metadata, downloads the real tarball, checks
integrity/shasum and package contents, installs it into a clean temporary React
Native consumer, and atomically writes exactly:

- `registry-provenance.json`
- byte-identical `stdout.json`
- `package.tgz`
- `bundle-manifest.json`

## Automatic Registry Health

The [Registry Health workflow](../../.github/workflows/registry-health.yml)
runs every Monday at 03:17 UTC, on explicit dispatch, and for pull requests
that change its workflow, local pnpm setup, verifier, smoke, release-status, or
evidence contracts. It reads the version from `docs/release-status.json`, uses
npm 12.0.1 for the same registry transport as Trusted Release, runs the
networked smoke, and passes the live four-file bundle to
`pnpm verify:registry-health`.

The canonical health report compares live and committed package name,
requested/resolved version, `latest`, publish timestamp, tarball URL, SRI,
shasum, tarball SHA-256, packed byte size, file count, unpacked size, README
status, forbidden package files, and consumer install/typecheck. It also
cross-checks `release-evidence-index.json`, `registry-provenance.json`,
`bundle-manifest.json`, and `package.tgz` so matching live metadata and live
bytes still fail when the committed release evidence differs.

This automatic workflow has top-level `contents: read` only. It does not use
`npm-production`, request OIDC, publish or mutate npm, change Git state or a
GitHub Release, create provenance/attestations, open issues, or send messages.
It uploads only the canonical health report and fails closed on empty,
multiple, incomplete, noncanonical, or drifted results.

Dispatch it manually with no version input:

```bash
gh workflow run registry-health.yml --ref master
```

For a local replay, let the status manifest choose the version:

```bash
health_version="$(node -p "require('./docs/release-status.json').publishedNpmLatest")"
health_dir="$(mktemp -d)"
pnpm smoke:registry -- \
  --version "$health_version" \
  --expect-tag latest \
  --json \
  --artifact-dir "$health_dir/live"
pnpm verify:registry-health -- \
  --live-artifact-dir "$health_dir/live" \
  --json \
  --report-file "$health_dir/registry-health.json"
```

Investigate a failure in this order:

1. Read `registry-health.json`, including `checks`, `drift`, and `error`.
2. Confirm `publishedNpmLatest` and `evidence/npm/<version>` form the intended
   release handoff and that all four required evidence files exist.
3. Inspect exact-version npm metadata and `latest`; rerun the npm 12.0.1 smoke
   to separate a transport failure from persistent drift.
4. Compare the live tarball hashes/inventory with the committed index, report,
   manifest, and tarball before escalating a registry or repository incident.

A failed monitor never authorizes npm republish/unpublish, dist-tag changes,
tag movement, GitHub Release edits, or evidence rewriting. Preserve the
observed bytes and fix forward only through the separately reviewed release
process.

## npm-production health deployment

The manual-only [Registry Validation workflow](../../.github/workflows/registry-validation.yml)
reports the verified registry state through the protected `npm-production`
GitHub environment. Dispatch it with the exact published version and dist-tag:

```bash
gh workflow run registry-validation.yml \
  --ref master \
  -f version=0.4.0 \
  -f expected_tag=latest
```

Approve the environment only after confirming those inputs. A successful run
adds a green deployment linked to the exact npm version. This health workflow
does not publish, change a dist-tag, mutate a Git tag, or create a GitHub
Release; it validates the existing registry bytes, consumer install, and
provenance, then creates attestations and temporary evidence artifacts. The
Trusted Release workflow remains the only npm publisher. Unlike automatic
Registry Health, this manual path uses protected `npm-production`, OIDC
attestation permissions, and maintainer approval specifically to create new
verification evidence; it remains `workflow_dispatch`-only.

## Offline provenance verification

```bash
pnpm verify:registry-provenance -- \
  --artifact-dir /path/to/registry-validation \
  --expect-package react-native-image-compression-kit \
  --expect-version 0.4.0 \
  --expect-tag latest \
  --json
```

The verifier parses the archive in memory, rejects traversal, links, duplicate
or unsupported entries, validates canonical JSON and every declared digest and
size, and performs no npm, GitHub, or other network request.

Successful Registry Validation run
[29737871213](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29737871213)
on `refs/heads/master` and commit
`6841a887b2d8b6c9e4823d2708233feeecaa77ea` attested manifest SHA-256
`32ee0e70deee24801662027943457f7130a023f5ac7b84c766d48c07d258776c`
as [attestation 36140293](https://github.com/GGULBAE/react-native-image-compression-kit/attestations/36140293).
The provenance artifact digest is
`sha256:1a931104adbad66300fb6e5b43e8e344acbb3f5b8aee73dd07aef9ff319244cb`;
the attestation artifact digest is
`sha256:4158a78f03e2fcd222ad6698d1d9379b890e3e4e301dbcb82104f0ee195e705e`.

## Offline attestation verification

```bash
pnpm verify:registry-attestation -- \
  --manifest /path/to/registry-validation/bundle-manifest.json \
  --attestation-bundle /path/to/registry-attestation/attestation.jsonl \
  --trusted-root /path/to/registry-attestation/trusted-root.jsonl \
  --expect-repository GGULBAE/react-native-image-compression-kit \
  --expect-workflow GGULBAE/react-native-image-compression-kit/.github/workflows/registry-validation.yml \
  --expect-ref refs/heads/master \
  --expect-head-sha 6841a887b2d8b6c9e4823d2708233feeecaa77ea \
  --json
```

The pinned trusted-root SHA-256 is
`65ca537f6ed8a47fd0e560c421baa1f6c1efb8b25fc200d8c5c02c0e92eb2b9c`.
Blocked-network replay reproduced the canonical report at SHA-256
`23d9b192d7fd70307a4ac33cdade99f0d7952b4e51be6bf164f2de8946b46647`
under UTC and Asia/Seoul.

## Repository-owned archive

The v0.2.50, v0.2.55, v0.2.62, v0.3.0, and v0.4.0 archives live under
`evidence/npm/<version>/`. Replay one version or the complete supported set:

```bash
pnpm verify:release-evidence -- --version 0.4.0
pnpm verify:release-evidence-set -- --json
```

The v0.4.0 index pins Registry Validation run `29737871213`, source commit
`6841a887b2d8b6c9e4823d2708233feeecaa77ea`, attestation `36140293`, every
retained file, and aggregate evidence SHA-256
`d6ab0b806fd1c5d5605faeafe2d9809b4a665193219694a416c154f833bc2558`.
With no selectors the set verifier checks v0.2.50, v0.2.55, v0.2.62, v0.3.0,
and v0.4.0 in stable order.

See [Acquisition](acquisition.md) for authenticated artifact download and
canonical importer handoff.
