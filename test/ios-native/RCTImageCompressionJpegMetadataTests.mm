#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>

#import "RCTImageCompressionJpegMetadata.h"
#import "RCTImageCompressionRequest.h"

static NSUInteger RCTJpegMetadataAssertionCount = 0;
static NSUInteger RCTJpegMetadataFailureCount = 0;

static void RCTMetadataAssert(BOOL condition, NSString *context)
{
  RCTJpegMetadataAssertionCount += 1;
  if (!condition) {
    RCTJpegMetadataFailureCount += 1;
    fprintf(stderr, "FAIL: %s\n", context.UTF8String);
  }
}

static void RCTMetadataAssertEqualObjects(id actual, id expected, NSString *context)
{
  BOOL equal = actual == expected || [actual isEqual:expected];
  RCTMetadataAssert(
    equal,
    [NSString stringWithFormat:@"%@ (actual=%@ expected=%@)", context, actual, expected]
  );
}

static NSString *RCTMetadataKey(CFStringRef key)
{
  return (__bridge NSString *)key;
}

static RCTImageCompressionJpegMetadataRequest *RCTMetadataRequest(
  NSString *policy,
  BOOL jpegInput,
  BOOL jpegOutput,
  NSData *sourceData
) {
  return [[RCTImageCompressionJpegMetadataRequest alloc]
    initWithMetadataPolicy:policy
    jpegInput:jpegInput
    jpegOutput:jpegOutput
    sourceData:sourceData
  ];
}

static NSData *RCTMetadataCreateJpegWithProperties(void)
{
  uint8_t pixel[] = { 20, 40, 60, 255 };
  CGDataProviderRef provider = CGDataProviderCreateWithData(
    nil,
    pixel,
    sizeof(pixel),
    nil
  );
  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  CGImageRef image = CGImageCreate(
    1,
    1,
    8,
    32,
    4,
    colorSpace,
    kCGBitmapByteOrder32Big | kCGImageAlphaNoneSkipLast,
    provider,
    nil,
    NO,
    kCGRenderingIntentDefault
  );
  NSMutableData *data = [NSMutableData data];
  CGImageDestinationRef destination = CGImageDestinationCreateWithData(
    (__bridge CFMutableDataRef)data,
    CFSTR("public.jpeg"),
    1,
    nil
  );
  NSDictionary *properties = @{
    RCTMetadataKey(kCGImagePropertyTIFFDictionary) : @{
      RCTMetadataKey(kCGImagePropertyTIFFArtist) : @"metadata-test",
    },
  };
  if (destination != nil && image != nil) {
    CGImageDestinationAddImage(
      destination,
      image,
      (__bridge CFDictionaryRef)properties
    );
    CGImageDestinationFinalize(destination);
  }
  if (destination != nil) {
    CFRelease(destination);
  }
  if (image != nil) {
    CGImageRelease(image);
  }
  CGColorSpaceRelease(colorSpace);
  CGDataProviderRelease(provider);
  return data;
}

static void TestRejectsUnsupportedPreserveCombinations(void)
{
  __block NSUInteger readerCalls = 0;
  RCTImageCompressionJpegMetadata *metadata = [[RCTImageCompressionJpegMetadata alloc]
    initWithSourcePropertyReader:^NSDictionary *(NSData *sourceData) {
      readerCalls += 1;
      return @{};
    }
  ];
  NSArray<NSArray<NSNumber *> *> *cases = @[
    @[@NO, @YES],
    @[@YES, @NO],
    @[@NO, @NO],
  ];

  for (NSArray<NSNumber *> *testCase in cases) {
    RCTImageCompressionJpegMetadataError *error = nil;
    RCTImageCompressionJpegMetadataResult *result = [metadata
      prepareRequest:RCTMetadataRequest(
        RCTImageCompressionKitPreserveMetadataPolicy,
        testCase[0].boolValue,
        testCase[1].boolValue,
        [@"source" dataUsingEncoding:NSUTF8StringEncoding]
      )
      error:&error
    ];

    RCTMetadataAssert(result == nil, @"unsupported preserve returns no result");
    RCTMetadataAssertEqualObjects(error.code, RCTImageCompressionKitNotImplementedCode, @"unsupported preserve error code");
    RCTMetadataAssertEqualObjects(
      error.message,
      @"iOS metadata preserve is supported only for JPEG input to JPEG output. Use safe or strip metadata for other iOS format conversions.",
      @"unsupported preserve error message"
    );
  }
  RCTMetadataAssert(readerCalls == 0, @"unsupported preserve does not inspect source properties");
}

