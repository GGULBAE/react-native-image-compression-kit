#import "RCTImageCompressionKit.h"

#include <memory>

static NSString *const RCTImageCompressionKitModuleName = @"ImageCompressionKit";
static NSString *const RCTImageCompressionKitNotImplementedCode = @"ERR_NOT_IMPLEMENTED";

static NSArray<NSString *> *RCTImageCompressionKitFormats(void)
{
  return @[@"jpeg", @"png", @"webp", @"heic", @"heif", @"avif", @"gif"];
}

static NSArray<NSString *> *RCTImageCompressionKitMetadataPolicies(void)
{
  return @[@"preserve", @"safe", @"strip"];
}

static NSDictionary *RCTImageCompressionKitUnavailableFormatCapability(NSString *format)
{
  return @{
    @"format" : format,
    @"input" : @NO,
    @"output" : @NO,
    @"supportsAlpha" : @NO,
    @"supportsAnimation" : @NO,
    @"notes" : @[@"Native codec support has not been implemented yet."]
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
    @"Image compression is not implemented in the iOS native stub yet.",
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
    @"metadataPolicies" : RCTImageCompressionKitMetadataPolicies(),
    @"supportsTargetSizeCompression" : @NO,
    @"supportsCancellation" : @NO
  });
}

@end
