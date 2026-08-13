import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PUBLIC_ECONOMIC_RESILIENCE_MAX_MEMBER_BYTES,
  PUBLIC_ECONOMIC_RESILIENCE_NATIVE_ARTIFACT_MEMBERS,
  inspectPublicEconomicResilienceArtifactZip,
} from '../scripts/public-economic-resilience-zip.mjs';

const roots = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

describe('retained public economic artifact ZIP safety', () => {
  it('accepts the exact regular member inventory and bounded CRC replay', () => {
    const fixture = createZip();
    const report = inspectPublicEconomicResilienceArtifactZip(fixture.zip);
    expect([...report.members.keys()].sort()).toEqual(
      PUBLIC_ECONOMIC_RESILIENCE_NATIVE_ARTIFACT_MEMBERS
    );
    expect(report.totalUncompressedBytes).toBeGreaterThan(0);
  });

  it('rejects extra members and symlink members', () => {
    const extra = createZip({ extra: true });
    expect(() => inspectPublicEconomicResilienceArtifactZip(extra.zip)).toThrow(
      'member shape is invalid'
    );

    const linked = createNativeRoot();
    const target = path.join(path.dirname(linked.root), 'outside-source.jpg');
    writeFileSync(target, 'outside');
    const source = path.join(linked.root, 'source.jpg');
    unlinkSync(source);
    symlinkSync(target, source);
    const linkedZip = path.join(path.dirname(linked.root), 'linked.zip');
    zip(linked.root, linkedZip, ['-y']);
    expect(() => inspectPublicEconomicResilienceArtifactZip(linkedZip)).toThrow(
      'not a regular file: source.jpg'
    );
  });

  it('rejects an oversized member before extraction and a CRC-corrupted member', () => {
    const oversized = createNativeRoot();
    truncateSync(
      path.join(oversized.root, 'source.jpg'),
      PUBLIC_ECONOMIC_RESILIENCE_MAX_MEMBER_BYTES + 1
    );
    const oversizedZip = path.join(path.dirname(oversized.root), 'oversized.zip');
    zip(oversized.root, oversizedZip);
    expect(() => inspectPublicEconomicResilienceArtifactZip(oversizedZip)).toThrow(
      'member size is invalid: source.jpg'
    );

    const corrupted = createZip({ stored: true });
    const bytes = readFileSync(corrupted.zip);
    const payload = Buffer.from('payload-source.jpg');
    const offset = bytes.indexOf(payload);
    expect(offset).toBeGreaterThan(0);
    bytes[offset] ^= 0xff;
    writeFileSync(corrupted.zip, bytes);
    expect(() => inspectPublicEconomicResilienceArtifactZip(corrupted.zip)).toThrow(
      'artifact ZIP member source.jpg failed'
    );
  });
});

function createZip({ extra = false, stored = false } = {}) {
  const fixture = createNativeRoot();
  if (extra) writeFileSync(path.join(fixture.root, 'extra.txt'), 'extra');
  const output = path.join(path.dirname(fixture.root), `artifact-${Date.now()}.zip`);
  zip(fixture.root, output, [
    ...(stored ? ['-0'] : []),
    ...(extra ? ['extra.txt'] : []),
  ]);
  return { ...fixture, zip: output };
}

function createNativeRoot() {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-public-zip-'));
  roots.push(parent);
  const root = path.join(parent, 'native');
  mkdirSync(root);
  for (const member of PUBLIC_ECONOMIC_RESILIENCE_NATIVE_ARTIFACT_MEMBERS) {
    const file = path.join(root, member);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `payload-${member}`);
  }
  return { parent, root };
}

function zip(root, output, options = []) {
  const extraMembers = options.filter((option) => !option.startsWith('-'));
  const flags = options.filter((option) => option.startsWith('-'));
  const result = spawnSync(
    'zip',
    ['-q', '-X', ...flags, output,
      ...PUBLIC_ECONOMIC_RESILIENCE_NATIVE_ARTIFACT_MEMBERS,
      ...extraMembers],
    { cwd: root, encoding: 'utf8' }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}
