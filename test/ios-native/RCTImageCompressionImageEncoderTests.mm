#import <Foundation/Foundation.h>

#import "RCTImageCompressionImageEncoder.h"
#import "RCTImageCompressionRequest.h"

static NSUInteger RCTImageEncoderAssertionCount = 0;
static NSUInteger RCTImageEncoderFailureCount = 0;

static void RCTEncoderAssert(BOOL condition, NSString *context)
{
  RCTImageEncoderAssertionCount += 1;
  if (!condition) {
    RCTImageEncoderFailureCount += 1;
    fprintf(stderr, "FAIL: %s\n", context.UTF8String);
  }
}

static void RCTEncoderAssertEqualObjects(id actual, id expected, NSString *context)
{
  BOOL equal = actual == expected || [actual isEqual:expected];
  RCTEncoderAssert(
    equal,
    [NSString stringWithFormat:@"%@ (actual=%@ expected=%@)", context, actual, expected]
  );
}

static NSData *RCTEncoderData(NSUInteger length)
{
  return [NSMutableData dataWithLength:length];
}

static RCTImageCompressionImageEncodeRequest *RCTEncoderRequest(
  UIImage *image,
  NSString *outputFormat,
  NSInteger quality,
  BOOL hasMaxBytes,
  NSUInteger maxBytes,
  RCTImageCompressionJpegMetadataResult *metadata
) {
  return [[RCTImageCompressionImageEncodeRequest alloc]
    initWithImage:image
    outputFormat:outputFormat
    quality:quality
    hasMaxBytes:hasMaxBytes
    maxBytes:maxBytes
    jpegMetadata:metadata
  ];
}

static RCTImageCompressionImageEncoder *RCTEncoder(
  RCTImageCompressionJpegImageEncoder jpegEncoder,
  RCTImageCompressionPngImageEncoder pngEncoder,
  RCTImageCompressionWebPImageEncoder webPEncoder,
  RCTImageCompressionImageEncodeExecutor executor
) {
  return [[RCTImageCompressionImageEncoder alloc]
    initWithJpegEncoder:jpegEncoder
    pngEncoder:pngEncoder
    webPEncoder:webPEncoder
    imageWorkExecutor:executor
  ];
}

static RCTImageCompressionImageEncodeExecutor RCTImmediateEncoderExecutor(void)
{
  return ^(RCTImageCompressionImageEncodeOperation operation) {
    operation();
  };
}

static void TestRoutesFormatMatrixInsideExecutor(void)
{
  NSArray<NSString *> *formats = @[
    RCTImageCompressionKitJpegFormat,
    RCTImageCompressionKitPngFormat,
    RCTImageCompressionKitWebPFormat,
  ];

  for (NSString *format in formats) {
    NSObject *source = [NSObject new];
    NSObject *metadata = [NSObject new];
    __block BOOL insideExecutor = NO;
    __block NSUInteger executorCalls = 0;
    __block NSUInteger jpegCalls = 0;
    __block NSUInteger pngCalls = 0;
    __block NSUInteger webPCalls = 0;
    __block NSInteger receivedQuality = -1;
    __block UIImage *receivedImage = nil;
    __block RCTImageCompressionJpegMetadataResult *receivedMetadata = nil;
    RCTImageCompressionImageEncoder *encoder = RCTEncoder(
      ^NSData *(UIImage *image, NSInteger quality, RCTImageCompressionJpegMetadataResult *jpegMetadata) {
        RCTEncoderAssert(insideExecutor, @"JPEG codec runs inside executor");
        jpegCalls += 1;
        receivedImage = image;
        receivedQuality = quality;
        receivedMetadata = jpegMetadata;
        return [@"jpeg" dataUsingEncoding:NSUTF8StringEncoding];
      },
      ^NSData *(UIImage *image) {
        RCTEncoderAssert(insideExecutor, @"PNG codec runs inside executor");
        pngCalls += 1;
        receivedImage = image;
        return [@"png" dataUsingEncoding:NSUTF8StringEncoding];
      },
      ^NSData *(UIImage *image, NSInteger quality) {
        RCTEncoderAssert(insideExecutor, @"WebP codec runs inside executor");
        webPCalls += 1;
        receivedImage = image;
        receivedQuality = quality;
        return [@"webp" dataUsingEncoding:NSUTF8StringEncoding];
      },
      ^(RCTImageCompressionImageEncodeOperation operation) {
        executorCalls += 1;
        insideExecutor = YES;
        operation();
        insideExecutor = NO;
      }
    );
    RCTImageCompressionEncodedImage *result = [encoder
      encodeRequest:RCTEncoderRequest(
        (UIImage *)source,
        format,
        73,
        NO,
        0,
        (RCTImageCompressionJpegMetadataResult *)metadata
      )
      error:nil
    ];

    RCTEncoderAssert(result != nil, @"format route returns encoded result");
    RCTEncoderAssert((id)receivedImage == source, @"codec receives source image");
    RCTEncoderAssert(executorCalls == 1, @"format route executes once");
    RCTEncoderAssert(
      jpegCalls == ([format isEqualToString:RCTImageCompressionKitJpegFormat] ? 1u : 0u),
      @"JPEG route call count"
    );
    RCTEncoderAssert(
      pngCalls == ([format isEqualToString:RCTImageCompressionKitPngFormat] ? 1u : 0u),
      @"PNG route call count"
    );
    RCTEncoderAssert(
      webPCalls == ([format isEqualToString:RCTImageCompressionKitWebPFormat] ? 1u : 0u),
      @"WebP route call count"
    );
    if (![format isEqualToString:RCTImageCompressionKitPngFormat]) {
      RCTEncoderAssert(receivedQuality == 73, @"quality route receives requested cap");
    }
    if ([format isEqualToString:RCTImageCompressionKitJpegFormat]) {
      RCTEncoderAssert((id)receivedMetadata == metadata, @"JPEG route receives metadata result");
    }
  }
}

