#import "RCTImageCompressionPipeline.h"

#import "RCTImageCompressionImageDecoder.h"
#import "RCTImageCompressionImageEncoder.h"
#import "RCTImageCompressionImageTransformer.h"
#import "RCTImageCompressionInput.h"
#import "RCTImageCompressionJpegMetadata.h"
#import "RCTImageCompressionOutput.h"
#import "RCTImageCompressionRequest.h"

NSString *const RCTImageCompressionKitNativeOperationFailedCode = @"ERR_NATIVE_OPERATION_FAILED";

static id RCTImageCompressionPipelineImmutableCopy(id value)
{
  if ([value isKindOfClass:[NSDictionary class]]) {
    NSMutableDictionary *copy = [NSMutableDictionary dictionary];
    [(NSDictionary *)value enumerateKeysAndObjectsUsingBlock:^(id key, id object, BOOL *stop) {
      copy[[key copy]] = RCTImageCompressionPipelineImmutableCopy(object);
    }];
    return [copy copy];
  }
  if ([value isKindOfClass:[NSArray class]]) {
    NSMutableArray *copy = [NSMutableArray array];
    for (id object in (NSArray *)value) {
      [copy addObject:RCTImageCompressionPipelineImmutableCopy(object)];
    }
    return [copy copy];
  }
  return [value copy];
}

@implementation RCTImageCompressionPipelineRequest

- (instancetype)initWithOptions:(NSDictionary *)options
{
  self = [super init];
  if (self != nil) {
    _options = RCTImageCompressionPipelineImmutableCopy(options);
  }
  return self;
}

@end


@implementation RCTImageCompressionPipelineResult

- (instancetype)initWithOutputResult:(RCTImageCompressionOutputResult *)outputResult
{
  self = [super init];
  if (self != nil) {
    _outputResult = outputResult;
  }
  return self;
}

- (NSDictionary *)dictionaryRepresentation
{
  return self.outputResult.dictionaryRepresentation;
}

@end


@implementation RCTImageCompressionPipelineError

- (instancetype)initWithCode:(NSString *)code
                      message:(NSString *)message
              underlyingError:(NSError *)underlyingError
{
  self = [super init];
  if (self != nil) {
    _code = [code copy];
    _message = [message copy];
    _underlyingError = underlyingError;
  }
  return self;
}

@end


@interface RCTImageCompressionPipeline ()

@property (nonatomic, copy, readonly) RCTImageCompressionPipelineRequestParser requestParser;
@property (nonatomic, copy, readonly) RCTImageCompressionPipelineInputLoader inputLoader;
@property (nonatomic, copy, readonly) RCTImageCompressionPipelineMetadataPreparer metadataPreparer;
@property (nonatomic, copy, readonly) RCTImageCompressionPipelineImageDecoder imageDecoder;
@property (nonatomic, copy, readonly) RCTImageCompressionPipelineImageTransformer imageTransformer;
@property (nonatomic, copy, readonly) RCTImageCompressionPipelineImageEncoder imageEncoder;
@property (nonatomic, copy, readonly) RCTImageCompressionPipelineOutputWriter outputWriter;
@property (nonatomic, copy, readonly) RCTImageCompressionPipelineRuntimeAvailability webPOutputAvailability;
@property (nonatomic, copy, readonly) RCTImageCompressionPipelineRuntimeAvailability avifInputAvailability;
@property (nonatomic, copy, readonly) RCTImageCompressionPipelineStageObserver stageObserver;

@end


@implementation RCTImageCompressionPipeline

