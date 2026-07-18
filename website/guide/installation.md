# Installation

## Requirements

| Target | Requirement |
| --- | --- |
| Android | API 23 or newer |
| iOS | iOS 13.4 or newer |
| React Native | `>=0.73 <1.0`; verified at 0.73.11 Legacy and 0.86.0 Legacy/New |
| Expo | 57.0.7 development build verified; Expo Go and Snack are unsupported |

The package contains custom Android and iOS code. Every installation or version
change requires rebuilding the native application.

The [exact compatibility matrix](../reference/compatibility.md) records the
tested Node, React Native, Expo, architecture, and platform lanes. Intermediate
React Native versions inside the peer range are not individually release
tested.

## Bare React Native

```bash
npm install react-native-image-compression-kit
```

Autolinking discovers the package. Rebuild Android from the application root:

```bash
npx react-native run-android
```

Install iOS pods, then rebuild:

```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

If the JavaScript package resolves but `ERR_NATIVE_MODULE_UNAVAILABLE` is
returned, stop Metro, clean the native build when needed, reinstall pods on
iOS, and rebuild the application binary.

## Expo development build

Expo Go and Snack cannot load this custom native module. Add the package to an
Expo project, regenerate the native projects, and run a development build:

```bash
npm install react-native-image-compression-kit
npx expo prebuild
npx expo run:android
# or: npx expo run:ios
```

After changing the package version, rebuild the development client. A Metro
reload alone cannot add or update native code.

## First capability check

```ts
import { getImageCompressionCapabilities } from 'react-native-image-compression-kit';

const capabilities = await getImageCompressionCapabilities();
console.log(capabilities.platform, capabilities.formats);
```

Continue with [image picker integration](./integration.md) or the
[compression recipes](./recipes.md).
