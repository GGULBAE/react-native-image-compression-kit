import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import {
  PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ROOT,
  inspectPublicEconomicResilienceArchive,
} from './public-economic-resilience-evidence-core.mjs';

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
  ['releaseTarget', 'Release target'],
  ['publishedNpmLatest', 'Published npm latest'],
  ['releaseState', 'Release state'],
  ['registryCheckedAt', 'Registry checked at'],
];

const LEGACY_PUBLISHED_STATUS_FIELDS = [
  ['packageVersion', 'Package version'],
  ['publishedNpmLatest', 'npm latest'],
  ['releaseState', 'Release state'],
  ['registryCheckedAt', 'Registry checked at'],
];

export const REQUIRED_DOCUMENTATION_FILES = [
  'README.md',
  'CHANGELOG.md',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'GOVERNANCE.md',
  'ROADMAP.md',
  'RELEASE.md',
  'SECURITY.md',
  'SUPPORT.md',
  'example/README.md',
  RELEASE_STATUS_MANIFEST_PATH,
  'docs/compatibility-matrix.json',
  'docs/repository-settings.json',
  'docs/product-architecture.md',
  'docs/verification-architecture.md',
  'website/reference/evidence.md',
  'website/reference/economic-resilience.md',
  'docs/maintainers/account-recovery.md',
  'docs/maintainers/repository-settings.md',
  'docs/maintainers/trusted-release.md',
  'docs/launch/README.md',
  'docs/launch/announcement-en.md',
  'docs/launch/announcement-ko.md',
  'docs/launch/baseline.json',
  'docs/release-evidence/README.md',
  'docs/release-evidence/registry-provenance.md',
  'docs/release-evidence/policy-review.md',
  'docs/release-evidence/review-archive.md',
  'docs/release-evidence/acquisition.md',
  'docs/supply-chain/README.md',
  'docs/supply-chain/action-pins.md',
  'docs/supply-chain/dependency-security.md',
  'docs/supply-chain/dependabot-triage.md',
  'docs/releases/0.2-history.md',
  'docs/legacy/README-v0.2.61.md',
  'docs/legacy/SECURITY-v0.2.61.md',
];

const README_HEADINGS = [
  'Current status',
  'Why this package',
  'Project direction',
  'Installation',
  'Quick start',
  'Public API',
  'Compression examples',
  'Platform capabilities and limitations',
  'Development verification',
  'Repository documentation',
  'Security',
  'Contributing and support',
  'License',
];

const README_COMMANDS = [
  'npm install react-native-image-compression-kit',
  'pnpm verify',
  'pnpm example:typecheck',
  'pnpm docs:check',
  'pnpm site:check',
  'pnpm site:build',
  'pnpm fixtures:compatibility:check',
  'git diff --check',
  'pnpm pack --dry-run',
  'pnpm release:dry-run',
];

const README_LINKS = [
  'https://ggulbae.github.io/react-native-image-compression-kit/',
  'https://ggulbae.github.io/react-native-image-compression-kit/reference/architecture',
  'https://ggulbae.github.io/react-native-image-compression-kit/reference/evidence',
  'https://ggulbae.github.io/react-native-image-compression-kit/roadmap',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/ROADMAP.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/product-architecture.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/README.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/registry-provenance.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/policy-review.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/review-archive.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-evidence/acquisition.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/supply-chain/action-pins.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/release-status.json',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/verification-architecture.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/RELEASE.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/releases/0.2-history.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/SECURITY.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/CONTRIBUTING.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/SUPPORT.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/CODE_OF_CONDUCT.md',
  'https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/CHANGELOG.md',
];

