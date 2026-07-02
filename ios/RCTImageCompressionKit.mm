#import "RCTImageCompressionKit.h"

#import <ImageIO/ImageIO.h>
#import <UIKit/UIKit.h>

#include <math.h>
#include <memory>

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
static NSString *const RCTImageCompressionKitWebPFormat = @"webp";
static NSString *const RCTImageCompressionKitGifFormat = @"gif";
static NSString *const RCTImageCompressionKitHeicFormat = @"heic";
static NSString *const RCTImageCompressionKitHeifFormat = @"heif";
static NSString *const RCTImageCompressionKitAvifFormat = @"avif";
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
  return @[
    RCTImageCompressionKitJpegFormat,
    RCTImageCompressionKitPngFormat,
    RCTImageCompressionKitWebPFormat,
    RCTImageCompressionKitHeicFormat,
    RCTImageCompressionKitHeifFormat,
    RCTImageCompressionKitAvifFormat,
    RCTImageCompressionKitGifFormat
  ];
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

static BOOL RCTImageCompressionKitCanEncodeWebP(void);

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
        @"Target-size compression supports maxBytes by adjusting JPEG quality.",
        @"Metadata preserve is not implemented; safe and strip re-encode without copying source metadata."
      ]
    );
  }

  if ([format isEqualToString:RCTImageCompressionKitPngFormat]) {
    return RCTImageCompressionKitFormatCapability(
      format,
      YES,
      YES,
      YES,
      NO,
      @[
        @"iOS MVP supports PNG input and PNG output through UIKit/ImageIO.",
        @"PNG output preserves alpha where the processed image contains transparency.",
        @"PNG output ignores quality and does not support target-size maxBytes."
      ]
    );
  }

  if ([format isEqualToString:RCTImageCompressionKitGifFormat]) {
    return RCTImageCompressionKitFormatCapability(
      format,
      YES,
      NO,
      YES,
      NO,
      @[
        @"iOS MVP decodes GIF input as a static first frame through ImageIO.",
        @"GIF input can be re-encoded to JPEG or PNG output without copying source metadata.",
        @"Animated GIF preservation and GIF output are not implemented."
      ]
    );
  }

  if ([format isEqualToString:RCTImageCompressionKitWebPFormat]) {
    BOOL canEncodeWebP = RCTImageCompressionKitCanEncodeWebP();
    return RCTImageCompressionKitFormatCapability(
      format,
      YES,
      canEncodeWebP,
      YES,
      NO,
      @[
        @"iOS MVP decodes WebP input as a static first frame through ImageIO.",
        canEncodeWebP
          ? @"WebP input can be re-encoded to JPEG, PNG, or WebP output without copying source metadata."
          : @"WebP input can be re-encoded to JPEG or PNG output without copying source metadata.",
        canEncodeWebP
          ? @"WebP output uses ImageIO CGImageDestination when the runtime advertises a WebP destination type."
          : @"This runtime does not advertise ImageIO WebP destination encoding support.",
        @"Runtime-available WebP output supports target-size maxBytes by adjusting WebP quality.",
        @"Animated WebP preservation is not implemented."
      ]
    );
  }

  if ([format isEqualToString:RCTImageCompressionKitHeicFormat] || [format isEqualToString:RCTImageCompressionKitHeifFormat]) {
    BOOL canEncodeWebP = RCTImageCompressionKitCanEncodeWebP();
    NSString *formatLabel = [format uppercaseString];
    return RCTImageCompressionKitFormatCapability(
      format,
      YES,
      NO,
      YES,
      NO,
      @[
        [NSString stringWithFormat:@"iOS MVP decodes %@ input as a static image through ImageIO.", formatLabel],
        [NSString stringWithFormat:@"%@ input can be re-encoded to JPEG or PNG output without copying source metadata.", formatLabel],
        canEncodeWebP
          ? [NSString stringWithFormat:@"%@ input can also be re-encoded to runtime-available WebP output.", formatLabel]
          : @"WebP output still requires runtime ImageIO WebP destination support.",
        [NSString stringWithFormat:@"%@ output is not implemented.", formatLabel]
      ]
    );
  }

  return RCTImageCompressionKitFormatCapability(
    format,
    NO,
    NO,
    NO,
    NO,
    @[@"iOS MVP supports JPEG, PNG, static GIF, static WebP, static HEIC, and static HEIF input with JPEG, PNG, or runtime ImageIO-backed WebP output only."]
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

static BOOL RCTImageCompressionKitReadMaxBytes(
  NSDictionary *output,
  BOOL *hasMaxBytes,
  NSUInteger *maxBytes,
  NSString **errorMessage
) {
  *hasMaxBytes = NO;
  *maxBytes = 0;

  if (!RCTImageCompressionKitHasValue(output, @"maxBytes")) {
    return YES;
  }

  NSNumber *maxBytesNumber = RCTImageCompressionKitNumberValue(output, @"maxBytes");
  double maxBytesValue = maxBytesNumber.doubleValue;
  if (
    maxBytesNumber == nil ||
    !RCTImageCompressionKitIsIntegerNumber(maxBytesNumber) ||
    maxBytesValue <= 0 ||
    maxBytesValue > (double)NSUIntegerMax
  ) {
    *errorMessage = @"Compression output.maxBytes must be a positive integer.";
    return NO;
  }

  *hasMaxBytes = YES;
  *maxBytes = (NSUInteger)maxBytesValue;
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

static BOOL RCTImageCompressionKitIsGifType(NSString *imageType)
{
  return [imageType isEqualToString:@"com.compuserve.gif"] || [imageType isEqualToString:@"public.gif"];
}

static BOOL RCTImageCompressionKitIsWebPType(NSString *imageType)
{
  return [imageType isEqualToString:@"org.webmproject.webp"] || [imageType isEqualToString:@"public.webp"];
}

static BOOL RCTImageCompressionKitIsHeicType(NSString *imageType)
{
  return
    [imageType isEqualToString:@"public.heic"] ||
    [imageType isEqualToString:@"public.heics"] ||
    [imageType isEqualToString:@"org.iso.heic"] ||
    [imageType isEqualToString:@"org.iso.heics"];
}

static BOOL RCTImageCompressionKitIsHeifType(NSString *imageType)
{
  return
    [imageType isEqualToString:@"public.heif"] ||
    [imageType isEqualToString:@"public.heifs"] ||
    [imageType isEqualToString:@"org.iso.heif"] ||
    [imageType isEqualToString:@"org.iso.heifs"];
}

static BOOL RCTImageCompressionKitIsHeicHeifType(NSString *imageType)
{
  return RCTImageCompressionKitIsHeicType(imageType) || RCTImageCompressionKitIsHeifType(imageType);
}

static BOOL RCTImageCompressionKitShouldDecodeFirstFrame(NSString *imageType)
{
  return
    RCTImageCompressionKitIsGifType(imageType) ||
    RCTImageCompressionKitIsWebPType(imageType) ||
    RCTImageCompressionKitIsHeicHeifType(imageType);
}

static BOOL RCTImageCompressionKitIsSupportedInputType(NSString *imageType)
{
  return
    [imageType isEqualToString:@"public.jpeg"] ||
    [imageType isEqualToString:@"public.png"] ||
    RCTImageCompressionKitIsGifType(imageType) ||
    RCTImageCompressionKitIsWebPType(imageType) ||
    RCTImageCompressionKitIsHeicHeifType(imageType);
}

static UIImage *RCTImageCompressionKitDecodeImage(NSData *sourceData, NSString *imageType)
{
  if (!RCTImageCompressionKitShouldDecodeFirstFrame(imageType)) {
    return [UIImage imageWithData:sourceData];
  }

  CGImageSourceRef imageSource = CGImageSourceCreateWithData((__bridge CFDataRef)sourceData, nil);
  if (imageSource == nil) {
    return nil;
  }

  if (CGImageSourceGetCount(imageSource) == 0) {
    CFRelease(imageSource);
    return nil;
  }

  CGImageRef firstFrame = CGImageSourceCreateImageAtIndex(imageSource, 0, nil);
  CFRelease(imageSource);
  if (firstFrame == nil) {
    return nil;
  }

  UIImage *image = [UIImage imageWithCGImage:firstFrame scale:1.0 orientation:UIImageOrientationUp];
  CGImageRelease(firstFrame);
  return image;
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

static UIImage *RCTImageCompressionKitRenderImage(
  UIImage *image,
  RCTImageCompressionKitResizeOptions resize,
  BOOL opaque
)
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
  format.opaque = opaque;

  UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:targetSize format:format];
  return [renderer imageWithActions:^(UIGraphicsImageRendererContext *rendererContext) {
    (void)rendererContext;
    [(opaque ? [UIColor whiteColor] : [UIColor clearColor]) setFill];
    UIRectFill(CGRectMake(0, 0, targetSize.width, targetSize.height));
    [image drawInRect:drawRect];
  }];
}

static NSData *RCTImageCompressionKitEncodeJpeg(UIImage *image, NSInteger quality)
{
  return UIImageJPEGRepresentation(image, (CGFloat)quality / 100.0);
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
  NSInteger quality
) {
  if ([outputFormat isEqualToString:RCTImageCompressionKitWebPFormat]) {
    return RCTImageCompressionKitEncodeWebP(image, quality);
  }

  return RCTImageCompressionKitEncodeJpeg(image, quality);
}

static NSData *RCTImageCompressionKitEncodeToTargetSize(
  UIImage *image,
  NSString *outputFormat,
  NSInteger qualityCap,
  NSUInteger maxBytes
) {
  NSData *outputData = RCTImageCompressionKitEncodeQualityOutput(image, outputFormat, qualityCap);
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
    NSData *candidateData = RCTImageCompressionKitEncodeQualityOutput(image, outputFormat, currentQuality);
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
    if (outputFormat == nil || ![@[
      RCTImageCompressionKitJpegFormat,
      RCTImageCompressionKitPngFormat,
      RCTImageCompressionKitWebPFormat,
      RCTImageCompressionKitHeicFormat,
      RCTImageCompressionKitHeifFormat,
      RCTImageCompressionKitAvifFormat
    ] containsObject:outputFormat]) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitInvalidOptionsCode,
        @"Compression output.format must be one of: jpeg, png, webp, heic, heif, avif.",
        nil
      );
      return;
    }

    BOOL outputIsJpeg = [outputFormat isEqualToString:RCTImageCompressionKitJpegFormat];
    BOOL outputIsPng = [outputFormat isEqualToString:RCTImageCompressionKitPngFormat];
    BOOL outputIsWebP = [outputFormat isEqualToString:RCTImageCompressionKitWebPFormat];
    if (!outputIsJpeg && !outputIsPng && !outputIsWebP) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitNotImplementedCode,
        @"iOS MVP supports JPEG, PNG, and WebP output only. Call getImageCompressionCapabilities() before selecting a platform output format.",
        nil
      );
      return;
    }
    if (outputIsWebP && !RCTImageCompressionKitCanEncodeWebP()) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitNotImplementedCode,
        @"iOS MVP requires ImageIO WebP destination support for WebP output on this runtime.",
        nil
      );
      return;
    }

    NSString *errorMessage = nil;
    NSInteger quality = RCTImageCompressionKitDefaultQuality;
    BOOL hasMaxBytes = NO;
    NSUInteger maxBytes = 0;
    if (!RCTImageCompressionKitReadQuality(output, &quality, &errorMessage)) {
      RCTImageCompressionKitReject(reject, RCTImageCompressionKitInvalidOptionsCode, errorMessage, nil);
      return;
    }

    if (!RCTImageCompressionKitReadMaxBytes(output, &hasMaxBytes, &maxBytes, &errorMessage)) {
      RCTImageCompressionKitReject(reject, RCTImageCompressionKitInvalidOptionsCode, errorMessage, nil);
      return;
    }
    if (hasMaxBytes && outputIsPng) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitNotImplementedCode,
        @"iOS MVP supports output.maxBytes for JPEG and runtime-available WebP output only.",
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
    RCTImageCompressionKitSmokeLog(@"options-validated");

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
    RCTImageCompressionKitSmokeLog(@"source-url-ready");

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
    RCTImageCompressionKitSmokeLog(@"source-read");

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
    RCTImageCompressionKitSmokeLog([NSString stringWithFormat:@"image-type-%@", imageType]);
    if (!RCTImageCompressionKitIsSupportedInputType(imageType)) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitUnsupportedFormatCode,
        @"iOS MVP supports JPEG, PNG, GIF, WebP, HEIC, and HEIF input only. GIF, WebP, HEIC, and HEIF input are decoded as static images through ImageIO.",
        nil
      );
      return;
    }

    __block UIImage *sourceImage = nil;
    __block UIImage *processedImage = nil;
    __block NSData *outputData = nil;
    RCTImageCompressionKitSmokeLog(@"image-work-start");
    RCTImageCompressionKitRunImageWork(^{
      sourceImage = RCTImageCompressionKitDecodeImage(sourceData, imageType);
      if (sourceImage == nil || sourceImage.size.width <= 0 || sourceImage.size.height <= 0) {
        return;
      }

      processedImage = RCTImageCompressionKitRenderImage(sourceImage, resizeOptions, outputIsJpeg);
      if (outputIsPng) {
        outputData = RCTImageCompressionKitEncodePng(processedImage);
      } else if (outputIsWebP) {
        outputData = hasMaxBytes
          ? RCTImageCompressionKitEncodeToTargetSize(processedImage, outputFormat, quality, maxBytes)
          : RCTImageCompressionKitEncodeWebP(processedImage, quality);
      } else {
        outputData = hasMaxBytes
          ? RCTImageCompressionKitEncodeToTargetSize(processedImage, outputFormat, quality, maxBytes)
          : RCTImageCompressionKitEncodeJpeg(processedImage, quality);
      }
    });
    RCTImageCompressionKitSmokeLog(@"image-work-finished");

    if (sourceImage == nil || sourceImage.size.width <= 0 || sourceImage.size.height <= 0) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitDecodeFailedCode,
        @"iOS MVP could not decode the source image.",
        nil
      );
      return;
    }

    if (processedImage == nil || outputData == nil || outputData.length == 0) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitEncodeFailedCode,
        [NSString stringWithFormat:@"iOS MVP could not encode %@ output.", [outputFormat uppercaseString]],
        nil
      );
      return;
    }
    RCTImageCompressionKitSmokeLog([NSString stringWithFormat:@"%@-encoded", outputFormat]);

    NSError *outputPathError = nil;
    NSString *outputPath = RCTImageCompressionKitOutputPath(outputFormat, &outputPathError);
    if (outputPath == nil) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitEncodeFailedCode,
        @"iOS MVP could not create an output cache file.",
        outputPathError
      );
      return;
    }
    RCTImageCompressionKitSmokeLog(@"output-path-ready");

    NSError *writeError = nil;
    if (![outputData writeToFile:outputPath options:NSDataWritingAtomic error:&writeError]) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitEncodeFailedCode,
        [NSString stringWithFormat:@"iOS MVP could not write %@ output.", [outputFormat uppercaseString]],
        writeError
      );
      return;
    }
    RCTImageCompressionKitSmokeLog(@"output-written");

    CGSize outputSize = RCTImageCompressionKitPixelSize(processedImage);
    double byteSize = (double)outputData.length;
    double originalByteSize = (double)sourceData.length;
    double compressionRatio = originalByteSize > 0.0 ? byteSize / originalByteSize : 1.0;

    resolve(@{
      @"uri" : [[NSURL fileURLWithPath:outputPath] absoluteString],
      @"format" : outputFormat,
      @"width" : @((NSInteger)outputSize.width),
      @"height" : @((NSInteger)outputSize.height),
      @"byteSize" : @(byteSize),
      @"originalByteSize" : @(originalByteSize),
      @"compressionRatio" : @(compressionRatio)
    });
    RCTImageCompressionKitSmokeLog(@"compress-resolved");
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
    @"supportsTargetSizeCompression" : @YES,
    @"supportsCancellation" : @NO
  });
}

@end
