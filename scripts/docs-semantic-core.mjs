import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';

export const STATUS_START = '<!-- package-status:start -->';
export const STATUS_END = '<!-- package-status:end -->';
export const RELEASE_STATUS_START = '<!-- release-status:start -->';
export const RELEASE_STATUS_END = '<!-- release-status:end -->';
export const RELEASE_STATUS_MANIFEST_PATH = 'docs/release-status.json';
export const RELEASE_STATE_MATRIX = Object.freeze({
  candidate: Object.freeze({ publishable: false }),
  release: Object.freeze({ publishable: true }),
});

const STATUS_FIELDS = [
  ['packageVersion', 'Package version'],
  ['npmLatest', 'npm latest'],
  ['releaseState', 'Release state'],
  ['registryCheckedAt', 'Registry checked at'],
];

export const REQUIRED_DOCUMENTATION_FILES = [
  'README.md',
  'RELEASE.md',
  'SECURITY.md',
  RELEASE_STATUS_MANIFEST_PATH,
  'docs/release-evidence/README.md',
  'docs/release-evidence/registry-provenance.md',
  'docs/release-evidence/policy-review.md',
  'docs/release-evidence/review-archive.md',
  'docs/release-evidence/acquisition.md',
  'docs/supply-chain/action-pins.md',
  'docs/releases/0.2-history.md',
  'docs/legacy/README-v0.2.61.md',
  'docs/legacy/SECURITY-v0.2.61.md',
];

const README_HEADINGS = [
  'Current status',
  'Installation',
  'Quick start',
  'Public API',
  'Compression examples',
  'Platform capabilities and limitations',
  'Development verification',
  'Repository documentation',
  'Security',
  'License',
];

const README_COMMANDS = [
  'npm install react-native-image-compression-kit',
  'pnpm verify',
  'pnpm example:typecheck',
  'pnpm docs:check',
  'git diff --check',
  'pnpm pack --dry-run',
  'pnpm release:dry-run',
];

const README_LINKS = [
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/README.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/registry-provenance.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/policy-review.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/review-archive.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/acquisition.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/supply-chain/action-pins.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-status.json',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/RELEASE.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/releases/0.2-history.md',
  'SECURITY.md',
];

const FORBIDDEN_PACKAGE_PREFIXES = [
  'docs',
  'evidence',
  'scripts',
  'test',
  'tests',
];

export function extractStatusBlock(
  contents,
  {
    documentName = 'README',
    startMarker = STATUS_START,
    endMarker = STATUS_END,
    markerName = 'package-status',
  } = {}
) {
  const starts = findAll(contents, startMarker);
  const ends = findAll(contents, endMarker);

  if (starts.length !== 1 || ends.length !== 1 || ends[0] < starts[0]) {
    throw new Error(
      `${documentName}: expected exactly one ordered ${markerName} marker block; ` +
        `received start=${starts.length}, end=${ends.length}`
    );
  }

  return contents.slice(starts[0] + startMarker.length, ends[0]).trim();
}

export function extractCurrentStatusBlock(readmeContents) {
  return extractStatusBlock(readmeContents);
}

export function parseStatusDocument(
  contents,
  {
    documentName = 'README',
    startMarker = STATUS_START,
    endMarker = STATUS_END,
    markerName = 'package-status',
  } = {}
) {
  const block = extractStatusBlock(contents, {
    documentName,
    startMarker,
    endMarker,
    markerName,
  });
  const status = Object.fromEntries(
    STATUS_FIELDS.map(([key, label]) => [
      key,
      readStatusField(block, label, documentName),
    ])
  );

  if (!isSemver(status.packageVersion)) {
    throw new Error(
      `${documentName}: Package version expected semantic version, received "${status.packageVersion}"`
    );
  }

  if (!isSemver(status.npmLatest)) {
    throw new Error(
      `${documentName}: npm latest expected semantic version, received "${status.npmLatest}"`
    );
  }

  if (!isReleaseState(status.releaseState)) {
    throw new Error(
      `${documentName}: Release state expected "candidate" or "release", received "${status.releaseState}"`
    );
  }

  if (!isIsoDate(status.registryCheckedAt)) {
    throw new Error(
      `${documentName}: Registry checked at expected YYYY-MM-DD, received "${status.registryCheckedAt}"`
    );
  }

  return { ...status, block };
}

