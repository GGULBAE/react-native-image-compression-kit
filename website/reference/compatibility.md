# Compatibility matrix

This page distinguishes executable evidence from a declared or experimental
claim. The v0.3.0 candidate is not publishable until every supported lane has a
green release-gate result.

| Consumer lane | Architecture | Android | iOS | Status |
| --- | --- | --- | --- | --- |
| React Native 0.86 example | New | Build, unit, instrumentation | Host-app smoke | Verified on CI |
| Declared React Native floor | Legacy or New as applicable | Fresh packed consumer | Fresh packed consumer | Release-gated |
| React Native 0.86 fresh consumer | New | Packed install/build | Packed install/build | Release-gated |
| Expo development build | New | Prebuild/install smoke | Prebuild/install smoke | Release-gated |
| Expo Go / Snack | N/A | Unsupported | Unsupported | By design |

## Platform floor

- Android: API 23+
- iOS: 13.4+
- Node: package metadata currently declares 18+; the release matrix must test
  the floor or narrow it before publication.

## Architecture meaning

New Architecture support uses the generated TurboModule spec and Codegen.
Legacy fallback resolves the module through `NativeModules`. A code path is not
listed as supported solely because it exists; the release matrix supplies the
fresh-consumer evidence.

The matrix is updated from exact CI runs before each compatibility-changing
release. Open a [compatibility report](https://github.com/GGULBAE/react-native-image-compression-kit/issues/new?template=compatibility.yml)
with the versions and architecture when a declared lane regresses.
