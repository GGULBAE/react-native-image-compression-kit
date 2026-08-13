#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>

#import "RCTImageCompressionImageEncoder.h"
#import "RCTImageCompressionJpegSegmentSanitizer.h"
#import "RCTImageCompressionOutput.h"
#import "RCTImageCompressionPipeline.h"

static NSUInteger RCTLargeImageAssertions = 0;
static NSUInteger RCTLargeImageFailures = 0;

static void RCTLargeAssert(BOOL condition, NSString *message)
{
  RCTLargeImageAssertions += 1;
  if (!condition) {
    RCTLargeImageFailures += 1;
    fprintf(stderr, "FAIL: %s\n", message.UTF8String);
  }
}

static void RCTLargeAssertEqualObjects(id actual, id expected, NSString *message)
{
  RCTLargeAssert(
    actual == expected || [actual isEqual:expected],
    [NSString stringWithFormat:@"%@ (actual=%@ expected=%@)", message, actual, expected]
  );
}

static NSData *RCTEncodeImage(CGImageRef image, NSString *type, NSDictionary *properties)
{
  NSMutableData *data = [NSMutableData data];
  CGImageDestinationRef destination = CGImageDestinationCreateWithData(
    (__bridge CFMutableDataRef)data,
    (__bridge CFStringRef)type,
    1,
    nil
  );
  RCTLargeAssert(destination != nil, @"creates image destination");
  if (destination == nil) return nil;
  CGImageDestinationAddImage(destination, image, (__bridge CFDictionaryRef)properties);
  BOOL finalized = CGImageDestinationFinalize(destination);
  CFRelease(destination);
  RCTLargeAssert(finalized && data.length > 0, @"finalizes encoded fixture");
  return data;
}

static NSData *RCTCreateSolidImageData(
  size_t width,
  size_t height,
  BOOL opaque,
  NSString *type
) {
  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(
    nil,
    width,
    height,
    8,
    width * 4,
    colorSpace,
    kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big
  );
  CGColorSpaceRelease(colorSpace);
  RCTLargeAssert(context != nil, @"allocates source fixture context");
  if (context == nil) return nil;
  if (opaque) {
    CGContextSetRGBFillColor(context, 0.2, 0.4, 0.6, 1.0);
    CGContextFillRect(context, CGRectMake(0, 0, width, height));
  } else {
    CGContextClearRect(context, CGRectMake(0, 0, width, height));
  }
  CGImageRef image = CGBitmapContextCreateImage(context);
  CGContextRelease(context);
  RCTLargeAssert(image != nil, @"creates source fixture image");
  if (image == nil) return nil;
  NSDictionary *properties = [type isEqualToString:@"public.jpeg"]
    ? @{ (__bridge NSString *)kCGImageDestinationLossyCompressionQuality : @0.82 }
    : @{};
  NSData *data = RCTEncodeImage(image, type, properties);
  CGImageRelease(image);
  return data;
}

static NSData *RCTCreateOrientedQuadrantJpeg(NSInteger orientation)
{
  size_t width = 80;
  size_t height = 60;
  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(
    nil,
    width,
    height,
    8,
    width * 4,
    colorSpace,
    kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big
  );
  CGColorSpaceRelease(colorSpace);
  RCTLargeAssert(context != nil, @"allocates oriented quadrant fixture context");
  if (context == nil) return nil;

  const CGFloat colors[][4] = {
    {0.94, 0.08, 0.08, 1.0},
    {0.08, 0.86, 0.08, 1.0},
    {0.08, 0.08, 0.94, 1.0},
    {0.94, 0.86, 0.08, 1.0},
  };
  const CGRect quadrants[] = {
    CGRectMake(0, height / 2, width / 2, height / 2),
    CGRectMake(width / 2, height / 2, width / 2, height / 2),
    CGRectMake(0, 0, width / 2, height / 2),
    CGRectMake(width / 2, 0, width / 2, height / 2),
  };
  for (NSUInteger index = 0; index < 4; index += 1) {
    CGContextSetRGBFillColor(
      context,
      colors[index][0],
      colors[index][1],
      colors[index][2],
      colors[index][3]
    );
    CGContextFillRect(context, quadrants[index]);
  }
  CGImageRef image = CGBitmapContextCreateImage(context);
  CGContextRelease(context);
  RCTLargeAssert(image != nil, @"creates oriented quadrant fixture image");
  if (image == nil) return nil;
  NSData *data = RCTEncodeImage(
    image,
    @"public.jpeg",
    @{
      (__bridge NSString *)kCGImageDestinationLossyCompressionQuality : @0.92,
      (__bridge NSString *)kCGImagePropertyOrientation : @(orientation),
      (__bridge NSString *)kCGImagePropertyTIFFDictionary : @{
        (__bridge NSString *)kCGImagePropertyTIFFArtist : @"metadata-test-artist",
      },
    }
  );
  CGImageRelease(image);
  return data;
}

