#import "RCTImageCompressionKit.h"

#import <ImageIO/ImageIO.h>
#import <UIKit/UIKit.h>

#include <math.h>
#include <memory>

static NSString *const RCTImageCompressionKitModuleName = @"ImageCompressionKit";
static NSString *const RCTImageCompressionKitInvalidOptionsCode = @"ERR_INVALID_OPTIONS";
static NSString *const RCTImageCompressionKitUnsupportedSourceCode = @"ERR_UNSUPPORTED_SOURCE";
static NSString *const RCTImageCompressionKitUnsupportedFormatCode = @"ERR_UNSUPPORTED_FORMAT";
static NSString *const RCTImageCompressionKitNotImplementedCode = @"ERR_NOT_IMPLEMENTED";
static NSString *const RCTImageCompressionKitFileAccessCode = @"ERR_FILE_ACCESS";
static NSString *const RCTImageCompressionKitDecodeFailedCode = @"ERR_DECODE_FAILED";
static NSString *const RCTImageCompressionKitEncodeFailedCode = @"ERR_ENCODE_FAILED";
static NSString *const RCTImageCompressionKitNativeOperationFailedCode = @"ERR_NATIVE_OPERATION_FAILED";

static NSString *const RCTImageCompressionKitJpegFormat = @"jpeg";
static NSString *const RCTImageCompressionKitPngFormat = @"png";
static NSString *const RCTImageCompressionKitDefaultMetadataPolicy = @"safe";
static NSString *const RCTImageCompressionKitStripMetadataPolicy = @"strip";
static NSString *const RCTImageCompressionKitPreserveMetadataPolicy = @"preserve";

static NSInteger const RCTImageCompressionKitDefaultQuality = 80;
static NSInteger const RCTImageCompressionKitMinQuality = 0;
static NSInteger const RCTImageCompressionKitMaxQuality = 100;

typedef NS_ENUM(NSInteger, RCTImageCompressionKitResizeMode) {
  RCTImageCompressionKitResizeModeContain,
  RCTImageCompressionKitResizeModeCover,
  RCTImageCompressionKitResizeModeStretch
};

typedef struct {
  BOOL enabled;
  BOOL hasMaxWidth;
  BOOL hasMaxHeight;
  NSInteger maxWidth;
  NSInteger maxHeight;
  RCTImageCompressionKitResizeMode mode;
} RCTImageCompressionKitResizeOptions;

static NSArray<NSString *> *RCTImageCompressionKitFormats(void)
{
  return @[@"jpeg", @"png", @"webp", @"heic", @"heif", @"avif", @"gif"];
}

static BOOL RCTImageCompressionKitHasValue(NSDictionary *map, NSString *key)
{
  id value = map[key];
  return value != nil && value != (id)kCFNull;
}

static BOOL RCTImageCompressionKitIsIntegerNumber(NSNumber *number)
{
  double value = number.doubleValue;
  return isfinite(value) && floor(value) == value;
}

static NSString *RCTImageCompressionKitStringValue(NSDictionary *map, NSString *key)
{
  id value = map[key];
  return [value isKindOfClass:[NSString class]] ? value : nil;
}

static NSNumber *RCTImageCompressionKitNumberValue(NSDictionary *map, NSString *key)
{
  id value = map[key];
  return [value isKindOfClass:[NSNumber class]] ? value : nil;
}

static NSDictionary *RCTImageCompressionKitFormatCapability(
  NSString *format,
  BOOL input,
  BOOL output,
  BOOL supportsAlpha,
  BOOL supportsAnimation,
  NSArray<NSString *> *notes
) {
  return @{
    @"format" : format,
    @"input" : @(input),
    @"output" : @(output),
    @"supportsAlpha" : @(supportsAlpha),
    @"supportsAnimation" : @(supportsAnimation),
    @"notes" : notes
  };
}

