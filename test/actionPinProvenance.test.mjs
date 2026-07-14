import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ACTION_PIN_ANNOTATED_TAG_FIELDS,
  ACTION_PIN_ARTIFACT_MANIFEST_ENTRY_FIELDS,
  ACTION_PIN_ARTIFACT_MANIFEST_FIELDS,
  ACTION_PIN_EXECUTION_FIELDS,
  ACTION_PIN_GITHUB_EVENT_FIELDS,
  ACTION_PIN_GITHUB_EVENT_INPUT_FIELDS,
  ACTION_PIN_PROVENANCE_CHECK_FIELDS,
  ACTION_PIN_PROVENANCE_EVIDENCE_FIELDS,
  ACTION_PIN_PROVENANCE_REPORT_FIELDS,
  ACTION_PIN_TAG_REFERENCE_FIELDS,
  ACTION_PIN_WORKFLOW_PATH,
  canonicalActionPinArtifactManifest,
  canonicalActionPinJson,
  createActionPinArtifactManifest,
  createActionPinEvidenceFiles,
  createWorkflowDispatchEventEvidence,
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
const EVENT_FIXTURE = path.join(
  ROOT,
  'test',
  'fixtures',
  'github',
  'action-pin-review-workflow-dispatch.json'
);
const WORKFLOW_FILE = path.join(ROOT, ACTION_PIN_WORKFLOW_PATH);
const WORKFLOW_BYTES = readFileSync(WORKFLOW_FILE);
const CHECKOUT_SHA = '9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0';
const GRADLE_SHA = '3f131e8634966bd73d06cc69884922b02e6faf92';
const GRADLE_TAG_SHA = '90ddb51e90a5fd9ba75f40cf85156b7b41bf76a3';
const OTHER_SHA = '1111111111111111111111111111111111111111';
const TAG_SHA = '2222222222222222222222222222222222222222';
const SOURCE_SHA = '3333333333333333333333333333333333333333';

