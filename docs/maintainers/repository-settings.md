# Repository settings runbook

The machine-readable authority is
[`docs/repository-settings.json`](../repository-settings.json). The repository
audit is read-only; any mutation must be reviewed against that contract first.

## Required public settings

- Canonical description, Pages homepage, discovery topics, Discussions enabled,
  Wiki disabled, private vulnerability reporting enabled, and merged branches
  deleted.
- Actions restricted to GitHub-owned actions plus the selected third-party
  patterns, with full-SHA pinning and read-only default workflow permissions.
- Active `Protected master` ruleset: pull requests, resolved conversations,
  exact required checks, and no deletion or force push. A solo-maintainer
  repository intentionally uses zero required approvals so automation cannot
  deadlock; branch protection and required CI still apply.
- Active `Immutable version tags` ruleset blocking updates and deletion of
  `v*` tags. Creation remains available to the release workflow.
- `github-pages` and manually approved `npm-production` environments restricted
  to protected branches. Trusted Release is the only npm publisher; manual
  Registry Validation may use `npm-production` only as a read-only health
  deployment.
- Pages uses GitHub Actions, and immutable GitHub Releases are enabled before
  the first final release is published.

## Apply order

1. Merge the workflows and community files before requiring their checks.
2. Update metadata, topics, community features, security features, and Actions
   policy.
3. Create both environments. Add the repository owner as the
   `npm-production` reviewer and prohibit self-bypass if the GitHub plan permits.
4. Run CI once on `master`, then create the branch ruleset using the exact check
   names in the contract.
5. Create the tag ruleset, enable immutable releases, and configure Pages to use
   the Pages workflow.
6. Run the networked audit and preserve its JSON in the launch issue:

```sh
pnpm fixtures:repository-settings:check
pnpm audit:repository-settings -- --report-file /tmp/repository-settings-audit.json
```

## Change control

Capture a before/after API snapshot and use full GitHub API version headers.
Never weaken a protection merely to complete a release. If a required check was
renamed, update and merge the contract first, observe the new check on `master`,
then update the ruleset. Emergency bypasses must be time-bounded and recorded in
a private incident or public maintenance issue as appropriate.

Quarterly, compare the live repository to the contract, review administrators
and installed apps, and exercise the private security-report route. A failed
`pnpm audit:repository-settings` blocks a release until drift is understood.
