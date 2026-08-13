import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { ECONOMIC_RESILIENCE_ASSET_FILES } from './economic-resilience-evidence-core.mjs';

export const PUBLIC_ECONOMIC_RESILIENCE_MAX_ZIP_BYTES = 64 * 1024 * 1024;
export const PUBLIC_ECONOMIC_RESILIENCE_MAX_MEMBER_BYTES = 32 * 1024 * 1024;
export const PUBLIC_ECONOMIC_RESILIENCE_MAX_UNCOMPRESSED_BYTES =
  128 * 1024 * 1024;

export const PUBLIC_ECONOMIC_RESILIENCE_NATIVE_ARTIFACT_MEMBERS = Object.freeze([
  'benchmark-comparison.json',
  'benchmark.json',
  'comparison-plan.json',
  ...ECONOMIC_RESILIENCE_ASSET_FILES.map(
    (file) => `economic-resilience/${file}`
  ),
  'manifest.json',
  'output.jpg',
  'recording.mp4',
  'screen.png',
  'source.jpg',
].sort());

/**
 * Validates the complete, exact native artifact member inventory and boundedly
 * extracts every member. `unzip -p` exits non-zero on CRC errors, so this also
 * checks CRC without an unbounded whole-archive extraction.
 */
export function inspectPublicEconomicResilienceArtifactZip(
  zipFile,
  { command = spawnSync } = {}
) {
  const listing = command('zipinfo', ['-l', zipFile], {
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
    timeout: 10_000,
  });
  assertCommand(listing, 'artifact ZIP member listing');
  const entries = parseZipinfoListing(listing.stdout);
  const names = entries.map(({ name }) => name);
  if (
    new Set(names).size !== names.length ||
    !isDeepStrictEqual([...names].sort(), [
      ...PUBLIC_ECONOMIC_RESILIENCE_NATIVE_ARTIFACT_MEMBERS,
    ])
  ) {
    throw new Error('artifact ZIP member shape is invalid');
  }
  let totalUncompressedBytes = 0;
  for (const entry of entries) {
    if (entry.mode[0] !== '-') {
      throw new Error(`artifact ZIP member is not a regular file: ${entry.name}`);
    }
    if (
      !Number.isSafeInteger(entry.uncompressedBytes) ||
      entry.uncompressedBytes <= 0 ||
      entry.uncompressedBytes > PUBLIC_ECONOMIC_RESILIENCE_MAX_MEMBER_BYTES
    ) {
      throw new Error(`artifact ZIP member size is invalid: ${entry.name}`);
    }
    totalUncompressedBytes += entry.uncompressedBytes;
  }
  if (totalUncompressedBytes > PUBLIC_ECONOMIC_RESILIENCE_MAX_UNCOMPRESSED_BYTES) {
    throw new Error('artifact ZIP uncompressed size exceeds the public evidence cap');
  }

  const members = new Map();
  for (const entry of entries) {
    const extracted = command('unzip', ['-p', zipFile, entry.name], {
      encoding: null,
      maxBuffer: Math.min(
        PUBLIC_ECONOMIC_RESILIENCE_MAX_MEMBER_BYTES + 64 * 1024,
        entry.uncompressedBytes + 64 * 1024
      ),
      timeout: 30_000,
    });
    assertCommand(extracted, `artifact ZIP member ${entry.name}`);
    if (
      !Buffer.isBuffer(extracted.stdout) ||
      extracted.stdout.length !== entry.uncompressedBytes
    ) {
      throw new Error(`artifact ZIP member size differs after extraction: ${entry.name}`);
    }
    members.set(entry.name, extracted.stdout);
  }
  return {
    members,
    inventory: entries.map(({ name, uncompressedBytes }) => ({
      name,
      uncompressedBytes,
    })),
    totalUncompressedBytes,
  };
}

function parseZipinfoListing(output) {
  if (typeof output !== 'string') {
    throw new Error('artifact ZIP member listing returned non-text output');
  }
  const entries = [];
  for (const line of output.split(/\r?\n/u)) {
    if (!/^[dl-][rwxStTs-]{9}\s/u.test(line)) continue;
    const fields = line.trim().split(/\s+/u);
    if (fields.length < 10) {
      throw new Error('artifact ZIP member listing is malformed');
    }
    const uncompressedBytes = Number(fields[3]);
    const compressedBytes = Number(fields[5]);
    const name = fields.slice(9).join(' ');
    if (
      !name ||
      name.startsWith('/') ||
      name.includes('\\') ||
      name.split('/').includes('..') ||
      !Number.isSafeInteger(compressedBytes) ||
      compressedBytes < 0
    ) {
      throw new Error('artifact ZIP contains an unsafe member');
    }
    entries.push({
      mode: fields[0],
      uncompressedBytes,
      compressedBytes,
      name,
    });
  }
  if (entries.length === 0) {
    throw new Error('artifact ZIP member listing contains no regular entries');
  }
  return entries;
}

function assertCommand(result, label) {
  if (result?.error) throw result.error;
  if (result?.status !== 0) {
    const stderr = Buffer.isBuffer(result?.stderr)
      ? result.stderr.toString('utf8')
      : String(result?.stderr ?? '');
    throw new Error(`${label} failed: ${stderr.trim() || `exit ${result?.status}`}`);
  }
}
