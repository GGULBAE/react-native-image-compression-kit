#import "RCTImageCompressionKit.h"
#import "RCTImageCompressionIOSCapabilities.h"
#import "RCTImageCompressionOutput.h"
#import "RCTImageCompressionPipeline.h"
#import "RCTImageCompressionRequest.h"
#import "RCTImageCompressionResources.h"

#include <memory>

static dispatch_queue_t RCTImageCompressionBridgeQueue(void)
{
  static dispatch_queue_t queue;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    queue = dispatch_queue_create(
      "com.imagecompressionkit.bridge",
      DISPATCH_QUEUE_SERIAL
    );
  });
  return queue;
}

@interface RCTImageCompressionNativeOperation : NSObject

@property (atomic, readonly, getter=isCancelled) BOOL cancelled;
@property (nonatomic, readonly, getter=isSettled) BOOL settled;
@property (nonatomic, copy, readonly) NSString *operationID;
@property (nonatomic, copy, readonly) RCTPromiseResolveBlock resolve;
@property (nonatomic, copy, readonly) RCTPromiseRejectBlock reject;

- (instancetype)initWithOperationID:(NSString *)operationID
                             resolve:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject;
- (void)cancel;
- (BOOL)markSettled;

@end

@implementation RCTImageCompressionNativeOperation {
  BOOL _cancelled;
  BOOL _settled;
}

- (instancetype)initWithOperationID:(NSString *)operationID
                             resolve:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject
{
  self = [super init];
  if (self != nil) {
    _operationID = [operationID copy];
    _resolve = [resolve copy];
    _reject = [reject copy];
  }
  return self;
}

- (BOOL)isCancelled
{
  @synchronized (self) { return _cancelled; }
}

- (BOOL)isSettled
{
  @synchronized (self) { return _settled; }
}

- (void)cancel
{
  @synchronized (self) { _cancelled = YES; }
}

- (BOOL)markSettled
{
  @synchronized (self) {
    if (_settled) return NO;
    _settled = YES;
    return YES;
  }
}

@end

@interface RCTImageCompressionKit ()

@property (nonatomic, strong) NSOperationQueue *compressionQueue;
@property (nonatomic, strong) NSMutableDictionary<NSString *, RCTImageCompressionNativeOperation *> *operations;
@property (nonatomic, strong) NSMutableSet<NSString *> *cancelledBeforeRegistration;
@property (nonatomic) BOOL invalidated;

@end

@implementation RCTImageCompressionKit

RCT_EXPORT_MODULE(ImageCompressionKit)

- (instancetype)init
{
  self = [super init];
  if (self != nil) {
    _compressionQueue = [[NSOperationQueue alloc] init];
    _compressionQueue.name = @"com.imagecompressionkit.worker";
    _compressionQueue.qualityOfService = NSQualityOfServiceUserInitiated;
    _compressionQueue.maxConcurrentOperationCount = RCTImageCompressionKitMaxConcurrentOperations;
    _operations = [NSMutableDictionary dictionary];
    _cancelledBeforeRegistration = [NSMutableSet set];
  }
  return self;
}

- (dispatch_queue_t)methodQueue
{
  return RCTImageCompressionBridgeQueue();
}

#if RNICK_HAS_CODEGEN_SPEC
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeImageCompressionKitSpecJSI>(params);
}

