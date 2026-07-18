#import <Foundation/Foundation.h>

#if __has_include(<RNImageCompressionKitSpec/RNImageCompressionKitSpec.h>)
#import <RNImageCompressionKitSpec/RNImageCompressionKitSpec.h>
#define RNICK_HAS_CODEGEN_SPEC 1
#else
#import <React/RCTBridgeModule.h>
#define RNICK_HAS_CODEGEN_SPEC 0
#endif

NS_ASSUME_NONNULL_BEGIN

#if RNICK_HAS_CODEGEN_SPEC
@interface RCTImageCompressionKit : NSObject <NativeImageCompressionKitSpec>
#else
@interface RCTImageCompressionKit : NSObject <RCTBridgeModule>
#endif

@end

NS_ASSUME_NONNULL_END