static CGImageRef RCTCreateUprightThumbnail(NSData *data)
{
  CGImageSourceRef source = CGImageSourceCreateWithData(
    (__bridge CFDataRef)data,
    nil
  );
  if (source == nil) return nil;
  NSDictionary *options = @{
    (__bridge NSString *)kCGImageSourceCreateThumbnailFromImageAlways : @YES,
    (__bridge NSString *)kCGImageSourceCreateThumbnailWithTransform : @YES,
    (__bridge NSString *)kCGImageSourceShouldCacheImmediately : @YES,
    (__bridge NSString *)kCGImageSourceThumbnailMaxPixelSize : @80,
  };
  CGImageRef image = CGImageSourceCreateThumbnailAtIndex(
    source,
    0,
    (__bridge CFDictionaryRef)options
  );
  CFRelease(source);
  return image;
}

static NSData *RCTRenderedPixels(CGImageRef image, size_t width, size_t height)
{
  NSMutableData *pixels = [NSMutableData dataWithLength:width * height * 4];
  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(
    pixels.mutableBytes,
    width,
    height,
    8,
    width * 4,
    colorSpace,
    kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big
  );
  CGColorSpaceRelease(colorSpace);
  if (context == nil) return nil;
  CGContextSetInterpolationQuality(context, kCGInterpolationNone);
  CGContextDrawImage(context, CGRectMake(0, 0, width, height), image);
  CGContextRelease(context);
  return pixels;
}

static CGFloat RCTMeanAbsoluteRgbDifference(NSData *left, NSData *right)
{
  if (left.length == 0 || left.length != right.length) return CGFLOAT_MAX;
  const uint8_t *leftBytes = (const uint8_t *)left.bytes;
  const uint8_t *rightBytes = (const uint8_t *)right.bytes;
  unsigned long long difference = 0;
  NSUInteger rgbChannelCount = 0;
  for (NSUInteger offset = 0; offset < left.length; offset += 4) {
    for (NSUInteger channel = 0; channel < 3; channel += 1) {
      difference += (unsigned long long)labs(
        (long)leftBytes[offset + channel] - (long)rightBytes[offset + channel]
      );
      rgbChannelCount += 1;
    }
  }
  return (CGFloat)difference / (CGFloat)rgbChannelCount;
}

static NSString *RCTWriteFixture(NSData *data, NSString *extension)
{
  NSString *path = [NSTemporaryDirectory() stringByAppendingPathComponent:
    [NSString stringWithFormat:@"rnick-%@.%@", NSUUID.UUID.UUIDString, extension]
  ];
  RCTLargeAssert([data writeToFile:path atomically:YES], @"writes source fixture");
  return path;
}

static RCTImageCompressionPipelineResult *RCTCompressWithMetadata(
  NSString *sourcePath,
  NSString *format,
  NSDictionary *resize,
  NSString *metadataPolicy,
  RCTImageCompressionPipelineError **error
) {
  NSMutableDictionary *options = [@{
    @"source" : @{ @"uri" : [NSURL fileURLWithPath:sourcePath].absoluteString },
    @"output" : @{ @"format" : format, @"quality" : @82 },
    @"metadata" : metadataPolicy,
  } mutableCopy];
  if (resize != nil) options[@"resize"] = resize;
  RCTImageCompressionPipeline *pipeline = [RCTImageCompressionPipeline defaultPipeline];
  return [pipeline
    executeRequest:[[RCTImageCompressionPipelineRequest alloc] initWithOptions:options]
    error:error
  ];
}

