# Supply-chain operations

This index contains repository-only dependency and GitHub Actions controls. The
documents, scripts, tests, locks, and review artifacts described here are not
part of the npm package.

## Procedure index

- [Dependency security](dependency-security.md) — reviewed Vite/esbuild and
  Lighthouse/OpenTelemetry resolutions, production boundary, offline gate, and
  override exit criteria.
- [Dependabot triage](dependabot-triage.md) — update grouping, queue limits,
  major-update policy, and the 2026-07-20 backlog disposition.
- [Immutable Action pins](action-pins.md) — canonical full-SHA lock, networked
  tag review, offline provenance replay, and signer verification.

## Default offline gates

```bash
pnpm verify:dependency-security -- --json
pnpm verify:workflow-supply-chain -- --json
pnpm verify:action-pin-fixture
pnpm verify:action-pin-attestation-fixture
```

Dependency updates do not weaken required CI, Android, iOS, compatibility, or
native-demo checks. A proposal that changes an Action SHA must use the Action
Pin Review path before the canonical lock or workflow pins change.
