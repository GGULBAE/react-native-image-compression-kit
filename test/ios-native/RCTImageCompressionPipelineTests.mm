#import <Foundation/Foundation.h>

#import "RCTImageCompressionImageDecoder.h"
#import "RCTImageCompressionImageEncoder.h"
#import "RCTImageCompressionImageTransformer.h"
#import "RCTImageCompressionInput.h"
#import "RCTImageCompressionJpegMetadata.h"
#import "RCTImageCompressionOutput.h"
#import "RCTImageCompressionPipeline.h"
#import "RCTImageCompressionRequest.h"

static NSUInteger RCTPipelineAssertionCount = 0;
static NSUInteger RCTPipelineFailureCount = 0;

static void RCTPipelineAssert(BOOL condition, NSString *context)
{
  RCTPipelineAssertionCount += 1;
  if (!condition) {
    RCTPipelineFailureCount += 1;
    fprintf(stderr, "FAIL: %s\n", context.UTF8String);
  }
}

static void RCTPipelineAssertEqualObjects(id actual, id expected, NSString *context)
{
  BOOL equal = actual == expected || [actual isEqual:expected];
  RCTPipelineAssert(
    equal,
    [NSString stringWithFormat:@"%@ (actual=%@ expected=%@)", context, actual, expected]
  );
}

static NSData *RCTPipelineData(NSUInteger length)
{
  return [NSMutableData dataWithLength:length];
}

static RCTImageCompressionRequest *RCTPipelineParsedRequest(void)
{
  RCTImageCompressionKitResizeOptions resize = {
    .enabled = YES,
    .hasMaxWidth = YES,
    .hasMaxHeight = YES,
    .maxWidth = 40,
    .maxHeight = 30,
    .mode = RCTImageCompressionKitResizeModeContain,
  };
  return [[RCTImageCompressionRequest alloc]
    initWithSourceURI:@"file:///source.jpg"
    outputFormat:RCTImageCompressionKitJpegFormat
    quality:77
    hasMaxBytes:YES
    maxBytes:4096
    metadataPolicy:RCTImageCompressionKitDefaultMetadataPolicy
    resizeOptions:resize
  ];
}

static RCTImageCompressionInputInspection *RCTPipelineInput(void)
{
  RCTImageCompressionSource *source = [[RCTImageCompressionSource alloc]
    initWithURL:[NSURL fileURLWithPath:@"/source.jpg"]
    data:RCTPipelineData(100)
  ];
  return [[RCTImageCompressionInputInspection alloc]
    initWithSource:source
    imageType:@"public.jpeg"
    format:RCTImageCompressionInputFormatJpeg
    sourceLooksLikeAVIF:NO
  ];
}

static RCTImageCompressionJpegMetadataResult *RCTPipelineMetadata(void)
{
  return [[RCTImageCompressionJpegMetadataResult alloc]
    initWithPreservingSourceMetadata:NO
    sourceProperties:nil
  ];
}

static RCTImageCompressionDecodedImage *RCTPipelineDecodedImage(NSObject *image)
{
  return [[RCTImageCompressionDecodedImage alloc]
    initWithImage:(UIImage *)image
    decodedFirstFrame:NO
  ];
}

static RCTImageCompressionTransformedImage *RCTPipelineTransformedImage(NSObject *image)
{
  RCTImageCompressionImageGeometry *geometry = [[RCTImageCompressionImageGeometry alloc]
    initWithSourceSize:CGSizeMake(80, 60)
    targetSize:CGSizeMake(40, 30)
    drawRect:CGRectMake(0, 0, 40, 30)
  ];
  return [[RCTImageCompressionTransformedImage alloc]
    initWithImage:(UIImage *)image
    geometry:geometry
  ];
}

static RCTImageCompressionEncodedImage *RCTPipelineEncodedImage(void)
{
  return [[RCTImageCompressionEncodedImage alloc]
    initWithData:RCTPipelineData(25)
  ];
}

static RCTImageCompressionOutputResult *RCTPipelineOutputResult(void)
{
  return [[RCTImageCompressionOutputResult alloc]
    initWithURI:@"file:///cache/compressed.jpg"
    format:RCTImageCompressionKitJpegFormat
    width:40
    height:30
    byteSize:25
    originalByteSize:100
    compressionRatio:0.25
  ];
}

