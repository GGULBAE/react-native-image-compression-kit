#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import {
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ECONOMIC_RESILIENCE_ASSET_FILES } from './economic-resilience-evidence-core.mjs';
import { replayEconomicResilienceArtifact } from './economic-resilience-replay.mjs';
import {
  PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ROOT,
  PUBLIC_ECONOMIC_RESILIENCE_ARTIFACT_METADATA_FILE,
  PUBLIC_ECONOMIC_RESILIENCE_CAPTURE_SET_FILE,
  PUBLIC_ECONOMIC_RESILIENCE_INDEX_FILE,
  PUBLIC_ECONOMIC_RESILIENCE_RUN_METADATA_FILE,
  appendPublicEconomicResilienceIndex,
  buildPublicEconomicResilienceCaptureSet,
  createEmptyPublicEconomicResilienceIndex,
  inspectPublicEconomicResilienceArchive,
} from './public-economic-resilience-evidence-core.mjs';
import { acquirePublicEconomicResilienceRun } from './public-economic-resilience-github.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = parseArgs(process.argv.slice(2));
if (!options.runId) throw new Error('--run-id is required');
const runId = Number(options.runId);
if (!Number.isSafeInteger(runId) || runId <= 0 || String(runId) !== options.runId) {
  throw new Error('--run-id must be a positive safe integer');
}
const archiveRoot = path.resolve(
  options.archiveRoot ??
    path.join(repositoryRoot, PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ROOT)
);
const filesystemRoot = path.parse(archiveRoot).root;
if (
  archiveRoot === filesystemRoot ||
  archiveRoot === repositoryRoot ||
  path.dirname(archiveRoot) === filesystemRoot
) {
  throw new Error('--archive-root must identify a scoped archive below a non-root parent');
}

let acquisition = null;
let transaction = null;
let completed = false;
const interrupt = () => {
  try {
    if (transaction) recoverOrCleanTransaction(transaction);
    if (transaction) releaseLock(transaction);
    if (acquisition) acquisition.cleanup();
  } finally {
    process.exit(130);
  }
};
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);

