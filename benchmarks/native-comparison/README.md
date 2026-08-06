# Native comparison plan

This directory owns the exact, reviewable inputs for the repository-private
native comparison. It is outside the published npm package and exists so users
can inspect which implementations were measured without trusting a generated
table.

## Selection boundary

The plan includes two external MIT-licensed libraries with Android and iOS
support and a public JPEG resize API:

- [`react-native-compressor`](https://github.com/numandev1/react-native-compressor)
  represents a broader media-compression API. Version 1.19.4 is the final
  pre-Nitro release and keeps the documented resize bounds working through its
  public API on both captured platforms without a local patch.
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
- Require the bundled 800 by 1280 fixture to produce the planned 200 by 320
  output on every measured sample; fail before publishing evidence on drift.
- Time the compression API call and perform adapter-specific metric inspection
  after the timer.
- Preserve the rotating round-robin schedule, two warmups, ten measured rounds,
  raw samples, and fail-closed evidence validation.
- Record unsupported behavior explicitly instead of fabricating a timing value.

The React Native 0.86 iOS example disables the prebuilt React Native core and
dependency pods. That version's prebuilt mode does not expose the `RCT-Folly`
pod target required by the exact published image-resizer podspec. Building the
example pods from source preserves the unpatched upstream comparator and gives
all three adapters the same application environment; metric inspection remains
outside the timed operation.

On Android, `react-native-compressor@1.19.4` brings in `TAndroidLame`, whose
library manifest declares `allowBackup=true`. The example application keeps
its existing `allowBackup=false` security boundary and resolves the manifest
merge explicitly with `tools:replace="android:allowBackup"`; the comparator
and its transitive dependency remain unpatched.

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
