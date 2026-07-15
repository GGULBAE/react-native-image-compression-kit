import { inflateRawSync } from 'node:zlib';

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const MAX_EOCD_SEARCH = 65_557;
const MAX_ENTRY_COUNT = 10_000;
const UNIX_HOST = 3;
const UNIX_FILE_TYPE_MASK = 0o170000;
const UNIX_REGULAR_FILE = 0o100000;
const UTF8 = new TextDecoder('utf-8', { fatal: true });

export function extractArtifactZip(zipBytes, { expectedFiles } = {}) {
  assert(Buffer.isBuffer(zipBytes), 'Artifact ZIP must be bytes.');
  const entries = readCentralDirectory(zipBytes);
  const names = entries.map((entry) => entry.name);
  validateArtifactZipFileNames(names, expectedFiles);

  const files = new Map();
  const ranges = [];
  for (const entry of entries) {
    const { bytes, range } = extractEntry(zipBytes, entry);
    assert(
      crc32(bytes) === entry.crc32,
      `Artifact ZIP CRC-32 mismatch: ${entry.name}`
    );
    files.set(entry.name, bytes);
    ranges.push({ ...range, name: entry.name });
  }
  ranges.sort((left, right) => left.start - right.start);
  for (let index = 1; index < ranges.length; index += 1) {
    assert(
      ranges[index].start >= ranges[index - 1].end,
      `Artifact ZIP entries overlap: ${ranges[index - 1].name}, ${ranges[index].name}`
    );
  }
  return files;
}

export function validateArtifactZipFileNames(actualFiles, expectedFiles) {
  assert(Array.isArray(actualFiles), 'Artifact ZIP file names must be an array.');
  for (const file of actualFiles) validateArtifactZipPath(file);
  assert(
    new Set(actualFiles).size === actualFiles.length,
    'Artifact ZIP contains duplicate file names.'
  );
  if (expectedFiles) {
    assert(
      Array.isArray(expectedFiles),
      'Expected artifact ZIP file names must be an array.'
    );
    const actual = [...actualFiles].sort(compareText);
    const expected = [...expectedFiles].sort(compareText);
    assert(
      JSON.stringify(actual) === JSON.stringify(expected),
      `Artifact ZIP must contain exactly: ${expected.join(', ')}.`
    );
  }
}

