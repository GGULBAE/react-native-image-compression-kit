import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import {
  GITHUB_ACTIONS_OIDC_ISSUER,
  SLSA_PROVENANCE_V1,
} from './registry-attestation-core.mjs';

const BLOCKED_PROXY = 'http://127.0.0.1:9';

export function buildOfflineGitHubAttestationVerifyArgs({
  subjectPath,
  attestationBundle,
  trustedRoot,
  expectedRepository,
  expectedWorkflow,
  expectedRef,
  expectedHeadSha,
}) {
  return [
    'attestation',
    'verify',
    path.resolve(subjectPath),
    '--bundle',
    path.resolve(attestationBundle),
    '--custom-trusted-root',
    path.resolve(trustedRoot),
    '--repo',
    expectedRepository,
    '--signer-workflow',
    expectedWorkflow,
    '--source-ref',
    expectedRef,
    '--source-digest',
    expectedHeadSha,
    '--cert-oidc-issuer',
    GITHUB_ACTIONS_OIDC_ISSUER,
    '--predicate-type',
    SLSA_PROVENANCE_V1,
    '--deny-self-hosted-runners',
    '--format',
    'json',
  ];
}

export function runOfflineGitHubAttestationVerify(args) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      HTTP_PROXY: BLOCKED_PROXY,
      HTTPS_PROXY: BLOCKED_PROXY,
      ALL_PROXY: BLOCKED_PROXY,
      NO_PROXY: '',
      GH_PROMPT_DISABLED: '1',
      GH_NO_UPDATE_NOTIFIER: '1',
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `gh attestation verify failed (${result.status ?? 1}): ${(
        result.stderr || result.stdout || ''
      ).trim()}`
    );
  }
  return result.stdout;
}

export function readSecureRegularFile(filePath, label) {
  const stats = lstatSync(filePath);
  if (stats.isSymbolicLink()) {
    throw new Error(`${label} must not be a symbolic link.`);
  }
  if (!stats.isFile()) {
    throw new Error(`${label} must be a regular file.`);
  }
  return readFileSync(realpathSync(filePath));
}
