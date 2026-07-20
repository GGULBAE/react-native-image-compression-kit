import { createHash } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

export const WORKFLOW_SUPPLY_CHAIN_SCHEMA_VERSION = 1;
export const WORKFLOW_ACTION_LOCK_FILE = '.github/actions-lock.json';
export const WORKFLOW_DEPENDABOT_FILE = '.github/dependabot.yml';

export const WORKFLOW_ACTION_LOCK_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'workflows',
  'actions',
  'error',
]);

export const WORKFLOW_ACTION_FIELDS = Object.freeze([
  'action',
  'repository',
  'version',
  'sha',
  'usages',
]);

export const WORKFLOW_ACTION_USAGE_FIELDS = Object.freeze([
  'workflow',
  'count',
]);

export const WORKFLOW_SUPPLY_CHAIN_REPORT_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'lockFile',
  'workflowCount',
  'actionCount',
  'usageCount',
  'lockSha256',
  'checks',
  'error',
]);

export const WORKFLOW_SUPPLY_CHAIN_CHECK_FIELDS = Object.freeze([
  'workflows',
  'pins',
  'comments',
  'consistency',
  'lock',
  'dependabot',
]);

export const WORKFLOW_DEPENDABOT_CONTENT = `version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 2
    groups:
      minor-and-patch:
        patterns:
          - "*"
        update-types:
          - "minor"
          - "patch"
    ignore:
      - dependency-name: "*"
        update-types:
          - "version-update:semver-major"
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "monthly"
    open-pull-requests-limit: 3
    groups:
      security-tooling:
        applies-to: "security-updates"
        patterns:
          - "vite"
          - "esbuild"
          - "lighthouse"
          - "@sentry/*"
          - "@opentelemetry/*"
        dependency-type: "development"
      development-minor-and-patch:
        applies-to: "version-updates"
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"
    ignore:
      - dependency-name: "*"
        update-types:
          - "version-update:semver-major"
  - package-ecosystem: "bundler"
    directory: "/example"
    schedule:
      interval: "monthly"
    open-pull-requests-limit: 1
  - package-ecosystem: "gradle"
    directory: "/example/android"
    schedule:
      interval: "monthly"
    open-pull-requests-limit: 1
`;

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/;
const REVIEWABLE_RELEASE_TAG = /^v(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,2}(?:-[0-9A-Za-z.-]+)?$/;
const ACTION_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalWorkflowActionLock(lock) {
  return `${JSON.stringify(lock)}\n`;
}

export function canonicalWorkflowSupplyChainReport(report) {
  return `${JSON.stringify(report)}\n`;
}

export function parseWorkflowActionUsages({ workflow, source }) {
  assert(typeof workflow === 'string' && workflow.length > 0, 'Workflow path is required.');
  assert(typeof source === 'string', `Workflow ${workflow} source must be text.`);

  const usages = [];
  const lines = source.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!/^\s*(?:-\s*)?uses\s*:/.test(line)) continue;

    const match = line.match(
      /^\s*(?:-\s*)?uses\s*:\s*(?:"([^"]+)"|'([^']+)'|([^#\s]+))(?:\s+#\s*(\S(?:.*\S)?))?\s*$/
    );
    assert(
      match,
      `${workflow}:${lineIndex + 1} has an unsupported uses declaration.`
    );
    const target = match[1] ?? match[2] ?? match[3];
    const version = match[4]?.trim() ?? null;
    if (target.startsWith('./')) continue;

    const at = target.lastIndexOf('@');
    assert(
      at > 0 && at < target.length - 1,
      `${workflow}:${lineIndex + 1} has an unsupported non-local uses target: ${target}`
    );
    const action = target.slice(0, at);
    const ref = target.slice(at + 1);
    assert(
      ACTION_NAME.test(action),
      `${workflow}:${lineIndex + 1} has an invalid remote Action name: ${action}`
    );
    const segments = action.split('/');
    usages.push({
      workflow,
      line: lineIndex + 1,
      action,
      repository: `${segments[0]}/${segments[1]}`,
      version,
      sha: ref,
    });
  }
  return usages;
}

export function createWorkflowActionLock(workflowSources) {
  const normalized = normalizeWorkflowSources(workflowSources);
  const usages = normalized.flatMap(parseWorkflowActionUsages);
  validateActionPins(usages);
  validateReleaseComments(usages);
  return buildWorkflowActionLock(
    normalized.map((workflow) => workflow.workflow),
    usages
  );
}

