import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ECONOMIC_RESILIENCE_ASSET_FILES,
  ECONOMIC_RESILIENCE_FIXTURE,
  ECONOMIC_RESILIENCE_OPERATION,
  buildEconomicResilienceEvidence,
} from '../scripts/economic-resilience-evidence-core.mjs';
import { PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE } from '../scripts/demo-visual-agreement-core.mjs';
import {
  PUBLIC_ECONOMIC_RESILIENCE_ARTIFACT_METADATA_FILE,
  PUBLIC_ECONOMIC_RESILIENCE_CAPTURE_SET_FILE,
  PUBLIC_ECONOMIC_RESILIENCE_RUN_METADATA_FILE,
  appendPublicEconomicResilienceIndex,
  buildPublicEconomicResilienceCaptureSet,
  createEmptyPublicEconomicResilienceIndex,
  inspectPublicEconomicResilienceArchive,
  inspectPublicEconomicResilienceArtifactMetadata,
  inspectPublicEconomicResilienceCaptureSet,
  inspectPublicEconomicResilienceIndex,
  inspectPublicEconomicResilienceRunMetadata,
} from '../scripts/public-economic-resilience-evidence-core.mjs';
import { PUBLIC_ECONOMIC_RESILIENCE_NATIVE_ARTIFACT_MEMBERS } from '../scripts/public-economic-resilience-zip.mjs';

const SHA = '1'.repeat(40);
const RUN_ID = 424_242_424;
const RUN_ATTEMPT = 1;
const RUN_URL =
  `https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/${RUN_ID}`;
const SOURCE = readFileSync('example/fixtures/kit-only-12mp-v1.jpg');
const FIXTURE_MANIFEST = JSON.parse(
  readFileSync('example/fixtures/kit-only-12mp-v1.json', 'utf8')
);
const PR_RUN_METADATA_PATH = path.resolve(
  'test/fixtures/public-economic-resilience/github-run-pr-failure.json'
);
const PR_RUN_METADATA = JSON.parse(readFileSync(PR_RUN_METADATA_PATH, 'utf8'));
const IMPORTER = path.resolve('scripts/import-public-economic-resilience-evidence.mjs');
const ARCHIVE_VERIFIER = path.resolve(
  'scripts/verify-public-economic-resilience-evidence.mjs'
);
const RUN_METADATA = Object.freeze({
  event: 'workflow_dispatch',
  headBranch: 'master',
  headSha: SHA,
  conclusion: 'success',
  workflowName: 'Native Demo Evidence',
  path: '.github/workflows/demo-evidence.yml',
  runId: RUN_ID,
  attempt: RUN_ATTEMPT,
  url: RUN_URL,
});
const RUN_METADATA_BYTES = serializeJson(RUN_METADATA);
const roots = [];
let githubFixture;

beforeAll(() => {
  githubFixture = createGithubFixture();
}, 60_000);

