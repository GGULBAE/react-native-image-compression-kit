#import "RCTImageCompressionOutput.h"

#import "RCTImageCompressionRequest.h"

NSString *const RCTImageCompressionKitOutputFailedCode = @"ERR_ENCODE_FAILED";

@implementation RCTImageCompressionOutputRequest

- (instancetype)initWithData:(NSData *)data
                 outputFormat:(NSString *)outputFormat
                   outputSize:(CGSize)outputSize
             originalByteSize:(NSUInteger)originalByteSize
{
  self = [super init];
  if (self != nil) {
    _data = [data copy];
    _outputFormat = [outputFormat copy];
    _outputSize = outputSize;
    _originalByteSize = originalByteSize;
  }
  return self;
}

@end

@implementation RCTImageCompressionOutputError

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

@implementation RCTImageCompressionOutputResult

- (instancetype)initWithURI:(NSString *)uri
                       format:(NSString *)format
                        width:(NSInteger)width
                       height:(NSInteger)height
                     byteSize:(double)byteSize
             originalByteSize:(double)originalByteSize
             compressionRatio:(double)compressionRatio
{
  self = [super init];
  if (self != nil) {
    _uri = [uri copy];
    _format = [format copy];
    _width = width;
    _height = height;
    _byteSize = byteSize;
    _originalByteSize = originalByteSize;
    _compressionRatio = compressionRatio;
  }
  return self;
}

- (NSDictionary *)dictionaryRepresentation
{
  return @{
    @"uri" : self.uri,
    @"format" : self.format,
    @"width" : @(self.width),
    @"height" : @(self.height),
    @"byteSize" : @(self.byteSize),
    @"originalByteSize" : @(self.originalByteSize),
    @"compressionRatio" : @(self.compressionRatio)
  };
}

@end

@interface RCTImageCompressionOutput ()

@property (nonatomic, copy, readonly) RCTImageCompressionOutputCacheDirectoryProvider cacheDirectoryProvider;
@property (nonatomic, copy, readonly) RCTImageCompressionOutputPathExists pathExists;
@property (nonatomic, copy, readonly) RCTImageCompressionOutputDirectoryCreator directoryCreator;
@property (nonatomic, copy, readonly) RCTImageCompressionOutputClock clock;
@property (nonatomic, copy, readonly) RCTImageCompressionOutputUUIDProvider uuidProvider;
@property (nonatomic, copy, readonly) RCTImageCompressionOutputFileWriter fileWriter;

@end

@implementation RCTImageCompressionOutput

- (instancetype)initWithCacheDirectoryProvider:(RCTImageCompressionOutputCacheDirectoryProvider)cacheDirectoryProvider
                                     pathExists:(RCTImageCompressionOutputPathExists)pathExists
                                directoryCreator:(RCTImageCompressionOutputDirectoryCreator)directoryCreator
                                           clock:(RCTImageCompressionOutputClock)clock
                                    uuidProvider:(RCTImageCompressionOutputUUIDProvider)uuidProvider
                                      fileWriter:(RCTImageCompressionOutputFileWriter)fileWriter
{
  self = [super init];
  if (self != nil) {
    _cacheDirectoryProvider = [cacheDirectoryProvider copy];
    _pathExists = [pathExists copy];
    _directoryCreator = [directoryCreator copy];
    _clock = [clock copy];
    _uuidProvider = [uuidProvider copy];
    _fileWriter = [fileWriter copy];
  }
  return self;
}

- (NSString *)extensionForOutputFormat:(NSString *)outputFormat
{
  if ([outputFormat isEqualToString:RCTImageCompressionKitPngFormat]) {
    return @"png";
  }
  if ([outputFormat isEqualToString:RCTImageCompressionKitWebPFormat]) {
    return @"webp";
  }
  return @"jpg";
}

- (nullable RCTImageCompressionOutputResult *)persistRequest:(RCTImageCompressionOutputRequest *)request
                                                       error:(RCTImageCompressionOutputError * _Nullable * _Nullable)error
{
  if (error != nil) {
    *error = nil;
  }

  NSString *cacheDirectory = self.cacheDirectoryProvider();
  if (cacheDirectory.length == 0) {
    cacheDirectory = NSTemporaryDirectory();
  }
  NSString *outputDirectory = [cacheDirectory stringByAppendingPathComponent:@"ImageCompressionKit"];
  if (!self.pathExists(outputDirectory)) {
    NSError *directoryError = nil;
    if (!self.directoryCreator(outputDirectory, &directoryError)) {
      if (error != nil) {
        *error = [[RCTImageCompressionOutputError alloc]
          initWithCode:RCTImageCompressionKitOutputFailedCode
          message:@"iOS MVP could not create an output cache file."
          underlyingError:directoryError
        ];
      }
      return nil;
    }
  }

  NSString *fileName = [NSString stringWithFormat:
    @"compressed-%lld-%@.%@",
    (long long)(self.clock() * 1000.0),
    self.uuidProvider(),
    [self extensionForOutputFormat:request.outputFormat]
  ];
  NSString *outputPath = [outputDirectory stringByAppendingPathComponent:fileName];
  NSError *writeError = nil;
  if (!self.fileWriter(request.data, outputPath, &writeError)) {
    if (error != nil) {
      *error = [[RCTImageCompressionOutputError alloc]
        initWithCode:RCTImageCompressionKitOutputFailedCode
        message:[NSString stringWithFormat:
          @"iOS MVP could not write %@ output.",
          request.outputFormat.uppercaseString
        ]
        underlyingError:writeError
      ];
    }
    return nil;
  }

  double byteSize = (double)request.data.length;
  double originalByteSize = (double)request.originalByteSize;
  double compressionRatio = originalByteSize > 0.0 ? byteSize / originalByteSize : 1.0;
  return [[RCTImageCompressionOutputResult alloc]
    initWithURI:[[NSURL fileURLWithPath:outputPath] absoluteString]
    format:request.outputFormat
    width:(NSInteger)request.outputSize.width
    height:(NSInteger)request.outputSize.height
    byteSize:byteSize
    originalByteSize:originalByteSize
    compressionRatio:compressionRatio
  ];
}

@end

@implementation RCTImageCompressionOutput (Default)

+ (instancetype)defaultOutput
{
  return [[RCTImageCompressionOutput alloc]
    initWithCacheDirectoryProvider:^NSString *{
      NSArray<NSString *> *cachePaths = NSSearchPathForDirectoriesInDomains(
        NSCachesDirectory,
        NSUserDomainMask,
        YES
      );
      return [cachePaths firstObject] ?: NSTemporaryDirectory();
    }
    pathExists:^BOOL(NSString *path) {
      return [[NSFileManager defaultManager] fileExistsAtPath:path];
    }
    directoryCreator:^BOOL(NSString *path, NSError **error) {
      return [[NSFileManager defaultManager]
        createDirectoryAtPath:path
        withIntermediateDirectories:YES
        attributes:nil
        error:error
      ];
    }
    clock:^NSTimeInterval{
      return [NSDate date].timeIntervalSince1970;
    }
    uuidProvider:^NSString *{
      return [NSUUID UUID].UUIDString;
    }
    fileWriter:^BOOL(NSData *data, NSString *path, NSError **error) {
      return [data writeToFile:path options:NSDataWritingAtomic error:error];
    }
  ];
}

@end
