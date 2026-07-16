#import <Foundation/Foundation.h>

#import "RCTImageCompressionInput.h"

static NSUInteger RCTImageCompressionInputAssertionCount = 0;
static NSUInteger RCTImageCompressionInputFailureCount = 0;

static void RCTInputAssert(BOOL condition, NSString *context)
{
  RCTImageCompressionInputAssertionCount += 1;
  if (!condition) {
    RCTImageCompressionInputFailureCount += 1;
    fprintf(stderr, "FAIL: %s\n", context.UTF8String);
  }
}

static void RCTInputAssertEqualObjects(id actual, id expected, NSString *context)
{
  BOOL equal = actual == expected || [actual isEqual:expected];
  RCTInputAssert(
    equal,
    [NSString stringWithFormat:@"%@ (actual=%@ expected=%@)", context, actual, expected]
  );
}

static NSData *RCTOrdinaryData(void)
{
  return [@"ordinary-image-data" dataUsingEncoding:NSUTF8StringEncoding];
}

static NSData *RCTAVIFSignatureData(void)
{
  const unsigned char bytes[] = {
    0x00, 0x00, 0x00, 0x18,
    'f', 't', 'y', 'p',
    'a', 'v', 'i', 'f',
    0x00, 0x00, 0x00, 0x00,
    'a', 'v', 'i', 'f',
    'm', 'i', 'f', '1'
  };
  return [NSData dataWithBytes:bytes length:sizeof(bytes)];
}

static RCTImageCompressionSource *RCTSource(NSData *data)
{
  return [[RCTImageCompressionSource alloc]
    initWithURL:[NSURL URLWithString:@"file:///tmp/input.img"]
    data:data
  ];
}

static RCTImageCompressionSourceResolver *RCTResolver(
  RCTImageCompressionSourceDataLoader dataLoader,
  RCTImageCompressionSecurityScopeStarter starter,
  RCTImageCompressionSecurityScopeStopper stopper
) {
  return [[RCTImageCompressionSourceResolver alloc]
    initWithDataLoader:dataLoader
    securityScopeStarter:starter
    securityScopeStopper:stopper
  ];
}

static void TestResolvesFileAndContentSourcesWithImmutableBytes(void)
{
  NSArray<NSDictionary *> *cases = @[
    @{ @"name" : @"file", @"uri" : @"file:///tmp/input.jpg", @"scope" : @YES },
    @{ @"name" : @"content", @"uri" : @"content://images/input.jpg", @"scope" : @NO },
    @{ @"name" : @"case-insensitive-file", @"uri" : @"FILE:///tmp/input.jpg", @"scope" : @NO }
  ];

  for (NSDictionary *testCase in cases) {
    NSMutableData *loadedData = [[@"source-bytes" dataUsingEncoding:NSUTF8StringEncoding] mutableCopy];
    __block NSUInteger loadCount = 0;
    __block NSUInteger startCount = 0;
    __block NSUInteger stopCount = 0;
    __block NSURL *loadedURL = nil;
    RCTImageCompressionSourceResolver *resolver = RCTResolver(
      ^NSData *(NSURL *URL, NSError **error) {
        loadCount += 1;
        loadedURL = URL;
        return loadedData;
      },
      ^BOOL(NSURL *URL) {
        startCount += 1;
        return [testCase[@"scope"] boolValue];
      },
      ^(NSURL *URL) {
        stopCount += 1;
      }
    );
    RCTImageCompressionInputError *error = nil;
    RCTImageCompressionSource *source = [resolver
      resolveSourceURI:testCase[@"uri"]
      error:&error
    ];
    NSUInteger originalLength = loadedData.length;
    [loadedData appendData:[@"-mutated" dataUsingEncoding:NSUTF8StringEncoding]];
    NSString *name = testCase[@"name"];

    RCTInputAssert(source != nil && error == nil, [NSString stringWithFormat:@"%@ resolves", name]);
    RCTInputAssert(loadCount == 1 && startCount == 1, [NSString stringWithFormat:@"%@ hooks called once", name]);
    RCTInputAssert(stopCount == ([testCase[@"scope"] boolValue] ? 1u : 0u), [NSString stringWithFormat:@"%@ scope stop count", name]);
    RCTInputAssertEqualObjects(source.URL, loadedURL, [NSString stringWithFormat:@"%@ URL", name]);
    RCTInputAssert(source.originalByteSize == originalLength, [NSString stringWithFormat:@"%@ original size", name]);
    RCTInputAssert(source.data.length == originalLength, [NSString stringWithFormat:@"%@ data is copied", name]);
  }
}

