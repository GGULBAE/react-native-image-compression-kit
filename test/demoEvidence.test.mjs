import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectDemoEvidence } from '../scripts/demo-evidence-core.mjs';

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
  return {
    root,
    manifest: { schemaVersion: 1, status: 'passed', packageVersion: '0.3.0', sourceCommit: SHA, cases },
  };
}

function asset(file, bytes) {
  return { file, byteSize: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
