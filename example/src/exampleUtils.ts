export type ErrorState = {
  code: string;
  message: string;
};

export function formatBytes(value: number): string {
  return `${value.toLocaleString()} B`;
}

export function formatUriForDisplay(uri: string): string {
  const scheme = uri.match(/^([a-z][a-z\d+.-]*):/i)?.[1] ?? 'file';
  const filename = uri.split('/').filter(Boolean).at(-1) ?? 'output';
  return `${scheme}://…/${decodeURIComponent(filename)}`;
}

export function parseOptionalPositiveInteger(
  value: string
): number | undefined {
  const trimmed = value.trim();

  if (trimmed.length === 0 || !/^\d+$/.test(trimmed)) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function toErrorState(error: unknown): ErrorState {
  if (isRecord(error)) {
    return {
      code: typeof error.code === 'string' ? error.code : 'ERR_UNKNOWN',
      message:
        typeof error.message === 'string'
          ? error.message
          : 'Native operation failed.',
    };
  }

  if (error instanceof Error) {
    return { code: 'ERR_UNKNOWN', message: error.message };
  }

  return { code: 'ERR_UNKNOWN', message: 'Native operation failed.' };
}

export function recoveryForErrorCode(code: string): string {
  switch (code) {
    case 'ERR_NATIVE_MODULE_UNAVAILABLE':
      return 'Install native dependencies and rebuild the application binary.';
    case 'ERR_UNSUPPORTED_SOURCE':
    case 'ERR_FILE_ACCESS':
      return 'Choose an app-readable local file and keep picker access alive until compression finishes.';
    case 'ERR_UNSUPPORTED_FORMAT':
    case 'ERR_NOT_IMPLEMENTED':
      return 'Use the runtime capability list to select JPEG, PNG, or an available WebP fallback.';
    case 'ERR_INVALID_OPTIONS':
      return 'Review quality, maxBytes, resize bounds, output format, and metadata values.';
    case 'ERR_DECODE_FAILED':
      return 'Choose a complete, runtime-decodable local image.';
    case 'ERR_ENCODE_FAILED':
      return 'Try a supported output format or remove an unreachable target-size constraint.';
    default:
      return 'Retry with the bundled sample and include sanitized environment details in a bug report.';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
