#import <Foundation/Foundation.h>

#import "RCTImageCompressionImageDecoder.h"
#import "RCTImageCompressionInput.h"

static NSUInteger RCTImageDecoderAssertionCount = 0;
static NSUInteger RCTImageDecoderFailureCount = 0;

static void RCTDecoderAssert(BOOL condition, NSString *context)
{
  RCTImageDecoderAssertionCount += 1;
  if (!condition) {
    RCTImageDecoderFailureCount += 1;
    fprintf(stderr, "FAIL: %s\n", context.UTF8String);
  }
}

static void RCTDecoderAssertEqualObjects(id actual, id expected, NSString *context)
{
  BOOL equal = actual == expected || [actual isEqual:expected];
  RCTDecoderAssert(
    equal,
    [NSString stringWithFormat:@"%@ (actual=%@ expected=%@)", context, actual, expected]
  );
}

static NSData *RCTDecoderSourceData(void)
{
  return [@"decoder-source-data" dataUsingEncoding:NSUTF8StringEncoding];
}

static RCTImageCompressionInputInspection *RCTDecoderInput(RCTImageCompressionInputFormat format)
{
  NSArray<NSString *> *types = @[
    @"public.jpeg",
    @"public.png",
    @"com.compuserve.gif",
    @"org.webmproject.webp",
    @"public.heic",
    @"public.heif",
    @"public.avif"
  ];
  RCTImageCompressionSource *source = [[RCTImageCompressionSource alloc]
    initWithURL:[NSURL URLWithString:@"file:///tmp/decoder-input.img"]
    data:RCTDecoderSourceData()
  ];
  return [[RCTImageCompressionInputInspection alloc]
    initWithSource:source
    imageType:types[format]
    format:format
    sourceLooksLikeAVIF:format == RCTImageCompressionInputFormatAvif
  ];
}

static RCTImageCompressionImageDecoder *RCTDecoder(
  RCTImageCompressionOrdinaryImageDecoder ordinaryDecoder,
  RCTImageCompressionFirstFrameImageDecoder firstFrameDecoder,
  RCTImageCompressionDecodedImageValidator validator,
  RCTImageCompressionImageDecodeExecutor executor
) {
  return [[RCTImageCompressionImageDecoder alloc]
    initWithOrdinaryImageDecoder:ordinaryDecoder
    firstFrameImageDecoder:firstFrameDecoder
    decodedImageValidator:validator
    imageWorkExecutor:executor
  ];
}

static void TestRoutesStaticAndFirstFrameFormats(void)
{
  NSArray<NSDictionary *> *cases = @[
    @{ @"name" : @"jpeg", @"format" : @(RCTImageCompressionInputFormatJpeg), @"first" : @NO },
    @{ @"name" : @"png", @"format" : @(RCTImageCompressionInputFormatPng), @"first" : @NO },
    @{ @"name" : @"gif", @"format" : @(RCTImageCompressionInputFormatGif), @"first" : @YES },
    @{ @"name" : @"webp", @"format" : @(RCTImageCompressionInputFormatWebP), @"first" : @YES },
    @{ @"name" : @"heic", @"format" : @(RCTImageCompressionInputFormatHeic), @"first" : @YES },
    @{ @"name" : @"heif", @"format" : @(RCTImageCompressionInputFormatHeif), @"first" : @YES },
    @{ @"name" : @"avif", @"format" : @(RCTImageCompressionInputFormatAvif), @"first" : @YES }
  ];

  for (NSDictionary *testCase in cases) {
    NSObject *ordinaryImage = [NSObject new];
    NSObject *firstFrameImage = [NSObject new];
    __block NSUInteger ordinaryCalls = 0;
    __block NSUInteger firstFrameCalls = 0;
    __block NSUInteger validatorCalls = 0;
    __block NSUInteger executorCalls = 0;
    __block NSData *decodedData = nil;
    RCTImageCompressionImageDecoder *decoder = RCTDecoder(
      ^UIImage *(NSData *data) {
        ordinaryCalls += 1;
        decodedData = data;
        return (UIImage *)ordinaryImage;
      },
      ^UIImage *(NSData *data) {
        firstFrameCalls += 1;
        decodedData = data;
        return (UIImage *)firstFrameImage;
      },
      ^BOOL(UIImage *image) {
        validatorCalls += 1;
        return YES;
      },
      ^(RCTImageCompressionImageDecodeOperation operation) {
        executorCalls += 1;
        operation();
      }
    );
    RCTImageCompressionInputInspection *input = RCTDecoderInput(
      (RCTImageCompressionInputFormat)[testCase[@"format"] integerValue]
    );
    RCTImageCompressionImageDecodeError *error = nil;
    RCTImageCompressionDecodedImage *result = [decoder decodeInput:input error:&error];
    BOOL expectedFirstFrame = [testCase[@"first"] boolValue];
    NSString *name = testCase[@"name"];
    id expectedImage = expectedFirstFrame ? firstFrameImage : ordinaryImage;

    RCTDecoderAssert(result != nil && error == nil, [NSString stringWithFormat:@"%@ decodes", name]);
    RCTDecoderAssert((id)result.image == expectedImage, [NSString stringWithFormat:@"%@ image route", name]);
    RCTDecoderAssert(result.decodedFirstFrame == expectedFirstFrame, [NSString stringWithFormat:@"%@ route model", name]);
    RCTDecoderAssert(ordinaryCalls == (expectedFirstFrame ? 0u : 1u), [NSString stringWithFormat:@"%@ ordinary count", name]);
    RCTDecoderAssert(firstFrameCalls == (expectedFirstFrame ? 1u : 0u), [NSString stringWithFormat:@"%@ first-frame count", name]);
    RCTDecoderAssert(validatorCalls == 1, [NSString stringWithFormat:@"%@ validator count", name]);
    RCTDecoderAssert(executorCalls == 1, [NSString stringWithFormat:@"%@ executor count", name]);
    RCTDecoderAssertEqualObjects(decodedData, input.source.data, [NSString stringWithFormat:@"%@ source bytes", name]);
  }
}