static void TestReturnsQualityCapWhenWithinTarget(void)
{
  for (NSString *format in @[RCTImageCompressionKitJpegFormat, RCTImageCompressionKitWebPFormat]) {
    __block NSMutableArray<NSNumber *> *qualities = [NSMutableArray array];
    RCTImageCompressionJpegImageEncoder jpeg = ^NSData *(
      UIImage *image,
      NSInteger quality,
      RCTImageCompressionJpegMetadataResult *metadata
    ) {
      [qualities addObject:@(quality)];
      return RCTEncoderData(40);
    };
    RCTImageCompressionWebPImageEncoder webP = ^NSData *(UIImage *image, NSInteger quality) {
      [qualities addObject:@(quality)];
      return RCTEncoderData(40);
    };
    RCTImageCompressionImageEncoder *encoder = RCTEncoder(
      jpeg,
      ^NSData *(UIImage *image) { return RCTEncoderData(40); },
      webP,
      RCTImmediateEncoderExecutor()
    );
    RCTImageCompressionEncodedImage *result = [encoder
      encodeRequest:RCTEncoderRequest(
        (UIImage *)[NSObject new],
        format,
        80,
        YES,
        40,
        (RCTImageCompressionJpegMetadataResult *)[NSObject new]
      )
      error:nil
    ];

    RCTEncoderAssert(result.data.length == 40, @"quality cap output at target is retained");
    RCTEncoderAssertEqualObjects(qualities, @[@80], @"within-target output avoids binary search");
  }
}

static void TestFindsHighestQualityWithinTarget(void)
{
  __block NSMutableArray<NSNumber *> *qualities = [NSMutableArray array];
  __block NSObject *expectedMetadata = [NSObject new];
  RCTImageCompressionImageEncoder *encoder = RCTEncoder(
    ^NSData *(UIImage *image, NSInteger quality, RCTImageCompressionJpegMetadataResult *metadata) {
      RCTEncoderAssert((id)metadata == expectedMetadata, @"every JPEG search attempt receives metadata result");
      [qualities addObject:@(quality)];
      return RCTEncoderData((NSUInteger)quality + 1);
    },
    ^NSData *(UIImage *image) { return nil; },
    ^NSData *(UIImage *image, NSInteger quality) { return nil; },
    RCTImmediateEncoderExecutor()
  );
  RCTImageCompressionEncodedImage *result = [encoder
    encodeRequest:RCTEncoderRequest(
      (UIImage *)[NSObject new],
      RCTImageCompressionKitJpegFormat,
      80,
      YES,
      51,
      (RCTImageCompressionJpegMetadataResult *)expectedMetadata
    )
    error:nil
  ];

  RCTEncoderAssert(result.data.length == 51, @"binary search returns highest quality within target");
  RCTEncoderAssertEqualObjects(
    qualities,
    (@[@80, @39, @59, @49, @54, @51, @50]),
    @"binary search preserves quality probe order"
  );
}

