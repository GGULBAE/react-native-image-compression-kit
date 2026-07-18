import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveExactSubjectGitHubAttestation } from '../scripts/github-attestation-transport.mjs';

const SUBJECT_BYTES = Buffer.from('{"subject":"exact"}\n');
const SUBJECT_SHA256 = createHash('sha256')
  .update(SUBJECT_BYTES)
  .digest('hex');
const BUNDLE = {
  mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
  verificationMaterial: {},
};
const SIGNED_BUNDLE_URL =
  'https://example.test/attestations/123/2026/07/17/456.json.sn' +
  '?signature=must-not-survive&token=must-not-survive';

function rawResponse(bundle = null) {
  return {
    attestations: [
      {
        repository_id: 123,
        initiator: 'must-not-survive',
        bundle_url: SIGNED_BUNDLE_URL,
        bundle,
      },
    ],
  };
}

function resolve(response, overrides = {}) {
  return resolveExactSubjectGitHubAttestation({
    repository: 'owner/repo',
    subjectSha256: SUBJECT_SHA256,
    subjectBytes: SUBJECT_BYTES,
    subjectFileName: 'artifact-manifest.json',
    requestAttestations: () => response,
    ...overrides,
  });
}

describe('exact-subject GitHub attestation transport', () => {
  it('normalizes inline and bundle URL responses through one sanitized boundary', () => {
    const inline = resolve(rawResponse(BUNDLE));
    let temporary;
    const downloaded = resolve(rawResponse(), {
      runCommand(command, args, options) {
        expect(command).toBe('gh');
        expect(args).toEqual([
          'attestation',
          'download',
          expect.any(String),
          '--repo',
          'owner/repo',
          '--limit',
          '2',
        ]);
        expect(readFileSync(args[2])).toEqual(SUBJECT_BYTES);
        temporary = options.cwd;
        writeFileSync(
          path.join(options.cwd, 'sha256-exact.jsonl'),
          `${JSON.stringify(BUNDLE)}\n`
        );
        return '';
      },
    });

    const expected = {
      attestations: [
        {
          repository_id: 123,
          attestation_id: 456,
          bundle: BUNDLE,
        },
      ],
    };
    expect(inline).toEqual(expected);
    expect(downloaded).toEqual(expected);
    expect(existsSync(temporary)).toBe(false);
    expect(JSON.stringify(inline)).not.toMatch(
      /bundle_url|signature|token|must-not-survive/
    );
  });

  it('rejects a missing subject response or exact subject bytes', () => {
    expect(() => resolve({ attestations: [] })).toThrow(
      'Expected at least one GitHub attestation'
    );
    let requested = false;
    expect(() =>
      resolve(rawResponse(BUNDLE), {
        subjectBytes: undefined,
        requestAttestations() {
          requested = true;
          return rawResponse(BUNDLE);
        },
      })
    ).toThrow('requires exact subject bytes');
    expect(requested).toBe(false);
    expect(() =>
      resolve(rawResponse(BUNDLE), { subjectBytes: Buffer.from('other') })
    ).toThrow('do not match the requested SHA-256');
  });

  it('sanitizes multiple inline attestations for downstream exact-bundle selection', () => {
    const response = rawResponse(BUNDLE);
    response.attestations.push({
      ...response.attestations[0],
      bundle_url: SIGNED_BUNDLE_URL.replace('/456.', '/457.'),
      bundle: { ...BUNDLE, mediaType: 'application/vnd.example.release+json' },
    });

    expect(resolve(response)).toEqual({
      attestations: [
        { repository_id: 123, attestation_id: 456, bundle: BUNDLE },
        {
          repository_id: 123,
          attestation_id: 457,
          bundle: { ...BUNDLE, mediaType: 'application/vnd.example.release+json' },
        },
      ],
    });
  });

  it('rejects multiple URL-only attestations before running a download command', () => {
    const response = rawResponse();
    response.attestations.push({
      ...response.attestations[0],
      bundle_url: SIGNED_BUNDLE_URL.replace('/456.', '/457.'),
    });
    let ran = false;

    expect(() =>
      resolve(response, {
        runCommand() {
          ran = true;
        },
      })
    ).toThrow('Cannot resolve multiple URL-only GitHub attestations');
    expect(ran).toBe(false);
  });

  it('rejects multiple downloaded JSONL files and removes the temporary directory', () => {
    let temporary;
    expect(() =>
      resolve(rawResponse(), {
        runCommand(_command, _args, options) {
          temporary = options.cwd;
          writeFileSync(path.join(options.cwd, 'first.jsonl'), '{}\n');
          writeFileSync(path.join(options.cwd, 'second.jsonl'), '{}\n');
          return '';
        },
      })
    ).toThrow('exactly one downloaded GitHub attestation JSONL');
    expect(existsSync(temporary)).toBe(false);
  });

  it('rejects multiple JSONL records and removes the temporary directory', () => {
    let temporary;
    expect(() =>
      resolve(rawResponse(), {
        runCommand(_command, _args, options) {
          temporary = options.cwd;
          writeFileSync(path.join(options.cwd, 'bundle.jsonl'), '{}\n{}\n');
          return '';
        },
      })
    ).toThrow('exactly one downloaded GitHub attestation bundle');
    expect(existsSync(temporary)).toBe(false);
  });

  it('rejects invalid downloaded JSON and removes the temporary directory', () => {
    let temporary;
    expect(() =>
      resolve(rawResponse(), {
        runCommand(_command, _args, options) {
          temporary = options.cwd;
          writeFileSync(path.join(options.cwd, 'bundle.jsonl'), '{invalid}\n');
          return '';
        },
      })
    ).toThrow('not valid JSON');
    expect(existsSync(temporary)).toBe(false);
  });

  it('propagates command failure and removes exact subject bytes', () => {
    let temporary;
    expect(() =>
      resolve(rawResponse(), {
        runCommand(_command, args, options) {
          temporary = options.cwd;
          expect(readFileSync(args[2])).toEqual(SUBJECT_BYTES);
          throw new Error('simulated gh failure');
        },
      })
    ).toThrow('simulated gh failure');
    expect(existsSync(temporary)).toBe(false);
  });
});
