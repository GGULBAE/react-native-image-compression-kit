import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

export function replayEconomicResilienceArtifact(artifactDir) {
  const result = spawnSync(
    process.execPath,
    [
      path.join(SCRIPT_DIRECTORY, 'verify-economic-resilience-evidence.mjs'),
      '--artifact-dir',
      path.resolve(artifactDir),
    ],
    {
      cwd: path.resolve(SCRIPT_DIRECTORY, '..'),
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    }
  );
  if (result.error) throw result.error;
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `economic resilience verifier returned invalid JSON: ${error.message}`
    );
  }
  if (
    result.status !== 0 ||
    report?.status !== 'passed' ||
    report?.replay?.status !== 'passed' ||
    report?.replay?.measurementMatch !== true ||
    report?.replay?.outcomesPassed !== true ||
    report?.replay?.exactShapes !== true ||
    report?.replay?.stableFieldsMatch !== true
  ) {
    throw new Error(
      report?.error ||
        result.stderr.trim() ||
        'economic resilience independent visual replay failed'
    );
  }
  return report;
}
