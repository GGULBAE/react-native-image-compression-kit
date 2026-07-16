#import "RCTImageCompressionIOSCapabilities.h"

#import "RCTImageCompressionRequest.h"

static NSArray<NSString *> *RCTImageCompressionFormats(void)
{
  return @[
    RCTImageCompressionKitJpegFormat,
    RCTImageCompressionKitPngFormat,
    RCTImageCompressionKitWebPFormat,
    RCTImageCompressionKitHeicFormat,
    RCTImageCompressionKitHeifFormat,
    RCTImageCompressionKitAvifFormat,
    RCTImageCompressionKitGifFormat
  ];
}

static NSDictionary *RCTImageCompressionFormatCapability(
  NSString *format,
  BOOL input,
  BOOL output,
  BOOL supportsAlpha,
  BOOL supportsAnimation,
  NSArray<NSString *> *notes
) {
  return @{
    @"format" : format,
    @"input" : @(input),
    @"output" : @(output),
    @"supportsAlpha" : @(supportsAlpha),
    @"supportsAnimation" : @(supportsAnimation),
    @"notes" : notes
  };
}

static NSDictionary *RCTImageCompressionIOSFormatCapability(
  NSString *format,
  BOOL webPOutputAvailable,
  BOOL avifInputAvailable
) {
  if ([format isEqualToString:RCTImageCompressionKitJpegFormat]) {
    return RCTImageCompressionFormatCapability(
      format,
      YES,
      YES,
      NO,
      NO,
      @[
        @"iOS MVP supports JPEG input and JPEG output through UIKit/ImageIO.",
        @"JPEG output supports quality-based compression and optional resize.",
        @"Target-size compression supports maxBytes by adjusting JPEG quality.",
        @"Metadata preserve copies source JPEG metadata and normalizes output orientation/dimensions for JPEG input to JPEG output.",
        @"Metadata safe and strip re-encode without copying source metadata.",
        @"Non-JPEG input or non-JPEG output rejects metadata preserve with ERR_NOT_IMPLEMENTED."
      ]
    );
  }

  if ([format isEqualToString:RCTImageCompressionKitPngFormat]) {
    return RCTImageCompressionFormatCapability(
      format,
      YES,
      YES,
      YES,
      NO,
      @[
        @"iOS MVP supports PNG input and PNG output through UIKit/ImageIO.",
        @"PNG output preserves alpha where the processed image contains transparency.",
        @"PNG output ignores quality and does not support target-size maxBytes."
      ]
    );
  }

  if ([format isEqualToString:RCTImageCompressionKitGifFormat]) {
    return RCTImageCompressionFormatCapability(
      format,
      YES,
      NO,
      YES,
      NO,
      @[
        @"iOS MVP decodes GIF input as a static first frame through ImageIO.",
        @"GIF input can be re-encoded to JPEG or PNG output without copying source metadata.",
        @"Animated GIF preservation and GIF output are not implemented."
      ]
    );
  }

  if ([format isEqualToString:RCTImageCompressionKitWebPFormat]) {
    return RCTImageCompressionFormatCapability(
      format,
      YES,
      webPOutputAvailable,
      YES,
      NO,
      @[
        @"iOS MVP decodes WebP input as a static first frame through ImageIO.",
        webPOutputAvailable
          ? @"WebP input can be re-encoded to JPEG, PNG, or WebP output without copying source metadata."
          : @"WebP input can be re-encoded to JPEG or PNG output without copying source metadata.",
        webPOutputAvailable
          ? @"WebP output uses ImageIO CGImageDestination when the runtime advertises a WebP destination type."
          : @"This runtime does not advertise ImageIO WebP destination encoding support.",
        @"Runtime-available WebP output supports target-size maxBytes by adjusting WebP quality.",
        @"Animated WebP preservation is not implemented."
      ]
    );
  }

  if ([format isEqualToString:RCTImageCompressionKitHeicFormat] || [format isEqualToString:RCTImageCompressionKitHeifFormat]) {
    NSString *formatLabel = [format uppercaseString];
    return RCTImageCompressionFormatCapability(
      format,
      YES,
      NO,
      YES,
      NO,
      @[
        [NSString stringWithFormat:@"iOS MVP decodes %@ input as a static image through ImageIO.", formatLabel],
        [NSString stringWithFormat:@"%@ input can be re-encoded to JPEG or PNG output without copying source metadata.", formatLabel],
        webPOutputAvailable
          ? [NSString stringWithFormat:@"%@ input can also be re-encoded to runtime-available WebP output.", formatLabel]
          : @"WebP output still requires runtime ImageIO WebP destination support.",
        [NSString stringWithFormat:@"%@ output is not implemented.", formatLabel]
      ]
    );
  }

  if ([format isEqualToString:RCTImageCompressionKitAvifFormat]) {
    return RCTImageCompressionFormatCapability(
      format,
      avifInputAvailable,
      NO,
      avifInputAvailable,
      NO,
      @[
        avifInputAvailable
          ? @"This runtime advertises ImageIO AVIF source support, so iOS MVP decodes AVIF input as a static image through ImageIO."
          : @"This runtime does not advertise ImageIO AVIF source support, so AVIF input rejects with ERR_UNSUPPORTED_FORMAT.",
        avifInputAvailable
          ? @"AVIF input can be re-encoded to JPEG or PNG output without copying source metadata."
          : @"Call getImageCompressionCapabilities() before accepting AVIF input on iOS.",
        avifInputAvailable && webPOutputAvailable
          ? @"AVIF input can also be re-encoded to runtime-available WebP output."
          : @"WebP output still requires runtime ImageIO WebP destination support.",
        @"Animated AVIF preservation is not implemented.",
        @"AVIF output is not implemented.",
        @"AVIF capability reports output=false; selecting output.format: 'avif' rejects with ERR_NOT_IMPLEMENTED.",
        @"Future iOS AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation.",
        @"metadata='preserve', output.maxBytes, and animated AVIF preservation remain unsupported for AVIF output until explicitly designed and tested."
      ]
    );
  }

  return RCTImageCompressionFormatCapability(
    format,
    NO,
    NO,
    NO,
    NO,
    @[@"iOS MVP supports JPEG, PNG, static GIF, static WebP, static HEIC, static HEIF, and runtime-available static AVIF input with JPEG, PNG, or runtime ImageIO-backed WebP output only."]
  );
}

NSArray<NSDictionary *> *RCTImageCompressionIOSFormatCapabilities(
  BOOL webPOutputAvailable,
  BOOL avifInputAvailable
) {
  NSMutableArray<NSDictionary *> *formats = [NSMutableArray array];
  for (NSString *format in RCTImageCompressionFormats()) {
    [formats addObject:RCTImageCompressionIOSFormatCapability(
      format,
      webPOutputAvailable,
      avifInputAvailable
    )];
  }
  return formats;
}
