#import <Foundation/Foundation.h>

#import "RCTImageCompressionOutput.h"
#import "RCTImageCompressionRequest.h"

static NSUInteger RCTOutputAssertionCount = 0;
static NSUInteger RCTOutputFailureCount = 0;

static void RCTOutputAssert(BOOL condition, NSString *context)
{
  RCTOutputAssertionCount += 1;
  if (!condition) {
    RCTOutputFailureCount += 1;
    fprintf(stderr, "FAIL: %s\n", context.UTF8String);
  }
}

static void RCTOutputAssertEqualObjects(id actual, id expected, NSString *context)
{
  BOOL equal = actual == expected || [actual isEqual:expected];
  RCTOutputAssert(
    equal,
    [NSString stringWithFormat:@"%@ (actual=%@ expected=%@)", context, actual, expected]
  );
}

static NSData *RCTOutputData(NSUInteger length)
{
  return [NSMutableData dataWithLength:length];
}

static RCTImageCompressionOutputRequest *RCTOutputRequest(
  NSString *format,
  NSUInteger outputByteSize,
  CGSize outputSize,
  NSUInteger originalByteSize
) {
  return [[RCTImageCompressionOutputRequest alloc]
    initWithData:RCTOutputData(outputByteSize)
    outputFormat:format
    outputSize:outputSize
    originalByteSize:originalByteSize
  ];
}

static RCTImageCompressionOutput *RCTOutput(
  RCTImageCompressionOutputCacheDirectoryProvider cacheDirectoryProvider,
  RCTImageCompressionOutputPathExists pathExists,
  RCTImageCompressionOutputDirectoryCreator directoryCreator,
  RCTImageCompressionOutputClock clock,
  RCTImageCompressionOutputUUIDProvider uuidProvider,
  RCTImageCompressionOutputFileWriter fileWriter
) {
  return [[RCTImageCompressionOutput alloc]
    initWithCacheDirectoryProvider:cacheDirectoryProvider
    pathExists:pathExists
    directoryCreator:directoryCreator
    clock:clock
    uuidProvider:uuidProvider
    fileWriter:fileWriter
  ];
}

static void TestBuildsFormatPathsAndPersistsBytes(void)
{
  typedef struct {
    NSString *__unsafe_unretained format;
    NSString *__unsafe_unretained extension;
  } RCTOutputFormatCase;
  RCTOutputFormatCase cases[] = {
    { RCTImageCompressionKitJpegFormat, @"jpg" },
    { RCTImageCompressionKitPngFormat, @"png" },
    { RCTImageCompressionKitWebPFormat, @"webp" },
  };

  for (const RCTOutputFormatCase &testCase : cases) {
    __block NSString *createdDirectory = nil;
    __block NSString *writtenPath = nil;
    __block NSData *writtenData = nil;
    RCTImageCompressionOutput *output = RCTOutput(
      ^NSString *{ return @"/cache root"; },
      ^BOOL(NSString *path) { return NO; },
      ^BOOL(NSString *path, NSError **error) {
        createdDirectory = path;
        return YES;
      },
      ^NSTimeInterval{ return 123.456; },
      ^NSString *{ return @"fixed-uuid"; },
      ^BOOL(NSData *data, NSString *path, NSError **error) {
        writtenData = data;
        writtenPath = path;
        return YES;
      }
    );
    RCTImageCompressionOutputResult *result = [output
      persistRequest:RCTOutputRequest(testCase.format, 9, CGSizeMake(20, 10), 30)
      error:nil
    ];
    NSString *expectedDirectory = @"/cache root/ImageCompressionKit";
    NSString *expectedPath = [expectedDirectory stringByAppendingPathComponent:
      [NSString stringWithFormat:@"compressed-123456-fixed-uuid.%@", testCase.extension]
    ];

    RCTOutputAssert(result != nil, @"format path persists output");
    RCTOutputAssertEqualObjects(createdDirectory, expectedDirectory, @"missing output directory is created");
    RCTOutputAssertEqualObjects(writtenPath, expectedPath, @"clock UUID and extension form stable path");
    RCTOutputAssert(writtenData.length == 9, @"writer receives immutable output bytes");
    RCTOutputAssertEqualObjects(
      result.uri,
      [[NSURL fileURLWithPath:expectedPath] absoluteString],
      @"result projects persisted file URI"
    );
  }
}

