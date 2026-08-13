import { existsSync, lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface EconomicArchivePlatformSnapshot {
  platform: 'android' | 'ios';
  root: string;
  sourceBytes: number;
  outputBytes: number;
  sourceToOutputByteDifference: number;
  uprightSimilarity: number;
  verticalFlipSimilarity: number;
  attemptedPackageOutputs: number;
  removedPackageOutputs: number;
  residualPackageOutputBytes: number;
}

export type EconomicArchiveSnapshot =
  | { kind: 'empty' }
  | {
      kind: 'available';
      count: number;
      sourceCommit: string;
      runId: number;
      runAttempt: number;
      runUrl: string;
      platforms: EconomicArchivePlatformSnapshot[];
    };

export function loadEconomicArchiveSnapshot(
  websiteRoot: string
): EconomicArchiveSnapshot {
  const archiveRoot = path.join(
    websiteRoot,
    'public/evidence/economic-resilience'
  );
  const indexPath = path.join(archiveRoot, 'index.json');
  if (!existsSync(indexPath)) return { kind: 'empty' };
  const index = readJson(indexPath, 'economic archive index');
  if (!Array.isArray(index.captures)) {
    throw new Error('economic archive index captures are invalid');
  }
  if (index.captures.length === 0) return { kind: 'empty' };
  const latest = index.captures.at(-1);
  if (
    !latest ||
    !/^[0-9a-f]{40}$/u.test(latest.sourceCommit ?? '') ||
    latest.captureSetPath !==
      `source-tree/${latest.sourceCommit}/capture-set.json`
  ) {
    throw new Error('economic archive latest capture identity is invalid');
  }
  const root = `source-tree/${latest.sourceCommit}`;
  const captureSet = readJson(
    path.join(archiveRoot, root, 'capture-set.json'),
    'economic archive capture-set'
  );
  if (
    captureSet.sourceCommit !== latest.sourceCommit ||
    captureSet.workflow?.runId !== latest.runId ||
    !Number.isSafeInteger(captureSet.workflow?.runAttempt) ||
    captureSet.workflow.runAttempt <= 0 ||
    captureSet.workflow?.runUrl !==
      `https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/${latest.runId}`
  ) {
    throw new Error('economic archive capture-set workflow identity is invalid');
  }
  const platforms = (['android', 'ios'] as const).map((platform) => {
    const platformRoot = path.join(archiveRoot, root, platform);
    const evidence = readJson(
      path.join(platformRoot, 'economic-resilience.json'),
      `${platform} economic evidence`
    );
    const visual = readJson(
      path.join(platformRoot, 'visual-agreement.json'),
      `${platform} visual agreement`
    );
    for (const file of [
      path.join(platformRoot, 'source.jpg'),
      path.join(platformRoot, 'output.jpg'),
      path.join(archiveRoot, root, 'artifacts', `${platform}.zip`),
    ]) {
      assertRegularSingleLink(file, `${platform} public archive asset`);
    }
    const snapshot: EconomicArchivePlatformSnapshot = {
      platform,
      root,
      sourceBytes: evidence.economics?.sourceBytes,
      outputBytes: evidence.economics?.outputBytes,
      sourceToOutputByteDifference:
        evidence.economics?.sourceToOutputByteDifference,
      uprightSimilarity: visual.uprightSimilarity,
      verticalFlipSimilarity: visual.verticalFlipSimilarity,
      attemptedPackageOutputs: evidence.cleanup?.attemptedPackageOutputs,
      removedPackageOutputs: evidence.cleanup?.removedPackageOutputs,
      residualPackageOutputBytes:
        evidence.cleanup?.residualPackageOutputBytes,
    };
    for (const [field, value] of Object.entries(snapshot)) {
      if (field === 'platform' || field === 'root') continue;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${platform} archive snapshot field is invalid: ${field}`);
      }
    }
    return snapshot;
  });
  return {
    kind: 'available',
    count: index.captures.length,
    sourceCommit: latest.sourceCommit,
    runId: latest.runId,
    runAttempt: captureSet.workflow.runAttempt,
    runUrl: captureSet.workflow.runUrl,
    platforms,
  };
}

function readJson(file: string, label: string): any {
  assertRegularSingleLink(file, label);
  return JSON.parse(readFileSync(file, 'utf8'));
}

function assertRegularSingleLink(file: string, label: string) {
  const status = lstatSync(file);
  if (!status.isFile() || status.isSymbolicLink() || status.nlink !== 1) {
    throw new Error(
      `${label} must be a regular non-symlink file with exactly one hard link`
    );
  }
}