afterAll(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

describe('public economic resilience source-tree archive', () => {
  it('accepts an absent archive or a schema-valid empty index as methodology-only state', () => {
    const parent = temporaryRoot();
    expect(
      inspectPublicEconomicResilienceArchive(path.join(parent, 'absent'))
    ).toMatchObject({
      status: 'passed',
      archiveState: 'empty',
      captureCount: 0,
    });
    const empty = path.join(parent, 'empty');
    mkdirSync(empty);
    writeJson(path.join(empty, 'index.json'), createEmptyPublicEconomicResilienceIndex());
    expect(inspectPublicEconomicResilienceArchive(empty)).toMatchObject({
      status: 'passed',
      archiveState: 'empty',
      captureCount: 0,
    });
  });

  it('binds exact run and artifact provenance while preserving the claim boundary', () => {
    const android = validEvidenceBoundary('android');
    const ios = validEvidenceBoundary('ios');
    const artifactMetadata = syntheticArtifactMetadata();
    const artifactMetadataBytes = serializeJson(artifactMetadata);
    const captureSet = buildPublicEconomicResilienceCaptureSet({
      sourceCommit: SHA,
      runMetadata: RUN_METADATA,
      runMetadataBytes: RUN_METADATA_BYTES,
      artifactMetadata,
      artifactMetadataBytes,
      androidEvidence: android,
      iosEvidence: ios,
    });
    const index = appendPublicEconomicResilienceIndex(
      createEmptyPublicEconomicResilienceIndex(),
      captureSet
    );
    expect(inspectPublicEconomicResilienceCaptureSet(captureSet, {
      androidEvidence: android,
      iosEvidence: ios,
      runMetadata: RUN_METADATA,
      runMetadataBytes: RUN_METADATA_BYTES,
      artifactMetadata,
      artifactMetadataBytes,
    })).toEqual([]);
    expect(inspectPublicEconomicResilienceIndex(index)).toEqual([]);
    expect(captureSet).toMatchObject({
      sourceCommit: SHA,
      artifactMetadata: { file: 'artifact-metadata.json' },
      workflow: {
        eventName: 'workflow_dispatch',
        headBranch: 'master',
        headSha: SHA,
        runId: RUN_ID,
      },
      claimBoundary: {
        sourceOwnership: 'source-remains',
        matchedTransferBaseline: null,
        costSavingsClaim: null,
      },
      platforms: {
        android: { artifactArchivePath: 'artifacts/android.zip' },
        ios: { artifactArchivePath: 'artifacts/ios.zip' },
      },
    });
    expect(() => appendPublicEconomicResilienceIndex(index, captureSet)).toThrow(
      `already exists for ${SHA}`
    );
  });

  it('fails closed across malformed run, artifact, index, and cross-platform inputs', () => {
    const base = {
      sourceCommit: SHA,
      runMetadata: RUN_METADATA,
      runMetadataBytes: RUN_METADATA_BYTES,
      artifactMetadata: syntheticArtifactMetadata(),
      artifactMetadataBytes: serializeJson(syntheticArtifactMetadata()),
      androidEvidence: validEvidenceBoundary('android'),
      iosEvidence: validEvidenceBoundary('ios'),
    };
    expect(() => buildPublicEconomicResilienceCaptureSet({
      ...base,
      runMetadata: { ...RUN_METADATA, event: 'pull_request' },
    })).toThrow('successful master workflow_dispatch run');
    expect(() => buildPublicEconomicResilienceCaptureSet({
      ...base,
      runMetadataBytes: null,
    })).toThrow('run metadata bytes are required');
    expect(() => buildPublicEconomicResilienceCaptureSet({
      ...base,
      artifactMetadata: {},
    })).toThrow('artifact metadata');
    expect(() => buildPublicEconomicResilienceCaptureSet({
      ...base,
      artifactMetadataBytes: null,
    })).toThrow('artifact metadata bytes are required');
    expect(() => buildPublicEconomicResilienceCaptureSet({
      ...base,
      iosEvidence: { ...base.iosEvidence, runAttempt: 2 },
    })).toThrow('ios run identity differs');

    expect(inspectPublicEconomicResilienceRunMetadata({
      ...RUN_METADATA,
      extra: true,
    })).toContain('public economic resilience run metadata fields drifted');
    expect(inspectPublicEconomicResilienceArtifactMetadata({}, {
      runMetadata: RUN_METADATA,
    })).toEqual([
      'public economic resilience artifact metadata fields drifted',
      'public economic resilience artifact metadata run identity is invalid',
      'public economic resilience artifact metadata must contain two artifacts',
    ]);
    const malformedArtifacts = syntheticArtifactMetadata();
    malformedArtifacts.artifacts[0].extra = true;
    malformedArtifacts.artifacts[1].expired = true;
    expect(inspectPublicEconomicResilienceArtifactMetadata(malformedArtifacts, {
      runMetadata: RUN_METADATA,
    }).join(' | ')).toContain('artifact fields drifted');
    expect(inspectPublicEconomicResilienceArtifactMetadata(malformedArtifacts, {
      runMetadata: RUN_METADATA,
    }).join(' | ')).toContain('artifact identity is invalid');
    expect(inspectPublicEconomicResilienceIndex({})).toEqual([
      'public economic resilience index fields drifted',
      'public economic resilience index schemaVersion is invalid',
      'public economic resilience archive identity drifted',
      'public economic resilience index captures must be an array',
    ]);
    const validCapture = buildPublicEconomicResilienceCaptureSet(base);
    expect(() => appendPublicEconomicResilienceIndex({}, validCapture)).toThrow(
      'index fields drifted'
    );
  });

  it('rejects a captured pull-request run before accepting any artifacts', () => {
    expect(
      inspectPublicEconomicResilienceRunMetadata(PR_RUN_METADATA, {
        sourceCommit: PR_RUN_METADATA.headSha,
      })
    ).toEqual([
      'public economic resilience run metadata must identify a successful master workflow_dispatch run',
    ]);
    const archive = path.join(temporaryRoot(), 'archive');
    const result = runImporter(archive, { FAKE_GH_MODE: 'pr' }, PR_RUN_METADATA.runId);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('successful master workflow_dispatch run');
    expect(readdirSync(path.dirname(archive))).not.toContain(path.basename(archive));
    expect(transactionResidue(path.dirname(archive))).toEqual([]);
  });

  it('imports real replayable JPEG bundles through the gh-backed CLI and verifies retained ZIPs', () => {
    const parent = temporaryRoot();
    const archive = path.join(parent, 'archive');
    const imported = runImporter(archive);
    expect(imported.status, imported.stderr).toBe(0);
    expect(JSON.parse(imported.stdout)).toMatchObject({
      status: 'passed',
      archiveState: 'available',
      captureCount: 1,
      importedSourceCommit: SHA,
    });
    const report = spawnSync(
      process.execPath,
      [ARCHIVE_VERIFIER, '--archive-root', archive],
      { encoding: 'utf8', timeout: 120_000 }
    );
    expect(report.status, report.stderr).toBe(0);
    expect(JSON.parse(report.stdout)).toMatchObject({
      status: 'passed',
      captureCount: 1,
      replay: [
        { sourceCommit: SHA, platform: 'android', status: 'passed' },
        { sourceCommit: SHA, platform: 'ios', status: 'passed' },
      ],
    });
    const capture = path.join(archive, 'source-tree', SHA);
    expect(readdirSync(capture).sort()).toEqual([
      PUBLIC_ECONOMIC_RESILIENCE_ARTIFACT_METADATA_FILE,
      PUBLIC_ECONOMIC_RESILIENCE_CAPTURE_SET_FILE,
      'android',
      'artifacts',
      'ios',
      PUBLIC_ECONOMIC_RESILIENCE_RUN_METADATA_FILE,
    ].sort());
    expect(readFileSync(path.join(capture, 'artifacts', 'android.zip'))).toEqual(
      readFileSync(githubFixture.zips.android)
    );
    expect(readFileSync(path.join(capture, 'artifacts', 'ios.zip'))).toEqual(
      readFileSync(githubFixture.zips.ios)
    );
    expect(transactionResidue(parent)).toEqual([]);

    const before = snapshotTree(archive);
    const duplicate = runImporter(archive);
    expect(duplicate.status).not.toBe(0);
    expect(duplicate.stderr).toContain(`already exists for ${SHA}`);
    expect(snapshotTree(archive)).toEqual(before);
    expect(transactionResidue(parent)).toEqual([]);
  }, 120_000);

  it('rejects hard links, retained ZIP drift, orphan entries, and SHA traversal', () => {
    const baseline = importedArchive();
    for (const [expected, mutate] of [
      [
        'exactly one hard link',
        (archive) => linkSync(
          path.join(archive, 'index.json'),
          path.join(path.dirname(archive), 'index-hardlink.json')
        ),
      ],
      [
        'exactly one hard link',
        (archive) => linkSync(
          path.join(archive, 'source-tree', SHA, 'android', 'source.jpg'),
          path.join(path.dirname(archive), 'source-hardlink.jpg')
        ),
      ],
      [
        'retained android artifact ZIP binding differs',
        (archive) => writeFileSync(
          path.join(archive, 'source-tree', SHA, 'artifacts', 'android.zip'),
          Buffer.from('changed')
        ),
      ],
      [
        'orphan entries',
        (archive) => renameSync(
          path.join(archive, 'source-tree', SHA),
          path.join(archive, 'source-tree', 'b'.repeat(40))
        ),
      ],
      [
        'index capture 1 SHA is invalid',
        (archive) => {
          const indexPath = path.join(archive, 'index.json');
          const index = readJson(indexPath);
          index.captures[0].sourceCommit = '../../outside';
          index.captures[0].captureSetPath =
            'source-tree/../../outside/capture-set.json';
          writeJson(indexPath, index);
        },
      ],
    ]) {
      const parent = temporaryRoot();
      const archive = path.join(parent, 'archive');
      cpSync(baseline, archive, { recursive: true });
      mutate(archive);
      const report = inspectPublicEconomicResilienceArchive(archive);
      expect(report.status).toBe('failed');
      expect(report.error).toContain(expected);
    }
  }, 120_000);

  it.each([
    ['before-journal', true],
    ['after-journal', true],
    ['after-capture-rename', false],
    ['after-index-publish', false],
  ])('recovers crash failpoint %s without transaction residue', (failpoint, retrySucceeds) => {
    const parent = temporaryRoot();
    const archive = path.join(parent, 'archive');
    const crashed = runImporter(archive, {
      NODE_ENV: 'test',
      RNICK_PUBLIC_EVIDENCE_FAILPOINT: failpoint,
    });
    expect(crashed.signal).toBe('SIGKILL');
    const recovered = runImporter(archive);
    if (retrySucceeds) expect(recovered.status, recovered.stderr).toBe(0);
    else {
      expect(recovered.status).not.toBe(0);
      expect(recovered.stderr).toContain(`already exists for ${SHA}`);
    }
    expect(inspectPublicEconomicResilienceArchive(archive)).toMatchObject({
      status: 'passed',
      archiveState: 'available',
      captureCount: 1,
    });
    expect(transactionResidue(parent)).toEqual([]);
  }, 120_000);

  it('keeps CLI acquisition narrow and public copy project-generic', () => {
    const importer = readFileSync(IMPORTER, 'utf8');
    expect(importer).toContain('acquirePublicEconomicResilienceRun(runId)');
    expect(importer).toContain("renameSync(stagedCapture, destinationCapture)");
    expect(importer).toContain("triggerFailpoint('after-capture-rename')");
    expect(importer).not.toContain('--android-artifact');
    expect(importer).not.toContain('--run-metadata');
    const page = readFileSync('website/reference/economic-resilience.md', 'utf8');
    expect(page).not.toMatch(/fastest|universally faster|money saved/i);
    expect(page).toContain('matchedTransferBaseline: null');
    expect(page).toContain('costSavingsClaim: null');
  });
});

function createGithubFixture() {
  const parent = temporaryRoot();
  const generatedOutput = path.join(parent, 'output.jpg');
  mustRun('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-i', path.resolve('example/fixtures/kit-only-12mp-v1.jpg'),
    '-vf', 'scale=1600:1200:flags=lanczos',
    '-frames:v', '1', '-c:v', 'mjpeg', '-q:v', '2',
    '-pix_fmt', 'yuvj420p', '-map_metadata', '-1',
    '-flags', '+bitexact', '-fflags', '+bitexact', generatedOutput,
  ]);
  const visualPath = path.join(parent, 'visual.json');
  mustRun(process.execPath, [
    path.resolve('scripts/measure-demo-visual-agreement.mjs'),
    '--source', path.resolve('example/fixtures/kit-only-12mp-v1.jpg'),
    '--output', generatedOutput,
    '--resize-mode', 'contain', '--max-width', '1600', '--max-height', '1200',
    '--comparison-profile', PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE,
    '--report', visualPath,
  ]);
  const outputBytes = readFileSync(generatedOutput);
  const visualAgreement = readJson(visualPath);
  const artifacts = [];
  const zips = {};
  for (const [platform, id] of [['android', 101], ['ios', 102]]) {
    const nativeRoot = path.join(parent, `native-${platform}`);
    const economicRoot = path.join(nativeRoot, 'economic-resilience');
    mkdirSync(economicRoot, { recursive: true });
    writeReplayableEvidence({
      root: economicRoot,
      platform,
      outputBytes,
      visualAgreement,
    });
    for (const member of PUBLIC_ECONOMIC_RESILIENCE_NATIVE_ARTIFACT_MEMBERS) {
      const file = path.join(nativeRoot, member);
      if (member.startsWith('economic-resilience/')) continue;
      if (member === 'source.jpg') writeFileSync(file, SOURCE);
      else if (member === 'output.jpg' || member === 'screen.png') {
        writeFileSync(file, outputBytes);
      } else writeFileSync(file, `${platform}-${member}\n`);
    }
    const zipFile = path.join(parent, `${platform}.zip`);
    mustRun('zip', [
      '-q', '-X', zipFile,
      ...PUBLIC_ECONOMIC_RESILIENCE_NATIVE_ARTIFACT_MEMBERS,
    ], { cwd: nativeRoot });
    zips[platform] = zipFile;
    const zipBytes = readFileSync(zipFile);
    artifacts.push({
      id,
      name: `native-demo-${platform}-${SHA}`,
      digest: `sha256:${sha256(zipBytes)}`,
      expired: false,
      size_in_bytes: zipBytes.length,
      archive_download_url:
        `https://api.github.com/repos/GGULBAE/react-native-image-compression-kit/actions/artifacts/${id}/zip`,
      workflow_run: { id: RUN_ID, head_branch: 'master', head_sha: SHA },
    });
  }
  const config = {
    run: {
      event: RUN_METADATA.event,
      head_branch: RUN_METADATA.headBranch,
      head_sha: RUN_METADATA.headSha,
      conclusion: RUN_METADATA.conclusion,
      name: RUN_METADATA.workflowName,
      path: RUN_METADATA.path,
      id: RUN_METADATA.runId,
      run_attempt: RUN_METADATA.attempt,
      html_url: RUN_METADATA.url,
    },
    prRun: {
      event: PR_RUN_METADATA.event,
      head_branch: PR_RUN_METADATA.headBranch,
      head_sha: PR_RUN_METADATA.headSha,
      conclusion: PR_RUN_METADATA.conclusion,
      name: PR_RUN_METADATA.workflowName,
      path: PR_RUN_METADATA.path,
      id: PR_RUN_METADATA.runId,
      run_attempt: PR_RUN_METADATA.attempt,
      html_url: PR_RUN_METADATA.url,
    },
    artifacts,
    zips,
  };
  const configPath = path.join(parent, 'github.json');
  writeJson(configPath, config);
  const bin = path.join(parent, 'bin');
  mkdirSync(bin);
  const gh = path.join(bin, 'gh');
  writeFileSync(gh, `#!/usr/bin/env node
const fs = require('node:fs');
const config = JSON.parse(fs.readFileSync(process.env.FAKE_GH_CONFIG, 'utf8'));
const endpoint = process.argv.at(-1);
if (process.env.FAKE_GH_MODE === 'pr') {
  process.stdout.write(JSON.stringify(config.prRun));
} else if (/actions\\/runs\\/\\d+\\/artifacts/.test(endpoint)) {
  process.stdout.write(JSON.stringify({total_count: 2, artifacts: config.artifacts}));
} else if (/actions\\/runs\\/\\d+$/.test(endpoint)) {
  process.stdout.write(JSON.stringify(config.run));
} else {
  const artifact = config.artifacts.find((item) => endpoint.includes('/artifacts/' + item.id + '/zip'));
  if (!artifact) process.exit(2);
  fs.writeFileSync(1, fs.readFileSync(config.zips[artifact.name.includes('-android-') ? 'android' : 'ios']));
}
`);
  chmodSync(gh, 0o755);
  return { configPath, bin, zips };
}

