# Release launch kit

This directory holds release-ready copy, measurement context, and the handoff
sequence for the public open-source launch. It does not authorize posting to an
external channel. Every announcement requires a separate maintainer approval.

## Pre-launch

- Merge the candidate through protected `master` with all required checks.
- Confirm the public site, package tarball, native demo evidence, compatibility
  matrix, repository audit, and community routes are live and internally linked.
- Complete the release-state transition from `candidate` to `release` in a
  reviewed commit without changing the observed published npm latest. Record
  its exact full source SHA.
- Confirm the release target has a matching
  `docs/launch/v<version>-release-notes.md`; the workflow selects that file from
  its validated version input instead of a hardcoded prior release.
- Configure npm Trusted Publishing for `GGULBAE/react-native-image-compression-kit`,
  workflow `.github/workflows/release.yml`, and environment `npm-production`.
- Run the [trusted release runbook](../maintainers/trusted-release.md) once.
- Recheck the [pre-launch baseline](baseline.json); never rewrite it after launch.

## Launch order

1. Publish and verify npm plus provenance through Trusted Release.
2. Verify the immutable GitHub Release and exact tag-to-source mapping.
3. Run and import the existing registry/review evidence workflow.
4. Verify the Pages site and demo links from a signed-out browser session.
5. With explicit approval, publish the English or Korean announcement copy.
6. Open the first support window and triage issues through the templates.

The recommended first channels are the repository Release and Discussions.
Broader community posts should follow only after the package has been installable
and the docs site stable for at least one observation window.

## Post-launch

- During the first 24 hours, verify npm installation, provenance, site uptime,
  tag identity, and new issue/discussion routing at least twice.
- At 7 and 30 days, compare downloads, stars, forks, issues, pull requests, and
  documentation corrections to the immutable baseline. Avoid interpreting
  download totals as unique users.
- Route security reports privately, integration questions to Discussions, and
  reproducible defects to Issues.
- For a serious defect, prefer deprecation and a forward hotfix. npm versions,
  signed evidence, immutable releases, and protected tags are never rewritten.

## Materials

- [English announcement](announcement-en.md)
- [Korean announcement](announcement-ko.md)
- [v0.4.0 release notes](v0.4.0-release-notes.md)
- [v0.3.0 release notes](v0.3.0-release-notes.md)
- [Channel-specific copy and asset map](channel-copy.md)
- [Public compatibility contract](../compatibility-matrix.json)
- [Repository settings contract](../repository-settings.json)

## Approval record

Record the approving maintainer, exact copy revision, destination, date, and
result in the corresponding GitHub issue or release discussion. Do not add API
keys, recovery codes, private reports, or unpublished registry evidence here.
