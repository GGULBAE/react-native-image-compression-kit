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
import { REGISTRY_BUNDLE_FILES } from '../scripts/registry-provenance-core.mjs';
import {
  RELEASE_EVIDENCE_ATTESTATION_FILES,
  RELEASE_EVIDENCE_FILE_PATHS,
  RELEASE_EVIDENCE_INDEX_FILE,
  RELEASE_EVIDENCE_POLICIES,
} from '../scripts/release-evidence-core.mjs';
import {
  RELEASE_EVIDENCE_ACQUISITION_CHECK_FIELDS,
  RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FIELDS,
  RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FILE,
  RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE,
  RELEASE_EVIDENCE_ACQUISITION_REPORT_FIELDS,
  acquireReleaseEvidenceBundle,
  canonicalReleaseEvidenceAcquisitionManifest,
  canonicalReleaseEvidenceAcquisitionReport,
  validateArtifactArchiveFileNames,
  writeReleaseEvidenceAcquisitionReportAtomic,
} from '../scripts/release-evidence-acquisition-core.mjs';
import {
  createReleaseEvidenceGitHubClient,
  extractArtifactArchive,
} from '../scripts/release-evidence-acquisition-github.mjs';
import {
  parseReleaseEvidenceAcquisitionArgs,
  runReleaseEvidenceAcquisition,
} from '../scripts/acquire-release-evidence.mjs';
import {
  canonicalReleaseEvidenceImportMetadata,
  createReleaseEvidenceImportMetadata,
  importReleaseEvidenceArchive,
} from '../scripts/release-evidence-import-core.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const FIXTURE_ROOT = path.join(
  TEST_DIR,
  'fixtures',
  'release-evidence-acquisition'
);
const REFRESHER = path.join(
  ROOT,
  'scripts',
  'refresh-release-evidence-acquisition-fixtures.mjs'
);
const CORE = path.join(
  ROOT,
  'scripts',
  'release-evidence-acquisition-core.mjs'
);
const VERSIONS = ['0.2.50', '0.2.55', '0.2.62'];
const REPOSITORY_ID = 1278863793;

function acquisitionOptions(parent, version = '0.2.55') {
  const policy = RELEASE_EVIDENCE_POLICIES[version];
  return {
    repository: policy.repository,
    workflowPath: policy.workflow.slice(policy.repository.length + 1),
    sourceRef: policy.sourceRef,
    sourceDigest: policy.sourceDigest,
    runId: policy.registryValidationRun.id,
    version,
    expectedTag: policy.expectedTag,
    outputDir: path.join(parent, `acquisition-${version}`),
  };
}