static void TestRejectsUnsupportedSourceSchemesWithoutLoading(void)
{
  NSArray<NSString *> *URIs = @[
    @"https://example.com/input.jpg",
    @"data:image/png;base64,AAAA",
    @"/tmp/input.jpg",
    @"not-a-uri"
  ];

  for (NSString *URI in URIs) {
    __block NSUInteger hookCalls = 0;
    RCTImageCompressionSourceResolver *resolver = RCTResolver(
      ^NSData *(NSURL *URL, NSError **error) {
        hookCalls += 1;
        return RCTOrdinaryData();
      },
      ^BOOL(NSURL *URL) {
        hookCalls += 1;
        return YES;
      },
      ^(NSURL *URL) {
        hookCalls += 1;
      }
    );
    RCTImageCompressionInputError *error = nil;
    RCTImageCompressionSource *source = [resolver resolveSourceURI:URI error:&error];

    RCTInputAssert(source == nil, [NSString stringWithFormat:@"%@ rejects", URI]);
    RCTInputAssert(hookCalls == 0, [NSString stringWithFormat:@"%@ skips hooks", URI]);
    RCTInputAssertEqualObjects(error.code, RCTImageCompressionKitUnsupportedSourceCode, [NSString stringWithFormat:@"%@ code", URI]);
    RCTInputAssertEqualObjects(error.message, @"iOS MVP supports file:// and content:// image URIs only.", [NSString stringWithFormat:@"%@ message", URI]);
    RCTInputAssert(error.underlyingError == nil, [NSString stringWithFormat:@"%@ has no underlying error", URI]);
  }
}

static void TestClosesSecurityScopeForUnreadableAndEmptySources(void)
{
  NSError *readError = [NSError
    errorWithDomain:@"RCTImageCompressionInputTests"
    code:7
    userInfo:nil
  ];
  NSArray<NSDictionary *> *cases = @[
    @{ @"name" : @"unreadable", @"value" : [NSNull null], @"error" : readError },
    @{ @"name" : @"empty", @"value" : [NSData data], @"error" : [NSNull null] }
  ];

  for (NSDictionary *testCase in cases) {
    __block NSUInteger stopCount = 0;
    RCTImageCompressionSourceResolver *resolver = RCTResolver(
      ^NSData *(NSURL *URL, NSError **error) {
        id loaderError = testCase[@"error"];
        if (loaderError != [NSNull null]) {
          *error = loaderError;
        }
        id value = testCase[@"value"];
        return value == [NSNull null] ? nil : value;
      },
      ^BOOL(NSURL *URL) {
        return YES;
      },
      ^(NSURL *URL) {
        stopCount += 1;
      }
    );
    RCTImageCompressionInputError *error = nil;
    RCTImageCompressionSource *source = [resolver
      resolveSourceURI:@"content://images/missing.jpg"
      error:&error
    ];
    NSString *name = testCase[@"name"];

    RCTInputAssert(source == nil, [NSString stringWithFormat:@"%@ rejects", name]);
    RCTInputAssert(stopCount == 1, [NSString stringWithFormat:@"%@ closes scope once", name]);
    RCTInputAssertEqualObjects(error.code, RCTImageCompressionKitFileAccessCode, [NSString stringWithFormat:@"%@ code", name]);
    RCTInputAssertEqualObjects(error.message, @"iOS MVP could not read the source image URI.", [NSString stringWithFormat:@"%@ message", name]);
    id expectedUnderlyingError = testCase[@"error"];
    if (expectedUnderlyingError == [NSNull null]) {
      expectedUnderlyingError = nil;
    }
    RCTInputAssert(error.underlyingError == expectedUnderlyingError, [NSString stringWithFormat:@"%@ underlying error", name]);
  }
}