try {
  acquisition = acquirePublicEconomicResilienceRun(runId);
  const androidArtifact = acquisition.platforms.android.artifactRoot;
  const iosArtifact = acquisition.platforms.ios.artifactRoot;
  const androidEvidence = readEvidence(androidArtifact, 'Android');
  const iosEvidence = readEvidence(iosArtifact, 'iOS');
  const captureSet = buildPublicEconomicResilienceCaptureSet({
    sourceCommit: acquisition.sourceCommit,
    runMetadata: acquisition.runMetadata,
    runMetadataBytes: acquisition.runMetadataBytes,
    artifactMetadata: acquisition.artifactMetadata,
    artifactMetadataBytes: acquisition.artifactMetadataBytes,
    androidEvidence,
    iosEvidence,
  });
  assertSameBytes(
    path.join(androidArtifact, 'source.jpg'),
    path.join(iosArtifact, 'source.jpg'),
    'Android and iOS source assets differ'
  );
  assertSameBytes(
    path.join(androidArtifact, 'fixture-manifest.json'),
    path.join(iosArtifact, 'fixture-manifest.json'),
    'Android and iOS fixture manifests differ'
  );
  const inputReplay = {
    android: replayEconomicResilienceArtifact(androidArtifact),
    ios: replayEconomicResilienceArtifact(iosArtifact),
  };

  transaction = beginTransaction({ archiveRoot });
  const currentReport = inspectPublicEconomicResilienceArchive(
    transaction.archiveRoot
  );
  if (currentReport.status !== 'passed') throw new Error(currentReport.error);
  for (const capture of currentReport.captures) {
    for (const platform of ['android', 'ios']) {
      replayEconomicResilienceArtifact(
        path.join(
          transaction.archiveRoot,
          capture.platforms[platform].artifactPath
        )
      );
    }
  }

  const indexPath = path.join(
    transaction.archiveRoot,
    PUBLIC_ECONOMIC_RESILIENCE_INDEX_FILE
  );
  const baseIndexBytes = existsSync(indexPath)
    ? readSecureSingleLinkFile(indexPath, 'public archive index')
    : null;
  const currentIndex = baseIndexBytes
    ? JSON.parse(baseIndexBytes.toString('utf8'))
    : createEmptyPublicEconomicResilienceIndex();
  const nextIndex = appendPublicEconomicResilienceIndex(currentIndex, captureSet);
  const nextIndexBytes = serializeJson(nextIndex);

  const stageRoot = transaction.stageRoot;
  mkdirSync(stageRoot);
  const stagedSourceTree = path.join(stageRoot, 'source-tree');
  mkdirSync(stagedSourceTree);
  const stagedCapture = path.join(stagedSourceTree, acquisition.sourceCommit);
  mkdirSync(stagedCapture);
  const stagedArtifacts = path.join(stagedCapture, 'artifacts');
  mkdirSync(stagedArtifacts);
  for (const platform of ['android', 'ios']) {
    const acquiredPlatform = acquisition.platforms[platform];
    const stagedPlatform = path.join(stagedCapture, platform);
    mkdirSync(stagedPlatform);
    for (const asset of ECONOMIC_RESILIENCE_ASSET_FILES) {
      copyExclusiveSingleLink(
        path.join(acquiredPlatform.artifactRoot, asset),
        path.join(stagedPlatform, asset),
        `${platform} ${asset}`
      );
    }
    copyExclusiveSingleLink(
      acquiredPlatform.zipFile,
      path.join(stagedArtifacts, `${platform}.zip`),
      `${platform} retained artifact ZIP`
    );
  }
  writeExclusive(
    path.join(stagedCapture, PUBLIC_ECONOMIC_RESILIENCE_CAPTURE_SET_FILE),
    serializeJson(captureSet)
  );
  writeExclusive(
    path.join(stagedCapture, PUBLIC_ECONOMIC_RESILIENCE_RUN_METADATA_FILE),
    acquisition.runMetadataBytes
  );
  writeExclusive(
    path.join(stagedCapture, PUBLIC_ECONOMIC_RESILIENCE_ARTIFACT_METADATA_FILE),
    acquisition.artifactMetadataBytes
  );
  const stagedIndex = appendPublicEconomicResilienceIndex(
    createEmptyPublicEconomicResilienceIndex(),
    captureSet
  );
  writeExclusive(path.join(stageRoot, PUBLIC_ECONOMIC_RESILIENCE_INDEX_FILE),
    serializeJson(stagedIndex));
  const stagedReport = inspectPublicEconomicResilienceArchive(stageRoot);
  if (stagedReport.status !== 'passed') {
    throw new Error(`staged public archive failed verification: ${stagedReport.error}`);
  }
  replayEconomicResilienceArtifact(path.join(stagedCapture, 'android'));
  replayEconomicResilienceArtifact(path.join(stagedCapture, 'ios'));

  const nextIndexPath = transaction.nextIndexPath;
  writeExclusive(nextIndexPath, nextIndexBytes);
  const destinationCapture = path.join(
    transaction.archiveRoot,
    'source-tree',
    acquisition.sourceCommit
  );
  const journal = {
    schemaVersion: 1,
    pid: process.pid,
    sourceCommit: acquisition.sourceCommit,
    archiveRoot: transaction.archiveRoot,
    stagedPath: stageRoot,
    destinationCapture,
    nextIndexPath,
    baseIndexDigest: baseIndexBytes ? sha256(baseIndexBytes) : null,
    nextIndexDigest: sha256(nextIndexBytes),
  };
  triggerFailpoint('before-journal');
  writeExclusive(transaction.journalPath, serializeJson(journal), 0o600);
  transaction.journalWritten = true;
  triggerFailpoint('after-journal');

  if (!existsSync(transaction.archiveRoot)) mkdirSync(transaction.archiveRoot);
  else assertRegularDirectory(transaction.archiveRoot, 'public archive root');
  const destinationSourceTree = path.join(transaction.archiveRoot, 'source-tree');
  if (!existsSync(destinationSourceTree)) mkdirSync(destinationSourceTree);
  else assertRegularDirectory(destinationSourceTree, 'public archive source-tree');
  assertMissing(destinationCapture, 'source SHA destination already exists');
  assertCurrentIndex(indexPath, baseIndexBytes);
  renameSync(stagedCapture, destinationCapture);
  triggerFailpoint('after-capture-rename');
  assertCurrentIndex(indexPath, baseIndexBytes);
  renameSync(nextIndexPath, indexPath);
  triggerFailpoint('after-index-publish');

  const report = inspectPublicEconomicResilienceArchive(transaction.archiveRoot);
  if (report.status !== 'passed') {
    throw new Error(`imported public archive failed verification: ${report.error}`);
  }
  cleanupPublishedTransaction(transaction);
  completed = true;
  process.stdout.write(`${JSON.stringify({
    ...report,
    importedSourceCommit: acquisition.sourceCommit,
    replay: {
      android: inputReplay.android.replay,
      ios: inputReplay.ios.replay,
    },
  })}\n`);
} catch (error) {
  if (transaction) recoverOrCleanTransaction(transaction);
  throw error;
} finally {
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', interrupt);
  if (transaction) releaseLock(transaction);
  if (acquisition) acquisition.cleanup();
  if (!completed && transaction?.stageRoot && existsSync(transaction.stageRoot)) {
    removeValidatedTree(transaction.stageRoot, transaction.archiveParent);
  }
}

