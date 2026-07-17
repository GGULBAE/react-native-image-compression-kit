#import "RCTImageCompressionKit.h"
#import "RCTImageCompressionImageDecoder.h"
#import "RCTImageCompressionImageEncoder.h"
#import "RCTImageCompressionImageTransformer.h"
#import "RCTImageCompressionInput.h"
#import "RCTImageCompressionIOSCapabilities.h"
#import "RCTImageCompressionJpegMetadata.h"
#import "RCTImageCompressionRequest.h"

#import <ImageIO/ImageIO.h>
#import <UIKit/UIKit.h>

#include <memory>

static NSString *const RCTImageCompressionKitNativeOperationFailedCode = @"ERR_NATIVE_OPERATION_FAILED";

static void RCTImageCompressionKitReject(
  RCTPromiseRejectBlock reject,
  NSString *code,
  NSString *message,
  NSError *error
) {
  reject(code, message, error);
}

static BOOL RCTImageCompressionKitSmokeEnabled(void)
{
  NSProcessInfo *processInfo = [NSProcessInfo processInfo];
  NSString *enabled = processInfo.environment[@"RNICK_IOS_SMOKE"];
  NSString *simctlEnabled = processInfo.environment[@"SIMCTL_CHILD_RNICK_IOS_SMOKE"];

  return
    [enabled isEqualToString:@"1"] ||
    [simctlEnabled isEqualToString:@"1"] ||
    [processInfo.arguments containsObject:@"--rnick-ios-smoke"];
}

static void RCTImageCompressionKitSmokeLog(NSString *stage)
{
  if (RCTImageCompressionKitSmokeEnabled()) {
    NSLog(@"RNICK_IOS_SMOKE_NATIVE %@", stage);
  }
}

static BOOL RCTImageCompressionKitCanDecodeAVIF(void)
{
  NSArray<NSString *> *supportedTypes = CFBridgingRelease(
    CGImageSourceCopyTypeIdentifiers()
  );
  for (NSString *imageType in RCTImageCompressionAVIFTypeIdentifiers()) {
    if ([supportedTypes containsObject:imageType]) {
      return YES;
    }
  }
  return NO;
}

static RCTImageCompressionTransformedImage *RCTImageCompressionKitTransformImage(UIImage *image, RCTImageCompressionKitResizeOptions resize, BOOL opaque)
{
  RCTImageCompressionImageTransformRequest *request = [[RCTImageCompressionImageTransformRequest alloc]
    initWithImage:image
    resizeOptions:resize
    opaque:opaque
  ];
  return [[RCTImageCompressionImageTransformer defaultTransformer] transformRequest:request error:nil];
}

static NSString *RCTImageCompressionKitOutputPath(NSString *outputFormat, NSError **error)
{
  NSArray<NSString *> *cachePaths = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES);
  NSString *cachePath = [cachePaths firstObject] ?: NSTemporaryDirectory();
  NSString *outputDirectory = [cachePath stringByAppendingPathComponent:@"ImageCompressionKit"];
  NSFileManager *fileManager = [NSFileManager defaultManager];

  if (![fileManager fileExistsAtPath:outputDirectory]) {
    if (![fileManager createDirectoryAtPath:outputDirectory withIntermediateDirectories:YES attributes:nil error:error]) {
      return nil;
    }
  }

  NSString *extension = @"jpg";
  if ([outputFormat isEqualToString:RCTImageCompressionKitPngFormat]) {
    extension = @"png";
  } else if ([outputFormat isEqualToString:RCTImageCompressionKitWebPFormat]) {
    extension = @"webp";
  }
  NSString *fileName = [NSString stringWithFormat:
    @"compressed-%lld-%@.%@",
    (long long)([NSDate date].timeIntervalSince1970 * 1000.0),
    [NSUUID UUID].UUIDString,
    extension
  ];
  return [outputDirectory stringByAppendingPathComponent:fileName];
}

static NSDictionary *RCTImageCompressionKitResult(
  NSString *outputPath,
  NSString *outputFormat,
  CGSize outputSize,
  NSData *outputData,
  NSData *sourceData
) {
  double byteSize = (double)outputData.length;
  double originalByteSize = (double)sourceData.length;
  double compressionRatio = originalByteSize > 0.0 ? byteSize / originalByteSize : 1.0;
  return @{
    @"uri" : [[NSURL fileURLWithPath:outputPath] absoluteString],
    @"format" : outputFormat,
    @"width" : @((NSInteger)outputSize.width),
    @"height" : @((NSInteger)outputSize.height),
    @"byteSize" : @(byteSize),
    @"originalByteSize" : @(originalByteSize),
    @"compressionRatio" : @(compressionRatio)
  };
}

