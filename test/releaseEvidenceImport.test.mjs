import { spawnSync } from 'node:child_process';
import {
  cpSync,
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
import {
  RELEASE_EVIDENCE_IMPORT_CHECK_FIELDS,
  RELEASE_EVIDENCE_IMPORT_METADATA_FIELDS,
  RELEASE_EVIDENCE_IMPORT_REPORT_FIELDS,
  canonicalReleaseEvidenceImportMetadata,
  canonicalReleaseEvidenceImportReport,
  createReleaseEvidenceImportMetadata,
  importReleaseEvidenceArchive,
} from '../scripts/release-evidence-import-core.mjs';
import {
  RELEASE_EVIDENCE_FILE_PATHS,
  RELEASE_EVIDENCE_INDEX_FILE,
  verifyReleaseEvidenceArchive,
} from '../scripts/release-evidence-core.mjs';
import { parseReleaseEvidenceImportArgs } from '../scripts/import-release-evidence.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const IMPORTER = path.join(ROOT, 'scripts', 'import-release-evidence.mjs');
const VERSIONS = ['0.2.50', '0.2.55', '0.2.62', '0.3.0', '0.4.0'];

function archive(version) {
  return path.join(ROOT, 'evidence', 'npm', version);
}

function writeMetadata(parent, version, mutate = () => {}) {
  const metadata = createReleaseEvidenceImportMetadata({ version });
  mutate(metadata);
  const metadataFile = path.join(parent, `${version}-metadata.json`);
  writeFileSync(
    metadataFile,
    canonicalReleaseEvidenceImportMetadata(metadata),
    'utf8'
  );
  return metadataFile;
}

function verifyWithStoredAttestation(options) {
  return verifyReleaseEvidenceArchive(options, {
    verifyAttestation: () =>
      JSON.parse(
        readFileSync(
          path.join(
            options.archiveDir,
            'attestation',
            'attestation-verification.json'
          ),
          'utf8'
        )
      ),
  });
}

function importFixture({
  parent,
  version,
  provenanceDir,
  attestationDir,
  dependencies,
}) {
  const metadataFile = writeMetadata(parent, version);
  const destination = path.join(parent, 'archives', version);
  const report = importReleaseEvidenceArchive(
    {
      provenanceArtifactDir:
        provenanceDir ?? path.join(archive(version), 'provenance'),
      attestationArtifactDir:
        attestationDir ?? path.join(archive(version), 'attestation'),
      metadataFile,
      archiveDir: destination,
      expectedVersion: version,
    },
    { verifyArchive: verifyWithStoredAttestation, ...dependencies }
  );
  return { destination, metadataFile, report };
}

describe('release evidence archive import', () => {
  it.each(VERSIONS)(
    'reconstructs the canonical %s archive from downloaded artifacts and metadata',
    (version) => {
      const parent = mkdtempSync(
        path.join(os.tmpdir(), 'rnick-evidence-import-')
      );
      try {
        const { destination, report } = importFixture({ parent, version });
        expect(Object.keys(report)).toEqual(
          RELEASE_EVIDENCE_IMPORT_REPORT_FIELDS
        );
        expect(Object.keys(report.checks)).toEqual(
          RELEASE_EVIDENCE_IMPORT_CHECK_FIELDS
        );
        expect(report).toMatchObject({
          status: 'passed',
          version,
          package: 'react-native-image-compression-kit',
          expectedTag: 'latest',
          fileCount: 7,
          checks: Object.fromEntries(
            RELEASE_EVIDENCE_IMPORT_CHECK_FIELDS.map((field) => [field, true])
          ),
          error: null,
        });
        expect(canonicalReleaseEvidenceImportReport(report).trim().split('\n'))
          .toHaveLength(1);
        expect(
          readFileSync(path.join(destination, RELEASE_EVIDENCE_INDEX_FILE))
        ).toEqual(
          readFileSync(path.join(archive(version), RELEASE_EVIDENCE_INDEX_FILE))
        );
        for (const relativePath of RELEASE_EVIDENCE_FILE_PATHS) {
          expect(readFileSync(path.join(destination, relativePath))).toEqual(
            readFileSync(path.join(archive(version), relativePath))
          );
        }
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  );

  it.each(VERSIONS)(
    'runs the real offline importer CLI for %s with one canonical stdout object',
    (version) => {
      const parent = mkdtempSync(
        path.join(os.tmpdir(), 'rnick-evidence-import-cli-')
      );
      try {
        const metadataFile = writeMetadata(parent, version);
        const destination = path.join(parent, 'archive');
        const result = spawnSync(
          process.execPath,
          [
            IMPORTER,
            '--version',
            version,
            '--provenance-artifact-dir',
            path.join(archive(version), 'provenance'),
            '--attestation-artifact-dir',
            path.join(archive(version), 'attestation'),
            '--metadata-file',
            metadataFile,
            '--archive-dir',
            destination,
            '--json',
          ],
          {
            cwd: ROOT,
            encoding: 'utf8',
            env: {
              ...process.env,
              HTTP_PROXY: 'http://127.0.0.1:9',
              HTTPS_PROXY: 'http://127.0.0.1:9',
              ALL_PROXY: 'http://127.0.0.1:9',
              NO_PROXY: '',
              GH_PROMPT_DISABLED: '1',
              GH_NO_UPDATE_NOTIFIER: '1',
            },
          }
        );
        expect(result.status).toBe(0);
        expect(result.stderr).toBe('');
        expect(result.stdout.trim().split('\n')).toHaveLength(1);
        expect(JSON.parse(result.stdout)).toMatchObject({
          status: 'passed',
          version,
          fileCount: 7,
        });
        expect(
          readFileSync(path.join(destination, RELEASE_EVIDENCE_INDEX_FILE))
        ).toEqual(
          readFileSync(path.join(archive(version), RELEASE_EVIDENCE_INDEX_FILE))
        );
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  );

  it('requires canonical metadata with exact committed GitHub identity', () => {
    for (const mode of ['noncanonical', 'wrong-artifact']) {
      const parent = mkdtempSync(
        path.join(os.tmpdir(), `rnick-import-${mode}-`)
      );
      try {
        const version = '0.2.55';
        const metadata = createReleaseEvidenceImportMetadata({ version });
        if (mode === 'wrong-artifact') metadata.provenanceArtifact.id += 1;
        const metadataFile = path.join(parent, 'metadata.json');
        writeFileSync(
          metadataFile,
          mode === 'noncanonical'
            ? `${JSON.stringify(metadata, null, 2)}\n`
            : canonicalReleaseEvidenceImportMetadata(metadata),
          'utf8'
        );
        const destination = path.join(parent, 'archive');
        const report = importReleaseEvidenceArchive({
          provenanceArtifactDir: path.join(archive(version), 'provenance'),
          attestationArtifactDir: path.join(archive(version), 'attestation'),
          metadataFile,
          archiveDir: destination,
          expectedVersion: version,
        });
        expect(report.status).toBe('failed');
        expect(report.error).toContain(
          mode === 'noncanonical' ? 'not canonical JSON' : 'does not match'
        );
        expect(readdirSync(parent)).toEqual(['metadata.json']);
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('rejects altered or additional artifact bytes without exposing an archive', () => {
    for (const mode of ['tampered', 'extra']) {
      const parent = mkdtempSync(
        path.join(os.tmpdir(), `rnick-import-${mode}-`)
      );
      try {
        const version = '0.2.55';
        const provenanceDir = path.join(parent, 'provenance');
        const attestationDir = path.join(parent, 'attestation');
        cpSync(path.join(archive(version), 'provenance'), provenanceDir, {
          recursive: true,
        });
        cpSync(path.join(archive(version), 'attestation'), attestationDir, {
          recursive: true,
        });
        if (mode === 'tampered') {
          const tarball = path.join(provenanceDir, 'package.tgz');
          const bytes = Buffer.from(readFileSync(tarball));
          bytes[0] ^= 0xff;
          writeFileSync(tarball, bytes);
        } else {
          writeFileSync(path.join(attestationDir, 'unexpected.txt'), 'extra\n');
        }
        const { destination, report } = importFixture({
          parent,
          version,
          provenanceDir,
          attestationDir,
        });
        expect(report.status).toBe('failed');
        expect(report.error).toContain(
          mode === 'tampered'
            ? 'Imported archive verification failed'
            : 'must contain exactly'
        );
        expect(() => readdirSync(destination)).toThrow();
        const archiveRoot = path.dirname(destination);
        if (readdirSync(parent).includes('archives')) {
          expect(readdirSync(archiveRoot)).toEqual([]);
        }
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('removes the complete temporary archive when the atomic rename fails', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-import-atomic-'));
    try {
      const { destination, report } = importFixture({
        parent,
        version: '0.2.55',
        dependencies: {
          rename: () => {
            throw new Error('fixture rename failure');
          },
        },
      });
      expect(report.status).toBe('failed');
      expect(report.error).toContain('fixture rename failure');
      expect(report.checks.verification).toBe(true);
      expect(report.checks.atomicWrite).toBe(false);
      expect(() => readdirSync(destination)).toThrow();
      expect(readdirSync(path.dirname(destination))).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('removes the complete temporary archive when a staged write fails', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-import-write-'));
    try {
      const { destination, report } = importFixture({
        parent,
        version: '0.2.55',
        dependencies: {
          writeFile: () => {
            throw new Error('fixture write failure');
          },
        },
      });
      expect(report.status).toBe('failed');
      expect(report.error).toContain('fixture write failure');
      expect(report.checks.index).toBe(false);
      expect(report.checks.atomicWrite).toBe(false);
      expect(() => readdirSync(destination)).toThrow();
      expect(readdirSync(path.dirname(destination))).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('never replaces an existing archive destination', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-import-existing-'));
    try {
      const destination = path.join(parent, 'archive');
      cpSync(archive('0.2.55'), destination, { recursive: true });
      const priorIndex = readFileSync(
        path.join(destination, RELEASE_EVIDENCE_INDEX_FILE)
      );
      const metadataFile = writeMetadata(parent, '0.2.55');
      const report = importReleaseEvidenceArchive({
        provenanceArtifactDir: path.join(archive('0.2.55'), 'provenance'),
        attestationArtifactDir: path.join(archive('0.2.55'), 'attestation'),
        metadataFile,
        archiveDir: destination,
        expectedVersion: '0.2.55',
      });
      expect(report.status).toBe('failed');
      expect(report.error).toContain('destination already exists');
      expect(readFileSync(path.join(destination, RELEASE_EVIDENCE_INDEX_FILE)))
        .toEqual(priorIndex);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('parses explicit artifact, metadata, version, and destination arguments', () => {
    expect(
      parseReleaseEvidenceImportArgs([
        '--version', '0.2.55',
        '--provenance-artifact-dir', 'provenance',
        '--attestation-artifact-dir', 'attestation',
        '--metadata-file', 'metadata.json',
        '--archive-root', 'evidence/npm',
        '--json',
      ])
    ).toEqual({
      version: '0.2.55',
      provenanceArtifactDir: 'provenance',
      attestationArtifactDir: 'attestation',
      metadataFile: 'metadata.json',
      archiveRoot: 'evidence/npm',
      json: true,
    });
    expect(() =>
      parseReleaseEvidenceImportArgs([
        '--archive-root', 'root',
        '--archive-dir', 'archive',
      ])
    ).toThrow('Use either --archive-root or --archive-dir');
    expect(
      Object.keys(createReleaseEvidenceImportMetadata({ version: '0.2.55' }))
    ).toEqual(RELEASE_EVIDENCE_IMPORT_METADATA_FIELDS);
  });
});
