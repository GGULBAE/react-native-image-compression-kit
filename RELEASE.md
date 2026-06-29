# Release Notes

## v0.1.1

Status: prepared for a docs-only npm patch release. This preparation does not
publish to npm, create a git tag, or push commits.

This patch corrects the README content that appears on the npm package page
after the Android `0.1.0` release. It aligns the first-screen project status
with the real registry state: the Android MVP is published, while iOS remains a
package stub and iOS compression is not implemented.

### Purpose

- Remove stale README wording that said the package had not been published to npm.
- Replace React Native and TypeScript badge values that still described those surfaces as planned.
- Make the README first screen clear that Android MVP runtime compression is published and iOS is stubbed/not implemented.
- Bump package metadata to `0.1.1` so the next npm publish can update the package page with corrected docs.
- Keep the `v0.1.0` release notes as the source for the original Android MVP artifact details.

### Included

- README status, badges, public API wording, installation wording, and release checklist wording updates.
- `package.json` version bump to `0.1.1`.
- `RELEASE.md` entry for this docs-only patch release.
- Repository verification expectations updated for the `0.1.1` preparation state.

### Not Included

- Android runtime behavior changes.
- iOS compression implementation.
- New native APIs or package exports.
- npm publish, git tag creation, or git push.

### Pre-publish Checklist

Before publishing `v0.1.1`, confirm the working tree and branch are correct:

```bash
git status --short --branch
```

Confirm the registry state and intended version:

```bash
pnpm view react-native-image-compression-kit version versions time --json
```

Run the release dry-run gate:

```bash
pnpm release:dry-run
```

After local validation, commit the prepared docs-only release, push the release
commit, and wait for GitHub Actions CI success on the pushed commit.

Only after the release commit and CI are confirmed, create and push the
annotated tag:

```bash
git tag -a v0.1.1 -m "v0.1.1"
git push origin v0.1.1
```

Do not run the tag commands as part of local dry-run preparation. They are a
manual promotion step after validation and CI are green.

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, pass a current one-time password:

```bash
pnpm login --registry=https://registry.npmjs.org/
pnpm whoami
pnpm publish --otp 123456
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version dist.integrity time --json
npm pack react-native-image-compression-kit@0.1.1
```

## v0.1.0

Status: published to npm on June 27, 2026 at 10:51:55 UTC (19:51:55 KST), tagged as `v0.1.0`.

This release note describes the first public package release for
`react-native-image-compression-kit`, published as
`react-native-image-compression-kit@0.1.0`. It should stay aligned with the
Android MVP implementation and the README.

### Published Artifacts

- npm package: `react-native-image-compression-kit@0.1.0`
- npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.1.0.tgz`
- npm integrity: `sha512-W8kaa3eKdWVLHCGeApdOqNMfeD7np42OcgjGCUZAQDZqzx86diybRtEqK+MJtX73Yt4wLcVKOtb62sPtLJLk9g==`
- Git tag: `v0.1.0`
- GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.0`
- Published tarball size: 34.2 kB package size, 142.2 kB unpacked size, 48 files.

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

### Release Checklist

The `v0.1.0` release completed these checks before npm publish:

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

### Publish Commands

The npm publish step requires an authenticated npm registry session. If npm
two-factor authentication is enabled, pass a current one-time password:

```bash
pnpm login --registry=https://registry.npmjs.org/
pnpm whoami
pnpm publish --otp 123456
```

After publish, verify the registry version:

```bash
pnpm view react-native-image-compression-kit version dist.integrity
```

### Post-publish Security Review

Completed after npm publish:

- `pnpm view react-native-image-compression-kit version dist.tarball dist.integrity time --json` confirmed version `0.1.0`, registry tarball URL, integrity, and publish timestamp.
- `npm pack react-native-image-compression-kit@0.1.0` confirmed the published tarball contains 48 files and excludes development-only scripts, tests, fixtures, example app files, build directories, and debug keystores.
- The published `package.json` contains no `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, `postpack`, `publish`, or `postpublish` lifecycle scripts.
- Registry tarball forbidden-file scan found no `.env*`, `.npmrc`, key files, debug keystore, Android test directories, example app files, or repository scripts.
- Registry tarball secret-like string scan found no npm tokens, GitHub tokens, auth tokens, private key blocks, passwords, or broad secret markers.
- `pnpm audit --prod` reported no known vulnerabilities.

### External Install Smoke

Completed after npm publish and GitHub Release creation:

- Created a fresh temporary consumer project outside this repository.
- Installed `react-native-image-compression-kit@0.1.0` from the npm registry with `pnpm install --ignore-scripts`.
- Confirmed dependency resolution with `pnpm list react-native-image-compression-kit react-native react --depth 0`.
- Typechecked imports for `compressImage`, `getImageCompressionCapabilities`, `ImageCompressionKitError`, `CompressionOptions`, `CompressionResult`, and `ImageCompressionCapabilities`.
- `pnpm typecheck` completed successfully in the external consumer project.

The GitHub Release was created from this note:

```bash
gh release create v0.1.0 --title "v0.1.0" --notes-file RELEASE.md
```
