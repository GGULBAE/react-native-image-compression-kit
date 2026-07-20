#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

#define RCTImageCompressionKitCancelledCode @"ERR_CANCELLED"
#define RCTImageCompressionKitResourceLimitCode @"ERR_RESOURCE_LIMIT"

static const NSUInteger RCTImageCompressionKitMaxSourceDimension = 32768;
static const unsigned long long RCTImageCompressionKitMaxSourcePixels = 100000000ULL;
static const unsigned long long RCTImageCompressionKitMaxWorkingPixels = 25000000ULL;
static const NSInteger RCTImageCompressionKitMaxConcurrentOperations = 2;

typedef BOOL (^RCTImageCompressionCancellationCheck)(void);

NS_ASSUME_NONNULL_END