static void TestReusesExistingDirectoryAndFallsBackToTemporaryPath(void)
{
  __block NSUInteger createCalls = 0;
  __block NSString *existingWritePath = nil;
  RCTImageCompressionOutput *existingOutput = RCTOutput(
    ^NSString *{ return @"/existing-cache"; },
    ^BOOL(NSString *path) { return YES; },
    ^BOOL(NSString *path, NSError **error) {
      createCalls += 1;
      return YES;
    },
    ^NSTimeInterval{ return 1.0; },
    ^NSString *{ return @"existing"; },
    ^BOOL(NSData *data, NSString *path, NSError **error) {
      existingWritePath = path;
      return YES;
    }
  );
  RCTImageCompressionOutputResult *existingResult = [existingOutput
    persistRequest:RCTOutputRequest(RCTImageCompressionKitJpegFormat, 1, CGSizeMake(1, 1), 1)
    error:nil
  ];

  RCTOutputAssert(existingResult != nil, @"existing directory output succeeds");
  RCTOutputAssert(createCalls == 0, @"existing directory is not recreated");
  RCTOutputAssertEqualObjects(
    existingWritePath,
    @"/existing-cache/ImageCompressionKit/compressed-1000-existing.jpg",
    @"existing cache path is retained"
  );

  __block NSString *fallbackDirectory = nil;
  RCTImageCompressionOutput *fallbackOutput = RCTOutput(
    ^NSString *{ return nil; },
    ^BOOL(NSString *path) { return NO; },
    ^BOOL(NSString *path, NSError **error) {
      fallbackDirectory = path;
      return YES;
    },
    ^NSTimeInterval{ return 2.0; },
    ^NSString *{ return @"fallback"; },
    ^BOOL(NSData *data, NSString *path, NSError **error) { return YES; }
  );
  RCTImageCompressionOutputResult *fallbackResult = [fallbackOutput
    persistRequest:RCTOutputRequest(RCTImageCompressionKitPngFormat, 1, CGSizeMake(1, 1), 1)
    error:nil
  ];

  RCTOutputAssert(fallbackResult != nil, @"missing cache provider path falls back");
  RCTOutputAssertEqualObjects(
    fallbackDirectory,
    [NSTemporaryDirectory() stringByAppendingPathComponent:@"ImageCompressionKit"],
    @"temporary directory fallback is stable"
  );
}

static void TestProjectsResultMetricsAndZeroSourceRatio(void)
{
  typedef struct {
    NSUInteger outputByteSize;
    NSUInteger originalByteSize;
    double expectedRatio;
  } RCTOutputMetricCase;
  RCTOutputMetricCase cases[] = {
    { 25, 100, 0.25 },
    { 8, 0, 1.0 },
  };

  for (const RCTOutputMetricCase &testCase : cases) {
    RCTImageCompressionOutput *output = RCTOutput(
      ^NSString *{ return @"/cache"; },
      ^BOOL(NSString *path) { return YES; },
      ^BOOL(NSString *path, NSError **error) { return YES; },
      ^NSTimeInterval{ return 4.0; },
      ^NSString *{ return @"metrics"; },
      ^BOOL(NSData *data, NSString *path, NSError **error) { return YES; }
    );
    RCTImageCompressionOutputResult *result = [output
      persistRequest:RCTOutputRequest(
        RCTImageCompressionKitWebPFormat,
        testCase.outputByteSize,
        CGSizeMake(12.9, 7.8),
        testCase.originalByteSize
      )
      error:nil
    ];
    NSDictionary *dictionary = result.dictionaryRepresentation;

    RCTOutputAssert(result.width == 12 && result.height == 7, @"result dimensions retain integer projection");
    RCTOutputAssert(result.byteSize == (double)testCase.outputByteSize, @"result byte size is projected");
    RCTOutputAssert(result.originalByteSize == (double)testCase.originalByteSize, @"original byte size is projected");
    RCTOutputAssert(result.compressionRatio == testCase.expectedRatio, @"compression ratio contract is retained");
    RCTOutputAssertEqualObjects(dictionary[@"format"], RCTImageCompressionKitWebPFormat, @"dictionary format projection");
    RCTOutputAssertEqualObjects(dictionary[@"width"], @12, @"dictionary width projection");
    RCTOutputAssertEqualObjects(dictionary[@"height"], @7, @"dictionary height projection");
    RCTOutputAssertEqualObjects(dictionary[@"byteSize"], @((double)testCase.outputByteSize), @"dictionary byte size projection");
    RCTOutputAssertEqualObjects(dictionary[@"originalByteSize"], @((double)testCase.originalByteSize), @"dictionary original size projection");
    RCTOutputAssertEqualObjects(dictionary[@"compressionRatio"], @(testCase.expectedRatio), @"dictionary ratio projection");
  }
}

