#!/usr/bin/env node

import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractArtifactZip } from './artifact-zip-core.mjs';
import {
  RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES,
  canonicalReleaseEvidenceReviewArchiveMetadata,
  createReleaseEvidenceReviewArchiveMetadata,
} from './release-evidence-review-archive-core.mjs';
import {
  RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE,
} from './release-evidence-review-core.mjs';
import {
  RELEASE_EVIDENCE_REVIEW_ACQUISITION_ARTIFACTS_DIR,
  RELEASE_EVIDENCE_REVIEW_ACQUISITION_ATTESTATION_ZIP,
  RELEASE_EVIDENCE_REVIEW_ACQUISITION_MANIFEST_FILE,
  RELEASE_EVIDENCE_REVIEW_ACQUISITION_METADATA_FILE,
  RELEASE_EVIDENCE_REVIEW_ACQUISITION_REVIEW_ZIP,
  canonicalReleaseEvidenceReviewAcquisitionManifest,
} from './release-evidence-review-acquisition-core.mjs';
import { runReleaseEvidenceReviewAcquisition } from './acquire-release-evidence-review.mjs';
import { sha256 } from './release-evidence-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
export const REVIEW_ACQUISITION_FIXTURE_VERSION = '0.2.55';
export const REVIEW_ACQUISITION_FIXTURE_TIME = '2026-07-15T06:00:00.000Z';
export const REVIEW_ACQUISITION_REPOSITORY_ID = 1278863793;

