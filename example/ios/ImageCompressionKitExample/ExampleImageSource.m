#import <React/RCTBridgeModule.h>
#import <ImageIO/ImageIO.h>
#import <UIKit/UIKit.h>

@interface ExampleImageSource : NSObject <RCTBridgeModule>
@end

static NSString *const ExampleImageSourceJpegSoftwareMetadata = @"RNICK iOS metadata preserve fixture";

static UIImage *ExampleImageSourceImage(void);
static NSData *ExampleImageSourceJpegData(void);
static NSData *ExampleImageSourcePngData(void);
static NSData *ExampleImageSourceUnsupportedData(NSString *format);
static NSDictionary *ExampleImageSourceReadJpegMetadataSummary(NSData *data);
static NSString *ExampleImageSourceReadJpegSoftwareMetadata(NSData *data);
static NSNumber *ExampleImageSourceNumberValue(NSDictionary *properties, NSString *key);

@implementation ExampleImageSource

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(isSmokeTestEnabled:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  (void)reject;
  NSProcessInfo *processInfo = [NSProcessInfo processInfo];
  NSString *enabled = processInfo.environment[@"RNICK_IOS_SMOKE"];
  NSString *simctlEnabled = processInfo.environment[@"SIMCTL_CHILD_RNICK_IOS_SMOKE"];
  BOOL hasSmokeArgument = [processInfo.arguments containsObject:@"--rnick-ios-smoke"];

  resolve(@([enabled isEqualToString:@"1"] || [simctlEnabled isEqualToString:@"1"] || hasSmokeArgument));
}

RCT_EXPORT_METHOD(logSmokeEvent:(NSString *)message
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  (void)reject;
  NSLog(@"%@", message);
  resolve(nil);
}

RCT_EXPORT_METHOD(copySampleJpegToCache:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self writeSampleWithFormat:@"jpg"
                         data:ExampleImageSourceJpegData()
                      resolve:resolve
                       reject:reject];
}

RCT_EXPORT_METHOD(copySamplePngToCache:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self writeSampleWithFormat:@"png"
                         data:ExampleImageSourcePngData()
                      resolve:resolve
                       reject:reject];
}

RCT_EXPORT_METHOD(copySampleHeicToCache:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self writeSampleWithFormat:@"heic"
                         data:ExampleImageSourceUnsupportedData(@"heic")
                      resolve:resolve
                       reject:reject];
}

RCT_EXPORT_METHOD(copySampleHeifToCache:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self writeSampleWithFormat:@"heif"
                         data:ExampleImageSourceUnsupportedData(@"heif")
                      resolve:resolve
                       reject:reject];
}

RCT_EXPORT_METHOD(copySampleAvifToCache:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self writeSampleWithFormat:@"avif"
                         data:ExampleImageSourceUnsupportedData(@"avif")
                      resolve:resolve
                       reject:reject];
}

RCT_EXPORT_METHOD(copyUnsupportedImageToCache:(NSString *)format
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSData *data = ExampleImageSourceUnsupportedData(format);
  [self writeSampleWithFormat:format data:data resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(readJpegSoftwareMetadata:(NSString *)uri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *url = [NSURL URLWithString:uri];
  if (url == nil) {
    reject(
      @"ERR_SAMPLE_METADATA_READ_FAILED",
      @"The iOS example could not read the JPEG metadata URI.",
      nil
    );
    return;
  }

  NSError *error = nil;
  NSData *data = [NSData dataWithContentsOfURL:url options:NSDataReadingMappedIfSafe error:&error];
  if (data == nil || data.length == 0) {
    reject(
      @"ERR_SAMPLE_METADATA_READ_FAILED",
      @"The iOS example could not read the JPEG metadata file.",
      error
    );
    return;
  }

  resolve(ExampleImageSourceReadJpegSoftwareMetadata(data) ?: [NSNull null]);
}

RCT_EXPORT_METHOD(readJpegMetadataSummary:(NSString *)uri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *url = [NSURL URLWithString:uri];
  if (url == nil) {
    reject(
      @"ERR_SAMPLE_METADATA_READ_FAILED",
      @"The iOS example could not read the JPEG metadata URI.",
      nil
    );
    return;
  }

  NSError *error = nil;
  NSData *data = [NSData dataWithContentsOfURL:url options:NSDataReadingMappedIfSafe error:&error];
  if (data == nil || data.length == 0) {
    reject(
      @"ERR_SAMPLE_METADATA_READ_FAILED",
      @"The iOS example could not read the JPEG metadata file.",
      error
    );
    return;
  }

  resolve(ExampleImageSourceReadJpegMetadataSummary(data));
}

- (void)writeSampleWithFormat:(NSString *)format
                         data:(NSData *)data
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  if (data == nil || data.length == 0) {
    reject(
      @"ERR_SAMPLE_GENERATION_FAILED",
      @"The iOS example could not generate the sample image.",
      nil
    );
    return;
  }

  NSString *fileName = [NSString stringWithFormat:@"rnick-sample.%@", format];
  NSString *path = [NSTemporaryDirectory() stringByAppendingPathComponent:fileName];
  NSError *error = nil;

  if (![data writeToFile:path options:NSDataWritingAtomic error:&error]) {
    reject(
      @"ERR_SAMPLE_WRITE_FAILED",
      @"The iOS example could not write the sample image to cache.",
      error
    );
    return;
  }

  resolve([[NSURL fileURLWithPath:path] absoluteString]);
}

static UIImage *ExampleImageSourceImage(void)
{
  CGSize size = CGSizeMake(32, 20);
  UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
  format.scale = 1.0;
  format.opaque = NO;
  UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:size format:format];

  return [renderer imageWithActions:^(UIGraphicsImageRendererContext *context) {
    (void)context;
    [[UIColor colorWithRed:0.09 green:0.36 blue:0.78 alpha:1.0] setFill];
    UIRectFill(CGRectMake(0, 0, size.width, size.height));

    [[UIColor colorWithRed:0.97 green:0.62 blue:0.13 alpha:1.0] setFill];
    UIRectFill(CGRectMake(4, 4, 12, 12));

    [[UIColor colorWithRed:0.16 green:0.72 blue:0.44 alpha:0.65] setFill];
    UIRectFill(CGRectMake(14, 6, 14, 10));
  }];
}