static RCTImageCompressionPipelineResult *RCTCompress(
  NSString *sourcePath,
  NSString *format,
  NSDictionary *resize,
  RCTImageCompressionPipelineError **error
) {
  return RCTCompressWithMetadata(
    sourcePath,
    format,
    resize,
    @"safe",
    error
  );
}

static NSArray<NSNumber *> *RCTCenterPixel(NSString *outputURI)
{
  NSURL *URL = [NSURL URLWithString:outputURI];
  CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)URL, nil);
  CGImageRef image = source == nil ? nil : CGImageSourceCreateImageAtIndex(source, 0, nil);
  if (source != nil) CFRelease(source);
  RCTLargeAssert(image != nil, @"decodes output pixels");
  if (image == nil) return @[];

  unsigned char pixel[4] = {0, 0, 0, 0};
  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(
    pixel,
    1,
    1,
    8,
    4,
    colorSpace,
    kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big
  );
  CGColorSpaceRelease(colorSpace);
  CGContextDrawImage(context, CGRectMake(0, 0, 1, 1), image);
  CGContextRelease(context);
  CGImageRelease(image);
  return @[@(pixel[0]), @(pixel[1]), @(pixel[2]), @(pixel[3])];
}

static void RCTRemoveResult(RCTImageCompressionPipelineResult *result)
{
  if (result == nil) return;
  NSURL *URL = [NSURL URLWithString:result.outputResult.uri];
  if (URL.isFileURL) [[NSFileManager defaultManager] removeItemAtURL:URL error:nil];
}

static void TestDownsamples48MPBeforeTransform(void)
{
  NSData *jpeg = RCTCreateSolidImageData(8000, 6000, YES, @"public.jpeg");
  NSString *sourcePath = RCTWriteFixture(jpeg, @"jpg");
  RCTImageCompressionPipelineError *error = nil;
  RCTImageCompressionPipelineResult *result = RCTCompress(
    sourcePath,
    @"jpeg",
    @{ @"maxWidth" : @1600, @"maxHeight" : @1200, @"mode" : @"contain" },
    &error
  );
  RCTLargeAssert(result != nil && error == nil, @"48MP resize succeeds");
  RCTLargeAssert(result.outputResult.width == 1600, @"48MP resize width is exact");
  RCTLargeAssert(result.outputResult.height == 1200, @"48MP resize height is exact");
  RCTLargeAssert(result.outputResult.byteSize > 0, @"48MP result contains complete bytes");
  RCTRemoveResult(result);

  error = nil;
  result = RCTCompress(sourcePath, @"jpeg", nil, &error);
  RCTLargeAssert(result == nil, @"unbounded 48MP work is rejected");
  RCTLargeAssert(
    [error.code isEqualToString:RCTImageCompressionKitResourceLimitCode],
    @"unbounded 48MP work uses ERR_RESOURCE_LIMIT"
  );
  [[NSFileManager defaultManager] removeItemAtPath:sourcePath error:nil];
}

static void TestAlphaAndJpegBackgroundDecodeBack(void)
{
  NSData *png = RCTCreateSolidImageData(16, 16, NO, @"public.png");
  NSString *sourcePath = RCTWriteFixture(png, @"png");
  NSMutableArray<NSString *> *formats = [NSMutableArray arrayWithObjects:@"png", @"jpeg", nil];
  if ([RCTImageCompressionImageEncoder defaultWebPOutputAvailable]) {
    [formats addObject:@"webp"];
  }

  for (NSString *format in formats) {
    RCTImageCompressionPipelineError *error = nil;
    RCTImageCompressionPipelineResult *result = RCTCompress(sourcePath, format, nil, &error);
    RCTLargeAssert(result != nil && error == nil, [NSString stringWithFormat:@"%@ alpha conversion succeeds", format]);
    NSArray<NSNumber *> *pixel = RCTCenterPixel(result.outputResult.uri);
    if ([format isEqualToString:@"jpeg"]) {
      RCTLargeAssert(
        pixel.count == 4 && pixel[0].integerValue > 245 && pixel[1].integerValue > 245 && pixel[2].integerValue > 245,
        @"JPEG flattens transparency onto white"
      );
    } else {
      RCTLargeAssert(pixel.count == 4 && pixel[3].integerValue < 8, [NSString stringWithFormat:@"%@ preserves alpha", format]);
    }
    RCTRemoveResult(result);
  }
  [[NSFileManager defaultManager] removeItemAtPath:sourcePath error:nil];
}

