#import "RCTImageCompressionPipeline.h"

#import "RCTImageCompressionImageDecoder.h"
#import "RCTImageCompressionImageEncoder.h"
#import "RCTImageCompressionImageTransformer.h"
#import "RCTImageCompressionInput.h"
#import "RCTImageCompressionJpegMetadata.h"
#import "RCTImageCompressionOutput.h"
#import "RCTImageCompressionRequest.h"

#import <ImageIO/ImageIO.h>

static BOOL RCTImageCompressionPipelineSmokeEnabled(void)
{
  NSProcessInfo *processInfo = [NSProcessInfo processInfo];
  NSString *enabled = processInfo.environment[@"RNICK_IOS_SMOKE"];
  NSString *simctlEnabled = processInfo.environment[@"SIMCTL_CHILD_RNICK_IOS_SMOKE"];

  return
    [enabled isEqualToString:@"1"] ||
    [simctlEnabled isEqualToString:@"1"] ||
    [processInfo.arguments containsObject:@"--rnick-ios-smoke"];
}

@implementation RCTImageCompressionPipeline (Default)

+ (instancetype)defaultPipeline
{
  RCTImageCompressionInputLoader *inputLoader = [RCTImageCompressionInputLoader defaultLoader];
  RCTImageCompressionJpegMetadata *metadata = [RCTImageCompressionJpegMetadata defaultMetadata];
  RCTImageCompressionImageDecoder *decoder = [RCTImageCompressionImageDecoder defaultDecoder];
  RCTImageCompressionImageTransformer *transformer = [RCTImageCompressionImageTransformer defaultTransformer];
  RCTImageCompressionImageEncoder *encoder = [RCTImageCompressionImageEncoder defaultEncoder];
  RCTImageCompressionOutput *output = [RCTImageCompressionOutput defaultOutput];

  return [[RCTImageCompressionPipeline alloc]
    initWithRequestParser:^RCTImageCompressionRequest *(
      NSDictionary *options,
      RCTImageCompressionPipelineRuntimeAvailability webPOutputAvailability,
      RCTImageCompressionRequestError **error
    ) {
      return [RCTImageCompressionRequestParser
        parseOptions:options
        webPOutputAvailability:webPOutputAvailability
        error:error
      ];
    }
    inputLoader:^RCTImageCompressionInputInspection *(
      NSString *sourceURI,
      RCTImageCompressionPipelineRuntimeAvailability avifInputAvailability,
      RCTImageCompressionInputError **error
    ) {
      return [inputLoader
        loadSourceURI:sourceURI
        avifInputAvailability:avifInputAvailability
        error:error
      ];
    }
    metadataPreparer:^RCTImageCompressionJpegMetadataResult *(
      RCTImageCompressionJpegMetadataRequest *request,
      RCTImageCompressionJpegMetadataError **error
    ) {
      return [metadata prepareRequest:request error:error];
    }
    imageDecoder:^RCTImageCompressionDecodedImage *(
      RCTImageCompressionInputInspection *input,
      RCTImageCompressionImageDecodeError **error
    ) {
      return [decoder decodeInput:input error:error];
    }
    imageTransformer:^RCTImageCompressionTransformedImage *(
      RCTImageCompressionImageTransformRequest *request
    ) {
      return [transformer transformRequest:request error:nil];
    }
    imageEncoder:^RCTImageCompressionEncodedImage *(
      RCTImageCompressionImageEncodeRequest *request,
      RCTImageCompressionImageEncodeError **error
    ) {
      return [encoder encodeRequest:request error:error];
    }
    outputWriter:^RCTImageCompressionOutputResult *(
      RCTImageCompressionOutputRequest *request,
      RCTImageCompressionOutputError **error
    ) {
      return [output persistRequest:request error:error];
    }
    webPOutputAvailability:^BOOL{
      return [self defaultWebPOutputAvailable];
    }
    avifInputAvailability:^BOOL{
      return [self defaultAVIFInputAvailable];
    }
    stageObserver:^(NSString *stage) {
      if (RCTImageCompressionPipelineSmokeEnabled()) {
        NSLog(@"RNICK_IOS_SMOKE_NATIVE %@", stage);
      }
    }
  ];
}

+ (BOOL)defaultWebPOutputAvailable
{
  return [RCTImageCompressionImageEncoder defaultWebPOutputAvailable];
}

+ (BOOL)defaultAVIFInputAvailable
{
  NSArray<NSString *> *supportedTypes = CFBridgingRelease(
    CGImageSourceCopyTypeIdentifiers()
  );
  for (NSString *imageType in RCTImageCompressionAVIFTypeIdentifiers()) {
    if ([supportedTypes containsObject:imageType]) {
      return YES;
    }
  }
  return NO;
}

@end
