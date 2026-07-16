#import <Foundation/Foundation.h>

#import "RCTImageCompressionRequest.h"

static NSUInteger RCTImageCompressionRequestAssertionCount = 0;
static NSUInteger RCTImageCompressionRequestFailureCount = 0;

static void RCTAssert(BOOL condition, NSString *context)
{
  RCTImageCompressionRequestAssertionCount += 1;
  if (!condition) {
    RCTImageCompressionRequestFailureCount += 1;
    fprintf(stderr, "FAIL: %s\n", context.UTF8String);
  }
}

static void RCTAssertEqualObjects(id actual, id expected, NSString *context)
{
  BOOL equal = actual == expected || [actual isEqual:expected];
  RCTAssert(
    equal,
    [NSString stringWithFormat:@"%@ (actual=%@ expected=%@)", context, actual, expected]
  );
}

static NSDictionary *RCTOptions(NSString *format, NSDictionary *outputOverrides)
{
  NSMutableDictionary *output = [@{ @"format" : format } mutableCopy];
  [output addEntriesFromDictionary:outputOverrides];
  return @{
    @"source" : @{ @"uri" : @"file:///tmp/input.jpg" },
    @"output" : output
  };
}

static NSDictionary *RCTOptionsWithTopLevelOverrides(NSDictionary *overrides)
{
  NSMutableDictionary *options = [RCTOptions(@"jpeg", @{}) mutableCopy];
  [options addEntriesFromDictionary:overrides];
  return options;
}

static RCTImageCompressionRequest *RCTParse(
  id options,
  BOOL webPOutputAvailable,
  RCTImageCompressionRequestError **error
) {
  return [RCTImageCompressionRequestParser
    parseOptions:options
    webPOutputAvailability:^BOOL{
      return webPOutputAvailable;
    }
    error:error
  ];
}

static void RCTAssertErrorCase(
  NSDictionary *testCase,
  BOOL webPOutputAvailable
) {
  RCTImageCompressionRequestError *error = nil;
  id options = testCase[@"options"];
  if (options == [NSNull null]) {
    options = nil;
  }
  RCTImageCompressionRequest *request = RCTParse(options, webPOutputAvailable, &error);
  NSString *name = testCase[@"name"];

  RCTAssert(request == nil, [NSString stringWithFormat:@"%@ rejects", name]);
  RCTAssertEqualObjects(error.code, testCase[@"code"], [NSString stringWithFormat:@"%@ code", name]);
  RCTAssertEqualObjects(error.message, testCase[@"message"], [NSString stringWithFormat:@"%@ message", name]);
}

static void TestParsesDefaultsIntoImmutableRequest(void)
{
  NSMutableString *sourceURI = [@"file:///tmp/input.jpg" mutableCopy];
  NSDictionary *options = @{
    @"source" : @{ @"uri" : sourceURI },
    @"output" : @{ @"format" : @"jpeg" }
  };
  RCTImageCompressionRequestError *error = nil;
  RCTImageCompressionRequest *request = RCTParse(options, YES, &error);
  [sourceURI appendString:@"?mutated=1"];

  RCTAssert(request != nil, @"default request parses");
  RCTAssert(error == nil, @"default request has no error");
  RCTAssertEqualObjects(request.sourceURI, @"file:///tmp/input.jpg", @"source URI is copied");
  RCTAssertEqualObjects(request.outputFormat, @"jpeg", @"default output format");
  RCTAssert(request.quality == 80, @"default quality is 80");
  RCTAssert(!request.hasMaxBytes && request.maxBytes == 0, @"maxBytes is absent by default");
  RCTAssertEqualObjects(request.metadataPolicy, @"safe", @"metadata defaults to safe");
  RCTAssert(!request.resizeOptions.enabled, @"resize is disabled by default");
  RCTAssert(request.resizeOptions.mode == RCTImageCompressionKitResizeModeContain, @"default resize mode is contain");
  RCTAssert(request.outputIsJpeg && !request.outputIsPng && !request.outputIsWebP, @"JPEG output flags are stable");

  NSDictionary *nullDefaults = RCTOptionsWithTopLevelOverrides(@{
    @"metadata" : [NSNull null],
    @"resize" : [NSNull null]
  });
  NSMutableDictionary *nullOutput = [nullDefaults[@"output"] mutableCopy];
  nullOutput[@"quality"] = [NSNull null];
  nullOutput[@"maxBytes"] = [NSNull null];
  NSMutableDictionary *nullOptions = [nullDefaults mutableCopy];
  nullOptions[@"output"] = nullOutput;
  request = RCTParse(nullOptions, YES, &error);
  RCTAssert(request != nil && error == nil, @"explicit null optional values keep defaults");
  RCTAssert(request.quality == 80 && !request.hasMaxBytes, @"null output defaults are stable");
  RCTAssertEqualObjects(request.metadataPolicy, @"safe", @"null metadata defaults to safe");
  RCTAssert(!request.resizeOptions.enabled, @"null resize remains disabled");
}