typedef NS_ENUM(NSInteger, RCTPipelineStage) {
  RCTPipelineStageNone,
  RCTPipelineStageRequest,
  RCTPipelineStageInput,
  RCTPipelineStageMetadata,
  RCTPipelineStageDecode,
  RCTPipelineStageTransform,
  RCTPipelineStageEncode,
  RCTPipelineStageOutput,
};

static RCTImageCompressionPipeline *RCTPipelineFixture(
  RCTPipelineStage failureStage,
  RCTPipelineStage exceptionStage,
  NSMutableArray<NSString *> *calls,
  NSMutableArray<NSString *> *stages,
  NSError *underlyingError,
  NSUInteger *webPAvailabilityCalls,
  NSUInteger *avifAvailabilityCalls
) {
  NSObject *decodedObject = [NSObject new];
  NSObject *transformedObject = [NSObject new];
  RCTImageCompressionRequest *parsedRequest = RCTPipelineParsedRequest();
  RCTImageCompressionInputInspection *input = RCTPipelineInput();
  RCTImageCompressionJpegMetadataResult *metadata = RCTPipelineMetadata();
  RCTImageCompressionDecodedImage *decodedImage = RCTPipelineDecodedImage(decodedObject);
  RCTImageCompressionTransformedImage *transformedImage = RCTPipelineTransformedImage(transformedObject);
  RCTImageCompressionEncodedImage *encodedImage = RCTPipelineEncodedImage();
  RCTImageCompressionOutputResult *outputResult = RCTPipelineOutputResult();

  return [[RCTImageCompressionPipeline alloc]
    initWithRequestParser:^RCTImageCompressionRequest *(
      NSDictionary *options,
      RCTImageCompressionPipelineRuntimeAvailability availability,
      RCTImageCompressionRequestError **error
    ) {
      [calls addObject:@"request"];
      (void)availability();
      if (exceptionStage == RCTPipelineStageRequest) {
        [NSException raise:@"request exception" format:@"test"];
      }
      if (failureStage == RCTPipelineStageRequest) {
        *error = [[RCTImageCompressionRequestError alloc]
          initWithCode:@"ERR_REQUEST"
          message:@"request failed"
        ];
        return nil;
      }
      return parsedRequest;
    }
    inputLoader:^RCTImageCompressionInputInspection *(
      NSString *sourceURI,
      RCTImageCompressionPipelineRuntimeAvailability availability,
      RCTImageCompressionInputError **error
    ) {
      [calls addObject:@"input"];
      (void)availability();
      if (exceptionStage == RCTPipelineStageInput) {
        [NSException raise:@"input exception" format:@"test"];
      }
      if (failureStage == RCTPipelineStageInput) {
        *error = [[RCTImageCompressionInputError alloc]
          initWithCode:@"ERR_INPUT"
          message:@"input failed"
          underlyingError:underlyingError
        ];
        return nil;
      }
      return input;
    }
    metadataPreparer:^RCTImageCompressionJpegMetadataResult *(
      RCTImageCompressionJpegMetadataRequest *request,
      RCTImageCompressionJpegMetadataError **error
    ) {
      [calls addObject:@"metadata"];
      if (exceptionStage == RCTPipelineStageMetadata) {
        [NSException raise:@"metadata exception" format:@"test"];
      }
      if (failureStage == RCTPipelineStageMetadata) {
        *error = [[RCTImageCompressionJpegMetadataError alloc]
          initWithCode:@"ERR_METADATA"
          message:@"metadata failed"
        ];
        return nil;
      }
      return metadata;
    }
    imageDecoder:^RCTImageCompressionDecodedImage *(
      RCTImageCompressionInputInspection *receivedInput,
      RCTImageCompressionKitResizeOptions resizeOptions,
      RCTImageCompressionImageDecodeError **error
    ) {
      (void)resizeOptions;
      [calls addObject:@"decode"];
      if (exceptionStage == RCTPipelineStageDecode) {
        [NSException raise:@"decode exception" format:@"test"];
      }
      if (failureStage == RCTPipelineStageDecode) {
        *error = [[RCTImageCompressionImageDecodeError alloc]
          initWithCode:@"ERR_DECODE"
          message:@"decode failed"
          underlyingError:underlyingError
        ];
        return nil;
      }
      return decodedImage;
    }
    imageTransformer:^RCTImageCompressionTransformedImage *(
      RCTImageCompressionImageTransformRequest *request
    ) {
      [calls addObject:@"transform"];
      if (exceptionStage == RCTPipelineStageTransform) {
        [NSException raise:@"transform exception" format:@"test"];
      }
      return failureStage == RCTPipelineStageTransform ? nil : transformedImage;
    }
    imageEncoder:^RCTImageCompressionEncodedImage *(
      RCTImageCompressionImageEncodeRequest *request,
      RCTImageCompressionImageEncodeError **error
    ) {
      [calls addObject:@"encode"];
      if (exceptionStage == RCTPipelineStageEncode) {
        [NSException raise:@"encode exception" format:@"test"];
      }
      if (failureStage == RCTPipelineStageEncode) {
        *error = [[RCTImageCompressionImageEncodeError alloc]
          initWithCode:@"ERR_ENCODE"
          message:@"encode failed"
        ];
        return nil;
      }
      return encodedImage;
    }
    outputWriter:^RCTImageCompressionOutputResult *(
      RCTImageCompressionOutputRequest *request,
      RCTImageCompressionOutputError **error
    ) {
      [calls addObject:@"output"];
      if (exceptionStage == RCTPipelineStageOutput) {
        [NSException raise:@"output exception" format:@"test"];
      }
      if (failureStage == RCTPipelineStageOutput) {
        *error = [[RCTImageCompressionOutputError alloc]
          initWithCode:@"ERR_OUTPUT"
          message:@"output failed"
          underlyingError:underlyingError
        ];
        return nil;
      }
      return outputResult;
    }
    webPOutputAvailability:^BOOL{
      *webPAvailabilityCalls += 1;
      return YES;
    }
    avifInputAvailability:^BOOL{
      *avifAvailabilityCalls += 1;
      return NO;
    }
    stageObserver:^(NSString *stage) {
      [stages addObject:stage];
    }
  ];
}