static void TestRejectsMissingAndInvalidDecodedImages(void)
{
  NSArray<NSDictionary *> *cases = @[
    @{ @"name" : @"ordinary-nil", @"format" : @(RCTImageCompressionInputFormatJpeg), @"returns" : @NO, @"valid" : @YES, @"validator" : @NO },
    @{ @"name" : @"first-frame-nil", @"format" : @(RCTImageCompressionInputFormatGif), @"returns" : @NO, @"valid" : @YES, @"validator" : @NO },
    @{ @"name" : @"ordinary-invalid", @"format" : @(RCTImageCompressionInputFormatPng), @"returns" : @YES, @"valid" : @NO, @"validator" : @YES },
    @{ @"name" : @"first-frame-invalid", @"format" : @(RCTImageCompressionInputFormatAvif), @"returns" : @YES, @"valid" : @NO, @"validator" : @YES }
  ];

  for (NSDictionary *testCase in cases) {
    NSObject *image = [NSObject new];
    __block NSUInteger validatorCalls = 0;
    BOOL returnsImage = [testCase[@"returns"] boolValue];
    RCTImageCompressionImageDecoder *decoder = RCTDecoder(
      ^UIImage *(NSData *data) {
        return returnsImage ? (UIImage *)image : nil;
      },
      ^UIImage *(NSData *data) {
        return returnsImage ? (UIImage *)image : nil;
      },
      ^BOOL(UIImage *decodedImage) {
        validatorCalls += 1;
        return [testCase[@"valid"] boolValue];
      },
      ^(RCTImageCompressionImageDecodeOperation operation) {
        operation();
      }
    );
    RCTImageCompressionImageDecodeError *error = nil;
    RCTImageCompressionDecodedImage *result = [decoder
      decodeInput:RCTDecoderInput((RCTImageCompressionInputFormat)[testCase[@"format"] integerValue])
      error:&error
    ];
    NSString *name = testCase[@"name"];

    RCTDecoderAssert(result == nil, [NSString stringWithFormat:@"%@ rejects", name]);
    RCTDecoderAssertEqualObjects(error.code, RCTImageCompressionKitDecodeFailedCode, [NSString stringWithFormat:@"%@ code", name]);
    RCTDecoderAssertEqualObjects(error.message, @"iOS MVP could not decode the source image.", [NSString stringWithFormat:@"%@ message", name]);
    RCTDecoderAssert(error.underlyingError == nil, [NSString stringWithFormat:@"%@ underlying error", name]);
    NSUInteger expectedValidatorCalls = [testCase[@"validator"] boolValue] ? 1u : 0u;
    RCTDecoderAssert(validatorCalls == expectedValidatorCalls, [NSString stringWithFormat:@"%@ validator count", name]);
  }
}

static void TestRejectsWhenExecutorDoesNotRunOperation(void)
{
  __block NSUInteger decodeCalls = 0;
  __block NSUInteger executorCalls = 0;
  RCTImageCompressionImageDecoder *decoder = RCTDecoder(
    ^UIImage *(NSData *data) {
      decodeCalls += 1;
      return (UIImage *)[NSObject new];
    },
    ^UIImage *(NSData *data) {
      decodeCalls += 1;
      return (UIImage *)[NSObject new];
    },
    ^BOOL(UIImage *image) {
      return YES;
    },
    ^(RCTImageCompressionImageDecodeOperation operation) {
      executorCalls += 1;
    }
  );
  RCTImageCompressionImageDecodeError *error = nil;
  RCTImageCompressionDecodedImage *result = [decoder
    decodeInput:RCTDecoderInput(RCTImageCompressionInputFormatJpeg)
    error:&error
  ];

  RCTDecoderAssert(result == nil, @"skipped operation rejects");
  RCTDecoderAssert(executorCalls == 1, @"executor called once");
  RCTDecoderAssert(decodeCalls == 0, @"decode hook skipped");
  RCTDecoderAssertEqualObjects(error.code, RCTImageCompressionKitDecodeFailedCode, @"skipped operation code");
}