static void TestClosesSecurityScopeWhenLoaderThrows(void)
{
  __block NSUInteger stopCount = 0;
  RCTImageCompressionSourceResolver *resolver = RCTResolver(
    ^NSData *(NSURL *URL, NSError **error) {
      [NSException raise:@"LoaderFailure" format:@"expected test exception"];
      return nil;
    },
    ^BOOL(NSURL *URL) {
      return YES;
    },
    ^(NSURL *URL) {
      stopCount += 1;
    }
  );
  BOOL threw = NO;
  @try {
    [resolver resolveSourceURI:@"file:///tmp/input.jpg" error:nil];
  } @catch (NSException *exception) {
    threw = [exception.name isEqualToString:@"LoaderFailure"];
  }

  RCTInputAssert(threw, @"loader exception propagates");
  RCTInputAssert(stopCount == 1, @"loader exception closes scope exactly once");
}

static void TestDefaultResolverReadsFileData(void)
{
  NSData *expectedData = [@"default-resolver-data" dataUsingEncoding:NSUTF8StringEncoding];
  NSURL *fileURL = [[NSURL fileURLWithPath:NSTemporaryDirectory()]
    URLByAppendingPathComponent:[NSString stringWithFormat:@"rnick-%@.bin", NSUUID.UUID.UUIDString]
  ];
  NSError *writeError = nil;
  BOOL wrote = [expectedData writeToURL:fileURL options:NSDataWritingAtomic error:&writeError];
  RCTImageCompressionInputError *error = nil;
  RCTImageCompressionSource *source = [[RCTImageCompressionSourceResolver defaultResolver]
    resolveSourceURI:fileURL.absoluteString
    error:&error
  ];
  [[NSFileManager defaultManager] removeItemAtURL:fileURL error:nil];

  RCTInputAssert(wrote && writeError == nil, @"default resolver fixture writes");
  RCTInputAssert(source != nil && error == nil, @"default resolver reads file URI");
  RCTInputAssertEqualObjects(source.data, expectedData, @"default resolver bytes");
  RCTInputAssert(source.originalByteSize == expectedData.length, @"default resolver byte size");
}

