# v0.3.0 channel kit

This file prepares launch copy; it does not authorize posting. Obtain explicit
approval for each external destination and adapt the copy to that community's
current rules instead of cross-posting an identical message.

## Core story

**One sentence:** Capability-aware native image compression for React Native,
with explicit byte budgets, metadata policy, and evidence-backed Android/iOS
support.

Representative uses:

1. Resize a gallery or camera image before upload and keep JPEG/WebP output
   under an application byte limit.
2. Create profile, marketplace, or messaging images while applying an explicit
   `safe` or `strip` metadata policy.
3. Query device capabilities and choose a supported output format rather than
   assuming that every Android and iOS runtime exposes the same codecs.

Honest limits:

- Inputs must be app-readable local URIs; remote and data URIs are unsupported.
- Expo requires prebuild or a development build. Expo Go and Snack are
  unsupported.
- HEIC, HEIF, and AVIF output are not implemented. Codec availability and exact
  output bytes can vary by OS and device.
- Results are cache files owned by the consuming app; copy durable results and
  delete temporary files when they are no longer needed.

## Assets

- Landing/social card: https://ggulbae.github.io/react-native-image-compression-kit/social-card.svg
- Native evidence explorer: https://ggulbae.github.io/react-native-image-compression-kit/demo/
- Android screenshot: https://ggulbae.github.io/react-native-image-compression-kit/demo/android/screen.png
- iOS screenshot: https://ggulbae.github.io/react-native-image-compression-kit/demo/ios/screen.png
- Short native-result video: https://ggulbae.github.io/react-native-image-compression-kit/demo/native-demo.mp4
- Capability table: https://ggulbae.github.io/react-native-image-compression-kit/guide/capabilities

Do not use an asset until its URL and manifest digest work from a signed-out
browser session.

## Recommended sequence

1. Publish npm provenance and the immutable GitHub Release.
2. Deploy and smoke-test the Pages site and evidence assets.
3. Submit a React Native Directory entry with the repository example, native
   screenshots, Android/iOS support, Expo Go disabled, and New Architecture
   support. The package was not present in the Directory source at the
   2026-07-18 baseline check, so this is a new entry rather than an update.
4. With approval, open one GitHub Discussion linking the release and asking for
   integration feedback.
5. After an observation window, adapt the short English post for Reactiflux and
   other React Native community channels that permit library announcements.
6. Publish the technical article, then use the short Korean or English social
   post once per relevant account. Do not repeat it across unrelated groups.

## Short English post

React Native Image Compression Kit v0.3.0 adds a public integration site,
native Android/iOS result evidence, verified RN 0.73–0.86 Legacy/New
Architecture lanes, and provenance-backed npm publishing. It supports resize,
byte targets, metadata policy, and runtime codec checks. Expo needs a dev build;
Expo Go is unsupported. https://ggulbae.github.io/react-native-image-compression-kit/

## 짧은 한국어 게시물

React Native Image Compression Kit v0.3.0을 준비했습니다. 이미지 리사이즈,
목표 용량, 메타데이터 정책과 런타임 codec 확인을 작은 public API로 제공하고,
Android/iOS 실제 결과와 RN 0.73–0.86 Legacy/New Architecture 검증 근거를
공개합니다. Expo는 development build가 필요하며 Expo Go는 지원하지 않습니다.
https://ggulbae.github.io/react-native-image-compression-kit/

## Community message

I maintain `react-native-image-compression-kit`, a small native module for
resize, format conversion, target-size compression, and metadata policy. The
v0.3.0 launch focuses on verifiable adoption: exact compatibility lanes, a
native before/after evidence manifest, typed errors, Expo development-build
guidance, and npm provenance. I would especially value feedback on real picker
URIs and build combinations. Expo Go is not supported, and I am not claiming
cross-device byte determinism or benchmark superiority.

## Technical article outline

1. Why image compression support is a capability question, not one boolean.
2. Designing byte targets and metadata policy without hiding platform limits.
3. Testing packed consumers across RN floor/current, Legacy/New, and Expo
   development builds.
4. Producing native demo evidence without pretending the browser runs the
   native codec.
5. Publishing one exact tarball through OIDC and verifying registry provenance.
6. Known limits and the next evidence-driven improvements.