function writeReplayableEvidence({ root, platform, outputBytes, visualAgreement }) {
  const payload = validPayload(platform, outputBytes);
  const environment = validEnvironment(platform);
  environment.toolchain.ffmpeg = firstLine(
    mustRun('ffmpeg', ['-version'], { encoding: 'utf8' }).stdout
  );
  environment.toolchain.ffprobe = firstLine(
    mustRun('ffprobe', ['-version'], { encoding: 'utf8' }).stdout
  );
  const evidence = buildEconomicResilienceEvidence({
    payload,
    packageVersion: '0.4.1',
    sourceCommit: SHA,
    runId: RUN_ID,
    runAttempt: RUN_ATTEMPT,
    capturedAt: '2026-08-13T07:00:00.000Z',
    runUrl: RUN_URL,
    environment,
    fixtureManifest: FIXTURE_MANIFEST,
    sourceBytes: SOURCE,
    outputBytes,
    visualAgreement,
  });
  writeFileSync(path.join(root, 'source.jpg'), SOURCE);
  writeFileSync(path.join(root, 'output.jpg'), outputBytes);
  writeJson(path.join(root, 'fixture-manifest.json'), FIXTURE_MANIFEST);
  writeJson(path.join(root, 'visual-agreement.json'), visualAgreement);
  writeJson(path.join(root, 'environment.json'), environment);
  writeJson(path.join(root, 'economic-resilience.json'), evidence);
  expect(readdirSync(root).sort()).toEqual(ECONOMIC_RESILIENCE_ASSET_FILES);
}