- (void)compressImage:(JS::NativeImageCompressionKit::NativeCompressionOptions &)options
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  JS::NativeImageCompressionKit::NativeCompressionSource source = options.source();
  JS::NativeImageCompressionKit::NativeOutputOptions output = options.output();
  NSMutableDictionary *sourceMap = [NSMutableDictionary dictionary];
  NSMutableDictionary *outputMap = [NSMutableDictionary dictionary];
  NSMutableDictionary *optionsMap = [NSMutableDictionary dictionary];
  NSString *operationID = options.operationId();
  NSString *sourceURI = source.uri();
  NSString *outputFormat = output.format();
  NSString *metadata = options.metadata();
  std::optional<double> quality = output.quality();
  std::optional<double> maxBytes = output.maxBytes();
  std::optional<JS::NativeImageCompressionKit::NativeResizeOptions> resize = options.resize();

  if (operationID != nil) optionsMap[@"operationId"] = operationID;
  if (sourceURI != nil) sourceMap[@"uri"] = sourceURI;
  if (outputFormat != nil) outputMap[@"format"] = outputFormat;
  if (quality.has_value()) outputMap[@"quality"] = @(quality.value());
  if (maxBytes.has_value()) outputMap[@"maxBytes"] = @(maxBytes.value());
  optionsMap[@"source"] = sourceMap;
  optionsMap[@"output"] = outputMap;
  if (metadata != nil) optionsMap[@"metadata"] = metadata;

  if (resize.has_value()) {
    JS::NativeImageCompressionKit::NativeResizeOptions resizeOptions = resize.value();
    NSMutableDictionary *resizeMap = [NSMutableDictionary dictionary];
    std::optional<double> maxWidth = resizeOptions.maxWidth();
    std::optional<double> maxHeight = resizeOptions.maxHeight();
    NSString *mode = resizeOptions.mode();
    if (maxWidth.has_value()) resizeMap[@"maxWidth"] = @(maxWidth.value());
    if (maxHeight.has_value()) resizeMap[@"maxHeight"] = @(maxHeight.value());
    if (mode != nil) resizeMap[@"mode"] = mode;
    optionsMap[@"resize"] = resizeMap;
  }

  [self compressImageWithDictionary:optionsMap resolve:resolve reject:reject];
}
#else
RCT_REMAP_METHOD(compressImage,
                 compressImageWithLegacyOptions:(NSDictionary *)options
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [self compressImageWithDictionary:options resolve:resolve reject:reject];
}
#endif

- (void)compressImageWithDictionary:(NSDictionary *)options
                             resolve:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject
{
  NSString *operationID = [options[@"operationId"] isKindOfClass:[NSString class]]
    ? options[@"operationId"]
    : [NSString stringWithFormat:@"legacy-%@", NSUUID.UUID.UUIDString];
  RCTImageCompressionNativeOperation *operation = [[RCTImageCompressionNativeOperation alloc]
    initWithOperationID:operationID
    resolve:resolve
    reject:reject
  ];

  if (self.invalidated || [self.cancelledBeforeRegistration containsObject:operationID]) {
    [self.cancelledBeforeRegistration removeObject:operationID];
    [operation cancel];
    [self rejectCancelledOperation:operation];
    return;
  }
  if (self.operations[operationID] != nil) {
    reject(@"ERR_INVALID_OPTIONS", @"Compression operationId must be unique while active.", nil);
    return;
  }
  self.operations[operationID] = operation;

  NSDictionary *immutableOptions = [options copy];
  __weak typeof(self) weakSelf = self;
  [self.compressionQueue addOperationWithBlock:^{
    @autoreleasepool {
      typeof(self) strongSelf = weakSelf;
      if (strongSelf == nil) return;
      RCTImageCompressionPipeline *pipeline = [RCTImageCompressionPipeline defaultPipeline];
      RCTImageCompressionPipelineRequest *request = [[RCTImageCompressionPipelineRequest alloc]
        initWithOptions:immutableOptions
      ];
      RCTImageCompressionPipelineError *pipelineError = nil;
      RCTImageCompressionPipelineResult *result = [pipeline
        executeRequest:request
        cancellationCheck:^BOOL{ return operation.isCancelled; }
        error:&pipelineError
      ];

      dispatch_async(RCTImageCompressionBridgeQueue(), ^{
        [strongSelf finishOperation:operation result:result error:pipelineError pipeline:pipeline];
      });
    }
  }];
}

