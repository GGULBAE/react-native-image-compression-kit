#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>

NS_ASSUME_NONNULL_BEGIN

@interface RCTImageCompressionCGImage : NSObject

@property (nonatomic, readonly) CGImageRef image;
@property (nonatomic, readonly) CGSize sourcePixelSize;

- (instancetype)initWithImage:(CGImageRef)image
               sourcePixelSize:(CGSize)sourcePixelSize NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END