static RCTImageCompressionPipelineRequest *RCTPipelineRequest(void)
{
  return [[RCTImageCompressionPipelineRequest alloc]
    initWithOptions:@{
      @"source" : @{ @"uri" : @"file:///source.jpg" },
      @"output" : @{ @"format" : @"jpeg" },
    }
  ];
}

static NSArray<NSString *> *RCTPipelineExpectedCallsThroughStage(RCTPipelineStage stage)
{
  NSArray<NSString *> *allCalls = @[
    @"request", @"input", @"metadata", @"decode", @"transform", @"encode", @"output",
  ];
  return [allCalls subarrayWithRange:NSMakeRange(0, (NSUInteger)stage)];
}

static NSArray<NSString *> *RCTPipelineExpectedStagesForFailure(RCTPipelineStage stage)
{
  NSMutableArray<NSString *> *expected = [NSMutableArray arrayWithObject:@"compress-start"];
  if (stage >= RCTPipelineStageInput) {
    [expected addObject:@"options-validated"];
  }
  if (stage >= RCTPipelineStageMetadata) {
    [expected addObjectsFromArray:@[
      @"source-url-ready",
      @"source-read",
      @"image-type-public.jpeg",
    ]];
  }
  if (stage >= RCTPipelineStageDecode) {
    [expected addObject:@"image-work-start"];
  }
  if (stage >= RCTPipelineStageDecode && stage <= RCTPipelineStageEncode) {
    [expected addObject:@"image-work-finished"];
  }
  if (stage == RCTPipelineStageOutput) {
    [expected addObjectsFromArray:@[
      @"image-work-finished",
      @"jpeg-encoded",
    ]];
  }
  return expected;
}