function validPayload(platform, outputBytes) {
  const inspection = {
    exists: true,
    byteSize: outputBytes.length,
    sha256: sha256(outputBytes),
    mediaType: 'image/jpeg',
    width: 1600,
    height: 1200,
  };
  const samples = Array.from({ length: 12 }, (_, index) => ({
    phase: index < 2 ? 'warmup' : 'measured',
    iteration: index < 2 ? index + 1 : index - 1,
    elapsedMs: index + 1,
    result: {
      format: 'jpeg', width: 1600, height: 1200,
      byteSize: outputBytes.length,
      originalByteSize: SOURCE.length,
      compressionRatio: outputBytes.length / SOURCE.length,
    },
    sourceToOutputByteDifference: SOURCE.length - outputBytes.length,
    outputInspection: { ...inspection },
    cleanup: {
      packageOutputRemoved: true,
      existsAfterRemoval: false,
      residualByteSize: 0,
    },
  }));
  return {
    schemaVersion: 1,
    scenarioId: 'kit-only-12mp-jpeg-v1',
    implementation: { name: 'react-native-image-compression-kit' },
    platform,
    architecture: 'new',
    jsEngine: 'hermes',
    fixture: {
      ...ECONOMIC_RESILIENCE_FIXTURE,
      sourceUri: 'file:///cache/source.jpg',
      inspection: {
        exists: true, byteSize: SOURCE.length, sha256: sha256(SOURCE),
        mediaType: 'image/jpeg', width: 4000, height: 3000,
      },
      remainsAfterRun: true,
    },
    operation: ECONOMIC_RESILIENCE_OPERATION,
    capabilities: validCapabilities(platform),
    timing: {
      clock: 'performance.now', boundary: 'compressImage-call-only',
      warmupIterations: 2, measuredIterations: 10,
    },
    representative: {
      measuredIteration: 10,
      stagedOutputUri: 'file:///cache/staged-output.jpg',
      inspection: { ...inspection },
    },
    samples,
    cleanup: {
      attemptedPackageOutputs: 12, removedPackageOutputs: 12,
      residualPackageOutputs: 0, residualPackageOutputBytes: 0,
    },
  };
}