function beginTransaction({ archiveRoot }) {
  const createdParents = ensureDirectoryPath(path.dirname(archiveRoot));
  const archiveParent = realpathSync(path.dirname(archiveRoot));
  const canonicalArchiveRoot = path.join(archiveParent, path.basename(archiveRoot));
  const lockPath = path.join(archiveParent, '.economic-resilience-import.lock');
  const journalPath = path.join(
    archiveParent,
    '.economic-resilience-import.journal.json'
  );
  const transactionId = randomUUID();
  const stageRoot = path.join(
    archiveParent,
    `.economic-resilience-stage-${process.pid}-${transactionId}`
  );
  const nextIndexPath = path.join(
    archiveParent,
    `.economic-resilience-index-${process.pid}-${transactionId}.json`
  );
  const transaction = {
    archiveRoot: canonicalArchiveRoot,
    archiveParent,
    lockPath,
    journalPath,
    createdParents,
    stageRoot,
    nextIndexPath,
    lockOwned: false,
    journalWritten: false,
  };
  recoverStaleTransactionBeforeLock(transaction);
  const lockRecord = {
    schemaVersion: 1,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    journalPath,
    stagedPath: stageRoot,
    nextIndexPath,
  };
  writeExclusive(lockPath, serializeJson(lockRecord), 0o600);
  transaction.lockRecord = lockRecord;
  transaction.lockOwned = true;
  if (existsSync(journalPath)) recoverJournal(transaction, lockRecord);
  return transaction;
}

function recoverStaleTransactionBeforeLock(transaction) {
  if (!existsSync(transaction.lockPath)) {
    if (existsSync(transaction.journalPath)) recoverJournal(transaction);
    return;
  }
  let lock;
  try {
    const lockBytes = readSecureSingleLinkFile(transaction.lockPath, 'import lock');
    if (lockBytes.length === 0 && !existsSync(transaction.journalPath)) {
      unlinkSync(transaction.lockPath);
      return;
    }
    lock = JSON.parse(lockBytes.toString('utf8'));
    validateLock(lock, transaction);
  } catch (error) {
    throw new Error(`public evidence import lock is invalid: ${error.message}`);
  }
  if (processIsLive(lock?.pid)) {
    throw new Error(`public economic evidence import is already active (PID ${lock.pid})`);
  }
  if (existsSync(transaction.journalPath)) recoverJournal(transaction, lock);
  else cleanupLockPlannedFiles(lock, transaction);
  unlinkSync(transaction.lockPath);
}

