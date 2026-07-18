import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/;

export function resolveExactSubjectGitHubAttestation({
  repository,
  subjectSha256,
  subjectBytes,
  subjectFileName,
  requestAttestations,
  runCommand,
}) {
  assert(
    typeof repository === 'string' && /^[^/\s]+\/[^/\s]+$/.test(repository),
    'GitHub attestation repository must be an explicit owner/repository.'
  );
  assert(
    typeof subjectSha256 === 'string' && SHA256.test(subjectSha256),
    'GitHub attestation subject SHA-256 must be 64 lowercase hexadecimal characters.'
  );
  assert(
    Buffer.isBuffer(subjectBytes),
    'GitHub attestation resolution requires exact subject bytes.'
  );
  assert(
    createHash('sha256').update(subjectBytes).digest('hex') === subjectSha256,
    'GitHub attestation subject bytes do not match the requested SHA-256.'
  );
  assert(
    typeof subjectFileName === 'string' &&
      subjectFileName.length > 0 &&
      path.basename(subjectFileName) === subjectFileName &&
      !subjectFileName.endsWith('.jsonl'),
    'GitHub attestation subject filename must be one safe non-JSONL basename.'
  );
  assert(
    typeof requestAttestations === 'function',
    'GitHub attestation resolution requires an API request function.'
  );

  const response = requestAttestations();
  assertRecord(response, 'GitHub attestations response');
  assert(
    Array.isArray(response.attestations),
    'GitHub attestations must be an array.'
  );
  assert(
    response.attestations.length > 0,
    `Expected at least one GitHub attestation for sha256:${subjectSha256}.`
  );

  const urlOnly = response.attestations.filter(
    (attestation) => attestation?.bundle === null
  );
  assert(
    response.attestations.length === 1 || urlOnly.length === 0,
    `Cannot resolve multiple URL-only GitHub attestations for sha256:${subjectSha256}.`
  );

  return {
    attestations: response.attestations.map((attestation, index) => {
      assertRecord(attestation, `GitHub attestation ${index + 1}`);
      assert(
        Number.isSafeInteger(attestation.repository_id) &&
          attestation.repository_id > 0,
        'GitHub attestation repository ID must be a positive integer.'
      );
      return {
        repository_id: attestation.repository_id,
        attestation_id: attestationIdFromBundleUrl(attestation.bundle_url),
        bundle:
          attestation.bundle === null
            ? downloadExactSubjectBundle({
                repository,
                subjectSha256,
                subjectBytes,
                subjectFileName,
                runCommand,
              })
            : normalizeBundle(
                attestation.bundle,
                `Inline GitHub attestation bundle ${index + 1}`
              ),
      };
    }),
  };
}

function downloadExactSubjectBundle({
  repository,
  subjectSha256,
  subjectBytes,
  subjectFileName,
  runCommand,
}) {
  assert(
    typeof runCommand === 'function',
    'GitHub attestation bundle download requires a command runner.'
  );
  const temporary = mkdtempSync(
    path.join(os.tmpdir(), 'rnick-github-attestation-')
  );
  const subject = path.join(temporary, subjectFileName);

  try {
    writeFileSync(subject, subjectBytes, { flag: 'wx' });
    runCommand(
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
    const jsonlEntries = readdirSync(temporary, { withFileTypes: true }).filter(
      (entry) => entry.name.endsWith('.jsonl')
    );
    assert(
      jsonlEntries.length === 1 && jsonlEntries[0].isFile(),
      `Expected exactly one downloaded GitHub attestation JSONL for sha256:${subjectSha256}.`
    );
    const lines = readFileSync(
      path.join(temporary, jsonlEntries[0].name),
      'utf8'
    )
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    assert(
      lines.length === 1,
      `Expected exactly one downloaded GitHub attestation bundle for sha256:${subjectSha256}.`
    );
    let parsed;
    try {
      parsed = JSON.parse(lines[0]);
    } catch (error) {
      throw new Error(
        `Downloaded GitHub attestation bundle is not valid JSON: ${error.message}`
      );
    }
    return normalizeBundle(parsed, 'Downloaded GitHub attestation bundle');
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function normalizeBundle(bundle, label) {
  assertRecord(bundle, label);
  let normalized;
  try {
    normalized = JSON.parse(JSON.stringify(bundle));
  } catch (error) {
    throw new Error(`${label} is not JSON-safe: ${error.message}`);
  }
  assert(
    isDeepStrictEqual(bundle, normalized),
    `${label} must contain only JSON values.`
  );
  return normalized;
}

function attestationIdFromBundleUrl(bundleUrl) {
  assert(
    typeof bundleUrl === 'string',
    'GitHub attestation bundle URL is missing.'
  );
  let parsed;
  try {
    parsed = new URL(bundleUrl);
  } catch {
    throw new Error('GitHub attestation bundle URL is invalid.');
  }
  assert(
    parsed.protocol === 'https:',
    'GitHub attestation bundle URL must use HTTPS.'
  );
  const match = parsed.pathname.match(
    /^\/attestations\/\d+\/\d{4}\/\d{2}\/\d{2}\/(\d+)\.json\.sn$/
  );
  assert(
    match,
    'GitHub attestation bundle URL does not contain an attestation ID.'
  );
  const id = Number(match[1]);
  assert(
    Number.isSafeInteger(id) && id > 0,
    'GitHub attestation ID must be a positive integer.'
  );
  return id;
}

function assertRecord(value, label) {
  assert(
    value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !Buffer.isBuffer(value),
    `${label} must be an object.`
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
