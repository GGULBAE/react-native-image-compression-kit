# Release Evidence Operations

This index separates repository release operations from the npm package README.
All default verification and replay commands in this section are network-free
unless a page explicitly labels an acquisition or registry smoke command as
networked.

## Trust boundaries

1. Registry Validation creates provenance and attestation artifacts from an
   already published npm version.
2. Explicit acquisition downloads artifacts from one reviewed immutable run.
3. Offline import verifies bytes and exposes an immutable repository archive by
   atomic rename.
4. Policy preparation derives a canonical candidate and diff without editing
   policy.
5. Manual review binds approval and execution identity to the candidate digest.
6. Review/archive verifiers replay retained bytes after GitHub artifact expiry.

## Procedure index

- [Registry provenance](registry-provenance.md) — registry smoke, four-file
  provenance, attestation, retained release archive, and exact digests.
- [Acquisition](acquisition.md) — explicit Registry Validation and policy-review
  artifact download/handoff boundaries.
- [Policy review](policy-review.md) — candidate preparation, reviewed promotion,
  review receipt, rehearsal, and attestation.
- [Review archive](review-archive.md) — exact ZIP retention, atomic import,
  single-archive replay, and archive-set replay.
- [Supply-chain operations](../supply-chain/README.md) — development dependency
  security, Dependabot triage, immutable workflow pins, provenance, and
  attestation.
- [Complete release history](../releases/0.2-history.md) — version-by-version
  goals, runs, artifact IDs, digests, results, and non-goals.

## Release status contract

The repository-only [release status manifest](../release-status.json) is the
authority for `npmLatest`, `releaseState`, and `registryCheckedAt`. Package
version is intentionally absent and remains authoritative in `package.json`.

README and RELEASE contain marked mirror blocks so npm users and repository
operators can see the same status. `candidate` is non-publishable; `release` is
publishable. A reviewed transition must update the manifest and both mirrors
together. `pnpm docs:check` rejects missing markers, invalid fields, or any
expected/actual mismatch without querying the registry.

## Default offline gates

```bash
pnpm fixtures:release-evidence-acquisition:check
pnpm fixtures:release-evidence-review-acquisition:check
pnpm verify:release-evidence-set -- --json
pnpm verify:release-evidence-review-archive-set -- --json
pnpm verify:workflow-supply-chain -- --json
pnpm verify:action-pin-fixture
pnpm verify:action-pin-attestation-fixture
```

`evidence/npm`, `evidence/reviews`, scripts, tests, and this `docs/` tree are
repository-only and must remain excluded from the npm package.

## Historical source preservation

The former long-form package/repository README is preserved as the
[v0.2.61 repository guide snapshot](../legacy/README-v0.2.61.md). The snapshot
retains earlier operational prose, run URLs, digest statements, platform
implementation notes, and validation rationale. Current procedures are routed
through the focused pages above.