static NSData *ExampleImageSourceJpegData(void)
{
  CGImageRef image = ExampleImageSourceImage().CGImage;
  if (image == nil) {
    return nil;
  }

  NSMutableData *data = [NSMutableData data];
  CGImageDestinationRef destination = CGImageDestinationCreateWithData(
    (__bridge CFMutableDataRef)data,
    (__bridge CFStringRef)@"public.jpeg",
    1,
    nil
  );
  if (destination == nil) {
    return nil;
  }

  NSDictionary *properties = @{
    (__bridge NSString *)kCGImageDestinationLossyCompressionQuality : @0.82,
    (__bridge NSString *)kCGImagePropertyPixelWidth : @320,
    (__bridge NSString *)kCGImagePropertyPixelHeight : @200,
    (__bridge NSString *)kCGImagePropertyOrientation : @6,
    (__bridge NSString *)kCGImagePropertyExifDictionary : @{
      (__bridge NSString *)kCGImagePropertyExifPixelXDimension : @320,
      (__bridge NSString *)kCGImagePropertyExifPixelYDimension : @200
    },
    (__bridge NSString *)kCGImagePropertyTIFFDictionary : @{
      (__bridge NSString *)kCGImagePropertyTIFFOrientation : @6,
      (__bridge NSString *)kCGImagePropertyTIFFSoftware : ExampleImageSourceJpegSoftwareMetadata
    }
  };
  CGImageDestinationAddImage(destination, image, (__bridge CFDictionaryRef)properties);
  BOOL finalized = CGImageDestinationFinalize(destination);
  CFRelease(destination);

  return finalized && data.length > 0 ? data : nil;
}

