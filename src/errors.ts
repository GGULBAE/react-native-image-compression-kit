export type ImageCompressionKitErrorCode =
  | 'ERR_INVALID_OPTIONS'
  | 'ERR_UNSUPPORTED_SOURCE'
  | 'ERR_UNSUPPORTED_FORMAT'
  | 'ERR_NATIVE_MODULE_UNAVAILABLE'
  | 'ERR_NOT_IMPLEMENTED'
  | 'ERR_FILE_ACCESS'
  | 'ERR_DECODE_FAILED'
  | 'ERR_ENCODE_FAILED'
  | 'ERR_RESOURCE_LIMIT'
  | 'ERR_CANCELLED'
  | 'ERR_NATIVE_OPERATION_FAILED';

export class ImageCompressionKitError extends Error {
  readonly code: ImageCompressionKitErrorCode;

  constructor(
    code: ImageCompressionKitErrorCode,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message);
    this.name = 'ImageCompressionKitError';
    this.code = code;

    if (options && 'cause' in options) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function normalizeNativeError(error: unknown): Error {
  if (error instanceof ImageCompressionKitError) {
    return error;
  }

  if (error instanceof Error) {
    return new ImageCompressionKitError(
      getNativeErrorCode(error),
      error.message || 'Native image compression failed.',
      { cause: error }
    );
  }

  if (isRecord(error)) {
    const message =
      typeof error.message === 'string'
        ? error.message
        : 'Native image compression failed.';

    return new ImageCompressionKitError(
      getNativeErrorCode(error),
      message,
      { cause: error }
    );
  }

  return new ImageCompressionKitError(
    'ERR_NATIVE_OPERATION_FAILED',
    'Native image compression failed.',
    { cause: error }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getNativeErrorCode(value: unknown): ImageCompressionKitErrorCode {
  if (!isRecord(value) || typeof value.code !== 'string') {
    return 'ERR_NATIVE_OPERATION_FAILED';
  }

  return isImageCompressionKitErrorCode(value.code)
    ? value.code
    : 'ERR_NATIVE_OPERATION_FAILED';
}

function isImageCompressionKitErrorCode(
  code: string
): code is ImageCompressionKitErrorCode {
  return (
    code === 'ERR_INVALID_OPTIONS' ||
    code === 'ERR_UNSUPPORTED_SOURCE' ||
    code === 'ERR_UNSUPPORTED_FORMAT' ||
    code === 'ERR_NATIVE_MODULE_UNAVAILABLE' ||
    code === 'ERR_NOT_IMPLEMENTED' ||
    code === 'ERR_FILE_ACCESS' ||
    code === 'ERR_DECODE_FAILED' ||
    code === 'ERR_ENCODE_FAILED' ||
    code === 'ERR_RESOURCE_LIMIT' ||
    code === 'ERR_CANCELLED' ||
    code === 'ERR_NATIVE_OPERATION_FAILED'
  );
}