function readCentralDirectory(zipBytes) {
  const eocdOffset = findEndOfCentralDirectory(zipBytes);
  const disk = zipBytes.readUInt16LE(eocdOffset + 4);
  const centralDisk = zipBytes.readUInt16LE(eocdOffset + 6);
  const diskEntries = zipBytes.readUInt16LE(eocdOffset + 8);
  const totalEntries = zipBytes.readUInt16LE(eocdOffset + 10);
  const centralSize = zipBytes.readUInt32LE(eocdOffset + 12);
  const centralOffset = zipBytes.readUInt32LE(eocdOffset + 16);
  const commentLength = zipBytes.readUInt16LE(eocdOffset + 20);

  assert(disk === 0 && centralDisk === 0, 'Multi-disk artifact ZIPs are unsupported.');
  assert(
    diskEntries === totalEntries,
    'Artifact ZIP central-directory entry counts disagree.'
  );
  assert(totalEntries > 0, 'Artifact ZIP must contain at least one file.');
  assert(
    totalEntries <= MAX_ENTRY_COUNT,
    `Artifact ZIP contains more than ${MAX_ENTRY_COUNT} entries.`
  );
  assert(
    totalEntries !== 0xffff &&
      centralSize !== 0xffffffff &&
      centralOffset !== 0xffffffff,
    'ZIP64 artifact archives are unsupported.'
  );
  assert(
    eocdOffset + 22 + commentLength === zipBytes.length,
    'Artifact ZIP has trailing or truncated end-of-directory bytes.'
  );
  assert(
    centralOffset + centralSize === eocdOffset,
    'Artifact ZIP central-directory bounds are invalid.'
  );

  const entries = [];
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    assertRange(zipBytes, offset, 46, 'central-directory header');
    assert(
      zipBytes.readUInt32LE(offset) === CENTRAL_DIRECTORY_SIGNATURE,
      'Artifact ZIP central-directory signature is invalid.'
    );
    const versionMadeBy = zipBytes.readUInt16LE(offset + 4);
    const flags = zipBytes.readUInt16LE(offset + 8);
    const compression = zipBytes.readUInt16LE(offset + 10);
    const crc = zipBytes.readUInt32LE(offset + 16);
    const compressedSize = zipBytes.readUInt32LE(offset + 20);
    const uncompressedSize = zipBytes.readUInt32LE(offset + 24);
    const nameLength = zipBytes.readUInt16LE(offset + 28);
    const extraLength = zipBytes.readUInt16LE(offset + 30);
    const entryCommentLength = zipBytes.readUInt16LE(offset + 32);
    const diskStart = zipBytes.readUInt16LE(offset + 34);
    const externalAttributes = zipBytes.readUInt32LE(offset + 38);
    const localHeaderOffset = zipBytes.readUInt32LE(offset + 42);
    const entryLength = 46 + nameLength + extraLength + entryCommentLength;
    assertRange(zipBytes, offset, entryLength, 'central-directory entry');
    assert(nameLength > 0, 'Artifact ZIP entry name must not be empty.');
    assert(
      compressedSize !== 0xffffffff &&
        uncompressedSize !== 0xffffffff &&
        localHeaderOffset !== 0xffffffff,
      'ZIP64 artifact entries are unsupported.'
    );
    assert(diskStart === 0, 'Multi-disk artifact ZIP entries are unsupported.');
    validateFlags(flags);
    assert(
      compression === 0 || compression === 8,
      `Unsupported artifact ZIP compression method: ${compression}`
    );
    const nameBytes = zipBytes.subarray(offset + 46, offset + 46 + nameLength);
    const name = decodeName(nameBytes, flags);
    validateArtifactZipPath(name);
    validateRegularFile(versionMadeBy, externalAttributes, name);
    entries.push({
      name,
      nameBytes: Buffer.from(nameBytes),
      flags,
      compression,
      crc32: crc,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset += entryLength;
  }
  assert(
    offset === centralOffset + centralSize,
    'Artifact ZIP central-directory size does not match its entries.'
  );
  return entries;
}

function extractEntry(zipBytes, entry) {
  const offset = entry.localHeaderOffset;
  assertRange(zipBytes, offset, 30, `local header for ${entry.name}`);
  assert(
    zipBytes.readUInt32LE(offset) === LOCAL_FILE_HEADER_SIGNATURE,
    `Artifact ZIP local-header signature is invalid: ${entry.name}`
  );
  const flags = zipBytes.readUInt16LE(offset + 6);
  const compression = zipBytes.readUInt16LE(offset + 8);
  const nameLength = zipBytes.readUInt16LE(offset + 26);
  const extraLength = zipBytes.readUInt16LE(offset + 28);
  assert(flags === entry.flags, `Artifact ZIP flags disagree: ${entry.name}`);
  assert(
    compression === entry.compression,
    `Artifact ZIP compression method disagrees: ${entry.name}`
  );
  const headerLength = 30 + nameLength + extraLength;
  assertRange(zipBytes, offset, headerLength, `local header for ${entry.name}`);
  const localName = zipBytes.subarray(offset + 30, offset + 30 + nameLength);
  assert(
    localName.equals(entry.nameBytes),
    `Artifact ZIP local and central file names disagree: ${entry.name}`
  );
  const dataStart = offset + headerLength;
  assertRange(
    zipBytes,
    dataStart,
    entry.compressedSize,
    `compressed data for ${entry.name}`
  );
  const compressed = zipBytes.subarray(
    dataStart,
    dataStart + entry.compressedSize
  );
  let bytes;
  try {
    bytes =
      entry.compression === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
  } catch (error) {
    throw new Error(
      `Could not decompress artifact ZIP entry ${entry.name}: ${error.message}`
    );
  }
  assert(
    bytes.length === entry.uncompressedSize,
    `Artifact ZIP uncompressed size drift: ${entry.name}`
  );
  return {
    bytes,
    range: { start: offset, end: dataStart + entry.compressedSize },
  };
}

function findEndOfCentralDirectory(zipBytes) {
  assert(zipBytes.length >= 22, 'Artifact ZIP is too short.');
  const minimum = Math.max(0, zipBytes.length - MAX_EOCD_SEARCH);
  for (let offset = zipBytes.length - 22; offset >= minimum; offset -= 1) {
    if (zipBytes.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }
  throw new Error('Artifact ZIP end-of-central-directory record is missing.');
}

function validateFlags(flags) {
  const forbidden = flags & ((1 << 0) | (1 << 5) | (1 << 6) | (1 << 13));
  assert(forbidden === 0, 'Encrypted or patched artifact ZIP entries are unsupported.');
}

function validateRegularFile(versionMadeBy, externalAttributes, name) {
  const host = versionMadeBy >>> 8;
  assert(host === UNIX_HOST, `Artifact ZIP entry is not Unix-owned: ${name}`);
  const mode = externalAttributes >>> 16;
  assert(
    (mode & UNIX_FILE_TYPE_MASK) === UNIX_REGULAR_FILE,
    `Artifact ZIP entry must be a regular file, not a directory or symlink: ${name}`
  );
}

function validateArtifactZipPath(file) {
  assert(typeof file === 'string' && file.length > 0, 'Artifact ZIP path is empty.');
  assert(!file.includes('\\'), `Artifact ZIP path uses a backslash: ${file}`);
  assert(!file.includes('\0'), `Artifact ZIP path contains NUL: ${file}`);
  assert(!file.startsWith('/'), `Artifact ZIP path is absolute: ${file}`);
  assert(!file.endsWith('/'), `Artifact ZIP entry must be a regular file: ${file}`);
  const segments = file.split('/');
  assert(
    segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..'),
    `Artifact ZIP path is unsafe: ${file}`
  );
}

function decodeName(bytes, flags) {
  assert((flags & (1 << 11)) !== 0 || bytes.every((byte) => byte < 0x80),
    'Non-UTF-8 artifact ZIP file names are unsupported.');
  try {
    return UTF8.decode(bytes);
  } catch {
    throw new Error('Artifact ZIP file name is not valid UTF-8.');
  }
}

function assertRange(bytes, offset, length, label) {
  assert(
    Number.isSafeInteger(offset) &&
      Number.isSafeInteger(length) &&
      offset >= 0 &&
      length >= 0 &&
      offset + length <= bytes.length,
    `Artifact ZIP ${label} is out of bounds.`
  );
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = Object.freeze(
  Array.from({ length: 256 }, (_, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    return crc >>> 0;
  })
);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
