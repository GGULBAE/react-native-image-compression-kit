#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>

#import "RCTImageCompressionImageEncoder.h"
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

static NSString *RCTWriteFixture(NSData *data, NSString *extension)
{
  NSString *path = [NSTemporaryDirectory() stringByAppendingPathComponent:
    [NSString stringWithFormat:@"rnick-%@.%@", NSUUID.UUID.UUIDString, extension]
  ];
  RCTLargeAssert([data writeToFile:path atomically:YES], @"writes source fixture");
  return path;
}

static RCTImageCompressionPipelineResult *RCTCompress(
  NSString *sourcePath,
  NSString *format,
  NSDictionary *resize,
  RCTImageCompressionPipelineError **error
) {
  NSMutableDictionary *options = [@{
    @"source" : @{ @"uri" : [NSURL fileURLWithPath:sourcePath].absoluteString },
    @"output" : @{ @"format" : format, @"quality" : @82 },
    @"metadata" : @"safe",
  } mutableCopy];
  if (resize != nil) options[@"resize"] = resize;
  RCTImageCompressionPipeline *pipeline = [RCTImageCompressionPipeline defaultPipeline];
  return [pipeline
    executeRequest:[[RCTImageCompressionPipelineRequest alloc] initWithOptions:options]
    error:error
  ];
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