static void TestRejectsDirectoryCreationFailureWithStableError(void)
{
  NSError *underlying = [NSError errorWithDomain:@"output-test" code:41 userInfo:nil];
  __block NSUInteger writerCalls = 0;
  RCTImageCompressionOutput *output = RCTOutput(
    ^NSString *{ return @"/cache"; },
    ^BOOL(NSString *path) { return NO; },
    ^BOOL(NSString *path, NSError **error) {
      *error = underlying;
      return NO;
    },
    ^NSTimeInterval{ return 1.0; },
    ^NSString *{ return @"uuid"; },
    ^BOOL(NSData *data, NSString *path, NSError **error) {
      writerCalls += 1;
      return YES;
    }
  );
  RCTImageCompressionOutputError *error = nil;
  RCTImageCompressionOutputResult *result = [output
    persistRequest:RCTOutputRequest(RCTImageCompressionKitJpegFormat, 3, CGSizeMake(1, 1), 5)
    error:&error
  ];

  RCTOutputAssert(result == nil, @"directory failure has no result");
  RCTOutputAssertEqualObjects(error.code, @"ERR_ENCODE_FAILED", @"directory failure code is stable");
  RCTOutputAssertEqualObjects(error.message, @"iOS MVP could not create an output cache file.", @"directory failure message is stable");
  RCTOutputAssert(error.underlyingError == underlying, @"directory failure retains underlying error");
  RCTOutputAssert(writerCalls == 0, @"directory failure does not attempt write");
}

static void TestRejectsWriteFailureMatrixWithStableErrors(void)
{
  for (NSString *format in @[
    RCTImageCompressionKitJpegFormat,
    RCTImageCompressionKitPngFormat,
    RCTImageCompressionKitWebPFormat,
  ]) {
    NSError *underlying = [NSError errorWithDomain:@"output-test" code:42 userInfo:nil];
    RCTImageCompressionOutput *output = RCTOutput(
      ^NSString *{ return @"/cache"; },
      ^BOOL(NSString *path) { return YES; },
      ^BOOL(NSString *path, NSError **error) { return YES; },
      ^NSTimeInterval{ return 1.0; },
      ^NSString *{ return @"uuid"; },
      ^BOOL(NSData *data, NSString *path, NSError **error) {
        *error = underlying;
        return NO;
      }
    );
    RCTImageCompressionOutputError *error = nil;
    RCTImageCompressionOutputResult *result = [output
      persistRequest:RCTOutputRequest(format, 3, CGSizeMake(1, 1), 5)
      error:&error
    ];

    RCTOutputAssert(result == nil, @"write failure has no result");
    RCTOutputAssertEqualObjects(error.code, @"ERR_ENCODE_FAILED", @"write failure code is stable");
    RCTOutputAssertEqualObjects(
      error.message,
      [NSString stringWithFormat:@"iOS MVP could not write %@ output.", format.uppercaseString],
      @"write failure format message is stable"
    );
    RCTOutputAssert(error.underlyingError == underlying, @"write failure retains underlying error");
  }
}