static void TestRunsSuccessStagesAndForwardsRequests(void)
{
  NSMutableArray<NSString *> *calls = [NSMutableArray array];
  NSMutableArray<NSString *> *stages = [NSMutableArray array];
  __block NSUInteger webPAvailabilityCalls = 0;
  __block NSUInteger avifAvailabilityCalls = 0;
  __block NSDictionary *receivedOptions = nil;
  __block BOOL receivedWebPAvailability = NO;
  __block BOOL receivedAVIFAvailability = YES;
  __block RCTImageCompressionJpegMetadataRequest *receivedMetadataRequest = nil;
  __block RCTImageCompressionInputInspection *receivedDecodeInput = nil;
  __block RCTImageCompressionImageTransformRequest *receivedTransformRequest = nil;
  __block RCTImageCompressionImageEncodeRequest *receivedEncodeRequest = nil;
  __block RCTImageCompressionOutputRequest *receivedOutputRequest = nil;
  NSObject *decodedObject = [NSObject new];
  NSObject *transformedObject = [NSObject new];
  RCTImageCompressionRequest *parsedRequest = RCTPipelineParsedRequest();
  RCTImageCompressionInputInspection *input = RCTPipelineInput();
  RCTImageCompressionJpegMetadataResult *metadata = RCTPipelineMetadata();
  RCTImageCompressionDecodedImage *decodedImage = RCTPipelineDecodedImage(decodedObject);
  RCTImageCompressionTransformedImage *transformedImage = RCTPipelineTransformedImage(transformedObject);
  RCTImageCompressionEncodedImage *encodedImage = RCTPipelineEncodedImage();
  RCTImageCompressionOutputResult *outputResult = RCTPipelineOutputResult();
  RCTImageCompressionPipeline *pipeline = [[RCTImageCompressionPipeline alloc]
    initWithRequestParser:^RCTImageCompressionRequest *(
      NSDictionary *options,
      RCTImageCompressionPipelineRuntimeAvailability availability,
      RCTImageCompressionRequestError **error
    ) {
      [calls addObject:@"request"];
      receivedOptions = options;
      receivedWebPAvailability = availability();
      return parsedRequest;
    }
    inputLoader:^RCTImageCompressionInputInspection *(
      NSString *sourceURI,
      RCTImageCompressionPipelineRuntimeAvailability availability,
      RCTImageCompressionInputError **error
    ) {
      [calls addObject:@"input"];
      RCTPipelineAssertEqualObjects(sourceURI, @"file:///source.jpg", @"input receives parsed source URI");
      receivedAVIFAvailability = availability();
      return input;
    }
    metadataPreparer:^RCTImageCompressionJpegMetadataResult *(
      RCTImageCompressionJpegMetadataRequest *request,
      RCTImageCompressionJpegMetadataError **error
    ) {
      [calls addObject:@"metadata"];
      receivedMetadataRequest = request;
      return metadata;
    }
    imageDecoder:^RCTImageCompressionDecodedImage *(
      RCTImageCompressionInputInspection *receivedInput,
      RCTImageCompressionKitResizeOptions resizeOptions,
      RCTImageCompressionImageDecodeError **error
    ) {
      (void)resizeOptions;
      [calls addObject:@"decode"];
      receivedDecodeInput = receivedInput;
      return decodedImage;
    }
    imageTransformer:^RCTImageCompressionTransformedImage *(
      RCTImageCompressionImageTransformRequest *request
    ) {
      [calls addObject:@"transform"];
      receivedTransformRequest = request;
      return transformedImage;
    }
    imageEncoder:^RCTImageCompressionEncodedImage *(
      RCTImageCompressionImageEncodeRequest *request,
      RCTImageCompressionImageEncodeError **error
    ) {
      [calls addObject:@"encode"];
      receivedEncodeRequest = request;
      return encodedImage;
    }
    outputWriter:^RCTImageCompressionOutputResult *(
      RCTImageCompressionOutputRequest *request,
      RCTImageCompressionOutputError **error
    ) {
      [calls addObject:@"output"];
      receivedOutputRequest = request;
      return outputResult;
    }
    webPOutputAvailability:^BOOL{
      webPAvailabilityCalls += 1;
      return YES;
    }
    avifInputAvailability:^BOOL{
      avifAvailabilityCalls += 1;
      return NO;
    }
    stageObserver:^(NSString *stage) {
      [stages addObject:stage];
    }
  ];
  NSMutableDictionary *source = [@{ @"uri" : @"file:///source.jpg" } mutableCopy];
  NSMutableDictionary *options = [@{
    @"source" : source,
    @"output" : @{ @"format" : @"jpeg" },
  } mutableCopy];
  RCTImageCompressionPipelineRequest *request = [[RCTImageCompressionPipelineRequest alloc]
    initWithOptions:options
  ];
  source[@"uri"] = @"file:///mutated.jpg";
  RCTImageCompressionPipelineError *error = nil;
  RCTImageCompressionPipelineResult *result = [pipeline executeRequest:request error:&error];

  RCTPipelineAssert(result != nil && error == nil, @"success returns pipeline result without error");
  RCTPipelineAssertEqualObjects(calls, (@[
    @"request", @"input", @"metadata", @"decode", @"transform", @"encode", @"output",
  ]), @"pipeline calls every component in order");
  RCTPipelineAssertEqualObjects(stages, (@[
    @"compress-start",
    @"options-validated",
    @"source-url-ready",
    @"source-read",
    @"image-type-public.jpeg",
    @"image-work-start",
    @"image-work-finished",
    @"jpeg-encoded",
    @"output-path-ready",
    @"output-written",
  ]), @"pipeline emits exact pre-resolution smoke stage order");
  RCTPipelineAssertEqualObjects(receivedOptions[@"source"][@"uri"], @"file:///source.jpg", @"pipeline request deep-copies nested options");
  RCTPipelineAssert(receivedWebPAvailability && !receivedAVIFAvailability, @"stage adapters receive runtime availability providers");
  RCTPipelineAssert(webPAvailabilityCalls == 1 && avifAvailabilityCalls == 1, @"runtime providers are evaluated by their owning stages");
  RCTPipelineAssertEqualObjects(receivedMetadataRequest.metadataPolicy, RCTImageCompressionKitDefaultMetadataPolicy, @"metadata stage receives parsed policy");
  RCTPipelineAssert(receivedMetadataRequest.jpegInput && receivedMetadataRequest.jpegOutput, @"metadata stage receives input/output JPEG flags");
  RCTPipelineAssert(receivedMetadataRequest.sourceData.length == 100, @"metadata stage receives source bytes");
  RCTPipelineAssert(receivedDecodeInput == input, @"decoder receives inspected input");
  RCTPipelineAssert((id)receivedTransformRequest.image == decodedObject, @"transformer receives decoded image");
  RCTPipelineAssert(receivedTransformRequest.resizeOptions.maxWidth == 40, @"transformer receives parsed resize options");
  RCTPipelineAssert(receivedTransformRequest.isOpaque, @"JPEG transform request remains opaque");
  RCTPipelineAssert((id)receivedEncodeRequest.image == transformedObject, @"encoder receives transformed image");
  RCTPipelineAssertEqualObjects(receivedEncodeRequest.outputFormat, RCTImageCompressionKitJpegFormat, @"encoder receives output format");
  RCTPipelineAssert(receivedEncodeRequest.quality == 77, @"encoder receives quality");
  RCTPipelineAssert(receivedEncodeRequest.hasMaxBytes && receivedEncodeRequest.maxBytes == 4096, @"encoder receives target size");
  RCTPipelineAssert(receivedEncodeRequest.jpegMetadata == metadata, @"encoder receives prepared metadata");
  RCTPipelineAssert(receivedOutputRequest.data.length == 25, @"output receives encoded bytes");
  RCTPipelineAssert(CGSizeEqualToSize(receivedOutputRequest.outputSize, CGSizeMake(40, 30)), @"output receives transformed pixel size");
  RCTPipelineAssert(receivedOutputRequest.originalByteSize == 100, @"output receives original byte size");
  RCTPipelineAssert(result.outputResult == outputResult, @"pipeline result retains output result");
  RCTPipelineAssertEqualObjects(result.dictionaryRepresentation, outputResult.dictionaryRepresentation, @"pipeline result projects unchanged dictionary");

  [pipeline notifyResolved];
  RCTPipelineAssertEqualObjects(stages.lastObject, @"compress-resolved", @"resolution notification preserves final smoke stage");
}

