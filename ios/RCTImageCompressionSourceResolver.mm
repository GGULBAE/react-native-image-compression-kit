#import "RCTImageCompressionInput.h"

NSString *const RCTImageCompressionKitUnsupportedSourceCode = @"ERR_UNSUPPORTED_SOURCE";
NSString *const RCTImageCompressionKitUnsupportedFormatCode = @"ERR_UNSUPPORTED_FORMAT";
NSString *const RCTImageCompressionKitFileAccessCode = @"ERR_FILE_ACCESS";
NSString *const RCTImageCompressionKitDecodeFailedCode = @"ERR_DECODE_FAILED";

static void RCTImageCompressionInputSetError(
  RCTImageCompressionInputError * _Nullable * _Nullable error,
  NSString *code,
  NSString *message,
  NSError *underlyingError
) {
  if (error != nil) {
    *error = [[RCTImageCompressionInputError alloc]
      initWithCode:code
      message:message
      underlyingError:underlyingError
    ];
  }
}

@implementation RCTImageCompressionInputError

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

@implementation RCTImageCompressionSource

- (instancetype)initWithURL:(NSURL *)URL data:(NSData *)data
{
  self = [super init];
  if (self != nil) {
    _URL = [URL copy];
    _data = [data copy];
    _originalByteSize = _data.length;
  }
  return self;
}

@end

@interface RCTImageCompressionSourceResolver ()

@property (nonatomic, copy, readonly) RCTImageCompressionSourceDataLoader dataLoader;
@property (nonatomic, copy, readonly) RCTImageCompressionSecurityScopeStarter securityScopeStarter;
@property (nonatomic, copy, readonly) RCTImageCompressionSecurityScopeStopper securityScopeStopper;

@end

@implementation RCTImageCompressionSourceResolver

+ (instancetype)defaultResolver
{
  return [[self alloc]
    initWithDataLoader:^NSData *(NSURL *URL, NSError **error) {
      return [NSData
        dataWithContentsOfURL:URL
        options:NSDataReadingMappedIfSafe
        error:error
      ];
    }
    securityScopeStarter:^BOOL(NSURL *URL) {
      return [URL startAccessingSecurityScopedResource];
    }
    securityScopeStopper:^(NSURL *URL) {
      [URL stopAccessingSecurityScopedResource];
    }
  ];
}

- (instancetype)initWithDataLoader:(RCTImageCompressionSourceDataLoader)dataLoader
              securityScopeStarter:(RCTImageCompressionSecurityScopeStarter)securityScopeStarter
              securityScopeStopper:(RCTImageCompressionSecurityScopeStopper)securityScopeStopper
{
  self = [super init];
  if (self != nil) {
    _dataLoader = [dataLoader copy];
    _securityScopeStarter = [securityScopeStarter copy];
    _securityScopeStopper = [securityScopeStopper copy];
  }
  return self;
}

- (nullable RCTImageCompressionSource *)resolveSourceURI:(NSString *)sourceURI
                                                   error:(RCTImageCompressionInputError * _Nullable * _Nullable)error
{
  if (error != nil) {
    *error = nil;
  }

  NSURL *sourceURL = [NSURL URLWithString:sourceURI];
  NSString *scheme = sourceURL.scheme.lowercaseString;
  if (![scheme isEqualToString:@"file"] && ![scheme isEqualToString:@"content"]) {
    RCTImageCompressionInputSetError(
      error,
      RCTImageCompressionKitUnsupportedSourceCode,
      @"iOS MVP supports file:// and content:// image URIs only.",
      nil
    );
    return nil;
  }

  BOOL hasSecurityScope = self.securityScopeStarter(sourceURL);
  NSError *sourceError = nil;
  NSData *sourceData = nil;
  @try {
    sourceData = self.dataLoader(sourceURL, &sourceError);
  } @finally {
    if (hasSecurityScope) {
      self.securityScopeStopper(sourceURL);
    }
  }

  if (sourceData == nil || sourceData.length == 0) {
    RCTImageCompressionInputSetError(
      error,
      RCTImageCompressionKitFileAccessCode,
      @"iOS MVP could not read the source image URI.",
      sourceError
    );
    return nil;
  }

  return [[RCTImageCompressionSource alloc] initWithURL:sourceURL data:sourceData];
}

@end
