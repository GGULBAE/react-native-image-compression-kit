#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

FOUNDATION_EXPORT NSString *const RCTImageCompressionKitUnsupportedSourceCode;
FOUNDATION_EXPORT NSString *const RCTImageCompressionKitUnsupportedFormatCode;
FOUNDATION_EXPORT NSString *const RCTImageCompressionKitFileAccessCode;
FOUNDATION_EXPORT NSString *const RCTImageCompressionKitDecodeFailedCode;

typedef NS_ENUM(NSInteger, RCTImageCompressionInputFormat) {
  RCTImageCompressionInputFormatJpeg,
  RCTImageCompressionInputFormatPng,
  RCTImageCompressionInputFormatGif,
  RCTImageCompressionInputFormatWebP,
  RCTImageCompressionInputFormatHeic,
  RCTImageCompressionInputFormatHeif,
  RCTImageCompressionInputFormatAvif
};

@interface RCTImageCompressionInputError : NSObject

@property (nonatomic, copy, readonly) NSString *code;
@property (nonatomic, copy, readonly) NSString *message;
@property (nonatomic, strong, readonly, nullable) NSError *underlyingError;

- (instancetype)initWithCode:(NSString *)code
                      message:(NSString *)message
              underlyingError:(nullable NSError *)underlyingError NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

@interface RCTImageCompressionSource : NSObject

@property (nonatomic, copy, readonly) NSURL *URL;
@property (nonatomic, copy, readonly) NSData *data;
@property (nonatomic, readonly) NSUInteger originalByteSize;

- (instancetype)initWithURL:(NSURL *)URL
                        data:(NSData *)data NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end


typedef NSData * _Nullable (^RCTImageCompressionSourceDataLoader)(
  NSURL *URL,
  NSError * _Nullable * _Nullable error
);
typedef BOOL (^RCTImageCompressionSecurityScopeStarter)(NSURL *URL);
typedef void (^RCTImageCompressionSecurityScopeStopper)(NSURL *URL);

@interface RCTImageCompressionSourceResolver : NSObject

+ (instancetype)defaultResolver;

- (instancetype)initWithDataLoader:(RCTImageCompressionSourceDataLoader)dataLoader
              securityScopeStarter:(RCTImageCompressionSecurityScopeStarter)securityScopeStarter
              securityScopeStopper:(RCTImageCompressionSecurityScopeStopper)securityScopeStopper NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

- (nullable RCTImageCompressionSource *)resolveSourceURI:(NSString *)sourceURI
                                                   error:(RCTImageCompressionInputError * _Nullable * _Nullable)error;

@end

@interface RCTImageCompressionInputInspection : NSObject

@property (nonatomic, strong, readonly) RCTImageCompressionSource *source;
@property (nonatomic, copy, readonly) NSString *imageType;
@property (nonatomic, readonly) RCTImageCompressionInputFormat format;
@property (nonatomic, readonly) BOOL jpeg;
@property (nonatomic, readonly) BOOL shouldDecodeFirstFrame;
@property (nonatomic, readonly) BOOL sourceLooksLikeAVIF;

- (instancetype)initWithSource:(RCTImageCompressionSource *)source
                      imageType:(NSString *)imageType
                         format:(RCTImageCompressionInputFormat)format
            sourceLooksLikeAVIF:(BOOL)sourceLooksLikeAVIF NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

typedef NSString * _Nullable (^RCTImageCompressionTypeIdentifierLoader)(NSData *data);
typedef BOOL (^RCTImageCompressionAVIFInputAvailability)(void);

FOUNDATION_EXPORT NSArray<NSString *> *RCTImageCompressionAVIFTypeIdentifiers(void);

@interface RCTImageCompressionInputInspector : NSObject

+ (instancetype)defaultInspector;

- (instancetype)initWithTypeIdentifierLoader:(RCTImageCompressionTypeIdentifierLoader)typeIdentifierLoader NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

- (nullable RCTImageCompressionInputInspection *)inspectSource:(RCTImageCompressionSource *)source
                                         avifInputAvailability:(RCTImageCompressionAVIFInputAvailability)avifInputAvailability
                                                         error:(RCTImageCompressionInputError * _Nullable * _Nullable)error;

@end

@interface RCTImageCompressionInputLoader : NSObject

+ (instancetype)defaultLoader;

- (instancetype)initWithSourceResolver:(RCTImageCompressionSourceResolver *)sourceResolver
                         inputInspector:(RCTImageCompressionInputInspector *)inputInspector NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

- (nullable RCTImageCompressionInputInspection *)loadSourceURI:(NSString *)sourceURI
                                          avifInputAvailability:(RCTImageCompressionAVIFInputAvailability)avifInputAvailability
                                                          error:(RCTImageCompressionInputError * _Nullable * _Nullable)error;

@end


NS_ASSUME_NONNULL_END