static void TestForwardsFailureMatrixWithoutRunningDownstreamStages(void)
{
  typedef struct {
    RCTPipelineStage stage;
    NSString *__unsafe_unretained code;
    NSString *__unsafe_unretained message;
    BOOL retainsUnderlyingError;
  } RCTPipelineFailureCase;
  RCTPipelineFailureCase cases[] = {
    { RCTPipelineStageRequest, @"ERR_REQUEST", @"request failed", NO },
    { RCTPipelineStageInput, @"ERR_INPUT", @"input failed", YES },
    { RCTPipelineStageMetadata, @"ERR_METADATA", @"metadata failed", NO },
    { RCTPipelineStageDecode, @"ERR_DECODE", @"decode failed", YES },
    { RCTPipelineStageTransform, @"ERR_ENCODE_FAILED", @"iOS MVP could not encode JPEG output.", NO },
    { RCTPipelineStageEncode, @"ERR_ENCODE", @"encode failed", NO },
    { RCTPipelineStageOutput, @"ERR_OUTPUT", @"output failed", YES },
  };

  for (const RCTPipelineFailureCase &testCase : cases) {
    NSMutableArray<NSString *> *calls = [NSMutableArray array];
    NSMutableArray<NSString *> *stages = [NSMutableArray array];
    NSError *underlying = [NSError errorWithDomain:@"pipeline-test" code:testCase.stage userInfo:nil];
    __block NSUInteger webPAvailabilityCalls = 0;
    __block NSUInteger avifAvailabilityCalls = 0;
    RCTImageCompressionPipeline *pipeline = RCTPipelineFixture(
      testCase.stage,
      RCTPipelineStageNone,
      calls,
      stages,
      underlying,
      &webPAvailabilityCalls,
      &avifAvailabilityCalls
    );
    RCTImageCompressionPipelineError *error = nil;
    RCTImageCompressionPipelineResult *result = [pipeline executeRequest:RCTPipelineRequest() error:&error];

    RCTPipelineAssert(result == nil, @"failed stage returns no pipeline result");
    RCTPipelineAssertEqualObjects(error.code, testCase.code, @"failed stage forwards stable code");
    RCTPipelineAssertEqualObjects(error.message, testCase.message, @"failed stage forwards stable message");
    RCTPipelineAssert(
      error.underlyingError == (testCase.retainsUnderlyingError ? underlying : nil),
      @"failed stage preserves legacy underlying-error contract"
    );
    RCTPipelineAssertEqualObjects(
      calls,
      RCTPipelineExpectedCallsThroughStage(testCase.stage),
      @"failed stage does not run downstream components"
    );
    RCTPipelineAssertEqualObjects(
      stages,
      RCTPipelineExpectedStagesForFailure(testCase.stage),
      @"failed stage preserves smoke stage sequence"
    );
  }
}

