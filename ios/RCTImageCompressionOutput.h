#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

FOUNDATION_EXPORT NSString *const RCTImageCompressionKitOutputFailedCode;

@interface RCTImageCompressionOutputRequest : NSObject

@property (nonatomic, copy, readonly) NSData *data;
@property (nonatomic, copy, readonly) NSString *outputFormat;
@property (nonatomic, readonly) CGSize outputSize;
@property (nonatomic, readonly) NSUInteger originalByteSize;

- (instancetype)initWithData:(NSData *)data
                 outputFormat:(NSString *)outputFormat
                   outputSize:(CGSize)outputSize
             originalByteSize:(NSUInteger)originalByteSize NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

@interface RCTImageCompressionOutputError : NSObject

@property (nonatomic, copy, readonly) NSString *code;
@property (nonatomic, copy, readonly) NSString *message;
@property (nonatomic, strong, readonly, nullable) NSError *underlyingError;

- (instancetype)initWithCode:(NSString *)code
                      message:(NSString *)message
              underlyingError:(nullable NSError *)underlyingError NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

@interface RCTImageCompressionOutputResult : NSObject

@property (nonatomic, copy, readonly) NSString *uri;
@property (nonatomic, copy, readonly) NSString *format;
@property (nonatomic, readonly) NSInteger width;
@property (nonatomic, readonly) NSInteger height;
@property (nonatomic, readonly) double byteSize;
@property (nonatomic, readonly) double originalByteSize;
@property (nonatomic, readonly) double compressionRatio;

- (instancetype)initWithURI:(NSString *)uri
                       format:(NSString *)format
                        width:(NSInteger)width
                       height:(NSInteger)height
                     byteSize:(double)byteSize
             originalByteSize:(double)originalByteSize
             compressionRatio:(double)compressionRatio NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

- (NSDictionary *)dictionaryRepresentation;

@end


typedef NSString * _Nullable (^RCTImageCompressionOutputCacheDirectoryProvider)(void);
typedef BOOL (^RCTImageCompressionOutputPathExists)(NSString *path);
typedef BOOL (^RCTImageCompressionOutputDirectoryCreator)(
  NSString *path,
  NSError * _Nullable * _Nullable error
);
typedef NSTimeInterval (^RCTImageCompressionOutputClock)(void);
typedef NSString * _Nonnull (^RCTImageCompressionOutputUUIDProvider)(void);
typedef BOOL (^RCTImageCompressionOutputFileWriter)(
  NSData *data,
  NSString *path,
  NSError * _Nullable * _Nullable error
);

@interface RCTImageCompressionOutput : NSObject

- (instancetype)initWithCacheDirectoryProvider:(RCTImageCompressionOutputCacheDirectoryProvider)cacheDirectoryProvider
                                     pathExists:(RCTImageCompressionOutputPathExists)pathExists
                                directoryCreator:(RCTImageCompressionOutputDirectoryCreator)directoryCreator
                                           clock:(RCTImageCompressionOutputClock)clock
                                    uuidProvider:(RCTImageCompressionOutputUUIDProvider)uuidProvider
                                      fileWriter:(RCTImageCompressionOutputFileWriter)fileWriter NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

- (nullable RCTImageCompressionOutputResult *)persistRequest:(RCTImageCompressionOutputRequest *)request
                                                       error:(RCTImageCompressionOutputError * _Nullable * _Nullable)error;

@end

@interface RCTImageCompressionOutput (Default)

+ (instancetype)defaultOutput;

@end


NS_ASSUME_NONNULL_END
