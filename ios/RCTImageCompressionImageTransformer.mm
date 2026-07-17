#import "RCTImageCompressionImageTransformer.h"

#include <math.h>

NSString *const RCTImageCompressionKitImageTransformFailedCode = @"ERR_ENCODE_FAILED";

static CGFloat RCTImageCompressionDimension(CGFloat value)
{
  return MAX((CGFloat)1.0, round(value));
}

static CGSize RCTImageCompressionNormalizedSize(CGSize size)
{
  return CGSizeMake(
    RCTImageCompressionDimension(size.width),
    RCTImageCompressionDimension(size.height)
  );
}

static CGSize RCTImageCompressionContainSize(
  CGSize imageSize,
  RCTImageCompressionKitResizeOptions resize
) {
  CGFloat scale = 1.0;

  if (resize.hasMaxWidth) {
    scale = MIN(scale, (CGFloat)resize.maxWidth / imageSize.width);
  }
  if (resize.hasMaxHeight) {
    scale = MIN(scale, (CGFloat)resize.maxHeight / imageSize.height);
  }

  return RCTImageCompressionNormalizedSize(CGSizeMake(
    imageSize.width * scale,
    imageSize.height * scale
  ));
}

static CGSize RCTImageCompressionStretchSize(
  CGSize imageSize,
  RCTImageCompressionKitResizeOptions resize
) {
  CGFloat width = resize.hasMaxWidth
    ? MIN((CGFloat)resize.maxWidth, imageSize.width)
    : imageSize.width;
  CGFloat height = resize.hasMaxHeight
    ? MIN((CGFloat)resize.maxHeight, imageSize.height)
    : imageSize.height;
  return RCTImageCompressionNormalizedSize(CGSizeMake(width, height));
}

static CGSize RCTImageCompressionCoverSize(
  CGSize imageSize,
  RCTImageCompressionKitResizeOptions resize
) {
  if (!resize.hasMaxWidth || !resize.hasMaxHeight) {
    return RCTImageCompressionContainSize(imageSize, resize);
  }

  return RCTImageCompressionNormalizedSize(CGSizeMake(
    MIN((CGFloat)resize.maxWidth, imageSize.width),
    MIN((CGFloat)resize.maxHeight, imageSize.height)
  ));
}

@implementation RCTImageCompressionImageGeometry

- (instancetype)initWithSourceSize:(CGSize)sourceSize
                        targetSize:(CGSize)targetSize
                          drawRect:(CGRect)drawRect
{
  self = [super init];
  if (self != nil) {
    _sourceSize = sourceSize;
    _targetSize = targetSize;
    _drawRect = drawRect;
  }
  return self;
}

@end

RCTImageCompressionImageGeometry *RCTImageCompressionImageGeometryCalculate(
  CGSize sourceSize,
  RCTImageCompressionKitResizeOptions resize
) {
  CGSize imageSize = RCTImageCompressionNormalizedSize(sourceSize);
  CGSize targetSize = imageSize;
  CGRect drawRect = CGRectMake(0, 0, imageSize.width, imageSize.height);

  if (resize.enabled && resize.mode == RCTImageCompressionKitResizeModeStretch) {
    targetSize = RCTImageCompressionStretchSize(imageSize, resize);
    drawRect = CGRectMake(0, 0, targetSize.width, targetSize.height);
  } else if (resize.enabled && resize.mode == RCTImageCompressionKitResizeModeCover) {
    targetSize = RCTImageCompressionCoverSize(imageSize, resize);
    CGFloat scale = MIN(
      MAX(targetSize.width / imageSize.width, targetSize.height / imageSize.height),
      (CGFloat)1.0
    );
    CGSize drawSize = RCTImageCompressionNormalizedSize(CGSizeMake(
      imageSize.width * scale,
      imageSize.height * scale
    ));
    drawRect = CGRectMake(
      (targetSize.width - drawSize.width) / 2.0,
      (targetSize.height - drawSize.height) / 2.0,
      drawSize.width,
      drawSize.height
    );
  } else if (resize.enabled) {
    targetSize = RCTImageCompressionContainSize(imageSize, resize);
    drawRect = CGRectMake(0, 0, targetSize.width, targetSize.height);
  }

  return [[RCTImageCompressionImageGeometry alloc]
    initWithSourceSize:imageSize
    targetSize:targetSize
    drawRect:drawRect
  ];
}

@implementation RCTImageCompressionImageTransformRequest

- (instancetype)initWithImage:(UIImage *)image
                 resizeOptions:(RCTImageCompressionKitResizeOptions)resizeOptions
                        opaque:(BOOL)opaque
{
  self = [super init];
  if (self != nil) {
    _image = image;
    _resizeOptions = resizeOptions;
    _opaque = opaque;
  }
  return self;
}

@end

@implementation RCTImageCompressionImageTransformError

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

@implementation RCTImageCompressionTransformedImage

- (instancetype)initWithImage:(UIImage *)image
                      geometry:(RCTImageCompressionImageGeometry *)geometry
{
  self = [super init];
  if (self != nil) {
    _image = image;
    _geometry = geometry;
    _pixelSize = geometry.targetSize;
  }
  return self;
}

@end

@interface RCTImageCompressionImageTransformer ()

@property (nonatomic, copy, readonly) RCTImageCompressionImagePixelSizeProvider pixelSizeProvider;
@property (nonatomic, copy, readonly) RCTImageCompressionImageRenderer renderer;
@property (nonatomic, copy, readonly) RCTImageCompressionImageTransformExecutor imageWorkExecutor;

@end

@implementation RCTImageCompressionImageTransformer

- (instancetype)initWithPixelSizeProvider:(RCTImageCompressionImagePixelSizeProvider)pixelSizeProvider
                                  renderer:(RCTImageCompressionImageRenderer)renderer
                         imageWorkExecutor:(RCTImageCompressionImageTransformExecutor)imageWorkExecutor
{
  self = [super init];
  if (self != nil) {
    _pixelSizeProvider = [pixelSizeProvider copy];
    _renderer = [renderer copy];
    _imageWorkExecutor = [imageWorkExecutor copy];
  }
  return self;
}

- (nullable RCTImageCompressionTransformedImage *)transformRequest:(RCTImageCompressionImageTransformRequest *)request
                                                              error:(RCTImageCompressionImageTransformError * _Nullable * _Nullable)error
{
  if (error != nil) {
    *error = nil;
  }

  __block RCTImageCompressionImageGeometry *geometry = nil;
  __block UIImage *renderedImage = nil;
  self.imageWorkExecutor(^{
    geometry = RCTImageCompressionImageGeometryCalculate(
      self.pixelSizeProvider(request.image),
      request.resizeOptions
    );
    renderedImage = self.renderer(request.image, geometry, request.isOpaque);
  });

  if (renderedImage == nil || geometry == nil) {
    if (error != nil) {
      *error = [[RCTImageCompressionImageTransformError alloc]
        initWithCode:RCTImageCompressionKitImageTransformFailedCode
        message:@"iOS MVP could not render the source image."
        underlyingError:nil
      ];
    }
    return nil;
  }

  return [[RCTImageCompressionTransformedImage alloc]
    initWithImage:renderedImage
    geometry:geometry
  ];
}

@end