static void TestReadsSourcePropertiesOnlyForSupportedPreserve(void)
{
  NSMutableData *mutableSource = [[@"jpeg-source" dataUsingEncoding:NSUTF8StringEncoding] mutableCopy];
  NSData *expectedSource = [mutableSource copy];
  NSDictionary *expectedProperties = @{ @"Custom" : @"retained" };
  __block NSUInteger readerCalls = 0;
  __block NSData *receivedSource = nil;
  RCTImageCompressionJpegMetadata *metadata = [[RCTImageCompressionJpegMetadata alloc]
    initWithSourcePropertyReader:^NSDictionary *(NSData *sourceData) {
      readerCalls += 1;
      receivedSource = sourceData;
      return expectedProperties;
    }
  ];
  RCTImageCompressionJpegMetadataRequest *preserveRequest = RCTMetadataRequest(
    RCTImageCompressionKitPreserveMetadataPolicy,
    YES,
    YES,
    mutableSource
  );
  [mutableSource appendData:[@"-changed" dataUsingEncoding:NSUTF8StringEncoding]];
  RCTImageCompressionJpegMetadataResult *preserve = [metadata prepareRequest:preserveRequest error:nil];

  RCTMetadataAssert(preserve.preservingSourceMetadata, @"supported preserve marks result as preserving");
  RCTMetadataAssertEqualObjects(preserve.sourceProperties, expectedProperties, @"supported preserve retains reader properties");
  RCTMetadataAssertEqualObjects(receivedSource, expectedSource, @"reader receives immutable request source bytes");

  for (NSString *policy in @[RCTImageCompressionKitDefaultMetadataPolicy, RCTImageCompressionKitStripMetadataPolicy]) {
    RCTImageCompressionJpegMetadataResult *result = [metadata
      prepareRequest:RCTMetadataRequest(policy, NO, NO, expectedSource)
      error:nil
    ];
    RCTMetadataAssert(!result.preservingSourceMetadata, @"safe and strip do not preserve source metadata");
    RCTMetadataAssert(result.sourceProperties == nil, @"safe and strip expose no source properties");
  }
  RCTMetadataAssert(readerCalls == 1, @"only supported preserve reads source properties");
}

static void TestBuildsQualityOnlyPropertiesForSafeAndStrip(void)
{
  RCTImageCompressionJpegMetadata *metadata = [[RCTImageCompressionJpegMetadata alloc]
    initWithSourcePropertyReader:^NSDictionary *(NSData *sourceData) {
      return @{ @"Unexpected" : @YES };
    }
  ];

  for (NSString *policy in @[RCTImageCompressionKitDefaultMetadataPolicy, RCTImageCompressionKitStripMetadataPolicy]) {
    RCTImageCompressionJpegMetadataResult *result = [metadata
      prepareRequest:RCTMetadataRequest(policy, YES, YES, [NSData data])
      error:nil
    ];
    NSDictionary *properties = [result
      destinationPropertiesForQuality:73
      pixelWidth:800
      pixelHeight:600
    ];
    RCTMetadataAssert(properties.count == 1, @"safe and strip emit quality-only destination properties");
    RCTMetadataAssertEqualObjects(
      properties[RCTMetadataKey(kCGImageDestinationLossyCompressionQuality)],
      @0.73,
      @"quality is converted to ImageIO fraction"
    );
  }
}

