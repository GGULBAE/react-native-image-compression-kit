#import <Foundation/Foundation.h>

#import "RCTImageCompressionJpegMetadata.h"
#import "RCTImageCompressionResources.h"

@class UIImage;

NS_ASSUME_NONNULL_BEGIN

FOUNDATION_EXPORT NSString *const RCTImageCompressionKitImageEncodeFailedCode;

@interface RCTImageCompressionImageEncodeRequest : NSObject

@property (nonatomic, strong, readonly) UIImage *image;
@property (nonatomic, copy, readonly) NSString *outputFormat;
@property (nonatomic, readonly) NSInteger quality;
@property (nonatomic, readonly) BOOL hasMaxBytes;
@property (nonatomic, readonly) NSUInteger maxBytes;
@property (nonatomic, strong, readonly) RCTImageCompressionJpegMetadataResult *jpegMetadata;
@property (nonatomic, copy, readonly) RCTImageCompressionCancellationCheck cancellationCheck;

- (instancetype)initWithImage:(UIImage *)image
                  outputFormat:(NSString *)outputFormat
                       quality:(NSInteger)quality
                   hasMaxBytes:(BOOL)hasMaxBytes
                      maxBytes:(NSUInteger)maxBytes
                  jpegMetadata:(RCTImageCompressionJpegMetadataResult *)jpegMetadata;

- (instancetype)initWithImage:(UIImage *)image
                  outputFormat:(NSString *)outputFormat
                       quality:(NSInteger)quality
                   hasMaxBytes:(BOOL)hasMaxBytes
                      maxBytes:(NSUInteger)maxBytes
                  jpegMetadata:(RCTImageCompressionJpegMetadataResult *)jpegMetadata
             cancellationCheck:(RCTImageCompressionCancellationCheck)cancellationCheck NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

@interface RCTImageCompressionImageEncodeError : NSObject

@property (nonatomic, copy, readonly) NSString *code;
@property (nonatomic, copy, readonly) NSString *message;

- (instancetype)initWithCode:(NSString *)code
                      message:(NSString *)message NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end


@interface RCTImageCompressionEncodedImage : NSObject

@property (nonatomic, copy, readonly) NSData *data;

- (instancetype)initWithData:(NSData *)data NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end


typedef NSData * _Nullable (^RCTImageCompressionJpegImageEncoder)(
  UIImage *image,
  NSInteger quality,
  RCTImageCompressionJpegMetadataResult *metadata
);
typedef NSData * _Nullable (^RCTImageCompressionPngImageEncoder)(UIImage *image);
typedef NSData * _Nullable (^RCTImageCompressionWebPImageEncoder)(
  UIImage *image,
  NSInteger quality
);
typedef void (^RCTImageCompressionImageEncodeOperation)(void);
typedef void (^RCTImageCompressionImageEncodeExecutor)(
  RCTImageCompressionImageEncodeOperation operation
);

@interface RCTImageCompressionImageEncoder : NSObject

- (instancetype)initWithJpegEncoder:(RCTImageCompressionJpegImageEncoder)jpegEncoder
                          pngEncoder:(RCTImageCompressionPngImageEncoder)pngEncoder
                         webPEncoder:(RCTImageCompressionWebPImageEncoder)webPEncoder
                   imageWorkExecutor:(RCTImageCompressionImageEncodeExecutor)imageWorkExecutor NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

- (nullable RCTImageCompressionEncodedImage *)encodeRequest:(RCTImageCompressionImageEncodeRequest *)request
                                                       error:(RCTImageCompressionImageEncodeError * _Nullable * _Nullable)error;

@end

@interface RCTImageCompressionImageEncoder (Default)

+ (instancetype)defaultEncoder;
+ (BOOL)defaultWebPOutputAvailable;

@end


NS_ASSUME_NONNULL_END