static void TestClassifiesSupportedTypeIdentifierMatrix(void)
{
  NSArray<NSDictionary *> *cases = @[
    @{ @"type" : @"public.jpeg", @"format" : @(RCTImageCompressionInputFormatJpeg), @"first" : @NO },
    @{ @"type" : @"public.jpg", @"format" : @(RCTImageCompressionInputFormatJpeg), @"first" : @NO },
    @{ @"type" : @"image/jpeg", @"format" : @(RCTImageCompressionInputFormatJpeg), @"first" : @NO },
    @{ @"type" : @"public.png", @"format" : @(RCTImageCompressionInputFormatPng), @"first" : @NO },
    @{ @"type" : @"com.compuserve.gif", @"format" : @(RCTImageCompressionInputFormatGif), @"first" : @YES },
    @{ @"type" : @"public.gif", @"format" : @(RCTImageCompressionInputFormatGif), @"first" : @YES },
    @{ @"type" : @"org.webmproject.webp", @"format" : @(RCTImageCompressionInputFormatWebP), @"first" : @YES },
    @{ @"type" : @"public.webp", @"format" : @(RCTImageCompressionInputFormatWebP), @"first" : @YES },
    @{ @"type" : @"public.heic", @"format" : @(RCTImageCompressionInputFormatHeic), @"first" : @YES },
    @{ @"type" : @"public.heics", @"format" : @(RCTImageCompressionInputFormatHeic), @"first" : @YES },
    @{ @"type" : @"org.iso.heic", @"format" : @(RCTImageCompressionInputFormatHeic), @"first" : @YES },
    @{ @"type" : @"org.iso.heics", @"format" : @(RCTImageCompressionInputFormatHeic), @"first" : @YES },
    @{ @"type" : @"public.heif", @"format" : @(RCTImageCompressionInputFormatHeif), @"first" : @YES },
    @{ @"type" : @"public.heifs", @"format" : @(RCTImageCompressionInputFormatHeif), @"first" : @YES },
    @{ @"type" : @"org.iso.heif", @"format" : @(RCTImageCompressionInputFormatHeif), @"first" : @YES },
    @{ @"type" : @"org.iso.heifs", @"format" : @(RCTImageCompressionInputFormatHeif), @"first" : @YES },
    @{ @"type" : @"public.avif", @"format" : @(RCTImageCompressionInputFormatAvif), @"first" : @YES },
    @{ @"type" : @"public.avifs", @"format" : @(RCTImageCompressionInputFormatAvif), @"first" : @YES },
    @{ @"type" : @"org.aomedia.avif", @"format" : @(RCTImageCompressionInputFormatAvif), @"first" : @YES },
    @{ @"type" : @"org.aomedia.avifs", @"format" : @(RCTImageCompressionInputFormatAvif), @"first" : @YES }
  ];

  for (NSDictionary *testCase in cases) {
    NSMutableString *mutableType = [testCase[@"type"] mutableCopy];
    __block NSUInteger availabilityChecks = 0;
    RCTImageCompressionInputInspector *inspector = [[RCTImageCompressionInputInspector alloc]
      initWithTypeIdentifierLoader:^NSString *(NSData *data) {
        return mutableType;
      }
    ];
    RCTImageCompressionInputError *error = nil;
    RCTImageCompressionInputInspection *input = [inspector
      inspectSource:RCTSource(RCTOrdinaryData())
      avifInputAvailability:^BOOL{
        availabilityChecks += 1;
        return YES;
      }
      error:&error
    ];
    NSString *expectedType = [testCase[@"type"] copy];
    [mutableType appendString:@".mutated"];

    RCTInputAssert(input != nil && error == nil, [NSString stringWithFormat:@"%@ classifies", expectedType]);
    RCTInputAssert(input.format == [testCase[@"format"] integerValue], [NSString stringWithFormat:@"%@ format", expectedType]);
    RCTInputAssert(input.shouldDecodeFirstFrame == [testCase[@"first"] boolValue], [NSString stringWithFormat:@"%@ first-frame policy", expectedType]);
    RCTInputAssert(input.jpeg == (input.format == RCTImageCompressionInputFormatJpeg), [NSString stringWithFormat:@"%@ JPEG flag", expectedType]);
    RCTInputAssertEqualObjects(input.imageType, expectedType, [NSString stringWithFormat:@"%@ type is copied", expectedType]);
    NSUInteger expectedAvailabilityChecks = input.format == RCTImageCompressionInputFormatAvif ? 1 : 0;
    RCTInputAssert(availabilityChecks == expectedAvailabilityChecks, [NSString stringWithFormat:@"%@ AVIF callback count", expectedType]);
    RCTInputAssert(!input.sourceLooksLikeAVIF, [NSString stringWithFormat:@"%@ ordinary signature", expectedType]);
  }
}

static void TestRejectsUnavailableAndSignatureOnlyAVIF(void)
{
  NSString *AVIFMessage = @"iOS AVIF input requires runtime ImageIO AVIF source support.";
  __block NSUInteger typeLoads = 0;
  __block NSUInteger availabilityChecks = 0;
  RCTImageCompressionInputInspector *inspector = [[RCTImageCompressionInputInspector alloc]
    initWithTypeIdentifierLoader:^NSString *(NSData *data) {
      typeLoads += 1;
      return @"public.avif";
    }
  ];
  RCTImageCompressionInputError *error = nil;
  RCTImageCompressionInputInspection *input = [inspector
    inspectSource:RCTSource(RCTAVIFSignatureData())
    avifInputAvailability:^BOOL{
      availabilityChecks += 1;
      return NO;
    }
    error:&error
  ];
  RCTInputAssert(input == nil && typeLoads == 0, @"signature AVIF rejects before type inspection");
  RCTInputAssert(availabilityChecks == 1, @"signature AVIF checks runtime once");
  RCTInputAssertEqualObjects(error.code, RCTImageCompressionKitUnsupportedFormatCode, @"signature AVIF code");
  RCTInputAssertEqualObjects(error.message, AVIFMessage, @"signature AVIF message");

  typeLoads = 0;
  availabilityChecks = 0;
  input = [inspector
    inspectSource:RCTSource(RCTOrdinaryData())
    avifInputAvailability:^BOOL{
      availabilityChecks += 1;
      return NO;
    }
    error:&error
  ];
  RCTInputAssert(input == nil && typeLoads == 1, @"typed AVIF inspects before runtime rejection");
  RCTInputAssert(availabilityChecks == 1, @"typed AVIF checks runtime once");
  RCTInputAssertEqualObjects(error.message, AVIFMessage, @"typed AVIF message");

  inspector = [[RCTImageCompressionInputInspector alloc]
    initWithTypeIdentifierLoader:^NSString *(NSData *data) {
      return nil;
    }
  ];
  input = [inspector
    inspectSource:RCTSource(RCTAVIFSignatureData())
    avifInputAvailability:^BOOL{
      return YES;
    }
    error:&error
  ];
  RCTInputAssert(input == nil, @"available signature-only AVIF still requires ImageIO type");
  RCTInputAssertEqualObjects(error.code, RCTImageCompressionKitDecodeFailedCode, @"signature-only inspect code");
  RCTInputAssertEqualObjects(error.message, @"iOS MVP could not inspect the source image.", @"signature-only inspect message");
}

