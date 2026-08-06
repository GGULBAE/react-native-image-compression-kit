import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = path.resolve('scripts/merge-demo-evidence.mjs');
const SHA = 'b'.repeat(40);

describe('native demo evidence merge', () => {
  it('assembles schema-v2 platform fragments without a synthetic video', () => {
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
      schemaVersion: 2,
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
  writeFileSync(
    path.join(directory, 'manifest.json'),
    `${JSON.stringify({
      schemaVersion: 2,
      status: 'passed',
      packageVersion: '0.4.0',
      sourceCommit: SHA,
      platform,
      assets: Object.fromEntries(
        Object.entries(files).map(([name, file]) => [name, { file }])
      ),
    })}\n`
  );
  return directory;
}
