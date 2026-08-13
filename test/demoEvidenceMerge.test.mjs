import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createDemoVisualAgreementReport } from '../scripts/demo-visual-agreement-core.mjs';

const SCRIPT = path.resolve('scripts/merge-demo-evidence.mjs');
const SHA = 'b'.repeat(40);

describe('native demo evidence merge', () => {
  it('assembles schema-v3 platform fragments without a synthetic video', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'rnick-demo-merge-'));
    const android = createFragment(root, 'android');
    const ios = createFragment(root, 'ios');
    const destination = path.join(root, 'merged');
    const result = spawnSync(
      process.execPath,
      [
        SCRIPT,
        '--android-dir', android,
        '--ios-dir', ios,
        '--destination', destination,
      ],
      { encoding: 'utf8' }
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const manifest = JSON.parse(
      readFileSync(path.join(destination, 'manifest.json'), 'utf8')
    );
    expect(manifest).toMatchObject({
      schemaVersion: 3,
      status: 'passed',
      packageVersion: '0.4.0',
      sourceCommit: SHA,
    });
    expect(manifest.presentation).toBeUndefined();
    expect(manifest.cases.map(({ platform }) => platform)).toEqual([
      'android',
      'ios',
    ]);
    expect(manifest.cases[0].assets.recording.file).toBe(
      'android/recording.mp4'
    );
    expect(readFileSync(path.join(destination, 'ios', 'recording.mp4'))).toEqual(
      Buffer.from('ios-recording')
    );
  });

  it('rejects a claimed pass whose visual report or digests are incomplete', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'rnick-demo-merge-invalid-'));
    const android = createFragment(root, 'android');
    const ios = createFragment(root, 'ios');
    const manifestPath = path.join(ios, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const originalVisualDigest = manifest.visualAgreement.outputSha256;
    manifest.visualAgreement.outputSha256 = '0'.repeat(64);
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
    const destination = path.join(root, 'merged');
    const result = spawnSync(process.execPath, [
      SCRIPT,
      '--android-dir', android,
      '--ios-dir', ios,
      '--destination', destination,
    ], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('output SHA-256 mismatch');
    expect(existsSync(destination)).toBe(false);

    manifest.visualAgreement.outputSha256 = originalVisualDigest;
    manifest.assets.output.sha256 = '0'.repeat(64);
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
    const assetDestination = path.join(root, 'asset-drift');
    const assetDrift = spawnSync(process.execPath, [
      SCRIPT,
      '--android-dir', android,
      '--ios-dir', ios,
      '--destination', assetDestination,
    ], { encoding: 'utf8' });
    expect(assetDrift.status).toBe(1);
    expect(assetDrift.stderr).toContain('output asset SHA-256 mismatch');
    expect(existsSync(assetDestination)).toBe(false);
  });
});

function createFragment(root, platform) {
  const directory = path.join(root, platform);
  mkdirSync(directory);
  const files = {
    source: 'source.jpg',
    output: 'output.jpg',
    screenshot: 'screen.png',
    recording: 'recording.mp4',
  };
  for (const [name, file] of Object.entries(files)) {
    writeFileSync(path.join(directory, file), Buffer.from(`${platform}-${name}`));
  }
  const sourceBytes = readFileSync(path.join(directory, files.source));
  const outputBytes = readFileSync(path.join(directory, files.output));
  const options = {
    resize: { maxWidth: 160, maxHeight: 160, mode: 'contain' },
    output: { format: 'jpeg', quality: 76, maxBytes: 8_000 },
    metadata: 'safe',
  };
  writeFileSync(
    path.join(directory, 'manifest.json'),
    `${JSON.stringify({
      schemaVersion: 3,
      status: 'passed',
      packageVersion: '0.4.0',
      sourceCommit: SHA,
      platform,
      options,
      result: { width: 100, height: 160 },
      visualAgreement: createDemoVisualAgreementReport({
        sourceBytes,
        outputBytes,
        sourceWidth: 600,
        sourceHeight: 960,
        width: 100,
        height: 160,
        resizeMode: 'contain',
        maxWidth: 160,
        maxHeight: 160,
        uprightSimilarity: 0.95,
        verticalFlipSimilarity: 0.7,
      }),
      assets: Object.fromEntries(
        Object.entries(files).map(([name, file]) => {
          const bytes = readFileSync(path.join(directory, file));
          return [name, {
            file,
            byteSize: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex'),
          }];
        })
      ),
    })}\n`
  );
  return directory;
}