static void TestReturnsSmallestOutputWhenTargetCannotBeMet(void)
{
  __block NSMutableArray<NSNumber *> *qualities = [NSMutableArray array];
  RCTImageCompressionImageEncoder *encoder = RCTEncoder(
    ^NSData *(UIImage *image, NSInteger quality, RCTImageCompressionJpegMetadataResult *metadata) {
      [qualities addObject:@(quality)];
      return RCTEncoderData((NSUInteger)quality + 100);
    },
    ^NSData *(UIImage *image) { return nil; },
    ^NSData *(UIImage *image, NSInteger quality) { return nil; },
    RCTImmediateEncoderExecutor()
  );
  RCTImageCompressionEncodedImage *result = [encoder
    encodeRequest:RCTEncoderRequest(
      (UIImage *)[NSObject new],
      RCTImageCompressionKitJpegFormat,
      80,
      YES,
      50,
      (RCTImageCompressionJpegMetadataResult *)[NSObject new]
    )
    error:nil
  ];

  RCTEncoderAssert(result.data.length == 100, @"unreachable target returns smallest encoded output");
  RCTEncoderAssertEqualObjects(
    qualities,
    (@[@80, @39, @19, @9, @4, @1, @0]),
    @"unreachable target probes down to minimum quality"
  );
}

static void TestRejectsMissingOutputsAndSkippedExecutor(void)
{
  typedef struct {
    const char *name;
    NSString *__unsafe_unretained format;
    BOOL skipExecutor;
    BOOL failDuringSearch;
  } RCTEncoderFailureCase;
  RCTEncoderFailureCase cases[] = {
    { "empty-jpeg-cap", RCTImageCompressionKitJpegFormat, NO, NO },
    { "missing-webp-search-candidate", RCTImageCompressionKitWebPFormat, NO, YES },
    { "skipped-executor", RCTImageCompressionKitPngFormat, YES, NO },
  };

  for (const RCTEncoderFailureCase &testCase : cases) {
    __block NSUInteger codecCalls = 0;
    RCTImageCompressionImageEncoder *encoder = RCTEncoder(
      ^NSData *(UIImage *image, NSInteger quality, RCTImageCompressionJpegMetadataResult *metadata) {
        codecCalls += 1;
        return [NSData data];
      },
      ^NSData *(UIImage *image) {
        codecCalls += 1;
        return RCTEncoderData(3);
      },
      ^NSData *(UIImage *image, NSInteger quality) {
        codecCalls += 1;
        return testCase.failDuringSearch && quality == 39
          ? nil
          : RCTEncoderData((NSUInteger)quality + 1);
      },
      ^(RCTImageCompressionImageEncodeOperation operation) {
        if (!testCase.skipExecutor) {
          operation();
        }
      }
    );
    RCTImageCompressionImageEncodeError *error = nil;
    RCTImageCompressionEncodedImage *result = [encoder
      encodeRequest:RCTEncoderRequest(
        (UIImage *)[NSObject new],
        testCase.format,
        80,
        testCase.failDuringSearch,
        51,
        (RCTImageCompressionJpegMetadataResult *)[NSObject new]
      )
      error:&error
    ];
    NSString *name = [NSString stringWithUTF8String:testCase.name];

    RCTEncoderAssert(result == nil, [name stringByAppendingString:@" returns no result"]);
    RCTEncoderAssertEqualObjects(error.code, RCTImageCompressionKitImageEncodeFailedCode, [name stringByAppendingString:@" error code"]);
    RCTEncoderAssertEqualObjects(
      error.message,
      [NSString stringWithFormat:@"iOS MVP could not encode %@ output.", testCase.format.uppercaseString],
      [name stringByAppendingString:@" error message"]
    );
    if (testCase.skipExecutor) {
      RCTEncoderAssert(codecCalls == 0, @"skipped executor does not invoke codec");
    }
  }
}