export function createWorkflowSupplyChainReport({
  lockFile = null,
  workflowCount = 0,
  actionCount = 0,
  usageCount = 0,
  lockSha256 = null,
  checks = {},
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: WORKFLOW_SUPPLY_CHAIN_SCHEMA_VERSION,
    status,
    lockFile,
    workflowCount,
    actionCount,
    usageCount,
    lockSha256,
    checks: Object.fromEntries(
      WORKFLOW_SUPPLY_CHAIN_CHECK_FIELDS.map((field) => [
        field,
        checks[field] === true,
      ])
    ),
    error,
  };
}

export function verifyWorkflowSupplyChain(
  { rootDir, workflowDir, lockFile, dependabotFile } = {},
  dependencies = {}
) {
  const resolvedRoot = rootDir ? path.resolve(rootDir) : null;
  const resolvedWorkflowDir = path.resolve(
    workflowDir ?? path.join(resolvedRoot ?? '', '.github', 'workflows')
  );
  const resolvedLockFile = path.resolve(
    lockFile ?? path.join(resolvedRoot ?? '', WORKFLOW_ACTION_LOCK_FILE)
  );
  const resolvedDependabotFile = path.resolve(
    dependabotFile ?? path.join(resolvedRoot ?? '', WORKFLOW_DEPENDABOT_FILE)
  );
  const state = {
    lockFile: resolvedLockFile,
    workflowCount: 0,
    actionCount: 0,
    usageCount: 0,
    lockSha256: null,
    checks: {},
  };

  try {
    assert(resolvedRoot, 'Missing repository root directory.');
    const root = validateDirectory(resolvedRoot, 'repository root');
    const readFile = dependencies.readFile ?? readSecureTextFile;
    const workflowDirectory = validateDirectory(
      resolvedWorkflowDir,
      'workflow directory'
    );
    const workflowFiles = readdirSync(workflowDirectory)
      .filter((entry) => /\.ya?ml$/.test(entry))
      .sort(compareText);
    assert(workflowFiles.length > 0, 'No GitHub workflow YAML files were found.');
    const workflowSources = workflowFiles.map((entry) => {
      const filePath = path.join(workflowDirectory, entry);
      const workflow = toRepositoryPath(root, filePath);
      return { workflow, source: readFile(filePath, `workflow ${workflow}`) };
    });
    state.workflowCount = workflowSources.length;
    const packageMetadata = JSON.parse(
      readFile(path.join(root, 'package.json'), 'package metadata')
    );
    validateRegistryValidationWorkflow(workflowSources, packageMetadata.version);
    validateTrustedReleaseWorkflow(workflowSources);
    state.checks.workflows = true;

    const normalized = normalizeWorkflowSources(workflowSources);
    const usages = normalized.flatMap(parseWorkflowActionUsages);
    assert(usages.length > 0, 'No remote GitHub Actions uses were found.');
    state.usageCount = usages.length;
    validateActionPins(usages);
    state.checks.pins = true;
    validateReleaseComments(usages);
    state.checks.comments = true;
    const expectedLock = buildWorkflowActionLock(
      normalized.map((workflow) => workflow.workflow),
      usages
    );
    state.actionCount = expectedLock.actions.length;
    state.checks.consistency = true;

    const lockBytes = readSecureFileBytes(resolvedLockFile, 'workflow action lock');
    state.lockSha256 = sha256(lockBytes);
    const lock = parseCanonicalWorkflowActionLock(lockBytes);
    validateWorkflowActionLock(lock);
    assert(
      JSON.stringify(lock) === JSON.stringify(expectedLock),
      'Canonical Action lock does not exactly match the workflow files.'
    );
    state.checks.lock = true;

    const dependabotContents = readFile(
      resolvedDependabotFile,
      'Dependabot configuration'
    );
    assert(
      dependabotContents === WORKFLOW_DEPENDABOT_CONTENT,
      'Dependabot github-actions configuration is missing or noncanonical.'
    );
    state.checks.dependabot = true;

    return createWorkflowSupplyChainReport({
      ...state,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    return createWorkflowSupplyChainReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function writeWorkflowSupplyChainReportAtomic(
  filePath,
  report,
  operations = {}
) {
  const mkdir = operations.mkdir ?? mkdirSync;
  const writeFile = operations.writeFile ?? writeFileSync;
  const rename = operations.rename ?? renameSync;
  const remove = operations.remove ?? rmSync;
  const destination = path.resolve(filePath);
  const directory = path.dirname(destination);
  const temporary = path.join(
    directory,
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`
  );

  mkdir(directory, { recursive: true });
  try {
    writeFile(temporary, canonicalWorkflowSupplyChainReport(report), {
      encoding: 'utf8',
      flag: 'wx',
    });
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { force: true });
    throw error;
  }
}

function normalizeWorkflowSources(workflowSources) {
  assert(Array.isArray(workflowSources), 'Workflow sources must be an array.');
  assert(workflowSources.length > 0, 'At least one workflow source is required.');
  const normalized = workflowSources
    .map(({ workflow, source }) => ({ workflow, source }))
    .sort((left, right) => compareText(left.workflow, right.workflow));
  const paths = normalized.map((workflow) => workflow.workflow);
  assert(
    new Set(paths).size === paths.length,
    'Workflow sources must not contain duplicate paths.'
  );
  return normalized;
}

export function validateRegistryValidationWorkflow(workflowSources, packageVersion) {
  assert(
    typeof packageVersion === 'string' && packageVersion.length > 0,
    'Package metadata must declare a version.'
  );
  const workflow = workflowSources.find(
    ({ workflow: workflowPath }) =>
      workflowPath === '.github/workflows/registry-validation.yml'
  );
  assert(workflow, 'Registry Validation workflow is required.');

  const eventBlock = extractYamlMappingBlock(workflow.source, 0, 'on');
  assert(eventBlock, 'Registry Validation workflow must declare an event mapping.');
  assert(
    JSON.stringify(readYamlMappingKeys(eventBlock, 2)) ===
      JSON.stringify(['workflow_dispatch']),
    'Registry Validation workflow must be workflow_dispatch-only.'
  );

  const permissionsBlock = extractYamlMappingBlock(
    workflow.source,
    0,
    'permissions'
  );
  assert(
    readYamlScalar(permissionsBlock, 2, 'contents') === 'read' &&
      !readYamlMappingKeys(permissionsBlock, 2).includes('packages'),
    'Registry Validation must keep read-only contents and no package permission.'
  );

  const dispatchBlock = extractYamlMappingBlock(eventBlock, 2, 'workflow_dispatch');
  const inputsBlock = extractYamlMappingBlock(dispatchBlock, 4, 'inputs');
  const versionBlock = extractYamlMappingBlock(inputsBlock, 6, 'version');
  const tagBlock = extractYamlMappingBlock(inputsBlock, 6, 'expected_tag');
  assert(
    readYamlScalar(versionBlock, 8, 'default') === packageVersion,
    `Registry Validation default version must match package.json (${packageVersion}).`
  );
  assert(
    readYamlScalar(tagBlock, 8, 'default') === 'latest',
    'Registry Validation default dist-tag must be latest.'
  );

  const jobsBlock = extractYamlMappingBlock(workflow.source, 0, 'jobs');
  const jobBlock = extractYamlMappingBlock(jobsBlock, 2, 'registry-provenance');
  const environmentBlock = extractYamlMappingBlock(jobBlock, 4, 'environment');
  assert(
    readYamlScalar(environmentBlock, 6, 'name') === 'npm-production',
    'Registry Validation must report health through the npm-production environment.'
  );
  assert(
    readYamlScalar(environmentBlock, 6, 'url') ===
      'https://www.npmjs.com/package/react-native-image-compression-kit/v/${{ inputs.version }}',
    'Registry Validation npm-production URL must identify the exact input version.'
  );

  for (const forbidden of [
    /\b(?:npm|pnpm|yarn)\s+(?:publish|unpublish|deprecate|dist-tag|access|owner|token)\b/,
    /\bgh\s+release\b/,
    /\bgit\s+push\b/,
  ]) {
    assert(
      !forbidden.test(workflow.source),
      'Registry Validation must not contain registry, release, or Git mutation commands.'
    );
  }
}

export function validateTrustedReleaseWorkflow(workflowSources) {
  const workflow = workflowSources.find(
    ({ workflow: workflowPath }) =>
      workflowPath === '.github/workflows/release.yml'
  );
  assert(workflow, 'Trusted Release workflow is required.');

  for (const required of [
    'release_notes="docs/launch/v${VERSION}-release-notes.md"',
    'test -f "$release_notes"',
    'cp "$release_notes" "$release_dir/release-notes.md"',
  ]) {
    assert(
      workflow.source.includes(required),
      'Trusted Release must select existing release notes from the exact validated VERSION.'
    );
  }
  assert(
    !/docs\/launch\/v\d+\.\d+\.\d+-release-notes\.md/.test(workflow.source),
    'Trusted Release must not hardcode a versioned release-notes path.'
  );
}

function extractYamlMappingBlock(source, indent, key) {
  assert(typeof source === 'string', `Missing YAML source while reading ${key}.`);
  const lines = source.split(/\r?\n/);
  const prefix = `${' '.repeat(indent)}${key}:`;
  const start = lines.findIndex((line) => line === prefix);
  assert(start >= 0, `Missing YAML mapping: ${key}.`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const leadingSpaces = line.length - line.trimStart().length;
    if (leadingSpaces <= indent) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function readYamlMappingKeys(source, indent) {
  const prefix = ' '.repeat(indent);
  return source
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(new RegExp(`^${prefix}([A-Za-z0-9_-]+):(?:\\s.*)?$`));
      return match?.[1] ?? null;
    })
    .filter(Boolean);
}

function readYamlScalar(source, indent, key) {
  assert(typeof source === 'string', `Missing YAML source while reading ${key}.`);
  const prefix = ' '.repeat(indent);
  const match = source.match(
    new RegExp(`^${prefix}${key}:\\s*(?:"([^"]*)"|'([^']*)'|(\\S.*?))\\s*$`, 'm')
  );
  assert(match, `Missing YAML scalar: ${key}.`);
  return match[1] ?? match[2] ?? match[3];
}

function validateActionPins(usages) {
  for (const usage of usages) {
    assert(
      FULL_COMMIT_SHA.test(usage.sha),
      `${usage.workflow}:${usage.line} must pin ${usage.action} to a lowercase full 40-character commit SHA; got ${usage.sha}.`
    );
  }
}

function validateReleaseComments(usages) {
  for (const usage of usages) {
    assert(
      usage.version && REVIEWABLE_RELEASE_TAG.test(usage.version),
      `${usage.workflow}:${usage.line} must keep one reviewable release tag comment for ${usage.action}.`
    );
  }
}

function buildWorkflowActionLock(workflows, usages) {
  const grouped = new Map();
  for (const usage of usages) {
    const existing = grouped.get(usage.action);
    if (existing) {
      assert(
        existing.sha === usage.sha && existing.version === usage.version,
        `${usage.action} must use one consistent commit SHA and release tag across all workflows.`
      );
      existing.usages.set(
        usage.workflow,
        (existing.usages.get(usage.workflow) ?? 0) + 1
      );
    } else {
      grouped.set(usage.action, {
        action: usage.action,
        repository: usage.repository,
        version: usage.version,
        sha: usage.sha,
        usages: new Map([[usage.workflow, 1]]),
      });
    }
  }

  const actions = [...grouped.values()]
    .sort((left, right) => compareText(left.action, right.action))
    .map((entry) => ({
      action: entry.action,
      repository: entry.repository,
      version: entry.version,
      sha: entry.sha,
      usages: [...entry.usages.entries()]
        .sort(([left], [right]) => compareText(left, right))
        .map(([workflow, count]) => ({ workflow, count })),
    }));

  return {
    schemaVersion: WORKFLOW_SUPPLY_CHAIN_SCHEMA_VERSION,
    status: 'passed',
    workflows: [...workflows],
    actions,
    error: null,
  };
}

export function parseCanonicalWorkflowActionLock(bytes) {
  let lock;
  try {
    lock = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Could not parse workflow Action lock: ${error.message}`);
  }
  assertRecord(lock, 'workflow Action lock');
  assert(
    bytes.equals(Buffer.from(canonicalWorkflowActionLock(lock), 'utf8')),
    'Workflow Action lock is not canonical JSON.'
  );
  return lock;
}

export function validateWorkflowActionLock(lock) {
  assertExactFields(lock, WORKFLOW_ACTION_LOCK_FIELDS, 'workflow Action lock');
  assert(
    lock.schemaVersion === WORKFLOW_SUPPLY_CHAIN_SCHEMA_VERSION,
    `Unsupported workflow Action lock schemaVersion: ${lock.schemaVersion}`
  );
  assert(lock.status === 'passed', 'Workflow Action lock status must be passed.');
  assert(lock.error === null, 'Workflow Action lock error must be null.');
  assert(Array.isArray(lock.workflows), 'Workflow Action lock workflows must be an array.');
  assertSortedUniqueStrings(lock.workflows, 'Workflow Action lock workflows');
  assert(Array.isArray(lock.actions), 'Workflow Action lock actions must be an array.');

  const actionNames = [];
  for (const action of lock.actions) {
    assertRecord(action, 'workflow Action');
    assertExactFields(action, WORKFLOW_ACTION_FIELDS, 'workflow Action');
    assert(ACTION_NAME.test(action.action), `Invalid locked Action name: ${action.action}`);
    const segments = action.action.split('/');
    assert(
      action.repository === `${segments[0]}/${segments[1]}`,
      `Locked repository does not match Action ${action.action}.`
    );
    assert(
      REVIEWABLE_RELEASE_TAG.test(action.version),
      `Locked Action ${action.action} has an invalid release tag.`
    );
    assert(
      FULL_COMMIT_SHA.test(action.sha),
      `Locked Action ${action.action} does not use a full commit SHA.`
    );
    assert(Array.isArray(action.usages), `Locked Action ${action.action} usages must be an array.`);
    const usageWorkflows = [];
    for (const usage of action.usages) {
      assertRecord(usage, 'workflow Action usage');
      assertExactFields(
        usage,
        WORKFLOW_ACTION_USAGE_FIELDS,
        'workflow Action usage'
      );
      assert(
        lock.workflows.includes(usage.workflow),
        `Locked Action ${action.action} references an unknown workflow.`
      );
      assert(
        Number.isSafeInteger(usage.count) && usage.count > 0,
        `Locked Action ${action.action} usage count must be a positive integer.`
      );
      usageWorkflows.push(usage.workflow);
    }
    assertSortedUniqueStrings(
      usageWorkflows,
      `Locked Action ${action.action} usage workflows`
    );
    actionNames.push(action.action);
  }
  assertSortedUniqueStrings(actionNames, 'Workflow Action lock actions');
}

function validateDirectory(directoryPath, label) {
  const stats = lstatSync(directoryPath);
  assert(!stats.isSymbolicLink(), `${label} must not be a symbolic link.`);
  assert(stats.isDirectory(), `${label} must be a directory.`);
  return realpathSync(directoryPath);
}

function readSecureTextFile(filePath, label) {
  return readSecureFileBytes(filePath, label).toString('utf8');
}

function readSecureFileBytes(filePath, label) {
  const stats = lstatSync(filePath);
  assert(!stats.isSymbolicLink(), `${label} must not be a symbolic link.`);
  assert(stats.isFile(), `${label} must be a regular file.`);
  return readFileSync(realpathSync(filePath));
}

function toRepositoryPath(root, filePath) {
  const relative = path.relative(root, filePath);
  assert(
    relative && relative !== '..' && !relative.startsWith(`..${path.sep}`),
    `Workflow path is outside repository root: ${filePath}`
  );
  return relative.split(path.sep).join('/');
}

function assertSortedUniqueStrings(values, label) {
  assert(
    values.every((value) => typeof value === 'string' && value.length > 0),
    `${label} must contain nonempty strings.`
  );
  const sorted = [...values].sort(compareText);
  assert(
    JSON.stringify(values) === JSON.stringify(sorted),
    `${label} must use canonical sort order.`
  );
  assert(new Set(values).size === values.length, `${label} must not contain duplicates.`);
}

function assertExactFields(value, fields, label) {
  assert(
    JSON.stringify(Object.keys(value)) === JSON.stringify(fields),
    `${label} fields must be exactly: ${fields.join(', ')}.`
  );
}

function assertRecord(value, label) {
  assert(
    value && typeof value === 'object' && !Array.isArray(value),
    `${label} must be an object.`
  );
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
