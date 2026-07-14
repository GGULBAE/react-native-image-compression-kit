# Release Notes

## v0.2.50

Status: release-ready GitHub artifact attestation and offline identity verification release. npm `version` and `dist-tags.latest` remain `0.2.48` until the separately gated one-time `0.2.50` promotion; no `v0.2.50` git tag or GitHub Release is planned.

This release keeps native behavior, the public API, the registry provenance report schema, and the exact four-file v0.2.49 provenance bundle unchanged. It binds the canonical `bundle-manifest.json` to GitHub's OIDC-issued artifact attestation and adds a deterministic verifier for the attested subject digest and workflow identity without registry or network access.

### Goals

- Attest the existing canonical `registry-validation/bundle-manifest.json` with `actions/attest@v4`.
- Require repository, signer workflow, source ref, source commit, subject digest, OIDC issuer, SLSA predicate, GitHub-hosted runner, and verified timestamps to match explicit expectations.
- Download both the attestation bundle and GitHub CLI trusted root, pin the root bytes by SHA-256, and replay verification with network access disabled.
- Emit one fixed canonical JSON verifier report to stdout and atomically write byte-identical `--report-file` output.
- Preserve the existing `registry-provenance-<version>` artifact as exactly four files and upload attestation trust material separately.

### Attestation Contract

The manual Registry Validation workflow grants only `contents: read`, `id-token: write`, and `attestations: write` job permissions. After the existing registry smoke and four-file offline verification pass, `actions/attest@v4` signs the SHA-256 subject for `registry-validation/bundle-manifest.json`. The workflow performs an online GitHub CLI verification, downloads the attestation bundle, fetches the trusted root, checks the pinned trusted-root SHA-256 `65ca537f6ed8a47fd0e560c421baa1f6c1efb8b25fc200d8c5c02c0e92eb2b9c`, and runs the repository verifier before either artifact can satisfy the final gate.

`pnpm verify:registry-attestation -- --manifest registry-validation/bundle-manifest.json --attestation-bundle registry-attestation/attestation.jsonl --trusted-root registry-attestation/trusted-root.jsonl --expect-repository GGULBAE/react-native-image-compression-kit --expect-workflow GGULBAE/react-native-image-compression-kit/.github/workflows/registry-validation.yml --expect-ref refs/heads/master --expect-head-sha <workflow-head-sha> --json --report-file registry-attestation/attestation-verification.json` passes the bundle and trusted root to `gh attestation verify` with closed proxy endpoints, then validates GitHub CLI's JSON independently.

The ordered verifier result fields are `schemaVersion`, `status`, `subject`, `subjectSha256`, `repository`, `signerWorkflow`, `sourceRef`, `sourceDigest`, `oidcIssuer`, `predicateType`, `verifiedTimestamps`, and `error`. Verified timestamps are normalized to UTC ISO strings so the canonical report is byte-identical across local timezone settings. The canonical manifest must retain its existing schema and field ordering, and its bytes must hash to the single attestation subject. The certificate and SLSA v1 predicate must identify the expected repository, `.github/workflows/registry-validation.yml`, `refs/heads/master`, caller-supplied workflow head SHA, `https://token.actions.githubusercontent.com`, and a GitHub-hosted runner.

Official GitHub CLI offline verification requires both `--bundle` and `--custom-trusted-root`; therefore the separate `registry-provenance-attestation-<version>` artifact contains exactly `attestation.jsonl`, `trusted-root.jsonl`, and `attestation-verification.json`. The trusted-root file is security-critical rather than optional evidence and is accepted only when its bytes match the pinned SHA-256 above. The original `registry-provenance-<version>` artifact remains exactly `registry-provenance.json`, `stdout.json`, `package.tgz`, and `bundle-manifest.json`.

### Included

- `package.json` version bump to `0.2.50` and `verify:registry-attestation` command.
- Pure attestation JSON validation separated from GitHub CLI execution.
- Fixed canonical success/failure report schema and atomic report-file replacement.
- Offline Vitest fixtures for identity, subject, issuer, predicate, runner, timestamp, malformed JSON, multi-subject, trusted-root, GitHub CLI failure, and atomic-write contracts.
- Registry Validation permissions, official attestation action, online policy check, downloaded trust material, offline verifier gate, separate artifact, and Step Summary identity evidence.
- README, release notes, Android verification doctor checks, and Vitest expectations aligned to the registry-independent v0.2.50 release and the pre-promotion npm latest v0.2.48 state.

### Not Included

- npm publish, npm authentication, dist-tag changes, git tags, or GitHub Releases.
- Changes to the existing registry provenance report or four-file bundle schema.
- Registry or GitHub access from default `pnpm verify` or default CI.
- Native/API behavior changes or AVIF output implementation.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- Network-free offline success/failure Vitest fixtures.
- Registry Validation dispatched with `version=0.2.48` and `expected_tag=latest`.
- Downloaded provenance and attestation artifacts verified with network access disabled.
- Attestation subject SHA-256 equal to the downloaded canonical manifest SHA-256.
- Canonical verifier stdout and report-file byte equality.
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the pushed release-ready commit.

### Pre-publish Validation Result

