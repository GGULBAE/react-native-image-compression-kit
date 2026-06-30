import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readProjectFile(filePath: string): string {
  return readFileSync(path.join(ROOT, filePath), 'utf8');
}

describe('example app', () => {
  it('lets Android users select JPEG, PNG, or WebP output formats', () => {
    const appSource = readProjectFile('example/src/App.tsx');

    expect(appSource).toContain(
      "const EXAMPLE_OUTPUT_FORMATS: OutputFormat[] = ['jpeg', 'png', 'webp'];"
    );
    expect(appSource).toContain("useState<OutputFormat>('jpeg')");
    expect(appSource).toContain('format: outputFormat');
    expect(appSource).toContain('supportsSelectedTargetSize');
    expect(appSource).toContain('Android MVP / iOS JPEG MVP');
    expect(appSource).toContain('editable={supportsSelectedTargetSize}');
    expect(appSource).toContain('label="selected output"');
    expect(appSource).toContain('label="output formats"');
    expect(appSource).toContain('label="format"');
  });

  it('wires an iOS host-app smoke runner for native JPEG MVP validation', () => {
    const appSource = readProjectFile('example/src/App.tsx');
    const iosModuleSource = readProjectFile(
      'example/ios/ImageCompressionKitExample/ExampleImageSource.m'
    );

    expect(appSource).toContain("Platform.OS !== 'ios'");
    expect(appSource).toContain('isSmokeTestEnabled');
    expect(appSource).toContain('runIOSHostAppSmokeValidation');
    expect(appSource).toContain('RNICK_IOS_SMOKE_START');
    expect(appSource).toContain('RNICK_IOS_SMOKE_PASS');
    expect(appSource).toContain('RNICK_IOS_SMOKE_FAIL');
    expect(appSource).toContain('copySamplePngToCache');
    expect(appSource).toContain('copyUnsupportedImageToCache');
    expect(appSource).toContain("capabilities.platform === 'ios'");
    expect(appSource).toContain("metadataPolicies.join(',') === 'safe,strip'");
    expect(appSource).toContain("const unsupportedInputs = ['webp', 'heic', 'heif', 'avif', 'gif']");
    expect(appSource).toContain("const unsupportedOutputs = ['png', 'webp', 'heic', 'heif', 'avif'] as const");
    expect(appSource).toContain('Expected output.maxBytes to be unimplemented on iOS.');
    expect(appSource).toContain("Expected metadata: 'preserve' to be unimplemented on iOS.");
    expect(iosModuleSource).toContain('RCT_EXPORT_MODULE();');
    expect(iosModuleSource).toContain('copySampleJpegToCache');
    expect(iosModuleSource).toContain('copySamplePngToCache');
    expect(iosModuleSource).toContain('copyUnsupportedImageToCache');
    expect(iosModuleSource).toContain('RNICK_IOS_SMOKE');
    expect(iosModuleSource).toContain('UIImageJPEGRepresentation');
    expect(iosModuleSource).toContain('PNGDataWithActions');
    expect(iosModuleSource).toContain('"gif"');
    expect(iosModuleSource).toContain('"webp"');
    expect(iosModuleSource).toContain('"heic"');
    expect(iosModuleSource).toContain('"heif"');
    expect(iosModuleSource).toContain('"avif"');
  });

  it('lets Android users select and inspect JPEG metadata policy behavior', () => {
    const appSource = readProjectFile('example/src/App.tsx');

    expect(appSource).toContain('METADATA_POLICIES');
    expect(appSource).toContain("useState<MetadataPolicy>('safe')");
    expect(appSource).toContain('metadata: metadataPolicy');
    expect(appSource).toContain('setResultMetadataPolicy(metadataPolicy)');
    expect(appSource).toContain('supportedMetadataPolicies.includes(policy)');
    expect(appSource).toContain('label="selected metadata"');
    expect(appSource).toContain('label="metadataPolicies"');
    expect(appSource).toContain('label="metadata"');
  });
});
