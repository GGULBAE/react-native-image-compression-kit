#import <Foundation/Foundation.h>

#import "RCTImageCompressionImageTransformer.h"

#include <math.h>

static NSUInteger RCTImageTransformerAssertionCount = 0;
static NSUInteger RCTImageTransformerFailureCount = 0;

static void RCTTransformerAssert(BOOL condition, NSString *context)
{
  RCTImageTransformerAssertionCount += 1;
  if (!condition) {
    RCTImageTransformerFailureCount += 1;
    fprintf(stderr, "FAIL: %s\n", context.UTF8String);
  }
}

static void RCTTransformerAssertEqualObjects(id actual, id expected, NSString *context)
{
  BOOL equal = actual == expected || [actual isEqual:expected];
  RCTTransformerAssert(
    equal,
    [NSString stringWithFormat:@"%@ (actual=%@ expected=%@)", context, actual, expected]
  );
}

static void RCTTransformerAssertEqualValue(
  CGFloat actual,
  CGFloat expected,
  NSString *context
) {
  RCTTransformerAssert(
    fabs(actual - expected) < 0.0001,
    [NSString stringWithFormat:@"%@ (actual=%.4f expected=%.4f)", context, actual, expected]
  );
}

static void RCTTransformerAssertEqualSize(CGSize actual, CGSize expected, NSString *context)
{
  RCTTransformerAssertEqualValue(actual.width, expected.width, [context stringByAppendingString:@" width"]);
  RCTTransformerAssertEqualValue(actual.height, expected.height, [context stringByAppendingString:@" height"]);
}

static void RCTTransformerAssertEqualRect(CGRect actual, CGRect expected, NSString *context)
{
  RCTTransformerAssertEqualValue(actual.origin.x, expected.origin.x, [context stringByAppendingString:@" x"]);
  RCTTransformerAssertEqualValue(actual.origin.y, expected.origin.y, [context stringByAppendingString:@" y"]);
  RCTTransformerAssertEqualValue(actual.size.width, expected.size.width, [context stringByAppendingString:@" width"]);
  RCTTransformerAssertEqualValue(actual.size.height, expected.size.height, [context stringByAppendingString:@" height"]);
}

static RCTImageCompressionKitResizeOptions RCTTransformerResize(
  BOOL enabled,
  BOOL hasWidth,
  NSInteger width,
  BOOL hasHeight,
  NSInteger height,
  RCTImageCompressionKitResizeMode mode
) {
  return (RCTImageCompressionKitResizeOptions){
    .enabled = enabled,
    .hasMaxWidth = hasWidth,
    .hasMaxHeight = hasHeight,
    .maxWidth = width,
    .maxHeight = height,
    .mode = mode,
  };
}

typedef struct {
  const char *name;
  CGSize sourceSize;
  RCTImageCompressionKitResizeOptions resize;
  CGSize targetSize;
  CGRect drawRect;
} RCTTransformerGeometryCase;

