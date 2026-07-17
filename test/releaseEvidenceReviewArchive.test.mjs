import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractArtifactZip } from '../scripts/artifact-zip-core.mjs';
import {
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_ARTIFACT_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_FILE_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_IMPORT_CHECK_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_IMPORT_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_INDEX_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_INDEX_FILE,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_METADATA_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_RUN_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERIFICATION_CHECK_FIELDS,
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERIFICATION_FIELDS,
  canonicalReleaseEvidenceReviewArchiveMetadata,
  createReleaseEvidenceReviewArchiveMetadata,
  importReleaseEvidenceReviewArchive,
  verifyReleaseEvidenceReviewArchive,
  writeReleaseEvidenceReviewArchiveVerificationAtomic,
} from '../scripts/release-evidence-review-archive-core.mjs';
import { sha256 } from '../scripts/release-evidence-core.mjs';
import { parseReleaseEvidenceReviewArchiveImportArgs } from '../scripts/import-release-evidence-review-archive.mjs';
import { parseReleaseEvidenceReviewArchiveVerificationArgs } from '../scripts/verify-release-evidence-review-archive.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const VERSION = '0.2.55';
const ARCHIVE_ROOT = path.join(ROOT, 'evidence', 'reviews');
const ARCHIVE = path.join(ARCHIVE_ROOT, VERSION);
const RELEASE_ARCHIVE_ROOT = path.join(ROOT, 'evidence', 'npm');
const REVIEW_ZIP = path.join(ARCHIVE, 'artifacts', 'review.zip');
const ATTESTATION_ZIP = path.join(ARCHIVE, 'artifacts', 'attestation.zip');
const IMPORTER = path.join(
  ROOT,
  'scripts',
  'import-release-evidence-review-archive.mjs'
);
const VERIFIER = path.join(
  ROOT,
  'scripts',
  'verify-release-evidence-review-archive.mjs'
);

function blockedEnvironment(timeZone = 'UTC') {
  return {
    ...process.env,
    TZ: timeZone,
    HTTP_PROXY: 'http://127.0.0.1:9',
    HTTPS_PROXY: 'http://127.0.0.1:9',
    ALL_PROXY: 'http://127.0.0.1:9',
    NO_PROXY: '',
    GH_PROMPT_DISABLED: '1',
    GH_NO_UPDATE_NOTIFIER: '1',
  };
}

function clonePolicy() {
  return structuredClone(RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES[VERSION]);
}

function writeMetadata(parent, policy = clonePolicy(), mutate = () => {}) {
  const metadata = createReleaseEvidenceReviewArchiveMetadata({
    version: VERSION,
    expectedPolicy: policy,
  });
  mutate(metadata);
  const file = path.join(parent, 'metadata.json');
  writeFileSync(
    file,
    canonicalReleaseEvidenceReviewArchiveMetadata(metadata),
    'utf8'
  );
  return file;
}

function importFixture(parent, overrides = {}, dependencies = {}) {
  const policy = overrides.expectedPolicy ?? clonePolicy();
  const metadataFile =
    overrides.metadataFile ?? writeMetadata(parent, policy, overrides.mutateMetadata);
  const archiveDir = overrides.archiveDir ?? path.join(parent, 'archive');
  const report = importReleaseEvidenceReviewArchive(
    {
      metadataFile,
      reviewArtifactZip: overrides.reviewArtifactZip ?? REVIEW_ZIP,
      attestationArtifactZip:
        overrides.attestationArtifactZip ?? ATTESTATION_ZIP,
      archiveDir,
      releaseArchiveRoot: overrides.releaseArchiveRoot ?? RELEASE_ARCHIVE_ROOT,
      expectedVersion: VERSION,
      reportFile: overrides.reportFile,
      expectedPolicy: policy,
    },
    dependencies
  );
  return { archiveDir, metadataFile, policy, report };
}

function readStoredAttestation() {
  return JSON.parse(
    readFileSync(path.join(ARCHIVE, 'attestation', 'attestation-verification.json'))
  );
}

