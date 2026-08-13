import {
  createHash,
} from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  ECONOMIC_RESILIENCE_ASSET_FILES,
  ECONOMIC_RESILIENCE_SCENARIO_ID,
  inspectEconomicResilienceEvidence,
} from './economic-resilience-evidence-core.mjs';
import { PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE } from './demo-visual-agreement-core.mjs';
import { inspectPublicEconomicResilienceArtifactZip } from './public-economic-resilience-zip.mjs';

export const PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_SCHEMA_VERSION = 1;
export const PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ID =
  'economic-resilience-source-tree-v1';
export const PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ROOT =
  'website/public/evidence/economic-resilience';
export const PUBLIC_ECONOMIC_RESILIENCE_INDEX_FILE = 'index.json';
export const PUBLIC_ECONOMIC_RESILIENCE_CAPTURE_SET_FILE = 'capture-set.json';
export const PUBLIC_ECONOMIC_RESILIENCE_RUN_METADATA_FILE = 'run-metadata.json';
export const PUBLIC_ECONOMIC_RESILIENCE_ARTIFACT_METADATA_FILE =
  'artifact-metadata.json';
export const PUBLIC_ECONOMIC_RESILIENCE_WORKFLOW =
  '.github/workflows/demo-evidence.yml';
export const PUBLIC_ECONOMIC_RESILIENCE_WORKFLOW_NAME =
  'Native Demo Evidence';
export const PUBLIC_ECONOMIC_RESILIENCE_EVENT = 'workflow_dispatch';
export const PUBLIC_ECONOMIC_RESILIENCE_BRANCH = 'master';
export const PUBLIC_ECONOMIC_RESILIENCE_RUN_URL_PREFIX =
  'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/';

const INDEX_FIELDS = ['archive', 'captures', 'schemaVersion'].sort();
const INDEX_CAPTURE_FIELDS = ['captureSetPath', 'runId', 'sourceCommit'].sort();
const CAPTURE_SET_FIELDS = [
  'artifactMetadata',
  'claimBoundary',
  'platforms',
  'scenarioId',
  'schemaVersion',
  'sourceCommit',
  'status',
  'workflow',
].sort();
const WORKFLOW_FIELDS = [
  'eventName',
  'file',
  'headBranch',
  'headSha',
  'metadataFile',
  'metadataSha256',
  'ref',
  'runAttempt',
  'runId',
  'runUrl',
  'workflowName',
].sort();
const RUN_METADATA_FIELDS = [
  'attempt',
  'conclusion',
  'event',
  'headBranch',
  'headSha',
  'path',
  'runId',
  'url',
  'workflowName',
].sort();
const PLATFORM_FIELDS = [
  'artifactArchivePath',
  'artifactDigest',
  'artifactExpired',
  'artifactId',
  'artifactName',
  'artifactPath',
  'artifactSizeInBytes',
].sort();
const ARTIFACT_METADATA_FIELDS = ['artifacts', 'runId', 'schemaVersion'].sort();
const ARTIFACT_FIELDS = [
  'archiveDownloadUrl',
  'digest',
  'expired',
  'id',
  'name',
  'platform',
  'sizeInBytes',
].sort();
const CLAIM_BOUNDARY_FIELDS = [
  'costSavingsClaim',
  'crossPlatformTimingComparison',
  'matchedTransferBaseline',
  'observation',
  'sourceOwnership',
].sort();

export function createEmptyPublicEconomicResilienceIndex() {
  return {
    schemaVersion: PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_SCHEMA_VERSION,
    archive: PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ID,
    captures: [],
  };
}

