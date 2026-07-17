#import <Foundation/Foundation.h>

#import "RCTImageCompressionRequest.h"

@class UIImage;

NS_ASSUME_NONNULL_BEGIN

FOUNDATION_EXPORT NSString *const RCTImageCompressionKitImageTransformFailedCode;

@interface RCTImageCompressionImageGeometry : NSObject

@property (nonatomic, readonly) CGSize sourceSize;
@property (nonatomic, readonly) CGSize targetSize;
@property (nonatomic, readonly) CGRect drawRect;

- (instancetype)initWithSourceSize:(CGSize)sourceSize
                        targetSize:(CGSize)targetSize
                          drawRect:(CGRect)drawRect NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

FOUNDATION_EXPORT RCTImageCompressionImageGeometry *
RCTImageCompressionImageGeometryCalculate(
  CGSize sourceSize,
  RCTImageCompressionKitResizeOptions resizeOptions
);

@interface RCTImageCompressionImageTransformRequest : NSObject

@property (nonatomic, strong, readonly) UIImage *image;
@property (nonatomic, readonly) RCTImageCompressionKitResizeOptions resizeOptions;
@property (nonatomic, readonly, getter=isOpaque) BOOL opaque;

- (instancetype)initWithImage:(UIImage *)image
                 resizeOptions:(RCTImageCompressionKitResizeOptions)resizeOptions
                        opaque:(BOOL)opaque NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

@interface RCTImageCompressionImageTransformError : NSObject

@property (nonatomic, copy, readonly) NSString *code;
@property (nonatomic, copy, readonly) NSString *message;
@property (nonatomic, strong, readonly, nullable) NSError *underlyingError;

- (instancetype)initWithCode:(NSString *)code
                      message:(NSString *)message
              underlyingError:(nullable NSError *)underlyingError NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

@interface RCTImageCompressionTransformedImage : NSObject

@property (nonatomic, strong, readonly) UIImage *image;
@property (nonatomic, strong, readonly) RCTImageCompressionImageGeometry *geometry;
@property (nonatomic, readonly) CGSize pixelSize;

- (instancetype)initWithImage:(UIImage *)image
                      geometry:(RCTImageCompressionImageGeometry *)geometry NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

typedef CGSize (^RCTImageCompressionImagePixelSizeProvider)(UIImage *image);
typedef UIImage * _Nullable (^RCTImageCompressionImageRenderer)(
  UIImage *image,
  RCTImageCompressionImageGeometry *geometry,
  BOOL opaque
);
typedef void (^RCTImageCompressionImageTransformOperation)(void);
typedef void (^RCTImageCompressionImageTransformExecutor)(
  RCTImageCompressionImageTransformOperation operation
);

@interface RCTImageCompressionImageTransformer : NSObject

- (instancetype)initWithPixelSizeProvider:(RCTImageCompressionImagePixelSizeProvider)pixelSizeProvider
                                  renderer:(RCTImageCompressionImageRenderer)renderer
                         imageWorkExecutor:(RCTImageCompressionImageTransformExecutor)imageWorkExecutor NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

- (nullable RCTImageCompressionTransformedImage *)transformRequest:(RCTImageCompressionImageTransformRequest *)request
                                                              error:(RCTImageCompressionImageTransformError * _Nullable * _Nullable)error;

@end

@interface RCTImageCompressionImageTransformer (Default)

+ (instancetype)defaultTransformer;

@end

NS_ASSUME_NONNULL_END
