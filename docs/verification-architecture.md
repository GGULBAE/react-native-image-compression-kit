# Repository verification architecture

This document defines which executable check owns each repository contract. It
is repository-only operational documentation and is intentionally excluded
from the npm package.

## Authority matrix

| Contract | Authority | Repository gate |
| --- | --- | --- |
| Package metadata, exports, Codegen, publish allowlist, and command wiring | `test/packageContract.test.ts` | `pnpm test` |
| README, release status, required documentation, and local links | `test/docsSemantic.test.mjs` and `scripts/docs-semantic-core.mjs` | `pnpm docs:check` |
| GitHub Actions pins and workflow supply chain | `test/workflowSupplyChain.test.mjs` and `scripts/workflow-supply-chain-core.mjs` | `pnpm verify:workflow-supply-chain -- --json` |
| Android registration, typed request/source/decode boundaries, build wiring, fixtures, and native-test presence | `test/androidSourceContract.test.ts` | `pnpm test` and `pnpm android:doctor` |
| Android compression behavior | Kotlin unit and instrumentation tests under `android/src/test` and `android/src/androidTest` | `pnpm example:android-unit-test` and `pnpm example:android-instrumentation` |
| iOS bridge, pod, workflow, and smoke-runner wiring | `test/iosSourceContract.test.ts` | `pnpm test` |
| iOS compression behavior | Host-app smoke contracts, replay fixtures, and the iOS validation workflow | `pnpm fixtures:ios-pass-replay:audit` and `pnpm example:ios:smoke` |
| Registry and release evidence | Evidence-specific tests and semantic verifiers | `pnpm verify:release-evidence-set -- --json` and related evidence gates |

## Source contract policy

Repository contract tests may inspect stable identifiers, configuration
values, file existence, test names, commands, hashes, and structured metadata.
They must not duplicate complete Kotlin, Objective-C++, workflow, or historical
release prose as assertions.

Runtime behavior belongs in executable platform tests. Documentation meaning
belongs in the semantic documentation gate. Historical evidence remains
queryable in repository documents and evidence archives, but it is not a
current source contract.

## Validation commands

Run the complete repository gate before merging:

```sh
pnpm verify
pnpm example:typecheck
pnpm fixtures:release-evidence-review-acquisition:check
pnpm docs:check
git diff --check
pnpm pack --dry-run
```

Platform workflows additionally run Android unit and instrumentation tests and
the iOS host-app smoke test in their supported environments.

## Change routing

- Change package shape or scripts in the package contract.
- Change document structure or links in the documentation semantic gate.
- Change native behavior in the corresponding Kotlin or iOS smoke tests.
- Change workflow actions or pins in the workflow supply-chain verifier.
- Change release evidence rules in the evidence-specific verifier and fixtures.

## Non-goals

This architecture does not redefine runtime behavior, release policy, evidence
digests, workflow behavior, or platform capability. It only assigns each
existing contract to one verification authority and removes duplicate
source-text assertions.