function validCapabilities(platform) {
  return {
    platform,
    formats: ['jpeg', 'png', 'webp', 'heic', 'heif', 'avif', 'gif'].map(
      (format) => ({
        format,
        input: true,
        output: ['jpeg', 'png', 'webp'].includes(format),
        supportsAlpha: format !== 'jpeg',
        supportsAnimation: false,
        notes: [`${format} exact runtime note`],
      })
    ),
    metadataPolicies: ['preserve', 'safe', 'strip'],
    supportsTargetSizeCompression: true,
    supportsCancellation: true,
    maxConcurrentOperations: 2,
    supportsDecodeDownsampling: true,
    resourceLimits: {
      maxSourceDimension: 16_384,
      maxSourcePixels: 48_000_000,
      maxWorkingPixels: 16_000_000,
    },
  };
}

function validEnvironment(platform) {
  return {
    platform,
    runtime: platform === 'android' ? 'Android 15 / API 35' : 'iOS 18.0',
    osBuild: 'exact-build',
    device: platform === 'android' ? 'Google emulator' : 'iPhone simulator',
    deviceKind: platform === 'android' ? 'emulator' : 'simulator',
    abi: platform === 'android' ? 'x86_64' : 'arm64',
    reactNativeArchitecture: 'new',
    reactNativeVersion: '0.86.2',
    jsEngine: 'hermes',
    buildType: 'debug',
    runner: {
      label: platform === 'android' ? 'ubuntu-latest' : 'macos-latest',
      os: platform === 'android' ? 'Linux' : 'macOS',
      arch: 'ARM64',
      name: 'GitHub Actions exact runner',
      imageOS: platform === 'android' ? 'ubuntu24' : 'macos15',
      imageVersion: '20260810.1',
    },
    toolchain: {
      node: 'v24.18.0', ffmpeg: 'pending', ffprobe: 'pending',
      primary: platform === 'android' ? 'openjdk 21.0.8' : 'Xcode 16.0',
      platformSdk: platform === 'android' ? 'Android SDK 35' : 'iOS SDK 18.0',
    },
  };
}

