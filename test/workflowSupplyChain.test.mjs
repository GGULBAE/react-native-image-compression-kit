import { spawnSync } from 'node:child_process';
import {
  cpSync,
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
  WORKFLOW_ACTION_FIELDS,
  WORKFLOW_ACTION_LOCK_FIELDS,
  WORKFLOW_ACTION_LOCK_FILE,
  WORKFLOW_ACTION_USAGE_FIELDS,
  WORKFLOW_DEPENDABOT_CONTENT,
  WORKFLOW_DEPENDABOT_FILE,
  WORKFLOW_SUPPLY_CHAIN_CHECK_FIELDS,
  WORKFLOW_SUPPLY_CHAIN_REPORT_FIELDS,
  canonicalWorkflowActionLock,
  canonicalWorkflowSupplyChainReport,
  createWorkflowActionLock,
  createWorkflowSupplyChainReport,
  verifyWorkflowSupplyChain,
  writeWorkflowSupplyChainReportAtomic,
} from '../scripts/workflow-supply-chain-core.mjs';
import { parseWorkflowSupplyChainArgs } from '../scripts/verify-workflow-supply-chain.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const WORKFLOW_DIR = path.join(ROOT, '.github', 'workflows');
const LOCK_FILE = path.join(ROOT, WORKFLOW_ACTION_LOCK_FILE);
const VERIFIER = path.join(ROOT, 'scripts', 'verify-workflow-supply-chain.mjs');
const CHECKOUT_SHA = '9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0';

function copiedRepository(label) {
  const parent = mkdtempSync(path.join(os.tmpdir(), `rnick-workflow-${label}-`));
  const rootDir = path.join(parent, 'repository');
  mkdirSync(path.join(rootDir, '.github'), { recursive: true });
  cpSync(WORKFLOW_DIR, path.join(rootDir, '.github', 'workflows'), {
    recursive: true,
  });
  cpSync(LOCK_FILE, path.join(rootDir, WORKFLOW_ACTION_LOCK_FILE));
  cpSync(
    path.join(ROOT, WORKFLOW_DEPENDABOT_FILE),
    path.join(rootDir, WORKFLOW_DEPENDABOT_FILE)
  );
  cpSync(path.join(ROOT, 'package.json'), path.join(rootDir, 'package.json'));
  return { parent, rootDir };
}

function verify(rootDir) {
  return verifyWorkflowSupplyChain({
    rootDir,
    workflowDir: path.join(rootDir, '.github', 'workflows'),
    lockFile: path.join(rootDir, WORKFLOW_ACTION_LOCK_FILE),
    dependabotFile: path.join(rootDir, WORKFLOW_DEPENDABOT_FILE),
  });
}

function mutateWorkflow(rootDir, workflow, mutate) {
  const filePath = path.join(rootDir, '.github', 'workflows', workflow);
  const source = readFileSync(filePath, 'utf8');
  writeFileSync(filePath, mutate(source), 'utf8');
}

function mutateLock(rootDir, mutate) {
  const filePath = path.join(rootDir, WORKFLOW_ACTION_LOCK_FILE);
  const lock = JSON.parse(readFileSync(filePath, 'utf8'));
  mutate(lock);
  writeFileSync(filePath, canonicalWorkflowActionLock(lock), 'utf8');
}

function repositoryWorkflowSources(rootDir = ROOT) {
  const workflowDir = path.join(rootDir, '.github', 'workflows');
  return readdirSync(workflowDir)
    .filter((entry) => /\.ya?ml$/.test(entry))
    .sort()
    .map((entry) => ({
      workflow: `.github/workflows/${entry}`,
      source: readFileSync(path.join(workflowDir, entry), 'utf8'),
    }));
}

