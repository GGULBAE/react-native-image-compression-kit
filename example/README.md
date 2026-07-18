# Example application

The example is a Bare React Native application that exercises the local
workspace package on Android and iOS. It retains a bundled image path for
deterministic CI and can also accept an app-readable local URI.

## Requirements

- Node.js 18 or newer and pnpm 11.7.0
- Android Studio/SDK 36, Java 21, and an API 23+ device or emulator
- Xcode, CocoaPods, and an iOS 13.4+ simulator or device

Install the workspace from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm example:typecheck
```

## Android

```bash
pnpm example:android
```

The bundled sample is copied from app assets into a readable local file by the
example-only native source helper. Gallery pickers commonly return a
`content://` URI; keep its temporary permission valid until compression
completes.

## iOS

```bash
pnpm example:ios:pods
pnpm example:ios
```

The example's bundled sample is exposed through an example-only native source
helper. A gallery integration should materialize or retain a readable local
file URL before calling the package.

## Deterministic validation

The repository uses the bundled input and native smoke hooks for repeatable
build and contract validation:

```bash
pnpm example:typecheck
pnpm example:codegen
pnpm example:android-unit-test
pnpm example:build
pnpm example:ios:smoke
```

Android and iOS codecs can emit different bytes across OS/device versions. A
public demo capture must record platform, OS/API level, device/simulator,
library source commit, options, dimensions, byte sizes, and input/output
SHA-256 in its manifest.

## Privacy and files

Do not use private user images for committed demo assets. Compression writes a
new cache file; the application must copy or upload durable results and delete
temporary outputs when they are no longer needed.
