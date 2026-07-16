import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readProjectFile(filePath: string): string {
  return readFileSync(path.join(ROOT, filePath), 'utf8');
}

describe('iOS source contract', () => {
  it('binds the Codegen provider to the Objective-C++ TurboModule bridge', () => {
    const header = readProjectFile('ios/RCTImageCompressionKit.h');
    const implementation = readProjectFile('ios/RCTImageCompressionKit.mm');

    expect(packageJson.codegenConfig.ios.modulesProvider).toEqual({
      ImageCompressionKit: 'RCTImageCompressionKit',
    });
    expect(header).toContain(
      '@interface RCTImageCompressionKit : NSObject <NativeImageCompressionKitSpec>'
    );
    expect(implementation).toContain('RCT_EXPORT_MODULE(ImageCompressionKit)');
    expect(implementation).toContain('getTurboModule:');
    expect(implementation).toContain(
      'compressImage:(JS::NativeImageCompressionKit::NativeCompressionOptions &)options'
    );
    expect(implementation).toContain('getImageCompressionCapabilities:');
  });

  it('keeps the podspec aligned with the package and supported source surface', () => {
    const podspec = readProjectFile(
      'react-native-image-compression-kit.podspec'
    );

    expect(podspec).toContain('s.version = package["version"]');
    expect(podspec).toContain('s.platforms = { :ios => "13.4" }');
    expect(podspec).toContain('s.source_files = "ios/**/*.{h,m,mm}"');
    expect(podspec).toContain('install_modules_dependencies(s)');
    expect(podspec).toContain('s.dependency "React-Core"');
  });

  it('delegates iOS behavior to the smoke contract and replay authorities', () => {
    const requiredAuthorities = [
      'scripts/ios-smoke-contract.mjs',
      'scripts/ios-validation.mjs',
      'scripts/refresh-ios-smoke-pass-replay.mjs',
      'test/iosSmokeContract.test.mjs',
      'test/iosSmokeLifecycle.test.mjs',
      'test/iosSmokePassReplayFixture.test.mjs',
      'test/fixtures/ios-smoke-pass-ci-replay.json',
    ];
    expect(
      requiredAuthorities.filter(
        (filePath) => !existsSync(path.join(ROOT, filePath))
      )
    ).toEqual([]);

    const exampleApp = readProjectFile('example/src/App.tsx');
    const exampleModule = readProjectFile(
      'example/ios/ImageCompressionKitExample/ExampleImageSource.m'
    );
    for (const marker of [
      'RNICK_IOS_SMOKE_START',
      'RNICK_IOS_SMOKE_PASS',
      'RNICK_IOS_SMOKE_FAIL',
    ]) {
      expect(exampleApp).toContain(marker);
    }
    expect(exampleApp).toContain('runIOSHostAppSmokeValidation');
    expect(exampleModule).toContain('@interface ExampleImageSource');
    expect(exampleModule).toContain('RCT_EXPORT_MODULE();');
  });

  it('runs replay audit and host-app smoke in the iOS workflow', () => {
    const workflow = readProjectFile('.github/workflows/ios-validation.yml');

    expect(packageJson.scripts['example:ios:smoke']).toBe(
      'node scripts/ios-validation.mjs smoke'
    );
    expect(packageJson.scripts['fixtures:ios-pass-replay:audit']).toBe(
      'node scripts/refresh-ios-smoke-pass-replay.mjs --audit'
    );
    expect(workflow).toContain('pnpm fixtures:ios-pass-replay:audit -- --json');
    expect(workflow).toContain('pnpm example:ios:smoke');
    expect(workflow).toContain('ios-smoke-diagnostics/ios-smoke.log');
  });
});
