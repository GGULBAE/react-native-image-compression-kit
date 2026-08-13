#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ROOT,
  PUBLIC_ECONOMIC_RESILIENCE_INDEX_FILE,
  inspectPublicEconomicResilienceArchive,
} from './public-economic-resilience-evidence-core.mjs';
import { inspectPublicEconomicResilienceEvolution } from './public-economic-resilience-evolution-core.mjs';
import { acquirePublicEconomicResilienceRun } from './public-economic-resilience-github.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = parseArgs(process.argv.slice(2));
if (!options.base) throw new Error('--base is required');
if (/^0{40}$/u.test(options.base)) {
  process.stdout.write(`${JSON.stringify({status: 'passed', evolutionState: 'skipped-zero-base'})}\n`);
  process.exit(0);
}
if (!/^[0-9a-f]{40}$/u.test(options.base)) {
  throw new Error('--base must be a full lowercase commit SHA');
}
mustGit(['cat-file', '-e', `${options.base}^{commit}`], 'comparison base commit');

const archiveRoot = path.join(repositoryRoot, PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ROOT);
const currentReport = inspectPublicEconomicResilienceArchive(archiveRoot);
if (currentReport.status !== 'passed') throw new Error(currentReport.error);
const baseEntries = readBaseEntries(options.base);
const baseArchivePresent = baseEntries.length > 0;
const currentIndexPath = path.join(archiveRoot, PUBLIC_ECONOMIC_RESILIENCE_INDEX_FILE);
const currentArchivePresent = existsSync(currentIndexPath);
const baseFiles = new Map();
for (const entry of baseEntries) {
  if (entry.mode !== '100644' && entry.mode !== '100755') {
    throw new Error(`base public economic resilience entry is not a regular file: ${entry.path}`);
  }
  baseFiles.set(entry.relativePath, mustGitBytes(['show', `${options.base}:${entry.path}`], entry.path));
}
const currentFiles = currentArchivePresent
  ? readCurrentFiles(archiveRoot, baseFiles.keys())
  : new Map();
const baseIndexBytes = baseFiles.get(PUBLIC_ECONOMIC_RESILIENCE_INDEX_FILE);
if (baseArchivePresent && !baseIndexBytes) {
  throw new Error('base public economic resilience archive index is missing');
}
const baseIndex = baseIndexBytes
  ? JSON.parse(baseIndexBytes.toString('utf8'))
  : { schemaVersion: 1, archive: 'economic-resilience-source-tree-v1', captures: [] };
const currentIndex = currentArchivePresent
  ? JSON.parse(readSecureFile(currentIndexPath, 'current archive index').toString('utf8'))
  : { schemaVersion: 1, archive: 'economic-resilience-source-tree-v1', captures: [] };
const errors = inspectPublicEconomicResilienceEvolution({
  baseArchivePresent,
  currentArchivePresent,
  baseIndex,
  currentIndex,
  baseFiles,
  currentFiles,
});
if (errors.length === 0) {
  for (const entry of currentIndex.captures.slice(baseIndex.captures.length)) {
    verifyNewCaptureAgainstGitHub(entry, archiveRoot);
  }
}
const report = {
  status: errors.length === 0 ? 'passed' : 'failed',
  evolutionState: baseArchivePresent ? 'compared' : 'first-publication',
  base: options.base,
  preservedFileCount: baseFiles.size - (baseFiles.has('index.json') ? 1 : 0),
  previousCaptureCount: baseIndex.captures.length,
  currentCaptureCount: currentIndex.captures.length,
  error: errors.length > 0 ? errors.join(' | ') : null,
};
process.stdout.write(`${JSON.stringify(report)}\n`);
if (errors.length > 0) process.exitCode = 1;

function verifyNewCaptureAgainstGitHub(entry, archiveRoot) {
  const acquisition = acquirePublicEconomicResilienceRun(entry.runId);
  try {
    if (acquisition.sourceCommit !== entry.sourceCommit) {
      throw new Error('new public economic resilience capture differs from GitHub head SHA');
    }
    const captureRoot = path.join(archiveRoot, 'source-tree', entry.sourceCommit);
    for (const [file, expected] of [
      ['run-metadata.json', acquisition.runMetadataBytes],
      ['artifact-metadata.json', acquisition.artifactMetadataBytes],
    ]) {
      const retained = readSecureFile(
        path.join(captureRoot, file),
        `new capture ${file}`
      );
      if (!retained.equals(expected)) {
        throw new Error(`new public economic resilience ${file} differs from GitHub`);
      }
    }
    for (const platform of ['android', 'ios']) {
      const retained = readSecureFile(
        path.join(captureRoot, 'artifacts', `${platform}.zip`),
        `new capture ${platform} artifact ZIP`
      );
      const downloaded = readSecureFile(
        acquisition.platforms[platform].zipFile,
        `downloaded ${platform} artifact ZIP`
      );
      if (!retained.equals(downloaded)) {
        throw new Error(
          `new public economic resilience ${platform} ZIP differs from GitHub artifact bytes`
        );
      }
    }
  } finally {
    acquisition.cleanup();
  }
}

function readBaseEntries(base) {
  const output = mustGitBytes([
    'ls-tree', '-r', '-z', base, '--', PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ROOT,
  ], 'base archive tree');
  return output.toString('utf8').split('\0').filter(Boolean).map((record) => {
    const match = /^(\d+)\s+(\S+)\s+([0-9a-f]+)\t(.+)$/u.exec(record);
    if (!match || match[2] !== 'blob') {
      throw new Error('base public economic resilience tree entry is invalid');
    }
    const relativePath = path.posix.relative(
      PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ROOT,
      match[4]
    );
    if (!relativePath || relativePath.startsWith('../')) {
      throw new Error('base public economic resilience path escaped its root');
    }
    return { mode: match[1], path: match[4], relativePath };
  });
}

function readCurrentFiles(root, relativePaths) {
  const files = new Map();
  for (const relative of relativePaths) {
    const absolute = path.join(root, ...relative.split('/'));
    if (existsSync(absolute)) {
      files.set(relative, readSecureFile(absolute, `current archive ${relative}`));
    }
  }
  return files;
}

function readSecureFile(file, label) {
  const status = lstatSync(file);
  if (!status.isFile() || status.isSymbolicLink() || status.nlink !== 1) {
    throw new Error(`${label} must be a regular non-symlink file with exactly one hard link`);
  }
  return readFileSync(file);
}

function mustGit(args, label) {
  mustGitBytes(args, label);
}

function mustGitBytes(args, label) {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: null,
    maxBuffer: 256 * 1024 * 1024,
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} cannot be read from Git: ${result.stderr.toString('utf8').trim()}`);
  }
  return result.stdout;
}

function parseArgs(args) {
  const values = args.filter((value) => value !== '--');
  if (values.length !== 2 || values[0] !== '--base' || !values[1]) {
    throw new Error('usage: verify-public-economic-resilience-evolution --base <sha>');
  }
  return { base: values[1] };
}
