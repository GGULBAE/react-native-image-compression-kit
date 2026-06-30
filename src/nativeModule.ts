import { ImageCompressionKitError } from './errors';
import type { Spec as NativeImageCompressionKitSpec } from './NativeImageCompressionKit';
import type {
  CompressionResult,
  ImageCompressionCapabilities,
  NormalizedCompressionOptions,
} from './types';

export const NATIVE_MODULE_NAME = 'ImageCompressionKit';

export type NativeImageCompressionKitModule = NativeImageCompressionKitSpec;

type NativeModuleContractCheck = {
  compressImage(
    options: NormalizedCompressionOptions
  ): Promise<CompressionResult>;
  getImageCompressionCapabilities(): Promise<ImageCompressionCapabilities>;
};

const _nativeModuleContractCheck: NativeImageCompressionKitModule extends NativeModuleContractCheck
  ? true
  : never = true;

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
    `Native module ${NATIVE_MODULE_NAME} is unavailable. Rebuild the React Native app after installing react-native-image-compression-kit. Android runtime compression is implemented; iOS runtime compression is implemented for JPEG/PNG input with JPEG and PNG output, including JPEG target-size maxBytes, in version 0.2.2 and later.`
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
  const codegenModule = resolveNativeModuleFromCodegenSpec();

  if (codegenModule) {
    return codegenModule;
  }

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

function resolveNativeModuleFromCodegenSpec():
  | NativeImageCompressionKitModule
  | null {
  if (typeof require !== 'function') {
    return null;
  }

  try {
    const codegenSpec = require('./NativeImageCompressionKit') as {
      default?: unknown;
    };

    return isNativeModule(codegenSpec.default) ? codegenSpec.default : null;
  } catch {
    return null;
  }
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
