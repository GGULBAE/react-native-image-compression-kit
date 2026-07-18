const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function inspectReleaseSource({
  expectedSourceSha,
  checkedOutSha,
  masterSha,
  requiredChecks,
  checkRuns,
}) {
  const errors = [];
  if (!SHA_PATTERN.test(expectedSourceSha ?? '')) {
    errors.push('expected source SHA must be a lowercase full commit SHA');
  }
  if (checkedOutSha !== expectedSourceSha) {
    errors.push('checked-out source does not match the expected SHA');
  }
  if (masterSha !== expectedSourceSha) {
    errors.push('expected source is not the current protected master HEAD');
  }
  if (!Array.isArray(requiredChecks) || requiredChecks.length === 0) {
    errors.push('required source checks are missing');
  }
  if (!Array.isArray(checkRuns)) {
    errors.push('GitHub check runs must be an array');
  } else {
    for (const required of requiredChecks ?? []) {
      const matches = checkRuns.filter(({ name }) => name === required);
      if (matches.length === 0) {
        errors.push(`required check is missing: ${required}`);
      } else if (
        !matches.some(({ status, conclusion }) => status === 'completed' && conclusion === 'success')
      ) {
        errors.push(`required check is not successful: ${required}`);
      }
    }
  }

  return {
    schemaVersion: 1,
    status: errors.length === 0 ? 'passed' : 'failed',
    sourceSha: expectedSourceSha ?? null,
    masterSha: masterSha ?? null,
    requiredChecks: requiredChecks ?? [],
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}
