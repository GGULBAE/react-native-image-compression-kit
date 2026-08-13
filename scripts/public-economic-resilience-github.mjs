import { createHash, randomUUID } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { ECONOMIC_RESILIENCE_ASSET_FILES } from './economic-resilience-evidence-core.mjs';
import {
  PUBLIC_ECONOMIC_RESILIENCE_BRANCH,
  inspectPublicEconomicResilienceArtifactMetadata,
  inspectPublicEconomicResilienceRunMetadata,
} from './public-economic-resilience-evidence-core.mjs';
import {
  PUBLIC_ECONOMIC_RESILIENCE_MAX_ZIP_BYTES,
  inspectPublicEconomicResilienceArtifactZip,
} from './public-economic-resilience-zip.mjs';

const REPOSITORY_API =
  'repos/GGULBAE/react-native-image-compression-kit';
const ARTIFACT_METADATA_SCHEMA_VERSION = 1;

export function acquirePublicEconomicResilienceRun(
  runId,
  { command = spawnSync } = {}
) {
  if (!Number.isSafeInteger(runId) || runId <= 0) {
    throw new Error('--run-id must be a positive safe integer');
  }
  const temporaryRoot = mkdtempSync(
    path.join(os.tmpdir(), 'rnick-public-economic-acquisition-')
  );
  try {
    const rawRun = requestJson(
      command,
      `${REPOSITORY_API}/actions/runs/${runId}`,
      'GitHub workflow run'
    );
    const runMetadata = normalizeRunMetadata(rawRun);
    const runErrors = inspectPublicEconomicResilienceRunMetadata(runMetadata, {
      sourceCommit: runMetadata.headSha,
    });
    if (runMetadata.runId !== runId) {
      runErrors.push('GitHub workflow run ID differs from --run-id');
    }
    if (runErrors.length > 0) throw new Error(runErrors.join(' | '));

    const rawArtifacts = requestJson(
      command,
      `${REPOSITORY_API}/actions/runs/${runId}/artifacts?per_page=100`,
      'GitHub workflow artifacts'
    );
    const artifacts = inspectAndNormalizeArtifacts(rawArtifacts, runMetadata);
    const runMetadataBytes = serializeJson(runMetadata);
    const artifactMetadata = {
      schemaVersion: ARTIFACT_METADATA_SCHEMA_VERSION,
      runId,
      artifacts,
    };
    const artifactMetadataBytes = serializeJson(artifactMetadata);
    const platforms = {};

    for (const artifact of artifacts) {
      const zipBytes = requestBytes(
        command,
        `${REPOSITORY_API}/actions/artifacts/${artifact.id}/zip`,
        `GitHub ${artifact.platform} artifact ZIP`
      );
      if (
        zipBytes.length !== artifact.sizeInBytes ||
        zipBytes.length === 0 ||
        zipBytes.length > PUBLIC_ECONOMIC_RESILIENCE_MAX_ZIP_BYTES
      ) {
        throw new Error(
          `GitHub ${artifact.platform} artifact ZIP size differs from API metadata`
        );
      }
      const digest = `sha256:${sha256(zipBytes)}`;
      if (digest !== artifact.digest) {
        throw new Error(
          `GitHub ${artifact.platform} artifact ZIP digest differs from API metadata`
        );
      }
      const zipFile = path.join(
        temporaryRoot,
        `${artifact.platform}-${artifact.id}-${randomUUID()}.zip`
      );
      writeFileSync(zipFile, zipBytes, { flag: 'wx', mode: 0o600 });
      const destination = path.join(temporaryRoot, artifact.platform);
      mkdirSync(destination);
      extractEconomicArtifact(command, zipFile, destination, artifact.platform);
      platforms[artifact.platform] = {
        artifactRoot: destination,
        zipFile,
        metadata: artifact,
      };
    }

    return {
      sourceCommit: runMetadata.headSha,
      runMetadata,
      runMetadataBytes,
      artifactMetadata,
      artifactMetadataBytes,
      platforms,
      cleanup() {
        rmSync(temporaryRoot, { recursive: true, force: false });
      },
    };
  } catch (error) {
    rmSync(temporaryRoot, { recursive: true, force: false });
    throw error;
  }
}

