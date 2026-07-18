export const RELEASE_ARTIFACT_CHECKS = Object.freeze([
  'version',
  'source',
  'branch',
  'status',
  'tarball',
  'inventory',
  'clean',
]);

const FORBIDDEN_PREFIXES = [
  'package/docs/',
  'package/evidence/',
  'package/example/',
  'package/scripts/',
  'package/test/',
  'package/tests/',
  'package/website/',
  'package/.github/',
];
const REQUIRED_FILES = [
  'package/package.json',
  'package/README.md',
  'package/CHANGELOG.md',
  'package/SECURITY.md',
  'package/LICENSE',
  'package/lib/index.js',
  'package/lib/index.d.ts',
  'package/react-native-image-compression-kit.podspec',
];

export function inspectReleaseArtifact(input) {
  const errors = [];
  const checks = Object.fromEntries(RELEASE_ARTIFACT_CHECKS.map((key) => [key, false]));

  if (!/^\d+\.\d+\.\d+$/.test(input.expectedVersion ?? '')) {
    errors.push('expected version must be an exact semantic version');
  } else if (input.packageVersion !== input.expectedVersion) {
    errors.push(
      `package version ${input.packageVersion} does not match ${input.expectedVersion}`
    );
  } else if (input.tarballPackageVersion !== input.expectedVersion) {
    errors.push(
      `tarball package version ${input.tarballPackageVersion} does not match ${input.expectedVersion}`
    );
  } else {
    checks.version = true;
  }

  if (!/^[0-9a-f]{40}$/.test(input.expectedSourceSha ?? '')) {
    errors.push('expected source SHA must be a lowercase full commit SHA');
  } else if (input.actualSourceSha !== input.expectedSourceSha) {
    errors.push(
      `checked-out source ${input.actualSourceSha} does not match ${input.expectedSourceSha}`
    );
  } else {
    checks.source = true;
  }

  if (input.sourceBranch !== 'master') {
    errors.push(`release source branch must be master, received ${input.sourceBranch}`);
  } else {
    checks.branch = true;
  }

  if (input.releaseState !== 'release') {
    errors.push(`release state must be release, received ${input.releaseState}`);
  } else if (input.npmLatest !== input.expectedVersion) {
    errors.push(
      `release-ready npm latest must be ${input.expectedVersion}, received ${input.npmLatest}`
    );
  } else {
    checks.status = true;
  }

  const expectedTarball = `react-native-image-compression-kit-${input.expectedVersion}.tgz`;
  if (input.tarballFile !== expectedTarball) {
    errors.push(`tarball filename expected ${expectedTarball}, received ${input.tarballFile}`);
  } else if (!Number.isInteger(input.tarballSize) || input.tarballSize <= 0) {
    errors.push('tarball size must be a positive integer');
  } else if (!/^[0-9a-f]{64}$/.test(input.tarballSha256 ?? '')) {
    errors.push('tarball SHA-256 must be lowercase hexadecimal');
  } else if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(input.tarballIntegrity ?? '')) {
    errors.push('tarball integrity must be an SHA-512 SRI value');
  } else {
    checks.tarball = true;
  }

  const inventory = Array.isArray(input.inventory) ? input.inventory : [];
  const forbidden = inventory.filter((entry) =>
    FORBIDDEN_PREFIXES.some((prefix) => entry === prefix.slice(0, -1) || entry.startsWith(prefix))
  );
  const missing = REQUIRED_FILES.filter((file) => !inventory.includes(file));
  if (forbidden.length > 0) {
    errors.push(`tarball contains forbidden paths: ${forbidden.join(', ')}`);
  }
  if (missing.length > 0) {
    errors.push(`tarball is missing required paths: ${missing.join(', ')}`);
  }
  if (forbidden.length === 0 && missing.length === 0) {
    checks.inventory = true;
  }

  if (input.worktreeClean !== true) {
    errors.push('release source worktree must be clean before packing');
  } else {
    checks.clean = true;
  }

  return {
    schemaVersion: 1,
    status: errors.length === 0 ? 'passed' : 'failed',
    package: 'react-native-image-compression-kit',
    version: input.expectedVersion ?? null,
    sourceSha: input.expectedSourceSha ?? null,
    sourceBranch: input.sourceBranch ?? null,
    tarballFile: input.tarballFile ?? null,
    tarballSize: input.tarballSize ?? null,
    tarballSha256: input.tarballSha256 ?? null,
    tarballIntegrity: input.tarballIntegrity ?? null,
    fileCount: inventory.length,
    checks,
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}

export function inspectPublicationState({
  expectedVersion,
  artifactIntegrity,
  registryVersion = null,
  registryIntegrity = null,
}) {
  if (registryVersion == null) {
    return {
      schemaVersion: 1,
      status: 'passed',
      version: expectedVersion,
      action: 'publish',
      registryVersion: null,
      registryIntegrity: null,
      artifactIntegrity,
      error: null,
    };
  }
  if (registryVersion !== expectedVersion) {
    return publicationFailure(
      expectedVersion,
      artifactIntegrity,
      registryVersion,
      registryIntegrity,
      `registry version ${registryVersion} does not match ${expectedVersion}`
    );
  }
  if (registryIntegrity !== artifactIntegrity) {
    return publicationFailure(
      expectedVersion,
      artifactIntegrity,
      registryVersion,
      registryIntegrity,
      'existing registry artifact integrity does not match the candidate tarball'
    );
  }
  return {
    schemaVersion: 1,
    status: 'passed',
    version: expectedVersion,
    action: 'resume',
    registryVersion,
    registryIntegrity,
    artifactIntegrity,
    error: null,
  };
}

export function inspectNpmAttestations(value, { packageName, version }) {
  const expectedSuffix = `${encodeURIComponent(packageName).replace('%40', '@')}@${version}`;
  const url = value?.url;
  const predicateType = value?.provenance?.predicateType;
  const errors = [];
  if (
    typeof url !== 'string' ||
    !url.startsWith('https://registry.npmjs.org/-/npm/v1/attestations/') ||
    !decodeURIComponent(url).endsWith(expectedSuffix)
  ) {
    errors.push('npm attestation URL does not identify the exact package version');
  }
  if (predicateType !== 'https://slsa.dev/provenance/v1') {
    errors.push(`unexpected npm provenance predicate: ${predicateType}`);
  }
  return {
    status: errors.length === 0 ? 'passed' : 'failed',
    url: typeof url === 'string' ? url : null,
    predicateType: predicateType ?? null,
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}

function publicationFailure(
  version,
  artifactIntegrity,
  registryVersion,
  registryIntegrity,
  error
) {
  return {
    schemaVersion: 1,
    status: 'failed',
    version,
    action: 'blocked',
    registryVersion,
    registryIntegrity,
    artifactIntegrity,
    error,
  };
}