static void TestCalculatesGeometryMatrix(void)
{
  RCTTransformerGeometryCase cases[] = {
    {
      "no-resize-landscape",
      CGSizeMake(400, 200),
      RCTTransformerResize(NO, NO, 0, NO, 0, RCTImageCompressionKitResizeModeContain),
      CGSizeMake(400, 200),
      CGRectMake(0, 0, 400, 200),
    },
    {
      "contain-landscape",
      CGSizeMake(400, 200),
      RCTTransformerResize(YES, YES, 300, YES, 300, RCTImageCompressionKitResizeModeContain),
      CGSizeMake(300, 150),
      CGRectMake(0, 0, 300, 150),
    },
    {
      "contain-portrait",
      CGSizeMake(200, 400),
      RCTTransformerResize(YES, YES, 300, YES, 100, RCTImageCompressionKitResizeModeContain),
      CGSizeMake(50, 100),
      CGRectMake(0, 0, 50, 100),
    },
    {
      "width-only",
      CGSizeMake(333, 111),
      RCTTransformerResize(YES, YES, 100, NO, 0, RCTImageCompressionKitResizeModeContain),
      CGSizeMake(100, 33),
      CGRectMake(0, 0, 100, 33),
    },
    {
      "height-only",
      CGSizeMake(111, 333),
      RCTTransformerResize(YES, NO, 0, YES, 100, RCTImageCompressionKitResizeModeContain),
      CGSizeMake(33, 100),
      CGRectMake(0, 0, 33, 100),
    },
    {
      "stretch-both",
      CGSizeMake(400, 200),
      RCTTransformerResize(YES, YES, 100, YES, 150, RCTImageCompressionKitResizeModeStretch),
      CGSizeMake(100, 150),
      CGRectMake(0, 0, 100, 150),
    },
    {
      "stretch-width-only",
      CGSizeMake(400, 200),
      RCTTransformerResize(YES, YES, 100, NO, 0, RCTImageCompressionKitResizeModeStretch),
      CGSizeMake(100, 200),
      CGRectMake(0, 0, 100, 200),
    },
    {
      "cover-landscape-center-crop",
      CGSizeMake(400, 200),
      RCTTransformerResize(YES, YES, 100, YES, 100, RCTImageCompressionKitResizeModeCover),
      CGSizeMake(100, 100),
      CGRectMake(-50, 0, 200, 100),
    },
    {
      "cover-portrait-center-crop",
      CGSizeMake(200, 400),
      RCTTransformerResize(YES, YES, 100, YES, 100, RCTImageCompressionKitResizeModeCover),
      CGSizeMake(100, 100),
      CGRectMake(0, -50, 100, 200),
    },
    {
      "cover-no-upscale",
      CGSizeMake(100, 50),
      RCTTransformerResize(YES, YES, 200, YES, 200, RCTImageCompressionKitResizeModeCover),
      CGSizeMake(100, 50),
      CGRectMake(0, 0, 100, 50),
    },
    {
      "cover-width-only-falls-back-to-contain",
      CGSizeMake(400, 200),
      RCTTransformerResize(YES, YES, 100, NO, 0, RCTImageCompressionKitResizeModeCover),
      CGSizeMake(100, 50),
      CGRectMake(0, 0, 100, 50),
    },
  };

  for (const RCTTransformerGeometryCase &testCase : cases) {
    NSString *name = [NSString stringWithUTF8String:testCase.name];
    RCTImageCompressionImageGeometry *geometry = RCTImageCompressionImageGeometryCalculate(
      testCase.sourceSize,
      testCase.resize
    );

    RCTTransformerAssertEqualSize(geometry.sourceSize, testCase.sourceSize, [name stringByAppendingString:@" source"]);
    RCTTransformerAssertEqualSize(geometry.targetSize, testCase.targetSize, [name stringByAppendingString:@" target"]);
    RCTTransformerAssertEqualRect(geometry.drawRect, testCase.drawRect, [name stringByAppendingString:@" draw"]);
  }
}

static RCTImageCompressionImageTransformer *RCTTransformer(
  RCTImageCompressionImagePixelSizeProvider pixelSizeProvider,
  RCTImageCompressionImageRenderer renderer,
  RCTImageCompressionImageTransformExecutor executor
) {
  return [[RCTImageCompressionImageTransformer alloc]
    initWithPixelSizeProvider:pixelSizeProvider
    renderer:renderer
    imageWorkExecutor:executor
  ];
}

static void TestForwardsOpaqueAndTransparentRendererRequests(void)
{
  for (NSNumber *opaqueValue in @[@YES, @NO]) {
    NSObject *source = [NSObject new];
    NSObject *rendered = [NSObject new];
    __block NSUInteger rendererCalls = 0;
    __block BOOL receivedOpaque = !opaqueValue.boolValue;
    __block UIImage *receivedSource = nil;
    __block CGSize receivedTarget = CGSizeMake(0, 0);
    RCTImageCompressionImageTransformer *transformer = RCTTransformer(
      ^CGSize(UIImage *image) {
        return CGSizeMake(400, 200);
      },
      ^UIImage *(UIImage *image, RCTImageCompressionImageGeometry *geometry, BOOL opaque) {
        rendererCalls += 1;
        receivedSource = image;
        receivedOpaque = opaque;
        receivedTarget = geometry.targetSize;
        return (UIImage *)rendered;
      },
      ^(RCTImageCompressionImageTransformOperation operation) {
        operation();
      }
    );
    RCTImageCompressionImageTransformRequest *request = [[RCTImageCompressionImageTransformRequest alloc]
      initWithImage:(UIImage *)source
      resizeOptions:RCTTransformerResize(YES, YES, 100, YES, 100, RCTImageCompressionKitResizeModeCover)
      opaque:opaqueValue.boolValue
    ];
    RCTImageCompressionTransformedImage *result = [transformer transformRequest:request error:nil];

    RCTTransformerAssert((id)result.image == rendered, @"renderer result is returned");
    RCTTransformerAssert((id)receivedSource == source, @"renderer receives source image");
    RCTTransformerAssert(receivedOpaque == opaqueValue.boolValue, @"renderer receives opaque/background policy");
    RCTTransformerAssertEqualSize(receivedTarget, CGSizeMake(100, 100), @"renderer receives cover target");
    RCTTransformerAssertEqualSize(result.pixelSize, CGSizeMake(100, 100), @"result exposes rendered pixel size");
    RCTTransformerAssert(rendererCalls == 1, @"renderer called exactly once");
  }
}