static void TestParsesMetadataAndResizeMatrix(void)
{
  NSArray<NSDictionary *> *cases = @[
    @{
      @"name" : @"width-contain-preserve",
      @"options" : RCTOptionsWithTopLevelOverrides(@{
        @"metadata" : @"preserve",
        @"resize" : @{ @"maxWidth" : @640, @"mode" : @"contain" },
        @"output" : @{ @"format" : @"jpeg", @"quality" : @0 }
      }),
      @"quality" : @0,
      @"metadata" : @"preserve",
      @"hasWidth" : @YES,
      @"hasHeight" : @NO,
      @"width" : @640,
      @"height" : @0,
      @"mode" : @(RCTImageCompressionKitResizeModeContain),
      @"format" : @"jpeg"
    },
    @{
      @"name" : @"height-cover-strip",
      @"options" : RCTOptionsWithTopLevelOverrides(@{
        @"metadata" : @"strip",
        @"resize" : @{ @"maxHeight" : @480, @"mode" : @"cover" },
        @"output" : @{ @"format" : @"png", @"quality" : @100 }
      }),
      @"quality" : @100,
      @"metadata" : @"strip",
      @"hasWidth" : @NO,
      @"hasHeight" : @YES,
      @"width" : @0,
      @"height" : @480,
      @"mode" : @(RCTImageCompressionKitResizeModeCover),
      @"format" : @"png"
    },
    @{
      @"name" : @"both-stretch-safe-webp",
      @"options" : RCTOptionsWithTopLevelOverrides(@{
        @"metadata" : @"safe",
        @"resize" : @{ @"maxWidth" : @320, @"maxHeight" : @240, @"mode" : @"stretch" },
        @"output" : @{ @"format" : @"webp", @"quality" : @64, @"maxBytes" : @4096 }
      }),
      @"quality" : @64,
      @"metadata" : @"safe",
      @"hasWidth" : @YES,
      @"hasHeight" : @YES,
      @"width" : @320,
      @"height" : @240,
      @"mode" : @(RCTImageCompressionKitResizeModeStretch),
      @"format" : @"webp"
    }
  ];

  for (NSDictionary *testCase in cases) {
    __block NSUInteger availabilityChecks = 0;
    RCTImageCompressionRequestError *error = nil;
    RCTImageCompressionRequest *request = [RCTImageCompressionRequestParser
      parseOptions:testCase[@"options"]
      webPOutputAvailability:^BOOL{
        availabilityChecks += 1;
        return YES;
      }
      error:&error
    ];
    NSString *name = testCase[@"name"];
    RCTAssert(request != nil && error == nil, [NSString stringWithFormat:@"%@ parses", name]);
    RCTAssertEqualObjects(request.outputFormat, testCase[@"format"], [NSString stringWithFormat:@"%@ format", name]);
    RCTAssert(request.quality == [testCase[@"quality"] integerValue], [NSString stringWithFormat:@"%@ quality", name]);
    RCTAssertEqualObjects(request.metadataPolicy, testCase[@"metadata"], [NSString stringWithFormat:@"%@ metadata", name]);
    RCTAssert(request.resizeOptions.enabled, [NSString stringWithFormat:@"%@ resize enabled", name]);
    RCTAssert(request.resizeOptions.hasMaxWidth == [testCase[@"hasWidth"] boolValue], [NSString stringWithFormat:@"%@ width presence", name]);
    RCTAssert(request.resizeOptions.hasMaxHeight == [testCase[@"hasHeight"] boolValue], [NSString stringWithFormat:@"%@ height presence", name]);
    RCTAssert(request.resizeOptions.maxWidth == [testCase[@"width"] integerValue], [NSString stringWithFormat:@"%@ width", name]);
    RCTAssert(request.resizeOptions.maxHeight == [testCase[@"height"] integerValue], [NSString stringWithFormat:@"%@ height", name]);
    RCTAssert(request.resizeOptions.mode == [testCase[@"mode"] integerValue], [NSString stringWithFormat:@"%@ mode", name]);
    NSUInteger expectedAvailabilityChecks = [request.outputFormat isEqualToString:@"webp"] ? 1 : 0;
    RCTAssert(availabilityChecks == expectedAvailabilityChecks, [NSString stringWithFormat:@"%@ runtime availability call count", name]);
  }
}

