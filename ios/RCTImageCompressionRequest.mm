#import "RCTImageCompressionRequest.h"

#include <math.h>

NSString *const RCTImageCompressionKitInvalidOptionsCode = @"ERR_INVALID_OPTIONS";
NSString *const RCTImageCompressionKitNotImplementedCode = @"ERR_NOT_IMPLEMENTED";

NSString *const RCTImageCompressionKitJpegFormat = @"jpeg";
NSString *const RCTImageCompressionKitPngFormat = @"png";
NSString *const RCTImageCompressionKitWebPFormat = @"webp";
NSString *const RCTImageCompressionKitGifFormat = @"gif";
NSString *const RCTImageCompressionKitHeicFormat = @"heic";
NSString *const RCTImageCompressionKitHeifFormat = @"heif";
NSString *const RCTImageCompressionKitAvifFormat = @"avif";

NSString *const RCTImageCompressionKitDefaultMetadataPolicy = @"safe";
NSString *const RCTImageCompressionKitStripMetadataPolicy = @"strip";
NSString *const RCTImageCompressionKitPreserveMetadataPolicy = @"preserve";

NSInteger const RCTImageCompressionKitDefaultQuality = 80;
NSInteger const RCTImageCompressionKitMinQuality = 0;
NSInteger const RCTImageCompressionKitMaxQuality = 100;

static BOOL RCTImageCompressionRequestHasValue(NSDictionary *map, NSString *key)
{
  id value = map[key];
  return value != nil && value != (id)kCFNull;
}

static BOOL RCTImageCompressionRequestIsIntegerNumber(NSNumber *number)
{
  double value = number.doubleValue;
  return isfinite(value) && floor(value) == value;
}

static NSString *RCTImageCompressionRequestStringValue(NSDictionary *map, NSString *key)
{
  id value = map[key];
  return [value isKindOfClass:[NSString class]] ? value : nil;
}

static NSNumber *RCTImageCompressionRequestNumberValue(NSDictionary *map, NSString *key)
{
  id value = map[key];
  return [value isKindOfClass:[NSNumber class]] ? value : nil;
}

static void RCTImageCompressionRequestSetError(
  RCTImageCompressionRequestError * _Nullable * _Nullable error,
  NSString *code,
  NSString *message
) {
  if (error != nil) {
    *error = [[RCTImageCompressionRequestError alloc] initWithCode:code message:message];
  }
}

static BOOL RCTImageCompressionRequestReadPositiveInteger(
  NSDictionary *map,
  NSString *key,
  NSInteger *value,
  RCTImageCompressionRequestError * _Nullable * _Nullable error
) {
  if (!RCTImageCompressionRequestHasValue(map, key)) {
    return YES;
  }

  NSNumber *number = RCTImageCompressionRequestNumberValue(map, key);
  if (number == nil || !RCTImageCompressionRequestIsIntegerNumber(number) || number.integerValue <= 0) {
    RCTImageCompressionRequestSetError(
      error,
      RCTImageCompressionKitInvalidOptionsCode,
      [NSString stringWithFormat:@"Compression resize.%@ must be a positive integer.", key]
    );
    return NO;
  }

  *value = number.integerValue;
  return YES;
}

static BOOL RCTImageCompressionRequestReadResizeMode(
  NSDictionary *resize,
  RCTImageCompressionKitResizeMode *mode,
  RCTImageCompressionRequestError * _Nullable * _Nullable error
) {
  if (!RCTImageCompressionRequestHasValue(resize, @"mode")) {
    *mode = RCTImageCompressionKitResizeModeContain;
    return YES;
  }

  NSString *modeValue = RCTImageCompressionRequestStringValue(resize, @"mode");
  if ([modeValue isEqualToString:@"contain"]) {
    *mode = RCTImageCompressionKitResizeModeContain;
    return YES;
  }
  if ([modeValue isEqualToString:@"cover"]) {
    *mode = RCTImageCompressionKitResizeModeCover;
    return YES;
  }
  if ([modeValue isEqualToString:@"stretch"]) {
    *mode = RCTImageCompressionKitResizeModeStretch;
    return YES;
  }

  RCTImageCompressionRequestSetError(
    error,
    RCTImageCompressionKitInvalidOptionsCode,
    @"Compression resize.mode must be one of: contain, cover, stretch."
  );
  return NO;
}

