#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = 'android/src/test/assets/heic-heif/manifest.json';
const CHECK_ONLY = process.argv.includes('--check');

function main() {
  const manifest = readJson(MANIFEST_PATH);
  const source = validateSource(manifest.source);
  validateGeneratedFixturePlan(manifest, source, {
    requireCommittedFixtures: CHECK_ONLY,
  });

  if (CHECK_ONLY) {
    console.log(
      `HEIC/HEIF fixture manifest OK: ${source.path} ${source.width}x${source.height} ${source.byteSize} bytes`
    );
    return;
  }

  const encoder = resolveCommand('heif-enc');

  if (!encoder) {
    fail(
      'heif-enc was not found. Install libheif tools, then rerun pnpm fixtures:heic-heif.'
    );
  }

  manifest.generatedFixtures.forEach((fixture) => {
    generateFixture(fixture, source, encoder);
  });
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

function validateGeneratedFixturePlan(
  manifest,
  source,
  options = { requireCommittedFixtures: false }
) {
  if (manifest.schemaVersion !== 1) {
    fail(`schemaVersion must be 1, got ${manifest.schemaVersion}`);
  }
  if (!Array.isArray(manifest.generatedFixtures) || manifest.generatedFixtures.length !== 2) {
    fail('manifest.generatedFixtures must define exactly sample.heic and sample.heif');
  }

  const formats = manifest.generatedFixtures.map((fixture) => fixture.format).sort();
  if (formats.join(',') !== 'heic,heif') {
    fail(`generated fixture formats must be heic and heif, got ${formats.join(',')}`);
  }

  manifest.generatedFixtures.forEach((fixture) => {
    requireString(fixture.format, 'generatedFixtures[].format');
    requireString(fixture.targetPath, `${fixture.format}.targetPath`);
    requireString(fixture.generationCommand, `${fixture.format}.generationCommand`);
    requireString(fixture.sourcePath, `${fixture.format}.sourcePath`);
    requireNumber(fixture.quality, `${fixture.format}.quality`);
    requireNumber(fixture.dimensions?.width, `${fixture.format}.dimensions.width`);
    requireNumber(fixture.dimensions?.height, `${fixture.format}.dimensions.height`);
    requireString(fixture.provenance?.generator, `${fixture.format}.provenance.generator`);
    requireString(fixture.provenance?.generatorVersion, `${fixture.format}.provenance.generatorVersion`);
    requireString(fixture.provenance?.source, `${fixture.format}.provenance.source`);
    requireString(fixture.provenance?.license, `${fixture.format}.provenance.license`);
    requireString(fixture.provenance?.status, `${fixture.format}.provenance.status`);

    const expectedFileName = `sample.${fixture.format}`;

    if (fixture.sourcePath !== source.path) {
      fail(`${fixture.format}.sourcePath must match source.path`);
    }
    if (!fixture.targetPath.endsWith(`/${expectedFileName}`)) {
      fail(`${fixture.format}.targetPath must end with /${expectedFileName}`);
    }
    if (
      fixture.dimensions.width !== source.width ||
      fixture.dimensions.height !== source.height
    ) {
      fail(`${fixture.format}.dimensions must match source dimensions`);
    }
    if (typeof fixture.byteSize !== 'number' || !Number.isFinite(fixture.byteSize)) {
      fail(`${fixture.format}.byteSize must be recorded for committed binary fixtures`);
    }
    if (typeof fixture.sha256 !== 'string' || fixture.sha256.length === 0) {
      fail(`${fixture.format}.sha256 must be recorded for committed binary fixtures`);
    }
    if (options.requireCommittedFixtures) {
      validateCommittedFixture(fixture);
    }
    if (!fixture.generationCommand.includes(`source.png -o ${expectedFileName}`)) {
      fail(`${fixture.format}.generationCommand must write ${expectedFileName}`);
    }
  });

  requireString(manifest.validation?.checkCommand, 'validation.checkCommand');
  requireString(manifest.validation?.generationCommand, 'validation.generationCommand');
  requireString(manifest.validation?.runtimeStatus, 'validation.runtimeStatus');
}

function validateCommittedFixture(fixture) {
  const bytes = readFileSync(resolveRepoPath(fixture.targetPath));
  const actualByteSize = bytes.length;
  const actualSha256 = hash(bytes);

  if (actualByteSize !== fixture.byteSize) {
    fail(
      `${fixture.format}.byteSize mismatch: manifest ${fixture.byteSize}, actual ${actualByteSize}`
    );
  }
  if (actualSha256 !== fixture.sha256) {
    fail(
      `${fixture.format}.sha256 mismatch: manifest ${fixture.sha256}, actual ${actualSha256}`
    );
  }
}

function generateFixture(fixture, source, encoder) {
  const targetPath = resolveRepoPath(fixture.targetPath);
  mkdirSync(path.dirname(targetPath), { recursive: true });

  const args = [
    '--quality',
    String(fixture.quality),
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
    fail(`heif-enc failed for ${fixture.format}`);
  }

  const bytes = readFileSync(targetPath);
  const byteSize = statSync(targetPath).size;
  const sha256 = hash(bytes);

  console.log(
    `${fixture.targetPath}: ${byteSize} bytes sha256=${sha256}`
  );

  if (byteSize !== fixture.byteSize || sha256 !== fixture.sha256) {
    fail(
      `${fixture.format} generated output differs from manifest; update byteSize, sha256, and provenance before committing`
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