static void TestExifOrientationMatrixPreservesDisplayedLayout(void)
{
  for (NSInteger orientation = 1; orientation <= 8; orientation += 1) {
    NSData *jpeg = RCTCreateOrientedQuadrantJpeg(orientation);
    NSString *sourcePath = RCTWriteFixture(jpeg, @"jpg");
    CGImageRef expected = RCTCreateUprightThumbnail(jpeg);
    RCTLargeAssert(
      expected != nil,
      [NSString stringWithFormat:@"orientation %ld creates upright reference", (long)orientation]
    );

    RCTImageCompressionPipelineError *error = nil;
    RCTImageCompressionPipelineResult *result = RCTCompress(
      sourcePath,
      @"jpeg",
      nil,
      &error
    );
    RCTLargeAssert(
      result != nil && error == nil,
      [NSString stringWithFormat:@"orientation %ld compresses", (long)orientation]
    );
    NSURL *outputURL = result == nil ? nil : [NSURL URLWithString:result.outputResult.uri];
    CGImageSourceRef outputSource = outputURL == nil ? nil : CGImageSourceCreateWithURL(
      (__bridge CFURLRef)outputURL,
      nil
    );
    CGImageRef output = outputSource == nil
      ? nil
      : CGImageSourceCreateImageAtIndex(outputSource, 0, nil);
    NSDictionary *outputProperties = outputSource == nil
      ? nil
      : CFBridgingRelease(CGImageSourceCopyPropertiesAtIndex(outputSource, 0, nil));
    if (outputSource != nil) CFRelease(outputSource);
    RCTLargeAssert(
      output != nil,
      [NSString stringWithFormat:@"orientation %ld decodes output", (long)orientation]
    );

    if (expected != nil && output != nil) {
      size_t expectedWidth = CGImageGetWidth(expected);
      size_t expectedHeight = CGImageGetHeight(expected);
      RCTLargeAssert(
        CGImageGetWidth(output) == expectedWidth && CGImageGetHeight(output) == expectedHeight,
        [NSString stringWithFormat:@"orientation %ld keeps displayed dimensions", (long)orientation]
      );
      NSData *expectedPixels = RCTRenderedPixels(expected, expectedWidth, expectedHeight);
      NSData *outputPixels = RCTRenderedPixels(output, expectedWidth, expectedHeight);
      CGFloat meanDifference = RCTMeanAbsoluteRgbDifference(expectedPixels, outputPixels);
      RCTLargeAssert(
        meanDifference < 18.0,
        [NSString stringWithFormat:
          @"orientation %ld keeps displayed pixel layout (mean RGB difference %.2f)",
          (long)orientation,
          meanDifference
        ]
      );
    }
    NSInteger outputOrientation = [outputProperties[
      (__bridge NSString *)kCGImagePropertyOrientation
    ] integerValue];
    RCTLargeAssert(
      outputOrientation == 0 || outputOrientation == 1,
      [NSString stringWithFormat:@"orientation %ld is normalized in output metadata", (long)orientation]
    );

    if (expected != nil) CGImageRelease(expected);
    if (output != nil) CGImageRelease(output);
    RCTRemoveResult(result);
    [[NSFileManager defaultManager] removeItemAtPath:sourcePath error:nil];
  }
}