static BOOL RCTImageCompressionRequestReadResizeOptions(
  NSDictionary *options,
  RCTImageCompressionKitResizeOptions *resizeOptions,
  RCTImageCompressionRequestError * _Nullable * _Nullable error
) {
  *resizeOptions = (RCTImageCompressionKitResizeOptions){
    .enabled = NO,
    .hasMaxWidth = NO,
    .hasMaxHeight = NO,
    .maxWidth = 0,
    .maxHeight = 0,
    .mode = RCTImageCompressionKitResizeModeContain
  };

  if (!RCTImageCompressionRequestHasValue(options, @"resize")) {
    return YES;
  }

  id resizeValue = options[@"resize"];
  if (![resizeValue isKindOfClass:[NSDictionary class]]) {
    RCTImageCompressionRequestSetError(
      error,
      RCTImageCompressionKitInvalidOptionsCode,
      @"Compression resize must be an object."
    );
    return NO;
  }

  NSDictionary *resize = resizeValue;
  NSInteger maxWidth = 0;
  NSInteger maxHeight = 0;
  if (!RCTImageCompressionRequestReadPositiveInteger(resize, @"maxWidth", &maxWidth, error)) {
    return NO;
  }
  if (!RCTImageCompressionRequestReadPositiveInteger(resize, @"maxHeight", &maxHeight, error)) {
    return NO;
  }

  BOOL hasMaxWidth = RCTImageCompressionRequestHasValue(resize, @"maxWidth");
  BOOL hasMaxHeight = RCTImageCompressionRequestHasValue(resize, @"maxHeight");
  if (!hasMaxWidth && !hasMaxHeight) {
    RCTImageCompressionRequestSetError(
      error,
      RCTImageCompressionKitInvalidOptionsCode,
      @"Compression resize must include maxWidth, maxHeight, or both."
    );
    return NO;
  }

  RCTImageCompressionKitResizeMode mode = RCTImageCompressionKitResizeModeContain;
  if (!RCTImageCompressionRequestReadResizeMode(resize, &mode, error)) {
    return NO;
  }

  *resizeOptions = (RCTImageCompressionKitResizeOptions){
    .enabled = YES,
    .hasMaxWidth = hasMaxWidth,
    .hasMaxHeight = hasMaxHeight,
    .maxWidth = maxWidth,
    .maxHeight = maxHeight,
    .mode = mode
  };
  return YES;
}

static BOOL RCTImageCompressionRequestReadQuality(
  NSDictionary *output,
  NSInteger *quality,
  RCTImageCompressionRequestError * _Nullable * _Nullable error
) {
  if (!RCTImageCompressionRequestHasValue(output, @"quality")) {
    *quality = RCTImageCompressionKitDefaultQuality;
    return YES;
  }

  NSNumber *qualityNumber = RCTImageCompressionRequestNumberValue(output, @"quality");
  if (
    qualityNumber == nil ||
    !RCTImageCompressionRequestIsIntegerNumber(qualityNumber) ||
    qualityNumber.integerValue < RCTImageCompressionKitMinQuality ||
    qualityNumber.integerValue > RCTImageCompressionKitMaxQuality
  ) {
    RCTImageCompressionRequestSetError(
      error,
      RCTImageCompressionKitInvalidOptionsCode,
      @"Compression output.quality must be an integer from 0 to 100."
    );
    return NO;
  }

  *quality = qualityNumber.integerValue;
  return YES;
}

