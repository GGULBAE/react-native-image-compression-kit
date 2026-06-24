import { ImageCompressionKitError } from './errors';
import type {
  CompressionResult,
  ImageCompressionCapabilities,
  NormalizedCompressionOptions,
} from './types';

export const NATIVE_MODULE_NAME = 'ImageCompressionKit';

export interface NativeImageCompressionKitModule {
  compressImage(
    options: NormalizedCompressionOptions
  ): Promise<CompressionResult>;
  getImageCompressionCapabilities(): Promise<ImageCompressionCapabilities>;
}

type ReactNativeRuntime = {
  NativeModules?: Record<string, unknown>;
  TurboModuleRegistry?: {
    get?: <T>(name: string) => T | null;
  };
};

declare const require: ((moduleName: string) => unknown) | undefined;

let testNativeModule: NativeImageCompressionKitModule | null | undefined;

export function getNativeModule(): NativeImageCompressionKitModule {
  const nativeModule =
    testNativeModule !== undefined
      ? testNativeModule
      : resolveNativeModuleFromReactNative();

  if (nativeModule) {
    return nativeModule;
  }

  throw new ImageCompressionKitError(
    'ERR_NATIVE_MODULE_UNAVAILABLE',
    `Native module ${NATIVE_MODULE_NAME} is unavailable. The TypeScript API is scaffolded, but Android and iOS implementations have not been added yet.`
  );
}

export function setNativeModuleForTesting(
  nativeModule: NativeImageCompressionKitModule | null
): void {
  testNativeModule = nativeModule;
}

export function resetNativeModuleForTesting(): void {
  testNativeModule = undefined;
}

function resolveNativeModuleFromReactNative():
  | NativeImageCompressionKitModule
  | null {
  const reactNative = loadReactNativeRuntime();

  const turboModule = reactNative?.TurboModuleRegistry?.get?.<
    NativeImageCompressionKitModule
  >(NATIVE_MODULE_NAME);

  if (isNativeModule(turboModule)) {
    return turboModule;
  }

  const legacyModule = reactNative?.NativeModules?.[NATIVE_MODULE_NAME];

  if (isNativeModule(legacyModule)) {
    return legacyModule;
  }

  return null;
}

function loadReactNativeRuntime(): ReactNativeRuntime | null {
  if (typeof require !== 'function') {
    return null;
  }

  try {
    return require('react-native') as ReactNativeRuntime;
  } catch {
    return null;
  }
}

function isNativeModule(
  value: unknown
): value is NativeImageCompressionKitModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as NativeImageCompressionKitModule).compressImage ===
      'function' &&
    typeof (value as NativeImageCompressionKitModule)
      .getImageCompressionCapabilities === 'function'
  );
}
