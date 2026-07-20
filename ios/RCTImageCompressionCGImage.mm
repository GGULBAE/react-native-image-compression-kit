#import "RCTImageCompressionCGImage.h"

@implementation RCTImageCompressionCGImage {
  CGImageRef _image;
}

- (instancetype)initWithImage:(CGImageRef)image sourcePixelSize:(CGSize)sourcePixelSize
{
  self = [super init];
  if (self != nil) {
    _image = CGImageRetain(image);
    _sourcePixelSize = sourcePixelSize;
  }
  return self;
}

- (void)dealloc
{
  if (_image != nil) {
    CGImageRelease(_image);
  }
}

@end
