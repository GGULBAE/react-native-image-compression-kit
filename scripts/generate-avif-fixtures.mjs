#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = 'android/src/test/assets/avif/manifest.json';
const CHECK_ONLY = process.argv.includes('--check');

function main() {
  const manifest = readJson(MANIFEST_PATH);
  const source = validateSource(manifest.source);
  const fixture = validateAvifFixturePlan(manifest, source, {
    requireCommittedFixture: CHECK_ONLY,
  });

  if (CHECK_ONLY) {
    console.log(
      `AVIF fixture manifest OK: ${source.path} ${source.width}x${source.height} ${source.byteSize} bytes`
    );
    return;
  }

  const encoder = resolveCommand('heif-enc');

  if (!encoder) {
    fail('heif-enc was not found. Install libheif tools, then rerun pnpm fixtures:avif.');
  }

  generateFixture(fixture, source, encoder);
}

function validateSource(source) {
  requireString(source?.path, 'source.path');
  requireString(source?.format, 'source.format');
  requireNumber(source?.byteSize, 'source.byteSize');
  requireString(source?.sha256, 'source.sha256');
  requireNumber(source?.dimensions?.width, 'source.dimensions.width');
  requireNumber(source?.dimensions?.height, 'source.dimensions.height');
  requireString(source?.provenance?.owner, 'source.provenance.owner');
  requireString(source?.provenance?.license, 'source.provenance.license');
  requireString(source?.provenance?.description, 'source.provenance.description');

  if (source.format !== 'png') {
    fail(`source.format must be png, got ${source.format}`);
  }

  const resolvedPath = resolveRepoPath(source.path);
  const bytes = readFileSync(resolvedPath);
  const dimensions = readPngDimensions(bytes);
  const sha256 = hash(bytes);

  if (bytes.length !== source.byteSize) {
    fail(`source.byteSize mismatch: manifest ${source.byteSize}, actual ${bytes.length}`);
  }
  if (sha256 !== source.sha256) {
    fail(`source.sha256 mismatch: manifest ${source.sha256}, actual ${sha256}`);
  }
  if (
    dimensions.width !== source.dimensions.width ||
    dimensions.height !== source.dimensions.height
  ) {
    fail(
      `source dimensions mismatch: manifest ${source.dimensions.width}x${source.dimensions.height}, actual ${dimensions.width}x${dimensions.height}`
    );
  }

  return {
    path: source.path,
    resolvedPath,
    byteSize: bytes.length,
    sha256,
    width: dimensions.width,
    height: dimensions.height,
  };
}

function validateAvifFixturePlan(
  manifest,
  source,
  options = { requireCommittedFixture: false }
) {
  if (manifest.schemaVersion !== 1) {
    fail(`schemaVersion must be 1, got ${manifest.schemaVersion}`);
  }
  if (!Array.isArray(manifest.generatedFixtures) || manifest.generatedFixtures.length !== 1) {
    fail('manifest.generatedFixtures must define exactly sample.avif');
  }

  const fixture = manifest.generatedFixtures[0];

  requireString(fixture?.format, 'generatedFixtures[].format');
  requireString(fixture?.targetPath, 'avif.targetPath');
  requireString(fixture?.generationCommand, 'avif.generationCommand');
  requireString(fixture?.sourcePath, 'avif.sourcePath');
  requireNumber(fixture?.quality, 'avif.quality');
  requireNumber(fixture?.dimensions?.width, 'avif.dimensions.width');
  requireNumber(fixture?.dimensions?.height, 'avif.dimensions.height');
  requireString(fixture?.provenance?.generator, 'avif.provenance.generator');
  requireString(fixture?.provenance?.generatorVersion, 'avif.provenance.generatorVersion');
  requireString(fixture?.provenance?.source, 'avif.provenance.source');
  requireString(fixture?.provenance?.license, 'avif.provenance.license');
  requireString(fixture?.provenance?.status, 'avif.provenance.status');

  if (fixture.format !== 'avif') {
    fail(`generated fixture format must be avif, got ${fixture.format}`);
  }
  if (fixture.sourcePath !== source.path) {
    fail('avif.sourcePath must match source.path');
  }
  if (!fixture.targetPath.endsWith('/sample.avif')) {
    fail('avif.targetPath must end with /sample.avif');
  }
  if (
    fixture.dimensions.width !== source.width ||
    fixture.dimensions.height !== source.height
  ) {
    fail('avif.dimensions must match source dimensions');
  }
  if (typeof fixture.byteSize !== 'number' || !Number.isFinite(fixture.byteSize)) {
    fail('avif.byteSize must be recorded for committed binary fixtures');
  }
  if (typeof fixture.sha256 !== 'string' || fixture.sha256.length === 0) {
    fail('avif.sha256 must be recorded for committed binary fixtures');
  }
  if (!fixture.generationCommand.includes('heif-enc --quality 80 --avif source.png -o sample.avif')) {
    fail('avif.generationCommand must write sample.avif with --avif');
  }
  if (options.requireCommittedFixture) {
    validateCommittedFixture(fixture);
  }

  requireString(manifest.validation?.checkCommand, 'validation.checkCommand');
  requireString(manifest.validation?.generationCommand, 'validation.generationCommand');
  requireString(manifest.validation?.runtimeStatus, 'validation.runtimeStatus');

  return fixture;
}

function validateCommittedFixture(fixture) {
  const bytes = readFileSync(resolveRepoPath(fixture.targetPath));
  const actualByteSize = bytes.length;
  const actualSha256 = hash(bytes);

  if (actualByteSize !== fixture.byteSize) {
    fail(`avif.byteSize mismatch: manifest ${fixture.byteSize}, actual ${actualByteSize}`);
  }
  if (actualSha256 !== fixture.sha256) {
    fail(`avif.sha256 mismatch: manifest ${fixture.sha256}, actual ${actualSha256}`);
  }
}

function generateFixture(fixture, source, encoder) {
  const targetPath = resolveRepoPath(fixture.targetPath);
  mkdirSync(path.dirname(targetPath), { recursive: true });

  const args = [
    '--quality',
    String(fixture.quality),
    '--avif',
    source.resolvedPath,
    '-o',
    targetPath,
  ];
  const result = spawnSync(encoder, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    fail('heif-enc failed for avif');
  }

  const bytes = readFileSync(targetPath);
  const byteSize = statSync(targetPath).size;
  const sha256 = hash(bytes);

  console.log(`${fixture.targetPath}: ${byteSize} bytes sha256=${sha256}`);

  if (byteSize !== fixture.byteSize || sha256 !== fixture.sha256) {
    fail(
      'avif generated output differs from manifest; update byteSize, sha256, and provenance before committing'
    );
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(resolveRepoPath(filePath), 'utf8'));
}

function resolveRepoPath(filePath) {
  const resolvedPath = path.resolve(ROOT, filePath);

  if (!resolvedPath.startsWith(`${ROOT}${path.sep}`)) {
    fail(`Path escapes repository root: ${filePath}`);
  }

  return resolvedPath;
}

function readPngDimensions(bytes) {
  const pngSignature = '89504e470d0a1a0a';

  if (bytes.subarray(0, 8).toString('hex') !== pngSignature) {
    fail('source.png must be a PNG file');
  }
  if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
    fail('source.png is missing an IHDR chunk');
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function resolveCommand(command) {
  const result = spawnSync(command, ['--help'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  return result.error ? null : command;
}

function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${fieldName} must be a non-empty string`);
  }
}

function requireNumber(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${fieldName} must be a finite number`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

main();