static void TestCopiesImmutableRequestResultAndErrorModels(void)
{
  NSMutableData *data = [RCTOutputData(4) mutableCopy];
  NSMutableString *format = [@"jpeg" mutableCopy];
  RCTImageCompressionOutputRequest *request = [[RCTImageCompressionOutputRequest alloc]
    initWithData:data
    outputFormat:format
    outputSize:CGSizeMake(3, 2)
    originalByteSize:10
  ];
  [data increaseLengthBy:3];
  [format appendString:@"-changed"];
  RCTOutputAssert(request.data.length == 4, @"output request copies bytes");
  RCTOutputAssertEqualObjects(request.outputFormat, @"jpeg", @"output request copies format");

  NSMutableString *uri = [@"file:///result.jpg" mutableCopy];
  NSMutableString *resultFormat = [@"jpeg" mutableCopy];
  RCTImageCompressionOutputResult *result = [[RCTImageCompressionOutputResult alloc]
    initWithURI:uri
    format:resultFormat
    width:3
    height:2
    byteSize:4
    originalByteSize:10
    compressionRatio:0.4
  ];
  [uri appendString:@"-changed"];
  [resultFormat appendString:@"-changed"];
  RCTOutputAssertEqualObjects(result.uri, @"file:///result.jpg", @"output result copies URI");
  RCTOutputAssertEqualObjects(result.format, @"jpeg", @"output result copies format");

  NSMutableString *code = [@"ERR_COPY" mutableCopy];
  NSMutableString *message = [@"copy message" mutableCopy];
  NSError *underlying = [NSError errorWithDomain:@"copy" code:1 userInfo:nil];
  RCTImageCompressionOutputError *error = [[RCTImageCompressionOutputError alloc]
    initWithCode:code
    message:message
    underlyingError:underlying
  ];
  [code appendString:@"-changed"];
  [message appendString:@"-changed"];
  RCTOutputAssertEqualObjects(error.code, @"ERR_COPY", @"output error copies code");
  RCTOutputAssertEqualObjects(error.message, @"copy message", @"output error copies message");
  RCTOutputAssert(error.underlyingError == underlying, @"output error retains underlying error");
}

static void TestClearsExistingErrorOnSuccess(void)
{
  RCTImageCompressionOutput *output = RCTOutput(
    ^NSString *{ return @"/cache"; },
    ^BOOL(NSString *path) { return YES; },
    ^BOOL(NSString *path, NSError **error) { return YES; },
    ^NSTimeInterval{ return 1.0; },
    ^NSString *{ return @"uuid"; },
    ^BOOL(NSData *data, NSString *path, NSError **error) { return YES; }
  );
  RCTImageCompressionOutputError *error = [[RCTImageCompressionOutputError alloc]
    initWithCode:@"ERR_OLD"
    message:@"old error"
    underlyingError:nil
  ];
  RCTImageCompressionOutputResult *result = [output
    persistRequest:RCTOutputRequest(RCTImageCompressionKitPngFormat, 2, CGSizeMake(1, 1), 4)
    error:&error
  ];

  RCTOutputAssert(result != nil, @"successful persistence returns result");
  RCTOutputAssert(error == nil, @"successful persistence clears previous error");
}

int main(void)
{
  @autoreleasepool {
    TestBuildsFormatPathsAndPersistsBytes();
    TestReusesExistingDirectoryAndFallsBackToTemporaryPath();
    TestProjectsResultMetricsAndZeroSourceRatio();
    TestRejectsDirectoryCreationFailureWithStableError();
    TestRejectsWriteFailureMatrixWithStableErrors();
    TestCopiesImmutableRequestResultAndErrorModels();
    TestClearsExistingErrorOnSuccess();

    if (RCTOutputFailureCount > 0) {
      fprintf(
        stderr,
        "iOS output native tests failed: %lu/%lu assertions failed.\n",
        (unsigned long)RCTOutputFailureCount,
        (unsigned long)RCTOutputAssertionCount
      );
      return 1;
    }

    printf(
      "iOS output native tests passed: %lu assertions across 7 table-driven groups.\n",
      (unsigned long)RCTOutputAssertionCount
    );
  }
  return 0;
}
