#import <Foundation/Foundation.h>

#import "RCTImageCompressionRequest.h"
#import "RCTImageCompressionResources.h"

@class RCTImageCompressionDecodedImage;
@class RCTImageCompressionImageDecodeError;
@class RCTImageCompressionImageEncodeError;
@class RCTImageCompressionImageEncodeRequest;
@class RCTImageCompressionImageTransformRequest;
@class RCTImageCompressionInputError;
@class RCTImageCompressionInputInspection;
@class RCTImageCompressionJpegMetadataError;
@class RCTImageCompressionJpegMetadataRequest;
@class RCTImageCompressionJpegMetadataResult;
@class RCTImageCompressionOutputError;
@class RCTImageCompressionOutputRequest;
@class RCTImageCompressionOutputResult;
@class RCTImageCompressionRequest;
@class RCTImageCompressionRequestError;
@class RCTImageCompressionTransformedImage;
@class RCTImageCompressionEncodedImage;

NS_ASSUME_NONNULL_BEGIN

FOUNDATION_EXPORT NSString *const RCTImageCompressionKitNativeOperationFailedCode;

@interface RCTImageCompressionPipelineRequest : NSObject

@property (nonatomic, copy, readonly) NSDictionary *options;

- (instancetype)initWithOptions:(NSDictionary *)options NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end


@interface RCTImageCompressionPipelineResult : NSObject

@property (nonatomic, strong, readonly) RCTImageCompressionOutputResult *outputResult;

- (instancetype)initWithOutputResult:(RCTImageCompressionOutputResult *)outputResult NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

- (NSDictionary *)dictionaryRepresentation;

@end


@interface RCTImageCompressionPipelineError : NSObject

@property (nonatomic, copy, readonly) NSString *code;
@property (nonatomic, copy, readonly) NSString *message;
@property (nonatomic, strong, readonly, nullable) NSError *underlyingError;

- (instancetype)initWithCode:(NSString *)code
                      message:(NSString *)message
              underlyingError:(nullable NSError *)underlyingError NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end


typedef BOOL (^RCTImageCompressionPipelineRuntimeAvailability)(void);
typedef RCTImageCompressionRequest * _Nullable (^RCTImageCompressionPipelineRequestParser)(
  NSDictionary *options,
  RCTImageCompressionPipelineRuntimeAvailability webPOutputAvailability,
  RCTImageCompressionRequestError * _Nullable * _Nullable error
);
typedef RCTImageCompressionInputInspection * _Nullable (^RCTImageCompressionPipelineInputLoader)(
  NSString *sourceURI,
  RCTImageCompressionPipelineRuntimeAvailability avifInputAvailability,
  RCTImageCompressionInputError * _Nullable * _Nullable error
);
typedef RCTImageCompressionJpegMetadataResult * _Nullable (^RCTImageCompressionPipelineMetadataPreparer)(
  RCTImageCompressionJpegMetadataRequest *request,
  RCTImageCompressionJpegMetadataError * _Nullable * _Nullable error
);
typedef RCTImageCompressionDecodedImage * _Nullable (^RCTImageCompressionPipelineImageDecoder)(
  RCTImageCompressionInputInspection *input,
  RCTImageCompressionKitResizeOptions resizeOptions,
  RCTImageCompressionImageDecodeError * _Nullable * _Nullable error
);
typedef RCTImageCompressionTransformedImage * _Nullable (^RCTImageCompressionPipelineImageTransformer)(
  RCTImageCompressionImageTransformRequest *request
);
typedef RCTImageCompressionEncodedImage * _Nullable (^RCTImageCompressionPipelineImageEncoder)(
  RCTImageCompressionImageEncodeRequest *request,
  RCTImageCompressionImageEncodeError * _Nullable * _Nullable error
);
typedef RCTImageCompressionOutputResult * _Nullable (^RCTImageCompressionPipelineOutputWriter)(
  RCTImageCompressionOutputRequest *request,
  RCTImageCompressionOutputError * _Nullable * _Nullable error
);
typedef void (^RCTImageCompressionPipelineStageObserver)(NSString *stage);

@interface RCTImageCompressionPipeline : NSObject

- (instancetype)initWithRequestParser:(RCTImageCompressionPipelineRequestParser)requestParser
                           inputLoader:(RCTImageCompressionPipelineInputLoader)inputLoader
                      metadataPreparer:(RCTImageCompressionPipelineMetadataPreparer)metadataPreparer
                          imageDecoder:(RCTImageCompressionPipelineImageDecoder)imageDecoder
                      imageTransformer:(RCTImageCompressionPipelineImageTransformer)imageTransformer
                          imageEncoder:(RCTImageCompressionPipelineImageEncoder)imageEncoder
                          outputWriter:(RCTImageCompressionPipelineOutputWriter)outputWriter
                webPOutputAvailability:(RCTImageCompressionPipelineRuntimeAvailability)webPOutputAvailability
                 avifInputAvailability:(RCTImageCompressionPipelineRuntimeAvailability)avifInputAvailability
                         stageObserver:(RCTImageCompressionPipelineStageObserver)stageObserver NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

- (nullable RCTImageCompressionPipelineResult *)executeRequest:(RCTImageCompressionPipelineRequest *)request
                                                          error:(RCTImageCompressionPipelineError * _Nullable * _Nullable)error;
- (nullable RCTImageCompressionPipelineResult *)executeRequest:(RCTImageCompressionPipelineRequest *)request
                                             cancellationCheck:(RCTImageCompressionCancellationCheck)cancellationCheck
                                                          error:(RCTImageCompressionPipelineError * _Nullable * _Nullable)error;
- (void)notifyResolved;

@end


@interface RCTImageCompressionPipeline (Default)

+ (instancetype)defaultPipeline;
+ (BOOL)defaultWebPOutputAvailable;
+ (BOOL)defaultAVIFInputAvailable;

@end


NS_ASSUME_NONNULL_END