static BOOL RCTImageCompressionRequestReadMaxBytes(
  NSDictionary *output,
  BOOL *hasMaxBytes,
  NSUInteger *maxBytes,
  RCTImageCompressionRequestError * _Nullable * _Nullable error
) {
  *hasMaxBytes = NO;
  *maxBytes = 0;

  if (!RCTImageCompressionRequestHasValue(output, @"maxBytes")) {
    return YES;
  }

  NSNumber *maxBytesNumber = RCTImageCompressionRequestNumberValue(output, @"maxBytes");
  double maxBytesValue = maxBytesNumber.doubleValue;
  if (
    maxBytesNumber == nil ||
    !RCTImageCompressionRequestIsIntegerNumber(maxBytesNumber) ||
    maxBytesValue <= 0 ||
    maxBytesValue > (double)NSUIntegerMax
  ) {
    RCTImageCompressionRequestSetError(
      error,
      RCTImageCompressionKitInvalidOptionsCode,
      @"Compression output.maxBytes must be a positive integer."
    );
    return NO;
  }

  *hasMaxBytes = YES;
  *maxBytes = (NSUInteger)maxBytesValue;
  return YES;
}

@implementation RCTImageCompressionRequestError

- (instancetype)initWithCode:(NSString *)code message:(NSString *)message
{
  self = [super init];
  if (self != nil) {
    _code = [code copy];
    _message = [message copy];
  }
  return self;
}

@end

@implementation RCTImageCompressionRequest

- (instancetype)initWithSourceURI:(NSString *)sourceURI
                     outputFormat:(NSString *)outputFormat
                          quality:(NSInteger)quality
                      hasMaxBytes:(BOOL)hasMaxBytes
                         maxBytes:(NSUInteger)maxBytes
                   metadataPolicy:(NSString *)metadataPolicy
                    resizeOptions:(RCTImageCompressionKitResizeOptions)resizeOptions
{
  self = [super init];
  if (self != nil) {
    _sourceURI = [sourceURI copy];
    _outputFormat = [outputFormat copy];
    _quality = quality;
    _hasMaxBytes = hasMaxBytes;
    _maxBytes = maxBytes;
    _metadataPolicy = [metadataPolicy copy];
    _resizeOptions = resizeOptions;
  }
  return self;
}

- (BOOL)outputIsJpeg
{
  return [self.outputFormat isEqualToString:RCTImageCompressionKitJpegFormat];
}

- (BOOL)outputIsPng
{
  return [self.outputFormat isEqualToString:RCTImageCompressionKitPngFormat];
}

- (BOOL)outputIsWebP
{
  return [self.outputFormat isEqualToString:RCTImageCompressionKitWebPFormat];
}

@end

@implementation RCTImageCompressionRequestParser

