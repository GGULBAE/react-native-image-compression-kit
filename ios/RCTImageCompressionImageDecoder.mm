#import "RCTImageCompressionImageDecoder.h"

#import "RCTImageCompressionInput.h"

@implementation RCTImageCompressionImageDecodeError

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

@implementation RCTImageCompressionDecodedImage

- (instancetype)initWithImage:(UIImage *)image decodedFirstFrame:(BOOL)decodedFirstFrame
{
  self = [super init];
  if (self != nil) {
    _image = image;
    _decodedFirstFrame = decodedFirstFrame;
  }
  return self;
}

@end

@interface RCTImageCompressionImageDecoder ()

@property (nonatomic, copy, readonly) RCTImageCompressionOrdinaryImageDecoder ordinaryImageDecoder;
@property (nonatomic, copy, readonly) RCTImageCompressionFirstFrameImageDecoder firstFrameImageDecoder;
@property (nonatomic, copy, readonly) RCTImageCompressionDecodedImageValidator decodedImageValidator;
@property (nonatomic, copy, readonly) RCTImageCompressionImageDecodeExecutor imageWorkExecutor;

@end

@implementation RCTImageCompressionImageDecoder

- (instancetype)initWithOrdinaryImageDecoder:(RCTImageCompressionOrdinaryImageDecoder)ordinaryImageDecoder
                       firstFrameImageDecoder:(RCTImageCompressionFirstFrameImageDecoder)firstFrameImageDecoder
                        decodedImageValidator:(RCTImageCompressionDecodedImageValidator)decodedImageValidator
                            imageWorkExecutor:(RCTImageCompressionImageDecodeExecutor)imageWorkExecutor
{
  self = [super init];
  if (self != nil) {
    _ordinaryImageDecoder = [ordinaryImageDecoder copy];
    _firstFrameImageDecoder = [firstFrameImageDecoder copy];
    _decodedImageValidator = [decodedImageValidator copy];
    _imageWorkExecutor = [imageWorkExecutor copy];
  }
  return self;
}

- (nullable RCTImageCompressionDecodedImage *)decodeInput:(RCTImageCompressionInputInspection *)input
                                                     error:(RCTImageCompressionImageDecodeError * _Nullable * _Nullable)error
{
  if (error != nil) {
    *error = nil;
  }

  BOOL decodedFirstFrame = input.shouldDecodeFirstFrame;
  __block UIImage *decodedImage = nil;
  __block BOOL decodedImageValid = NO;
  self.imageWorkExecutor(^{
    decodedImage = decodedFirstFrame
      ? self.firstFrameImageDecoder(input.source.data)
      : self.ordinaryImageDecoder(input.source.data);
    decodedImageValid = decodedImage != nil && self.decodedImageValidator(decodedImage);
  });

  if (!decodedImageValid) {
    if (error != nil) {
      *error = [[RCTImageCompressionImageDecodeError alloc]
        initWithCode:RCTImageCompressionKitDecodeFailedCode
        message:@"iOS MVP could not decode the source image."
        underlyingError:nil
      ];
    }
    return nil;
  }

  return [[RCTImageCompressionDecodedImage alloc]
    initWithImage:decodedImage
    decodedFirstFrame:decodedFirstFrame
  ];
}

@end