export function buildPublicEconomicResilienceCaptureSet({
  sourceCommit,
  runMetadata,
  runMetadataBytes,
  artifactMetadata,
  artifactMetadataBytes,
  androidEvidence,
  iosEvidence,
}) {
  const metadataErrors = inspectPublicEconomicResilienceRunMetadata(
    runMetadata,
    { sourceCommit }
  );
  if (metadataErrors.length > 0) throw new Error(metadataErrors.join(' | '));
  if (!Buffer.isBuffer(runMetadataBytes)) {
    throw new Error('public economic resilience run metadata bytes are required');
  }
  const artifactErrors = inspectPublicEconomicResilienceArtifactMetadata(
    artifactMetadata,
    { runMetadata }
  );
  if (artifactErrors.length > 0) throw new Error(artifactErrors.join(' | '));
  if (!Buffer.isBuffer(artifactMetadataBytes)) {
    throw new Error('public economic resilience artifact metadata bytes are required');
  }
  const artifactsByPlatform = Object.fromEntries(
    artifactMetadata.artifacts.map((artifact) => [artifact.platform, artifact])
  );
  const captureSet = {
    schemaVersion: PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_SCHEMA_VERSION,
    status: 'passed',
    scenarioId: ECONOMIC_RESILIENCE_SCENARIO_ID,
    sourceCommit,
    artifactMetadata: {
      file: PUBLIC_ECONOMIC_RESILIENCE_ARTIFACT_METADATA_FILE,
      sha256: sha256(artifactMetadataBytes),
    },
    workflow: {
      metadataFile: PUBLIC_ECONOMIC_RESILIENCE_RUN_METADATA_FILE,
      metadataSha256: sha256(runMetadataBytes),
      file: runMetadata.path,
      workflowName: runMetadata.workflowName,
      eventName: runMetadata.event,
      headBranch: runMetadata.headBranch,
      ref: `refs/heads/${runMetadata.headBranch}`,
      headSha: runMetadata.headSha,
      runId: runMetadata.runId,
      runAttempt: runMetadata.attempt,
      runUrl: runMetadata.url,
    },
    platforms: {
      android: capturePlatform('android', artifactsByPlatform.android),
      ios: capturePlatform('ios', artifactsByPlatform.ios),
    },
    claimBoundary: {
      observation: 'source-to-output-byte-difference',
      sourceOwnership: 'source-remains',
      matchedTransferBaseline: null,
      costSavingsClaim: null,
      crossPlatformTimingComparison: null,
    },
  };
  const errors = inspectPublicEconomicResilienceCaptureSet(captureSet, {
    androidEvidence,
    iosEvidence,
    runMetadata,
    runMetadataBytes,
    artifactMetadata,
    artifactMetadataBytes,
  });
  if (errors.length > 0) throw new Error(errors.join(' | '));
  return captureSet;
}

export function inspectPublicEconomicResilienceRunMetadata(
  metadata,
  { sourceCommit } = {}
) {
  const errors = [];
  if (!exactFields(metadata, RUN_METADATA_FIELDS)) {
    errors.push('public economic resilience run metadata fields drifted');
  }
  if (
    metadata?.event !== PUBLIC_ECONOMIC_RESILIENCE_EVENT ||
    metadata?.headBranch !== PUBLIC_ECONOMIC_RESILIENCE_BRANCH ||
    metadata?.conclusion !== 'success' ||
    metadata?.workflowName !== PUBLIC_ECONOMIC_RESILIENCE_WORKFLOW_NAME ||
    metadata?.path !== PUBLIC_ECONOMIC_RESILIENCE_WORKFLOW ||
    !fullSha(metadata?.headSha) ||
    (sourceCommit !== undefined && metadata?.headSha !== sourceCommit) ||
    !positiveInteger(metadata?.runId) ||
    !positiveInteger(metadata?.attempt) ||
    !validRunUrl(metadata?.url, metadata?.runId)
  ) {
    errors.push(
      'public economic resilience run metadata must identify a successful master workflow_dispatch run'
    );
  }
  return errors;
}

export function inspectPublicEconomicResilienceArtifactMetadata(
  metadata,
  { runMetadata } = {}
) {
  const errors = [];
  if (!exactFields(metadata, ARTIFACT_METADATA_FIELDS)) {
    errors.push('public economic resilience artifact metadata fields drifted');
  }
  if (
    metadata?.schemaVersion !== 1 ||
    !positiveInteger(metadata?.runId) ||
    (runMetadata !== undefined && metadata?.runId !== runMetadata?.runId)
  ) {
    errors.push('public economic resilience artifact metadata run identity is invalid');
  }
  if (!Array.isArray(metadata?.artifacts) || metadata.artifacts.length !== 2) {
    errors.push('public economic resilience artifact metadata must contain two artifacts');
    return errors;
  }
  ['android', 'ios'].forEach((platform, index) => {
    const artifact = metadata.artifacts[index];
    if (!exactFields(artifact, ARTIFACT_FIELDS)) {
      errors.push(`public economic resilience ${platform} artifact fields drifted`);
    }
    if (
      artifact?.platform !== platform ||
      !positiveInteger(artifact?.id) ||
      artifact?.name !==
        `native-demo-${platform}-${runMetadata?.headSha ?? ''}` ||
      !/^sha256:[0-9a-f]{64}$/u.test(artifact?.digest ?? '') ||
      artifact?.expired !== false ||
      !positiveInteger(artifact?.sizeInBytes) ||
      artifact.sizeInBytes > 64 * 1024 * 1024 ||
      artifact?.archiveDownloadUrl !==
        `https://api.github.com/repos/GGULBAE/react-native-image-compression-kit/actions/artifacts/${artifact?.id}/zip`
    ) {
      errors.push(`public economic resilience ${platform} artifact identity is invalid`);
    }
  });
  return errors;
}

