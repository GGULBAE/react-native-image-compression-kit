#import "RCTImageCompressionInput.h"

#import <ImageIO/ImageIO.h>

#include <string.h>

static void RCTImageCompressionInspectionSetError(
  RCTImageCompressionInputError * _Nullable * _Nullable error,
  NSString *code,
  NSString *message
) {
  if (error != nil) {
    *error = [[RCTImageCompressionInputError alloc]
      initWithCode:code
      message:message
      underlyingError:nil
    ];
  }
}

static BOOL RCTImageCompressionTypeIsJpeg(NSString *imageType)
{
  return
    [imageType isEqualToString:@"public.jpeg"] ||
    [imageType isEqualToString:@"public.jpg"] ||
    [imageType isEqualToString:@"image/jpeg"];
}

static BOOL RCTImageCompressionTypeIsGif(NSString *imageType)
{
  return
    [imageType isEqualToString:@"com.compuserve.gif"] ||
    [imageType isEqualToString:@"public.gif"];
}

static BOOL RCTImageCompressionTypeIsWebP(NSString *imageType)
{
  return
    [imageType isEqualToString:@"org.webmproject.webp"] ||
    [imageType isEqualToString:@"public.webp"];
}

static BOOL RCTImageCompressionTypeIsHeic(NSString *imageType)
{
  return
    [imageType isEqualToString:@"public.heic"] ||
    [imageType isEqualToString:@"public.heics"] ||
    [imageType isEqualToString:@"org.iso.heic"] ||
    [imageType isEqualToString:@"org.iso.heics"];
}

static BOOL RCTImageCompressionTypeIsHeif(NSString *imageType)
{
  return
    [imageType isEqualToString:@"public.heif"] ||
    [imageType isEqualToString:@"public.heifs"] ||
    [imageType isEqualToString:@"org.iso.heif"] ||
    [imageType isEqualToString:@"org.iso.heifs"];
}

NSArray<NSString *> *RCTImageCompressionAVIFTypeIdentifiers(void)
{
  return @[
    @"public.avif",
    @"public.avifs",
    @"org.aomedia.avif",
    @"org.aomedia.avifs"
  ];
}

static BOOL RCTImageCompressionTypeIsAVIF(NSString *imageType)
{
  return [RCTImageCompressionAVIFTypeIdentifiers() containsObject:imageType];
}

static BOOL RCTImageCompressionDataLooksLikeAVIF(NSData *sourceData)
{
  if (sourceData.length < 12) {
    return NO;
  }

  const unsigned char *bytes = (const unsigned char *)sourceData.bytes;
  if (memcmp(bytes + 4, "ftyp", 4) != 0) {
    return NO;
  }

  NSUInteger searchLength = MIN(sourceData.length, (NSUInteger)64);
  for (NSUInteger offset = 8; offset + 4 <= searchLength; offset += 4) {
    if (
      memcmp(bytes + offset, "avif", 4) == 0 ||
      memcmp(bytes + offset, "avis", 4) == 0
    ) {
      return YES;
    }
  }

  return NO;
}

static BOOL RCTImageCompressionFormatForType(
  NSString *imageType,
  RCTImageCompressionInputFormat *format
) {
  if (RCTImageCompressionTypeIsJpeg(imageType)) {
    *format = RCTImageCompressionInputFormatJpeg;
    return YES;
  }
  if ([imageType isEqualToString:@"public.png"]) {
    *format = RCTImageCompressionInputFormatPng;
    return YES;
  }
  if (RCTImageCompressionTypeIsGif(imageType)) {
    *format = RCTImageCompressionInputFormatGif;
    return YES;
  }
  if (RCTImageCompressionTypeIsWebP(imageType)) {
    *format = RCTImageCompressionInputFormatWebP;
    return YES;
  }
  if (RCTImageCompressionTypeIsHeic(imageType)) {
    *format = RCTImageCompressionInputFormatHeic;
    return YES;
  }
  if (RCTImageCompressionTypeIsHeif(imageType)) {
    *format = RCTImageCompressionInputFormatHeif;
    return YES;
  }
  if (RCTImageCompressionTypeIsAVIF(imageType)) {
    *format = RCTImageCompressionInputFormatAvif;
    return YES;
  }
  return NO;
}

@implementation RCTImageCompressionInputInspection

- (instancetype)initWithSource:(RCTImageCompressionSource *)source
                      imageType:(NSString *)imageType
                         format:(RCTImageCompressionInputFormat)format
            sourceLooksLikeAVIF:(BOOL)sourceLooksLikeAVIF
{
  self = [super init];
  if (self != nil) {
    _source = source;
    _imageType = [imageType copy];
    _format = format;
    _sourceLooksLikeAVIF = sourceLooksLikeAVIF;
  }
  return self;
}

- (BOOL)jpeg
{
  return self.format == RCTImageCompressionInputFormatJpeg;
}

- (BOOL)shouldDecodeFirstFrame
{
  return
    self.format == RCTImageCompressionInputFormatGif ||
    self.format == RCTImageCompressionInputFormatWebP ||
    self.format == RCTImageCompressionInputFormatHeic ||
    self.format == RCTImageCompressionInputFormatHeif ||
    self.format == RCTImageCompressionInputFormatAvif;
}

