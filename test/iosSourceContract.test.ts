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
    expect(header).toContain(
      '@interface RCTImageCompressionKit : NSObject <RCTBridgeModule>'
    );
    expect(header).toContain(
      '#if __has_include(<RNImageCompressionKitSpec/RNImageCompressionKitSpec.h>)'
    );
    expect(implementation).toContain('RCT_EXPORT_MODULE(ImageCompressionKit)');
    expect(implementation).toContain('#if RNICK_HAS_CODEGEN_SPEC');
    expect(implementation).toContain('getTurboModule:');
    expect(implementation).toContain(
      'compressImage:(JS::NativeImageCompressionKit::NativeCompressionOptions &)options'
    );
    expect(implementation).toContain('RCT_REMAP_METHOD(compressImage,');
    expect(implementation).toContain(
      'RCT_REMAP_METHOD(getImageCompressionCapabilities,'
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
    expect(podspec).toContain('"ios/RCTImageCompressionImageEncoder.h"');
    expect(podspec).toContain('"ios/RCTImageCompressionImageTransformer.h"');
    expect(podspec).toContain('"ios/RCTImageCompressionJpegMetadata.h"');
    expect(podspec).toContain('"ios/RCTImageCompressionOutput.h"');
    expect(podspec).toContain('"ios/RCTImageCompressionPipeline.h"');
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
    const pipeline = readProjectFile('ios/RCTImageCompressionPipeline.mm');
    const defaultPipeline = readProjectFile(
      'ios/RCTImageCompressionDefaultPipeline.mm'
    );
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
    expect(defaultPipeline).toMatch(
      /\[\s*RCTImageCompressionRequestParser\s+parseOptions:options/
    );
    expect(pipeline).toContain('self.requestParser(');
    expect(implementation.match(/options\[@/g)?.length).toBe(2);
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
    const pipeline = readProjectFile('ios/RCTImageCompressionPipeline.mm');
    const defaultPipeline = readProjectFile(
      'ios/RCTImageCompressionDefaultPipeline.mm'
    );
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
    expect(defaultPipeline).toMatch(
      /\[\s*RCTImageCompressionInputLoader\s+defaultLoader\]/
    );
    expect(defaultPipeline).toContain('loadSourceURI:sourceURI');
    expect(defaultPipeline).toContain('defaultAVIFInputAvailable');
    expect(pipeline).toContain('self.inputLoader(');
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

  it('isolates ImageIO downsampling from the non-blocking bridge boundary', () => {
    const header = readProjectFile('ios/RCTImageCompressionImageDecoder.h');
    const decoder = readProjectFile('ios/RCTImageCompressionImageDecoder.mm');
    const uiKitDecoder = readProjectFile(
      'ios/RCTImageCompressionUIKitImageDecoder.mm'
    );
    const capabilities = readProjectFile(
      'ios/RCTImageCompressionIOSCapabilities.mm'
    );
    const implementation = readProjectFile('ios/RCTImageCompressionKit.mm');
    const pipeline = readProjectFile('ios/RCTImageCompressionPipeline.mm');
    const defaultPipeline = readProjectFile(
      'ios/RCTImageCompressionDefaultPipeline.mm'
    );
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
    expect(uiKitDecoder).toContain('CGImageSourceCopyPropertiesAtIndex');
    expect(uiKitDecoder).toContain('CGImageSourceCreateThumbnailAtIndex');
    expect(uiKitDecoder).toContain('kCGImageSourceThumbnailMaxPixelSize');
    expect(uiKitDecoder).toContain('RCTImageCompressionKitMaxSourcePixels');
    expect(uiKitDecoder).toContain('RCTImageCompressionKitMaxWorkingPixels');
    expect(uiKitDecoder).not.toMatch(/(?:#import <UIKit|\bUIImage\s+imageWithData|dispatch_get_main_queue)/);
    expect(`${decoder}\n${uiKitDecoder}`).not.toMatch(
      /(?:RCTImageCompressionKit(?:Render|Encode|SourceImageProperties)|UIGraphicsImageRenderer|CGImageDestination|maxBytes|metadataPolicy|writeToFile:)/
    );
    expect(defaultPipeline).toContain(
      '[RCTImageCompressionImageDecoder defaultDecoder]'
    );
    expect(defaultPipeline).toContain('[decoder decodeInput:input resizeOptions:resizeOptions error:error]');
    expect(pipeline).toContain('RCTImageCompressionDecodedImage *decodedImage = self.imageDecoder(');
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
    expect(methodLines).toBeLessThanOrEqual(140);
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

  it('isolates resize geometry and CoreGraphics rendering behind native tables', () => {
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
    const pipeline = readProjectFile('ios/RCTImageCompressionPipeline.mm');
    const defaultPipeline = readProjectFile(
      'ios/RCTImageCompressionDefaultPipeline.mm'
    );
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
    expect(uiKitTransformer).toContain('CGBitmapContextCreate(');
    expect(uiKitTransformer).toContain('CGContextDrawImage(');
    expect(uiKitTransformer).toContain('CGContextSetRGBFillColor(context, 1.0, 1.0, 1.0, 1.0)');
    expect(uiKitTransformer).toContain('CGContextClearRect(');
    expect(uiKitTransformer).not.toMatch(/(?:#import <UIKit|UIGraphicsImageRenderer|dispatch_get_main_queue)/);
    expect(`${transformer}\n${uiKitTransformer}`).not.toMatch(
      /(?:RCTImageCompression(?:Input|Source)|metadataPolicy|CGImageDestination|maxBytes|writeToFile:|RCTImageCompressionKitEncode)/
    );
    expect(defaultPipeline).toContain(
      '[RCTImageCompressionImageTransformer defaultTransformer]'
    );
    expect(defaultPipeline).toContain(
      '[transformer transformRequest:request error:nil]'
    );
    expect(pipeline).toContain(
      'RCTImageCompressionImageTransformRequest *transformRequest'
    );
    expect(pipeline).toContain('self.imageTransformer(transformRequest)');
    expect(implementation).not.toMatch(
      /(?:UIGraphicsImageRenderer|drawInRect:|RCTImageCompressionKit(?:ContainSize|CoverSize|StretchSize|RenderImage))/
    );
    expect(implementation.split(/\r?\n/).length).toBeLessThanOrEqual(540);
    expect(methodLines).toBeLessThanOrEqual(140);
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

  it('isolates JPEG metadata policy and ImageIO properties behind native tables', () => {
    const header = readProjectFile('ios/RCTImageCompressionJpegMetadata.h');
    const metadata = readProjectFile('ios/RCTImageCompressionJpegMetadata.mm');
    const implementation = readProjectFile('ios/RCTImageCompressionKit.mm');
    const pipeline = readProjectFile('ios/RCTImageCompressionPipeline.mm');
    const defaultPipeline = readProjectFile(
      'ios/RCTImageCompressionDefaultPipeline.mm'
    );
    const nativeTests = readProjectFile(
      'test/ios-native/RCTImageCompressionJpegMetadataTests.mm'
    );
    const runner = readProjectFile('scripts/ios-validation.mjs');
    const metadataTestNames = [
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
      '@interface RCTImageCompressionJpegMetadataRequest : NSObject',
      '@interface RCTImageCompressionJpegMetadataError : NSObject',
      '@interface RCTImageCompressionJpegMetadataResult : NSObject',
      '@interface RCTImageCompressionJpegMetadata : NSObject',
      'RCTImageCompressionJpegSourcePropertyReader',
    ]) {
      expect(header).toContain(identifier);
    }
    expect(metadata).not.toMatch(/#import <(?:UIKit|React)/);
    expect(metadata).toContain('CGImageSourceCreateWithData');
    expect(metadata).toContain('CGImageSourceCopyPropertiesAtIndex');
    for (const propertyKey of [
      'kCGImageDestinationLossyCompressionQuality',
      'kCGImagePropertyPixelWidth',
      'kCGImagePropertyPixelHeight',
      'kCGImagePropertyOrientation',
      'kCGImagePropertyTIFFOrientation',
      'kCGImagePropertyExifPixelXDimension',
      'kCGImagePropertyExifPixelYDimension',
    ]) {
      expect(metadata).toContain(propertyKey);
    }
    expect(metadata).not.toMatch(
      /(?:CGImageDestinationCreateWithData|CGImageDestinationAddImage|CGImageDestinationFinalize|UIImage|maxBytes|writeToFile:|RCTPromise)/
    );
    expect(defaultPipeline).toContain(
      '[RCTImageCompressionJpegMetadata defaultMetadata]'
    );
    expect(defaultPipeline).toContain(
      '[metadata prepareRequest:request error:error]'
    );
    expect(pipeline).toContain(
      'RCTImageCompressionJpegMetadataRequest *metadataRequest'
    );
    expect(pipeline).toContain('self.metadataPreparer(');
    expect(implementation).not.toMatch(
      /(?:RCTImageCompressionKitSourceImageProperties|RCTImageCompressionKitJpegDestinationProperties|CGImageSourceCreateWithData|CGImageSourceCopyPropertiesAtIndex|kCGImageProperty(?:PixelWidth|PixelHeight|Orientation|TIFFDictionary|ExifDictionary))/
    );
    expect(implementation.split(/\r?\n/).length).toBeLessThanOrEqual(500);
    expect(methodLines).toBeLessThanOrEqual(140);
    expect(metadataTestNames).toEqual(
      expect.arrayContaining([
        'TestRejectsUnsupportedPreserveCombinations',
        'TestReadsSourcePropertiesOnlyForSupportedPreserve',
        'TestBuildsQualityOnlyPropertiesForSafeAndStrip',
        'TestNormalizesPreservedMetadataWithoutMutatingSource',
        'TestHandlesMissingAndMalformedSourceProperties',
        'TestUsesDefaultImageIOReaderAndImmutableModels',
        'TestClearsExistingErrorOnSuccess',
      ])
    );
    expect(metadataTestNames).toHaveLength(7);
    expect(packageJson.scripts['example:ios:metadata-test']).toBe(
      'node scripts/ios-validation.mjs metadata-test'
    );
    expect(runner).toContain("if (mode === 'metadata-test')");
    expect(runner).toMatch(
      /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);\s*runImageDecoderTests\(\);\s*runImageTransformerTests\(\);\s*runJpegMetadataTests\(\);/
    );
  });

  it('isolates output encoding and target-size search behind native tables', () => {
    const header = readProjectFile('ios/RCTImageCompressionImageEncoder.h');
    const encoder = readProjectFile('ios/RCTImageCompressionImageEncoder.mm');
    const uiKitEncoder = readProjectFile(
      'ios/RCTImageCompressionUIKitImageEncoder.mm'
    );
    const implementation = readProjectFile('ios/RCTImageCompressionKit.mm');
    const pipeline = readProjectFile('ios/RCTImageCompressionPipeline.mm');
    const defaultPipeline = readProjectFile(
      'ios/RCTImageCompressionDefaultPipeline.mm'
    );
    const nativeTests = readProjectFile(
      'test/ios-native/RCTImageCompressionImageEncoderTests.mm'
    );
    const runner = readProjectFile('scripts/ios-validation.mjs');
    const encoderTestNames = [
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
      '@interface RCTImageCompressionImageEncodeRequest : NSObject',
      '@interface RCTImageCompressionImageEncodeError : NSObject',
      '@interface RCTImageCompressionEncodedImage : NSObject',
      '@interface RCTImageCompressionImageEncoder : NSObject',
      'RCTImageCompressionJpegImageEncoder',
      'RCTImageCompressionPngImageEncoder',
      'RCTImageCompressionWebPImageEncoder',
      'RCTImageCompressionImageEncodeExecutor',
    ]) {
      expect(header).toContain(identifier);
    }
    expect(encoder).not.toMatch(/#import <(?:UIKit|ImageIO|React)/);
    expect(encoder).toContain('RCTImageCompressionKitMinQuality');
    expect(encoder).toContain('while (low <= high)');
    expect(uiKitEncoder).toContain('@"public.png"');
    expect(uiKitEncoder).toContain('CGImageDestinationCopyTypeIdentifiers');
    expect(uiKitEncoder).toContain('CGImageDestinationCreateWithData');
    expect(uiKitEncoder).toContain('CGImageDestinationAddImage');
    expect(uiKitEncoder).toContain('CGImageDestinationFinalize');
    expect(uiKitEncoder).toContain('org.webmproject.webp');
    expect(uiKitEncoder).toContain('public.webp');
    expect(uiKitEncoder).toContain(
      'destinationPropertiesForQuality:quality'
    );
    expect(uiKitEncoder).not.toMatch(/(?:#import <UIKit|UIImagePNGRepresentation|dispatch_get_main_queue)/);
    expect(`${encoder}\n${uiKitEncoder}`).not.toMatch(
      /(?:RCTImageCompression(?:Input|ImageDecoder|ImageTransformer)|UIGraphicsImageRenderer|writeToFile:|NSCachesDirectory|RCTPromise)/
    );
    expect(defaultPipeline).toContain(
      '[RCTImageCompressionImageEncoder defaultEncoder]'
    );
    expect(defaultPipeline).toContain('[encoder encodeRequest:request error:error]');
    expect(defaultPipeline).toContain(
      '[RCTImageCompressionImageEncoder defaultWebPOutputAvailable]'
    );
    expect(pipeline).toContain(
      'RCTImageCompressionImageEncodeRequest *encodeRequest'
    );
    expect(pipeline).toContain('self.imageEncoder(encodeRequest, &encodeError)');
    expect(implementation).not.toMatch(
      /(?:CGImageDestination|UIImagePNGRepresentation|RCTImageCompressionKitEncode(?:Jpeg|Png|WebP|QualityOutput|ToTargetSize)|while \(low <= high\))/
    );
    expect(implementation.split(/\r?\n/).length).toBeLessThanOrEqual(380);
    expect(methodLines).toBeLessThanOrEqual(140);
    expect(encoderTestNames).toEqual(
      expect.arrayContaining([
        'TestRoutesFormatMatrixInsideExecutor',
        'TestReturnsQualityCapWhenWithinTarget',
        'TestFindsHighestQualityWithinTarget',
        'TestReturnsSmallestOutputWhenTargetCannotBeMet',
        'TestRejectsMissingOutputsAndSkippedExecutor',
        'TestCopiesImmutableRequestResultAndErrorModels',
        'TestClearsExistingErrorOnSuccess',
        'TestCancelsTargetSizeSearchWithStableError',
      ])
    );
    expect(encoderTestNames).toHaveLength(8);
    expect(packageJson.scripts['example:ios:encoder-test']).toBe(
      'node scripts/ios-validation.mjs encoder-test'
    );
    expect(runner).toContain("if (mode === 'encoder-test')");
    expect(runner).toMatch(
      /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);\s*runImageDecoderTests\(\);\s*runImageTransformerTests\(\);\s*runJpegMetadataTests\(\);\s*runImageEncoderTests\(\);/
    );
  });

  it('isolates output persistence and result projection behind native tables', () => {
    const header = readProjectFile('ios/RCTImageCompressionOutput.h');
    const output = readProjectFile('ios/RCTImageCompressionOutput.mm');
    const implementation = readProjectFile('ios/RCTImageCompressionKit.mm');
    const pipeline = readProjectFile('ios/RCTImageCompressionPipeline.mm');
    const defaultPipeline = readProjectFile(
      'ios/RCTImageCompressionDefaultPipeline.mm'
    );
    const nativeTests = readProjectFile(
      'test/ios-native/RCTImageCompressionOutputTests.mm'
    );
    const runner = readProjectFile('scripts/ios-validation.mjs');
    const outputTestNames = [
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
      '@interface RCTImageCompressionOutputRequest : NSObject',
      '@interface RCTImageCompressionOutputError : NSObject',
      '@interface RCTImageCompressionOutputResult : NSObject',
      '@interface RCTImageCompressionOutput : NSObject',
      'RCTImageCompressionOutputCacheDirectoryProvider',
      'RCTImageCompressionOutputPathExists',
      'RCTImageCompressionOutputDirectoryCreator',
      'RCTImageCompressionOutputClock',
      'RCTImageCompressionOutputUUIDProvider',
      'RCTImageCompressionOutputFileWriter',
    ]) {
      expect(header).toContain(identifier);
    }
    expect(output).not.toMatch(/#import <(?:UIKit|ImageIO|React)/);
    expect(output).toContain('NSCachesDirectory');
    expect(output).toContain('createDirectoryAtPath:path');
    expect(output).toContain('NSDataWritingAtomic');
    expect(output).toContain('compressionRatio =');
    expect(output).toContain('dictionaryRepresentation');
    expect(output).not.toMatch(
      /(?:UIImage|CGImageDestination|UIGraphicsImageRenderer|metadataPolicy|maxBytes|RCTPromise)/
    );
    expect(defaultPipeline).toContain(
      '[RCTImageCompressionOutput defaultOutput]'
    );
    expect(defaultPipeline).toContain(
      '[output persistRequest:request error:error]'
    );
    expect(pipeline).toContain(
      'RCTImageCompressionOutputRequest *outputRequest'
    );
    expect(pipeline).toContain('self.outputWriter(outputRequest, &outputError)');
    expect(implementation).not.toMatch(
      /(?:NSCachesDirectory|createDirectoryAtPath|writeToFile:|RCTImageCompressionKitOutputPath|RCTImageCompressionKitResult|compressionRatio|originalByteSize\s*=)/
    );
    expect(implementation.split(/\r?\n/).length).toBeLessThanOrEqual(360);
    expect(methodLines).toBeLessThanOrEqual(140);
    expect(outputTestNames).toEqual(
      expect.arrayContaining([
        'TestBuildsFormatPathsAndPersistsBytes',
        'TestReusesExistingDirectoryAndFallsBackToTemporaryPath',
        'TestProjectsResultMetricsAndZeroSourceRatio',
        'TestRejectsDirectoryCreationFailureWithStableError',
        'TestRejectsWriteFailureMatrixWithStableErrors',
        'TestCopiesImmutableRequestResultAndErrorModels',
        'TestClearsExistingErrorOnSuccess',
      ])
    );
    expect(outputTestNames).toHaveLength(7);
    expect(packageJson.scripts['example:ios:output-test']).toBe(
      'node scripts/ios-validation.mjs output-test'
    );
    expect(runner).toContain("if (mode === 'output-test')");
    expect(runner).toMatch(
      /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);\s*runImageDecoderTests\(\);\s*runImageTransformerTests\(\);\s*runJpegMetadataTests\(\);\s*runImageEncoderTests\(\);\s*runOutputTests\(\);/
    );
  });

  it('isolates compression orchestration behind an injected pipeline', () => {
    const header = readProjectFile('ios/RCTImageCompressionPipeline.h');
    const pipeline = readProjectFile('ios/RCTImageCompressionPipeline.mm');
    const defaultPipeline = readProjectFile(
      'ios/RCTImageCompressionDefaultPipeline.mm'
    );
    const implementation = readProjectFile('ios/RCTImageCompressionKit.mm');
    const nativeTests = readProjectFile(
      'test/ios-native/RCTImageCompressionPipelineTests.mm'
    );
    const runner = readProjectFile('scripts/ios-validation.mjs');
    const pipelineTestNames = [
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
      '@interface RCTImageCompressionPipelineRequest : NSObject',
      '@interface RCTImageCompressionPipelineResult : NSObject',
      '@interface RCTImageCompressionPipelineError : NSObject',
      '@interface RCTImageCompressionPipeline : NSObject',
      'RCTImageCompressionPipelineRuntimeAvailability',
      'RCTImageCompressionPipelineRequestParser',
      'RCTImageCompressionPipelineInputLoader',
      'RCTImageCompressionPipelineMetadataPreparer',
      'RCTImageCompressionPipelineImageDecoder',
      'RCTImageCompressionPipelineImageTransformer',
      'RCTImageCompressionPipelineImageEncoder',
      'RCTImageCompressionPipelineOutputWriter',
      'RCTImageCompressionPipelineStageObserver',
    ]) {
      expect(header).toContain(identifier);
    }
    expect(pipeline).not.toMatch(/#import <(?:UIKit|ImageIO|React)/);
    for (const stageCall of [
      'self.requestParser(',
      'self.inputLoader(',
      'self.metadataPreparer(',
      'self.imageDecoder(',
      'self.imageTransformer(',
      'self.imageEncoder(',
      'self.outputWriter(',
    ]) {
      expect(pipeline).toContain(stageCall);
    }
    expect(pipeline).toContain('self.webPOutputAvailability');
    expect(pipeline).toContain('self.avifInputAvailability');
    expect(pipeline).toContain('self.stageObserver(');
    expect(pipeline).toContain('RCTImageCompressionKitNativeOperationFailedCode');
    expect(defaultPipeline).toContain('CGImageSourceCopyTypeIdentifiers');
    expect(defaultPipeline).toContain('RNICK_IOS_SMOKE_NATIVE %@');
    for (const defaultOwner of [
      'RCTImageCompressionInputLoader defaultLoader',
      'RCTImageCompressionJpegMetadata defaultMetadata',
      'RCTImageCompressionImageDecoder defaultDecoder',
      'RCTImageCompressionImageTransformer defaultTransformer',
      'RCTImageCompressionImageEncoder defaultEncoder',
      'RCTImageCompressionOutput defaultOutput',
    ]) {
      expect(defaultPipeline).toContain(defaultOwner);
    }
    expect(implementation).toContain(
      '[RCTImageCompressionPipeline defaultPipeline]'
    );
    expect(implementation).toContain('executeRequest:request');
    expect(implementation).toContain('cancellationCheck:^BOOL');
    expect(implementation).toMatch(
      /operation\.resolve\(result\.dictionaryRepresentation\);\s*\[pipeline notifyResolved\];/
    );
    expect(implementation).not.toMatch(
      /#import "RCTImageCompression(?:Input|ImageDecoder|ImageTransformer|JpegMetadata|ImageEncoder)\.h"/
    );
    expect(implementation).not.toMatch(
      /(?:defaultLoader|defaultDecoder|defaultTransformer|defaultMetadata|defaultEncoder|defaultOutput|loadSourceURI:|decodeInput:|transformRequest:|encodeRequest:|persistRequest:|CGImageSource|RNICK_IOS_SMOKE_NATIVE)/
    );
    expect(implementation).toContain('maxConcurrentOperationCount = RCTImageCompressionKitMaxConcurrentOperations');
    expect(implementation).toContain('cancelCompression:(NSString *)operationID');
    expect(implementation).not.toContain('dispatch_get_main_queue');
    expect(implementation.split(/\r?\n/).length).toBeLessThanOrEqual(360);
    expect(methodLines).toBeLessThanOrEqual(145);
    expect(pipeline.split(/\r?\n/).length).toBeLessThanOrEqual(350);
    expect(defaultPipeline.split(/\r?\n/).length).toBeLessThanOrEqual(160);
    expect(pipelineTestNames).toEqual(
      expect.arrayContaining([
        'TestRunsSuccessStagesAndForwardsRequests',
        'TestForwardsFailureMatrixWithoutRunningDownstreamStages',
        'TestUsesInjectedRuntimeCapabilityProviders',
        'TestConvertsExceptionStageMatrixToNativeFailure',
        'TestCopiesImmutableRequestResultAndErrorModels',
        'TestClearsExistingErrorAndNotifiesResolution',
      ])
    );
    expect(pipelineTestNames).toHaveLength(6);
    expect(packageJson.scripts['example:ios:pipeline-test']).toBe(
      'node scripts/ios-validation.mjs pipeline-test'
    );
    expect(runner).toContain("if (mode === 'pipeline-test')");
    expect(runner).toMatch(
      /if \(mode === 'smoke'\) \{[\s\S]*?runRequestParserTests\(\);\s*runInputTests\(\);\s*runImageDecoderTests\(\);\s*runImageTransformerTests\(\);\s*runJpegMetadataTests\(\);\s*runImageEncoderTests\(\);\s*runOutputTests\(\);\s*runPipelineTests\(\);/
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
    const exampleSmoke = readProjectFile('example/src/iosSmoke.ts');
    const exampleModule = readProjectFile(
      'example/ios/ImageCompressionKitExample/ExampleImageSource.m'
    );
    expect(exampleSmoke).toContain('RNICK_IOS_SMOKE_START');
    expect(exampleApp).toContain('RNICK_IOS_SMOKE_PASS');
    expect(exampleApp).toContain('RNICK_IOS_SMOKE_FAIL');
    expect(exampleApp).toContain('runIOSHostAppSmokeValidation');
    expect(exampleSmoke).toContain('export async function runIOSHostAppSmokeValidation');
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
