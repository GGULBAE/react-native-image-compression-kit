#import <Foundation/Foundation.h>

@class RCTImageCompressionInputInspection;
@class UIImage;

NS_ASSUME_NONNULL_BEGIN

@interface RCTImageCompressionImageDecodeError : NSObject

@property (nonatomic, copy, readonly) NSString *code;
@property (nonatomic, copy, readonly) NSString *message;
@property (nonatomic, strong, readonly, nullable) NSError *underlyingError;

- (instancetype)initWithCode:(NSString *)code
                      message:(NSString *)message
              underlyingError:(nullable NSError *)underlyingError NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

@interface RCTImageCompressionDecodedImage : NSObject

@property (nonatomic, strong, readonly) UIImage *image;
@property (nonatomic, readonly) BOOL decodedFirstFrame;

- (instancetype)initWithImage:(UIImage *)image
            decodedFirstFrame:(BOOL)decodedFirstFrame NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

typedef UIImage * _Nullable (^RCTImageCompressionOrdinaryImageDecoder)(NSData *data);
typedef UIImage * _Nullable (^RCTImageCompressionFirstFrameImageDecoder)(NSData *data);
typedef BOOL (^RCTImageCompressionDecodedImageValidator)(UIImage *image);
typedef void (^RCTImageCompressionImageDecodeOperation)(void);
typedef void (^RCTImageCompressionImageDecodeExecutor)(RCTImageCompressionImageDecodeOperation operation);

@interface RCTImageCompressionImageDecoder : NSObject

- (instancetype)initWithOrdinaryImageDecoder:(RCTImageCompressionOrdinaryImageDecoder)ordinaryImageDecoder
                       firstFrameImageDecoder:(RCTImageCompressionFirstFrameImageDecoder)firstFrameImageDecoder
                        decodedImageValidator:(RCTImageCompressionDecodedImageValidator)decodedImageValidator
                           imageWorkExecutor:(RCTImageCompressionImageDecodeExecutor)imageWorkExecutor NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

- (nullable RCTImageCompressionDecodedImage *)decodeInput:(RCTImageCompressionInputInspection *)input
                                                     error:(RCTImageCompressionImageDecodeError * _Nullable * _Nullable)error;

@end

@interface RCTImageCompressionImageDecoder (Default)

+ (instancetype)defaultDecoder;

@end

NS_ASSUME_NONNULL_END
