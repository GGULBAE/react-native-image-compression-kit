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
    expect(podspec).toContain('"ios/RCTImageCompressionImageDecoder.h"');
    expect(podspec).toContain('"ios/RCTImageCompressionImageTransformer.h"');
    expect(podspec).toContain('"ios/RCTImageCompressionInput.h"');
    expect(podspec).toContain('"ios/RCTImageCompressionIOSCapabilities.h"');
    expect(podspec).toContain('"ios/RCTImageCompressionRequest.h"');
    expect(podspec).toContain('install_modules_dependencies(s)');
    expect(podspec).toContain('s.dependency "React-Core"');
  });

  it('isolates immutable request parsing behind executable native tests', () => {
    const header = readProjectFile('ios/RCTImageCompressionRequest.h');
    const parser = readProjectFile('ios/RCTImageCompressionRequest.mm');
    const implementation = readProjectFile('ios/RCTImageCompressionKit.mm');
    const nativeTests = readProjectFile(
      'test/ios-native/RCTImageCompressionRequestTests.mm'
    );
    const runner = readProjectFile('scripts/ios-validation.mjs');
    const parserTestNames = [
      ...nativeTests.matchAll(/static void (Test\w+)\(void\)/g),
    ].map((match) => match[1]);
    const methodStart = implementation.indexOf(
      '- (void)compressImageWithDictionary:'
    );
    const methodEnd = implementation.indexOf(
      '- (void)getImageCompressionCapabilities:',
      methodStart
    );
    const methodLines = implementation
      .slice(methodStart, methodEnd)
      .split(/\r?\n/).length;

    expect(header).toContain('@interface RCTImageCompressionRequest : NSObject');
    expect(header).toContain(
      '@interface RCTImageCompressionRequestParser : NSObject'
    );
    expect(header).toContain(
      '@property (nonatomic, copy, readonly) NSString *sourceURI;'
    );
    expect(header).toContain(
      '@property (nonatomic, readonly) RCTImageCompressionKitResizeOptions resizeOptions;'
    );
    expect(parser).not.toMatch(/#import <(?:UIKit|ImageIO|React)/);
    expect(parser).not.toMatch(/\b(?:RCTPromise|UIImage|CGImage)\b/);
    expect(parser).not.toContain('[NSData dataWithContentsOf');
    expect(parser).not.toContain('writeToFile:');
    expect(implementation).toMatch(
      /\[\s*RCTImageCompressionRequestParser\s+parseOptions:options/
    );
    expect(implementation).not.toMatch(/\boptions\[@/);
    expect(implementation.split(/\r?\n/).length).toBeLessThanOrEqual(1_100);
    expect(methodLines).toBeLessThanOrEqual(190);
    expect(parserTestNames).toEqual(
      expect.arrayContaining([
        'TestParsesDefaultsIntoImmutableRequest',
        'TestParsesMetadataAndResizeMatrix',
        'TestRejectsMissingAndMalformedRequiredOptions',
        'TestRejectsInvalidQualityAndMaxBytes',
        'TestRejectsUnsupportedOutputAndStaticCombinations',
        'TestRejectsInvalidMetadataAndResizeMatrix',
      ])
    );
    expect(parserTestNames).toHaveLength(6);
    expect(packageJson.scripts['example:ios:request-parser-test']).toBe(
      'node scripts/ios-validation.mjs request-parser-test'
    );
    expect(packageJson.scripts['example:ios:request-test']).toBe(
      'node scripts/ios-validation.mjs request-parser-test'
    );
    expect(runner).toContain("if (mode === 'request-parser-test')");
    expect(runner).toMatch(
      /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);/
    );
  });

  it('isolates source acquisition and input inspection behind native tables', () => {
    const header = readProjectFile('ios/RCTImageCompressionInput.h');
    const resolver = readProjectFile(
      'ios/RCTImageCompressionSourceResolver.mm'
    );
    const inspector = readProjectFile(
      'ios/RCTImageCompressionInputInspector.mm'
    );
    const implementation = readProjectFile('ios/RCTImageCompressionKit.mm');
    const nativeTests = readProjectFile(
      'test/ios-native/RCTImageCompressionInputTests.mm'
    );
    const runner = readProjectFile('scripts/ios-validation.mjs');
    const inputTestNames = [
      ...nativeTests.matchAll(/static void (Test\w+)\(void\)/g),
    ].map((match) => match[1]);
    const methodStart = implementation.indexOf(
      '- (void)compressImageWithDictionary:'
    );
    const methodEnd = implementation.indexOf(
      '- (void)getImageCompressionCapabilities:',
      methodStart
    );
    const methodLines = implementation
      .slice(methodStart, methodEnd)
      .split(/\r?\n/).length;

    for (const identifier of [
      '@interface RCTImageCompressionSource : NSObject',
      '@interface RCTImageCompressionSourceResolver : NSObject',
      '@interface RCTImageCompressionInputInspection : NSObject',
      '@interface RCTImageCompressionInputInspector : NSObject',
      '@interface RCTImageCompressionInputLoader : NSObject',
    ]) {
      expect(header).toContain(identifier);
    }
    expect(resolver).not.toMatch(/#import <(?:ImageIO|UIKit|React)/);
    expect(resolver).not.toMatch(/\b(?:UIImage|CGImage|RCTPromise)\b/);
    expect(inspector).not.toMatch(/#import <(?:UIKit|React)/);
    expect(inspector).not.toMatch(
      /(?:startAccessingSecurityScopedResource|dataWithContentsOfURL|writeToFile:)/
    );
    expect(implementation).toMatch(
      /\[\s*RCTImageCompressionInputLoader\s+defaultLoader\]/
    );
    expect(implementation).toMatch(
      /loadSourceURI:request\.sourceURI[\s\S]*?avifInputAvailability:\^BOOL\{[\s\S]*?RCTImageCompressionKitCanDecodeAVIF\(\)/
    );
    expect(implementation).not.toMatch(
      /(?:startAccessingSecurityScopedResource|dataWithContentsOfURL|RCTImageCompressionKit(?:SourceURL|ReadSourceData|ImageType|LooksLikeAVIFData|IsSupportedInputType|IsJpegType))/
    );
    expect(implementation.split(/\r?\n/).length).toBeLessThanOrEqual(850);
    expect(methodLines).toBeLessThanOrEqual(140);
    expect(inputTestNames).toEqual(
      expect.arrayContaining([
        'TestResolvesFileAndContentSourcesWithImmutableBytes',
        'TestRejectsUnsupportedSourceSchemesWithoutLoading',
        'TestClosesSecurityScopeForUnreadableAndEmptySources',
        'TestClosesSecurityScopeWhenLoaderThrows',
        'TestDefaultResolverReadsFileData',
        'TestClassifiesSupportedTypeIdentifierMatrix',
        'TestRejectsUnavailableAndSignatureOnlyAVIF',
        'TestRejectsUnknownAndUninspectableFormats',
        'TestPreservesSignatureClassificationOrder',
        'TestDefaultImageIOLoaderInspectsPNG',
        'TestInputLoaderComposesResolverAndInspector',
      ])
    );
    expect(inputTestNames).toHaveLength(11);
    expect(packageJson.scripts['example:ios:input-test']).toBe(
      'node scripts/ios-validation.mjs input-test'
    );
    expect(runner).toContain("if (mode === 'input-test')");
    expect(runner).toMatch(
      /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);/
    );
  });

  it('isolates image decoding and main-thread ownership behind native tables', () => {
    const header = readProjectFile('ios/RCTImageCompressionImageDecoder.h');
    const decoder = readProjectFile('ios/RCTImageCompressionImageDecoder.mm');
    const uiKitDecoder = readProjectFile(
      'ios/RCTImageCompressionUIKitImageDecoder.mm'
    );
    const capabilities = readProjectFile(
      'ios/RCTImageCompressionIOSCapabilities.mm'
    );
    const implementation = readProjectFile('ios/RCTImageCompressionKit.mm');
    const nativeTests = readProjectFile(
      'test/ios-native/RCTImageCompressionImageDecoderTests.mm'
    );
    const runner = readProjectFile('scripts/ios-validation.mjs');
    const decoderTestNames = [
      ...nativeTests.matchAll(/static void (Test\w+)\(void\)/g),
    ].map((match) => match[1]);
    const methodStart = implementation.indexOf(
      '- (void)compressImageWithDictionary:'
    );
    const methodEnd = implementation.indexOf(
      '- (void)getImageCompressionCapabilities:',
      methodStart
    );
    const methodLines = implementation
      .slice(methodStart, methodEnd)
      .split(/\r?\n/).length;

    for (const identifier of [
      '@interface RCTImageCompressionImageDecodeError : NSObject',
      '@interface RCTImageCompressionDecodedImage : NSObject',
      '@interface RCTImageCompressionImageDecoder : NSObject',
      'RCTImageCompressionOrdinaryImageDecoder',
      'RCTImageCompressionFirstFrameImageDecoder',
      'RCTImageCompressionDecodedImageValidator',
      'RCTImageCompressionImageDecodeExecutor',
    ]) {
      expect(header).toContain(identifier);
    }
    expect(decoder).not.toMatch(/#import <(?:UIKit|ImageIO|React)/);
    expect(decoder).toContain('input.shouldDecodeFirstFrame');
    expect(decoder).toContain('RCTImageCompressionKitDecodeFailedCode');
    expect(decoder).toContain(
      '@"iOS MVP could not decode the source image."'
    );
    expect(uiKitDecoder).toContain('[UIImage imageWithData:data]');
    expect(uiKitDecoder).toContain('CGImageSourceCreateImageAtIndex');
    expect(uiKitDecoder).toContain('[NSThread isMainThread]');
    expect(uiKitDecoder).toContain('dispatch_sync(dispatch_get_main_queue()');
    expect(`${decoder}\n${uiKitDecoder}`).not.toMatch(
      /(?:RCTImageCompressionKit(?:Render|Encode|SourceImageProperties)|UIGraphicsImageRenderer|CGImageDestination|maxBytes|metadataPolicy|writeToFile:)/
    );
    expect(implementation).toMatch(
      /\[\s*\[RCTImageCompressionImageDecoder\s+defaultDecoder\]\s+decodeInput:input\s+error:&decodeError\s*\]/
    );
    expect(implementation).toContain(
      'RCTImageCompressionIOSFormatCapabilities('
    );
    expect(capabilities).toContain(
      'NSArray<NSDictionary *> *RCTImageCompressionIOSFormatCapabilities('
    );
    expect(capabilities).toContain('RCTImageCompressionKitGifFormat');
    expect(implementation).not.toMatch(
      /(?:\[UIImage\s+imageWithData:|CGImageSourceCreateImageAtIndex|RCTImageCompressionKitDecodeImage)/
    );
    expect(implementation.split(/\r?\n/).length).toBeLessThanOrEqual(720);
    expect(methodLines).toBeLessThanOrEqual(115);
    expect(decoderTestNames).toEqual(
      expect.arrayContaining([
        'TestRoutesStaticAndFirstFrameFormats',
        'TestRejectsMissingAndInvalidDecodedImages',
        'TestRejectsWhenExecutorDoesNotRunOperation',
        'TestRunsDecodeAndValidationInsideExecutor',
        'TestRetainsDecodedImageAndCopiesErrors',
        'TestClearsExistingErrorOnSuccess',
      ])
    );
    expect(decoderTestNames).toHaveLength(6);
    expect(packageJson.scripts['example:ios:decoder-test']).toBe(
      'node scripts/ios-validation.mjs decoder-test'
    );
    expect(runner).toContain("if (mode === 'decoder-test')");
    expect(runner).toMatch(
      /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);\s*runImageDecoderTests\(\);/
    );
  });

  it('isolates resize geometry and UIKit rendering behind native tables', () => {
    const header = readProjectFile(
      'ios/RCTImageCompressionImageTransformer.h'
    );
    const transformer = readProjectFile(
      'ios/RCTImageCompressionImageTransformer.mm'
    );
    const uiKitTransformer = readProjectFile(
      'ios/RCTImageCompressionUIKitImageTransformer.mm'
    );
    const implementation = readProjectFile('ios/RCTImageCompressionKit.mm');
    const nativeTests = readProjectFile(
      'test/ios-native/RCTImageCompressionImageTransformerTests.mm'
    );
    const runner = readProjectFile('scripts/ios-validation.mjs');
    const transformerTestNames = [
      ...nativeTests.matchAll(/static void (Test\w+)\(void\)/g),
    ].map((match) => match[1]);
    const methodStart = implementation.indexOf(
      '- (void)compressImageWithDictionary:'
    );
    const methodEnd = implementation.indexOf(
      '- (void)getImageCompressionCapabilities:',
      methodStart
    );
    const methodLines = implementation
      .slice(methodStart, methodEnd)
      .split(/\r?\n/).length;

    for (const identifier of [
      '@interface RCTImageCompressionImageGeometry : NSObject',
      '@interface RCTImageCompressionImageTransformRequest : NSObject',
      '@interface RCTImageCompressionImageTransformError : NSObject',
      '@interface RCTImageCompressionTransformedImage : NSObject',
      '@interface RCTImageCompressionImageTransformer : NSObject',
      'RCTImageCompressionImagePixelSizeProvider',
      'RCTImageCompressionImageRenderer',
      'RCTImageCompressionImageTransformExecutor',
    ]) {
      expect(header).toContain(identifier);
    }
    expect(transformer).not.toMatch(/#import <(?:UIKit|ImageIO|React)/);
    expect(transformer).toContain(
      'RCTImageCompressionImageGeometryCalculate('
    );
    expect(transformer).toContain(
      'RCTImageCompressionKitImageTransformFailedCode'
    );
    expect(uiKitTransformer).toContain('UIGraphicsImageRenderer');
    expect(uiKitTransformer).toContain('image.size.width * image.scale');
    expect(uiKitTransformer).toContain('image.size.height * image.scale');
    expect(uiKitTransformer).toContain('[UIColor whiteColor]');
    expect(uiKitTransformer).toContain('[UIColor clearColor]');
    expect(uiKitTransformer).toContain('[image drawInRect:geometry.drawRect]');
    expect(uiKitTransformer).toContain('[NSThread isMainThread]');
    expect(uiKitTransformer).toContain(
      'dispatch_sync(dispatch_get_main_queue()'
    );
    expect(`${transformer}\n${uiKitTransformer}`).not.toMatch(
      /(?:RCTImageCompression(?:Input|Source)|metadataPolicy|CGImageDestination|maxBytes|writeToFile:|RCTImageCompressionKitEncode)/
    );
    expect(implementation).toMatch(
      /\[\s*\[RCTImageCompressionImageTransformer\s+defaultTransformer\]\s+transformRequest:request\s+error:nil\s*\]/
    );
    expect(implementation).toContain(
      'RCTImageCompressionKitTransformImage(decodedImage.image, request.resizeOptions, request.outputIsJpeg)'
    );
    expect(implementation).not.toMatch(
      /(?:UIGraphicsImageRenderer|drawInRect:|RCTImageCompressionKit(?:ContainSize|CoverSize|StretchSize|RenderImage))/
    );
    expect(implementation.split(/\r?\n/).length).toBeLessThanOrEqual(540);
    expect(methodLines).toBeLessThanOrEqual(120);
    expect(transformerTestNames).toEqual(
      expect.arrayContaining([
        'TestCalculatesGeometryMatrix',
        'TestForwardsOpaqueAndTransparentRendererRequests',
        'TestRunsPixelGeometryAndRendererInsideExecutor',
        'TestRejectsMissingRenderAndSkippedExecutor',
        'TestRetainsImmutableRequestResultAndErrorModels',
        'TestClearsExistingErrorOnSuccess',
      ])
    );
    expect(transformerTestNames).toHaveLength(6);
    for (const geometryCase of [
      'no-resize-landscape',
      'contain-landscape',
      'contain-portrait',
      'width-only',
      'height-only',
      'stretch-both',
      'cover-landscape-center-crop',
      'cover-portrait-center-crop',
      'cover-no-upscale',
    ]) {
      expect(nativeTests).toContain(`"${geometryCase}"`);
    }
    expect(packageJson.scripts['example:ios:transformer-test']).toBe(
      'node scripts/ios-validation.mjs transformer-test'
    );
    expect(runner).toContain("if (mode === 'transformer-test')");
    expect(runner).toMatch(
      /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);\s*runImageDecoderTests\(\);\s*runImageTransformerTests\(\);/
    );
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