function normalizeRunMetadata(raw) {
  return {
    event: raw?.event,
    headBranch: raw?.head_branch,
    headSha: raw?.head_sha,
    conclusion: raw?.conclusion,
    workflowName: raw?.name,
    path: raw?.path,
    runId: raw?.id,
    attempt: raw?.run_attempt,
    url: raw?.html_url,
  };
}

function inspectAndNormalizeArtifacts(raw, runMetadata) {
  if (
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    raw.total_count !== 2 ||
    !Array.isArray(raw.artifacts) ||
    raw.artifacts.length !== 2
  ) {
    throw new Error('GitHub workflow must expose exactly two native demo artifacts');
  }
  const normalized = raw.artifacts
    .map((artifact) => {
      const prefix = 'native-demo-';
      const suffix = `-${runMetadata.headSha}`;
      const platform = artifact?.name?.startsWith(prefix) &&
        artifact.name.endsWith(suffix)
        ? artifact.name.slice(prefix.length, -suffix.length)
        : null;
      if (
        !['android', 'ios'].includes(platform) ||
        artifact?.workflow_run?.id !== runMetadata.runId ||
        artifact?.workflow_run?.head_branch !== PUBLIC_ECONOMIC_RESILIENCE_BRANCH ||
        artifact?.workflow_run?.head_sha !== runMetadata.headSha
      ) {
        throw new Error('GitHub artifact workflow identity is invalid');
      }
      return {
        platform,
        id: artifact.id,
        name: artifact.name,
        digest: artifact.digest,
        expired: artifact.expired,
        sizeInBytes: artifact.size_in_bytes,
        archiveDownloadUrl: artifact.archive_download_url,
      };
    })
    .sort((left, right) => left.platform.localeCompare(right.platform));
  const metadata = {
    schemaVersion: ARTIFACT_METADATA_SCHEMA_VERSION,
    runId: runMetadata.runId,
    artifacts: normalized,
  };
  const errors = inspectPublicEconomicResilienceArtifactMetadata(metadata, {
    runMetadata,
  });
  if (errors.length > 0) throw new Error(errors.join(' | '));
  return normalized;
}

function extractEconomicArtifact(command, zipFile, destination, platform) {
  const { members } = inspectPublicEconomicResilienceArtifactZip(zipFile, {
    command,
  });
  for (const asset of ECONOMIC_RESILIENCE_ASSET_FILES) {
    const member = `economic-resilience/${asset}`;
    const extracted = members.get(member);
    const destinationFile = path.join(destination, asset);
    writeFileSync(destinationFile, extracted, {
      flag: 'wx',
      mode: 0o644,
    });
    const status = lstatSync(destinationFile);
    if (!status.isFile() || status.isSymbolicLink() || status.nlink !== 1) {
      throw new Error(
        `${platform} acquired asset is not a single-link regular file: ${asset}`
      );
    }
  }
}

function requestJson(command, endpoint, label) {
  const bytes = request(command, endpoint, label, 'utf8');
  try {
    return JSON.parse(bytes);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}`);
  }
}

function requestBytes(command, endpoint, label) {
  const result = request(command, endpoint, label, null);
  return Buffer.isBuffer(result) ? result : Buffer.from(result);
}

function request(command, endpoint, label, encoding) {
  const result = command('gh', ['api', endpoint], {
    encoding,
    maxBuffer: PUBLIC_ECONOMIC_RESILIENCE_MAX_ZIP_BYTES + 1024 * 1024,
    timeout: 60_000,
  });
  assertCommand(result, label);
  return result.stdout;
}

function assertCommand(result, label) {
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8')
      : String(result.stderr ?? '');
    throw new Error(`${label} failed: ${stderr.trim() || `exit ${result.status}`}`);
  }
}

function serializeJson(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
