# Compatibility matrix

This page distinguishes executable evidence from a broad compatibility claim.
All v0.3.0 release-required lanes passed for the exact package source in
[Compatibility run 29635966120](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29635966120).

| Consumer lane | Architecture | Android | iOS | Status |
| --- | --- | --- | --- | --- |
| React Native 0.86 example | New | Build, unit, instrumentation | Host-app smoke | Verified on CI |
| React Native 0.73.11 fresh consumer | Legacy · Node 18 | Packed install/build passed | Packed install/build passed | Verified |
| React Native 0.86.0 fresh consumer | Legacy · Node 24 | Packed install/build passed | Packed install/build passed | Verified |
| React Native 0.86.0 fresh consumer | New · Node 24 | Packed install/build passed | Packed install/build passed | Verified |
| Expo 57.0.7 / React Native 0.86.0 | New · Node 24 | Prebuild + packed native build passed | Prebuild + packed native build passed | Verified |
| Expo Go / Snack | N/A | Unsupported | Unsupported | By design |

## Platform floor

- Android: API 23+
- iOS: 13.4+
- Node: 18+; Node 18 is exercised by the React Native floor lane and Node 24 by
  current React Native and Expo lanes.

The package peer range remains `>=0.73 <1.0`. React Native versions between
0.73.11 and 0.86.0 are accepted by that range but are not individually tested
by the release matrix. A verified row means a fresh app installed the packed
candidate tarball and completed its native Android or iOS build; it is not a
claim that every intermediate framework, OS, device, or codec combination was
exercised.

## Architecture meaning

New Architecture support uses the generated TurboModule spec and Codegen.
Legacy fallback resolves the module through `NativeModules`. A code path is not
listed as supported solely because it exists; the release matrix supplies the
fresh-consumer evidence.

The matrix is refreshed from exact CI runs before each compatibility-changing
release. Open a [compatibility report](https://github.com/GGULBAE/react-native-image-compression-kit/issues/new?template=compatibility.yml)
with the versions and architecture when a declared lane regresses.
