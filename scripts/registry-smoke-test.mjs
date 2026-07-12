#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FORBIDDEN_PACKAGE_FILES,
  REQUIRED_PACKAGE_FILES,
  canonicalRegistryReport,
  createRegistryReport,
  validateRegistryEvidence,
  writeRegistryReportAtomic,
} from './registry-smoke-core.mjs';
import { writeRegistryBundleAtomic } from './registry-provenance-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const rootPackageJson = readJson(path.join(ROOT, 'package.json'));
const TEMP_PARENT = process.env.RNICK_REGISTRY_SMOKE_TMPDIR
  ? path.resolve(process.env.RNICK_REGISTRY_SMOKE_TMPDIR)
  : os.tmpdir();
const KEEP_TEMP = process.env.RNICK_REGISTRY_SMOKE_KEEP === '1';
const REACT_VERSION = '19.2.3';
const REACT_NATIVE_VERSION = '0.86.0';
const TYPESCRIPT_VERSION = '^5.8.3';
const TYPES_REACT_VERSION = '^19.2.0';

export function parseRegistrySmokeArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    const flags = {
      '--version': 'version',
      '--tag': 'tag',
      '--expect-tag': 'expectedTag',
      '--package': 'packageName',
      '--report-file': 'reportFile',
      '--artifact-dir': 'artifactDir',
    };

    if (flags[arg]) {
      parsed[flags[arg]] = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--json') {
      parsed.json = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (parsed.version && parsed.tag) {
    throw new Error('Use either --version or --tag, not both.');
  }
  if (parsed.reportFile && parsed.artifactDir) {
    throw new Error('Use either --report-file or --artifact-dir, not both.');
  }

  return parsed;
}

