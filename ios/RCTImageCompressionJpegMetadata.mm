#import "RCTImageCompressionJpegMetadata.h"

#import "RCTImageCompressionRequest.h"

#import <ImageIO/ImageIO.h>

static NSString *const RCTImageCompressionJpegMetadataUnsupportedMessage =
  @"iOS metadata preserve is supported only for JPEG input to JPEG output. Use safe or strip metadata for other iOS format conversions.";

@implementation RCTImageCompressionJpegMetadataRequest

- (instancetype)initWithMetadataPolicy:(NSString *)metadataPolicy
                              jpegInput:(BOOL)jpegInput
                             jpegOutput:(BOOL)jpegOutput
                             sourceData:(NSData *)sourceData
{
  self = [super init];
  if (self != nil) {
    _metadataPolicy = [metadataPolicy copy];
    _jpegInput = jpegInput;
    _jpegOutput = jpegOutput;
    _sourceData = [sourceData copy];
  }
  return self;
}

@end

@implementation RCTImageCompressionJpegMetadataError

- (instancetype)initWithCode:(NSString *)code message:(NSString *)message
{
  self = [super init];
  if (self != nil) {
    _code = [code copy];
    _message = [message copy];
  }
  return self;
}

@end

@implementation RCTImageCompressionJpegMetadataResult

- (instancetype)initWithPreservingSourceMetadata:(BOOL)preservingSourceMetadata
                                 sourceProperties:(NSDictionary *)sourceProperties
{
  self = [super init];
  if (self != nil) {
    _preservingSourceMetadata = preservingSourceMetadata;
    _sourceProperties = [sourceProperties copy];
  }
  return self;
}

- (NSDictionary *)destinationPropertiesForQuality:(NSInteger)quality
                                        pixelWidth:(NSUInteger)pixelWidth
                                       pixelHeight:(NSUInteger)pixelHeight
{
  NSMutableDictionary *properties = self.sourceProperties != nil
    ? [self.sourceProperties mutableCopy]
    : [NSMutableDictionary dictionary];

  properties[(__bridge NSString *)kCGImageDestinationLossyCompressionQuality] = @((CGFloat)quality / 100.0);
  if (!self.preservingSourceMetadata || self.sourceProperties == nil) {
    return properties;
  }

  properties[(__bridge NSString *)kCGImagePropertyPixelWidth] = @(pixelWidth);
  properties[(__bridge NSString *)kCGImagePropertyPixelHeight] = @(pixelHeight);
  properties[(__bridge NSString *)kCGImagePropertyOrientation] = @1;

  NSDictionary *tiffProperties = properties[(__bridge NSString *)kCGImagePropertyTIFFDictionary];
  if ([tiffProperties isKindOfClass:[NSDictionary class]]) {
    NSMutableDictionary *normalizedTiffProperties = [tiffProperties mutableCopy];
    normalizedTiffProperties[(__bridge NSString *)kCGImagePropertyTIFFOrientation] = @1;
    properties[(__bridge NSString *)kCGImagePropertyTIFFDictionary] = normalizedTiffProperties;
  }

  NSDictionary *exifProperties = properties[(__bridge NSString *)kCGImagePropertyExifDictionary];
  if ([exifProperties isKindOfClass:[NSDictionary class]]) {
    NSMutableDictionary *normalizedExifProperties = [exifProperties mutableCopy];
    normalizedExifProperties[(__bridge NSString *)kCGImagePropertyExifPixelXDimension] = @(pixelWidth);
    normalizedExifProperties[(__bridge NSString *)kCGImagePropertyExifPixelYDimension] = @(pixelHeight);
    properties[(__bridge NSString *)kCGImagePropertyExifDictionary] = normalizedExifProperties;
  }

  return properties;
}

@end

@interface RCTImageCompressionJpegMetadata ()

@property (nonatomic, copy, readonly) RCTImageCompressionJpegSourcePropertyReader sourcePropertyReader;

@end

@implementation RCTImageCompressionJpegMetadata

- (instancetype)initWithSourcePropertyReader:(RCTImageCompressionJpegSourcePropertyReader)sourcePropertyReader
{
  self = [super init];
  if (self != nil) {
    _sourcePropertyReader = [sourcePropertyReader copy];
  }
  return self;
}

- (nullable RCTImageCompressionJpegMetadataResult *)prepareRequest:(RCTImageCompressionJpegMetadataRequest *)request
                                                              error:(RCTImageCompressionJpegMetadataError * _Nullable * _Nullable)error
{
  if (error != nil) {
    *error = nil;
  }

  BOOL preserveRequested = [request.metadataPolicy isEqualToString:RCTImageCompressionKitPreserveMetadataPolicy];
  if (preserveRequested && (!request.jpegInput || !request.jpegOutput)) {
    if (error != nil) {
      *error = [[RCTImageCompressionJpegMetadataError alloc]
        initWithCode:RCTImageCompressionKitNotImplementedCode
        message:RCTImageCompressionJpegMetadataUnsupportedMessage
      ];
    }
    return nil;
  }

  NSDictionary *sourceProperties = preserveRequested
    ? self.sourcePropertyReader(request.sourceData)
    : nil;
  return [[RCTImageCompressionJpegMetadataResult alloc]
    initWithPreservingSourceMetadata:preserveRequested
    sourceProperties:sourceProperties
  ];
}

@end

@implementation RCTImageCompressionJpegMetadata (Default)

+ (instancetype)defaultMetadata
{
  return [[self alloc]
    initWithSourcePropertyReader:^NSDictionary *(NSData *sourceData) {
      CGImageSourceRef imageSource = CGImageSourceCreateWithData(
        (__bridge CFDataRef)sourceData,
        nil
      );
      if (imageSource == nil) {
        return nil;
      }

      NSDictionary *properties = nil;
      if (CGImageSourceGetCount(imageSource) > 0) {
        properties = CFBridgingRelease(
          CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil)
        );
      }
      CFRelease(imageSource);
      return properties;
    }
  ];
}

@end