static NSDictionary *ExampleImageSourceReadJpegMetadataSummary(NSData *data)
{
  CGImageSourceRef source = CGImageSourceCreateWithData((__bridge CFDataRef)data, nil);
  if (source == nil || CGImageSourceGetCount(source) == 0) {
    if (source != nil) {
      CFRelease(source);
    }
    return @{};
  }

  NSDictionary *properties = CFBridgingRelease(CGImageSourceCopyPropertiesAtIndex(source, 0, nil));
  CFRelease(source);

  NSDictionary *tiffProperties = properties[(__bridge NSString *)kCGImagePropertyTIFFDictionary];
  NSDictionary *exifProperties = properties[(__bridge NSString *)kCGImagePropertyExifDictionary];
  NSString *software = nil;
  if ([tiffProperties isKindOfClass:[NSDictionary class]]) {
    NSString *candidateSoftware = tiffProperties[(__bridge NSString *)kCGImagePropertyTIFFSoftware];
    software = [candidateSoftware isKindOfClass:[NSString class]] ? candidateSoftware : nil;
  }

  NSNumber *pixelWidth = ExampleImageSourceNumberValue(properties, (__bridge NSString *)kCGImagePropertyPixelWidth);
  NSNumber *pixelHeight = ExampleImageSourceNumberValue(properties, (__bridge NSString *)kCGImagePropertyPixelHeight);
  NSNumber *orientation = ExampleImageSourceNumberValue(properties, (__bridge NSString *)kCGImagePropertyOrientation);
  NSNumber *tiffOrientation = [tiffProperties isKindOfClass:[NSDictionary class]]
    ? ExampleImageSourceNumberValue(tiffProperties, (__bridge NSString *)kCGImagePropertyTIFFOrientation)
    : nil;
  NSNumber *exifPixelXDimension = [exifProperties isKindOfClass:[NSDictionary class]]
    ? ExampleImageSourceNumberValue(exifProperties, (__bridge NSString *)kCGImagePropertyExifPixelXDimension)
    : nil;
  NSNumber *exifPixelYDimension = [exifProperties isKindOfClass:[NSDictionary class]]
    ? ExampleImageSourceNumberValue(exifProperties, (__bridge NSString *)kCGImagePropertyExifPixelYDimension)
    : nil;

  return @{
    @"software" : software ?: [NSNull null],
    @"pixelWidth" : pixelWidth ?: [NSNull null],
    @"pixelHeight" : pixelHeight ?: [NSNull null],
    @"orientation" : orientation ?: [NSNull null],
    @"tiffOrientation" : tiffOrientation ?: [NSNull null],
    @"exifPixelXDimension" : exifPixelXDimension ?: [NSNull null],
    @"exifPixelYDimension" : exifPixelYDimension ?: [NSNull null]
  };
}

static NSString *ExampleImageSourceReadJpegSoftwareMetadata(NSData *data)
{
  CGImageSourceRef source = CGImageSourceCreateWithData((__bridge CFDataRef)data, nil);
  if (source == nil || CGImageSourceGetCount(source) == 0) {
    if (source != nil) {
      CFRelease(source);
    }
    return nil;
  }

  NSDictionary *properties = CFBridgingRelease(CGImageSourceCopyPropertiesAtIndex(source, 0, nil));
  CFRelease(source);

  NSDictionary *tiffProperties = properties[(__bridge NSString *)kCGImagePropertyTIFFDictionary];
  if (![tiffProperties isKindOfClass:[NSDictionary class]]) {
    return nil;
  }

  NSString *software = tiffProperties[(__bridge NSString *)kCGImagePropertyTIFFSoftware];
  return [software isKindOfClass:[NSString class]] ? software : nil;
}

static NSNumber *ExampleImageSourceNumberValue(NSDictionary *properties, NSString *key)
{
  id value = properties[key];
  return [value isKindOfClass:[NSNumber class]] ? value : nil;
}

static NSData *ExampleImageSourcePngData(void)
{
  UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
  format.scale = 1.0;
  format.opaque = NO;
  UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:CGSizeMake(32, 20) format:format];

  return [renderer PNGDataWithActions:^(UIGraphicsImageRendererContext *context) {
    (void)context;
    [[UIColor clearColor] setFill];
    UIRectFill(CGRectMake(0, 0, 32, 20));

    [[UIColor colorWithRed:0.36 green:0.20 blue:0.76 alpha:0.85] setFill];
    UIRectFill(CGRectMake(0, 0, 18, 20));

    [[UIColor colorWithRed:0.98 green:0.78 blue:0.20 alpha:0.70] setFill];
    UIRectFill(CGRectMake(10, 4, 20, 12));
  }];
}

