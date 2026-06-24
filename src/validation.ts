import {
  METADATA_POLICIES,
  OUTPUT_FORMATS,
  RESIZE_MODES,
  type CompressionOptions,
  type MetadataPolicy,
  type NormalizedCompressionOptions,
  type OutputFormat,
  type ResizeMode,
} from './types';
import { ImageCompressionKitError } from './errors';

export function normalizeCompressionOptions(
  options: CompressionOptions
): NormalizedCompressionOptions {
  if (!isRecord(options)) {
    throw invalidOptions('Compression options must be an object.');
  }

  const source = options.source;

  if (!isRecord(source)) {
    throw invalidOptions('Compression source must be an object.');
  }

  const uri = source.uri;

  if (typeof uri !== 'string' || uri.trim().length === 0) {
    throw invalidOptions('Compression source.uri must be a non-empty string.');
  }

  if (isRemoteOrInlineUri(uri)) {
    throw new ImageCompressionKitError(
      'ERR_UNSUPPORTED_SOURCE',
      'Compression source.uri must point to a local image. Remote URLs and inline data URIs are outside this package scope.'
    );
  }

  if (!isRecord(options.output)) {
    throw invalidOptions('Compression output must be an object.');
  }

  const format = options.output.format;

  if (!isOutputFormat(format)) {
    throw invalidOptions(
      `Compression output.format must be one of: ${OUTPUT_FORMATS.join(', ')}.`
    );
  }

  const output: NormalizedCompressionOptions['output'] = { format };

  if (options.output.quality !== undefined) {
    assertIntegerInRange(
      options.output.quality,
      'Compression output.quality',
      0,
      100
    );
    output.quality = options.output.quality;
  }

  if (options.output.maxBytes !== undefined) {
    assertPositiveInteger(options.output.maxBytes, 'Compression output.maxBytes');
    output.maxBytes = options.output.maxBytes;
  }

  const metadata = options.metadata ?? 'safe';

  if (!isMetadataPolicy(metadata)) {
    throw invalidOptions(
      `Compression metadata must be one of: ${METADATA_POLICIES.join(', ')}.`
    );
  }

  const normalized: NormalizedCompressionOptions = {
    source: { uri },
    output,
    metadata,
  };

  if (options.resize !== undefined) {
    if (!isRecord(options.resize)) {
      throw invalidOptions('Compression resize must be an object.');
    }

    const { maxWidth, maxHeight } = options.resize;

    if (maxWidth === undefined && maxHeight === undefined) {
      throw invalidOptions(
        'Compression resize must include maxWidth, maxHeight, or both.'
      );
    }

    if (maxWidth !== undefined) {
      assertPositiveInteger(maxWidth, 'Compression resize.maxWidth');
    }

    if (maxHeight !== undefined) {
      assertPositiveInteger(maxHeight, 'Compression resize.maxHeight');
    }

    const mode = options.resize.mode ?? 'contain';

    if (!isResizeMode(mode)) {
      throw invalidOptions(
        `Compression resize.mode must be one of: ${RESIZE_MODES.join(', ')}.`
      );
    }

    normalized.resize = {
      ...(maxWidth !== undefined ? { maxWidth } : {}),
      ...(maxHeight !== undefined ? { maxHeight } : {}),
      mode,
    };
  }

  return normalized;
}

function invalidOptions(message: string): ImageCompressionKitError {
  return new ImageCompressionKitError('ERR_INVALID_OPTIONS', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOutputFormat(value: unknown): value is OutputFormat {
  return (
    typeof value === 'string' &&
    (OUTPUT_FORMATS as readonly string[]).includes(value)
  );
}

function isMetadataPolicy(value: unknown): value is MetadataPolicy {
  return (
    typeof value === 'string' &&
    (METADATA_POLICIES as readonly string[]).includes(value)
  );
}

function isResizeMode(value: unknown): value is ResizeMode {
  return (
    typeof value === 'string' &&
    (RESIZE_MODES as readonly string[]).includes(value)
  );
}

function isRemoteOrInlineUri(uri: string): boolean {
  return /^(https?:|data:)/i.test(uri.trim());
}

function assertIntegerInRange(
  value: unknown,
  label: string,
  min: number,
  max: number
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw invalidOptions(`${label} must be an integer from ${min} to ${max}.`);
  }
}

function assertPositiveInteger(
  value: unknown,
  label: string
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw invalidOptions(`${label} must be a positive integer.`);
  }
}