export function appendPublicEconomicResilienceIndex(index, captureSet) {
  const errors = inspectPublicEconomicResilienceIndex(index);
  errors.push(...inspectPublicEconomicResilienceCaptureSet(captureSet));
  if (errors.length > 0) throw new Error(errors.join(' | '));
  if (
    index.captures.some(
      ({ sourceCommit }) => sourceCommit === captureSet.sourceCommit
    )
  ) {
    throw new Error(
      `public economic resilience capture already exists for ${captureSet.sourceCommit}`
    );
  }
  return {
    ...structuredClone(index),
    captures: [
      ...structuredClone(index.captures),
      {
        sourceCommit: captureSet.sourceCommit,
        runId: captureSet.workflow.runId,
        captureSetPath:
          `source-tree/${captureSet.sourceCommit}/${PUBLIC_ECONOMIC_RESILIENCE_CAPTURE_SET_FILE}`,
      },
    ],
  };
}

export function inspectPublicEconomicResilienceIndex(index) {
  const errors = [];
  if (!exactFields(index, INDEX_FIELDS)) {
    errors.push('public economic resilience index fields drifted');
  }
  if (
    index?.schemaVersion !==
      PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_SCHEMA_VERSION
  ) {
    errors.push('public economic resilience index schemaVersion is invalid');
  }
  if (index?.archive !== PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ID) {
    errors.push('public economic resilience archive identity drifted');
  }
  if (!Array.isArray(index?.captures)) {
    errors.push('public economic resilience index captures must be an array');
    return errors;
  }
  const seen = new Set();
  index.captures.forEach((entry, position) => {
    if (!exactFields(entry, INDEX_CAPTURE_FIELDS)) {
      errors.push(`public economic resilience index capture ${position + 1} fields drifted`);
    }
    if (!fullSha(entry?.sourceCommit)) {
      errors.push(`public economic resilience index capture ${position + 1} SHA is invalid`);
    }
    if (!positiveInteger(entry?.runId)) {
      errors.push(`public economic resilience index capture ${position + 1} runId is invalid`);
    }
    if (
      entry?.captureSetPath !==
      `source-tree/${entry?.sourceCommit}/${PUBLIC_ECONOMIC_RESILIENCE_CAPTURE_SET_FILE}`
    ) {
      errors.push(
        `public economic resilience index capture ${position + 1} path is invalid`
      );
    }
    if (seen.has(entry?.sourceCommit)) {
      errors.push('public economic resilience index contains a duplicate source SHA');
    }
    seen.add(entry?.sourceCommit);
  });
  return errors;
}

