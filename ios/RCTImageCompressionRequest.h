#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

FOUNDATION_EXPORT NSString *const RCTImageCompressionKitInvalidOptionsCode;
FOUNDATION_EXPORT NSString *const RCTImageCompressionKitNotImplementedCode;

FOUNDATION_EXPORT NSString *const RCTImageCompressionKitJpegFormat;
FOUNDATION_EXPORT NSString *const RCTImageCompressionKitPngFormat;
FOUNDATION_EXPORT NSString *const RCTImageCompressionKitWebPFormat;
FOUNDATION_EXPORT NSString *const RCTImageCompressionKitGifFormat;
FOUNDATION_EXPORT NSString *const RCTImageCompressionKitHeicFormat;
FOUNDATION_EXPORT NSString *const RCTImageCompressionKitHeifFormat;
FOUNDATION_EXPORT NSString *const RCTImageCompressionKitAvifFormat;

FOUNDATION_EXPORT NSString *const RCTImageCompressionKitDefaultMetadataPolicy;
FOUNDATION_EXPORT NSString *const RCTImageCompressionKitStripMetadataPolicy;
FOUNDATION_EXPORT NSString *const RCTImageCompressionKitPreserveMetadataPolicy;

FOUNDATION_EXPORT NSInteger const RCTImageCompressionKitDefaultQuality;
FOUNDATION_EXPORT NSInteger const RCTImageCompressionKitMinQuality;
FOUNDATION_EXPORT NSInteger const RCTImageCompressionKitMaxQuality;

typedef NS_ENUM(NSInteger, RCTImageCompressionKitResizeMode) {
  RCTImageCompressionKitResizeModeContain,
  RCTImageCompressionKitResizeModeCover,
  RCTImageCompressionKitResizeModeStretch
};

typedef struct {
  BOOL enabled;
  BOOL hasMaxWidth;
  BOOL hasMaxHeight;
  NSInteger maxWidth;
  NSInteger maxHeight;
  RCTImageCompressionKitResizeMode mode;
} RCTImageCompressionKitResizeOptions;

@interface RCTImageCompressionRequestError : NSObject

@property (nonatomic, copy, readonly) NSString *code;
@property (nonatomic, copy, readonly) NSString *message;

- (instancetype)initWithCode:(NSString *)code
                      message:(NSString *)message NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

@interface RCTImageCompressionRequest : NSObject

@property (nonatomic, copy, readonly) NSString *sourceURI;
@property (nonatomic, copy, readonly) NSString *outputFormat;
@property (nonatomic, readonly) NSInteger quality;
@property (nonatomic, readonly) BOOL hasMaxBytes;
@property (nonatomic, readonly) NSUInteger maxBytes;
@property (nonatomic, copy, readonly) NSString *metadataPolicy;
@property (nonatomic, readonly) RCTImageCompressionKitResizeOptions resizeOptions;
@property (nonatomic, readonly) BOOL outputIsJpeg;
@property (nonatomic, readonly) BOOL outputIsPng;
@property (nonatomic, readonly) BOOL outputIsWebP;

- (instancetype)initWithSourceURI:(NSString *)sourceURI
                     outputFormat:(NSString *)outputFormat
                          quality:(NSInteger)quality
                      hasMaxBytes:(BOOL)hasMaxBytes
                         maxBytes:(NSUInteger)maxBytes
                   metadataPolicy:(NSString *)metadataPolicy
                    resizeOptions:(RCTImageCompressionKitResizeOptions)resizeOptions NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

typedef BOOL (^RCTImageCompressionKitWebPOutputAvailability)(void);

@interface RCTImageCompressionRequestParser : NSObject

+ (nullable RCTImageCompressionRequest *)parseOptions:(id _Nullable)options
                               webPOutputAvailability:(RCTImageCompressionKitWebPOutputAvailability)webPOutputAvailability
                                                 error:(RCTImageCompressionRequestError * _Nullable * _Nullable)error;

@end


NS_ASSUME_NONNULL_END
