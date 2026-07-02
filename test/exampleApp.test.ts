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
    expect(appSource).toContain('Android MVP / iOS JPEG+PNG+runtime WebP');
    expect(appSource).toContain('editable={supportsSelectedTargetSize}');
    expect(appSource).toContain('label="selected output"');
    expect(appSource).toContain('label="output formats"');
    expect(appSource).toContain('label="format"');
  });

  it('wires an iOS host-app smoke runner for native JPEG/PNG/GIF/WebP MVP validation', () => {
    const appSource = readProjectFile('example/src/App.tsx');
    const iosModuleSource = readProjectFile(
      'example/ios/ImageCompressionKitExample/ExampleImageSource.m'
    );

    expect(appSource).toContain("Platform.OS !== 'ios'");
    expect(appSource).toContain('isSmokeTestEnabled');
    expect(appSource).toContain('logSmokeEvent');
    expect(appSource).toContain('emitIOSSmokeLog');
    expect(appSource).toContain('runIOSHostAppSmokeValidation');
    expect(appSource).toContain('RNICK_IOS_SMOKE_START');
    expect(appSource).toContain('RNICK_IOS_SMOKE_STEP_START');
    expect(appSource).toContain('ERR_IOS_SMOKE_TIMEOUT');
    expect(appSource).toContain('RNICK_IOS_SMOKE_PASS');
    expect(appSource).toContain('RNICK_IOS_SMOKE_FAIL');
    expect(appSource).toContain('copySamplePngToCache');
    expect(appSource).toContain('copyUnsupportedImageToCache');
    expect(appSource).toContain("capabilities.platform === 'ios'");
    expect(appSource).toContain("metadataPolicies.join(',') === 'safe,strip'");
    expect(appSource).toContain("assertIOSFormatCapability(capabilities, 'gif', true, false)");
    expect(appSource).toContain("assertIOSFormatCapability(capabilities, 'webp', true)");
    expect(appSource).toContain('webpOutputAvailable');
    expect(appSource).toContain(
      'Expected iOS JPEG target-size compression to be supported.'
    );
    expect(appSource).toContain('compress-jpeg-to-jpeg-max-bytes');
    expect(appSource).toContain('copy-gif-fixture');
    expect(appSource).toContain('copy-webp-fixture');
    expect(appSource).toContain('compress-gif-to-jpeg');
    expect(appSource).toContain('compress-gif-to-png');
    expect(appSource).toContain('compress-webp-to-jpeg');
    expect(appSource).toContain('compress-webp-to-png');
    expect(appSource).toContain('compress-jpeg-to-webp');
    expect(appSource).toContain('compress-png-to-webp');
    expect(appSource).toContain('compress-gif-to-webp');
    expect(appSource).toContain('compress-webp-to-webp');
    expect(appSource).toContain('reject-webp-output-unavailable');
    expect(appSource).toContain('reject-gif-output');
    expect(appSource).toContain('compress-webp-to-webp-max-bytes');
    expect(appSource).toContain('gifResultBytes');
    expect(appSource).toContain('gifToPngResultBytes');
    expect(appSource).toContain('webpResultBytes');
    expect(appSource).toContain('webpToPngResultBytes');
    expect(appSource).toContain('jpegToWebPResultBytes');
    expect(appSource).toContain('pngToWebPResultBytes');
    expect(appSource).toContain('gifToWebPResultBytes');
    expect(appSource).toContain('webpToWebPResultBytes');
    expect(appSource).toContain('webpTargetSizeResultBytes');
    expect(appSource).toContain(
      'Expected iOS target-size output <= ${targetSizeMaxBytes} bytes'
    );
    expect(appSource).toContain(
      'Expected iOS GIF target-size output <= ${targetSizeMaxBytes} bytes'
    );
    expect(appSource).toContain(
      'Expected iOS WebP output target-size <= ${targetSizeMaxBytes} bytes'
    );
    expect(appSource).toContain(
      'Expected GIF output to be rejected before native compression.'
    );
    expect(appSource).toContain("const unsupportedInputs = ['heic', 'heif', 'avif']");
    expect(appSource).toContain('const unsupportedOutputCases = [');
    expect(appSource).toContain('compress-jpeg-to-png');
    expect(appSource).toContain('compress-png-to-png');
    expect(appSource).toContain('reject-png-max-bytes');
    expect(appSource).toContain('Expected PNG maxBytes to be unsupported on iOS.');
    expect(appSource).toContain("Expected metadata: 'preserve' to be unimplemented on iOS.");
    expect(iosModuleSource).toContain('RCT_EXPORT_MODULE();');
    expect(iosModuleSource).toContain('copySampleJpegToCache');
    expect(iosModuleSource).toContain('copySamplePngToCache');
    expect(iosModuleSource).toContain('copyUnsupportedImageToCache');
    expect(iosModuleSource).toContain('logSmokeEvent');
    expect(iosModuleSource).toContain('RNICK_IOS_SMOKE');
    expect(iosModuleSource).toContain('--rnick-ios-smoke');
    expect(iosModuleSource).toContain('NSLog');
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