static void TestRejectsUnknownAndUninspectableFormats(void)
{
  NSArray<NSDictionary *> *cases = @[
    @{
      @"name" : @"uninspectable",
      @"type" : [NSNull null],
      @"code" : RCTImageCompressionKitDecodeFailedCode,
      @"message" : @"iOS MVP could not inspect the source image."
    },
    @{
      @"name" : @"unsupported-tiff",
      @"type" : @"public.tiff",
      @"code" : RCTImageCompressionKitUnsupportedFormatCode,
      @"message" : @"iOS MVP supports JPEG, PNG, GIF, WebP, HEIC, HEIF, and runtime-available AVIF input only. GIF, WebP, HEIC, HEIF, and AVIF input are decoded as static images through ImageIO."
    }
  ];

  for (NSDictionary *testCase in cases) {
    RCTImageCompressionInputInspector *inspector = [[RCTImageCompressionInputInspector alloc]
      initWithTypeIdentifierLoader:^NSString *(NSData *data) {
        id type = testCase[@"type"];
        return type == [NSNull null] ? nil : type;
      }
    ];
    RCTImageCompressionInputError *error = nil;
    RCTImageCompressionInputInspection *input = [inspector
      inspectSource:RCTSource(RCTOrdinaryData())
      avifInputAvailability:^BOOL{
        return YES;
      }
      error:&error
    ];
    NSString *name = testCase[@"name"];
    RCTInputAssert(input == nil, [NSString stringWithFormat:@"%@ rejects", name]);
    RCTInputAssertEqualObjects(error.code, testCase[@"code"], [NSString stringWithFormat:@"%@ code", name]);
    RCTInputAssertEqualObjects(error.message, testCase[@"message"], [NSString stringWithFormat:@"%@ message", name]);
  }
}

static void TestPreservesSignatureClassificationOrder(void)
{
  NSArray<NSDictionary *> *cases = @[
    @{ @"type" : @"public.png", @"accepted" : @YES, @"code" : [NSNull null] },
    @{ @"type" : @"public.tiff", @"accepted" : @NO, @"code" : RCTImageCompressionKitUnsupportedFormatCode }
  ];

  for (NSDictionary *testCase in cases) {
    RCTImageCompressionInputInspector *inspector = [[RCTImageCompressionInputInspector alloc]
      initWithTypeIdentifierLoader:^NSString *(NSData *data) {
        return testCase[@"type"];
      }
    ];
    RCTImageCompressionInputError *error = nil;
    RCTImageCompressionInputInspection *input = [inspector
      inspectSource:RCTSource(RCTAVIFSignatureData())
      avifInputAvailability:^BOOL{
        return YES;
      }
      error:&error
    ];
    BOOL accepted = [testCase[@"accepted"] boolValue];
    RCTInputAssert((input != nil) == accepted, [NSString stringWithFormat:@"%@ signature precedence", testCase[@"type"]]);
    if (accepted) {
      RCTInputAssert(input.format == RCTImageCompressionInputFormatPng, @"supported ImageIO type remains authoritative");
      RCTInputAssert(input.sourceLooksLikeAVIF, @"accepted input retains AVIF signature observation");
    } else {
      RCTInputAssertEqualObjects(error.code, testCase[@"code"], @"signature unsupported code");
      RCTInputAssertEqualObjects(error.message, @"iOS AVIF input requires runtime ImageIO AVIF source support.", @"signature unsupported message");
    }
  }
}

