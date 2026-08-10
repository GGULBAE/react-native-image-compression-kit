# Roadmap

The roadmap is organized around user problems and acceptance evidence, not
dates. No roadmap item is a release promise.

## Current priorities

- Make Bare React Native and Expo development-build failures easier to
  reproduce and diagnose.
- Keep Legacy/New Architecture and React Native/Expo compatibility claims tied
  to fresh native consumer builds.
- Expand measured benchmark scenarios beyond the current fixed JPEG plan while
  retaining raw samples and exact environment identity.
- Preserve bounded processing, cancellation cleanup, dependency security, and
  fail-closed delivery checks.

## Evidence-gated candidates

HEIC, HEIF, or AVIF output, broader metadata preservation, and additional local
source adapters need a concrete use case and an agreed test contract before
implementation. Codec work must cover runtime capability detection,
decode-back validation, metadata and target-size behavior, cancellation,
resource limits, and transactional output.

Animation preservation, remote fetching, an image picker/editor, upload or CDN
features, and universal performance claims remain outside the current product
scope.

Read the complete
[roadmap](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/ROADMAP.md)
for status definitions, acceptance evidence, deferred work, non-goals, and the
change-proposal checklist. Design exploration starts in
[GitHub Discussions](https://github.com/GGULBAE/react-native-image-compression-kit/discussions).
