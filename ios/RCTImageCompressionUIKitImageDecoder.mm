#import "RCTImageCompressionImageDecoder.h"

#import <ImageIO/ImageIO.h>
#import <UIKit/UIKit.h>

static UIImage *RCTImageCompressionDecodeFirstFrame(NSData *sourceData)
{
  CGImageSourceRef imageSource = CGImageSourceCreateWithData(
    (__bridge CFDataRef)sourceData,
    nil
  );
  if (imageSource == nil) {
    return nil;
  }

  if (CGImageSourceGetCount(imageSource) == 0) {
    CFRelease(imageSource);
    return nil;
  }

  CGImageRef firstFrame = CGImageSourceCreateImageAtIndex(imageSource, 0, nil);
  CFRelease(imageSource);
  if (firstFrame == nil) {
    return nil;
  }

  UIImage *image = [UIImage
    imageWithCGImage:firstFrame
    scale:1.0
    orientation:UIImageOrientationUp
  ];
  CGImageRelease(firstFrame);
  return image;
}

@implementation RCTImageCompressionImageDecoder (Default)

+ (instancetype)defaultDecoder
{
  return [[self alloc]
    initWithOrdinaryImageDecoder:^UIImage *(NSData *data) {
      return [UIImage imageWithData:data];
    }
    firstFrameImageDecoder:^UIImage *(NSData *data) {
      return RCTImageCompressionDecodeFirstFrame(data);
    }
    decodedImageValidator:^BOOL(UIImage *image) {
      return image.size.width > 0 && image.size.height > 0;
    }
    imageWorkExecutor:^(RCTImageCompressionImageDecodeOperation operation) {
      if ([NSThread isMainThread]) {
        operation();
      } else {
        dispatch_sync(dispatch_get_main_queue(), operation);
      }
    }
  ];
}

@end