function cleanupLockPlannedFiles(lock, transaction) {
  for (const [candidate, kind] of [
    [lock?.stagedPath, 'stage'],
    [lock?.nextIndexPath, 'index'],
  ]) {
    if (!within(transaction.archiveParent, candidate)) {
      throw new Error(`stale import lock ${kind} path is invalid`);
    }
  }
  if (existsSync(lock.stagedPath)) {
    removeValidatedTree(lock.stagedPath, transaction.archiveParent);
  }
  if (existsSync(lock.nextIndexPath)) unlinkSync(lock.nextIndexPath);
}

function recoverOrCleanTransaction(transaction) {
  if (existsSync(transaction.journalPath)) {
    recoverJournal(transaction, transaction.lockRecord);
    transaction.journalWritten = false;
    return;
  }
  if (transaction.nextIndexPath && existsSync(transaction.nextIndexPath)) {
    unlinkSync(transaction.nextIndexPath);
  }
  if (transaction.stageRoot && existsSync(transaction.stageRoot)) {
    removeValidatedTree(transaction.stageRoot, transaction.archiveParent);
  }
}

function recoverJournal(transaction, expectedLock = null) {
  const bytes = readSecureSingleLinkFile(transaction.journalPath, 'import journal');
  const journal = JSON.parse(bytes.toString('utf8'));
  validateJournal(journal, transaction, expectedLock);
  const indexPath = path.join(
    transaction.archiveRoot,
    PUBLIC_ECONOMIC_RESILIENCE_INDEX_FILE
  );
  const currentDigest = existsSync(indexPath)
    ? sha256(readSecureSingleLinkFile(indexPath, 'public archive index'))
    : null;
  const captureExists = existsSync(journal.destinationCapture);
  if (!captureExists) {
    if (currentDigest !== journal.baseIndexDigest) {
      throw new Error('stale import journal cannot roll back a changed archive index');
    }
    cleanupJournalFiles(journal, transaction);
    cleanupEmptyArchive(transaction.archiveRoot);
    return;
  }
  if (currentDigest === journal.baseIndexDigest) {
    const nextBytes = readSecureSingleLinkFile(journal.nextIndexPath, 'next archive index');
    if (sha256(nextBytes) !== journal.nextIndexDigest) {
      throw new Error('stale import journal next-index digest differs');
    }
    renameSync(journal.nextIndexPath, indexPath);
  } else if (currentDigest !== journal.nextIndexDigest) {
    throw new Error('stale import journal does not match the current archive index');
  }
  const report = inspectPublicEconomicResilienceArchive(transaction.archiveRoot);
  if (report.status !== 'passed') {
    throw new Error(`recovered public archive failed verification: ${report.error}`);
  }
  cleanupJournalFiles(journal, transaction);
}

function validateJournal(journal, transaction, expectedLock) {
  const expected = [
    'archiveRoot', 'baseIndexDigest', 'destinationCapture', 'nextIndexDigest',
    'nextIndexPath', 'pid', 'schemaVersion', 'sourceCommit', 'stagedPath',
  ].sort();
  if (
    !journal || typeof journal !== 'object' || Array.isArray(journal) ||
    JSON.stringify(Object.keys(journal).sort()) !== JSON.stringify(expected) ||
    journal.schemaVersion !== 1 ||
    !Number.isSafeInteger(journal.pid) ||
    journal.pid <= 0 ||
    journal.archiveRoot !== transaction.archiveRoot ||
    !/^[0-9a-f]{40}$/u.test(journal.sourceCommit ?? '') ||
    !digestOrNull(journal.baseIndexDigest) ||
    !/^[0-9a-f]{64}$/u.test(journal.nextIndexDigest ?? '') ||
    !within(transaction.archiveParent, journal.stagedPath) ||
    !within(transaction.archiveParent, journal.nextIndexPath) ||
    !validTransactionPaths(journal) ||
    (expectedLock !== null &&
      (journal.pid !== expectedLock.pid ||
        journal.stagedPath !== expectedLock.stagedPath ||
        journal.nextIndexPath !== expectedLock.nextIndexPath)) ||
    journal.destinationCapture !== path.join(
      transaction.archiveRoot, 'source-tree', journal.sourceCommit
    )
  ) {
    throw new Error('public evidence import journal is invalid');
  }
}

