#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGISTRY_BUNDLE_FILES } from './registry-provenance-core.mjs';
import {
  RELEASE_EVIDENCE_ATTESTATION_FILES,
  RELEASE_EVIDENCE_POLICIES,
  sha256,
} from './release-evidence-core.mjs';
import { selectReleaseEvidenceArtifacts } from './release-evidence-acquisition-core.mjs';
import {
  createReleaseEvidenceGitHubClient,
  extractArtifactArchive,
} from './release-evidence-acquisition-github.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const FIXTURE_ROOT = path.join(
  ROOT,
  'test',
  'fixtures',
  'release-evidence-acquisition'
);
const ARCHIVES = Object.freeze([
  {
    key: 'provenance',
    file: 'provenance.zip',
    evidenceDir: 'provenance',
    expectedFiles: Object.values(REGISTRY_BUNDLE_FILES),
  },
  {
    key: 'attestation',
    file: 'attestation.zip',
    evidenceDir: 'attestation',
    expectedFiles: RELEASE_EVIDENCE_ATTESTATION_FILES,
  },
]);

function main() {
  const options = parseArgs(process.argv.slice(2));
  const versions =
    options.versions.length > 0
      ? options.versions
      : Object.keys(RELEASE_EVIDENCE_POLICIES);
  const github = options.check ? null : createReleaseEvidenceGitHubClient();

  for (const version of versions) {
    const policy = RELEASE_EVIDENCE_POLICIES[version];
    if (!policy) {
      throw new Error(`No committed release evidence policy exists for ${version}.`);
    }
    let downloads = null;
    if (!options.check) {
      const artifactsResponse = github.listArtifacts({
        repository: policy.repository,
        runId: policy.registryValidationRun.id,
      });
      const selected = selectReleaseEvidenceArtifacts({
        artifactsResponse,
        version,
        runId: policy.registryValidationRun.id,
        sourceDigest: policy.sourceDigest,
      });
      for (const archive of ARCHIVES) {
        const expected =
          archive.key === 'provenance'
            ? policy.provenanceArtifact
            : policy.attestationArtifact;
        const actual = selected[archive.key];
        if (
          actual.id !== expected.id ||
          actual.name !== expected.name ||
          actual.size_in_bytes !== expected.size ||
          actual.digest !== expected.digest ||
          actual.created_at !== expected.createdAt ||
          actual.expires_at !== expected.expiresAt
        ) {
          throw new Error(
            `${version} ${archive.file} GitHub metadata differs from policy.`
          );
        }
      }
      downloads = Object.fromEntries(
        ARCHIVES.map((archive) => [
          archive.key,
          github.downloadArtifact({
            repository: policy.repository,
            artifactId: selected[archive.key].id,
            expectedFiles: archive.expectedFiles,
          }),
        ])
      );
    }

    const fixtureDir = path.join(FIXTURE_ROOT, version);
    mkdirSync(fixtureDir, { recursive: true });
    for (const archive of ARCHIVES) {
      const fixturePath = path.join(fixtureDir, archive.file);
      if (!options.check) {
        writeAtomic(fixturePath, downloads[archive.key].zipBytes);
      }
      verifyFixture({ version, policy, archive, fixturePath });
    }
    process.stdout.write(
      `Release evidence acquisition fixture ${
        options.check ? 'check' : 'refresh'
      } passed: ${version}\n`
    );
  }
}

function verifyFixture({ version, policy, archive, fixturePath }) {
  if (!existsSync(fixturePath)) {
    throw new Error(`Missing acquisition fixture: ${fixturePath}`);
  }
  const zipBytes = readFileSync(fixturePath);
  const expectedArtifact =
    archive.key === 'provenance'
      ? policy.provenanceArtifact
      : policy.attestationArtifact;
  if (zipBytes.length !== expectedArtifact.size) {
    throw new Error(`${version} ${archive.file} size does not match policy.`);
  }
  if (`sha256:${sha256(zipBytes)}` !== expectedArtifact.digest) {
    throw new Error(`${version} ${archive.file} digest does not match policy.`);
  }
  const files = extractArtifactArchive(zipBytes, archive.expectedFiles);
  for (const file of archive.expectedFiles) {
    const retained = readFileSync(
      path.join(
        ROOT,
        'evidence',
        'npm',
        version,
        archive.evidenceDir,
        file
      )
    );
    if (!isDeepStrictEqual(files.get(file), retained)) {
      throw new Error(
        `${version} ${archive.file} entry ${file} differs from retained evidence.`
      );
    }
  }
}

function writeAtomic(filePath, bytes) {
  const temporary = `${filePath}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, bytes, { flag: 'wx' });
    renameSync(temporary, filePath);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function parseArgs(args) {
  const parsed = { check: false, versions: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--check') {
      parsed.check = true;
      continue;
    }
    if (arg === '--version') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --version.');
      }
      parsed.versions.push(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (new Set(parsed.versions).size !== parsed.versions.length) {
    throw new Error('Fixture versions must not contain duplicates.');
  }
  return parsed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
