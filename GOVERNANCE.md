# Governance

React Native Image Compression Kit currently uses a maintainer-led governance
model.

## Maintainer responsibilities

The maintainer owns release decisions, security coordination, public API and
compatibility policy, repository settings, and evidence retention. Decisions
should be documented in issues, pull requests, release notes, or maintainer
runbooks rather than private chat.

## Decision process

- Small fixes and documentation changes are decided through pull request review.
- Public API, codec, metadata, compatibility, and release-policy changes require
  an issue or design note before implementation.
- Security decisions may remain private until coordinated disclosure.
- A release must satisfy the repository's exact-source and artifact gates.

## Maintainer changes and continuity

New maintainers should demonstrate sustained, careful contributions and agree
to the Code of Conduct and security rules. Repository and npm ownership changes
require 2FA and an explicit audit trail. Recovery credentials and private keys
must never be committed.

If the sole maintainer becomes unavailable, the project may pause releases
until repository and npm ownership can be transferred through their official
recovery processes. No contributor is entitled to publish access solely by
contribution volume.

## Conduct and appeals

Conduct reports are handled under [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
Maintainer decisions may be reconsidered when new reproducible evidence or a
clearer compatibility impact is provided.
