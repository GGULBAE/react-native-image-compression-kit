#import "RCTImageCompressionImageEncoder.h"

#import "RCTImageCompressionCGImage.h"

#import <ImageIO/ImageIO.h>

static NSString *RCTImageCompressionWebPOutputTypeIdentifier(void)
{
  NSArray<NSString *> *supportedTypes = CFBridgingRelease(
    CGImageDestinationCopyTypeIdentifiers()
  );
  for (NSString *webPType in @[@"org.webmproject.webp", @"public.webp"]) {
    if ([supportedTypes containsObject:webPType]) return webPType;
  }
  return nil;
}

static CGImageRef RCTImageCompressionEncoderCGImage(UIImage *image)
{
  if (![(id)image isKindOfClass:[RCTImageCompressionCGImage class]]) return nil;
  return ((RCTImageCompressionCGImage *)(id)image).image;
}

static NSData *RCTImageCompressionEncodeImage(
  UIImage *image,
  NSString *typeIdentifier,
  NSDictionary *properties
) {
  CGImageRef cgImage = RCTImageCompressionEncoderCGImage(image);
  if (cgImage == nil || typeIdentifier.length == 0) return nil;

  NSMutableData *outputData = [NSMutableData data];
  CGImageDestinationRef destination = CGImageDestinationCreateWithData(
    (__bridge CFMutableDataRef)outputData,
    (__bridge CFStringRef)typeIdentifier,
    1,
    nil
  );
  if (destination == nil) return nil;
  CGImageDestinationAddImage(
    destination,
    cgImage,
    (__bridge CFDictionaryRef)properties
  );
  BOOL finalized = CGImageDestinationFinalize(destination);
  CFRelease(destination);
  return finalized && outputData.length > 0 ? outputData : nil;
}

static NSData *RCTImageCompressionEncodeJpeg(
  UIImage *image,
  NSInteger quality,
  RCTImageCompressionJpegMetadataResult *metadata
) {
  CGImageRef cgImage = RCTImageCompressionEncoderCGImage(image);
  if (cgImage == nil) return nil;
  NSDictionary *properties = [metadata
    destinationPropertiesForQuality:quality
    pixelWidth:CGImageGetWidth(cgImage)
    pixelHeight:CGImageGetHeight(cgImage)
  ];
  return RCTImageCompressionEncodeImage(image, @"public.jpeg", properties);
}

static NSData *RCTImageCompressionEncodeWebP(UIImage *image, NSInteger quality)
{
  return RCTImageCompressionEncodeImage(
    image,
    RCTImageCompressionWebPOutputTypeIdentifier(),
    @{
      (__bridge NSString *)kCGImageDestinationLossyCompressionQuality :
        @((CGFloat)quality / 100.0),
    }
  );
}

@implementation RCTImageCompressionImageEncoder (Default)

+ (instancetype)defaultEncoder
{
  return [[self alloc]
    initWithJpegEncoder:^NSData *(
      UIImage *image,
      NSInteger quality,
      RCTImageCompressionJpegMetadataResult *metadata
    ) {
      return RCTImageCompressionEncodeJpeg(image, quality, metadata);
    }
    pngEncoder:^NSData *(UIImage *image) {
      return RCTImageCompressionEncodeImage(image, @"public.png", @{});
    }
    webPEncoder:^NSData *(UIImage *image, NSInteger quality) {
      return RCTImageCompressionEncodeWebP(image, quality);
    }
    imageWorkExecutor:^(RCTImageCompressionImageEncodeOperation operation) {
      operation();
    }
  ];
}

+ (BOOL)defaultWebPOutputAvailable
{
  return RCTImageCompressionWebPOutputTypeIdentifier() != nil;
}

@end
