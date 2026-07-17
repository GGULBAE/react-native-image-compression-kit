#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface RCTImageCompressionJpegMetadataRequest : NSObject

@property (nonatomic, copy, readonly) NSString *metadataPolicy;
@property (nonatomic, readonly) BOOL jpegInput;
@property (nonatomic, readonly) BOOL jpegOutput;
@property (nonatomic, copy, readonly) NSData *sourceData;

- (instancetype)initWithMetadataPolicy:(NSString *)metadataPolicy
                              jpegInput:(BOOL)jpegInput
                             jpegOutput:(BOOL)jpegOutput
                             sourceData:(NSData *)sourceData NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

@interface RCTImageCompressionJpegMetadataError : NSObject

@property (nonatomic, copy, readonly) NSString *code;
@property (nonatomic, copy, readonly) NSString *message;

- (instancetype)initWithCode:(NSString *)code
                      message:(NSString *)message NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

@interface RCTImageCompressionJpegMetadataResult : NSObject

@property (nonatomic, readonly) BOOL preservingSourceMetadata;
@property (nonatomic, copy, readonly, nullable) NSDictionary *sourceProperties;

- (instancetype)initWithPreservingSourceMetadata:(BOOL)preservingSourceMetadata
                                 sourceProperties:(nullable NSDictionary *)sourceProperties NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

- (NSDictionary *)destinationPropertiesForQuality:(NSInteger)quality
                                        pixelWidth:(NSUInteger)pixelWidth
                                       pixelHeight:(NSUInteger)pixelHeight;

@end

typedef NSDictionary * _Nullable (^RCTImageCompressionJpegSourcePropertyReader)(NSData *sourceData);

@interface RCTImageCompressionJpegMetadata : NSObject

- (instancetype)initWithSourcePropertyReader:(RCTImageCompressionJpegSourcePropertyReader)sourcePropertyReader NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

- (nullable RCTImageCompressionJpegMetadataResult *)prepareRequest:(RCTImageCompressionJpegMetadataRequest *)request
                                                              error:(RCTImageCompressionJpegMetadataError * _Nullable * _Nullable)error;

@end

@interface RCTImageCompressionJpegMetadata (Default)

+ (instancetype)defaultMetadata;

@end

NS_ASSUME_NONNULL_END
