import { readFileSync } from 'node:fs';
import path from 'node:path';

export const DEPENDENCY_SECURITY_SCHEMA_VERSION = 2;
export const PNPM_REVIEWED_VERSION = '11.8.0';
export const VITE_MINIMUM_SAFE_VERSION = '6.4.3';
export const ESBUILD_MINIMUM_SAFE_VERSION = '0.25.0';
export const OPENTELEMETRY_CORE_MINIMUM_SAFE_VERSION = '2.8.0';
export const SENTRY_NODE_REVIEWED_VERSION = '10.66.0';
export const SHELL_QUOTE_MINIMUM_SAFE_VERSION = '1.9.0';
export const SHELL_QUOTE_REVIEWED_VERSION = '1.10.0';
export const VITEPRESS_OVERRIDE_SELECTOR = 'vitepress@1.6.4>vite';
export const SENTRY_NODE_OVERRIDE_SELECTOR =
  'lighthouse@13.4.0>@sentry/node';
export const SHELL_QUOTE_OVERRIDE_SELECTOR =
  'react-devtools-core@6.1.5>shell-quote';

export const DEPENDENCY_SECURITY_CHECK_FIELDS = Object.freeze([
  'manifest',
  'override',
  'lockfile',
  'ranges',
  'production',
]);

export const DEPENDENCY_SECURITY_REPORT_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'package',
  'pnpmVersion',
  'vitepress',
  'viteOverride',
  'lighthouse',
  'sentryNodeOverride',
  'shellQuoteOverride',
  'viteVersions',
  'esbuildVersions',
  'opentelemetryCoreVersions',
  'shellQuoteVersions',
  'productionExposure',
  'checks',
  'error',
]);

const PRODUCTION_DEPENDENCY_FIELDS = Object.freeze([
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
]);

const TOOLING_PACKAGES = new Set([
  'vite',
  'vitepress',
  'esbuild',
  'lighthouse',
  '@sentry/node',
  '@opentelemetry/core',
  'react-devtools-core',
  'shell-quote',
]);

