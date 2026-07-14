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

## Release Evidence Retention

Repository-owned release evidence under `evidence/npm/<version>/` is a security
verification asset, not package runtime content. It may retain an exact registry
tarball, provenance report, canonical manifest, attestation bundle, trusted root,
and verification report, but the whole `evidence/` tree must remain excluded from
the npm package file list.

For retained v0.2.50 evidence, run the complete trust-chain replay without npm,
GitHub, Sigstore, or other network access:

```bash
pnpm verify:release-evidence -- --version 0.2.50
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
