#import "RCTImageCompressionKit.h"
#import "RCTImageCompressionImageDecoder.h"
#import "RCTImageCompressionImageTransformer.h"
#import "RCTImageCompressionInput.h"
#import "RCTImageCompressionIOSCapabilities.h"
#import "RCTImageCompressionJpegMetadata.h"
#import "RCTImageCompressionRequest.h"

#import <ImageIO/ImageIO.h>
#import <UIKit/UIKit.h>

#include <memory>

static NSString *const RCTImageCompressionKitEncodeFailedCode = @"ERR_ENCODE_FAILED";
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

static void RCTImageCompressionKitRunImageWork(dispatch_block_t block)
{
  if ([NSThread isMainThread]) {
    block();
    return;
  }

  dispatch_sync(dispatch_get_main_queue(), block);
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

static NSData *RCTImageCompressionKitEncodeJpeg(
  UIImage *image,
  NSInteger quality,
  RCTImageCompressionJpegMetadataResult *metadata
) {
  CGImageRef cgImage = image.CGImage;
  if (cgImage == nil) {
    return nil;
  }

  NSMutableData *outputData = [NSMutableData data];
  CGImageDestinationRef destination = CGImageDestinationCreateWithData(
    (__bridge CFMutableDataRef)outputData,
    (__bridge CFStringRef)@"public.jpeg",
    1,
    nil
  );
  if (destination == nil) {
    return nil;
  }

  NSDictionary *destinationProperties = [metadata
    destinationPropertiesForQuality:quality
    pixelWidth:CGImageGetWidth(cgImage)
    pixelHeight:CGImageGetHeight(cgImage)
  ];
  CGImageDestinationAddImage(destination, cgImage, (__bridge CFDictionaryRef)destinationProperties);
  BOOL finalized = CGImageDestinationFinalize(destination);
  CFRelease(destination);

  return finalized && outputData.length > 0 ? outputData : nil;
}

static NSData *RCTImageCompressionKitEncodePng(UIImage *image)
{
  return UIImagePNGRepresentation(image);
}

static NSString *RCTImageCompressionKitWebPOutputTypeIdentifier(void)
{
  NSArray<NSString *> *supportedTypes = CFBridgingRelease(CGImageDestinationCopyTypeIdentifiers());
  NSArray<NSString *> *webpTypes = @[@"org.webmproject.webp", @"public.webp"];

  for (NSString *webpType in webpTypes) {
    if ([supportedTypes containsObject:webpType]) {
      return webpType;
    }
  }

  return nil;
}

static BOOL RCTImageCompressionKitCanEncodeWebP(void)
{
  return RCTImageCompressionKitWebPOutputTypeIdentifier() != nil;
}

static NSData *RCTImageCompressionKitEncodeWebP(UIImage *image, NSInteger quality)
{
  NSString *typeIdentifier = RCTImageCompressionKitWebPOutputTypeIdentifier();
  CGImageRef cgImage = image.CGImage;
  if (typeIdentifier == nil || cgImage == nil) {
    return nil;
  }

  NSMutableData *outputData = [NSMutableData data];
  CGImageDestinationRef destination = CGImageDestinationCreateWithData(
    (__bridge CFMutableDataRef)outputData,
    (__bridge CFStringRef)typeIdentifier,
    1,
    nil
  );
  if (destination == nil) {
    return nil;
  }

  NSDictionary *properties = @{
    (__bridge NSString *)kCGImageDestinationLossyCompressionQuality : @((CGFloat)quality / 100.0)
  };
  CGImageDestinationAddImage(destination, cgImage, (__bridge CFDictionaryRef)properties);
  BOOL finalized = CGImageDestinationFinalize(destination);
  CFRelease(destination);

  return finalized && outputData.length > 0 ? outputData : nil;
}

static NSData *RCTImageCompressionKitEncodeQualityOutput(
  UIImage *image,
  NSString *outputFormat,
  NSInteger quality,
  RCTImageCompressionJpegMetadataResult *jpegMetadata
) {
  if ([outputFormat isEqualToString:RCTImageCompressionKitWebPFormat]) {
    return RCTImageCompressionKitEncodeWebP(image, quality);
  }

  return RCTImageCompressionKitEncodeJpeg(image, quality, jpegMetadata);
}

static NSData *RCTImageCompressionKitEncodeToTargetSize(
  UIImage *image,
  NSString *outputFormat,
  NSInteger qualityCap,
  NSUInteger maxBytes,
  RCTImageCompressionJpegMetadataResult *jpegMetadata
) {
  NSData *outputData = RCTImageCompressionKitEncodeQualityOutput(
    image,
    outputFormat,
    qualityCap,
    jpegMetadata
  );
  if (outputData == nil || outputData.length == 0 || outputData.length <= maxBytes) {
    return outputData;
  }

  NSData *lowestAboveTargetData = outputData;
  NSUInteger lowestAboveTargetSize = outputData.length;
  NSData *bestWithinTargetData = nil;
  NSInteger low = RCTImageCompressionKitMinQuality;
  NSInteger high = qualityCap - 1;

  while (low <= high) {
    NSInteger currentQuality = (low + high) / 2;
    NSData *candidateData = RCTImageCompressionKitEncodeQualityOutput(
      image,
      outputFormat,
      currentQuality,
      jpegMetadata
    );
    if (candidateData == nil || candidateData.length == 0) {
      return candidateData;
    }

    NSUInteger byteSize = candidateData.length;
    if (byteSize <= maxBytes) {
      bestWithinTargetData = candidateData;
      low = currentQuality + 1;
    } else {
      if (byteSize < lowestAboveTargetSize) {
        lowestAboveTargetData = candidateData;
        lowestAboveTargetSize = byteSize;
      }
      high = currentQuality - 1;
    }
  }

  return bestWithinTargetData ?: lowestAboveTargetData;
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
        return RCTImageCompressionKitCanEncodeWebP();
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
      RCTImageCompressionKitReject(reject, RCTImageCompressionKitEncodeFailedCode, message, nil);
      return;
    }
    __block NSData *outputData = nil;
    RCTImageCompressionKitRunImageWork(^{
      if (request.outputIsPng) {
        outputData = RCTImageCompressionKitEncodePng(transformedImage.image);
      } else if (request.outputIsWebP) {
        outputData = request.hasMaxBytes
          ? RCTImageCompressionKitEncodeToTargetSize(transformedImage.image, request.outputFormat, request.quality, request.maxBytes, jpegMetadata)
          : RCTImageCompressionKitEncodeWebP(transformedImage.image, request.quality);
      } else {
        outputData = request.hasMaxBytes
          ? RCTImageCompressionKitEncodeToTargetSize(transformedImage.image, request.outputFormat, request.quality, request.maxBytes, jpegMetadata)
          : RCTImageCompressionKitEncodeJpeg(transformedImage.image, request.quality, jpegMetadata);
      }
    });
    RCTImageCompressionKitSmokeLog(@"image-work-finished");
    if (outputData == nil || outputData.length == 0) {
      NSString *message = [NSString stringWithFormat:@"iOS MVP could not encode %@ output.", request.outputFormat.uppercaseString];
      RCTImageCompressionKitReject(reject, RCTImageCompressionKitEncodeFailedCode, message, nil);
      return;
    }
    RCTImageCompressionKitSmokeLog([NSString stringWithFormat:@"%@-encoded", request.outputFormat]);
    NSError *outputPathError = nil;
    NSString *outputPath = RCTImageCompressionKitOutputPath(request.outputFormat, &outputPathError);
    if (outputPath == nil) {
      RCTImageCompressionKitReject(reject, RCTImageCompressionKitEncodeFailedCode,
        @"iOS MVP could not create an output cache file.", outputPathError);
      return;
    }
    RCTImageCompressionKitSmokeLog(@"output-path-ready");
    NSError *writeError = nil;
    if (![outputData writeToFile:outputPath options:NSDataWritingAtomic error:&writeError]) {
      NSString *message = [NSString stringWithFormat:@"iOS MVP could not write %@ output.", request.outputFormat.uppercaseString];
      RCTImageCompressionKitReject(reject, RCTImageCompressionKitEncodeFailedCode, message, writeError);
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
    RCTImageCompressionKitCanEncodeWebP(),
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