export function parseCurrentStatus(readmeContents) {
  return parseStatusDocument(readmeContents);
}

export function parseReleaseStatus(releaseContents) {
  return parseStatusDocument(releaseContents, {
    documentName: 'RELEASE',
    startMarker: RELEASE_STATUS_START,
    endMarker: RELEASE_STATUS_END,
    markerName: 'release-status',
  });
}

export function validateReleaseStatusManifest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `${RELEASE_STATUS_MANIFEST_PATH}: expected JSON object, received ${describeValue(value)}`
    );
  }

  const expectedKeys = [
    'schemaVersion',
    'npmLatest',
    'releaseState',
    'registryCheckedAt',
  ];
  const actualKeys = Object.keys(value);
  const missingKeys = expectedKeys.filter((key) => !actualKeys.includes(key));
  const extraKeys = actualKeys.filter((key) => !expectedKeys.includes(key));

  if (missingKeys.length > 0 || extraKeys.length > 0) {
    throw new Error(
      `${RELEASE_STATUS_MANIFEST_PATH}: fields expected [${expectedKeys.join(', ')}], ` +
        `received [${actualKeys.join(', ')}]` +
        `${missingKeys.length > 0 ? `; missing [${missingKeys.join(', ')}]` : ''}` +
        `${extraKeys.length > 0 ? `; unexpected [${extraKeys.join(', ')}]` : ''}`
    );
  }

  if (value.schemaVersion !== 1) {
    throw new Error(
      `${RELEASE_STATUS_MANIFEST_PATH}: schemaVersion expected 1, received ${describeValue(value.schemaVersion)}`
    );
  }
  if (!isSemver(value.npmLatest)) {
    throw new Error(
      `${RELEASE_STATUS_MANIFEST_PATH}: npmLatest expected semantic version, received ${describeValue(value.npmLatest)}`
    );
  }
  if (!isReleaseState(value.releaseState)) {
    throw new Error(
      `${RELEASE_STATUS_MANIFEST_PATH}: releaseState expected "candidate" or "release", received ${describeValue(value.releaseState)}`
    );
  }
  if (!isIsoDate(value.registryCheckedAt)) {
    throw new Error(
      `${RELEASE_STATUS_MANIFEST_PATH}: registryCheckedAt expected YYYY-MM-DD, received ${describeValue(value.registryCheckedAt)}`
    );
  }

  return {
    schemaVersion: value.schemaVersion,
    npmLatest: value.npmLatest,
    releaseState: value.releaseState,
    registryCheckedAt: value.registryCheckedAt,
  };
}