- Implementation commit `5217c91555ac30bd3b6a2882f49600c386f8271d` passed GitHub Actions [CI](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29307762909), [Android Instrumentation](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29307762893), and [iOS Validation](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29307762973).
- Manual [Registry Validation run 29308232424](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29308232424) passed for `version=0.2.48` and `expected_tag=latest`; registry validation, manifest attestation, online and downloaded-bundle offline attestation verification, Step Summary generation, and both artifact uploads completed successfully.
- [Attestation 35197903](https://github.com/GGULBAE/react-native-image-compression-kit/attestations/35197903) binds `bundle-manifest.json` SHA-256 `eea6c859cac11a10d4f564957f49606ed9fb9814d37a9e4aabdbb8375285df53` to repository `GGULBAE/react-native-image-compression-kit`, signer workflow `GGULBAE/react-native-image-compression-kit/.github/workflows/registry-validation.yml`, ref `refs/heads/master`, source digest `5217c91555ac30bd3b6a2882f49600c386f8271d`, GitHub Actions OIDC, SLSA v1, and Tlog timestamp `2026-07-14T05:20:06.000Z`.
- The exact four-file `registry-provenance-0.2.48` artifact has GitHub digest `sha256:32697da5ffd12d237e2cedbdc94507f26ab58dcb40dec51ac1a45dfccc8f0a8b`; the separate three-file `registry-provenance-attestation-0.2.48` artifact has GitHub digest `sha256:45b2d6cf85c4de2db0f58f7870bf3c2876c632bcc4e3165400e76dacc2a4851d`.
- Downloaded provenance SHA-256 values are `eea6c859cac11a10d4f564957f49606ed9fb9814d37a9e4aabdbb8375285df53` for the manifest, `ec118e9c9aae3ecd783e10289fa1e9c52cb4dac73f298b86946d973fa0a2a128` for the tarball, and `cd142b45513e2d27cdfc39b75317df2f447df3f6ac1f99ec59ef9b0e3fa73ba3` for both report and stdout. Attestation artifact SHA-256 values are `2b7919495063cfe7db4b8121ce2e54484408bf8386df334797c65a07ebd2b319` for `attestation.jsonl`, the pinned `65ca537f6ed8a47fd0e560c421baa1f6c1efb8b25fc200d8c5c02c0e92eb2b9c` for `trusted-root.jsonl`, and `a89a481872f6cf543ba7b96ef4ba71d04fb15cd39429dfe3f47c175b496b643c` for `attestation-verification.json`.
- Local offline replay reproduced `attestation-verification.json` byte-for-byte from the downloaded manifest, attestation bundle, and trusted root. Report-file and stdout matched, UTC and Asia/Seoul runs matched, the attestation subject equaled the manifest digest, and provenance verification reported all six checks as `true` with network proxies forced closed.
- At this pre-publish checkpoint, npm `version` and `dist-tags.latest` remained `0.2.48`, and `react-native-image-compression-kit@0.2.50` did not exist. No publish, dist-tag change, git tag, GitHub Release, npm login, token, OTP, or authentication file was created during candidate validation.

## v0.2.49

Status: unpublished Registry provenance bundle offline verification candidate. npm `version` and `dist-tags.latest` remain `0.2.48`; no npm publish, dist-tag change, `v0.2.49` git tag, or GitHub Release is part of this candidate.

This candidate keeps native behavior, the public API, and the registry provenance report schema unchanged. It retains the exact tarball bytes already consumed by registry smoke in a fixed atomic bundle and adds a one-command verifier for canonical JSON, digest, archive, package, and README consistency without npm, GitHub, or other network access.

### Goals

- Atomically preserve `registry-provenance.json`, byte-identical `stdout.json`, the exact validated `package.tgz`, and canonical `bundle-manifest.json`.
- Recompute report/stdout SHA-256 plus tarball SHA-512 integrity and SHA-1 shasum offline.
- Inspect the gzip/tar archive in memory without extraction and validate package identity, sizes, required/forbidden files, and README status.
- Reject bundle path traversal, archive traversal, symlink/hardlink entries, duplicate files, unsupported entry types, corrupt archives, and schema drift.
- Emit one stable canonical verifier JSON object and atomically support `--report-file`.
- Extend the manual Registry Validation workflow with offline verification, fixed four-file artifact upload, and Step Summary checksums.

### Offline Provenance Bundle Contract

`pnpm smoke:registry -- --version 0.2.48 --expect-tag latest --json --artifact-dir registry-validation` performs the existing networked registry and clean-consumer checks, then writes the bundle through a sibling temporary directory and one atomic rename. The workflow does not download the tarball a second time; `package.tgz` contains the exact bytes that supplied the registry smoke README, package shape, integrity, and install evidence.

The ordered bundle manifest fields are `schemaVersion`, `status`, `package`, `version`, `expectedTag`, `reportFile`, `reportSha256`, `stdoutFile`, `stdoutSha256`, `tarballFile`, `tarballIntegrity`, `tarballShasum`, `fileCount`, `packageSize`, `unpackedSize`, and `error`. The existing ordered registry report fields and `schemaVersion: 1` contract remain unchanged.

`pnpm verify:registry-provenance -- --artifact-dir registry-validation --expect-package react-native-image-compression-kit --expect-version 0.2.48 --expect-tag latest --json` reads only the caller-selected artifact bundle. It requires exactly the four declared regular files, canonical manifest/report bytes, report/stdout byte equality, explicit package/version/tag expectations, matching digests and sizes, a valid `package/package.json`, all required files, no forbidden files, and a registry-independent tarball README. Tar entries are parsed in memory and never extracted. `--report-file` writes the exact verifier stdout bytes through a same-directory temporary file plus atomic rename.

The ordered verifier result fields are `schemaVersion`, `status`, `artifactDir`, `package`, `version`, `expectedTag`, `reportSha256`, `tarballIntegrity`, `tarballShasum`, `checks`, and `error`. Ordered checks are `manifest`, `report`, `stdout`, `tarball`, `packageContents`, and `readme`.

### Included

- `package.json` version bump to `0.2.49` and `verify:registry-provenance` command.
- Exact-tarball `--artifact-dir` output from the existing registry smoke command.
- Fixed canonical bundle manifest and atomic directory/report writes.
- Network-free verifier core plus CLI with secure in-memory tar parsing.
- Vitest coverage for success, CLI JSON/report parity, report/stdout drift, noncanonical JSON, unsupported schemas, selector mismatch, digest mismatch, corrupt tarball, missing/forbidden files, stale README, traversal, symlinks, and atomic failures.
- Manual Registry Validation offline gate, bundle checksums in GitHub Step Summary, and fixed four-file artifact upload.
- README, release notes, Android verification doctor checks, and Vitest expectations aligned to the v0.2.49 candidate and npm latest v0.2.48.

### Not Included

- npm publish, npm authentication, dist-tag changes, git tags, or GitHub Releases.
- GitHub artifact attestation, signatures, or an external trust anchor; the verifier proves bundle self-consistency against caller-supplied identity expectations.
- Offline replay of the consumer install/typecheck; the verifier validates the successful structured claim produced by the networked registry smoke.
- npm registry access from default `pnpm verify` or default CI.
- Native/API behavior changes or AVIF output implementation.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- Network-free offline success/failure Vitest fixtures.
- Registry Validation dispatched with `version=0.2.48` and `expected_tag=latest`.
- Downloaded workflow artifact verified with `pnpm verify:registry-provenance` without registry access.
- Report/stdout byte equality and v0.2.48 tarball integrity/shasum agreement.
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the pushed candidate commit.

### Candidate Validation Result

- Candidate implementation commit `d233529ddb3804b9fff05832bc4b327348f0fc51` passed GitHub Actions CI, Android Instrumentation, and iOS Validation.
- Manual [Registry Validation run 29182554246](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29182554246) passed for `version=0.2.48` and `expected_tag=latest`; its validation, Step Summary, and artifact upload steps all completed successfully.
- The uploaded `registry-provenance-0.2.48` artifact has GitHub digest `sha256:9039f1c127ce2f743d17a80e4469972a65343cabf91f3b5074808294ac670fa3` and contains exactly the four declared files.
- Downloaded bundle SHA-256 values are `eea6c859cac11a10d4f564957f49606ed9fb9814d37a9e4aabdbb8375285df53` for `bundle-manifest.json`, `ec118e9c9aae3ecd783e10289fa1e9c52cb4dac73f298b86946d973fa0a2a128` for `package.tgz`, and `cd142b45513e2d27cdfc39b75317df2f447df3f6ac1f99ec59ef9b0e3fa73ba3` for both report and stdout.
- The downloaded bundle matched the independently generated local bundle byte-for-byte. Offline verification reported all `manifest`, `report`, `stdout`, `tarball`, `packageContents`, and `readme` checks as `true`.
- npm `version` and `dist-tags.latest` remain `0.2.48`, while `react-native-image-compression-kit@0.2.49` remains unpublished. No publish, dist-tag change, git tag, GitHub Release, or authentication file was created.

## v0.2.48

Status: published to npm as the `0.2.48` latest registry provenance and manual CI gate release. npm `version` and `dist-tags.latest` are both `0.2.48`; no `v0.2.48` git tag or GitHub Release was created.

This release keeps native and public API behavior unchanged. It makes the existing post-publish registry smoke evidence deterministic, machine-consumable, reproducible from one command, and runnable through an explicit manual GitHub Actions gate.

### Goals

- Require an exact published version and optionally prove a named dist-tag resolves the same version.
- Emit one stable canonical JSON provenance report to stdout and an atomic report file.
- Validate the real registry tarball README, integrity/shasum, required/forbidden files, and clean consumer install/typecheck.
- Separate command execution from validation so all success/failure contracts run offline in Vitest fixtures.
- Add a workflow-dispatch-only Registry Validation workflow with Step Summary and uploaded evidence.

### Registry Provenance Contract

`pnpm smoke:registry -- --version 0.2.47 --expect-tag latest --json --report-file registry-provenance.json` resolves the exact version, separately resolves `dist-tags.latest`, packs the resolved registry tarball, extracts its actual `README.md`, and runs the clean consumer smoke. `--json` emits exactly one canonical JSON object to stdout. `--report-file` uses a same-directory temporary file plus atomic rename, and its bytes match stdout.

The ordered report fields are `schemaVersion`, `status`, `package`, `requestedVersion`, `resolvedVersion`, `expectedTag`, `tagVersion`, `publishedAt`, `tarball`, `integrity`, `shasum`, `fileCount`, `packageSize`, `unpackedSize`, `readmeStatus`, `forbiddenFiles`, `registryInstallSmoke`, and `error`.

`scripts/readme-status-validator.mjs` is shared by `release:dry-run` and the registry validator. Offline fixtures cover success, version/tag mismatch, stale candidate/unpublished/no-publish README wording, integrity mismatch, forbidden files, install failure, stable field order, canonical bytes, and atomic-write failure without a partial replacement.

### Included

- `package.json` version bump to `0.2.48`.
- Shared README status validator and pure registry provenance validation module.
- Extended `scripts/registry-smoke-test.mjs` CLI with `--expect-tag`, `--json`, and `--report-file`.
- Offline registry evidence fixtures and Vitest failure contracts.
- Manual `.github/workflows/registry-validation.yml` report, summary, artifact, and failure gate.
- README, release notes, Android verification doctor expectations, and Vitest expectations aligned to registry-independent packed wording and the final v0.2.48 published state.

### Not Included

- Additional or automatic npm publish attempts, npm authentication storage, login automation, or manual dist-tag changes outside the completed single `latest` promotion.
- Git tag or GitHub Release creation.
- Registry access from default `pnpm verify` or the default CI workflow.
- Native/API behavior changes or AVIF output implementation.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- `pnpm smoke:registry -- --version 0.2.48 --expect-tag latest --json --report-file registry-provenance.json`
- Canonical stdout/report-file byte comparison.
- GitHub Actions CI, Android Instrumentation, iOS Validation, and manual Registry Validation.

### Promotion Result

- Release-ready commit `80bf1c3808aaab32db984df7c1df83d0fca8b149` passed GitHub Actions [CI](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29180643528), [Android Instrumentation](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29180643527), and [iOS Validation](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29180643530).
- npm authentication was confirmed as `ggulbae`, then `npm publish --tag latest` was executed exactly once and published `react-native-image-compression-kit@0.2.48`.
- Registry metadata reports `version=0.2.48`, `dist-tags.latest=0.2.48`, publish time `2026-07-12T05:47:42.131Z`, and modified time `2026-07-12T05:47:42.234Z`.
- `pnpm smoke:registry -- --version 0.2.48 --expect-tag latest --json --report-file registry-provenance.json` matched integrity `sha512-NBk5Gb56Wc/va1p3bTQ7PS93ihoTBE0Fdh8ekvhXt/fQQ2UWcH0xBaIIomybHUi1PnrCAuIFiAO4gm5AMvhO6g==`, shasum `dcc1b43534c6a9620d2704f692f335f28ff2f0d4`, 51 files, 66,099-byte package size, and 291,340-byte unpacked size; README status and clean consumer install/typecheck passed.
- Manual [Registry Validation run 29181708376](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29181708376) passed, produced the GitHub Step Summary, and uploaded byte-identical one-line provenance report/stdout artifacts.
- No additional publish attempt, manual dist-tag change, git tag, or GitHub Release was performed.

## v0.2.47

Status: published to npm as the `0.2.47` latest iOS PASS replay automation gate release. npm `version` and `dist-tags.latest` are both `0.2.47`; no `v0.2.47` tag or GitHub Release was created.

This release does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, change the live iOS PASS payload, add native features, download GitHub Actions logs, refresh artifacts automatically, write from check/audit modes, or access the network during tests. It keeps runtime behavior unchanged while making the committed iOS PASS replay artifact an explicit semantic, local, and CI quality gate.

### Goals

- Add a reusable `RNICK_IOS_SMOKE_PASS` payload validator for exact capability-driven field order and value semantics.
- Validate `platform: 'ios'`, positive safe-integer `*ResultBytes`, boolean capability flags, and duplicate-free capability-consistent unsupported format arrays.
- Apply the semantic payload validator from the replay fixture validator.
- Add source-log-free `--audit` mode for the committed artifact.
- Add stable `--check --json` and `--audit --json` machine-readable reports.
- Preserve existing text-mode check output, `0`/`1` exit behavior, and no-write/no-network boundaries.
- Run the standalone audit from `pnpm verify` and the iOS Validation workflow.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.47 release.

### iOS PASS Replay Automation Gate

`getIOSSmokePassPayloadContractDifferences()` and `validateIOSSmokePassPayload()` now enforce the exact field order selected by the WebP-output x AVIF-input capability matrix. Every present `*ResultBytes` field must be a positive safe integer, `platform` must be `ios`, both capability fields must be booleans, and `unsupportedInputs` / `unsupportedOutputs` must be unique ordered string arrays that agree with those capabilities.

`validateIOSSmokePassReplayFixture()` now applies that payload contract after validating the fixture schema, provenance, GitHub Actions source-line metadata, and SHA-256 integrity. `getIOSSmokePassReplayFixtureValidationDifferences()` provides deterministic artifact-side labels for audit and machine-readable failures.

`pnpm fixtures:ios-pass-replay:audit -- --json` reads the committed artifact without requiring the original Actions log. It validates JSON parsing, canonical bytes, schema, provenance, source-line digest, and payload semantics. The command exits `0` only for a current artifact and exits `1` for stale or invalid artifacts without creating or modifying files.

`--check --json` and `--audit --json` emit exactly one compact JSON object to stdout with ordered `schemaVersion`, `mode`, `status`, `artifactPath`, `differences`, and `error` fields. `status` is `current`, `stale`, or `invalid`; text mode keeps the existing human-readable check contract. Conflicting `--check` / `--audit` flags and audit source arguments fail deterministically.

`test/iosSmokeContract.test.mjs` covers all four capability matrix cases, every selected result byte field, field ordering, platform, capability types, duplicate arrays, and capability consistency. `test/iosSmokePassReplayFixture.test.mjs` snapshots current, stale, noncanonical, missing, malformed, schema-invalid, payload-invalid, and flag-conflict text/JSON stream behavior while pinning no-write and no-network boundaries.

### Included

- `package.json` version bump to `0.2.47`, `fixtures:ios-pass-replay:audit`, and the audit step in `pnpm verify`.
- Reusable semantic PASS payload validator and replay artifact validation differences.
- Standalone `--audit` plus stable check/audit JSON result schema.
- iOS Validation workflow audit gate before simulator smoke.
- Matrix-wide semantic validator and CLI JSON/no-write/no-network Vitest coverage.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.47 published state.

### Not Included

- GitHub Actions log download or API access from the replay fixture CLI.
- Automatic fixture refresh or writes from check/audit modes.
- Network access from tests.
- Changes to the live `RNICK_IOS_SMOKE_PASS` payload fields.
- iOS or Android native feature changes.
- AVIF input support forced available or unavailable on real simulators.
- WebP output forced on runtimes that do not advertise ImageIO WebP destination support.
- AVIF output enablement or actual AVIF file returns from `compressImage()`.
- Forced simulator capability changes or simulator failures.
- Git tag or GitHub Release promotion for `v0.2.47`.

### Promotion Result

- Release-ready commit `9434f5fe02c3030b178a2c5d0f6cc871b7e0262a` passed GitHub Actions [CI](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29146930316), [Android Instrumentation](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29146930311), and [iOS Validation](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29146930321).
- npm authentication was confirmed as `ggulbae`, then `npm publish --tag latest` was executed exactly once and published `react-native-image-compression-kit@0.2.47`.
- Registry metadata reports `version=0.2.47`, `dist-tags.latest=0.2.47`, and modified time `2026-07-11T11:23:46.074Z`.
- `pnpm smoke:registry -- --version 0.2.47` downloaded the registry tarball, matched integrity `sha512-BH2Kupv1OhlKtyjZ2BZnM6uvjJV+OQDXS064/oTi4rj6fEIzWWOefDBgHXokNlxxqwVBxhfawbudzvuYFpJBoQ==` and shasum `a17b89f89d49dce1092d46bc02cea20c8a7e0228`, installed it into a clean consumer, and passed public API typechecking.
- Independent inspection of the 51-file registry tarball confirmed the packed README retains registry-independent v0.2.47 release wording, contains no guarded v0.2.47 candidate snippets, and excludes development-only scripts, tests, fixtures, examples, workflows, and `RELEASE.md`.
- No git tag, GitHub Release, extra publish attempt, or manual dist-tag change was performed.

### Validation

- `pnpm fixtures:ios-pass-replay:audit -- --json`
- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- `npm view react-native-image-compression-kit version dist-tags.latest time.modified --json`
- `pnpm smoke:registry -- --version 0.2.47`
- Real registry tarball README and development-only file exclusion inspection.
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the release-ready and final published-status commits.

## v0.2.46

Status: unpublished release candidate for iOS PASS replay fixture offline check mode coverage. npm `latest` remains `0.2.40`; no `v0.2.46` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, add iOS native features, download GitHub Actions logs, write artifacts in check mode, or access the network during tests. It keeps runtime behavior unchanged while adding a read-only comparison between a local Actions log plus provenance and the committed canonical replay artifact.

### Goals

- Add `--check` mode to the existing offline replay fixture CLI.
- Compare the in-memory expected fixture with the existing artifact's validated canonical JSON bytes.
- Exit `0` for a current artifact and `1` for missing, malformed, invalid, stale, or noncanonical artifacts.
- Report concise schema, provenance, source-line SHA-256, source-line, and canonical-format differences.
- Prove fake-log check paths never create or modify the target artifact and retain the existing no-network boundary.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.46 candidate.

### iOS PASS Replay Offline Check Mode

`getIOSSmokePassReplayFixtureDifferences()` returns deterministic `schema`, `schemaVersion`, `provenance.schema`, `provenance.<field>`, and `sourceLine` labels while the existing validator continues to reject malformed artifact structure and integrity mismatches.

`pnpm fixtures:ios-pass-replay:check -- --log-file <local-log> --workflow-name <workflow> --run-id <run-id> --run-url <run-url> --head-sha <head-sha>` runs the existing refresh CLI with `--check`. It creates the expected fixture in memory, reads and validates the existing artifact, compares exact canonical bytes, and reports `canonicalFormat` when only JSON formatting differs. A successful check prints the resolved artifact path and exits `0`; every stale or invalid path exits `1` without writing.

`test/iosSmokePassReplayFixture.test.mjs` covers current, stale provenance, stale source-line/digest, missing, malformed, invalid-schema, and noncanonical fake artifacts. Current and stale tests pin unchanged bytes and modification times, missing-artifact coverage proves no file is created, and static source assertions continue to exclude child-process, HTTP, HTTPS, socket, `fetch()`, and `gh run` network paths from the CLI.

### Included

- `package.json` version bump to `0.2.46` and `fixtures:ios-pass-replay:check` command.
- Read-only `--check` mode with deterministic drift labels and canonical-byte comparison.
- Fake-log current/stale/missing/invalid/noncanonical no-write Vitest coverage.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.46 candidate state and the published v0.2.40 npm baseline.

### Not Included

- GitHub Actions download or API access from the replay fixture CLI.
- Automatic replay artifact refresh from check mode.
- Network access from tests.
- iOS native feature changes.
- AVIF input support forced available or unavailable on real simulators.
- WebP output forced on runtimes that do not advertise ImageIO WebP destination support.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.46`.
- Forced simulator capability changes or forced simulator failures.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the release candidate commit.

## v0.2.45

Status: unpublished release candidate for iOS PASS replay fixture offline refresh artifact coverage. npm `latest` remains `0.2.40`; no `v0.2.45` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, add iOS native features, access GitHub from the refresh CLI, or access the network during tests. It keeps runtime behavior unchanged while moving replay provenance and the exact PASS source line into a canonical JSON artifact with a deterministic offline refresh path.

### Goals

- Move replay provenance and the exact `RNICK_IOS_SMOKE_PASS` source line into a structured fixture artifact.
- Add an offline CLI that accepts a local Actions log plus workflow/run/head SHA provenance arguments.
- Derive job, step, timestamp, and source-line SHA-256 while writing canonical deterministic JSON.
- Pin the fixture schema, canonical formatting, and fake-log CLI success/error behavior without network access.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.45 candidate.

### iOS PASS Replay Offline Refresh Artifact

`test/fixtures/ios-smoke-pass-ci-replay.json` now owns `schemaVersion`, the ordered provenance fields, and the exact successful GitHub Actions-prefixed PASS source line. `test/iosSmokeContract.test.mjs` loads that artifact, verifies canonical byte formatting through `formatIOSSmokePassReplayFixture()`, and replays the source line against the existing payload matrix schema.

`scripts/ios-smoke-pass-replay-fixture.mjs` owns single PASS-line extraction, GitHub Actions prefix parsing, exact schema validation, run URL/head SHA validation, PASS JSON validation, source metadata matching, SHA-256 calculation, and deterministic two-space JSON formatting with one trailing newline.

`pnpm fixtures:ios-pass-replay -- --log-file <local-log> --workflow-name <workflow> --run-id <run-id> --run-url <run-url> --head-sha <head-sha>` runs `scripts/refresh-ios-smoke-pass-replay.mjs`. The CLI only reads a local log and writes the artifact; downloading or exporting the Actions log remains a separate explicit step.

`test/iosSmokePassReplayFixture.test.mjs` builds exact fake-log schema expectations, compares repeated formatter output, runs the CLI twice into separate files and compares their bytes, rejects missing/duplicate/malformed/hash-mismatched source lines, and asserts the CLI has no child-process, HTTP, HTTPS, socket, `fetch()`, or `gh run` path.

### Included

- `package.json` version bump to `0.2.45`.
- Canonical structured replay fixture under `test/fixtures`.
- Reusable replay fixture schema/format module and offline refresh CLI.
- Fake-log deterministic output and error-path Vitest coverage.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.45 candidate state and the published v0.2.40 npm baseline.

### Not Included

- GitHub Actions download or API access from the refresh CLI.
- Network access from tests.
- iOS native feature changes.
- AVIF input support forced available or unavailable on real simulators.
- WebP output forced on runtimes that do not advertise ImageIO WebP destination support.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.45`.
- Forced simulator capability changes or forced simulator failures.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the release candidate commit.

## v0.2.44

Status: unpublished release candidate for iOS PASS replay fixture source-line integrity digest coverage. npm `latest` remains `0.2.40`; no `v0.2.44` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, add iOS native features, or access GitHub during tests. It keeps runtime behavior unchanged while binding the replay provenance to the exact successful `RNICK_IOS_SMOKE_PASS` source line with SHA-256.

### Goals

- Add the exact PASS source-line SHA-256 to `IOS_SMOKE_PASS_CI_LOG_REPLAY_PROVENANCE`.
- Extract exactly one `RNICK_IOS_SMOKE_PASS` source line and reject missing or duplicate lines.
- Verify the replay source line matches the provenance digest before parsing its payload against the existing matrix schema.
- Document digest recalculation when a stale replay fixture is refreshed.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.44 candidate.

### iOS PASS Replay Source-Line Integrity Digest

`test/iosSmokeContract.test.mjs` now pins `sourceLineSha256` to `c20c9e72f2b9f3159d7db56c7c811a3ecb81555a9d9e90350d2e155e6f832dc6`. The digest covers the complete GitHub Actions-prefixed `RNICK_IOS_SMOKE_PASS` line as UTF-8 without a trailing newline, including the job, step, Actions timestamp, unified-log prefix, marker, and JSON payload.

`extractSingleIOSSmokePassCIReplaySourceLine()` requires exactly one PASS source line in `IOS_SMOKE_PASS_CI_LOG_REPLAY_FIXTURE`. The replay test verifies missing and duplicate lines fail, hashes the extracted line with Node `createHash('sha256')`, compares it with provenance, and then runs the existing payload and matrix-schema assertions without network access.

When the replay fixture becomes stale, select a newer successful `iOS Validation` run, copy the complete `RNICK_IOS_SMOKE_PASS` line from the `iOS host-app smoke` / `Run iOS host-app smoke` log, calculate SHA-256 over that exact UTF-8 line without a trailing newline, and update `sourceLineSha256`, the remaining provenance fields, and `IOS_SMOKE_PASS_CI_LOG_REPLAY_FIXTURE` together before running the local validation checklist.

### Included

- `package.json` version bump to `0.2.44`.
- Exact PASS source-line SHA-256 provenance and local Node crypto assertion.
- Missing and duplicate PASS source-line rejection coverage.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.44 candidate state and the published v0.2.40 npm baseline.

### Not Included

- Network access from tests.
- iOS native feature changes.
- AVIF input support forced available or unavailable on real simulators.
- WebP output forced on runtimes that do not advertise ImageIO WebP destination support.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.44`.
- Forced simulator capability changes or forced simulator failures.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the release candidate commit.

## v0.2.43

Status: unpublished release candidate for iOS PASS payload replay fixture provenance coverage. npm `latest` remains `0.2.40`; no `v0.2.43` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, or add iOS native features. It keeps runtime behavior unchanged while making the successful GitHub Actions source behind `IOS_SMOKE_PASS_CI_LOG_REPLAY_FIXTURE` explicit and testable.

### Goals

- Pin workflow `iOS Validation`, source run `28928015548`, head SHA `c6981c3b6b06e5e6e34f42147a94e4299a0f82b2`, source URL, job, step, and timestamp beside the replay fixture.
- Verify the GitHub Actions job/step/timestamp prefix is derived from the pinned provenance metadata.
- Document how to refresh the replay fixture when its successful CI payload becomes stale.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.43 candidate.

### iOS PASS Payload Replay Fixture Provenance

`test/iosSmokeContract.test.mjs` now includes `IOS_SMOKE_PASS_CI_LOG_REPLAY_PROVENANCE`, which points to [iOS Validation run 28928015548](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28928015548) at head SHA `c6981c3b6b06e5e6e34f42147a94e4299a0f82b2`. The provenance object also pins the `iOS host-app smoke` job, `Run iOS host-app smoke` step, and `2026-07-08T08:25:57.8583890Z` PASS-line timestamp.

The replay test asserts the full provenance object, checks that its run URL contains the pinned run id, and builds the expected GitHub Actions prefix from the provenance job, step, and timestamp before parsing the payload against the existing matrix schema.

When the replay fixture becomes stale, select a newer successful `iOS Validation` run, copy the complete `RNICK_IOS_SMOKE_PASS` line from the `iOS host-app smoke` / `Run iOS host-app smoke` log, update `IOS_SMOKE_PASS_CI_LOG_REPLAY_PROVENANCE` and `IOS_SMOKE_PASS_CI_LOG_REPLAY_FIXTURE` together, then run the local validation checklist below.

### Included

- `package.json` version bump to `0.2.43`.
- Replay fixture source workflow, run id, head SHA, URL, job, step, and timestamp provenance in `test/iosSmokeContract.test.mjs`.
- Provenance-to-log-prefix Vitest assertions and stale fixture refresh guidance.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.43 candidate state and the published v0.2.40 npm baseline.

### Not Included

- iOS native feature changes.
- AVIF input support forced available or unavailable on real simulators.
- WebP output forced on runtimes that do not advertise ImageIO WebP destination support.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.43`.
- Forced simulator capability changes or forced simulator failures.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the release candidate commit.

## v0.2.42

Status: unpublished release candidate for iOS PASS payload CI log replay fixture coverage. npm `latest` remains `0.2.40`; no `v0.2.42` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, or add iOS native features. It keeps iOS native compression behavior unchanged while pinning the real GitHub Actions log shape emitted by a successful `RNICK_IOS_SMOKE_PASS` host-app smoke.

### Goals

- Add a replay fixture copied from a successful GitHub Actions iOS Validation `RNICK_IOS_SMOKE_PASS` line.
- Preserve the GitHub Actions job/step/timestamp prefix and the `ImageCompressionKitExample.debug.dylib` unified-log prefix in simulator-free Vitest coverage.
- Prove `parseIOSSmokePassPayload()` extracts the payload from the real CI-shaped line.
- Compare the replay payload against the matrix-derived required fields and formatted schema.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.42 candidate.

### iOS PASS Payload CI Log Replay Fixture

`test/iosSmokeContract.test.mjs` now includes `IOS_SMOKE_PASS_CI_LOG_REPLAY_FIXTURE`, copied from a successful GitHub Actions iOS Validation run. The fixture keeps the workflow job name, step name, GitHub timestamp, unified-log timestamp, process/thread marker, debug dylib prefix, `RNICK_IOS_SMOKE_PASS` marker, and JSON payload on the same line.

The replay test parses that line through `parseIOSSmokePassPayload()`, verifies the payload matches the fixture-factory payload for the `webp-output-unavailable-avif-input-available` matrix case, checks that `Object.keys(payload)` equals the matrix-derived required fields, and keeps `listMissingIOSSmokePassPayloadFields()` plus `formatIOSSmokePassPayloadSchema()` aligned with the real CI payload shape.

The existing matrix test still owns all four WebP output x AVIF input combinations; this candidate adds real-log replay coverage so a future parser or log-prefix change cannot silently break successful iOS smoke PASS extraction.

### Included

- `package.json` version bump to `0.2.42`.
- Successful GitHub Actions iOS Validation PASS log replay fixture in `test/iosSmokeContract.test.mjs`.
- Matrix-derived required-field and schema checks against the replayed payload.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.42 candidate state and the published v0.2.40 npm baseline.

### Not Included

- iOS native feature changes.
- AVIF input support forced available or unavailable on real simulators.
- WebP output forced on runtimes that do not advertise ImageIO WebP destination support.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.42`.
- Forced simulator capability changes or forced simulator failures.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the release candidate commit.

## v0.2.41

Status: unpublished release candidate for iOS PASS payload schema matrix helper coverage. npm `latest` remains `0.2.40`; no `v0.2.41` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, or add iOS native features. It keeps iOS native compression behavior unchanged while making the simulator-free `RNICK_IOS_SMOKE_PASS` payload schema tests table-driven across the four WebP output x AVIF input capability combinations.

### Goals

- Derive iOS PASS payload required-field schemas from one WebP output x AVIF input matrix.
- Keep legacy exported required-field constants compatible while making them matrix-derived.
- Replace duplicated PASS log JSON fixtures with a shared fixture factory for all four capability combinations.
- Preserve missing conditional WebP and AVIF result-field coverage.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.41 candidate.

### iOS PASS Payload Schema Matrix Helper

`scripts/ios-smoke-contract.mjs` now exposes `IOS_SMOKE_PASS_PAYLOAD_SCHEMA_MATRIX`, and the existing `IOS_SMOKE_PASS_PAYLOAD_REQUIRED_FIELDS`, `IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_REQUIRED_FIELDS`, `IOS_SMOKE_PASS_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS`, and `IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS` exports are derived from that matrix.

`getIOSSmokePassPayloadRequiredFields()` now chooses the matrix case from `webpOutputAvailable` and `avifInputAvailable` instead of branching across duplicated required-field arrays.

`test/iosSmokeContract.test.mjs` now builds prefixed `RNICK_IOS_SMOKE_PASS` payloads with a fixture factory, loops through all four matrix cases, and pins payload key order, type schema, unsupported input/output arrays, and missing-field probes without repeating full JSON payload strings.

The matrix keeps `avifResultBytes`, `avifToPngResultBytes`, and `avifToWebPResultBytes` conditional on AVIF input availability; keeps WebP output result bytes and `webpTargetSizeResultBytes` conditional on WebP output availability; and keeps `unsupportedInputs: ['avif']` plus `unsupportedOutputs` WebP exclusion behavior covered.

### Included

- `package.json` version bump to `0.2.41`.
- Matrix-driven PASS payload required-field helper in `scripts/ios-smoke-contract.mjs`.
- Four-case WebP output x AVIF input fixture factory coverage in `test/iosSmokeContract.test.mjs`.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.41 candidate state and the published v0.2.40 npm baseline.

### Not Included

- iOS native feature changes.
- AVIF input support forced available or unavailable on real simulators.
- WebP output forced on runtimes that do not advertise ImageIO WebP destination support.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.41`.
- Forced simulator capability changes.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the release candidate commit.

## v0.2.40

Status: published to npm as the `0.2.40` latest iOS AVIF-input unavailable PASS payload schema snapshot release. No `v0.2.40` tag or GitHub Release is part of this package-page promotion.

This release does not enable AVIF output, force AVIF input unavailability, force WebP output availability, or add iOS native features. It keeps iOS native compression behavior unchanged while pinning the JSON payload fields emitted by successful `RNICK_IOS_SMOKE_PASS` host-app smoke logs when `avifInputAvailable=false`.

### Goals

- Add simulator-free `RNICK_IOS_SMOKE_PASS` fixture coverage for the AVIF-input unavailable branches.
- Snapshot omission of `avifResultBytes` and `avifToPngResultBytes` when `avifInputAvailable=false`.
- Snapshot omission of `avifToWebPResultBytes` when WebP output is available but AVIF input is unavailable.
- Prove `unsupportedInputs` includes `avif` when AVIF source support is unavailable.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.40 npm latest release.

### iOS AVIF-Input Unavailable PASS Payload Schema Snapshots

`scripts/ios-smoke-contract.mjs` now exposes `IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_REQUIRED_FIELDS`, `IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS`, and an AVIF-aware `getIOSSmokePassPayloadRequiredFields()` branch so AVIF-input unavailable PASS payloads can be checked without launching Xcode, Metro, or a simulator.

`test/iosSmokeContract.test.mjs` parses prefixed `RNICK_IOS_SMOKE_PASS` log fixtures with `avifInputAvailable=false`, snapshots payload key order and type schema for WebP-output unavailable and available runtimes, and verifies missing conditional AVIF fields are not reported as missing when AVIF input is unavailable.

The fixtures also pin `unsupportedInputs: ['avif']`, proving the AVIF-input unavailable branch reports AVIF as an unsupported input while keeping HEIC, HEIF, and AVIF output unsupported and WebP output capability-gated.

### Included

- `package.json` version bump to `0.2.40`.
- Conditional AVIF-input unavailable PASS payload schema helpers in `scripts/ios-smoke-contract.mjs`.
- Exact `avifInputAvailable=false` `RNICK_IOS_SMOKE_PASS` payload fixture expectations in `test/iosSmokeContract.test.mjs`.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.40 npm latest release state.
- npm publish promotion for `0.2.40` with the `latest` dist-tag.

### Not Included

- iOS native feature changes.
- AVIF input support forced unavailable on real simulators.
- WebP output forced on runtimes that do not advertise ImageIO WebP destination support.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- Git tag or GitHub Release promotion for `v0.2.40`.
- Forced simulator capability changes.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- `npm view react-native-image-compression-kit version dist-tags --json`
- `pnpm smoke:registry -- --version 0.2.40`
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the package-page promotion commit.

## v0.2.39

Status: unpublished release candidate for iOS WebP-output available PASS payload schema snapshot coverage. npm `latest` remains `0.2.38`; no `v0.2.39` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output, force WebP output availability, or add iOS native features. It keeps iOS native compression behavior unchanged while pinning the extra JSON payload fields emitted by successful `RNICK_IOS_SMOKE_PASS` host-app smoke logs when `webpOutputAvailable=true`.

### Goals

- Add simulator-free `RNICK_IOS_SMOKE_PASS` fixture coverage for the WebP-output available branch.
- Snapshot the conditional WebP output result byte fields: `jpegToWebPResultBytes`, `pngToWebPResultBytes`, `gifToWebPResultBytes`, `webpToWebPResultBytes`, `heicToWebPResultBytes`, `heifToWebPResultBytes`, and `avifToWebPResultBytes`.
- Snapshot `webpTargetSizeResultBytes` as a required conditional field when `webpOutputAvailable=true`.
- Prove `unsupportedOutputs` excludes `webp` when WebP destination support is available.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.39 candidate.

### iOS WebP Output PASS Payload Schema Snapshots

`scripts/ios-smoke-contract.mjs` now exposes `IOS_SMOKE_PASS_WEBP_OUTPUT_REQUIRED_FIELDS`, `IOS_SMOKE_PASS_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS`, and `getIOSSmokePassPayloadRequiredFields()` so WebP-output available PASS payloads can be checked without launching Xcode, Metro, or a simulator.

`test/iosSmokeContract.test.mjs` parses a prefixed `RNICK_IOS_SMOKE_PASS` log fixture with `webpOutputAvailable=true`, snapshots the payload key order and type schema for all WebP output byte fields plus `webpTargetSizeResultBytes`, and verifies missing conditional WebP fields are reported by `listMissingIOSSmokePassPayloadFields()`.

The fixture also pins `unsupportedOutputs: ['heic', 'heif', 'avif']`, proving the WebP-output available branch no longer reports `webp` as unsupported while HEIC, HEIF, and AVIF output remain unsupported.

### Included

- `package.json` version bump to `0.2.39`.
- Conditional WebP-output available PASS payload schema helpers in `scripts/ios-smoke-contract.mjs`.
- Exact `webpOutputAvailable=true` `RNICK_IOS_SMOKE_PASS` payload fixture expectations in `test/iosSmokeContract.test.mjs`.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.39 candidate state and the published v0.2.38 npm baseline.

### Not Included

- iOS native feature changes.
- WebP output forced on runtimes that do not advertise ImageIO WebP destination support.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.39`.
- Forced simulator capability changes.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the release candidate commit.

## v0.2.38

Status: published to npm as the `0.2.38` latest iOS smoke PASS payload schema snapshot release. No `v0.2.38` tag or GitHub Release is part of this package-page promotion.

This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while pinning the JSON payload schema emitted by successful `RNICK_IOS_SMOKE_PASS` host-app smoke logs.

### Goals

- Add simulator-free `RNICK_IOS_SMOKE_PASS` log line fixture parsing coverage.
- Snapshot the required PASS payload key order and type schema for platform, result byte, capability, target-size, and unsupported format fields.
- Cover missing or malformed PASS payload logs without forcing a real simulator failure.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.38 candidate.

### iOS Smoke PASS Payload Schema Snapshots

`scripts/ios-smoke-contract.mjs` now exposes `parseIOSSmokePassPayload()`, `IOS_SMOKE_PASS_PAYLOAD_REQUIRED_FIELDS`, `listMissingIOSSmokePassPayloadFields()`, and `formatIOSSmokePassPayloadSchema()` so the successful smoke marker can be tested without launching Xcode, Metro, or a simulator.

`test/iosSmokeContract.test.mjs` parses a prefixed `RNICK_IOS_SMOKE_PASS` log fixture and snapshots the payload shape for `platform`, JPEG/PNG/GIF/WebP/HEIC/HEIF/AVIF result byte fields, PNG-output result byte fields, `targetSizeResultBytes`, `webpOutputAvailable`, `avifInputAvailable`, `unsupportedInputs`, and `unsupportedOutputs`.

The fixture also verifies missing required fields, missing marker logs, missing JSON payloads, malformed JSON payloads, and non-object JSON payloads, so a green smoke run cannot silently drop or rename the key success fields.

### Included

- `package.json` version bump to `0.2.38`.
- PASS payload parser and schema helper coverage in `scripts/ios-smoke-contract.mjs`.
- Exact `RNICK_IOS_SMOKE_PASS` payload fixture expectations in `test/iosSmokeContract.test.mjs`.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.38 candidate state.

### Not Included

- iOS feature changes.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- Git tag or GitHub Release promotion for `v0.2.38`.
- Forced simulator smoke failures.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the release candidate commit.

## v0.2.37

Status: unpublished release candidate for iOS smoke diagnostics artifact schema snapshot coverage. npm `latest` remains `0.2.19`; no `v0.2.37` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while pinning the exact markdown schema that failed iOS smoke diagnostics artifacts expose in `ios-smoke-diagnostics/ios-smoke-summary.md` and the GitHub Step Summary.

### Goals

- Add exact `formatIOSSmokeDiagnosticsSummary()` markdown schema fixture expectations.
- Cover empty-log and no-marker fallback text for failed smoke summaries.
- Cover very-long-log marker and packed-tail window bounds without forcing a simulator failure.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.37 candidate.

### iOS Smoke Diagnostics Artifact Schema Snapshots

`test/iosSmokeContract.test.mjs` now snapshots the full `formatIOSSmokeDiagnosticsSummary()` markdown shape: `## iOS smoke diagnostics`, `### Key markers and diagnostics`, `### Packed log tail`, and the fenced `text` blocks used by GitHub summary rendering.

The empty-log fixture pins `(no RNICK_IOS_SMOKE markers or diagnostics lines captured)` and `(no iOS smoke log captured)` fallback text. The no-marker fixture pins the same marker fallback while preserving ordinary smoke command output in the packed log tail.

The very-long-log fixture pins marker and tail truncation independently, proving the marker section keeps the last diagnostic lines while the packed tail keeps the final raw log lines.

### Included

- `package.json` version bump to `0.2.37`.
- Exact markdown schema snapshot coverage for `formatIOSSmokeDiagnosticsSummary()`.
- Empty-log, no-marker, and very-long-log summary fixture expectations.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.37 candidate state.

### Not Included

- iOS feature changes.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.37`.
- Forced simulator smoke failures.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the release candidate commit.

## v0.2.36

Status: unpublished release candidate for iOS smoke artifact failure-path dry-run fixture coverage. npm `latest` remains `0.2.19`; no `v0.2.36` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while proving the iOS smoke diagnostics summary and artifact failure path with a local fake-log dry run instead of forcing a simulator failure.

### Goals

- Run `node scripts/ios-validation.mjs summarize-smoke-log` against a fake `ios-smoke.log` fixture.
- Verify the CLI writes the same packed diagnostics summary to stdout and `$GITHUB_STEP_SUMMARY`.
- Pin the iOS Validation workflow summary and upload artifact steps as failure-only `if: failure()` paths.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.36 candidate.

### iOS Smoke Artifact Failure-Path Dry Run Fixtures

`test/iosSmokeSummaryCli.test.mjs` runs `node scripts/ios-validation.mjs summarize-smoke-log` with a fake `ios-smoke.log`, sets `GITHUB_STEP_SUMMARY` to a temporary file, and asserts stdout exactly matches the summary file content.

The fixture log includes iOS smoke attempt, `RNICK_IOS_SMOKE_*`, timeout, diagnostics, retry guidance, and log stream error markers so the summary keeps key markers before the packed log tail without depending on Xcode, Metro, or a simulator.

`.github/workflows/ios-validation.yml` keeps the failure-only path explicit: it tees smoke output into `ios-smoke-diagnostics/ios-smoke.log`, summarizes that log into `ios-smoke-diagnostics/ios-smoke-summary.md`, and uploads the `ios-smoke-diagnostics` artifact only through `if: failure()` steps.

### Included

- `package.json` version bump to `0.2.36`.
- `test/iosSmokeSummaryCli.test.mjs` fake-log CLI fixture for `summarize-smoke-log` stdout and `$GITHUB_STEP_SUMMARY` parity.
- Failure-only iOS smoke summary/upload artifact path expectations in README, Android verification doctor checks, and Vitest coverage.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.36 candidate state.

### Not Included

- iOS feature changes.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.36`.
- Forced simulator smoke failures.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the release candidate commit.

## v0.2.35

Status: unpublished release candidate for iOS smoke diagnostics packed log artifact coverage. npm `latest` remains `0.2.19`; no `v0.2.35` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while making failed iOS smoke diagnostics easier to find in GitHub Actions through a packed `ios-smoke-diagnostics` artifact and a GitHub Step Summary excerpt generated from the same Node-level formatter.

### Goals

- Capture the full `pnpm example:ios:smoke` output into `ios-smoke-diagnostics/ios-smoke.log` on the iOS Validation workflow.
- Generate `ios-smoke-diagnostics/ios-smoke-summary.md` and append the same ordered excerpt to `$GITHUB_STEP_SUMMARY` after a failed iOS smoke step.
- Cover the summary formatter without launching Xcode, Metro, or a simulator.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.35 candidate.

### iOS Smoke Diagnostics Artifact Fixtures

`.github/workflows/ios-validation.yml` now tees the host-app smoke output into `ios-smoke-diagnostics/ios-smoke.log`, summarizes that log with `node scripts/ios-validation.mjs summarize-smoke-log`, and uploads the packed diagnostics directory with `actions/upload-artifact@v6` when the smoke step fails.

`formatIOSSmokeDiagnosticsSummary()` now owns the GitHub Step Summary shape. It keeps key `RNICK_IOS_SMOKE_*`, timeout, retry, failure, and log-stream-error lines before the packed log tail so the most useful markers remain visible even when the raw smoke log is long.

`test/iosSmokeContract.test.mjs` validates the packed diagnostics summary ordering and marker extraction with fake log text, including timeout diagnostics, `RNICK_IOS_SMOKE_STEP_START`, retry guidance, and log stream error lines.

### Included

- `package.json` version bump to `0.2.35`.
- `summarize-smoke-log` mode in `scripts/ios-validation.mjs` for reusable GitHub Step Summary generation.
- iOS Validation workflow failure artifact upload for `ios-smoke-diagnostics`.
- Node-level fixture coverage for diagnostics excerpt and packed log tail ordering.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.35 candidate state.

### Not Included

- iOS feature changes.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.35`.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation on the release candidate commit.

## v0.2.34

Status: unpublished release candidate for iOS smoke log stream error fixture coverage. npm `latest` remains `0.2.19`; no `v0.2.34` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while adding simulator-free fixture coverage for log stream `error` events flowing through output, lifecycle snapshot state, and timeout diagnostics used by `scripts/ios-validation.mjs smoke`.

### Goals

- Treat log process `error` events as smoke log output inside `createSmokeAttemptLifecycle()`.
- Cover fake EventEmitter log stream `error` output and snapshot state without launching Xcode, Metro, or a simulator.
- Verify timeout diagnostics receive the log stream error text through `createSmokeTimeoutErrorFromCLIState()`.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.34 candidate.

### iOS Smoke Log Stream Error Fixtures

`createSmokeAttemptLifecycle()` now records log process `error` events as `iOS smoke log stream error:` output and includes that text in `markerBuffer` and `smokeLogOutput` snapshot state.

`test/iosSmokeLifecycle.test.mjs` validates the log stream error path with a fake EventEmitter process. The test pins output writing, snapshot state, timeout diagnostic propagation through `createSmokeTimeoutErrorFromCLIState()`, and cleanup after timeout settle.

The runtime smoke still uses Xcode, Metro, simulator log streaming, and unified logs for end-to-end validation. The fixture coverage makes a broken log stream visible in timeout diagnostics instead of losing the process error outside the captured smoke-log state.

### Included

- `package.json` version bump to `0.2.34`.
- `createSmokeAttemptLifecycle()` log process `error` events now populate smoke-log snapshot state.
- `test/iosSmokeLifecycle.test.mjs` Node-level fixture coverage for log stream error output, snapshot state, and timeout diagnostics propagation.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.34 candidate state.

### Not Included

- iOS feature changes.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.34`.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation after push.

## v0.2.33

Status: unpublished release candidate for iOS smoke process lifecycle fixture coverage. npm `latest` remains `0.2.19`; no `v0.2.33` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while adding simulator-free fixture coverage for the log stream listener cleanup, log process termination, and log process reference clearing used by `scripts/ios-validation.mjs smoke`.

### Goals

- Split the `runSmokeAttempt` process lifecycle into `createSmokeAttemptLifecycle()` so Metro/log stream listeners and log process cleanup can be tested without launching Xcode, Metro, or a simulator.
- Cover PASS, FAIL, and timeout settle paths with fake EventEmitter Metro and log stream fixtures.
- Verify listener removal, log process stop, and `setLogProcess(null)` after each settle path.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.33 candidate.

### iOS Smoke Process Lifecycle Fixtures

`scripts/ios-validation.mjs` now delegates smoke marker observation, Metro/log stream listener lifecycle, log stream error handling, log process termination, and log process reference clearing to `createSmokeAttemptLifecycle()`.

`test/iosSmokeLifecycle.test.mjs` validates PASS, FAIL, and timeout settle paths with fake EventEmitter Metro/log stream fixtures. The tests pin listener counts for Metro stdout/stderr, log stream stdout/stderr, and log stream `error`, then assert cleanup stops the log process and clears `setLogProcess(null)` exactly once per settle path.

The runtime smoke still uses Xcode, Metro, simulator log streaming, and unified logs for end-to-end validation. The fixture coverage makes the process cleanup contract reviewable before the macOS runner reaches an actual simulator run or timeout.

### Included

- `package.json` version bump to `0.2.33`.
- `createSmokeAttemptLifecycle()` helper for iOS smoke marker observation and process lifecycle cleanup.
- `test/iosSmokeLifecycle.test.mjs` Node-level fixture coverage for PASS, FAIL, and timeout cleanup paths.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.33 candidate state.

### Not Included

- iOS feature changes.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.33`.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation after push.

## v0.2.32

Status: unpublished release candidate for iOS smoke timeout CLI fixture coverage. npm `latest` remains `0.2.19`; no `v0.2.32` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while adding simulator-free fixture coverage for the CLI timeout diagnostic assembly and retry warning order used by `scripts/ios-validation.mjs smoke`.

### Goals

- Split the `runSmokeAttempt` timeout diagnostic assembly into `createSmokeTimeoutErrorFromCLIState()` so app/container/process/log inputs can be tested without launching Xcode, Metro, or a simulator.
- Cover fake launch output, captured `RNICK_IOS_SMOKE_*` log stream output, Metro output, unified log output, app container lookup, and process lookup in Node-level Vitest fixtures.
- Cover the timeout retry warning order so the diagnostics block is printed before the retry guidance.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.32 candidate.

### iOS Smoke CLI Timeout Fixtures

`scripts/ios-validation.mjs` now delegates timeout diagnostic input assembly to `createSmokeTimeoutErrorFromCLIState()` and retry warning ordering to `formatSmokeRetryWarningMessages()`.

`test/iosSmokeCliTimeout.test.mjs` validates the CLI timeout path with fake simulator summary, app/data container lookups, process lookup, launch output, captured log stream output, Metro output, and unified log output. The test also pins diagnostics-before-retry warning order without forcing a real simulator timeout.

The runtime smoke still uses Xcode, Metro, simulator log streaming, and unified logs for end-to-end validation. The fixture coverage makes the timeout failure surface reviewable before the macOS runner reaches an actual timeout.

### Included

- `package.json` version bump to `0.2.32`.
- `createSmokeTimeoutErrorFromCLIState()` helper for CLI timeout diagnostic input assembly.
- `formatSmokeRetryWarningMessages()` helper for diagnostics-before-retry warning order.
- `test/iosSmokeCliTimeout.test.mjs` Node-level fixture coverage for CLI timeout diagnostics and retry warning ordering.
- README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.32 candidate state.

### Not Included

- iOS feature changes.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.32`.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation after push.

## v0.2.31

Status: unpublished release candidate for iOS smoke diagnostic testability hardening. npm `latest` remains `0.2.19`; no `v0.2.31` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while extracting the smoke retry, environment override, and timeout diagnostic formatting contract into simulator-free Node-level test coverage.

### Goals

- Extract the iOS smoke retry and timeout diagnostic contract into `scripts/ios-smoke-contract.mjs`.
- Cover `RNICK_IOS_SMOKE_ATTEMPTS`, `RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS`, and `RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW` defaults and overrides without launching Xcode, Metro, or a simulator.
- Cover timeout-only retry decisions so only `rnickSmokeTimeout` errors retry before the final attempt.
- Cover timeout diagnostic formatting for simulator state, app/data containers, app process lookup, launch output, captured `RNICK_IOS_SMOKE_*` stream tail, Metro output tail, and unified log tail.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.31 candidate.

### iOS Smoke Contract Testability

`scripts/ios-validation.mjs` now delegates environment parsing, retry decision checks, retry warning text, and timeout error formatting to `scripts/ios-smoke-contract.mjs`.

`test/iosSmokeContract.test.mjs` validates the iOS smoke contract without any simulator dependency. The tests pin default and overridden smoke env values, invalid override fallback behavior, timeout-only retry gating before the final attempt, and the diagnostics block shape.

The runtime smoke still uses Xcode, Metro, and simulator logs for end-to-end validation. The new Node-level tests make the failure-surface contract reviewable before the macOS runner reaches the host-app smoke.

### Included

- `package.json` version bump to `0.2.31`.
- `scripts/ios-smoke-contract.mjs` helper module for iOS smoke env parsing, retry gating, retry warnings, and timeout diagnostics.
- `test/iosSmokeContract.test.mjs` Node-level Vitest coverage for iOS smoke env overrides, timeout-only retry decisions, and timeout diagnostics.
- README, release notes, Android verification doctor expectations, and Vitest configuration updated for the v0.2.31 candidate state.

### Not Included

- iOS feature changes.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.31`.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation after push.

## v0.2.30

Status: unpublished release candidate for iOS smoke retry and diagnostic hardening. npm `latest` remains `0.2.19`; no `v0.2.30` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output or add iOS features. It keeps the iOS native behavior unchanged while making `scripts/ios-validation.mjs smoke` retry timeout-only `RNICK_IOS_SMOKE_PASS` misses and print simulator/app/process/log diagnostics before retrying or failing.

### Goals

- Retry timeout-only iOS smoke attempts with a fresh app launch through `RNICK_IOS_SMOKE_ATTEMPTS`.
- Warm the `RNICK_IOS_SMOKE_*` log stream before app launch through `RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS`.
- Print timeout diagnostics for simulator state, app/data containers, app process lookup, launch output, captured smoke stream tail, Metro output tail, and recent unified logs from `RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW`.
- Update README, release notes, Android verification doctor checks, and Vitest expectations for the Xcode 26.5 / iPhoneSimulator26.5 runner environment.
- Keep AVIF output disabled and keep npm publish, git tag, and GitHub Release outside this candidate.

### iOS Smoke Retry And Diagnostics

The iOS smoke runner now treats a missing `RNICK_IOS_SMOKE_PASS` marker as a timeout-only attempt when no `RNICK_IOS_SMOKE_FAIL` marker is captured. It terminates the app and retries with a new log stream and app launch until `RNICK_IOS_SMOKE_ATTEMPTS` is exhausted.

Each attempt starts the unified log stream before launch, waits `RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS`, then launches `com.imagecompressionkit.example` with `SIMCTL_CHILD_RNICK_IOS_SMOKE=1`.

On timeout, the script prints an `iOS smoke diagnostics:` block with simulator state, app and data container lookup, process lookup, launch output, captured `RNICK_IOS_SMOKE_*` stream tail, Metro output tail, and recent unified logs from `RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW`.

### Included

- `package.json` version bump to `0.2.30`.
- iOS smoke timeout-only retry support.
- iOS smoke timeout diagnostics for simulator, app, process, launch, Metro, and unified log state.
- README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.30 candidate state and Xcode 26.5 runner environment.

### Not Included

- iOS feature changes.
- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- npm publish, git tag, or GitHub Release promotion for `v0.2.30`.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation after push.

## v0.2.29

Status: unpublished release candidate for the Android AVIF output helper validation-result provenance contract. npm `latest` remains `0.2.19`; no `v0.2.29` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output. It keeps the Android `compressImage()` AVIF output scaffold on `ERR_NOT_IMPLEMENTED` before helper entry while pinning whether helper validation details came from the direct file or the muxed file inside `AndroidAvifOutputHelper`.

### Goals

- Add direct validation detail expectations proving direct file name, byte size, signature result, and decode-back result stay attached to the direct validation file.
- Add muxed validation detail expectations proving muxed file name, byte size, signature result, and decode-back result stay attached to the muxed validation file.
- Add direct-failure plus muxed-success/failure expectations proving `details` preserve encoder, direct validation, muxer, final validation order with file provenance.
- Keep `output.format: 'avif'` on the documented `ERR_NOT_IMPLEMENTED` path before source access or helper entry.
- Keep Android capability reporting on `formats.avif.output=false`.
- Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.29 candidate.

### Validation Provenance Contract

The default Android AVIF file validator now records one provenance summary per validation file with the file name, byte size, signature result, decode-back result, and decoded dimensions when available. ImageDecoder failure details remain attached after that summary.

Android JVM helper tests now assert direct validation success keeps the direct file name, direct byte size, signature result, and decode-back result in the direct validation detail, while still skipping the muxer.

Android JVM helper tests now assert direct validation failure followed by muxed success or muxed failure keeps `details` ordered as encoder, direct validation, muxer, and final validation, with the final validation detail naming the muxed file and its byte size, signature result, and decode-back result.

The contract keeps helper diagnostics stable before production wiring without changing `compressImage()` behavior, capability reporting, or AVIF output support.

### Included

- `package.json` version bump to `0.2.29`.
- Android AVIF output helper direct validation provenance JVM coverage.
- Android AVIF output helper muxed validation provenance JVM coverage.
- Android AVIF output helper direct-failure detail ordering JVM coverage.
- Default Android AVIF file validator detail summary now includes file name, byte size, signature result, decode-back result, and decoded dimensions.
- README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.29 candidate state.

### Not Included

- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- iOS AVIF output implementation.
- Metadata-preserving AVIF output.
- Target-size AVIF output.
- Animated AVIF preservation.
- npm publish, git tag, or GitHub Release promotion for `v0.2.29`.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation after push.

## v0.2.28

Status: unpublished release candidate for the Android AVIF output helper temp-file lifecycle contract. npm `latest` remains `0.2.19`; no `v0.2.28` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output. It keeps the Android `compressImage()` AVIF output scaffold on `ERR_NOT_IMPLEMENTED` before helper entry while pinning direct and muxed validation temp-file creation, returned `outputFilePath`, and intermediate-file non-reporting behavior inside `AndroidAvifOutputHelper`.

### Goals

- Add direct-success expectations proving only the direct validation file is created, no muxed file is created, and `outputFilePath`/`byteSize` come from the direct file.
- Add direct-failure plus muxed-success expectations proving the returned `outputFilePath`/`byteSize` come from the muxed file and the direct intermediate file is not reported as the result.
- Add invalid-signature and decode-back failure expectations proving the final blocker result reports the final muxed validation path and final-file `byteSize`.
- Keep `output.format: 'avif'` on the documented `ERR_NOT_IMPLEMENTED` path before source access or helper entry.
- Keep Android capability reporting on `formats.avif.output=false`.
- Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.28 candidate.

### Temp-File Lifecycle Contract

Android JVM helper tests now assert direct validation success creates and returns the direct `.avif` file, skips mux file creation, and derives `byteSize` from the returned direct file.

Android JVM helper tests now assert direct validation failure followed by muxed success creates both direct and muxed files, but returns only the muxed file path and muxed file byte size; the direct intermediate file remains an internal validation artifact and is not reported as the result.

Invalid-signature and decode-back failure tests now assert the final blocker result reports the final muxed validation file path, does not report the direct intermediate file, and derives `byteSize` from that final muxed file.

The contract keeps cache-file result reporting stable before production wiring without changing `compressImage()` behavior, capability reporting, or AVIF output support.

### Included

- `package.json` version bump to `0.2.28`.
- Android AVIF output helper direct success temp-file lifecycle JVM coverage.
- Android AVIF output helper muxed success final-result path JVM coverage.
- Android AVIF output helper invalid-signature and decode-back final blocker path JVM coverage.
- README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.28 candidate state.

### Not Included

- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- iOS AVIF output implementation.
- Metadata-preserving AVIF output.
- Target-size AVIF output.
- Animated AVIF preservation.
- npm publish, git tag, or GitHub Release promotion for `v0.2.28`.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation after push.

## v0.2.27

Status: unpublished release candidate for the Android AVIF output helper blocked-route detail contract. npm `latest` remains `0.2.19`; no `v0.2.27` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output. It keeps the Android `compressImage()` AVIF output scaffold on `ERR_NOT_IMPLEMENTED` before helper entry while pinning blocked helper details for `sdk_unavailable` and `no_image_avif_encoder` paths, and proving the smoke adapter preserves those blocked helper details with `outputCanBeEnabled=false`.

### Goals

- Add exact detail-order expectations for below-API-34 and no-image/avif-encoder blocked helper paths.
- Fix blocked helper details around route blockers, `INJECTABLE_VALIDATION_SEAM`, and `HELPER_DISABLED_FROM_COMPRESS_IMAGE`.
- Add smoke adapter expectations proving `runEncodeDecodeBackSmoke()` preserves blocked `blockerCode`, `details`, and `outputCanBeEnabled=false`.
- Keep `output.format: 'avif'` on the documented `ERR_NOT_IMPLEMENTED` path before source access or helper entry.
- Keep Android capability reporting on `formats.avif.output=false`.
- Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.27 candidate.

### Blocked Route Detail Contract

Android JVM helper tests now assert exact `details` arrays for both below-API-34 and no-image/avif-encoder blocked paths. The blocked result order is route blockers first, then `INJECTABLE_VALIDATION_SEAM`, then `HELPER_DISABLED_FROM_COMPRESS_IMAGE`.

Android JVM smoke tests now build the matching `AndroidAvifOutputPrototype.inspectRoute()` report and assert `runEncodeDecodeBackSmoke()` preserves the route blockers, helper seam, helper-disabled message, stable `blockerCode`, and `outputCanBeEnabled=false` in the adapted `AndroidAvifEncodeDecodeSmokeResult`.

The contract keeps disabled-route diagnostics stable before production wiring without changing `compressImage()` behavior, capability reporting, or AVIF output support.

### Included

- `package.json` version bump to `0.2.27`.
- Android AVIF output helper blocked-route detail-order JVM coverage.
- Android AVIF output smoke adapter blocked-result preservation JVM coverage.
- README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.27 candidate state.

### Not Included

- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- iOS AVIF output implementation.
- Metadata-preserving AVIF output.
- Target-size AVIF output.
- Animated AVIF preservation.
- npm publish, git tag, or GitHub Release promotion for `v0.2.27`.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation after push.

## v0.2.26

Status: unpublished release candidate for the Android AVIF output helper validation detail contract. npm `latest` remains `0.2.19`; no `v0.2.26` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output. It keeps the Android `compressImage()` AVIF output scaffold on `ERR_NOT_IMPLEMENTED` before helper entry while pinning `AndroidAvifOutputHelper` result `details` order for direct success, muxed success, invalid signature, decode-back failure, and codec failure paths.

### Goals

- Add Android JVM expectations for direct success, muxed success, invalid signature, decode-back failure, and codec failure `details` ordering.
- Fix validation-result detail order around `INJECTABLE_VALIDATION_SEAM`, dependency-provided encoder/direct/muxer/validator details, and trailing route blockers.
- Fix codec-failure detail order around route blockers, `INJECTABLE_VALIDATION_SEAM`, and `HELPER_DISABLED_FROM_COMPRESS_IMAGE`.
- Keep `output.format: 'avif'` on the documented `ERR_NOT_IMPLEMENTED` path before source access or helper entry.
- Keep Android capability reporting on `formats.avif.output=false`.
- Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.26 candidate.

### Validation Detail Contract

Android JVM tests now assert exact helper `details` arrays for the injected direct success, muxed success, invalid-signature, decode-back-failure, and codec-failure paths.

Validation results report details in this order: `INJECTABLE_VALIDATION_SEAM`, dependency-provided encoder/direct-validator/muxer/final-validator details, then the route blockers from `AndroidAvifOutputPrototype.inspectRoute()`. Codec failure results report route blockers first, then `INJECTABLE_VALIDATION_SEAM`, then `HELPER_DISABLED_FROM_COMPRESS_IMAGE`.

The contract keeps diagnostics stable for production wiring without changing `compressImage()` behavior, capability reporting, or the disabled AVIF output gate.

### Included

- `package.json` version bump to `0.2.26`.
- Android AVIF output helper validation-detail-order JVM coverage.
- README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.26 candidate state.

### Not Included

- AVIF output enablement.
- Actual AVIF file returns from `compressImage()`.
- iOS AVIF output implementation.
- Metadata-preserving AVIF output.
- Target-size AVIF output.
- Animated AVIF preservation.
- npm publish, git tag, or GitHub Release promotion for `v0.2.26`.

### Validation

- `pnpm verify`
- `pnpm example:typecheck`
- `git diff --check`
- `pnpm pack --dry-run`
- `pnpm release:dry-run`
- GitHub Actions CI, Android Instrumentation, and iOS Validation after push.

## v0.2.25

Status: unpublished release candidate for the Android AVIF output helper direct-output success contract. npm `latest` remains `0.2.19`; no `v0.2.25` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output. It keeps the Android `compressImage()` AVIF output scaffold on `ERR_NOT_IMPLEMENTED` before helper entry while adding an injected direct-output success path so the helper returns the direct encoder output result and skips muxing when direct bytes pass AVIF file validation.

### Goals

- Keep Android and iOS AVIF output disabled.
- Add fake valid direct AVIF bytes and decode-back success coverage to `AndroidAvifOutputHelper`.
- Fix direct success expectations for route, output file path, `byteSize`, `blockerCode`, `blocker`, and `productionDecision`.
- Prove `muxEncodedSamples` is not called after direct output validation succeeds.
- Keep `output.format: 'avif'` on the documented `ERR_NOT_IMPLEMENTED` path before source access or helper entry.
- Keep Android capability reporting on `formats.avif.output=false`.
- Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.25 candidate.

### Direct Output Success Contract

- Android JVM tests now inject direct fake AVIF bytes that pass signature checks and decode-back dimensions that match the helper input.
- Direct helper validation reports the `MediaCodec image/avif encode/decode-back smoke direct encoder output` route, a direct `.avif` output path, `success=true`, `byteSize` from the direct fake AVIF file, `blockerCode=null`, and `blocker=null`.
- The injected `muxEncodedSamples` dependency fails the test if called, proving the helper does not mux after direct validation success.
- A passed direct helper smoke still reports `PRODUCTION_DECISION_SMOKE_PASSED_KEEP_DISABLED` because production wiring, metadata preserve, `output.maxBytes`, and animated AVIF boundaries are not implemented.

### Included

- `package.json` version bump to `0.2.25`.
- Android AVIF output helper injected direct-success-path JVM coverage.
- README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.25 candidate state.

### Not Included

- Production AVIF output encoding enablement.
- Android AVIF output capability enablement.
- Actual AVIF file return from `compressImage()`.
- iOS AVIF output implementation.
- Metadata preservation for AVIF output.
- Target-size AVIF output.
- Animated AVIF preservation.
- npm publish, git tag, or GitHub Release promotion for `v0.2.25`.

### Validation

Before considering the candidate ready:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
```

Remote validation also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed candidate commit. The Android Instrumentation `RNICK_AVIF_OUTPUT_SMOKE` log must keep AVIF output disabled and expose the relevant blocker code unless a later non-candidate implementation explicitly enables AVIF output.

After validation, keep this candidate unpublished until a separate publish goal.

## v0.2.24

Status: unpublished release candidate for the Android AVIF output helper injected success contract. npm `latest` remains `0.2.19`; no `v0.2.24` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output. It keeps the Android `compressImage()` AVIF output scaffold on `ERR_NOT_IMPLEMENTED` before helper entry while adding an injected muxed success path so the helper's passed-smoke result contract is fixed before production wiring.

### Goals

- Keep Android and iOS AVIF output disabled.
- Add fake valid AVIF bytes, muxed output file, and decode-back success coverage to `AndroidAvifOutputHelper`.
- Fix helper success expectations for `byteSize`, `signatureValid`, `decodeBackValid`, `blockerCode`, `blocker`, and `productionDecision`.
- Keep `output.format: 'avif'` on the documented `ERR_NOT_IMPLEMENTED` path before source access or helper entry.
- Keep Android capability reporting on `formats.avif.output=false`.
- Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.24 candidate.

### Injected Success Contract

- Android JVM tests now inject direct bytes that fail validation, muxed fake AVIF bytes that pass signature checks, and decode-back dimensions that match the helper input.
- Successful helper validation reports `success=true`, `byteSize` from the muxed fake AVIF file, `signatureValid=true`, `decodeBackValid=true`, `blockerCode=null`, and `blocker=null`.
- A passed helper smoke still reports `PRODUCTION_DECISION_SMOKE_PASSED_KEEP_DISABLED` because production wiring, metadata preserve, `output.maxBytes`, and animated AVIF boundaries are not implemented.
- `AndroidAvifOutputHelper.INJECTABLE_VALIDATION_SEAM` now describes fake success and failure coverage; `compressImage()` and capability reporting still keep AVIF output disabled.

### Included

- `package.json` version bump to `0.2.24`.
- Android AVIF output helper injected success-path JVM coverage.
- README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.24 candidate state.

### Not Included

- Production AVIF output encoding enablement.
- Android AVIF output capability enablement.
- Actual AVIF file return from `compressImage()`.
- iOS AVIF output implementation.
- Metadata preservation for AVIF output.
- Target-size AVIF output.
- Animated AVIF preservation.
- npm publish, git tag, or GitHub Release promotion for `v0.2.24`.

### Validation

Before considering the candidate ready:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
```

Remote validation also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed candidate commit. The Android Instrumentation `RNICK_AVIF_OUTPUT_SMOKE` log must keep AVIF output disabled and expose the relevant blocker code unless a later non-candidate implementation explicitly enables AVIF output.

After validation, keep this candidate unpublished until a separate publish goal.

## v0.2.23

Status: unpublished release candidate for the Android AVIF output helper injectable validation seam. npm `latest` remains `0.2.19`; no `v0.2.23` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output. It keeps the Android `compressImage()` AVIF output scaffold on `ERR_NOT_IMPLEMENTED` before helper entry while adding an injectable helper dependency seam so fake encoded bytes, invalid signatures, decode-back failures, and codec failures can be covered before production wiring.

### Goals

- Keep Android and iOS AVIF output disabled.
- Add injectable encoder, muxer, output-file, and decode-back validation dependencies to `AndroidAvifOutputHelper`.
- Cover fake encoded bytes, invalid signature, decode-back failure, and codec failure result paths in Android JVM tests.
- Keep `output.format: 'avif'` on the documented `ERR_NOT_IMPLEMENTED` path before source access or helper entry.
- Keep Android capability reporting on `formats.avif.output=false`.
- Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.23 candidate.

### Injectable Validation Seam

- `AndroidAvifOutputHelperDependencies` wraps the default bitmap creation, MediaCodec encode, output-file creation, MediaMuxer mux, and ImageDecoder validation path.
- `AndroidAvifOutputHelper.runEncodeDecodeBack()` accepts injected dependencies while preserving the default production helper route for instrumentation.
- Android JVM tests now inject fake encoder bytes, fake muxed bytes, fake validation results, and injected encoder failures to prove blocker classification without requiring a real `image/avif` encoder.
- `AndroidAvifOutputHelper.INJECTABLE_VALIDATION_SEAM` records that the seam is internal validation coverage only; `compressImage()` and capability reporting still keep AVIF output disabled.

### Included

- `package.json` version bump to `0.2.23`.
- Android AVIF output helper dependency seam for encoder, muxer, output file, and decode-back validation injection.
- Android JVM tests for fake encoded bytes, invalid signature, decode-back failure, codec failure, scaffold helper-entry blocking, and capability notes.
- README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.23 candidate state.

### Not Included

- Production AVIF output encoding enablement.
- Android AVIF output capability enablement.
- Actual AVIF file return from `compressImage()`.
- iOS AVIF output implementation.
- Metadata preservation for AVIF output.
- Target-size AVIF output.
- Animated AVIF preservation.
- npm publish, git tag, or GitHub Release promotion for `v0.2.23`.

### Validation

Before considering the candidate ready:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
```

Remote validation also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed candidate commit. The Android Instrumentation `RNICK_AVIF_OUTPUT_SMOKE` log must keep AVIF output disabled and expose the relevant blocker code unless a later non-candidate implementation explicitly enables AVIF output.

After validation, keep this candidate unpublished until a separate publish goal.

## v0.2.22

Status: unpublished release candidate for the Android AVIF output production helper extraction. npm `latest` remains `0.2.19`; no `v0.2.22` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output. It extracts the Android AVIF encode/decode-back implementation from the prototype object into `AndroidAvifOutputHelper`, so future production wiring can reuse explicit helper input, output, sample, file-validation, and result types while `compressImage()` continues to reject before helper entry.

### Goals

- Keep Android and iOS AVIF output disabled.
- Extract the Android AVIF encode/decode-back helper from the prototype-only structure into reusable internal helper types.
- Keep `output.format: 'avif'` on the documented `ERR_NOT_IMPLEMENTED` path before source access or helper entry.
- Keep Android capability reporting on `formats.avif.output=false`.
- Cover helper input, result, blocker, and failure boundaries in Android JVM tests.
- Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.22 candidate.

### Production Helper Extraction

- `AndroidAvifOutputHelper` owns the MediaCodec image/avif encode/decode-back helper implementation.
- `AndroidAvifOutputHelperInput`, `AndroidAvifOutputHelperOutput`, `AndroidAvifOutputHelperSample`, `AndroidAvifOutputHelperFileValidation`, and `AndroidAvifOutputHelperResult` make the helper boundary explicit.
- `AndroidAvifOutputPrototype.runEncodeDecodeBackSmoke()` now delegates to the helper and adapts the helper result back to the existing smoke result shape for instrumentation logs.
- `AndroidAvifOutputProductionScaffold.reusableHelperRoute` points at the extracted production helper route, but `willEnterEncodeDecodeBackHelper=false` while `avif.output=false`.
- Android `compressImage()` still rejects AVIF output with the scaffold-specific `ERR_NOT_IMPLEMENTED` message before source access or helper entry.

### Included

- `package.json` version bump to `0.2.22`.
- Android AVIF output helper extraction into a reusable internal helper file.
- Android JVM tests for helper input construction, SDK/encoder blockers, validation blocker classification, codec failure messaging, scaffold helper-entry blocking, and capability notes.
- README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.22 candidate state.

### Not Included

- Production AVIF output encoding enablement.
- Android AVIF output capability enablement.
- Actual AVIF file return from `compressImage()`.
- iOS AVIF output implementation.
- Metadata preservation for AVIF output.
- Target-size AVIF output.
- Animated AVIF preservation.
- npm publish, git tag, or GitHub Release promotion for `v0.2.22`.

### Validation

Before considering the candidate ready:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
```

Remote validation also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed candidate commit. The Android Instrumentation `RNICK_AVIF_OUTPUT_SMOKE` log must keep AVIF output disabled and expose the relevant blocker code unless a later non-candidate implementation explicitly enables AVIF output.

After validation, keep this candidate unpublished until a separate publish goal.

## v0.2.21

Status: unpublished release candidate for the Android AVIF output production wiring scaffold. npm `latest` remains `0.2.19`; no `v0.2.21` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output. It moves Android AVIF output handling closer to the production `compressImage()` boundary by routing `output.format: 'avif'` through a production wiring scaffold that rejects before source access or MediaCodec encode/decode-back helper entry while `avif.output=false`.

### Goals

- Keep Android and iOS AVIF output disabled.
- Add an Android AVIF output production wiring scaffold that can reuse the encode/decode-back helper route later.
- Keep `output.format: 'avif'` on the documented `ERR_NOT_IMPLEMENTED` path.
- Block metadata `preserve`, `output.maxBytes`, and animated AVIF preservation before Android AVIF output helper entry.
- Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.21 candidate.

### Production Wiring Scaffold

- `AndroidAvifOutputProductionScaffold` reports the scaffold route, reusable helper route, output-enabled decision, helper-entry decision, unsupported message, boundary blockers, and validation plan.
- Android `compressImage()` recognizes `output.format: 'avif'`, parses metadata and `output.maxBytes`, and then rejects with `ERR_NOT_IMPLEMENTED` before source access.
- `willEnterEncodeDecodeBackHelper` remains `false` while `avif.output=false`.
- Android capability reporting remains `formats.avif.output=false`.

### Included

- `package.json` version bump to `0.2.21`.
- Android AVIF production wiring scaffold and helper-entry blockers for metadata `preserve`, `output.maxBytes`, and animated AVIF preservation.
- Android module AVIF output rejection path that uses the scaffold-specific `ERR_NOT_IMPLEMENTED` message before source access.
- Android JVM tests covering the scaffold, AVIF output rejection, and capability note boundary.
- README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.21 candidate state.

### Not Included

- Production AVIF output encoding.
- Android AVIF output capability enablement.
- Actual AVIF file return from `compressImage()`.
- iOS AVIF output implementation.
- Metadata preservation for AVIF output.
- Target-size AVIF output.
- Animated AVIF preservation.
- npm publish, git tag, or GitHub Release promotion for `v0.2.21`.

### Validation

Before considering the candidate ready:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
```

Remote validation also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed candidate commit. The Android Instrumentation `RNICK_AVIF_OUTPUT_SMOKE` log must keep AVIF output disabled and expose the relevant blocker code unless a later non-candidate implementation explicitly enables AVIF output.

After validation, keep this candidate unpublished until a separate publish goal.

## v0.2.20

Status: unpublished release candidate for the AVIF output production wiring preflight. npm `latest` remains `0.2.19`; no `v0.2.20` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output. It keeps Android and iOS capability reporting on `output=false` while making the Android `RNICK_AVIF_OUTPUT_SMOKE` result production-decision ready with explicit blocker codes and an `outputCanBeEnabled=false` decision.

### Goals

- Keep Android and iOS AVIF output disabled.
- Make Android encode/decode-back smoke results carry stable blocker codes for missing `image/avif` encoder, codec failure, invalid `ftyp` signature, and `ImageDecoder` decode-back failure.
- Keep `output.format: 'avif'` on the documented `ERR_NOT_IMPLEMENTED` path with metadata preserve, `output.maxBytes`, and animated AVIF boundaries.
- Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.20 candidate.

### Production Decision Preflight

- `AndroidAvifEncodeDecodeSmokeResult` reports `blockerCode`, `outputCanBeEnabled`, and `productionDecision`.
- The candidate blocker codes are `sdk_unavailable`, `no_image_avif_encoder`, `codec_failure`, `invalid_signature`, and `decode_back_failure`.
- `outputCanBeEnabled` remains `false` even if a file-validation smoke passes, because production wiring, metadata preserve, `output.maxBytes`, and animated AVIF boundaries are still not implemented.
- Android capability reporting remains `formats.avif.output=false`.

### Included

- `package.json` version bump to `0.2.20`.
- Android AVIF output smoke blocker classification for SDK unavailable, missing `image/avif` encoder, codec failure, invalid signature, and decode-back failure.
- Android AVIF output smoke production decision fields that keep AVIF output disabled before production wiring.
- Android instrumentation expectation that `RNICK_AVIF_OUTPUT_SMOKE` keeps `outputCanBeEnabled=false` and reports a stable blocker code when the smoke fails.
- README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.20 candidate state.

### Not Included

- Production AVIF output encoding.
- Android `compressImage()` AVIF output wiring.
- iOS AVIF output implementation.
- AVIF output capability enablement.
- Metadata preservation for AVIF output.
- Target-size AVIF output.
- Animated AVIF preservation.
- npm publish, git tag, or GitHub Release promotion for `v0.2.20`.

### Validation

Before considering the candidate ready:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
```

Remote validation also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed candidate commit. The Android Instrumentation `RNICK_AVIF_OUTPUT_SMOKE` log must keep AVIF output disabled and expose the relevant blocker code unless a later non-candidate implementation explicitly enables AVIF output.

After validation, keep this candidate unpublished until a separate publish goal.

## v0.2.19

Status: published to npm as the `0.2.19` latest AVIF output production gate release. No `v0.2.19` tag or GitHub Release is part of this package-page promotion.

This release does not enable AVIF output. It tightens the public and test-covered explanation for why AVIF output remains disabled after the v0.2.17 Android `MediaCodec image/avif` encode/decode-back smoke blocker, and how future iOS AVIF output must stay runtime-gated by ImageIO destination support.

### Goals

- Keep AVIF output capability reporting unchanged while making the production gate explicit.
- Align the Android AVIF smoke blocker language with the runtime capability notes and unsupported-output error message.
- Align iOS AVIF capability notes and `output.format: 'avif'` unsupported-output errors with the current ImageIO runtime-gated destination policy.
- State that `metadata: 'preserve'`, `output.maxBytes`, and animated AVIF preservation remain unsupported for AVIF output until explicitly designed and tested.
- Publish a package-page release whose packed README does not carry stale `v0.2.19 candidate` wording.
- Keep README, release notes, release dry-run checks, Android verification doctor checks, and Vitest expectations current for the v0.2.19 package release.

### Capability Reporting Decision

- Android AVIF input remains API 34+ and AVIF output remains `output=false`.
- Android AVIF output remains disabled until the `MediaCodec image/avif` encode/decode-back smoke produces a complete AVIF file with `ftyp` `avif` / `avis` signature bytes and `ImageDecoder` decode-back validation.
- iOS AVIF input remains gated by `CGImageSourceCopyTypeIdentifiers()`, and AVIF output remains `output=false`.
- Future iOS AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation.
- `metadata='preserve'`, `output.maxBytes`, and animated AVIF preservation remain unsupported for AVIF output until explicitly designed and tested.

### Included

- `package.json` version bump to `0.2.19`.
- Android `AndroidAvifOutputPrototype` production gate message now names production wiring, byte-signature validation, `ImageDecoder` decode-back validation, metadata preserve, `output.maxBytes`, and animated AVIF boundaries.
- Android AVIF capability notes now describe the `MediaCodec image/avif` encode/decode-back gate and the metadata, target-size, and animation unsupported boundaries.
- Android HEIC/HEIF/AVIF unsupported-output error message now explains that AVIF output remains disabled until the smoke produces a complete AVIF file and the remaining AVIF output boundaries are validated.
- iOS AVIF capability notes now state that future AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation.
- iOS AVIF unsupported-output error message now calls out metadata preserve, `output.maxBytes`, and animated AVIF preservation as unsupported AVIF output boundaries.
- TypeScript native-unavailable guidance now includes the AVIF output production gate boundary.
- README, release dry-run stale README snippets, Android verification doctor expectations, and Vitest expectations updated for the v0.2.19 published package state.
- npm package publication under the `latest` dist-tag.

### Not Included

- Production AVIF output encoding.
- Android encoder production wiring.
- iOS AVIF output implementation.
- AVIF output capability enablement.
- Metadata preservation for AVIF output.
- Target-size AVIF output.
- Animated AVIF preservation.
- Git tag or GitHub Release promotion for `v0.2.19`.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
```

Release promotion also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed release commit. The Android Instrumentation `RNICK_AVIF_OUTPUT_SMOKE` log must keep AVIF output disabled and carry the known encoder-discovery blocker unless a later implementation explicitly enables AVIF output.

After npm publish:

```bash
npm publish --tag latest
npm view react-native-image-compression-kit version dist-tags.latest time.modified --json
pnpm smoke:registry -- --version 0.2.19
```

### Pre-Publish Remote Verification

- Release preparation commit `fb45336a875422620d5a64413ee3300bbb0aa9f0` passed GitHub Actions CI: `https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28700528814`.
- Android Instrumentation passed: `https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28700528804`.
- iOS Validation passed: `https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28700528803`.
- Android `RNICK_AVIF_OUTPUT_SMOKE` reported `attempted=false`, `success=false`, and blocker `No image/avif encoder was discovered through MediaCodecList.findEncoderForFormat().`, keeping AVIF output disabled.
- iOS smoke reported `RNICK_IOS_SMOKE_PASS` with `unsupportedOutputs` containing `webp`, `heic`, `heif`, and `avif`, matching the runtime-gated output policy.

### Post-Publish Registry Verification

- `npm view react-native-image-compression-kit version dist-tags.latest time.modified --json` confirmed package version `0.2.19`, `latest: 0.2.19`, and registry modified time `2026-07-04T08:41:31.627Z`.
- `npm view react-native-image-compression-kit@0.2.19 version dist.tarball dist.integrity dist.shasum time.modified --json` confirmed tarball `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.19.tgz`, integrity `sha512-QI0XvKLtq9bi4QAnAq7BP8I8pq2X6wZ7Zp8O29Z7UUkoGqNp6nS0TDy2OYjblyp87vvVh7Z2RaDi09IV5WigZA==`, shasum `f2691b8fde440c8ab20fec01dbadd18ba928839a`, and publish timestamp `2026-07-04T08:41:31.627Z`.
- Published tarball README inspection confirmed `Status: v0.2.19 published`, `npm latest points to 0.2.19`, `Version 0.2.19 is a package-only npm release`, and `The 0.2.19 package metadata is published as the AVIF output production gate release`.
- Published tarball README stale-candidate scan found no `v0.2.19 candidate`, unpublished AVIF output production gate candidate, `npm latest remains 0.2.18`, or unpublished `0.2.19` package-page snippets.
- `pnpm smoke:registry -- --version 0.2.19` passed against the real registry tarball with `fileCount: 50`, `packageSize: 55677`, `unpackedSize: 246114`, and a clean consumer `tsc --noEmit`.

## v0.2.18

Status: published to npm as the `0.2.18` latest docs-only README correction. No `v0.2.18` tag or GitHub Release is part of this package-page correction.

This release corrects the README that is shown on the npm package page after the `0.2.17` tarball shipped pre-publish candidate status text. It keeps Android and iOS runtime behavior unchanged while publishing a new package version whose packaged README reports `0.2.18` as the current docs-only correction.

### Goals

- Publish a docs-only package version so the npm package page reflects the corrected `0.2.18` release state.
- Remove stale `0.2.17` pre-publish package-page status wording from the packaged README.
- Keep Android runtime behavior, iOS runtime behavior, and the public TypeScript API unchanged.
- Verify the `0.2.17` registry tarball README before preparation and the `0.2.18` registry tarball README after publish.
- Keep the release dry-run packed README stale-status check and post-publish registry smoke flow in place.

### Included

- `package.json` version bump to `0.2.18`.
- README status, installation, release guidance, and registry smoke examples updated for the published docs-only npm README correction.
- README copy now describes `0.2.18` as a docs-only README correction release while preserving the `0.2.17` runtime behavior surface.
- Source-level tests and Android verification doctor expectations are updated for the `0.2.18` published docs-only status.
- Release dry-run packed README stale checks now reject the stale `0.2.17` pre-publish candidate snippets that shipped in the published `0.2.17` tarball and the stale `0.2.18` candidate snippets from the pre-publish correction commit.
- npm `latest` publish and post-publish registry smoke are part of this publish gate.

### Not Included

- Android or iOS runtime behavior changes.
- Native code changes.
- New public TypeScript API surface.
- AVIF output, animated AVIF preservation, HEIC/HEIF output, iOS metadata preservation, cancellation, or progress support.
- Git tag or GitHub Release promotion for `v0.2.18`.

### v0.2.17 Registry README Inspection

Before preparing this patch, the published `0.2.17` registry tarball README was checked explicitly:

```bash
tmpdir=$(mktemp -d)
npm pack react-native-image-compression-kit@0.2.17 --pack-destination "$tmpdir"
tar -xOf "$tmpdir"/react-native-image-compression-kit-0.2.17.tgz package/README.md | rg -n 'Status: v0\.2\.17 candidate|Version `0\.2\.17` is an unpublished release candidate|latest published npm package is `0\.2\.14`|GitHub Release \[v0\.2\.14\]|v0\.2\.17 Android AVIF output encode/decode-back smoke candidate notes'
rm -rf "$tmpdir"
```

The inspection found `Status: v0.2.17 candidate`, `Version 0.2.17 is an unpublished release candidate`, the "latest published npm package is 0.2.14" wording, `GitHub Release [v0.2.14]`, the unpublished `0.2.17` package metadata sentence, and `v0.2.17 Android AVIF output encode/decode-back smoke candidate notes` in the published `0.2.17` README.

### Validation

Before publishing and after the publish gate:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
npm publish --tag latest
npm view react-native-image-compression-kit version dist-tags.latest
pnpm smoke:registry -- --version 0.2.18
```

After publishing, `pnpm smoke:registry -- --version 0.2.18` validates the real registry tarball and confirms the package-page README no longer contains the stale `0.2.17` candidate wording.

### Post-Publish Registry Verification

- `npm view react-native-image-compression-kit version dist-tags.latest time.modified --json` confirmed package version `0.2.18`, `latest: 0.2.18`, and registry modified time `2026-07-04T07:09:19.302Z`.
- `npm view react-native-image-compression-kit@0.2.18 version dist.tarball dist.integrity dist.shasum time.modified --json` confirmed tarball `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.18.tgz`.
- Registry tarball integrity: `sha512-fpM8aqOij9qXN3gk05b6wbGRCcvB16XnqxGoXOSI6+W67pSzCIWfKj4+URZCU+DSkNyKLehO1XvGj+RkrqOYVw==`; shasum: `72c7cbf845d436c936de8bbcc3844bc330416549`.
- Published tarball README inspection confirmed `Status: v0.2.18 published`, `npm latest points to 0.2.18`, and `version 0.2.18 is the published docs-only npm package-page README correction release`.
- Published tarball README stale-candidate scan found no `v0.2.17 candidate`, unpublished `0.2.17` release-candidate, `latest published npm package is 0.2.14`, `GitHub Release [v0.2.14]`, `v0.2.18 candidate`, or unpublished `0.2.18` package-page snippets.
- `pnpm smoke:registry -- --version 0.2.18` passed against the real registry tarball with `fileCount: 50`, `packageSize: 54991`, `unpackedSize: 242469`, and a clean consumer `tsc --noEmit`.
- Release promotion gate passed on commit `9f032e269e5d82e5fdaf38f554a113572cd63f1e`: CI `https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28698349542`, Android Instrumentation `https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28698349545`, and iOS Validation `https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28698349539`.

## v0.2.17

Status: published to npm as the `0.2.17` latest release, tagged as `v0.2.17`.

This release does not enable AVIF output. It advances the v0.2.16 Android `MediaCodec image/avif` prototype from route discovery to a real static-file smoke attempt that either proves a minimal AVIF cache file can be encoded and decoded back, or records the blocker that keeps production AVIF output disabled.

### Goals

- Attempt a repo-owned 16x12 Bitmap to AVIF cache-file encode on an API 34+ Android emulator or device.
- Validate the generated file has an `ftyp` box with `avif` or `avis` compatible brand.
- Decode the generated file with `ImageDecoder` and assert 16x12 output dimensions.
- Record a clear blocker when no encoder is exposed, the codec route fails, muxing fails, the signature is invalid, or decode-back fails.
- Keep AVIF output capability reporting unchanged until a production path is intentionally implemented.
- Align README, release notes, Android verification doctor checks, Vitest expectations, JVM tests, and Android instrumentation with the smoke result contract.

### Findings

- Android platform supported-media documentation lists AVIF baseline image encoder and decoder support as mandatory beginning with Android 14, but the current production implementation still cannot use `Bitmap.compress()` for AVIF because `Bitmap.CompressFormat` has no AVIF enum.
- The smoke route creates a 16x12 ARGB bitmap pattern, converts it into YUV420 input through `MediaCodec.getInputImage()`, queues it into an `image/avif` encoder, and collects encoder output bytes and muxable samples.
- The smoke validates direct encoder bytes first, then attempts a `MediaMuxer.MUXER_OUTPUT_HEIF` container path and validates the muxed output.
- A passing smoke requires both AVIF `ftyp` `avif` / `avis` signature bytes and `ImageDecoder` decode-back dimensions. Anything less remains a documented blocker, not a partial production feature.
- Current GitHub Android Instrumentation on the API 35 Google APIs emulator reports `attempted=false`, `success=false`, and blocker `No image/avif encoder was discovered through MediaCodecList.findEncoderForFormat().`; that keeps AVIF output disabled.

### Capability Reporting Decision

- v0.2.17 keeps runtime capability reporting unchanged: Android AVIF `input=true` on Android 14+ and `output=false`; iOS AVIF input remains gated by `CGImageSourceCopyTypeIdentifiers()` and AVIF output remains `false`.
- Android may report AVIF `output=true` only after the smoke is promoted into a production encode path with metadata, target-size, unsupported-path, and public API behavior tests.
- `metadata: 'preserve'` remains unsupported for AVIF output unless explicitly designed and validated.
- `output.maxBytes` remains unsupported for AVIF output until AVIF quality and size-search semantics are validated.
- Animated AVIF preservation remains out of scope.

### Included

- `package.json` version bump to `0.2.17`.
- Internal Android `AndroidAvifOutputPrototype.runEncodeDecodeBackSmoke()` route with `MediaCodec` input image writing, direct output validation, `MediaMuxer.MUXER_OUTPUT_HEIF` fallback, AVIF signature checking, and `ImageDecoder` decode-back validation.
- Android JVM tests for smoke blocker reporting below API 34 and when no `image/avif` encoder is discovered.
- Android instrumentation smoke that runs on API 34+, logs `RNICK_AVIF_OUTPUT_SMOKE`, accepts either a validated static AVIF file or a documented blocker, and asserts `getImageCompressionCapabilities().formats.avif.output=false`.
- README and verification expectations that keep `getImageCompressionCapabilities().formats.avif.output=false`.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.17` and GitHub Release `v0.2.17`.

### Not Included

- Production AVIF output encoding.
- AVIF output capability enablement.
- HEIC / HEIF output encoding.
- Metadata preservation for AVIF output.
- Target-size AVIF output.
- Animated AVIF preservation.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
```

After npm publish:

```bash
npm publish --tag latest
npm view react-native-image-compression-kit version dist-tags time.modified --json
pnpm smoke:registry -- --version 0.2.17
git tag -a v0.2.17 -m "v0.2.17"
git push origin v0.2.17
```

Release promotion also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed release commit. The Android Instrumentation `RNICK_AVIF_OUTPUT_SMOKE` log must be reviewed. If the route fails to produce a decodeable AVIF file there, keep AVIF output disabled and carry the logged blocker into the next production-path decision.

### Publication Results

- `npm view react-native-image-compression-kit version dist-tags time.modified --json` confirmed package version `0.2.17`, `latest: 0.2.17`, and registry modified time `2026-07-03T09:25:30.216Z`.
- `npm view react-native-image-compression-kit@0.2.17 version dist.tarball dist.integrity dist.shasum time.modified --json` confirmed tarball `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.17.tgz`.
- Registry integrity is `sha512-QMoXmU5VL5dPvhJIVe1GPJxK5u2OilbAVzL1UHH8gHaf7nDeL/7Cu2JdDY4yqgCLe+HvYG+MTJNEQ2cqjAsi7g==`.
- Registry shasum is `a7a99058a1f67f6907e57d3a5080129655b0314b`.
- `pnpm smoke:registry -- --version 0.2.17` passed against the real registry tarball with `fileCount: 50`, `packageSize: 54863`, `unpackedSize: 242110`, and a clean consumer `tsc --noEmit`.
- Published tarball README inspection found pre-publish package-page wording because `0.2.17` was published before the post-publish README refresh. The npm tarball is immutable, so correcting the npm package-page README requires a later docs-only package version.
- Release promotion gate passed on commit `f142dcb8bccd0d6955048fb9a762356c076d7167`: [CI](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28650341234), [Android Instrumentation](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28650341269), and [iOS Validation](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28650341225).
- Git tag and GitHub Release: `v0.2.17` at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.17`.

## v0.2.16

Status: unpublished release candidate for the Android AVIF output encoder route prototype. npm `latest` remains `0.2.14`; no `v0.2.16` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not enable AVIF output. It adds an internal Android prototype that probes whether an API 34+ `MediaCodec` still-image AVIF encoder route can become the future production path outside `Bitmap.compress()`.

### Goals

- Reconfirm the public Android AVIF encoder route available on Android 14+.
- Add one minimal Android prototype for a `MediaCodec image/avif encoder probe`.
- Keep AVIF output capability reporting unchanged until full output validation exists.
- Define byte-signature, decode-back, metadata, `output.maxBytes`, and animation boundaries before production AVIF output work.
- Align README, release notes, Android verification doctor checks, Vitest expectations, JVM tests, and Android instrumentation with the prototype decision.

### Findings

- Android platform supported-media documentation lists AVIF baseline image encoder and decoder support as mandatory beginning with Android 14.
- Android `Bitmap.CompressFormat` still exposes JPEG, PNG, WebP, WebP lossless, and WebP lossy output formats with no AVIF enum, so the existing `Bitmap.compress()` path still cannot implement AVIF output.
- The prototype route builds an `image/avif` `MediaFormat` with `COLOR_FormatYUV420Flexible` input and asks `MediaCodecList.findEncoderForFormat()` for an encoder on API 34+.
- The prototype records a `video/av01` fallback encoder probe as evidence only; AV1 video encoder availability is not enough to prove a complete static AVIF still-image file output path.
- The Android production gate remains closed until the module feeds processed `Bitmap` pixels to the encoder, writes a complete `.avif` file, verifies `ftyp` `avif` / `avis` signature bytes, and decodes the result back with `ImageDecoder`.

### Capability Reporting Decision

- v0.2.16 keeps runtime capability reporting unchanged: Android AVIF `input=true` on Android 14+ and `output=false`; iOS AVIF input remains gated by `CGImageSourceCopyTypeIdentifiers()` and AVIF output remains `false`.
- Android may report AVIF `output=true` only after the prototype is promoted into a real encode path with byte-signature, decode-back, target-size, and unsupported metadata-path tests.
- `metadata: 'preserve'` remains unsupported for AVIF output unless explicitly designed and validated.
- `output.maxBytes` remains unsupported for AVIF output until AVIF quality and size-search semantics are validated.
- Animated AVIF preservation remains out of scope.

### Included

- `package.json` version bump to `0.2.16`.
- Internal Android `AndroidAvifOutputPrototype` source with route report, API gate, `MediaCodecList.findEncoderForFormat()` probe, AV1 fallback probe, AVIF signature helper, and validation plan.
- Android JVM tests for injected encoder discovery, API 34 gating, production gate closure, YUV420 `image/avif` format construction, and AVIF `ftyp` brand detection.
- Android instrumentation assertion for the API 34+ prototype route report and production gate.
- README and verification expectations that keep `getImageCompressionCapabilities().formats.avif.output=false`.

### Not Included

- Production AVIF output encoding.
- AVIF output capability enablement.
- HEIC / HEIF output encoding.
- Metadata preservation for AVIF output.
- Target-size AVIF output.
- Animated AVIF preservation.
- npm publish, git tag, or GitHub Release promotion for `v0.2.16`.

### Validation

Before considering the candidate ready:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
```

Because this is a prototype candidate and not a publish step, `pnpm smoke:registry` remains pointed at the latest published package, `0.2.14`, after any future publish decision.

## v0.2.15

Status: unpublished release candidate for the AVIF output feasibility spike. npm `latest` remains `0.2.14`; no `v0.2.15` tag, GitHub Release, or npm publish is part of this candidate.

This candidate does not implement AVIF output. It records the platform boundary for when Android and iOS can safely report AVIF `output=true` instead of the current `ERR_NOT_IMPLEMENTED` unsupported-output path.

### Goals

- Confirm whether Android can encode AVIF through the current native output path.
- Confirm whether iOS ImageIO AVIF destination support can be advertised without runtime probing.
- Define the AVIF output capability reporting rule for Android and iOS.
- Define unsupported versus partial-implementation criteria before any production AVIF output work.
- Align README, release notes, Android verification doctor checks, and Vitest expectations with the feasibility decision.

### Findings

- Android platform supported-media documentation lists AVIF baseline image encoder and decoder support as mandatory beginning with Android 14, but the current module encodes through `Bitmap.compress()`.
- Android `Bitmap.CompressFormat` exposes JPEG, PNG, WebP, WebP lossless, and WebP lossy output formats, with no AVIF enum, so the existing `Bitmap.compress()` path cannot add AVIF output by enum mapping alone.
- Android `ExifInterface` supports AVIF for reading metadata but lists writable metadata formats as JPEG, PNG, and WebP, so any future AVIF output must explicitly document metadata preserve behavior.
- iOS ImageIO supports runtime discovery of destination formats with `CGImageDestinationCopyTypeIdentifiers()`. Future AVIF output must follow the existing WebP pattern and report AVIF `output=true` only when ImageIO advertises an AVIF destination type.

### Capability Reporting Decision

- v0.2.15 keeps runtime capability reporting unchanged: Android AVIF `input=true` on Android 14+ and `output=false`; iOS AVIF input remains gated by `CGImageSourceCopyTypeIdentifiers()` and AVIF output remains `false`.
- Android may report AVIF `output=true` only after a non-`Bitmap.compress()` AVIF encoder route is implemented and validated on API 34+ with byte-signature, decode-back, target-size, and unsupported metadata-path tests.
- iOS may report AVIF `output=true` only when `CGImageDestinationCopyTypeIdentifiers()` returns an AVIF destination type and the native path validates static AVIF output through `CGImageDestination`.
- On platforms or runtimes without a validated encoder route, `output.format: 'avif'` must continue to reject with `ERR_NOT_IMPLEMENTED`.

### Unsupported vs Partial Criteria

- Keep AVIF output unsupported when there is no runtime destination or encoder, no byte-signature and decode-back smoke, unclear metadata behavior, or no documented target-size behavior.
- A partial implementation may ship only for static still-image output, with animated AVIF preservation out of scope.
- A partial implementation may reject `metadata: 'preserve'` and `output.maxBytes` for AVIF until those semantics are explicitly designed and tested.
- A partial release must include README guidance, capability notes, Android instrumentation coverage where Android output is enabled, and iOS host-app smoke coverage where iOS output is enabled.

### Not Included

- Production AVIF output encoding.
- HEIC / HEIF output encoding.
- Animated AVIF preservation.
- Runtime behavior changes.
- npm publish, git tag, or GitHub Release promotion for `v0.2.15`.

### Validation

Before considering the candidate ready:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
```

Because this is a feasibility candidate and not a publish step, `pnpm smoke:registry` remains pointed at the latest published package, `0.2.14`, after any future publish decision.

## v0.2.14

Status: published to npm as the `0.2.14` latest release, tagged as `v0.2.14`.

This release keeps AVIF output unimplemented while making Android and iOS capability reporting, unsupported-output messages, TypeScript guidance, README guidance, and verification checks agree on the same boundary: AVIF input can be supported, but `output.format: 'avif'` rejects with `ERR_NOT_IMPLEMENTED`.

### Goals

- Keep AVIF output out of scope while making the unsupported output path explicit.
- Align Android and iOS AVIF capability notes around `output=false`.
- Make native `ERR_NOT_IMPLEMENTED` messages clear when callers select `output.format: 'avif'`.
- Keep TypeScript validation accepting `avif` as a planned output format so native platform capability errors surface intact.
- Align README guidance, release notes, Android verification doctor checks, Vitest expectations, Android JVM tests, and iOS host-app smoke assertions.

### Included

- `package.json` version bump to `0.2.14`.
- Android AVIF capability notes now say AVIF output reports `output=false` and selecting `output.format: 'avif'` rejects with `ERR_NOT_IMPLEMENTED`.
- Android `compressImage()` now rejects HEIC, HEIF, and AVIF output with an explicit unsupported-output message naming JPEG, PNG, and WebP as the supported output formats.
- Android module tests now assert AVIF output rejects with `ERR_NOT_IMPLEMENTED`.
- iOS AVIF capability notes now separate animated AVIF preservation from AVIF output, report AVIF output as unsupported, and state that selecting `output.format: 'avif'` rejects with `ERR_NOT_IMPLEMENTED`.
- iOS `compressImage()` now uses an AVIF-specific unsupported-output message for `output.format: 'avif'`.
- iOS host-app smoke now asserts the AVIF capability note documents the unsupported AVIF output path.
- TypeScript native-unavailable guidance now describes the current Android/iOS input/output matrix and calls out HEIC, HEIF, and AVIF output as unsupported.
- README status, implementation scope, iOS behavior, Android AVIF input/output guidance, installation/package status, and release dry-run guidance are updated for the `0.2.14` release.
- Source-level tests and Android verification doctor expectations are updated for the AVIF output unsupported surface release.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.14` and GitHub Release `v0.2.14`.

### Not Included

- AVIF output encoding.
- HEIC / HEIF output encoding.
- Animated AVIF preservation.
- Android or iOS decode behavior changes.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
```

After npm publish:

```bash
npm publish --tag latest
pnpm smoke:registry -- --version 0.2.14
git tag -a v0.2.14 -m "v0.2.14"
git push origin v0.2.14
```

Release promotion also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed release commit. After npm publish, the registry smoke must confirm the real `0.2.14` tarball README no longer includes stale candidate package-page status snippets.

### Publication Results

- `npm view react-native-image-compression-kit version dist-tags time.modified --json` confirmed package version `0.2.14`, `latest: 0.2.14`, and registry modified time `2026-07-03T07:12:58.753Z`.
- `npm view react-native-image-compression-kit@0.2.14 version dist.tarball dist.integrity dist.shasum time.modified --json` confirmed tarball `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.14.tgz`.
- Registry integrity is `sha512-/rdbK4BvVQZkGKYhUkutQn4z9NwCD4n+9a2cmHxVdE61YTp0+TWOhpDQHVmOmAjA4mwqjXykn2RPimAZ8FOweA==`.
- Registry shasum is `d49f394ad95935f7326d33e9fb9efeb5cc276f2d`.
- `pnpm smoke:registry -- --version 0.2.14` passed against the real registry tarball with `fileCount: 49`, `packageSize: 47733`, `unpackedSize: 213156`, and a clean consumer `tsc --noEmit`.
- The published tarball README stale-candidate scan found no `v0.2.14 candidate`, unpublished release-candidate, `latest published npm package is 0.2.13`, or unpublished AVIF output capability/error surface candidate package-page snippets.
- Release promotion gate passed on commit `2d3d4732f6b2ddc5bb58c100c810e7befb5d539d`: [CI](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28643843274), [Android Instrumentation](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28643843263), and [iOS Validation](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28643843264).
- Git tag and GitHub Release: `v0.2.14` at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.14`.

## v0.2.13

Status: published to npm as the `0.2.13` latest release, tagged as `v0.2.13`.

This release hardens the iOS JPEG source to JPEG output `metadata: 'preserve'`
path so preserved metadata does not retain stale orientation or pixel dimension
values after resize, quality, or `output.maxBytes` encoding.

### Goals

- Normalize iOS preserved JPEG output orientation metadata to `1` after rendering.
- Update preserved top-level pixel width/height and EXIF `PixelXDimension` / `PixelYDimension` to the rendered JPEG dimensions.
- Keep JPEG source to JPEG output as the only iOS preserve scope.
- Prove the behavior through iOS host-app smoke metadata readback and source-level expectations.
- Align README guidance, release notes, Android verification doctor checks, and Vitest expectations.

### Included

- `package.json` version bump to `0.2.13`.
- iOS JPEG preserve encoding now passes final `CGImage` dimensions into ImageIO destination properties.
- Preserved JPEG metadata normalizes top-level orientation, TIFF orientation, top-level pixel width/height, and EXIF pixel dimensions.
- iOS smoke fixture writes stale TIFF orientation and source-size EXIF pixel dimensions, then verifies preserve output normalizes them to the compressed JPEG result.
- README status, iOS behavior guidance, metadata policy docs, iOS smoke description, and release dry-run guidance are updated for the `0.2.13` release.
- Source-level tests and Android verification doctor expectations are updated for the iOS JPEG metadata preserve hardening release.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.13` and GitHub Release `v0.2.13`.

### Not Included

- Android runtime behavior changes.
- PNG, WebP, GIF, HEIC, HEIF, or AVIF metadata preserve on iOS.
- New output formats.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
```

After npm publish:

```bash
npm publish --tag latest
pnpm smoke:registry -- --version 0.2.13
git tag -a v0.2.13 -m "v0.2.13"
git push origin v0.2.13
```

Release promotion also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed release commit. After npm publish, the registry smoke must confirm the real `0.2.13` tarball README no longer includes stale candidate package-page status snippets.

### Publication Results

- `npm view react-native-image-compression-kit version dist-tags time.modified --json` confirmed package version `0.2.13`, `latest: 0.2.13`, and registry modified time `2026-07-03T06:21:08.749Z`.
- `npm view react-native-image-compression-kit@0.2.13 version dist.tarball dist.integrity dist.shasum time.modified --json` confirmed tarball `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.13.tgz`.
- Registry integrity is `sha512-1XklGCG2cUQaXuw7z1AeNxJekleC5IUyCVWRnNWekJAbpae3uXnX1Fa0c43J5w5werqnHSs7kUGcAxcmSo0qEQ==`.
- Registry shasum is `59af2dc4682fe8445c5f7f02b886f56cd799bb09`.
- `pnpm smoke:registry -- --version 0.2.13` passed against the real registry tarball with `fileCount: 49`, `packageSize: 47296`, `unpackedSize: 210816`, and a clean consumer `tsc --noEmit`.
- Release promotion gate passed on commit `dfaa3763fc3d3a223a6672dbfa934e6bc8100443`: [CI](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28641938227), [Android Instrumentation](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28641938248), and [iOS Validation](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28641938240).
- Git tag and GitHub Release: `v0.2.13` at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.13`.

## v0.2.12

Status: published to npm as the `0.2.12` latest release, tagged as `v0.2.12`.

This release adds the narrow iOS `metadata: 'preserve'` MVP for JPEG source
to JPEG output. Other iOS format conversions keep the explicit
`ERR_NOT_IMPLEMENTED` preserve boundary.

### Goals

- Support iOS JPEG source to JPEG output with `metadata: 'preserve'`.
- Keep resize, `output.quality`, and `output.maxBytes` JPEG output paths aligned with metadata preserve.
- Report iOS `metadataPolicies: ['preserve', 'safe', 'strip']` while documenting that preserve is JPEG-to-JPEG only.
- Keep PNG/WebP/GIF/HEIC/HEIF/AVIF metadata preservation out of scope.
- Align TypeScript/native error surface, README guidance, release notes, source-level expectations, Android verification doctor checks, and iOS host-app smoke validation.

### Included

- `package.json` version bump to `0.2.12`.
- iOS JPEG output now uses ImageIO `CGImageDestination`, allowing source JPEG metadata to be copied for JPEG source to JPEG output.
- iOS `metadata: 'preserve'` rejects with `ERR_NOT_IMPLEMENTED` unless both input and output are JPEG.
- iOS capability reporting now includes `preserve`, `safe`, and `strip` metadata policies.
- iOS smoke fixtures include a JPEG TIFF Software metadata marker and read it back after preserve compression.
- README status, iOS behavior guidance, metadata policy docs, iOS smoke description, and release dry-run guidance are updated for the `0.2.12` release.
- Source-level tests and Android verification doctor expectations are updated for the iOS JPEG metadata preserve release.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.12` and GitHub Release `v0.2.12`.

### Not Included

- Android runtime behavior changes.
- PNG, WebP, GIF, HEIC, HEIF, or AVIF metadata preserve on iOS.
- AVIF output, animated AVIF preservation, HEIC/HEIF output, GIF animation preservation, animated WebP preservation, cancellation, or progress support.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
```

After npm publish:

```bash
npm publish --tag latest
pnpm smoke:registry -- --version 0.2.12
git tag -a v0.2.12 -m "v0.2.12"
git push origin v0.2.12
```

Release promotion also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed release commit. After npm publish, the registry smoke must confirm the real `0.2.12` tarball README no longer includes stale candidate package-page status snippets.

## v0.2.11

Status: published to npm on July 2, 2026 at 08:49:37 UTC (17:49:37 KST), tagged as `v0.2.11`.

This docs-only patch corrects the README that is shown on the npm package page
after the `0.2.10` tarball shipped release-ready/pre-publish status text. It
keeps Android and iOS runtime behavior unchanged while publishing a new package
version whose packaged README reports the `0.2.11` published package state.

### Goals

- Publish a docs-only package version so the npm package page reflects the published state after `0.2.11` is released.
- Remove stale `0.2.10` release-ready/pre-publish package-page status wording from the packaged README.
- Keep Android runtime behavior, iOS runtime behavior, and the public TypeScript API unchanged.
- Verify the `0.2.10` registry tarball README before preparation and the `0.2.11` registry tarball README after publish.
- Keep the release dry-run packed README stale-status check and post-publish registry smoke flow in place.

### Included

- `package.json` version bump to `0.2.11`.
- README status, installation, release guidance, and registry smoke examples updated for the docs-only npm README correction.
- README copy now describes `0.2.11` as a docs-only README correction while preserving the `0.2.10` runtime behavior surface.
- Source-level tests and Android verification doctor expectations are updated for the `0.2.11` docs-only status.
- Release dry-run packed README stale checks now reject the stale `0.2.10` release-ready/pre-publish snippets and old `0.2.10` package-page status snippets.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.11` and GitHub Release `v0.2.11`.

### Not Included

- Android or iOS runtime behavior changes.
- Native code changes.
- New public TypeScript API surface.
- AVIF output, animated AVIF preservation, HEIC/HEIF output, iOS metadata preservation, cancellation, or progress support.

### v0.2.10 Registry README Inspection

Before preparing this patch, the published `0.2.10` registry tarball README was
checked explicitly:

```bash
tmpdir=$(mktemp -d)
npm pack react-native-image-compression-kit@0.2.10 --pack-destination "$tmpdir"
tar -xOf "$tmpdir"/react-native-image-compression-kit-0.2.10.tgz package/README.md | rg -n 'Status: v0\.2\.10 release-ready|It has not been published to npm yet|latest published npm package remains `0\.2\.9`|v0\.2\.10 release-ready notes'
rm -rf "$tmpdir"
```

The inspection found `Status: v0.2.10 release-ready`, `It has not been
published to npm yet`, the "latest published npm package remains `0.2.9`"
wording, and `v0.2.10 release-ready notes` in the published `0.2.10` README.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
```

After npm publish:

```bash
npm publish --tag latest
pnpm smoke:registry -- --version 0.2.11
git tag -a v0.2.11 -m "v0.2.11"
git push origin v0.2.11
```

The release dry run includes a packed README stale status check before the consumer smoke and publish dry run. Release promotion also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed release-ready commit. After npm publish, the registry smoke must confirm the real `0.2.11` tarball README no longer includes the stale `0.2.10` release-ready/pre-publish package-page status snippets.

Release commit validation before npm publish:

- Commit: `be8344f7b5dd884e5d44d9da9ae934976c50d581`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28576768326>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28576768289>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28576768307>.
- Local pre-publish gate completed successfully before npm publish: `pnpm release:dry-run`, including `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, `pnpm pack --dry-run`, packed README stale-status check, packed consumer smoke, and publish dry run.

Completed after npm publish and GitHub Release creation:

- `npm publish --tag latest` published `react-native-image-compression-kit@0.2.11`.
- `npm view react-native-image-compression-kit@0.2.11 version dist.tarball dist.integrity dist.shasum time.modified --json` confirmed version `0.2.11`, registry tarball URL, integrity `sha512-JMBebCxcpwdiLspK8s8pIF8xIEpgqxWjO5BZEkBEoCdRp09wvqj8b3UXLczGqXSgcAZtTL+UuE2mF+nptKWDpw==`, shasum `e3c067a00949e93f29f80dee5eabfaaf4bf1fa72`, and publish timestamp `2026-07-02T08:49:36.915Z`.
- `npm view react-native-image-compression-kit dist-tags version --json` confirmed `latest` dist-tag `0.2.11`.
- npm package: `react-native-image-compression-kit@0.2.11`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.11.tgz`
- npm integrity: `sha512-JMBebCxcpwdiLspK8s8pIF8xIEpgqxWjO5BZEkBEoCdRp09wvqj8b3UXLczGqXSgcAZtTL+UuE2mF+nptKWDpw==`
- npm shasum: `e3c067a00949e93f29f80dee5eabfaaf4bf1fa72`
- Git tag: `v0.2.11`
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.11>.
- Registry smoke confirmed 49 files, 46.4 kB package size, 204.3 kB unpacked size, clean `npm install --ignore-scripts --legacy-peer-deps`, and public TypeScript import/typecheck success.
- Registry tarball README stale-status check passed for the `0.2.11` package-page status.

## v0.2.10

Status: published to npm on July 2, 2026 at 07:52:44 UTC (16:52:44 KST), tagged as `v0.2.10`.

This release adds capability-gated iOS AVIF input. iOS decodes AVIF as a static
image through ImageIO only when the runtime advertises AVIF source support, then
routes the decoded image through the existing JPEG, PNG, or runtime-gated WebP
output paths. Runtimes without ImageIO AVIF source support keep the explicit
`ERR_UNSUPPORTED_FORMAT` path.

### Goals

- Support iOS AVIF input through runtime ImageIO source capability reporting.
- Decode supported AVIF inputs as static images before resize and output encoding.
- Reuse the existing iOS JPEG, PNG, runtime-gated WebP, target-size, and metadata no-copy paths.
- Keep unsupported iOS AVIF runtimes on a clear `ERR_UNSUPPORTED_FORMAT` path.
- Align TypeScript native-unavailable messaging, README guidance, release notes, source-level expectations, Android verification doctor checks, and iOS host-app smoke validation with the capability-gated AVIF input behavior.

### Included

- `package.json` version bump to `0.2.10`.
- iOS `getImageCompressionCapabilities()` reports AVIF `input=true` only when `CGImageSourceCopyTypeIdentifiers()` advertises an AVIF source type, and always reports AVIF `output=false`.
- iOS `compressImage()` accepts AVIF input only on runtimes with ImageIO AVIF source support.
- Supported iOS AVIF input is decoded as a static image with `CGImageSourceCreateImageAtIndex`.
- AVIF input can be re-encoded to JPEG or PNG output without copying source metadata.
- AVIF input can be re-encoded to WebP output when the runtime also advertises ImageIO WebP destination support.
- iOS unsupported-input errors keep AVIF on `ERR_UNSUPPORTED_FORMAT` when ImageIO AVIF source support is unavailable.
- The iOS host-app smoke validates both the AVIF-supported branch and the AVIF-unavailable rejection branch through runtime capabilities.
- README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.
- Source-level tests and Android verification doctor expectations are updated for the iOS AVIF input release.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.10` and GitHub Release `v0.2.10`.

### Not Included

- Android runtime behavior changes.
- AVIF output.
- Animated AVIF preservation.
- HEIC/HEIF output.
- iOS metadata preservation.
- Cancellation or progress support.
- New public TypeScript API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm release:dry-run
pnpm example:ios:smoke
```

The release dry run includes a packed README stale status check before the consumer smoke and publish dry run. Release promotion also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed release-ready commit.

Release commit validation before npm publish:

- Commit: `d8d3232d74e66158d1de297783e3fc39448f1684`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28573553093>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28573553082>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28573553073>.
- Local pre-publish gate completed successfully before npm publish: `pnpm release:dry-run`, including `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, `pnpm pack --dry-run`, packed README stale-status check, packed consumer smoke, and publish dry run.

Completed after npm publish and GitHub Release creation:

- `npm publish --tag latest` published `react-native-image-compression-kit@0.2.10`.
- `npm view react-native-image-compression-kit@0.2.10 version dist.tarball dist.integrity dist.shasum time.modified --json` confirmed version `0.2.10`, registry tarball URL, integrity `sha512-73bAB8tcLrQ7o2iletdLYWEry1VRn3vIWyhYy+/RDGAj9MLho5aKJJtnx92eDgtQOW3s9r48qtCcJByPVwnfxw==`, shasum `1890e78917538d2e27d3274e97a0820c5597a827`, and publish timestamp `2026-07-02T07:52:43.911Z`.
- `npm view react-native-image-compression-kit dist-tags version --json` confirmed `latest` dist-tag `0.2.10`.
- npm package: `react-native-image-compression-kit@0.2.10`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.10.tgz`
- npm integrity: `sha512-73bAB8tcLrQ7o2iletdLYWEry1VRn3vIWyhYy+/RDGAj9MLho5aKJJtnx92eDgtQOW3s9r48qtCcJByPVwnfxw==`
- npm shasum: `1890e78917538d2e27d3274e97a0820c5597a827`
- Git tag: `v0.2.10`
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.10>.
- Registry smoke confirmed 49 files, 46.4 kB package size, 204.3 kB unpacked size, clean `npm install --ignore-scripts --legacy-peer-deps`, and public TypeScript import/typecheck success.

## v0.2.9

Status: published to npm on July 2, 2026 at 06:24:49 UTC (15:24:49 KST), tagged as `v0.2.9`.

This docs-only patch corrects the README that is shown on the npm package
page. It keeps Android and iOS runtime behavior unchanged while publishing a
new package version whose packaged README no longer carries the stale
pre-release status text that shipped in the `0.2.8` tarball.

### Goals

- Publish a docs-only package version so the npm package page reflects the current release state.
- Remove stale `0.2.8` package-page status wording from the packaged README.
- Keep Android runtime behavior, iOS runtime behavior, and the public TypeScript API unchanged.
- Align README guidance, release notes, package metadata, source-level expectations, and Android verification doctor checks with the docs-only correction.
- Verify the packed tarball README before publish and the registry tarball README after publish.

### Included

- `package.json` version bump to `0.2.9`.
- README status, installation, release guidance, and registry smoke examples updated for the docs-only package-page correction.
- README copy now describes `0.2.9` as a docs-only README correction while preserving the `0.2.8` runtime behavior surface.
- Source-level tests and the Android verification doctor expectations are updated for the `0.2.9` docs-only status.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.9` and GitHub Release `v0.2.9`.

### Not Included

- Android or iOS runtime behavior changes.
- New public TypeScript API surface.
- AVIF output, HEIC/HEIF output, iOS metadata preservation, cancellation, or progress support.
- Changes to npm package file globs or install-time lifecycle behavior.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
tmpdir=$(mktemp -d)
pnpm pack --pack-destination "$tmpdir"
if tar -xOf "$tmpdir"/react-native-image-compression-kit-0.2.9.tgz package/README.md | rg -n 'v0\.2\.8 candidate|unpublished tooling candidate|latest npm `latest` dist-tag remains|latest published npm package remains `0\.2\.7`|version `0\.2\.8` is the unpublished|v0\.2\.8 candidate notes|GitHub Release \[v0\.2\.7\]'; then exit 1; fi
pnpm smoke:registry -- --version 0.2.8
```

Release commit validation before npm publish:

- Commit: `770bb06b2c0dc8b2e186cd799e647f6fdcac9fa8`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28568919988>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28568919982>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28568919984>.
- Local pre-publish gate completed successfully before npm publish: `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, `pnpm pack --dry-run`, packed tarball README stale-status check, and `pnpm smoke:registry -- --version 0.2.8`.

Completed after npm publish and GitHub Release creation:

- `npm publish --tag latest` published `react-native-image-compression-kit@0.2.9`.
- `npm view react-native-image-compression-kit@0.2.9 version dist.tarball dist.integrity dist.shasum time.modified --json` confirmed version `0.2.9`, registry tarball URL, integrity `sha512-Q/z8QZdsEl85Q9IhO31gv3/OAfGXh5FS7O3kBKJouzlnvtbTYCS+zgGYKrDNNq7x1rIVHQAxKXmeNJpoMwxWqw==`, shasum `11882a2c1fff4b21648ebbfb773c6ae5aabad638`, and publish timestamp `2026-07-02T06:24:49.065Z`.
- `npm view react-native-image-compression-kit dist-tags version --json` confirmed `latest` dist-tag `0.2.9`.
- npm package: `react-native-image-compression-kit@0.2.9`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.9.tgz`
- npm integrity: `sha512-Q/z8QZdsEl85Q9IhO31gv3/OAfGXh5FS7O3kBKJouzlnvtbTYCS+zgGYKrDNNq7x1rIVHQAxKXmeNJpoMwxWqw==`
- npm shasum: `11882a2c1fff4b21648ebbfb773c6ae5aabad638`
- Git tag: `v0.2.9`
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.9>.
- Registry smoke confirmed 49 files, 45.4 kB package size, 198.3 kB unpacked size, clean `npm install --ignore-scripts --legacy-peer-deps`, and public TypeScript import/typecheck success.
- Registry tarball README stale-status check passed.

## v0.2.8

Status: published to npm on July 2, 2026 at 05:07:49 UTC (14:07:49 KST), tagged as `v0.2.8`.

This release keeps Android and iOS runtime behavior unchanged while adding a
repeatable post-publish npm registry smoke test for the manual checks that were
used after the `0.2.7` publish.

### Goals

- Automate npm registry tarball inspection for a published package version.
- Automate required runtime file and forbidden development-only file checks for the registry tarball.
- Automate clean temporary consumer installation from npm with public TypeScript import/typecheck coverage.
- Keep the registry smoke outside pre-publish `pnpm release:dry-run` and default CI because it requires an already published npm version.
- Align README guidance, release notes, package scripts, source-level expectations, and Android verification doctor checks with the new post-publish registry smoke workflow.

### Included

- `package.json` version bump to `0.2.8`.
- New `pnpm smoke:registry` package script backed by `scripts/registry-smoke-test.mjs`.
- Registry smoke supports `--version <version>`, `--tag <tag>`, `RNICK_REGISTRY_SMOKE_VERSION`, `RNICK_REGISTRY_SMOKE_TAG`, `RNICK_REGISTRY_SMOKE_KEEP`, and `RNICK_REGISTRY_SMOKE_TMPDIR`.
- Registry smoke runs `npm view` for registry metadata, `npm pack <package>@<version> --json` for tarball inspection, required/forbidden file assertions, clean `npm install --ignore-scripts --legacy-peer-deps`, installed package file assertions, and `npm run typecheck` against public imports and exported types.
- README development verification and release dry-run guidance now document when to run `pnpm smoke:registry -- --version <published-version>` and why it is post-publish only.
- Source-level tests and the Android verification doctor expectations are updated for the registry smoke script and documentation.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.8` and GitHub Release `v0.2.8`.

### Not Included

- Android or iOS runtime behavior changes.
- New public TypeScript API surface.
- Adding registry smoke to default CI or `pnpm release:dry-run`.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm smoke:registry -- --version 0.2.7
```

Release commit validation before npm publish:

- Commit: `9c2ea1cc12d666c73e8809b33b575f527bb465dc`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28566423923>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28566423970>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28566423928>.
- Local pre-publish gate completed successfully before npm publish: `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, and `pnpm pack --dry-run`.

Completed after npm publish and GitHub Release creation:

- `npm publish --tag latest` published `react-native-image-compression-kit@0.2.8`.
- `npm view react-native-image-compression-kit@0.2.8 version dist.tarball dist.integrity dist.shasum time.modified --json` confirmed version `0.2.8`, registry tarball URL, integrity `sha512-zMnehpDnojrjeanfTz8I+DpXz32ON2p5i1wdKYJWC4/WD/IVc3PARz2itBpMepLFwlxIeBQ89blbmns/dI+eBg==`, shasum `5417ad397b69a0301da57d8e23ec9cc3546862fa`, and publish timestamp `2026-07-02T05:07:49.047Z`.
- `npm view react-native-image-compression-kit dist-tags version --json` confirmed `latest` dist-tag `0.2.8`.
- npm package: `react-native-image-compression-kit@0.2.8`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.8.tgz`
- npm integrity: `sha512-zMnehpDnojrjeanfTz8I+DpXz32ON2p5i1wdKYJWC4/WD/IVc3PARz2itBpMepLFwlxIeBQ89blbmns/dI+eBg==`
- npm shasum: `5417ad397b69a0301da57d8e23ec9cc3546862fa`
- Git tag: `v0.2.8`
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.8>.
- Registry smoke confirmed 49 files, 45.5 kB package size, 198.3 kB unpacked size, clean `npm install --ignore-scripts --legacy-peer-deps`, and public TypeScript import/typecheck success.

## v0.2.7

Status: published to npm on July 2, 2026 at 04:38:13 UTC (13:38:13 KST), tagged as `v0.2.7`.

This release keeps Android runtime behavior unchanged while adding iOS
HEIC/HEIF input support to the existing iOS ImageIO-backed static decode path.
HEIC and HEIF inputs are decoded as static images and then routed through the
existing JPEG, PNG, or runtime-gated WebP output paths.

### Goals

- Support HEIC/HEIF input on iOS through ImageIO static image decode.
- Reuse the existing iOS resize, JPEG quality, JPEG `output.maxBytes`, PNG output, runtime-gated WebP output, and runtime-available WebP `output.maxBytes` paths.
- Report iOS HEIC and HEIF capabilities as `input=true` and `output=false`.
- Keep HEIC/HEIF output, iOS AVIF input/output, Live Photo/depth/burst/animation handling, iOS metadata preservation, and Android runtime behavior outside this release.
- Align README guidance, TypeScript native-unavailable messaging, native error surfaces, source-level expectations, Android verification doctor expectations, and iOS host-app smoke validation with the new iOS HEIC/HEIF input path.

### Included

- `package.json` version bump to `0.2.7`.
- iOS `compressImage()` now accepts HEIC and HEIF source data for JPEG and PNG output.
- iOS HEIC/HEIF input is decoded through ImageIO with `CGImageSourceCreateImageAtIndex` as a static image before resize and output encoding.
- HEIC/HEIF input to JPEG output keeps resize, `output.quality`, and JPEG `output.maxBytes` behavior.
- HEIC/HEIF input to PNG output keeps resize behavior and re-encodes without copying source metadata.
- HEIC/HEIF input can be re-encoded to runtime-available WebP output when ImageIO advertises a WebP destination type.
- iOS `getImageCompressionCapabilities()` reports HEIC `input=true` / `output=false` and HEIF `input=true` / `output=false`, with notes that HEIC/HEIF output remains unimplemented.
- The iOS unsupported-input error surface now lists JPEG, PNG, GIF, WebP, HEIC, and HEIF input as supported and leaves AVIF on the unsupported path.
- The iOS host-app smoke validates `compress-heic-to-jpeg`, `compress-heif-to-jpeg`, `compress-heic-to-png`, `compress-heif-to-png`, and capability-gated HEIC/HEIF to WebP output when WebP output is available.
- The iOS host-app smoke removes HEIC and HEIF from the unsupported-input rejection loop and keeps AVIF input rejected with `ERR_UNSUPPORTED_FORMAT`.
- TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF/WebP/HEIC/HEIF input with JPEG, PNG, and runtime-gated ImageIO-backed WebP output in version `0.2.7`.
- README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the iOS HEIC/HEIF input path.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.7` and GitHub Release `v0.2.7`.

### Not Included

- Android runtime behavior changes.
- HEIC/HEIF output on iOS.
- AVIF input or output on iOS.
- Live Photo, depth, burst, or animation handling.
- iOS metadata preservation.
- New public TypeScript API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm example:ios:smoke
```

Release commit validation before npm publish:

- Commit: `9fa3cfcaf023a5f35bd288966f5b1c4d649fbaa9`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28565430449>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28565430448>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28565430475>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_PASS` with JPEG, PNG, GIF, WebP, HEIC, and HEIF input coverage, HEIC/HEIF capability reporting, AVIF input rejection, and capability-gated WebP output behavior.
- Local pre-publish gate completed successfully before npm publish: `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, and `pnpm pack --dry-run`.

Completed after npm publish and GitHub Release creation:

- `npm publish --tag latest` published `react-native-image-compression-kit@0.2.7`.
- `npm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json` confirmed version `0.2.7`, `latest` dist-tag `0.2.7`, registry tarball URL, integrity `sha512-0z7iNLyJs+9vQzuEo8flXKfvjauoNiXJxhrmR6NXnnJMBUeh/wordcDqmJQ3TB8Hy2gb0IHHikDE9f20W5QlOA==`, shasum `22494d3d42db7f8e3dd0bf1b0f9cb377a3703521`, and publish timestamp `2026-07-02T04:38:13.043Z`.
- npm package: `react-native-image-compression-kit@0.2.7`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.7.tgz`
- npm integrity: `sha512-0z7iNLyJs+9vQzuEo8flXKfvjauoNiXJxhrmR6NXnnJMBUeh/wordcDqmJQ3TB8Hy2gb0IHHikDE9f20W5QlOA==`
- npm shasum: `22494d3d42db7f8e3dd0bf1b0f9cb377a3703521`
- Git tag: `v0.2.7`
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.7>.
- Registry tarball dry-run confirmed 49 files, 45.0 kB package size, and 196.3 kB unpacked size.
- The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.
- External registry install smoke installed `react-native-image-compression-kit@0.2.7` with `npm install --ignore-scripts --legacy-peer-deps`, confirmed package version `0.2.7`, verified required runtime files, confirmed development-only verification files were absent, and completed `npx tsc --noEmit` against public imports and types.

## v0.2.6

Status: published to npm on July 2, 2026 at 03:36:53 UTC (12:36:53 KST), tagged as `v0.2.6`.

This release keeps Android runtime behavior unchanged while adding iOS WebP
target-size `output.maxBytes` support to the runtime-gated ImageIO-backed WebP
output path introduced in `0.2.5`.

### Goals

- Support `output.format: 'webp'` with `output.maxBytes` on iOS runtimes that advertise ImageIO WebP destination encoding.
- Reuse the existing iOS target-size quality search for both JPEG and runtime-available WebP output.
- Keep WebP output unavailable runtimes on the existing capability-gated `ERR_NOT_IMPLEMENTED` path.
- Align iOS capability reporting, README guidance, TypeScript native-unavailable messaging, source-level expectations, and host-app smoke validation with runtime-gated WebP target-size support.

### Included

- `package.json` version bump to `0.2.6`.
- iOS WebP output now accepts `output.maxBytes` when ImageIO advertises a WebP destination type.
- iOS target-size encoding now shares one quality-search helper for JPEG and runtime-available WebP output.
- WebP target-size compression treats `quality` as the upper quality bound and returns the highest WebP quality that fits under `maxBytes`, or the smallest generated output when the target cannot be reached.
- iOS PNG output still rejects `output.maxBytes` with `ERR_NOT_IMPLEMENTED`.
- iOS runtimes without ImageIO WebP destination support still reject `output.format: 'webp'` before any WebP target-size work.
- iOS WebP capability notes now state that runtime-available WebP output supports target-size `maxBytes` by adjusting WebP quality.
- The iOS host-app smoke now follows the WebP output capability: it validates `compress-webp-to-webp-max-bytes` with `byteSize <= maxBytes` when WebP output is available, and keeps `reject-webp-output-unavailable` / `reject-webp-output` when it is not.
- The example app enables the Max bytes input for WebP output on platforms where WebP output is currently reported as available.
- TypeScript native-unavailable messaging now mentions iOS JPEG and runtime-available WebP target-size `maxBytes` in version `0.2.6`.
- README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the iOS WebP target-size path.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.6` and GitHub Release `v0.2.6`.

### Not Included

- Android runtime behavior changes.
- Animated WebP preservation.
- GIF output on iOS.
- iOS HEIC, HEIF, or AVIF input.
- iOS HEIC, HEIF, or AVIF output.
- iOS metadata preservation.
- New public TypeScript API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm example:ios:smoke
```

Candidate implementation validation before release promotion:

- Commit: `bd4003f18b705416b8d662ca837d8746656fe706`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28561479567>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28561479544>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28561479519>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS reject-webp-output-unavailable`, `RNICK_IOS_SMOKE_STEP_PASS reject-webp-output`, and `RNICK_IOS_SMOKE_PASS` with `webpOutputAvailable: false`, `targetSizeResultBytes: 996`, `unsupportedInputs: ['heic', 'heif', 'avif']`, and `unsupportedOutputs: ['webp', 'heic', 'heif', 'avif']`.
- The `compress-webp-to-webp-max-bytes` success branch remains capability-gated for iOS runtimes that report WebP `output=true`.
- Local pre-publish gate completed successfully before npm publish: `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, and `pnpm pack --dry-run`.

Completed after npm publish and GitHub Release creation:

- `npm publish --tag latest` published `react-native-image-compression-kit@0.2.6`.
- `npm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json` confirmed version `0.2.6`, `latest` dist-tag `0.2.6`, registry tarball URL, integrity `sha512-WbGBG6LnOHEKaWSVhSG0dC+fe8PTs5DxQUAw+kmI69MhHZCLlGfsDNBmYGs4YYQKCsGT7peglmBWVPwduD9ILg==`, shasum `3d978c4650c854dbd18115fb9062e909b9eb63f3`, and publish timestamp `2026-07-02T03:36:53.452Z`.
- npm package: `react-native-image-compression-kit@0.2.6`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.6.tgz`
- npm integrity: `sha512-WbGBG6LnOHEKaWSVhSG0dC+fe8PTs5DxQUAw+kmI69MhHZCLlGfsDNBmYGs4YYQKCsGT7peglmBWVPwduD9ILg==`
- npm shasum: `3d978c4650c854dbd18115fb9062e909b9eb63f3`
- Git tag: `v0.2.6`
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.6>.
- Registry tarball dry-run confirmed 49 files, 44.6 kB package size, and 193.1 kB unpacked size.
- External registry install smoke installed `react-native-image-compression-kit@0.2.6` with `npm install --ignore-scripts --legacy-peer-deps`, confirmed package version `0.2.6`, verified required runtime files, and confirmed development-only verification files were absent.

## v0.2.5

Status: published to npm on July 2, 2026 at 02:14:56 UTC (11:14:56 KST), tagged as `v0.2.5`.

This release keeps Android runtime behavior unchanged while adding a
runtime-gated iOS ImageIO-backed WebP output path to the existing iOS
JPEG/PNG/GIF/WebP input and JPEG/PNG output MVP.

### Goals

- Verify that iOS can advertise WebP destination support through ImageIO before enabling WebP output.
- Implement iOS WebP output for JPEG, PNG, static first-frame GIF, and static first-frame WebP input when the runtime supports WebP destination encoding.
- Keep iOS WebP target-size `maxBytes`, animated WebP preservation, HEIC/HEIF/AVIF input, and Android runtime behavior outside this candidate.
- Align iOS capability reporting, README guidance, TypeScript native-unavailable messaging, source-level expectations, and host-app smoke validation with runtime-gated WebP output support.

### Included

- `package.json` version bump to `0.2.5`.
- iOS `compressImage()` now accepts `output.format: 'webp'` when ImageIO advertises a WebP destination type through `CGImageDestinationCopyTypeIdentifiers()`.
- iOS WebP output is encoded with ImageIO `CGImageDestinationCreateWithData`, `CGImageDestinationAddImage`, and `CGImageDestinationFinalize`.
- WebP output keeps existing iOS resize behavior, honors `output.quality`, writes `.webp` cache files, and re-encodes without copying source metadata under `safe` and `strip`.
- JPEG, PNG, GIF, and WebP input can be re-encoded to WebP output on runtimes that advertise an ImageIO WebP destination type.
- The GitHub Actions iOS Validation runner with Xcode 16.4 and the iPhoneSimulator18.5 SDK currently does not advertise a WebP destination type, so WebP reports `input=true` and `output=false` there.
- iOS WebP output rejects `output.maxBytes` with `ERR_NOT_IMPLEMENTED` because target-size WebP compression remains outside this candidate.
- iOS `getImageCompressionCapabilities()` reports WebP `input=true` and runtime WebP `output=true` only when ImageIO destination encoding is available.
- The iOS host-app smoke now follows the WebP output capability: it validates `compress-jpeg-to-webp`, `compress-png-to-webp`, `compress-gif-to-webp`, `compress-webp-to-webp`, and `reject-webp-max-bytes` when WebP output is available, and validates `reject-webp-output-unavailable` / `reject-webp-output` when it is not.
- TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF/WebP input with JPEG, PNG, and runtime-gated ImageIO-backed WebP output in version `0.2.5`.
- README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the runtime-gated iOS WebP output path.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.5` and GitHub Release `v0.2.5`.

### Not Included

- Android runtime behavior changes.
- WebP target-size `maxBytes` on iOS.
- Animated WebP preservation.
- GIF output on iOS.
- iOS HEIC, HEIF, or AVIF input.
- iOS HEIC, HEIF, or AVIF output.
- iOS metadata preservation.
- New public TypeScript API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm example:ios:smoke
```

Candidate implementation validation before release promotion:

- Commit: `231e86ddd30662df9797e3e7051c3fd5b9526922`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28559336635>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28559336634>.
- iOS Validation initially failed on this commit because the GitHub Actions iOS runtime reported WebP `output=false`; that finding drove the capability-gated smoke update below.

Release commit validation before npm publish:

- Commit: `e5f69c971d3eaa872419be8736f123e6d69b5985`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28559877269>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28559877253>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28559877256>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS reject-webp-output-unavailable`, `RNICK_IOS_SMOKE_STEP_PASS reject-webp-output`, and `RNICK_IOS_SMOKE_PASS` with `webpOutputAvailable: false`, `webpResultBytes: 836`, `webpToPngResultBytes: 248`, `unsupportedInputs: ['heic', 'heif', 'avif']`, and `unsupportedOutputs: ['webp', 'heic', 'heif', 'avif']`.
- Local pre-publish gate completed successfully before npm publish: `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, and `pnpm pack --dry-run`.

Completed after npm publish and GitHub Release creation:

- `npm publish --tag latest` published `react-native-image-compression-kit@0.2.5`.
- `npm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json` confirmed version `0.2.5`, `latest` dist-tag `0.2.5`, registry tarball URL, integrity `sha512-VfEgaHsOjYUKrKUJT8bxdXLJY1upFZEIu4IytQEYO1+URjN4YcXL3Ru1bbaLBAOyFeziK8Ciba7FlZxf/r2RvQ==`, shasum `3795f231b2cca37a1f82cbd333beac3854f67185`, and publish timestamp `2026-07-02T02:14:56.213Z`.
- npm package: `react-native-image-compression-kit@0.2.5`
- Git tag: `v0.2.5`
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.5>.
- External registry install smoke installed `react-native-image-compression-kit@0.2.5` with `npm install --ignore-scripts --legacy-peer-deps`, confirmed package version `0.2.5`, verified required runtime files, and confirmed development-only verification files were absent.

## v0.2.4

Status: published to npm on July 2, 2026 at 01:03:13 UTC (10:03:13 KST), tagged as `v0.2.4`.

This release keeps Android runtime behavior unchanged while adding iOS WebP
static first-frame input to the existing iOS JPEG/PNG/GIF input and JPEG/PNG
output MVP.

### Goals

- Implement iOS WebP input without changing the public TypeScript API.
- Decode WebP input as a static first frame and route it through the existing iOS resize, JPEG quality, JPEG target-size `maxBytes`, PNG output, and metadata no-copy behavior.
- Align iOS capability reporting, README guidance, TypeScript native-unavailable messaging, source-level expectations, and host-app smoke validation with the new WebP input support.

### Included

- `package.json` version bump to `0.2.4`.
- iOS `compressImage()` now accepts WebP input for JPEG and PNG output.
- iOS WebP input is decoded with ImageIO as a static first frame through `CGImageSourceCreateImageAtIndex`.
- WebP input to JPEG output keeps resize, `output.quality`, and JPEG `output.maxBytes` behavior.
- WebP input to PNG output keeps resize behavior and re-encodes without copying source metadata.
- iOS `safe` and `strip` metadata policies continue to re-encode without copying source metadata.
- iOS `getImageCompressionCapabilities()` reports WebP `input=true` and `output=false`.
- iOS WebP format notes state that WebP input is static first-frame only and that WebP output and animation preservation are not implemented.
- The iOS host-app smoke validates `compress-webp-to-jpeg` and `compress-webp-to-png`, and removes WebP from the unsupported-input rejection loop.
- The iOS host-app smoke keeps `reject-webp-output` as an `ERR_NOT_IMPLEMENTED` native output capability check because WebP output is not implemented on iOS.
- TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF/WebP input and static first-frame GIF/WebP support.
- README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the implemented iOS WebP input path.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.4` and GitHub Release `v0.2.4`.

### Not Included

- Android runtime behavior changes.
- WebP output on iOS.
- Animated WebP preservation.
- iOS HEIC, HEIF, or AVIF input.
- iOS HEIC, HEIF, or AVIF output.
- iOS metadata preservation.
- New public API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm example:ios:smoke
```

Candidate implementation validation before release promotion:

- Commit: `7bad5ac9032aaaf8147e67572a20cda046b87c50`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28500059159>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28500059163>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28500059174>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-webp-to-jpeg`, `RNICK_IOS_SMOKE_STEP_PASS compress-webp-to-png`, `RNICK_IOS_SMOKE_STEP_PASS reject-webp-output`, and `RNICK_IOS_SMOKE_PASS` with `webpResultBytes: 836`, `webpToPngResultBytes: 248`, `unsupportedInputs: ['heic', 'heif', 'avif']`, and `unsupportedOutputs: ['webp', 'heic', 'heif', 'avif']`.

Release commit validation before npm publish:

- Commit: `e62557b99a1ebf3bcbd879af21fc2ccc163d11a2`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28557446734>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28557446741>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28557446723>.
- `pnpm release:dry-run` completed successfully before npm publish, including `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, `pnpm pack --dry-run`, packed consumer smoke, and `pnpm publish --dry-run --no-git-checks`.

Completed after npm publish and GitHub Release creation:

- `pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.4`.
- `npm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json` confirmed version `0.2.4`, `latest` dist-tag `0.2.4`, registry tarball URL, integrity, shasum, and publish timestamp `2026-07-02T01:03:13.919Z`.
- npm package: `react-native-image-compression-kit@0.2.4`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.4.tgz`
- npm integrity: `sha512-f6cqSgAbvx0jg7soLOgiCWsc+e1MwpTN6/mV7T5yKbLsU64ENMmBvR6PBiW2s8KU2UxDCTUDVXU4SBRK/eC62A==`
- npm shasum: `5fca25a4a94937e59b089b46599705af77cf2ba0`
- `npm pack react-native-image-compression-kit@0.2.4 --json` confirmed the published tarball contains 49 files, 44.0 kB package size, and 186.9 kB unpacked size.
- The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.
- A fresh temporary consumer project installed `react-native-image-compression-kit@0.2.4` from the npm registry with `pnpm install --ignore-scripts` and completed `pnpm typecheck`.
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.4>.

## v0.2.3

Status: published to npm on July 1, 2026 at 06:09:45 UTC (15:09:45 KST), tagged as `v0.2.3`.

This release keeps Android runtime behavior unchanged while adding iOS GIF
static first-frame input to the existing iOS JPEG/PNG input and JPEG/PNG output
MVP.

### Goals

- Implement iOS GIF input without changing the public TypeScript API.
- Decode GIF input as a static first frame and route it through the existing iOS resize, JPEG quality, JPEG target-size `maxBytes`, PNG output, and metadata no-copy behavior.
- Align iOS capability reporting, README guidance, TypeScript native-unavailable messaging, source-level expectations, and host-app smoke validation with the new GIF input support.

### Included

- `package.json` version bump to `0.2.3`.
- iOS `compressImage()` now accepts GIF input for JPEG and PNG output.
- iOS GIF input is decoded with ImageIO as a static first frame through `CGImageSourceCreateImageAtIndex`.
- GIF input to JPEG output keeps resize, `output.quality`, and JPEG `output.maxBytes` behavior.
- GIF input to PNG output keeps resize behavior and re-encodes without copying source metadata.
- iOS `safe` and `strip` metadata policies continue to re-encode without copying source metadata.
- iOS `getImageCompressionCapabilities()` reports GIF `input=true` and `output=false`.
- iOS GIF format notes state that GIF input is static first-frame only and that GIF output and animation preservation are not implemented.
- The iOS host-app smoke validates `compress-gif-to-jpeg` and `compress-gif-to-png`, and removes GIF from the unsupported-input rejection loop.
- The iOS host-app smoke keeps `reject-gif-output` as an `ERR_INVALID_OPTIONS` TypeScript validation check because GIF output is not part of the public output format surface.
- TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF input and static first-frame GIF support.
- README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the implemented iOS GIF input path.

### Not Included

- Android runtime behavior changes.
- GIF output.
- GIF animation preservation.
- Animated WebP handling.
- iOS WebP, HEIC, HEIF, or AVIF input.
- iOS WebP, HEIC, HEIF, or AVIF output.
- iOS metadata preservation.
- New public API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
pnpm example:ios:smoke
```

Actual implementation validation before the release commit:

- Commit: `62a1c3fb4763f5977592c8e7c917246ce6be2fe2`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28493712854>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28493712886>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28493712935>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-gif-to-jpeg`, `RNICK_IOS_SMOKE_STEP_PASS compress-gif-to-png`, `RNICK_IOS_SMOKE_STEP_PASS reject-gif-output`, and `RNICK_IOS_SMOKE_PASS` with `gifResultBytes: 840`, `gifToPngResultBytes: 331`, and `unsupportedInputs: ['webp', 'heic', 'heif', 'avif']`.

Release commit validation before npm publish:

- Commit: `8d2394dfaf4b5ba5bc322fd766328624b7abc92d`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28496763807>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28496763836>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28496763804>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-gif-to-jpeg`, `RNICK_IOS_SMOKE_STEP_PASS compress-gif-to-png`, `RNICK_IOS_SMOKE_STEP_PASS reject-gif-output`, and `RNICK_IOS_SMOKE_PASS` with `gifResultBytes: 840`, `gifToPngResultBytes: 331`, and `unsupportedInputs: ['webp', 'heic', 'heif', 'avif']`.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, use a current passkey or one-time password:

```bash
pnpm whoami
pnpm publish --tag latest
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json
npm pack react-native-image-compression-kit@0.2.3 --json
```

Completed after npm publish and GitHub Release creation:

- `pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.3`.
- `pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json` confirmed version `0.2.3`, `latest` dist-tag `0.2.3`, registry tarball URL, integrity, shasum, and publish timestamp `2026-07-01T06:09:45.481Z`.
- npm package: `react-native-image-compression-kit@0.2.3`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.3.tgz`
- npm integrity: `sha512-ns/m3ZmUdTyT+kVWjCWEzWMVE0Ydu9VtWkm361pg6TEpufEN6ImV9tK9e7iSmlwjvmeZESlUiduGdAr/7rJEXQ==`
- npm shasum: `d420053faf7d4e460c4cd41c99fb489c6d017dbd`
- `npm pack react-native-image-compression-kit@0.2.3 --json` confirmed the published tarball contains 49 files, 43.7 kB package size, and 185.0 kB unpacked size.
- The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.3>.

## v0.2.2

Status: published to npm on June 30, 2026 at 10:50:12 UTC (19:50:12 KST), tagged as `v0.2.2`.

This release keeps Android runtime behavior unchanged while adding PNG output
to the existing iOS JPEG/PNG input MVP.

### Goals

- Implement iOS PNG output without changing the public TypeScript API.
- Keep iOS PNG behavior aligned with Android where applicable: PNG output ignores `quality`, preserves alpha where the processed image contains transparency, and rejects `output.maxBytes`.
- Align iOS capability reporting, README guidance, source-level expectations, and host-app smoke validation with the new PNG output support.

### Included

- `package.json` version bump to `0.2.2`.
- iOS `compressImage()` now accepts `output.format: 'png'` for JPEG and PNG input.
- iOS PNG output is encoded with `UIImagePNGRepresentation()` into the app cache directory.
- iOS PNG output keeps resize support and ignores `output.quality`.
- iOS PNG output rejects `output.maxBytes` with `ERR_NOT_IMPLEMENTED`.
- iOS `getImageCompressionCapabilities()` reports PNG `input=true` and `output=true`.
- iOS format notes now state that PNG output preserves alpha where possible and does not support target-size `maxBytes`.
- The iOS host-app smoke validates JPEG-to-PNG and PNG-to-PNG output, plus PNG `maxBytes` rejection.
- TypeScript native-unavailable messaging now mentions iOS JPEG/PNG output support.
- README iOS limitation, public API, target-size mode, roadmap, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the implemented iOS PNG output path.

### Not Included

- Android runtime behavior changes.
- iOS WebP, HEIC, HEIF, AVIF, or GIF output.
- WebP, HEIC, HEIF, AVIF, or GIF input on iOS.
- iOS metadata preservation.
- New public API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
```

Actual implementation validation before the release commit:

- Commit: `8ff9345a882243459bb6c1d44a2b4c1802296370`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28436846165>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28436846207>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28436846121>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-jpeg-to-png`, `RNICK_IOS_SMOKE_STEP_PASS compress-png-to-png`, `RNICK_IOS_SMOKE_STEP_PASS reject-png-max-bytes`, and `RNICK_IOS_SMOKE_PASS` with `jpegToPngResultBytes: 805`, `pngToPngResultBytes: 672`, and `unsupportedOutputs` excluding `png`.

Release commit validation before npm publish:

- Commit: `8b00f730a9a9d4e37afe78434943ec69556dba80`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28438265776>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28438265781>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28438265837>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-jpeg-to-png`, `RNICK_IOS_SMOKE_STEP_PASS compress-png-to-png`, `RNICK_IOS_SMOKE_STEP_PASS reject-png-max-bytes`, and `RNICK_IOS_SMOKE_PASS` with `jpegToPngResultBytes: 805`, `pngToPngResultBytes: 672`, and `unsupportedOutputs` excluding `png`.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, use a current passkey or one-time password:

```bash
pnpm whoami
pnpm publish --tag latest
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity time --json
npm pack react-native-image-compression-kit@0.2.2
```

Completed after npm publish:

- `pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.2`.
- `pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json` confirmed version `0.2.2`, `latest` dist-tag `0.2.2`, registry tarball URL, integrity, shasum, and publish timestamp `2026-06-30T10:50:12.131Z`.
- npm package: `react-native-image-compression-kit@0.2.2`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.2.tgz`
- npm integrity: `sha512-E7fzlLfMxAJhQim1xFbX9b5aEIFDtifHNYNlk7IM5+LrDgtINAR4moUe8MrPglfjJ/zpZAxcDH5eL6IlFzgzlQ==`
- npm shasum: `0bf7a4c554745d557e31787a78869895945d46df`
- `npm pack react-native-image-compression-kit@0.2.2 --json` confirmed the published tarball contains 49 files, 43.2 kB package size, and 182.2 kB unpacked size.
- The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.2>.

## v0.2.1

Status: published to npm on June 30, 2026 at 09:37:20 UTC (18:37:20 KST), tagged as `v0.2.1`.

This release keeps Android runtime behavior unchanged while adding iOS JPEG
target-size compression to the existing iOS JPEG MVP.

### Goals

- Implement iOS JPEG output `output.maxBytes` without changing the public TypeScript API.
- Keep iOS target-size semantics aligned with Android: treat `quality` as the upper quality bound, search for the highest JPEG quality that fits under `maxBytes`, and return the smallest generated JPEG if the target cannot be reached.
- Align iOS capability reporting, README guidance, source-level expectations, and host-app smoke validation with the new JPEG target-size support.

### Included

- `package.json` version bump to `0.2.1`.
- iOS `compressImage()` now accepts `output.maxBytes` for JPEG output.
- iOS JPEG target-size compression validates `maxBytes` as a positive integer and encodes JPEG candidates across the allowed quality range.
- iOS `getImageCompressionCapabilities()` reports `supportsTargetSizeCompression: true`.
- iOS format notes now state that JPEG output supports `maxBytes` by adjusting JPEG quality.
- The iOS host-app smoke validates a JPEG target-size case and asserts `byteSize <= maxBytes`.
- TypeScript native-unavailable messaging now mentions iOS JPEG target-size support.
- README iOS limitation, public API, target-size mode, roadmap, and host-app validation guidance are updated for the release behavior.
- Source-level tests and the Android verification doctor expectations are updated for the implemented iOS JPEG target-size path.

### Not Included

- Android runtime behavior changes.
- iOS PNG, WebP, HEIC, HEIF, AVIF, or GIF output.
- WebP, HEIC, HEIF, AVIF, or GIF input on iOS.
- iOS metadata preservation.
- New public API surface.

### Release Checklist

Before npm publish:

```bash
git status --short --branch
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
```

Actual implementation validation before the release commit:

- Commit: `ab85c398e4aa266dc98bd7eb4f20ae59dcdebd78`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432011263>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432011301>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432011306>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-jpeg-to-jpeg-max-bytes` and `RNICK_IOS_SMOKE_PASS` with `targetSizeResultBytes: 996` for `maxBytes: 1000`.

Release commit validation before npm publish:

- Commit: `fee74b895e471a2132b3f233dad7b9a5797c237f`.
- GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432929488>.
- Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432929458>.
- iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432929468>.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_STEP_PASS compress-jpeg-to-jpeg-max-bytes` and `RNICK_IOS_SMOKE_PASS` with `targetSizeResultBytes: 996` for `maxBytes: 1000`.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, use a current passkey or one-time password:

```bash
pnpm whoami
pnpm publish --tag latest
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity time --json
npm pack react-native-image-compression-kit@0.2.1
```

Completed after npm publish:

- `pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.1`.
- `npm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity dist.shasum time --json` confirmed version `0.2.1`, `latest` dist-tag `0.2.1`, registry tarball URL, integrity, shasum, and publish timestamp `2026-06-30T09:37:20.896Z`.
- npm package: `react-native-image-compression-kit@0.2.1`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.1.tgz`
- npm integrity: `sha512-4gJD35dySJmtRKHfUW23iLNbFrv7R8ow1trLOl7BHQXduHIP49+AuSYewexTa39vGnl/pniANpMVwFEUgVtZlA==`
- npm shasum: `8b5bd26e2fe46b9b6b340b72a656beb41ad798f9`
- `npm pack react-native-image-compression-kit@0.2.1 --json` confirmed the published tarball contains 49 files, 42.9 kB package size, and 180.5 kB unpacked size.
- The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.
- GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.1>.

## v0.2.0

Status: published to npm on June 30, 2026 at 07:04:03 UTC (16:04:03 KST), tagged as `v0.2.0`.

This release keeps Android runtime behavior unchanged while replacing the iOS
package stub with a native iOS JPEG compression MVP.

### Goals

- Implement iOS native `compressImage()` for local JPEG and PNG input.
- Support iOS JPEG output with `output.quality`, optional resize, and cache-file result metadata.
- Report iOS runtime capabilities for JPEG input/output, PNG input, metadata policies, target-size compression, and cancellation.
- Align README guidance, TypeScript native-unavailable messaging, and test expectations with the implemented iOS MVP.
- Validate the iOS MVP through a React Native iOS host app, not only source-level checks.

### Included

- `package.json` version bump to `0.2.0`.
- iOS `compressImage()` reads `file://` and best-effort `content://` source URIs.
- iOS input detection accepts JPEG and PNG only, rejecting other formats with `ERR_UNSUPPORTED_FORMAT`.
- iOS output supports JPEG only, rejecting unsupported output formats with `ERR_NOT_IMPLEMENTED`.
- iOS resize supports `contain`, `cover`, and `stretch`.
- iOS `output.quality` supports integer quality values from `0` to `100`, defaulting to `80`.
- iOS `metadata: 'safe'` and `metadata: 'strip'` are accepted and re-encode without copying source metadata.
- iOS `metadata: 'preserve'` and `output.maxBytes` reject with `ERR_NOT_IMPLEMENTED`.
- iOS `getImageCompressionCapabilities()` reports `metadataPolicies: ['safe', 'strip']`, JPEG `input=true` and `output=true`, PNG `input=true` and `output=false`, `supportsTargetSizeCompression: false`, and `supportsCancellation: false`.
- README iOS support matrix, public API guidance, roadmap, installation status, and release dry-run wording updates.
- Focused TypeScript and source-level native foundation test expectation updates for the `0.2.0` release.
- React Native iOS example host app under `example/ios`.
- iOS example `ExampleImageSource` native module for generated JPEG, PNG, GIF, WebP, HEIC, HEIF, and AVIF smoke fixtures.
- `scripts/ios-validation.mjs` with `pods`, `build`, and `smoke` modes.
- `pnpm example:ios:pods`, `pnpm example:ios:build`, and `pnpm example:ios:smoke` scripts.
- GitHub Actions iOS Validation workflow that runs the host-app smoke on a macOS runner.
- npm package publication under the `latest` dist-tag.
- Git tag `v0.2.0` and GitHub Release `v0.2.0`.

### Not Included

- Android runtime behavior changes.
- HEIC / HEIF / AVIF / GIF / WebP input on iOS.
- PNG, WebP, HEIC, HEIF, AVIF, or GIF output on iOS.
- iOS target-size compression.
- iOS metadata preservation.

### Published Artifacts

- npm package: `react-native-image-compression-kit@0.2.0`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.0.tgz`
- npm integrity: `sha512-YUsh/bwcU/ScsWu5RGQT/CEZaQ6dL9xCgoYfHOHalJkEeWicv9lT7HqEGhle84EUTLL8a8T3vefw+fso7kPj6Q==`
- Git tag: `v0.2.0`
- GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.0`
- Published tarball size: 41.1 kB package size, 176.1 kB unpacked size, 49 files.

### Release Checklist

The `v0.2.0` release completed these checks before npm publish:

```bash
git status --short --branch
```

Release validation gate:

```bash
pnpm verify
pnpm example:typecheck
git diff --check
pnpm pack --dry-run
```

If an iOS build environment is available, also run a host-app iOS build or
native smoke test that links the pod and compresses a JPEG and PNG source to
JPEG output.

```bash
pnpm example:ios:pods
pnpm example:ios:build
pnpm example:ios:smoke
```

The iOS host-app smoke should produce `RNICK_IOS_SMOKE_PASS` after validating
capability reporting, JPEG and PNG to JPEG runtime compression, unsupported
WebP/HEIC/HEIF/AVIF/GIF input errors, unsupported non-JPEG output errors,
`output.maxBytes`, and `metadata: 'preserve'`.

Actual iOS host-app validation result for the implementation candidate:

- Date: June 30, 2026 UTC.
- Commit: `5bf0bcc6045175b3fe9efa9a2b5867fc32a63cc3`.
- GitHub Actions iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28424614173>.
- Environment: macOS GitHub Actions runner, Xcode 26.5, iPhoneSimulator 26.5 SDK, iPhone 17 Pro simulator on iOS 26.4.1.
- Native install/build evidence: CocoaPods installed 76 pods, React Native autolinked `react-native-image-compression-kit`, and `xcodebuild` completed with `BUILD SUCCEEDED`.
- Runtime smoke evidence: `RNICK_IOS_SMOKE_PASS` with `jpegResultBytes: 946`, `pngResultBytes: 1034`, `unsupportedInputs: ['webp', 'heic', 'heif', 'avif', 'gif']`, and `unsupportedOutputs: ['png', 'webp', 'heic', 'heif', 'avif']`.
- Same-commit CI evidence: CI passed at <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28424614148> and Android Instrumentation passed at <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28424614133>.
- Release documentation evidence: CI passed at <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28425030936>, Android Instrumentation passed at <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28425030943>, and iOS Validation passed at <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28425030985>.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, use a current passkey or one-time password:

```bash
pnpm whoami
pnpm publish --tag latest
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity time --json
npm pack react-native-image-compression-kit@0.2.0
```

### Post-publish Verification

Completed after npm publish:

- `pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.0`.
- `pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity time --json` confirmed version `0.2.0`, `latest` dist-tag `0.2.0`, registry tarball URL, integrity, and publish timestamp `2026-06-30T07:04:03.022Z`.
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.0.tgz`
- npm integrity: `sha512-YUsh/bwcU/ScsWu5RGQT/CEZaQ6dL9xCgoYfHOHalJkEeWicv9lT7HqEGhle84EUTLL8a8T3vefw+fso7kPj6Q==`
- `npm pack react-native-image-compression-kit@0.2.0` confirmed the published tarball contains 49 files, 41.1 kB package size, 176.1 kB unpacked size, and shasum `850a32e69d3c398e58b129ea330bc3d5a27eb5fd`.
- The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.
- A fresh temporary consumer project installed `react-native-image-compression-kit@0.2.0` from the npm registry with `pnpm install --ignore-scripts` and completed `pnpm typecheck` against public imports and types.
- GitHub Release `v0.2.0` was created at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.0`.

## v0.1.2

Status: published to npm on June 30, 2026 at 02:18:30 UTC (11:18:30 KST), tagged as `v0.1.2`.

This patch keeps Android runtime behavior unchanged while making the iOS stub
experience explicit across native errors, TypeScript fallback errors, README
guidance, and runtime capability reporting.

### Purpose

- Clarify that iOS ships a native package stub and iOS compression is not implemented.
- Preserve a stable iOS `ERR_NOT_IMPLEMENTED` compression failure with a message that points developers to capability checks.
- Make iOS capability reporting show no supported input formats, output formats, metadata policies, target-size compression, or cancellation.
- Update the TypeScript native-unavailable message so missing native module errors no longer imply that Android is unimplemented.
- Publish package metadata for `0.1.2` after the release candidate passed local and GitHub Actions validation.

### Published Artifacts

- npm package: `react-native-image-compression-kit@0.1.2`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.1.2.tgz`
- npm integrity: `sha512-OOHIV4Lnmu+16/W8iGMZriiYXLbB9nIVV0vBz4dd3erW3meaSqV28JkWpc/5FetIz0HcLU/4Pfgq8eTZ8fIY6g==`
- Git tag: `v0.1.2`
- GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.2`
- Published tarball size: 35.3 kB package size, 146.8 kB unpacked size, 49 files.

### Included

- iOS stub `compressImage()` error message aligned to the package-stub state.
- iOS `getImageCompressionCapabilities()` reports `metadataPolicies: []`, format `input=false`, format `output=false`, `supportsTargetSizeCompression: false`, and `supportsCancellation: false`.
- TypeScript `ERR_NATIVE_MODULE_UNAVAILABLE` message distinguishes install/linking failure from the expected iOS stub `ERR_NOT_IMPLEMENTED` path.
- README iOS stub behavior guidance and release dry-run wording updates.
- `package.json` version bump to `0.1.2`.
- Focused test and Android verification doctor expectation updates for the `0.1.2` release.

### Not Included

- iOS compression implementation.
- Android runtime behavior changes.
- New supported input or output formats.

### Pre-publish Checklist

Before publishing `v0.1.2`, confirm the working tree and branch are correct:

```bash
git status --short --branch
```

Run the release-candidate verification gate:

```bash
pnpm verify
pnpm example:typecheck
git diff --check
```

For packaging validation before promotion, also run:

```bash
pnpm release:dry-run
```

After local validation, commit the prepared patch, push the release commit, and
wait for GitHub Actions CI success on the pushed commit.

Only after the release commit and CI are confirmed, create and push the
annotated tag:

```bash
git tag -a v0.1.2 -m "v0.1.2"
git push origin v0.1.2
```

Do not run the tag commands as part of local candidate preparation. They are a
manual promotion step after validation and CI are green.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, pass a current one-time password:

```bash
pnpm login --registry=https://registry.npmjs.org/
pnpm whoami
pnpm publish --otp 123456
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version dist.integrity time --json
npm pack react-native-image-compression-kit@0.1.2
```

### Post-publish Verification

Completed after npm publish:

- `npm publish --tag latest` published `react-native-image-compression-kit@0.1.2`.
- `pnpm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity time --json` confirmed version `0.1.2`, `latest` dist-tag `0.1.2`, registry tarball URL, integrity, and publish timestamp `2026-06-30T02:18:30.591Z`.
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.1.2.tgz`
- npm integrity: `sha512-OOHIV4Lnmu+16/W8iGMZriiYXLbB9nIVV0vBz4dd3erW3meaSqV28JkWpc/5FetIz0HcLU/4Pfgq8eTZ8fIY6g==`
- `npm pack react-native-image-compression-kit@0.1.2` confirmed the published tarball contains 49 files, 35.3 kB package size, and 146.8 kB unpacked size.
- The published tarball includes the README, iOS native stub, built JS, TypeScript declarations, Codegen source, Android runtime source, package metadata, SECURITY, and LICENSE.
- Published tarball inspection confirmed the iOS `ERR_NOT_IMPLEMENTED` message, `metadataPolicies: []`, no iOS input/output format support notes, and TypeScript native-unavailable message are present.
- A fresh temporary consumer project installed `react-native-image-compression-kit@0.1.2` from the npm registry with `pnpm install --ignore-scripts` and completed `pnpm typecheck` against public imports and types.
- GitHub Release `v0.1.2` was created at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.2`.

## v0.1.1

Status: prepared for a docs-only npm patch release. This preparation does not
publish to npm, create a git tag, or push commits.

This patch corrects the README content that appears on the npm package page
after the Android `0.1.0` release. It aligns the first-screen project status
with the real registry state: the Android MVP is published, while iOS remains a
package stub and iOS compression is not implemented.

### Purpose

- Remove stale README wording that said the package had not been published to npm.
- Replace React Native and TypeScript badge values that still described those surfaces as planned.
- Make the README first screen clear that Android MVP runtime compression is published and iOS is stubbed/not implemented.
- Bump package metadata to `0.1.1` so the next npm publish can update the package page with corrected docs.
- Keep the `v0.1.0` release notes as the source for the original Android MVP artifact details.

### Included

- README status, badges, public API wording, installation wording, and release checklist wording updates.
- `package.json` version bump to `0.1.1`.
- `RELEASE.md` entry for this docs-only patch release.
- Repository verification expectations updated for the `0.1.1` preparation state.

### Not Included

- Android runtime behavior changes.
- iOS compression implementation.
- New native APIs or package exports.
- npm publish, git tag creation, or git push.

### Pre-publish Checklist

Before publishing `v0.1.1`, confirm the working tree and branch are correct:

```bash
git status --short --branch
```

Confirm the registry state and intended version:

```bash
pnpm view react-native-image-compression-kit version versions time --json
```

Run the release dry-run gate:

```bash
pnpm release:dry-run
```

After local validation, commit the prepared docs-only release, push the release
commit, and wait for GitHub Actions CI success on the pushed commit.

Only after the release commit and CI are confirmed, create and push the
annotated tag:

```bash
git tag -a v0.1.1 -m "v0.1.1"
git push origin v0.1.1
```

Do not run the tag commands as part of local dry-run preparation. They are a
manual promotion step after validation and CI are green.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, pass a current one-time password:

```bash
pnpm login --registry=https://registry.npmjs.org/
pnpm whoami
pnpm publish --otp 123456
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version dist.integrity time --json
npm pack react-native-image-compression-kit@0.1.1
```

### Post-publish Verification

Completed after npm publish:

- `pnpm publish --no-git-checks` published `react-native-image-compression-kit@0.1.1`.
- `npm view react-native-image-compression-kit version versions dist-tags dist.tarball dist.integrity time --json` confirmed version `0.1.1`, `latest` dist-tag `0.1.1`, registry tarball URL, integrity, and publish timestamp `2026-06-29T07:18:19.684Z`.
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.1.1.tgz`
- npm integrity: `sha512-pnLxeyn/JVKykGbOKrS9GYoU+pKr/oq4nffdHPn97ycjOw//RD6Yd6BGUPNuRcVoqnS17QsYgGx2c5JXWQq4BA==`
- `npm pack react-native-image-compression-kit@0.1.1` confirmed the published tarball contains 49 files, 35.1 kB package size, and 144.8 kB unpacked size.
- The published tarball and a fresh registry install both include the corrected README status, Android MVP published badge, Android MVP / iOS stub platform badge, React Native Codegen-ready badge, TypeScript API-available badge, and iOS stub/not implemented wording.
- Published README verification found no stale `has not been published to npm yet`, `React%20Native-planned`, or `TypeScript-planned` snippets.
- A fresh temporary consumer project installed `react-native-image-compression-kit@0.1.1` from the npm registry with `pnpm install --ignore-scripts` and completed `pnpm typecheck` against public imports and types.

## v0.1.0

Status: published to npm on June 27, 2026 at 10:51:55 UTC (19:51:55 KST), tagged as `v0.1.0`.

This release note describes the first public package release for
`react-native-image-compression-kit`, published as
`react-native-image-compression-kit@0.1.0`. It should stay aligned with the
Android MVP implementation and the README.

### Published Artifacts

- npm package: `react-native-image-compression-kit@0.1.0`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.1.0.tgz`
- npm integrity: `sha512-W8kaa3eKdWVLHCGeApdOqNMfeD7np42OcgjGCUZAQDZqzx86diybRtEqK+MJtX73Yt4wLcVKOtb62sPtLJLk9g==`
- Git tag: `v0.1.0`
- GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.0`
- Published tarball size: 34.2 kB package size, 142.2 kB unpacked size, 48 files.

### Included

- Android MVP only. iOS exports the package stub, but iOS compression is not implemented.
- TypeScript API exports, validation, React Native Codegen spec, and Android native module wiring.
- `file://` and `content://` local URI sources.
- JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input.
- GIF input is decoded as a static first frame.
- HEIC / HEIF input is SDK-gated: Android API 28+ uses ImageDecoder, Android API 26-27 attempts a guarded BitmapFactory fallback, and lower API levels reject as unsupported.
- Android 14+ AVIF input through the platform ImageDecoder path for baseline still images.
- JPEG EXIF orientation correction before resize and output encoding.
- Resize with `contain`, `cover`, and `stretch`.
- JPEG, PNG, and WebP output.
- Quality handling for JPEG and WebP output; PNG output ignores quality.
- Target-size compression with maxBytes for JPEG and WebP output; PNG output rejects maxBytes.
- Metadata policies preserve, safe, and strip for JPEG source to JPEG output.
- Runtime capability reporting through `getImageCompressionCapabilities()`.
- Package metadata, pack dry-run, consumer smoke test, and npm publish dry-run checks.

### Not Included

- iOS compression is not implemented.
- AVIF output is not implemented.
- HEIC / HEIF output is not implemented.
- GIF output and animation preservation are not implemented.
- Animated WebP and animated AVIF preservation are not implemented.
- Metadata support for non-JPEG formats and iOS is not implemented.
- Cancellation and progress callbacks are not implemented.

### Release Checklist

The `v0.1.0` release completed these checks before npm publish:

- Confirm `package.json` still has version `0.1.0`.
- Review this v0.1.0 release note and README release status for consistency with the implemented Android MVP.
- Confirm the working tree and branch are correct:

```bash
git status --short --branch
```

- Run the release dry-run gate:

```bash
pnpm release:dry-run
```

- Push the release commit and wait for GitHub Actions CI success on `master`.
- Keep the Android Instrumentation workflow result in mind for codec-backed HEIC / HEIF / AVIF validation.
- Only after the release commit and CI are confirmed, create and push the annotated tag:

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

Do not run the tag commands as part of the dry-run checklist. They are a manual
promotion step after local validation and GitHub Actions CI are green.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, pass a current one-time password:

```bash
pnpm login --registry=https://registry.npmjs.org/
pnpm whoami
pnpm publish --otp 123456
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version dist.integrity
```

### Post-publish Security Review

Completed after npm publish:

- `pnpm view react-native-image-compression-kit version dist.tarball dist.integrity time --json` confirmed version `0.1.0`, registry tarball URL, integrity, and publish timestamp.
- `npm pack react-native-image-compression-kit@0.1.0` confirmed the published tarball contains 48 files and excludes development-only scripts, tests, fixtures, example app files, build directories, and debug keystores.
- The published `package.json` contains no `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, `postpack`, `publish`, or `postpublish` lifecycle scripts.
- Registry tarball forbidden-file scan found no `.env*`, `.npmrc`, key files, debug keystore, Android test directories, example app files, or repository scripts.
- Registry tarball secret-like string scan found no npm tokens, GitHub tokens, auth tokens, private key blocks, passwords, or broad secret markers.
- `pnpm audit --prod` reported no known vulnerabilities.

### External Install Smoke

Completed after npm publish and GitHub Release creation:

- Created a fresh temporary consumer project outside this repository.
- Installed `react-native-image-compression-kit@0.1.0` from the npm registry with `pnpm install --ignore-scripts`.
- Confirmed dependency resolution with `pnpm list react-native-image-compression-kit react-native react --depth 0`.
- Typechecked imports for `compressImage`, `getImageCompressionCapabilities`, `ImageCompressionKitError`, `CompressionOptions`, `CompressionResult`, and `ImageCompressionCapabilities`.
- `pnpm typecheck` completed successfully in the external consumer project.

The GitHub Release was created from this note:

```bash
gh release create v0.1.0 --title "v0.1.0" --notes-file RELEASE.md
```
