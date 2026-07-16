# Release Notes

This file keeps the current release work and the most recent release evidence.
Complete prior notes are preserved in [0.2 release history](docs/releases/0.2-history.md).

## v0.2.62

<!-- release-status:start -->
- Package version: `0.2.62`
- npm latest: `0.2.55`
- Release state: `candidate`
- Registry checked at: `2026-07-16`
<!-- release-status:end -->

- Scope: documentation information architecture, semantic status gates,
  repository verification contract decomposition, and Android request parsing
  boundary extraction

This work separates the npm user README from repository-only release
operations. It adds a network-free documentation gate for semantic status,
required headings/links/commands, file existence, internal Markdown links and
anchors, README size, and npm package exclusions.

The packed README stale validator reads only the marked current-status block.
Historical candidate text outside that block is ignored. The shared state
matrix blocks `candidate` and permits `release`; Android doctor consumes the
same semantic result instead of matching release procedure sentences.

The repository-only [release status manifest](docs/release-status.json) is the
authority for npm latest, release state, and the registry check date. Package
version remains authoritative in `package.json`; the README and this release
block are validated mirrors.

Repository verification is split by contract instead of one Android-named
umbrella test. Package shape, documentation, Android wiring, iOS wiring, and
workflow supply chain each have an explicit authority. Native behavior remains
owned by Kotlin unit/instrumentation tests and the iOS host-app smoke gates;
doctor checks their structure and presence without copying implementation
sentences.

The Android bridge now delegates `ReadableMap` parsing and validation to an
immutable typed request boundary. Output selection, metadata, target-size,
resize, and source URI validation retain their existing error codes and
messages; decode, transform, metadata copy, and encode behavior are unchanged.

### Included

- `package.json` as the package-version authority, with aligned
  README/RELEASE/SECURITY/Vitest coverage.
- npm-focused README with current support, installation, API examples,
  limitations, verification, and repository documentation links.
- Repository-only release-evidence, Action pin, and historical documentation.
- Repository-only structured release-status manifest and shared publishability
  matrix.
- `pnpm docs:check` in default verification.
- Aligned README/RELEASE marker parsing and current candidate refusal.
- Domain contract suites for package, Android, iOS, documentation, and workflow
  verification, with a repository-only
  [authority matrix](docs/verification-architecture.md).
- Android doctor checks based on module wiring, commands, structured fixture
  metadata, and executable native-test authorities.
- Typed Android compression request parsing with table-driven Kotlin coverage
  for defaults, boundaries, invalid values, and malformed bridge types.

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
entries. `pnpm release:dry-run` stops for `candidate` and continues for a
manifest-aligned `release` after a reviewed status update.

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
- [v0.2.55](docs/releases/0.2-history.md#v0255) established the retained Action
  Pin attestation/release evidence baseline.

## History index

All earlier `0.2.x` and `0.1.x` entries, including exact runs, artifact IDs,
digests, validation commands, publication results, and non-goals, are indexed by
their version headings in [docs/releases/0.2-history.md](docs/releases/0.2-history.md).