static void TestRunsPixelGeometryAndRendererInsideExecutor(void)
{
  NSObject *source = [NSObject new];
  NSObject *rendered = [NSObject new];
  __block BOOL insideExecutor = NO;
  __block BOOL pixelSizeInsideExecutor = NO;
  __block BOOL rendererInsideExecutor = NO;
  __block NSUInteger executorCalls = 0;
  RCTImageCompressionImageTransformer *transformer = RCTTransformer(
    ^CGSize(UIImage *image) {
      pixelSizeInsideExecutor = insideExecutor;
      return CGSizeMake(300.4, 199.5);
    },
    ^UIImage *(UIImage *image, RCTImageCompressionImageGeometry *geometry, BOOL opaque) {
      rendererInsideExecutor = insideExecutor;
      RCTTransformerAssertEqualSize(geometry.sourceSize, CGSizeMake(300, 200), @"pixel size normalized before render");
      return (UIImage *)rendered;
    },
    ^(RCTImageCompressionImageTransformOperation operation) {
      executorCalls += 1;
      insideExecutor = YES;
      operation();
      insideExecutor = NO;
    }
  );
  RCTImageCompressionImageTransformRequest *request = [[RCTImageCompressionImageTransformRequest alloc]
    initWithImage:(UIImage *)source
    resizeOptions:RCTTransformerResize(NO, NO, 0, NO, 0, RCTImageCompressionKitResizeModeContain)
    opaque:YES
  ];
  RCTImageCompressionTransformedImage *result = [transformer transformRequest:request error:nil];

  RCTTransformerAssert(result != nil, @"executor transform succeeds");
  RCTTransformerAssert(executorCalls == 1, @"executor called once");
  RCTTransformerAssert(pixelSizeInsideExecutor, @"pixel size read inside executor");
  RCTTransformerAssert(rendererInsideExecutor, @"renderer runs inside executor");
  RCTTransformerAssert(!insideExecutor, @"executor completes synchronously");
}

static void TestRejectsMissingRenderAndSkippedExecutor(void)
{
  NSArray<NSNumber *> *runOperationCases = @[@YES, @NO];
  for (NSNumber *runOperation in runOperationCases) {
    __block NSUInteger rendererCalls = 0;
    RCTImageCompressionImageTransformer *transformer = RCTTransformer(
      ^CGSize(UIImage *image) {
        return CGSizeMake(10, 20);
      },
      ^UIImage *(UIImage *image, RCTImageCompressionImageGeometry *geometry, BOOL opaque) {
        rendererCalls += 1;
        return nil;
      },
      ^(RCTImageCompressionImageTransformOperation operation) {
        if (runOperation.boolValue) {
          operation();
        }
      }
    );
    RCTImageCompressionImageTransformRequest *request = [[RCTImageCompressionImageTransformRequest alloc]
      initWithImage:(UIImage *)[NSObject new]
      resizeOptions:RCTTransformerResize(NO, NO, 0, NO, 0, RCTImageCompressionKitResizeModeContain)
      opaque:NO
    ];
    RCTImageCompressionImageTransformError *error = nil;
    RCTImageCompressionTransformedImage *result = [transformer transformRequest:request error:&error];

    RCTTransformerAssert(result == nil, @"missing render rejects");
    RCTTransformerAssertEqualObjects(error.code, @"ERR_ENCODE_FAILED", @"render failure keeps encode classification");
    RCTTransformerAssertEqualObjects(error.message, @"iOS MVP could not render the source image.", @"render failure message");
    RCTTransformerAssert(error.underlyingError == nil, @"render failure has no underlying error");
    RCTTransformerAssert(rendererCalls == (runOperation.boolValue ? 1u : 0u), @"executor owns renderer invocation");
  }
}

