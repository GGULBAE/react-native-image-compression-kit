import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  inspectDemoEvidence,
  inspectMp4,
} from '../scripts/demo-evidence-core.mjs';
import { createDemoVisualAgreementReport } from '../scripts/demo-visual-agreement-core.mjs';

const SHA = 'a'.repeat(40);

describe('native demo evidence', () => {
  it('accepts exact Android and iOS assets with native metrics', () => {
    const fixture = createFixture();
    expect(inspectDemoEvidence(fixture.root, fixture.manifest)).toMatchObject({
      status: 'passed',
      platforms: ['android', 'ios'],
      error: null,
    });
  });

  it('rejects missing platforms, digest drift, and non-GitHub provenance', () => {
    const fixture = createFixture();
    fixture.manifest.cases.pop();
    fixture.manifest.cases[0].assets.output.sha256 = '0'.repeat(64);
    fixture.manifest.cases[0].runUrl = 'local://capture';
    const report = inspectDemoEvidence(fixture.root, fixture.manifest);
    expect(report.status).toBe('failed');
    expect(report.error).toContain('exactly one Android and one iOS');
    expect(report.error).toContain('output SHA-256 mismatch');
    expect(report.error).toContain('capture workflow run');
  });

  it('rejects a result that does not reduce the deterministic source', () => {
    const fixture = createFixture();
    fixture.manifest.cases[0].result.byteSize = fixture.manifest.cases[0].result.originalByteSize;
    fixture.manifest.cases[0].result.compressionRatio = 1;
    expect(inspectDemoEvidence(fixture.root, fixture.manifest).error).toContain(
      'demo output must be smaller than its source'
    );
  });

  it('rejects presentation-video digest and duration drift', () => {
    const fixture = createFixture();
    writeFileSync(path.join(fixture.root, 'native-demo.mp4'), Buffer.from('tampered'));
    fixture.manifest.presentation.video.durationSeconds = 31;
    const report = inspectDemoEvidence(fixture.root, fixture.manifest);
    expect(report.status).toBe('failed');
    expect(report.error).toContain('presentation video byte size mismatch');
    expect(report.error).toContain('presentation video SHA-256 mismatch');
    expect(report.error).toContain('presentation video is not MP4');
    expect(report.error).toContain('presentation video duration');
  });

  it('accepts timed native recordings and the exact guided walkthrough', () => {
    const fixture = createGuidedFixture();
    expect(inspectDemoEvidence(fixture.root, fixture.manifest)).toMatchObject({
      status: 'passed',
      platforms: ['android', 'ios'],
      error: null,
    });
    expect(inspectMp4(fixture.recording)).toMatchObject({
      status: 'passed',
      durationSeconds: 24,
      width: 720,
      height: 1_600,
    });
  });

  it('uses video-track duration instead of a misleading movie duration', () => {
    expect(inspectMp4(timedMp4(5, 24))).toMatchObject({
      status: 'passed',
      durationSeconds: 5,
    });
  });

  it('rejects recording metadata and guided stage mutation', () => {
    const fixture = createGuidedFixture();
    const android = fixture.manifest.cases[0];
    android.assets.recording.durationSeconds = 17;
    android.walkthrough.stages[2].id = 'result';
    android.walkthrough.durationMs = 31_000;
    android.walkthrough.result.byteSize += 1;
    const report = inspectDemoEvidence(fixture.root, fixture.manifest);
    expect(report.status).toBe('failed');
    expect(report.error).toContain('recording duration does not match MP4 metadata');
    expect(report.error).toContain('recording duration must be between 18 and 30 seconds');
    expect(report.error).toContain('walkthrough stage order or ordinal drifted');
    expect(report.error).toContain('walkthrough duration must be between 18 and 30 seconds');
    expect(report.error).toContain('walkthrough result does not match the native result');
  });

  it('requires visual agreement on every schema-v3 capture', () => {
    const fixture = createGuidedFixture();
    fixture.manifest.schemaVersion = 3;
    for (const evidence of fixture.manifest.cases) evidence.schemaVersion = 3;
    delete fixture.manifest.cases[0].visualAgreement;
    const report = inspectDemoEvidence(fixture.root, fixture.manifest);
    expect(report.status).toBe('failed');
    expect(report.error).toContain('visual agreement report is required');
  });

  it('preserves the retained schema-v2 visual-report exception only for its exact source', () => {
    const fixture = createGuidedFixture();
    fixture.manifest.sourceCommit =
      '11b91af66322d7b98b46481739c54825b406ef0c';
    for (const evidence of fixture.manifest.cases) {
      evidence.sourceCommit = fixture.manifest.sourceCommit;
      delete evidence.visualAgreement;
    }
    expect(inspectDemoEvidence(fixture.root, fixture.manifest)).toMatchObject({
      status: 'passed',
      evidenceStatus: 'passed',
      error: null,
    });

    fixture.manifest.sourceCommit = 'd'.repeat(40);
    for (const evidence of fixture.manifest.cases) {
      evidence.sourceCommit = fixture.manifest.sourceCommit;
    }
    expect(inspectDemoEvidence(fixture.root, fixture.manifest).error).toContain(
      'visual agreement report is required'
    );
  });

  it('accepts an integrity-valid affected case and derives the aggregate outcome', () => {
    const fixture = createGuidedFixture();
    fixture.manifest.schemaVersion = 3;
    for (const evidence of fixture.manifest.cases) evidence.schemaVersion = 3;
    const ios = fixture.manifest.cases[1];
    ios.visualAgreement = createDemoVisualAgreementReport({
      sourceBytes: readFileSync(path.join(fixture.root, ios.assets.source.file)),
      outputBytes: readFileSync(path.join(fixture.root, ios.assets.output.file)),
      sourceWidth: 600,
      sourceHeight: 960,
      width: ios.result.width,
      height: ios.result.height,
      resizeMode: 'contain',
      maxWidth: 160,
      maxHeight: 160,
      uprightSimilarity: 0.75,
      verticalFlipSimilarity: 0.94,
    });
    ios.status = 'affected';
    fixture.manifest.status = 'affected';
    expect(inspectDemoEvidence(fixture.root, fixture.manifest)).toMatchObject({
      status: 'passed',
      evidenceStatus: 'affected',
      error: null,
    });

    fixture.manifest.status = 'passed';
    expect(inspectDemoEvidence(fixture.root, fixture.manifest).error).toContain(
      'status does not match the derived case outcomes'
    );
  });

  it('validates schema and post-release source provenance disclosure', () => {
    const fixture = createGuidedFixture();
    fixture.manifest.schemaVersion = 3;
    for (const evidence of fixture.manifest.cases) evidence.schemaVersion = 3;
    fixture.manifest.sourceProvenance = {
      kind: 'post-release',
      releaseSourceCommit: 'b'.repeat(40),
    };
    expect(inspectDemoEvidence(fixture.root, fixture.manifest)).toMatchObject({
      status: 'passed',
      evidenceStatus: 'passed',
    });

    fixture.manifest.schemaVersion = 9;
    fixture.manifest.sourceProvenance = {
      kind: 'exact-candidate',
      releaseSourceCommit: fixture.manifest.sourceCommit,
    };
    const invalid = inspectDemoEvidence(fixture.root, fixture.manifest);
    expect(invalid.status).toBe('failed');
    expect(invalid.error).toContain('schemaVersion must be 1, 2, or 3');
    expect(invalid.error).toContain(
      'sourceProvenance must disclose a distinct post-release capture source'
    );
  });

  it('rejects schema-v3 visual integrity, outcome, schema, and dimension drift', () => {
    const fixture = createGuidedFixture();
    fixture.manifest.schemaVersion = 3;
    for (const evidence of fixture.manifest.cases) evidence.schemaVersion = 3;
    const android = fixture.manifest.cases[0];

    android.status = 'affected';
    fixture.manifest.status = 'affected';
    expect(inspectDemoEvidence(fixture.root, fixture.manifest).error).toContain(
      'status does not match visual agreement outcome'
    );

    android.status = 'passed';
    fixture.manifest.status = 'passed';
    android.visualAgreement = {
      ...android.visualAgreement,
      width: android.visualAgreement.width + 1,
    };
    const drift = inspectDemoEvidence(fixture.root, fixture.manifest);
    expect(drift.error).toContain(
      'geometry check does not match the measured values'
    );
    expect(drift.error).toContain(
      'visual agreement dimensions do not match the native result'
    );

    android.visualAgreement = {
      schemaVersion: 1,
      status: 'passed',
      algorithm: 'ffmpeg-auto-oriented-ssim-v1',
      width: android.result.width,
      height: android.result.height,
      uprightSimilarity: 0.95,
      verticalFlipSimilarity: 0.7,
      minimumSimilarity: 0.9,
      minimumOrientationMargin: 0.02,
      sourceSha256: android.assets.source.sha256,
      outputSha256: android.assets.output.sha256,
    };
    expect(inspectDemoEvidence(fixture.root, fixture.manifest).error).toContain(
      'schemaVersion 3 requires visual agreement schemaVersion 2'
    );
  });

  it('rejects truncated and untimed MP4 containers', () => {
    expect(inspectMp4(Buffer.from('not an mp4'))).toMatchObject({
      status: 'failed',
      durationSeconds: null,
    });
    expect(inspectMp4(box('ftyp', Buffer.from('isom'))).error).toContain(
      'moov box is missing'
    );
    expect(inspectMp4(mp4WithMoov(box('free', Buffer.alloc(0)))).error).toContain(
      'mvhd box is missing'
    );
    const invalidDuration = Buffer.alloc(20);
    expect(
      inspectMp4(
        Buffer.concat([
          box('ftyp', Buffer.from('isom')),
          box('moov', box('mvhd', invalidDuration)),
        ])
      ).error
    ).toContain('mvhd duration is invalid');
  });

  it('rejects malformed native case metadata and asset bytes', () => {
    const fixture = createFixture();
    const android = fixture.manifest.cases[0];
    fixture.manifest.status = 'failed';
    fixture.manifest.packageVersion = 'latest';
    fixture.manifest.sourceCommit = 'short';
    android.schemaVersion = 2;
    android.status = 'failed';
    android.capturedAt = 'not-a-date';
    android.runtime = '';
    android.device = '';
    android.options.output.format = 'png';
    android.result.format = 'png';
    android.result.width = 0;
    android.assets.source.file = '/absolute.jpg';
    android.assets.output.byteSize += 1;
    android.assets.output.sha256 = '0'.repeat(64);
    writeFileSync(path.join(fixture.root, 'android', 'output.jpg'), Buffer.from('bad'));
    writeFileSync(path.join(fixture.root, 'android', 'screen.png'), Buffer.from('bad'));
    fixture.manifest.cases[1].assets.source.file = 'ios/missing.jpg';
    const report = inspectDemoEvidence(fixture.root, fixture.manifest);
    expect(report.status).toBe('failed');
    expect(report.error).toContain('status does not match the derived case outcomes');
    expect(report.error).toContain('packageVersion must be an exact semantic version');
    expect(report.error).toContain('sourceCommit must be a lowercase full commit SHA');
    expect(report.error).toContain('schemaVersion does not match the manifest');
    expect(report.error).toContain('capturedAt must be an ISO timestamp');
    expect(report.error).toContain('runtime and device are required');
    expect(report.error).toContain('deterministic JPEG options drifted');
    expect(report.error).toContain('native result metrics are invalid');
    expect(report.error).toContain('source file path is invalid');
    expect(report.error).toContain('output byte size mismatch');
    expect(report.error).toContain('output SHA-256 mismatch');
    expect(report.error).toContain('output is not JPEG');
    expect(report.error).toContain('screenshot is not PNG');
    expect(report.error).toContain('source file is missing');
  });
});

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rnick-demo-evidence-'));
  const cases = ['android', 'ios'].map((platform, index) => {
    const directory = path.join(root, platform);
    mkdirSync(directory);
    const source = Buffer.from([0xff, 0xd8, 1, index, 3, 4]);
    const output = Buffer.from([0xff, 0xd8, 2, index]);
    const screenshot = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, index]);
    for (const [name, bytes] of [['source.jpg', source], ['output.jpg', output], ['screen.png', screenshot]]) {
      writeFileSync(path.join(directory, name), bytes);
    }
    return {
      schemaVersion: 1,
      status: 'passed',
      packageVersion: '0.3.0',
      sourceCommit: SHA,
      capturedAt: '2026-07-18T00:00:00.000Z',
      platform,
      runtime: platform === 'ios' ? 'iOS 26.5' : 'Android 15 / API 35',
      device: platform === 'ios' ? 'iPhone 17 Pro' : 'Google Pixel 6',
      runUrl: `https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/${index + 1}`,
      sourceUriKind: 'file',
      options: {
        resize: { maxWidth: 160, maxHeight: 160, mode: 'contain' },
        output: { format: 'jpeg', quality: 76, maxBytes: 8000 },
        metadata: 'safe',
      },
      result: {
        format: 'jpeg', width: 100, height: 160,
        byteSize: output.length,
        originalByteSize: source.length,
        compressionRatio: output.length / source.length,
      },
      assets: {
        source: asset(`${platform}/source.jpg`, source),
        output: asset(`${platform}/output.jpg`, output),
        screenshot: asset(`${platform}/screen.png`, screenshot),
      },
    };
  });
  const video = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0]);
  writeFileSync(path.join(root, 'native-demo.mp4'), video);
  return {
    root,
    manifest: {
      schemaVersion: 1,
      status: 'passed',
      packageVersion: '0.3.0',
      sourceCommit: SHA,
      cases,
      presentation: {
        video: {
          file: 'native-demo.mp4',
          byteSize: video.length,
          sha256: createHash('sha256').update(video).digest('hex'),
          durationSeconds: 5,
          generator: 'ffmpeg fixture',
        },
      },
    },
  };
}

