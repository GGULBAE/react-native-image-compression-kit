import { ImageCompressionKitError, normalizeNativeError } from './errors';
import { getNativeModule } from './nativeModule';
import type {
  CompressionOptions,
  CompressionAbortSignal,
  CompressionControl,
  CompressionResult,
  ImageCompressionCapabilities,
} from './types';
import { normalizeCompressionOptions } from './validation';

export async function compressImage(
  options: CompressionOptions,
  control?: CompressionControl | CompressionAbortSignal
): Promise<CompressionResult> {
  const normalizedOptions = normalizeCompressionOptions(options);
  const signal = getAbortSignal(control);

  if (signal?.aborted) {
    throw cancelledError(signal.reason);
  }

  const operationId = createOperationId();
  const nativeModule = getNativeModule();

  return await new Promise<CompressionResult>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };
    const settleResolve = (result: CompressionResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const settleReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(normalizeNativeError(error));
    };
    const onAbort = () => {
      if (settled) return;
      try {
        nativeModule.cancelCompression(operationId);
      } catch {
        // Cancellation remains deterministic even if the native bridge is
        // already invalidating and cannot accept the best-effort signal.
      }
      settleReject(cancelledError(signal?.reason));
    };

    signal?.addEventListener('abort', onAbort, { once: true });

    if (signal?.aborted) {
      onAbort();
      return;
    }

    nativeModule
      .compressImage({ ...normalizedOptions, operationId })
      .then(settleResolve, settleReject);
  });
}

export async function getImageCompressionCapabilities(): Promise<ImageCompressionCapabilities> {
  try {
    return await getNativeModule().getImageCompressionCapabilities();
  } catch (error) {
    throw normalizeNativeError(error);
  }
}

let operationSequence = 0;

function createOperationId(): string {
  operationSequence = (operationSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `rnick-${Date.now().toString(36)}-${operationSequence.toString(36)}`;
}

function getAbortSignal(
  control?: CompressionControl | CompressionAbortSignal
): CompressionAbortSignal | undefined {
  if (control === undefined) return undefined;
  return 'signal' in control ? control.signal : control;
}

function cancelledError(reason: unknown): ImageCompressionKitError {
  const message =
    reason instanceof Error && reason.message
      ? `Image compression was cancelled: ${reason.message}`
      : 'Image compression was cancelled.';
  return new ImageCompressionKitError('ERR_CANCELLED', message, {
    cause: reason,
  });
}
