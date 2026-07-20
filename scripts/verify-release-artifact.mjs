#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readReleaseStatusManifest } from './docs-semantic-core.mjs';
import { inspectReleaseArtifact } from './release-artifact-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = parseArgs(process.argv.slice(2));
if (!options.version || !options.sourceSha || !options.tarball) {
  throw new Error(
    'usage: verify-release-artifact --version <x.y.z> --source-sha <sha> --source-branch master --tarball <file> [--report-file <file>]'
  );
}

const tarballPath = path.resolve(options.tarball);
if (!existsSync(tarballPath)) throw new Error(`missing tarball: ${tarballPath}`);
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const status = readReleaseStatusManifest(root);
const bytes = readFileSync(tarballPath);
const inventory = run('tar', ['-tzf', tarballPath])
  .split(/\r?\n/)
  .filter(Boolean)
  .sort();
const tarballPackage = JSON.parse(run('tar', ['-xOf', tarballPath, 'package/package.json']));
const actualSourceSha = run('git', ['rev-parse', 'HEAD']).trim();
const worktreeClean = run('git', ['status', '--porcelain']).trim().length === 0;
const report = inspectReleaseArtifact({
  expectedVersion: options.version,
  packageVersion: packageJson.version,
  tarballPackageVersion: tarballPackage.version,
  expectedSourceSha: options.sourceSha,
  actualSourceSha,
  sourceBranch: options.sourceBranch ?? 'master',
  releaseState: status.releaseState,
  releaseTarget: status.releaseTarget,
  publishedNpmLatest: status.publishedNpmLatest,
  tarballFile: path.basename(tarballPath),
  tarballSize: bytes.length,
  tarballSha256: createHash('sha256').update(bytes).digest('hex'),
  tarballIntegrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
  inventory,
  worktreeClean,
});

const output = `${JSON.stringify(report)}\n`;
if (options.reportFile) writeAtomic(path.resolve(options.reportFile), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);

function parseArgs(args) {
  const parsed = {};
  const fields = {
    '--version': 'version',
    '--source-sha': 'sourceSha',
    '--source-branch': 'sourceBranch',
    '--tarball': 'tarball',
    '--report-file': 'reportFile',
  };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--') continue;
    const field = fields[args[index]];
    if (!field) throw new Error(`unknown release artifact argument: ${args[index]}`);
    parsed[field] = args[++index];
    if (!parsed[field]) throw new Error(`missing value for ${args[index - 1]}`);
  }
  return parsed;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || `${command} exited with ${result.status}`);
  }
  return result.stdout;
}

function writeAtomic(destination, contents) {
  const temporary = `${destination}.tmp-${process.pid}`;
  try {
    writeFileSync(temporary, contents, { flag: 'wx' });
    renameSync(temporary, destination);
  } finally {
    rmSync(temporary, { force: true });
  }
}