static NSDictionary *RCTImageCompressionKitIOSFormatCapability(NSString *format)
{
  if ([format isEqualToString:RCTImageCompressionKitJpegFormat]) {
    return RCTImageCompressionKitFormatCapability(
      format,
      YES,
      YES,
      NO,
      NO,
      @[
        @"iOS MVP supports JPEG input and JPEG output through UIKit/ImageIO.",
        @"JPEG output supports quality-based compression and optional resize.",
        @"Metadata preserve is not implemented; safe and strip re-encode without copying source metadata."
      ]
    );
  }

  if ([format isEqualToString:RCTImageCompressionKitPngFormat]) {
    return RCTImageCompressionKitFormatCapability(
      format,
      YES,
      NO,
      YES,
      NO,
      @[
        @"iOS MVP supports PNG input with JPEG output conversion.",
        @"PNG alpha is composited over white when encoding JPEG output.",
        @"PNG output is not implemented in the iOS MVP."
      ]
    );
  }

  return RCTImageCompressionKitFormatCapability(
    format,
    NO,
    NO,
    NO,
    NO,
    @[@"iOS MVP supports JPEG and PNG input with JPEG output only."]
  );
}

static void RCTImageCompressionKitReject(
  RCTPromiseRejectBlock reject,
  NSString *code,
  NSString *message,
  NSError *error
) {
  reject(code, message, error);
}

static BOOL RCTImageCompressionKitReadPositiveInteger(
  NSDictionary *map,
  NSString *key,
  NSInteger *value,
  NSString **errorMessage
) {
  if (!RCTImageCompressionKitHasValue(map, key)) {
    return YES;
  }

  NSNumber *number = RCTImageCompressionKitNumberValue(map, key);
  if (number == nil || !RCTImageCompressionKitIsIntegerNumber(number) || number.integerValue <= 0) {
    *errorMessage = [NSString stringWithFormat:@"Compression resize.%@ must be a positive integer.", key];
    return NO;
  }

  *value = number.integerValue;
  return YES;
}

static BOOL RCTImageCompressionKitReadResizeMode(
  NSDictionary *resize,
  RCTImageCompressionKitResizeMode *mode,
  NSString **errorMessage
) {
  if (!RCTImageCompressionKitHasValue(resize, @"mode")) {
    *mode = RCTImageCompressionKitResizeModeContain;
    return YES;
  }

  NSString *modeValue = RCTImageCompressionKitStringValue(resize, @"mode");
  if ([modeValue isEqualToString:@"contain"]) {
    *mode = RCTImageCompressionKitResizeModeContain;
    return YES;
  }
  if ([modeValue isEqualToString:@"cover"]) {
    *mode = RCTImageCompressionKitResizeModeCover;
    return YES;
  }
  if ([modeValue isEqualToString:@"stretch"]) {
    *mode = RCTImageCompressionKitResizeModeStretch;
    return YES;
  }

  *errorMessage = @"Compression resize.mode must be one of: contain, cover, stretch.";
  return NO;
}

static BOOL RCTImageCompressionKitReadResizeOptions(
  NSDictionary *options,
  RCTImageCompressionKitResizeOptions *resizeOptions,
  NSString **errorMessage
) {
  *resizeOptions = (RCTImageCompressionKitResizeOptions){
    .enabled = NO,
    .hasMaxWidth = NO,
    .hasMaxHeight = NO,
    .maxWidth = 0,
    .maxHeight = 0,
    .mode = RCTImageCompressionKitResizeModeContain
  };

  if (!RCTImageCompressionKitHasValue(options, @"resize")) {
    return YES;
  }

  id resizeValue = options[@"resize"];
  if (![resizeValue isKindOfClass:[NSDictionary class]]) {
    *errorMessage = @"Compression resize must be an object.";
    return NO;
  }

  NSDictionary *resize = resizeValue;
  NSInteger maxWidth = 0;
  NSInteger maxHeight = 0;

  if (!RCTImageCompressionKitReadPositiveInteger(resize, @"maxWidth", &maxWidth, errorMessage)) {
    return NO;
  }
  if (!RCTImageCompressionKitReadPositiveInteger(resize, @"maxHeight", &maxHeight, errorMessage)) {
    return NO;
  }

  BOOL hasMaxWidth = RCTImageCompressionKitHasValue(resize, @"maxWidth");
  BOOL hasMaxHeight = RCTImageCompressionKitHasValue(resize, @"maxHeight");
  if (!hasMaxWidth && !hasMaxHeight) {
    *errorMessage = @"Compression resize must include maxWidth, maxHeight, or both.";
    return NO;
  }

  RCTImageCompressionKitResizeMode mode = RCTImageCompressionKitResizeModeContain;
  if (!RCTImageCompressionKitReadResizeMode(resize, &mode, errorMessage)) {
    return NO;
  }

  *resizeOptions = (RCTImageCompressionKitResizeOptions){
    .enabled = YES,
    .hasMaxWidth = hasMaxWidth,
    .hasMaxHeight = hasMaxHeight,
    .maxWidth = maxWidth,
    .maxHeight = maxHeight,
    .mode = mode
  };
  return YES;
}