function fixtureResponses(version) {
  const policy = RELEASE_EVIDENCE_POLICIES[version];
  const branch = policy.sourceRef.replace(/^refs\/(?:heads|tags)\//, '');
  const runResponse = {
    id: policy.registryValidationRun.id,
    html_url: policy.registryValidationRun.url,
    event: policy.registryValidationRun.event,
    status: 'completed',
    conclusion: 'success',
    created_at: policy.registryValidationRun.createdAt,
    updated_at: policy.registryValidationRun.completedAt,
    head_sha: policy.sourceDigest,
    head_branch: branch,
    path: policy.workflow.slice(policy.repository.length + 1),
    run_attempt: 1,
    repository: { id: REPOSITORY_ID, full_name: policy.repository },
    head_repository: { id: REPOSITORY_ID, full_name: policy.repository },
  };
  const artifacts = [policy.attestationArtifact, policy.provenanceArtifact].map(
    (artifact) => ({
      id: artifact.id,
      name: artifact.name,
      size_in_bytes: artifact.size,
      digest: artifact.digest,
      expired: false,
      created_at: artifact.createdAt,
      updated_at: artifact.createdAt,
      expires_at: artifact.expiresAt,
      workflow_run: {
        id: policy.registryValidationRun.id,
        head_branch: branch,
        head_sha: policy.sourceDigest,
        repository_id: REPOSITORY_ID,
        head_repository_id: REPOSITORY_ID,
      },
    })
  );
  const artifactArchives = {
    provenance: readFixtureArchive(version, 'provenance'),
    attestation: readFixtureArchive(version, 'attestation'),
  };
  const downloadedBundle = JSON.parse(
    artifactArchives.attestation.files
      .get('attestation.jsonl')
      .toString('utf8')
      .trim()
  );
  const verifiedDate = policy.attestation.verifiedAt.slice(0, 10).replaceAll('-', '/');
  const attestationsResponse = {
    attestations: [
      {
        repository_id: REPOSITORY_ID,
        initiator: 'user',
        bundle_url:
          `https://fixtures.invalid/attestations/${REPOSITORY_ID}/` +
          `${verifiedDate}/${policy.attestation.id}.json.sn?signature=redacted`,
        bundle: downloadedBundle,
      },
    ],
  };
  return {
    runResponse,
    artifactsResponse: { total_count: artifacts.length, artifacts },
    attestationsResponse,
    artifactArchives,
  };
}

function readFixtureArchive(version, kind) {
  const zipBytes = readFileSync(
    path.join(FIXTURE_ROOT, version, `${kind}.zip`)
  );
  const expectedFiles =
    kind === 'provenance'
      ? Object.values(REGISTRY_BUNDLE_FILES)
      : RELEASE_EVIDENCE_ATTESTATION_FILES;
  return {
    zipBytes,
    files: extractArtifactArchive(zipBytes, expectedFiles),
  };
}

function mockGitHub(version) {
  const fixture = fixtureResponses(version);
  return {
    getRun: () => fixture.runResponse,
    listArtifacts: () => fixture.artifactsResponse,
    getAttestations: () => fixture.attestationsResponse,
    downloadArtifact: ({ artifactId }) => {
      const policy = RELEASE_EVIDENCE_POLICIES[version];
      return artifactId === policy.provenanceArtifact.id
        ? fixture.artifactArchives.provenance
        : fixture.artifactArchives.attestation;
    },
  };
}

function expectDirectoriesEqual(actualRoot, expectedRoot) {
  expect(
    readFileSync(path.join(actualRoot, RELEASE_EVIDENCE_INDEX_FILE))
  ).toEqual(readFileSync(path.join(expectedRoot, RELEASE_EVIDENCE_INDEX_FILE)));
  for (const relativePath of RELEASE_EVIDENCE_FILE_PATHS) {
    expect(readFileSync(path.join(actualRoot, relativePath))).toEqual(
      readFileSync(path.join(expectedRoot, relativePath))
    );
  }
}

describe('Registry Validation release evidence acquisition', () => {
  it.each(VERSIONS)(
    'acquires canonical %s inputs and hands them to the existing importer byte-for-byte',
    (version) => {
      const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-acquisition-'));
      try {
        const options = acquisitionOptions(parent, version);
        const report = runReleaseEvidenceAcquisition(options, {
          github: mockGitHub(version),
        });
        expect(Object.keys(report)).toEqual(
          RELEASE_EVIDENCE_ACQUISITION_REPORT_FIELDS
        );
        expect(Object.keys(report.checks)).toEqual(
          RELEASE_EVIDENCE_ACQUISITION_CHECK_FIELDS
        );
        expect(report).toMatchObject({
          status: 'passed',
          version,
          expectedTag: 'latest',
          repository: 'GGULBAE/react-native-image-compression-kit',
          runId: RELEASE_EVIDENCE_POLICIES[version].registryValidationRun.id,
          evidenceSha256:
            JSON.parse(
              readFileSync(
                path.join(
                  ROOT,
                  'evidence',
                  'npm',
                  version,
                  RELEASE_EVIDENCE_INDEX_FILE
                )
              )
            ).evidenceSha256,
          checks: Object.fromEntries(
            RELEASE_EVIDENCE_ACQUISITION_CHECK_FIELDS.map((field) => [
              field,
              true,
            ])
          ),
          error: null,
        });
        expect(
          canonicalReleaseEvidenceAcquisitionReport(report).trim().split('\n')
        ).toHaveLength(1);
        expect(readdirSync(options.outputDir).sort()).toEqual([
          'acquisition-manifest.json',
          'attestation',
          'provenance',
          'release-evidence-metadata.json',
        ]);

        const metadataBytes = readFileSync(
          path.join(
            options.outputDir,
            RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE
          ),
          'utf8'
        );
        expect(metadataBytes).toBe(
          canonicalReleaseEvidenceImportMetadata(
            createReleaseEvidenceImportMetadata({ version })
          )
        );
        const manifestBytes = readFileSync(
          path.join(
            options.outputDir,
            RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FILE
          ),
          'utf8'
        );
        const manifest = JSON.parse(manifestBytes);
        expect(Object.keys(manifest)).toEqual(
          RELEASE_EVIDENCE_ACQUISITION_MANIFEST_FIELDS
        );
        expect(manifestBytes).toBe(
          canonicalReleaseEvidenceAcquisitionManifest(manifest)
        );
        expect(manifest.acquisitionSha256).toBe(report.acquisitionSha256);

        const imported = path.join(parent, `imported-${version}`);
        const handoff = importReleaseEvidenceArchive({
          provenanceArtifactDir: path.join(options.outputDir, 'provenance'),
          attestationArtifactDir: path.join(options.outputDir, 'attestation'),
          metadataFile: path.join(
            options.outputDir,
            RELEASE_EVIDENCE_ACQUISITION_METADATA_FILE
          ),
          archiveDir: imported,
          expectedVersion: version,
        });
        expect(handoff.status).toBe('passed');
        expectDirectoriesEqual(
          imported,
          path.join(ROOT, 'evidence', 'npm', version)
        );
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  );

  it.each([
    ['conclusion', (fixture) => (fixture.runResponse.conclusion = 'failure')],
    ['workflow', (fixture) => (fixture.runResponse.path = '.github/workflows/ci.yml')],
    ['repository', (fixture) => (fixture.runResponse.repository.full_name = 'other/repo')],
    ['ref', (fixture) => (fixture.runResponse.head_branch = 'other')],
    ['head SHA', (fixture) => (fixture.runResponse.head_sha = '0'.repeat(40))],
  ])('rejects a wrong successful-run %s before creating output', (_, mutate) => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-acquisition-run-'));
    try {
      const options = acquisitionOptions(parent);
      const fixture = fixtureResponses('0.2.55');
      mutate(fixture);
      const report = acquireReleaseEvidenceBundle({ ...options, ...fixture });
      expect(report.status).toBe('failed');
      expect(report.checks.run).toBe(false);
      expect(() => readdirSync(options.outputDir)).toThrow();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it.each([
    ['artifact ID', (fixture) => (fixture.artifactsResponse.artifacts[0].id += 1)],
    ['artifact digest', (fixture) => {
      fixture.artifactsResponse.artifacts[0].digest = `sha256:${'0'.repeat(64)}`;
    }],
    ['artifact expiration', (fixture) => (fixture.artifactsResponse.artifacts[0].expires_at = '2027-01-01T00:00:00Z')],
    ['expired artifact', (fixture) => (fixture.artifactsResponse.artifacts[0].expired = true)],
  ])('rejects wrong %s metadata without exposing output', (_, mutate) => {
    const parent = mkdtempSync(
      path.join(os.tmpdir(), 'rnick-acquisition-artifact-')
    );
    try {
      const options = acquisitionOptions(parent);
      const fixture = fixtureResponses('0.2.55');
      mutate(fixture);
      const report = acquireReleaseEvidenceBundle({ ...options, ...fixture });
      expect(report.status).toBe('failed');
      expect(() => readdirSync(options.outputDir)).toThrow();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects a downloaded artifact ZIP digest mismatch', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-acquisition-zip-'));
    try {
      const options = acquisitionOptions(parent);
      const fixture = fixtureResponses('0.2.55');
      fixture.artifactArchives.provenance.zipBytes = Buffer.from(
        fixture.artifactArchives.provenance.zipBytes
      );
      fixture.artifactArchives.provenance.zipBytes[0] ^= 0xff;
      const report = acquireReleaseEvidenceBundle({ ...options, ...fixture });
      expect(report.status).toBe('failed');
      expect(report.error).toContain('ZIP digest');
      expect(() => readdirSync(options.outputDir)).toThrow();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it.each([
    ['bundle', (fixture) => (fixture.attestationsResponse.attestations[0].bundle = {})],
    ['ID', (fixture) => {
      fixture.attestationsResponse.attestations[0].bundle_url =
        fixture.attestationsResponse.attestations[0].bundle_url.replace(
          '35257248.json.sn',
          '35257249.json.sn'
        );
    }],
  ])('rejects an attestation %s disagreement', (_, mutate) => {
    const parent = mkdtempSync(
      path.join(os.tmpdir(), 'rnick-acquisition-attestation-')
    );
    try {
      const options = acquisitionOptions(parent);
      const fixture = fixtureResponses('0.2.55');
      mutate(fixture);
      const report = acquireReleaseEvidenceBundle({ ...options, ...fixture });
      expect(report.status).toBe('failed');
      expect(() => readdirSync(options.outputDir)).toThrow();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects unsafe, duplicate, missing, and additional ZIP entries', () => {
    for (const files of [
      ['../file.txt'],
      ['file.txt', 'file.txt'],
      [],
      ['file.txt', 'extra.txt'],
    ]) {
      expect(() =>
        validateArtifactArchiveFileNames(files, ['file.txt'])
      ).toThrow();
    }
  });

  it('removes staged output and importer handoff after an atomic rename failure', () => {
    const parent = mkdtempSync(
      path.join(os.tmpdir(), 'rnick-acquisition-atomic-')
    );
    try {
      const options = acquisitionOptions(parent);
      const fixture = fixtureResponses('0.2.55');
      const report = acquireReleaseEvidenceBundle(
        { ...options, ...fixture },
        {
          rename: () => {
            throw new Error('fixture rename failure');
          },
        }
      );
      expect(report.status).toBe('failed');
      expect(report.error).toContain('fixture rename failure');
      expect(report.checks.handoff).toBe(true);
      expect(report.checks.atomicWrite).toBe(false);
      expect(readdirSync(parent)).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('removes staged output after a write or importer handoff failure', () => {
    for (const mode of ['write', 'handoff']) {
      const parent = mkdtempSync(
        path.join(os.tmpdir(), `rnick-acquisition-${mode}-`)
      );
      try {
        const options = acquisitionOptions(parent);
        const fixture = fixtureResponses('0.2.55');
        const dependencies =
          mode === 'write'
            ? {
                writeFile: () => {
                  throw new Error('fixture write failure');
                },
              }
            : {
                importArchive: () => ({
                  status: 'failed',
                  error: 'fixture handoff failure',
                }),
              };
        const report = acquireReleaseEvidenceBundle(
          { ...options, ...fixture },
          dependencies
        );
        expect(report.status).toBe('failed');
        expect(report.error).toContain(`fixture ${mode} failure`);
        expect(report.checks.atomicWrite).toBe(false);
        expect(readdirSync(parent)).toEqual([]);
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('never replaces an existing acquisition destination', () => {
    const parent = mkdtempSync(
      path.join(os.tmpdir(), 'rnick-acquisition-existing-')
    );
    try {
      const options = acquisitionOptions(parent);
      cpSync(path.join(FIXTURE_ROOT, '0.2.55'), options.outputDir, {
        recursive: true,
      });
      const before = readdirSync(options.outputDir);
      const fixture = fixtureResponses('0.2.55');
      const report = acquireReleaseEvidenceBundle({ ...options, ...fixture });
      expect(report.status).toBe('failed');
      expect(report.error).toContain('destination already exists');
      expect(readdirSync(options.outputDir)).toEqual(before);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('writes report bytes identical to the canonical stdout representation', () => {
    const parent = mkdtempSync(
      path.join(os.tmpdir(), 'rnick-acquisition-report-success-')
    );
    try {
      const destination = path.join(parent, 'report.json');
      const report = runReleaseEvidenceAcquisition(
        acquisitionOptions(parent),
        { github: mockGitHub('0.2.55') }
      );
      const stdout = canonicalReleaseEvidenceAcquisitionReport(report);
      writeReleaseEvidenceAcquisitionReportAtomic(destination, report);
      expect(readFileSync(destination, 'utf8')).toBe(stdout);
      expect(stdout.trim().split('\n')).toHaveLength(1);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('preserves a previous report and removes temporary bytes on atomic failure', () => {
    const parent = mkdtempSync(
      path.join(os.tmpdir(), 'rnick-acquisition-report-')
    );
    try {
      const destination = path.join(parent, 'report.json');
      writeFileSync(destination, 'previous\n');
      const report = runReleaseEvidenceAcquisition(
        acquisitionOptions(parent),
        { github: mockGitHub('0.2.55') }
      );
      expect(() =>
        writeReleaseEvidenceAcquisitionReportAtomic(destination, report, {
          rename: () => {
            throw new Error('fixture report rename failure');
          },
        })
      ).toThrow('fixture report rename failure');
      expect(readFileSync(destination, 'utf8')).toBe('previous\n');
      expect(readdirSync(parent).sort()).toEqual([
        'acquisition-0.2.55',
        'report.json',
      ]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('requires every trust input explicitly and never selects the latest run', () => {
    expect(
      parseReleaseEvidenceAcquisitionArgs([
        '--repository',
        'GGULBAE/react-native-image-compression-kit',
        '--workflow',
        '.github/workflows/registry-validation.yml',
        '--source-ref',
        'refs/heads/master',
        '--source-digest',
        '1'.repeat(40),
        '--run-id',
        '123',
        '--version',
        '0.2.55',
        '--expected-tag',
        'latest',
        '--output-dir',
        'acquisition',
        '--report-file',
        'report.json',
        '--json',
      ])
    ).toEqual({
      repository: 'GGULBAE/react-native-image-compression-kit',
      workflowPath: '.github/workflows/registry-validation.yml',
      sourceRef: 'refs/heads/master',
      sourceDigest: '1'.repeat(40),
      runId: 123,
      version: '0.2.55',
      expectedTag: 'latest',
      outputDir: 'acquisition',
      reportFile: 'report.json',
      json: true,
    });
    expect(() =>
      runReleaseEvidenceAcquisition(
        {
          repository: 'GGULBAE/react-native-image-compression-kit',
          version: '0.2.55',
          outputDir: 'acquisition',
        },
        { github: {} }
      )
    ).toThrow('Workflow path must be an explicit');
    expect(() =>
      runReleaseEvidenceAcquisition(
        {
          ...acquisitionOptions('/tmp'),
          outputDir: '/tmp/acquisition',
          reportFile: '/tmp/acquisition/report.json',
        },
        { github: mockGitHub('0.2.55') }
      )
    ).toThrow('must be outside the canonical output directory');
  });

  it('builds exact gh API requests and extracts only validated ZIP entries', () => {
    const calls = [];
    const runCommand = (command, args, { encoding }) => {
      calls.push({ command, args, encoding });
      if (command === 'unzip' && args[0] === '-Z1') return 'file.txt\n';
      if (command === 'unzip' && args[0] === '-p') return Buffer.from('file');
      if (args.at(-1)?.endsWith('/zip')) return Buffer.from('zip');
      return JSON.stringify({ ok: true });
    };
    const github = createReleaseEvidenceGitHubClient({ runCommand });
    expect(
      github.getRun({ repository: 'owner/repo', runId: 123 })
    ).toEqual({ ok: true });
    expect(
      github.listArtifacts({ repository: 'owner/repo', runId: 123 })
    ).toEqual({ ok: true });
    expect(
      github.getAttestations({
        repository: 'owner/repo',
        subjectSha256: 'a'.repeat(64),
      })
    ).toEqual({ ok: true });
    const archive = github.downloadArtifact({
      repository: 'owner/repo',
      artifactId: 456,
      expectedFiles: ['file.txt'],
    });
    expect(archive.zipBytes).toEqual(Buffer.from('zip'));
    expect(archive.files.get('file.txt')).toEqual(Buffer.from('file'));
    expect(calls.filter((call) => call.command === 'gh').map((call) => call.args))
      .toEqual([
        ['api', 'repos/owner/repo/actions/runs/123'],
        ['api', 'repos/owner/repo/actions/runs/123/artifacts'],
        ['api', `repos/owner/repo/attestations/sha256:${'a'.repeat(64)}`],
        ['api', 'repos/owner/repo/actions/artifacts/456/zip'],
      ]);
    expect(calls.some((call) => call.args.includes('latest'))).toBe(false);
  });

  it('hydrates a bundle URL response through an exact-subject gh download', () => {
    const subjectBytes = Buffer.from('{"subject":"exact"}\n');
    const bundle = { mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json' };
    const calls = [];
    const runCommand = (command, args, options = {}) => {
      calls.push({ command, args, options });
      if (args[0] === 'api') {
        return JSON.stringify({
          attestations: [
            {
              repository_id: 123,
              bundle: null,
              bundle_url: 'https://example.test/attestation',
            },
          ],
        });
      }
      if (args[0] === 'attestation' && args[1] === 'download') {
        expect(readFileSync(args[2])).toEqual(subjectBytes);
        writeFileSync(
          path.join(options.cwd, 'sha256-test.jsonl'),
          `${JSON.stringify(bundle)}\n`
        );
        return '';
      }
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    };
    const github = createReleaseEvidenceGitHubClient({ runCommand });
    const response = github.getAttestations({
      repository: 'owner/repo',
      subjectSha256: 'a'.repeat(64),
      subjectBytes,
    });
    expect(response.attestations).toEqual([
      {
        repository_id: 123,
        bundle,
        bundle_url: 'https://example.test/attestation',
      },
    ]);
    expect(calls[1].args).toEqual([
      'attestation',
      'download',
      expect.any(String),
      '--repo',
      'owner/repo',
      '--limit',
      '2',
    ]);
    expect(calls.some((call) => call.args.includes('latest'))).toBe(false);
  });

  it('keeps validation core network-free and fixture checking offline', () => {
    const source = readFileSync(CORE, 'utf8');
    for (const forbidden of [
      'node:child_process',
      'fetch(',
      'gh api',
      'https.request',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    const result = spawnSync(process.execPath, [REFRESHER, '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        HTTP_PROXY: 'http://127.0.0.1:9',
        HTTPS_PROXY: 'http://127.0.0.1:9',
        ALL_PROXY: 'http://127.0.0.1:9',
        NO_PROXY: '',
        GH_PROMPT_DISABLED: '1',
      },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('0.2.50');
    expect(result.stdout).toContain('0.2.55');
    expect(result.stdout).toContain('0.2.62');
  });
});