@implementation RCTImageCompressionKit

RCT_EXPORT_MODULE(ImageCompressionKit)

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeImageCompressionKitSpecJSI>(params);
}

- (void)compressImage:(JS::NativeImageCompressionKit::NativeCompressionOptions &)options
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  JS::NativeImageCompressionKit::NativeCompressionSource source = options.source();
  JS::NativeImageCompressionKit::NativeOutputOptions output = options.output();
  NSMutableDictionary *sourceMap = [NSMutableDictionary dictionary];
  NSMutableDictionary *outputMap = [NSMutableDictionary dictionary];
  NSMutableDictionary *optionsMap = [NSMutableDictionary dictionary];
  NSString *sourceUri = source.uri();
  NSString *outputFormat = output.format();
  NSString *metadata = options.metadata();
  std::optional<double> quality = output.quality();
  std::optional<double> maxBytes = output.maxBytes();
  std::optional<JS::NativeImageCompressionKit::NativeResizeOptions> resize = options.resize();

  if (sourceUri != nil) {
    sourceMap[@"uri"] = sourceUri;
  }
  if (outputFormat != nil) {
    outputMap[@"format"] = outputFormat;
  }
  if (quality.has_value()) {
    outputMap[@"quality"] = @(quality.value());
  }
  if (maxBytes.has_value()) {
    outputMap[@"maxBytes"] = @(maxBytes.value());
  }

  optionsMap[@"source"] = sourceMap;
  optionsMap[@"output"] = outputMap;
  if (metadata != nil) {
    optionsMap[@"metadata"] = metadata;
  }

  if (resize.has_value()) {
    JS::NativeImageCompressionKit::NativeResizeOptions resizeOptions = resize.value();
    NSMutableDictionary *resizeMap = [NSMutableDictionary dictionary];
    std::optional<double> maxWidth = resizeOptions.maxWidth();
    std::optional<double> maxHeight = resizeOptions.maxHeight();
    NSString *mode = resizeOptions.mode();

    if (maxWidth.has_value()) {
      resizeMap[@"maxWidth"] = @(maxWidth.value());
    }
    if (maxHeight.has_value()) {
      resizeMap[@"maxHeight"] = @(maxHeight.value());
    }
    if (mode != nil) {
      resizeMap[@"mode"] = mode;
    }
    optionsMap[@"resize"] = resizeMap;
  }

  [self compressImageWithDictionary:optionsMap resolve:resolve reject:reject];
}