static BOOL RCTImageCompressionKitReadQuality(
  NSDictionary *output,
  NSInteger *quality,
  NSString **errorMessage
) {
  if (!RCTImageCompressionKitHasValue(output, @"quality")) {
    *quality = RCTImageCompressionKitDefaultQuality;
    return YES;
  }

  NSNumber *qualityNumber = RCTImageCompressionKitNumberValue(output, @"quality");
  if (
    qualityNumber == nil ||
    !RCTImageCompressionKitIsIntegerNumber(qualityNumber) ||
    qualityNumber.integerValue < RCTImageCompressionKitMinQuality ||
    qualityNumber.integerValue > RCTImageCompressionKitMaxQuality
  ) {
    *errorMessage = @"Compression output.quality must be an integer from 0 to 100.";
    return NO;
  }

  *quality = qualityNumber.integerValue;
  return YES;
}

static BOOL RCTImageCompressionKitValidateMaxBytes(
  NSDictionary *output,
  NSString **errorMessage
) {
  if (!RCTImageCompressionKitHasValue(output, @"maxBytes")) {
    return YES;
  }

  NSNumber *maxBytes = RCTImageCompressionKitNumberValue(output, @"maxBytes");
  if (maxBytes == nil || !RCTImageCompressionKitIsIntegerNumber(maxBytes) || maxBytes.doubleValue <= 0) {
    *errorMessage = @"Compression output.maxBytes must be a positive integer.";
    return NO;
  }

  return YES;
}

static NSURL *RCTImageCompressionKitSourceURL(NSString *uri)
{
  NSURL *sourceURL = [NSURL URLWithString:uri];
  NSString *scheme = [[sourceURL scheme] lowercaseString];

  if ([scheme isEqualToString:@"file"] || [scheme isEqualToString:@"content"]) {
    return sourceURL;
  }

  return nil;
}

static NSData *RCTImageCompressionKitReadSourceData(NSURL *sourceURL, NSError **error)
{
  BOOL hasSecurityScope = [sourceURL startAccessingSecurityScopedResource];
  NSData *sourceData = [NSData dataWithContentsOfURL:sourceURL options:NSDataReadingMappedIfSafe error:error];

  if (hasSecurityScope) {
    [sourceURL stopAccessingSecurityScopedResource];
  }

  return sourceData;
}

static NSString *RCTImageCompressionKitImageType(NSData *sourceData)
{
  CGImageSourceRef imageSource = CGImageSourceCreateWithData((__bridge CFDataRef)sourceData, nil);
  if (imageSource == nil) {
    return nil;
  }

  NSString *imageType = nil;
  if (CGImageSourceGetCount(imageSource) > 0) {
    imageType = [(__bridge NSString *)CGImageSourceGetType(imageSource) copy];
  }

  CFRelease(imageSource);
  return imageType;
}

static BOOL RCTImageCompressionKitIsSupportedInputType(NSString *imageType)
{
  return [imageType isEqualToString:@"public.jpeg"] || [imageType isEqualToString:@"public.png"];
}

