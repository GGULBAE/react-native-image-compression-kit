#import "RCTImageCompressionKit.h"

#include <memory>

static NSString *const RCTImageCompressionKitModuleName = @"ImageCompressionKit";
static NSString *const RCTImageCompressionKitNotImplementedCode = @"ERR_NOT_IMPLEMENTED";
static NSString *const RCTImageCompressionKitNotImplementedMessage =
  @"iOS compression is not implemented in react-native-image-compression-kit yet. The current iOS native package is a stub; use getImageCompressionCapabilities() to check support before calling compressImage().";

static NSArray<NSString *> *RCTImageCompressionKitFormats(void)
{
  return @[@"jpeg", @"png", @"webp", @"heic", @"heif", @"avif", @"gif"];
}

static NSDictionary *RCTImageCompressionKitUnavailableFormatCapability(NSString *format)
{
  return @{
    @"format" : format,
    @"input" : @NO,
    @"output" : @NO,
    @"supportsAlpha" : @NO,
    @"supportsAnimation" : @NO,
    @"notes" : @[
      @"iOS compression is not implemented in this package stub yet.",
      @"No iOS input or output formats are available in v0.1.x."
    ]
  };
}

@implementation RCTImageCompressionKit

+ (NSString *)moduleName
{
  return RCTImageCompressionKitModuleName;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeImageCompressionKitSpecJSI>(params);
}

- (void)compressImage:(NSDictionary *)options
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  reject(
    RCTImageCompressionKitNotImplementedCode,
    RCTImageCompressionKitNotImplementedMessage,
    nil
  );
}

- (void)getImageCompressionCapabilities:(RCTPromiseResolveBlock)resolve
                                 reject:(RCTPromiseRejectBlock)reject
{
  NSMutableArray<NSDictionary *> *formats = [NSMutableArray array];

  for (NSString *format in RCTImageCompressionKitFormats()) {
    [formats addObject:RCTImageCompressionKitUnavailableFormatCapability(format)];
  }

  resolve(@{
    @"platform" : @"ios",
    @"formats" : formats,
    @"metadataPolicies" : @[],
    @"supportsTargetSizeCompression" : @NO,
    @"supportsCancellation" : @NO
  });
}

@end