- (void)compressImageWithDictionary:(NSDictionary *)options
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  @try {
    RCTImageCompressionKitSmokeLog(@"compress-start");
    RCTImageCompressionRequestError *requestError = nil;
    RCTImageCompressionRequest *request = [RCTImageCompressionRequestParser
      parseOptions:options
      webPOutputAvailability:^BOOL{
        return [RCTImageCompressionImageEncoder defaultWebPOutputAvailable];
      }
      error:&requestError
    ];
    if (request == nil) {
      RCTImageCompressionKitReject(reject, requestError.code, requestError.message, nil);
      return;
    }
    RCTImageCompressionKitSmokeLog(@"options-validated");
    RCTImageCompressionInputError *inputError = nil;
    RCTImageCompressionInputInspection *input = [[RCTImageCompressionInputLoader defaultLoader]
      loadSourceURI:request.sourceURI
      avifInputAvailability:^BOOL{
        return RCTImageCompressionKitCanDecodeAVIF();
      }
      error:&inputError
    ];
    if (input == nil) {
      RCTImageCompressionKitReject(reject, inputError.code, inputError.message, inputError.underlyingError);
      return;
    }
    RCTImageCompressionKitSmokeLog(@"source-url-ready");
    RCTImageCompressionKitSmokeLog(@"source-read");
    RCTImageCompressionKitSmokeLog([NSString stringWithFormat:@"image-type-%@", input.imageType]);
    RCTImageCompressionJpegMetadataRequest *metadataRequest = [[RCTImageCompressionJpegMetadataRequest alloc]
      initWithMetadataPolicy:request.metadataPolicy
      jpegInput:input.jpeg
      jpegOutput:request.outputIsJpeg
      sourceData:input.source.data
    ];
    RCTImageCompressionJpegMetadataError *metadataError = nil;
    RCTImageCompressionJpegMetadataResult *jpegMetadata = [[RCTImageCompressionJpegMetadata defaultMetadata]
      prepareRequest:metadataRequest
      error:&metadataError
    ];
    if (jpegMetadata == nil) {
      RCTImageCompressionKitReject(reject, metadataError.code, metadataError.message, nil);
      return;
    }
    RCTImageCompressionKitSmokeLog(@"image-work-start");
    RCTImageCompressionImageDecodeError *decodeError = nil;
    RCTImageCompressionDecodedImage *decodedImage = [[RCTImageCompressionImageDecoder defaultDecoder]
      decodeInput:input
      error:&decodeError
    ];
    if (decodedImage == nil) {
      RCTImageCompressionKitSmokeLog(@"image-work-finished");
      RCTImageCompressionKitReject(reject, decodeError.code, decodeError.message, decodeError.underlyingError);
      return;
    }
    RCTImageCompressionTransformedImage *transformedImage = RCTImageCompressionKitTransformImage(decodedImage.image, request.resizeOptions, request.outputIsJpeg);
    if (transformedImage == nil) {
      RCTImageCompressionKitSmokeLog(@"image-work-finished");
      NSString *message = [NSString stringWithFormat:@"iOS MVP could not encode %@ output.", request.outputFormat.uppercaseString];
      RCTImageCompressionKitReject(reject, RCTImageCompressionKitImageEncodeFailedCode, message, nil);
      return;
    }
    RCTImageCompressionImageEncodeRequest *encodeRequest = [[RCTImageCompressionImageEncodeRequest alloc]
      initWithImage:transformedImage.image
      outputFormat:request.outputFormat
      quality:request.quality
      hasMaxBytes:request.hasMaxBytes
      maxBytes:request.maxBytes
      jpegMetadata:jpegMetadata
    ];
    RCTImageCompressionImageEncodeError *encodeError = nil;
    RCTImageCompressionEncodedImage *encodedImage = [[RCTImageCompressionImageEncoder defaultEncoder]
      encodeRequest:encodeRequest
      error:&encodeError
    ];
    RCTImageCompressionKitSmokeLog(@"image-work-finished");
    if (encodedImage == nil) {
      RCTImageCompressionKitReject(reject, encodeError.code, encodeError.message, nil);
      return;
    }
    NSData *outputData = encodedImage.data;
    RCTImageCompressionKitSmokeLog([NSString stringWithFormat:@"%@-encoded", request.outputFormat]);
    NSError *outputPathError = nil;
    NSString *outputPath = RCTImageCompressionKitOutputPath(request.outputFormat, &outputPathError);
    if (outputPath == nil) {
      RCTImageCompressionKitReject(reject, RCTImageCompressionKitImageEncodeFailedCode,
        @"iOS MVP could not create an output cache file.", outputPathError);
      return;
    }
    RCTImageCompressionKitSmokeLog(@"output-path-ready");
    NSError *writeError = nil;
    if (![outputData writeToFile:outputPath options:NSDataWritingAtomic error:&writeError]) {
      NSString *message = [NSString stringWithFormat:@"iOS MVP could not write %@ output.", request.outputFormat.uppercaseString];
      RCTImageCompressionKitReject(reject, RCTImageCompressionKitImageEncodeFailedCode, message, writeError);
      return;
    }
    RCTImageCompressionKitSmokeLog(@"output-written");
    resolve(RCTImageCompressionKitResult(outputPath, request.outputFormat, transformedImage.pixelSize, outputData, input.source.data));
    RCTImageCompressionKitSmokeLog(@"compress-resolved");
  } @catch (NSException *exception) {
    RCTImageCompressionKitReject(reject, RCTImageCompressionKitNativeOperationFailedCode,
      @"iOS MVP compression failed.", nil);
  }
}

- (void)getImageCompressionCapabilities:(RCTPromiseResolveBlock)resolve
                                 reject:(RCTPromiseRejectBlock)reject
{
  NSArray<NSDictionary *> *formats = RCTImageCompressionIOSFormatCapabilities(
    [RCTImageCompressionImageEncoder defaultWebPOutputAvailable],
    RCTImageCompressionKitCanDecodeAVIF()
  );

  resolve(@{
    @"platform" : @"ios",
    @"formats" : formats,
    @"metadataPolicies" : @[
      RCTImageCompressionKitPreserveMetadataPolicy,
      RCTImageCompressionKitDefaultMetadataPolicy,
      RCTImageCompressionKitStripMetadataPolicy
    ],
    @"supportsTargetSizeCompression" : @YES,
    @"supportsCancellation" : @NO
  });
}

@end