static void TestRetainsImmutableRequestResultAndErrorModels(void)
{
  NSObject *source = [NSObject new];
  NSObject *rendered = [NSObject new];
  __weak NSObject *weakSource = source;
  __weak NSObject *weakRendered = rendered;
  RCTImageCompressionImageTransformRequest *request = [[RCTImageCompressionImageTransformRequest alloc]
    initWithImage:(UIImage *)source
    resizeOptions:RCTTransformerResize(YES, YES, 30, YES, 20, RCTImageCompressionKitResizeModeStretch)
    opaque:YES
  ];
  RCTImageCompressionImageGeometry *geometry = RCTImageCompressionImageGeometryCalculate(
    CGSizeMake(100, 50),
    request.resizeOptions
  );
  RCTImageCompressionTransformedImage *result = [[RCTImageCompressionTransformedImage alloc]
    initWithImage:(UIImage *)rendered
    geometry:geometry
  ];
  source = nil;
  rendered = nil;

  NSMutableString *code = [@"ERR_MUTABLE" mutableCopy];
  NSMutableString *message = [@"mutable message" mutableCopy];
  NSError *underlying = [NSError errorWithDomain:@"transform" code:7 userInfo:nil];
  RCTImageCompressionImageTransformError *error = [[RCTImageCompressionImageTransformError alloc]
    initWithCode:code
    message:message
    underlyingError:underlying
  ];
  [code appendString:@"-changed"];
  [message appendString:@" changed"];

  RCTTransformerAssert((id)request.image == weakSource && weakSource != nil, @"request retains source image");
  RCTTransformerAssert((id)result.image == weakRendered && weakRendered != nil, @"result retains rendered image");
  RCTTransformerAssertEqualSize(result.pixelSize, CGSizeMake(30, 20), @"result snapshots target size");
  RCTTransformerAssertEqualObjects(error.code, @"ERR_MUTABLE", @"error code is copied");
  RCTTransformerAssertEqualObjects(error.message, @"mutable message", @"error message is copied");
  RCTTransformerAssert(error.underlyingError == underlying, @"error retains underlying error");
}

static void TestClearsExistingErrorOnSuccess(void)
{
  NSObject *rendered = [NSObject new];
  RCTImageCompressionImageTransformer *transformer = RCTTransformer(
    ^CGSize(UIImage *image) {
      return CGSizeMake(40, 30);
    },
    ^UIImage *(UIImage *image, RCTImageCompressionImageGeometry *geometry, BOOL opaque) {
      return (UIImage *)rendered;
    },
    ^(RCTImageCompressionImageTransformOperation operation) {
      operation();
    }
  );
  RCTImageCompressionImageTransformRequest *request = [[RCTImageCompressionImageTransformRequest alloc]
    initWithImage:(UIImage *)[NSObject new]
    resizeOptions:RCTTransformerResize(NO, NO, 0, NO, 0, RCTImageCompressionKitResizeModeContain)
    opaque:NO
  ];
  RCTImageCompressionImageTransformError *error = [[RCTImageCompressionImageTransformError alloc]
    initWithCode:@"ERR_OLD"
    message:@"old error"
    underlyingError:nil
  ];
  RCTImageCompressionTransformedImage *result = [transformer transformRequest:request error:&error];

  RCTTransformerAssert(result != nil, @"successful transform returns result");
  RCTTransformerAssert(error == nil, @"successful transform clears previous error");
}

int main(void)
{
  @autoreleasepool {
    TestCalculatesGeometryMatrix();
    TestForwardsOpaqueAndTransparentRendererRequests();
    TestRunsPixelGeometryAndRendererInsideExecutor();
    TestRejectsMissingRenderAndSkippedExecutor();
    TestRetainsImmutableRequestResultAndErrorModels();
    TestClearsExistingErrorOnSuccess();

    if (RCTImageTransformerFailureCount > 0) {
      fprintf(
        stderr,
        "iOS image transformer native tests failed: %lu/%lu assertions failed.\n",
        (unsigned long)RCTImageTransformerFailureCount,
        (unsigned long)RCTImageTransformerAssertionCount
      );
      return 1;
    }

    printf(
      "iOS image transformer native tests passed: %lu assertions across 6 table-driven groups.\n",
      (unsigned long)RCTImageTransformerAssertionCount
    );
  }
  return 0;
}
