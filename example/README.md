# Example application

The example is a Bare React Native application that exercises the local
workspace package on Android and iOS. It retains a bundled image path for
deterministic CI and can also accept an app-readable local URI.

## Requirements

- Node.js 22.13 or newer and pnpm 11.8.0
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

The Android sample is a repository-owned 600×960 JPEG generated from geometric
shapes, not a user image. Its reproducible source command is:

```bash
ffmpeg -f lavfi -i "gradients=size=600x960:c0=0x0f766e:c1=0x1d4ed8:x0=0:y0=0:x1=600:y1=960,drawbox=x=90:y=130:w=420:h=280:color=0xf59e0b:t=fill,drawbox=x=150:y=340:w=300:h=430:color=0x6ee7b7:t=fill,drawbox=x=205:y=630:w=190:h=190:color=0xf8fafc@0.86:t=fill" -frames:v 1 -q:v 2 -pix_fmt yuvj420p -y example/android/app/src/main/assets/sample.jpg
```

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
