import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = path.resolve('scripts/create-demo-evidence.mjs');
const SHA = 'c'.repeat(40);

describe('native demo evidence creation', () => {
  it('records parsed MP4 duration and rejects a short capture', () => {
    const fixture = createInput();
    const accepted = runCreate(fixture, timedMp4(24), 'accepted');
    expect(accepted.result.status).toBe(0);
    const manifest = JSON.parse(
      readFileSync(path.join(accepted.destination, 'manifest.json'), 'utf8')
    );
    expect(manifest).toMatchObject({
      schemaVersion: 2,
      platform: 'android',
      sourceCommit: SHA,
      assets: {
        recording: {
          durationSeconds: 24,
          captureMethod: 'android fixture capture',
        },
      },
    });

    const rejected = runCreate(fixture, timedMp4(14), 'rejected');
    expect(rejected.result.status).toBe(1);
    expect(rejected.result.stderr).toContain(
      'captured walkthrough duration must be between 18 and 30 seconds'
    );
  });
});

function createInput() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rnick-demo-create-'));
  const source = Buffer.from([0xff, 0xd8, 1, 2, 3, 4]);
  const output = Buffer.from([0xff, 0xd8, 3, 4]);
  const screenshot = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const options = {
    resize: { maxWidth: 160, maxHeight: 160, mode: 'contain' },
    output: { format: 'jpeg', quality: 76, maxBytes: 8_000 },
    metadata: 'safe',
  };
  const result = {
    format: 'jpeg',
    width: 100,
    height: 160,
    byteSize: output.length,
    originalByteSize: source.length,
    compressionRatio: output.length / source.length,
  };
  const walkthrough = {
    schemaVersion: 1,
    platform: 'android',
    status: 'passed',
    stages: [
      { id: 'source', ordinal: 0, elapsedMs: 0 },
      { id: 'options', ordinal: 1, elapsedMs: 5_000 },
      { id: 'capabilities', ordinal: 2, elapsedMs: 9_000 },
      { id: 'compressing', ordinal: 3, elapsedMs: 13_000 },
      { id: 'result', ordinal: 4, elapsedMs: 15_000 },
    ],
    durationMs: 22_000,
    options,
    result,
  };
  for (const [file, bytes] of [
    ['source.jpg', source],
    ['output.jpg', output],
    ['screen.png', screenshot],
  ]) {
    writeFileSync(path.join(root, file), bytes);
  }
  writeFileSync(
    path.join(root, 'native.log'),
    `RNICK_DEMO_PASS ${JSON.stringify({
      schemaVersion: 1,
      platform: 'android',
      sourceUri: 'file:///tmp/source.jpg',
      options,
      result,
    })}\nRNICK_GUIDED_DEMO_PASS ${JSON.stringify(walkthrough)}\n`
  );
  return root;
}

function runCreate(root, recording, label) {
  const recordingPath = path.join(root, `${label}.mp4`);
  const destination = path.join(root, label);
  writeFileSync(recordingPath, recording);
  const result = spawnSync(
    process.execPath,
    [
      SCRIPT,
      '--platform', 'android',
      '--package-version', '0.4.0',
      '--source-sha', SHA,
      '--runtime', 'Android 15 / API 35',
      '--device', 'Google Pixel 6',
      '--source', path.join(root, 'source.jpg'),
      '--output', path.join(root, 'output.jpg'),
      '--screenshot', path.join(root, 'screen.png'),
      '--recording', recordingPath,
      '--capture-method', 'android fixture capture',
      '--log', path.join(root, 'native.log'),
      '--destination', destination,
      '--run-url', 'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/42',
    ],
    { encoding: 'utf8' }
  );
  return { destination, result };
}

function timedMp4(durationSeconds) {
  const ftyp = box('ftyp', Buffer.from('isom\0\0\0\0isom'));
  const mvhdPayload = Buffer.alloc(20);
  mvhdPayload.writeUInt32BE(1_000, 12);
  mvhdPayload.writeUInt32BE(durationSeconds * 1_000, 16);
  return Buffer.concat([ftyp, box('moov', box('mvhd', mvhdPayload))]);
}

function box(type, payload) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8, 0);
  header.write(type, 4, 4, 'ascii');
  return Buffer.concat([header, payload]);
}
