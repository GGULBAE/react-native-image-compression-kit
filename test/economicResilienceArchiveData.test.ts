import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadEconomicArchiveSnapshot } from '../website/.vitepress/economicArchiveData';

const roots: string[] = [];
const SHA = 'a'.repeat(40);

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe('economic resilience page archive data', () => {
  it('renders the honest empty methodology state without an archive', () => {
    expect(loadEconomicArchiveSnapshot(temporaryWebsite())).toEqual({ kind: 'empty' });
  });

  it('derives every displayed result and asset identity from the latest index entry', () => {
    const website = temporaryWebsite();
    const archive = path.join(website, 'public/evidence/economic-resilience');
    const root = path.join(archive, 'source-tree', SHA);
    mkdirSync(path.join(root, 'artifacts'), { recursive: true });
    writeJson(path.join(archive, 'index.json'), {
      captures: [{
        sourceCommit: SHA,
        runId: 42,
        captureSetPath: `source-tree/${SHA}/capture-set.json`,
      }],
    });
    writeJson(path.join(root, 'capture-set.json'), {
      sourceCommit: SHA,
      workflow: {
        runId: 42,
        runAttempt: 3,
        runUrl:
          'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/42',
      },
    });
    for (const [platform, offset] of [['android', 0], ['ios', 1]] as const) {
      const platformRoot = path.join(root, platform);
      mkdirSync(platformRoot);
      writeJson(path.join(platformRoot, 'economic-resilience.json'), {
        economics: {
          sourceBytes: 1_721_333,
          outputBytes: 400_000 + offset,
          sourceToOutputByteDifference: 1_321_333 - offset,
        },
        cleanup: {
          attemptedPackageOutputs: 12,
          removedPackageOutputs: 12,
          residualPackageOutputBytes: 0,
        },
      });
      writeJson(path.join(platformRoot, 'visual-agreement.json'), {
        uprightSimilarity: 0.98 - offset * 0.01,
        verticalFlipSimilarity: 0.5,
      });
      writeFileSync(path.join(platformRoot, 'source.jpg'), 'source');
      writeFileSync(path.join(platformRoot, 'output.jpg'), 'output');
      writeFileSync(path.join(root, 'artifacts', `${platform}.zip`), 'zip');
    }

    expect(loadEconomicArchiveSnapshot(website)).toEqual({
      kind: 'available',
      count: 1,
      sourceCommit: SHA,
      runId: 42,
      runAttempt: 3,
      runUrl:
        'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/42',
      platforms: [
        {
          platform: 'android',
          root: `source-tree/${SHA}`,
          sourceBytes: 1_721_333,
          outputBytes: 400_000,
          sourceToOutputByteDifference: 1_321_333,
          uprightSimilarity: 0.98,
          verticalFlipSimilarity: 0.5,
          attemptedPackageOutputs: 12,
          removedPackageOutputs: 12,
          residualPackageOutputBytes: 0,
        },
        expect.objectContaining({
          platform: 'ios',
          outputBytes: 400_001,
          sourceToOutputByteDifference: 1_321_332,
          uprightSimilarity: 0.97,
        }),
      ],
    });
  });

  it('fails closed instead of presenting a partial available snapshot', () => {
    const website = temporaryWebsite();
    const archive = path.join(website, 'public/evidence/economic-resilience');
    mkdirSync(archive, { recursive: true });
    writeJson(path.join(archive, 'index.json'), {
      captures: [{
        sourceCommit: SHA,
        runId: 42,
        captureSetPath: `source-tree/${SHA}/capture-set.json`,
      }],
    });
    expect(() => loadEconomicArchiveSnapshot(website)).toThrow();
  });
});

function temporaryWebsite() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rnick-economic-page-'));
  roots.push(root);
  return root;
}

function writeJson(file: string, value: unknown) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
