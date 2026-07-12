import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import packageJson from '../package.json';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readProjectFile(filePath: string): string {
  return readFileSync(path.join(ROOT, filePath), 'utf8');
}

function readProjectBinary(filePath: string): Buffer {
  return readFileSync(path.join(ROOT, filePath));
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function readPngDimensions(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function extractKotlinArray(source: string, arrayName: string): string {
  const match = source.match(
    new RegExp(`(?:private\\s+)?val ${arrayName} = arrayOf\\(([\\s\\S]*?)\\n  \\)`)
  );

  if (!match) {
    throw new Error(`Could not find Kotlin array ${arrayName}.`);
  }

  return match[1] ?? '';
}

describe('Android verification scripts', () => {
  it('declares npm published package metadata', () => {
    const readmeSource = readProjectFile('README.md');
    const staleReadmeSnippets = [
      'Status: v0.2.8 candidate',
      'v0.2.8%20candidate',
      'This repository is preparing `react-native-image-compression-kit@0.2.8` as an unpublished tooling candidate.',
      'The latest npm `latest` dist-tag remains `react-native-image-compression-kit@0.2.7`',
      'GitHub Release [v0.2.7]',
      'The `0.2.8` package metadata is prepared as an unpublished tooling candidate for `react-native-image-compression-kit`',
      'The latest published npm package remains `0.2.7`',
      'version `0.2.8` is the unpublished post-publish registry smoke automation candidate',
      'v0.2.8 candidate notes',
      'Status: v0.2.10 candidate',
      'v0.2.10%20candidate',
      'Version `0.2.10` is an unpublished release candidate',
      'outside this candidate',
      'As of version `0.2.10` candidate',
      'The `0.2.10` package metadata is prepared as an unpublished AVIF input candidate',
      'version `0.2.10` is the unpublished iOS AVIF input capability-gated static decode candidate',
      'v0.2.10 candidate notes',
      'Status: v0.2.10 release-ready',
      'v0.2.10%20release--ready',
      'Version `0.2.10` is release-ready',
      'It has not been published to npm yet',
      'until that publish happens, the latest published npm package remains `0.2.9`',
      'The `0.2.10` package metadata is release-ready',
      'Version `0.2.10` has not been published to npm yet',
      'version `0.2.10` is the release-ready iOS AVIF input capability-gated static decode release',
      'v0.2.10 release-ready notes',
      'Status: v0.2.10 published',
      'v0.2.10%20published',
      'Version `0.2.10` is published for `react-native-image-compression-kit`',
      'The latest published npm package is `0.2.10`',
      'GitHub Release [v0.2.10]',
      'The `0.2.10` package metadata is published for `react-native-image-compression-kit`',
      'Status: v0.2.12 published',
      'v0.2.12%20published',
      'Version `0.2.12` is published for `react-native-image-compression-kit`',
      'The latest published npm package is `0.2.12`',
      'The `0.2.12` package metadata is published for `react-native-image-compression-kit`',
      'Status: v0.2.13 published',
      'v0.2.13%20published',
      'Version `0.2.13` is published for `react-native-image-compression-kit`',
      'The `0.2.13` package metadata is published for `react-native-image-compression-kit`',
      'Status: v0.2.14 candidate',
      'v0.2.14%20candidate',
      'Version `0.2.14` is an unpublished release candidate for `react-native-image-compression-kit`',
      'latest published npm package is `0.2.13`',
      'The `0.2.14` package metadata is prepared as an unpublished AVIF output capability/error surface candidate',
      'version `0.2.14` is the unpublished AVIF output capability/error surface candidate',
      'v0.2.14 AVIF output capability/error surface candidate notes',
      'Status: v0.2.14 published',
      'v0.2.14%20published',
      'Version `0.2.14` is published for `react-native-image-compression-kit`',
      'The `0.2.14` package metadata is published for `react-native-image-compression-kit`',
      'Status: v0.2.15 published',
      'v0.2.15%20published',
      'Version `0.2.15` is published for `react-native-image-compression-kit`',
      'The `0.2.15` package metadata is published for `react-native-image-compression-kit`',
      'Status: v0.2.15 candidate',
      'v0.2.15%20candidate',
      'Version `0.2.15` is an unpublished release candidate for `react-native-image-compression-kit`',
      'It documents the AVIF output feasibility spike and keeps runtime AVIF output unsupported until platform-specific encoder paths can be validated.',
      'The `0.2.15` package metadata is prepared as an unpublished AVIF output feasibility candidate for `react-native-image-compression-kit`',
      'Status: v0.2.16 candidate',
      'v0.2.16%20candidate',
      'Version `0.2.16` is an unpublished release candidate for `react-native-image-compression-kit`',
      'It adds an internal Android AVIF output encoder route prototype and keeps runtime AVIF output unsupported until byte-signature, decode-back, metadata, and target-size behavior are validated.',
      'The `0.2.16` package metadata is prepared as an unpublished Android AVIF output encoder route prototype candidate for `react-native-image-compression-kit`',
      'Status: v0.2.16 published',
      'v0.2.16%20published',
      'Version `0.2.16` is published for `react-native-image-compression-kit`',
      'The `0.2.16` package metadata is published for `react-native-image-compression-kit`',
      'Status: v0.2.17 candidate',
      'v0.2.17%20candidate',
      'Version `0.2.17` is an unpublished release candidate for `react-native-image-compression-kit`',
      'latest published npm package is `0.2.14`',
      'GitHub Release [v0.2.14]',
      'The `0.2.17` package metadata is prepared as an unpublished Android AVIF output encode/decode-back smoke candidate for `react-native-image-compression-kit`',
      'version `0.2.17` is the unpublished Android AVIF output encode/decode-back smoke candidate',
      'v0.2.17 Android AVIF output encode/decode-back smoke candidate notes',
      'Status: v0.2.18 candidate',
      'v0.2.18%20candidate',
      'Version `0.2.18` is an unpublished docs-only npm README correction candidate for `react-native-image-compression-kit`',
      'The latest published npm package is `0.2.17`',
      'npm `latest` remains `0.2.17`',
      'The `0.2.18` package metadata is prepared as an unpublished docs-only npm README correction candidate for `react-native-image-compression-kit`',
      'version `0.2.18` is the unpublished docs-only npm package-page README correction candidate',
      'v0.2.18 docs-only npm README correction candidate notes',
      'Status: v0.2.18 published',
      'v0.2.18%20published',
      'Version `0.2.18` is published as a docs-only npm README correction for `react-native-image-compression-kit`',
      'The `0.2.18` package metadata is published as a docs-only npm README correction for `react-native-image-compression-kit`',
      'v0.2.18 published docs-only npm README correction release notes',
      'Status: v0.2.19 candidate',
      'v0.2.19%20candidate',
      'Version `0.2.19` is an unpublished AVIF output production gate candidate for `react-native-image-compression-kit`',
      'npm `latest` remains `0.2.18`',
      'Version `0.2.18` remains the latest published npm package and docs-only package-page README correction.',
      'No npm publish, git tag, or GitHub Release is part of the v0.2.19 candidate.',
      'The `0.2.19` package metadata is prepared as an unpublished AVIF output production gate candidate for `react-native-image-compression-kit`',
      'version `0.2.19` is the unpublished AVIF output production gate candidate',
      'v0.2.19 AVIF output production gate candidate notes',
      'Status: v0.2.40 candidate',
      'v0.2.40%20candidate',
      'Version `0.2.40` is an unpublished iOS AVIF-input unavailable PASS payload schema snapshot candidate',
      'npm `latest` remains `0.2.38`',
      'Version `0.2.38` remains the latest published npm package and iOS smoke PASS payload schema snapshot release.',
      'No npm publish, git tag, or GitHub Release is part of the v0.2.40 candidate.',
      'The `0.2.40` package metadata is prepared as an unpublished iOS AVIF-input unavailable PASS payload schema snapshot candidate',
      'version `0.2.40` is the unpublished iOS AVIF-input unavailable PASS payload schema snapshot candidate',
      'The v0.2.40 candidate fixes iOS AVIF-input unavailable PASS payload schema snapshot coverage.',
      'v0.2.40 iOS AVIF-input unavailable PASS payload schema snapshot candidate notes',
      'Status: v0.2.40 npm latest',
      'v0.2.40%20npm%20latest',
      'Version `0.2.40` is published to npm as the `latest` iOS AVIF-input unavailable PASS payload schema snapshot release',
      'Version `0.2.40` is the latest published npm package and iOS AVIF-input unavailable PASS payload schema snapshot release.',
      'No git tag or GitHub Release is part of this package-page promotion.',
      'The `0.2.40` package is published as the npm `latest` iOS AVIF-input unavailable PASS payload schema snapshot release',
      'Status: v0.2.47 candidate',
      'v0.2.47%20candidate',
      'Version `0.2.47` is an unpublished iOS PASS replay automation gate candidate for `react-native-image-compression-kit`.',
      'No npm publish, git tag, or GitHub Release is part of the v0.2.47 candidate.',
      'The `0.2.47` package metadata is prepared as an unpublished iOS PASS replay automation gate candidate for `react-native-image-compression-kit`',
      'Version `0.2.47` is the unpublished iOS PASS replay automation gate candidate.',
      'The v0.2.47 candidate fixes semantic PASS payload validation',
      'The current v0.2.47 iOS PASS replay automation gate candidate notes',
      'Status: v0.2.48 candidate',
      'v0.2.48%20candidate',
      'Version `0.2.48` is an unpublished registry provenance and manual CI gate candidate for `react-native-image-compression-kit`',
      'No npm publish, dist-tag change, git tag, or GitHub Release is part of this candidate.',
      'The repository is preparing `0.2.48` as an unpublished registry provenance and manual CI gate candidate.',
      'Version `0.2.48` is the unpublished registry provenance and manual CI gate candidate.',
      'The v0.2.48 candidate adds a canonical registry provenance report',
      'The v0.2.48 registry provenance and manual CI gate candidate notes',
    ];
    const expectedKeywords = [
      'react-native',
      'image',
      'image-processing',
      'compression',
      'resize',
      'transcode',
      'jpeg',
      'png',
      'webp',
      'heic',
      'heif',
      'avif',
    ];

    expect(packageJson.name).toBe('react-native-image-compression-kit');
    expect(packageJson.version).toBe('0.2.50');
    expect(packageJson.license).toBe('MIT');
    expect(packageJson.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/GGULBAE/react-native-image-compression-kit.git',
    });
    expect(packageJson.bugs).toEqual({
      url: 'https://github.com/GGULBAE/react-native-image-compression-kit/issues',
    });
    expect(packageJson.homepage).toBe(
      'https://github.com/GGULBAE/react-native-image-compression-kit#readme'
    );
    expect(packageJson.main).toBe('lib/index.js');
    expect(packageJson.types).toBe('lib/index.d.ts');
    expect(packageJson.exports['.']).toEqual({
      types: './lib/index.d.ts',
      default: './lib/index.js',
    });
    expect(packageJson.peerDependencies['react-native']).toBe('>=0.73 <1.0');
    expect(packageJson.files).toContain('README.md');
    expect(packageJson.files).toContain('SECURITY.md');
    expect(packageJson.files).toContain('LICENSE');

    for (const keyword of expectedKeywords) {
      expect(packageJson.keywords).toContain(keyword);
    }

    expect(readmeSource).toContain(
      'Version `0.2.50` is an unpublished GitHub artifact attestation and offline identity verification candidate for `react-native-image-compression-kit`; npm `latest` remains the published `0.2.48` release.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.49` was the previous unpublished Registry provenance bundle offline verification candidate.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.48` is published to npm as the `latest` registry provenance and manual CI gate release for `react-native-image-compression-kit`.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.47` was the previous npm `latest` iOS PASS replay automation gate release for `react-native-image-compression-kit`.'
    );
    expect(readmeSource).toContain(
      '`validateIOSSmokePassPayload()` now enforces the exact capability-selected field order'
    );
    expect(readmeSource).toContain(
      '`validateIOSSmokePassReplayFixture()` applies that semantic contract'
    );
    expect(readmeSource).toContain(
      'adds source-log-free `--audit`'
    );
    expect(readmeSource).toContain(
      'stable machine-readable `schemaVersion`, `mode`, `status`, `artifactPath`, `differences`, and `error` fields'
    );
    expect(readmeSource).toContain(
      '`pnpm verify` and the iOS Validation workflow now run the standalone audit'
    );
    expect(readmeSource).toContain(
      'The CLI performs no GitHub or other network requests.'
    );
    expect(readmeSource).toContain(
      'pnpm fixtures:ios-pass-replay --'
    );
    expect(readmeSource).toContain(
      'pnpm fixtures:ios-pass-replay:check --'
    );
    expect(readmeSource).toContain(
      'pnpm fixtures:ios-pass-replay:audit -- --json'
    );
    expect(readmeSource).toContain(
      'regenerates the structured JSON fields'
    );
    expect(readmeSource).toContain(
      'Check and audit modes perform no writes; refresh, check, and audit perform no GitHub or other network requests.'
    );
    expect(readmeSource).toContain(
      'reusable semantic payload validator coverage across exact field order, positive result bytes, capability booleans, and unsupported-format consistency'
    );
    expect(readmeSource).toContain(
      'uploads the `ios-smoke-diagnostics` artifact only through `if: failure()` steps'
    );
    expect(readmeSource).toContain(
      'The GitHub Actions iOS Validation runner currently uses Xcode 26.5 and the iPhoneSimulator26.5 SDK'
    );
    expect(readmeSource).toContain(
      "The Android `compressImage()` scaffold still rejects `output.format: 'avif'` with `ERR_NOT_IMPLEMENTED` before source access or helper entry"
    );
    expect(readmeSource).toContain(
      'Registry verification confirmed both npm `version` and `dist-tags.latest` at `0.2.48`.'
    );
    expect(readmeSource).toContain(
      'The real 51-file registry tarball retained the registry-independent `Status: v0.2.48 release` package README'
    );
    expect(readmeSource).toContain(
      'No git tag or GitHub Release was created as part of this npm-only promotion.'
    );
    expect(readmeSource).toContain(
      'The repository package metadata is `0.2.50` for the unpublished GitHub artifact attestation and offline identity verification candidate, while npm `latest` remains the published `0.2.48` registry provenance and manual CI gate release.'
    );
    expect(readmeSource).toContain(
      'version `0.2.0` is the published iOS native JPEG MVP release'
    );
    expect(readmeSource).toContain(
      'version `0.2.1` is the published iOS JPEG target-size release'
    );
    expect(readmeSource).toContain(
      'version `0.2.2` is the published iOS PNG output release'
    );
    expect(readmeSource).toContain(
      'version `0.2.3` is the published iOS GIF static first-frame input release'
    );
    expect(readmeSource).toContain(
      'version `0.2.4` is the published iOS WebP static first-frame input release'
    );
    expect(readmeSource).toContain(
      'version `0.2.5` is the published iOS runtime-gated WebP output release'
    );
    expect(readmeSource).toContain(
      'version `0.2.6` is the published iOS runtime-gated WebP target-size release'
    );
    expect(readmeSource).toContain(
      'version `0.2.7` is the published iOS HEIC/HEIF static input release'
    );
    expect(readmeSource).toContain(
      'version `0.2.8` is the published post-publish registry smoke automation release'
    );
    expect(readmeSource).toContain(
      'version `0.2.9` is the published docs-only npm package page README correction release'
    );
    expect(readmeSource).toContain(
      'version `0.2.10` is the published iOS AVIF input capability-gated static decode release'
    );
    expect(readmeSource).toContain(
      'version `0.2.11` is the published docs-only npm README correction release'
    );
    expect(readmeSource).toContain(
      'version `0.2.12` is the published iOS JPEG metadata preserve release'
    );
    expect(readmeSource).toContain(
      'version `0.2.13` is the published iOS JPEG metadata preserve hardening release'
    );
    expect(readmeSource).toContain(
      'version `0.2.14` is the published AVIF output capability/error surface release'
    );
    expect(readmeSource).toContain(
      'version `0.2.15` is the unpublished AVIF output feasibility candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.16` is the unpublished Android AVIF output encoder route prototype candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.17` is the published Android AVIF output encode/decode-back smoke release'
    );
    expect(readmeSource).toContain(
      'version `0.2.18` is the published docs-only npm package-page README correction release'
    );
    expect(readmeSource).toContain(
      'version `0.2.19` is the published AVIF output production gate release'
    );
    expect(readmeSource).toContain(
      'version `0.2.20` is the unpublished AVIF output production wiring preflight candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.21` is the unpublished Android AVIF output production wiring scaffold candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.22` is the unpublished Android AVIF output production helper extraction candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.23` is the unpublished Android AVIF output helper injectable validation seam candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.24` is the unpublished Android AVIF output helper injected success contract candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.25` is the unpublished Android AVIF output helper direct-output success contract candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.26` is the unpublished Android AVIF output helper validation detail contract candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.27` is the unpublished Android AVIF output helper blocked-route detail contract candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.28` is the unpublished Android AVIF output helper temp-file lifecycle contract candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.29` is the unpublished Android AVIF output helper validation-result provenance contract candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.30` is the unpublished iOS smoke retry and diagnostic hardening candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.31` is the unpublished iOS smoke diagnostic testability hardening candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.32` is the unpublished iOS smoke timeout CLI fixture coverage candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.33` is the unpublished iOS smoke process lifecycle fixture coverage candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.34` is the unpublished iOS smoke log stream error fixture coverage candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.35` is the unpublished iOS smoke diagnostics packed log artifact coverage candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.36` is the unpublished iOS smoke artifact failure-path dry-run fixture candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.37` is the unpublished iOS smoke diagnostics artifact schema snapshot candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.38` is the published iOS smoke PASS payload schema snapshot release'
    );
    expect(readmeSource).toContain(
      'version `0.2.39` is the unpublished iOS WebP-output available PASS payload schema snapshot candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.40` is the published iOS AVIF-input unavailable PASS payload schema snapshot release'
    );
    expect(readmeSource).toContain(
      'version `0.2.41` is the unpublished iOS PASS payload schema matrix helper candidate'
    );
    expect(readmeSource).toContain(
      'version `0.2.42` is the unpublished iOS PASS payload CI log replay fixture candidate'
    );
    expect(readmeSource).toContain(
      'Version `0.2.43` is the unpublished iOS PASS payload replay fixture provenance candidate.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.44` is the unpublished iOS PASS replay fixture source-line integrity digest candidate.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.45` is the unpublished iOS PASS replay fixture offline refresh artifact candidate.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.46` is the unpublished iOS PASS replay fixture offline check mode candidate.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.47` is the iOS PASS replay automation gate release.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.10` adds iOS AVIF input decoded as a runtime-available static ImageIO image.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.11` corrects the packaged npm README without runtime behavior changes.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.12` adds iOS JPEG metadata preserve for JPEG source to JPEG output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.13` hardens that iOS preserve path by normalizing output orientation and pixel dimension metadata.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.14` aligns AVIF output unsupported capability notes and `ERR_NOT_IMPLEMENTED` messages without adding AVIF encoding.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.15` documents the AVIF output feasibility decision without runtime behavior changes.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.16` adds an internal Android AVIF output encoder route prototype without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.17` adds an internal Android AVIF output encode/decode-back smoke attempt without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.18` corrects the packaged npm README without runtime behavior changes.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.19` clarifies the AVIF output production gate, capability notes, and `ERR_NOT_IMPLEMENTED` messages without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.20` adds Android AVIF output smoke production-decision blocker codes without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.21` adds an Android AVIF output production wiring scaffold without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.22` extracts the Android AVIF output encode/decode-back helper boundary without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.23` adds injectable Android AVIF output helper validation dependencies without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.24` fixes the injected Android AVIF output helper success contract without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.25` fixes the injected Android AVIF output helper direct-output success contract without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.26` fixes the Android AVIF output helper validation detail ordering contract without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.27` fixes the Android AVIF output helper blocked-route detail and smoke adapter contract without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.28` fixes the Android AVIF output helper temp-file lifecycle contract without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.29` fixes the Android AVIF output helper validation-result provenance contract without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.30` hardens iOS smoke retry and timeout diagnostics without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.31` hardens simulator-free iOS smoke diagnostic test coverage without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.32` hardens CLI-level iOS smoke timeout fixture coverage without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.33` hardens iOS smoke process lifecycle fixture coverage without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.34` hardens iOS smoke log stream error fixture coverage without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.35` hardens iOS smoke diagnostics packed log artifact coverage without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.36` hardens iOS smoke artifact failure-path dry-run fixture coverage without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.37` hardens iOS smoke diagnostics artifact schema snapshot coverage without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.38` hardens iOS smoke PASS payload schema snapshot coverage without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.39` hardens iOS WebP-output available PASS payload schema snapshot coverage without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.40` hardens iOS AVIF-input unavailable PASS payload schema snapshot coverage without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.41` hardens iOS PASS payload schema matrix helper coverage without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.42` hardens iOS PASS payload CI log replay fixture coverage without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.43` hardens iOS PASS payload replay fixture provenance and refresh guidance without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.44` hardens iOS PASS replay fixture source-line SHA-256 integrity without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.45` adds the structured replay artifact and offline deterministic refresh CLI without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.46` adds read-only offline artifact freshness checking without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.47` adds semantic payload validation, standalone audit mode, machine-readable reports, and local/CI audit gating without enabling AVIF output.'
    );
    expect(readmeSource).toContain(
      "Android `getImageCompressionCapabilities()` reports AVIF `input=true`, AVIF `output=false`, and notes that selecting `output.format: 'avif'` rejects with `ERR_NOT_IMPLEMENTED`."
    );
    expect(readmeSource).toContain(
      'Android AVIF output remains disabled until the MediaCodec image/avif encode/decode-back smoke produces a complete AVIF file with ftyp avif/avis signature and ImageDecoder decode-back validation.'
    );
    expect(readmeSource).toContain(
      "AVIF output is not implemented. `output.format: 'avif'` rejects with `ERR_NOT_IMPLEMENTED` even on runtimes that can decode AVIF input."
    );
    expect(readmeSource).toContain(
      'Future iOS AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation.'
    );
    expect(readmeSource).toContain(
      "metadata='preserve', output.maxBytes, and animated AVIF preservation remain unsupported for AVIF output until explicitly designed and tested."
    );
    expect(readmeSource).toContain('## AVIF Output Feasibility Spike');
    expect(readmeSource).toContain(
      'Android platform docs list AVIF baseline image encoder and decoder support on Android 14+'
    );
    expect(readmeSource).toContain(
      'the current Android implementation encodes through `Bitmap.compress()`'
    );
    expect(readmeSource).toContain('Future iOS AVIF output must mirror the WebP output path');
    expect(readmeSource).toContain('Current v0.2.15 capability reporting remains unchanged');
    expect(readmeSource).toContain('## Android AVIF Output Prototype');
    expect(readmeSource).toContain('MediaCodec image/avif encoder probe');
    expect(readmeSource).toContain('MediaCodecList.findEncoderForFormat()');
    expect(readmeSource).toContain('## Android AVIF Output Encode/Decode-Back Smoke');
    expect(readmeSource).toContain('MediaCodec image/avif encode/decode-back smoke');
    expect(readmeSource).toContain('MediaMuxer.MUXER_OUTPUT_HEIF');
    expect(readmeSource).toContain(
      'Current GitHub Android Instrumentation result: the API 35 Google APIs emulator does not expose an `image/avif` encoder through `MediaCodecList.findEncoderForFormat()`.'
    );
    expect(readmeSource).toContain(
      'The smoke therefore reports `attempted=false`, `success=false`, `blockerCode=no_image_avif_encoder`, and blocker `No image/avif encoder was discovered through MediaCodecList.findEncoderForFormat().`'
    );
    expect(readmeSource).toContain('getImageCompressionCapabilities().formats.avif.output=false');
    expect(readmeSource).toContain(
      'The v0.2.17 instrumentation check keeps that probe and adds the encode/decode-back smoke'
    );
    expect(readmeSource).toContain(
      'Version `0.2.19` keeps AVIF output disabled while making the production gate explicit across Android and iOS capability notes, unsupported-output errors, README guidance, and verification expectations.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.20` keeps AVIF output disabled and turns the Android smoke into a production-decision preflight.'
    );
    expect(readmeSource).toContain(
      'Smoke results now carry `blockerCode`, `outputCanBeEnabled=false`, and `productionDecision`'
    );
    expect(readmeSource).toContain(
      'instrumentation records an explicit blocker code (`sdk_unavailable`, `no_image_avif_encoder`, `codec_failure`, `invalid_signature`, or `decode_back_failure`) and capability reporting remains `output=false`.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.21` keeps AVIF output disabled and adds an Android production wiring scaffold at the `compressImage()` output boundary.'
    );
    expect(readmeSource).toContain('willEnterEncodeDecodeBackHelper=false');
    expect(readmeSource).toContain(
      'AVIF requests continue to reject with `ERR_NOT_IMPLEMENTED` before source access, helper entry, metadata preserve, `output.maxBytes`, or animated AVIF preservation can be treated as implemented.'
    );
    expect(readmeSource).toContain(
      'Version `0.2.22` keeps AVIF output disabled and extracts the Android AVIF encode/decode-back implementation into `AndroidAvifOutputHelper`.'
    );
    expect(readmeSource).toContain(
      'The helper owns reusable input, encoded output, sample, file-validation, and result types for future production wiring'
    );
    expect(readmeSource).toContain(
      'Version `0.2.23` keeps AVIF output disabled and adds an injectable validation seam to `AndroidAvifOutputHelper`.'
    );
    expect(readmeSource).toContain(
      '`AndroidAvifOutputHelperDependencies` wraps the default bitmap, encoder, output-file, muxer, and decode-back validator path'
    );
    expect(readmeSource).toContain(
      'Version `0.2.24` keeps AVIF output disabled and fixes the injected success contract for `AndroidAvifOutputHelper`.'
    );
    expect(readmeSource).toContain(
      'helper success reports `byteSize`, `signatureValid=true`, `decodeBackValid=true`, `blockerCode=null`, and `PRODUCTION_DECISION_SMOKE_PASSED_KEEP_DISABLED`'
    );
    expect(readmeSource).toContain(
      'Version `0.2.25` keeps AVIF output disabled and fixes the injected direct-output success contract for `AndroidAvifOutputHelper`.'
    );
    expect(readmeSource).toContain(
      'proves `muxEncodedSamples` is not called after direct validation success'
    );
    expect(readmeSource).toContain(
      'Version `0.2.26` keeps AVIF output disabled and fixes the helper validation detail contract for `AndroidAvifOutputHelper`.'
    );
    expect(readmeSource).toContain(
      'pin direct success, muxed success, invalid signature, decode-back failure, and codec failure `details` ordering'
    );
    expect(readmeSource).toContain(
      'dependency-provided encoder/direct/muxer/validator details next, and route blockers last'
    );
    expect(readmeSource).toContain(
      'Version `0.2.27` keeps AVIF output disabled and fixes the blocked-route detail contract for `AndroidAvifOutputHelper` and `AndroidAvifOutputPrototype.runEncodeDecodeBackSmoke()`.'
    );
    expect(readmeSource).toContain(
      'pin below-API-34 and no-image/avif-encoder blocked helper details to route blockers, `INJECTABLE_VALIDATION_SEAM`, and `HELPER_DISABLED_FROM_COMPRESS_IMAGE`'
    );
    expect(readmeSource).toContain(
      'verify the smoke adapter preserves `blockerCode`, `details`, and `outputCanBeEnabled=false`'
    );
    expect(readmeSource).toContain(
      'Version `0.2.28` keeps AVIF output disabled and fixes the temp-file lifecycle contract for `AndroidAvifOutputHelper`.'
    );
    expect(readmeSource).toContain(
      'pin direct success to direct-file-only creation, muxer skip, and direct `outputFilePath`/`byteSize`'
    );
    expect(readmeSource).toContain(
      'pin invalid-signature/decode-back failures to the final muxed blocker path and final-file `byteSize`'
    );
    expect(readmeSource).toContain(
      'Version `0.2.29` keeps AVIF output disabled and fixes the validation-result provenance contract for `AndroidAvifOutputHelper`.'
    );
    expect(readmeSource).toContain(
      'pin direct validation details to the direct file name, byte size, signature result, and decode-back result'
    );
    expect(readmeSource).toContain(
      'pin muxed validation details to the muxed file name, byte size, signature result, and decode-back result'
    );
    expect(readmeSource).toContain('Partial implementation criteria: static image output only');
    expect(readmeSource).toContain("metadataPolicies: ['preserve', 'safe', 'strip']");
    for (const snippet of staleReadmeSnippets) {
      expect(readmeSource).not.toContain(snippet);
    }
    expect(readmeSource).toContain(
      'Development scripts, Android JVM tests, instrumentation tests, and codec fixtures are intentionally excluded from the publish tarball.'
    );
    expect(readmeSource).toContain('Install from npm:');
    expect(readmeSource).toContain('- [x] Public npm release.');
  });

  it('exposes repository and app-backed Android verification commands', () => {
    expect(packageJson.scripts['android:doctor']).toBe(
      'node scripts/android-verification.mjs doctor'
    );
    expect(packageJson.scripts['android:codegen']).toBe(
      'node scripts/android-verification.mjs codegen'
    );
    expect(packageJson.scripts['android:build']).toBe(
      'node scripts/android-verification.mjs build'
    );
    expect(packageJson.scripts['example:android-unit-test']).toBe(
      'RNICK_ANDROID_APP_DIR=example/android RNICK_ANDROID_GRADLE_TASK=:react-native-image-compression-kit:testDebugUnitTest pnpm android:build'
    );
    expect(packageJson.scripts['example:android-instrumentation']).toBe(
      'RNICK_ANDROID_APP_DIR=example/android RNICK_ANDROID_GRADLE_TASK=:react-native-image-compression-kit:connectedDebugAndroidTest pnpm android:build'
    );
    expect(packageJson.scripts.verify).toContain('pnpm android:doctor');
  });

  it('defines the Docker Android build and test environment', () => {
    const dockerfileSource = readProjectFile('Dockerfile');
    const dockerIgnoreSource = readProjectFile('.dockerignore');
    const dockerScriptSource = readProjectFile('scripts/docker-android.mjs');
    const readmeSource = readProjectFile('README.md');

    expect(packageJson.scripts['docker:android:build']).toBe(
      'node scripts/docker-android.mjs build'
    );
    expect(packageJson.scripts['docker:android:verify']).toBe(
      'node scripts/docker-android.mjs verify'
    );
    expect(packageJson.scripts['docker:android:example:typecheck']).toBe(
      'node scripts/docker-android.mjs example:typecheck'
    );
    expect(packageJson.scripts['docker:android:example:codegen']).toBe(
      'node scripts/docker-android.mjs example:codegen'
    );
    expect(packageJson.scripts['docker:android:example:android-unit-test']).toBe(
      'node scripts/docker-android.mjs example:android-unit-test'
    );
    expect(packageJson.scripts['docker:android:example:build']).toBe(
      'node scripts/docker-android.mjs example:build'
    );
    expect(packageJson.scripts['docker:android:ci']).toBe(
      'node scripts/docker-android.mjs ci'
    );
    expect(packageJson.scripts['docker:android:shell']).toBe(
      'node scripts/docker-android.mjs shell'
    );

    expect(dockerfileSource).toContain('FROM eclipse-temurin:21-jdk-jammy');
    expect(dockerfileSource).toContain('ARG NODE_VERSION=24.11.1');
    expect(dockerfileSource).toContain('ARG PNPM_VERSION=11.7.0');
    expect(dockerfileSource).toContain('ARG ANDROID_PLATFORM=android-36');
    expect(dockerfileSource).toContain('ARG ANDROID_BUILD_TOOLS_VERSION=36.0.0');
    expect(dockerfileSource).toContain('ARG ANDROID_LEGACY_BUILD_TOOLS_VERSION=35.0.0');
    expect(dockerfileSource).toContain('ARG ANDROID_NDK_VERSION=27.1.12297006');
    expect(dockerfileSource).toContain('ARG ANDROID_CMAKE_VERSION=3.22.1');
    expect(dockerfileSource).toContain('ANDROID_HOME=/opt/android-sdk');
    expect(dockerfileSource).toContain('GRADLE_OPTS=-Dorg.gradle.vfs.watch=false');
    expect(dockerfileSource).toContain('npm install -g "pnpm@${PNPM_VERSION}"');
    expect(dockerfileSource).toContain('sdkmanager --install');
    expect(dockerfileSource).toContain('"platforms;${ANDROID_PLATFORM}"');
    expect(dockerfileSource).toContain('"build-tools;${ANDROID_BUILD_TOOLS_VERSION}"');
    expect(dockerfileSource).toContain('"build-tools;${ANDROID_LEGACY_BUILD_TOOLS_VERSION}"');
    expect(dockerfileSource).toContain('"cmake;${ANDROID_CMAKE_VERSION}"');
    expect(dockerfileSource).toContain('"ndk;${ANDROID_NDK_VERSION}"');
    expect(dockerfileSource).toContain('WORKDIR /workspace');

    expect(dockerIgnoreSource).toContain('node_modules/');
    expect(dockerIgnoreSource).toContain('android/build/');
    expect(dockerIgnoreSource).toContain('example/android/build/');

    expect(dockerScriptSource).toContain('RNICK_ANDROID_DOCKER_PLATFORM');
    expect(dockerScriptSource).toContain('linux/amd64');
    expect(dockerScriptSource).toContain('pnpm install --frozen-lockfile');
    expect(dockerScriptSource).toContain('example:android-unit-test');
    expect(dockerScriptSource).toContain('${VOLUME_PREFIX}-node-modules:/workspace/node_modules');
    expect(dockerScriptSource).toContain('${VOLUME_PREFIX}-pnpm-store:/pnpm/store');
    expect(dockerScriptSource).toContain('${VOLUME_PREFIX}-gradle-home:/root/.gradle');
    expect(dockerScriptSource).toContain('GRADLE_OPTS=-Dorg.gradle.vfs.watch=false');

    expect(readmeSource).toContain('## Docker Android Build/Test Environment');
    expect(readmeSource).toContain('Node.js 24, pnpm 11.7.0, Temurin JDK 21');
    expect(readmeSource).toContain('Android SDK platform 36, Android build tools 36.0.0');
    expect(readmeSource).toContain(
      'Android build tools 35.0.0 for React Native/AGP compatibility'
    );
    expect(readmeSource).toContain('CMake 3.22.1');
    expect(readmeSource).toContain('Android NDK 27.1.12297006');
    expect(readmeSource).toContain('pnpm docker:android:build');
    expect(readmeSource).toContain('pnpm docker:android:ci');
    expect(readmeSource).toContain('pnpm docker:android:example:android-unit-test');
    expect(readmeSource).toContain('linux/amd64');
    expect(readmeSource).toContain('disables Gradle VFS watching');
    expect(readmeSource).toContain('named Docker volumes');
    expect(readmeSource).toContain('does not run an Android emulator');
  });

  it('keeps development-only files out of npm package file globs', () => {
    expect(packageJson.files).toContain('android/build.gradle');
    expect(packageJson.files).toContain('android/src/main');
    expect(packageJson.files).not.toContain('android');
    expect(packageJson.files).not.toContain('android/src');
    expect(packageJson.files).not.toContain('scripts');
  });

  it('wires the packed package consumer smoke test', () => {
    const smokeScriptSource = readProjectFile('scripts/consumer-smoke-test.mjs');
    const ciWorkflowSource = readProjectFile('.github/workflows/ci.yml');
    const readmeSource = readProjectFile('README.md');

    expect(packageJson.scripts['smoke:consumer']).toBe(
      'pnpm build && node scripts/consumer-smoke-test.mjs'
    );
    expect(smokeScriptSource).toContain(
      "run('pnpm', ['pack', '--pack-destination', packDir], ROOT)"
    );
    expect(smokeScriptSource).toContain(
      "run('pnpm', ['install', '--ignore-scripts'], consumerDir)"
    );
    expect(smokeScriptSource).toContain("run('pnpm', ['typecheck'], consumerDir)");
    expect(smokeScriptSource).toContain(
      "'react-native-image-compression-kit': tarballSpecifier"
    );
    expect(smokeScriptSource).toContain("const REACT_NATIVE_VERSION = '0.86.0'");
    expect(smokeScriptSource).toContain('lib/index.d.ts');
    expect(smokeScriptSource).toContain('development-only files');
    expect(smokeScriptSource).toContain('scripts/consumer-smoke-test.mjs');
    expect(smokeScriptSource).toContain('android/src/test/assets/heic-heif/sample.heic');
    expect(smokeScriptSource).toContain('compressImage(options)');
    expect(smokeScriptSource).toContain('getImageCompressionCapabilities()');
    expect(ciWorkflowSource).toContain('name: Run package consumer smoke test');
    expect(ciWorkflowSource).toContain('run: pnpm smoke:consumer');
    expect(readmeSource).toContain('pnpm smoke:consumer');
    expect(readmeSource).toContain('separate temporary React Native consumer project');
    expect(readmeSource).toContain(
      'typechecks imports from `react-native-image-compression-kit`'
    );
    expect(readmeSource).toContain('without publishing to npm');
  });

  it('wires the post-publish registry package smoke test', () => {
    const registrySmokeScriptSource = readProjectFile('scripts/registry-smoke-test.mjs');
    const registrySmokeCoreSource = readProjectFile('scripts/registry-smoke-core.mjs');
    const registryProvenanceCoreSource = readProjectFile('scripts/registry-provenance-core.mjs');
    const registryProvenanceCliSource = readProjectFile('scripts/verify-registry-provenance.mjs');
    const registryProvenanceTestSource = readProjectFile('test/registryProvenance.test.mjs');
    const registryAttestationCoreSource = readProjectFile('scripts/registry-attestation-core.mjs');
    const registryAttestationCliSource = readProjectFile('scripts/verify-registry-attestation.mjs');
    const registryAttestationTestSource = readProjectFile('test/registryAttestation.test.mjs');
    const readmeValidatorSource = readProjectFile('scripts/readme-status-validator.mjs');
    const registryWorkflowSource = readProjectFile('.github/workflows/registry-validation.yml');
    const readmeSource = readProjectFile('README.md');

    expect(packageJson.scripts['smoke:registry']).toBe(
      'node scripts/registry-smoke-test.mjs'
    );
    expect(packageJson.scripts['verify:registry-provenance']).toBe(
      'node scripts/verify-registry-provenance.mjs'
    );
    expect(packageJson.scripts['verify:registry-attestation']).toBe(
      'node scripts/verify-registry-attestation.mjs'
    );
    expect(registrySmokeScriptSource).toContain("'--expect-tag': 'expectedTag'");
    expect(registrySmokeScriptSource).toContain("'--report-file': 'reportFile'");
    expect(registrySmokeScriptSource).toContain("'--artifact-dir': 'artifactDir'");
    expect(registrySmokeScriptSource).toContain('writeRegistryBundleAtomic');
    expect(registrySmokeScriptSource).toContain("'dist.tarball'");
    expect(registrySmokeScriptSource).toContain("'dist.integrity'");
    expect(registrySmokeScriptSource).toContain("'dist.shasum'");
    expect(registrySmokeScriptSource).toContain(
      "run('npm', ['install', '--ignore-scripts', '--legacy-peer-deps'], consumerDir)"
    );
    expect(registrySmokeScriptSource).toContain(
      "run('npm', ['run', 'typecheck'], consumerDir)"
    );
    expect(registrySmokeCoreSource).toContain("'scripts/registry-smoke-test.mjs'");
    expect(registrySmokeCoreSource).toContain(
      "'android/src/test/assets/heic-heif/sample.heic'"
    );
    expect(registrySmokeScriptSource).toContain(
      "const REACT_NATIVE_VERSION = '0.86.0'"
    );
    expect(registrySmokeScriptSource).toContain('RNICK_REGISTRY_SMOKE_VERSION');
    expect(registrySmokeScriptSource).toContain('RNICK_REGISTRY_SMOKE_KEEP');
    expect(registrySmokeScriptSource).toContain('compressImage(options)');
    expect(registrySmokeScriptSource).toContain('getImageCompressionCapabilities()');
    expect(registrySmokeCoreSource).toContain('validateRegistryEvidence');
    expect(registrySmokeCoreSource).toContain('writeRegistryReportAtomic');
    expect(registryProvenanceCoreSource).toContain('REGISTRY_BUNDLE_MANIFEST_FIELDS');
    expect(registryProvenanceCoreSource).toContain('verifyRegistryProvenanceBundle');
    expect(registryProvenanceCoreSource).toContain('inspectPackageTarball');
    expect(registryProvenanceCoreSource).toContain('writeRegistryBundleAtomic');
    expect(registryProvenanceCoreSource).toContain('writeVerificationReportAtomic');
    expect(registryProvenanceCliSource).toContain("'--expect-package': 'expectedPackage'");
    expect(registryProvenanceCliSource).toContain("'--expect-version': 'expectedVersion'");
    expect(registryProvenanceTestSource).toContain(
      'rejects archive traversal and link entries without extracting them'
    );
    expect(registryProvenanceTestSource).toContain(
      'keeps the offline verifier free of network and registry command paths'
    );
    expect(registryAttestationCoreSource).toContain('REGISTRY_ATTESTATION_REPORT_FIELDS');
    expect(registryAttestationCoreSource).toContain('PINNED_GITHUB_TRUSTED_ROOT_SHA256');
    expect(registryAttestationCoreSource).toContain('validateRegistryAttestation');
    expect(registryAttestationCliSource).toContain("'--custom-trusted-root'");
    expect(registryAttestationCliSource).toContain("'--deny-self-hosted-runners'");
    expect(registryAttestationCliSource).toContain('writeRegistryAttestationReportAtomic');
    expect(registryAttestationTestSource).toContain('rejects a subject digest mismatch');
    expect(registryAttestationTestSource).toContain('pins the no-network gh invocation in source');
    expect(readmeValidatorSource).toContain('validateReadmeStatus');
    expect(registryWorkflowSource).toContain('workflow_dispatch:');
    expect(registryWorkflowSource).toContain('default: "0.2.48"');
    expect(registryWorkflowSource).toContain('run: pnpm install --frozen-lockfile');
    expect(registryWorkflowSource).toContain('GITHUB_STEP_SUMMARY');
    expect(registryWorkflowSource).toContain('actions/upload-artifact@v6');
    expect(registryWorkflowSource).toContain('--artifact-dir registry-validation');
    expect(registryWorkflowSource).toContain('verify:registry-provenance');
    expect(registryWorkflowSource).toContain('manifest.reportSha256');
    expect(registryWorkflowSource).toContain('manifest.tarballIntegrity');
    expect(registryWorkflowSource).toContain('Bundle manifest SHA-256');
    expect(registryWorkflowSource).toContain('verification.status');
    expect(registryWorkflowSource).toContain('id-token: write');
    expect(registryWorkflowSource).toContain('attestations: write');
    expect(registryWorkflowSource).toContain('actions/attest@v4');
    expect(registryWorkflowSource).toContain('GH_TOKEN: ${{ github.token }}');
    expect(registryWorkflowSource).toContain('gh attestation trusted-root');
    expect(registryWorkflowSource).toContain('verify:registry-attestation');
    expect(registryWorkflowSource).toContain('registry-provenance-attestation-${{ inputs.version }}');
    expect(readmeSource).toContain('pnpm smoke:registry -- --version <published-version> --expect-tag latest --json --artifact-dir registry-validation');
    expect(readmeSource).toContain('pnpm verify:registry-provenance -- --artifact-dir registry-validation');
    expect(readmeSource).toContain('pnpm verify:registry-attestation --');
    expect(readmeSource).toContain('validates the requested registry package');
    expect(readmeSource).toContain('npm install --ignore-scripts --legacy-peer-deps');
    expect(readmeSource).toContain(
      'This post-publish smoke test intentionally is not part of the default CI or `pnpm release:dry-run`'
    );
    expect(readmeSource).toContain(
      'After npm publish, run `pnpm smoke:registry -- --version <published-version>`'
    );
  });

  it('documents and wires the release dry-run checklist', () => {
    const releaseScriptSource = readProjectFile('scripts/release-dry-run.mjs');
    const releaseTestSource = readProjectFile('test/releaseDryRun.test.mjs');
    const readmeSource = readProjectFile('README.md');

    expect(packageJson.scripts['release:dry-run']).toBe(
      'node scripts/release-dry-run.mjs'
    );
    expect(releaseScriptSource).toContain(
      'Release dry run only validates publish readiness. It does not publish to npm.'
    );
    expect(releaseScriptSource).toContain("args: ['verify']");
    expect(releaseScriptSource).toContain("args: ['example:typecheck']");
    expect(releaseScriptSource).toContain("args: ['diff', '--check']");
    expect(releaseScriptSource).toContain("args: ['pack', '--dry-run']");
    expect(releaseScriptSource).toContain('Check packed README status');
    expect(releaseScriptSource).toContain('STALE_PACKED_README_SNIPPETS');
    expect(releaseScriptSource).toContain('checkPackedReadmeStatus');
    expect(releaseScriptSource).toContain('getPackedReadmeStatusViolations');
    expect(releaseScriptSource).toContain('validatePackedReadmeStatus');
    expect(releaseScriptSource).toContain('Status: v0.2.47 candidate');
    expect(releaseScriptSource).toContain(
      'Version `0.2.47` is an unpublished iOS PASS replay automation gate candidate'
    );
    expect(releaseScriptSource).toContain('Status: v0.2.48 candidate');
    expect(releaseScriptSource).toContain(
      'Version `0.2.48` is an unpublished registry provenance and manual CI gate candidate'
    );
    expect(releaseScriptSource).toContain('package/README.md');
    expect(releaseScriptSource).toContain(
      'Packed README release status check completed.'
    );
    expect(releaseTestSource).toContain(
      'rejects the v0.2.47 candidate snippet'
    );
    expect(releaseTestSource).toContain(
      'accepts registry-independent v0.2.47 release wording'
    );
    expect(releaseTestSource).toContain(
      'rejects the v0.2.48 candidate snippet'
    );
    expect(releaseTestSource).toContain(
      'accepts registry-independent v0.2.48 release wording'
    );
    expect(releaseScriptSource).toContain("args: ['smoke:consumer']");
    expect(releaseScriptSource).toContain(
      "args: ['publish', '--dry-run', '--no-git-checks']"
    );
    expect(readmeSource).toContain('## Release Dry Run Checklist');
    expect(readmeSource).toContain(
      'Actual npm publishing requires an authenticated npm registry session and is intentionally outside the dry-run checklist.'
    );
    expect(readmeSource).toContain('pnpm release:dry-run');
    expect(readmeSource).toContain('pnpm verify');
    expect(readmeSource).toContain('pnpm example:typecheck');
    expect(readmeSource).toContain('git diff --check');
    expect(readmeSource).toContain('pnpm pack --dry-run');
    expect(readmeSource).toContain('packed README stale status check');
    expect(readmeSource).toContain('pnpm smoke:consumer');
    expect(readmeSource).toContain('pnpm publish --dry-run --no-git-checks');
    expect(readmeSource).toContain(
      'successful GitHub Actions CI, Android Instrumentation, and iOS Validation runs'
    );
  });

  it('documents and guards iOS host-app validation stability', () => {
    const readmeSource = readProjectFile('README.md');
    const gemfileSource = readProjectFile('example/Gemfile');
    const podfileSource = readProjectFile('example/ios/Podfile');
    const podfileWorkaroundSource = readProjectFile(
      'example/ios/cocoapods_pathname_workaround.rb'
    );
    const smokeLifecycleTestSource = readProjectFile('test/iosSmokeLifecycle.test.mjs');
    const smokeCliTimeoutTestSource = readProjectFile('test/iosSmokeCliTimeout.test.mjs');
    const smokeSummaryCliTestSource = readProjectFile('test/iosSmokeSummaryCli.test.mjs');
    const smokeContractSource = readProjectFile('scripts/ios-smoke-contract.mjs');
    const smokeContractTestSource = readProjectFile('test/iosSmokeContract.test.mjs');
    const replayFixtureModuleSource = readProjectFile(
      'scripts/ios-smoke-pass-replay-fixture.mjs'
    );
    const replayRefreshCliSource = readProjectFile(
      'scripts/refresh-ios-smoke-pass-replay.mjs'
    );
    const replayFixtureTestSource = readProjectFile(
      'test/iosSmokePassReplayFixture.test.mjs'
    );
    const replayFixtureSource = readProjectFile(
      'test/fixtures/ios-smoke-pass-ci-replay.json'
    );
    const validationScriptSource = readProjectFile('scripts/ios-validation.mjs');
    const vitestConfigSource = readProjectFile('vitest.config.ts');
    const workflowSource = readProjectFile('.github/workflows/ios-validation.yml');

    expect(packageJson.scripts['example:ios:pods']).toBe(
      'node scripts/ios-validation.mjs pods'
    );
    expect(packageJson.scripts['example:ios:build']).toBe(
      'node scripts/ios-validation.mjs build'
    );
    expect(packageJson.scripts['example:ios:smoke']).toBe(
      'node scripts/ios-validation.mjs smoke'
    );
    expect(packageJson.scripts['fixtures:ios-pass-replay']).toBe(
      'node scripts/refresh-ios-smoke-pass-replay.mjs'
    );
    expect(packageJson.scripts['fixtures:ios-pass-replay:check']).toBe(
      'node scripts/refresh-ios-smoke-pass-replay.mjs --check'
    );
    expect(packageJson.scripts['fixtures:ios-pass-replay:audit']).toBe(
      'node scripts/refresh-ios-smoke-pass-replay.mjs --audit'
    );
    expect(packageJson.scripts.verify).toBe(
      'pnpm typecheck && pnpm test && pnpm build && pnpm fixtures:ios-pass-replay:audit && pnpm android:doctor'
    );
    expect(readmeSource).toContain('## iOS Host-App Validation');
    expect(readmeSource).toContain('pnpm example:ios:smoke');
    expect(readmeSource).toContain('RNICK_IOS_SMOKE_PASS');
    expect(readmeSource).toContain('RNICK_IOS_SMOKE_ATTEMPTS=2');
    expect(readmeSource).toContain('RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS=1000');
    expect(readmeSource).toContain('RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW=10m');
    expect(readmeSource).toContain('iOS smoke diagnostics:');
    expect(readmeSource).toContain('ios-smoke-diagnostics/ios-smoke.log');
    expect(readmeSource).toContain('ios-smoke-diagnostics/ios-smoke-summary.md');
    expect(readmeSource).toContain('formatIOSSmokeDiagnosticsSummary()');
    expect(readmeSource).toContain('GitHub Step Summary');
    expect(readmeSource).toContain(
      'packed diagnostics summary marker extraction and log-tail ordering'
    );
    expect(readmeSource).toContain('artifact markdown schema');
    expect(readmeSource).toContain('PASS payload schema');
    expect(readmeSource).toContain('WebP-output available PASS payload schema');
    expect(readmeSource).toContain('AVIF-input unavailable PASS payload schema');
    expect(readmeSource).toContain(
      'exact `formatIOSSmokeDiagnosticsSummary()` markdown schema snapshots for normal, empty, no-marker, and very-long-log fixtures'
    );
    expect(readmeSource).toContain(
      'exact `RNICK_IOS_SMOKE_PASS` payload schema snapshots for platform, result byte, capability, target-size, and unsupported format fields'
    );
    expect(readmeSource).toContain(
      'exact WebP-output available `RNICK_IOS_SMOKE_PASS` payload schema snapshots for conditional WebP output byte fields and `webpTargetSizeResultBytes`'
    );
    expect(readmeSource).toContain(
      'exact AVIF-input unavailable `RNICK_IOS_SMOKE_PASS` payload schema snapshots for omitted `avifResultBytes`, `avifToPngResultBytes`, and `avifToWebPResultBytes`'
    );
    expect(readmeSource).toContain(
      'matrix-driven `RNICK_IOS_SMOKE_PASS` payload schema snapshots for WebP output x AVIF input combinations'
    );
    expect(readmeSource).toContain(
      'shared PASS payload fixture factory coverage'
    );
    expect(readmeSource).toContain(
      'successful GitHub Actions iOS Validation PASS log replay fixture coverage'
    );
    expect(readmeSource).toContain(
      'The committed replay artifact keeps workflow `iOS Validation`'
    );
    expect(readmeSource).toContain(
      'source-line SHA-256 `c20c9e72f2b9f3159d7db56c7c811a3ecb81555a9d9e90350d2e155e6f832dc6`'
    );
    expect(readmeSource).toContain(
      'recalculates SHA-256 over the exact UTF-8 line without a trailing newline'
    );
    expect(readmeSource).toContain(
      'regenerates the structured JSON fields'
    );
    expect(readmeSource).toContain('missing or malformed PASS payload log handling');
    expect(readmeSource).toContain('missing conditional WebP and AVIF payload field handling');
    expect(readmeSource).toContain(
      '`unsupportedInputs` including `avif` when AVIF input is unavailable'
    );
    expect(readmeSource).toContain(
      '`unsupportedOutputs` excluding `webp` when WebP output is available'
    );
    expect(readmeSource).toContain('test/iosSmokeLifecycle.test.mjs');
    expect(readmeSource).toContain('test/iosSmokeCliTimeout.test.mjs');
    expect(readmeSource).toContain('test/iosSmokeContract.test.mjs');
    expect(readmeSource).toContain('test/iosSmokePassReplayFixture.test.mjs');
    expect(readmeSource).toContain(
      'test/fixtures/ios-smoke-pass-ci-replay.json'
    );
    expect(readmeSource).toContain('test/iosSmokeSummaryCli.test.mjs');
    expect(readmeSource).toContain('scripts/ios-smoke-contract.mjs');
    expect(readmeSource).toContain(
      'scripts/ios-smoke-pass-replay-fixture.mjs'
    );
    expect(readmeSource).toContain(
      'scripts/refresh-ios-smoke-pass-replay.mjs'
    );
    expect(readmeSource).toContain('pnpm fixtures:ios-pass-replay --');
    expect(readmeSource).toContain('pnpm fixtures:ios-pass-replay:check --');
    expect(readmeSource).toContain(
      'pnpm fixtures:ios-pass-replay:audit -- --json'
    );
    expect(readmeSource).toContain(
      'The CLI performs no GitHub or other network requests.'
    );
    expect(readmeSource).toContain(
      'Check and audit modes perform no writes; refresh, check, and audit perform no GitHub or other network requests.'
    );
    expect(readmeSource).toContain(
      '`schemaVersion`, `mode`, `status`, `artifactPath`, `differences`, and `error`'
    );
    expect(readmeSource).toContain(
      '`status` is `current`, `stale`, or `invalid`'
    );
    expect(readmeSource).toContain(
      'summarize-smoke-log` CLI stdout/`$GITHUB_STEP_SUMMARY` dry-run contracts'
    );
    expect(readmeSource).toContain(
      'summarize-smoke-log` CLI stdout/`$GITHUB_STEP_SUMMARY` parity from a fake `ios-smoke.log`'
    );
    expect(readmeSource).toContain(
      'CLI timeout input assembly from fake launch/log stream/Metro/unified-log output'
    );
    expect(readmeSource).toContain(
      'fake EventEmitter Metro/log stream listener cleanup plus log process stop and `setLogProcess(null)` after PASS, FAIL, and timeout settle paths'
    );
    expect(readmeSource).toContain(
      'log stream error output/snapshot/timeout diagnostics propagation'
    );
    expect(readmeSource).toContain('Xcode 26.5 and the iPhoneSimulator26.5 SDK');
    expect(readmeSource).toContain('Ruby 3.1 or newer');
    expect(readmeSource).toContain('patched ActiveSupport and Concurrent Ruby ranges');
    expect(readmeSource).toContain('pathname contains null byte');
    expect(readmeSource).toContain(
      'local CocoaPods pathname workaround for pnpm-symlinked pods'
    );
    expect(readmeSource).toContain('RNICK_IOS_POD_INSTALL_ATTEMPTS');
    expect(podfileSource).toContain("require_relative './cocoapods_pathname_workaround'");
    expect(podfileWorkaroundSource).toContain('module RNICKCocoaPodsPathnameWorkaround');
    expect(podfileWorkaroundSource).toContain('base_path.cleanpath');
    expect(podfileWorkaroundSource).toContain('Pod::Project.prepend');
    expect(gemfileSource).toContain("ruby '>= 3.1.0'");
    expect(gemfileSource).toContain("gem 'activesupport', '>= 7.2.3.1'");
    expect(gemfileSource).toContain("gem 'concurrent-ruby', '>= 1.3.7'");
    expect(workflowSource).toContain(
      'pnpm example:ios:smoke 2>&1 | tee ios-smoke-diagnostics/ios-smoke.log'
    );
    expect(workflowSource).toContain('name: Audit iOS PASS replay fixture');
    expect(workflowSource).toContain(
      'pnpm fixtures:ios-pass-replay:audit -- --json'
    );
    expect(workflowSource).toContain(
      'node scripts/ios-validation.mjs summarize-smoke-log ios-smoke-diagnostics/ios-smoke.log'
    );
    expect(workflowSource).toContain('tee ios-smoke-diagnostics/ios-smoke-summary.md');
    expect(workflowSource).toContain('if: failure()');
    expect(workflowSource).toContain('uses: actions/upload-artifact@v6');
    expect(workflowSource).toContain('name: ios-smoke-diagnostics');
    expect(workflowSource).toContain('path: ios-smoke-diagnostics');
    expect(validationScriptSource).toContain("from './ios-smoke-contract.mjs'");
    expect(validationScriptSource).toContain('summarize-smoke-log');
    expect(validationScriptSource).toContain('GITHUB_STEP_SUMMARY');
    expect(validationScriptSource).toContain('POD_INSTALL_MAX_ATTEMPTS');
    expect(validationScriptSource).toContain('SMOKE_MAX_ATTEMPTS');
    expect(validationScriptSource).toContain('SMOKE_LOG_STREAM_WARMUP_MS');
    expect(validationScriptSource).toContain('SMOKE_DIAGNOSTIC_LOG_WINDOW');
    expect(validationScriptSource).toContain('createSmokeAttemptLifecycle');
    expect(validationScriptSource).toContain('createSmokeTimeoutErrorFromCLIState');
    expect(validationScriptSource).toContain('formatIOSSmokeDiagnosticsSummary');
    expect(validationScriptSource).toContain('formatSmokeRetryWarningMessages');
    expect(validationScriptSource).toContain('createSmokeTimeoutError');
    expect(validationScriptSource).toContain('smokeLogOutput');
    expect(validationScriptSource).toContain('simulatorSummary');
    expect(validationScriptSource).toContain('recentIOSSmokeLogs');
    expect(smokeContractSource).toContain('createIOSValidationConfig');
    expect(smokeContractSource).toContain('shouldRetrySmokeTimeout');
    expect(smokeContractSource).toContain('formatSmokeTimeoutDiagnostics');
    expect(smokeContractSource).toContain('createSmokeAttemptLifecycle');
    expect(smokeContractSource).toContain('createSmokeTimeoutErrorFromCLIState');
    expect(smokeContractSource).toContain('extractIOSSmokeDiagnosticExcerpt');
    expect(smokeContractSource).toContain('formatIOSSmokeDiagnosticsSummary');
    expect(smokeContractSource).toContain('parseIOSSmokePassPayload');
    expect(smokeContractSource).toContain('IOS_SMOKE_PASS_PAYLOAD_REQUIRED_FIELDS');
    expect(smokeContractSource).toContain('IOS_SMOKE_PASS_PAYLOAD_SCHEMA_MATRIX');
    expect(smokeContractSource).toContain(
      'IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_REQUIRED_FIELDS'
    );
    expect(smokeContractSource).toContain(
      'IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS'
    );
    expect(smokeContractSource).toContain('IOS_SMOKE_PASS_WEBP_OUTPUT_REQUIRED_FIELDS');
    expect(smokeContractSource).toContain(
      'IOS_SMOKE_PASS_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS'
    );
    expect(smokeContractSource).toContain('getIOSSmokePassPayloadRequiredFields');
    expect(smokeContractSource).toContain(
      'getIOSSmokePassPayloadContractDifferences'
    );
    expect(smokeContractSource).toContain('validateIOSSmokePassPayload');
    expect(smokeContractSource).toContain('listMissingIOSSmokePassPayloadFields');
    expect(smokeContractSource).toContain('formatIOSSmokePassPayloadSchema');
    expect(smokeContractSource).toContain('Key markers and diagnostics');
    expect(smokeContractSource).toContain('Packed log tail');
    expect(smokeContractSource).toContain('createSmokeTimeoutError');
    expect(smokeContractSource).toContain('formatSmokeRetryWarningMessages');
    expect(smokeContractSource).toContain('formatSmokeRetryWarning');
    expect(smokeContractSource).toContain('iOS smoke diagnostics:');
    expect(smokeContractSource).toContain('iOS smoke log stream error:');
    expect(smokeContractSource).toContain('RNICK_IOS_SMOKE_PASS');
    expect(smokeContractSource).toContain('RNICK_IOS_SMOKE_FAIL');
    expect(smokeContractSource).toContain('Retrying after terminating the app');
    expect(smokeContractSource).toContain('RNICK_IOS_SMOKE_ATTEMPTS');
    expect(smokeContractSource).toContain('RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS');
    expect(smokeContractSource).toContain('RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW');
    expect(smokeContractSource).toContain('RNICK_IOS_METRO_READY_TIMEOUT_MS');
    expect(smokeContractSource).toContain('RNICK_IOS_POD_INSTALL_ATTEMPTS');
    expect(smokeLifecycleTestSource).toContain(
      'removes listeners, stops the log process, and clears the reference after PASS settle'
    );
    expect(smokeLifecycleTestSource).toContain(
      'removes listeners, stops the log process, and clears the reference after FAIL settle'
    );
    expect(smokeLifecycleTestSource).toContain(
      'removes listeners, stops the log process, and clears the reference after timeout settle'
    );
    expect(smokeLifecycleTestSource).toContain(
      'records log stream errors in output, snapshot state, and timeout diagnostics'
    );
    expect(smokeLifecycleTestSource).toContain('fixture log stream disconnected');
    expect(smokeLifecycleTestSource).toContain('createSmokeTimeoutErrorFromCLIState');
    expect(smokeLifecycleTestSource).toContain('smokeLogOutput');
    expect(smokeLifecycleTestSource).toContain('iOS smoke log stream error:');
    expect(smokeLifecycleTestSource).toContain('listenerCount');
    expect(smokeLifecycleTestSource).toContain('setLogProcess');
    expect(smokeLifecycleTestSource).toContain('stopProcess');
    expect(smokeCliTimeoutTestSource).toContain(
      'assembles timeout diagnostics from fake CLI launch, log stream, Metro, and unified log output'
    );
    expect(smokeCliTimeoutTestSource).toContain(
      'keeps timeout diagnostics before the retry warning message'
    );
    expect(smokeCliTimeoutTestSource).toContain('createSmokeTimeoutErrorFromCLIState');
    expect(smokeCliTimeoutTestSource).toContain('formatSmokeRetryWarningMessages');
    expect(smokeContractTestSource).toContain(
      'formats packed diagnostics summary with key markers before the log tail'
    );
    expect(smokeContractTestSource).toContain('extractIOSSmokeDiagnosticExcerpt');
    expect(smokeContractTestSource).toContain('formatIOSSmokeDiagnosticsSummary');
    expect(smokeContractTestSource).toContain(
      'parses default and overridden iOS validation environment values'
    );
    expect(smokeContractTestSource).toContain(
      'falls back to defaults for invalid positive integer and empty window overrides'
    );
    expect(smokeContractTestSource).toContain(
      'retries timeout-only errors before the final attempt'
    );
    expect(smokeContractTestSource).toContain(
      'formats timeout diagnostics with simulator, app, process, launch, log, and Metro state'
    );
    expect(smokeContractTestSource).toContain(
      'snapshots the diagnostics summary markdown schema'
    );
    expect(smokeContractTestSource).toContain(
      'snapshots empty and no-marker diagnostics summaries'
    );
    expect(smokeContractTestSource).toContain(
      'bounds very long diagnostics summaries to marker and tail windows'
    );
    expect(smokeContractTestSource).toContain(
      'snapshots every iOS smoke PASS payload schema matrix case from a fixture factory'
    );
    expect(smokeContractTestSource).toContain(
      'validates iOS PASS payload ordering, values, and capability semantics'
    );
    expect(smokeContractTestSource).toContain(
      'getIOSSmokePassPayloadContractDifferences'
    );
    expect(smokeContractTestSource).toContain('validateIOSSmokePassPayload');
    expect(smokeContractTestSource).toContain(
      'loads the structured fixture artifact and replays its successful GitHub Actions iOS smoke PASS log line'
    );
    expect(smokeContractTestSource).toContain('createIOSSmokePassPayloadFixture');
    expect(smokeContractTestSource).toContain('createIOSSmokePassLogFixture');
    expect(smokeContractTestSource).toContain(
      'IOS_SMOKE_PASS_CI_LOG_REPLAY_ARTIFACT_SOURCE'
    );
    expect(smokeContractTestSource).toContain(
      'IOS_SMOKE_PASS_CI_LOG_REPLAY_ARTIFACT'
    );
    expect(smokeContractTestSource).toContain(
      'IOS_SMOKE_PASS_CI_LOG_REPLAY_PROVENANCE'
    );
    expect(smokeContractTestSource).toContain('IOS_SMOKE_PASS_CI_LOG_REPLAY_FIXTURE');
    expect(smokeContractTestSource).toContain(
      'validateIOSSmokePassReplayFixture'
    );
    expect(smokeContractTestSource).toContain(
      'formatIOSSmokePassReplayFixture'
    );
    expect(replayFixtureModuleSource).toContain(
      'IOS_SMOKE_PASS_REPLAY_FIXTURE_SCHEMA_VERSION = 1'
    );
    expect(replayFixtureModuleSource).toContain(
      'extractSingleIOSSmokePassSourceLine'
    );
    expect(replayFixtureModuleSource).toContain(
      'createIOSSmokePassReplayFixture'
    );
    expect(replayFixtureModuleSource).toContain(
      'validateIOSSmokePassReplayFixture'
    );
    expect(replayFixtureModuleSource).toContain(
      'formatIOSSmokePassReplayFixture'
    );
    expect(replayFixtureModuleSource).toContain(
      'getIOSSmokePassReplayFixtureDifferences'
    );
    expect(replayFixtureModuleSource).toContain(
      'getIOSSmokePassReplayFixtureValidationDifferences'
    );
    expect(replayFixtureModuleSource).toContain('validateIOSSmokePassPayload');
    expect(replayFixtureModuleSource).toContain("createHash('sha256')");
    expect(replayRefreshCliSource).toContain(
      "const DEFAULT_OUTPUT = 'test/fixtures/ios-smoke-pass-ci-replay.json'"
    );
    expect(replayRefreshCliSource).toContain("if (arg === '--')");
    expect(replayRefreshCliSource).toContain("['--log-file', 'logFile']");
    expect(replayRefreshCliSource).toContain(
      "['--workflow-name', 'workflowName']"
    );
    expect(replayRefreshCliSource).toContain("['--run-id', 'runId']");
    expect(replayRefreshCliSource).toContain("['--run-url', 'runUrl']");
    expect(replayRefreshCliSource).toContain("['--head-sha', 'headSha']");
    expect(replayRefreshCliSource).toContain("arg === '--check'");
    expect(replayRefreshCliSource).toContain("arg === '--audit'");
    expect(replayRefreshCliSource).toContain("arg === '--json'");
    expect(replayRefreshCliSource).toContain(
      'IOS_SMOKE_PASS_REPLAY_REPORT_SCHEMA_VERSION = 1'
    );
    expect(replayRefreshCliSource).toContain("status: 'current'");
    expect(replayRefreshCliSource).toContain("status: 'stale'");
    expect(replayRefreshCliSource).toContain("status: 'invalid'");
    expect(replayRefreshCliSource).toContain('artifactPath');
    expect(replayRefreshCliSource).toContain('differences');
    expect(replayRefreshCliSource).toContain('error');
    expect(replayRefreshCliSource).toContain('Fixture artifact is stale');
    expect(replayRefreshCliSource).toContain('canonicalFormat');
    expect(replayRefreshCliSource).toContain('never writes a file');
    expect(replayRefreshCliSource).toContain(
      'This command performs no network access.'
    );
    expect(replayFixtureTestSource).toContain(
      'creates and formats the exact deterministic fixture schema from a fake log'
    );
    expect(replayFixtureTestSource).toContain(
      'refreshes deterministic fixture files from a fake local log without network access'
    );
    expect(replayFixtureTestSource).toContain(
      'checks a current fake-log artifact without modifying it'
    );
    expect(replayFixtureTestSource).toContain(
      'rejects stale provenance without modifying the artifact'
    );
    expect(replayFixtureTestSource).toContain(
      'rejects source-line drift and reports its digest without modifying the artifact'
    );
    expect(replayFixtureTestSource).toContain(
      'rejects a %s artifact without creating or modifying it'
    );
    expect(replayFixtureTestSource).toContain(
      'rejects noncanonical artifact bytes without modifying them'
    );
    expect(replayFixtureTestSource).toContain(
      'audits the committed artifact without a source log or file writes'
    );
    expect(replayFixtureTestSource).toContain(
      'snapshots current check and audit JSON stdout contracts'
    );
    expect(replayFixtureTestSource).toContain(
      'snapshots stale check JSON stdout without modifying the artifact'
    );
    expect(replayFixtureTestSource).toContain(
      'snapshots $name audit JSON stdout without file writes'
    );
    expect(replayFixtureTestSource).toContain(
      'rejects conflicting CLI modes and pins text and JSON stream behavior'
    );
    expect(replayFixtureTestSource).toContain(
      'rejects a %s PASS source line in the CLI fake log'
    );
    expect(replayFixtureTestSource).toContain(
      'node:(?:child_process|http|https|net|tls)'
    );
    expect(replayFixtureSource).toContain('"schemaVersion": 1');
    expect(replayFixtureSource).toContain('"provenance": {');
    expect(replayFixtureSource).toContain('"runId": 28928015548');
    expect(smokeContractTestSource).toContain(
      'IOS_SMOKE_PASS_MATRIX_FIELD_PROBES'
    );
    expect(replayFixtureSource).toContain(
      '"headSha": "c6981c3b6b06e5e6e34f42147a94e4299a0f82b2"'
    );
    expect(replayFixtureSource).toContain(
      '"sourceLineSha256": "c20c9e72f2b9f3159d7db56c7c811a3ecb81555a9d9e90350d2e155e6f832dc6"'
    );
    expect(smokeContractTestSource).toContain(
      'handles missing and malformed iOS smoke PASS payload logs'
    );
    expect(smokeContractTestSource).toContain('jpegPreserveResultBytes');
    expect(smokeContractTestSource).toContain('avifToPngResultBytes');
    expect(smokeContractTestSource).toContain('jpegToWebPResultBytes');
    expect(smokeContractTestSource).toContain('webpTargetSizeResultBytes');
    expect(smokeContractTestSource).toContain('describeExpectedFixtureSchemaValue');
    expect(smokeContractTestSource).toContain(
      "unsupportedInputs: avifInputAvailable ? [] : ['avif']"
    );
    expect(smokeContractTestSource).toContain(
      "['webp', 'heic', 'heif', 'avif']"
    );
    expect(smokeContractTestSource).toContain(
      '(no RNICK_IOS_SMOKE markers or diagnostics lines captured)'
    );
    expect(smokeContractTestSource).toContain('(no iOS smoke log captured)');
    expect(smokeContractTestSource).toContain('RNICK_IOS_SMOKE_STEP_12');
    expect(smokeSummaryCliTestSource).toContain(
      'writes the same packed diagnostics summary to stdout and GITHUB_STEP_SUMMARY'
    );
    expect(smokeSummaryCliTestSource).toContain('spawnSync');
    expect(smokeSummaryCliTestSource).toContain('summarize-smoke-log');
    expect(smokeSummaryCliTestSource).toContain('GITHUB_STEP_SUMMARY');
    expect(smokeSummaryCliTestSource).toContain('ios-smoke.log');
    expect(smokeSummaryCliTestSource).toContain('Installing ImageCompressionKitExample.app');
    expect(smokeSummaryCliTestSource).toContain(
      'RNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg'
    );
    expect(vitestConfigSource).toContain("include: ['test/**/*.test.{ts,mjs}']");
    expect(validationScriptSource).toContain('pathname contains null byte');
    expect(validationScriptSource).toContain('cleanPodInstallArtifacts');
    expect(validationScriptSource).toContain('iOS pod install diagnostics:');
  });

  it('documents the v0.2.50 attestation candidate and previous release notes', () => {
    const releaseSource = readProjectFile('RELEASE.md');
    const readmeSource = readProjectFile('README.md');

    expect(packageJson.version).toBe('0.2.50');
    expect(releaseSource).toContain('## v0.2.50');
    expect(releaseSource).toContain(
      'Status: unpublished GitHub artifact attestation and offline identity verification candidate. npm `version` and `dist-tags.latest` remain `0.2.48`; no npm publish, dist-tag change, `v0.2.50` git tag, or GitHub Release is part of this candidate.'
    );
    expect(releaseSource).toContain(
      '`pnpm verify:registry-attestation -- --manifest registry-validation/bundle-manifest.json --attestation-bundle registry-attestation/attestation.jsonl --trusted-root registry-attestation/trusted-root.jsonl --expect-repository GGULBAE/react-native-image-compression-kit --expect-workflow GGULBAE/react-native-image-compression-kit/.github/workflows/registry-validation.yml --expect-ref refs/heads/master --expect-head-sha <workflow-head-sha> --json --report-file registry-attestation/attestation-verification.json`'
    );
    expect(releaseSource).toContain(
      'Official GitHub CLI offline verification requires both `--bundle` and `--custom-trusted-root`'
    );
    expect(releaseSource).toContain('## v0.2.49');
    expect(releaseSource).toContain(
      'Status: unpublished Registry provenance bundle offline verification candidate. npm `version` and `dist-tags.latest` remain `0.2.48`; no npm publish, dist-tag change, `v0.2.49` git tag, or GitHub Release is part of this candidate.'
    );
    expect(releaseSource).toContain(
      '`pnpm smoke:registry -- --version 0.2.48 --expect-tag latest --json --artifact-dir registry-validation`'
    );
    expect(releaseSource).toContain(
      '`pnpm verify:registry-provenance -- --artifact-dir registry-validation --expect-package react-native-image-compression-kit --expect-version 0.2.48 --expect-tag latest --json`'
    );
    expect(releaseSource).toContain(
      'The ordered bundle manifest fields are `schemaVersion`, `status`, `package`, `version`, `expectedTag`, `reportFile`, `reportSha256`, `stdoutFile`, `stdoutSha256`, `tarballFile`, `tarballIntegrity`, `tarballShasum`, `fileCount`, `packageSize`, `unpackedSize`, and `error`.'
    );
    expect(releaseSource).toContain('Tar entries are parsed in memory and never extracted.');
    expect(releaseSource).toContain(
      'Manual [Registry Validation run 29182554246](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29182554246) passed for `version=0.2.48` and `expected_tag=latest`'
    );
    expect(releaseSource).toContain(
      'GitHub digest `sha256:9039f1c127ce2f743d17a80e4469972a65343cabf91f3b5074808294ac670fa3`'
    );
    expect(releaseSource).toContain(
      'Offline verification reported all `manifest`, `report`, `stdout`, `tarball`, `packageContents`, and `readme` checks as `true`.'
    );
    expect(releaseSource).toContain('## v0.2.48');
    expect(releaseSource).toContain(
      'Status: published to npm as the `0.2.48` latest registry provenance and manual CI gate release. npm `version` and `dist-tags.latest` are both `0.2.48`; no `v0.2.48` git tag or GitHub Release was created.'
    );
    expect(releaseSource).toContain(
      '`pnpm smoke:registry -- --version 0.2.48 --expect-tag latest --json --report-file registry-provenance.json`'
    );
    expect(releaseSource).toContain('same-directory temporary file plus atomic rename');
    expect(releaseSource).toContain(
      'Release-ready commit `80bf1c3808aaab32db984df7c1df83d0fca8b149` passed GitHub Actions'
    );
    expect(releaseSource).toContain(
      '`npm publish --tag latest` was executed exactly once and published `react-native-image-compression-kit@0.2.48`.'
    );
    expect(releaseSource).toContain(
      'Registry metadata reports `version=0.2.48`, `dist-tags.latest=0.2.48`, publish time `2026-07-12T05:47:42.131Z`, and modified time `2026-07-12T05:47:42.234Z`.'
    );
    expect(releaseSource).toContain(
      'matched integrity `sha512-NBk5Gb56Wc/va1p3bTQ7PS93ihoTBE0Fdh8ekvhXt/fQQ2UWcH0xBaIIomybHUi1PnrCAuIFiAO4gm5AMvhO6g==`, shasum `dcc1b43534c6a9620d2704f692f335f28ff2f0d4`, 51 files, 66,099-byte package size, and 291,340-byte unpacked size'
    );
    expect(releaseSource).toContain(
      'Manual [Registry Validation run 29181708376](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29181708376) passed'
    );
    expect(releaseSource).toContain(
      'No additional publish attempt, manual dist-tag change, git tag, or GitHub Release was performed.'
    );
    expect(releaseSource).toContain('## v0.2.47');
    expect(releaseSource).toContain(
      'Status: published to npm as the `0.2.47` latest iOS PASS replay automation gate release. npm `version` and `dist-tags.latest` are both `0.2.47`; no `v0.2.47` tag or GitHub Release was created.'
    );
    expect(releaseSource).toContain(
      'This release does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, change the live iOS PASS payload, add native features, download GitHub Actions logs, refresh artifacts automatically, write from check/audit modes, or access the network during tests.'
    );
    expect(releaseSource).toContain(
      'Add a reusable `RNICK_IOS_SMOKE_PASS` payload validator for exact capability-driven field order and value semantics.'
    );
    expect(releaseSource).toContain(
      "Validate `platform: 'ios'`, positive safe-integer `*ResultBytes`, boolean capability flags, and duplicate-free capability-consistent unsupported format arrays."
    );
    expect(releaseSource).toContain(
      'Add source-log-free `--audit` mode for the committed artifact.'
    );
    expect(releaseSource).toContain(
      'Add stable `--check --json` and `--audit --json` machine-readable reports.'
    );
    expect(releaseSource).toContain(
      'Run the standalone audit from `pnpm verify` and the iOS Validation workflow.'
    );
    expect(releaseSource).toContain('### iOS PASS Replay Automation Gate');
    expect(releaseSource).toContain(
      '`getIOSSmokePassPayloadContractDifferences()` and `validateIOSSmokePassPayload()` now enforce the exact field order selected by the WebP-output x AVIF-input capability matrix.'
    );
    expect(releaseSource).toContain(
      '`pnpm fixtures:ios-pass-replay:audit -- --json` reads the committed artifact without requiring the original Actions log.'
    );
    expect(releaseSource).toContain(
      '`--check --json` and `--audit --json` emit exactly one compact JSON object to stdout with ordered `schemaVersion`, `mode`, `status`, `artifactPath`, `differences`, and `error` fields.'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokePassReplayFixture.test.mjs` snapshots current, stale, noncanonical, missing, malformed, schema-invalid, payload-invalid, and flag-conflict text/JSON stream behavior'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.2.47`, `fixtures:ios-pass-replay:audit`, and the audit step in `pnpm verify`.'
    );
    expect(releaseSource).toContain(
      'iOS Validation workflow audit gate before simulator smoke.'
    );
    expect(releaseSource).toContain(
      '### Promotion Result'
    );
    expect(releaseSource).toContain(
      'Release-ready commit `9434f5fe02c3030b178a2c5d0f6cc871b7e0262a` passed GitHub Actions'
    );
    expect(releaseSource).toContain(
      '`npm publish --tag latest` was executed exactly once and published `react-native-image-compression-kit@0.2.47`.'
    );
    expect(releaseSource).toContain(
      'Registry metadata reports `version=0.2.47`, `dist-tags.latest=0.2.47`, and modified time `2026-07-11T11:23:46.074Z`.'
    );
    expect(releaseSource).toContain(
      '`pnpm smoke:registry -- --version 0.2.47` downloaded the registry tarball'
    );
    expect(releaseSource).toContain(
      'Independent inspection of the 51-file registry tarball confirmed the packed README retains registry-independent v0.2.47 release wording'
    );
    expect(releaseSource).toContain(
      'No git tag, GitHub Release, extra publish attempt, or manual dist-tag change was performed.'
    );
    expect(releaseSource).toContain(
      'Git tag or GitHub Release promotion for `v0.2.47`.'
    );
    expect(releaseSource).toContain('## v0.2.46');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS PASS replay fixture offline check mode coverage. npm `latest` remains `0.2.40`; no `v0.2.46` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, add iOS native features, download GitHub Actions logs, write artifacts in check mode, or access the network during tests.'
    );
    expect(releaseSource).toContain(
      'Add `--check` mode to the existing offline replay fixture CLI.'
    );
    expect(releaseSource).toContain(
      "Compare the in-memory expected fixture with the existing artifact's validated canonical JSON bytes."
    );
    expect(releaseSource).toContain(
      'Exit `0` for a current artifact and `1` for missing, malformed, invalid, stale, or noncanonical artifacts.'
    );
    expect(releaseSource).toContain(
      'Report concise schema, provenance, source-line SHA-256, source-line, and canonical-format differences.'
    );
    expect(releaseSource).toContain(
      'Prove fake-log check paths never create or modify the target artifact and retain the existing no-network boundary.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.46 candidate.'
    );
    expect(releaseSource).toContain('### iOS PASS Replay Offline Check Mode');
    expect(releaseSource).toContain(
      '`getIOSSmokePassReplayFixtureDifferences()` returns deterministic `schema`, `schemaVersion`, `provenance.schema`, `provenance.<field>`, and `sourceLine` labels'
    );
    expect(releaseSource).toContain(
      '`pnpm fixtures:ios-pass-replay:check -- --log-file <local-log> --workflow-name <workflow> --run-id <run-id> --run-url <run-url> --head-sha <head-sha>`'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokePassReplayFixture.test.mjs` covers current, stale provenance, stale source-line/digest, missing, malformed, invalid-schema, and noncanonical fake artifacts.'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.2.46` and `fixtures:ios-pass-replay:check` command.'
    );
    expect(releaseSource).toContain(
      'Read-only `--check` mode with deterministic drift labels and canonical-byte comparison.'
    );
    expect(releaseSource).toContain(
      'Fake-log current/stale/missing/invalid/noncanonical no-write Vitest coverage.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.46 candidate state and the published v0.2.40 npm baseline.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.46`.'
    );
    expect(releaseSource).toContain('## v0.2.45');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS PASS replay fixture offline refresh artifact coverage. npm `latest` remains `0.2.40`; no `v0.2.45` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, add iOS native features, access GitHub from the refresh CLI, or access the network during tests. It keeps runtime behavior unchanged while moving replay provenance and the exact PASS source line into a canonical JSON artifact with a deterministic offline refresh path.'
    );
    expect(releaseSource).toContain(
      'Move replay provenance and the exact `RNICK_IOS_SMOKE_PASS` source line into a structured fixture artifact.'
    );
    expect(releaseSource).toContain(
      'Add an offline CLI that accepts a local Actions log plus workflow/run/head SHA provenance arguments.'
    );
    expect(releaseSource).toContain(
      'Derive job, step, timestamp, and source-line SHA-256 while writing canonical deterministic JSON.'
    );
    expect(releaseSource).toContain(
      'Pin the fixture schema, canonical formatting, and fake-log CLI success/error behavior without network access.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.45 candidate.'
    );
    expect(releaseSource).toContain(
      '### iOS PASS Replay Offline Refresh Artifact'
    );
    expect(releaseSource).toContain(
      '`test/fixtures/ios-smoke-pass-ci-replay.json` now owns `schemaVersion`, the ordered provenance fields, and the exact successful GitHub Actions-prefixed PASS source line.'
    );
    expect(releaseSource).toContain(
      '`scripts/ios-smoke-pass-replay-fixture.mjs` owns single PASS-line extraction'
    );
    expect(releaseSource).toContain(
      '`pnpm fixtures:ios-pass-replay -- --log-file <local-log> --workflow-name <workflow> --run-id <run-id> --run-url <run-url> --head-sha <head-sha>`'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokePassReplayFixture.test.mjs` builds exact fake-log schema expectations'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.45`.');
    expect(releaseSource).toContain(
      'Canonical structured replay fixture under `test/fixtures`.'
    );
    expect(releaseSource).toContain(
      'Reusable replay fixture schema/format module and offline refresh CLI.'
    );
    expect(releaseSource).toContain(
      'Fake-log deterministic output and error-path Vitest coverage.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.45 candidate state and the published v0.2.40 npm baseline.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.45`.'
    );
    expect(releaseSource).toContain('## v0.2.44');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS PASS replay fixture source-line integrity digest coverage. npm `latest` remains `0.2.40`; no `v0.2.44` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, add iOS native features, or access GitHub during tests. It keeps runtime behavior unchanged while binding the replay provenance to the exact successful `RNICK_IOS_SMOKE_PASS` source line with SHA-256.'
    );
    expect(releaseSource).toContain(
      'Add the exact PASS source-line SHA-256 to `IOS_SMOKE_PASS_CI_LOG_REPLAY_PROVENANCE`.'
    );
    expect(releaseSource).toContain(
      'Extract exactly one `RNICK_IOS_SMOKE_PASS` source line and reject missing or duplicate lines.'
    );
    expect(releaseSource).toContain(
      'Verify the replay source line matches the provenance digest before parsing its payload against the existing matrix schema.'
    );
    expect(releaseSource).toContain(
      'Document digest recalculation when a stale replay fixture is refreshed.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.44 candidate.'
    );
    expect(releaseSource).toContain(
      '### iOS PASS Replay Source-Line Integrity Digest'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeContract.test.mjs` now pins `sourceLineSha256` to `c20c9e72f2b9f3159d7db56c7c811a3ecb81555a9d9e90350d2e155e6f832dc6`.'
    );
    expect(releaseSource).toContain(
      '`extractSingleIOSSmokePassCIReplaySourceLine()` requires exactly one PASS source line'
    );
    expect(releaseSource).toContain(
      'calculate SHA-256 over that exact UTF-8 line without a trailing newline'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.44`.');
    expect(releaseSource).toContain(
      'Exact PASS source-line SHA-256 provenance and local Node crypto assertion.'
    );
    expect(releaseSource).toContain(
      'Missing and duplicate PASS source-line rejection coverage.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.44 candidate state and the published v0.2.40 npm baseline.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.44`.'
    );
    expect(releaseSource).toContain('## v0.2.43');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS PASS payload replay fixture provenance coverage. npm `latest` remains `0.2.40`; no `v0.2.43` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, or add iOS native features. It keeps runtime behavior unchanged while making the successful GitHub Actions source behind `IOS_SMOKE_PASS_CI_LOG_REPLAY_FIXTURE` explicit and testable.'
    );
    expect(releaseSource).toContain(
      'Pin workflow `iOS Validation`, source run `28928015548`, head SHA `c6981c3b6b06e5e6e34f42147a94e4299a0f82b2`, source URL, job, step, and timestamp beside the replay fixture.'
    );
    expect(releaseSource).toContain(
      'Verify the GitHub Actions job/step/timestamp prefix is derived from the pinned provenance metadata.'
    );
    expect(releaseSource).toContain(
      'Document how to refresh the replay fixture when its successful CI payload becomes stale.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.43 candidate.'
    );
    expect(releaseSource).toContain(
      '### iOS PASS Payload Replay Fixture Provenance'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeContract.test.mjs` now includes `IOS_SMOKE_PASS_CI_LOG_REPLAY_PROVENANCE`'
    );
    expect(releaseSource).toContain(
      'The replay test asserts the full provenance object'
    );
    expect(releaseSource).toContain(
      'update `IOS_SMOKE_PASS_CI_LOG_REPLAY_PROVENANCE` and `IOS_SMOKE_PASS_CI_LOG_REPLAY_FIXTURE` together'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.43`.');
    expect(releaseSource).toContain(
      'Replay fixture source workflow, run id, head SHA, URL, job, step, and timestamp provenance in `test/iosSmokeContract.test.mjs`.'
    );
    expect(releaseSource).toContain(
      'Provenance-to-log-prefix Vitest assertions and stale fixture refresh guidance.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.43 candidate state and the published v0.2.40 npm baseline.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.43`.'
    );
    expect(releaseSource).toContain('## v0.2.42');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS PASS payload CI log replay fixture coverage. npm `latest` remains `0.2.40`; no `v0.2.42` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, or add iOS native features. It keeps iOS native compression behavior unchanged while pinning the real GitHub Actions log shape emitted by a successful `RNICK_IOS_SMOKE_PASS` host-app smoke.'
    );
    expect(releaseSource).toContain(
      'Add a replay fixture copied from a successful GitHub Actions iOS Validation `RNICK_IOS_SMOKE_PASS` line.'
    );
    expect(releaseSource).toContain(
      'Preserve the GitHub Actions job/step/timestamp prefix and the `ImageCompressionKitExample.debug.dylib` unified-log prefix in simulator-free Vitest coverage.'
    );
    expect(releaseSource).toContain(
      'Prove `parseIOSSmokePassPayload()` extracts the payload from the real CI-shaped line.'
    );
    expect(releaseSource).toContain(
      'Compare the replay payload against the matrix-derived required fields and formatted schema.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.42 candidate.'
    );
    expect(releaseSource).toContain('### iOS PASS Payload CI Log Replay Fixture');
    expect(releaseSource).toContain(
      '`test/iosSmokeContract.test.mjs` now includes `IOS_SMOKE_PASS_CI_LOG_REPLAY_FIXTURE`'
    );
    expect(releaseSource).toContain(
      'The replay test parses that line through `parseIOSSmokePassPayload()`'
    );
    expect(releaseSource).toContain(
      'The existing matrix test still owns all four WebP output x AVIF input combinations'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.42`.');
    expect(releaseSource).toContain(
      'Successful GitHub Actions iOS Validation PASS log replay fixture in `test/iosSmokeContract.test.mjs`.'
    );
    expect(releaseSource).toContain(
      'Matrix-derived required-field and schema checks against the replayed payload.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.42 candidate state and the published v0.2.40 npm baseline.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.42`.'
    );
    expect(releaseSource).toContain('## v0.2.41');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS PASS payload schema matrix helper coverage. npm `latest` remains `0.2.40`; no `v0.2.41` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output, force AVIF input availability or unavailability, force WebP output availability, or add iOS native features. It keeps iOS native compression behavior unchanged while making the simulator-free `RNICK_IOS_SMOKE_PASS` payload schema tests table-driven across the four WebP output x AVIF input capability combinations.'
    );
    expect(releaseSource).toContain(
      'Derive iOS PASS payload required-field schemas from one WebP output x AVIF input matrix.'
    );
    expect(releaseSource).toContain(
      'Keep legacy exported required-field constants compatible while making them matrix-derived.'
    );
    expect(releaseSource).toContain(
      'Replace duplicated PASS log JSON fixtures with a shared fixture factory for all four capability combinations.'
    );
    expect(releaseSource).toContain(
      'Preserve missing conditional WebP and AVIF result-field coverage.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.41 candidate.'
    );
    expect(releaseSource).toContain('### iOS PASS Payload Schema Matrix Helper');
    expect(releaseSource).toContain(
      '`scripts/ios-smoke-contract.mjs` now exposes `IOS_SMOKE_PASS_PAYLOAD_SCHEMA_MATRIX`'
    );
    expect(releaseSource).toContain(
      '`getIOSSmokePassPayloadRequiredFields()` now chooses the matrix case from `webpOutputAvailable` and `avifInputAvailable`'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeContract.test.mjs` now builds prefixed `RNICK_IOS_SMOKE_PASS` payloads with a fixture factory'
    );
    expect(releaseSource).toContain(
      'The matrix keeps `avifResultBytes`, `avifToPngResultBytes`, and `avifToWebPResultBytes` conditional on AVIF input availability'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.41`.');
    expect(releaseSource).toContain(
      'Matrix-driven PASS payload required-field helper in `scripts/ios-smoke-contract.mjs`.'
    );
    expect(releaseSource).toContain(
      'Four-case WebP output x AVIF input fixture factory coverage in `test/iosSmokeContract.test.mjs`.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.41 candidate state and the published v0.2.40 npm baseline.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.41`.'
    );
    expect(releaseSource).toContain('## v0.2.40');
    expect(releaseSource).toContain(
      'Status: published to npm as the `0.2.40` latest iOS AVIF-input unavailable PASS payload schema snapshot release. No `v0.2.40` tag or GitHub Release is part of this package-page promotion.'
    );
    expect(releaseSource).toContain(
      'This release does not enable AVIF output, force AVIF input unavailability, force WebP output availability, or add iOS native features. It keeps iOS native compression behavior unchanged while pinning the JSON payload fields emitted by successful `RNICK_IOS_SMOKE_PASS` host-app smoke logs when `avifInputAvailable=false`.'
    );
    expect(releaseSource).toContain(
      'Add simulator-free `RNICK_IOS_SMOKE_PASS` fixture coverage for the AVIF-input unavailable branches.'
    );
    expect(releaseSource).toContain(
      'Snapshot omission of `avifResultBytes` and `avifToPngResultBytes` when `avifInputAvailable=false`.'
    );
    expect(releaseSource).toContain(
      'Snapshot omission of `avifToWebPResultBytes` when WebP output is available but AVIF input is unavailable.'
    );
    expect(releaseSource).toContain(
      'Prove `unsupportedInputs` includes `avif` when AVIF source support is unavailable.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.40 npm latest release.'
    );
    expect(releaseSource).toContain(
      '### iOS AVIF-Input Unavailable PASS Payload Schema Snapshots'
    );
    expect(releaseSource).toContain(
      '`scripts/ios-smoke-contract.mjs` now exposes `IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_REQUIRED_FIELDS`, `IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS`, and an AVIF-aware `getIOSSmokePassPayloadRequiredFields()`'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeContract.test.mjs` parses prefixed `RNICK_IOS_SMOKE_PASS` log fixtures with `avifInputAvailable=false`, snapshots payload key order and type schema for WebP-output unavailable and available runtimes'
    );
    expect(releaseSource).toContain(
      "The fixtures also pin `unsupportedInputs: ['avif']`"
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.40`.');
    expect(releaseSource).toContain(
      'Conditional AVIF-input unavailable PASS payload schema helpers in `scripts/ios-smoke-contract.mjs`.'
    );
    expect(releaseSource).toContain(
      'Exact `avifInputAvailable=false` `RNICK_IOS_SMOKE_PASS` payload fixture expectations in `test/iosSmokeContract.test.mjs`.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.40 npm latest release state.'
    );
    expect(releaseSource).toContain(
      'npm publish promotion for `0.2.40` with the `latest` dist-tag.'
    );
    expect(releaseSource).toContain(
      'Git tag or GitHub Release promotion for `v0.2.40`.'
    );
    expect(releaseSource).toContain(
      '`npm view react-native-image-compression-kit version dist-tags --json`'
    );
    expect(releaseSource).toContain(
      '`pnpm smoke:registry -- --version 0.2.40`'
    );
    expect(releaseSource).toContain('## v0.2.39');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS WebP-output available PASS payload schema snapshot coverage. npm `latest` remains `0.2.38`; no `v0.2.39` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output, force WebP output availability, or add iOS native features. It keeps iOS native compression behavior unchanged while pinning the extra JSON payload fields emitted by successful `RNICK_IOS_SMOKE_PASS` host-app smoke logs when `webpOutputAvailable=true`.'
    );
    expect(releaseSource).toContain(
      'Add simulator-free `RNICK_IOS_SMOKE_PASS` fixture coverage for the WebP-output available branch.'
    );
    expect(releaseSource).toContain(
      'Snapshot the conditional WebP output result byte fields: `jpegToWebPResultBytes`, `pngToWebPResultBytes`, `gifToWebPResultBytes`, `webpToWebPResultBytes`, `heicToWebPResultBytes`, `heifToWebPResultBytes`, and `avifToWebPResultBytes`.'
    );
    expect(releaseSource).toContain(
      'Snapshot `webpTargetSizeResultBytes` as a required conditional field when `webpOutputAvailable=true`.'
    );
    expect(releaseSource).toContain(
      'Prove `unsupportedOutputs` excludes `webp` when WebP destination support is available.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.39 candidate.'
    );
    expect(releaseSource).toContain('### iOS WebP Output PASS Payload Schema Snapshots');
    expect(releaseSource).toContain(
      '`scripts/ios-smoke-contract.mjs` now exposes `IOS_SMOKE_PASS_WEBP_OUTPUT_REQUIRED_FIELDS`, `IOS_SMOKE_PASS_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS`, and `getIOSSmokePassPayloadRequiredFields()`'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeContract.test.mjs` parses a prefixed `RNICK_IOS_SMOKE_PASS` log fixture with `webpOutputAvailable=true`, snapshots the payload key order and type schema for all WebP output byte fields plus `webpTargetSizeResultBytes`'
    );
    expect(releaseSource).toContain(
      "The fixture also pins `unsupportedOutputs: ['heic', 'heif', 'avif']`"
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.39`.');
    expect(releaseSource).toContain(
      'Conditional WebP-output available PASS payload schema helpers in `scripts/ios-smoke-contract.mjs`.'
    );
    expect(releaseSource).toContain(
      'Exact `webpOutputAvailable=true` `RNICK_IOS_SMOKE_PASS` payload fixture expectations in `test/iosSmokeContract.test.mjs`.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.39 candidate state and the published v0.2.38 npm baseline.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.39`.'
    );
    expect(releaseSource).toContain('## v0.2.38');
    expect(releaseSource).toContain(
      'Status: published to npm as the `0.2.38` latest iOS smoke PASS payload schema snapshot release. No `v0.2.38` tag or GitHub Release is part of this package-page promotion.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while pinning the JSON payload schema emitted by successful `RNICK_IOS_SMOKE_PASS` host-app smoke logs.'
    );
    expect(releaseSource).toContain(
      'Add simulator-free `RNICK_IOS_SMOKE_PASS` log line fixture parsing coverage.'
    );
    expect(releaseSource).toContain(
      'Snapshot the required PASS payload key order and type schema for platform, result byte, capability, target-size, and unsupported format fields.'
    );
    expect(releaseSource).toContain(
      'Cover missing or malformed PASS payload logs without forcing a real simulator failure.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.38 candidate.'
    );
    expect(releaseSource).toContain('### iOS Smoke PASS Payload Schema Snapshots');
    expect(releaseSource).toContain(
      '`scripts/ios-smoke-contract.mjs` now exposes `parseIOSSmokePassPayload()`, `IOS_SMOKE_PASS_PAYLOAD_REQUIRED_FIELDS`, `listMissingIOSSmokePassPayloadFields()`, and `formatIOSSmokePassPayloadSchema()`'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeContract.test.mjs` parses a prefixed `RNICK_IOS_SMOKE_PASS` log fixture and snapshots the payload shape for `platform`, JPEG/PNG/GIF/WebP/HEIC/HEIF/AVIF result byte fields, PNG-output result byte fields, `targetSizeResultBytes`, `webpOutputAvailable`, `avifInputAvailable`, `unsupportedInputs`, and `unsupportedOutputs`.'
    );
    expect(releaseSource).toContain(
      'The fixture also verifies missing required fields, missing marker logs, missing JSON payloads, malformed JSON payloads, and non-object JSON payloads, so a green smoke run cannot silently drop or rename the key success fields.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.38`.');
    expect(releaseSource).toContain(
      'PASS payload parser and schema helper coverage in `scripts/ios-smoke-contract.mjs`.'
    );
    expect(releaseSource).toContain(
      'Exact `RNICK_IOS_SMOKE_PASS` payload fixture expectations in `test/iosSmokeContract.test.mjs`.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.38 candidate state.'
    );
    expect(releaseSource).toContain(
      'Git tag or GitHub Release promotion for `v0.2.38`.'
    );
    expect(releaseSource).toContain('## v0.2.37');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS smoke diagnostics artifact schema snapshot coverage. npm `latest` remains `0.2.19`; no `v0.2.37` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while pinning the exact markdown schema that failed iOS smoke diagnostics artifacts expose in `ios-smoke-diagnostics/ios-smoke-summary.md` and the GitHub Step Summary.'
    );
    expect(releaseSource).toContain(
      'Add exact `formatIOSSmokeDiagnosticsSummary()` markdown schema fixture expectations.'
    );
    expect(releaseSource).toContain(
      'Cover empty-log and no-marker fallback text for failed smoke summaries.'
    );
    expect(releaseSource).toContain(
      'Cover very-long-log marker and packed-tail window bounds without forcing a simulator failure.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.37 candidate.'
    );
    expect(releaseSource).toContain('### iOS Smoke Diagnostics Artifact Schema Snapshots');
    expect(releaseSource).toContain(
      '`test/iosSmokeContract.test.mjs` now snapshots the full `formatIOSSmokeDiagnosticsSummary()` markdown shape: `## iOS smoke diagnostics`, `### Key markers and diagnostics`, `### Packed log tail`, and the fenced `text` blocks used by GitHub summary rendering.'
    );
    expect(releaseSource).toContain(
      'The empty-log fixture pins `(no RNICK_IOS_SMOKE markers or diagnostics lines captured)` and `(no iOS smoke log captured)` fallback text. The no-marker fixture pins the same marker fallback while preserving ordinary smoke command output in the packed log tail.'
    );
    expect(releaseSource).toContain(
      'The very-long-log fixture pins marker and tail truncation independently, proving the marker section keeps the last diagnostic lines while the packed tail keeps the final raw log lines.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.37`.');
    expect(releaseSource).toContain(
      'Exact markdown schema snapshot coverage for `formatIOSSmokeDiagnosticsSummary()`.'
    );
    expect(releaseSource).toContain(
      'Empty-log, no-marker, and very-long-log summary fixture expectations.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.37 candidate state.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.37`.'
    );
    expect(releaseSource).toContain('## v0.2.36');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS smoke artifact failure-path dry-run fixture coverage. npm `latest` remains `0.2.19`; no `v0.2.36` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while proving the iOS smoke diagnostics summary and artifact failure path with a local fake-log dry run instead of forcing a simulator failure.'
    );
    expect(releaseSource).toContain(
      'Run `node scripts/ios-validation.mjs summarize-smoke-log` against a fake `ios-smoke.log` fixture.'
    );
    expect(releaseSource).toContain(
      'Verify the CLI writes the same packed diagnostics summary to stdout and `$GITHUB_STEP_SUMMARY`.'
    );
    expect(releaseSource).toContain(
      'Pin the iOS Validation workflow summary and upload artifact steps as failure-only `if: failure()` paths.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.36 candidate.'
    );
    expect(releaseSource).toContain('### iOS Smoke Artifact Failure-Path Dry Run Fixtures');
    expect(releaseSource).toContain(
      '`test/iosSmokeSummaryCli.test.mjs` runs `node scripts/ios-validation.mjs summarize-smoke-log` with a fake `ios-smoke.log`, sets `GITHUB_STEP_SUMMARY` to a temporary file, and asserts stdout exactly matches the summary file content.'
    );
    expect(releaseSource).toContain(
      'The fixture log includes iOS smoke attempt, `RNICK_IOS_SMOKE_*`, timeout, diagnostics, retry guidance, and log stream error markers so the summary keeps key markers before the packed log tail without depending on Xcode, Metro, or a simulator.'
    );
    expect(releaseSource).toContain(
      '`.github/workflows/ios-validation.yml` keeps the failure-only path explicit: it tees smoke output into `ios-smoke-diagnostics/ios-smoke.log`, summarizes that log into `ios-smoke-diagnostics/ios-smoke-summary.md`, and uploads the `ios-smoke-diagnostics` artifact only through `if: failure()` steps.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.36`.');
    expect(releaseSource).toContain(
      '`test/iosSmokeSummaryCli.test.mjs` fake-log CLI fixture for `summarize-smoke-log` stdout and `$GITHUB_STEP_SUMMARY` parity.'
    );
    expect(releaseSource).toContain(
      'Failure-only iOS smoke summary/upload artifact path expectations in README, Android verification doctor checks, and Vitest coverage.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.36 candidate state.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.36`.'
    );
    expect(releaseSource).toContain('Forced simulator smoke failures.');
    expect(releaseSource).toContain('## v0.2.35');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS smoke diagnostics packed log artifact coverage. npm `latest` remains `0.2.19`; no `v0.2.35` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while making failed iOS smoke diagnostics easier to find in GitHub Actions through a packed `ios-smoke-diagnostics` artifact and a GitHub Step Summary excerpt generated from the same Node-level formatter.'
    );
    expect(releaseSource).toContain(
      'Capture the full `pnpm example:ios:smoke` output into `ios-smoke-diagnostics/ios-smoke.log` on the iOS Validation workflow.'
    );
    expect(releaseSource).toContain(
      'Generate `ios-smoke-diagnostics/ios-smoke-summary.md` and append the same ordered excerpt to `$GITHUB_STEP_SUMMARY` after a failed iOS smoke step.'
    );
    expect(releaseSource).toContain(
      'Cover the summary formatter without launching Xcode, Metro, or a simulator.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.35 candidate.'
    );
    expect(releaseSource).toContain('### iOS Smoke Diagnostics Artifact Fixtures');
    expect(releaseSource).toContain(
      '`.github/workflows/ios-validation.yml` now tees the host-app smoke output into `ios-smoke-diagnostics/ios-smoke.log`, summarizes that log with `node scripts/ios-validation.mjs summarize-smoke-log`, and uploads the packed diagnostics directory with `actions/upload-artifact@v6` when the smoke step fails.'
    );
    expect(releaseSource).toContain(
      '`formatIOSSmokeDiagnosticsSummary()` now owns the GitHub Step Summary shape.'
    );
    expect(releaseSource).toContain(
      'It keeps key `RNICK_IOS_SMOKE_*`, timeout, retry, failure, and log-stream-error lines before the packed log tail so the most useful markers remain visible even when the raw smoke log is long.'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeContract.test.mjs` validates the packed diagnostics summary ordering and marker extraction with fake log text, including timeout diagnostics, `RNICK_IOS_SMOKE_STEP_START`, retry guidance, and log stream error lines.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.35`.');
    expect(releaseSource).toContain(
      '`summarize-smoke-log` mode in `scripts/ios-validation.mjs` for reusable GitHub Step Summary generation.'
    );
    expect(releaseSource).toContain(
      'iOS Validation workflow failure artifact upload for `ios-smoke-diagnostics`.'
    );
    expect(releaseSource).toContain(
      'Node-level fixture coverage for diagnostics excerpt and packed log tail ordering.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.35 candidate state.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.35`.'
    );
    expect(releaseSource).toContain('## v0.2.34');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS smoke log stream error fixture coverage. npm `latest` remains `0.2.19`; no `v0.2.34` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while adding simulator-free fixture coverage for log stream `error` events flowing through output, lifecycle snapshot state, and timeout diagnostics used by `scripts/ios-validation.mjs smoke`.'
    );
    expect(releaseSource).toContain(
      'Treat log process `error` events as smoke log output inside `createSmokeAttemptLifecycle()`.'
    );
    expect(releaseSource).toContain(
      'Cover fake EventEmitter log stream `error` output and snapshot state without launching Xcode, Metro, or a simulator.'
    );
    expect(releaseSource).toContain(
      'Verify timeout diagnostics receive the log stream error text through `createSmokeTimeoutErrorFromCLIState()`.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.34 candidate.'
    );
    expect(releaseSource).toContain('### iOS Smoke Log Stream Error Fixtures');
    expect(releaseSource).toContain(
      '`createSmokeAttemptLifecycle()` now records log process `error` events as `iOS smoke log stream error:` output and includes that text in `markerBuffer` and `smokeLogOutput` snapshot state.'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeLifecycle.test.mjs` validates the log stream error path with a fake EventEmitter process.'
    );
    expect(releaseSource).toContain(
      'The test pins output writing, snapshot state, timeout diagnostic propagation through `createSmokeTimeoutErrorFromCLIState()`, and cleanup after timeout settle.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.34`.');
    expect(releaseSource).toContain(
      '`createSmokeAttemptLifecycle()` log process `error` events now populate smoke-log snapshot state.'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeLifecycle.test.mjs` Node-level fixture coverage for log stream error output, snapshot state, and timeout diagnostics propagation.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.34 candidate state.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.34`.'
    );
    expect(releaseSource).toContain('## v0.2.33');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS smoke process lifecycle fixture coverage. npm `latest` remains `0.2.19`; no `v0.2.33` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while adding simulator-free fixture coverage for the log stream listener cleanup, log process termination, and log process reference clearing used by `scripts/ios-validation.mjs smoke`.'
    );
    expect(releaseSource).toContain(
      'Split the `runSmokeAttempt` process lifecycle into `createSmokeAttemptLifecycle()` so Metro/log stream listeners and log process cleanup can be tested without launching Xcode, Metro, or a simulator.'
    );
    expect(releaseSource).toContain(
      'Cover PASS, FAIL, and timeout settle paths with fake EventEmitter Metro and log stream fixtures.'
    );
    expect(releaseSource).toContain(
      'Verify listener removal, log process stop, and `setLogProcess(null)` after each settle path.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.33 candidate.'
    );
    expect(releaseSource).toContain('### iOS Smoke Process Lifecycle Fixtures');
    expect(releaseSource).toContain(
      '`scripts/ios-validation.mjs` now delegates smoke marker observation, Metro/log stream listener lifecycle, log stream error handling, log process termination, and log process reference clearing to `createSmokeAttemptLifecycle()`.'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeLifecycle.test.mjs` validates PASS, FAIL, and timeout settle paths with fake EventEmitter Metro/log stream fixtures.'
    );
    expect(releaseSource).toContain(
      'The tests pin listener counts for Metro stdout/stderr, log stream stdout/stderr, and log stream `error`, then assert cleanup stops the log process and clears `setLogProcess(null)` exactly once per settle path.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.33`.');
    expect(releaseSource).toContain(
      '`createSmokeAttemptLifecycle()` helper for iOS smoke marker observation and process lifecycle cleanup.'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeLifecycle.test.mjs` Node-level fixture coverage for PASS, FAIL, and timeout cleanup paths.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.33 candidate state.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.33`.'
    );
    expect(releaseSource).toContain('## v0.2.32');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS smoke timeout CLI fixture coverage. npm `latest` remains `0.2.19`; no `v0.2.32` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while adding simulator-free fixture coverage for the CLI timeout diagnostic assembly and retry warning order used by `scripts/ios-validation.mjs smoke`.'
    );
    expect(releaseSource).toContain(
      'Split the `runSmokeAttempt` timeout diagnostic assembly into `createSmokeTimeoutErrorFromCLIState()` so app/container/process/log inputs can be tested without launching Xcode, Metro, or a simulator.'
    );
    expect(releaseSource).toContain(
      'Cover fake launch output, captured `RNICK_IOS_SMOKE_*` log stream output, Metro output, unified log output, app container lookup, and process lookup in Node-level Vitest fixtures.'
    );
    expect(releaseSource).toContain(
      'Cover the timeout retry warning order so the diagnostics block is printed before the retry guidance.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.32 candidate.'
    );
    expect(releaseSource).toContain('### iOS Smoke CLI Timeout Fixtures');
    expect(releaseSource).toContain(
      '`scripts/ios-validation.mjs` now delegates timeout diagnostic input assembly to `createSmokeTimeoutErrorFromCLIState()` and retry warning ordering to `formatSmokeRetryWarningMessages()`.'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeCliTimeout.test.mjs` validates the CLI timeout path with fake simulator summary, app/data container lookups, process lookup, launch output, captured log stream output, Metro output, and unified log output.'
    );
    expect(releaseSource).toContain(
      'The test also pins diagnostics-before-retry warning order without forcing a real simulator timeout.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.32`.');
    expect(releaseSource).toContain(
      '`createSmokeTimeoutErrorFromCLIState()` helper for CLI timeout diagnostic input assembly.'
    );
    expect(releaseSource).toContain(
      '`formatSmokeRetryWarningMessages()` helper for diagnostics-before-retry warning order.'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeCliTimeout.test.mjs` Node-level fixture coverage for CLI timeout diagnostics and retry warning ordering.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest coverage updated for the v0.2.32 candidate state.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.32`.'
    );
    expect(releaseSource).toContain('## v0.2.31');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS smoke diagnostic testability hardening. npm `latest` remains `0.2.19`; no `v0.2.31` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output or add iOS features. It keeps iOS native compression behavior unchanged while extracting the smoke retry, environment override, and timeout diagnostic formatting contract into simulator-free Node-level test coverage.'
    );
    expect(releaseSource).toContain(
      'Extract the iOS smoke retry and timeout diagnostic contract into `scripts/ios-smoke-contract.mjs`.'
    );
    expect(releaseSource).toContain(
      'Cover `RNICK_IOS_SMOKE_ATTEMPTS`, `RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS`, and `RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW` defaults and overrides without launching Xcode, Metro, or a simulator.'
    );
    expect(releaseSource).toContain(
      'Cover timeout-only retry decisions so only `rnickSmokeTimeout` errors retry before the final attempt.'
    );
    expect(releaseSource).toContain(
      'Cover timeout diagnostic formatting for simulator state, app/data containers, app process lookup, launch output, captured `RNICK_IOS_SMOKE_*` stream tail, Metro output tail, and unified log tail.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the v0.2.31 candidate.'
    );
    expect(releaseSource).toContain('### iOS Smoke Contract Testability');
    expect(releaseSource).toContain(
      '`scripts/ios-validation.mjs` now delegates environment parsing, retry decision checks, retry warning text, and timeout error formatting to `scripts/ios-smoke-contract.mjs`.'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeContract.test.mjs` validates the iOS smoke contract without any simulator dependency.'
    );
    expect(releaseSource).toContain(
      'The tests pin default and overridden smoke env values, invalid override fallback behavior, timeout-only retry gating before the final attempt, and the diagnostics block shape.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.31`.');
    expect(releaseSource).toContain(
      '`scripts/ios-smoke-contract.mjs` helper module for iOS smoke env parsing, retry gating, retry warnings, and timeout diagnostics.'
    );
    expect(releaseSource).toContain(
      '`test/iosSmokeContract.test.mjs` Node-level Vitest coverage for iOS smoke env overrides, timeout-only retry decisions, and timeout diagnostics.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest configuration updated for the v0.2.31 candidate state.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.31`.'
    );
    expect(releaseSource).toContain('## v0.2.30');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for iOS smoke retry and diagnostic hardening. npm `latest` remains `0.2.19`; no `v0.2.30` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output or add iOS features. It keeps the iOS native behavior unchanged while making `scripts/ios-validation.mjs smoke` retry timeout-only `RNICK_IOS_SMOKE_PASS` misses and print simulator/app/process/log diagnostics before retrying or failing.'
    );
    expect(releaseSource).toContain(
      'Retry timeout-only iOS smoke attempts with a fresh app launch through `RNICK_IOS_SMOKE_ATTEMPTS`.'
    );
    expect(releaseSource).toContain(
      'Warm the `RNICK_IOS_SMOKE_*` log stream before app launch through `RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS`.'
    );
    expect(releaseSource).toContain(
      'Print timeout diagnostics for simulator state, app/data containers, app process lookup, launch output, captured smoke stream tail, Metro output tail, and recent unified logs from `RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW`.'
    );
    expect(releaseSource).toContain(
      'Update README, release notes, Android verification doctor checks, and Vitest expectations for the Xcode 26.5 / iPhoneSimulator26.5 runner environment.'
    );
    expect(releaseSource).toContain('### iOS Smoke Retry And Diagnostics');
    expect(releaseSource).toContain(
      'The iOS smoke runner now treats a missing `RNICK_IOS_SMOKE_PASS` marker as a timeout-only attempt when no `RNICK_IOS_SMOKE_FAIL` marker is captured.'
    );
    expect(releaseSource).toContain(
      'Each attempt starts the unified log stream before launch, waits `RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS`, then launches `com.imagecompressionkit.example` with `SIMCTL_CHILD_RNICK_IOS_SMOKE=1`.'
    );
    expect(releaseSource).toContain(
      'On timeout, the script prints an `iOS smoke diagnostics:` block with simulator state, app and data container lookup, process lookup, launch output, captured `RNICK_IOS_SMOKE_*` stream tail, Metro output tail, and recent unified logs from `RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW`.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.30`.');
    expect(releaseSource).toContain('iOS smoke timeout-only retry support.');
    expect(releaseSource).toContain(
      'iOS smoke timeout diagnostics for simulator, app, process, launch, Metro, and unified log state.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.30 candidate state and Xcode 26.5 runner environment.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.30`.'
    );
    expect(releaseSource).toContain('## v0.2.29');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for the Android AVIF output helper validation-result provenance contract. npm `latest` remains `0.2.19`; no `v0.2.29` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output. It keeps the Android `compressImage()` AVIF output scaffold on `ERR_NOT_IMPLEMENTED` before helper entry while pinning whether helper validation details came from the direct file or the muxed file inside `AndroidAvifOutputHelper`.'
    );
    expect(releaseSource).toContain(
      'Add direct validation detail expectations proving direct file name, byte size, signature result, and decode-back result stay attached to the direct validation file.'
    );
    expect(releaseSource).toContain(
      'Add muxed validation detail expectations proving muxed file name, byte size, signature result, and decode-back result stay attached to the muxed validation file.'
    );
    expect(releaseSource).toContain(
      'Add direct-failure plus muxed-success/failure expectations proving `details` preserve encoder, direct validation, muxer, final validation order with file provenance.'
    );
    expect(releaseSource).toContain(
      'Keep Android capability reporting on `formats.avif.output=false`.'
    );
    expect(releaseSource).toContain(
      'Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.29 candidate.'
    );
    expect(releaseSource).toContain('### Validation Provenance Contract');
    expect(releaseSource).toContain(
      'The default Android AVIF file validator now records one provenance summary per validation file with the file name, byte size, signature result, decode-back result, and decoded dimensions when available.'
    );
    expect(releaseSource).toContain(
      'Android JVM helper tests now assert direct validation success keeps the direct file name, direct byte size, signature result, and decode-back result in the direct validation detail, while still skipping the muxer.'
    );
    expect(releaseSource).toContain(
      'Android JVM helper tests now assert direct validation failure followed by muxed success or muxed failure keeps `details` ordered as encoder, direct validation, muxer, and final validation, with the final validation detail naming the muxed file and its byte size, signature result, and decode-back result.'
    );
    expect(releaseSource).toContain(
      'The contract keeps helper diagnostics stable before production wiring without changing `compressImage()` behavior, capability reporting, or AVIF output support.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.29`.');
    expect(releaseSource).toContain(
      'Android AVIF output helper direct validation provenance JVM coverage.'
    );
    expect(releaseSource).toContain(
      'Android AVIF output helper muxed validation provenance JVM coverage.'
    );
    expect(releaseSource).toContain(
      'Android AVIF output helper direct-failure detail ordering JVM coverage.'
    );
    expect(releaseSource).toContain(
      'Default Android AVIF file validator detail summary now includes file name, byte size, signature result, decode-back result, and decoded dimensions.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.29 candidate state.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.29`.'
    );
    expect(releaseSource).toContain('## v0.2.28');
    expect(releaseSource).toContain('## v0.2.27');
    expect(releaseSource).toContain('## v0.2.26');
    expect(releaseSource).toContain('## v0.2.25');
    expect(releaseSource).toContain('## v0.2.24');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for the Android AVIF output helper injected success contract. npm `latest` remains `0.2.19`; no `v0.2.24` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      "This candidate does not enable AVIF output. It keeps the Android `compressImage()` AVIF output scaffold on `ERR_NOT_IMPLEMENTED` before helper entry while adding an injected muxed success path so the helper's passed-smoke result contract is fixed before production wiring."
    );
    expect(releaseSource).toContain(
      'Add fake valid AVIF bytes, muxed output file, and decode-back success coverage to `AndroidAvifOutputHelper`.'
    );
    expect(releaseSource).toContain(
      'Fix helper success expectations for `byteSize`, `signatureValid`, `decodeBackValid`, `blockerCode`, `blocker`, and `productionDecision`.'
    );
    expect(releaseSource).toContain(
      'Keep Android capability reporting on `formats.avif.output=false`.'
    );
    expect(releaseSource).toContain(
      'Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.24 candidate.'
    );
    expect(releaseSource).toContain('### Injected Success Contract');
    expect(releaseSource).toContain(
      'Android JVM tests now inject direct bytes that fail validation, muxed fake AVIF bytes that pass signature checks, and decode-back dimensions that match the helper input.'
    );
    expect(releaseSource).toContain(
      'Successful helper validation reports `success=true`, `byteSize` from the muxed fake AVIF file, `signatureValid=true`, `decodeBackValid=true`, `blockerCode=null`, and `blocker=null`.'
    );
    expect(releaseSource).toContain(
      'A passed helper smoke still reports `PRODUCTION_DECISION_SMOKE_PASSED_KEEP_DISABLED` because production wiring, metadata preserve, `output.maxBytes`, and animated AVIF boundaries are not implemented.'
    );
    expect(releaseSource).toContain(
      '`AndroidAvifOutputHelper.INJECTABLE_VALIDATION_SEAM` now describes fake success and failure coverage; `compressImage()` and capability reporting still keep AVIF output disabled.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.24`.');
    expect(releaseSource).toContain(
      'Android AVIF output helper injected success-path JVM coverage.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.24 candidate state.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.24`.'
    );
    expect(releaseSource).toContain('## v0.2.23');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for the Android AVIF output helper injectable validation seam. npm `latest` remains `0.2.19`; no `v0.2.23` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output. It keeps the Android `compressImage()` AVIF output scaffold on `ERR_NOT_IMPLEMENTED` before helper entry while adding an injectable helper dependency seam so fake encoded bytes, invalid signatures, decode-back failures, and codec failures can be covered before production wiring.'
    );
    expect(releaseSource).toContain(
      'Add injectable encoder, muxer, output-file, and decode-back validation dependencies to `AndroidAvifOutputHelper`.'
    );
    expect(releaseSource).toContain(
      'Cover fake encoded bytes, invalid signature, decode-back failure, and codec failure result paths in Android JVM tests.'
    );
    expect(releaseSource).toContain(
      'Keep Android capability reporting on `formats.avif.output=false`.'
    );
    expect(releaseSource).toContain(
      'Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.23 candidate.'
    );
    expect(releaseSource).toContain('### Injectable Validation Seam');
    expect(releaseSource).toContain(
      '`AndroidAvifOutputHelperDependencies` wraps the default bitmap creation, MediaCodec encode, output-file creation, MediaMuxer mux, and ImageDecoder validation path.'
    );
    expect(releaseSource).toContain(
      '`AndroidAvifOutputHelper.runEncodeDecodeBack()` accepts injected dependencies while preserving the default production helper route for instrumentation.'
    );
    expect(releaseSource).toContain(
      'Android JVM tests now inject fake encoder bytes, fake muxed bytes, fake validation results, and injected encoder failures to prove blocker classification without requiring a real `image/avif` encoder.'
    );
    expect(releaseSource).toContain(
      '`AndroidAvifOutputHelper.INJECTABLE_VALIDATION_SEAM` records that the seam is internal validation coverage only; `compressImage()` and capability reporting still keep AVIF output disabled.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.23`.');
    expect(releaseSource).toContain(
      'Android AVIF output helper dependency seam for encoder, muxer, output file, and decode-back validation injection.'
    );
    expect(releaseSource).toContain(
      'Android JVM tests for fake encoded bytes, invalid signature, decode-back failure, codec failure, scaffold helper-entry blocking, and capability notes.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.23 candidate state.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.23`.'
    );
    expect(releaseSource).toContain('## v0.2.22');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for the Android AVIF output production helper extraction. npm `latest` remains `0.2.19`; no `v0.2.22` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output. It extracts the Android AVIF encode/decode-back implementation from the prototype object into `AndroidAvifOutputHelper`, so future production wiring can reuse explicit helper input, output, sample, file-validation, and result types while `compressImage()` continues to reject before helper entry.'
    );
    expect(releaseSource).toContain(
      'Extract the Android AVIF encode/decode-back helper from the prototype-only structure into reusable internal helper types.'
    );
    expect(releaseSource).toContain(
      "Keep `output.format: 'avif'` on the documented `ERR_NOT_IMPLEMENTED` path before source access or helper entry."
    );
    expect(releaseSource).toContain(
      'Keep Android capability reporting on `formats.avif.output=false`.'
    );
    expect(releaseSource).toContain(
      'Cover helper input, result, blocker, and failure boundaries in Android JVM tests.'
    );
    expect(releaseSource).toContain(
      'Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.22 candidate.'
    );
    expect(releaseSource).toContain('### Production Helper Extraction');
    expect(releaseSource).toContain(
      '`AndroidAvifOutputHelper` owns the MediaCodec image/avif encode/decode-back helper implementation.'
    );
    expect(releaseSource).toContain(
      '`AndroidAvifOutputHelperInput`, `AndroidAvifOutputHelperOutput`, `AndroidAvifOutputHelperSample`, `AndroidAvifOutputHelperFileValidation`, and `AndroidAvifOutputHelperResult` make the helper boundary explicit.'
    );
    expect(releaseSource).toContain(
      '`AndroidAvifOutputPrototype.runEncodeDecodeBackSmoke()` now delegates to the helper and adapts the helper result back to the existing smoke result shape for instrumentation logs.'
    );
    expect(releaseSource).toContain(
      '`AndroidAvifOutputProductionScaffold.reusableHelperRoute` points at the extracted production helper route, but `willEnterEncodeDecodeBackHelper=false` while `avif.output=false`.'
    );
    expect(releaseSource).toContain(
      'Android `compressImage()` still rejects AVIF output with the scaffold-specific `ERR_NOT_IMPLEMENTED` message before source access or helper entry.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.22`.');
    expect(releaseSource).toContain(
      'Android AVIF output helper extraction into a reusable internal helper file.'
    );
    expect(releaseSource).toContain(
      'Android JVM tests for helper input construction, SDK/encoder blockers, validation blocker classification, codec failure messaging, scaffold helper-entry blocking, and capability notes.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.22 candidate state.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.22`.'
    );
    expect(releaseSource).toContain('## v0.2.21');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for the Android AVIF output production wiring scaffold. npm `latest` remains `0.2.19`; no `v0.2.21` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      "This candidate does not enable AVIF output. It moves Android AVIF output handling closer to the production `compressImage()` boundary by routing `output.format: 'avif'` through a production wiring scaffold that rejects before source access or MediaCodec encode/decode-back helper entry while `avif.output=false`."
    );
    expect(releaseSource).toContain(
      'Add an Android AVIF output production wiring scaffold that can reuse the encode/decode-back helper route later.'
    );
    expect(releaseSource).toContain(
      "Keep `output.format: 'avif'` on the documented `ERR_NOT_IMPLEMENTED` path."
    );
    expect(releaseSource).toContain(
      'Block metadata `preserve`, `output.maxBytes`, and animated AVIF preservation before Android AVIF output helper entry.'
    );
    expect(releaseSource).toContain(
      'Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.21 candidate.'
    );
    expect(releaseSource).toContain('### Production Wiring Scaffold');
    expect(releaseSource).toContain(
      '`AndroidAvifOutputProductionScaffold` reports the scaffold route, reusable helper route, output-enabled decision, helper-entry decision, unsupported message, boundary blockers, and validation plan.'
    );
    expect(releaseSource).toContain(
      "Android `compressImage()` recognizes `output.format: 'avif'`, parses metadata and `output.maxBytes`, and then rejects with `ERR_NOT_IMPLEMENTED` before source access."
    );
    expect(releaseSource).toContain(
      '`willEnterEncodeDecodeBackHelper` remains `false` while `avif.output=false`.'
    );
    expect(releaseSource).toContain('Android capability reporting remains `formats.avif.output=false`.');
    expect(releaseSource).toContain('`package.json` version bump to `0.2.21`.');
    expect(releaseSource).toContain(
      'Android AVIF production wiring scaffold and helper-entry blockers for metadata `preserve`, `output.maxBytes`, and animated AVIF preservation.'
    );
    expect(releaseSource).toContain(
      'Android module AVIF output rejection path that uses the scaffold-specific `ERR_NOT_IMPLEMENTED` message before source access.'
    );
    expect(releaseSource).toContain(
      'Android JVM tests covering the scaffold, AVIF output rejection, and capability note boundary.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.21 candidate state.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.21`.'
    );
    expect(releaseSource).toContain(
      'Remote validation also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed candidate commit. The Android Instrumentation `RNICK_AVIF_OUTPUT_SMOKE` log must keep AVIF output disabled and expose the relevant blocker code unless a later non-candidate implementation explicitly enables AVIF output.'
    );
    expect(releaseSource).toContain('## v0.2.20');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for the AVIF output production wiring preflight. npm `latest` remains `0.2.19`; no `v0.2.20` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output. It keeps Android and iOS capability reporting on `output=false` while making the Android `RNICK_AVIF_OUTPUT_SMOKE` result production-decision ready with explicit blocker codes and an `outputCanBeEnabled=false` decision.'
    );
    expect(releaseSource).toContain('Keep Android and iOS AVIF output disabled.');
    expect(releaseSource).toContain(
      'Make Android encode/decode-back smoke results carry stable blocker codes for missing `image/avif` encoder, codec failure, invalid `ftyp` signature, and `ImageDecoder` decode-back failure.'
    );
    expect(releaseSource).toContain(
      "Keep `output.format: 'avif'` on the documented `ERR_NOT_IMPLEMENTED` path with metadata preserve, `output.maxBytes`, and animated AVIF boundaries."
    );
    expect(releaseSource).toContain(
      'Keep README, release notes, Android verification doctor checks, and Vitest expectations current for the v0.2.20 candidate.'
    );
    expect(releaseSource).toContain('### Production Decision Preflight');
    expect(releaseSource).toContain(
      '`AndroidAvifEncodeDecodeSmokeResult` reports `blockerCode`, `outputCanBeEnabled`, and `productionDecision`.'
    );
    expect(releaseSource).toContain(
      'The candidate blocker codes are `sdk_unavailable`, `no_image_avif_encoder`, `codec_failure`, `invalid_signature`, and `decode_back_failure`.'
    );
    expect(releaseSource).toContain(
      '`outputCanBeEnabled` remains `false` even if a file-validation smoke passes, because production wiring, metadata preserve, `output.maxBytes`, and animated AVIF boundaries are still not implemented.'
    );
    expect(releaseSource).toContain('Android capability reporting remains `formats.avif.output=false`.');
    expect(releaseSource).toContain('`package.json` version bump to `0.2.20`.');
    expect(releaseSource).toContain(
      'Android AVIF output smoke blocker classification for SDK unavailable, missing `image/avif` encoder, codec failure, invalid signature, and decode-back failure.'
    );
    expect(releaseSource).toContain(
      'Android AVIF output smoke production decision fields that keep AVIF output disabled before production wiring.'
    );
    expect(releaseSource).toContain(
      'Android instrumentation expectation that `RNICK_AVIF_OUTPUT_SMOKE` keeps `outputCanBeEnabled=false` and reports a stable blocker code when the smoke fails.'
    );
    expect(releaseSource).toContain(
      'README, release notes, Android verification doctor expectations, and Vitest expectations updated for the v0.2.20 candidate state.'
    );
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.20`.'
    );
    expect(releaseSource).toContain('### Validation');
    expect(releaseSource).toContain('Before considering the candidate ready:');
    expect(releaseSource).toContain(
      'Remote validation also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed candidate commit.'
    );
    expect(releaseSource).toContain(
      'After validation, keep this candidate unpublished until a separate publish goal.'
    );
    expect(releaseSource).toContain('## v0.2.19');
    expect(releaseSource).toContain(
      'Status: published to npm as the `0.2.19` latest AVIF output production gate release. No `v0.2.19` tag or GitHub Release is part of this package-page promotion.'
    );
    expect(releaseSource).toContain(
      'This release does not enable AVIF output. It tightens the public and test-covered explanation for why AVIF output remains disabled after the v0.2.17 Android `MediaCodec image/avif` encode/decode-back smoke blocker, and how future iOS AVIF output must stay runtime-gated by ImageIO destination support.'
    );
    expect(releaseSource).toContain(
      'Keep AVIF output capability reporting unchanged while making the production gate explicit.'
    );
    expect(releaseSource).toContain(
      'Align the Android AVIF smoke blocker language with the runtime capability notes and unsupported-output error message.'
    );
    expect(releaseSource).toContain(
      "Align iOS AVIF capability notes and `output.format: 'avif'` unsupported-output errors with the current ImageIO runtime-gated destination policy."
    );
    expect(releaseSource).toContain(
      "State that `metadata: 'preserve'`, `output.maxBytes`, and animated AVIF preservation remain unsupported for AVIF output until explicitly designed and tested."
    );
    expect(releaseSource).toContain(
      'Publish a package-page release whose packed README does not carry stale `v0.2.19 candidate` wording.'
    );
    expect(releaseSource).toContain(
      'Android AVIF output remains disabled until the `MediaCodec image/avif` encode/decode-back smoke produces a complete AVIF file with `ftyp` `avif` / `avis` signature bytes and `ImageDecoder` decode-back validation.'
    );
    expect(releaseSource).toContain(
      'Future iOS AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation.'
    );
    expect(releaseSource).toContain(
      "`metadata='preserve'`, `output.maxBytes`, and animated AVIF preservation remain unsupported for AVIF output until explicitly designed and tested."
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.19`.');
    expect(releaseSource).toContain(
      'Android `AndroidAvifOutputPrototype` production gate message now names production wiring, byte-signature validation, `ImageDecoder` decode-back validation, metadata preserve, `output.maxBytes`, and animated AVIF boundaries.'
    );
    expect(releaseSource).toContain(
      'Android AVIF capability notes now describe the `MediaCodec image/avif` encode/decode-back gate and the metadata, target-size, and animation unsupported boundaries.'
    );
    expect(releaseSource).toContain(
      'Android HEIC/HEIF/AVIF unsupported-output error message now explains that AVIF output remains disabled until the smoke produces a complete AVIF file and the remaining AVIF output boundaries are validated.'
    );
    expect(releaseSource).toContain(
      'iOS AVIF capability notes now state that future AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation.'
    );
    expect(releaseSource).toContain(
      'iOS AVIF unsupported-output error message now calls out metadata preserve, `output.maxBytes`, and animated AVIF preservation as unsupported AVIF output boundaries.'
    );
    expect(releaseSource).toContain(
      'TypeScript native-unavailable guidance now includes the AVIF output production gate boundary.'
    );
    expect(releaseSource).toContain(
      'README, release dry-run stale README snippets, Android verification doctor expectations, and Vitest expectations updated for the v0.2.19 published package state.'
    );
    expect(releaseSource).toContain('npm package publication under the `latest` dist-tag.');
    expect(releaseSource).toContain('Production AVIF output encoding.');
    expect(releaseSource).toContain('Android encoder production wiring.');
    expect(releaseSource).toContain('iOS AVIF output implementation.');
    expect(releaseSource).toContain('Metadata preservation for AVIF output.');
    expect(releaseSource).toContain('Target-size AVIF output.');
    expect(releaseSource).toContain('Animated AVIF preservation.');
    expect(releaseSource).toContain(
      'Git tag or GitHub Release promotion for `v0.2.19`.'
    );
    expect(releaseSource).toContain('### Release Checklist');
    expect(releaseSource).toContain('Before npm publish:');
    expect(releaseSource).toContain('After npm publish:');
    expect(releaseSource).toContain('npm publish --tag latest');
    expect(releaseSource).toContain(
      'npm view react-native-image-compression-kit version dist-tags.latest time.modified --json'
    );
    expect(releaseSource).toContain('pnpm smoke:registry -- --version 0.2.19');
    expect(releaseSource).toContain('### Pre-Publish Remote Verification');
    expect(releaseSource).toContain(
      'Release preparation commit `fb45336a875422620d5a64413ee3300bbb0aa9f0` passed GitHub Actions CI: `https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28700528814`.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation passed: `https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28700528804`.'
    );
    expect(releaseSource).toContain(
      'iOS Validation passed: `https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28700528803`.'
    );
    expect(releaseSource).toContain(
      'Android `RNICK_AVIF_OUTPUT_SMOKE` reported `attempted=false`, `success=false`, and blocker `No image/avif encoder was discovered through MediaCodecList.findEncoderForFormat().`, keeping AVIF output disabled.'
    );
    expect(releaseSource).toContain(
      'iOS smoke reported `RNICK_IOS_SMOKE_PASS` with `unsupportedOutputs` containing `webp`, `heic`, `heif`, and `avif`, matching the runtime-gated output policy.'
    );
    expect(releaseSource).toContain('### Post-Publish Registry Verification');
    expect(releaseSource).toContain(
      'confirmed package version `0.2.19`, `latest: 0.2.19`, and registry modified time `2026-07-04T08:41:31.627Z`.'
    );
    expect(releaseSource).toContain(
      'https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.19.tgz'
    );
    expect(releaseSource).toContain(
      'sha512-QI0XvKLtq9bi4QAnAq7BP8I8pq2X6wZ7Zp8O29Z7UUkoGqNp6nS0TDy2OYjblyp87vvVh7Z2RaDi09IV5WigZA=='
    );
    expect(releaseSource).toContain('f2691b8fde440c8ab20fec01dbadd18ba928839a');
    expect(releaseSource).toContain(
      'Published tarball README inspection confirmed `Status: v0.2.19 published`'
    );
    expect(releaseSource).toContain(
      'Published tarball README stale-candidate scan found no `v0.2.19 candidate`'
    );
    expect(releaseSource).toContain(
      '`pnpm smoke:registry -- --version 0.2.19` passed against the real registry tarball with `fileCount: 50`, `packageSize: 55677`, `unpackedSize: 246114`, and a clean consumer `tsc --noEmit`.'
    );
    expect(releaseSource).toContain('## v0.2.18');
    expect(releaseSource).toContain(
      'Status: published to npm as the `0.2.18` latest docs-only README correction. No `v0.2.18` tag or GitHub Release is part of this package-page correction.'
    );
    expect(releaseSource).toContain(
      'This release corrects the README that is shown on the npm package page after the `0.2.17` tarball shipped pre-publish candidate status text.'
    );
    expect(releaseSource).toContain(
      'Publish a docs-only package version so the npm package page reflects the corrected `0.2.18` release state.'
    );
    expect(releaseSource).toContain(
      'Remove stale `0.2.17` pre-publish package-page status wording from the packaged README.'
    );
    expect(releaseSource).toContain(
      'Keep Android runtime behavior, iOS runtime behavior, and the public TypeScript API unchanged.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.18`.');
    expect(releaseSource).toContain(
      'README status, installation, release guidance, and registry smoke examples updated for the published docs-only npm README correction.'
    );
    expect(releaseSource).toContain(
      'README copy now describes `0.2.18` as a docs-only README correction release while preserving the `0.2.17` runtime behavior surface.'
    );
    expect(releaseSource).toContain(
      'Source-level tests and Android verification doctor expectations are updated for the `0.2.18` published docs-only status.'
    );
    expect(releaseSource).toContain(
      'Release dry-run packed README stale checks now reject the stale `0.2.17` pre-publish candidate snippets that shipped in the published `0.2.17` tarball and the stale `0.2.18` candidate snippets from the pre-publish correction commit.'
    );
    expect(releaseSource).toContain(
      'npm `latest` publish and post-publish registry smoke are part of this publish gate.'
    );
    expect(releaseSource).toContain('Android or iOS runtime behavior changes.');
    expect(releaseSource).toContain('Native code changes.');
    expect(releaseSource).toContain('New public TypeScript API surface.');
    expect(releaseSource).toContain('Git tag or GitHub Release promotion for `v0.2.18`.');
    expect(releaseSource).toContain('### v0.2.17 Registry README Inspection');
    expect(releaseSource).toContain(
      'npm pack react-native-image-compression-kit@0.2.17 --pack-destination "$tmpdir"'
    );
    expect(releaseSource).toContain('react-native-image-compression-kit-0.2.17.tgz');
    expect(releaseSource).toContain(
      'Status: v0\\.2\\.17 candidate|Version `0\\.2\\.17` is an unpublished release candidate|latest published npm package is `0\\.2\\.14`|GitHub Release \\[v0\\.2\\.14\\]|v0\\.2\\.17 Android AVIF output encode/decode-back smoke candidate notes'
    );
    expect(releaseSource).toContain('The inspection found `Status: v0.2.17 candidate`');
    expect(releaseSource).toContain('the "latest published npm package is 0.2.14" wording');
    expect(releaseSource).toContain('v0.2.17 Android AVIF output encode/decode-back smoke candidate notes');
    expect(releaseSource).toContain(
      'After publishing, `pnpm smoke:registry -- --version 0.2.18` validates the real registry tarball and confirms the package-page README no longer contains the stale `0.2.17` candidate wording.'
    );
    expect(releaseSource).toContain('### Post-Publish Registry Verification');
    expect(releaseSource).toContain(
      'confirmed package version `0.2.18`, `latest: 0.2.18`, and registry modified time `2026-07-04T07:09:19.302Z`.'
    );
    expect(releaseSource).toContain(
      'https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.18.tgz'
    );
    expect(releaseSource).toContain(
      'sha512-fpM8aqOij9qXN3gk05b6wbGRCcvB16XnqxGoXOSI6+W67pSzCIWfKj4+URZCU+DSkNyKLehO1XvGj+RkrqOYVw=='
    );
    expect(releaseSource).toContain('72c7cbf845d436c936de8bbcc3844bc330416549');
    expect(releaseSource).toContain(
      'Published tarball README inspection confirmed `Status: v0.2.18 published`'
    );
    expect(releaseSource).toContain(
      'Published tarball README stale-candidate scan found no `v0.2.17 candidate`'
    );
    expect(releaseSource).toContain(
      '`pnpm smoke:registry -- --version 0.2.18` passed against the real registry tarball with `fileCount: 50`, `packageSize: 54991`, `unpackedSize: 242469`, and a clean consumer `tsc --noEmit`.'
    );
    expect(releaseSource).toContain(
      'Release promotion gate passed on commit `9f032e269e5d82e5fdaf38f554a113572cd63f1e`'
    );
    expect(releaseSource).toContain(
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28698349542'
    );
    expect(releaseSource).toContain(
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28698349545'
    );
    expect(releaseSource).toContain(
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28698349539'
    );
    expect(releaseSource).toContain('## v0.2.17');
    expect(releaseSource).toContain(
      'Status: published to npm as the `0.2.17` latest release, tagged as `v0.2.17`.'
    );
    expect(releaseSource).toContain(
      'This release does not enable AVIF output. It advances the v0.2.16 Android `MediaCodec image/avif` prototype from route discovery to a real static-file smoke attempt that either proves a minimal AVIF cache file can be encoded and decoded back, or records the blocker that keeps production AVIF output disabled.'
    );
    expect(releaseSource).toContain(
      'Attempt a repo-owned 16x12 Bitmap to AVIF cache-file encode on an API 34+ Android emulator or device.'
    );
    expect(releaseSource).toContain(
      'Validate the generated file has an `ftyp` box with `avif` or `avis` compatible brand.'
    );
    expect(releaseSource).toContain(
      'Decode the generated file with `ImageDecoder` and assert 16x12 output dimensions.'
    );
    expect(releaseSource).toContain(
      'Record a clear blocker when no encoder is exposed, the codec route fails, muxing fails, the signature is invalid, or decode-back fails.'
    );
    expect(releaseSource).toContain(
      'Keep AVIF output capability reporting unchanged until a production path is intentionally implemented.'
    );
    expect(releaseSource).toContain(
      'Align README, release notes, Android verification doctor checks, Vitest expectations, JVM tests, and Android instrumentation with the smoke result contract.'
    );
    expect(releaseSource).toContain(
      'The smoke route creates a 16x12 ARGB bitmap pattern, converts it into YUV420 input through `MediaCodec.getInputImage()`, queues it into an `image/avif` encoder, and collects encoder output bytes and muxable samples.'
    );
    expect(releaseSource).toContain(
      'The smoke validates direct encoder bytes first, then attempts a `MediaMuxer.MUXER_OUTPUT_HEIF` container path and validates the muxed output.'
    );
    expect(releaseSource).toContain(
      'A passing smoke requires both AVIF `ftyp` `avif` / `avis` signature bytes and `ImageDecoder` decode-back dimensions.'
    );
    expect(releaseSource).toContain(
      'Current GitHub Android Instrumentation on the API 35 Google APIs emulator reports `attempted=false`, `success=false`, and blocker `No image/avif encoder was discovered through MediaCodecList.findEncoderForFormat().`; that keeps AVIF output disabled.'
    );
    expect(releaseSource).toContain(
      'v0.2.17 keeps runtime capability reporting unchanged: Android AVIF `input=true` on Android 14+ and `output=false`; iOS AVIF input remains gated by `CGImageSourceCopyTypeIdentifiers()` and AVIF output remains `false`.'
    );
    expect(releaseSource).toContain(
      'Android may report AVIF `output=true` only after the smoke is promoted into a production encode path with metadata, target-size, unsupported-path, and public API behavior tests.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.17`.');
    expect(releaseSource).toContain(
      'Internal Android `AndroidAvifOutputPrototype.runEncodeDecodeBackSmoke()` route with `MediaCodec` input image writing, direct output validation, `MediaMuxer.MUXER_OUTPUT_HEIF` fallback, AVIF signature checking, and `ImageDecoder` decode-back validation.'
    );
    expect(releaseSource).toContain(
      'Android JVM tests for smoke blocker reporting below API 34 and when no `image/avif` encoder is discovered.'
    );
    expect(releaseSource).toContain(
      'Android instrumentation smoke that runs on API 34+, logs `RNICK_AVIF_OUTPUT_SMOKE`, accepts either a validated static AVIF file or a documented blocker, and asserts `getImageCompressionCapabilities().formats.avif.output=false`.'
    );
    expect(releaseSource).toContain('npm package publication under the `latest` dist-tag.');
    expect(releaseSource).toContain('Git tag `v0.2.17` and GitHub Release `v0.2.17`.');
    expect(releaseSource).toContain('pnpm smoke:registry -- --version 0.2.17');
    expect(releaseSource).toContain('git tag -a v0.2.17 -m "v0.2.17"');
    expect(releaseSource).toContain('git push origin v0.2.17');
    expect(releaseSource).toContain(
      'Release promotion also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed release commit.'
    );
    expect(releaseSource).toContain('### Publication Results');
    expect(releaseSource).toContain(
      'confirmed package version `0.2.17`, `latest: 0.2.17`, and registry modified time `2026-07-03T09:25:30.216Z`.'
    );
    expect(releaseSource).toContain(
      'https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.17.tgz'
    );
    expect(releaseSource).toContain(
      'sha512-QMoXmU5VL5dPvhJIVe1GPJxK5u2OilbAVzL1UHH8gHaf7nDeL/7Cu2JdDY4yqgCLe+HvYG+MTJNEQ2cqjAsi7g=='
    );
    expect(releaseSource).toContain('a7a99058a1f67f6907e57d3a5080129655b0314b');
    expect(releaseSource).toContain(
      '`pnpm smoke:registry -- --version 0.2.17` passed against the real registry tarball with `fileCount: 50`, `packageSize: 54863`, `unpackedSize: 242110`, and a clean consumer `tsc --noEmit`.'
    );
    expect(releaseSource).toContain(
      'Published tarball README inspection found pre-publish package-page wording because `0.2.17` was published before the post-publish README refresh.'
    );
    expect(releaseSource).toContain(
      'Release promotion gate passed on commit `f142dcb8bccd0d6955048fb9a762356c076d7167`'
    );
    expect(releaseSource).toContain(
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28650341234'
    );
    expect(releaseSource).toContain(
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28650341269'
    );
    expect(releaseSource).toContain(
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28650341225'
    );
    expect(releaseSource).toContain(
      'Git tag and GitHub Release: `v0.2.17` at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.17`.'
    );
    expect(releaseSource).toContain('## v0.2.16');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for the Android AVIF output encoder route prototype. npm `latest` remains `0.2.14`; no `v0.2.16` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not enable AVIF output. It adds an internal Android prototype that probes whether an API 34+ `MediaCodec` still-image AVIF encoder route can become the future production path outside `Bitmap.compress()`.'
    );
    expect(releaseSource).toContain(
      'Reconfirm the public Android AVIF encoder route available on Android 14+.'
    );
    expect(releaseSource).toContain(
      'Add one minimal Android prototype for a `MediaCodec image/avif encoder probe`.'
    );
    expect(releaseSource).toContain(
      'Keep AVIF output capability reporting unchanged until full output validation exists.'
    );
    expect(releaseSource).toContain(
      'Define byte-signature, decode-back, metadata, `output.maxBytes`, and animation boundaries before production AVIF output work.'
    );
    expect(releaseSource).toContain(
      'Align README, release notes, Android verification doctor checks, Vitest expectations, JVM tests, and Android instrumentation with the prototype decision.'
    );
    expect(releaseSource).toContain(
      'Android platform supported-media documentation lists AVIF baseline image encoder and decoder support as mandatory beginning with Android 14.'
    );
    expect(releaseSource).toContain(
      'The prototype route builds an `image/avif` `MediaFormat` with `COLOR_FormatYUV420Flexible` input and asks `MediaCodecList.findEncoderForFormat()` for an encoder on API 34+.'
    );
    expect(releaseSource).toContain(
      'The prototype records a `video/av01` fallback encoder probe as evidence only; AV1 video encoder availability is not enough to prove a complete static AVIF still-image file output path.'
    );
    expect(releaseSource).toContain(
      'The Android production gate remains closed until the module feeds processed `Bitmap` pixels to the encoder, writes a complete `.avif` file, verifies `ftyp` `avif` / `avis` signature bytes, and decodes the result back with `ImageDecoder`.'
    );
    expect(releaseSource).toContain(
      'v0.2.16 keeps runtime capability reporting unchanged: Android AVIF `input=true` on Android 14+ and `output=false`; iOS AVIF input remains gated by `CGImageSourceCopyTypeIdentifiers()` and AVIF output remains `false`.'
    );
    expect(releaseSource).toContain(
      'Android may report AVIF `output=true` only after the prototype is promoted into a real encode path with byte-signature, decode-back, target-size, and unsupported metadata-path tests.'
    );
    expect(releaseSource).toContain(
      "`metadata: 'preserve'` remains unsupported for AVIF output unless explicitly designed and validated."
    );
    expect(releaseSource).toContain(
      '`output.maxBytes` remains unsupported for AVIF output until AVIF quality and size-search semantics are validated.'
    );
    expect(releaseSource).toContain('Animated AVIF preservation remains out of scope.');
    expect(releaseSource).toContain('`package.json` version bump to `0.2.16`.');
    expect(releaseSource).toContain(
      'Internal Android `AndroidAvifOutputPrototype` source with route report, API gate, `MediaCodecList.findEncoderForFormat()` probe, AV1 fallback probe, AVIF signature helper, and validation plan.'
    );
    expect(releaseSource).toContain(
      'Android JVM tests for injected encoder discovery, API 34 gating, production gate closure, YUV420 `image/avif` format construction, and AVIF `ftyp` brand detection.'
    );
    expect(releaseSource).toContain(
      'Android instrumentation assertion for the API 34+ prototype route report and production gate.'
    );
    expect(releaseSource).toContain(
      'README and verification expectations that keep `getImageCompressionCapabilities().formats.avif.output=false`.'
    );
    expect(releaseSource).toContain('AVIF output capability enablement.');
    expect(releaseSource).toContain('Target-size AVIF output.');
    expect(releaseSource).toContain(
      'npm publish, git tag, or GitHub Release promotion for `v0.2.16`.'
    );
    expect(releaseSource).toContain(
      'Because this is a prototype candidate and not a publish step, `pnpm smoke:registry` remains pointed at the latest published package, `0.2.14`, after any future publish decision.'
    );
    expect(releaseSource).toContain('## v0.2.15');
    expect(releaseSource).toContain(
      'Status: unpublished release candidate for the AVIF output feasibility spike. npm `latest` remains `0.2.14`; no `v0.2.15` tag, GitHub Release, or npm publish is part of this candidate.'
    );
    expect(releaseSource).toContain(
      'This candidate does not implement AVIF output. It records the platform boundary for when Android and iOS can safely report AVIF `output=true` instead of the current `ERR_NOT_IMPLEMENTED` unsupported-output path.'
    );
    expect(releaseSource).toContain(
      'Confirm whether Android can encode AVIF through the current native output path.'
    );
    expect(releaseSource).toContain(
      'Confirm whether iOS ImageIO AVIF destination support can be advertised without runtime probing.'
    );
    expect(releaseSource).toContain(
      'Define the AVIF output capability reporting rule for Android and iOS.'
    );
    expect(releaseSource).toContain(
      'Define unsupported versus partial-implementation criteria before any production AVIF output work.'
    );
    expect(releaseSource).toContain(
      'Align README, release notes, Android verification doctor checks, and Vitest expectations with the feasibility decision.'
    );
    expect(releaseSource).toContain(
      'Android platform supported-media documentation lists AVIF baseline image encoder and decoder support as mandatory beginning with Android 14, but the current module encodes through `Bitmap.compress()`.'
    );
    expect(releaseSource).toContain(
      'Android `Bitmap.CompressFormat` exposes JPEG, PNG, WebP, WebP lossless, and WebP lossy output formats, with no AVIF enum, so the existing `Bitmap.compress()` path cannot add AVIF output by enum mapping alone.'
    );
    expect(releaseSource).toContain(
      'Android `ExifInterface` supports AVIF for reading metadata but lists writable metadata formats as JPEG, PNG, and WebP, so any future AVIF output must explicitly document metadata preserve behavior.'
    );
    expect(releaseSource).toContain(
      'iOS ImageIO supports runtime discovery of destination formats with `CGImageDestinationCopyTypeIdentifiers()`.'
    );
    expect(releaseSource).toContain(
      'v0.2.15 keeps runtime capability reporting unchanged: Android AVIF `input=true` on Android 14+ and `output=false`; iOS AVIF input remains gated by `CGImageSourceCopyTypeIdentifiers()` and AVIF output remains `false`.'
    );
    expect(releaseSource).toContain(
      'Android may report AVIF `output=true` only after a non-`Bitmap.compress()` AVIF encoder route is implemented and validated on API 34+ with byte-signature, decode-back, target-size, and unsupported metadata-path tests.'
    );
    expect(releaseSource).toContain(
      'iOS may report AVIF `output=true` only when `CGImageDestinationCopyTypeIdentifiers()` returns an AVIF destination type and the native path validates static AVIF output through `CGImageDestination`.'
    );
    expect(releaseSource).toContain(
      "On platforms or runtimes without a validated encoder route, `output.format: 'avif'` must continue to reject with `ERR_NOT_IMPLEMENTED`."
    );
    expect(releaseSource).toContain(
      'Keep AVIF output unsupported when there is no runtime destination or encoder, no byte-signature and decode-back smoke, unclear metadata behavior, or no documented target-size behavior.'
    );
    expect(releaseSource).toContain(
      'A partial implementation may ship only for static still-image output, with animated AVIF preservation out of scope.'
    );
    expect(releaseSource).toContain(
      "A partial implementation may reject `metadata: 'preserve'` and `output.maxBytes` for AVIF until those semantics are explicitly designed and tested."
    );
    expect(releaseSource).toContain('Production AVIF output encoding.');
    expect(releaseSource).toContain('Runtime behavior changes.');
    expect(releaseSource).toContain('npm publish, git tag, or GitHub Release promotion for `v0.2.15`.');
    expect(releaseSource).toContain(
      'Because this is a feasibility candidate and not a publish step, `pnpm smoke:registry` remains pointed at the latest published package, `0.2.14`, after any future publish decision.'
    );
    expect(releaseSource).toContain('## v0.2.14');
    expect(releaseSource).toContain(
      'Status: published to npm as the `0.2.14` latest release, tagged as `v0.2.14`.'
    );
    expect(releaseSource).toContain(
      "This release keeps AVIF output unimplemented while making Android and iOS capability reporting, unsupported-output messages, TypeScript guidance, README guidance, and verification checks agree on the same boundary: AVIF input can be supported, but `output.format: 'avif'` rejects with `ERR_NOT_IMPLEMENTED`."
    );
    expect(releaseSource).toContain(
      'Keep AVIF output out of scope while making the unsupported output path explicit.'
    );
    expect(releaseSource).toContain(
      'Align Android and iOS AVIF capability notes around `output=false`.'
    );
    expect(releaseSource).toContain(
      "Make native `ERR_NOT_IMPLEMENTED` messages clear when callers select `output.format: 'avif'`."
    );
    expect(releaseSource).toContain(
      'Keep TypeScript validation accepting `avif` as a planned output format so native platform capability errors surface intact.'
    );
    expect(releaseSource).toContain(
      'Align README guidance, release notes, Android verification doctor checks, Vitest expectations, Android JVM tests, and iOS host-app smoke assertions.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.14`.');
    expect(releaseSource).toContain(
      "Android AVIF capability notes now say AVIF output reports `output=false` and selecting `output.format: 'avif'` rejects with `ERR_NOT_IMPLEMENTED`."
    );
    expect(releaseSource).toContain(
      'Android `compressImage()` now rejects HEIC, HEIF, and AVIF output with an explicit unsupported-output message naming JPEG, PNG, and WebP as the supported output formats.'
    );
    expect(releaseSource).toContain(
      'Android module tests now assert AVIF output rejects with `ERR_NOT_IMPLEMENTED`.'
    );
    expect(releaseSource).toContain(
      "iOS AVIF capability notes now separate animated AVIF preservation from AVIF output, report AVIF output as unsupported, and state that selecting `output.format: 'avif'` rejects with `ERR_NOT_IMPLEMENTED`."
    );
    expect(releaseSource).toContain(
      "iOS `compressImage()` now uses an AVIF-specific unsupported-output message for `output.format: 'avif'`."
    );
    expect(releaseSource).toContain(
      'iOS host-app smoke now asserts the AVIF capability note documents the unsupported AVIF output path.'
    );
    expect(releaseSource).toContain(
      'TypeScript native-unavailable guidance now describes the current Android/iOS input/output matrix and calls out HEIC, HEIF, and AVIF output as unsupported.'
    );
    expect(releaseSource).toContain(
      'README status, implementation scope, iOS behavior, Android AVIF input/output guidance, installation/package status, and release dry-run guidance are updated for the `0.2.14` release.'
    );
    expect(releaseSource).toContain(
      'Source-level tests and Android verification doctor expectations are updated for the AVIF output unsupported surface release.'
    );
    expect(releaseSource).toContain('npm package publication under the `latest` dist-tag.');
    expect(releaseSource).toContain('Git tag `v0.2.14` and GitHub Release `v0.2.14`.');
    expect(releaseSource).toContain('AVIF output encoding.');
    expect(releaseSource).toContain('HEIC / HEIF output encoding.');
    expect(releaseSource).toContain('Animated AVIF preservation.');
    expect(releaseSource).toContain('Android or iOS decode behavior changes.');
    expect(releaseSource).toContain('pnpm smoke:registry -- --version 0.2.14');
    expect(releaseSource).toContain('git tag -a v0.2.14 -m "v0.2.14"');
    expect(releaseSource).toContain('git push origin v0.2.14');
    expect(releaseSource).toContain(
      'Release promotion also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed release commit.'
    );
    expect(releaseSource).toContain('### Publication Results');
    expect(releaseSource).toContain(
      'confirmed package version `0.2.14`, `latest: 0.2.14`, and registry modified time `2026-07-03T07:12:58.753Z`.'
    );
    expect(releaseSource).toContain(
      'https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.14.tgz'
    );
    expect(releaseSource).toContain(
      'sha512-/rdbK4BvVQZkGKYhUkutQn4z9NwCD4n+9a2cmHxVdE61YTp0+TWOhpDQHVmOmAjA4mwqjXykn2RPimAZ8FOweA=='
    );
    expect(releaseSource).toContain('d49f394ad95935f7326d33e9fb9efeb5cc276f2d');
    expect(releaseSource).toContain(
      '`pnpm smoke:registry -- --version 0.2.14` passed against the real registry tarball with `fileCount: 49`, `packageSize: 47733`, `unpackedSize: 213156`, and a clean consumer `tsc --noEmit`.'
    );
    expect(releaseSource).toContain(
      'The published tarball README stale-candidate scan found no `v0.2.14 candidate`, unpublished release-candidate, `latest published npm package is 0.2.13`, or unpublished AVIF output capability/error surface candidate package-page snippets.'
    );
    expect(releaseSource).toContain(
      'Release promotion gate passed on commit `2d3d4732f6b2ddc5bb58c100c810e7befb5d539d`'
    );
    expect(releaseSource).toContain(
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28643843274'
    );
    expect(releaseSource).toContain(
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28643843263'
    );
    expect(releaseSource).toContain(
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28643843264'
    );
    expect(releaseSource).toContain(
      'Git tag and GitHub Release: `v0.2.14` at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.14`.'
    );
    expect(releaseSource).toContain('## v0.2.13');
    expect(releaseSource).toContain(
      'Status: published to npm as the `0.2.13` latest release, tagged as `v0.2.13`.'
    );
    expect(releaseSource).toContain(
      "This release hardens the iOS JPEG source to JPEG output `metadata: 'preserve'`"
    );
    expect(releaseSource).toContain(
      'Normalize iOS preserved JPEG output orientation metadata to `1` after rendering.'
    );
    expect(releaseSource).toContain(
      'Update preserved top-level pixel width/height and EXIF `PixelXDimension` / `PixelYDimension` to the rendered JPEG dimensions.'
    );
    expect(releaseSource).toContain(
      'Keep JPEG source to JPEG output as the only iOS preserve scope.'
    );
    expect(releaseSource).toContain(
      'Prove the behavior through iOS host-app smoke metadata readback and source-level expectations.'
    );
    expect(releaseSource).toContain(
      'Align README guidance, release notes, Android verification doctor checks, and Vitest expectations.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.13`.');
    expect(releaseSource).toContain(
      'iOS JPEG preserve encoding now passes final `CGImage` dimensions into ImageIO destination properties.'
    );
    expect(releaseSource).toContain(
      'Preserved JPEG metadata normalizes top-level orientation, TIFF orientation, top-level pixel width/height, and EXIF pixel dimensions.'
    );
    expect(releaseSource).toContain(
      'iOS smoke fixture writes stale TIFF orientation and source-size EXIF pixel dimensions, then verifies preserve output normalizes them to the compressed JPEG result.'
    );
    expect(releaseSource).toContain(
      'README status, iOS behavior guidance, metadata policy docs, iOS smoke description, and release dry-run guidance are updated for the `0.2.13` release.'
    );
    expect(releaseSource).toContain(
      'Source-level tests and Android verification doctor expectations are updated for the iOS JPEG metadata preserve hardening release.'
    );
    expect(releaseSource).toContain('npm package publication under the `latest` dist-tag.');
    expect(releaseSource).toContain(
      'Git tag `v0.2.13` and GitHub Release `v0.2.13`.'
    );
    expect(releaseSource).toContain('pnpm release:dry-run');
    expect(releaseSource).toContain('npm publish --tag latest');
    expect(releaseSource).toContain('pnpm smoke:registry -- --version 0.2.13');
    expect(releaseSource).toContain('git tag -a v0.2.13 -m "v0.2.13"');
    expect(releaseSource).toContain('git push origin v0.2.13');
    expect(releaseSource).toContain(
      'Release promotion also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed release commit.'
    );
    expect(releaseSource).toContain('### Publication Results');
    expect(releaseSource).toContain(
      'confirmed package version `0.2.13`, `latest: 0.2.13`, and registry modified time `2026-07-03T06:21:08.749Z`.'
    );
    expect(releaseSource).toContain(
      'https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.13.tgz'
    );
    expect(releaseSource).toContain(
      'sha512-1XklGCG2cUQaXuw7z1AeNxJekleC5IUyCVWRnNWekJAbpae3uXnX1Fa0c43J5w5werqnHSs7kUGcAxcmSo0qEQ=='
    );
    expect(releaseSource).toContain('59af2dc4682fe8445c5f7f02b886f56cd799bb09');
    expect(releaseSource).toContain(
      '`pnpm smoke:registry -- --version 0.2.13` passed against the real registry tarball with `fileCount: 49`, `packageSize: 47296`, `unpackedSize: 210816`, and a clean consumer `tsc --noEmit`.'
    );
    expect(releaseSource).toContain(
      'Release promotion gate passed on commit `dfaa3763fc3d3a223a6672dbfa934e6bc8100443`'
    );
    expect(releaseSource).toContain(
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28641938227'
    );
    expect(releaseSource).toContain(
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28641938248'
    );
    expect(releaseSource).toContain(
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28641938240'
    );
    expect(releaseSource).toContain(
      'Git tag and GitHub Release: `v0.2.13` at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.13`.'
    );
    expect(releaseSource).toContain('## v0.2.12');
    expect(releaseSource).toContain(
      'Status: published to npm as the `0.2.12` latest release, tagged as `v0.2.12`.'
    );
    expect(releaseSource).toContain(
      "This release adds the narrow iOS `metadata: 'preserve'` MVP for JPEG source"
    );
    expect(releaseSource).toContain(
      "Support iOS JPEG source to JPEG output with `metadata: 'preserve'`."
    );
    expect(releaseSource).toContain(
      'Keep resize, `output.quality`, and `output.maxBytes` JPEG output paths aligned with metadata preserve.'
    );
    expect(releaseSource).toContain(
      "Report iOS `metadataPolicies: ['preserve', 'safe', 'strip']` while documenting that preserve is JPEG-to-JPEG only."
    );
    expect(releaseSource).toContain(
      'Keep PNG/WebP/GIF/HEIC/HEIF/AVIF metadata preservation out of scope.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.12`.');
    expect(releaseSource).toContain(
      'iOS JPEG output now uses ImageIO `CGImageDestination`, allowing source JPEG metadata to be copied for JPEG source to JPEG output.'
    );
    expect(releaseSource).toContain(
      "iOS `metadata: 'preserve'` rejects with `ERR_NOT_IMPLEMENTED` unless both input and output are JPEG."
    );
    expect(releaseSource).toContain(
      'iOS capability reporting now includes `preserve`, `safe`, and `strip` metadata policies.'
    );
    expect(releaseSource).toContain(
      'iOS smoke fixtures include a JPEG TIFF Software metadata marker and read it back after preserve compression.'
    );
    expect(releaseSource).toContain(
      'README status, iOS behavior guidance, metadata policy docs, iOS smoke description, and release dry-run guidance are updated for the `0.2.12` release.'
    );
    expect(releaseSource).toContain(
      'Source-level tests and Android verification doctor expectations are updated for the iOS JPEG metadata preserve release.'
    );
    expect(releaseSource).toContain('npm package publication under the `latest` dist-tag.');
    expect(releaseSource).toContain('Git tag `v0.2.12` and GitHub Release `v0.2.12`.');
    expect(releaseSource).toContain('Android runtime behavior changes.');
    expect(releaseSource).toContain(
      'PNG, WebP, GIF, HEIC, HEIF, or AVIF metadata preserve on iOS.'
    );
    expect(releaseSource).toContain('npm publish --tag latest');
    expect(releaseSource).toContain('pnpm smoke:registry -- --version 0.2.12');
    expect(releaseSource).toContain('git tag -a v0.2.12 -m "v0.2.12"');
    expect(releaseSource).toContain('git push origin v0.2.12');
    expect(releaseSource).toContain(
      'Release promotion also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed release commit.'
    );
    expect(releaseSource).toContain('## v0.2.11');
    expect(releaseSource).toContain(
      'Status: published to npm on July 2, 2026 at 08:49:37 UTC (17:49:37 KST), tagged as `v0.2.11`.'
    );
    expect(releaseSource).toContain(
      'This docs-only patch corrects the README that is shown on the npm package page'
    );
    expect(releaseSource).toContain(
      'after the `0.2.10` tarball shipped release-ready/pre-publish status text.'
    );
    expect(releaseSource).toContain(
      'version whose packaged README reports the `0.2.11` published package state.'
    );
    expect(releaseSource).toContain(
      'Publish a docs-only package version so the npm package page reflects the published state after `0.2.11` is released.'
    );
    expect(releaseSource).toContain(
      'Remove stale `0.2.10` release-ready/pre-publish package-page status wording from the packaged README.'
    );
    expect(releaseSource).toContain(
      'Keep Android runtime behavior, iOS runtime behavior, and the public TypeScript API unchanged.'
    );
    expect(releaseSource).toContain(
      'Verify the `0.2.10` registry tarball README before preparation and the `0.2.11` registry tarball README after publish.'
    );
    expect(releaseSource).toContain(
      'Keep the release dry-run packed README stale-status check and post-publish registry smoke flow in place.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.11`.');
    expect(releaseSource).toContain(
      'README status, installation, release guidance, and registry smoke examples updated for the docs-only npm README correction.'
    );
    expect(releaseSource).toContain(
      'README copy now describes `0.2.11` as a docs-only README correction while preserving the `0.2.10` runtime behavior surface.'
    );
    expect(releaseSource).toContain(
      'Source-level tests and Android verification doctor expectations are updated for the `0.2.11` docs-only status.'
    );
    expect(releaseSource).toContain(
      'Release dry-run packed README stale checks now reject the stale `0.2.10` release-ready/pre-publish snippets and old `0.2.10` package-page status snippets.'
    );
    expect(releaseSource).toContain('npm package publication under the `latest` dist-tag.');
    expect(releaseSource).toContain('Git tag `v0.2.11` and GitHub Release `v0.2.11`.');
    expect(releaseSource).toContain('Android or iOS runtime behavior changes.');
    expect(releaseSource).toContain('Native code changes.');
    expect(releaseSource).toContain('New public TypeScript API surface.');
    expect(releaseSource).toContain(
      'AVIF output, animated AVIF preservation, HEIC/HEIF output, iOS metadata preservation, cancellation, or progress support.'
    );
    expect(releaseSource).toContain('### v0.2.10 Registry README Inspection');
    expect(releaseSource).toContain(
      'npm pack react-native-image-compression-kit@0.2.10 --pack-destination "$tmpdir"'
    );
    expect(releaseSource).toContain('react-native-image-compression-kit-0.2.10.tgz');
    expect(releaseSource).toContain(
      'Status: v0\\.2\\.10 release-ready|It has not been published to npm yet|latest published npm package remains `0\\.2\\.9`|v0\\.2\\.10 release-ready notes'
    );
    expect(releaseSource).toContain(
      'The inspection found `Status: v0.2.10 release-ready`'
    );
    expect(releaseSource).toContain(
      'published to npm yet`, the "latest published npm package remains `0.2.9`"'
    );
    expect(releaseSource).toContain('pnpm smoke:registry -- --version 0.2.11');
    expect(releaseSource).toContain(
      'After npm publish, the registry smoke must confirm the real `0.2.11` tarball README no longer includes the stale `0.2.10` release-ready/pre-publish package-page status snippets.'
    );
    expect(releaseSource).toContain('Release commit validation before npm publish:');
    expect(releaseSource).toContain(
      'Commit: `be8344f7b5dd884e5d44d9da9ae934976c50d581`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28576768326>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28576768289>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28576768307>.'
    );
    expect(releaseSource).toContain(
      'Local pre-publish gate completed successfully before npm publish: `pnpm release:dry-run`, including `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, `pnpm pack --dry-run`, packed README stale-status check, packed consumer smoke, and publish dry run.'
    );
    expect(releaseSource).toContain(
      'Completed after npm publish and GitHub Release creation:'
    );
    expect(releaseSource).toContain(
      '`npm publish --tag latest` published `react-native-image-compression-kit@0.2.11`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.2.11`');
    expect(releaseSource).toContain(
      'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.11.tgz`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-JMBebCxcpwdiLspK8s8pIF8xIEpgqxWjO5BZEkBEoCdRp09wvqj8b3UXLczGqXSgcAZtTL+UuE2mF+nptKWDpw==`'
    );
    expect(releaseSource).toContain(
      'npm shasum: `e3c067a00949e93f29f80dee5eabfaaf4bf1fa72`'
    );
    expect(releaseSource).toContain('Git tag: `v0.2.11`');
    expect(releaseSource).toContain(
      'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.11>.'
    );
    expect(releaseSource).toContain(
      'Registry smoke confirmed 49 files, 46.4 kB package size, 204.3 kB unpacked size'
    );
    expect(releaseSource).toContain(
      'Registry tarball README stale-status check passed for the `0.2.11` package-page status.'
    );
    expect(releaseSource).toContain('## v0.2.10');
    expect(releaseSource).toContain(
      'Status: published to npm on July 2, 2026 at 07:52:44 UTC (16:52:44 KST), tagged as `v0.2.10`.'
    );
    expect(releaseSource).toContain(
      'This release adds capability-gated iOS AVIF input.'
    );
    expect(releaseSource).toContain('iOS decodes AVIF');
    expect(releaseSource).toContain(
      'image through ImageIO only when the runtime advertises AVIF source'
    );
    expect(releaseSource).toContain('`ERR_UNSUPPORTED_FORMAT` path.');
    expect(releaseSource).toContain(
      'Support iOS AVIF input through runtime ImageIO source capability reporting.'
    );
    expect(releaseSource).toContain(
      'Decode supported AVIF inputs as static images before resize and output encoding.'
    );
    expect(releaseSource).toContain(
      'Keep unsupported iOS AVIF runtimes on a clear `ERR_UNSUPPORTED_FORMAT` path.'
    );
    expect(releaseSource).toContain('`package.json` version bump to `0.2.10`.');
    expect(releaseSource).toContain(
      'iOS `getImageCompressionCapabilities()` reports AVIF `input=true` only when `CGImageSourceCopyTypeIdentifiers()` advertises an AVIF source type, and always reports AVIF `output=false`.'
    );
    expect(releaseSource).toContain(
      'iOS `compressImage()` accepts AVIF input only on runtimes with ImageIO AVIF source support.'
    );
    expect(releaseSource).toContain(
      'Supported iOS AVIF input is decoded as a static image with `CGImageSourceCreateImageAtIndex`.'
    );
    expect(releaseSource).toContain(
      'AVIF input can be re-encoded to JPEG or PNG output without copying source metadata.'
    );
    expect(releaseSource).toContain(
      'AVIF input can be re-encoded to WebP output when the runtime also advertises ImageIO WebP destination support.'
    );
    expect(releaseSource).toContain(
      'iOS unsupported-input errors keep AVIF on `ERR_UNSUPPORTED_FORMAT` when ImageIO AVIF source support is unavailable.'
    );
    expect(releaseSource).toContain(
      'The iOS host-app smoke validates both the AVIF-supported branch and the AVIF-unavailable rejection branch through runtime capabilities.'
    );
    expect(releaseSource).toContain(
      'Source-level tests and Android verification doctor expectations are updated for the iOS AVIF input release.'
    );
    expect(releaseSource).toContain('npm package publication under the `latest` dist-tag.');
    expect(releaseSource).toContain('Git tag `v0.2.10` and GitHub Release `v0.2.10`.');
    expect(releaseSource).toContain('Android runtime behavior changes.');
    expect(releaseSource).toContain('Animated AVIF preservation.');
    expect(releaseSource).toContain(
      'The release dry run includes a packed README stale status check before the consumer smoke and publish dry run.'
    );
    expect(releaseSource).toContain(
      'Release promotion also requires GitHub Actions CI, Android Instrumentation, and iOS Validation to pass on the pushed release-ready commit.'
    );
    expect(releaseSource).toContain(
      'Commit: `d8d3232d74e66158d1de297783e3fc39448f1684`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28573553093>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28573553082>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28573553073>.'
    );
    expect(releaseSource).toContain(
      '`npm publish --tag latest` published `react-native-image-compression-kit@0.2.10`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.2.10`');
    expect(releaseSource).toContain(
      'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.10.tgz`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-73bAB8tcLrQ7o2iletdLYWEry1VRn3vIWyhYy+/RDGAj9MLho5aKJJtnx92eDgtQOW3s9r48qtCcJByPVwnfxw==`'
    );
    expect(releaseSource).toContain(
      'npm shasum: `1890e78917538d2e27d3274e97a0820c5597a827`'
    );
    expect(releaseSource).toContain('Git tag: `v0.2.10`');
    expect(releaseSource).toContain(
      'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.10>.'
    );
    expect(releaseSource).toContain(
      'Registry smoke confirmed 49 files, 46.4 kB package size, 204.3 kB unpacked size'
    );
    expect(releaseSource).toContain('## v0.2.9');
    expect(releaseSource).toContain(
      'Status: published to npm on July 2, 2026 at 06:24:49 UTC (15:24:49 KST), tagged as `v0.2.9`.'
    );
    expect(releaseSource).toContain(
      'This docs-only patch corrects the README that is shown on the npm package'
    );
    expect(releaseSource).toContain(
      'Publish a docs-only package version so the npm package page reflects the current release state.'
    );
    expect(releaseSource).toContain(
      'Remove stale `0.2.8` package-page status wording from the packaged README.'
    );
    expect(releaseSource).toContain(
      'Keep Android runtime behavior, iOS runtime behavior, and the public TypeScript API unchanged.'
    );
    expect(releaseSource).toContain(
      'Verify the packed tarball README before publish and the registry tarball README after publish.'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.2.9`.'
    );
    expect(releaseSource).toContain(
      'README status, installation, release guidance, and registry smoke examples updated for the docs-only package-page correction.'
    );
    expect(releaseSource).toContain(
      'README copy now describes `0.2.9` as a docs-only README correction while preserving the `0.2.8` runtime behavior surface.'
    );
    expect(releaseSource).toContain(
      'Source-level tests and the Android verification doctor expectations are updated for the `0.2.9` docs-only status.'
    );
    expect(releaseSource).toContain('npm package publication under the `latest` dist-tag.');
    expect(releaseSource).toContain('Git tag `v0.2.9` and GitHub Release `v0.2.9`.');
    expect(releaseSource).toContain('Android or iOS runtime behavior changes.');
    expect(releaseSource).toContain('New public TypeScript API surface.');
    expect(releaseSource).toContain(
      'AVIF output, HEIC/HEIF output, iOS metadata preservation, cancellation, or progress support.'
    );
    expect(releaseSource).toContain('tmpdir=$(mktemp -d)');
    expect(releaseSource).toContain(
      'react-native-image-compression-kit-0.2.9.tgz'
    );
    expect(releaseSource).toContain(
      'v0\\.2\\.8 candidate|unpublished tooling candidate|latest npm `latest` dist-tag remains'
    );
    expect(releaseSource).toContain('pnpm smoke:registry -- --version 0.2.8');
    expect(releaseSource).toContain(
      'Release commit validation before npm publish:'
    );
    expect(releaseSource).toContain(
      'Commit: `770bb06b2c0dc8b2e186cd799e647f6fdcac9fa8`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28568919988>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28568919982>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28568919984>.'
    );
    expect(releaseSource).toContain(
      '`npm publish --tag latest` published `react-native-image-compression-kit@0.2.9`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.2.9`');
    expect(releaseSource).toContain(
      'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.9.tgz`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-Q/z8QZdsEl85Q9IhO31gv3/OAfGXh5FS7O3kBKJouzlnvtbTYCS+zgGYKrDNNq7x1rIVHQAxKXmeNJpoMwxWqw==`'
    );
    expect(releaseSource).toContain(
      'npm shasum: `11882a2c1fff4b21648ebbfb773c6ae5aabad638`'
    );
    expect(releaseSource).toContain('Git tag: `v0.2.9`');
    expect(releaseSource).toContain(
      'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.9>.'
    );
    expect(releaseSource).toContain(
      'Registry smoke confirmed 49 files, 45.4 kB package size, 198.3 kB unpacked size'
    );
    expect(releaseSource).toContain('Registry tarball README stale-status check passed.');
    expect(releaseSource).toContain('## v0.2.8');
    expect(releaseSource).toContain(
      'Status: published to npm on July 2, 2026 at 05:07:49 UTC (14:07:49 KST), tagged as `v0.2.8`.'
    );
    expect(releaseSource).toContain(
      'repeatable post-publish npm registry smoke test'
    );
    expect(releaseSource).toContain(
      'Automate npm registry tarball inspection for a published package version.'
    );
    expect(releaseSource).toContain(
      'Automate required runtime file and forbidden development-only file checks for the registry tarball.'
    );
    expect(releaseSource).toContain(
      'Automate clean temporary consumer installation from npm with public TypeScript import/typecheck coverage.'
    );
    expect(releaseSource).toContain(
      'Keep the registry smoke outside pre-publish `pnpm release:dry-run` and default CI because it requires an already published npm version.'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.2.8`.'
    );
    expect(releaseSource).toContain(
      'New `pnpm smoke:registry` package script backed by `scripts/registry-smoke-test.mjs`.'
    );
    expect(releaseSource).toContain(
      'Registry smoke supports `--version <version>`, `--tag <tag>`, `RNICK_REGISTRY_SMOKE_VERSION`, `RNICK_REGISTRY_SMOKE_TAG`, `RNICK_REGISTRY_SMOKE_KEEP`, and `RNICK_REGISTRY_SMOKE_TMPDIR`.'
    );
    expect(releaseSource).toContain(
      'Registry smoke runs `npm view` for registry metadata, `npm pack <package>@<version> --json` for tarball inspection'
    );
    expect(releaseSource).toContain(
      'README development verification and release dry-run guidance now document when to run `pnpm smoke:registry -- --version <published-version>`'
    );
    expect(releaseSource).toContain(
      'npm package publication under the `latest` dist-tag.'
    );
    expect(releaseSource).toContain(
      'Git tag `v0.2.8` and GitHub Release `v0.2.8`.'
    );
    expect(releaseSource).toContain(
      'Adding registry smoke to default CI or `pnpm release:dry-run`.'
    );
    expect(releaseSource).toContain('pnpm smoke:registry -- --version 0.2.7');
    expect(releaseSource).toContain(
      'Release commit validation before npm publish:'
    );
    expect(releaseSource).toContain(
      'Commit: `9c2ea1cc12d666c73e8809b33b575f527bb465dc`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28566423923>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28566423970>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28566423928>.'
    );
    expect(releaseSource).toContain(
      '`npm publish --tag latest` published `react-native-image-compression-kit@0.2.8`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.2.8`');
    expect(releaseSource).toContain(
      'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.8.tgz`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-zMnehpDnojrjeanfTz8I+DpXz32ON2p5i1wdKYJWC4/WD/IVc3PARz2itBpMepLFwlxIeBQ89blbmns/dI+eBg==`'
    );
    expect(releaseSource).toContain(
      'npm shasum: `5417ad397b69a0301da57d8e23ec9cc3546862fa`'
    );
    expect(releaseSource).toContain('Git tag: `v0.2.8`');
    expect(releaseSource).toContain(
      'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.8>.'
    );
    expect(releaseSource).toContain(
      'Registry smoke confirmed 49 files, 45.5 kB package size, 198.3 kB unpacked size'
    );
    expect(releaseSource).toContain('## v0.2.7');
    expect(releaseSource).toContain(
      'Status: published to npm on July 2, 2026 at 04:38:13 UTC (13:38:13 KST), tagged as `v0.2.7`.'
    );
    expect(releaseSource).toContain(
      'This release keeps Android runtime behavior unchanged while adding iOS'
    );
    expect(releaseSource).toContain(
      'HEIC/HEIF input support to the existing iOS ImageIO-backed static decode path'
    );
    expect(releaseSource).toContain(
      'Support HEIC/HEIF input on iOS through ImageIO static image decode.'
    );
    expect(releaseSource).toContain(
      'Reuse the existing iOS resize, JPEG quality, JPEG `output.maxBytes`, PNG output, runtime-gated WebP output, and runtime-available WebP `output.maxBytes` paths.'
    );
    expect(releaseSource).toContain(
      'Report iOS HEIC and HEIF capabilities as `input=true` and `output=false`.'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.2.7`.'
    );
    expect(releaseSource).toContain(
      'iOS `compressImage()` now accepts HEIC and HEIF source data for JPEG and PNG output.'
    );
    expect(releaseSource).toContain(
      'iOS HEIC/HEIF input is decoded through ImageIO with `CGImageSourceCreateImageAtIndex` as a static image before resize and output encoding.'
    );
    expect(releaseSource).toContain(
      'HEIC/HEIF input to JPEG output keeps resize, `output.quality`, and JPEG `output.maxBytes` behavior.'
    );
    expect(releaseSource).toContain(
      'HEIC/HEIF input can be re-encoded to runtime-available WebP output when ImageIO advertises a WebP destination type.'
    );
    expect(releaseSource).toContain(
      'iOS `getImageCompressionCapabilities()` reports HEIC `input=true` / `output=false` and HEIF `input=true` / `output=false`'
    );
    expect(releaseSource).toContain(
      'The iOS unsupported-input error surface now lists JPEG, PNG, GIF, WebP, HEIC, and HEIF input as supported and leaves AVIF on the unsupported path.'
    );
    expect(releaseSource).toContain(
      'The iOS host-app smoke validates `compress-heic-to-jpeg`, `compress-heif-to-jpeg`, `compress-heic-to-png`, `compress-heif-to-png`'
    );
    expect(releaseSource).toContain(
      'The iOS host-app smoke removes HEIC and HEIF from the unsupported-input rejection loop and keeps AVIF input rejected with `ERR_UNSUPPORTED_FORMAT`.'
    );
    expect(releaseSource).toContain(
      'TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF/WebP/HEIC/HEIF input with JPEG, PNG, and runtime-gated ImageIO-backed WebP output in version `0.2.7`.'
    );
    expect(releaseSource).toContain('HEIC/HEIF output on iOS.');
    expect(releaseSource).toContain('AVIF input or output on iOS.');
    expect(releaseSource).toContain('Live Photo, depth, burst, or animation handling.');
    expect(releaseSource).toContain(
      'Release commit validation before npm publish:'
    );
    expect(releaseSource).toContain(
      'Commit: `9fa3cfcaf023a5f35bd288966f5b1c4d649fbaa9`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28565430449>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28565430448>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28565430475>.'
    );
    expect(releaseSource).toContain(
      'Local pre-publish gate completed successfully before npm publish: `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, and `pnpm pack --dry-run`.'
    );
    expect(releaseSource).toContain(
      'Completed after npm publish and GitHub Release creation:'
    );
    expect(releaseSource).toContain(
      '`npm publish --tag latest` published `react-native-image-compression-kit@0.2.7`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.2.7`');
    expect(releaseSource).toContain(
      'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.7.tgz`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-0z7iNLyJs+9vQzuEo8flXKfvjauoNiXJxhrmR6NXnnJMBUeh/wordcDqmJQ3TB8Hy2gb0IHHikDE9f20W5QlOA==`'
    );
    expect(releaseSource).toContain(
      'npm shasum: `22494d3d42db7f8e3dd0bf1b0f9cb377a3703521`'
    );
    expect(releaseSource).toContain(
      'Git tag: `v0.2.7`'
    );
    expect(releaseSource).toContain(
      'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.7>.'
    );
    expect(releaseSource).toContain(
      'Registry tarball dry-run confirmed 49 files, 45.0 kB package size, and 196.3 kB unpacked size.'
    );
    expect(releaseSource).toContain(
      'External registry install smoke installed `react-native-image-compression-kit@0.2.7`'
    );
    expect(releaseSource).toContain('## v0.2.6');
    expect(releaseSource).toContain(
      'Status: published to npm on July 2, 2026 at 03:36:53 UTC (12:36:53 KST), tagged as `v0.2.6`.'
    );
    expect(releaseSource).toContain('adding iOS WebP');
    expect(releaseSource).toContain(
      'target-size `output.maxBytes` support to the runtime-gated ImageIO-backed WebP'
    );
    expect(releaseSource).toContain(
      "Support `output.format: 'webp'` with `output.maxBytes` on iOS runtimes that advertise ImageIO WebP destination encoding."
    );
    expect(releaseSource).toContain(
      'Reuse the existing iOS target-size quality search for both JPEG and runtime-available WebP output.'
    );
    expect(releaseSource).toContain(
      'Keep WebP output unavailable runtimes on the existing capability-gated `ERR_NOT_IMPLEMENTED` path.'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.2.6`.'
    );
    expect(releaseSource).toContain(
      'iOS WebP output now accepts `output.maxBytes` when ImageIO advertises a WebP destination type.'
    );
    expect(releaseSource).toContain(
      'iOS target-size encoding now shares one quality-search helper for JPEG and runtime-available WebP output.'
    );
    expect(releaseSource).toContain(
      'WebP target-size compression treats `quality` as the upper quality bound and returns the highest WebP quality that fits under `maxBytes`'
    );
    expect(releaseSource).toContain(
      'iOS PNG output still rejects `output.maxBytes` with `ERR_NOT_IMPLEMENTED`.'
    );
    expect(releaseSource).toContain(
      "iOS runtimes without ImageIO WebP destination support still reject `output.format: 'webp'` before any WebP target-size work."
    );
    expect(releaseSource).toContain(
      'iOS WebP capability notes now state that runtime-available WebP output supports target-size `maxBytes` by adjusting WebP quality.'
    );
    expect(releaseSource).toContain(
      'The iOS host-app smoke now follows the WebP output capability: it validates `compress-webp-to-webp-max-bytes`'
    );
    expect(releaseSource).toContain(
      'The example app enables the Max bytes input for WebP output on platforms where WebP output is currently reported as available.'
    );
    expect(releaseSource).toContain(
      'TypeScript native-unavailable messaging now mentions iOS JPEG and runtime-available WebP target-size `maxBytes` in version `0.2.6`.'
    );
    expect(releaseSource).toContain(
      'README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.'
    );
    expect(releaseSource).toContain(
      'Source-level tests and the Android verification doctor expectations are updated for the iOS WebP target-size path.'
    );
    expect(releaseSource).toContain(
      'npm package publication under the `latest` dist-tag.'
    );
    expect(releaseSource).toContain(
      'Git tag `v0.2.6` and GitHub Release `v0.2.6`.'
    );
    expect(releaseSource).toContain('Before npm publish:');
    expect(releaseSource).toContain(
      'Candidate implementation validation before release promotion:'
    );
    expect(releaseSource).toContain(
      'Commit: `bd4003f18b705416b8d662ca837d8746656fe706`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28561479567>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28561479544>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28561479519>.'
    );
    expect(releaseSource).toContain(
      'RNICK_IOS_SMOKE_STEP_PASS reject-webp-output-unavailable'
    );
    expect(releaseSource).toContain(
      'RNICK_IOS_SMOKE_STEP_PASS reject-webp-output'
    );
    expect(releaseSource).toContain('webpOutputAvailable: false');
    expect(releaseSource).toContain('targetSizeResultBytes: 996');
    expect(releaseSource).toContain(
      "unsupportedOutputs: ['webp', 'heic', 'heif', 'avif']"
    );
    expect(releaseSource).toContain(
      'The `compress-webp-to-webp-max-bytes` success branch remains capability-gated'
    );
    expect(releaseSource).toContain(
      'Local pre-publish gate completed successfully before npm publish'
    );
    expect(releaseSource).toContain(
      'Completed after npm publish and GitHub Release creation:'
    );
    expect(releaseSource).toContain(
      '`npm publish --tag latest` published `react-native-image-compression-kit@0.2.6`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.2.6`');
    expect(releaseSource).toContain(
      'publish timestamp `2026-07-02T03:36:53.452Z`'
    );
    expect(releaseSource).toContain(
      'npm package: `react-native-image-compression-kit@0.2.6`'
    );
    expect(releaseSource).toContain(
      'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.6.tgz`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-WbGBG6LnOHEKaWSVhSG0dC+fe8PTs5DxQUAw+kmI69MhHZCLlGfsDNBmYGs4YYQKCsGT7peglmBWVPwduD9ILg==`'
    );
    expect(releaseSource).toContain(
      'npm shasum: `3d978c4650c854dbd18115fb9062e909b9eb63f3`'
    );
    expect(releaseSource).toContain(
      'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.6>.'
    );
    expect(releaseSource).toContain(
      'Registry tarball dry-run confirmed 49 files, 44.6 kB package size, and 193.1 kB unpacked size.'
    );
    expect(releaseSource).toContain(
      'External registry install smoke installed `react-native-image-compression-kit@0.2.6`'
    );
    expect(releaseSource).toContain('## v0.2.5');
    expect(releaseSource).toContain(
      'Status: published to npm on July 2, 2026 at 02:14:56 UTC (11:14:56 KST), tagged as `v0.2.5`.'
    );
    expect(releaseSource).toContain('adding iOS');
    expect(releaseSource).toContain(
      'runtime-gated iOS ImageIO-backed WebP output path to the existing iOS'
    );
    expect(releaseSource).toContain(
      'Verify that iOS can advertise WebP destination support through ImageIO before enabling WebP output.'
    );
    expect(releaseSource).toContain(
      'Implement iOS WebP output for JPEG, PNG, static first-frame GIF, and static first-frame WebP input when the runtime supports WebP destination encoding.'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.2.5`.'
    );
    expect(releaseSource).toContain(
      "iOS `compressImage()` now accepts `output.format: 'webp'` when ImageIO advertises a WebP destination type through `CGImageDestinationCopyTypeIdentifiers()`."
    );
    expect(releaseSource).toContain(
      'iOS WebP output is encoded with ImageIO `CGImageDestinationCreateWithData`, `CGImageDestinationAddImage`, and `CGImageDestinationFinalize`.'
    );
    expect(releaseSource).toContain(
      'WebP output keeps existing iOS resize behavior, honors `output.quality`, writes `.webp` cache files, and re-encodes without copying source metadata under `safe` and `strip`.'
    );
    expect(releaseSource).toContain(
      'JPEG, PNG, GIF, and WebP input can be re-encoded to WebP output on runtimes that advertise an ImageIO WebP destination type.'
    );
    expect(releaseSource).toContain(
      'The GitHub Actions iOS Validation runner with Xcode 16.4 and the iPhoneSimulator18.5 SDK currently does not advertise a WebP destination type'
    );
    expect(releaseSource).toContain(
      'iOS WebP output rejects `output.maxBytes` with `ERR_NOT_IMPLEMENTED` because target-size WebP compression remains outside this candidate.'
    );
    expect(releaseSource).toContain(
      'iOS `getImageCompressionCapabilities()` reports WebP `input=true` and runtime WebP `output=true` only when ImageIO destination encoding is available.'
    );
    expect(releaseSource).toContain(
      'The iOS host-app smoke now follows the WebP output capability'
    );
    expect(releaseSource).toContain(
      'TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF/WebP input with JPEG, PNG, and runtime-gated ImageIO-backed WebP output in version `0.2.5`.'
    );
    expect(releaseSource).toContain(
      'README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.'
    );
    expect(releaseSource).toContain(
      'npm package publication under the `latest` dist-tag.'
    );
    expect(releaseSource).toContain(
      'Git tag `v0.2.5` and GitHub Release `v0.2.5`.'
    );
    expect(releaseSource).toContain('Android runtime behavior changes.');
    expect(releaseSource).toContain('WebP target-size `maxBytes` on iOS.');
    expect(releaseSource).toContain('Animated WebP preservation.');
    expect(releaseSource).toContain('iOS HEIC, HEIF, or AVIF input.');
    expect(releaseSource).toContain(
      'Candidate implementation validation before release promotion:'
    );
    expect(releaseSource).toContain(
      'Release commit validation before npm publish:'
    );
    expect(releaseSource).toContain(
      'Completed after npm publish and GitHub Release creation:'
    );
    expect(releaseSource).toContain('npm publish --tag latest');
    expect(releaseSource).toContain('react-native-image-compression-kit@0.2.5');
    expect(releaseSource).toContain(
      'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.5>.'
    );
    expect(releaseSource).toContain(
      'External registry install smoke installed `react-native-image-compression-kit@0.2.5`'
    );
    expect(releaseSource).toContain('## v0.2.4');
    expect(releaseSource).toContain(
      'Status: published to npm on July 2, 2026 at 01:03:13 UTC (10:03:13 KST), tagged as `v0.2.4`.'
    );
    expect(releaseSource).toContain('adding iOS WebP');
    expect(releaseSource).toContain(
      'static first-frame input to the existing iOS JPEG/PNG/GIF input and JPEG/PNG'
    );
    expect(releaseSource).toContain(
      'Implement iOS WebP input without changing the public TypeScript API.'
    );
    expect(releaseSource).toContain(
      'Decode WebP input as a static first frame and route it through the existing iOS resize, JPEG quality, JPEG target-size `maxBytes`, PNG output, and metadata no-copy behavior.'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.2.4`.'
    );
    expect(releaseSource).toContain(
      'iOS `compressImage()` now accepts WebP input for JPEG and PNG output.'
    );
    expect(releaseSource).toContain(
      'iOS WebP input is decoded with ImageIO as a static first frame through `CGImageSourceCreateImageAtIndex`.'
    );
    expect(releaseSource).toContain(
      'WebP input to JPEG output keeps resize, `output.quality`, and JPEG `output.maxBytes` behavior.'
    );
    expect(releaseSource).toContain(
      'WebP input to PNG output keeps resize behavior and re-encodes without copying source metadata.'
    );
    expect(releaseSource).toContain(
      'iOS `getImageCompressionCapabilities()` reports WebP `input=true` and `output=false`.'
    );
    expect(releaseSource).toContain(
      'The iOS host-app smoke validates `compress-webp-to-jpeg` and `compress-webp-to-png`, and removes WebP from the unsupported-input rejection loop.'
    );
    expect(releaseSource).toContain(
      'The iOS host-app smoke keeps `reject-webp-output` as an `ERR_NOT_IMPLEMENTED` native output capability check because WebP output is not implemented on iOS.'
    );
    expect(releaseSource).toContain(
      'TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF/WebP input and static first-frame GIF/WebP support.'
    );
    expect(releaseSource).toContain(
      'README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.'
    );
    expect(releaseSource).toContain(
      'npm package publication under the `latest` dist-tag.'
    );
    expect(releaseSource).toContain(
      'Git tag `v0.2.4` and GitHub Release `v0.2.4`.'
    );
    expect(releaseSource).toContain('WebP output on iOS.');
    expect(releaseSource).toContain('Animated WebP preservation.');
    expect(releaseSource).toContain('iOS HEIC, HEIF, or AVIF input.');
    expect(releaseSource).toContain('Before npm publish:');
    expect(releaseSource).toContain(
      'Candidate implementation validation before release promotion:'
    );
    expect(releaseSource).toContain(
      'Commit: `7bad5ac9032aaaf8147e67572a20cda046b87c50`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28500059159>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28500059163>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28500059174>.'
    );
    expect(releaseSource).toContain(
      'RNICK_IOS_SMOKE_STEP_PASS compress-webp-to-jpeg'
    );
    expect(releaseSource).toContain(
      'RNICK_IOS_SMOKE_STEP_PASS compress-webp-to-png'
    );
    expect(releaseSource).toContain(
      'RNICK_IOS_SMOKE_STEP_PASS reject-webp-output'
    );
    expect(releaseSource).toContain('webpResultBytes: 836');
    expect(releaseSource).toContain('webpToPngResultBytes: 248');
    expect(releaseSource).toContain(
      "unsupportedInputs: ['heic', 'heif', 'avif']"
    );
    expect(releaseSource).toContain(
      "unsupportedOutputs: ['webp', 'heic', 'heif', 'avif']"
    );
    expect(releaseSource).toContain(
      'Release commit validation before npm publish:'
    );
    expect(releaseSource).toContain(
      'Commit: `e62557b99a1ebf3bcbd879af21fc2ccc163d11a2`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28557446734>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28557446741>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28557446723>.'
    );
    expect(releaseSource).toContain(
      '`pnpm release:dry-run` completed successfully before npm publish, including `pnpm verify`, `pnpm example:typecheck`, `git diff --check`, `pnpm pack --dry-run`, packed consumer smoke, and `pnpm publish --dry-run --no-git-checks`.'
    );
    expect(releaseSource).toContain(
      'Completed after npm publish and GitHub Release creation:'
    );
    expect(releaseSource).toContain(
      '`pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.4`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.2.4`');
    expect(releaseSource).toContain(
      'publish timestamp `2026-07-02T01:03:13.919Z`'
    );
    expect(releaseSource).toContain(
      'npm package: `react-native-image-compression-kit@0.2.4`'
    );
    expect(releaseSource).toContain(
      'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.4.tgz`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-f6cqSgAbvx0jg7soLOgiCWsc+e1MwpTN6/mV7T5yKbLsU64ENMmBvR6PBiW2s8KU2UxDCTUDVXU4SBRK/eC62A==`'
    );
    expect(releaseSource).toContain(
      'npm shasum: `5fca25a4a94937e59b089b46599705af77cf2ba0`'
    );
    expect(releaseSource).toContain(
      'contains 49 files, 44.0 kB package size, and 186.9 kB unpacked size'
    );
    expect(releaseSource).toContain(
      'The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.'
    );
    expect(releaseSource).toContain(
      'fresh temporary consumer project installed `react-native-image-compression-kit@0.2.4`'
    );
    expect(releaseSource).toContain(
      'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.4>.'
    );
    expect(releaseSource).toContain('## v0.2.3');
    expect(releaseSource).toContain(
      'Status: published to npm on July 1, 2026 at 06:09:45 UTC (15:09:45 KST), tagged as `v0.2.3`.'
    );
    expect(releaseSource).toContain('adding iOS GIF');
    expect(releaseSource).toContain(
      'static first-frame input to the existing iOS JPEG/PNG input and JPEG/PNG output'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.2.3`.'
    );
    expect(releaseSource).toContain(
      'iOS `compressImage()` now accepts GIF input for JPEG and PNG output.'
    );
    expect(releaseSource).toContain(
      'iOS GIF input is decoded with ImageIO as a static first frame through `CGImageSourceCreateImageAtIndex`.'
    );
    expect(releaseSource).toContain(
      'GIF input to JPEG output keeps resize, `output.quality`, and JPEG `output.maxBytes` behavior.'
    );
    expect(releaseSource).toContain(
      'iOS `getImageCompressionCapabilities()` reports GIF `input=true` and `output=false`.'
    );
    expect(releaseSource).toContain(
      'The iOS host-app smoke validates `compress-gif-to-jpeg` and `compress-gif-to-png`, and removes GIF from the unsupported-input rejection loop.'
    );
    expect(releaseSource).toContain(
      'The iOS host-app smoke keeps `reject-gif-output` as an `ERR_INVALID_OPTIONS` TypeScript validation check because GIF output is not part of the public output format surface.'
    );
    expect(releaseSource).toContain(
      'README iOS limitation, public API, roadmap, package metadata, and host-app validation guidance are updated for the release behavior.'
    );
    expect(releaseSource).toContain(
      'TypeScript native-unavailable messaging now mentions iOS JPEG/PNG/GIF input and static first-frame GIF support.'
    );
    expect(releaseSource).toContain('### Release Checklist');
    expect(releaseSource).toContain('Before npm publish:');
    expect(releaseSource).toContain(
      'Actual implementation validation before the release commit:'
    );
    expect(releaseSource).toContain(
      'Commit: `62a1c3fb4763f5977592c8e7c917246ce6be2fe2`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28493712854>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28493712886>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28493712935>.'
    );
    expect(releaseSource).toContain(
      'RNICK_IOS_SMOKE_STEP_PASS compress-gif-to-jpeg'
    );
    expect(releaseSource).toContain(
      'RNICK_IOS_SMOKE_STEP_PASS compress-gif-to-png'
    );
    expect(releaseSource).toContain(
      'RNICK_IOS_SMOKE_STEP_PASS reject-gif-output'
    );
    expect(releaseSource).toContain(
      'gifResultBytes: 840'
    );
    expect(releaseSource).toContain(
      'gifToPngResultBytes: 331'
    );
    expect(releaseSource).toContain(
      "unsupportedInputs: ['webp', 'heic', 'heif', 'avif']"
    );
    expect(releaseSource).toContain(
      'Release commit validation before npm publish:'
    );
    expect(releaseSource).toContain(
      'Commit: `8d2394dfaf4b5ba5bc322fd766328624b7abc92d`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28496763807>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28496763836>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28496763804>.'
    );
    expect(releaseSource).toContain(
      'npm pack react-native-image-compression-kit@0.2.3 --json'
    );
    expect(releaseSource).toContain(
      'Completed after npm publish and GitHub Release creation:'
    );
    expect(releaseSource).toContain(
      '`pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.3`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.2.3`');
    expect(releaseSource).toContain(
      'publish timestamp `2026-07-01T06:09:45.481Z`'
    );
    expect(releaseSource).toContain(
      'npm package: `react-native-image-compression-kit@0.2.3`'
    );
    expect(releaseSource).toContain(
      'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.3.tgz`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-ns/m3ZmUdTyT+kVWjCWEzWMVE0Ydu9VtWkm361pg6TEpufEN6ImV9tK9e7iSmlwjvmeZESlUiduGdAr/7rJEXQ==`'
    );
    expect(releaseSource).toContain(
      'npm shasum: `d420053faf7d4e460c4cd41c99fb489c6d017dbd`'
    );
    expect(releaseSource).toContain(
      'contains 49 files, 43.7 kB package size, and 185.0 kB unpacked size'
    );
    expect(releaseSource).toContain(
      'The published tarball includes the README, SECURITY, LICENSE, iOS native source, Android runtime source, built JS, TypeScript declarations, Codegen source, package metadata, podspec, and React Native config.'
    );
    expect(releaseSource).toContain(
      'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.3>.'
    );
    expect(releaseSource).toContain('## v0.2.2');
    expect(releaseSource).toContain(
      'Status: published to npm on June 30, 2026 at 10:50:12 UTC (19:50:12 KST), tagged as `v0.2.2`.'
    );
    expect(releaseSource).toContain('adding PNG output');
    expect(releaseSource).toContain(
      'to the existing iOS JPEG/PNG input MVP'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.2.2`.'
    );
    expect(releaseSource).toContain(
      "iOS `compressImage()` now accepts `output.format: 'png'` for JPEG and PNG input."
    );
    expect(releaseSource).toContain(
      'iOS PNG output is encoded with `UIImagePNGRepresentation()` into the app cache directory.'
    );
    expect(releaseSource).toContain(
      'iOS PNG output rejects `output.maxBytes` with `ERR_NOT_IMPLEMENTED`.'
    );
    expect(releaseSource).toContain(
      'iOS `getImageCompressionCapabilities()` reports PNG `input=true` and `output=true`.'
    );
    expect(releaseSource).toContain(
      'The iOS host-app smoke validates JPEG-to-PNG and PNG-to-PNG output, plus PNG `maxBytes` rejection.'
    );
    expect(releaseSource).toContain(
      'TypeScript native-unavailable messaging now mentions iOS JPEG/PNG output support.'
    );
    expect(releaseSource).toContain('New public API surface.');
    expect(releaseSource).toContain('### Release Checklist');
    expect(releaseSource).toContain(
      'Actual implementation validation before the release commit:'
    );
    expect(releaseSource).toContain(
      'Commit: `8ff9345a882243459bb6c1d44a2b4c1802296370`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28436846165>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28436846207>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28436846121>.'
    );
    expect(releaseSource).toContain(
      'RNICK_IOS_SMOKE_STEP_PASS compress-jpeg-to-png'
    );
    expect(releaseSource).toContain(
      'RNICK_IOS_SMOKE_STEP_PASS compress-png-to-png'
    );
    expect(releaseSource).toContain(
      'RNICK_IOS_SMOKE_STEP_PASS reject-png-max-bytes'
    );
    expect(releaseSource).toContain('jpegToPngResultBytes: 805');
    expect(releaseSource).toContain('pngToPngResultBytes: 672');
    expect(releaseSource).toContain(
      'unsupportedOutputs` excluding `png`'
    );
    expect(releaseSource).toContain(
      'Release commit validation before npm publish:'
    );
    expect(releaseSource).toContain(
      'Commit: `8b00f730a9a9d4e37afe78434943ec69556dba80`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28438265776>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28438265781>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28438265837>.'
    );
    expect(releaseSource).toContain(
      '`pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.2`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.2.2`');
    expect(releaseSource).toContain(
      'publish timestamp `2026-06-30T10:50:12.131Z`'
    );
    expect(releaseSource).toContain(
      'npm package: `react-native-image-compression-kit@0.2.2`'
    );
    expect(releaseSource).toContain(
      'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.2.tgz`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-E7fzlLfMxAJhQim1xFbX9b5aEIFDtifHNYNlk7IM5+LrDgtINAR4moUe8MrPglfjJ/zpZAxcDH5eL6IlFzgzlQ==`'
    );
    expect(releaseSource).toContain(
      'npm shasum: `0bf7a4c554745d557e31787a78869895945d46df`'
    );
    expect(releaseSource).toContain(
      'contains 49 files, 43.2 kB package size, and 182.2 kB unpacked size'
    );
    expect(releaseSource).toContain(
      'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.2>.'
    );
    expect(releaseSource).toContain('## v0.2.1');
    expect(releaseSource).toContain(
      'Status: published to npm on June 30, 2026 at 09:37:20 UTC (18:37:20 KST), tagged as `v0.2.1`.'
    );
    expect(releaseSource).toContain('adding iOS JPEG');
    expect(releaseSource).toContain(
      'target-size compression to the existing iOS JPEG MVP'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.2.1`.'
    );
    expect(releaseSource).toContain(
      'iOS `compressImage()` now accepts `output.maxBytes` for JPEG output.'
    );
    expect(releaseSource).toContain(
      'iOS JPEG target-size compression validates `maxBytes` as a positive integer'
    );
    expect(releaseSource).toContain(
      'iOS `getImageCompressionCapabilities()` reports `supportsTargetSizeCompression: true`.'
    );
    expect(releaseSource).toContain(
      'TypeScript native-unavailable messaging now mentions iOS JPEG target-size support.'
    );
    expect(releaseSource).toContain('New public API surface.');
    expect(releaseSource).toContain(
      'Actual implementation validation before the release commit:'
    );
    expect(releaseSource).toContain(
      'Commit: `ab85c398e4aa266dc98bd7eb4f20ae59dcdebd78`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432011263>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432011301>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432011306>.'
    );
    expect(releaseSource).toContain(
      'Release commit validation before npm publish:'
    );
    expect(releaseSource).toContain(
      'Commit: `fee74b895e471a2132b3f233dad7b9a5797c237f`.'
    );
    expect(releaseSource).toContain(
      'GitHub Actions CI: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432929488>.'
    );
    expect(releaseSource).toContain(
      'Android Instrumentation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432929458>.'
    );
    expect(releaseSource).toContain(
      'iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28432929468>.'
    );
    expect(releaseSource).toContain(
      'RNICK_IOS_SMOKE_STEP_PASS compress-jpeg-to-jpeg-max-bytes'
    );
    expect(releaseSource).toContain('targetSizeResultBytes: 996');
    expect(releaseSource).toContain(
      'npm pack react-native-image-compression-kit@0.2.1'
    );
    expect(releaseSource).toContain(
      '`pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.1`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.2.1`');
    expect(releaseSource).toContain(
      'npm package: `react-native-image-compression-kit@0.2.1`'
    );
    expect(releaseSource).toContain(
      'npm tarball: `https://registry.npmjs.org/react-native-image-compression-kit/-/react-native-image-compression-kit-0.2.1.tgz`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-4gJD35dySJmtRKHfUW23iLNbFrv7R8ow1trLOl7BHQXduHIP49+AuSYewexTa39vGnl/pniANpMVwFEUgVtZlA==`'
    );
    expect(releaseSource).toContain(
      'npm shasum: `8b5bd26e2fe46b9b6b340b72a656beb41ad798f9`'
    );
    expect(releaseSource).toContain(
      'contains 49 files, 42.9 kB package size, and 180.5 kB unpacked size'
    );
    expect(releaseSource).toContain(
      'GitHub Release: <https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.1>.'
    );
    expect(releaseSource).toContain('## v0.2.0');
    expect(releaseSource).toContain(
      'Status: published to npm on June 30, 2026 at 07:04:03 UTC (16:04:03 KST), tagged as `v0.2.0`.'
    );
    expect(releaseSource).toContain('replacing the iOS');
    expect(releaseSource).toContain(
      'package stub with a native iOS JPEG compression MVP'
    );
    expect(releaseSource).toContain(
      'Implement iOS native `compressImage()` for local JPEG and PNG input.'
    );
    expect(releaseSource).toContain(
      'Support iOS JPEG output with `output.quality`, optional resize, and cache-file result metadata.'
    );
    expect(releaseSource).toContain(
      'Report iOS runtime capabilities for JPEG input/output, PNG input, metadata policies, target-size compression, and cancellation.'
    );
    expect(releaseSource).toContain(
      'Align README guidance, TypeScript native-unavailable messaging, and test expectations with the implemented iOS MVP.'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.2.0`.'
    );
    expect(releaseSource).toContain(
      'iOS `compressImage()` reads `file://` and best-effort `content://` source URIs.'
    );
    expect(releaseSource).toContain(
      'iOS input detection accepts JPEG and PNG only, rejecting other formats with `ERR_UNSUPPORTED_FORMAT`.'
    );
    expect(releaseSource).toContain(
      'iOS output supports JPEG only, rejecting unsupported output formats with `ERR_NOT_IMPLEMENTED`.'
    );
    expect(releaseSource).toContain(
      'iOS resize supports `contain`, `cover`, and `stretch`.'
    );
    expect(releaseSource).toContain(
      'iOS `output.quality` supports integer quality values from `0` to `100`, defaulting to `80`.'
    );
    expect(releaseSource).toContain(
      "iOS `metadata: 'safe'` and `metadata: 'strip'` are accepted"
    );
    expect(releaseSource).toContain(
      "iOS `metadata: 'preserve'` and `output.maxBytes` reject with `ERR_NOT_IMPLEMENTED`."
    );
    expect(releaseSource).toContain(
      "iOS `getImageCompressionCapabilities()` reports `metadataPolicies: ['safe', 'strip']`"
    );
    expect(releaseSource).toContain(
      'README iOS support matrix, public API guidance, roadmap, installation status, and release dry-run wording updates.'
    );
    expect(releaseSource).toContain(
      'Focused TypeScript and source-level native foundation test expectation updates for the `0.2.0` release.'
    );
    expect(releaseSource).toContain(
      'npm package publication under the `latest` dist-tag.'
    );
    expect(releaseSource).toContain(
      'Git tag `v0.2.0` and GitHub Release `v0.2.0`.'
    );
    expect(releaseSource).toContain('Android runtime behavior changes.');
    expect(releaseSource).toContain(
      'HEIC / HEIF / AVIF / GIF / WebP input on iOS.'
    );
    expect(releaseSource).toContain('iOS target-size compression.');
    expect(releaseSource).toContain('iOS metadata preservation.');
    expect(releaseSource).toContain('### Published Artifacts');
    expect(releaseSource).toContain(
      'npm package: `react-native-image-compression-kit@0.2.0`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-YUsh/bwcU/ScsWu5RGQT/CEZaQ6dL9xCgoYfHOHalJkEeWicv9lT7HqEGhle84EUTLL8a8T3vefw+fso7kPj6Q==`'
    );
    expect(releaseSource).toContain('Git tag: `v0.2.0`');
    expect(releaseSource).toContain(
      'GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.0`'
    );
    expect(releaseSource).toContain(
      'Published tarball size: 41.1 kB package size, 176.1 kB unpacked size, 49 files.'
    );
    expect(releaseSource).toContain(
      'The `v0.2.0` release completed these checks before npm publish'
    );
    expect(releaseSource).toContain('pnpm pack --dry-run');
    expect(releaseSource).toContain(
      'native smoke test that links the pod and compresses a JPEG and PNG source to'
    );
    expect(releaseSource).toContain(
      'Actual iOS host-app validation result for the implementation candidate:'
    );
    expect(releaseSource).toContain(
      'GitHub Actions iOS Validation: <https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/28424614173>.'
    );
    expect(releaseSource).toContain(
      'Runtime smoke evidence: `RNICK_IOS_SMOKE_PASS` with `jpegResultBytes: 946`, `pngResultBytes: 1034`'
    );
    expect(releaseSource).toContain(
      "unsupportedInputs: ['webp', 'heic', 'heif', 'avif', 'gif']"
    );
    expect(releaseSource).toContain('### Publish Commands');
    expect(releaseSource).toContain('pnpm publish --tag latest');
    expect(releaseSource).toContain(
      'npm pack react-native-image-compression-kit@0.2.0'
    );
    expect(releaseSource).toContain('### Post-publish Verification');
    expect(releaseSource).toContain(
      '`pnpm publish --tag latest` published `react-native-image-compression-kit@0.2.0`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.2.0`');
    expect(releaseSource).toContain(
      'publish timestamp `2026-06-30T07:04:03.022Z`'
    );
    expect(releaseSource).toContain(
      'shasum `850a32e69d3c398e58b129ea330bc3d5a27eb5fd`'
    );
    expect(releaseSource).toContain(
      'fresh temporary consumer project installed `react-native-image-compression-kit@0.2.0`'
    );
    expect(releaseSource).toContain(
      'GitHub Release `v0.2.0` was created at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.2.0`.'
    );
    expect(releaseSource).toContain('## v0.1.2');
    expect(releaseSource).toContain(
      'Status: published to npm on June 30, 2026 at 02:18:30 UTC (11:18:30 KST), tagged as `v0.1.2`.'
    );
    expect(releaseSource).toContain(
      'This patch keeps Android runtime behavior unchanged'
    );
    expect(releaseSource).toContain(
      'Clarify that iOS ships a native package stub and iOS compression is not implemented.'
    );
    expect(releaseSource).toContain(
      'Preserve a stable iOS `ERR_NOT_IMPLEMENTED` compression failure'
    );
    expect(releaseSource).toContain(
      'Make iOS capability reporting show no supported input formats, output formats, metadata policies, target-size compression, or cancellation.'
    );
    expect(releaseSource).toContain(
      'Update the TypeScript native-unavailable message'
    );
    expect(releaseSource).toContain(
      'Publish package metadata for `0.1.2` after the release candidate passed local and GitHub Actions validation.'
    );
    expect(releaseSource).toContain('### Published Artifacts');
    expect(releaseSource).toContain(
      'npm package: `react-native-image-compression-kit@0.1.2`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-OOHIV4Lnmu+16/W8iGMZriiYXLbB9nIVV0vBz4dd3erW3meaSqV28JkWpc/5FetIz0HcLU/4Pfgq8eTZ8fIY6g==`'
    );
    expect(releaseSource).toContain('Git tag: `v0.1.2`');
    expect(releaseSource).toContain(
      'GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.2`'
    );
    expect(releaseSource).toContain(
      'Published tarball size: 35.3 kB package size, 146.8 kB unpacked size, 49 files.'
    );
    expect(releaseSource).toContain(
      'iOS stub `compressImage()` error message aligned to the package-stub state.'
    );
    expect(releaseSource).toContain(
      'iOS `getImageCompressionCapabilities()` reports `metadataPolicies: []`'
    );
    expect(releaseSource).toContain(
      'TypeScript `ERR_NATIVE_MODULE_UNAVAILABLE` message distinguishes install/linking failure'
    );
    expect(releaseSource).toContain(
      'README iOS stub behavior guidance and release dry-run wording updates.'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.1.2`.'
    );
    expect(releaseSource).toContain(
      'Focused test and Android verification doctor expectation updates for the `0.1.2` release.'
    );
    expect(releaseSource).toContain('iOS compression implementation.');
    expect(releaseSource).toContain('Android runtime behavior changes.');
    expect(releaseSource).toContain('git tag -a v0.1.2 -m "v0.1.2"');
    expect(releaseSource).toContain('git push origin v0.1.2');
    expect(releaseSource).toContain(
      'npm pack react-native-image-compression-kit@0.1.2'
    );
    expect(releaseSource).toContain('### Post-publish Verification');
    expect(releaseSource).toContain(
      '`npm publish --tag latest` published `react-native-image-compression-kit@0.1.2`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.1.2`');
    expect(releaseSource).toContain(
      'publish timestamp `2026-06-30T02:18:30.591Z`'
    );
    expect(releaseSource).toContain(
      'The published tarball includes the README, iOS native stub, built JS'
    );
    expect(releaseSource).toContain(
      'Published tarball inspection confirmed the iOS `ERR_NOT_IMPLEMENTED` message'
    );
    expect(releaseSource).toContain(
      'fresh temporary consumer project installed `react-native-image-compression-kit@0.1.2`'
    );
    expect(releaseSource).toContain(
      'GitHub Release `v0.1.2` was created at `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.2`.'
    );
    expect(releaseSource).toContain('## v0.1.1');
    expect(releaseSource).toContain(
      'Status: prepared for a docs-only npm patch release.'
    );
    expect(releaseSource).toContain(
      'This patch corrects the README content that appears on the npm package page'
    );
    expect(releaseSource).toContain('Android MVP is published');
    expect(releaseSource).toContain('iOS remains a');
    expect(releaseSource).toContain(
      'package stub and iOS compression is not implemented'
    );
    expect(releaseSource).toContain(
      'Remove stale README wording that said the package had not been published to npm.'
    );
    expect(releaseSource).toContain(
      'Replace React Native and TypeScript badge values'
    );
    expect(releaseSource).toContain('Bump package metadata to `0.1.1`');
    expect(releaseSource).toContain(
      'README status, badges, public API wording, installation wording, and release checklist wording updates.'
    );
    expect(releaseSource).toContain(
      '`package.json` version bump to `0.1.1`.'
    );
    expect(releaseSource).toContain('Android runtime behavior changes.');
    expect(releaseSource).toContain('npm publish, git tag creation, or git push.');
    expect(releaseSource).toContain('git tag -a v0.1.1 -m "v0.1.1"');
    expect(releaseSource).toContain('git push origin v0.1.1');
    expect(releaseSource).toContain(
      'npm pack react-native-image-compression-kit@0.1.1'
    );
    expect(releaseSource).toContain('### Post-publish Verification');
    expect(releaseSource).toContain(
      '`pnpm publish --no-git-checks` published `react-native-image-compression-kit@0.1.1`.'
    );
    expect(releaseSource).toContain('`latest` dist-tag `0.1.1`');
    expect(releaseSource).toContain(
      'publish timestamp `2026-06-29T07:18:19.684Z`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-pnLxeyn/JVKykGbOKrS9GYoU+pKr/oq4nffdHPn97ycjOw//RD6Yd6BGUPNuRcVoqnS17QsYgGx2c5JXWQq4BA==`'
    );
    expect(releaseSource).toContain(
      '49 files, 35.1 kB package size, and 144.8 kB unpacked size'
    );
    expect(releaseSource).toContain(
      'corrected README status, Android MVP published badge, Android MVP / iOS stub platform badge'
    );
    expect(releaseSource).toContain(
      'Published README verification found no stale'
    );
    expect(releaseSource).toContain(
      'fresh temporary consumer project installed `react-native-image-compression-kit@0.1.1`'
    );
    expect(releaseSource).toContain('## v0.1.0');
    expect(releaseSource).toContain(
      'Status: published to npm on June 27, 2026 at 10:51:55 UTC (19:51:55 KST), tagged as `v0.1.0`.'
    );
    expect(releaseSource).toContain('published as');
    expect(releaseSource).toContain('### Published Artifacts');
    expect(releaseSource).toContain(
      'npm package: `react-native-image-compression-kit@0.1.0`'
    );
    expect(releaseSource).toContain(
      'npm integrity: `sha512-W8kaa3eKdWVLHCGeApdOqNMfeD7np42OcgjGCUZAQDZqzx86diybRtEqK+MJtX73Yt4wLcVKOtb62sPtLJLk9g==`'
    );
    expect(releaseSource).toContain(
      'GitHub Release: `https://github.com/GGULBAE/react-native-image-compression-kit/releases/tag/v0.1.0`'
    );
    expect(releaseSource).toContain(
      'Published tarball size: 34.2 kB package size, 142.2 kB unpacked size, 48 files.'
    );
    expect(releaseSource).toContain('Android MVP only');
    expect(releaseSource).toContain('file://` and `content://');
    expect(releaseSource).toContain(
      'JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input'
    );
    expect(releaseSource).toContain(
      'GIF input is decoded as a static first frame'
    );
    expect(releaseSource).toContain('HEIC / HEIF input is SDK-gated');
    expect(releaseSource).toContain('Android 14+ AVIF input');
    expect(releaseSource).toContain('JPEG, PNG, and WebP output');
    expect(releaseSource).toContain(
      'Target-size compression with maxBytes for JPEG and WebP output'
    );
    expect(releaseSource).toContain(
      'Metadata policies preserve, safe, and strip'
    );
    expect(releaseSource).toContain('iOS compression is not implemented');
    expect(releaseSource).toContain('AVIF output is not implemented');
    expect(releaseSource).toContain('HEIC / HEIF output is not implemented');
    expect(releaseSource).toContain(
      'GIF output and animation preservation are not implemented'
    );
    expect(releaseSource).toContain('### Release Checklist');
    expect(releaseSource).toContain('git status --short --branch');
    expect(releaseSource).toContain('pnpm release:dry-run');
    expect(releaseSource).toContain('GitHub Actions CI success');
    expect(releaseSource).toContain('git tag -a v0.1.0 -m "v0.1.0"');
    expect(releaseSource).toContain('git push origin v0.1.0');
    expect(releaseSource).toContain('### Publish Commands');
    expect(releaseSource).toContain(
      'pnpm login --registry=https://registry.npmjs.org/'
    );
    expect(releaseSource).toContain('pnpm whoami');
    expect(releaseSource).toContain('pnpm publish --otp 123456');
    expect(releaseSource).toContain(
      'pnpm view react-native-image-compression-kit version dist.integrity'
    );
    expect(releaseSource).toContain('### Post-publish Security Review');
    expect(releaseSource).toContain(
      'contains no `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, `postpack`, `publish`, or `postpublish` lifecycle scripts'
    );
    expect(releaseSource).toContain(
      'forbidden-file scan found no `.env*`, `.npmrc`, key files, debug keystore, Android test directories, example app files, or repository scripts'
    );
    expect(releaseSource).toContain(
      '`pnpm audit --prod` reported no known vulnerabilities'
    );
    expect(releaseSource).toContain('### External Install Smoke');
    expect(releaseSource).toContain(
      'Installed `react-native-image-compression-kit@0.1.0` from the npm registry with `pnpm install --ignore-scripts`'
    );
    expect(releaseSource).toContain(
      'Confirmed dependency resolution with `pnpm list react-native-image-compression-kit react-native react --depth 0`'
    );
    expect(releaseSource).toContain(
      'Typechecked imports for `compressImage`, `getImageCompressionCapabilities`, `ImageCompressionKitError`, `CompressionOptions`, `CompressionResult`, and `ImageCompressionCapabilities`'
    );
    expect(releaseSource).toContain(
      '`pnpm typecheck` completed successfully in the external consumer project'
    );
    expect(releaseSource).toContain(
      'The GitHub Release was created from this note'
    );
    expect(releaseSource).toContain(
      'gh release create v0.1.0 --title "v0.1.0" --notes-file RELEASE.md'
    );
    expect(readmeSource).toContain(
      'See [RELEASE.md](RELEASE.md) for the v0.2.42 iOS PASS payload CI log replay fixture candidate notes, v0.2.41 iOS PASS payload schema matrix helper candidate notes, v0.2.40 iOS AVIF-input unavailable PASS payload schema snapshot release notes, v0.2.39 iOS WebP-output available PASS payload schema snapshot candidate notes, v0.2.38 iOS smoke PASS payload schema snapshot release notes, v0.2.37 iOS smoke diagnostics artifact schema snapshot candidate notes, v0.2.36 iOS smoke artifact failure-path dry-run fixture candidate notes, v0.2.35 iOS smoke diagnostics packed log artifact coverage candidate notes, v0.2.34 iOS smoke log stream error fixture coverage candidate notes, v0.2.33 iOS smoke process lifecycle fixture coverage candidate notes, v0.2.32 iOS smoke timeout CLI fixture coverage candidate notes, v0.2.31 iOS smoke diagnostic testability hardening candidate notes, v0.2.30 iOS smoke retry and diagnostic hardening candidate notes, v0.2.29 Android AVIF output helper validation-result provenance contract candidate notes, v0.2.28 Android AVIF output helper temp-file lifecycle contract candidate notes, v0.2.27 Android AVIF output helper blocked-route detail contract candidate notes, v0.2.26 Android AVIF output helper validation detail contract candidate notes, v0.2.25 Android AVIF output helper direct-output success contract candidate notes, v0.2.24 Android AVIF output helper injected success contract candidate notes, v0.2.23 Android AVIF output helper injectable validation seam candidate notes, v0.2.22 Android AVIF output production helper extraction candidate notes, v0.2.21 Android AVIF output production wiring scaffold candidate notes, v0.2.20 AVIF output production wiring preflight candidate notes, v0.2.19 published AVIF output production gate release notes, v0.2.18 docs-only npm README correction release notes, v0.2.17 published Android AVIF output encode/decode-back smoke release notes, v0.2.16 Android AVIF output encoder route prototype candidate notes, v0.2.15 AVIF output feasibility candidate notes, v0.2.14 published AVIF output capability/error surface release notes, v0.2.13 published iOS JPEG metadata preserve hardening release notes, v0.2.12 published iOS JPEG metadata preserve release notes, v0.2.11 docs-only correction notes, v0.2.10 published release notes, v0.2.9 release notes, v0.2.8 release notes, v0.2.7 release notes, v0.2.6 release notes, v0.2.5 release notes, v0.2.4 release notes, v0.2.3 release notes, v0.2.2 release notes, v0.2.1 release notes, v0.2.0 published release notes, v0.1.2 published patch notes, v0.1.1 docs-only patch notes, v0.1.0 published artifact details, tag checklist, and post-publish security review.'
    );
    expect(readmeSource).toContain(
      'The v0.2.50 GitHub artifact attestation and offline identity verification candidate notes are in [RELEASE.md](RELEASE.md).'
    );
    expect(readmeSource).toContain(
      'The v0.2.49 Registry provenance bundle offline verification candidate notes are in [RELEASE.md](RELEASE.md).'
    );
    expect(readmeSource).toContain(
      'Successful [Registry Validation run 29182554246](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29182554246) on commit `d233529ddb3804b9fff05832bc4b327348f0fc51` uploaded the fixed four-file v0.2.48 bundle'
    );
    expect(readmeSource).toContain('reviewed release notes');
    expect(readmeSource).toContain(
      'npm publish, registry smoke, and post-publish security review commands are documented in `RELEASE.md`'
    );
  });

  it('documents security policy and package hygiene expectations', () => {
    const securitySource = readProjectFile('SECURITY.md');
    const readmeSource = readProjectFile('README.md');

    expect(securitySource).toContain('# Security Policy');
    expect(securitySource).toContain('| 0.2.x | Yes |');
    expect(securitySource).toContain('| 0.1.x | No |');
    expect(securitySource).toContain(
      'Please do not include exploit details, secrets, private keys, or sensitive'
    );
    expect(securitySource).toContain(
      'The npm package is intended to avoid install-time code execution.'
    );
    expect(securitySource).toContain(
      '`preinstall`, `install`, `postinstall`, `prepare`'
    );
    expect(securitySource).toContain(
      'Development-only scripts, tests,'
    );
    expect(securitySource).toContain(
      'fixtures, example apps, build directories, credentials, `.npmrc`, `.env*`, keys,'
    );
    expect(securitySource).toContain('## Dependency Triage');
    expect(securitySource).toContain('dependency as npm runtime');
    expect(securitySource).toContain('validation toolchain');
    expect(securitySource).toContain(
      'The `example/Gemfile` Ruby dependencies are used for local and GitHub Actions'
    );
    expect(securitySource).toContain('Ruby 3.1 or newer');
    expect(securitySource).toContain('pins ActiveSupport');
    expect(securitySource).toContain('Concurrent Ruby to patched minimum versions');
    expect(securitySource).toContain(
      '### v0.2.0 Post-Release Alert Classification'
    );
    expect(securitySource).toContain('no npm runtime advisories from');
    expect(securitySource).toContain('Alerts #2, #3, and #4');
    expect(securitySource).toContain('activesupport >= 7.2.3.1');
    expect(securitySource).toContain('Alerts #5, #6, and #7');
    expect(securitySource).toContain('concurrent-ruby >= 1.3.7');
    expect(securitySource).toContain('pnpm release:dry-run');
    expect(securitySource).toContain('pnpm audit --prod');
    expect(securitySource).toContain(
      'npm pack react-native-image-compression-kit@<version>'
    );
    expect(readmeSource).toContain('## Security');
    expect(readmeSource).toContain(
      'See [SECURITY.md](SECURITY.md) for supported versions, vulnerability reporting guidance, dependency triage, and package security hygiene.'
    );
    expect(readmeSource).toContain(
      'Published packages should not run install-time lifecycle scripts'
    );
  });

  it('keeps GitHub Actions on Node 24 runtime-compatible action majors', () => {
    const ciWorkflowSource = readProjectFile('.github/workflows/ci.yml');
    const instrumentationWorkflowSource = readProjectFile(
      '.github/workflows/android-instrumentation.yml'
    );
    const readmeSource = readProjectFile('README.md');
    const expectedActions = [
      'uses: actions/checkout@v7',
      'uses: actions/setup-java@v5',
      'uses: android-actions/setup-android@v4',
      'uses: pnpm/action-setup@v6',
      'uses: actions/setup-node@v6',
      'uses: gradle/actions/setup-gradle@v6',
    ];
    const deprecatedActions = [
      'uses: actions/checkout@v4',
      'uses: actions/setup-java@v4',
      'uses: android-actions/setup-android@v3',
      'uses: pnpm/action-setup@v4',
      'uses: actions/setup-node@v4',
      'uses: gradle/actions/setup-gradle@v4',
    ];

    for (const action of expectedActions) {
      expect(ciWorkflowSource).toContain(action);
      expect(instrumentationWorkflowSource).toContain(action);
    }

    for (const action of deprecatedActions) {
      expect(ciWorkflowSource).not.toContain(action);
      expect(instrumentationWorkflowSource).not.toContain(action);
    }

    expect(instrumentationWorkflowSource).toContain(
      'uses: reactivecircus/android-emulator-runner@v2'
    );
    expect(readmeSource).toContain('Node 24 runtime-compatible majors');
    expect(readmeSource).toContain('`actions/checkout@v7`');
    expect(readmeSource).toContain('`actions/setup-node@v6`');
    expect(readmeSource).toContain('`actions/setup-java@v5`');
    expect(readmeSource).toContain('`android-actions/setup-android@v4`');
    expect(readmeSource).toContain('`pnpm/action-setup@v6`');
    expect(readmeSource).toContain('`gradle/actions/setup-gradle@v6`');
  });

  it('documents the HEIC, HEIF, and AVIF real codec sample validation strategy', () => {
    const readmeSource = readProjectFile('README.md');
    const verificationSource = readProjectFile('scripts/android-verification.mjs');

    expect(readmeSource).toContain('## HEIC / HEIF / AVIF Codec Sample Validation Strategy');
    expect(readmeSource).toContain(
      'This repository now commits tiny HEIC / HEIF / AVIF samples generated from repo-owned PNG sources.'
    );
    expect(readmeSource).toContain('Use `android/src/test/assets/heic-heif/source.png`');
    expect(readmeSource).toContain('Track source and generated output metadata');
    expect(readmeSource).toContain('`android/src/test/assets/heic-heif/manifest.json`');
    expect(readmeSource).toContain('committed sample files');
    expect(readmeSource).toContain('`pnpm fixtures:heic-heif:check`');
    expect(readmeSource).toContain('`pnpm fixtures:heic-heif`');
    expect(readmeSource).toContain(
      'heif-enc --quality 80 source.png -o sample.heic'
    );
    expect(readmeSource).toContain('`pnpm fixtures:avif:check`');
    expect(readmeSource).toContain('`pnpm fixtures:avif`');
    expect(readmeSource).toContain(
      'heif-enc --quality 80 --avif source.png -o sample.avif'
    );
    expect(readmeSource).toContain('Generated fixtures are committed because they are tiny');
    expect(readmeSource).toContain('android/src/test/assets/heic-heif/');
    expect(readmeSource).toContain(
      'They verify the fixture files and metadata, but they do not boot an emulator.'
    );
    expect(readmeSource).toContain(
      'A separate Android Instrumentation workflow enables KVM permissions, boots an API 35 Google APIs emulator with an extended boot timeout'
    );
    expect(readmeSource).toContain('`pnpm example:android-instrumentation`');
    expect(readmeSource).toContain(
      'committed `sample.heic`, `sample.heif`, and `sample.avif` fixtures through their `ImageDecoder` routes'
    );
    expect(readmeSource).toContain(
      'Manual codec validation beyond CI should use a codec-backed Android device or emulator'
    );
    expect(readmeSource).toContain(
      'file:///data/data/com.imagecompressionkit.example/files/rnick-codec/sample.heic'
    );
    expect(readmeSource).toContain(
      'API 26-27 should still be checked separately for the guarded `BitmapFactory` fallback'
    );
    expect(readmeSource).toContain(
      'For AVIF manual validation, use an API 34+ device or emulator'
    );
    expect(verificationSource).toContain('checkHeicHeifCodecSampleStrategy');
  });

  it('wires HEIC, HEIF, and AVIF emulator instrumentation validation', () => {
    const gradleSource = readProjectFile('android/build.gradle');
    const instrumentationSource = readProjectFile(
      'android/src/androidTest/java/com/imagecompressionkit/ImageCompressionKitHeicHeifInstrumentationTest.kt'
    );
    const workflowSource = readProjectFile('.github/workflows/android-instrumentation.yml');
    const verificationSource = readProjectFile('scripts/android-verification.mjs');

    expect(gradleSource).toContain(
      'testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"'
    );
    expect(gradleSource).toContain('androidTest.assets.srcDirs += ["src/test/assets"]');
    expect(gradleSource).toContain(
      'androidTestImplementation "androidx.test.ext:junit:1.2.1"'
    );
    expect(instrumentationSource).toContain(
      'compressesCommittedHeicHeifAndAvifSamplesToJpegPngAndWebp'
    );
    expect(instrumentationSource).toContain('probesAndroidAvifOutputEncoderPrototypeRoute');
    expect(instrumentationSource).toContain('attemptsAndroidAvifOutputEncodeDecodeBackSmoke');
    expect(instrumentationSource).toContain(
      'AndroidAvifOutputPrototype.runEncodeDecodeBackSmoke(targetContext.cacheDir)'
    );
    expect(instrumentationSource).toContain('RNICK_AVIF_OUTPUT_SMOKE');
    expect(instrumentationSource).toContain(
      'Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE'
    );
    expect(instrumentationSource).toContain(
      'AndroidAvifOutputPrototype.inspectRoute(width = 16, height = 12)'
    );
    expect(instrumentationSource).toContain('AndroidAvifOutputPrototype.PRODUCTION_GATE_MESSAGE');
    expect(instrumentationSource).toContain('assertFalse(report.productionReady)');
    expect(instrumentationSource).toContain('assertAvifOutputCapabilityRemainsFalse');
    expect(instrumentationSource).toContain('assertFalse(avifCapability.getBoolean("output"))');
    expect(instrumentationSource).toContain('result.signatureValid');
    expect(instrumentationSource).toContain('result.decodeBackValid');
    expect(instrumentationSource).toContain('result.blocker');
    expect(instrumentationSource).toContain('heic-heif/sample.heic');
    expect(instrumentationSource).toContain('heic-heif/sample.heif');
    expect(instrumentationSource).toContain('avif/sample.avif');
    expect(instrumentationSource).toContain('ImageCompressionKitModule(');
    expect(instrumentationSource).toContain('JavaOnlyMap.of');
    expect(instrumentationSource).toContain('OutputCase("jpeg", ::assertJpegSignature)');
    expect(instrumentationSource).toContain('OutputCase("png", ::assertPngSignature)');
    expect(instrumentationSource).toContain('OutputCase("webp", ::assertWebpSignature)');
    expect(instrumentationSource).toContain(
      'assertBitmapDimensions(outputFile, width = 16, height = 12)'
    );
    expect(workflowSource).toContain('name: Android Instrumentation');
    expect(workflowSource).toContain('HEIC/HEIF/AVIF emulator validation');
    expect(workflowSource).toContain('Enable KVM group permissions');
    expect(workflowSource).toContain('reactivecircus/android-emulator-runner@v2');
    expect(workflowSource).toContain('api-level: 35');
    expect(workflowSource).toContain('target: google_apis');
    expect(workflowSource).toContain('emulator-boot-timeout: 1200');
    expect(workflowSource).toContain('script: |');
    expect(workflowSource).toContain('pnpm example:android-instrumentation');
    expect(workflowSource).toContain('instrumentation_status=$?');
    expect(workflowSource).toContain('adb logcat -d -s RNICK_AVIF_OUTPUT_SMOKE:I');
    expect(verificationSource).toContain('checkHeicHeifInstrumentationValidation');
  });

  it('defines the AVIF source fixture manifest and committed sample', () => {
    const manifest = JSON.parse(readProjectFile('android/src/test/assets/avif/manifest.json'));
    const sourceBytes = readProjectBinary(manifest.source.path);
    const sourceDimensions = readPngDimensions(sourceBytes);
    const fixture = manifest.generatedFixtures[0];
    const fixtureBytes = readProjectBinary(fixture.targetPath);
    const generatorSource = readProjectFile('scripts/generate-avif-fixtures.mjs');

    expect(packageJson.scripts['fixtures:avif']).toBe(
      'node scripts/generate-avif-fixtures.mjs'
    );
    expect(packageJson.scripts['fixtures:avif:check']).toBe(
      'node scripts/generate-avif-fixtures.mjs --check'
    );
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.description).toContain('AVIF fixture');
    expect(manifest.source).toMatchObject({
      path: 'android/src/test/assets/avif/source.png',
      format: 'png',
      byteSize: sourceBytes.length,
      sha256: sha256(sourceBytes),
      dimensions: sourceDimensions,
    });
    expect(fixture).toMatchObject({
      format: 'avif',
      sourcePath: manifest.source.path,
      targetPath: 'android/src/test/assets/avif/sample.avif',
      byteSize: fixtureBytes.length,
      sha256: sha256(fixtureBytes),
      provenance: {
        generator: 'libheif heif-enc',
        generatorVersion: '1.23.0',
        source: 'repo-owned source.png',
        license: 'MIT',
        status: 'committed fixture generated from repo-owned source',
      },
    });
    expect(fixture.generationCommand).toContain(
      'heif-enc --quality 80 --avif source.png -o sample.avif'
    );
    expect(manifest.validation.runtimeStatus).toContain('API 34+ emulator instrumentation');
    expect(generatorSource).toContain('--avif');
    expect(generatorSource).toContain('validateCommittedFixture');
    expect(generatorSource).toContain('AVIF fixture manifest OK');
  });

  it('defines the HEIC and HEIF source fixture manifest and committed samples', () => {
    const manifest = JSON.parse(
      readProjectFile('android/src/test/assets/heic-heif/manifest.json')
    );
    const sourceBytes = readProjectBinary(manifest.source.path);
    const sourceDimensions = readPngDimensions(sourceBytes);
    const generatorSource = readProjectFile('scripts/generate-heic-heif-fixtures.mjs');

    expect(packageJson.scripts['fixtures:heic-heif']).toBe(
      'node scripts/generate-heic-heif-fixtures.mjs'
    );
    expect(packageJson.scripts['fixtures:heic-heif:check']).toBe(
      'node scripts/generate-heic-heif-fixtures.mjs --check'
    );
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.source).toMatchObject({
      path: 'android/src/test/assets/heic-heif/source.png',
      format: 'png',
      byteSize: sourceBytes.length,
      sha256: sha256(sourceBytes),
      dimensions: sourceDimensions,
    });
    expect(manifest.source.provenance).toMatchObject({
      owner: 'react-native-image-compression-kit',
      license: 'MIT',
    });
    expect(manifest.description).toContain('committed samples');
    expect(manifest.generatedFixtures.map((fixture: { format: string }) => fixture.format)).toEqual([
      'heic',
      'heif',
    ]);
    manifest.generatedFixtures.forEach(
      (fixture: {
        format: string;
        sourcePath: string;
        targetPath: string;
        generationCommand: string;
        byteSize: number;
        sha256: string;
        provenance: {
          generator: string;
          generatorVersion: string;
          source: string;
          license: string;
          status: string;
        };
      }) => {
        const fixtureBytes = readProjectBinary(fixture.targetPath);

        expect(fixture.sourcePath).toBe(manifest.source.path);
        expect(fixture.targetPath).toBe(
          `android/src/test/assets/heic-heif/sample.${fixture.format}`
        );
        expect(fixture.generationCommand).toContain(
          `heif-enc --quality 80 source.png -o sample.${fixture.format}`
        );
        expect(fixture.byteSize).toBe(fixtureBytes.length);
        expect(fixture.sha256).toBe(sha256(fixtureBytes));
        expect(fixture.provenance).toMatchObject({
          generator: 'libheif heif-enc',
          generatorVersion: '1.23.0',
          source: 'repo-owned source.png',
          license: 'MIT',
          status: 'committed fixture generated from repo-owned source',
        });
      }
    );
    expect(manifest.validation.runtimeStatus).toContain('binary fixtures are committed');
    expect(generatorSource).toContain('heif-enc');
    expect(generatorSource).toContain('CHECK_ONLY');
    expect(generatorSource).toContain('readPngDimensions');
    expect(generatorSource).toContain('validateCommittedFixture');
    expect(generatorSource).toContain(
      'byteSize must be recorded for committed binary fixtures'
    );
  });

  it('documents the Android AVIF output encoder route prototype and smoke attempt in source and JVM tests', () => {
    const helperSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/AndroidAvifOutputHelper.kt'
    );
    const prototypeSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/AndroidAvifOutputPrototype.kt'
    );
    const helperTestSource = readProjectFile(
      'android/src/test/java/com/imagecompressionkit/AndroidAvifOutputHelperTest.kt'
    );
    const prototypeTestSource = readProjectFile(
      'android/src/test/java/com/imagecompressionkit/AndroidAvifOutputPrototypeTest.kt'
    );
    const combinedSource = `${helperSource}\n${prototypeSource}`;
    const combinedTestSource = `${helperTestSource}\n${prototypeTestSource}`;

    expect(combinedSource).toContain('AndroidAvifOutputHelper');
    expect(combinedSource).toContain('AndroidAvifOutputHelperInput');
    expect(combinedSource).toContain('AndroidAvifOutputHelperOutput');
    expect(combinedSource).toContain('AndroidAvifOutputHelperSample');
    expect(combinedSource).toContain('AndroidAvifOutputHelperFileValidation');
    expect(combinedSource).toContain('AndroidAvifOutputHelperDependencies');
    expect(combinedSource).toContain('AndroidAvifOutputHelperResult');
    expect(combinedSource).toContain('PRODUCTION_HELPER_ROUTE');
    expect(combinedSource).toContain('HELPER_DISABLED_FROM_COMPRESS_IMAGE');
    expect(combinedSource).toContain('INJECTABLE_VALIDATION_SEAM');
    expect(combinedSource).toContain('AndroidAvifOutputPrototype');
    expect(combinedSource).toContain('AndroidAvifOutputPrototypeReport');
    expect(combinedSource).toContain('AndroidAvifEncodeDecodeSmokeResult');
    expect(combinedSource).toContain('AndroidAvifSmokeBlocker');
    expect(combinedSource).toContain('blockerCode');
    expect(combinedSource).toContain('outputCanBeEnabled');
    expect(combinedSource).toContain('productionDecision');
    expect(combinedSource).toContain('BLOCKER_CODE_SDK_UNAVAILABLE');
    expect(combinedSource).toContain('BLOCKER_CODE_NO_IMAGE_AVIF_ENCODER');
    expect(combinedSource).toContain('BLOCKER_CODE_CODEC_FAILURE');
    expect(combinedSource).toContain('BLOCKER_CODE_INVALID_SIGNATURE');
    expect(combinedSource).toContain('BLOCKER_CODE_DECODE_BACK_FAILURE');
    expect(combinedSource).toContain('NO_IMAGE_AVIF_ENCODER_BLOCKER');
    expect(combinedSource).toContain('INVALID_SIGNATURE_BLOCKER');
    expect(combinedSource).toContain('DECODE_BACK_FAILURE_BLOCKER');
    expect(combinedSource).toContain('CODEC_FAILURE_BLOCKER_PREFIX');
    expect(combinedSource).toContain('PRODUCTION_DECISION_KEEP_DISABLED');
    expect(combinedSource).toContain('PRODUCTION_DECISION_SMOKE_PASSED_KEEP_DISABLED');
    expect(combinedSource).toContain('MediaCodecList(MediaCodecList.REGULAR_CODECS)');
    expect(combinedSource).toContain('findEncoderForFormat');
    expect(combinedSource).toContain(
      'MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible'
    );
    expect(combinedSource).toContain('MediaCodec image/avif encoder probe');
    expect(combinedSource).toContain('MediaCodec image/avif encode/decode-back smoke');
    expect(combinedSource).toContain('AV1_VIDEO_MIME_TYPE = "video/av01"');
    expect(combinedSource).toContain('SMOKE_ROUTE');
    expect(combinedSource).toContain('PRODUCTION_GATE_MESSAGE');
    expect(combinedSource).toContain('looksLikeAvifFile');
    expect(combinedSource).toContain('classifySmokeValidationBlocker');
    expect(combinedSource).toContain('codecFailureBlocker');
    expect(combinedSource).toContain('createInput');
    expect(combinedSource).toContain('createDefaultDependencies');
    expect(combinedSource).toContain('runEncodeDecodeBack');
    expect(combinedSource).toContain('runEncodeDecodeBackSmoke');
    expect(combinedSource).toContain('dependencies.encodeBitmap');
    expect(combinedSource).toContain('dependencies.muxEncodedSamples');
    expect(combinedSource).toContain('dependencies.validateFile');
    expect(combinedSource).toContain('decodeBackValid=$decodeBackValid');
    expect(combinedSource).toContain('decodedWidth=${decodedWidth?.toString() ?: "null"}');
    expect(combinedSource).toContain('MediaCodec.createByCodecName');
    expect(combinedSource).toContain('MediaCodec.CONFIGURE_FLAG_ENCODE');
    expect(combinedSource).toContain('getInputImage');
    expect(combinedSource).toContain('queueInputBuffer');
    expect(combinedSource).toContain('dequeueOutputBuffer');
    expect(combinedSource).toContain('MediaMuxer.OutputFormat.MUXER_OUTPUT_HEIF');
    expect(combinedSource).toContain('ImageDecoder.decodeBitmap');
    expect(combinedSource).toContain('rnick-avif-output-smoke');
    expect(combinedSource).toContain('ftyp avif/avis signature');
    expect(combinedSource).toContain(
      'Decode the result with ImageDecoder and assert dimensions match the processed bitmap.'
    );
    expect(combinedTestSource).toContain(
      'imageAvifMediaFormatUsesStillImageMimeAndFlexibleYuvInput'
    );
    expect(combinedTestSource).toContain(
      'inspectRouteFindsInjectedImageEncoderButKeepsProductionGateClosed'
    );
    expect(combinedTestSource).toContain(
      'inspectRouteBelowApi34DoesNotProbeEncoderAndReportsSdkBlocker'
    );
    expect(combinedTestSource).toContain('avifSignatureRecognizesFtypAvifOrAvisBrandOnly');
    expect(combinedTestSource).toContain('smokeBelowApi34ReportsSdkBlockerWithoutAttempting');
    expect(combinedTestSource).toContain(
      'smokeOnApi34WithoutImageEncoderReportsBlockerWithoutAttempting'
    );
    expect(combinedTestSource).toContain(
      'smokeValidationClassifiesInvalidSignatureAndDecodeBackFailures'
    );
    expect(combinedTestSource).toContain(
      'codecFailureBlockerKeepsStableProductionDecisionMessage'
    );
    expect(combinedTestSource).toContain(
      'helperInputPreservesRouteReportAndProductionHelperBoundary'
    );
    expect(combinedTestSource).toContain(
      'helperBelowApi34ReportsSdkBlockerWithoutAttemptingCodec'
    );
    expect(combinedTestSource).toContain(
      'helperWithoutImageEncoderReportsStableNoEncoderBlocker'
    );
    expect(combinedTestSource).toContain(
      'helperUsesInjectedEncoderMuxerAndValidatorForInvalidSignatureBlocker'
    );
    expect(combinedTestSource).toContain(
      'helperUsesInjectedMuxedDecodeBackSuccessForPassedSmokeContract'
    );
    expect(combinedTestSource).toContain(
      'helperUsesInjectedDirectDecodeBackSuccessAndSkipsMuxer'
    );
    expect(combinedTestSource).toContain(
      'helperUsesInjectedValidatorForDecodeBackFailureBlocker'
    );
    expect(combinedTestSource).toContain(
      'helperUsesInjectedEncoderFailureForCodecFailureResult'
    );
    expect(combinedTestSource).toContain(
      'helperClassifiesValidationAndCodecFailuresWithProductionDecisionBlockers'
    );
    expect(combinedTestSource).toContain('assertValidationResultDetailsOrder');
    expect(combinedTestSource).toContain('assertBlockedResultDetailsOrder');
    expect(combinedTestSource).toContain('assertSmokeBlockedDetailsOrder');
    expect(combinedTestSource).toContain('validationProvenanceDetail');
    expect(combinedTestSource).toContain('"Direct validation"');
    expect(combinedTestSource).toContain('"Muxed validation"');
    expect(combinedTestSource).toContain('outputFiles.getValue("direct")');
    expect(combinedTestSource).toContain('outputFiles.getValue("muxed")');
    expect(combinedTestSource).toContain(
      'assertEquals(muxedFile.absolutePath, result.outputFilePath)'
    );
    expect(combinedTestSource).toContain(
      'assertFalse(result.outputFilePath == directFile.absolutePath)'
    );
    expect(combinedTestSource).toContain('assertFalse(outputFiles.containsKey("muxed"))');
    expect(combinedTestSource).toContain('assertEquals(muxedFile.length(), result.byteSize)');
  });

  it('verifies the Android module supports file and content JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF sources', () => {
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );

    expect(moduleSource).toContain('"file" ->');
    expect(moduleSource).toContain('"content" ->');
    expect(moduleSource).toContain('reactContext.contentResolver.openInputStream');
    expect(moduleSource).toContain('OpenableColumns.SIZE');
    expect(moduleSource).toContain('BitmapFactory.decodeStream');
    expect(moduleSource).toContain('ImageDecoder.decodeBitmap');
    expect(moduleSource).toContain('createImageDecoderSource(inputSource)');
    expect(moduleSource).toContain('decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE');
    expect(moduleSource).toContain('InputFormat.fromMimeType(bounds?.mimeType) ?: inputFormatHint');
    expect(moduleSource).toContain('readInputFormatHint(inputSource)');
    expect(moduleSource).toContain('readUnsupportedInputMimeTypeHint(inputSource)');
    expect(moduleSource).toContain('queryContentMimeType(inputSource.uri)');
    expect(moduleSource).toContain('usesAvifDecodePath');
    expect(moduleSource).toContain('InputFormat.fromFileExtension(fileExtension)');
    expect(moduleSource).toContain('Build.VERSION.SDK_INT >= Build.VERSION_CODES.P');
    expect(moduleSource).toContain('Build.VERSION.SDK_INT >= Build.VERSION_CODES.O');
    expect(moduleSource).toContain('Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE');
    expect(moduleSource).toContain('decodeHeicHeifBitmapWithImageDecoder');
    expect(moduleSource).toContain('decodeAvifBitmapWithImageDecoder');
    expect(moduleSource).toContain('decodeBitmapFactory(inputSource)');
    expect(moduleSource).toContain('mimeType = "image/jpeg"');
    expect(moduleSource).toContain('mimeType = "image/png"');
    expect(moduleSource).toContain('mimeType = "image/webp"');
    expect(moduleSource).toContain('mimeType = "image/heic"');
    expect(moduleSource).toContain('mimeType = "image/heif"');
    expect(moduleSource).toContain('mimeType = "image/avif"');
    expect(moduleSource).toContain('mimeType = "image/gif"');
    expect(moduleSource).toContain(
      'Android MVP supports JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input only.'
    );
    expect(moduleSource).toContain('createCompressionResult(');
    expect(moduleSource).toContain('outputFormat');
    expect(moduleSource).not.toContain('BitmapFactory.decodeFile');
  });

  it('verifies the iOS native module implements the JPEG/PNG/GIF/WebP/HEIC/HEIF MVP path', () => {
    const iosSource = readProjectFile('ios/RCTImageCompressionKit.mm');
    const podspecSource = readProjectFile(
      'react-native-image-compression-kit.podspec'
    );

    expect(iosSource).toContain('#import <ImageIO/ImageIO.h>');
    expect(iosSource).toContain('#import <UIKit/UIKit.h>');
    expect(iosSource).toContain(
      'RCTImageCompressionKitUnsupportedFormatCode = @"ERR_UNSUPPORTED_FORMAT"'
    );
    expect(iosSource).toContain(
      'RCTImageCompressionKitNotImplementedCode = @"ERR_NOT_IMPLEMENTED"'
    );
    expect(iosSource).toContain('RCTImageCompressionKitJpegFormat = @"jpeg"');
    expect(iosSource).toContain('RCTImageCompressionKitPngFormat = @"png"');
    expect(iosSource).toContain('RCTImageCompressionKitWebPFormat = @"webp"');
    expect(iosSource).toContain('RCTImageCompressionKitGifFormat = @"gif"');
    expect(iosSource).toContain('RCTImageCompressionKitHeicFormat = @"heic"');
    expect(iosSource).toContain('RCTImageCompressionKitHeifFormat = @"heif"');
    expect(iosSource).toContain('RCTImageCompressionKitAvifFormat = @"avif"');
    expect(iosSource).toContain(
      'RCTImageCompressionKitDefaultMetadataPolicy = @"safe"'
    );
    expect(iosSource).toContain(
      'RCTImageCompressionKitStripMetadataPolicy = @"strip"'
    );
    expect(iosSource).toContain(
      'RCTImageCompressionKitPreserveMetadataPolicy = @"preserve"'
    );
    expect(iosSource).toContain(
      'iOS MVP supports JPEG input and JPEG output through UIKit/ImageIO.'
    );
    expect(iosSource).toContain(
      'Metadata preserve copies source JPEG metadata and normalizes output orientation/dimensions for JPEG input to JPEG output.'
    );
    expect(iosSource).toContain(
      'Metadata safe and strip re-encode without copying source metadata.'
    );
    expect(iosSource).toContain(
      'Non-JPEG input or non-JPEG output rejects metadata preserve with ERR_NOT_IMPLEMENTED.'
    );
    expect(iosSource).toContain(
      'iOS MVP supports PNG input and PNG output through UIKit/ImageIO.'
    );
    expect(iosSource).toContain(
      'PNG output preserves alpha where the processed image contains transparency.'
    );
    expect(iosSource).toContain(
      'PNG output ignores quality and does not support target-size maxBytes.'
    );
    expect(iosSource).toContain(
      'iOS MVP decodes GIF input as a static first frame through ImageIO.'
    );
    expect(iosSource).toContain(
      'GIF input can be re-encoded to JPEG or PNG output without copying source metadata.'
    );
    expect(iosSource).toContain(
      'Animated GIF preservation and GIF output are not implemented.'
    );
    expect(iosSource).toContain(
      'iOS MVP decodes WebP input as a static first frame through ImageIO.'
    );
    expect(iosSource).toContain(
      'WebP input can be re-encoded to JPEG, PNG, or WebP output without copying source metadata.'
    );
    expect(iosSource).toContain(
      'WebP output uses ImageIO CGImageDestination when the runtime advertises a WebP destination type.'
    );
    expect(iosSource).toContain(
      'Runtime-available WebP output supports target-size maxBytes by adjusting WebP quality.'
    );
    expect(iosSource).toContain(
      'Animated WebP preservation is not implemented.'
    );
    expect(iosSource).toContain(
      'iOS MVP decodes %@ input as a static image through ImageIO.'
    );
    expect(iosSource).toContain(
      '%@ input can be re-encoded to JPEG or PNG output without copying source metadata.'
    );
    expect(iosSource).toContain(
      '%@ input can also be re-encoded to runtime-available WebP output.'
    );
    expect(iosSource).toContain(
      '%@ output is not implemented.'
    );
    expect(iosSource).toContain(
      'This runtime advertises ImageIO AVIF source support, so iOS MVP decodes AVIF input as a static image through ImageIO.'
    );
    expect(iosSource).toContain(
      'This runtime does not advertise ImageIO AVIF source support, so AVIF input rejects with ERR_UNSUPPORTED_FORMAT.'
    );
    expect(iosSource).toContain(
      'Call getImageCompressionCapabilities() before accepting AVIF input on iOS.'
    );
    expect(iosSource).toContain(
      'AVIF input can be re-encoded to JPEG or PNG output without copying source metadata.'
    );
    expect(iosSource).toContain(
      'AVIF input can also be re-encoded to runtime-available WebP output.'
    );
    expect(iosSource).toContain(
      'Animated AVIF preservation is not implemented.'
    );
    expect(iosSource).toContain(
      'AVIF output is not implemented.'
    );
    expect(iosSource).toContain(
      "AVIF capability reports output=false; selecting output.format: 'avif' rejects with ERR_NOT_IMPLEMENTED."
    );
    expect(iosSource).toContain(
      'Future iOS AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation.'
    );
    expect(iosSource).toContain(
      "metadata='preserve', output.maxBytes, and animated AVIF preservation remain unsupported for AVIF output until explicitly designed and tested."
    );
    expect(iosSource).toContain(
      'iOS MVP supports JPEG, PNG, static GIF, static WebP, static HEIC, static HEIF, and runtime-available static AVIF input with JPEG, PNG, or runtime ImageIO-backed WebP output only.'
    );
    expect(iosSource).toContain(
      "iOS MVP supports AVIF input when ImageIO source decoding is available, but AVIF output is not implemented. Supported output formats are JPEG, PNG, and runtime-available WebP. Future AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation; metadata='preserve', output.maxBytes, and animated AVIF preservation remain unsupported for AVIF output. output.format: 'avif' rejects with ERR_NOT_IMPLEMENTED."
    );
    expect(iosSource).toContain(
      'iOS MVP supports JPEG, PNG, and runtime-available WebP output only. HEIC and HEIF output are not implemented. Call getImageCompressionCapabilities() before selecting a platform output format.'
    );
    expect(iosSource).toContain(
      'iOS MVP requires ImageIO WebP destination support for WebP output on this runtime.'
    );
    expect(iosSource).toContain(
      'iOS MVP supports output.maxBytes for JPEG and runtime-available WebP output only.'
    );
    expect(iosSource).toContain('RCTImageCompressionKitReadMaxBytes');
    expect(iosSource).toContain(
      'Compression output.maxBytes must be a positive integer.'
    );
    expect(iosSource).toContain('RCTImageCompressionKitEncodeToTargetSize');
    expect(iosSource).toContain('RCTImageCompressionKitEncodeQualityOutput');
    expect(iosSource).toContain('bestWithinTargetData');
    expect(iosSource).toContain('RCTImageCompressionKitWebPOutputTypeIdentifier');
    expect(iosSource).toContain('RCTImageCompressionKitCanEncodeWebP');
    expect(iosSource).toContain('CGImageDestinationCopyTypeIdentifiers');
    expect(iosSource).toContain('CGImageDestinationCreateWithData');
    expect(iosSource).toContain('CGImageDestinationAddImage');
    expect(iosSource).toContain('CGImageDestinationFinalize');
    expect(iosSource).toContain('kCGImageDestinationLossyCompressionQuality');
    expect(iosSource).toContain('kCGImagePropertyPixelWidth');
    expect(iosSource).toContain('kCGImagePropertyPixelHeight');
    expect(iosSource).toContain('kCGImagePropertyOrientation');
    expect(iosSource).toContain('kCGImagePropertyTIFFOrientation');
    expect(iosSource).toContain('kCGImagePropertyExifDictionary');
    expect(iosSource).toContain('kCGImagePropertyExifPixelXDimension');
    expect(iosSource).toContain('kCGImagePropertyExifPixelYDimension');
    expect(iosSource).toContain('RCTImageCompressionKitSourceImageProperties');
    expect(iosSource).toContain('RCTImageCompressionKitJpegDestinationProperties');
    expect(iosSource).toContain('CGImageGetWidth(cgImage)');
    expect(iosSource).toContain('CGImageGetHeight(cgImage)');
    expect(iosSource).toContain('RCTImageCompressionKitEncodeWebP');
    expect(iosSource).toContain(
      'iOS metadata preserve is supported only for JPEG input to JPEG output. Use safe or strip metadata for other iOS format conversions.'
    );
    expect(iosSource).toContain(
      'Compression output.quality must be an integer from 0 to 100.'
    );
    expect(iosSource).toContain(
      'Compression resize.mode must be one of: contain, cover, stretch.'
    );
    expect(iosSource).toContain(
      'iOS MVP supports file:// and content:// image URIs only.'
    );
    expect(iosSource).toContain('iOS MVP could not read the source image URI.');
    expect(iosSource).toContain(
      'iOS AVIF input requires runtime ImageIO AVIF source support.'
    );
    expect(iosSource).toContain(
      'iOS MVP supports JPEG, PNG, GIF, WebP, HEIC, HEIF, and runtime-available AVIF input only. GIF, WebP, HEIC, HEIF, and AVIF input are decoded as static images through ImageIO.'
    );
    expect(iosSource).toContain('iOS MVP could not decode the source image.');
    expect(iosSource).toContain('iOS MVP could not encode %@ output.');
    expect(iosSource).toContain('CGImageSourceCreateWithData');
    expect(iosSource).toContain('CGImageSourceCreateImageAtIndex');
    expect(iosSource).toContain('RCTImageCompressionKitDecodeImage');
    expect(iosSource).toContain('RCTImageCompressionKitIsGifType');
    expect(iosSource).toContain('RCTImageCompressionKitIsWebPType');
    expect(iosSource).toContain('RCTImageCompressionKitIsHeicType');
    expect(iosSource).toContain('RCTImageCompressionKitIsHeifType');
    expect(iosSource).toContain('RCTImageCompressionKitIsHeicHeifType');
    expect(iosSource).toContain('RCTImageCompressionKitAvifTypeIdentifiers');
    expect(iosSource).toContain('RCTImageCompressionKitIsAvifType');
    expect(iosSource).toContain('RCTImageCompressionKitAvailableImageSourceTypeIdentifier');
    expect(iosSource).toContain('RCTImageCompressionKitCanDecodeAVIF');
    expect(iosSource).toContain('CGImageSourceCopyTypeIdentifiers');
    expect(iosSource).toContain('RCTImageCompressionKitLooksLikeAVIFData');
    expect(iosSource).toContain('RCTImageCompressionKitShouldDecodeFirstFrame');
    expect(iosSource).toContain('com.compuserve.gif');
    expect(iosSource).toContain('public.gif');
    expect(iosSource).toContain('org.webmproject.webp');
    expect(iosSource).toContain('public.webp');
    expect(iosSource).toContain('public.heic');
    expect(iosSource).toContain('public.heics');
    expect(iosSource).toContain('org.iso.heic');
    expect(iosSource).toContain('org.iso.heics');
    expect(iosSource).toContain('public.heif');
    expect(iosSource).toContain('public.heifs');
    expect(iosSource).toContain('org.iso.heif');
    expect(iosSource).toContain('org.iso.heifs');
    expect(iosSource).toContain('public.avif');
    expect(iosSource).toContain('public.avifs');
    expect(iosSource).toContain('org.aomedia.avif');
    expect(iosSource).toContain('org.aomedia.avifs');
    expect(iosSource).toContain('ftyp');
    expect(iosSource).toContain('avis');
    expect(iosSource).toContain('UIImage imageWithData');
    expect(iosSource).toContain('RCTImageCompressionKitEncodeJpeg');
    expect(iosSource).toContain('UIImagePNGRepresentation');
    expect(iosSource).toContain('UIGraphicsImageRenderer');
    expect(iosSource).toContain('NSCachesDirectory');
    expect(iosSource).toContain('RCTImageCompressionKitRenderImage');
    expect(iosSource).toContain('RCTImageCompressionKitResizeModeContain');
    expect(iosSource).toContain('RCTImageCompressionKitResizeModeCover');
    expect(iosSource).toContain('RCTImageCompressionKitResizeModeStretch');
    expect(iosSource).toContain('RCTImageCompressionKitReadSourceData');
    expect(iosSource).toContain('RCTImageCompressionKitIsSupportedInputType');
    expect(iosSource).toContain('@"metadataPolicies" : @[');
    expect(iosSource).toContain('@"supportsTargetSizeCompression" : @YES');
    expect(iosSource).toContain('@"supportsCancellation" : @NO');
    expect(podspecSource).toContain('s.platforms = { :ios => "13.4" }');
    expect(podspecSource).toContain('s.source_files = "ios/**/*.{h,m,mm}"');
  });

  it('verifies the Android module applies EXIF orientation before resize', () => {
    const gradleSource = readProjectFile('android/build.gradle');
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );

    expect(gradleSource).toContain(
      'androidx.exifinterface:exifinterface:1.4.2'
    );
    expect(moduleSource).toContain('readExifOrientation(inputSource)');
    expect(moduleSource).toContain('ExifInterface.TAG_ORIENTATION');
    expect(moduleSource).toContain(
      'applyExifOrientation(bitmap, exifOrientation)'
    );
    expect(
      moduleSource.indexOf('applyExifOrientation(bitmap, exifOrientation)')
    ).toBeLessThan(moduleSource.indexOf('resizeBitmap(orientedBitmap, resize)'));
    expect(moduleSource).toContain('Matrix');
    expect(moduleSource).toContain('ExifInterface.ORIENTATION_ROTATE_90');
    expect(moduleSource).toContain('ExifInterface.ORIENTATION_TRANSVERSE');
    expect(moduleSource).toContain('ExifInterface.ORIENTATION_NORMAL');
  });

  it('verifies the Android module implements JPEG resize modes', () => {
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );

    expect(moduleSource).toContain('readResizeOptions');
    expect(moduleSource).toContain('resizeBitmap(orientedBitmap, resize)');
    expect(moduleSource).toContain('ResizeMode.CONTAIN');
    expect(moduleSource).toContain('ResizeMode.COVER');
    expect(moduleSource).toContain('ResizeMode.STRETCH');
    expect(moduleSource).toContain('Bitmap.createScaledBitmap');
    expect(moduleSource).toContain('centerCropBitmap');
    expect(moduleSource).toContain('outputDimensions');
    expect(moduleSource).not.toContain('does not implement resize yet');
  });

  it('verifies the Android module implements JPEG target-size compression', () => {
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );
    const outputSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionOutput.kt'
    );
    const combinedSource = `${moduleSource}\n${outputSource}`;

    expect(moduleSource).toContain('readMaxBytes(output)');
    expect(moduleSource).toContain('output.maxBytes must be a positive integer');
    expect(moduleSource).toContain('didEncode = ImageCompressionOutput.encodeBitmap(');
    expect(moduleSource).toContain('maxBytes,');
    expect(moduleSource).toContain('copiedExifMetadata');
    expect(combinedSource).toContain('encodeBitmapToTargetSize');
    expect(combinedSource).toContain('bestWithinTargetQuality');
    expect(moduleSource).toContain('supportsTargetSizeCompression", true');
    expect(combinedSource).toContain(
      'supports output.maxBytes for JPEG and WebP output only'
    );
    expect(moduleSource).not.toContain('does not implement target-size compression yet');
  });

  it('verifies the Android module implements PNG and WebP output encoding', () => {
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );
    const outputSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionOutput.kt'
    );
    const combinedSource = `${moduleSource}\n${outputSource}`;

    expect(combinedSource).toContain('ImageCompressionOutput.createOutputFile');
    expect(combinedSource).toContain('ImageCompressionOutput.createResultMetadata');
    expect(combinedSource).toContain('ImageCompressionOutput.maxBytesValidationError');
    expect(combinedSource).toContain('OutputFormat.fromValue');
    expect(combinedSource).toContain('PNG_FORMAT');
    expect(combinedSource).toContain('WEBP_FORMAT');
    expect(combinedSource).toContain('Bitmap.CompressFormat.PNG');
    expect(combinedSource).toContain('Bitmap.CompressFormat.WEBP_LOSSY');
    expect(combinedSource).toContain('Bitmap.CompressFormat.WEBP');
    expect(combinedSource).toContain('outputFormat.fileExtension');
    expect(combinedSource).toContain('format = outputFormat.value');
    expect(combinedSource).toContain('pngFormatNotes');
    expect(combinedSource).toContain('webpFormatNotes');
    expect(combinedSource).toContain('gifFormatNotes');
    expect(combinedSource).toContain('heicHeifFormatNotes');
    expect(combinedSource).toContain('avifFormatNotes');
    expect(combinedSource).toContain('SUPPORTED_INPUT_FORMATS');
    expect(combinedSource).toContain('HEIC_FORMAT');
    expect(combinedSource).toContain('HEIF_FORMAT');
    expect(combinedSource).toContain('AVIF_FORMAT');
    expect(combinedSource).toContain('output = outputFormat != null');
    expect(combinedSource).toContain('Non-JPEG output does not preserve source EXIF metadata.');
    expect(combinedSource).toContain(
      'Android MVP supports HEIC, HEIF, and AVIF input, but HEIC, HEIF, and AVIF output are not implemented. Supported output formats are JPEG, PNG, and WebP; selecting heic, heif, or avif output rejects with ERR_NOT_IMPLEMENTED. AVIF output remains disabled by the production wiring scaffold until the extracted Android AVIF output encode/decode-back helper produces a complete AVIF file and metadata preserve, output.maxBytes, and animated AVIF boundaries are explicitly validated.'
    );
    expect(combinedSource).not.toContain('PNG and WebP input remain planned.');
  });

  it('verifies the Android module handles JPEG metadata policies explicitly', () => {
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );
    const metadataSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/JpegExifMetadata.kt'
    );
    const outputSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionOutput.kt'
    );
    const combinedSource = `${moduleSource}\n${metadataSource}\n${outputSource}`;

    expect(combinedSource).toContain('readMetadataPolicy(options)');
    expect(combinedSource).toContain('MetadataPolicy.SAFE');
    expect(combinedSource).toContain('MetadataPolicy.STRIP');
    expect(combinedSource).toContain('MetadataPolicy.PRESERVE');
    expect(combinedSource).toContain('createCopiedExifMetadata');
    expect(combinedSource).toContain('JpegExifMetadata.read');
    expect(combinedSource).toContain('JpegExifMetadata.write');
    expect(combinedSource).toContain('SAFE_EXIF_TAGS');
    expect(combinedSource).toContain('PRESERVED_EXIF_TAGS');
    expect(combinedSource).toContain('outputExif.setAttribute(');
    expect(combinedSource).toContain('ExifInterface.TAG_ORIENTATION');
    expect(combinedSource).toContain('ExifInterface.ORIENTATION_NORMAL.toString()');
    expect(combinedSource).toContain('ExifInterface.TAG_PIXEL_X_DIMENSION');
    expect(combinedSource).toContain('ExifInterface.TAG_PIXEL_Y_DIMENSION');
    expect(combinedSource).toContain('pushString(METADATA_POLICY_PRESERVE)');
    expect(combinedSource).toContain('pushString(METADATA_POLICY_SAFE)');
    expect(combinedSource).toContain('pushString(METADATA_POLICY_STRIP)');
    expect(combinedSource).not.toContain('does not implement metadata preservation yet');
    expect(combinedSource).toContain('without preserving source metadata');
    expect(combinedSource).toContain(
      'PNG, WebP, GIF, HEIC, HEIF, and AVIF sources are decoded without copying EXIF metadata.'
    );
    expect(combinedSource).toContain('heicHeifFormatNotes("HEIC")');
    expect(combinedSource).toContain('heicHeifFormatNotes("HEIF")');
    expect(combinedSource).toContain(
      '$formatLabel input is supported on Android 8.0+ when device HEIF decode codecs are present.'
    );
    expect(combinedSource).toContain(
      'Android API 28+ uses ImageDecoder for $formatLabel input.'
    );
    expect(combinedSource).toContain(
      'Android API 26-27 attempts a guarded BitmapFactory HEIF decode fallback.'
    );
    expect(combinedSource).toContain(
      '$formatLabel inputs are decoded without copying EXIF metadata.'
    );
    expect(combinedSource).toContain('$formatLabel output is not implemented.');
    expect(combinedSource).toContain(
      'AVIF input is supported on Android 14+ for baseline still images.'
    );
    expect(combinedSource).toContain('Android API 34+ uses ImageDecoder for AVIF input.');
    expect(combinedSource).toContain('AVIF inputs are decoded without copying EXIF metadata.');
    expect(combinedSource).toContain('AVIF output is not implemented.');
    expect(combinedSource).toContain(
      "AVIF capability reports output=false; selecting output.format: 'avif' rejects with ERR_NOT_IMPLEMENTED."
    );
    expect(combinedSource).toContain(
      'Android AVIF output production wiring scaffold blocks entry into the extracted encode/decode-back helper while capability output=false.'
    );
    expect(combinedSource).toContain(
      'Android AVIF output remains disabled until the MediaCodec image/avif encode/decode-back smoke produces a complete AVIF file with ftyp avif/avis signature and ImageDecoder decode-back validation.'
    );
    expect(combinedSource).toContain(
      "metadata='preserve', output.maxBytes, and animated AVIF preservation remain unsupported for AVIF output until explicitly designed and tested."
    );
    expect(combinedSource).toContain('UNSUPPORTED_OUTPUT_FORMAT_MESSAGE');
    expect(combinedSource).toContain(
      'Android MVP supports HEIC, HEIF, and AVIF input, but HEIC, HEIF, and AVIF output are not implemented. Supported output formats are JPEG, PNG, and WebP; selecting heic, heif, or avif output rejects with ERR_NOT_IMPLEMENTED. AVIF output remains disabled by the production wiring scaffold until the extracted Android AVIF output encode/decode-back helper produces a complete AVIF file and metadata preserve, output.maxBytes, and animated AVIF boundaries are explicitly validated.'
    );
    expect(combinedSource).toContain(
      'Android MVP decodes GIF file:// and content:// sources as a static first frame.'
    );
    expect(combinedSource).toContain('Animated GIF preservation is not implemented.');
    expect(combinedSource).toContain('GIF output is not implemented.');
  });

  it('verifies the Android module uses a privacy-filtered safe metadata allowlist', () => {
    const metadataSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/JpegExifMetadata.kt'
    );
    const moduleSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt'
    );
    const outputSource = readProjectFile(
      'android/src/main/java/com/imagecompressionkit/ImageCompressionOutput.kt'
    );
    const combinedSource = `${moduleSource}\n${outputSource}`;
    const safeExifTags = extractKotlinArray(metadataSource, 'SAFE_EXIF_TAGS');
    const preservedExifTags = extractKotlinArray(
      metadataSource,
      'PRESERVED_EXIF_TAGS'
    );

    [
      'ExifInterface.TAG_MAKE',
      'ExifInterface.TAG_MODEL',
      'ExifInterface.TAG_DATETIME_ORIGINAL',
      'ExifInterface.TAG_EXPOSURE_TIME',
      'ExifInterface.TAG_F_NUMBER',
      'ExifInterface.TAG_LENS_MODEL',
    ].forEach((tag) => {
      expect(safeExifTags).toContain(tag);
    });

    [
      'ExifInterface.TAG_GPS_LATITUDE',
      'ExifInterface.TAG_GPS_LONGITUDE',
      'ExifInterface.TAG_CAMERA_OWNER_NAME',
      'ExifInterface.TAG_BODY_SERIAL_NUMBER',
      'ExifInterface.TAG_LENS_SERIAL_NUMBER',
      'ExifInterface.TAG_MAKER_NOTE',
      'ExifInterface.TAG_USER_COMMENT',
      'ExifInterface.TAG_XMP',
    ].forEach((tag) => {
      expect(safeExifTags).not.toContain(tag);
      expect(preservedExifTags).toContain(tag);
    });

    expect(combinedSource).toContain(
      'Metadata safe copies privacy-filtered JPEG source EXIF attributes.'
    );
    expect(combinedSource).toContain(
      'Metadata safe excludes GPS/location, owner/serial, maker note, user comment, and XMP.'
    );
  });

  it('verifies the Android metadata policy runtime unit test exists', () => {
    const gradleSource = readProjectFile('android/build.gradle');
    const testSource = readProjectFile(
      'android/src/test/java/com/imagecompressionkit/JpegExifMetadataTest.kt'
    );

    expect(gradleSource).toContain('testImplementation "junit:junit:4.13.2"');
    expect(gradleSource).toContain('unitTests.returnDefaultValues = true');
    expect(gradleSource).toContain('unitTests.includeAndroidResources = true');
    expect(gradleSource).toContain(
      'testImplementation "org.robolectric:robolectric:4.16.1"'
    );
    expect(testSource).toContain(
      'safeMetadataCopiesAllowlistedExifAndFiltersSensitiveTags'
    );
    expect(testSource).toContain(
      'preserveMetadataCopiesSensitiveExifButNormalizesOutputGeometry'
    );
    expect(testSource).toContain('nullMetadataLeavesOutputExifUntouchedForStripPolicy');
    expect(testSource).toContain('Base64.getMimeDecoder().decode(SAMPLE_JPEG_BASE64)');
    expect(testSource).toContain('RobolectricTestRunner');
    expect(testSource).toContain('JpegExifMetadata.write(metadata, outputFile)');
    expect(testSource).toContain('ExifInterface.TAG_GPS_LATITUDE');
    expect(testSource).toContain('ExifInterface.ORIENTATION_NORMAL');
  });

  it('verifies the Android output format runtime unit test exists', () => {
    const testSource = readProjectFile(
      'android/src/test/java/com/imagecompressionkit/ImageCompressionOutputTest.kt'
    );

    expect(testSource).toContain(
      'outputFormatsCreateMatchingResultFormatAndFileExtensions'
    );
    expect(testSource).toContain(
      'encodedOutputsContainExpectedByteSignaturesAndResultMetadataMatchesFile'
    );
    expect(testSource).toContain(
      'capabilitiesExposeJpegPngWebpGifHeicHeifAvifInputsAndJpegPngWebpOutputsOnly'
    );
    expect(testSource).toContain('assertHeicHeifCapabilityNotes');
    expect(testSource).toContain('assertAvifCapabilityNotes');
    expect(testSource).toContain('pngRejectsMaxBytesButWebpAndJpegAllowIt');
    expect(testSource).toContain(
      'outputFormatsMapToAndroidCompressFormatsAndQualityRules'
    );
    expect(testSource).toContain('OutputFormat.JPEG to ".jpg"');
    expect(testSource).toContain('OutputFormat.PNG to ".png"');
    expect(testSource).toContain('OutputFormat.WEBP to ".webp"');
    expect(testSource).toContain('ImageCompressionOutput.encodeBitmap');
    expect(testSource).toContain('BitmapFactory.decodeByteArray');
    expect(testSource).toContain('GraphicsMode.Mode.NATIVE');
    expect(testSource).toContain('assertPngSignature');
    expect(testSource).toContain('assertWebpSignature');
    expect(testSource).toContain('"RIFF"');
    expect(testSource).toContain('"WEBP"');
    expect(testSource).toContain('Bitmap.CompressFormat.WEBP_LOSSY');
    expect(testSource).toContain('ImageCompressionOutput.MAX_BYTES_UNSUPPORTED_MESSAGE');
    expect(testSource).toContain('RobolectricTestRunner');
  });

  it('verifies the Android module-level compression integration test exists', () => {
    const testSource = readProjectFile(
      'android/src/test/java/com/imagecompressionkit/ImageCompressionKitModuleTest.kt'
    );

    expect(testSource).toContain(
      'compressImageCreatesJpegPngAndWebpOutputsWithExpectedResultMetadata'
    );
    expect(testSource).toContain('compressImageRejectsPngMaxBytesAtModuleBoundary');
    expect(testSource).toContain(
      'compressImageAppliesExifOrientationBeforeResizeModesAndNormalizesOutputExif'
    );
    expect(testSource).toContain(
      'compressImageReadsContentUriJpegLikeFileUriAndReportsMetadata'
    );
    expect(testSource).toContain(
      'compressImageRejectsUnreadableContentUriAtModuleBoundary'
    );
    expect(testSource).toContain(
      'compressImageRejectsAvifFileBeforeAndroidU'
    );
    expect(testSource).toContain(
      'compressImageRejectsAvifContentMimeBeforeAndroidU'
    );
    expect(testSource).toContain(
      'compressImageTreatsHeicAndHeifSourcesAsDecodeCandidatesOnSupportedSdk'
    );
    expect(testSource).toContain(
      'compressImageTreatsAvifSourcesAsDecodeCandidatesOnSupportedSdk'
    );
    expect(testSource).toContain('compressImageRejectsHeicAndHeifBeforeAndroidO');
    expect(testSource).toContain(
      'compressImageSeparatesSupportedFormatDecodeFailures'
    );
    expect(testSource).toContain(
      'compressImageAcceptsGifFileAndContentSourcesAsStaticFrameWithAllImplementedOutputs'
    );
    expect(testSource).toContain('compressImageResizesGifSourceAcrossModes');
    expect(testSource).toContain(
      'compressImageHonorsJpegAndWebpMaxBytesForGifSource'
    );
    expect(testSource).toContain('compressImageIgnoresMetadataPoliciesForGifSource');
    expect(testSource).toContain(
      'compressImageAcceptsPngAndWebpFileAndContentSourcesWithAllImplementedOutputs'
    );
    expect(testSource).toContain(
      'compressImageResizesPngAndWebpSourcesAcrossModes'
    );
    expect(testSource).toContain(
      'compressImageHonorsJpegAndWebpMaxBytesForPngAndWebpSources'
    );
    expect(testSource).toContain(
      'compressImageIgnoresMetadataPoliciesForPngAndWebpSources'
    );
    expect(testSource).toContain(
      'compressImageHonorsJpegAndWebpMaxBytesAndReportsFileMetadata'
    );
    expect(testSource).toContain(
      'compressImageFallsBackWhenMaxBytesIsTooSmallAndReportsConsistentMetadata'
    );
    expect(testSource).toContain('ImageCompressionKitModule(');
    expect(testSource).toContain('module.compressImage(');
    expect(testSource).toContain('JavaOnlyMap.of');
    expect(testSource).toContain('RecordingPromise');
    expect(testSource).toContain('Uri.fromFile(sourceFile).toString()');
    expect(testSource).toContain('org.robolectric.Shadows.shadowOf');
    expect(testSource).toContain('registerInputStreamSupplier');
    expect(testSource).toContain('ByteArrayInputStream');
    expect(testSource).toContain('sourceUri = contentUri.toString()');
    expect(testSource).toContain('assertResultMetadataMatchesBytes');
    expect(testSource).toContain('UnsupportedSourceCase');
    expect(testSource).toContain('TestMimeTypeContentProvider');
    expect(testSource).toContain('ShadowContentResolver.registerProviderInternal');
    expect(testSource).toContain('createSampleGifFile');
    expect(testSource).toContain('SAMPLE_GIF_BASE64');
    expect(testSource).toContain('Base64.getMimeDecoder().decode');
    expect(testSource).toContain('assertTopLeftPixelNear');
    expect(testSource).toContain('createEncodedImageFile');
    expect(testSource).toContain('SourceFormatCase');
    expect(testSource).toContain('assertNoCopiedExifMetadata');
    expect(testSource).toContain('metadataPolicies = listOf("preserve", "safe", "strip")');
    expect(testSource).toContain('ImageCompressionKitModule.ERR_FILE_ACCESS');
    expect(testSource).toContain('ExifInterface.ORIENTATION_ROTATE_90');
    expect(testSource).toContain('resizeOptions(');
    expect(testSource).toContain('mode = "contain"');
    expect(testSource).toContain('mode = "cover"');
    expect(testSource).toContain('mode = "stretch"');
    expect(testSource).toContain('metadata = "safe"');
    expect(testSource).toContain('assertNormalizedOutputExif');
    expect(testSource).toContain('ExifInterface.ORIENTATION_NORMAL');
    expect(testSource).toContain('ExifInterface.TAG_PIXEL_X_DIMENSION');
    expect(testSource).toContain('createPatternJpegFile');
    expect(testSource).toContain('calculateAchievableTargetBytes');
    expect(testSource).toContain('assertResultMetadataMatchesFile');
    expect(testSource).toContain('OutputFormat.JPEG');
    expect(testSource).toContain('OutputFormat.WEBP');
    expect(testSource).toContain('"maxBytes"');
    expect(testSource).toContain('ImageCompressionKitModule.ERR_INVALID_OPTIONS');
    expect(testSource).toContain('ImageCompressionOutput.MAX_BYTES_UNSUPPORTED_MESSAGE');
    expect(testSource).toContain('ImageCompressionKitModule.ERR_DECODE_FAILED');
    expect(testSource).toContain('Android MVP could not decode the source image.');
    expect(testSource).toContain('ERR_UNSUPPORTED_FORMAT');
    expect(testSource).toContain('GraphicsMode.Mode.NATIVE');
    expect(testSource).toContain('assertJpegSignature');
    expect(testSource).toContain('assertPngSignature');
    expect(testSource).toContain('assertWebpSignature');
    expect(testSource).toContain('assertGifSignature');
    expect(testSource).toContain('"RIFF"');
    expect(testSource).toContain('"WEBP"');
  });
});
