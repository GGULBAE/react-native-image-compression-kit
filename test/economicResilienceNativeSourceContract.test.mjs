import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const android = readFileSync(
  'example/android/app/src/main/java/com/imagecompressionkit/example/ExampleImageSourceModule.kt',
  'utf8'
);
const androidBuild = readFileSync('example/android/app/build.gradle', 'utf8');
const ios = readFileSync(
  'example/ios/ImageCompressionKitExample/ExampleImageSource.m',
  'utf8'
);
const project = readFileSync(
  'example/ios/ImageCompressionKitExample.xcodeproj/project.pbxproj',
  'utf8'
);

describe('12 MP example native fixture bridge contract', () => {
  it('bundles the same repository fixture into both native examples', () => {
    expect(androidBuild).toContain('main.assets.srcDirs += ["../../fixtures"]');
    expect(project.match(/kit-only-12mp-v1\.jpg/g)?.length).toBeGreaterThanOrEqual(3);
    expect(android).toContain('assets.open(assetName)');
    expect(ios).toContain('pathForResource:@"kit-only-12mp-v1" ofType:@"jpg"');
  });

  it('rejects outside-cache and linked inputs before inspection or staging', () => {
    expect(android).toContain('requestedFile.path != file.path');
    expect(android).toContain('!file.path.startsWith(cachePrefix)');
    expect(android).toContain('!uri.authority.isNullOrEmpty()');
    expect(android).toContain('uri.query != null');
    expect(android).toContain('uri.fragment != null');
    expect(android).toContain('uri.isOpaque');
    expect(android).toContain('Os.lstat(file.absolutePath)');
    expect(android).toContain('OsConstants.S_ISREG(status.st_mode)');
    expect(android).not.toContain('java.nio.file.Files');
    expect(android).toContain('OsConstants.ENOENT');
    expect(ios).toContain('standardizedPath.stringByDeletingLastPathComponent');
    expect(ios).toContain('standardizedParent.stringByResolvingSymlinksInPath');
    expect(ios).toContain('standardizedPath.lastPathComponent');
    expect(ios).toContain('ExampleImageSourcePathIsRegularNonSymlink(path)');
    expect(ios).toContain('lstat(path.fileSystemRepresentation, &status)');
    expect(ios).toContain('URL.host.length > 0');
    expect(ios.indexOf('!ExampleImageSourcePathIsRegularNonSymlink(path)')).toBeLessThan(
      ios.indexOf('NSData *data = [NSData dataWithContentsOfFile:path')
    );
  });

  it('refuses unsafe fixed destinations instead of following a symlink', () => {
    expect(android).toContain('removeExistingRegularDestination(outputFile)');
    expect(android).toContain('File.createTempFile(".rnick-evidence-", ".tmp", directory)');
    expect(android).toContain('Os.rename(temporary.absolutePath, destination.absolutePath)');
    expect(android).toContain('Evidence destination must be a removable regular file.');
    expect(android).toContain('Sample image cache directory must not be linked.');
    expect(ios).toContain('The iOS example refused an unsafe evidence destination.');
    expect(ios).toContain('The iOS example refused a linked evidence destination.');
  });
});