static void TestUsesInjectedRuntimeCapabilityProviders(void)
{
  NSMutableArray<NSString *> *calls = [NSMutableArray array];
  NSMutableArray<NSString *> *stages = [NSMutableArray array];
  __block NSUInteger webPAvailabilityCalls = 0;
  __block NSUInteger avifAvailabilityCalls = 0;
  RCTImageCompressionPipeline *pipeline = RCTPipelineFixture(
    RCTPipelineStageNone,
    RCTPipelineStageNone,
    calls,
    stages,
    nil,
    &webPAvailabilityCalls,
    &avifAvailabilityCalls
  );
  RCTImageCompressionPipelineResult *result = [pipeline executeRequest:RCTPipelineRequest() error:nil];

  RCTPipelineAssert(result != nil, @"runtime provider fixture succeeds");
  RCTPipelineAssert(webPAvailabilityCalls == 1, @"request parser owns WebP provider evaluation");
  RCTPipelineAssert(avifAvailabilityCalls == 1, @"input loader owns AVIF provider evaluation");
}

static void TestConvertsExceptionStageMatrixToNativeFailure(void)
{
  for (RCTPipelineStage stage = RCTPipelineStageRequest;
       stage <= RCTPipelineStageOutput;
       stage = (RCTPipelineStage)(stage + 1)) {
    NSMutableArray<NSString *> *calls = [NSMutableArray array];
    NSMutableArray<NSString *> *stages = [NSMutableArray array];
    __block NSUInteger webPAvailabilityCalls = 0;
    __block NSUInteger avifAvailabilityCalls = 0;
    RCTImageCompressionPipeline *pipeline = RCTPipelineFixture(
      RCTPipelineStageNone,
      stage,
      calls,
      stages,
      nil,
      &webPAvailabilityCalls,
      &avifAvailabilityCalls
    );
    RCTImageCompressionPipelineError *error = nil;
    RCTImageCompressionPipelineResult *result = [pipeline executeRequest:RCTPipelineRequest() error:&error];

    RCTPipelineAssert(result == nil, @"thrown stage returns no result");
    RCTPipelineAssertEqualObjects(error.code, @"ERR_NATIVE_OPERATION_FAILED", @"thrown stage uses native failure code");
    RCTPipelineAssertEqualObjects(error.message, @"iOS MVP compression failed.", @"thrown stage uses native failure message");
    RCTPipelineAssert(error.underlyingError == nil, @"thrown stage preserves nil underlying error");
    RCTPipelineAssertEqualObjects(calls, RCTPipelineExpectedCallsThroughStage(stage), @"thrown stage stops downstream execution");
  }
}

