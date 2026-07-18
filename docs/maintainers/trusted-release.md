# Trusted release runbook

The release workflow publishes one reviewed tarball through npm Trusted
Publishing OIDC and then verifies the registry artifact before finalizing an
immutable GitHub Release. No npm token is accepted by this path.

## One-time trust setup

In npm package settings, create a GitHub Actions trusted publisher with this
exact tuple:

- organization/user: `GGULBAE`
- repository: `react-native-image-compression-kit`
- workflow: `.github/workflows/release.yml`
- environment: `npm-production`

Require two-factor authentication on maintainer accounts. In GitHub, create the
protected `npm-production` environment and its manual reviewer before testing
the workflow. Never store `NODE_AUTH_TOKEN`, an npm automation token, or account
recovery codes in repository secrets.

## Release

1. Merge a reviewed release-state commit on protected `master`. It must align
   `package.json`, README, RELEASE, changelog, status manifest, site, and
   compatibility matrix for the exact version.
2. Record the full lowercase 40-character source SHA. Confirm the worktree and
   CI are clean and `npm view react-native-image-compression-kit@<version>` is
   absent.
3. Dispatch `.github/workflows/release.yml` with the exact version, source SHA,
   and `confirm_publish=true`.
4. Review the compatibility and exact-artifact preflight results. Approve the
   `npm-production` deployment only if its version, SHA, tarball SHA-256/SRI,
   inventory, release state, and registry action are correct.
5. After completion, verify npm `latest`, provenance, registry consumer smoke,
   the immutable GitHub Release assets, and the `v<version>` tag source SHA.
6. Run the existing registry-validation, acquisition, import, policy-review,
   and archive procedure from [release evidence](../release-evidence/README.md).

## Resume semantics

The workflow has only three publication decisions:

- `publish`: the exact version is absent, so the verified tarball may publish.
- `resume`: the version exists and its registry integrity exactly matches the
  preflight tarball; skip npm publish and finish provenance/release verification.
- `blocked`: the version or integrity differs, source/status is wrong, or a gate
  failed. Stop and investigate. Never overwrite or recreate the version.

A failed run after npm accepted the tarball is resumed with the same version and
source SHA. A new commit creates a different artifact and cannot resume that
publication.

## Failure and rollback

- Before npm publish: fix through a new reviewed commit; discard an incomplete
  draft release only if it contains no public evidence that must be retained.
- After npm publish: npm and immutable release artifacts are append-only. If the
  release is unsafe, use `npm deprecate` with an actionable message, publish a
  forward hotfix from protected source, and use a Security Advisory when needed.
- Never move a version tag, replace a tarball, delete provenance, rewrite release
  evidence, or reuse a semantic version.
- If OIDC trust fails, verify the exact npm tuple, environment, default branch,
  workflow filename, and id-token permission. Do not fall back to a token.

The post-publish handoff artifact is temporary transport evidence. The canonical
long-term record remains the npm registry, immutable GitHub Release, protected
tag, and imported release-evidence set.
