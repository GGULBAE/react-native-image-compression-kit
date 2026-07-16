# Release Notes

This file keeps the current candidate and the most recent release-evidence work.
Complete prior notes are preserved in [0.2 release history](docs/releases/0.2-history.md).

## v0.2.62

- Package version: `0.2.62`
- npm latest: `0.2.55`
- Release state: `candidate`
- Scope: documentation information architecture and semantic status gates

This candidate separates the npm user README from repository-only release
operations. It adds a network-free documentation gate for semantic status,
required headings/links/commands, file existence, internal Markdown links and
anchors, README size, and npm package exclusions.

The packed README stale validator reads only the marked current-status block.
Historical candidate text outside that block is ignored; the current
`0.2.62`/`candidate` fields intentionally stop `pnpm release:dry-run` before a
publish dry run. Android doctor consumes the shared semantic result instead of
matching release procedure sentences.

### Included

- `package.json` version `0.2.62` and aligned README/RELEASE/SECURITY/Vitest.
- npm-focused README with current support, installation, API examples,
  limitations, verification, and repository documentation links.
- Repository-only release-evidence, Action pin, and historical documentation.
- `pnpm docs:check` in default verification.
- Current-status marker parsing and current-version candidate refusal.

### Not included

- npm publish, dist-tag changes, git tags, or GitHub Releases.
- Registry/review policy, digest, `evidence/npm`, or `evidence/reviews` changes.
- Workflow behavior changes, acquisition bundle verification, native/API
  changes, or AVIF output changes.

### Validation

```bash
pnpm verify
pnpm example:typecheck
pnpm fixtures:release-evidence-review-acquisition:check
pnpm docs:check
git diff --check
pnpm pack --dry-run
```

Package inspection must show no `docs/`, `evidence/`, `scripts/`, or `test/`
entries. `pnpm release:dry-run` is expected to stop at the packed README status
gate until the current status is changed from `candidate` through a reviewed
release update.

## Recent release-evidence work

- [v0.2.61](docs/releases/0.2-history.md#v0261) added authenticated review
  artifact acquisition and canonical importer handoff.
- [v0.2.60](docs/releases/0.2-history.md#v0260) retained the review archive for
  expiration-independent replay.
- [v0.2.59](docs/releases/0.2-history.md#v0259) added the reviewed policy receipt,
  promotion rehearsal bundle, and signer attestation.
- [v0.2.58](docs/releases/0.2-history.md#v0258) added canonical policy candidate
  preparation and reviewed promotion.
- [v0.2.57](docs/releases/0.2-history.md#v0257) added authenticated Registry
  Validation artifact acquisition.
- [v0.2.56](docs/releases/0.2-history.md#v0256) added release-evidence archive
  import and multi-version replay.
- [v0.2.55](docs/releases/0.2-history.md#v0255) is npm `latest` and retained the
  Action Pin attestation/release evidence baseline.

## History index

All earlier `0.2.x` and `0.1.x` entries, including exact runs, artifact IDs,
digests, validation commands, publication results, and non-goals, are indexed by
their version headings in [docs/releases/0.2-history.md](docs/releases/0.2-history.md).