function asset(file, bytes) {
  return { file, byteSize: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function createGuidedFixture() {
  const fixture = createFixture();
  const recording = timedMp4(24);
  fixture.manifest.schemaVersion = 2;
  delete fixture.manifest.presentation;
  for (const evidence of fixture.manifest.cases) {
    evidence.sourceCommit = fixture.manifest.sourceCommit;
    evidence.schemaVersion = 2;
    const recordingPath = path.join(fixture.root, evidence.platform, 'recording.mp4');
    writeFileSync(recordingPath, recording);
    evidence.assets.recording = {
      ...asset(`${evidence.platform}/recording.mp4`, recording),
      durationSeconds: 24,
      captureMethod: `${evidence.platform} native fixture capture`,
    };
    evidence.walkthrough = {
      schemaVersion: 1,
      platform: evidence.platform,
      status: 'passed',
      stages: [
        { id: 'source', ordinal: 0, elapsedMs: 0 },
        { id: 'options', ordinal: 1, elapsedMs: 5_000 },
        { id: 'capabilities', ordinal: 2, elapsedMs: 9_000 },
        { id: 'compressing', ordinal: 3, elapsedMs: 13_000 },
        { id: 'result', ordinal: 4, elapsedMs: 15_000 },
      ],
      durationMs: 22_000,
      options: structuredClone(evidence.options),
      result: structuredClone(evidence.result),
    };
    const sourceBytes = readFileSync(path.join(fixture.root, evidence.assets.source.file));
    const outputBytes = readFileSync(path.join(fixture.root, evidence.assets.output.file));
    evidence.visualAgreement = createDemoVisualAgreementReport({
      sourceBytes,
      outputBytes,
      sourceWidth: 600,
      sourceHeight: 960,
      width: evidence.result.width,
      height: evidence.result.height,
      resizeMode: 'contain',
      maxWidth: 160,
      maxHeight: 160,
      uprightSimilarity: 0.95,
      verticalFlipSimilarity: 0.7,
    });
  }
  return { ...fixture, recording };
}

function timedMp4(durationSeconds, movieDurationSeconds = durationSeconds) {
  const ftyp = box('ftyp', Buffer.from('isom\0\0\0\0isom'));
  const mvhdPayload = Buffer.alloc(20);
  mvhdPayload.writeUInt32BE(1_000, 12);
  mvhdPayload.writeUInt32BE(movieDurationSeconds * 1_000, 16);
  const mdhdPayload = Buffer.alloc(20);
  mdhdPayload.writeUInt32BE(1_000, 12);
  mdhdPayload.writeUInt32BE(durationSeconds * 1_000, 16);
  const hdlrPayload = Buffer.alloc(12);
  hdlrPayload.write('vide', 8, 4, 'ascii');
  const tkhdPayload = Buffer.alloc(84);
  tkhdPayload.writeUInt32BE(720 * 65_536, 76);
  tkhdPayload.writeUInt32BE(1_600 * 65_536, 80);
  const trak = box(
    'trak',
    Buffer.concat([
      box('tkhd', tkhdPayload),
      box('mdia', Buffer.concat([box('mdhd', mdhdPayload), box('hdlr', hdlrPayload)])),
    ])
  );
  return Buffer.concat([ftyp, box('moov', Buffer.concat([box('mvhd', mvhdPayload), trak]))]);
}

function mp4WithMoov(payload) {
  return Buffer.concat([box('ftyp', Buffer.from('isom')), box('moov', payload)]);
}

function box(type, payload) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8, 0);
  header.write(type, 4, 4, 'ascii');
  return Buffer.concat([header, payload]);
}