export function runRegistrySmoke(options, dependencies = {}) {
  const captureJson = dependencies.captureJson ?? captureCommandJson;
  const run = dependencies.run ?? runCommand;
  const extractReadme = dependencies.extractReadme ?? extractTarballReadme;
  const writeBundle = dependencies.writeBundle ?? writeRegistryBundleAtomic;
  const packageName = options.packageName ?? rootPackageJson.name;
  const requestedTag = options.tag ?? process.env.RNICK_REGISTRY_SMOKE_TAG ?? null;
  let requestedVersion =
    options.version ?? process.env.RNICK_REGISTRY_SMOKE_VERSION ?? null;
  const selector = requestedVersion ?? requestedTag ?? rootPackageJson.version;
  if (!requestedVersion && !requestedTag) {
    requestedVersion = rootPackageJson.version;
  }
  let tempRoot = null;
  let registryMetadata = null;
  let tagVersion = null;
  let packInfo = null;
  let readmeContents = null;
  let registryInstallSmoke = false;
  let installError = null;
  let tarballBytes = null;

  const finalize = (report) => {
    if (options.artifactDir) {
      if (!tarballBytes) {
        throw new Error('Could not create provenance bundle without the validated tarball.');
      }
      writeBundle(options.artifactDir, report, tarballBytes);
    }
    return report;
  };

  try {
    if (!packageName) throw new Error('Missing package name.');
    if (!selector) throw new Error('Missing registry version or tag.');

    mkdirSync(TEMP_PARENT, { recursive: true });
    registryMetadata = captureJson(
      'npm',
      [
        'view',
        `${packageName}@${selector}`,
        'version',
        'dist.tarball',
        'dist.integrity',
        'dist.shasum',
        'time',
        '--json',
      ],
      ROOT
    );
    const resolvedVersion = String(registryMetadata?.version ?? '');
    requestedVersion ??= resolvedVersion;

    if (options.expectedTag) {
      tagVersion = captureJson(
        'npm',
        ['view', packageName, `dist-tags.${options.expectedTag}`, '--json'],
        ROOT
      );
      if (typeof tagVersion === 'object' && tagVersion !== null) {
        tagVersion = tagVersion[options.expectedTag] ?? null;
      }
      if (tagVersion != null) tagVersion = String(tagVersion);
    }

    tempRoot = mkdtempSync(path.join(TEMP_PARENT, 'rnick-registry-smoke-'));
    const packDir = path.join(tempRoot, 'pack');
    const consumerDir = path.join(tempRoot, 'consumer');
    mkdirSync(packDir, { recursive: true });
    mkdirSync(path.join(consumerDir, 'src'), { recursive: true });

    const packed = captureJson(
      'npm',
      [
        'pack',
        `${packageName}@${resolvedVersion}`,
        '--pack-destination',
        packDir,
        '--json',
      ],
      ROOT
    );
    if (!Array.isArray(packed) || packed.length !== 1) {
      throw new Error(
        `Expected npm pack to return one tarball entry for ${packageName}@${resolvedVersion}.`
      );
    }
    packInfo = packed[0];
    const tarballPath = path.join(packDir, packInfo.filename);
    tarballBytes = readFileSync(tarballPath);
    readmeContents = extractReadme(tarballPath);

    const preflightReport = validateRegistryEvidence({
      packageName,
      requestedVersion,
      expectedTag: options.expectedTag ?? null,
      tagVersion,
      registryMetadata,
      packInfo,
      readmeContents,
      registryInstallSmoke: true,
    });
    if (preflightReport.status !== 'passed') {
      return finalize({ ...preflightReport, registryInstallSmoke: false });
    }

    writeConsumerProject(consumerDir, packageName, resolvedVersion);
    try {
      run('npm', ['install', '--ignore-scripts', '--legacy-peer-deps'], consumerDir);
      assertInstalledPackageFiles(consumerDir, packageName, resolvedVersion);
      run('npm', ['run', 'typecheck'], consumerDir);
      registryInstallSmoke = true;
    } catch (error) {
      installError = error instanceof Error ? error.message : String(error);
    }

    return finalize(validateRegistryEvidence({
      packageName,
      requestedVersion,
      expectedTag: options.expectedTag ?? null,
      tagVersion,
      registryMetadata,
      packInfo,
      readmeContents,
      registryInstallSmoke,
      installError,
    }));
  } catch (error) {
    return createRegistryReport({
      packageName: packageName ?? null,
      requestedVersion: requestedVersion ?? null,
      resolvedVersion: registryMetadata?.version
        ? String(registryMetadata.version)
        : null,
      expectedTag: options.expectedTag ?? null,
      tagVersion,
      publishedAt: registryMetadata?.version
        ? registryMetadata?.time?.[registryMetadata.version] ?? null
        : null,
      tarball: registryMetadata?.['dist.tarball'] ?? null,
      integrity: registryMetadata?.['dist.integrity'] ?? null,
      shasum: registryMetadata?.['dist.shasum'] ?? null,
      fileCount: Array.isArray(packInfo?.files) ? packInfo.files.length : null,
      packageSize: Number.isFinite(packInfo?.size) ? packInfo.size : null,
      unpackedSize: Number.isFinite(packInfo?.unpackedSize)
        ? packInfo.unpackedSize
        : null,
      readmeStatus: readmeContents == null ? 'not-run' : 'failed',
      forbiddenFiles: [],
      registryInstallSmoke,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (tempRoot && !KEEP_TEMP) {
      rmSync(tempRoot, { recursive: true, force: true });
    } else if (tempRoot && KEEP_TEMP && !options.json) {
      process.stderr.write(`Keeping registry smoke test directory: ${tempRoot}\n`);
    }
  }
}

function main() {
  let options;
  let report;

  try {
    options = parseRegistrySmokeArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    report = runRegistrySmoke(options);
  } catch (error) {
    report = createRegistryReport({
      packageName: rootPackageJson.name ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    options ??= {};
  }

  if (options.reportFile) {
    try {
      writeRegistryReportAtomic(options.reportFile, report);
    } catch (error) {
      report = {
        ...report,
        status: 'failed',
      error: `Could not write report atomically: ${
        error instanceof Error ? error.message : String(error)
      }`,
      };
    }
  }

  const canonical = canonicalRegistryReport(report);
  if (options.json) {
    process.stdout.write(canonical);
  } else if (report.status === 'passed') {
    process.stdout.write(canonical);
  } else {
    process.stderr.write(`${report.error}\n`);
    process.stdout.write(canonical);
  }

  if (report.status !== 'passed') process.exitCode = 1;
}

function usage() {
  return `Usage: pnpm smoke:registry -- [--version 0.2.48 | --tag latest]\n\nOptions:\n  --version <version>    Smoke-test an exact published version.\n  --tag <tag>            Resolve and smoke-test a published npm dist-tag.\n  --expect-tag <tag>     Require this dist-tag to resolve the tested version.\n  --package <name>       Override the package name. Defaults to package.json name.\n  --json                 Emit exactly one canonical JSON object to stdout.\n  --report-file <path>   Atomically write the same canonical JSON report.\n  --artifact-dir <path>  Atomically write report, stdout, tarball, and manifest.\n`;
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function captureCommandJson(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status ?? 1}): ${(result.stderr || result.stdout || '').trim()}`
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `Could not parse JSON output from ${command} ${args.join(' ')}: ${error.message}`
    );
  }
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status ?? 1}): ${(result.stderr || result.stdout || '').trim()}`
    );
  }
}

function extractTarballReadme(tarballPath) {
  const result = spawnSync('tar', ['-xOf', tarballPath, 'package/README.md'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      result.stderr || `Could not extract package/README.md from ${tarballPath}.`
    );
  }
  return result.stdout;
}

function writeConsumerProject(projectDir, dependencyName, dependencyVersion) {
  writeJson(path.join(projectDir, 'package.json'), {
    name: 'rnick-registry-smoke',
    version: '0.0.0',
    private: true,
    scripts: {
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      react: REACT_VERSION,
      'react-native': REACT_NATIVE_VERSION,
      [dependencyName]: dependencyVersion,
    },
    devDependencies: {
      '@types/react': TYPES_REACT_VERSION,
      typescript: TYPESCRIPT_VERSION,
    },
    engines: { node: '>=22.11.0' },
  });
  writeJson(path.join(projectDir, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      noEmit: true,
      jsx: 'react-jsx',
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      skipLibCheck: true,
    },
    include: ['src'],
  });
  writeFileSync(path.join(projectDir, 'src/index.ts'), consumerSource(), 'utf8');
}

