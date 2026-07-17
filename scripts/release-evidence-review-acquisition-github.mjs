import { spawnSync } from 'node:child_process';
import { extractArtifactZip } from './artifact-zip-core.mjs';
import { resolveExactSubjectGitHubAttestation } from './github-attestation-transport.mjs';

const MAX_GITHUB_RESPONSE_BYTES = 128 * 1024 * 1024;

export function createReleaseEvidenceReviewGitHubClient(dependencies = {}) {
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
      return resolveExactSubjectGitHubAttestation({
        repository,
        subjectSha256,
        subjectBytes,
        subjectFileName: 'artifact-manifest.json',
        requestAttestations: () =>
          requestJson(
            ['api', `repos/${repository}/attestations/sha256:${subjectSha256}`],
            'GitHub attestations',
            run
          ),
        runCommand: run,
      });
    },
    downloadArtifact({ repository, artifactId }) {
      const zipBytes = run(
        'gh',
        ['api', `repos/${repository}/actions/artifacts/${artifactId}/zip`],
        { encoding: null }
      );
      return { zipBytes, files: extractArtifactZip(zipBytes) };
    },
  };
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

function requestJson(args, label, run) {
  const stdout = run('gh', args, { encoding: 'utf8' });
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} response is not valid JSON: ${error.message}`);
  }
}
