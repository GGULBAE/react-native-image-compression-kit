#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface RCTImageCompressionJpegSegmentSanitizer : NSObject

+ (nullable NSData *)sanitizeJpegData:(NSData *)jpegData
                       stripRequested:(BOOL)stripRequested;

@end

NS_ASSUME_NONNULL_END
