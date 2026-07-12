import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { validateReadmeStatus } from './readme-status-validator.mjs';

export const REGISTRY_REPORT_SCHEMA_VERSION = 1;

export const REQUIRED_PACKAGE_FILES = [
  'package.json',
  'README.md',
  'SECURITY.md',
  'LICENSE',
  'lib/index.js',
  'lib/index.d.ts',
  'android/build.gradle',
  'android/src/main/java/com/imagecompressionkit/ImageCompressionKitModule.kt',
  'ios/RCTImageCompressionKit.h',
  'ios/RCTImageCompressionKit.mm',
  'react-native-image-compression-kit.podspec',
  'react-native.config.js',
];

export const FORBIDDEN_PACKAGE_FILES = [
  'scripts/consumer-smoke-test.mjs',
  'scripts/registry-smoke-test.mjs',
  'scripts/android-verification.mjs',
  'android/src/androidTest/java/com/imagecompressionkit/ImageCompressionKitHeicHeifInstrumentationTest.kt',
  'android/src/test/assets/heic-heif/sample.heic',
  'android/src/test/assets/avif/sample.avif',
  'android/src/test/java/com/imagecompressionkit/ImageCompressionKitModuleTest.kt',
  'example/package.json',
];

export function createRegistryReport({
  status = 'failed',
  packageName = null,
  requestedVersion = null,
  resolvedVersion = null,
  expectedTag = null,
  tagVersion = null,
  publishedAt = null,
  tarball = null,
  integrity = null,
  shasum = null,
  fileCount = null,
  packageSize = null,
  unpackedSize = null,
  readmeStatus = 'not-run',
  forbiddenFiles = [],
  registryInstallSmoke = false,
  error = null,
} = {}) {
  return {
    schemaVersion: REGISTRY_REPORT_SCHEMA_VERSION,
    status,
    package: packageName,
    requestedVersion,
    resolvedVersion,
    expectedTag,
    tagVersion,
    publishedAt,
    tarball,
    integrity,
    shasum,
    fileCount,
    packageSize,
    unpackedSize,
    readmeStatus,
    forbiddenFiles,
    registryInstallSmoke,
    error,
  };
}

export function validateRegistryEvidence({
  packageName,
  requestedVersion,
  expectedTag = null,
  tagVersion = null,
  registryMetadata,
  packInfo,
  readmeContents,
  registryInstallSmoke,
  installError = null,
}) {
  const resolvedVersion = stringOrNull(registryMetadata?.version);
  const filePaths = Array.isArray(packInfo?.files)
    ? packInfo.files.map((file) => file.path)
    : [];
  const forbiddenFiles = FORBIDDEN_PACKAGE_FILES.filter((filePath) =>
    filePaths.includes(filePath)
  );
  const reportValues = {
    packageName,
    requestedVersion,
    resolvedVersion,
    expectedTag,
    tagVersion: stringOrNull(tagVersion),
    publishedAt: resolvedVersion
      ? stringOrNull(registryMetadata?.time?.[resolvedVersion])
      : null,
    tarball: stringOrNull(registryMetadata?.['dist.tarball']),
    integrity: stringOrNull(registryMetadata?.['dist.integrity']),
    shasum: stringOrNull(registryMetadata?.['dist.shasum']),
    fileCount: numberOrNull(packInfo?.files?.length),
    packageSize: numberOrNull(packInfo?.size),
    unpackedSize: numberOrNull(packInfo?.unpackedSize),
    readmeStatus: 'not-run',
    forbiddenFiles,
    registryInstallSmoke: registryInstallSmoke === true,
  };

  try {
    assert(
      resolvedVersion,
      `Could not resolve published version for ${packageName}@${requestedVersion}.`
    );
    assert(
      resolvedVersion === requestedVersion,
      `Expected version ${requestedVersion}, but npm resolved ${resolvedVersion}.`
    );

    if (expectedTag) {
      assert(
        tagVersion === resolvedVersion,
        `Expected dist-tag ${expectedTag} to resolve ${resolvedVersion}, but it resolves ${tagVersion ?? 'nothing'}.`
      );
    }

    assert(
      packInfo?.name === packageName,
      `Expected packed package name ${packageName}, got ${packInfo?.name ?? 'nothing'}.`
    );
    assert(
      packInfo?.version === resolvedVersion,
      `Expected packed version ${resolvedVersion}, got ${packInfo?.version ?? 'nothing'}.`
    );
    assert(
      !reportValues.integrity || packInfo?.integrity === reportValues.integrity,
      'Packed tarball integrity does not match npm registry metadata.'
    );
    assert(
      !reportValues.shasum || packInfo?.shasum === reportValues.shasum,
      'Packed tarball shasum does not match npm registry metadata.'
    );

    const missing = REQUIRED_PACKAGE_FILES.filter(
      (filePath) => !filePaths.includes(filePath)
    );
    assert(
      missing.length === 0,
      `Packed registry tarball is missing expected files: ${missing.join(', ')}`
    );
    assert(
      forbiddenFiles.length === 0,
      `Packed registry tarball contains development-only files: ${forbiddenFiles.join(', ')}`
    );

    reportValues.readmeStatus = validateReadmeStatus(readmeContents ?? '', {
      version: resolvedVersion,
    });

    assert(
      registryInstallSmoke === true,
      installError || 'Registry consumer install/typecheck smoke failed.'
    );

    return createRegistryReport({
      ...reportValues,
      status: 'passed',
      error: null,
    });
  } catch (error) {
    if (reportValues.readmeStatus === 'not-run' && readmeContents != null) {
      try {
        reportValues.readmeStatus = validateReadmeStatus(readmeContents, {
          version: resolvedVersion,
        });
      } catch {
        reportValues.readmeStatus = 'failed';
      }
    }

    return createRegistryReport({
      ...reportValues,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function canonicalRegistryReport(report) {
  return `${JSON.stringify(report)}\n`;
}

export function writeRegistryReportAtomic(filePath, report, operations = {}) {
  const mkdir = operations.mkdir ?? mkdirSync;
  const writeFile = operations.writeFile ?? writeFileSync;
  const rename = operations.rename ?? renameSync;
  const remove = operations.remove ?? rmSync;
  const destination = path.resolve(filePath);
  const directory = path.dirname(destination);
  const temporary = path.join(
    directory,
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`
  );

  mkdir(directory, { recursive: true });

  try {
    writeFile(temporary, canonicalRegistryReport(report), {
      encoding: 'utf8',
      flag: 'wx',
    });
    rename(temporary, destination);
  } catch (error) {
    remove(temporary, { force: true });
    throw error;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stringOrNull(value) {
  return value == null || value === '' ? null : String(value);
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}
