#import "RCTImageCompressionImageTransformer.h"

#import "RCTImageCompressionCGImage.h"

#import <CoreGraphics/CoreGraphics.h>

static RCTImageCompressionCGImage *RCTImageCompressionCoreGraphicsImage(UIImage *image)
{
  return [(id)image isKindOfClass:[RCTImageCompressionCGImage class]]
    ? (RCTImageCompressionCGImage *)(id)image
    : nil;
}

static UIImage *RCTImageCompressionRenderCoreGraphicsImage(
  UIImage *image,
  RCTImageCompressionImageGeometry *geometry,
  BOOL opaque
) {
  RCTImageCompressionCGImage *source = RCTImageCompressionCoreGraphicsImage(image);
  size_t width = (size_t)geometry.targetSize.width;
  size_t height = (size_t)geometry.targetSize.height;
  if (source == nil || width == 0 || height == 0) return nil;

  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(
    nil,
    width,
    height,
    8,
    width * 4,
    colorSpace,
    kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big
  );
  CGColorSpaceRelease(colorSpace);
  if (context == nil) return nil;

  if (opaque) {
    CGContextSetRGBFillColor(context, 1.0, 1.0, 1.0, 1.0);
    CGContextFillRect(context, CGRectMake(0, 0, width, height));
  } else {
    CGContextClearRect(context, CGRectMake(0, 0, width, height));
  }
  CGContextSetInterpolationQuality(context, kCGInterpolationHigh);
  CGContextTranslateCTM(context, 0, (CGFloat)height);
  CGContextScaleCTM(context, 1.0, -1.0);
  CGContextDrawImage(context, geometry.drawRect, source.image);

  CGImageRef rendered = CGBitmapContextCreateImage(context);
  CGContextRelease(context);
  if (rendered == nil) return nil;

  RCTImageCompressionCGImage *result = [[RCTImageCompressionCGImage alloc]
    initWithImage:rendered
    sourcePixelSize:geometry.targetSize
  ];
  CGImageRelease(rendered);
  return (UIImage *)result;
}

@implementation RCTImageCompressionImageTransformer (Default)

+ (instancetype)defaultTransformer
{
  return [[self alloc]
    initWithPixelSizeProvider:^CGSize(UIImage *image) {
      RCTImageCompressionCGImage *source = RCTImageCompressionCoreGraphicsImage(image);
      return source != nil ? source.sourcePixelSize : CGSizeZero;
    }
    renderer:^UIImage *(
      UIImage *image,
      RCTImageCompressionImageGeometry *geometry,
      BOOL opaque
    ) {
      return RCTImageCompressionRenderCoreGraphicsImage(image, geometry, opaque);
    }
    imageWorkExecutor:^(RCTImageCompressionImageTransformOperation operation) {
      operation();
    }
  ];
}

@end
