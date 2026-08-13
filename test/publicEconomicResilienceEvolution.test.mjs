import { describe, expect, it } from 'vitest';
import { inspectPublicEconomicResilienceEvolution } from '../scripts/public-economic-resilience-evolution-core.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const capture = (sha, runId) => ({
  sourceCommit: sha,
  runId,
  captureSetPath: `source-tree/${sha}/capture-set.json`,
});
const index = (captures) => ({
  schemaVersion: 1,
  archive: 'economic-resilience-source-tree-v1',
  captures,
});
const baseIndex = index([capture(A, 1)]);
const baseFiles = new Map([
  ['index.json', Buffer.from('base-index')],
  [`source-tree/${A}/capture-set.json`, Buffer.from('capture')],
  [`source-tree/${A}/artifacts/android.zip`, Buffer.from('zip')],
]);

describe('public economic resilience revision evolution', () => {
  it('accepts only an exact historical prefix plus a full-SHA suffix', () => {
    expect(check({
      currentIndex: index([capture(A, 1), capture(B, 2)]),
      currentFiles: new Map([...baseFiles, [
        `source-tree/${B}/capture-set.json`, Buffer.from('new'),
      ]]),
    })).toEqual([]);
  });

  it.each([
    ['deleted archive', {
      currentArchivePresent: false,
      currentIndex: index([]),
      currentFiles: new Map(),
    }, 'archive was removed'],
    ['subset rewrite', {
      currentIndex: index([]),
      currentFiles: new Map(baseFiles),
    }, 'history was truncated'],
    ['reordered captures', {
      currentIndex: index([capture(B, 2), capture(A, 1)]),
      currentFiles: new Map(baseFiles),
    }, 'not an exact ordered prefix'],
    ['modified bytes', {
      currentIndex: baseIndex,
      currentFiles: new Map([...baseFiles].map(([name, bytes]) => [
        name,
        name.endsWith('android.zip') ? Buffer.from('changed') : bytes,
      ])),
    }, 'file changed'],
    ['modified metadata', {
      currentIndex: baseIndex,
      currentFiles: new Map([...baseFiles].map(([name, bytes]) => [
        name,
        name.endsWith('capture-set.json') ? Buffer.from('changed') : bytes,
      ])),
    }, 'file changed'],
    ['removed retained file', {
      currentIndex: baseIndex,
      currentFiles: new Map([['index.json', Buffer.from('current')]]),
    }, 'file was removed'],
  ])('rejects %s', (_name, overrides, expected) => {
    expect(check(overrides).join(' | ')).toContain(expected);
  });

  it('treats a missing base archive as first publication', () => {
    expect(inspectPublicEconomicResilienceEvolution({
      baseArchivePresent: false,
      currentArchivePresent: true,
      baseIndex: index([]),
      currentIndex: baseIndex,
      baseFiles: new Map(),
      currentFiles: baseFiles,
    })).toEqual([]);
  });

  it('labels malformed base and current indexes before comparing bytes', () => {
    expect(inspectPublicEconomicResilienceEvolution({
      baseArchivePresent: true,
      currentArchivePresent: true,
      baseIndex: {},
      currentIndex: {},
      baseFiles: new Map(),
      currentFiles: new Map(),
    }).join(' | ')).toContain('base archive: public economic resilience index fields drifted');
    expect(inspectPublicEconomicResilienceEvolution({
      baseArchivePresent: true,
      currentArchivePresent: true,
      baseIndex: {},
      currentIndex: {},
      baseFiles: new Map(),
      currentFiles: new Map(),
    }).join(' | ')).toContain('current archive: public economic resilience index fields drifted');
  });
});

function check(overrides = {}) {
  return inspectPublicEconomicResilienceEvolution({
    baseArchivePresent: true,
    currentArchivePresent: true,
    baseIndex,
    currentIndex: baseIndex,
    baseFiles,
    currentFiles: new Map(baseFiles),
    ...overrides,
  });
}