export function inspectPublicEconomicResilienceCaptureSet(
  captureSet,
  {
    androidEvidence,
    iosEvidence,
    runMetadata,
    runMetadataBytes,
    artifactMetadata,
    artifactMetadataBytes,
  } = {}
) {
  const errors = [];
  if (!exactFields(captureSet, CAPTURE_SET_FIELDS)) {
    errors.push('public economic resilience capture-set fields drifted');
  }
  if (
    captureSet?.schemaVersion !==
      PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_SCHEMA_VERSION ||
    captureSet?.status !== 'passed'
  ) {
    errors.push('public economic resilience capture-set schemaVersion/status is invalid');
  }
  if (captureSet?.scenarioId !== ECONOMIC_RESILIENCE_SCENARIO_ID) {
    errors.push('public economic resilience scenario identity drifted');
  }
  if (!fullSha(captureSet?.sourceCommit)) {
    errors.push('public economic resilience sourceCommit is invalid');
  }
  if (!exactFields(captureSet?.workflow, WORKFLOW_FIELDS)) {
    errors.push('public economic resilience workflow fields drifted');
  }
  if (
    !exactFields(captureSet?.artifactMetadata, ['file', 'sha256']) ||
    captureSet?.artifactMetadata?.file !==
      PUBLIC_ECONOMIC_RESILIENCE_ARTIFACT_METADATA_FILE ||
    !/^[0-9a-f]{64}$/u.test(captureSet?.artifactMetadata?.sha256 ?? '')
  ) {
    errors.push('public economic resilience artifact metadata binding is invalid');
  }
  if (
    captureSet?.workflow?.file !== PUBLIC_ECONOMIC_RESILIENCE_WORKFLOW ||
    captureSet?.workflow?.workflowName !==
      PUBLIC_ECONOMIC_RESILIENCE_WORKFLOW_NAME ||
    captureSet?.workflow?.eventName !== PUBLIC_ECONOMIC_RESILIENCE_EVENT ||
    captureSet?.workflow?.headBranch !== PUBLIC_ECONOMIC_RESILIENCE_BRANCH ||
    captureSet?.workflow?.ref !==
      `refs/heads/${PUBLIC_ECONOMIC_RESILIENCE_BRANCH}` ||
    captureSet?.workflow?.headSha !== captureSet?.sourceCommit ||
    captureSet?.workflow?.metadataFile !==
      PUBLIC_ECONOMIC_RESILIENCE_RUN_METADATA_FILE ||
    !/^[0-9a-f]{64}$/u.test(captureSet?.workflow?.metadataSha256 ?? '') ||
    !positiveInteger(captureSet?.workflow?.runId) ||
    !positiveInteger(captureSet?.workflow?.runAttempt) ||
    !validRunUrl(
      captureSet?.workflow?.runUrl,
      captureSet?.workflow?.runId
    )
  ) {
    errors.push('public economic resilience workflow identity is invalid');
  }
  if (runMetadata !== undefined || runMetadataBytes !== undefined) {
    errors.push(
      ...inspectPublicEconomicResilienceRunMetadata(runMetadata, {
        sourceCommit: captureSet?.sourceCommit,
      })
    );
    if (
      !Buffer.isBuffer(runMetadataBytes) ||
      captureSet?.workflow?.metadataSha256 !== sha256(runMetadataBytes) ||
      captureSet?.workflow?.file !== runMetadata?.path ||
      captureSet?.workflow?.workflowName !== runMetadata?.workflowName ||
      captureSet?.workflow?.eventName !== runMetadata?.event ||
      captureSet?.workflow?.headBranch !== runMetadata?.headBranch ||
      captureSet?.workflow?.headSha !== runMetadata?.headSha ||
      captureSet?.workflow?.runId !== runMetadata?.runId ||
      captureSet?.workflow?.runAttempt !== runMetadata?.attempt ||
      captureSet?.workflow?.runUrl !== runMetadata?.url
    ) {
      errors.push('public economic resilience capture-set does not match run metadata');
    }
  }
  if (artifactMetadata !== undefined || artifactMetadataBytes !== undefined) {
    errors.push(
      ...inspectPublicEconomicResilienceArtifactMetadata(artifactMetadata, {
        runMetadata,
      })
    );
    if (
      !Buffer.isBuffer(artifactMetadataBytes) ||
      captureSet?.artifactMetadata?.sha256 !== sha256(artifactMetadataBytes)
    ) {
      errors.push('public economic resilience capture-set does not match artifact metadata');
    }
  }
  if (!exactFields(captureSet?.platforms, ['android', 'ios'])) {
    errors.push('public economic resilience platform set drifted');
  }
  for (const platform of ['android', 'ios']) {
    if (!exactFields(captureSet?.platforms?.[platform], PLATFORM_FIELDS)) {
      errors.push(`public economic resilience ${platform} platform fields drifted`);
    }
    const artifact = artifactMetadata?.artifacts?.find?.(
      (candidate) => candidate.platform === platform
    );
    if (
      captureSet?.platforms?.[platform]?.artifactPath !== platform ||
      captureSet?.platforms?.[platform]?.artifactArchivePath !==
        `artifacts/${platform}.zip` ||
      !positiveInteger(captureSet?.platforms?.[platform]?.artifactId) ||
      captureSet?.platforms?.[platform]?.artifactName !==
        `native-demo-${platform}-${captureSet?.sourceCommit}` ||
      !/^sha256:[0-9a-f]{64}$/u.test(
        captureSet?.platforms?.[platform]?.artifactDigest ?? ''
      ) ||
      captureSet?.platforms?.[platform]?.artifactExpired !== false ||
      !positiveInteger(captureSet?.platforms?.[platform]?.artifactSizeInBytes)
    ) {
      errors.push(`public economic resilience ${platform} artifact path is invalid`);
    }
    if (
      artifact !== undefined &&
      (captureSet?.platforms?.[platform]?.artifactId !== artifact.id ||
        captureSet?.platforms?.[platform]?.artifactName !== artifact.name ||
        captureSet?.platforms?.[platform]?.artifactDigest !== artifact.digest ||
        captureSet?.platforms?.[platform]?.artifactExpired !== artifact.expired ||
        captureSet?.platforms?.[platform]?.artifactSizeInBytes !==
          artifact.sizeInBytes)
    ) {
      errors.push(`public economic resilience ${platform} artifact binding differs`);
    }
  }
  if (!exactFields(captureSet?.claimBoundary, CLAIM_BOUNDARY_FIELDS)) {
    errors.push('public economic resilience claim-boundary fields drifted');
  }
  if (
    captureSet?.claimBoundary?.observation !==
      'source-to-output-byte-difference' ||
    captureSet?.claimBoundary?.sourceOwnership !== 'source-remains' ||
    captureSet?.claimBoundary?.matchedTransferBaseline !== null ||
    captureSet?.claimBoundary?.costSavingsClaim !== null ||
    captureSet?.claimBoundary?.crossPlatformTimingComparison !== null
  ) {
    errors.push('public economic resilience claim boundary is invalid');
  }
  if (androidEvidence !== undefined || iosEvidence !== undefined) {
    errors.push(
      ...inspectCaptureEvidence(
        captureSet,
        androidEvidence,
        'android'
      ),
      ...inspectCaptureEvidence(captureSet, iosEvidence, 'ios')
    );
    if (
      androidEvidence?.implementation?.version !==
        iosEvidence?.implementation?.version ||
      androidEvidence?.fixture?.sha256 !== iosEvidence?.fixture?.sha256 ||
      androidEvidence?.fixture?.byteSize !== iosEvidence?.fixture?.byteSize
    ) {
      errors.push('public economic resilience platform source identities differ');
    }
  }
  return errors;
}