@end

@interface RCTImageCompressionInputLoader ()

@property (nonatomic, strong, readonly) RCTImageCompressionSourceResolver *sourceResolver;
@property (nonatomic, strong, readonly) RCTImageCompressionInputInspector *inputInspector;

@end


@implementation RCTImageCompressionInputLoader

+ (instancetype)defaultLoader
{
  return [[self alloc]
    initWithSourceResolver:[RCTImageCompressionSourceResolver defaultResolver]
    inputInspector:[RCTImageCompressionInputInspector defaultInspector]
  ];
}

- (instancetype)initWithSourceResolver:(RCTImageCompressionSourceResolver *)sourceResolver
                         inputInspector:(RCTImageCompressionInputInspector *)inputInspector
{
  self = [super init];
  if (self != nil) {
    _sourceResolver = sourceResolver;
    _inputInspector = inputInspector;
  }
  return self;
}

- (nullable RCTImageCompressionInputInspection *)loadSourceURI:(NSString *)sourceURI
                                          avifInputAvailability:(RCTImageCompressionAVIFInputAvailability)avifInputAvailability
                                                          error:(RCTImageCompressionInputError * _Nullable * _Nullable)error
{
  RCTImageCompressionSource *source = [self.sourceResolver
    resolveSourceURI:sourceURI
    error:error
  ];
  if (source == nil) {
    return nil;
  }
  return [self.inputInspector
    inspectSource:source
    avifInputAvailability:avifInputAvailability
    error:error
  ];
}

@end

@interface RCTImageCompressionInputInspector ()

@property (nonatomic, copy, readonly) RCTImageCompressionTypeIdentifierLoader typeIdentifierLoader;

@end

@implementation RCTImageCompressionInputInspector

+ (instancetype)defaultInspector
{
  return [[self alloc] initWithTypeIdentifierLoader:^NSString *(NSData *data) {
    CGImageSourceRef imageSource = CGImageSourceCreateWithData(
      (__bridge CFDataRef)data,
      nil
    );
    if (imageSource == nil) {
      return nil;
    }

    NSString *imageType = nil;
    if (CGImageSourceGetCount(imageSource) > 0) {
      imageType = [(__bridge NSString *)CGImageSourceGetType(imageSource) copy];
    }
    CFRelease(imageSource);
    return imageType;
  }];
}

- (instancetype)initWithTypeIdentifierLoader:(RCTImageCompressionTypeIdentifierLoader)typeIdentifierLoader
{
  self = [super init];
  if (self != nil) {
    _typeIdentifierLoader = [typeIdentifierLoader copy];
  }
  return self;
}

- (nullable RCTImageCompressionInputInspection *)inspectSource:(RCTImageCompressionSource *)source
                                         avifInputAvailability:(RCTImageCompressionAVIFInputAvailability)avifInputAvailability
                                                         error:(RCTImageCompressionInputError * _Nullable * _Nullable)error
{
  if (error != nil) {
    *error = nil;
  }

  BOOL sourceLooksLikeAVIF = RCTImageCompressionDataLooksLikeAVIF(source.data);
  BOOL avifAvailabilityChecked = NO;
  BOOL avifInputAvailable = NO;
  if (sourceLooksLikeAVIF) {
    avifAvailabilityChecked = YES;
    avifInputAvailable = avifInputAvailability();
    if (!avifInputAvailable) {
      RCTImageCompressionInspectionSetError(
        error,
        RCTImageCompressionKitUnsupportedFormatCode,
        @"iOS AVIF input requires runtime ImageIO AVIF source support."
      );
      return nil;
    }
  }

  NSString *imageType = self.typeIdentifierLoader(source.data);
  if (imageType == nil) {
    RCTImageCompressionInspectionSetError(
      error,
      RCTImageCompressionKitDecodeFailedCode,
      @"iOS MVP could not inspect the source image."
    );
    return nil;
  }

  RCTImageCompressionInputFormat format;
  if (!RCTImageCompressionFormatForType(imageType, &format)) {
    NSString *message = sourceLooksLikeAVIF
      ? @"iOS AVIF input requires runtime ImageIO AVIF source support."
      : @"iOS MVP supports JPEG, PNG, GIF, WebP, HEIC, HEIF, and runtime-available AVIF input only. GIF, WebP, HEIC, HEIF, and AVIF input are decoded as static images through ImageIO.";
    RCTImageCompressionInspectionSetError(
      error,
      RCTImageCompressionKitUnsupportedFormatCode,
      message
    );
    return nil;
  }

  if (format == RCTImageCompressionInputFormatAvif) {
    if (!avifAvailabilityChecked) {
      avifInputAvailable = avifInputAvailability();
    }
    if (!avifInputAvailable) {
      RCTImageCompressionInspectionSetError(
        error,
        RCTImageCompressionKitUnsupportedFormatCode,
        @"iOS AVIF input requires runtime ImageIO AVIF source support."
      );
      return nil;
    }
  }

  return [[RCTImageCompressionInputInspection alloc]
    initWithSource:source
    imageType:imageType
    format:format
    sourceLooksLikeAVIF:sourceLooksLikeAVIF
  ];
}

@end