- (instancetype)initWithRequestParser:(RCTImageCompressionPipelineRequestParser)requestParser
                           inputLoader:(RCTImageCompressionPipelineInputLoader)inputLoader
                      metadataPreparer:(RCTImageCompressionPipelineMetadataPreparer)metadataPreparer
                          imageDecoder:(RCTImageCompressionPipelineImageDecoder)imageDecoder
                      imageTransformer:(RCTImageCompressionPipelineImageTransformer)imageTransformer
                          imageEncoder:(RCTImageCompressionPipelineImageEncoder)imageEncoder
                          outputWriter:(RCTImageCompressionPipelineOutputWriter)outputWriter
                webPOutputAvailability:(RCTImageCompressionPipelineRuntimeAvailability)webPOutputAvailability
                 avifInputAvailability:(RCTImageCompressionPipelineRuntimeAvailability)avifInputAvailability
                         stageObserver:(RCTImageCompressionPipelineStageObserver)stageObserver
{
  self = [super init];
  if (self != nil) {
    _requestParser = [requestParser copy];
    _inputLoader = [inputLoader copy];
    _metadataPreparer = [metadataPreparer copy];
    _imageDecoder = [imageDecoder copy];
    _imageTransformer = [imageTransformer copy];
    _imageEncoder = [imageEncoder copy];
    _outputWriter = [outputWriter copy];
    _webPOutputAvailability = [webPOutputAvailability copy];
    _avifInputAvailability = [avifInputAvailability copy];
    _stageObserver = [stageObserver copy];
  }
  return self;
}

- (void)setError:(RCTImageCompressionPipelineError * _Nullable * _Nullable)error
             code:(NSString *)code
          message:(NSString *)message
  underlyingError:(NSError *)underlyingError
{
  if (error != nil) {
    *error = [[RCTImageCompressionPipelineError alloc]
      initWithCode:code
      message:message
      underlyingError:underlyingError
    ];
  }
}

- (nullable RCTImageCompressionPipelineResult *)executeRequest:(RCTImageCompressionPipelineRequest *)pipelineRequest
                                                          error:(RCTImageCompressionPipelineError * _Nullable * _Nullable)error
{
  return [self
    executeRequest:pipelineRequest
    cancellationCheck:^BOOL{ return NO; }
    error:error
  ];
}

- (BOOL)stopIfCancelled:(RCTImageCompressionCancellationCheck)cancellationCheck
                   error:(RCTImageCompressionPipelineError * _Nullable * _Nullable)error
{
  if (!cancellationCheck()) return NO;
  [self setError:error
    code:RCTImageCompressionKitCancelledCode
    message:@"Image compression was cancelled."
    underlyingError:nil
  ];
  return YES;
}