static void TestNormalizesPreservedMetadataWithoutMutatingSource(void)
{
  NSMutableDictionary *sourceTiff = [@{
    RCTMetadataKey(kCGImagePropertyTIFFOrientation) : @8,
    RCTMetadataKey(kCGImagePropertyTIFFArtist) : @"artist",
  } mutableCopy];
  NSMutableDictionary *sourceExif = [@{
    RCTMetadataKey(kCGImagePropertyExifPixelXDimension) : @4000,
    RCTMetadataKey(kCGImagePropertyExifPixelYDimension) : @3000,
    @"CustomExif" : @"retained",
  } mutableCopy];
  NSDictionary *source = @{
    RCTMetadataKey(kCGImagePropertyPixelWidth) : @4000,
    RCTMetadataKey(kCGImagePropertyPixelHeight) : @3000,
    RCTMetadataKey(kCGImagePropertyOrientation) : @8,
    RCTMetadataKey(kCGImagePropertyTIFFDictionary) : sourceTiff,
    RCTMetadataKey(kCGImagePropertyExifDictionary) : sourceExif,
    @"CustomTopLevel" : @"retained",
  };
  RCTImageCompressionJpegMetadataResult *result = [[RCTImageCompressionJpegMetadataResult alloc]
    initWithPreservingSourceMetadata:YES
    sourceProperties:source
  ];
  NSDictionary *properties = [result
    destinationPropertiesForQuality:85
    pixelWidth:640
    pixelHeight:480
  ];
  NSDictionary *normalizedTiff = properties[RCTMetadataKey(kCGImagePropertyTIFFDictionary)];
  NSDictionary *normalizedExif = properties[RCTMetadataKey(kCGImagePropertyExifDictionary)];

  RCTMetadataAssertEqualObjects(properties[RCTMetadataKey(kCGImagePropertyPixelWidth)], @640, @"top-level width normalized");
  RCTMetadataAssertEqualObjects(properties[RCTMetadataKey(kCGImagePropertyPixelHeight)], @480, @"top-level height normalized");
  RCTMetadataAssertEqualObjects(properties[RCTMetadataKey(kCGImagePropertyOrientation)], @1, @"top-level orientation normalized");
  RCTMetadataAssertEqualObjects(normalizedTiff[RCTMetadataKey(kCGImagePropertyTIFFOrientation)], @1, @"TIFF orientation normalized");
  RCTMetadataAssertEqualObjects(normalizedTiff[RCTMetadataKey(kCGImagePropertyTIFFArtist)], @"artist", @"TIFF fields retained");
  RCTMetadataAssertEqualObjects(normalizedExif[RCTMetadataKey(kCGImagePropertyExifPixelXDimension)], @640, @"EXIF width normalized");
  RCTMetadataAssertEqualObjects(normalizedExif[RCTMetadataKey(kCGImagePropertyExifPixelYDimension)], @480, @"EXIF height normalized");
  RCTMetadataAssertEqualObjects(normalizedExif[@"CustomExif"], @"retained", @"EXIF custom fields retained");
  RCTMetadataAssertEqualObjects(properties[@"CustomTopLevel"], @"retained", @"top-level custom fields retained");
  RCTMetadataAssertEqualObjects(sourceTiff[RCTMetadataKey(kCGImagePropertyTIFFOrientation)], @8, @"source TIFF dictionary is unchanged");
  RCTMetadataAssertEqualObjects(sourceExif[RCTMetadataKey(kCGImagePropertyExifPixelXDimension)], @4000, @"source EXIF dictionary is unchanged");
}

static void TestHandlesMissingAndMalformedSourceProperties(void)
{
  RCTImageCompressionJpegMetadata *missingMetadata = [[RCTImageCompressionJpegMetadata alloc]
    initWithSourcePropertyReader:^NSDictionary *(NSData *sourceData) {
      return nil;
    }
  ];
  RCTImageCompressionJpegMetadataResult *missing = [missingMetadata
    prepareRequest:RCTMetadataRequest(
      RCTImageCompressionKitPreserveMetadataPolicy,
      YES,
      YES,
      [NSData data]
    )
    error:nil
  ];
  NSDictionary *missingProperties = [missing
    destinationPropertiesForQuality:40
    pixelWidth:20
    pixelHeight:10
  ];
  RCTMetadataAssert(missing.preservingSourceMetadata, @"preserve intent survives missing ImageIO properties");
  RCTMetadataAssert(missingProperties.count == 1, @"missing ImageIO properties fall back to quality only");

  NSDictionary *malformedSource = @{
    RCTMetadataKey(kCGImagePropertyTIFFDictionary) : @"not-a-dictionary",
    RCTMetadataKey(kCGImagePropertyExifDictionary) : @7,
  };
  RCTImageCompressionJpegMetadataResult *malformed = [[RCTImageCompressionJpegMetadataResult alloc]
    initWithPreservingSourceMetadata:YES
    sourceProperties:malformedSource
  ];
  NSDictionary *malformedProperties = [malformed
    destinationPropertiesForQuality:50
    pixelWidth:30
    pixelHeight:15
  ];
  RCTMetadataAssertEqualObjects(malformedProperties[RCTMetadataKey(kCGImagePropertyTIFFDictionary)], @"not-a-dictionary", @"malformed TIFF value remains unchanged");
  RCTMetadataAssertEqualObjects(malformedProperties[RCTMetadataKey(kCGImagePropertyExifDictionary)], @7, @"malformed EXIF value remains unchanged");
  RCTMetadataAssertEqualObjects(malformedProperties[RCTMetadataKey(kCGImagePropertyPixelWidth)], @30, @"top-level width still normalized");
}

