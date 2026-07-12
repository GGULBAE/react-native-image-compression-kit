import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  REGISTRY_BUNDLE_FILES,
  REGISTRY_BUNDLE_MANIFEST_FIELDS,
  REGISTRY_VERIFICATION_FIELDS,
  canonicalBundleManifest,
  canonicalVerificationReport,
  createRegistryBundleManifest,
  inspectPackageTarball,
  sha256,
  tarballIntegrity,
  tarballShasum,
  verifyRegistryProvenanceBundle,
  writeRegistryBundleAtomic,
  writeVerificationReportAtomic,
} from '../scripts/registry-provenance-core.mjs';
import {
  REQUIRED_PACKAGE_FILES,
  canonicalRegistryReport,
  createRegistryReport,
} from '../scripts/registry-smoke-core.mjs';
import { parseRegistrySmokeArgs } from '../scripts/registry-smoke-test.mjs';
import { parseRegistryProvenanceArgs } from '../scripts/verify-registry-provenance.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const VERIFIER = path.join(ROOT, 'scripts', 'verify-registry-provenance.mjs');
const PACKAGE_NAME = 'react-native-image-compression-kit';
const VERSION = '0.2.48';
const EXPECTED_TAG = 'latest';

function packageFiles(overrides = {}) {
  const files = Object.fromEntries(
    REQUIRED_PACKAGE_FILES.map((filePath) => [filePath, Buffer.from(`fixture:${filePath}\n`)])
  );
  files['package.json'] = Buffer.from(
    `${JSON.stringify({ name: PACKAGE_NAME, version: VERSION })}\n`
  );
  files['README.md'] = Buffer.from(
    `# fixture\n\nStatus: v${VERSION} release\n\nRegistry-independent release wording.\n`
  );
  return { ...files, ...overrides };
}

function createBundle(parent, options = {}) {
  const entries = options.entries ?? Object.entries(packageFiles(options.fileOverrides));
  const tarball = createTarGz(entries);
  const unpackedSize = entries
    .filter(([, , type = '0']) => type === '0')
    .reduce((total, [, contents]) => total + Buffer.from(contents).length, 0);
  const fileCount = entries.filter(([, , type = '0']) => type === '0').length;
  const report = createRegistryReport({
    status: 'passed',
    packageName: PACKAGE_NAME,
    requestedVersion: VERSION,
    resolvedVersion: VERSION,
    expectedTag: EXPECTED_TAG,
    tagVersion: VERSION,
    publishedAt: '2026-07-12T05:47:42.131Z',
    tarball: `https://registry.npmjs.org/${PACKAGE_NAME}/-/${PACKAGE_NAME}-${VERSION}.tgz`,
    integrity: tarballIntegrity(tarball),
    shasum: tarballShasum(tarball),
    fileCount,
    packageSize: tarball.length,
    unpackedSize,
    readmeStatus: 'passed',
    forbiddenFiles: [],
    registryInstallSmoke: true,
    error: null,
    ...options.reportOverrides,
  });
  const artifactDir = path.join(parent, options.name ?? 'artifact');
  writeRegistryBundleAtomic(artifactDir, report, tarball);
  return { artifactDir, report, tarball };
}

function verify(artifactDir, overrides = {}) {
  return verifyRegistryProvenanceBundle({
    artifactDir,
    expectedPackage: PACKAGE_NAME,
    expectedVersion: VERSION,
    expectedTag: EXPECTED_TAG,
    ...overrides,
  });
}