static void TestDefaultImageIOLoaderInspectsPNG(void)
{
  NSString *base64PNG = @"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2Q1sAAAAASUVORK5CYII=";
  NSData *PNGData = [[NSData alloc] initWithBase64EncodedString:base64PNG options:0];
  RCTImageCompressionInputError *error = nil;
  RCTImageCompressionInputInspection *input = [[RCTImageCompressionInputInspector defaultInspector]
    inspectSource:RCTSource(PNGData)
    avifInputAvailability:^BOOL{
      return NO;
    }
    error:&error
  ];

  RCTInputAssert(input != nil && error == nil, @"default ImageIO loader inspects PNG");
  RCTInputAssertEqualObjects(input.imageType, @"public.png", @"default ImageIO PNG type");
  RCTInputAssert(input.format == RCTImageCompressionInputFormatPng, @"default ImageIO PNG format");
  RCTInputAssert(!input.shouldDecodeFirstFrame, @"PNG uses ordinary decode path");
}

static void TestInputLoaderComposesResolverAndInspector(void)
{
  __block NSUInteger loadCount = 0;
  RCTImageCompressionSourceResolver *resolver = RCTResolver(
    ^NSData *(NSURL *URL, NSError **error) {
      loadCount += 1;
      return RCTOrdinaryData();
    },
    ^BOOL(NSURL *URL) {
      return NO;
    },
    ^(NSURL *URL) {}
  );
  RCTImageCompressionInputInspector *inspector = [[RCTImageCompressionInputInspector alloc]
    initWithTypeIdentifierLoader:^NSString *(NSData *data) {
      return @"public.jpeg";
    }
  ];
  RCTImageCompressionInputLoader *loader = [[RCTImageCompressionInputLoader alloc]
    initWithSourceResolver:resolver
    inputInspector:inspector
  ];
  RCTImageCompressionInputError *error = nil;
  RCTImageCompressionInputInspection *input = [loader
    loadSourceURI:@"content://images/input.jpg"
    avifInputAvailability:^BOOL{
      return NO;
    }
    error:&error
  ];

  RCTInputAssert(input != nil && error == nil, @"input loader returns inspection");
  RCTInputAssert(loadCount == 1, @"input loader resolves once");
  RCTInputAssert(input.jpeg, @"input loader returns inspector classification");
  RCTInputAssert(input.source.originalByteSize == RCTOrdinaryData().length, @"input loader retains source size");
}

int main(void)
{
  @autoreleasepool {
    TestResolvesFileAndContentSourcesWithImmutableBytes();
    TestRejectsUnsupportedSourceSchemesWithoutLoading();
    TestClosesSecurityScopeForUnreadableAndEmptySources();
    TestClosesSecurityScopeWhenLoaderThrows();
    TestDefaultResolverReadsFileData();
    TestClassifiesSupportedTypeIdentifierMatrix();
    TestRejectsUnavailableAndSignatureOnlyAVIF();
    TestRejectsUnknownAndUninspectableFormats();
    TestPreservesSignatureClassificationOrder();
    TestDefaultImageIOLoaderInspectsPNG();
    TestInputLoaderComposesResolverAndInspector();

    if (RCTImageCompressionInputFailureCount > 0) {
      fprintf(
        stderr,
        "iOS input native tests failed: %lu/%lu assertions failed.\n",
        (unsigned long)RCTImageCompressionInputFailureCount,
        (unsigned long)RCTImageCompressionInputAssertionCount
      );
      return 1;
    }

    printf(
      "iOS input native tests passed: %lu assertions across 11 table-driven groups.\n",
      (unsigned long)RCTImageCompressionInputAssertionCount
    );
  }
  return 0;
}
