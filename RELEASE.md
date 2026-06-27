# Release Notes

## v0.1.0

This release note describes the first public package release for
`react-native-image-compression-kit`. It should stay aligned with the Android
MVP implementation and the README before the package is published.

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
- Actual npm publish remains a separate manual step.

### Pre-publish Checklist

Complete these checks before publishing `v0.1.0` to npm:

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

### npm Publish Step

Log in to npm only after local validation, GitHub Actions CI, and the pushed
`v0.1.0` tag are confirmed:

```bash
pnpm login --registry=https://registry.npmjs.org/
pnpm whoami
pnpm publish
pnpm view react-native-image-compression-kit version
```

If npm two-factor authentication asks for a one-time password, run:

```bash
pnpm publish --otp 123456
```

After npm publish succeeds, create the GitHub Release from this note:

```bash
gh release create v0.1.0 --title "v0.1.0" --notes-file RELEASE.md
```