export function readReleaseStatusManifest(root) {
  const manifestPath = path.join(root, RELEASE_STATUS_MANIFEST_PATH);
  if (!existsSync(manifestPath)) {
    throw new Error(`${RELEASE_STATUS_MANIFEST_PATH}: missing release status manifest`);
  }

  let value;
  try {
    value = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `${RELEASE_STATUS_MANIFEST_PATH}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return validateReleaseStatusManifest(value);
}

export function inspectStatusContract({ packageVersion, manifest, documents }) {
  const errors = [];
  let normalizedManifest = null;

  if (!isSemver(packageVersion)) {
    errors.push(
      `package.json: version expected semantic version, received ${describeValue(packageVersion)}`
    );
  }

  try {
    normalizedManifest = validateReleaseStatusManifest(manifest);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const parsedDocuments = {};
  for (const document of documents) {
    try {
      const status = parseStatusDocument(document.contents, document);
      parsedDocuments[document.documentName] = status;
      if (isSemver(packageVersion) && status.packageVersion !== packageVersion) {
        errors.push(
          `${document.documentName}: Package version expected "${packageVersion}" from package.json, ` +
            `received "${status.packageVersion}"`
        );
      }
      if (normalizedManifest) {
        for (const [statusKey, fieldLabel, manifestKey] of [
          ['npmLatest', 'npm latest', 'npmLatest'],
          ['releaseState', 'Release state', 'releaseState'],
          ['registryCheckedAt', 'Registry checked at', 'registryCheckedAt'],
        ]) {
          if (status[statusKey] !== normalizedManifest[manifestKey]) {
            errors.push(
              `${document.documentName}: ${fieldLabel} expected "${normalizedManifest[manifestKey]}" ` +
                `from ${RELEASE_STATUS_MANIFEST_PATH}, received "${status[statusKey]}"`
            );
          }
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    packageVersion,
    manifest: normalizedManifest,
    documents: parsedDocuments,
    status: parsedDocuments.README ?? null,
  };
}

export function inspectDocumentation(root) {
  const errors = [];
  const missingFiles = REQUIRED_DOCUMENTATION_FILES.filter(
    (filePath) => !existsSync(path.join(root, filePath))
  );
  errors.push(...missingFiles.map((filePath) => `missing document: ${filePath}`));

  const packagePath = path.join(root, 'package.json');
  if (!existsSync(packagePath)) {
    errors.push('missing document metadata: package.json');
    return { ok: false, errors, status: null, markdownFiles: [] };
  }

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const readmePath = path.join(root, 'README.md');
  const releasePath = path.join(root, 'RELEASE.md');
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : null;
  const release = existsSync(releasePath)
    ? readFileSync(releasePath, 'utf8')
    : null;
  let manifest = null;

  try {
    manifest = readReleaseStatusManifest(root);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const statusReport = inspectStatusContract({
    packageVersion: packageJson.version,
    manifest: manifest ?? {},
    documents: [
      ...(readme === null
        ? []
        : [{ documentName: 'README', contents: readme }]),
      ...(release === null
        ? []
        : [
            {
              documentName: 'RELEASE',
              contents: release,
              startMarker: RELEASE_STATUS_START,
              endMarker: RELEASE_STATUS_END,
              markerName: 'release-status',
            },
          ]),
    ],
  });
  errors.push(
    ...statusReport.errors.filter(
      (error) => manifest !== null || !error.startsWith(`${RELEASE_STATUS_MANIFEST_PATH}:`)
    )
  );
  const status = statusReport.status;
  const releaseStatus = statusReport.documents.RELEASE ?? null;

  if (readme !== null) {
    const headings = new Set(parseHeadings(readme).map(({ text }) => text));
    for (const heading of README_HEADINGS) {
      if (!headings.has(heading)) {
        errors.push(`README missing heading: ${heading}`);
      }
    }

    for (const command of README_COMMANDS) {
      if (!readme.includes(command)) {
        errors.push(`README missing command: ${command}`);
      }
    }

    const links = new Set(parseMarkdownLinks(readme).map(({ target }) => target));
    for (const link of README_LINKS) {
      if (!links.has(link)) {
        errors.push(`README missing link: ${link}`);
      }
    }

    const lineCount = readme.split(/\r?\n/).length;
    const byteCount = Buffer.byteLength(readme);
    if (lineCount > 700) {
      errors.push(`README exceeds 700 lines: ${lineCount}`);
    }
    if (byteCount > 90 * 1024) {
      errors.push(`README exceeds 90KB: ${byteCount} bytes`);
    }
  }

  if (packageJson.name !== 'react-native-image-compression-kit') {
    errors.push(`unexpected package name: ${packageJson.name}`);
  }

  for (const entry of packageJson.files ?? []) {
    const normalized = entry.replace(/^\.\//, '');
    if (
      FORBIDDEN_PACKAGE_PREFIXES.some(
        (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
      )
    ) {
      errors.push(`npm package includes repository-only path: ${entry}`);
    }
  }

  const markdownFiles = collectMarkdownFiles(root);
  errors.push(...collectMarkdownLinkViolations(root, markdownFiles));

  if (release !== null) {
    const releaseHeadings = new Set(
      parseHeadings(release).map(({ text }) => text)
    );
    if (!releaseHeadings.has(`v${packageJson.version}`)) {
      errors.push(`RELEASE missing current heading: v${packageJson.version}`);
    }
    if (!release.includes('docs/releases/0.2-history.md')) {
      errors.push('RELEASE missing history link');
    }
  }

  const securityPath = path.join(root, 'SECURITY.md');
  if (existsSync(securityPath)) {
    const security = readFileSync(securityPath, 'utf8');
    const securityHeadings = new Set(
      parseHeadings(security).map(({ text }) => text)
    );
    for (const heading of [
      'Supported versions',
      'Reporting a vulnerability',
      'Package prohibitions',
      'Repository security rules',
      'Operational procedures',
    ]) {
      if (!securityHeadings.has(heading)) {
        errors.push(`SECURITY missing heading: ${heading}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    status,
    releaseStatus,
    manifest: statusReport.manifest,
    markdownFiles,
  };
}

