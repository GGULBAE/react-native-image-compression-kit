import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEPENDENCY_SECURITY_CHECK_FIELDS,
  DEPENDENCY_SECURITY_REPORT_FIELDS,
  ESBUILD_MINIMUM_SAFE_VERSION,
  OPENTELEMETRY_CORE_MINIMUM_SAFE_VERSION,
  PNPM_REVIEWED_VERSION,
  SENTRY_NODE_REVIEWED_VERSION,
  SHELL_QUOTE_MINIMUM_SAFE_VERSION,
  SHELL_QUOTE_REVIEWED_VERSION,
  VITE_MINIMUM_SAFE_VERSION,
  canonicalDependencySecurityReport,
  verifyDependencySecurity,
} from '../scripts/dependency-security-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERIFIER = path.join(ROOT, 'scripts', 'verify-dependency-security.mjs');

function repositoryInputs() {
  return {
    packageJson: JSON.parse(
      readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    ),
    workspaceContents: readFileSync(
      path.join(ROOT, 'pnpm-workspace.yaml'),
      'utf8'
    ),
    lockfileContents: readFileSync(path.join(ROOT, 'pnpm-lock.yaml'), 'utf8'),
  };
}

describe('dependency security gate', () => {
  it('pins the reviewed Vite backport and rejects vulnerable lock resolutions', () => {
    const report = verifyDependencySecurity(repositoryInputs());
    expect(Object.keys(report)).toEqual(DEPENDENCY_SECURITY_REPORT_FIELDS);
    expect(Object.keys(report.checks)).toEqual(
      DEPENDENCY_SECURITY_CHECK_FIELDS
    );
    expect(report).toMatchObject({
      status: 'passed',
      pnpmVersion: PNPM_REVIEWED_VERSION,
      vitepress: '1.6.4',
      viteOverride: VITE_MINIMUM_SAFE_VERSION,
      lighthouse: '13.4.0',
      sentryNodeOverride: SENTRY_NODE_REVIEWED_VERSION,
      shellQuoteOverride: SHELL_QUOTE_REVIEWED_VERSION,
      productionExposure: [],
      checks: Object.fromEntries(
        DEPENDENCY_SECURITY_CHECK_FIELDS.map((field) => [field, true])
      ),
      error: null,
    });
    expect(report.viteVersions).toContain(VITE_MINIMUM_SAFE_VERSION);
    expect(report.esbuildVersions).toContain('0.25.12');
    expect(report.opentelemetryCoreVersions).toContain('2.9.0');
    expect(report.shellQuoteVersions).toEqual([SHELL_QUOTE_REVIEWED_VERSION]);
    expect(canonicalDependencySecurityReport(report)).toBe(
      JSON.stringify(report) + '\n'
    );
  });

  it.each([
    [
      'vulnerable pnpm',
      (inputs) => {
        inputs.packageJson.packageManager = 'pnpm@11.7.0';
      },
      'Expected packageManager pnpm@' + PNPM_REVIEWED_VERSION,
    ],
    [
      'missing override',
      (inputs) => {
        inputs.workspaceContents = inputs.workspaceContents.replace(
          /^overrides:[\s\S]*$/m,
          ''
        );
      },
      'Expected pnpm override',
    ],
    [
      'missing sentry override',
      (inputs) => {
        inputs.workspaceContents = inputs.workspaceContents.replace(
          /^  "lighthouse@13\.4\.0>@sentry\/node": "10\.66\.0"\n/m,
          ''
        );
      },
      'lighthouse@13.4.0>@sentry/node',
    ],
    [
      'missing shell-quote override',
      (inputs) => {
        inputs.workspaceContents = inputs.workspaceContents.replace(
          /^  "react-devtools-core@6\.1\.5>shell-quote": "1\.10\.0"\n/m,
          ''
        );
      },
      'react-devtools-core@6.1.5>shell-quote',
    ],
    [
      'vulnerable vite',
      (inputs) => {
        inputs.lockfileContents = inputs.lockfileContents.replaceAll(
          'vite@6.4.3',
          'vite@5.4.21'
        );
      },
      'minimum is ' + VITE_MINIMUM_SAFE_VERSION,
    ],
    [
      'vulnerable esbuild',
      (inputs) => {
        inputs.lockfileContents = inputs.lockfileContents.replaceAll(
          'esbuild@0.25.12',
          'esbuild@0.21.5'
        );
      },
      'minimum is ' + ESBUILD_MINIMUM_SAFE_VERSION,
    ],
    [
      'vulnerable opentelemetry core',
      (inputs) => {
        inputs.lockfileContents = inputs.lockfileContents.replaceAll(
          '@opentelemetry/core@2.9.0',
          '@opentelemetry/core@1.30.1'
        );
      },
      'minimum is ' + OPENTELEMETRY_CORE_MINIMUM_SAFE_VERSION,
    ],
    [
      'vulnerable shell-quote',
      (inputs) => {
        inputs.lockfileContents = inputs.lockfileContents.replaceAll(
          'shell-quote@1.10.0',
          'shell-quote@1.8.4'
        );
      },
      'minimum is ' + SHELL_QUOTE_MINIMUM_SAFE_VERSION,
    ],
    [
      'production exposure',
      (inputs) => {
        inputs.packageJson.dependencies = {
          vite: VITE_MINIMUM_SAFE_VERSION,
        };
      },
      'Development tooling entered a production dependency field',
    ],
  ])('rejects %s', (_, mutate, expectedError) => {
    const inputs = repositoryInputs();
    mutate(inputs);
    const report = verifyDependencySecurity(inputs);
    expect(report.status).toBe('failed');
    expect(report.error).toContain(expectedError);
  });

  it('runs offline and emits one canonical JSON report', () => {
    const result = spawnSync(
      process.execPath,
      [VERIFIER, '--root', ROOT, '--json'],
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
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'passed',
      pnpmVersion: PNPM_REVIEWED_VERSION,
      viteOverride: VITE_MINIMUM_SAFE_VERSION,
      sentryNodeOverride: SENTRY_NODE_REVIEWED_VERSION,
      shellQuoteOverride: SHELL_QUOTE_REVIEWED_VERSION,
      productionExposure: [],
    });
  });
});