static CGFloat RCTImageCompressionKitDimension(CGFloat value)
{
  return MAX((CGFloat)1.0, round(value));
}

static CGSize RCTImageCompressionKitPixelSize(UIImage *image)
{
  return CGSizeMake(
    RCTImageCompressionKitDimension(image.size.width * image.scale),
    RCTImageCompressionKitDimension(image.size.height * image.scale)
  );
}

static CGSize RCTImageCompressionKitContainSize(CGSize imageSize, RCTImageCompressionKitResizeOptions resize)
{
  CGFloat scale = 1.0;

  if (resize.hasMaxWidth) {
    scale = MIN(scale, (CGFloat)resize.maxWidth / imageSize.width);
  }
  if (resize.hasMaxHeight) {
    scale = MIN(scale, (CGFloat)resize.maxHeight / imageSize.height);
  }

  return CGSizeMake(
    RCTImageCompressionKitDimension(imageSize.width * scale),
    RCTImageCompressionKitDimension(imageSize.height * scale)
  );
}

static CGSize RCTImageCompressionKitStretchSize(CGSize imageSize, RCTImageCompressionKitResizeOptions resize)
{
  CGFloat targetWidth = resize.hasMaxWidth ? MIN((CGFloat)resize.maxWidth, imageSize.width) : imageSize.width;
  CGFloat targetHeight = resize.hasMaxHeight ? MIN((CGFloat)resize.maxHeight, imageSize.height) : imageSize.height;

  return CGSizeMake(
    RCTImageCompressionKitDimension(targetWidth),
    RCTImageCompressionKitDimension(targetHeight)
  );
}

static CGSize RCTImageCompressionKitCoverSize(CGSize imageSize, RCTImageCompressionKitResizeOptions resize)
{
  if (!resize.hasMaxWidth || !resize.hasMaxHeight) {
    return RCTImageCompressionKitContainSize(imageSize, resize);
  }

  return CGSizeMake(
    RCTImageCompressionKitDimension(MIN((CGFloat)resize.maxWidth, imageSize.width)),
    RCTImageCompressionKitDimension(MIN((CGFloat)resize.maxHeight, imageSize.height))
  );
}

static UIImage *RCTImageCompressionKitRenderImage(UIImage *image, RCTImageCompressionKitResizeOptions resize)
{
  CGSize imageSize = RCTImageCompressionKitPixelSize(image);
  CGSize targetSize = imageSize;
  CGRect drawRect = CGRectMake(0, 0, imageSize.width, imageSize.height);

  if (resize.enabled && resize.mode == RCTImageCompressionKitResizeModeStretch) {
    targetSize = RCTImageCompressionKitStretchSize(imageSize, resize);
    drawRect = CGRectMake(0, 0, targetSize.width, targetSize.height);
  } else if (resize.enabled && resize.mode == RCTImageCompressionKitResizeModeCover) {
    targetSize = RCTImageCompressionKitCoverSize(imageSize, resize);
    CGFloat scale = MIN(
      MAX(targetSize.width / imageSize.width, targetSize.height / imageSize.height),
      (CGFloat)1.0
    );
    CGSize drawSize = CGSizeMake(
      RCTImageCompressionKitDimension(imageSize.width * scale),
      RCTImageCompressionKitDimension(imageSize.height * scale)
    );
    drawRect = CGRectMake(
      (targetSize.width - drawSize.width) / 2.0,
      (targetSize.height - drawSize.height) / 2.0,
      drawSize.width,
      drawSize.height
    );
  } else if (resize.enabled) {
    targetSize = RCTImageCompressionKitContainSize(imageSize, resize);
    drawRect = CGRectMake(0, 0, targetSize.width, targetSize.height);
  }

  UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
  format.scale = 1.0;
  format.opaque = YES;

  UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:targetSize format:format];
  return [renderer imageWithActions:^(UIGraphicsImageRendererContext *rendererContext) {
    (void)rendererContext;
    [[UIColor whiteColor] setFill];
    UIRectFill(CGRectMake(0, 0, targetSize.width, targetSize.height));
    [image drawInRect:drawRect];
  }];
}