function mutateCanonicalJson(filePath, mutate) {
  const value = JSON.parse(readFileSync(filePath, 'utf8'));
  mutate(value);
  writeFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

function synchronizeManifest(artifactDir) {
  const reportBytes = readFileSync(path.join(artifactDir, REGISTRY_BUNDLE_FILES.report));
  const stdoutBytes = readFileSync(path.join(artifactDir, REGISTRY_BUNDLE_FILES.stdout));
  const tarball = readFileSync(path.join(artifactDir, REGISTRY_BUNDLE_FILES.tarball));
  mutateCanonicalJson(path.join(artifactDir, REGISTRY_BUNDLE_FILES.manifest), (manifest) => {
    const report = JSON.parse(reportBytes.toString('utf8'));
    manifest.status = report.status;
    manifest.package = report.package;
    manifest.version = report.resolvedVersion;
    manifest.expectedTag = report.expectedTag;
    manifest.reportSha256 = sha256(reportBytes);
    manifest.stdoutSha256 = sha256(stdoutBytes);
    manifest.tarballIntegrity = tarballIntegrity(tarball);
    manifest.tarballShasum = tarballShasum(tarball);
    manifest.fileCount = report.fileCount;
    manifest.packageSize = report.packageSize;
    manifest.unpackedSize = report.unpackedSize;
    manifest.error = report.error;
  });
}

function replaceTarballAndClaims(artifactDir, tarball, fileCount, unpackedSize) {
  writeFileSync(path.join(artifactDir, REGISTRY_BUNDLE_FILES.tarball), tarball);
  mutateCanonicalJson(path.join(artifactDir, REGISTRY_BUNDLE_FILES.report), (report) => {
    report.integrity = tarballIntegrity(tarball);
    report.shasum = tarballShasum(tarball);
    report.fileCount = fileCount;
    report.packageSize = tarball.length;
    report.unpackedSize = unpackedSize;
  });
  writeFileSync(
    path.join(artifactDir, REGISTRY_BUNDLE_FILES.stdout),
    readFileSync(path.join(artifactDir, REGISTRY_BUNDLE_FILES.report))
  );
  synchronizeManifest(artifactDir);
}

describe('registry provenance bundle', () => {
  it('writes the fixed canonical bundle and verifies every offline check', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-provenance-'));
    try {
      const { artifactDir, report, tarball } = createBundle(parent);
      expect(readdirSync(artifactDir).sort()).toEqual(
        Object.values(REGISTRY_BUNDLE_FILES).sort()
      );
      const manifestBytes = readFileSync(
        path.join(artifactDir, REGISTRY_BUNDLE_FILES.manifest),
        'utf8'
      );
      const manifest = JSON.parse(manifestBytes);
      expect(Object.keys(manifest)).toEqual(REGISTRY_BUNDLE_MANIFEST_FIELDS);
      expect(manifestBytes).toBe(canonicalBundleManifest(manifest));
      expect(manifest).toEqual(createRegistryBundleManifest(report, tarball));

      const result = verify(artifactDir);
      expect(Object.keys(result)).toEqual(REGISTRY_VERIFICATION_FIELDS);
      expect(result).toMatchObject({
        status: 'passed',
        package: PACKAGE_NAME,
        version: VERSION,
        expectedTag: EXPECTED_TAG,
        checks: {
          manifest: true,
          report: true,
          stdout: true,
          tarball: true,
          packageContents: true,
          readme: true,
        },
        error: null,
      });
      expect(canonicalVerificationReport(result).trim().split('\n')).toHaveLength(1);
      expect(inspectPackageTarball(tarball).fileCount).toBe(REQUIRED_PACKAGE_FILES.length);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('parses smoke artifact and offline verifier CLI options', () => {
    expect(
      parseRegistrySmokeArgs([
        '--version', VERSION,
        '--expect-tag', EXPECTED_TAG,
        '--json',
        '--artifact-dir', 'registry-validation',
      ])
    ).toEqual({
      version: VERSION,
      expectedTag: EXPECTED_TAG,
      json: true,
      artifactDir: 'registry-validation',
    });
    expect(() =>
      parseRegistrySmokeArgs([
        '--report-file', 'report.json',
        '--artifact-dir', 'artifact',
      ])
    ).toThrow('Use either --report-file or --artifact-dir');
    expect(
      parseRegistryProvenanceArgs([
        '--artifact-dir', 'artifact',
        '--expect-package', PACKAGE_NAME,
        '--expect-version', VERSION,
        '--expect-tag', EXPECTED_TAG,
        '--json',
        '--report-file', 'verification.json',
      ])
    ).toEqual({
      artifactDir: 'artifact',
      expectedPackage: PACKAGE_NAME,
      expectedVersion: VERSION,
      expectedTag: EXPECTED_TAG,
      json: true,
      reportFile: 'verification.json',
    });
  });

  it('emits exactly one canonical JSON object and atomically writes the same report', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-provenance-cli-'));
    try {
      const { artifactDir } = createBundle(parent);
      const reportFile = path.join(parent, 'verification.json');
      const result = spawnSync(
        process.execPath,
        [
          VERIFIER,
          '--artifact-dir', artifactDir,
          '--expect-package', PACKAGE_NAME,
          '--expect-version', VERSION,
          '--expect-tag', EXPECTED_TAG,
          '--json',
          '--report-file', reportFile,
        ],
        { cwd: ROOT, encoding: 'utf8' }
      );
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout.trim().split('\n')).toHaveLength(1);
      expect(readFileSync(reportFile, 'utf8')).toBe(result.stdout);
      expect(JSON.parse(result.stdout).status).toBe('passed');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects report/stdout drift and noncanonical JSON', () => {
    for (const mode of ['stdout', 'noncanonical-report', 'noncanonical-manifest']) {
      const parent = mkdtempSync(path.join(os.tmpdir(), `rnick-${mode}-`));
      try {
        const { artifactDir } = createBundle(parent);
        if (mode === 'stdout') {
          writeFileSync(
            path.join(artifactDir, REGISTRY_BUNDLE_FILES.stdout),
            '{}\n',
            'utf8'
          );
          expect(verify(artifactDir).error).toContain('differ');
        } else {
          const target =
            mode === 'noncanonical-report'
              ? REGISTRY_BUNDLE_FILES.report
              : REGISTRY_BUNDLE_FILES.manifest;
          const reportPath = path.join(artifactDir, target);
          const report = JSON.parse(readFileSync(reportPath, 'utf8'));
          writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
          expect(verify(artifactDir).error).toContain('not canonical JSON');
        }
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('rejects unsupported manifest and report schemas', () => {
    for (const target of [REGISTRY_BUNDLE_FILES.manifest, REGISTRY_BUNDLE_FILES.report]) {
      const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-schema-'));
      try {
        const { artifactDir } = createBundle(parent);
        mutateCanonicalJson(path.join(artifactDir, target), (value) => {
          value.schemaVersion = 999;
        });
        if (target === REGISTRY_BUNDLE_FILES.report) {
          writeFileSync(
            path.join(artifactDir, REGISTRY_BUNDLE_FILES.stdout),
            readFileSync(path.join(artifactDir, target))
          );
          synchronizeManifest(artifactDir);
        }
        expect(verify(artifactDir).error).toContain('Unsupported');
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('rejects package, version, and tag expectation mismatches', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-expect-'));
    try {
      const { artifactDir } = createBundle(parent);
      expect(verify(artifactDir, { expectedPackage: 'wrong-package' }).error).toContain('Expected package');
      expect(verify(artifactDir, { expectedVersion: '9.9.9' }).error).toContain('Expected requested version');
      expect(verify(artifactDir, { expectedTag: 'next' }).error).toContain('Expected dist-tag');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects report digest and tarball integrity mismatches', () => {
    for (const target of ['report', 'tarball', 'shasum']) {
      const parent = mkdtempSync(path.join(os.tmpdir(), `rnick-digest-${target}-`));
      try {
        const { artifactDir } = createBundle(parent);
        if (target === 'report') {
          mutateCanonicalJson(path.join(artifactDir, REGISTRY_BUNDLE_FILES.manifest), (manifest) => {
            manifest.reportSha256 = '0'.repeat(64);
          });
          expect(verify(artifactDir).error).toContain('Report SHA-256');
        } else if (target === 'tarball') {
          const tarballPath = path.join(artifactDir, REGISTRY_BUNDLE_FILES.tarball);
          const bytes = readFileSync(tarballPath);
          bytes[20] ^= 0xff;
          writeFileSync(tarballPath, bytes);
          expect(verify(artifactDir).error).toContain('Tarball integrity');
        } else {
          const reportPath = path.join(artifactDir, REGISTRY_BUNDLE_FILES.report);
          mutateCanonicalJson(reportPath, (report) => {
            report.shasum = '0'.repeat(40);
          });
          writeFileSync(
            path.join(artifactDir, REGISTRY_BUNDLE_FILES.stdout),
            readFileSync(reportPath)
          );
          synchronizeManifest(artifactDir);
          mutateCanonicalJson(path.join(artifactDir, REGISTRY_BUNDLE_FILES.manifest), (manifest) => {
            manifest.tarballShasum = '0'.repeat(40);
          });
          expect(verify(artifactDir).error).toContain('Tarball shasum');
        }
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('rejects a corrupt tarball even when all outer digests agree', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-corrupt-'));
    try {
      const { artifactDir } = createBundle(parent);
      const corrupt = Buffer.from('not a gzip tarball');
      replaceTarballAndClaims(artifactDir, corrupt, REQUIRED_PACKAGE_FILES.length, 123);
      expect(verify(artifactDir).error).toContain('Could not decompress package tarball');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects missing files, forbidden files, and stale README contents', () => {
    const cases = [
      {
        name: 'missing',
        files: () => {
          const files = packageFiles();
          delete files['lib/index.d.ts'];
          return files;
        },
        message: 'missing expected files',
      },
      {
        name: 'forbidden',
        files: () => ({ ...packageFiles(), 'example/package.json': Buffer.from('{}\n') }),
        message: 'development-only files',
      },
      {
        name: 'readme',
        files: () => ({
          ...packageFiles(),
          'README.md': Buffer.from(`Status: v${VERSION} candidate\n`),
        }),
        message: 'stale package status',
      },
    ];

    for (const fixture of cases) {
      const parent = mkdtempSync(path.join(os.tmpdir(), `rnick-${fixture.name}-`));
      try {
        const { artifactDir } = createBundle(parent, {
          entries: Object.entries(fixture.files()),
        });
        expect(verify(artifactDir).error).toContain(fixture.message);
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('rejects archive traversal and link entries without extracting them', () => {
    for (const [name, maliciousEntry, message] of [
      ['traversal', ['../escape.txt', Buffer.from('escape')], 'contains traversal'],
      ['symlink', ['README-link', Buffer.alloc(0), '2', '../README.md'], 'link entry'],
    ]) {
      const parent = mkdtempSync(path.join(os.tmpdir(), `rnick-${name}-`));
      try {
        const entries = [...Object.entries(packageFiles()), maliciousEntry];
        const { artifactDir } = createBundle(parent, { entries });
        expect(verify(artifactDir).error).toContain(message);
        expect(readdirSync(parent).sort()).toEqual(['artifact']);
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('rejects manifest traversal and bundle file symlinks', () => {
    for (const mode of ['manifest', 'symlink', 'unexpected']) {
      const parent = mkdtempSync(path.join(os.tmpdir(), `rnick-path-${mode}-`));
      try {
        const { artifactDir } = createBundle(parent);
        if (mode === 'manifest') {
          mutateCanonicalJson(path.join(artifactDir, REGISTRY_BUNDLE_FILES.manifest), (manifest) => {
            manifest.tarballFile = '../package.tgz';
          });
          expect(verify(artifactDir).error).toContain('traversal');
        } else if (mode === 'symlink') {
          const stdoutPath = path.join(artifactDir, REGISTRY_BUNDLE_FILES.stdout);
          unlinkSync(stdoutPath);
          symlinkSync(REGISTRY_BUNDLE_FILES.report, stdoutPath);
          expect(verify(artifactDir).error).toContain('symbolic link');
        } else {
          writeFileSync(path.join(artifactDir, '.npmrc'), 'fixture-only=true\n', 'utf8');
          expect(verify(artifactDir).error).toContain('must contain exactly');
        }
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('leaves no incomplete bundle or verification report after atomic rename failure', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-atomic-'));
    try {
      const tarball = createTarGz(Object.entries(packageFiles()));
      const unpackedSize = Object.values(packageFiles()).reduce(
        (total, value) => total + value.length,
        0
      );
      const report = createRegistryReport({
        status: 'passed',
        packageName: PACKAGE_NAME,
        requestedVersion: VERSION,
        resolvedVersion: VERSION,
        expectedTag: EXPECTED_TAG,
        tagVersion: VERSION,
        publishedAt: '2026-07-12T05:47:42.131Z',
        tarball: 'https://registry.example/package.tgz',
        integrity: tarballIntegrity(tarball),
        shasum: tarballShasum(tarball),
        fileCount: REQUIRED_PACKAGE_FILES.length,
        packageSize: tarball.length,
        unpackedSize,
        readmeStatus: 'passed',
        forbiddenFiles: [],
        registryInstallSmoke: true,
        error: null,
      });
      const artifactDir = path.join(parent, 'artifact');
      expect(() =>
        writeRegistryBundleAtomic(artifactDir, report, tarball, {
          rename() {
            throw new Error('fixture bundle rename failure');
          },
        })
      ).toThrow('fixture bundle rename failure');
      expect(readdirSync(parent)).toEqual([]);

      const verificationPath = path.join(parent, 'verification.json');
      writeFileSync(verificationPath, 'previous-complete-report\n', 'utf8');
      expect(() =>
        writeVerificationReportAtomic(
          verificationPath,
          verifyRegistryProvenanceBundle({}),
          {
            rename() {
              throw new Error('fixture report rename failure');
            },
          }
        )
      ).toThrow('fixture report rename failure');
      expect(readFileSync(verificationPath, 'utf8')).toBe('previous-complete-report\n');
      expect(readdirSync(parent)).toEqual(['verification.json']);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('keeps the offline verifier free of network and registry command paths', () => {
    const sources = [
      readFileSync(path.join(ROOT, 'scripts', 'registry-provenance-core.mjs'), 'utf8'),
      readFileSync(VERIFIER, 'utf8'),
    ].join('\n');
    for (const forbidden of [
      "node:child_process",
      "node:http",
      "node:https",
      "node:net",
      "node:tls",
      "node:dns",
      'fetch(',
      'npm view',
      'npm pack',
      'gh run',
    ]) {
      expect(sources).not.toContain(forbidden);
    }
  });
});

function createTarGz(entries) {
  const blocks = [];
  for (const [entryName, rawContents, type = '0', linkName = ''] of entries) {
    const contents = Buffer.from(rawContents);
    const fullPath = entryName.startsWith('package/') ? entryName : `package/${entryName}`;
    const header = Buffer.alloc(512);
    const { name, prefix } = splitTarPath(fullPath);
    writeTarString(header, 0, 100, name);
    writeTarOctal(header, 100, 8, type === '5' ? 0o755 : 0o644);
    writeTarOctal(header, 108, 8, 0);
    writeTarOctal(header, 116, 8, 0);
    writeTarOctal(header, 124, 12, type === '0' ? contents.length : 0);
    writeTarOctal(header, 136, 12, 0);
    header.fill(32, 148, 156);
    header[156] = type.charCodeAt(0);
    writeTarString(header, 157, 100, linkName);
    writeTarString(header, 257, 6, 'ustar');
    writeTarString(header, 263, 2, '00');
    writeTarString(header, 265, 32, 'fixture');
    writeTarString(header, 297, 32, 'fixture');
    writeTarString(header, 345, 155, prefix);
    const checksum = [...header].reduce((total, value) => total + value, 0);
    const checksumValue = checksum.toString(8).padStart(6, '0');
    header.write(checksumValue, 148, 6, 'ascii');
    header[154] = 0;
    header[155] = 32;
    blocks.push(header);
    if (type === '0') {
      blocks.push(contents);
      const padding = (512 - (contents.length % 512)) % 512;
      if (padding) blocks.push(Buffer.alloc(padding));
    }
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks), { level: 9 });
}

function splitTarPath(value) {
  if (Buffer.byteLength(value) <= 100) return { name: value, prefix: '' };
  for (let index = value.lastIndexOf('/'); index > 0; index = value.lastIndexOf('/', index - 1)) {
    const prefix = value.slice(0, index);
    const name = value.slice(index + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) {
      return { name, prefix };
    }
  }
  throw new Error(`Fixture tar path is too long: ${value}`);
}

function writeTarString(buffer, offset, length, value) {
  const bytes = Buffer.from(value);
  if (bytes.length > length) throw new Error(`Fixture tar string is too long: ${value}`);
  bytes.copy(buffer, offset);
}

function writeTarOctal(buffer, offset, length, value) {
  const text = value.toString(8).padStart(length - 1, '0');
  buffer.write(text, offset, length - 1, 'ascii');
  buffer[offset + length - 1] = 0;
}