static void TestUsesDefaultImageIOReaderAndImmutableModels(void)
{
  NSMutableString *policy = [@"preserve" mutableCopy];
  NSMutableData *sourceData = [RCTMetadataCreateJpegWithProperties() mutableCopy];
  NSData *expectedData = [sourceData copy];
  RCTImageCompressionJpegMetadataRequest *request = RCTMetadataRequest(
    policy,
    YES,
    YES,
    sourceData
  );
  [policy appendString:@"-changed"];
  [sourceData appendData:[@"changed" dataUsingEncoding:NSUTF8StringEncoding]];
  RCTImageCompressionJpegMetadataResult *result = [[RCTImageCompressionJpegMetadata defaultMetadata]
    prepareRequest:request
    error:nil
  ];

  RCTMetadataAssertEqualObjects(request.metadataPolicy, RCTImageCompressionKitPreserveMetadataPolicy, @"request copies metadata policy");
  RCTMetadataAssertEqualObjects(request.sourceData, expectedData, @"request copies source data");
  RCTMetadataAssert(result.sourceProperties != nil, @"default ImageIO reader extracts JPEG properties");
  RCTMetadataAssertEqualObjects(
    result.sourceProperties[RCTMetadataKey(kCGImagePropertyPixelWidth)],
    @1,
    @"default reader reports JPEG pixel width"
  );

  NSMutableString *code = [@"ERR_COPY" mutableCopy];
  NSMutableString *message = [@"copy message" mutableCopy];
  RCTImageCompressionJpegMetadataError *error = [[RCTImageCompressionJpegMetadataError alloc]
    initWithCode:code
    message:message
  ];
  [code appendString:@"-changed"];
  [message appendString:@"-changed"];
  RCTMetadataAssertEqualObjects(error.code, @"ERR_COPY", @"error copies code");
  RCTMetadataAssertEqualObjects(error.message, @"copy message", @"error copies message");

  NSMutableDictionary *mutableProperties = [@{ @"Before" : @YES } mutableCopy];
  RCTImageCompressionJpegMetadataResult *copiedResult = [[RCTImageCompressionJpegMetadataResult alloc]
    initWithPreservingSourceMetadata:YES
    sourceProperties:mutableProperties
  ];
  mutableProperties[@"After"] = @YES;
  RCTMetadataAssert(copiedResult.sourceProperties[@"After"] == nil, @"result copies source property container");
}

static void TestClearsExistingErrorOnSuccess(void)
{
  RCTImageCompressionJpegMetadata *metadata = [[RCTImageCompressionJpegMetadata alloc]
    initWithSourcePropertyReader:^NSDictionary *(NSData *sourceData) {
      return @{};
    }
  ];
  RCTImageCompressionJpegMetadataError *error = [[RCTImageCompressionJpegMetadataError alloc]
    initWithCode:@"ERR_OLD"
    message:@"old error"
  ];
  RCTImageCompressionJpegMetadataResult *result = [metadata
    prepareRequest:RCTMetadataRequest(
      RCTImageCompressionKitDefaultMetadataPolicy,
      NO,
      NO,
      [NSData data]
    )
    error:&error
  ];

  RCTMetadataAssert(result != nil, @"successful metadata preparation returns result");
  RCTMetadataAssert(error == nil, @"successful metadata preparation clears previous error");
}

int main(void)
{
  @autoreleasepool {
    TestRejectsUnsupportedPreserveCombinations();
    TestReadsSourcePropertiesOnlyForSupportedPreserve();
    TestBuildsQualityOnlyPropertiesForSafeAndStrip();
    TestNormalizesPreservedMetadataWithoutMutatingSource();
    TestHandlesMissingAndMalformedSourceProperties();
    TestUsesDefaultImageIOReaderAndImmutableModels();
    TestClearsExistingErrorOnSuccess();

    if (RCTJpegMetadataFailureCount > 0) {
      fprintf(
        stderr,
        "iOS JPEG metadata native tests failed: %lu/%lu assertions failed.\n",
        (unsigned long)RCTJpegMetadataFailureCount,
        (unsigned long)RCTJpegMetadataAssertionCount
      );
      return 1;
    }

    printf(
      "iOS JPEG metadata native tests passed: %lu assertions across 7 table-driven groups.\n",
      (unsigned long)RCTJpegMetadataAssertionCount
    );
  }
  return 0;
}
