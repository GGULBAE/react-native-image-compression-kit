#import "RCTImageCompressionImageEncoder.h"

#import <ImageIO/ImageIO.h>
#import <UIKit/UIKit.h>

static NSString *RCTImageCompressionWebPOutputTypeIdentifier(void)
{
  NSArray<NSString *> *supportedTypes = CFBridgingRelease(
    CGImageDestinationCopyTypeIdentifiers()
  );
  NSArray<NSString *> *webPTypes = @[
    @"org.webmproject.webp",
    @"public.webp",
  ];

  for (NSString *webPType in webPTypes) {
    if ([supportedTypes containsObject:webPType]) {
      return webPType;
    }
  }
  return nil;
}

static NSData *RCTImageCompressionEncodeJpeg(
  UIImage *image,
  NSInteger quality,
  RCTImageCompressionJpegMetadataResult *metadata
) {
  CGImageRef cgImage = image.CGImage;
  if (cgImage == nil) {
    return nil;
  }

  NSMutableData *outputData = [NSMutableData data];
  CGImageDestinationRef destination = CGImageDestinationCreateWithData(
    (__bridge CFMutableDataRef)outputData,
    (__bridge CFStringRef)@"public.jpeg",
    1,
    nil
  );
  if (destination == nil) {
    return nil;
  }

  NSDictionary *destinationProperties = [metadata
    destinationPropertiesForQuality:quality
    pixelWidth:CGImageGetWidth(cgImage)
    pixelHeight:CGImageGetHeight(cgImage)
  ];
  CGImageDestinationAddImage(
    destination,
    cgImage,
    (__bridge CFDictionaryRef)destinationProperties
  );
  BOOL finalized = CGImageDestinationFinalize(destination);
  CFRelease(destination);
  return finalized && outputData.length > 0 ? outputData : nil;
}

static NSData *RCTImageCompressionEncodeWebP(UIImage *image, NSInteger quality)
{
  NSString *typeIdentifier = RCTImageCompressionWebPOutputTypeIdentifier();
  CGImageRef cgImage = image.CGImage;
  if (typeIdentifier == nil || cgImage == nil) {
    return nil;
  }

  NSMutableData *outputData = [NSMutableData data];
  CGImageDestinationRef destination = CGImageDestinationCreateWithData(
    (__bridge CFMutableDataRef)outputData,
    (__bridge CFStringRef)typeIdentifier,
    1,
    nil
  );
  if (destination == nil) {
    return nil;
  }

  NSDictionary *properties = @{
    (__bridge NSString *)kCGImageDestinationLossyCompressionQuality :
      @((CGFloat)quality / 100.0),
  };
  CGImageDestinationAddImage(
    destination,
    cgImage,
    (__bridge CFDictionaryRef)properties
  );
  BOOL finalized = CGImageDestinationFinalize(destination);
  CFRelease(destination);
  return finalized && outputData.length > 0 ? outputData : nil;
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
      return UIImagePNGRepresentation(image);
    }
    webPEncoder:^NSData *(UIImage *image, NSInteger quality) {
      return RCTImageCompressionEncodeWebP(image, quality);
    }
    imageWorkExecutor:^(RCTImageCompressionImageEncodeOperation operation) {
      if ([NSThread isMainThread]) {
        operation();
      } else {
        dispatch_sync(dispatch_get_main_queue(), operation);
      }
    }
  ];
}

+ (BOOL)defaultWebPOutputAvailable
{
  return RCTImageCompressionWebPOutputTypeIdentifier() != nil;
}

@end
