const VERSION_STATUS_PATTERNS = [
  (version) => `Status: v${version} candidate`,
  (version) => `v${version}%20candidate`,
  (version) => `Version \`${version}\` is an unpublished`,
  (version) => `The \`${version}\` package metadata is prepared as an unpublished`,
  (version) => `No npm publish, git tag, or GitHub Release is part of the v${version} candidate`,
  (version) => `v${version} no-publish`,
  (version) => `v${version}%20no--publish`,
];

export function getReadmeStatusViolations(
  readmeContents,
  { version, forbiddenSnippets = [] } = {}
) {
  const versionSnippets = version
    ? VERSION_STATUS_PATTERNS.map((pattern) => pattern(version))
    : [];

  return [...new Set([...forbiddenSnippets, ...versionSnippets])].filter(
    (snippet) => readmeContents.includes(snippet)
  );
}

export function validateReadmeStatus(readmeContents, options = {}) {
  const violations = getReadmeStatusViolations(readmeContents, options);

  if (violations.length > 0) {
    throw new Error(
      `README contains stale package status snippets: ${violations.join(' | ')}`
    );
  }

  return 'passed';
}
