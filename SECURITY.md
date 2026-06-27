# Security Policy

## Supported Versions

Security fixes are provided for the latest published minor release line.

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
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