function syntheticArtifactMetadata() {
  return {
    schemaVersion: 1,
    runId: RUN_ID,
    artifacts: ['android', 'ios'].map((platform, index) => ({
      platform,
      id: index + 1,
      name: `native-demo-${platform}-${SHA}`,
      digest: `sha256:${String(index + 1).repeat(64)}`,
      expired: false,
      sizeInBytes: 100 + index,
      archiveDownloadUrl:
        `https://api.github.com/repos/GGULBAE/react-native-image-compression-kit/actions/artifacts/${index + 1}/zip`,
    })),
  };
}

function validEvidenceBoundary(platform) {
  return {
    implementation: { version: '0.4.1', buildSource: 'checked-out-source-tree' },
    sourceCommit: SHA,
    runId: RUN_ID,
    runAttempt: RUN_ATTEMPT,
    runUrl: RUN_URL,
    environment: { platform },
    fixture: { remainsAfterRun: true, sha256: sha256(SOURCE), byteSize: SOURCE.length },
    economics: {
      boundary: 'source-to-output-observation', sourceOwnership: 'source-remains',
      matchedTransferBaseline: null, costSavingsClaim: null,
    },
    cleanup: {
      attemptedPackageOutputs: 12, removedPackageOutputs: 12,
      residualPackageOutputs: 0, residualPackageOutputBytes: 0,
    },
    visualAgreement: {
      schemaVersion: 3,
      comparisonProfile: PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE,
    },
    scenarioId: 'kit-only-12mp-jpeg-v1',
  };
}