function consumerSource() {
  return `import {
  IMAGE_FORMATS,
  ImageCompressionKitError,
  METADATA_POLICIES,
  OUTPUT_FORMATS,
  RESIZE_MODES,
  compressImage,
  getImageCompressionCapabilities,
} from 'react-native-image-compression-kit';
import type {
  CompressionOptions,
  CompressionResult,
  CompressionSource,
  FormatCapability,
  ImageCompressionCapabilities,
  ImageFormat,
  MetadataPolicy,
  NormalizedCompressionOptions,
  OutputFormat,
} from 'react-native-image-compression-kit';

const source: CompressionSource = {
  uri: 'file:///tmp/rnick-registry-smoke/source.jpg',
};
const outputFormat: OutputFormat = OUTPUT_FORMATS[0];
const metadataPolicy: MetadataPolicy = METADATA_POLICIES[1];
const options: CompressionOptions = {
  source,
  resize: {
    maxWidth: 320,
    maxHeight: 240,
    mode: RESIZE_MODES[0],
  },
  output: {
    format: outputFormat,
    quality: 82,
    maxBytes: 120_000,
  },
  metadata: metadataPolicy,
};
const normalizedOptions: NormalizedCompressionOptions = {
  ...options,
  resize: {
    maxWidth: 320,
    maxHeight: 240,
    mode: RESIZE_MODES[0],
  },
  metadata: metadataPolicy,
};
const firstCapability: FormatCapability = {
  format: IMAGE_FORMATS[0],
  input: true,
  output: true,
  supportsAlpha: false,
  supportsAnimation: false,
};
const formats: ImageFormat[] = IMAGE_FORMATS.map((format) => format);
const unavailableError = new ImageCompressionKitError(
  'ERR_NATIVE_MODULE_UNAVAILABLE',
  'Native module is intentionally not invoked during the registry smoke test.'
);

async function exercisePublicTypes(): Promise<{
  result: CompressionResult;
  capabilities: ImageCompressionCapabilities;
}> {
  const result = await compressImage(options);
  const capabilities = await getImageCompressionCapabilities();

  return { result, capabilities };
}

void normalizedOptions;
void firstCapability;
void formats;
void unavailableError;
void exercisePublicTypes;
`;
}

function assertInstalledPackageFiles(projectDir, dependencyName, expectedVersion) {
  const packageDir = path.join(projectDir, 'node_modules', dependencyName);
  const installedPackageJsonPath = path.join(packageDir, 'package.json');
  if (!existsSync(installedPackageJsonPath)) {
    throw new Error(
      `Installed package is missing package.json at ${installedPackageJsonPath}.`
    );
  }
  const installedPackageJson = readJson(installedPackageJsonPath);
  if (installedPackageJson.version !== expectedVersion) {
    throw new Error(
      `Expected installed version ${expectedVersion}, got ${installedPackageJson.version}.`
    );
  }
  const missing = REQUIRED_PACKAGE_FILES.filter(
    (filePath) => !existsSync(path.join(packageDir, filePath))
  );
  const forbidden = FORBIDDEN_PACKAGE_FILES.filter((filePath) =>
    existsSync(path.join(packageDir, filePath))
  );
  if (missing.length) {
    throw new Error(
      `Installed package is missing expected files: ${missing.join(', ')}`
    );
  }
  if (forbidden.length) {
    throw new Error(
      `Installed package contains development-only files: ${forbidden.join(', ')}`
    );
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
