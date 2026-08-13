#import "RCTImageCompressionOutput.h"

#import "RCTImageCompressionRequest.h"

#include <errno.h>
#include <sys/stat.h>
#include <unistd.h>

NSString *const RCTImageCompressionKitOutputFailedCode = @"ERR_ENCODE_FAILED";
NSString *const RCTImageCompressionKitOutputFileAccessCode = @"ERR_FILE_ACCESS";

static NSString *const RCTImageCompressionOutputOwnershipMessage =
  @"Output URI must reference a file created by react-native-image-compression-kit.";
static NSString *const RCTImageCompressionOutputRemovalMessage =
  @"iOS could not remove the compression output cache file.";

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
@property (nonatomic, copy, readonly) RCTImageCompressionOutputPathIsRegularFile pathIsRegularFile;
@property (nonatomic, copy, readonly) RCTImageCompressionOutputFileRemover fileRemover;

@end

@implementation RCTImageCompressionOutput

- (instancetype)initWithCacheDirectoryProvider:(RCTImageCompressionOutputCacheDirectoryProvider)cacheDirectoryProvider
                                     pathExists:(RCTImageCompressionOutputPathExists)pathExists
                                directoryCreator:(RCTImageCompressionOutputDirectoryCreator)directoryCreator
                                           clock:(RCTImageCompressionOutputClock)clock
                                    uuidProvider:(RCTImageCompressionOutputUUIDProvider)uuidProvider
                                      fileWriter:(RCTImageCompressionOutputFileWriter)fileWriter
                               pathIsRegularFile:(RCTImageCompressionOutputPathIsRegularFile)pathIsRegularFile
                                     fileRemover:(RCTImageCompressionOutputFileRemover)fileRemover
{
  self = [super init];
  if (self != nil) {
    _cacheDirectoryProvider = [cacheDirectoryProvider copy];
    _pathExists = [pathExists copy];
    _directoryCreator = [directoryCreator copy];
    _clock = [clock copy];
    _uuidProvider = [uuidProvider copy];
    _fileWriter = [fileWriter copy];
    _pathIsRegularFile = [pathIsRegularFile copy];
    _fileRemover = [fileRemover copy];
  }
  return self;
}

- (NSString *)outputDirectory
{
  NSString *cacheDirectory = self.cacheDirectoryProvider();
  if (cacheDirectory.length == 0) {
    cacheDirectory = NSTemporaryDirectory();
  }
  return [cacheDirectory stringByAppendingPathComponent:@"ImageCompressionKit"];
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

  NSString *outputDirectory = [self outputDirectory];
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

- (BOOL)removeOutputURI:(NSString *)uri
                  error:(RCTImageCompressionOutputError * _Nullable * _Nullable)error
{
  if (error != nil) *error = nil;
  NSURL *URL = uri.length > 0 ? [NSURL URLWithString:uri] : nil;
  NSString *path = URL.path;
  NSArray<NSString *> *pathComponents = path.pathComponents;
  NSString *outputDirectory = self.outputDirectory.stringByStandardizingPath;
  NSString *requestedPath = path.stringByStandardizingPath;
  NSString *resolvedDirectory = outputDirectory.stringByResolvingSymlinksInPath;
  NSString *resolvedOutputParent =
    outputDirectory.stringByDeletingLastPathComponent.stringByResolvingSymlinksInPath;
  NSString *expectedResolvedDirectory =
    [resolvedOutputParent stringByAppendingPathComponent:outputDirectory.lastPathComponent];
  NSString *resolvedPath = requestedPath.stringByResolvingSymlinksInPath;
  NSString *fileName = requestedPath.lastPathComponent;
  NSRegularExpression *fileNamePattern = [NSRegularExpression
    regularExpressionWithPattern:@"^compressed-[0-9]+-[A-Za-z0-9-]+\\.(jpg|png|webp)$"
    options:0
    error:nil
  ];
  BOOL valid = URL.isFileURL && URL.host.length == 0 && URL.query.length == 0 &&
    URL.fragment.length == 0 && path.length > 0 &&
    ![pathComponents containsObject:@"."] && ![pathComponents containsObject:@".."] &&
    [resolvedDirectory isEqualToString:expectedResolvedDirectory] &&
    [requestedPath.stringByDeletingLastPathComponent isEqualToString:outputDirectory] &&
    [resolvedPath.stringByDeletingLastPathComponent isEqualToString:resolvedDirectory] &&
    [resolvedPath.lastPathComponent isEqualToString:fileName] &&
    [fileNamePattern
      numberOfMatchesInString:fileName
      options:0
      range:NSMakeRange(0, fileName.length)
    ] == 1;
  if (!valid || (self.pathExists(requestedPath) && !self.pathIsRegularFile(requestedPath))) {
    if (error != nil) {
      *error = [[RCTImageCompressionOutputError alloc]
        initWithCode:RCTImageCompressionKitInvalidOptionsCode
        message:RCTImageCompressionOutputOwnershipMessage
        underlyingError:nil
      ];
    }
    return NO;
  }
  if (!self.pathExists(requestedPath)) return YES;

  NSError *removalError = nil;
  if (self.fileRemover(requestedPath, &removalError) || !self.pathExists(requestedPath)) {
    return YES;
  }
  if (error != nil) {
    *error = [[RCTImageCompressionOutputError alloc]
      initWithCode:RCTImageCompressionKitOutputFileAccessCode
      message:RCTImageCompressionOutputRemovalMessage
      underlyingError:removalError
    ];
  }
  return NO;
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
    pathIsRegularFile:^BOOL(NSString *path) {
      struct stat fileStatus;
      return lstat(path.fileSystemRepresentation, &fileStatus) == 0 &&
        S_ISREG(fileStatus.st_mode);
    }
    fileRemover:^BOOL(NSString *path, NSError **error) {
      if (unlink(path.fileSystemRepresentation) == 0) return YES;
      if (error != nil) {
        *error = [NSError errorWithDomain:NSPOSIXErrorDomain code:errno userInfo:nil];
      }
      return NO;
    }
  ];
}

@end