static void TestRejectsMissingAndMalformedRequiredOptions(void)
{
  NSString *objectMessage = @"Compression options must be an object.";
  NSString *shapeMessage = @"Compression options must include source and output objects.";
  NSString *uriMessage = @"Compression source.uri must be a non-empty string.";
  NSString *formatMessage = @"Compression output.format must be one of: jpeg, png, webp, heic, heif, avif.";
  NSArray<NSDictionary *> *cases = @[
    @{ @"name" : @"nil-options", @"options" : [NSNull null], @"message" : objectMessage },
    @{ @"name" : @"string-options", @"options" : @"invalid", @"message" : objectMessage },
    @{ @"name" : @"missing-source-output", @"options" : @{}, @"message" : shapeMessage },
    @{ @"name" : @"missing-source", @"options" : @{ @"output" : @{} }, @"message" : shapeMessage },
    @{ @"name" : @"malformed-source", @"options" : @{ @"source" : @"invalid", @"output" : @{} }, @"message" : shapeMessage },
    @{ @"name" : @"malformed-output", @"options" : @{ @"source" : @{}, @"output" : @42 }, @"message" : shapeMessage },
    @{ @"name" : @"missing-uri", @"options" : @{ @"source" : @{}, @"output" : @{ @"format" : @"jpeg" } }, @"message" : uriMessage },
    @{ @"name" : @"numeric-uri", @"options" : @{ @"source" : @{ @"uri" : @42 }, @"output" : @{ @"format" : @"jpeg" } }, @"message" : uriMessage },
    @{ @"name" : @"empty-uri", @"options" : @{ @"source" : @{ @"uri" : @"" }, @"output" : @{ @"format" : @"jpeg" } }, @"message" : uriMessage },
    @{ @"name" : @"whitespace-uri", @"options" : @{ @"source" : @{ @"uri" : @" \n\t" }, @"output" : @{ @"format" : @"jpeg" } }, @"message" : uriMessage },
    @{ @"name" : @"missing-format", @"options" : @{ @"source" : @{ @"uri" : @"file:///tmp/input.jpg" }, @"output" : @{} }, @"message" : formatMessage },
    @{ @"name" : @"numeric-format", @"options" : @{ @"source" : @{ @"uri" : @"file:///tmp/input.jpg" }, @"output" : @{ @"format" : @42 } }, @"message" : formatMessage },
    @{ @"name" : @"gif-output", @"options" : RCTOptions(@"gif", @{}), @"message" : formatMessage },
    @{ @"name" : @"unknown-output", @"options" : RCTOptions(@"tiff", @{}), @"message" : formatMessage }
  ];

  for (NSDictionary *testCase in cases) {
    NSMutableDictionary *expected = [testCase mutableCopy];
    expected[@"code"] = RCTImageCompressionKitInvalidOptionsCode;
    RCTAssertErrorCase(expected, YES);
  }
}