static NSData *ExampleImageSourceUnsupportedData(NSString *format)
{
  NSDictionary<NSString *, NSString *> *fixtures = @{
    @"gif" : @"R0lGODdhKAAUAJEAAAAAADNmmf///wAAACH5BAQAAAAALAAAAAAoABQAAAIajI+py+0Po5y02ouz3rz7D4biSJbmiabqihUAOw==",
    @"webp" : @"UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
    @"heic" : @"AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAXptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAABngABAAAAAAAAAW4AAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABodmMxAAAAAA5waXRtAAAAAAABAAAA+mlwcnAAAADaaXBjbwAAAHVodmNDAQNwAAAAAAAAAAAAHvAA/P34+AAADwNgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQGEAAQApQgEBA3AAAAMAkAAAAwAAAwAeoCCBBZbqrprm4CGgwIAAAAyAAAADAIRiAAEABkQBwXPBiQAAABNjb2xybmNseAABAA0ABoAAAAAUaXNwZQAAAAAAAABAAAAAQAAAAChjbGFwAAAAEAAAAAEAAAAMAAAAAf///9AAAAAC////zAAAAAIAAAAOcGl4aQAAAAABCAAAABhpcG1hAAAAAAAAAAEAAQWBAgMFhAAAAXZtZGF0AAABaigBrwTyCZCFg3ApmkckCHWZ/3mepR0TJrbxfTFRlB1kZsXFxbKtWgP4P00MrtdUr5nPASXLwRsn6lCkn7baE5OB1yOvx0CZna4AjByr/RVFfZpycWEiS+80Yf4IUyaUzBD/sH5gS1GvWAArMlUV7Q0aLsStM2jrJF12dLpPZ6Qwslvt5gfG2QlaKDLfAgnMW+ym6MT7nrMP5eeBq2g58HCK5nASSQO5rVesPUGZm9vFsJ/sZF/0AxvuqiI5+IyFiUxUeB3CLL/MDf33JdKL3TgW3NGrocmsF/gSXa02Yl+QkzB3gML3bIa0+51gbE88VQWDNZVINw/WnPVLkcaeQzGZy1vHAI/FYTyQJQdMlvN3znRziCp1YdiNd5DOqeTfEbIT756p/Ynnauuz/WCrRHBZfPd1A2f8pLwIDYGFEs61+QfQt1PI5m33KAExDMmq4bALb/RWSrgcWHRDXUXnKIrtygOfYEyP3Bu/",
    @"heif" : @"AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAXptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAABngABAAAAAAAAAW4AAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABodmMxAAAAAA5waXRtAAAAAAABAAAA+mlwcnAAAADaaXBjbwAAAHVodmNDAQNwAAAAAAAAAAAAHvAA/P34+AAADwNgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQGEAAQApQgEBA3AAAAMAkAAAAwAAAwAeoCCBBZbqrprm4CGgwIAAAAyAAAADAIRiAAEABkQBwXPBiQAAABNjb2xybmNseAABAA0ABoAAAAAUaXNwZQAAAAAAAABAAAAAQAAAAChjbGFwAAAAEAAAAAEAAAAMAAAAAf///9AAAAAC////zAAAAAIAAAAOcGl4aQAAAAABCAAAABhpcG1hAAAAAAAAAAEAAQWBAgMFhAAAAXZtZGF0AAABaigBrwTyCZCFg3ApmkckCHWZ/3mepR0TJrbxfTFRlB1kZsXFxbKtWgP4P00MrtdUr5nPASXLwRsn6lCkn7baE5OB1yOvx0CZna4AjByr/RVFfZpycWEiS+80Yf4IUyaUzBD/sH5gS1GvWAArMlUV7Q0aLsStM2jrJF12dLpPZ6Qwslvt5gfG2QlaKDLfAgnMW+ym6MT7nrMP5eeBq2g58HCK5nASSQO5rVesPUGZm9vFsJ/sZF/0AxvuqiI5+IyFiUxUeB3CLL/MDf33JdKL3TgW3NGrocmsF/gSXa02Yl+QkzB3gML3bIa0+51gbE88VQWDNZVINw/WnPVLkcaeQzGZy1vHAI/FYTyQJQdMlvN3znRziCp1YdiNd5DOqeTfEbIT756p/Ynnauuz/WCrRHBZfPd1A2f8pLwIDYGFEs61+QfQt1PI5m33KAExDMmq4bALb/RWSrgcWHRDXUXnKIrtygOfYEyP3Bu/",
    @"avif" : @"AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAAOhtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAABDAABAAAAAAAAAOIAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAAAA5waXRtAAAAAAABAAAAaGlwcnAAAABJaXBjbwAAAAxhdjFDgQAMAAAAABNjb2xybmNseAABAA0ABoAAAAAUaXNwZQAAAAAAAAAQAAAADAAAAA5waXhpAAAAAAEIAAAAF2lwbWEAAAAAAAAAAQABBIECAwQAAADqbWRhdBIACgkYDP7aICGg0IAy0gETx4eGZQGGGH4VAAAIxJ00osKTn+ZjIVsXIEqnIoIVcokNhH2nBF43NQJmyRGcGop9NEq8nUr6KMcp6HeKgbkp+/i9bKP/KiLsCUwD8L6V47vELP4kr2cuHZBvbYH7WCMXP06uP/nbT0Cx0eBimqK7RpkL/Q4+Aw+We9CXufQyygjWB8+hteFdOzN9Sk/yAowqpyVSDyWTs2s56y0ZzjAkL248Nk0up4lAl1sqPAqyApN98lBYCxjasglfRvWkU7kxLUZJ24wlZen3s029IDc/FoA="
  };
  NSString *base64 = fixtures[format];

  if (base64 == nil) {
    return nil;
  }

  return [[NSData alloc] initWithBase64EncodedString:base64 options:0];
}

@end
