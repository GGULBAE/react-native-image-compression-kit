import { describe, expect, it } from 'vitest';
import { inspectReleaseSource } from '../scripts/release-source-core.mjs';

const sha = 'a'.repeat(40);
const requiredChecks = ['CI', 'Android', 'iOS'];
const checkRuns = requiredChecks.map((name) => ({
  name,
  status: 'completed',
  conclusion: 'success',
}));

describe('trusted release source', () => {
  it('accepts the exact protected master SHA with every required check green', () => {
    expect(
      inspectReleaseSource({
        expectedSourceSha: sha,
        checkedOutSha: sha,
        masterSha: sha,
        requiredChecks,
        checkRuns,
      })
    ).toMatchObject({ status: 'passed', error: null });
  });

  it.each([
    ['stale master', { masterSha: 'b'.repeat(40) }, 'current protected master HEAD'],
    ['wrong checkout', { checkedOutSha: 'b'.repeat(40) }, 'checked-out source'],
    ['missing check', { checkRuns: checkRuns.slice(1) }, 'required check is missing: CI'],
    [
      'failed check',
      { checkRuns: [{ name: 'CI', status: 'completed', conclusion: 'failure' }, ...checkRuns.slice(1)] },
      'required check is not successful: CI',
    ],
  ])('rejects %s', (_label, mutation, expectedError) => {
    const report = inspectReleaseSource({
      expectedSourceSha: sha,
      checkedOutSha: sha,
      masterSha: sha,
      requiredChecks,
      checkRuns,
      ...mutation,
    });
    expect(report.status).toBe('failed');
    expect(report.error).toContain(expectedError);
  });
});