describe('GitHub Actions workflow supply-chain gate', () => {
  it('matches every workflow use to one canonical immutable Action lock', () => {
    const lockBytes = readFileSync(LOCK_FILE, 'utf8');
    const lock = JSON.parse(lockBytes);
    const expected = createWorkflowActionLock(repositoryWorkflowSources());
    const result = verify(ROOT);

    expect(Object.keys(lock)).toEqual(WORKFLOW_ACTION_LOCK_FIELDS);
    expect(lock.workflows).toHaveLength(10);
    expect(lock.workflows).toContain(
      '.github/workflows/release-evidence-policy-review.yml'
    );
    expect(lock.actions).toHaveLength(13);
    for (const action of lock.actions) {
      expect(Object.keys(action)).toEqual(WORKFLOW_ACTION_FIELDS);
      expect(action.sha).toMatch(/^[0-9a-f]{40}$/);
      expect(action.version).toMatch(/^v\d/);
      for (const usage of action.usages) {
        expect(Object.keys(usage)).toEqual(WORKFLOW_ACTION_USAGE_FIELDS);
      }
    }
    expect(lockBytes).toBe(canonicalWorkflowActionLock(lock));
    expect(lock).toEqual(expected);
    expect(Object.keys(result)).toEqual(WORKFLOW_SUPPLY_CHAIN_REPORT_FIELDS);
    expect(Object.keys(result.checks)).toEqual(WORKFLOW_SUPPLY_CHAIN_CHECK_FIELDS);
    expect(result).toMatchObject({
      status: 'passed',
      workflowCount: 10,
      actionCount: 13,
      usageCount: 70,
      lockSha256:
        '43122405b320062850f7ada247c0ee0d9e2f59814dc8a846445d1984e43eab68',
      checks: Object.fromEntries(
        WORKFLOW_SUPPLY_CHAIN_CHECK_FIELDS.map((field) => [field, true])
      ),
      error: null,
    });
    expect(readFileSync(path.join(ROOT, WORKFLOW_DEPENDABOT_FILE), 'utf8')).toBe(
      WORKFLOW_DEPENDABOT_CONTENT
    );
    for (const policy of [
      'open-pull-requests-limit: 2',
      'open-pull-requests-limit: 3',
      'applies-to: "security-updates"',
      '"@opentelemetry/*"',
      'version-update:semver-major',
    ]) {
      expect(WORKFLOW_DEPENDABOT_CONTENT).toContain(policy);
    }

    const coreSource = readFileSync(
      path.join(ROOT, 'scripts', 'workflow-supply-chain-core.mjs'),
      'utf8'
    );
    const cliSource = readFileSync(VERIFIER, 'utf8');
    for (const forbidden of ['node:child_process', 'node:http', 'node:https', 'fetch(', 'gh api']) {
      expect(coreSource).not.toContain(forbidden);
      expect(cliSource).not.toContain(forbidden);
    }
  });

  it('parses fixture paths and writes canonical CLI stdout/report bytes offline', () => {
    expect(
      parseWorkflowSupplyChainArgs([
        '--root', 'fixture',
        '--workflow-dir', 'fixture/workflows',
        '--lock-file', 'fixture/actions-lock.json',
        '--dependabot-file', 'fixture/dependabot.yml',
        '--json',
        '--report-file', 'fixture/report.json',
      ])
    ).toEqual({
      rootDir: 'fixture',
      workflowDir: 'fixture/workflows',
      lockFile: 'fixture/actions-lock.json',
      dependabotFile: 'fixture/dependabot.yml',
      json: true,
      reportFile: 'fixture/report.json',
    });

    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-workflow-cli-'));
    try {
      const reportFile = path.join(parent, 'report.json');
      const result = spawnSync(
        process.execPath,
        [VERIFIER, '--root', ROOT, '--json', '--report-file', reportFile],
        {
          cwd: ROOT,
          encoding: 'utf8',
          env: {
            ...process.env,
            HTTP_PROXY: 'http://127.0.0.1:9',
            HTTPS_PROXY: 'http://127.0.0.1:9',
            ALL_PROXY: 'http://127.0.0.1:9',
            NO_PROXY: '',
          },
        }
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

  it('rejects mutable refs and short commit SHAs', () => {
    for (const replacement of ['v7', CHECKOUT_SHA.slice(0, 12)]) {
      const { parent, rootDir } = copiedRepository('pin');
      try {
        mutateWorkflow(rootDir, 'ci.yml', (source) =>
          source.replace(`actions/checkout@${CHECKOUT_SHA}`, `actions/checkout@${replacement}`)
        );
        const result = verify(rootDir);
        expect(result.status).toBe('failed');
        expect(result.error).toContain('full 40-character commit SHA');
        expect(result.checks.pins).toBe(false);
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('rejects missing, additional, duplicate, and digest-drift lock entries', () => {
    const mutations = [
      ['missing', (lock) => lock.actions.shift()],
      ['additional', (lock) => {
        lock.actions.push({
          action: 'example/action',
          repository: 'example/action',
          version: 'v1',
          sha: '0'.repeat(40),
          usages: [{ workflow: '.github/workflows/ci.yml', count: 1 }],
        });
        lock.actions.sort((left, right) => left.action < right.action ? -1 : 1);
      }],
      ['duplicate', (lock) => {
        lock.actions.push(structuredClone(lock.actions[0]));
        lock.actions.sort((left, right) => left.action < right.action ? -1 : 1);
      }],
      ['digest', (lock) => {
        lock.actions[0].sha = '0'.repeat(40);
      }],
    ];

    for (const [label, mutate] of mutations) {
      const { parent, rootDir } = copiedRepository(`lock-${label}`);
      try {
        mutateLock(rootDir, mutate);
        const result = verify(rootDir);
        expect(result.status).toBe('failed');
        expect(result.checks.lock).toBe(false);
        expect(result.error).toMatch(
          label === 'duplicate' ? /duplicates/ : /does not exactly match/
        );
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('rejects one Action using inconsistent SHAs across workflows', () => {
    const { parent, rootDir } = copiedRepository('inconsistent');
    try {
      mutateWorkflow(rootDir, 'ci.yml', (source) =>
        source.replace(CHECKOUT_SHA, '0'.repeat(40))
      );
      const result = verify(rootDir);
      expect(result.status).toBe('failed');
      expect(result.error).toContain(
        'must use one consistent commit SHA and release tag across all workflows'
      );
      expect(result.checks.consistency).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects missing and non-release version comments', () => {
    for (const replacement of ['', ' # main']) {
      const { parent, rootDir } = copiedRepository('comment');
      try {
        mutateWorkflow(rootDir, 'ci.yml', (source) =>
          source.replace(`${CHECKOUT_SHA} # v7`, `${CHECKOUT_SHA}${replacement}`)
        );
        const result = verify(rootDir);
        expect(result.status).toBe('failed');
        expect(result.error).toContain('reviewable release tag comment');
        expect(result.checks.comments).toBe(false);
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('rejects missing or drifted Dependabot github-actions configuration', () => {
    for (const contents of ['', WORKFLOW_DEPENDABOT_CONTENT.replace('weekly', 'daily')]) {
      const { parent, rootDir } = copiedRepository('dependabot');
      try {
        writeFileSync(path.join(rootDir, WORKFLOW_DEPENDABOT_FILE), contents, 'utf8');
        const result = verify(rootDir);
        expect(result.status).toBe('failed');
        expect(result.error).toContain('Dependabot github-actions configuration');
        expect(result.checks.dependabot).toBe(false);
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('requires a manual, read-only npm-production health deployment contract', () => {
    const mutations = [
      ['automatic trigger', (source) => source.replace('  workflow_dispatch:', '  push:\n  workflow_dispatch:')],
      ['version drift', (source) => source.replace('default: "0.3.0"', 'default: "0.2.55"')],
      ['tag drift', (source) => source.replace('default: latest', 'default: next')],
      ['write permission', (source) => source.replace('contents: read', 'contents: write')],
      ['missing environment', (source) => source.replace('name: npm-production', 'name: staging')],
      [
        'versionless URL',
        (source) => source.replace(
          'https://www.npmjs.com/package/react-native-image-compression-kit/v/${{ inputs.version }}',
          'https://www.npmjs.com/package/react-native-image-compression-kit'
        ),
      ],
      [
        'registry mutation',
        (source) => source.replace('    steps:\n', '    steps:\n      - run: pnpm publish\n'),
      ],
    ];

    for (const [label, mutate] of mutations) {
      const { parent, rootDir } = copiedRepository(`registry-${label.replaceAll(' ', '-')}`);
      try {
        mutateWorkflow(rootDir, 'registry-validation.yml', mutate);
        const result = verify(rootDir);
        expect(result.status).toBe('failed');
        expect(result.checks.workflows).toBe(false);
        expect(result.error).toMatch(
          /workflow_dispatch-only|default version|default dist-tag|read-only contents|npm-production|exact input version|must not contain/
        );
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('preserves an existing report and removes the temporary file on atomic failure', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-workflow-atomic-'));
    try {
      const reportFile = path.join(parent, 'report.json');
      writeFileSync(reportFile, 'previous\n');
      const report = createWorkflowSupplyChainReport({ lockFile: LOCK_FILE });
      expect(() =>
        writeWorkflowSupplyChainReportAtomic(reportFile, report, {
          rename: () => {
            throw new Error('fixture rename failure');
          },
        })
      ).toThrow('fixture rename failure');
      expect(readFileSync(reportFile, 'utf8')).toBe('previous\n');
      expect(readdirSync(parent)).toEqual(['report.json']);
      expect(canonicalWorkflowSupplyChainReport(report).trim().split('\n')).toHaveLength(1);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