function validateLock(lock, transaction) {
  const expected = [
    'journalPath', 'nextIndexPath', 'pid', 'schemaVersion', 'stagedPath',
    'startedAt',
  ].sort();
  if (
    !lock || typeof lock !== 'object' || Array.isArray(lock) ||
    JSON.stringify(Object.keys(lock).sort()) !== JSON.stringify(expected) ||
    lock.schemaVersion !== 1 ||
    !Number.isSafeInteger(lock.pid) || lock.pid <= 0 ||
    lock.journalPath !== transaction.journalPath ||
    typeof lock.startedAt !== 'string' ||
    !within(transaction.archiveParent, lock.stagedPath) ||
    !within(transaction.archiveParent, lock.nextIndexPath) ||
    !validTransactionPaths(lock)
  ) {
    throw new Error('public evidence import lock fields are invalid');
  }
}

function validTransactionPaths(record) {
  const stage = /^\.economic-resilience-stage-(\d+)-([0-9a-f-]{36})$/u.exec(
    path.basename(record.stagedPath ?? '')
  );
  const next = /^\.economic-resilience-index-(\d+)-([0-9a-f-]{36})\.json$/u.exec(
    path.basename(record.nextIndexPath ?? '')
  );
  return Boolean(
    stage && next &&
      Number(stage[1]) === record.pid &&
      Number(next[1]) === record.pid &&
      stage[2] === next[2]
  );
}

function cleanupJournalFiles(journal, transaction) {
  if (existsSync(journal.nextIndexPath)) unlinkSync(journal.nextIndexPath);
  if (existsSync(journal.stagedPath)) {
    removeValidatedTree(journal.stagedPath, transaction.archiveParent);
  }
  unlinkSync(transaction.journalPath);
}

function cleanupPublishedTransaction(transaction) {
  if (transaction.stageRoot && existsSync(transaction.stageRoot)) {
    removeValidatedTree(transaction.stageRoot, transaction.archiveParent);
  }
  if (existsSync(transaction.journalPath)) unlinkSync(transaction.journalPath);
}

function releaseLock(transaction) {
  if (transaction.lockOwned && existsSync(transaction.lockPath)) {
    unlinkSync(transaction.lockPath);
  }
  transaction.lockOwned = false;
  for (const directory of [...transaction.createdParents].reverse()) {
    removeEmptyDirectory(directory);
  }
}

function cleanupEmptyArchive(archiveRoot) {
  removeEmptyDirectory(path.join(archiveRoot, 'source-tree'));
  removeEmptyDirectory(archiveRoot);
}

function removeValidatedTree(candidate, parent) {
  const resolved = path.resolve(candidate);
  if (!within(parent, resolved) || !path.basename(resolved).startsWith('.economic-resilience-stage-')) {
    throw new Error('refused to clean an unexpected transaction path');
  }
  const status = lstatSync(resolved);
  if (!status.isDirectory() || status.isSymbolicLink()) {
    throw new Error('transaction staging path must be a regular directory');
  }
  assertSafeRemovalTree(resolved);
  rmSync(resolved, { recursive: true, force: false });
}

function assertSafeRemovalTree(directory) {
  for (const entry of readdirSync(directory)) {
    const candidate = path.join(directory, entry);
    const status = lstatSync(candidate);
    if (status.isSymbolicLink()) {
      throw new Error('transaction staging tree must not contain symbolic links');
    }
    if (status.isDirectory()) assertSafeRemovalTree(candidate);
    else if (!status.isFile() || status.nlink !== 1) {
      throw new Error(
        'transaction staging tree entries must be single-link regular files or directories'
      );
    }
  }
}