static void TestStripSanitizesJpegWithoutChangingGeometry(void)
{
  NSData *jpeg = RCTCreateOrientedQuadrantJpeg(6);
  NSString *sourcePath = RCTWriteFixture(jpeg, @"jpg");
  CGImageRef expected = RCTCreateUprightThumbnail(jpeg);
  RCTLargeAssert(expected != nil, @"strip integration creates upright reference");

  RCTImageCompressionPipelineError *stripError = nil;
  RCTImageCompressionPipelineResult *stripResult = RCTCompressWithMetadata(
    sourcePath,
    @"jpeg",
    nil,
    @"strip",
    &stripError
  );
  RCTLargeAssert(
    stripResult != nil && stripError == nil,
    @"strip integration compresses oriented JPEG"
  );
  NSURL *stripURL = stripResult == nil
    ? nil
    : [NSURL URLWithString:stripResult.outputResult.uri];
  NSData *stripData = stripURL == nil ? nil : [NSData dataWithContentsOfURL:stripURL];
  NSData *resanitizedStripData = stripData == nil
    ? nil
    : [RCTImageCompressionJpegSegmentSanitizer
        sanitizeJpegData:stripData
        stripRequested:YES
      ];
  RCTLargeAssert(
    stripData.length > 0 && [stripData isEqualToData:resanitizedStripData],
    @"strip output is a strict JPEG with no remaining APP1, APP13, or COM segments"
  );
  RCTLargeAssert(
    stripResult.outputResult.byteSize == stripData.length,
    @"strip result metrics and persisted bytes use the sanitized JPEG"
  );

  CGImageSourceRef stripSource = stripData == nil
    ? nil
    : CGImageSourceCreateWithData((__bridge CFDataRef)stripData, nil);
  CGImageRef stripImage = stripSource == nil
    ? nil
    : CGImageSourceCreateImageAtIndex(stripSource, 0, nil);
  NSDictionary *stripProperties = stripSource == nil
    ? nil
    : CFBridgingRelease(CGImageSourceCopyPropertiesAtIndex(stripSource, 0, nil));
  if (stripSource != nil) CFRelease(stripSource);
  RCTLargeAssert(stripImage != nil, @"strict strip output decodes");
  NSDictionary *stripTiff = stripProperties[
    (__bridge NSString *)kCGImagePropertyTIFFDictionary
  ];
  RCTLargeAssert(
    stripTiff[(__bridge NSString *)kCGImagePropertyTIFFArtist] == nil,
    @"strip output removes source TIFF artist metadata"
  );
  NSInteger stripOrientation = [stripProperties[
    (__bridge NSString *)kCGImagePropertyOrientation
  ] integerValue];
  RCTLargeAssert(
    stripOrientation == 0 || stripOrientation == 1,
    @"strip output keeps normalized orientation metadata"
  );

  if (expected != nil && stripImage != nil) {
    size_t expectedWidth = CGImageGetWidth(expected);
    size_t expectedHeight = CGImageGetHeight(expected);
    RCTLargeAssert(
      CGImageGetWidth(stripImage) == expectedWidth &&
        CGImageGetHeight(stripImage) == expectedHeight &&
        stripResult.outputResult.width == expectedWidth &&
        stripResult.outputResult.height == expectedHeight,
      @"strip output keeps normalized displayed dimensions"
    );
    NSData *expectedPixels = RCTRenderedPixels(
      expected,
      expectedWidth,
      expectedHeight
    );
    NSData *stripPixels = RCTRenderedPixels(
      stripImage,
      expectedWidth,
      expectedHeight
    );
    RCTLargeAssert(
      RCTMeanAbsoluteRgbDifference(expectedPixels, stripPixels) < 18.0,
      @"strip output keeps upright displayed pixels"
    );
  }

  RCTImageCompressionPipelineError *preserveError = nil;
  RCTImageCompressionPipelineResult *preserveResult = RCTCompressWithMetadata(
    sourcePath,
    @"jpeg",
    nil,
    @"preserve",
    &preserveError
  );
  RCTLargeAssert(
    preserveResult != nil && preserveError == nil,
    @"preserve integration compresses oriented JPEG"
  );
  NSURL *preserveURL = preserveResult == nil
    ? nil
    : [NSURL URLWithString:preserveResult.outputResult.uri];
  NSData *preserveData = preserveURL == nil
    ? nil
    : [NSData dataWithContentsOfURL:preserveURL];
  NSData *sanitizedPreserveData = preserveData == nil
    ? nil
    : [RCTImageCompressionJpegSegmentSanitizer
        sanitizeJpegData:preserveData
        stripRequested:YES
      ];
  RCTLargeAssert(
    sanitizedPreserveData != nil &&
      ![preserveData isEqualToData:sanitizedPreserveData],
    @"preserve output keeps marker metadata that strip would remove"
  );
  CGImageSourceRef preserveSource = preserveData == nil
    ? nil
    : CGImageSourceCreateWithData((__bridge CFDataRef)preserveData, nil);
  NSDictionary *preserveProperties = preserveSource == nil
    ? nil
    : CFBridgingRelease(
        CGImageSourceCopyPropertiesAtIndex(preserveSource, 0, nil)
      );
  if (preserveSource != nil) CFRelease(preserveSource);
  NSDictionary *preserveTiff = preserveProperties[
    (__bridge NSString *)kCGImagePropertyTIFFDictionary
  ];
  RCTLargeAssertEqualObjects(
    preserveTiff[(__bridge NSString *)kCGImagePropertyTIFFArtist],
    @"metadata-test-artist",
    @"preserve output retains source TIFF artist metadata"
  );
  NSInteger preserveOrientation = [preserveProperties[
    (__bridge NSString *)kCGImagePropertyOrientation
  ] integerValue];
  RCTLargeAssert(
    preserveOrientation == 0 || preserveOrientation == 1,
    @"preserve output keeps normalized orientation metadata"
  );

  if (expected != nil) CGImageRelease(expected);
  if (stripImage != nil) CGImageRelease(stripImage);
  RCTRemoveResult(stripResult);
  RCTRemoveResult(preserveResult);
  [[NSFileManager defaultManager] removeItemAtPath:sourcePath error:nil];
}

