#!/usr/bin/env node

import {
  existsSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ECONOMIC_RESILIENCE_ASSET_FILES,
  inspectEconomicResilienceEvidence,
} from './economic-resilience-evidence-core.mjs';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

const options = parseArgs(process.argv.slice(2));
if (!options.artifactDir) throw new Error('--artifact-dir is required');
const artifactDir = secureArtifactRoot(options.artifactDir);
const reportFile = options.reportFile
  ? secureReportDestination(options.reportFile, artifactDir)
  : null;
preflightArtifact(artifactDir);
const evidence = JSON.parse(
  readFileSync(path.join(artifactDir, 'economic-resilience.json'), 'utf8')
);
const structuralReport = inspectEconomicResilienceEvidence(artifactDir, evidence);
let report = {
  ...structuralReport,
  replay: {
    status: 'not-run',
    localFfmpegVersion: null,
    capturedFfmpegVersion: evidence?.environment?.toolchain?.ffmpeg ?? null,
    ffmpegVersionsMatch: null,
    localFfprobeVersion: null,
    capturedFfprobeVersion: evidence?.environment?.toolchain?.ffprobe ?? null,
    ffprobeVersionsMatch: null,
    measurementMatch: null,
  },
};
if (structuralReport.status === 'passed') {
  try {
    const replay = replayVisualAgreement(artifactDir, evidence);
    report = { ...structuralReport, replay };
  } catch (error) {
    report = {
      ...structuralReport,
      status: 'failed',
      representative: null,
      economics: null,
      replay: {
        status: 'failed',
        localFfmpegVersion: error.localFfmpegVersion ?? null,
        capturedFfmpegVersion: evidence?.environment?.toolchain?.ffmpeg ?? null,
        ffmpegVersionsMatch:
          error.localFfmpegVersion === undefined
            ? null
            : error.localFfmpegVersion === evidence?.environment?.toolchain?.ffmpeg,
        localFfprobeVersion: error.localFfprobeVersion ?? null,
        capturedFfprobeVersion: evidence?.environment?.toolchain?.ffprobe ?? null,
        ffprobeVersionsMatch:
          error.localFfprobeVersion === undefined
            ? null
            : error.localFfprobeVersion === evidence?.environment?.toolchain?.ffprobe,
        measurementMatch: false,
      },
      error: `visual replay failed: ${error.message}`,
    };
  }
}
const serialized = `${JSON.stringify(report)}\n`;
if (reportFile) writeReportAtomic(reportFile, serialized);
process.stdout.write(serialized);
if (report.status !== 'passed') process.exitCode = 1;

function replayVisualAgreement(root, evidence) {
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'rnick-visual-replay-'));
  const replay = path.join(temporary, 'visual-agreement.json');
  try {
    const version = spawnSync('ffmpeg', ['-version'], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    if (version.error) throw version.error;
    if (version.status !== 0) throw new Error(version.stderr.trim());
    const versionLine = version.stdout.split(/\r?\n/, 1)[0];
    const probeVersion = spawnSync('ffprobe', ['-version'], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    if (probeVersion.error) throw probeVersion.error;
    if (probeVersion.status !== 0) throw new Error(probeVersion.stderr.trim());
    const probeVersionLine = probeVersion.stdout.split(/\r?\n/, 1)[0];
    const result = spawnSync(
      process.execPath,
      [
        path.join(SCRIPT_DIRECTORY, 'measure-demo-visual-agreement.mjs'),
        '--source',
        path.join(root, 'source.jpg'),
        '--output',
        path.join(root, 'output.jpg'),
        '--resize-mode',
        'contain',
        '--max-width',
        '1600',
        '--max-height',
        '1200',
        '--report',
        replay,
      ],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
    );
    if (result.error) throw result.error;
    if (result.status !== 0 || !existsSync(replay)) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || 'measurement failed');
    }
    const measured = JSON.parse(readFileSync(replay, 'utf8'));
    if (JSON.stringify(measured) !== JSON.stringify(evidence.visualAgreement)) {
      const error = new Error('replayed SSIM, flip control, geometry, or hashes differ');
      error.localFfmpegVersion = versionLine;
      error.localFfprobeVersion = probeVersionLine;
      throw error;
    }
    return {
      status: 'passed',
      localFfmpegVersion: versionLine,
      capturedFfmpegVersion: evidence.environment.toolchain.ffmpeg,
      ffmpegVersionsMatch: versionLine === evidence.environment.toolchain.ffmpeg,
      localFfprobeVersion: probeVersionLine,
      capturedFfprobeVersion: evidence.environment.toolchain.ffprobe,
      ffprobeVersionsMatch: probeVersionLine === evidence.environment.toolchain.ffprobe,
      measurementMatch: true,
    };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function secureArtifactRoot(value) {
  const requested = path.resolve(value);
  const status = lstatSync(requested);
  if (!status.isDirectory() || status.isSymbolicLink()) {
    throw new Error('--artifact-dir must be a regular non-symlink directory');
  }
  return realpathSync(requested);
}

function preflightArtifact(root) {
  const entries = readdirSync(root).sort();
  if (JSON.stringify(entries) !== JSON.stringify(ECONOMIC_RESILIENCE_ASSET_FILES)) {
    throw new Error('artifact must contain the exact economic resilience asset set');
  }
  for (const entry of entries) {
    const candidate = path.join(root, entry);
    const status = lstatSync(candidate);
    if (!status.isFile() || status.isSymbolicLink()) {
      throw new Error(`artifact entry must be a regular non-symlink file: ${entry}`);
    }
  }
}

function secureReportDestination(value, artifactRoot) {
  const requested = path.resolve(value);
  const requestedParent = path.dirname(requested);
  const requestedParentStatus = lstatSync(requestedParent);
  const canonicalParent = realpathSync(requestedParent);
  const parentStatus = lstatSync(canonicalParent);
  if (
    !requestedParentStatus.isDirectory() ||
    requestedParentStatus.isSymbolicLink() ||
    !parentStatus.isDirectory() ||
    parentStatus.isSymbolicLink()
  ) {
    throw new Error('--report-file parent must resolve to a regular directory');
  }
  const destination = path.join(canonicalParent, path.basename(requested));
  if (
    destination === artifactRoot ||
    destination.startsWith(`${artifactRoot}${path.sep}`)
  ) {
    throw new Error('--report-file must be outside the artifact directory');
  }
  try {
    lstatSync(destination);
    throw new Error('--report-file must not already exist');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return destination;
}

function writeReportAtomic(destination, contents) {
  const temporary = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    writeFileSync(temporary, contents, { flag: 'wx', mode: 0o600 });
    // A same-filesystem hard link atomically publishes complete bytes and,
    // unlike rename(), refuses to replace a destination created in a race.
    linkSync(temporary, destination);
  } finally {
    try {
      unlinkSync(temporary);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

function parseArgs(args) {
  const parsed = {};
  const normalizedArgs = args.filter((value) => value !== '--');
  for (let index = 0; index < normalizedArgs.length; index += 2) {
    const flag = normalizedArgs[index];
    const value = normalizedArgs[index + 1];
    if (!flag?.startsWith('--') || !value) {
      throw new Error(`invalid argument: ${flag ?? ''}`);
    }
    parsed[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] =
      value;
  }
  return parsed;
}