static void TestCopiesImmutableRequestResultAndErrorModels(void)
{
  NSObject *source = [NSObject new];
  NSObject *metadata = [NSObject new];
  NSMutableString *format = [@"jpeg" mutableCopy];
  RCTImageCompressionImageEncodeRequest *request = RCTEncoderRequest(
    (UIImage *)source,
    format,
    65,
    YES,
    1234,
    (RCTImageCompressionJpegMetadataResult *)metadata
  );
  [format appendString:@"-changed"];

  RCTEncoderAssert((id)request.image == source, @"request retains source image");
  RCTEncoderAssert((id)request.jpegMetadata == metadata, @"request retains metadata result");
  RCTEncoderAssertEqualObjects(request.outputFormat, @"jpeg", @"request copies output format");
  RCTEncoderAssert(request.quality == 65, @"request retains quality");
  RCTEncoderAssert(request.hasMaxBytes && request.maxBytes == 1234, @"request retains target size fields");

  NSMutableData *mutableData = [RCTEncoderData(4) mutableCopy];
  RCTImageCompressionEncodedImage *result = [[RCTImageCompressionEncodedImage alloc]
    initWithData:mutableData
  ];
  [mutableData increaseLengthBy:3];
  RCTEncoderAssert(result.data.length == 4, @"encoded result copies output bytes");

  NSMutableString *code = [@"ERR_COPY" mutableCopy];
  NSMutableString *message = [@"copy message" mutableCopy];
  RCTImageCompressionImageEncodeError *error = [[RCTImageCompressionImageEncodeError alloc]
    initWithCode:code
    message:message
  ];
  [code appendString:@"-changed"];
  [message appendString:@"-changed"];
  RCTEncoderAssertEqualObjects(error.code, @"ERR_COPY", @"encode error copies code");
  RCTEncoderAssertEqualObjects(error.message, @"copy message", @"encode error copies message");
}

static void TestClearsExistingErrorOnSuccess(void)
{
  RCTImageCompressionImageEncoder *encoder = RCTEncoder(
    ^NSData *(UIImage *image, NSInteger quality, RCTImageCompressionJpegMetadataResult *metadata) {
      return RCTEncoderData(2);
    },
    ^NSData *(UIImage *image) { return RCTEncoderData(2); },
    ^NSData *(UIImage *image, NSInteger quality) { return RCTEncoderData(2); },
    RCTImmediateEncoderExecutor()
  );
  RCTImageCompressionImageEncodeError *error = [[RCTImageCompressionImageEncodeError alloc]
    initWithCode:@"ERR_OLD"
    message:@"old error"
  ];
  RCTImageCompressionEncodedImage *result = [encoder
    encodeRequest:RCTEncoderRequest(
      (UIImage *)[NSObject new],
      RCTImageCompressionKitPngFormat,
      80,
      NO,
      0,
      (RCTImageCompressionJpegMetadataResult *)[NSObject new]
    )
    error:&error
  ];

  RCTEncoderAssert(result != nil, @"successful encode returns result");
  RCTEncoderAssert(error == nil, @"successful encode clears previous error");
}

int main(void)
{
  @autoreleasepool {
    TestRoutesFormatMatrixInsideExecutor();
    TestReturnsQualityCapWhenWithinTarget();
    TestFindsHighestQualityWithinTarget();
    TestReturnsSmallestOutputWhenTargetCannotBeMet();
    TestRejectsMissingOutputsAndSkippedExecutor();
    TestCopiesImmutableRequestResultAndErrorModels();
    TestClearsExistingErrorOnSuccess();

    if (RCTImageEncoderFailureCount > 0) {
      fprintf(
        stderr,
        "iOS image encoder native tests failed: %lu/%lu assertions failed.\n",
        (unsigned long)RCTImageEncoderFailureCount,
        (unsigned long)RCTImageEncoderAssertionCount
      );
      return 1;
    }

    printf(
      "iOS image encoder native tests passed: %lu assertions across 7 table-driven groups.\n",
      (unsigned long)RCTImageEncoderAssertionCount
    );
  }
  return 0;
}
