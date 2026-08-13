#import "RCTImageCompressionJpegSegmentSanitizer.h"

static BOOL RCTImageCompressionJpegMarkerHasNoLength(uint8_t marker)
{
  return marker == 0x01 || (marker >= 0xd0 && marker <= 0xd9);
}

static BOOL RCTImageCompressionJpegMarkerCarriesMetadata(uint8_t marker)
{
  return marker == 0xe1 || marker == 0xed || marker == 0xfe;
}

static BOOL RCTImageCompressionJpegMarkerHasLength(uint8_t marker)
{
  return marker >= 0xc0 && marker <= 0xfe;
}

@implementation RCTImageCompressionJpegSegmentSanitizer

+ (nullable NSData *)sanitizeJpegData:(NSData *)jpegData
                       stripRequested:(BOOL)stripRequested
{
  if (!stripRequested) return [jpegData copy];

  const uint8_t *bytes = (const uint8_t *)jpegData.bytes;
  const NSUInteger length = jpegData.length;
  if (length < 4 || bytes[0] != 0xff || bytes[1] != 0xd8) return nil;

  NSMutableData *sanitized = [NSMutableData dataWithCapacity:length];
  [sanitized appendBytes:bytes length:2];
  NSUInteger cursor = 2;
  BOOL insideEntropyData = NO;
  BOOL resumeEntropyAfterSegment = NO;
  BOOL sawScan = NO;

  while (cursor < length) {
    if (insideEntropyData) {
      NSUInteger entropyStart = cursor;
      BOOL foundMarker = NO;
      while (cursor < length) {
        if (bytes[cursor] != 0xff) {
          cursor += 1;
          continue;
        }

        NSUInteger markerStart = cursor;
        cursor += 1;
        while (cursor < length && bytes[cursor] == 0xff) cursor += 1;
        if (cursor >= length) return nil;

        uint8_t marker = bytes[cursor];
        if (marker == 0x00 || marker == 0x01 ||
            (marker >= 0xd0 && marker <= 0xd7)) {
          cursor += 1;
          continue;
        }

        [sanitized appendBytes:bytes + entropyStart length:markerStart - entropyStart];
        cursor = markerStart;
        insideEntropyData = NO;
        resumeEntropyAfterSegment = marker == 0xdc;
        foundMarker = YES;
        break;
      }
      if (!foundMarker) return nil;
      continue;
    }

    if (bytes[cursor] != 0xff) return nil;
    NSUInteger markerStart = cursor;
    cursor += 1;
    while (cursor < length && bytes[cursor] == 0xff) cursor += 1;
    if (cursor >= length) return nil;

    uint8_t marker = bytes[cursor];
    cursor += 1;
    if (marker == 0x00 || marker == 0xd8 ||
        (marker >= 0xd0 && marker <= 0xd7)) {
      return nil;
    }

    if (marker == 0xd9) {
      if (!sawScan || cursor != length) return nil;
      [sanitized appendBytes:bytes + markerStart length:cursor - markerStart];
      return [sanitized copy];
    }

    if (RCTImageCompressionJpegMarkerHasNoLength(marker)) {
      [sanitized appendBytes:bytes + markerStart length:cursor - markerStart];
      continue;
    }

    if (!RCTImageCompressionJpegMarkerHasLength(marker)) return nil;

    if (length - cursor < 2) return nil;
    NSUInteger segmentLength = ((NSUInteger)bytes[cursor] << 8) | bytes[cursor + 1];
    if (segmentLength < 2 || segmentLength > length - cursor) return nil;
    if (marker == 0xda) {
      if (segmentLength < 8) return nil;
      NSUInteger componentCount = bytes[cursor + 2];
      if (componentCount == 0 || componentCount > 4 ||
          segmentLength != 6 + (2 * componentCount)) {
        return nil;
      }
    }
    if (marker == 0xdc &&
        (!resumeEntropyAfterSegment || segmentLength != 4)) {
      return nil;
    }
    NSUInteger segmentEnd = cursor + segmentLength;

    if (!RCTImageCompressionJpegMarkerCarriesMetadata(marker)) {
      [sanitized appendBytes:bytes + markerStart length:segmentEnd - markerStart];
    }
    cursor = segmentEnd;

    if (marker == 0xda) {
      sawScan = YES;
      insideEntropyData = YES;
    } else if (resumeEntropyAfterSegment) {
      insideEntropyData = YES;
    }
    resumeEntropyAfterSegment = NO;
  }

  return nil;
}

@end