static void TestCancellationRemovesPublishedOutput(void)
{
  NSData *jpeg = RCTCreateSolidImageData(64, 48, YES, @"public.jpeg");
  NSString *sourcePath = RCTWriteFixture(jpeg, @"jpg");
  NSString *outputDirectory = [[NSSearchPathForDirectoriesInDomains(
    NSCachesDirectory,
    NSUserDomainMask,
    YES
  ) firstObject] stringByAppendingPathComponent:@"ImageCompressionKit"];
  NSSet *before = [NSSet setWithArray:
    [[NSFileManager defaultManager] contentsOfDirectoryAtPath:outputDirectory error:nil] ?: @[]
  ];
  NSDictionary *options = @{
    @"source" : @{ @"uri" : [NSURL fileURLWithPath:sourcePath].absoluteString },
    @"output" : @{ @"format" : @"jpeg", @"quality" : @82 },
    @"metadata" : @"safe",
  };
  __block NSUInteger checks = 0;
  RCTImageCompressionPipelineError *error = nil;
  RCTImageCompressionPipelineResult *result = [[RCTImageCompressionPipeline defaultPipeline]
    executeRequest:[[RCTImageCompressionPipelineRequest alloc] initWithOptions:options]
    cancellationCheck:^BOOL{
      checks += 1;
      return checks >= 11;
    }
    error:&error
  ];
  NSSet *after = [NSSet setWithArray:
    [[NSFileManager defaultManager] contentsOfDirectoryAtPath:outputDirectory error:nil] ?: @[]
  ];

  RCTLargeAssert(result == nil, @"post-write cancellation returns no result");
  RCTLargeAssert([error.code isEqualToString:RCTImageCompressionKitCancelledCode], @"post-write cancellation uses ERR_CANCELLED");
  RCTLargeAssert([before isEqualToSet:after], @"post-write cancellation removes published cache output");
  [[NSFileManager defaultManager] removeItemAtPath:sourcePath error:nil];
}

int main(void)
{
  @autoreleasepool {
    TestDownsamples48MPBeforeTransform();
    TestAlphaAndJpegBackgroundDecodeBack();
    TestExifOrientationMatrixPreservesDisplayedLayout();
    TestStripSanitizesJpegWithoutChangingGeometry();
    TestCancellationRemovesPublishedOutput();
    if (RCTLargeImageFailures > 0) {
      fprintf(stderr, "iOS large-image tests failed: %lu/%lu assertions.\n",
        (unsigned long)RCTLargeImageFailures,
        (unsigned long)RCTLargeImageAssertions);
      return 1;
    }
    printf("iOS large-image tests passed: %lu assertions.\n", (unsigned long)RCTLargeImageAssertions);
  }
  return 0;
}
