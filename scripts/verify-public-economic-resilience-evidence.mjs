#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ROOT,
  inspectPublicEconomicResilienceArchive,
} from './public-economic-resilience-evidence-core.mjs';
import { replayEconomicResilienceArtifact } from './economic-resilience-replay.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = parseArgs(process.argv.slice(2));
const archiveRoot = path.resolve(
  options.archiveRoot ??
    path.join(repositoryRoot, PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ROOT)
);
const structural = inspectPublicEconomicResilienceArchive(archiveRoot);
const replay = [];
const errors = [];
if (structural.status === 'passed') {
  for (const capture of structural.captures) {
    for (const platform of ['android', 'ios']) {
      const artifactRoot = path.join(
        archiveRoot,
        capture.platforms[platform].artifactPath
      );
      try {
        const report = replayEconomicResilienceArtifact(artifactRoot);
        replay.push({
          sourceCommit: capture.sourceCommit,
          platform,
          status: 'passed',
          measurementMode: report.replay.measurementMode,
          measurementTolerance: report.replay.measurementTolerance,
        });
      } catch (error) {
        errors.push(
          `${capture.sourceCommit} ${platform}: ${error.message}`
        );
      }
    }
  }
}
const report = {
  ...structural,
  status:
    structural.status === 'passed' && errors.length === 0 ? 'passed' : 'failed',
  replay,
  error:
    structural.error ?? (errors.length > 0 ? errors.join(' | ') : null),
};
process.stdout.write(`${JSON.stringify(report)}\n`);
if (report.status !== 'passed') process.exitCode = 1;

function parseArgs(args) {
  const parsed = {};
  const values = args.filter((value) => value !== '--');
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    if (flag !== '--archive-root' || !value) {
      throw new Error(`invalid argument: ${flag ?? ''}`);
    }
    if (parsed.archiveRoot !== undefined) {
      throw new Error('duplicate argument: --archive-root');
    }
    parsed.archiveRoot = value;
  }
  return parsed;
}