static NSString *RCTImageCompressionKitOutputPath(NSError **error)
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

  NSString *fileName = [NSString stringWithFormat:
    @"compressed-%lld-%@.jpg",
    (long long)([NSDate date].timeIntervalSince1970 * 1000.0),
    [NSUUID UUID].UUIDString
  ];
  return [outputDirectory stringByAppendingPathComponent:fileName];
}

@implementation RCTImageCompressionKit

+ (NSString *)moduleName
{
  return RCTImageCompressionKitModuleName;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeImageCompressionKitSpecJSI>(params);
}

- (void)compressImage:(NSDictionary *)options
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  @try {
    if (![options isKindOfClass:[NSDictionary class]]) {
      RCTImageCompressionKitReject(reject, RCTImageCompressionKitInvalidOptionsCode, @"Compression options must be an object.", nil);
      return;
    }

    id sourceValue = options[@"source"];
    id outputValue = options[@"output"];
    if (![sourceValue isKindOfClass:[NSDictionary class]] || ![outputValue isKindOfClass:[NSDictionary class]]) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitInvalidOptionsCode,
        @"Compression options must include source and output objects.",
        nil
      );
      return;
    }

    NSDictionary *source = sourceValue;
    NSDictionary *output = outputValue;
    NSString *uri = RCTImageCompressionKitStringValue(source, @"uri");
    if (uri == nil || [uri stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]].length == 0) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitInvalidOptionsCode,
        @"Compression source.uri must be a non-empty string.",
        nil
      );
      return;
    }

    NSString *outputFormat = RCTImageCompressionKitStringValue(output, @"format");
    if (outputFormat == nil || ![@[@"jpeg", @"png", @"webp", @"heic", @"heif", @"avif"] containsObject:outputFormat]) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitInvalidOptionsCode,
        @"Compression output.format must be one of: jpeg, png, webp, heic, heif, avif.",
        nil
      );
      return;
    }

    if (![outputFormat isEqualToString:RCTImageCompressionKitJpegFormat]) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitNotImplementedCode,
        @"iOS MVP supports JPEG output only. Call getImageCompressionCapabilities() before selecting a platform output format.",
        nil
      );
      return;
    }

    NSString *errorMessage = nil;
    NSInteger quality = RCTImageCompressionKitDefaultQuality;
    if (!RCTImageCompressionKitReadQuality(output, &quality, &errorMessage)) {
      RCTImageCompressionKitReject(reject, RCTImageCompressionKitInvalidOptionsCode, errorMessage, nil);
      return;
    }

    if (!RCTImageCompressionKitValidateMaxBytes(output, &errorMessage)) {
      RCTImageCompressionKitReject(reject, RCTImageCompressionKitInvalidOptionsCode, errorMessage, nil);
      return;
    }
    if (RCTImageCompressionKitHasValue(output, @"maxBytes")) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitNotImplementedCode,
        @"iOS MVP does not support output.maxBytes yet. Call getImageCompressionCapabilities() and omit maxBytes on iOS.",
        nil
      );
      return;
    }

    NSString *metadataPolicy = RCTImageCompressionKitStringValue(options, @"metadata") ?: RCTImageCompressionKitDefaultMetadataPolicy;
    if (![@[RCTImageCompressionKitDefaultMetadataPolicy, RCTImageCompressionKitStripMetadataPolicy, RCTImageCompressionKitPreserveMetadataPolicy] containsObject:metadataPolicy]) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitInvalidOptionsCode,
        @"Compression metadata must be one of: preserve, safe, strip.",
        nil
      );
      return;
    }
    if ([metadataPolicy isEqualToString:RCTImageCompressionKitPreserveMetadataPolicy]) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitNotImplementedCode,
        @"iOS MVP does not support metadata preserve yet. Use safe or strip metadata on iOS.",
        nil
      );
      return;
    }

    RCTImageCompressionKitResizeOptions resizeOptions;
    if (!RCTImageCompressionKitReadResizeOptions(options, &resizeOptions, &errorMessage)) {
      RCTImageCompressionKitReject(reject, RCTImageCompressionKitInvalidOptionsCode, errorMessage, nil);
      return;
    }

    NSURL *sourceURL = RCTImageCompressionKitSourceURL(uri);
    if (sourceURL == nil) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitUnsupportedSourceCode,
        @"iOS MVP supports file:// and content:// image URIs only.",
        nil
      );
      return;
    }

    NSError *sourceError = nil;
    NSData *sourceData = RCTImageCompressionKitReadSourceData(sourceURL, &sourceError);
    if (sourceData == nil || sourceData.length == 0) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitFileAccessCode,
        @"iOS MVP could not read the source image URI.",
        sourceError
      );
      return;
    }

    NSString *imageType = RCTImageCompressionKitImageType(sourceData);
    if (imageType == nil) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitDecodeFailedCode,
        @"iOS MVP could not inspect the source image.",
        nil
      );
      return;
    }
    if (!RCTImageCompressionKitIsSupportedInputType(imageType)) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitUnsupportedFormatCode,
        @"iOS MVP supports JPEG and PNG input only.",
        nil
      );
      return;
    }

    UIImage *sourceImage = [UIImage imageWithData:sourceData];
    if (sourceImage == nil || sourceImage.size.width <= 0 || sourceImage.size.height <= 0) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitDecodeFailedCode,
        @"iOS MVP could not decode the source image.",
        nil
      );
      return;
    }

    UIImage *processedImage = RCTImageCompressionKitRenderImage(sourceImage, resizeOptions);
    NSData *outputData = UIImageJPEGRepresentation(processedImage, (CGFloat)quality / 100.0);
    if (outputData == nil || outputData.length == 0) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitEncodeFailedCode,
        @"iOS MVP could not encode JPEG output.",
        nil
      );
      return;
    }

    NSError *outputPathError = nil;
    NSString *outputPath = RCTImageCompressionKitOutputPath(&outputPathError);
    if (outputPath == nil) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitEncodeFailedCode,
        @"iOS MVP could not create an output cache file.",
        outputPathError
      );
      return;
    }

    NSError *writeError = nil;
    if (![outputData writeToFile:outputPath options:NSDataWritingAtomic error:&writeError]) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitEncodeFailedCode,
        @"iOS MVP could not write JPEG output.",
        writeError
      );
      return;
    }

    CGSize outputSize = RCTImageCompressionKitPixelSize(processedImage);
    double byteSize = (double)outputData.length;
    double originalByteSize = (double)sourceData.length;
    double compressionRatio = originalByteSize > 0.0 ? byteSize / originalByteSize : 1.0;

    resolve(@{
      @"uri" : [[NSURL fileURLWithPath:outputPath] absoluteString],
      @"format" : RCTImageCompressionKitJpegFormat,
      @"width" : @((NSInteger)outputSize.width),
      @"height" : @((NSInteger)outputSize.height),
      @"byteSize" : @(byteSize),
      @"originalByteSize" : @(originalByteSize),
      @"compressionRatio" : @(compressionRatio)
    });
  } @catch (NSException *exception) {
    RCTImageCompressionKitReject(
      reject,
      RCTImageCompressionKitNativeOperationFailedCode,
      @"iOS MVP compression failed.",
      nil
    );
  }
}

- (void)getImageCompressionCapabilities:(RCTPromiseResolveBlock)resolve
                                 reject:(RCTPromiseRejectBlock)reject
{
  NSMutableArray<NSDictionary *> *formats = [NSMutableArray array];

  for (NSString *format in RCTImageCompressionKitFormats()) {
    [formats addObject:RCTImageCompressionKitIOSFormatCapability(format)];
  }

  resolve(@{
    @"platform" : @"ios",
    @"formats" : formats,
    @"metadataPolicies" : @[RCTImageCompressionKitDefaultMetadataPolicy, RCTImageCompressionKitStripMetadataPolicy],
    @"supportsTargetSizeCompression" : @NO,
    @"supportsCancellation" : @NO
  });
}

@end
