#import "RCTImageCompressionImageDecoder.h"

#import "RCTImageCompressionCGImage.h"
#import "RCTImageCompressionImageTransformer.h"
#import "RCTImageCompressionInput.h"
#import "RCTImageCompressionResources.h"

#import <ImageIO/ImageIO.h>

#include <math.h>

static void RCTImageCompressionSetDecodeError(
  RCTImageCompressionImageDecodeError **error,
  NSString *code,
  NSString *message
) {
  if (error != nil) {
    *error = [[RCTImageCompressionImageDecodeError alloc]
      initWithCode:code
      message:message
      underlyingError:nil
    ];
  }
}

static BOOL RCTImageCompressionOrientationSwapsAxes(NSInteger orientation)
{
  return orientation >= 5 && orientation <= 8;
}

static RCTImageCompressionDecodedImage *RCTImageCompressionDecodeDownsampled(
  RCTImageCompressionInputInspection *input,
  RCTImageCompressionKitResizeOptions resizeOptions,
  RCTImageCompressionImageDecodeError **error
) {
  CGImageSourceRef imageSource = CGImageSourceCreateWithData(
    (__bridge CFDataRef)input.source.data,
    nil
  );
  if (imageSource == nil || CGImageSourceGetCount(imageSource) == 0) {
    if (imageSource != nil) CFRelease(imageSource);
    RCTImageCompressionSetDecodeError(
      error,
      RCTImageCompressionKitDecodeFailedCode,
      @"iOS could not decode the source image."
    );
    return nil;
  }

  NSDictionary *properties = CFBridgingRelease(
    CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil)
  );
  NSUInteger rawWidth = [properties[(__bridge NSString *)kCGImagePropertyPixelWidth] unsignedIntegerValue];
  NSUInteger rawHeight = [properties[(__bridge NSString *)kCGImagePropertyPixelHeight] unsignedIntegerValue];
  NSInteger orientation = [properties[(__bridge NSString *)kCGImagePropertyOrientation] integerValue];
  if (orientation == 0) orientation = 1;

  unsigned long long sourcePixels = (unsigned long long)rawWidth * (unsigned long long)rawHeight;
  if (
    rawWidth == 0 || rawHeight == 0 ||
    rawWidth > RCTImageCompressionKitMaxSourceDimension ||
    rawHeight > RCTImageCompressionKitMaxSourceDimension ||
    sourcePixels > RCTImageCompressionKitMaxSourcePixels
  ) {
    CFRelease(imageSource);
    RCTImageCompressionSetDecodeError(
      error,
      RCTImageCompressionKitResourceLimitCode,
      @"Source image dimensions or pixels exceed the configured resource limit."
    );
    return nil;
  }

  BOOL swapsAxes = RCTImageCompressionOrientationSwapsAxes(orientation);
  CGSize sourceSize = CGSizeMake(
    swapsAxes ? rawHeight : rawWidth,
    swapsAxes ? rawWidth : rawHeight
  );
  RCTImageCompressionImageGeometry *geometry = RCTImageCompressionImageGeometryCalculate(
    sourceSize,
    resizeOptions
  );
  CGFloat requiredScale = MIN(
    (CGFloat)1.0,
    MAX(
      geometry.targetSize.width / sourceSize.width,
      geometry.targetSize.height / sourceSize.height
    )
  );
  CGSize decodeSize = CGSizeMake(
    ceil(sourceSize.width * requiredScale),
    ceil(sourceSize.height * requiredScale)
  );
  unsigned long long workingPixels =
    (unsigned long long)decodeSize.width * (unsigned long long)decodeSize.height;
  if (workingPixels > RCTImageCompressionKitMaxWorkingPixels) {
    CFRelease(imageSource);
    RCTImageCompressionSetDecodeError(
      error,
      RCTImageCompressionKitResourceLimitCode,
      @"Requested image work exceeds the configured pixel limit. Provide smaller resize dimensions."
    );
    return nil;
  }

  NSUInteger thumbnailMaxPixelSize = (NSUInteger)ceil(MAX(decodeSize.width, decodeSize.height));
  NSDictionary *thumbnailOptions = @{
    (__bridge NSString *)kCGImageSourceCreateThumbnailFromImageAlways : @YES,
    (__bridge NSString *)kCGImageSourceCreateThumbnailWithTransform : @YES,
    (__bridge NSString *)kCGImageSourceShouldCacheImmediately : @YES,
    (__bridge NSString *)kCGImageSourceThumbnailMaxPixelSize : @(MAX((NSUInteger)1, thumbnailMaxPixelSize)),
  };
  CGImageRef decoded = CGImageSourceCreateThumbnailAtIndex(
    imageSource,
    0,
    (__bridge CFDictionaryRef)thumbnailOptions
  );
  CFRelease(imageSource);
  if (decoded == nil) {
    RCTImageCompressionSetDecodeError(
      error,
      RCTImageCompressionKitDecodeFailedCode,
      @"iOS could not decode the source image."
    );
    return nil;
  }

  RCTImageCompressionCGImage *image = [[RCTImageCompressionCGImage alloc]
    initWithImage:decoded
    sourcePixelSize:sourceSize
  ];
  CGImageRelease(decoded);
  return [[RCTImageCompressionDecodedImage alloc]
    initWithImage:(UIImage *)image
    decodedFirstFrame:input.shouldDecodeFirstFrame
  ];
}

@implementation RCTImageCompressionImageDecoder (Default)

+ (instancetype)defaultDecoder
{
  return [[self alloc]
    initWithDownsampledImageDecoder:^RCTImageCompressionDecodedImage *(
      RCTImageCompressionInputInspection *input,
      RCTImageCompressionKitResizeOptions resizeOptions,
      RCTImageCompressionImageDecodeError **error
    ) {
      return RCTImageCompressionDecodeDownsampled(input, resizeOptions, error);
    }
    imageWorkExecutor:^(RCTImageCompressionImageDecodeOperation operation) {
      operation();
    }
  ];
}

@end