- (void)finishOperation:(RCTImageCompressionNativeOperation *)operation
                  result:(RCTImageCompressionPipelineResult *)result
                   error:(RCTImageCompressionPipelineError *)error
                pipeline:(RCTImageCompressionPipeline *)pipeline
{
  [self.operations removeObjectForKey:operation.operationID];
  if (operation.isCancelled && result != nil) {
    [self removeOutputForResult:result];
  }
  if (![operation markSettled]) return;

  if (operation.isCancelled) {
    operation.reject(RCTImageCompressionKitCancelledCode, @"Image compression was cancelled.", nil);
  } else if (result == nil) {
    operation.reject(
      error.code ?: RCTImageCompressionKitNativeOperationFailedCode,
      error.message ?: @"iOS compression failed.",
      error.underlyingError
    );
  } else {
    operation.resolve(result.dictionaryRepresentation);
    [pipeline notifyResolved];
  }
}

- (void)removeOutputForResult:(RCTImageCompressionPipelineResult *)result
{
  NSURL *URL = [NSURL URLWithString:result.outputResult.uri];
  if (URL.isFileURL) {
    [[NSFileManager defaultManager] removeItemAtURL:URL error:nil];
  }
}

- (void)rejectCancelledOperation:(RCTImageCompressionNativeOperation *)operation
{
  if ([operation markSettled]) {
    operation.reject(RCTImageCompressionKitCancelledCode, @"Image compression was cancelled.", nil);
  }
}

- (void)cancelOperationID:(NSString *)operationID
{
  RCTImageCompressionNativeOperation *operation = self.operations[operationID];
  if (operation == nil) {
    [self.cancelledBeforeRegistration addObject:operationID];
    return;
  }
  [operation cancel];
  [self rejectCancelledOperation:operation];
}

#if RNICK_HAS_CODEGEN_SPEC
- (void)cancelCompression:(NSString *)operationID
{
  [self cancelOperationID:operationID];
}
#else
RCT_EXPORT_METHOD(cancelCompression:(NSString *)operationID)
{
  [self cancelOperationID:operationID];
}
#endif

- (void)invalidate
{
  self.invalidated = YES;
  for (RCTImageCompressionNativeOperation *operation in self.operations.allValues) {
    [operation cancel];
    [self rejectCancelledOperation:operation];
  }
  [self.operations removeAllObjects];
  [self.cancelledBeforeRegistration removeAllObjects];
  [self.compressionQueue cancelAllOperations];
}

#if RNICK_HAS_CODEGEN_SPEC
- (void)getImageCompressionCapabilities:(RCTPromiseResolveBlock)resolve
                                 reject:(RCTPromiseRejectBlock)reject
#else
RCT_REMAP_METHOD(getImageCompressionCapabilities,
                 getImageCompressionCapabilitiesWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
#endif
{
  NSArray<NSDictionary *> *formats = RCTImageCompressionIOSFormatCapabilities(
    [RCTImageCompressionPipeline defaultWebPOutputAvailable],
    [RCTImageCompressionPipeline defaultAVIFInputAvailable]
  );
  resolve(@{
    @"platform" : @"ios",
    @"formats" : formats,
    @"metadataPolicies" : @[
      RCTImageCompressionKitPreserveMetadataPolicy,
      RCTImageCompressionKitDefaultMetadataPolicy,
      RCTImageCompressionKitStripMetadataPolicy
    ],
    @"supportsTargetSizeCompression" : @YES,
    @"supportsCancellation" : @YES,
    @"maxConcurrentOperations" : @(RCTImageCompressionKitMaxConcurrentOperations),
    @"supportsDecodeDownsampling" : @YES,
    @"resourceLimits" : @{
      @"maxSourceDimension" : @(RCTImageCompressionKitMaxSourceDimension),
      @"maxSourcePixels" : @(RCTImageCompressionKitMaxSourcePixels),
      @"maxWorkingPixels" : @(RCTImageCompressionKitMaxWorkingPixels),
    },
  });
}

@end
