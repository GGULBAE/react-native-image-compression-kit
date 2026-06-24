export type ImageCompressionKitErrorCode =
  | 'ERR_INVALID_OPTIONS'
  | 'ERR_UNSUPPORTED_SOURCE'
  | 'ERR_NATIVE_MODULE_UNAVAILABLE'
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
  if (error instanceof ImageCompressionKitError || error instanceof Error) {
    return error;
  }

  if (isRecord(error)) {
    const message =
      typeof error.message === 'string'
        ? error.message
        : 'Native image compression failed.';

    return new ImageCompressionKitError(
      'ERR_NATIVE_OPERATION_FAILED',
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