static void TestRejectsInvalidQualityAndMaxBytes(void)
{
  NSString *qualityMessage = @"Compression output.quality must be an integer from 0 to 100.";
  NSString *maxBytesMessage = @"Compression output.maxBytes must be a positive integer.";
  NSArray<NSDictionary *> *cases = @[
    @{ @"name" : @"quality-string", @"options" : RCTOptions(@"jpeg", @{ @"quality" : @"80" }), @"message" : qualityMessage },
    @{ @"name" : @"quality-negative", @"options" : RCTOptions(@"jpeg", @{ @"quality" : @-1 }), @"message" : qualityMessage },
    @{ @"name" : @"quality-over-max", @"options" : RCTOptions(@"jpeg", @{ @"quality" : @101 }), @"message" : qualityMessage },
    @{ @"name" : @"quality-fractional", @"options" : RCTOptions(@"jpeg", @{ @"quality" : @80.5 }), @"message" : qualityMessage },
    @{ @"name" : @"maxBytes-string", @"options" : RCTOptions(@"jpeg", @{ @"maxBytes" : @"1024" }), @"message" : maxBytesMessage },
    @{ @"name" : @"maxBytes-zero", @"options" : RCTOptions(@"jpeg", @{ @"maxBytes" : @0 }), @"message" : maxBytesMessage },
    @{ @"name" : @"maxBytes-negative", @"options" : RCTOptions(@"jpeg", @{ @"maxBytes" : @-1 }), @"message" : maxBytesMessage },
    @{ @"name" : @"maxBytes-fractional", @"options" : RCTOptions(@"jpeg", @{ @"maxBytes" : @1024.5 }), @"message" : maxBytesMessage },
    @{ @"name" : @"maxBytes-infinite", @"options" : RCTOptions(@"jpeg", @{ @"maxBytes" : [NSNumber numberWithDouble:INFINITY] }), @"message" : maxBytesMessage }
  ];

  for (NSDictionary *testCase in cases) {
    NSMutableDictionary *expected = [testCase mutableCopy];
    expected[@"code"] = RCTImageCompressionKitInvalidOptionsCode;
    RCTAssertErrorCase(expected, YES);
  }

  for (NSNumber *quality in @[ @0, @100 ]) {
    RCTImageCompressionRequestError *error = nil;
    RCTImageCompressionRequest *request = RCTParse(RCTOptions(@"jpeg", @{ @"quality" : quality, @"maxBytes" : @1 }), YES, &error);
    RCTAssert(request != nil && error == nil, [NSString stringWithFormat:@"quality boundary %@ parses", quality]);
    RCTAssert(request.quality == quality.integerValue && request.maxBytes == 1, [NSString stringWithFormat:@"quality boundary %@ values", quality]);
  }
}

static void TestRejectsUnsupportedOutputAndStaticCombinations(void)
{
  NSString *genericOutputMessage = @"iOS MVP supports JPEG, PNG, and runtime-available WebP output only. HEIC and HEIF output are not implemented. Call getImageCompressionCapabilities() before selecting a platform output format.";
  NSString *avifOutputMessage = @"iOS MVP supports AVIF input when ImageIO source decoding is available, but AVIF output is not implemented. Supported output formats are JPEG, PNG, and runtime-available WebP. Future AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation; metadata='preserve', output.maxBytes, and animated AVIF preservation remain unsupported for AVIF output. output.format: 'avif' rejects with ERR_NOT_IMPLEMENTED.";
  NSString *webPMessage = @"iOS MVP requires ImageIO WebP destination support for WebP output on this runtime.";
  NSString *targetSizeMessage = @"iOS MVP supports output.maxBytes for JPEG and runtime-available WebP output only.";
  NSArray<NSDictionary *> *cases = @[
    @{ @"name" : @"heic-output", @"options" : RCTOptions(@"heic", @{}), @"message" : genericOutputMessage, @"webp" : @YES },
    @{ @"name" : @"heif-output-invalid-quality-precedence", @"options" : RCTOptions(@"heif", @{ @"quality" : @-1 }), @"message" : genericOutputMessage, @"webp" : @YES },
    @{ @"name" : @"avif-output", @"options" : RCTOptions(@"avif", @{}), @"message" : avifOutputMessage, @"webp" : @YES },
    @{ @"name" : @"webp-unavailable", @"options" : RCTOptions(@"webp", @{}), @"message" : webPMessage, @"webp" : @NO },
    @{ @"name" : @"webp-unavailable-invalid-quality-precedence", @"options" : RCTOptions(@"webp", @{ @"quality" : @-1 }), @"message" : webPMessage, @"webp" : @NO },
    @{ @"name" : @"png-target-size", @"options" : RCTOptions(@"png", @{ @"maxBytes" : @1024 }), @"message" : targetSizeMessage, @"webp" : @YES }
  ];

  for (NSDictionary *testCase in cases) {
    NSMutableDictionary *expected = [testCase mutableCopy];
    expected[@"code"] = RCTImageCompressionKitNotImplementedCode;
    RCTAssertErrorCase(expected, [testCase[@"webp"] boolValue]);
  }
}