static void TestRunsDecodeAndValidationInsideExecutor(void)
{
  NSObject *image = [NSObject new];
  __block BOOL insideExecutor = NO;
  __block BOOL decodeInsideExecutor = NO;
  __block BOOL validationInsideExecutor = NO;
  RCTImageCompressionImageDecoder *decoder = RCTDecoder(
    ^UIImage *(NSData *data) {
      decodeInsideExecutor = insideExecutor;
      return (UIImage *)image;
    },
    ^UIImage *(NSData *data) {
      decodeInsideExecutor = insideExecutor;
      return (UIImage *)image;
    },
    ^BOOL(UIImage *decodedImage) {
      validationInsideExecutor = insideExecutor;
      return YES;
    },
    ^(RCTImageCompressionImageDecodeOperation operation) {
      insideExecutor = YES;
      operation();
      insideExecutor = NO;
    }
  );
  RCTImageCompressionImageDecodeError *error = nil;
  RCTImageCompressionDecodedImage *result = [decoder
    decodeInput:RCTDecoderInput(RCTImageCompressionInputFormatWebP)
    error:&error
  ];

  RCTDecoderAssert(result != nil && error == nil, @"executor result succeeds");
  RCTDecoderAssert(decodeInsideExecutor, @"decode runs inside executor");
  RCTDecoderAssert(validationInsideExecutor, @"validation runs inside executor");
  RCTDecoderAssert(!insideExecutor, @"executor completes synchronously");
}

static void TestRetainsDecodedImageAndCopiesErrors(void)
{
  NSObject *image = [NSObject new];
  __weak NSObject *weakImage = image;
  RCTImageCompressionImageDecoder *decoder = RCTDecoder(
    ^UIImage *(NSData *data) {
      return (UIImage *)image;
    },
    ^UIImage *(NSData *data) {
      return (UIImage *)image;
    },
    ^BOOL(UIImage *decodedImage) {
      return YES;
    },
    ^(RCTImageCompressionImageDecodeOperation operation) {
      operation();
    }
  );
  RCTImageCompressionDecodedImage *result = [decoder
    decodeInput:RCTDecoderInput(RCTImageCompressionInputFormatJpeg)
    error:nil
  ];
  decoder = nil;
  image = nil;

  NSMutableString *code = [@"ERR_MUTABLE" mutableCopy];
  NSMutableString *message = [@"mutable message" mutableCopy];
  NSError *underlyingError = [NSError errorWithDomain:@"decoder" code:1 userInfo:nil];
  RCTImageCompressionImageDecodeError *error = [[RCTImageCompressionImageDecodeError alloc]
    initWithCode:code
    message:message
    underlyingError:underlyingError
  ];
  [code appendString:@"-changed"];
  [message appendString:@" changed"];

  RCTDecoderAssert((id)result.image == weakImage && weakImage != nil, @"result retains decoded image");
  RCTDecoderAssertEqualObjects(error.code, @"ERR_MUTABLE", @"error code is copied");
  RCTDecoderAssertEqualObjects(error.message, @"mutable message", @"error message is copied");
  RCTDecoderAssert(error.underlyingError == underlyingError, @"error retains underlying error");
}

static void TestClearsExistingErrorOnSuccess(void)
{
  NSObject *image = [NSObject new];
  RCTImageCompressionImageDecoder *decoder = RCTDecoder(
    ^UIImage *(NSData *data) {
      return (UIImage *)image;
    },
    ^UIImage *(NSData *data) {
      return (UIImage *)image;
    },
    ^BOOL(UIImage *decodedImage) {
      return YES;
    },
    ^(RCTImageCompressionImageDecodeOperation operation) {
      operation();
    }
  );
  RCTImageCompressionImageDecodeError *error = [[RCTImageCompressionImageDecodeError alloc]
    initWithCode:@"ERR_OLD"
    message:@"old error"
    underlyingError:nil
  ];
  RCTImageCompressionDecodedImage *result = [decoder
    decodeInput:RCTDecoderInput(RCTImageCompressionInputFormatHeic)
    error:&error
  ];

  RCTDecoderAssert(result != nil, @"successful decode returns result");
  RCTDecoderAssert(error == nil, @"successful decode clears previous error");
  RCTDecoderAssert(result.decodedFirstFrame, @"HEIC success retains route");
}

int main(void)
{
  @autoreleasepool {
    TestRoutesStaticAndFirstFrameFormats();
    TestRejectsMissingAndInvalidDecodedImages();
    TestRejectsWhenExecutorDoesNotRunOperation();
    TestRunsDecodeAndValidationInsideExecutor();
    TestRetainsDecodedImageAndCopiesErrors();
    TestClearsExistingErrorOnSuccess();

    if (RCTImageDecoderFailureCount > 0) {
      fprintf(
        stderr,
        "iOS image decoder native tests failed: %lu/%lu assertions failed.\n",
        (unsigned long)RCTImageDecoderFailureCount,
        (unsigned long)RCTImageDecoderAssertionCount
      );
      return 1;
    }

    printf(
      "iOS image decoder native tests passed: %lu assertions across 6 table-driven groups.\n",
      (unsigned long)RCTImageDecoderAssertionCount
    );
  }
  return 0;
}
