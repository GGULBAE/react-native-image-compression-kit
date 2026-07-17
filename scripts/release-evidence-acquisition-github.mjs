import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateArtifactArchiveFileNames } from './release-evidence-acquisition-core.mjs';

const MAX_GITHUB_RESPONSE_BYTES = 128 * 1024 * 1024;

export function createReleaseEvidenceGitHubClient(dependencies = {}) {
  const run = dependencies.runCommand ?? runCommand;
  return {
    getRun({ repository, runId }) {
      return requestJson(
        ['api', `repos/${repository}/actions/runs/${runId}`],
        'GitHub workflow run',
        run
      );
    },
    listArtifacts({ repository, runId }) {
      return requestJson(
        ['api', `repos/${repository}/actions/runs/${runId}/artifacts`],
        'GitHub workflow artifacts',
        run
      );
    },
    getAttestations({ repository, subjectSha256, subjectBytes }) {
      const response = requestJson(
        [
          'api',
          `repos/${repository}/attestations/sha256:${subjectSha256}`,
        ],
        'GitHub attestations',
        run
      );
      return hydrateBundleUrlAttestation(
        response,
        { repository, subjectSha256, subjectBytes },
        run
      );
    },
    downloadArtifact({ repository, artifactId, expectedFiles }) {
      const zipBytes = run(
        'gh',
        [
          'api',
          `repos/${repository}/actions/artifacts/${artifactId}/zip`,
        ],
        { encoding: null }
      );
      return {
        zipBytes,
        files: extractArtifactArchive(zipBytes, expectedFiles, {
          runCommand: run,
        }),
      };
    },
  };
}

export function extractArtifactArchive(
  zipBytes,
  expectedFiles,
  dependencies = {}
) {
  assert(Buffer.isBuffer(zipBytes), 'Artifact ZIP must be bytes.');
  const run = dependencies.runCommand ?? runCommand;
  const temporary = mkdtempSync(
    path.join(os.tmpdir(), 'rnick-release-evidence-artifact-')
  );
  const zipPath = path.join(temporary, 'artifact.zip');

  try {
    writeFileSync(zipPath, zipBytes, { flag: 'wx' });
    const listing = run('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
    const actualFiles = listing.endsWith('\n')
      ? listing.slice(0, -1).split('\n')
      : listing.split('\n');
    validateArtifactArchiveFileNames(actualFiles, expectedFiles);
    return new Map(
      expectedFiles.map((file) => [
        file,
        run('unzip', ['-p', zipPath, file], { encoding: null }),
      ])
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

export function runCommand(
  command,
  args,
  { encoding = 'utf8', cwd } = {}
) {
  const result = spawnSync(command, args, {
    encoding,
    cwd,
    env: {
      ...process.env,
      GH_PROMPT_DISABLED: '1',
      GH_NO_UPDATE_NOTIFIER: '1',
    },
    maxBuffer: MAX_GITHUB_RESPONSE_BYTES,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8')
      : result.stderr;
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status}): ${stderr.trim()}`
    );
  }
  return result.stdout;
}

function hydrateBundleUrlAttestation(
  response,
  { repository, subjectSha256, subjectBytes },
  run
) {
  if (
    !Array.isArray(response?.attestations) ||
    response.attestations.every((attestation) => attestation?.bundle != null)
  ) {
    return response;
  }
  assert(
    response.attestations.length === 1 &&
      response.attestations[0]?.bundle === null &&
      typeof response.attestations[0]?.bundle_url === 'string',
    'GitHub bundle URL fallback requires exactly one bundle-less attestation.'
  );
  assert(
    Buffer.isBuffer(subjectBytes),
    'GitHub bundle URL fallback requires exact subject bytes.'
  );

  const temporary = mkdtempSync(
    path.join(os.tmpdir(), 'rnick-release-evidence-attestation-')
  );
  const subject = path.join(temporary, 'bundle-manifest.json');
  try {
    writeFileSync(subject, subjectBytes, { flag: 'wx' });
    run(
      'gh',
      [
        'attestation',
        'download',
        subject,
        '--repo',
        repository,
        '--limit',
        '2',
      ],
      { encoding: 'utf8', cwd: temporary }
    );
    const bundles = readdirSync(temporary).filter((file) =>
      file.endsWith('.jsonl')
    );
    assert(
      bundles.length === 1,
      `Expected exactly one downloaded GitHub attestation file for sha256:${subjectSha256}.`
    );
    const lines = readFileSync(path.join(temporary, bundles[0]), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean);
    assert(
      lines.length === 1,
      `Expected exactly one downloaded GitHub attestation bundle for sha256:${subjectSha256}.`
    );
    let bundle;
    try {
      bundle = JSON.parse(lines[0]);
    } catch (error) {
      throw new Error(
        `Downloaded GitHub attestation bundle is not valid JSON: ${error.message}`
      );
    }
    return {
      ...response,
      attestations: [{ ...response.attestations[0], bundle }],
    };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function requestJson(args, label, run) {
  const stdout = run('gh', args, { encoding: 'utf8' });
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} response is not valid JSON: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
