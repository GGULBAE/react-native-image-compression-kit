import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';

export const STATUS_START = '<!-- package-status:start -->';
export const STATUS_END = '<!-- package-status:end -->';
export const EXPECTED_NPM_LATEST = '0.2.55';

export const REQUIRED_DOCUMENTATION_FILES = [
  'README.md',
  'RELEASE.md',
  'SECURITY.md',
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

export function extractCurrentStatusBlock(readmeContents) {
  const starts = findAll(readmeContents, STATUS_START);
  const ends = findAll(readmeContents, STATUS_END);

  if (starts.length !== 1 || ends.length !== 1 || ends[0] < starts[0]) {
    throw new Error(
      'README must contain exactly one ordered package-status marker block'
    );
  }

  return readmeContents.slice(starts[0] + STATUS_START.length, ends[0]).trim();
}

export function parseCurrentStatus(readmeContents) {
  const block = extractCurrentStatusBlock(readmeContents);
  const packageVersion = readStatusField(block, 'Package version');
  const npmLatest = readStatusField(block, 'npm latest');
  const releaseState = readStatusField(block, 'Release state');

  if (!/^\d+\.\d+\.\d+$/.test(packageVersion)) {
    throw new Error(`README package status has invalid version: ${packageVersion}`);
  }

  if (!/^\d+\.\d+\.\d+$/.test(npmLatest)) {
    throw new Error(`README package status has invalid npm latest: ${npmLatest}`);
  }

  if (!['candidate', 'release'].includes(releaseState)) {
    throw new Error(`README package status has invalid release state: ${releaseState}`);
  }

  return { packageVersion, npmLatest, releaseState, block };
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
  let status = null;

  if (existsSync(readmePath)) {
    const readme = readFileSync(readmePath, 'utf8');
    try {
      status = parseCurrentStatus(readme);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    if (status) {
      if (status.packageVersion !== packageJson.version) {
        errors.push(
          `README package version ${status.packageVersion} does not match package.json ${packageJson.version}`
        );
      }
      if (status.npmLatest !== EXPECTED_NPM_LATEST) {
        errors.push(
          `README npm latest ${status.npmLatest} does not match ${EXPECTED_NPM_LATEST}`
        );
      }
    }

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

  const releasePath = path.join(root, 'RELEASE.md');
  if (existsSync(releasePath)) {
    const release = readFileSync(releasePath, 'utf8');
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

  return { ok: errors.length === 0, errors, status, markdownFiles };
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

function readStatusField(block, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [
    ...block.matchAll(new RegExp('^- ' + escaped + ': `([^`]+)`$', 'gm')),
  ];
  if (matches.length !== 1) {
    throw new Error(`README package status must contain exactly one ${field} field`);
  }
  return matches[0][1];
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