- (nullable RCTImageCompressionPipelineResult *)executeRequest:(RCTImageCompressionPipelineRequest *)pipelineRequest
                                             cancellationCheck:(RCTImageCompressionCancellationCheck)cancellationCheck
                                                          error:(RCTImageCompressionPipelineError * _Nullable * _Nullable)error
{
  if (error != nil) {
    *error = nil;
  }

  @try {
    if ([self stopIfCancelled:cancellationCheck error:error]) return nil;
    self.stageObserver(@"compress-start");
    RCTImageCompressionRequestError *requestError = nil;
    RCTImageCompressionRequest *request = self.requestParser(
      pipelineRequest.options,
      self.webPOutputAvailability,
      &requestError
    );
    if (request == nil) {
      [self setError:error code:requestError.code message:requestError.message underlyingError:nil];
      return nil;
    }

    self.stageObserver(@"options-validated");
    if ([self stopIfCancelled:cancellationCheck error:error]) return nil;
    RCTImageCompressionInputError *inputError = nil;
    RCTImageCompressionInputInspection *input = self.inputLoader(
      request.sourceURI,
      self.avifInputAvailability,
      &inputError
    );
    if (input == nil) {
      [self setError:error code:inputError.code message:inputError.message
        underlyingError:inputError.underlyingError];
      return nil;
    }
    if ([self stopIfCancelled:cancellationCheck error:error]) return nil;

    self.stageObserver(@"source-url-ready");
    self.stageObserver(@"source-read");
    self.stageObserver([NSString stringWithFormat:@"image-type-%@", input.imageType]);
    RCTImageCompressionJpegMetadataRequest *metadataRequest = [[RCTImageCompressionJpegMetadataRequest alloc]
      initWithMetadataPolicy:request.metadataPolicy
      jpegInput:input.jpeg
      jpegOutput:request.outputIsJpeg
      sourceData:input.source.data
    ];
    RCTImageCompressionJpegMetadataError *metadataError = nil;
    RCTImageCompressionJpegMetadataResult *jpegMetadata = self.metadataPreparer(
      metadataRequest,
      &metadataError
    );
    if (jpegMetadata == nil) {
      [self setError:error code:metadataError.code message:metadataError.message underlyingError:nil];
      return nil;
    }
    if ([self stopIfCancelled:cancellationCheck error:error]) return nil;

    self.stageObserver(@"image-work-start");
    RCTImageCompressionImageDecodeError *decodeError = nil;
    RCTImageCompressionDecodedImage *decodedImage = self.imageDecoder(
      input,
      request.resizeOptions,
      &decodeError
    );
    if (decodedImage == nil) {
      self.stageObserver(@"image-work-finished");
      [self setError:error code:decodeError.code message:decodeError.message
        underlyingError:decodeError.underlyingError];
      return nil;
    }
    if ([self stopIfCancelled:cancellationCheck error:error]) {
      self.stageObserver(@"image-work-finished");
      return nil;
    }

    RCTImageCompressionImageTransformRequest *transformRequest = [[RCTImageCompressionImageTransformRequest alloc]
      initWithImage:decodedImage.image
      resizeOptions:request.resizeOptions
      opaque:request.outputIsJpeg
    ];
    RCTImageCompressionTransformedImage *transformedImage = self.imageTransformer(transformRequest);
    if (transformedImage == nil) {
      self.stageObserver(@"image-work-finished");
      [self setError:error
        code:RCTImageCompressionKitImageEncodeFailedCode
        message:[NSString stringWithFormat:
          @"iOS MVP could not encode %@ output.",
          request.outputFormat.uppercaseString
        ]
        underlyingError:nil
      ];
      return nil;
    }
    if ([self stopIfCancelled:cancellationCheck error:error]) {
      self.stageObserver(@"image-work-finished");
      return nil;
    }

    RCTImageCompressionImageEncodeRequest *encodeRequest = [[RCTImageCompressionImageEncodeRequest alloc]
      initWithImage:transformedImage.image
      outputFormat:request.outputFormat
      quality:request.quality
      hasMaxBytes:request.hasMaxBytes
      maxBytes:request.maxBytes
      jpegMetadata:jpegMetadata
      cancellationCheck:cancellationCheck
    ];
    RCTImageCompressionImageEncodeError *encodeError = nil;
    RCTImageCompressionEncodedImage *encodedImage = self.imageEncoder(encodeRequest, &encodeError);
    self.stageObserver(@"image-work-finished");
    if (encodedImage == nil) {
      [self setError:error code:encodeError.code message:encodeError.message underlyingError:nil];
      return nil;
    }
    if ([self stopIfCancelled:cancellationCheck error:error]) return nil;

    self.stageObserver([NSString stringWithFormat:@"%@-encoded", request.outputFormat]);
    RCTImageCompressionOutputRequest *outputRequest = [[RCTImageCompressionOutputRequest alloc]
      initWithData:encodedImage.data
      outputFormat:request.outputFormat
      outputSize:transformedImage.pixelSize
      originalByteSize:input.source.data.length
    ];
    RCTImageCompressionOutputError *outputError = nil;
    RCTImageCompressionOutputResult *outputResult = self.outputWriter(outputRequest, &outputError);
    if (outputResult == nil) {
      [self setError:error code:outputError.code message:outputError.message
        underlyingError:outputError.underlyingError];
      return nil;
    }

    if ([self stopIfCancelled:cancellationCheck error:error]) {
      NSURL *outputURL = [NSURL URLWithString:outputResult.uri];
      if (outputURL.isFileURL) {
        [[NSFileManager defaultManager] removeItemAtURL:outputURL error:nil];
      }
      return nil;
    }

    self.stageObserver(@"output-path-ready");
    self.stageObserver(@"output-written");
    return [[RCTImageCompressionPipelineResult alloc] initWithOutputResult:outputResult];
  } @catch (NSException *exception) {
    [self setError:error
      code:RCTImageCompressionKitNativeOperationFailedCode
      message:@"iOS MVP compression failed."
      underlyingError:nil
    ];
    return nil;
  }
}

- (void)notifyResolved
{
  self.stageObserver(@"compress-resolved");
}

@end