export function inspectPublicEconomicResilienceArchive(
  root,
  { inspectPlatformArtifact = inspectEconomicResilienceEvidence } = {}
) {
  const archiveRoot = path.resolve(root);
  if (!existsSync(archiveRoot)) return emptyArchiveReport();
  const errors = [];
  const rootEntries = readDirectoryEntries(
    archiveRoot,
    'public economic resilience archive root',
    errors
  );
  if (rootEntries === null) return failedArchiveReport(errors);
  const allowedRootEntries = new Set([
    PUBLIC_ECONOMIC_RESILIENCE_INDEX_FILE,
    'source-tree',
  ]);
  for (const entry of rootEntries) {
    if (!allowedRootEntries.has(entry)) {
      errors.push(`public economic resilience archive contains unexpected entry: ${entry}`);
    }
  }

  const indexPath = path.join(
    archiveRoot,
    PUBLIC_ECONOMIC_RESILIENCE_INDEX_FILE
  );
  if (!existsSync(indexPath)) {
    if (rootEntries.length === 0) return emptyArchiveReport();
    errors.push('public economic resilience archive index is missing');
    return failedArchiveReport(errors);
  }
  const index = readSecureJson(
    indexPath,
    'public economic resilience index',
    errors
  );
  const indexErrors =
    index === null ? [] : inspectPublicEconomicResilienceIndex(index);
  errors.push(...indexErrors);
  if (index === null || !Array.isArray(index.captures)) {
    return failedArchiveReport(errors);
  }
  if (indexErrors.length > 0) return failedArchiveReport(errors);

  const sourceTree = path.join(archiveRoot, 'source-tree');
  let sourceTreeEntries = [];
  if (existsSync(sourceTree)) {
    const inspectedSourceTree = readDirectoryEntries(
      sourceTree,
      'public economic resilience source-tree',
      errors
    );
    if (inspectedSourceTree === null) return failedArchiveReport(errors);
    sourceTreeEntries = inspectedSourceTree;
  } else if (index.captures.length > 0) {
    errors.push('public economic resilience source-tree is missing');
  }
  const indexedShas = index.captures.map(({ sourceCommit }) => sourceCommit);
  if (!isDeepStrictEqual([...sourceTreeEntries].sort(), [...indexedShas].sort())) {
    errors.push('public economic resilience index and source-tree contain orphan entries');
  }

  const captures = [];
  for (const entry of index.captures) {
    const captureRoot = path.join(sourceTree, entry.sourceCommit);
    const capture = inspectCaptureDirectory({
      captureRoot,
      indexEntry: entry,
      inspectPlatformArtifact,
      errors,
    });
    if (capture !== null) captures.push(capture);
  }
  return {
    schemaVersion: PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_SCHEMA_VERSION,
    status: errors.length === 0 ? 'passed' : 'failed',
    archiveState:
      errors.length === 0 && captures.length === 0 ? 'empty' :
        errors.length === 0 ? 'available' : 'invalid',
    captureCount: errors.length === 0 ? captures.length : 0,
    captures: errors.length === 0 ? captures : [],
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}

function inspectCaptureDirectory({
  captureRoot,
  indexEntry,
  inspectPlatformArtifact,
  errors,
}) {
  const entries = readDirectoryEntries(
    captureRoot,
    `public economic resilience capture ${indexEntry.sourceCommit}`,
    errors
  );
  if (entries === null) return null;
  if (
    !isDeepStrictEqual(
      [...entries].sort(),
      [
        PUBLIC_ECONOMIC_RESILIENCE_CAPTURE_SET_FILE,
        PUBLIC_ECONOMIC_RESILIENCE_RUN_METADATA_FILE,
        PUBLIC_ECONOMIC_RESILIENCE_ARTIFACT_METADATA_FILE,
        'artifacts',
        'android',
        'ios',
      ].sort()
    )
  ) {
    errors.push(
      `public economic resilience capture ${indexEntry.sourceCommit} has an invalid entry set`
    );
  }
  const captureSet = readSecureJson(
    path.join(captureRoot, PUBLIC_ECONOMIC_RESILIENCE_CAPTURE_SET_FILE),
    `public economic resilience capture-set ${indexEntry.sourceCommit}`,
    errors
  );
  if (captureSet === null) return null;
  const runMetadataPath = path.join(
    captureRoot,
    PUBLIC_ECONOMIC_RESILIENCE_RUN_METADATA_FILE
  );
  const runMetadataBytes = readSecureFile(
    runMetadataPath,
    `public economic resilience run metadata ${indexEntry.sourceCommit}`,
    errors
  );
  let runMetadata = null;
  if (runMetadataBytes !== null) {
    try {
      runMetadata = JSON.parse(runMetadataBytes.toString('utf8'));
    } catch (error) {
      errors.push(
        `public economic resilience run metadata JSON is invalid: ${error.message}`
      );
    }
  }
  const artifactMetadataPath = path.join(
    captureRoot,
    PUBLIC_ECONOMIC_RESILIENCE_ARTIFACT_METADATA_FILE
  );
  const artifactMetadataBytes = readSecureFile(
    artifactMetadataPath,
    `public economic resilience artifact metadata ${indexEntry.sourceCommit}`,
    errors
  );
  let artifactMetadata = null;
  if (artifactMetadataBytes !== null) {
    try {
      artifactMetadata = JSON.parse(artifactMetadataBytes.toString('utf8'));
    } catch (error) {
      errors.push(
        `public economic resilience artifact metadata JSON is invalid: ${error.message}`
      );
    }
  }

  const platformEvidence = {};
  const artifactMetadataByPlatform = new Map(
    (artifactMetadata?.artifacts ?? []).map((artifact) => [
      artifact.platform,
      artifact,
    ])
  );
  const artifactsRoot = path.join(captureRoot, 'artifacts');
  const artifactEntries = readDirectoryEntries(
    artifactsRoot,
    `public economic resilience retained artifacts ${indexEntry.sourceCommit}`,
    errors
  );
  if (
    artifactEntries !== null &&
    !isDeepStrictEqual(artifactEntries, ['android.zip', 'ios.zip'])
  ) {
    errors.push('public economic resilience retained artifact ZIP set drifted');
  }
  for (const platform of ['android', 'ios']) {
    const artifactRoot = path.join(captureRoot, platform);
    if (!inspectExactArtifactFiles(artifactRoot, platform, errors)) continue;
    const evidence = readSecureJson(
      path.join(artifactRoot, 'economic-resilience.json'),
      `public economic resilience ${platform} evidence`,
      errors
    );
    if (evidence === null) continue;
    const report = inspectPlatformArtifact(artifactRoot, evidence);
    if (report?.status !== 'passed') {
      errors.push(
        `public economic resilience ${platform} artifact failed: ${report?.error ?? 'unknown error'}`
      );
    }
    platformEvidence[platform] = evidence;

    const retainedZip = path.join(artifactsRoot, `${platform}.zip`);
    const retainedZipBytes = readSecureFile(
      retainedZip,
      `public economic resilience retained ${platform} artifact ZIP`,
      errors
    );
    const artifact = artifactMetadataByPlatform.get(platform);
    if (
      retainedZipBytes !== null &&
      (retainedZipBytes.length !== artifact?.sizeInBytes ||
        `sha256:${sha256(retainedZipBytes)}` !== artifact?.digest)
    ) {
      errors.push(
        `public economic resilience retained ${platform} artifact ZIP binding differs`
      );
    }
    if (retainedZipBytes !== null) {
      try {
        const inspectedZip = inspectPublicEconomicResilienceArtifactZip(retainedZip);
        for (const asset of ECONOMIC_RESILIENCE_ASSET_FILES) {
          const archivedAsset = readSecureFile(
            path.join(artifactRoot, asset),
            `public economic resilience ${platform} archived asset ${asset}`,
            errors
          );
          const zipAsset = inspectedZip.members.get(
            `economic-resilience/${asset}`
          );
          if (archivedAsset && !archivedAsset.equals(zipAsset)) {
            errors.push(
              `public economic resilience ${platform} archived asset differs from retained ZIP: ${asset}`
            );
          }
        }
      } catch (error) {
        errors.push(
          `public economic resilience retained ${platform} artifact ZIP failed: ${error.message}`
        );
      }
    }
  }
  errors.push(
    ...inspectPublicEconomicResilienceCaptureSet(captureSet, {
      androidEvidence: platformEvidence.android,
      iosEvidence: platformEvidence.ios,
      runMetadata,
      runMetadataBytes,
      artifactMetadata,
      artifactMetadataBytes,
    })
  );
  if (
    captureSet?.sourceCommit !== indexEntry.sourceCommit ||
    captureSet?.workflow?.runId !== indexEntry.runId ||
    indexEntry.captureSetPath !==
      `source-tree/${indexEntry.sourceCommit}/${PUBLIC_ECONOMIC_RESILIENCE_CAPTURE_SET_FILE}`
  ) {
    errors.push('public economic resilience index does not match its capture-set');
  }

  if (platformEvidence.android && platformEvidence.ios) {
    const androidSource = readSecureFile(
      path.join(captureRoot, 'android', 'source.jpg'),
      'public economic resilience Android source',
      errors
    );
    const iosSource = readSecureFile(
      path.join(captureRoot, 'ios', 'source.jpg'),
      'public economic resilience iOS source',
      errors
    );
    const androidFixture = readSecureFile(
      path.join(captureRoot, 'android', 'fixture-manifest.json'),
      'public economic resilience Android fixture manifest',
      errors
    );
    const iosFixture = readSecureFile(
      path.join(captureRoot, 'ios', 'fixture-manifest.json'),
      'public economic resilience iOS fixture manifest',
      errors
    );
    if (
      androidSource && iosSource && !androidSource.equals(iosSource)
    ) {
      errors.push('public economic resilience platform source bytes differ');
    }
    if (
      androidFixture && iosFixture && !androidFixture.equals(iosFixture)
    ) {
      errors.push('public economic resilience platform fixture manifests differ');
    }
  }

  return {
    sourceCommit: captureSet?.sourceCommit,
    runId: captureSet?.workflow?.runId,
    runAttempt: captureSet?.workflow?.runAttempt,
    platforms: {
      android: {
        artifactPath: `source-tree/${captureSet?.sourceCommit}/android`,
        artifactArchivePath:
          `source-tree/${captureSet?.sourceCommit}/artifacts/android.zip`,
      },
      ios: {
        artifactPath: `source-tree/${captureSet?.sourceCommit}/ios`,
        artifactArchivePath:
          `source-tree/${captureSet?.sourceCommit}/artifacts/ios.zip`,
      },
    },
  };
}

function inspectCaptureEvidence(captureSet, evidence, platform) {
  const errors = [];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return [`public economic resilience ${platform} evidence is missing`];
  }
  if (
    evidence.sourceCommit !== captureSet.sourceCommit ||
    evidence.runId !== captureSet.workflow.runId ||
    evidence.runAttempt !== captureSet.workflow.runAttempt ||
    evidence.runUrl !== captureSet.workflow.runUrl ||
    evidence.environment?.platform !== platform
  ) {
    errors.push(`public economic resilience ${platform} run identity differs`);
  }
  if (
    evidence.scenarioId !== ECONOMIC_RESILIENCE_SCENARIO_ID ||
    evidence.implementation?.buildSource !== 'checked-out-source-tree' ||
    evidence.fixture?.remainsAfterRun !== true ||
    evidence.economics?.boundary !== 'source-to-output-observation' ||
    evidence.economics?.sourceOwnership !== 'source-remains' ||
    evidence.economics?.matchedTransferBaseline !== null ||
    evidence.economics?.costSavingsClaim !== null ||
    evidence.cleanup?.attemptedPackageOutputs !== 12 ||
    evidence.cleanup?.removedPackageOutputs !== 12 ||
    evidence.cleanup?.residualPackageOutputs !== 0 ||
    evidence.cleanup?.residualPackageOutputBytes !== 0 ||
    evidence.visualAgreement?.schemaVersion !== 3 ||
    evidence.visualAgreement?.comparisonProfile !==
      PORTABLE_DEMO_VISUAL_AGREEMENT_PROFILE
  ) {
    errors.push(`public economic resilience ${platform} claim boundary differs`);
  }
  return errors;
}