static void TestCopiesImmutableRequestResultAndErrorModels(void)
{
  NSMutableString *uri = [@"file:///source.jpg" mutableCopy];
  NSMutableDictionary *source = [@{ @"uri" : uri } mutableCopy];
  NSMutableDictionary *options = [@{ @"source" : source } mutableCopy];
  RCTImageCompressionPipelineRequest *request = [[RCTImageCompressionPipelineRequest alloc]
    initWithOptions:options
  ];
  [uri appendString:@"-changed"];
  source[@"uri"] = @"file:///changed.jpg";
  options[@"extra"] = @YES;
  RCTPipelineAssertEqualObjects(request.options[@"source"][@"uri"], @"file:///source.jpg", @"pipeline request copies nested option values");
  RCTPipelineAssert(request.options[@"extra"] == nil, @"pipeline request does not retain mutable top-level options");

  RCTImageCompressionOutputResult *outputResult = RCTPipelineOutputResult();
  RCTImageCompressionPipelineResult *result = [[RCTImageCompressionPipelineResult alloc]
    initWithOutputResult:outputResult
  ];
  RCTPipelineAssert(result.outputResult == outputResult, @"pipeline result retains immutable output result");

  NSMutableString *code = [@"ERR_COPY" mutableCopy];
  NSMutableString *message = [@"copy message" mutableCopy];
  NSError *underlying = [NSError errorWithDomain:@"copy" code:1 userInfo:nil];
  RCTImageCompressionPipelineError *error = [[RCTImageCompressionPipelineError alloc]
    initWithCode:code
    message:message
    underlyingError:underlying
  ];
  [code appendString:@"-changed"];
  [message appendString:@"-changed"];
  RCTPipelineAssertEqualObjects(error.code, @"ERR_COPY", @"pipeline error copies code");
  RCTPipelineAssertEqualObjects(error.message, @"copy message", @"pipeline error copies message");
  RCTPipelineAssert(error.underlyingError == underlying, @"pipeline error retains underlying error");
}

static void TestClearsExistingErrorAndNotifiesResolution(void)
{
  NSMutableArray<NSString *> *calls = [NSMutableArray array];
  NSMutableArray<NSString *> *stages = [NSMutableArray array];
  __block NSUInteger webPAvailabilityCalls = 0;
  __block NSUInteger avifAvailabilityCalls = 0;
  RCTImageCompressionPipeline *pipeline = RCTPipelineFixture(
    RCTPipelineStageNone,
    RCTPipelineStageNone,
    calls,
    stages,
    nil,
    &webPAvailabilityCalls,
    &avifAvailabilityCalls
  );
  RCTImageCompressionPipelineError *error = [[RCTImageCompressionPipelineError alloc]
    initWithCode:@"ERR_OLD"
    message:@"old error"
    underlyingError:nil
  ];
  RCTImageCompressionPipelineResult *result = [pipeline executeRequest:RCTPipelineRequest() error:&error];

  RCTPipelineAssert(result != nil, @"successful pipeline returns result");
  RCTPipelineAssert(error == nil, @"successful pipeline clears previous error");
  RCTPipelineAssert(![stages containsObject:@"compress-resolved"], @"execute does not announce resolution before promise mapping");
  [pipeline notifyResolved];
  RCTPipelineAssertEqualObjects(stages.lastObject, @"compress-resolved", @"bridge can notify resolution after promise mapping");
}

int main(void)
{
  @autoreleasepool {
    TestRunsSuccessStagesAndForwardsRequests();
    TestForwardsFailureMatrixWithoutRunningDownstreamStages();
    TestUsesInjectedRuntimeCapabilityProviders();
    TestConvertsExceptionStageMatrixToNativeFailure();
    TestCopiesImmutableRequestResultAndErrorModels();
    TestClearsExistingErrorAndNotifiesResolution();

    if (RCTPipelineFailureCount > 0) {
      fprintf(
        stderr,
        "iOS compression pipeline native tests failed: %lu/%lu assertions failed.\n",
        (unsigned long)RCTPipelineFailureCount,
        (unsigned long)RCTPipelineAssertionCount
      );
      return 1;
    }

    printf(
      "iOS compression pipeline native tests passed: %lu assertions across 6 table-driven groups.\n",
      (unsigned long)RCTPipelineAssertionCount
    );
  }
  return 0;
}
