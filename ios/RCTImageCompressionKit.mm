#import "RCTImageCompressionKit.h"
#import "RCTImageCompressionRequest.h"

#import <ImageIO/ImageIO.h>
#import <UIKit/UIKit.h>

#include <math.h>
#include <memory>
#include <string.h>

static NSString *const RCTImageCompressionKitUnsupportedSourceCode = @"ERR_UNSUPPORTED_SOURCE";
static NSString *const RCTImageCompressionKitUnsupportedFormatCode = @"ERR_UNSUPPORTED_FORMAT";
static NSString *const RCTImageCompressionKitFileAccessCode = @"ERR_FILE_ACCESS";
static NSString *const RCTImageCompressionKitDecodeFailedCode = @"ERR_DECODE_FAILED";
static NSString *const RCTImageCompressionKitEncodeFailedCode = @"ERR_ENCODE_FAILED";
static NSString *const RCTImageCompressionKitNativeOperationFailedCode = @"ERR_NATIVE_OPERATION_FAILED";

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

static BOOL RCTImageCompressionKitCanEncodeWebP(void);
static BOOL RCTImageCompressionKitCanDecodeAVIF(void);

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
        @"Metadata preserve copies source JPEG metadata and normalizes output orientation/dimensions for JPEG input to JPEG output.",
        @"Metadata safe and strip re-encode without copying source metadata.",
        @"Non-JPEG input or non-JPEG output rejects metadata preserve with ERR_NOT_IMPLEMENTED."
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

  if ([format isEqualToString:RCTImageCompressionKitAvifFormat]) {
    BOOL canDecodeAVIF = RCTImageCompressionKitCanDecodeAVIF();
    BOOL canEncodeWebP = RCTImageCompressionKitCanEncodeWebP();
    return RCTImageCompressionKitFormatCapability(
      format,
      canDecodeAVIF,
      NO,
      canDecodeAVIF,
      NO,
      @[
        canDecodeAVIF
          ? @"This runtime advertises ImageIO AVIF source support, so iOS MVP decodes AVIF input as a static image through ImageIO."
          : @"This runtime does not advertise ImageIO AVIF source support, so AVIF input rejects with ERR_UNSUPPORTED_FORMAT.",
        canDecodeAVIF
          ? @"AVIF input can be re-encoded to JPEG or PNG output without copying source metadata."
          : @"Call getImageCompressionCapabilities() before accepting AVIF input on iOS.",
        canDecodeAVIF && canEncodeWebP
          ? @"AVIF input can also be re-encoded to runtime-available WebP output."
          : @"WebP output still requires runtime ImageIO WebP destination support.",
        @"Animated AVIF preservation is not implemented.",
        @"AVIF output is not implemented.",
        @"AVIF capability reports output=false; selecting output.format: 'avif' rejects with ERR_NOT_IMPLEMENTED.",
        @"Future iOS AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation.",
        @"metadata='preserve', output.maxBytes, and animated AVIF preservation remain unsupported for AVIF output until explicitly designed and tested."
      ]
    );
  }

  return RCTImageCompressionKitFormatCapability(
    format,
    NO,
    NO,
    NO,
    NO,
    @[@"iOS MVP supports JPEG, PNG, static GIF, static WebP, static HEIC, static HEIF, and runtime-available static AVIF input with JPEG, PNG, or runtime ImageIO-backed WebP output only."]
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

static BOOL RCTImageCompressionKitIsJpegType(NSString *imageType)
{
  return
    [imageType isEqualToString:@"public.jpeg"] ||
    [imageType isEqualToString:@"public.jpg"] ||
    [imageType isEqualToString:@"image/jpeg"];
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

static NSArray<NSString *> *RCTImageCompressionKitAvifTypeIdentifiers(void)
{
  return @[@"public.avif", @"public.avifs", @"org.aomedia.avif", @"org.aomedia.avifs"];
}

static BOOL RCTImageCompressionKitIsAvifType(NSString *imageType)
{
  return [RCTImageCompressionKitAvifTypeIdentifiers() containsObject:imageType];
}

static NSString *RCTImageCompressionKitAvailableImageSourceTypeIdentifier(NSArray<NSString *> *candidateTypes)
{
  NSArray<NSString *> *supportedTypes = CFBridgingRelease(CGImageSourceCopyTypeIdentifiers());

  for (NSString *candidateType in candidateTypes) {
    if ([supportedTypes containsObject:candidateType]) {
      return candidateType;
    }
  }

  return nil;
}

static BOOL RCTImageCompressionKitCanDecodeAVIF(void)
{
  return RCTImageCompressionKitAvailableImageSourceTypeIdentifier(RCTImageCompressionKitAvifTypeIdentifiers()) != nil;
}

static BOOL RCTImageCompressionKitLooksLikeAVIFData(NSData *sourceData)
{
  if (sourceData.length < 12) {
    return NO;
  }

  const unsigned char *bytes = (const unsigned char *)sourceData.bytes;
  if (memcmp(bytes + 4, "ftyp", 4) != 0) {
    return NO;
  }

  NSUInteger searchLength = MIN(sourceData.length, (NSUInteger)64);
  for (NSUInteger offset = 8; offset + 4 <= searchLength; offset += 4) {
    if (memcmp(bytes + offset, "avif", 4) == 0 || memcmp(bytes + offset, "avis", 4) == 0) {
      return YES;
    }
  }

  return NO;
}

static BOOL RCTImageCompressionKitShouldDecodeFirstFrame(NSString *imageType)
{
  return
    RCTImageCompressionKitIsGifType(imageType) ||
    RCTImageCompressionKitIsWebPType(imageType) ||
    RCTImageCompressionKitIsHeicHeifType(imageType) ||
    RCTImageCompressionKitIsAvifType(imageType);
}

static BOOL RCTImageCompressionKitIsSupportedInputType(NSString *imageType)
{
  return
    RCTImageCompressionKitIsJpegType(imageType) ||
    [imageType isEqualToString:@"public.png"] ||
    RCTImageCompressionKitIsGifType(imageType) ||
    RCTImageCompressionKitIsWebPType(imageType) ||
    RCTImageCompressionKitIsHeicHeifType(imageType) ||
    (RCTImageCompressionKitIsAvifType(imageType) && RCTImageCompressionKitCanDecodeAVIF());
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

static NSDictionary *RCTImageCompressionKitSourceImageProperties(NSData *sourceData)
{
  CGImageSourceRef imageSource = CGImageSourceCreateWithData((__bridge CFDataRef)sourceData, nil);
  if (imageSource == nil) {
    return nil;
  }

  NSDictionary *properties = nil;
  if (CGImageSourceGetCount(imageSource) > 0) {
    properties = CFBridgingRelease(CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil));
  }

  CFRelease(imageSource);
  return properties;
}

static NSDictionary *RCTImageCompressionKitJpegDestinationProperties(
  NSInteger quality,
  NSDictionary *sourceProperties,
  NSUInteger pixelWidth,
  NSUInteger pixelHeight
) {
  NSMutableDictionary *properties = sourceProperties != nil
    ? [sourceProperties mutableCopy]
    : [NSMutableDictionary dictionary];

  properties[(__bridge NSString *)kCGImageDestinationLossyCompressionQuality] = @((CGFloat)quality / 100.0);
  if (sourceProperties != nil) {
    properties[(__bridge NSString *)kCGImagePropertyPixelWidth] = @(pixelWidth);
    properties[(__bridge NSString *)kCGImagePropertyPixelHeight] = @(pixelHeight);
    properties[(__bridge NSString *)kCGImagePropertyOrientation] = @1;

    NSDictionary *tiffProperties = properties[(__bridge NSString *)kCGImagePropertyTIFFDictionary];
    if ([tiffProperties isKindOfClass:[NSDictionary class]]) {
      NSMutableDictionary *mutableTiffProperties = [tiffProperties mutableCopy];
      mutableTiffProperties[(__bridge NSString *)kCGImagePropertyTIFFOrientation] = @1;
      properties[(__bridge NSString *)kCGImagePropertyTIFFDictionary] = mutableTiffProperties;
    }

    NSDictionary *exifProperties = properties[(__bridge NSString *)kCGImagePropertyExifDictionary];
    if ([exifProperties isKindOfClass:[NSDictionary class]]) {
      NSMutableDictionary *mutableExifProperties = [exifProperties mutableCopy];
      mutableExifProperties[(__bridge NSString *)kCGImagePropertyExifPixelXDimension] = @(pixelWidth);
      mutableExifProperties[(__bridge NSString *)kCGImagePropertyExifPixelYDimension] = @(pixelHeight);
      properties[(__bridge NSString *)kCGImagePropertyExifDictionary] = mutableExifProperties;
    }
  }

  return properties;
}

static NSData *RCTImageCompressionKitEncodeJpeg(
  UIImage *image,
  NSInteger quality,
  NSDictionary *sourceProperties
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

  NSDictionary *properties = RCTImageCompressionKitJpegDestinationProperties(
    quality,
    sourceProperties,
    CGImageGetWidth(cgImage),
    CGImageGetHeight(cgImage)
  );
  CGImageDestinationAddImage(destination, cgImage, (__bridge CFDictionaryRef)properties);
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
  NSDictionary *jpegSourceProperties
) {
  if ([outputFormat isEqualToString:RCTImageCompressionKitWebPFormat]) {
    return RCTImageCompressionKitEncodeWebP(image, quality);
  }

  return RCTImageCompressionKitEncodeJpeg(image, quality, jpegSourceProperties);
}

static NSData *RCTImageCompressionKitEncodeToTargetSize(
  UIImage *image,
  NSString *outputFormat,
  NSInteger qualityCap,
  NSUInteger maxBytes,
  NSDictionary *jpegSourceProperties
) {
  NSData *outputData = RCTImageCompressionKitEncodeQualityOutput(
    image,
    outputFormat,
    qualityCap,
    jpegSourceProperties
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
      jpegSourceProperties
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
  UIImage *processedImage,
  NSData *outputData,
  NSData *sourceData
) {
  CGSize outputSize = RCTImageCompressionKitPixelSize(processedImage);
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

    NSString *outputFormat = request.outputFormat;

    NSURL *sourceURL = RCTImageCompressionKitSourceURL(request.sourceURI);
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

    BOOL sourceLooksLikeAVIF = RCTImageCompressionKitLooksLikeAVIFData(sourceData);
    BOOL canDecodeAVIF = RCTImageCompressionKitCanDecodeAVIF();
    if (sourceLooksLikeAVIF && !canDecodeAVIF) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitUnsupportedFormatCode,
        @"iOS AVIF input requires runtime ImageIO AVIF source support.",
        nil
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
    RCTImageCompressionKitSmokeLog([NSString stringWithFormat:@"image-type-%@", imageType]);
    if (!RCTImageCompressionKitIsSupportedInputType(imageType)) {
      if (RCTImageCompressionKitIsAvifType(imageType) || sourceLooksLikeAVIF) {
        RCTImageCompressionKitReject(
          reject,
          RCTImageCompressionKitUnsupportedFormatCode,
          @"iOS AVIF input requires runtime ImageIO AVIF source support.",
          nil
        );
        return;
      }
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitUnsupportedFormatCode,
        @"iOS MVP supports JPEG, PNG, GIF, WebP, HEIC, HEIF, and runtime-available AVIF input only. GIF, WebP, HEIC, HEIF, and AVIF input are decoded as static images through ImageIO.",
        nil
      );
      return;
    }

    BOOL metadataPreserveRequested = [request.metadataPolicy isEqualToString:RCTImageCompressionKitPreserveMetadataPolicy];
    BOOL canPreserveJpegMetadata = metadataPreserveRequested && request.outputIsJpeg && RCTImageCompressionKitIsJpegType(imageType);
    if (metadataPreserveRequested && !canPreserveJpegMetadata) {
      RCTImageCompressionKitReject(
        reject,
        RCTImageCompressionKitNotImplementedCode,
        @"iOS metadata preserve is supported only for JPEG input to JPEG output. Use safe or strip metadata for other iOS format conversions.",
        nil
      );
      return;
    }

    NSDictionary *jpegSourceProperties = canPreserveJpegMetadata
      ? RCTImageCompressionKitSourceImageProperties(sourceData)
      : nil;

    __block UIImage *sourceImage = nil;
    __block UIImage *processedImage = nil;
    __block NSData *outputData = nil;
    RCTImageCompressionKitSmokeLog(@"image-work-start");
    RCTImageCompressionKitRunImageWork(^{
      sourceImage = RCTImageCompressionKitDecodeImage(sourceData, imageType);
      if (sourceImage == nil || sourceImage.size.width <= 0 || sourceImage.size.height <= 0) {
        return;
      }

      processedImage = RCTImageCompressionKitRenderImage(sourceImage, request.resizeOptions, request.outputIsJpeg);
      if (request.outputIsPng) {
        outputData = RCTImageCompressionKitEncodePng(processedImage);
      } else if (request.outputIsWebP) {
        outputData = request.hasMaxBytes
          ? RCTImageCompressionKitEncodeToTargetSize(processedImage, outputFormat, request.quality, request.maxBytes, nil)
          : RCTImageCompressionKitEncodeWebP(processedImage, request.quality);
      } else {
        outputData = request.hasMaxBytes
          ? RCTImageCompressionKitEncodeToTargetSize(processedImage, outputFormat, request.quality, request.maxBytes, jpegSourceProperties)
          : RCTImageCompressionKitEncodeJpeg(processedImage, request.quality, jpegSourceProperties);
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

    resolve(RCTImageCompressionKitResult(outputPath, outputFormat, processedImage, outputData, sourceData));
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