function importedArchive() {
  const archive = path.join(temporaryRoot(), 'archive');
  const result = runImporter(archive);
  expect(result.status, result.stderr).toBe(0);
  return archive;
}

function runImporter(archive, environment = {}, runId = RUN_ID) {
  return spawnSync(
    process.execPath,
    [IMPORTER, '--run-id', String(runId), '--archive-root', archive],
    {
      encoding: 'utf8',
      timeout: 120_000,
      env: {
        ...process.env,
        PATH: `${githubFixture.bin}${path.delimiter}${process.env.PATH}`,
        FAKE_GH_CONFIG: githubFixture.configPath,
        ...environment,
      },
    }
  );
}

function transactionResidue(parent) {
  return readdirSync(parent).filter((entry) => entry.startsWith('.economic-resilience'));
}

function snapshotTree(root) {
  const snapshot = {};
  const visit = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = path.posix.join(prefix, entry.name);
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute, relative);
      else snapshot[relative] = sha256(readFileSync(absolute));
    }
  };
  visit(root);
  return snapshot;
}

function temporaryRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rnick-public-economic-'));
  roots.push(root);
  return root;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  writeFileSync(file, serializeJson(value));
}

function serializeJson(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function mustRun(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result;
}

function firstLine(value) {
  return String(value).split(/\r?\n/u)[0];
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