export function verifyDependencySecurity(
  { packageJson, workspaceContents, lockfileContents } = {}
) {
  const state = {
    package: null,
    pnpmVersion: null,
    vitepress: null,
    viteOverride: null,
    lighthouse: null,
    sentryNodeOverride: null,
    shellQuoteOverride: null,
    viteVersions: [],
    esbuildVersions: [],
    opentelemetryCoreVersions: [],
    shellQuoteVersions: [],
    productionExposure: [],
    checks: {},
  };

  try {
    assertObject(packageJson, 'package.json');
    assert(
      typeof workspaceContents === 'string',
      'pnpm-workspace.yaml must be text.'
    );
    assert(typeof lockfileContents === 'string', 'pnpm-lock.yaml must be text.');

    assert(
      typeof packageJson.name === 'string' && packageJson.name.length > 0,
      'package.json name is required.'
    );
    state.package = packageJson.name;
    const packageManagerMatch = String(packageJson.packageManager ?? '').match(
      /^pnpm@(.+)$/
    );
    state.pnpmVersion = packageManagerMatch?.[1] ?? null;
    assert(
      state.pnpmVersion === PNPM_REVIEWED_VERSION,
      'Expected packageManager pnpm@' +
        PNPM_REVIEWED_VERSION +
        ', received ' +
        describe(packageJson.packageManager ?? null) +
        '.'
    );
    state.vitepress = packageJson.devDependencies?.vitepress ?? null;
    assert(
      state.vitepress === '1.6.4',
      'Expected vitepress 1.6.4, received ' + describe(state.vitepress) + '.'
    );
    state.lighthouse = packageJson.devDependencies?.lighthouse ?? null;
    assert(
      state.lighthouse === '13.4.0',
      'Expected lighthouse 13.4.0, received ' +
        describe(state.lighthouse) +
        '.'
    );
    state.checks.manifest = true;

    state.viteOverride = readWorkspaceOverride(
      workspaceContents,
      VITEPRESS_OVERRIDE_SELECTOR
    );
    assert(
      state.viteOverride === VITE_MINIMUM_SAFE_VERSION,
      'Expected pnpm override ' +
        VITEPRESS_OVERRIDE_SELECTOR +
        '=' +
        VITE_MINIMUM_SAFE_VERSION +
        ', received ' +
        describe(state.viteOverride) +
        '.'
    );
    state.sentryNodeOverride = readWorkspaceOverride(
      workspaceContents,
      SENTRY_NODE_OVERRIDE_SELECTOR
    );
    assert(
      state.sentryNodeOverride === SENTRY_NODE_REVIEWED_VERSION,
      'Expected pnpm override ' +
        SENTRY_NODE_OVERRIDE_SELECTOR +
        '=' +
        SENTRY_NODE_REVIEWED_VERSION +
        ', received ' +
        describe(state.sentryNodeOverride) +
        '.'
    );
    state.shellQuoteOverride = readWorkspaceOverride(
      workspaceContents,
      SHELL_QUOTE_OVERRIDE_SELECTOR
    );
    assert(
      state.shellQuoteOverride === SHELL_QUOTE_REVIEWED_VERSION,
      'Expected pnpm override ' +
        SHELL_QUOTE_OVERRIDE_SELECTOR +
        '=' +
        SHELL_QUOTE_REVIEWED_VERSION +
        ', received ' +
        describe(state.shellQuoteOverride) +
        '.'
    );
    state.checks.override = true;

    state.viteVersions = extractLockedVersions(lockfileContents, 'vite');
    state.esbuildVersions = extractLockedVersions(lockfileContents, 'esbuild');
    state.opentelemetryCoreVersions = extractLockedVersions(
      lockfileContents,
      '@opentelemetry/core'
    );
    state.shellQuoteVersions = extractLockedVersions(
      lockfileContents,
      'shell-quote'
    );
    assert(state.viteVersions.length > 0, 'pnpm-lock.yaml does not resolve vite.');
    assert(
      state.esbuildVersions.length > 0,
      'pnpm-lock.yaml does not resolve esbuild.'
    );
    assert(
      state.opentelemetryCoreVersions.length > 0,
      'pnpm-lock.yaml does not resolve @opentelemetry/core.'
    );
    assert(
      state.shellQuoteVersions.length > 0,
      'pnpm-lock.yaml does not resolve shell-quote.'
    );
    state.checks.lockfile = true;

    assertMinimumVersions(
      'vite',
      state.viteVersions,
      VITE_MINIMUM_SAFE_VERSION
    );
    assertMinimumVersions(
      'esbuild',
      state.esbuildVersions,
      ESBUILD_MINIMUM_SAFE_VERSION
    );
    assertMinimumVersions(
      '@opentelemetry/core',
      state.opentelemetryCoreVersions,
      OPENTELEMETRY_CORE_MINIMUM_SAFE_VERSION
    );
    assertMinimumVersions(
      'shell-quote',
      state.shellQuoteVersions,
      SHELL_QUOTE_MINIMUM_SAFE_VERSION
    );
    assert(
      state.viteVersions.includes(VITE_MINIMUM_SAFE_VERSION),
      'pnpm-lock.yaml must resolve the reviewed Vite override ' +
        VITE_MINIMUM_SAFE_VERSION +
        '.'
    );
    assert(
      state.shellQuoteVersions.includes(SHELL_QUOTE_REVIEWED_VERSION),
      'pnpm-lock.yaml must resolve the reviewed shell-quote override ' +
        SHELL_QUOTE_REVIEWED_VERSION +
        '.'
    );
    state.checks.ranges = true;

    state.productionExposure = findProductionExposure(packageJson);
    assert(
      state.productionExposure.length === 0,
      'Development tooling entered a production dependency field: ' +
        state.productionExposure.join(', ') +
        '.'
    );
    state.checks.production = true;

    return createDependencySecurityReport({
      ...state,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    return createDependencySecurityReport({
      ...state,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function createDependencySecurityReport({
  package: packageName = null,
  pnpmVersion = null,
  vitepress = null,
  viteOverride = null,
  lighthouse = null,
  sentryNodeOverride = null,
  shellQuoteOverride = null,
  viteVersions = [],
  esbuildVersions = [],
  opentelemetryCoreVersions = [],
  shellQuoteVersions = [],
  productionExposure = [],
  checks = {},
  status = 'failed',
  error = null,
} = {}) {
  return {
    schemaVersion: DEPENDENCY_SECURITY_SCHEMA_VERSION,
    status,
    package: packageName,
    pnpmVersion,
    vitepress,
    viteOverride,
    lighthouse,
    sentryNodeOverride,
    shellQuoteOverride,
    viteVersions: [...viteVersions],
    esbuildVersions: [...esbuildVersions],
    opentelemetryCoreVersions: [...opentelemetryCoreVersions],
    shellQuoteVersions: [...shellQuoteVersions],
    productionExposure: [...productionExposure],
    checks: Object.fromEntries(
      DEPENDENCY_SECURITY_CHECK_FIELDS.map((field) => [
        field,
        checks[field] === true,
      ])
    ),
    error,
  };
}

export function canonicalDependencySecurityReport(report) {
  return JSON.stringify(report) + '\n';
}

export function readDependencySecurityInputs(rootDir) {
  const root = path.resolve(rootDir);
  return {
    packageJson: JSON.parse(
      readFileSync(path.join(root, 'package.json'), 'utf8')
    ),
    workspaceContents: readFileSync(
      path.join(root, 'pnpm-workspace.yaml'),
      'utf8'
    ),
    lockfileContents: readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8'),
  };
}

export function extractLockedVersions(lockfileContents, packageName) {
  assert(typeof lockfileContents === 'string', 'Lockfile contents must be text.');
  assert(
    typeof packageName === 'string' && packageName.length > 0,
    'Package name is required.'
  );
  const escaped = escapeRegExp(packageName);
  const pattern = new RegExp(
    '^  ["\']?' +
      escaped +
      '@([^:\\s("\']+)(?:\\([^:]*\\))?["\']?:\\s*$',
    'gm'
  );
  return [
    ...new Set(
      [...lockfileContents.matchAll(pattern)].map((match) => match[1])
    ),
  ].sort(compareVersionText);
}

export function compareSemver(left, right) {
  const leftVersion = parseSemver(left);
  const rightVersion = parseSemver(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = leftVersion.core[index] - rightVersion.core[index];
    if (difference !== 0) return difference;
  }
  if (leftVersion.prerelease === rightVersion.prerelease) return 0;
  if (leftVersion.prerelease === null) return 1;
  if (rightVersion.prerelease === null) return -1;
  return leftVersion.prerelease.localeCompare(rightVersion.prerelease);
}

function readWorkspaceOverride(contents, selector) {
  const escaped = escapeRegExp(selector);
  const matches = [
    ...contents.matchAll(
      new RegExp(
        "^  [\"']?" +
          escaped +
          "[\"']?:\\s*[\"']?([^\"'\\s#]+)[\"']?\\s*$",
        'gm'
      )
    ),
  ];
  assert(
    matches.length <= 1,
    'pnpm-workspace.yaml contains duplicate ' + selector + ' overrides.'
  );
  return matches[0]?.[1] ?? null;
}

function assertMinimumVersions(packageName, versions, minimum) {
  const vulnerable = versions.filter(
    (version) => compareSemver(version, minimum) < 0
  );
  assert(
    vulnerable.length === 0,
    packageName +
      ' resolves vulnerable version(s) ' +
      vulnerable.join(', ') +
      '; minimum is ' +
      minimum +
      '.'
  );
}

function findProductionExposure(packageJson) {
  const exposure = [];
  for (const field of PRODUCTION_DEPENDENCY_FIELDS) {
    const dependencies = packageJson[field];
    if (!dependencies || typeof dependencies !== 'object') continue;
    for (const packageName of Object.keys(dependencies)) {
      if (TOOLING_PACKAGES.has(packageName)) {
        exposure.push(field + '.' + packageName);
      }
    }
  }
  return exposure.sort();
}

function parseSemver(version) {
  const match = String(version).match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/
  );
  assert(match, 'Expected semantic version, received ' + describe(version) + '.');
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? null,
  };
}

function compareVersionText(left, right) {
  return compareSemver(left, right);
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');
}

function assertObject(value, label) {
  assert(
    value && typeof value === 'object' && !Array.isArray(value),
    label + ' must be an object.'
  );
}

function describe(value) {
  return value === null ? 'null' : JSON.stringify(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