export function validateDocumentation(root) {
  const report = inspectDocumentation(root);
  if (!report.ok) {
    throw new Error(`Documentation verification failed:\n- ${report.errors.join('\n- ')}`);
  }
  return report;
}

export function collectMarkdownLinkViolations(root, markdownFiles) {
  const errors = [];

  for (const relativeSource of markdownFiles) {
    const sourcePath = path.join(root, relativeSource);
    const source = readFileSync(sourcePath, 'utf8');

    for (const { target } of parseMarkdownLinks(source)) {
      if (isExternalTarget(target)) {
        continue;
      }

      const [rawPath, rawAnchor = ''] = target.split('#', 2);
      let decodedPath;
      let decodedAnchor;
      try {
        decodedPath = decodeURIComponent(rawPath);
        decodedAnchor = decodeURIComponent(rawAnchor).toLowerCase();
      } catch {
        errors.push(`${relativeSource}: invalid encoded link ${target}`);
        continue;
      }

      const targetPath = decodedPath
        ? path.resolve(path.dirname(sourcePath), decodedPath)
        : sourcePath;

      if (!targetPath.startsWith(`${path.resolve(root)}${path.sep}`) && targetPath !== path.resolve(root)) {
        errors.push(`${relativeSource}: link escapes repository ${target}`);
        continue;
      }

      if (!existsSync(targetPath)) {
        errors.push(`${relativeSource}: missing link target ${target}`);
        continue;
      }

      if (decodedPath && statSync(targetPath).isDirectory()) {
        errors.push(`${relativeSource}: link target is a directory ${target}`);
        continue;
      }

      if (decodedAnchor) {
        const targetContents = readFileSync(targetPath, 'utf8');
        const anchors = new Set(parseHeadings(targetContents).map(({ anchor }) => anchor));
        if (!anchors.has(decodedAnchor)) {
          errors.push(`${relativeSource}: missing anchor ${target}`);
        }
      }
    }
  }

  return errors;
}

export function parseHeadings(markdown) {
  const seen = new Map();
  const headings = [];
  const source = stripFencedCode(markdown);

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) {
      continue;
    }
    const text = normalizeHeadingText(match[1]);
    const base = slugifyHeading(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    headings.push({ text, anchor: count === 0 ? base : `${base}-${count}` });
  }

  return headings;
}

export function parseMarkdownLinks(markdown) {
  const links = [];
  const source = stripFencedCode(markdown);
  const pattern = /(?<!!)\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  for (const match of source.matchAll(pattern)) {
    const raw = match[1] ?? '';
    links.push({ target: raw.startsWith('<') ? raw.slice(1, -1) : raw });
  }
  return links;
}

function collectMarkdownFiles(root) {
  const files = ['README.md', 'RELEASE.md', 'SECURITY.md'];
  const docsRoot = path.join(root, 'docs');

  if (existsSync(docsRoot)) {
    walkMarkdown(docsRoot, root, files);
  }

  return files.filter((filePath) => existsSync(path.join(root, filePath))).sort();
}

function walkMarkdown(directory, root, files) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkMarkdown(fullPath, root, files);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path.relative(root, fullPath));
    }
  }
}

function readStatusField(block, field, documentName) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [
    ...block.matchAll(new RegExp('^- ' + escaped + ': `([^`]+)`$', 'gm')),
  ];
  if (matches.length !== 1) {
    throw new Error(
      `${documentName}: expected exactly one ${field} field, received ${matches.length}`
    );
  }
  return matches[0][1];
}

function isSemver(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
}

function isReleaseState(value) {
  return typeof value === 'string' && Object.hasOwn(RELEASE_STATE_MATRIX, value);
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function describeValue(value) {
  return typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
}

function normalizeHeadingText(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[`*_~]/g, '')
    .trim();
}

function slugifyHeading(value) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function stripFencedCode(markdown) {
  return markdown.replace(/^ {0,3}(```|~~~)[\s\S]*?^ {0,3}\1\s*$/gm, '');
}

function isExternalTarget(target) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target);
}

function findAll(value, snippet) {
  const indexes = [];
  let cursor = 0;
  while ((cursor = value.indexOf(snippet, cursor)) !== -1) {
    indexes.push(cursor);
    cursor += snippet.length;
  }
  return indexes;
}