static void TestRejectsInvalidMetadataAndResizeMatrix(void)
{
  NSString *metadataMessage = @"Compression metadata must be one of: preserve, safe, strip.";
  NSString *resizeObjectMessage = @"Compression resize must be an object.";
  NSString *resizeShapeMessage = @"Compression resize must include maxWidth, maxHeight, or both.";
  NSString *widthMessage = @"Compression resize.maxWidth must be a positive integer.";
  NSString *heightMessage = @"Compression resize.maxHeight must be a positive integer.";
  NSString *modeMessage = @"Compression resize.mode must be one of: contain, cover, stretch.";
  NSArray<NSDictionary *> *cases = @[
    @{ @"name" : @"metadata-empty", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"metadata" : @"" }), @"message" : metadataMessage },
    @{ @"name" : @"metadata-unknown", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"metadata" : @"all" }), @"message" : metadataMessage },
    @{ @"name" : @"metadata-number", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"metadata" : @42 }), @"message" : metadataMessage },
    @{ @"name" : @"resize-string", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"resize" : @"invalid" }), @"message" : resizeObjectMessage },
    @{ @"name" : @"resize-empty", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"resize" : @{} }), @"message" : resizeShapeMessage },
    @{ @"name" : @"resize-null-width", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"resize" : @{ @"maxWidth" : [NSNull null] } }), @"message" : resizeShapeMessage },
    @{ @"name" : @"width-string", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"resize" : @{ @"maxWidth" : @"640" } }), @"message" : widthMessage },
    @{ @"name" : @"width-zero", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"resize" : @{ @"maxWidth" : @0 } }), @"message" : widthMessage },
    @{ @"name" : @"width-negative", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"resize" : @{ @"maxWidth" : @-1 } }), @"message" : widthMessage },
    @{ @"name" : @"width-fractional", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"resize" : @{ @"maxWidth" : @640.5 } }), @"message" : widthMessage },
    @{ @"name" : @"height-string", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"resize" : @{ @"maxHeight" : @"480" } }), @"message" : heightMessage },
    @{ @"name" : @"height-zero", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"resize" : @{ @"maxHeight" : @0 } }), @"message" : heightMessage },
    @{ @"name" : @"mode-unknown", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"resize" : @{ @"maxWidth" : @640, @"mode" : @"fit" } }), @"message" : modeMessage },
    @{ @"name" : @"mode-number", @"options" : RCTOptionsWithTopLevelOverrides(@{ @"resize" : @{ @"maxWidth" : @640, @"mode" : @42 } }), @"message" : modeMessage }
  ];

  for (NSDictionary *testCase in cases) {
    NSMutableDictionary *expected = [testCase mutableCopy];
    expected[@"code"] = RCTImageCompressionKitInvalidOptionsCode;
    RCTAssertErrorCase(expected, YES);
  }
}

int main(void)
{
  @autoreleasepool {
    TestParsesDefaultsIntoImmutableRequest();
    TestParsesMetadataAndResizeMatrix();
    TestRejectsMissingAndMalformedRequiredOptions();
    TestRejectsInvalidQualityAndMaxBytes();
    TestRejectsUnsupportedOutputAndStaticCombinations();
    TestRejectsInvalidMetadataAndResizeMatrix();

    if (RCTImageCompressionRequestFailureCount > 0) {
      fprintf(
        stderr,
        "iOS request parser native tests failed: %lu/%lu assertions failed.\n",
        (unsigned long)RCTImageCompressionRequestFailureCount,
        (unsigned long)RCTImageCompressionRequestAssertionCount
      );
      return 1;
    }

    printf(
      "iOS request parser native tests passed: %lu assertions across 6 table-driven groups.\n",
      (unsigned long)RCTImageCompressionRequestAssertionCount
    );
  }
  return 0;
}