function inspectExactArtifactFiles(root, platform, errors) {
  const initialErrorCount = errors.length;
  const entries = readDirectoryEntries(
    root,
    `public economic resilience ${platform} artifact`,
    errors
  );
  if (entries === null) return false;
  if (!isDeepStrictEqual([...entries].sort(), [...ECONOMIC_RESILIENCE_ASSET_FILES])) {
    errors.push(
      `public economic resilience ${platform} artifact must contain exactly six assets`
    );
    return false;
  }
  for (const entry of entries) {
    const candidate = path.join(root, entry);
    try {
      const status = lstatSync(candidate);
      if (
        !status.isFile() ||
        status.isSymbolicLink() ||
        status.nlink !== 1
      ) {
        errors.push(
          `public economic resilience ${platform} asset must be a regular non-symlink file with exactly one hard link: ${entry}`
        );
      }
    } catch (error) {
      errors.push(
        `public economic resilience ${platform} asset cannot be inspected: ${entry}: ${error.message}`
      );
    }
  }
  return errors.length === initialErrorCount;
}

function readDirectoryEntries(directory, label, errors) {
  try {
    const status = lstatSync(directory);
    if (!status.isDirectory() || status.isSymbolicLink()) {
      errors.push(`${label} must be a regular non-symlink directory`);
      return null;
    }
    realpathSync(directory);
    return readdirSync(directory).sort();
  } catch (error) {
    errors.push(`${label} cannot be inspected: ${error.message}`);
    return null;
  }
}