function copyExclusiveSingleLink(source, destination, label) {
  readSecureSingleLinkFile(source, label);
  copyFileSync(source, destination, constants.COPYFILE_EXCL);
  readSecureSingleLinkFile(destination, `copied ${label}`);
}

function writeExclusive(file, bytes, mode = 0o644) {
  writeFileSync(file, bytes, { flag: 'wx', mode });
  readSecureSingleLinkFile(file, file);
}

function readSecureSingleLinkFile(file, label) {
  const status = lstatSync(file);
  if (!status.isFile() || status.isSymbolicLink() || status.nlink !== 1) {
    throw new Error(`${label} must be a regular non-symlink file with exactly one hard link`);
  }
  return readFileSync(file);
}

function assertCurrentIndex(indexPath, expectedBytes) {
  if (expectedBytes === null) {
    if (existsSync(indexPath)) throw new Error('public archive index appeared during import');
    return;
  }
  const current = readSecureSingleLinkFile(indexPath, 'public archive index');
  if (!current.equals(expectedBytes)) {
    throw new Error('public archive index changed during import');
  }
}

function readEvidence(root, label) {
  try {
    return JSON.parse(
      readSecureSingleLinkFile(
        path.join(root, 'economic-resilience.json'),
        `${label} economic evidence`
      ).toString('utf8')
    );
  } catch (error) {
    throw new Error(`${label} economic evidence JSON is invalid: ${error.message}`);
  }
}

function assertSameBytes(left, right, message) {
  if (!readSecureSingleLinkFile(left, left).equals(readSecureSingleLinkFile(right, right))) {
    throw new Error(message);
  }
}

function assertRegularDirectory(directory, label) {
  const status = lstatSync(directory);
  if (!status.isDirectory() || status.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink directory`);
  }
}

function assertMissing(candidate, message) {
  try {
    lstatSync(candidate);
    throw new Error(message);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function ensureDirectoryPath(directory) {
  const requested = path.resolve(directory);
  let cursor = requested;
  const missing = [];
  while (!existsSync(cursor)) {
    missing.push(cursor);
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new Error('archive parent cannot be resolved');
    cursor = parent;
  }
  assertRegularDirectory(cursor, 'archive existing ancestor');
  let current = realpathSync(cursor);
  const created = [];
  for (const component of path.relative(cursor, requested).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    if (existsSync(current)) assertRegularDirectory(current, 'archive parent component');
    else {
      mkdirSync(current);
      created.push(current);
    }
  }
  if (created.length !== missing.length) {
    throw new Error('archive parent creation did not resolve the requested path');
  }
  return created;
}

function removeEmptyDirectory(directory) {
  try {
    rmdirSync(directory);
  } catch (error) {
    if (!['ENOENT', 'ENOTEMPTY'].includes(error?.code)) throw error;
  }
}

function processIsLive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function triggerFailpoint(name) {
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.RNICK_PUBLIC_EVIDENCE_FAILPOINT === name
  ) {
    process.kill(process.pid, 'SIGKILL');
  }
}

function within(parent, candidate) {
  if (typeof candidate !== 'string') return false;
  const relative = path.relative(parent, path.resolve(candidate));
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`);
}

function digestOrNull(value) {
  return value === null || /^[0-9a-f]{64}$/u.test(value ?? '');
}

function serializeJson(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseArgs(args) {
  const parsed = {};
  const allowed = new Set(['runId', 'archiveRoot']);
  const values = args.filter((value) => value !== '--');
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    if (!flag?.startsWith('--') || !value) {
      throw new Error(`invalid argument: ${flag ?? ''}`);
    }
    const key = flag.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    if (!allowed.has(key)) throw new Error(`unsupported argument: ${flag}`);
    if (parsed[key] !== undefined) throw new Error(`duplicate argument: ${flag}`);
    parsed[key] = value;
  }
  return parsed;
}
