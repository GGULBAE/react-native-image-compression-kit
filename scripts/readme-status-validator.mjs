import {
  inspectStatusContract,
  parseCurrentStatus,
  RELEASE_STATE_MATRIX,
  STATUS_END,
  STATUS_START,
} from './docs-semantic-core.mjs';

const LEGACY_CANDIDATE_PATTERNS = [
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
  { version, manifest, requireStatusBlock = false, forbiddenSnippets = [] } = {}
) {
  const hasStatusMarker =
    readmeContents.includes(STATUS_START) || readmeContents.includes(STATUS_END);

  if (!hasStatusMarker && !requireStatusBlock) {
    const legacySnippets = version
      ? LEGACY_CANDIDATE_PATTERNS.map((pattern) => pattern(version))
      : [];
    return [...new Set([...forbiddenSnippets, ...legacySnippets])].filter(
      (snippet) => readmeContents.includes(snippet)
    );
  }

  let status;

  if (manifest) {
    const report = inspectStatusContract({
      packageVersion: version,
      manifest,
      documents: [{ documentName: 'README', contents: readmeContents }],
    });
    if (!report.ok) {
      return report.errors;
    }
    status = report.status;
  } else {
    try {
      status = parseCurrentStatus(readmeContents);
    } catch (error) {
      return [error instanceof Error ? error.message : String(error)];
    }
  }

  if (version && status.packageVersion !== version) {
    return [
      `current status package version ${status.packageVersion} does not match ${version}`,
    ];
  }

  if (!RELEASE_STATE_MATRIX[status.releaseState].publishable) {
    return [
      `current status declares package version ${status.packageVersion} as candidate`,
    ];
  }

  return forbiddenSnippets.filter((snippet) => readmeContents.includes(snippet));
}

export function validateReadmeStatus(readmeContents, options = {}) {
  const violations = getReadmeStatusViolations(readmeContents, options);

  if (violations.length > 0) {
    const hasStatusMarker =
      readmeContents.includes(STATUS_START) || readmeContents.includes(STATUS_END);
    throw new Error(
      `${hasStatusMarker || options.requireStatusBlock
        ? 'README current status is not publishable'
        : 'README contains stale package status snippets'}: ${violations.join(' | ')}`
    );
  }

  return 'passed';
}
