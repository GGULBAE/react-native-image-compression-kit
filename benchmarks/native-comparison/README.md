# Native comparison plan

This directory owns the exact, reviewable inputs for the repository-private
native comparison. It is outside the published npm package and exists so users
can inspect which implementations were measured without trusting a generated
table.

## Selection boundary

The plan includes two external MIT-licensed libraries with Android and iOS
support and a public JPEG resize API:

- [`react-native-compressor`](https://github.com/numandev1/react-native-compressor)
  represents a broader media-compression API and uses
  `react-native-nitro-modules` in the pinned major version.
- [`@bam.tech/react-native-image-resizer`](https://github.com/bamlab/react-native-image-resizer)
  represents a focused image-resize API.

Selection is not an endorsement or a claim that these are the only relevant
alternatives. Exact versions, source-tag commits, licenses, and npm registry
integrities live in `implementations.json`. A capture copies that plan into the
artifact and binds it by SHA-256.

## Adapter rules

- Keep comparison dependencies in `example/package.json`; never add them to the
  root package dependency fields or npm file allowlist.
- Pin exact versions. Do not use ranges, tags, Git branches, or unreviewed local
  patches.
- Map only the common 320 by 320 contain resize and JPEG quality-80 operation.
- Time the compression API call and perform adapter-specific metric inspection
  after the timer.
- Preserve the rotating round-robin schedule, two warmups, ten measured rounds,
  raw samples, and fail-closed evidence validation.
- Record unsupported behavior explicitly instead of fabricating a timing value.

## Updating an implementation

1. Confirm the upstream repository, tag commit, package license, peer
   dependencies, and registry integrity from primary sources.
2. Update the exact example dependency, `implementations.json`, and adapter in
   one focused change.
3. Run `pnpm install --frozen-lockfile`, `pnpm test:coverage`, `pnpm verify`,
   `pnpm example:typecheck`, and `pnpm pack --dry-run`.
4. Use the GitHub-hosted Android and iOS Native Demo Evidence jobs as the
   executable authority when the local native toolchains are unavailable.
5. Inspect both platform artifacts with
   `pnpm verify:benchmark-comparison-evidence -- <artifact-dir>` before using
   any numbers in documentation.