export function createReleaseEvidenceReviewAcquisitionFixture(parent) {
  const version = REVIEW_ACQUISITION_FIXTURE_VERSION;
  const policy = RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES[version];
  const workflowPath = policy.workflow.slice(policy.repository.length + 1);
  const outputDir = path.join(parent, 'review-acquisition');
  const reviewZipBytes = readFileSync(
    path.join(ROOT, 'evidence', 'reviews', version, 'artifacts', 'review.zip')
  );
  const attestationZipBytes = readFileSync(
    path.join(
      ROOT,
      'evidence',
      'reviews',
      version,
      'artifacts',
      'attestation.zip'
    )
  );
  const reviewFiles = extractArtifactZip(reviewZipBytes);
  const attestationFiles = extractArtifactZip(attestationZipBytes);
  const branch = policy.sourceRef.replace(/^refs\/(?:heads|tags)\//, '');
  const artifactResponse = (artifact) => ({
    id: artifact.id,
    name: artifact.name,
    size_in_bytes: artifact.size,
    digest: artifact.digest,
    expired: false,
    created_at: artifact.createdAt,
    updated_at: artifact.createdAt,
    expires_at: artifact.expiresAt,
    workflow_run: {
      id: policy.reviewRun.id,
      head_branch: branch,
      head_sha: policy.sourceDigest,
      repository_id: REVIEW_ACQUISITION_REPOSITORY_ID,
      head_repository_id: REVIEW_ACQUISITION_REPOSITORY_ID,
    },
  });
  const runResponse = {
    id: policy.reviewRun.id,
    html_url: policy.reviewRun.url,
    event: policy.reviewRun.event,
    status: 'completed',
    conclusion: 'success',
    created_at: policy.reviewRun.createdAt,
    updated_at: policy.reviewRun.completedAt,
    head_sha: policy.sourceDigest,
    head_branch: branch,
    path: workflowPath,
    run_attempt: policy.reviewRun.runAttempt,
    actor: { login: policy.reviewer },
    triggering_actor: { login: policy.reviewer },
    repository: {
      id: REVIEW_ACQUISITION_REPOSITORY_ID,
      full_name: policy.repository,
    },
    head_repository: {
      id: REVIEW_ACQUISITION_REPOSITORY_ID,
      full_name: policy.repository,
    },
  };
  const bundle = JSON.parse(
    attestationFiles.get('attestation.jsonl').toString('utf8').trim()
  );
  const date = policy.attestation.verifiedAt.slice(0, 10).replaceAll('-', '/');
  const fixture = {
    options: {
      repository: policy.repository,
      workflowPath,
      sourceRef: policy.sourceRef,
      sourceDigest: policy.sourceDigest,
      runId: policy.reviewRun.id,
      version,
      outputDir,
      releaseArchiveRoot: path.join(ROOT, 'evidence', 'npm'),
      acquiredAt: REVIEW_ACQUISITION_FIXTURE_TIME,
    },
    runResponse,
    artifactsResponse: {
      total_count: 2,
      artifacts: [
        artifactResponse(policy.attestationArtifact),
        artifactResponse(policy.reviewArtifact),
      ],
    },
    attestationsResponse: {
      attestations: [
        {
          repository_id: REVIEW_ACQUISITION_REPOSITORY_ID,
          bundle_url:
            `https://fixtures.invalid/attestations/${REVIEW_ACQUISITION_REPOSITORY_ID}/` +
            `${date}/${policy.attestation.id}.json.sn?signature=redacted`,
          bundle,
        },
      ],
    },
    archives: {
      review: { zipBytes: reviewZipBytes, files: reviewFiles },
      attestation: { zipBytes: attestationZipBytes, files: attestationFiles },
    },
  };
  fixture.github = {
    getRun: () => fixture.runResponse,
    listArtifacts: () => fixture.artifactsResponse,
    getAttestations: () => fixture.attestationsResponse,
    downloadArtifact: ({ artifactId }) =>
      artifactId === policy.reviewArtifact.id
        ? fixture.archives.review
        : fixture.archives.attestation,
  };
  return fixture;
}

export function checkReleaseEvidenceReviewAcquisitionFixture() {
  const parent = mkdtempSync(
    path.join(os.tmpdir(), 'rnick-review-acquisition-fixture-')
  );
  try {
    const fixture = createReleaseEvidenceReviewAcquisitionFixture(parent);
    const report = runReleaseEvidenceReviewAcquisition(fixture.options, {
      github: fixture.github,
    });
    assert(report.status === 'passed', report.error ?? 'Fixture acquisition failed.');
    assert(
      report.checks.handoff === true && report.checks.atomicWrite === true,
      'Fixture acquisition did not complete atomic importer handoff.'
    );
    assert(
      JSON.stringify(readdirSync(fixture.options.outputDir).sort()) ===
        JSON.stringify([
          RELEASE_EVIDENCE_REVIEW_ACQUISITION_ARTIFACTS_DIR,
          RELEASE_EVIDENCE_REVIEW_ACQUISITION_MANIFEST_FILE,
          RELEASE_EVIDENCE_REVIEW_ACQUISITION_METADATA_FILE,
        ].sort()),
      'Fixture acquisition output layout drifted.'
    );
    const metadataBytes = readFileSync(
      path.join(
        fixture.options.outputDir,
        RELEASE_EVIDENCE_REVIEW_ACQUISITION_METADATA_FILE
      )
    );
    assert(
      metadataBytes.equals(
        Buffer.from(
          canonicalReleaseEvidenceReviewArchiveMetadata(
            createReleaseEvidenceReviewArchiveMetadata({
              version: REVIEW_ACQUISITION_FIXTURE_VERSION,
            })
          ),
          'utf8'
        )
      ),
      'Fixture acquisition canonical metadata drifted.'
    );
    for (const [name, expected] of [
      [RELEASE_EVIDENCE_REVIEW_ACQUISITION_REVIEW_ZIP, fixture.archives.review.zipBytes],
      [RELEASE_EVIDENCE_REVIEW_ACQUISITION_ATTESTATION_ZIP, fixture.archives.attestation.zipBytes],
    ]) {
      assert(
        readFileSync(
          path.join(
            fixture.options.outputDir,
            RELEASE_EVIDENCE_REVIEW_ACQUISITION_ARTIFACTS_DIR,
            name
          )
        ).equals(expected),
        `Fixture acquisition changed exact ${name} bytes.`
      );
    }
    const manifestBytes = readFileSync(
      path.join(
        fixture.options.outputDir,
        RELEASE_EVIDENCE_REVIEW_ACQUISITION_MANIFEST_FILE
      )
    );
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    assert(
      manifestBytes.equals(
        Buffer.from(
          canonicalReleaseEvidenceReviewAcquisitionManifest(manifest),
          'utf8'
        )
      ),
      'Fixture acquisition manifest is not canonical JSON.'
    );
    assert(
      sha256(fixture.archives.review.files.get(RELEASE_EVIDENCE_REVIEW_MANIFEST_FILE)) ===
        RELEASE_EVIDENCE_REVIEW_ARCHIVE_POLICIES[
          REVIEW_ACQUISITION_FIXTURE_VERSION
        ].manifestSha256,
      'Retained review manifest digest drifted.'
    );
    return report;
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  const report = checkReleaseEvidenceReviewAcquisitionFixture();
  process.stdout.write(
    `Release evidence review acquisition fixture is current for ${report.version} (${report.acquisitionSha256}).\n`
  );
}