function readSecureJson(file, label, errors) {
  const contents = readSecureFile(file, label, errors);
  if (contents === null) return null;
  try {
    return JSON.parse(contents.toString('utf8'));
  } catch (error) {
    errors.push(`${label} JSON is invalid: ${error.message}`);
    return null;
  }
}

function readSecureFile(file, label, errors) {
  try {
    const status = lstatSync(file);
    if (
      !status.isFile() ||
      status.isSymbolicLink() ||
      status.nlink !== 1
    ) {
      errors.push(
        `${label} must be a regular non-symlink file with exactly one hard link`
      );
      return null;
    }
    return readFileSync(file);
  } catch (error) {
    errors.push(`${label} cannot be read: ${error.message}`);
    return null;
  }
}

function emptyArchiveReport() {
  return {
    schemaVersion: PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_SCHEMA_VERSION,
    status: 'passed',
    archiveState: 'empty',
    captureCount: 0,
    captures: [],
    error: null,
  };
}

function failedArchiveReport(errors) {
  return {
    schemaVersion: PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_SCHEMA_VERSION,
    status: 'failed',
    archiveState: 'invalid',
    captureCount: 0,
    captures: [],
    error: errors.join(' | '),
  };
}

function exactFields(value, expected) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      isDeepStrictEqual(Object.keys(value).sort(), [...expected].sort())
  );
}

function fullSha(value) {
  return /^[0-9a-f]{40}$/u.test(value ?? '');
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validRunUrl(value, runId) {
  return (
    typeof value === 'string' &&
    value === `${PUBLIC_ECONOMIC_RESILIENCE_RUN_URL_PREFIX}${runId}` &&
    Number(value.split('/').at(-1)) === runId
  );
}

function capturePlatform(platform, artifact) {
  return {
    artifactPath: platform,
    artifactArchivePath: `artifacts/${platform}.zip`,
    artifactId: artifact.id,
    artifactName: artifact.name,
    artifactDigest: artifact.digest,
    artifactExpired: artifact.expired,
    artifactSizeInBytes: artifact.sizeInBytes,
  };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
