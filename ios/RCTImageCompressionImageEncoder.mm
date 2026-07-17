#import "RCTImageCompressionImageEncoder.h"

#import "RCTImageCompressionRequest.h"

NSString *const RCTImageCompressionKitImageEncodeFailedCode = @"ERR_ENCODE_FAILED";

@implementation RCTImageCompressionImageEncodeRequest

- (instancetype)initWithImage:(UIImage *)image
                  outputFormat:(NSString *)outputFormat
                       quality:(NSInteger)quality
                   hasMaxBytes:(BOOL)hasMaxBytes
                      maxBytes:(NSUInteger)maxBytes
                  jpegMetadata:(RCTImageCompressionJpegMetadataResult *)jpegMetadata
{
  self = [super init];
  if (self != nil) {
    _image = image;
    _outputFormat = [outputFormat copy];
    _quality = quality;
    _hasMaxBytes = hasMaxBytes;
    _maxBytes = maxBytes;
    _jpegMetadata = jpegMetadata;
  }
  return self;
}

@end

@implementation RCTImageCompressionImageEncodeError

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

@implementation RCTImageCompressionEncodedImage

- (instancetype)initWithData:(NSData *)data
{
  self = [super init];
  if (self != nil) {
    _data = [data copy];
  }
  return self;
}

@end

@interface RCTImageCompressionImageEncoder ()

@property (nonatomic, copy, readonly) RCTImageCompressionJpegImageEncoder jpegEncoder;
@property (nonatomic, copy, readonly) RCTImageCompressionPngImageEncoder pngEncoder;
@property (nonatomic, copy, readonly) RCTImageCompressionWebPImageEncoder webPEncoder;
@property (nonatomic, copy, readonly) RCTImageCompressionImageEncodeExecutor imageWorkExecutor;

@end

@implementation RCTImageCompressionImageEncoder

- (instancetype)initWithJpegEncoder:(RCTImageCompressionJpegImageEncoder)jpegEncoder
                          pngEncoder:(RCTImageCompressionPngImageEncoder)pngEncoder
                         webPEncoder:(RCTImageCompressionWebPImageEncoder)webPEncoder
                   imageWorkExecutor:(RCTImageCompressionImageEncodeExecutor)imageWorkExecutor
{
  self = [super init];
  if (self != nil) {
    _jpegEncoder = [jpegEncoder copy];
    _pngEncoder = [pngEncoder copy];
    _webPEncoder = [webPEncoder copy];
    _imageWorkExecutor = [imageWorkExecutor copy];
  }
  return self;
}

- (NSData *)encodeQualityRequest:(RCTImageCompressionImageEncodeRequest *)request
                         quality:(NSInteger)quality
{
  if ([request.outputFormat isEqualToString:RCTImageCompressionKitWebPFormat]) {
    return self.webPEncoder(request.image, quality);
  }
  return self.jpegEncoder(request.image, quality, request.jpegMetadata);
}

- (NSData *)encodeRequestToTargetSize:(RCTImageCompressionImageEncodeRequest *)request
{
  NSData *outputData = [self encodeQualityRequest:request quality:request.quality];
  if (outputData == nil || outputData.length == 0 || outputData.length <= request.maxBytes) {
    return outputData;
  }

  NSData *lowestAboveTargetData = outputData;
  NSUInteger lowestAboveTargetSize = outputData.length;
  NSData *bestWithinTargetData = nil;
  NSInteger low = RCTImageCompressionKitMinQuality;
  NSInteger high = request.quality - 1;

  while (low <= high) {
    NSInteger currentQuality = (low + high) / 2;
    NSData *candidateData = [self encodeQualityRequest:request quality:currentQuality];
    if (candidateData == nil || candidateData.length == 0) {
      return candidateData;
    }

    NSUInteger byteSize = candidateData.length;
    if (byteSize <= request.maxBytes) {
      bestWithinTargetData = candidateData;
      low = currentQuality + 1;
    } else {
      if (byteSize < lowestAboveTargetSize) {
        lowestAboveTargetData = candidateData;
        lowestAboveTargetSize = byteSize;
      }
      high = currentQuality - 1;
    }
  }

  return bestWithinTargetData ?: lowestAboveTargetData;
}

- (nullable RCTImageCompressionEncodedImage *)encodeRequest:(RCTImageCompressionImageEncodeRequest *)request
                                                       error:(RCTImageCompressionImageEncodeError * _Nullable * _Nullable)error
{
  if (error != nil) {
    *error = nil;
  }

  __block NSData *outputData = nil;
  self.imageWorkExecutor(^{
    if ([request.outputFormat isEqualToString:RCTImageCompressionKitPngFormat]) {
      outputData = self.pngEncoder(request.image);
    } else if (request.hasMaxBytes) {
      outputData = [self encodeRequestToTargetSize:request];
    } else {
      outputData = [self encodeQualityRequest:request quality:request.quality];
    }
  });

  if (outputData == nil || outputData.length == 0) {
    if (error != nil) {
      *error = [[RCTImageCompressionImageEncodeError alloc]
        initWithCode:RCTImageCompressionKitImageEncodeFailedCode
        message:[NSString stringWithFormat:
          @"iOS MVP could not encode %@ output.",
          request.outputFormat.uppercaseString
        ]
      ];
    }
    return nil;
  }

  return [[RCTImageCompressionEncodedImage alloc] initWithData:outputData];
}

@end
