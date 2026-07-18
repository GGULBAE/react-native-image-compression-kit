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
| Public documentation site structure, claims, local links, and npm exclusion | `scripts/verify-site.mjs` | `pnpm site:check` and `pnpm site:build` |
| Native demo result metrics, source/output/screenshot bytes, presentation-video bytes, digests, platform provenance, and exact source identity | `test/demoEvidence.test.mjs` and `scripts/demo-evidence-core.mjs` | Native Demo Evidence workflow and `pnpm verify:demo-evidence` |
| Packed-consumer compatibility lane definitions | `test/compatibilityMatrix.test.mjs` and `scripts/compatibility-matrix-core.mjs` | `pnpm fixtures:compatibility:check` and the Compatibility workflow |
| Built public-site performance, accessibility, and SEO | `scripts/verify-site-quality.mjs` | `pnpm site:build && pnpm site:quality` |
| Repository metadata, security features, Actions policy, rulesets, environments, and Pages | `test/repositorySettings.test.mjs`, `docs/repository-settings.json`, and `scripts/repository-settings-core.mjs` | `pnpm fixtures:repository-settings:check` and `pnpm audit:repository-settings` |
| Exact release source, publishable state, tarball identity/inventory, and registry resume policy | `test/releaseArtifact.test.mjs` and `scripts/release-artifact-core.mjs` | `pnpm verify:release-artifact`, `pnpm verify:publication-state`, and the Trusted Release workflow |
| Protected master identity and required source checks | `test/releaseSource.test.mjs` and `scripts/release-source-core.mjs` | `pnpm verify:release-source` and the Trusted Release workflow |
| Android registration, typed request/source/decode/transform boundaries, build wiring, fixtures, and native-test presence | `test/androidSourceContract.test.ts` | `pnpm test` and `pnpm android:doctor` |
| Android compression behavior | Kotlin unit and instrumentation tests under `android/src/test` and `android/src/androidTest` | `pnpm example:android-unit-test` and `pnpm example:android-instrumentation` |
| iOS bridge, immutable request/source/inspection/decoder/transform/JPEG-metadata/output-encoder/output-persistence/pipeline boundaries, pod, workflow, and native-test/smoke-runner wiring | `test/iosSourceContract.test.ts` | `pnpm test` and `pnpm android:doctor` |
| iOS request validation behavior | Foundation-only table-driven native tests under `test/ios-native` | `pnpm example:ios:request-parser-test` and `pnpm example:ios:smoke` |
| iOS source acquisition and format inspection behavior | Foundation/ImageIO table-driven native tests under `test/ios-native` | `pnpm example:ios:input-test` and `pnpm example:ios:smoke` |
| iOS decode route, result/error, and executor ownership | Foundation/ImageIO table-driven native tests plus UIKit host smoke | `pnpm example:ios:decoder-test` and `pnpm example:ios:smoke` |
| iOS resize geometry, render request/result/error, background policy, and executor ownership | Foundation/CoreGraphics table-driven native tests plus UIKit host smoke | `pnpm example:ios:transformer-test` and `pnpm example:ios:smoke` |
| iOS JPEG preserve policy, ImageIO source properties, and destination metadata normalization | Foundation/ImageIO table-driven native tests plus UIKit host smoke | `pnpm example:ios:metadata-test` and `pnpm example:ios:smoke` |
| iOS JPEG/PNG/WebP routing, target-size search, WebP availability, codec defaults, and executor ownership | Foundation-only table-driven native tests plus UIKit/ImageIO host smoke | `pnpm example:ios:encoder-test` and `pnpm example:ios:smoke` |
| iOS cache path and extension selection, atomic file writes, stable output errors, and result projection | Foundation-only table-driven native tests plus UIKit host smoke | `pnpm example:ios:output-test` and `pnpm example:ios:smoke` |
| iOS request-to-output stage order, failure forwarding, runtime capability providers, and smoke observation | Foundation-only table-driven pipeline tests plus UIKit host smoke | `pnpm example:ios:pipeline-test` and `pnpm example:ios:smoke` |
| iOS compression behavior | Host-app smoke contracts, replay fixtures, and the iOS validation workflow | `pnpm fixtures:ios-pass-replay:audit` and `pnpm example:ios:smoke` |
| Registry and release evidence | Evidence-specific tests and semantic verifiers | `pnpm verify:release-evidence-set -- --json` and related evidence gates |

The public-site quality gate warms the local preview in Chrome, records three
desktop Lighthouse runs, and applies the unchanged thresholds to each
category's median score. Every run remains present in the JSON report, while
axe checks every sitemap route for serious or critical violations.

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
pnpm site:check
pnpm site:build
pnpm site:quality
pnpm fixtures:compatibility:check
pnpm fixtures:repository-settings:check
pnpm audit:repository-settings
pnpm verify:release-artifact -- --help
git diff --check
pnpm pack --dry-run
```

Platform workflows additionally run Android unit and instrumentation tests and
the iOS request/input/decoder/transformer/JPEG-metadata/output-encoder,
output-persistence, and pipeline native
tests plus host-app smoke test in their supported environments.

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
