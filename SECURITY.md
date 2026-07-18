# Security Policy

## Supported versions

Security fixes are provided for the latest published minor release line.

| Version | Supported |
| --- | --- |
| 0.3.x | Candidate; not yet published |
| 0.2.x | Yes |
| 0.1.x | No |
| < 0.1.0 | No |

## Reporting a vulnerability

Do not include exploit details, secrets, private keys, credentials, or sensitive
sample images in public issues. Submit reports through
[GitHub private vulnerability reporting](https://github.com/GGULBAE/react-native-image-compression-kit/security/advisories/new).
If that route is unavailable, open a minimal
[support request](https://github.com/GGULBAE/react-native-image-compression-kit/issues/new/choose)
that contains only the affected version and a request for private coordination.

The maintainer should acknowledge reports within seven days and coordinate a
fix, release, or disclosure timeline based on severity and reproducibility.

## Package prohibitions

Published npm packages must not:

- define install-time `preinstall`, `install`, `postinstall`, `prepare`, or
  equivalent lifecycle execution;
- contain `docs/`, `evidence/`, `scripts/`, `test/`, fixtures, example apps,
  build output, debug keystores, or repository workflow data;
- contain credentials, npm/GitHub tokens, OTPs, `.npmrc`, `.env*`, private keys,
  signed download URLs, login state, or authentication files;
- silently preserve location, owner, serial, maker-note, user-comment, XMP, or
  other privacy-sensitive metadata under the default `safe` policy;
- claim HEIC, HEIF, or AVIF output, animation preservation, cancellation, or
  other capabilities that the native runtime does not report.

## Repository security rules

- Every remote GitHub Action must use a lowercase full 40-character commit SHA
  and stay aligned with `.github/actions-lock.json`.
- Dependabot Action updates are review inputs, not authority to bypass the
  immutable pin and provenance review.
- Release and review evidence must be selected by explicit repository,
  workflow, ref, source commit, run ID, version, and artifact identity. Never
  infer or select the latest run.
- Network access and credential use must remain outside offline validation
  cores and default verification.
- Evidence and review archives are immutable once exposed. Validation or write
  failure must not replace a prior destination or expose partial output.
- Policy source changes require normal reviewed Git changes; review evidence
  must not mutate committed policy or release archives.

## Operational procedures

Detailed execution steps are repository-only:

- [Release evidence overview](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/README.md)
- [Registry provenance and retained evidence](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/registry-provenance.md)
- [Explicit evidence acquisition](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/acquisition.md)
- [Policy preparation, review, and promotion](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/policy-review.md)
- [Review archive import and replay](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/review-archive.md)
- [Immutable GitHub Action pins](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/supply-chain/action-pins.md)

The historical policy and dependency-triage text remains available in the
[v0.2.61 security snapshot](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/legacy/SECURITY-v0.2.61.md).