+ (nullable RCTImageCompressionRequest *)parseOptions:(id _Nullable)options
                               webPOutputAvailability:(RCTImageCompressionKitWebPOutputAvailability)webPOutputAvailability
                                                 error:(RCTImageCompressionRequestError * _Nullable * _Nullable)error
{
  if (error != nil) {
    *error = nil;
  }

  if (![options isKindOfClass:[NSDictionary class]]) {
    RCTImageCompressionRequestSetError(
      error,
      RCTImageCompressionKitInvalidOptionsCode,
      @"Compression options must be an object."
    );
    return nil;
  }

  NSDictionary *optionsMap = options;
  id sourceValue = optionsMap[@"source"];
  id outputValue = optionsMap[@"output"];
  if (![sourceValue isKindOfClass:[NSDictionary class]] || ![outputValue isKindOfClass:[NSDictionary class]]) {
    RCTImageCompressionRequestSetError(
      error,
      RCTImageCompressionKitInvalidOptionsCode,
      @"Compression options must include source and output objects."
    );
    return nil;
  }

  NSDictionary *source = sourceValue;
  NSDictionary *output = outputValue;
  NSString *sourceURI = RCTImageCompressionRequestStringValue(source, @"uri");
  if (
    sourceURI == nil ||
    [sourceURI stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]].length == 0
  ) {
    RCTImageCompressionRequestSetError(
      error,
      RCTImageCompressionKitInvalidOptionsCode,
      @"Compression source.uri must be a non-empty string."
    );
    return nil;
  }

  NSString *outputFormat = RCTImageCompressionRequestStringValue(output, @"format");
  if (outputFormat == nil || ![@[
    RCTImageCompressionKitJpegFormat,
    RCTImageCompressionKitPngFormat,
    RCTImageCompressionKitWebPFormat,
    RCTImageCompressionKitHeicFormat,
    RCTImageCompressionKitHeifFormat,
    RCTImageCompressionKitAvifFormat
  ] containsObject:outputFormat]) {
    RCTImageCompressionRequestSetError(
      error,
      RCTImageCompressionKitInvalidOptionsCode,
      @"Compression output.format must be one of: jpeg, png, webp, heic, heif, avif."
    );
    return nil;
  }

  BOOL outputIsJpeg = [outputFormat isEqualToString:RCTImageCompressionKitJpegFormat];
  BOOL outputIsPng = [outputFormat isEqualToString:RCTImageCompressionKitPngFormat];
  BOOL outputIsWebP = [outputFormat isEqualToString:RCTImageCompressionKitWebPFormat];
  if (!outputIsJpeg && !outputIsPng && !outputIsWebP) {
    NSString *unsupportedOutputMessage = [outputFormat isEqualToString:RCTImageCompressionKitAvifFormat]
      ? @"iOS MVP supports AVIF input when ImageIO source decoding is available, but AVIF output is not implemented. Supported output formats are JPEG, PNG, and runtime-available WebP. Future AVIF output must be runtime-gated by ImageIO AVIF destination support and static output validation; metadata='preserve', output.maxBytes, and animated AVIF preservation remain unsupported for AVIF output. output.format: 'avif' rejects with ERR_NOT_IMPLEMENTED."
      : @"iOS MVP supports JPEG, PNG, and runtime-available WebP output only. HEIC and HEIF output are not implemented. Call getImageCompressionCapabilities() before selecting a platform output format.";
    RCTImageCompressionRequestSetError(
      error,
      RCTImageCompressionKitNotImplementedCode,
      unsupportedOutputMessage
    );
    return nil;
  }

  if (outputIsWebP && !webPOutputAvailability()) {
    RCTImageCompressionRequestSetError(
      error,
      RCTImageCompressionKitNotImplementedCode,
      @"iOS MVP requires ImageIO WebP destination support for WebP output on this runtime."
    );
    return nil;
  }

  NSInteger quality = RCTImageCompressionKitDefaultQuality;
  if (!RCTImageCompressionRequestReadQuality(output, &quality, error)) {
    return nil;
  }

  BOOL hasMaxBytes = NO;
  NSUInteger maxBytes = 0;
  if (!RCTImageCompressionRequestReadMaxBytes(output, &hasMaxBytes, &maxBytes, error)) {
    return nil;
  }
  if (hasMaxBytes && outputIsPng) {
    RCTImageCompressionRequestSetError(
      error,
      RCTImageCompressionKitNotImplementedCode,
      @"iOS MVP supports output.maxBytes for JPEG and runtime-available WebP output only."
    );
    return nil;
  }

  NSString *metadataPolicy = RCTImageCompressionKitDefaultMetadataPolicy;
  if (RCTImageCompressionRequestHasValue(optionsMap, @"metadata")) {
    id metadataValue = optionsMap[@"metadata"];
    if (![metadataValue isKindOfClass:[NSString class]]) {
      RCTImageCompressionRequestSetError(
        error,
        RCTImageCompressionKitInvalidOptionsCode,
        @"Compression metadata must be one of: preserve, safe, strip."
      );
      return nil;
    }
    metadataPolicy = metadataValue;
  }
  if (![@[
    RCTImageCompressionKitDefaultMetadataPolicy,
    RCTImageCompressionKitStripMetadataPolicy,
    RCTImageCompressionKitPreserveMetadataPolicy
  ] containsObject:metadataPolicy]) {
    RCTImageCompressionRequestSetError(
      error,
      RCTImageCompressionKitInvalidOptionsCode,
      @"Compression metadata must be one of: preserve, safe, strip."
    );
    return nil;
  }

  RCTImageCompressionKitResizeOptions resizeOptions;
  if (!RCTImageCompressionRequestReadResizeOptions(optionsMap, &resizeOptions, error)) {
    return nil;
  }

  return [[RCTImageCompressionRequest alloc]
    initWithSourceURI:sourceURI
    outputFormat:outputFormat
    quality:quality
    hasMaxBytes:hasMaxBytes
    maxBytes:maxBytes
    metadataPolicy:metadataPolicy
    resizeOptions:resizeOptions
  ];
}

@end
