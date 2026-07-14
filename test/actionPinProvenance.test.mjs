import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
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
  ACTION_PIN_ANNOTATED_TAG_FIELDS,
  ACTION_PIN_PROVENANCE_CHECK_FIELDS,
  ACTION_PIN_PROVENANCE_EVIDENCE_FIELDS,
  ACTION_PIN_PROVENANCE_REPORT_FIELDS,
  ACTION_PIN_TAG_REFERENCE_FIELDS,
  canonicalActionPinJson,
  reviewActionPin,
  verifyActionPinProvenanceArtifact,
  writeActionPinProvenanceArtifactAtomic,
  writeActionPinProvenanceReportAtomic,
} from '../scripts/action-pin-provenance-core.mjs';
import { resolveGitHubActionTag } from '../scripts/action-pin-review-github.mjs';
import { runActionPinReview } from '../scripts/review-action-pin.mjs';
import {
  canonicalWorkflowActionLock,
  createWorkflowSupplyChainReport,
} from '../scripts/workflow-supply-chain-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(ROOT, 'test', 'fixtures', 'action-pin-review');
const CHECKOUT_SHA = '9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0';
const OTHER_SHA = '1111111111111111111111111111111111111111';
const TAG_SHA = '2222222222222222222222222222222222222222';

describe('Action pin provenance', () => {
  it('replays the committed annotated-tag fixture with exact stable fields and no network path', () => {
    const report = verifyActionPinProvenanceArtifact({ artifactDir: FIXTURE_DIR });
    const stored = readFileSync(
      path.join(FIXTURE_DIR, 'action-pin-provenance.json'),
      'utf8'
    );
    expect(report.status).toBe('passed');
    expect(report.resolution).toBe('annotated');
    expect(report.resolvedCommitSha).toBe(
      '3f131e8634966bd73d06cc69884922b02e6faf92'
    );
    expect(canonicalActionPinJson(report)).toBe(stored);
    expect(Object.keys(report)).toEqual(ACTION_PIN_PROVENANCE_REPORT_FIELDS);
    expect(Object.keys(report.evidence)).toEqual(
      ACTION_PIN_PROVENANCE_EVIDENCE_FIELDS
    );
    expect(Object.keys(report.checks)).toEqual(ACTION_PIN_PROVENANCE_CHECK_FIELDS);
    expect(
      Object.keys(
        JSON.parse(readFileSync(path.join(FIXTURE_DIR, 'tag-reference.json'), 'utf8'))
      )
    ).toEqual(ACTION_PIN_TAG_REFERENCE_FIELDS);
    expect(
      Object.keys(
        JSON.parse(readFileSync(path.join(FIXTURE_DIR, 'annotated-tag.json'), 'utf8'))
      )
    ).toEqual(ACTION_PIN_ANNOTATED_TAG_FIELDS);

    const offlineSources = [
      'scripts/action-pin-provenance-core.mjs',
      'scripts/verify-action-pin-provenance.mjs',
    ].map((file) => readFileSync(path.join(ROOT, file), 'utf8'));
    for (const source of offlineSources) {
      for (const forbidden of [
        'node:child_process',
        'node:http',
        'node:https',
        'fetch(',
        'gh api',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
    expect(readFileSync(path.join(ROOT, 'scripts/action-pin-review-github.mjs'), 'utf8'))
      .toContain('await fetch(url');
    expect(createWorkflowSupplyChainReport().status).toBe('failed');
  });

  it('resolves lightweight and annotated Git tags through an injected execution layer', async () => {
    const commitUrl = githubObjectUrl('actions/checkout', 'commits', CHECKOUT_SHA);
    const lightweightCalls = [];
    const lightweight = await resolveGitHubActionTag(
      { repository: 'actions/checkout', releaseTag: 'v7' },
      {
        requestJson: async (url) => {
          lightweightCalls.push(url);
          return {
            ref: 'refs/tags/v7',
            object: { type: 'commit', sha: CHECKOUT_SHA, url: commitUrl },
          };
        },
      }
    );
    expect(lightweightCalls).toEqual([
      'https://api.github.com/repos/actions/checkout/git/ref/tags/v7',
    ]);
    expect(lightweight.annotatedTag).toBeNull();

    const annotatedCalls = [];
    const annotated = await resolveGitHubActionTag(
      { repository: 'actions/checkout', releaseTag: 'v7' },
      {
        requestJson: async (url) => {
          annotatedCalls.push(url);
          if (annotatedCalls.length === 1) {
            return {
              ref: 'refs/tags/v7',
              object: {
                type: 'tag',
                sha: TAG_SHA,
                url: githubObjectUrl('actions/checkout', 'tags', TAG_SHA),
              },
            };
          }
          return {
            tag: 'v7',
            sha: TAG_SHA,
            object: { type: 'commit', sha: CHECKOUT_SHA, url: commitUrl },
          };
        },
      }
    );
    expect(annotatedCalls).toHaveLength(2);
    expect(annotated.annotatedTag.objectSha).toBe(CHECKOUT_SHA);

    const lock = makeLock();
    for (const evidence of [lightweight, annotated]) {
      const report = reviewActionPin({
        ...reviewInputs(),
        baselineLockBytes: lock,
        candidateLockBytes: lock,
        ...evidence,
      });
      expect(report.status).toBe('passed');
      expect(report.resolvedCommitSha).toBe(CHECKOUT_SHA);
    }
  });

  it('creates a network-resolved artifact and replays stdout/report byte-for-byte offline', async () => {
    await withTempDirAsync(async (directory) => {
      const baselineLock = path.join(directory, 'baseline.json');
      const candidateLock = path.join(directory, 'candidate.json');
      const artifactDir = path.join(directory, 'artifact');
      writeFileSync(baselineLock, makeLock());
      writeFileSync(candidateLock, makeLock());
      const report = await runActionPinReview(
        {
          ...reviewInputs(),
          baselineLock,
          candidateLock,
          artifactDir,
        },
        { resolveTag: async () => lightweightEvidence() }
      );
      expect(report.status).toBe('passed');
      expect(verifyActionPinProvenanceArtifact({ artifactDir })).toEqual(report);

      const replayFile = path.join(directory, 'replay.json');
      const child = spawnSync(
        process.execPath,
        [
          'scripts/verify-action-pin-provenance.mjs',
          '--artifact-dir',
          artifactDir,
          '--json',
          '--report-file',
          replayFile,
        ],
        {
          cwd: ROOT,
          encoding: 'utf8',
          env: blockedNetworkEnv(),
        }
      );
      expect(child.status).toBe(0);
      expect(child.stderr).toBe('');
      expect(child.stdout).toBe(
        readFileSync(path.join(artifactDir, 'action-pin-provenance.json'), 'utf8')
      );
      expect(readFileSync(replayFile, 'utf8')).toBe(child.stdout);
    });
  });

  it('rejects version/tag mismatch and resolved commit mismatch', () => {
    const tagMismatch = reviewActionPin({
      ...reviewInputs({ releaseTag: 'v6' }),
      baselineLockBytes: makeLock(),
      candidateLockBytes: makeLock(),
      ...lightweightEvidence({ releaseTag: 'v6' }),
    });
    expect(tagMismatch.status).toBe('failed');
    expect(tagMismatch.error).toContain('does not match reviewed tag v6');

    const commitMismatch = reviewActionPin({
      ...reviewInputs(),
      baselineLockBytes: makeLock(),
      candidateLockBytes: makeLock(),
      ...lightweightEvidence({ sha: OTHER_SHA }),
    });
    expect(commitMismatch.status).toBe('failed');
    expect(commitMismatch.error).toContain('not proposed SHA');
  });

  it('rejects major downgrade, an unregistered Action, and repository changes', () => {
    const downgrade = reviewActionPin({
      ...reviewInputs({ releaseTag: 'v6', proposedSha: OTHER_SHA }),
      baselineLockBytes: makeLock({ version: 'v7', sha: CHECKOUT_SHA }),
      candidateLockBytes: makeLock({ version: 'v6', sha: OTHER_SHA }),
      ...lightweightEvidence({ releaseTag: 'v6', sha: OTHER_SHA }),
    });
    expect(downgrade.status).toBe('failed');
    expect(downgrade.error).toContain('may not downgrade from v7 to v6');

    const unregistered = reviewActionPin({
      ...reviewInputs(),
      baselineLockBytes: makeLock(),
      candidateLockBytes: makeLock({
        action: 'actions/setup-node',
        repository: 'actions/setup-node',
      }),
      ...lightweightEvidence(),
    });
    expect(unregistered.status).toBe('failed');
    expect(unregistered.error).toContain('not registered in the candidate lock');

    const repositoryChange = reviewActionPin({
      ...reviewInputs({ repository: 'evil/checkout' }),
      baselineLockBytes: makeLock(),
      candidateLockBytes: makeLock(),
      ...lightweightEvidence({ repository: 'evil/checkout' }),
    });
    expect(repositoryChange.status).toBe('failed');
    expect(repositoryChange.error).toContain('does not own Action');
  });

  it('rejects annotated-tag dereference failure and tampered artifact evidence', () => {
    const failedDereference = reviewActionPin({
      ...reviewInputs(),
      baselineLockBytes: makeLock(),
      candidateLockBytes: makeLock(),
      ...annotatedEvidence({ objectType: 'tree' }),
    });
    expect(failedDereference.status).toBe('failed');
    expect(failedDereference.error).toContain(
      'Annotated tag dereference must resolve directly to a commit'
    );

    withTempDir((directory) => {
      const artifact = path.join(directory, 'artifact');
      copyFixture(artifact);
      const tagPath = path.join(artifact, 'annotated-tag.json');
      const tag = JSON.parse(readFileSync(tagPath, 'utf8'));
      tag.objectSha = OTHER_SHA;
      tag.objectUrl = githubObjectUrl('gradle/actions', 'commits', OTHER_SHA);
      writeFileSync(tagPath, canonicalActionPinJson(tag));
      expect(() => verifyActionPinProvenanceArtifact({ artifactDir: artifact })).toThrow(
        'does not match its bundled evidence'
      );
    });
  });

  it('atomically preserves prior reports and removes incomplete artifact directories', () => {
    withTempDir((directory) => {
      const reportPath = path.join(directory, 'report.json');
      writeFileSync(reportPath, 'prior-report\n');
      expect(() =>
        writeActionPinProvenanceReportAtomic(
          reportPath,
          reviewActionPin({}),
          {
            writeFile: (filePath) => {
              writeFileSync(filePath, 'partial');
              throw new Error('injected report write failure');
            },
          }
        )
      ).toThrow('injected report write failure');
      expect(readFileSync(reportPath, 'utf8')).toBe('prior-report\n');
      expect(readdirSync(directory).filter((name) => name.endsWith('.tmp'))).toEqual([]);

      const artifact = path.join(directory, 'artifact');
      const evidence = lightweightEvidence();
      expect(() =>
        writeActionPinProvenanceArtifactAtomic(
          artifact,
          {
            baselineLockBytes: makeLock(),
            candidateLockBytes: makeLock(),
            ...evidence,
            report: reviewActionPin({
              ...reviewInputs(),
              baselineLockBytes: makeLock(),
              candidateLockBytes: makeLock(),
              ...evidence,
            }),
          },
          {
            writeFile: (filePath, bytes, options) => {
              if (filePath.endsWith('action-pin-provenance.json')) {
                writeFileSync(filePath, 'partial');
                throw new Error('injected artifact write failure');
              }
              writeFileSync(filePath, bytes, options);
            },
          }
        )
      ).toThrow('injected artifact write failure');
      expect(() => readFileSync(path.join(artifact, 'action-pin-provenance.json'))).toThrow();
      expect(readdirSync(directory).filter((name) => name.includes('.tmp'))).toEqual([]);
    });
  });
});

function reviewInputs(overrides = {}) {
  return {
    action: 'actions/checkout',
    repository: 'actions/checkout',
    releaseTag: 'v7',
    proposedSha: CHECKOUT_SHA,
    ...overrides,
  };
}

function makeLock({
  action = 'actions/checkout',
  repository = 'actions/checkout',
  version = 'v7',
  sha = CHECKOUT_SHA,
} = {}) {
  return Buffer.from(
    canonicalWorkflowActionLock({
      schemaVersion: 1,
      status: 'passed',
      workflows: ['.github/workflows/ci.yml'],
      actions: [
        {
          action,
          repository,
          version,
          sha,
          usages: [{ workflow: '.github/workflows/ci.yml', count: 1 }],
        },
      ],
      error: null,
    })
  );
}

function lightweightEvidence({
  repository = 'actions/checkout',
  releaseTag = 'v7',
  sha = CHECKOUT_SHA,
} = {}) {
  return {
    tagReference: {
      repository,
      tag: releaseTag,
      ref: `refs/tags/${releaseTag}`,
      url: `https://api.github.com/repos/${repository}/git/ref/tags/${releaseTag}`,
      objectType: 'commit',
      objectSha: sha,
      objectUrl: githubObjectUrl(repository, 'commits', sha),
    },
    annotatedTag: null,
  };
}

function annotatedEvidence({ objectType = 'commit', sha = CHECKOUT_SHA } = {}) {
  return {
    tagReference: {
      repository: 'actions/checkout',
      tag: 'v7',
      ref: 'refs/tags/v7',
      url: 'https://api.github.com/repos/actions/checkout/git/ref/tags/v7',
      objectType: 'tag',
      objectSha: TAG_SHA,
      objectUrl: githubObjectUrl('actions/checkout', 'tags', TAG_SHA),
    },
    annotatedTag: {
      repository: 'actions/checkout',
      tag: 'v7',
      sha: TAG_SHA,
      url: githubObjectUrl('actions/checkout', 'tags', TAG_SHA),
      objectType,
      objectSha: sha,
      objectUrl: githubObjectUrl('actions/checkout', 'commits', sha),
    },
  };
}

function githubObjectUrl(repository, kind, sha) {
  return `https://api.github.com/repos/${repository}/git/${kind}/${sha}`;
}

function blockedNetworkEnv() {
  return {
    ...process.env,
    HTTP_PROXY: 'http://127.0.0.1:1',
    HTTPS_PROXY: 'http://127.0.0.1:1',
    ALL_PROXY: 'http://127.0.0.1:1',
    NO_PROXY: '',
  };
}

function copyFixture(destination) {
  mkdirSync(destination, { recursive: true });
  for (const name of readdirSync(FIXTURE_DIR)) {
    writeFileSync(
      path.join(destination, name),
      readFileSync(path.join(FIXTURE_DIR, name))
    );
  }
}

function withTempDir(callback) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'rnick-action-pin-'));
  try {
    return callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

async function withTempDirAsync(callback) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'rnick-action-pin-'));
  try {
    return await callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