describe('Action pin provenance', () => {
  it('replays the committed execution-bound fixture with exact stable fields and no network path', () => {
    const report = verifyActionPinProvenanceArtifact({ artifactDir: FIXTURE_DIR });
    const stored = readFileSync(
      path.join(FIXTURE_DIR, 'action-pin-provenance.json'),
      'utf8'
    );
    const manifest = JSON.parse(
      readFileSync(path.join(FIXTURE_DIR, 'artifact-manifest.json'), 'utf8')
    );
    expect(report.status).toBe('passed');
    expect(report.resolution).toBe('annotated');
    expect(report.resolvedCommitSha).toBe(GRADLE_SHA);
    expect(report.sourceRepository).toBe(
      'GGULBAE/react-native-image-compression-kit'
    );
    expect(report.workflowPath).toBe(ACTION_PIN_WORKFLOW_PATH);
    expect(report.runAttempt).toBe(1);
    expect(canonicalActionPinJson(report)).toBe(stored);
    expect(Object.keys(report)).toEqual(ACTION_PIN_PROVENANCE_REPORT_FIELDS);
    expect(Object.keys(report.evidence)).toEqual(
      ACTION_PIN_PROVENANCE_EVIDENCE_FIELDS
    );
    expect(Object.keys(report.checks)).toEqual(ACTION_PIN_PROVENANCE_CHECK_FIELDS);
    expect(Object.keys(manifest)).toEqual(ACTION_PIN_ARTIFACT_MANIFEST_FIELDS);
    for (const entry of manifest.files) {
      expect(Object.keys(entry)).toEqual(ACTION_PIN_ARTIFACT_MANIFEST_ENTRY_FIELDS);
    }
    expect(
      readFileSync(path.join(FIXTURE_DIR, 'action-pin-review-workflow.yml'))
    ).toEqual(WORKFLOW_BYTES);
    expect(
      Object.keys(
        JSON.parse(readFileSync(path.join(FIXTURE_DIR, 'github-execution.json'), 'utf8'))
      )
    ).toEqual(ACTION_PIN_EXECUTION_FIELDS);
    expect(
      Object.keys(
        JSON.parse(
          readFileSync(path.join(FIXTURE_DIR, 'workflow-dispatch-event.json'), 'utf8')
        )
      )
    ).toEqual(ACTION_PIN_GITHUB_EVENT_FIELDS);
    expect(
      Object.keys(
        JSON.parse(
          readFileSync(path.join(FIXTURE_DIR, 'workflow-dispatch-event.json'), 'utf8')
        ).inputs
      )
    ).toEqual(ACTION_PIN_GITHUB_EVENT_INPUT_FIELDS);
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

  it('normalizes a GitHub workflow_dispatch fixture and binds every execution identity field', () => {
    const rawEvent = JSON.parse(readFileSync(EVENT_FIXTURE, 'utf8'));
    const inputs = gradleReviewInputs();
    const execution = makeExecution();
    const event = createWorkflowDispatchEventEvidence({
      eventName: 'workflow_dispatch',
      event: rawEvent,
      execution,
      ...inputs,
      baselineRef: 'master',
    });
    expect(Object.keys(execution)).toEqual(ACTION_PIN_EXECUTION_FIELDS);
    expect(event).toEqual(makeGithubEvent({ inputs, execution }));
    expect(canonicalActionPinJson(event)).toContain('"eventName":"workflow_dispatch"');
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

    for (const evidence of [lightweight, annotated]) {
      const report = reviewActionPin(buildReviewArgs({ tagEvidence: evidence }));
      expect(report.status).toBe('passed');
      expect(report.resolvedCommitSha).toBe(CHECKOUT_SHA);
      expect(Object.values(report.checks).every(Boolean)).toBe(true);
    }
  });

  it('creates an event-bound artifact and replays stdout/report byte-for-byte offline', async () => {
    await withTempDirAsync(async (directory) => {
      const baselineLock = path.join(directory, 'baseline.json');
      const candidateLock = path.join(directory, 'candidate.json');
      const artifactDir = path.join(directory, 'artifact');
      const inputs = gradleReviewInputs();
      const lock = makeLock({ ...inputs, version: inputs.releaseTag, sha: inputs.proposedSha });
      writeFileSync(baselineLock, lock);
      writeFileSync(candidateLock, lock);
      const report = await runActionPinReview(
        {
          ...inputs,
          baselineRef: 'master',
          baselineLock,
          candidateLock,
          ...executionOptions(),
          workflowFile: WORKFLOW_FILE,
          eventName: 'workflow_dispatch',
          githubEvent: EVENT_FIXTURE,
          artifactDir,
        },
        { resolveTag: async () => gradleAnnotatedEvidence() }
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

  it('rejects execution, event, and workflow identity mismatches', () => {
    const badExecution = buildReviewArgs();
    badExecution.execution.workflowRef =
      'GGULBAE/react-native-image-compression-kit/.github/workflows/ci.yml@refs/heads/master';
    expect(reviewActionPin(badExecution).error).toContain('Workflow ref does not bind');

    const badEvent = buildReviewArgs();
    badEvent.githubEvent.ref = 'refs/heads/other';
    expect(reviewActionPin(badEvent).error).toContain(
      'GitHub event ref does not match source ref'
    );

    const unregisteredWorkflowLock = makeLock({
      workflows: ['.github/workflows/ci.yml'],
    });
    const unregisteredWorkflow = buildReviewArgs({
      candidateLockBytes: unregisteredWorkflowLock,
    });
    expect(reviewActionPin(unregisteredWorkflow).error).toContain(
      'does not register workflow'
    );
  });

  it('rejects version/tag mismatch and resolved commit mismatch', () => {
    const versionInputs = reviewInputs({ releaseTag: 'v6' });
    const tagMismatch = reviewActionPin(
      buildReviewArgs({
        inputs: versionInputs,
        tagEvidence: lightweightEvidence({ releaseTag: 'v6' }),
      })
    );
    expect(tagMismatch.status).toBe('failed');
    expect(tagMismatch.error).toContain('does not match reviewed tag v6');

    const commitMismatch = reviewActionPin(
      buildReviewArgs({ tagEvidence: lightweightEvidence({ sha: OTHER_SHA }) })
    );
    expect(commitMismatch.status).toBe('failed');
    expect(commitMismatch.error).toContain('not proposed SHA');
  });

  it('rejects major downgrade, an unregistered Action, and repository changes', () => {
    const downgradeInputs = reviewInputs({ releaseTag: 'v6', proposedSha: OTHER_SHA });
    const downgrade = reviewActionPin(
      buildReviewArgs({
        inputs: downgradeInputs,
        baselineLockBytes: makeLock({ version: 'v7', sha: CHECKOUT_SHA }),
        candidateLockBytes: makeLock({ version: 'v6', sha: OTHER_SHA }),
        tagEvidence: lightweightEvidence({ releaseTag: 'v6', sha: OTHER_SHA }),
      })
    );
    expect(downgrade.error).toContain('may not downgrade from v7 to v6');

    const unregistered = reviewActionPin(
      buildReviewArgs({
        candidateLockBytes: makeLock({
          action: 'actions/setup-node',
          repository: 'actions/setup-node',
        }),
      })
    );
    expect(unregistered.error).toContain('not registered in the candidate lock');

    const repositoryInputs = reviewInputs({ repository: 'evil/checkout' });
    const repositoryChange = reviewActionPin(
      buildReviewArgs({
        inputs: repositoryInputs,
        tagEvidence: lightweightEvidence({ repository: 'evil/checkout' }),
      })
    );
    expect(repositoryChange.error).toContain('does not own Action');
  });

  it('rejects annotated-tag dereference failure', () => {
    const failedDereference = reviewActionPin(
      buildReviewArgs({ tagEvidence: annotatedEvidence({ objectType: 'tree' }) })
    );
    expect(failedDereference.status).toBe('failed');
    expect(failedDereference.error).toContain(
      'Annotated tag dereference must resolve directly to a commit'
    );
  });

  it('rejects artifact manifest path traversal', () => {
    withCopiedFixture((artifact) => {
      const manifestPath = path.join(artifact, 'artifact-manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.files[0].path = '../escape.json';
      writeFileSync(manifestPath, canonicalActionPinArtifactManifest(manifest));
      expect(() => verifyActionPinProvenanceArtifact({ artifactDir: artifact })).toThrow(
        /traverses directories|flat filenames/
      );
    });
  });

  it('rejects missing and additional artifact files', () => {
    withCopiedFixture((artifact) => {
      unlinkSync(path.join(artifact, 'tag-reference.json'));
      expect(() => verifyActionPinProvenanceArtifact({ artifactDir: artifact })).toThrow(
        /files must be exactly|is missing/
      );
    });
    withCopiedFixture((artifact) => {
      writeFileSync(path.join(artifact, 'unlisted.txt'), 'unexpected');
      expect(() => verifyActionPinProvenanceArtifact({ artifactDir: artifact })).toThrow(
        'files must be exactly'
      );
    });
  });

  it('rejects artifact evidence size and SHA-256 tampering', () => {
    withCopiedFixture((artifact) => {
      const workflowPath = path.join(artifact, 'action-pin-review-workflow.yml');
      writeFileSync(
        workflowPath,
        Buffer.concat([readFileSync(workflowPath), Buffer.from('\n')])
      );
      expect(() => verifyActionPinProvenanceArtifact({ artifactDir: artifact })).toThrow(
        'size does not match the artifact manifest'
      );
    });
    withCopiedFixture((artifact) => {
      const eventPath = path.join(artifact, 'workflow-dispatch-event.json');
      const bytes = readFileSync(eventPath);
      const mutated = Buffer.from(bytes);
      mutated[0] = mutated[0] === 0x7b ? 0x5b : 0x7b;
      writeFileSync(eventPath, mutated);
      expect(() => verifyActionPinProvenanceArtifact({ artifactDir: artifact })).toThrow(
        'SHA-256 does not match the artifact manifest'
      );
    });
  });

  it('rejects provenance report execution identity tampering', () => {
    withCopiedFixture((artifact) => {
      const reportPath = path.join(artifact, 'action-pin-provenance.json');
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      report.sourceHeadSha = OTHER_SHA;
      writeFileSync(reportPath, canonicalActionPinJson(report));
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
        writeActionPinProvenanceReportAtomic(reportPath, reviewActionPin({}), {
          writeFile: (filePath) => {
            writeFileSync(filePath, 'partial');
            throw new Error('injected report write failure');
          },
        })
      ).toThrow('injected report write failure');
      expect(readFileSync(reportPath, 'utf8')).toBe('prior-report\n');
      expect(readdirSync(directory).filter((name) => name.endsWith('.tmp'))).toEqual([]);

      const artifact = path.join(directory, 'artifact');
      const args = buildReviewArgs();
      const report = reviewActionPin(args);
      expect(report.status).toBe('passed');
      expect(() =>
        writeActionPinProvenanceArtifactAtomic(
          artifact,
          artifactWriteInputs(args, report),
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

function gradleReviewInputs() {
  return {
    action: 'gradle/actions/setup-gradle',
    repository: 'gradle/actions',
    releaseTag: 'v6',
    proposedSha: GRADLE_SHA,
  };
}

function makeExecution(overrides = {}) {
  const sourceRepository =
    overrides.sourceRepository ?? 'GGULBAE/react-native-image-compression-kit';
  const sourceRef = overrides.sourceRef ?? 'refs/heads/master';
  return {
    sourceRepository,
    sourceRef,
    sourceHeadSha: SOURCE_SHA,
    workflowName: 'Action Pin Review',
    workflowPath: ACTION_PIN_WORKFLOW_PATH,
    workflowRef: `${sourceRepository}/${ACTION_PIN_WORKFLOW_PATH}@${sourceRef}`,
    workflowSha: SOURCE_SHA,
    runId: '30000000000',
    runAttempt: 1,
    ...overrides,
  };
}

function executionOptions() {
  const execution = makeExecution();
  return { ...execution, runAttempt: String(execution.runAttempt) };
}

function makeGithubEvent({ inputs = reviewInputs(), execution = makeExecution() } = {}) {
  return {
    eventName: 'workflow_dispatch',
    repository: execution.sourceRepository,
    ref: execution.sourceRef,
    workflow: execution.workflowPath,
    inputs: {
      action: inputs.action,
      repository: inputs.repository,
      releaseTag: inputs.releaseTag,
      proposedSha: inputs.proposedSha,
      baselineRef: 'master',
    },
  };
}

function buildReviewArgs({
  inputs = reviewInputs(),
  baselineLockBytes = makeLock(),
  candidateLockBytes = makeLock(),
  execution = makeExecution(),
  githubEvent = makeGithubEvent({ inputs, execution }),
  workflowBytes = WORKFLOW_BYTES,
  tagEvidence = lightweightEvidence({
    repository: inputs.repository,
    releaseTag: inputs.releaseTag,
    sha: inputs.proposedSha,
  }),
} = {}) {
  const artifactManifest = createActionPinArtifactManifest(
    createActionPinEvidenceFiles({
      baselineLockBytes,
      candidateLockBytes,
      execution,
      githubEvent,
      workflowBytes,
      ...tagEvidence,
    })
  );
  return {
    ...inputs,
    baselineRef: 'master',
    baselineLockBytes,
    candidateLockBytes,
    execution,
    githubEvent,
    workflowBytes,
    ...tagEvidence,
    artifactManifest,
  };
}

function artifactWriteInputs(args, report) {
  return {
    baselineLockBytes: args.baselineLockBytes,
    candidateLockBytes: args.candidateLockBytes,
    execution: args.execution,
    githubEvent: args.githubEvent,
    workflowBytes: args.workflowBytes,
    tagReference: args.tagReference,
    annotatedTag: args.annotatedTag,
    artifactManifest: args.artifactManifest,
    report,
  };
}

function makeLock({
  action = 'actions/checkout',
  repository = 'actions/checkout',
  version = 'v7',
  sha = CHECKOUT_SHA,
  workflows = [ACTION_PIN_WORKFLOW_PATH],
} = {}) {
  return Buffer.from(
    canonicalWorkflowActionLock({
      schemaVersion: 1,
      status: 'passed',
      workflows,
      actions: [
        {
          action,
          repository,
          version,
          sha,
          usages: [{ workflow: workflows[0], count: 1 }],
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

function gradleAnnotatedEvidence() {
  return {
    tagReference: {
      repository: 'gradle/actions',
      tag: 'v6',
      ref: 'refs/tags/v6',
      url: 'https://api.github.com/repos/gradle/actions/git/ref/tags/v6',
      objectType: 'tag',
      objectSha: GRADLE_TAG_SHA,
      objectUrl: githubObjectUrl('gradle/actions', 'tags', GRADLE_TAG_SHA),
    },
    annotatedTag: {
      repository: 'gradle/actions',
      tag: 'v6',
      sha: GRADLE_TAG_SHA,
      url: githubObjectUrl('gradle/actions', 'tags', GRADLE_TAG_SHA),
      objectType: 'commit',
      objectSha: GRADLE_SHA,
      objectUrl: githubObjectUrl('gradle/actions', 'commits', GRADLE_SHA),
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
    writeFileSync(path.join(destination, name), readFileSync(path.join(FIXTURE_DIR, name)));
  }
}

function withCopiedFixture(callback) {
  return withTempDir((directory) => {
    const artifact = path.join(directory, 'artifact');
    copyFixture(artifact);
    return callback(artifact);
  });
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
