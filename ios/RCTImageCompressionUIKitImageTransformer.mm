#import "RCTImageCompressionImageTransformer.h"

#import <UIKit/UIKit.h>

@implementation RCTImageCompressionImageTransformer (Default)

+ (instancetype)defaultTransformer
{
  return [[self alloc]
    initWithPixelSizeProvider:^CGSize(UIImage *image) {
      return CGSizeMake(
        image.size.width * image.scale,
        image.size.height * image.scale
      );
    }
    renderer:^UIImage *(
      UIImage *image,
      RCTImageCompressionImageGeometry *geometry,
      BOOL opaque
    ) {
      UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
      format.scale = 1.0;
      format.opaque = opaque;

      UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc]
        initWithSize:geometry.targetSize
        format:format
      ];
      return [renderer imageWithActions:^(UIGraphicsImageRendererContext *rendererContext) {
        (void)rendererContext;
        [(opaque ? [UIColor whiteColor] : [UIColor clearColor]) setFill];
        UIRectFill(CGRectMake(0, 0, geometry.targetSize.width, geometry.targetSize.height));
        [image drawInRect:geometry.drawRect];
      }];
    }
    imageWorkExecutor:^(RCTImageCompressionImageTransformOperation operation) {
      if ([NSThread isMainThread]) {
        operation();
      } else {
        dispatch_sync(dispatch_get_main_queue(), operation);
      }
    }
  ];
}

@end