const FORBIDDEN_PACKAGE_PREFIXES = [
  'docs',
  'evidence',
  'scripts',
  'test',
  'tests',
  'website',
  'example',
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

  if (!isSemver(status.releaseTarget)) {
    throw new Error(
      `${documentName}: Release target expected semantic version, received "${status.releaseTarget}"`
    );
  }

  if (!isSemver(status.publishedNpmLatest)) {
    throw new Error(
      `${documentName}: Published npm latest expected semantic version, received "${status.publishedNpmLatest}"`
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

export function parsePublishedPackageStatus(readmeContents) {
  const block = extractCurrentStatusBlock(readmeContents);
  if (
    block.includes('- Release target:') ||
    block.includes('- Published npm latest:')
  ) {
    return parseCurrentStatus(readmeContents);
  }

  const legacy = Object.fromEntries(
    LEGACY_PUBLISHED_STATUS_FIELDS.map(([key, label]) => [
      key,
      readStatusField(block, label, 'README'),
    ])
  );
  if (!isSemver(legacy.packageVersion)) {
    throw new Error(
      `README: Package version expected semantic version, received "${legacy.packageVersion}"`
    );
  }
  if (!isSemver(legacy.publishedNpmLatest)) {
    throw new Error(
      `README: npm latest expected semantic version, received "${legacy.publishedNpmLatest}"`
    );
  }
  if (!isReleaseState(legacy.releaseState)) {
    throw new Error(
      `README: Release state expected "candidate" or "release", received "${legacy.releaseState}"`
    );
  }
  if (!isIsoDate(legacy.registryCheckedAt)) {
    throw new Error(
      `README: Registry checked at expected YYYY-MM-DD, received "${legacy.registryCheckedAt}"`
    );
  }

  return {
    ...legacy,
    releaseTarget: legacy.packageVersion,
    block,
  };
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
    'releaseTarget',
    'publishedNpmLatest',
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

  if (value.schemaVersion !== 2) {
    throw new Error(
      `${RELEASE_STATUS_MANIFEST_PATH}: schemaVersion expected 2, received ${describeValue(value.schemaVersion)}`
    );
  }
  if (!isSemver(value.releaseTarget)) {
    throw new Error(
      `${RELEASE_STATUS_MANIFEST_PATH}: releaseTarget expected semantic version, received ${describeValue(value.releaseTarget)}`
    );
  }
  if (!isSemver(value.publishedNpmLatest)) {
    throw new Error(
      `${RELEASE_STATUS_MANIFEST_PATH}: publishedNpmLatest expected semantic version, received ${describeValue(value.publishedNpmLatest)}`
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
    releaseTarget: value.releaseTarget,
    publishedNpmLatest: value.publishedNpmLatest,
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

  if (
    normalizedManifest &&
    isSemver(packageVersion) &&
    normalizedManifest.releaseTarget !== packageVersion
  ) {
    errors.push(
      `${RELEASE_STATUS_MANIFEST_PATH}: releaseTarget expected "${packageVersion}" from package.json, ` +
        `received "${normalizedManifest.releaseTarget}"`
    );
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
      if (isSemver(packageVersion) && status.releaseTarget !== packageVersion) {
        errors.push(
          `${document.documentName}: Release target expected "${packageVersion}" from package.json, ` +
            `received "${status.releaseTarget}"`
        );
      }
      if (normalizedManifest) {
        for (const [statusKey, fieldLabel, manifestKey] of [
          ['releaseTarget', 'Release target', 'releaseTarget'],
          ['publishedNpmLatest', 'Published npm latest', 'publishedNpmLatest'],
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

export function inspectReleaseLanguageContracts({
  packageVersion,
  releaseState,
  releaseNotes = null,
  documents = [],
}) {
  const errors = [];

  if (!isSemver(packageVersion)) {
    errors.push(
      `release language gate expected a semantic package version, received ${describeValue(packageVersion)}`
    );
  }
  if (!isReleaseState(releaseState)) {
    errors.push(
      `release language gate expected release state "candidate" or "release", received ${describeValue(releaseState)}`
    );
  }

  if (releaseNotes?.contents != null && isSemver(packageVersion)) {
    const escapedVersion = escapeRegularExpression(packageVersion);
    const evergreenViolations = [
      [
        'candidate self-description',
        /\bThis\s+(?:backward-compatible\s+)?candidate\b/i,
      ],
      [
        'publication-conditional install heading',
        /^#{1,6}\s+Install after publication\s*$/im,
      ],
      ['publication-conditional timing', /\bUntil publication\b/i],
      [
        'current-version source-candidate label',
        new RegExp(
          `\\b(?:v|version\\s+)?${escapedVersion}\\s+source candidate\\b`,
          'i'
        ),
      ],
      ['registry-release negation', /\bnot represented as a registry release\b/i],
    ];

    for (const [description, pattern] of evergreenViolations) {
      if (pattern.test(releaseNotes.contents)) {
        errors.push(
          `${releaseNotes.documentName}: release notes must remain true after publication; found ${description}`
        );
      }
    }
  }

  if (releaseState === 'release' && isSemver(packageVersion)) {
    const escapedVersion = escapeRegularExpression(packageVersion);
    const currentCandidatePatterns = [
      [
        'current-version candidate label',
        new RegExp(
          `\\b(?:Version\\s+|v)?${escapedVersion}\\s+(?:is\\s+(?:a\\s+)?)?(?:source|repository|release)\\s+candidate\\b`,
          'i'
        ),
      ],
      [
        'current release self-description',
        /\bThis\s+(?:backward-compatible\s+)?candidate\b/i,
      ],
      ['candidate validation heading', /^#{1,6}\s+Candidate validation\s*$/im],
      ['pending candidate release timing', /\buntil the candidate is released\b/i],
      ['pending candidate ship timing', /\buntil the candidate ships\b/i],
      ['pending publication timing', /\bUntil it is published\b/i],
    ];

    for (const document of documents) {
      for (const [description, pattern] of currentCandidatePatterns) {
        if (pattern.test(document.contents)) {
          errors.push(
            `${document.documentName}: release-state document still contains ${description} for ${packageVersion}`
          );
        }
      }
    }
  }

  return errors;
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
  const releaseNotesPath = `docs/launch/v${packageJson.version}-release-notes.md`;
  if (!existsSync(path.join(root, releaseNotesPath))) {
    errors.push(`missing document: ${releaseNotesPath}`);
  }
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

  const verificationArchitecturePath = path.join(
    root,
    'docs/verification-architecture.md'
  );
  if (existsSync(verificationArchitecturePath)) {
    const verificationArchitecture = readFileSync(
      verificationArchitecturePath,
      'utf8'
    );
    const verificationHeadings = new Set(
      parseHeadings(verificationArchitecture).map(({ text }) => text)
    );
    for (const heading of [
      'Authority matrix',
      'Source contract policy',
      'Validation commands',
      'Change routing',
      'Non-goals',
    ]) {
      if (!verificationHeadings.has(heading)) {
        errors.push(`verification architecture missing heading: ${heading}`);
      }
    }
    for (const command of [
      'pnpm verify',
      'pnpm example:typecheck',
      'pnpm docs:check',
      'pnpm site:check',
      'pnpm verify:public-economic-resilience-evidence',
      'pnpm fixtures:compatibility:check',
      'pnpm fixtures:repository-settings:check',
      'pnpm audit:repository-settings',
      'pnpm verify:release-artifact',
      'git diff --check',
      'pnpm pack --dry-run',
    ]) {
      if (!verificationArchitecture.includes(command)) {
        errors.push(`verification architecture missing command: ${command}`);
      }
    }
  }

  const roadmapPath = path.join(root, 'ROADMAP.md');
  const productArchitecturePath = path.join(root, 'docs/product-architecture.md');
  if (existsSync(roadmapPath) && existsSync(productArchitecturePath)) {
    errors.push(
      ...inspectProductDirectionContracts({
        roadmap: readFileSync(roadmapPath, 'utf8'),
        architecture: readFileSync(productArchitecturePath, 'utf8'),
      })
    );
  }

  const productEvidencePath = path.join(root, 'website/reference/evidence.md');
  if (existsSync(productEvidencePath)) {
    errors.push(
      ...inspectProductEvidenceContracts(
        readFileSync(productEvidencePath, 'utf8')
      )
    );
  }

  const economicEvidencePath = path.join(
    root,
    'website/reference/economic-resilience.md'
  );
  if (existsSync(economicEvidencePath)) {
    errors.push(
      ...inspectEconomicResiliencePageContracts(
        readFileSync(economicEvidencePath, 'utf8')
      )
    );
    const publicArchive = inspectPublicEconomicResilienceArchive(
      path.join(root, PUBLIC_ECONOMIC_RESILIENCE_ARCHIVE_ROOT)
    );
    if (publicArchive.status !== 'passed') {
      errors.push(`public economic resilience archive: ${publicArchive.error}`);
    } else {
      const componentPath = path.join(
        root,
        'website/.vitepress/theme/EconomicResilienceArchive.vue'
      );
      errors.push(
        ...inspectEconomicResilienceStateContracts({
          archiveState: publicArchive.archiveState,
          componentContents: existsSync(componentPath)
            ? readFileSync(componentPath, 'utf8')
            : '',
        })
      );
    }
  }

  inspectPublicLaunchContracts(
    root,
    packageJson.version,
    statusReport.manifest,
    errors
  );

  const releaseNotes = existsSync(path.join(root, releaseNotesPath))
    ? {
        documentName: releaseNotesPath,
        contents: readFileSync(path.join(root, releaseNotesPath), 'utf8'),
      }
    : null;
  errors.push(
    ...inspectReleaseLanguageContracts({
      packageVersion: packageJson.version,
      releaseState: statusReport.manifest?.releaseState,
      releaseNotes,
      documents: collectReleaseLanguageDocuments(root),
    })
  );

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

function inspectPublicLaunchContracts(root, packageVersion, releaseStatus, errors) {
  const compatibilityPath = path.join(root, 'docs/compatibility-matrix.json');
  if (existsSync(compatibilityPath)) {
    const compatibility = JSON.parse(readFileSync(compatibilityPath, 'utf8'));
    if (compatibility.packageVersion !== packageVersion) {
      errors.push(
        `compatibility matrix packageVersion expected ${packageVersion}, received ${compatibility.packageVersion}`
      );
    }
    for (const lane of ['rn-floor-legacy', 'rn-current-legacy', 'rn-current-new', 'expo-current-new']) {
      if (!compatibility.lanes?.some(({ id }) => id === lane)) {
        errors.push(`compatibility matrix missing release lane: ${lane}`);
      }
    }
  }

  const baselinePath = path.join(root, 'docs/launch/baseline.json');
  if (existsSync(baselinePath)) {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    const evidencePackageVersion = releaseStatus?.publishedNpmLatest;
    if (
      baseline.packageVersion !== evidencePackageVersion ||
      baseline.schemaVersion !== 1
    ) {
      errors.push(
        'launch baseline must identify the latest published package version and schema'
      );
    }
    for (const field of ['capturedAt', 'npm', 'github', 'measurementWindow']) {
      if (!Object.hasOwn(baseline, field)) {
        errors.push(`launch baseline missing field: ${field}`);
      }
    }
  }

  for (const relativePath of [
    '.github/ISSUE_TEMPLATE/bug.yml',
    '.github/ISSUE_TEMPLATE/compatibility.yml',
    '.github/ISSUE_TEMPLATE/feature.yml',
    '.github/ISSUE_TEMPLATE/config.yml',
  ]) {
    const fullPath = path.join(root, relativePath);
    if (!existsSync(fullPath)) {
      errors.push(`missing community form: ${relativePath}`);
      continue;
    }
    const form = readFileSync(fullPath, 'utf8');
    if (
      relativePath.endsWith('/config.yml')
        ? !form.includes('blank_issues_enabled: false') || !form.includes('contact_links:')
        : !form.includes('name:') || !form.includes('description:')
    ) {
      errors.push(`${relativePath}: missing semantic name or description`);
    }
  }

  for (const [relativePath, requiredSnippets] of [
    ['docs/maintainers/trusted-release.md', ['npm-production', '.github/workflows/release.yml', 'resume', 'deprecate']],
    ['docs/maintainers/repository-settings.md', ['Protected master', 'Immutable version tags', 'pnpm audit:repository-settings']],
    ['docs/maintainers/account-recovery.md', ['two-factor', 'recovery codes', 'npm']],
    ['docs/launch/README.md', ['pre-launch', 'post-launch', 'approval']],
  ]) {
    const fullPath = path.join(root, relativePath);
    if (!existsSync(fullPath)) continue;
    const contents = readFileSync(fullPath, 'utf8');
    for (const snippet of requiredSnippets) {
      if (!contents.toLowerCase().includes(snippet.toLowerCase())) {
        errors.push(`${relativePath}: missing launch contract ${snippet}`);
      }
    }
  }
}

export function validateDocumentation(root) {
  const report = inspectDocumentation(root);
  if (!report.ok) {
    throw new Error(`Documentation verification failed:\n- ${report.errors.join('\n- ')}`);
  }
  return report;
}

export function inspectProductDirectionContracts({ roadmap, architecture }) {
  const errors = [];
  inspectDecisionDocument({
    label: 'ROADMAP',
    contents: roadmap,
    headings: [
      'How priorities are chosen',
      'Current priorities',
      'Evidence-gated candidates',
      'Deferred work',
      'Non-goals',
      'How to propose a change',
    ],
    snippets: [
      'No roadmap item is a release promise',
      'getImageCompressionCapabilities()',
      'GitHub Discussions',
      'HEIC, HEIF, or AVIF output',
    ],
    errors,
  });
  inspectDecisionDocument({
    label: 'product architecture',
    contents: architecture,
    headings: [
      'System boundary',
      'Request lifecycle',
      'Platform pipelines',
      'Architectural decisions',
      'Verification ownership',
      'Change rules',
    ],
    snippets: [
      'capability-first',
      'getImageCompressionCapabilities()',
      'ERR_RESOURCE_LIMIT',
      'ERR_CANCELLED',
      'transactional',
      'Codegen',
      'NativeModules',
    ],
    errors,
  });
  return errors;
}

export function inspectProductEvidenceContracts(contents) {
  const errors = [];
  inspectDecisionDocument({
    label: 'product evidence',
    contents,
    headings: [
      'Purpose and claim boundary',
      'Primary metrics',
      'Byte-budget attainment',
      'Failure-safe completion',
      'Runtime capability agreement',
      'Driver and guardrail metrics',
      'Evidence charts',
      'Current evidence snapshot',
      'Interpretation limits',
      'Reproduce the evidence',
    ],
    snippets: [
      '1 / 2',
      'orientation-affected',
      '8 / 8',
      '96%',
      '0 of 7',
      'not a peak-memory measurement',
      'does not establish image-quality superiority',
      'evidence-scorecard.svg',
    ],
    errors,
  });
  return errors;
}

export function inspectEconomicResiliencePageContracts(contents) {
  const errors = [];
  inspectDecisionDocument({
    label: 'economic resilience evidence',
    contents,
    headings: [
      'What a capture must prove',
      'Economic claim boundary',
      'Append-only archive layout',
      'Import and verify',
    ],
    snippets: [
      '<EconomicResilienceArchive />',
      'source-remains',
      'matchedTransferBaseline: null',
      'costSavingsClaim: null',
      'workflow_dispatch',
      'refs/heads/master',
      'pnpm verify:public-economic-resilience-evidence',
      'There is no mutable `latest`',
    ],
    errors,
  });
  return errors;
}

export function inspectEconomicResilienceStateContracts({
  archiveState,
  componentContents,
}) {
  const errors = [];
  const required = archiveState === 'available'
    ? [
        'Archived source-tree capture',
        'sourceToOutputByteDifference',
        'uprightSimilarity',
        'verticalFlipSimilarity',
        'removedPackageOutputs',
        'state.runUrl',
        'Original artifact ZIP',
      ]
    : [
        'Methodology preview · no archived capture',
        'not a package release or a measured product result',
      ];
  for (const snippet of required) {
    if (!componentContents.includes(snippet)) {
      errors.push(
        `economic resilience ${archiveState} state missing component contract: ${snippet}`
      );
    }
  }
  return errors;
}

function inspectDecisionDocument({
  label,
  contents,
  headings,
  snippets,
  errors,
}) {
  const actualHeadings = new Set(parseHeadings(contents).map(({ text }) => text));
  for (const heading of headings) {
    if (!actualHeadings.has(heading)) {
      errors.push(`${label} missing heading: ${heading}`);
    }
  }
  for (const snippet of snippets) {
    if (!contents.includes(snippet)) {
      errors.push(`${label} missing decision contract: ${snippet}`);
    }
  }
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
  const files = [
    'README.md',
    'CHANGELOG.md',
    'CODE_OF_CONDUCT.md',
    'CONTRIBUTING.md',
    'GOVERNANCE.md',
    'ROADMAP.md',
    'RELEASE.md',
    'SECURITY.md',
    'SUPPORT.md',
    'example/README.md',
  ];
  const docsRoot = path.join(root, 'docs');

  if (existsSync(docsRoot)) {
    walkMarkdown(docsRoot, root, files);
  }

  return files.filter((filePath) => existsSync(path.join(root, filePath))).sort();
}

function collectReleaseLanguageDocuments(root) {
  const documents = [];
  const activeFiles = [
    'README.md',
    'RELEASE.md',
    'docs/launch/announcement-en.md',
    'docs/launch/announcement-ko.md',
  ];

  for (const relativePath of activeFiles) {
    const fullPath = path.join(root, relativePath);
    if (existsSync(fullPath)) {
      documents.push({
        documentName: relativePath,
        contents: readFileSync(fullPath, 'utf8'),
      });
    }
  }

  const websiteRoot = path.join(root, 'website');
  if (existsSync(websiteRoot)) {
    walkReleaseLanguageDocuments(websiteRoot, root, documents);
  }

  return documents;
}

function walkReleaseLanguageDocuments(directory, root, documents) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['cache', 'dist', 'node_modules'].includes(entry.name)) continue;
      walkReleaseLanguageDocuments(fullPath, root, documents);
    } else if (
      entry.isFile() &&
      ['.md', '.svg', '.vue'].includes(path.extname(entry.name))
    ) {
      documents.push({
        documentName: path.relative(root, fullPath),
        contents: readFileSync(fullPath, 'utf8'),
      });
    }
  }
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  return stripHeadingTags(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

function stripHeadingTags(value) {
  let result = '';
  let insideTag = false;
  for (const character of value) {
    if (character === '<') {
      insideTag = true;
    } else if (character === '>') {
      insideTag = false;
    } else if (!insideTag) {
      result += character;
    }
  }
  return result;
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