function verifierDependencies() {
  return { verifyAttestation: () => readStoredAttestation() };
}

function copyArchive(parent) {
  const destination = path.join(parent, 'archive');
  cpSync(ARCHIVE, destination, { recursive: true });
  return destination;
}

function readArchiveFiles(root, prefix = '') {
  const files = new Map();
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      for (const [file, bytes] of readArchiveFiles(absolute, relative)) {
        files.set(file, bytes);
      }
    } else {
      files.set(relative, readFileSync(absolute));
    }
  }
  return files;
}

describe('repository-owned release evidence review archive', () => {
  it('pins the exact canonical index, nested identity, and retained ZIP bytes', () => {
    const indexBytes = readFileSync(
      path.join(ARCHIVE, RELEASE_EVIDENCE_REVIEW_ARCHIVE_INDEX_FILE)
    );
    const index = JSON.parse(indexBytes);
    expect(Object.keys(index)).toEqual(RELEASE_EVIDENCE_REVIEW_ARCHIVE_INDEX_FIELDS);
    expect(Object.keys(index.reviewRun)).toEqual(
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_RUN_FIELDS
    );
    expect(Object.keys(index.reviewArtifact)).toEqual(
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_ARTIFACT_FIELDS
    );
    expect(Object.keys(index.attestationArtifact)).toEqual(
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_ARTIFACT_FIELDS
    );
    expect(Object.keys(index.attestation)).toEqual(
      RELEASE_EVIDENCE_REVIEW_ARCHIVE_ATTESTATION_FIELDS
    );
    expect(index.files).toHaveLength(39);
    for (const file of index.files) {
      expect(Object.keys(file)).toEqual(RELEASE_EVIDENCE_REVIEW_ARCHIVE_FILE_FIELDS);
    }
    expect(index).toMatchObject({
      status: 'passed',
      package: 'react-native-image-compression-kit',
      version: VERSION,
      reviewRun: { id: 29390495773, runAttempt: 1 },
      archiveSha256:
        'f63924d58ef18c94379b102949e6870e838a014ac883b7c9c03fca5abc6b56dd',
      receiptSha256:
        '45ddefa85cba6a9fed62cb1c187dd0bab2246b72ba66a803b1282e4eac07efad',
      manifestSha256:
        '48cfd454b636cf1911b7d19dae996e7ead2797247d2b974687bb02aeebb439ff',
      evidenceSha256:
        'e890e90e322ab6205517950466476a9b9430fa3307b2eacbc3ede0234e3f5e78',
      error: null,
    });
    expect(sha256(readFileSync(REVIEW_ZIP))).toBe(
      index.reviewArtifact.digest.slice('sha256:'.length)
    );
    expect(sha256(readFileSync(ATTESTATION_ZIP))).toBe(
      index.attestationArtifact.digest.slice('sha256:'.length)
    );
  });

  it('runs the real blocked-network verifier identically in UTC and Asia/Seoul', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-archive-tz-'));
    try {
      const archiveDir = copyArchive(parent);
      const outputs = [];
      for (const timeZone of ['UTC', 'Asia/Seoul']) {
        const reportFile = path.join(parent, `${timeZone.replace('/', '-')}.json`);
        const result = spawnSync(
          process.execPath,
          [
            VERIFIER,
            '--version',
            VERSION,
            '--archive-dir',
            archiveDir,
            '--release-archive-root',
            RELEASE_ARCHIVE_ROOT,
            '--json',
            '--report-file',
            reportFile,
          ],
          { cwd: ROOT, encoding: 'utf8', env: blockedEnvironment(timeZone) }
        );
        expect(result.status, result.stderr || result.stdout).toBe(0);
        expect(result.stderr).toBe('');
        expect(result.stdout.trim().split('\n')).toHaveLength(1);
        expect(readFileSync(reportFile, 'utf8')).toBe(result.stdout);
        outputs.push(result.stdout);
      }
      expect(outputs[1]).toBe(outputs[0]);
      const report = JSON.parse(outputs[0]);
      expect(Object.keys(report)).toEqual(
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERIFICATION_FIELDS
      );
      expect(Object.keys(report.checks)).toEqual(
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_VERIFICATION_CHECK_FIELDS
      );
      expect(Object.values(report.checks).every(Boolean)).toBe(true);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }, 20_000);

  it('imports the exact ZIPs atomically with stdout and report bytes equal', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-archive-cli-'));
    try {
      const metadataFile = writeMetadata(parent);
      const archiveDir = path.join(parent, 'archive');
      const reportFile = path.join(parent, 'report.json');
      const result = spawnSync(
        process.execPath,
        [
          IMPORTER,
          '--version',
          VERSION,
          '--metadata-file',
          metadataFile,
          '--review-artifact-zip',
          REVIEW_ZIP,
          '--attestation-artifact-zip',
          ATTESTATION_ZIP,
          '--archive-dir',
          archiveDir,
          '--release-archive-root',
          RELEASE_ARCHIVE_ROOT,
          '--json',
          '--report-file',
          reportFile,
        ],
        { cwd: ROOT, encoding: 'utf8', env: blockedEnvironment() }
      );
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout.trim().split('\n')).toHaveLength(1);
      expect(readFileSync(reportFile, 'utf8')).toBe(result.stdout);
      const report = JSON.parse(result.stdout);
      expect(Object.keys(report)).toEqual(RELEASE_EVIDENCE_REVIEW_ARCHIVE_IMPORT_FIELDS);
      expect(Object.keys(report.checks)).toEqual(
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_IMPORT_CHECK_FIELDS
      );
      expect(report).toMatchObject({
        status: 'passed',
        version: VERSION,
        fileCount: 39,
        checks: Object.fromEntries(
          RELEASE_EVIDENCE_REVIEW_ARCHIVE_IMPORT_CHECK_FIELDS.map((field) => [
            field,
            true,
          ])
        ),
        error: null,
      });
      expect(readArchiveFiles(archiveDir)).toEqual(readArchiveFiles(ARCHIVE));
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }, 20_000);

  it.each([
    ['noncanonical metadata', (metadata) => `${JSON.stringify(metadata, null, 2)}\n`],
    ['run identity drift', (metadata) => {
      metadata.reviewRun.id += 1;
      return canonicalReleaseEvidenceReviewArchiveMetadata(metadata);
    }],
    ['artifact identity drift', (metadata) => {
      metadata.reviewArtifact.id += 1;
      return canonicalReleaseEvidenceReviewArchiveMetadata(metadata);
    }],
    ['attestation identity drift', (metadata) => {
      metadata.attestation.id += 1;
      return canonicalReleaseEvidenceReviewArchiveMetadata(metadata);
    }],
    ['invalid expiration order', (metadata) => {
      metadata.reviewArtifact.expiresAt = metadata.reviewArtifact.createdAt;
      return canonicalReleaseEvidenceReviewArchiveMetadata(metadata);
    }],
  ])('rejects %s without exposing an archive', (_label, serialize) => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-metadata-'));
    try {
      const metadata = createReleaseEvidenceReviewArchiveMetadata({ version: VERSION });
      const metadataFile = path.join(parent, 'metadata.json');
      writeFileSync(metadataFile, serialize(metadata), 'utf8');
      const { archiveDir, report } = importFixture(parent, { metadataFile });
      expect(report.status).toBe('failed');
      expect(existsSync(archiveDir)).toBe(false);
      expect(readdirSync(parent)).toEqual(['metadata.json']);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it.each(['traversal', 'duplicate', 'symlink', 'missing', 'additional'])(
    'rejects a %s review artifact ZIP without exposing an archive',
    (mode) => {
      const parent = mkdtempSync(path.join(os.tmpdir(), `rnick-review-zip-${mode}-`));
      try {
        const entries = [...extractArtifactZip(readFileSync(REVIEW_ZIP))].map(
          ([name, bytes]) => ({ name, bytes, mode: 0o100644 })
        );
        if (mode === 'traversal') {
          entries.push({ name: '../escape.json', bytes: Buffer.from('{}\n'), mode: 0o100644 });
        } else if (mode === 'duplicate') {
          entries.push({ ...entries[0] });
        } else if (mode === 'symlink') {
          entries[0] = { ...entries[0], mode: 0o120777 };
        } else if (mode === 'missing') {
          entries.pop();
        } else {
          entries.push({ name: 'extra.json', bytes: Buffer.from('{}\n'), mode: 0o100644 });
        }
        const zipBytes = createStoredZip(entries);
        const zipFile = path.join(parent, 'review.zip');
        writeFileSync(zipFile, zipBytes);
        const policy = clonePolicy();
        policy.reviewArtifact.size = zipBytes.length;
        policy.reviewArtifact.digest = `sha256:${sha256(zipBytes)}`;
        const { archiveDir, report } = importFixture(parent, {
          reviewArtifactZip: zipFile,
          expectedPolicy: policy,
        });
        expect(report.status).toBe('failed');
        expect(existsSync(archiveDir)).toBe(false);
        expect(report.error).toMatch(
          mode === 'symlink'
            ? /directory or symlink/
            : mode === 'duplicate'
              ? /duplicate/
              : mode === 'traversal'
                ? /unsafe/
                : /must contain exactly/
        );
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  );

  it.each([
    'artifacts/review.zip',
    'review/review-receipt.json',
    'review/artifact-manifest.json',
    'review/policy-candidate.json',
    'attestation/attestation-verification.json',
  ])('rejects retained byte drift in %s', (relativePath) => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-byte-drift-'));
    try {
      const archiveDir = copyArchive(parent);
      const file = path.join(archiveDir, relativePath);
      const bytes = Buffer.from(readFileSync(file));
      bytes[Math.floor(bytes.length / 2)] ^= 0xff;
      writeFileSync(file, bytes);
      const report = verifyReleaseEvidenceReviewArchive(
        {
          archiveDir,
          releaseArchiveRoot: RELEASE_ARCHIVE_ROOT,
          expectedVersion: VERSION,
        },
        verifierDependencies()
      );
      expect(report.status).toBe('failed');
      expect(report.error).toMatch(
        /digest|files|exact ZIP|contain exactly|parse|decompress|CRC/i
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects signer identity drift and a different repository target archive', () => {
    const signerDrift = verifyReleaseEvidenceReviewArchive(
      {
        archiveDir: ARCHIVE,
        releaseArchiveRoot: RELEASE_ARCHIVE_ROOT,
        expectedVersion: VERSION,
      },
      {
        verifyAttestation: () => ({
          ...readStoredAttestation(),
          signerWorkflow: 'GGULBAE/react-native-image-compression-kit/.github/workflows/other.yml',
        }),
      }
    );
    expect(signerDrift.status).toBe('failed');
    expect(signerDrift.error).toContain('does not match offline replay');

    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-target-'));
    try {
      const releaseRoot = path.join(parent, 'npm');
      cpSync(RELEASE_ARCHIVE_ROOT, releaseRoot, { recursive: true });
      const target = path.join(
        releaseRoot,
        VERSION,
        'provenance',
        'registry-provenance.json'
      );
      const bytes = Buffer.from(readFileSync(target));
      bytes[0] ^= 0xff;
      writeFileSync(target, bytes);
      const targetDrift = verifyReleaseEvidenceReviewArchive(
        {
          archiveDir: ARCHIVE,
          releaseArchiveRoot: releaseRoot,
          expectedVersion: VERSION,
        },
        verifierDependencies()
      );
      expect(targetDrift.status).toBe('failed');
      expect(targetDrift.error).toContain(
        'Rehearsed target archive does not match repository release evidence'
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }, 15_000);

  it('rejects duplicate destination and cleans index, archive, and report failures', () => {
    for (const mode of ['duplicate', 'index', 'archive-rename', 'report-rename']) {
      const parent = mkdtempSync(path.join(os.tmpdir(), `rnick-review-${mode}-`));
      try {
        const archiveDir = path.join(parent, 'archive');
        const reportFile = path.join(parent, 'report.json');
        const overrides = { archiveDir, reportFile };
        const dependencies = { verifierDependencies: verifierDependencies() };
        if (mode === 'duplicate') {
          writeFileSync(archiveDir, 'occupied');
        } else if (mode === 'index') {
          dependencies.writeFile = (file, bytes, options) => {
            if (file.endsWith(RELEASE_EVIDENCE_REVIEW_ARCHIVE_INDEX_FILE)) {
              throw new Error('fixture index write failure');
            }
            writeFileSync(file, bytes, options);
          };
        } else if (mode === 'archive-rename') {
          dependencies.renameArchive = () => {
            throw new Error('fixture archive rename failure');
          };
        } else {
          writeFileSync(reportFile, 'previous\n');
          dependencies.renameReport = () => {
            throw new Error('fixture report rename failure');
          };
        }
        const { report } = importFixture(parent, overrides, dependencies);
        expect(report.status).toBe('failed');
        if (mode === 'duplicate') {
          expect(readFileSync(archiveDir, 'utf8')).toBe('occupied');
        } else {
          expect(existsSync(archiveDir)).toBe(false);
        }
        if (mode === 'report-rename') {
          expect(readFileSync(reportFile, 'utf8')).toBe('previous\n');
        } else {
          expect(existsSync(reportFile)).toBe(false);
        }
        expect(readdirSync(parent).filter((name) => name.includes('.tmp'))).toEqual([]);
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  }, 20_000);

  it('preserves a verification report on atomic rename failure', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-review-report-'));
    try {
      const reportFile = path.join(parent, 'report.json');
      writeFileSync(reportFile, 'previous\n');
      const report = verifyReleaseEvidenceReviewArchive(
        {
          archiveDir: ARCHIVE,
          releaseArchiveRoot: RELEASE_ARCHIVE_ROOT,
          expectedVersion: VERSION,
        },
        verifierDependencies()
      );
      expect(() =>
        writeReleaseEvidenceReviewArchiveVerificationAtomic(reportFile, report, {
          rename: () => {
            throw new Error('fixture verification report rename failure');
          },
        })
      ).toThrow('fixture verification report rename failure');
      expect(readFileSync(reportFile, 'utf8')).toBe('previous\n');
      expect(readdirSync(parent)).toEqual(['report.json']);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }, 10_000);

  it('parses only explicit importer and verifier paths', () => {
    expect(
      parseReleaseEvidenceReviewArchiveImportArgs([
        '--version',
        VERSION,
        '--metadata-file',
        'metadata.json',
        '--review-artifact-zip',
        'review.zip',
        '--attestation-artifact-zip',
        'attestation.zip',
        '--archive-root',
        'evidence/reviews',
        '--release-archive-root',
        'evidence/npm',
        '--report-file',
        'report.json',
        '--json',
      ])
    ).toEqual({
      version: VERSION,
      metadataFile: 'metadata.json',
      reviewArtifactZip: 'review.zip',
      attestationArtifactZip: 'attestation.zip',
      archiveRoot: 'evidence/reviews',
      releaseArchiveRoot: 'evidence/npm',
      reportFile: 'report.json',
      json: true,
    });
    expect(
      parseReleaseEvidenceReviewArchiveVerificationArgs([
        '--version',
        VERSION,
        '--archive-dir',
        'archive',
        '--release-archive-root',
        'evidence/npm',
        '--json',
      ])
    ).toEqual({
      version: VERSION,
      archiveDir: 'archive',
      releaseArchiveRoot: 'evidence/npm',
      json: true,
    });
  });
});

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const bytes = Buffer.from(entry.bytes);
    const crc = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(1 << 11, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 30, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(1 << 11, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((entry.mode << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    localParts.push(local, name, bytes);
    centralParts.push(central, name);
    offset += local.length + name.length + bytes.length;
  }
  const centralBytes = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralBytes, eocd]);
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
