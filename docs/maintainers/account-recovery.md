# Maintainer account recovery

This runbook protects GitHub, npm, domain/email, and local signing access without
storing credentials in the repository.

## Preventive controls

- Require phishing-resistant two-factor authentication for GitHub and npm where
  each service supports it. Keep at least two independent authenticators.
- Store GitHub and npm recovery codes in an encrypted offline vault separate
  from the primary device. Verify recovery access twice a year.
- Keep the verified npm account email and GitHub security email current. Protect
  the email account with independent two-factor authentication and recovery.
- Prefer npm Trusted Publishing OIDC. Do not add a long-lived npm automation
  token to GitHub Actions or local release scripts.
- Review repository administrators, npm package maintainers, environment
  reviewers, trusted publishers, SSH keys, passkeys, and active sessions at
  every release.

## Suspected compromise

1. From a known-clean device, secure the email identity first, then GitHub and
   npm. Revoke suspicious sessions, tokens, keys, and recovery methods.
2. Disable the npm trusted publisher or `npm-production` environment while the
   incident is investigated. Do not delete published versions, releases, tags,
   provenance, or evidence.
3. Preserve timestamps, audit-log exports, workflow run IDs, package integrity,
   and exact source SHAs in a private incident record.
4. If users are exposed, publish a GitHub Security Advisory and deprecate the
   affected npm version with a precise migration message.
5. Restore release access only after a second maintainer or documented offline
   recovery check verifies repository rules, workflows, package ownership, and
   the trusted publisher tuple.

## Lost access

Use the service's official account recovery path. Never ask contributors for
credentials and never commit recovery codes. If only one service is recovered,
keep publication disabled until GitHub, npm, and the controlling email identity
are all trusted again.

After recovery, rotate every affected credential, re-enrol two-factor devices,
refresh offline recovery codes, run `pnpm audit:repository-settings`, verify npm
maintainers and Trusted Publishing, and document the completed review privately.
