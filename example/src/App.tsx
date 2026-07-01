import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  NativeModules,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  METADATA_POLICIES,
  compressImage,
  getImageCompressionCapabilities,
  type CompressionOptions,
  type CompressionResult,
  type ImageFormat,
  type ImageCompressionCapabilities,
  type MetadataPolicy,
  type OutputFormat,
  type ResizeMode,
} from 'react-native-image-compression-kit';

type ErrorState = {
  code: string;
  message: string;
};

type ExampleImageSourceModule = {
  copySampleJpegToCache: () => Promise<string>;
  copySamplePngToCache?: () => Promise<string>;
  copyUnsupportedImageToCache?: (format: string) => Promise<string>;
  isSmokeTestEnabled?: () => Promise<boolean>;
  logSmokeEvent?: (message: string) => Promise<void>;
};

type IOSSmokeSampleModule = ExampleImageSourceModule & {
  copySamplePngToCache: () => Promise<string>;
  copyUnsupportedImageToCache: (format: string) => Promise<string>;
};

const DEFAULT_QUALITY = '72';
const EXAMPLE_OUTPUT_FORMATS: OutputFormat[] = ['jpeg', 'png', 'webp'];
const RESIZE_MODES: ResizeMode[] = ['contain', 'cover', 'stretch'];
const IOS_SMOKE_STEP_TIMEOUT_MS = 30_000;
const SAMPLE_MODULE = NativeModules.ExampleImageSource as
  | ExampleImageSourceModule
  | undefined;

export default function App(): React.JSX.Element {
  const [sourceUri, setSourceUri] = useState('');
  const [qualityText, setQualityText] = useState(DEFAULT_QUALITY);
  const [maxBytesText, setMaxBytesText] = useState('');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('jpeg');
  const [maxWidthText, setMaxWidthText] = useState('');
  const [maxHeightText, setMaxHeightText] = useState('');
  const [resizeMode, setResizeMode] = useState<ResizeMode>('contain');
  const [metadataPolicy, setMetadataPolicy] =
    useState<MetadataPolicy>('safe');
  const [capabilities, setCapabilities] =
    useState<ImageCompressionCapabilities | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [resultMetadataPolicy, setResultMetadataPolicy] =
    useState<MetadataPolicy | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const quality = useMemo(() => {
    const parsed = Number.parseInt(qualityText, 10);

    if (!Number.isFinite(parsed)) {
      return DEFAULT_QUALITY;
    }

    return String(Math.min(100, Math.max(0, parsed)));
  }, [qualityText]);

  const resizeOptions = useMemo<CompressionOptions['resize']>(() => {
    const maxWidth = parseOptionalPositiveInteger(maxWidthText);
    const maxHeight = parseOptionalPositiveInteger(maxHeightText);

    if (maxWidth === undefined && maxHeight === undefined) {
      return undefined;
    }

    return {
      ...(maxWidth !== undefined ? { maxWidth } : {}),
      ...(maxHeight !== undefined ? { maxHeight } : {}),
      mode: resizeMode,
    };
  }, [maxHeightText, maxWidthText, resizeMode]);

  const maxBytes = useMemo(
    () => parseOptionalPositiveInteger(maxBytesText),
    [maxBytesText]
  );
  const supportedOutputFormats =
    capabilities?.formats
      .filter((capability) => capability.output)
      .map((capability) => capability.format) ?? [];
  const supportsSelectedTargetSize =
    capabilities?.supportsTargetSizeCompression === true &&
    supportedOutputFormats.includes(outputFormat) &&
    outputFormat !== 'png';

  const loadSample = useCallback(async () => {
    if (!SAMPLE_MODULE) {
      setError({
        code: 'ERR_SAMPLE_MODULE_UNAVAILABLE',
        message: 'Example sample module is unavailable.',
      });
      return;
    }

    setIsLoadingSample(true);
    setError(null);

    try {
      const uri = await SAMPLE_MODULE.copySampleJpegToCache();
      setSourceUri(uri);
    } catch (nativeError) {
      setError(toErrorState(nativeError));
    } finally {
      setIsLoadingSample(false);
    }
  }, []);

  useEffect(() => {
    void loadSample();
  }, [loadSample]);

  useEffect(() => {
    let isMounted = true;

    if (Platform.OS !== 'ios' || !SAMPLE_MODULE?.isSmokeTestEnabled) {
      return () => {
        isMounted = false;
      };
    }

    SAMPLE_MODULE.isSmokeTestEnabled()
      .then(async (enabled) => {
        if (!enabled || !isMounted) {
          return;
        }

        try {
          const smokeSummary = await runIOSHostAppSmokeValidation();
          await emitIOSSmokeLog(
            `RNICK_IOS_SMOKE_PASS ${JSON.stringify(smokeSummary)}`
          );
        } catch (smokeError) {
          const errorState = toErrorState(smokeError);
          await emitIOSSmokeLog(
            `RNICK_IOS_SMOKE_FAIL ${errorState.code} ${errorState.message}`
          );

          if (isMounted) {
            setError(errorState);
          }
        }
      })
      .catch(async (nativeError) => {
        const errorState = toErrorState(nativeError);
        await emitIOSSmokeLog(
          `RNICK_IOS_SMOKE_FAIL ${errorState.code} ${errorState.message}`
        );

        if (isMounted) {
          setError(errorState);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    getImageCompressionCapabilities()
      .then((nextCapabilities) => {
        if (isMounted) {
          setCapabilities(nextCapabilities);
        }
      })
      .catch((nativeError) => {
        if (isMounted) {
          setError(toErrorState(nativeError));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const runCompression = useCallback(async () => {
    setIsCompressing(true);
    setResult(null);
    setResultMetadataPolicy(null);
    setError(null);

    try {
      const outputOptions: CompressionOptions['output'] = {
        format: outputFormat,
        quality: Number.parseInt(quality, 10),
      };

      if (maxBytes !== undefined && supportsSelectedTargetSize) {
        outputOptions.maxBytes = maxBytes;
      }

      const compressionOptions: CompressionOptions = {
        source: { uri: sourceUri.trim() },
        output: outputOptions,
        metadata: metadataPolicy,
      };

      if (resizeOptions) {
        compressionOptions.resize = resizeOptions;
      }

      const nextResult = await compressImage(compressionOptions);

      setResult(nextResult);
      setResultMetadataPolicy(metadataPolicy);
    } catch (nativeError) {
      setError(toErrorState(nativeError));
    } finally {
      setIsCompressing(false);
    }
  }, [
    maxBytes,
    metadataPolicy,
    outputFormat,
    quality,
    resizeOptions,
    sourceUri,
    supportsSelectedTargetSize,
  ]);

  const jpegCapability = capabilities?.formats.find(
    (capability) => capability.format === 'jpeg'
  );
  const supportedMetadataPolicies = capabilities?.metadataPolicies ?? [];
  const canSubmit = sourceUri.trim().length > 0 && !isCompressing;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Image Compression Kit</Text>
        <Text style={styles.subtitle}>Android MVP / iOS JPEG+PNG+GIF+WebP MVP</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Source URI</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            onChangeText={setSourceUri}
            placeholder="file:///data/user/0/... or content://..."
            style={[styles.input, styles.uriInput]}
            value={sourceUri}
          />
          <Button
            disabled={isLoadingSample}
            onPress={loadSample}
            title={isLoadingSample ? 'Loading sample' : 'Use bundled sample'}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.qualityField}>
            <Text style={styles.label}>Quality</Text>
            <TextInput
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={setQualityText}
              style={styles.input}
              value={qualityText}
            />
          </View>
          <View style={styles.qualityField}>
            <Text style={styles.label}>Max bytes</Text>
            <TextInput
              editable={supportsSelectedTargetSize}
              keyboardType="number-pad"
              onChangeText={setMaxBytesText}
              placeholder={supportsSelectedTargetSize ? 'optional' : 'jpeg/webp'}
              style={[
                styles.input,
                !supportsSelectedTargetSize ? styles.disabledInput : null,
              ]}
              value={maxBytesText}
            />
          </View>
          <View style={styles.action}>
            {isCompressing ? (
              <ActivityIndicator size="small" />
            ) : (
              <Button
                disabled={!canSubmit}
                onPress={runCompression}
                title="Compress"
              />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Output</Text>
          <View style={styles.modeRow}>
            {EXAMPLE_OUTPUT_FORMATS.map((format) => (
              <View key={format} style={styles.modeButton}>
                <Button
                  color={outputFormat === format ? '#175cd3' : '#667085'}
                  onPress={() => setOutputFormat(format)}
                  title={format}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resize</Text>
          <View style={styles.row}>
            <View style={styles.compactField}>
              <Text style={styles.label}>Max width</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setMaxWidthText}
                placeholder="optional"
                style={styles.input}
                value={maxWidthText}
              />
            </View>
            <View style={styles.compactField}>
              <Text style={styles.label}>Max height</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setMaxHeightText}
                placeholder="optional"
                style={styles.input}
                value={maxHeightText}
              />
            </View>
          </View>
          <View style={styles.modeRow}>
            {RESIZE_MODES.map((mode) => (
              <View key={mode} style={styles.modeButton}>
                <Button
                  color={resizeMode === mode ? '#175cd3' : '#667085'}
                  onPress={() => setResizeMode(mode)}
                  title={mode}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metadata</Text>
          <View style={styles.modeRow}>
            {METADATA_POLICIES.map((policy) => {
              const isSupported =
                capabilities === null ||
                supportedMetadataPolicies.includes(policy);

              return (
                <View key={policy} style={styles.modeButton}>
                  <Button
                    color={metadataPolicy === policy ? '#175cd3' : '#667085'}
                    disabled={!isSupported}
                    onPress={() => setMetadataPolicy(policy)}
                    title={policy}
                  />
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Native Capability</Text>
          <ResultLine
            label="platform"
            value={capabilities?.platform ?? 'loading'}
          />
          <ResultLine
            label="jpeg input"
            value={String(jpegCapability?.input ?? false)}
          />
          <ResultLine
            label="jpeg output"
            value={String(jpegCapability?.output ?? false)}
          />
          <ResultLine label="selected output" value={outputFormat} />
          <ResultLine
            label="output formats"
            value={
              supportedOutputFormats.length > 0
                ? supportedOutputFormats.join(', ')
                : 'loading'
            }
          />
          <ResultLine label="selected metadata" value={metadataPolicy} />
          <ResultLine
            label="metadataPolicies"
            value={
              supportedMetadataPolicies.length > 0
                ? supportedMetadataPolicies.join(', ')
                : 'loading'
            }
          />
        </View>

        {result ? (
          <View style={[styles.section, styles.successSection]}>
            <Text style={styles.sectionTitle}>Result</Text>
            <ResultLine label="uri" value={result.uri} />
            <ResultLine label="format" value={result.format} />
            <ResultLine
              label="metadata"
              value={resultMetadataPolicy ?? metadataPolicy}
            />
            <ResultLine label="width" value={String(result.width)} />
            <ResultLine label="height" value={String(result.height)} />
            <ResultLine label="byteSize" value={formatBytes(result.byteSize)} />
            <ResultLine
              label="originalByteSize"
              value={formatBytes(result.originalByteSize)}
            />
            <ResultLine
              label="compressionRatio"
              value={result.compressionRatio.toFixed(3)}
            />
          </View>
        ) : null}

        {error ? (
          <View style={[styles.section, styles.errorSection]}>
            <Text style={styles.sectionTitle}>Error</Text>
            <ResultLine label="code" value={error.code} />
            <ResultLine label="message" value={error.message} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resultLine}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text selectable style={styles.resultValue}>
        {value}
      </Text>
    </View>
  );
}

async function emitIOSSmokeLog(message: string): Promise<void> {
  console.log(message);

  try {
    await SAMPLE_MODULE?.logSmokeEvent?.(message);
  } catch {
    // The Metro console log above is still useful when native logging is unavailable.
  }
}

type IOSHostAppSmokeSummary = {
  platform: 'ios';
  jpegResultBytes: number;
  pngResultBytes: number;
  gifResultBytes: number;
  webpResultBytes: number;
  jpegToPngResultBytes: number;
  pngToPngResultBytes: number;
  gifToPngResultBytes: number;
  webpToPngResultBytes: number;
  targetSizeResultBytes: number;
  unsupportedInputs: string[];
  unsupportedOutputs: string[];
};

async function runIOSHostAppSmokeValidation(): Promise<IOSHostAppSmokeSummary> {
  await emitIOSSmokeLog('RNICK_IOS_SMOKE_START');

  const sampleModule = SAMPLE_MODULE;
  assertIOSSmokeSampleModule(sampleModule);
  const copySampleJpegToCache = sampleModule.copySampleJpegToCache;
  const copySamplePngToCache = sampleModule.copySamplePngToCache;
  const copyUnsupportedImageToCache =
    sampleModule.copyUnsupportedImageToCache;

  const capabilities = await runIOSSmokeStep('capabilities', () =>
    getImageCompressionCapabilities()
  );
  assertIOSSmoke(
    capabilities.platform === 'ios',
    `Expected iOS capabilities, received ${capabilities.platform}.`
  );
  assertIOSFormatCapability(capabilities, 'jpeg', true, true);
  assertIOSFormatCapability(capabilities, 'png', true, true);
  assertIOSFormatCapability(capabilities, 'gif', true, false);
  assertIOSFormatCapability(capabilities, 'webp', true, false);
  assertIOSSmoke(
    capabilities.metadataPolicies.join(',') === 'safe,strip',
    `Expected iOS metadata policies safe,strip, received ${capabilities.metadataPolicies.join(',')}.`
  );
  assertIOSSmoke(
    capabilities.supportsTargetSizeCompression === true,
    'Expected iOS JPEG target-size compression to be supported.'
  );
  assertIOSSmoke(
    capabilities.supportsCancellation === false,
    'Expected iOS cancellation to be unsupported.'
  );

  const jpegUri = await runIOSSmokeStep('copy-jpeg-fixture', () =>
    copySampleJpegToCache()
  );
  const pngUri = await runIOSSmokeStep('copy-png-fixture', () =>
    copySamplePngToCache()
  );
  const gifUri = await runIOSSmokeStep('copy-gif-fixture', () =>
    copyUnsupportedImageToCache('gif')
  );
  const webpUri = await runIOSSmokeStep('copy-webp-fixture', () =>
    copyUnsupportedImageToCache('webp')
  );
  const targetSizeMaxBytes = 1_000;
  const jpegResult = await runIOSSmokeStep('compress-jpeg-to-jpeg', () =>
    compressImage({
      source: { uri: jpegUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: { format: 'jpeg', quality: 68 },
      metadata: 'safe',
    })
  );
  const pngResult = await runIOSSmokeStep('compress-png-to-jpeg', () =>
    compressImage({
      source: { uri: pngUri },
      resize: { maxWidth: 18, maxHeight: 12, mode: 'cover' },
      output: { format: 'jpeg', quality: 72 },
      metadata: 'strip',
    })
  );
  const gifResult = await runIOSSmokeStep('compress-gif-to-jpeg', () =>
    compressImage({
      source: { uri: gifUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: {
        format: 'jpeg',
        quality: 74,
        maxBytes: targetSizeMaxBytes,
      },
      metadata: 'safe',
    })
  );
  const webpResult = await runIOSSmokeStep('compress-webp-to-jpeg', () =>
    compressImage({
      source: { uri: webpUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: {
        format: 'jpeg',
        quality: 74,
        maxBytes: targetSizeMaxBytes,
      },
      metadata: 'safe',
    })
  );

  assertCompressionResult(jpegResult, 'jpeg');
  assertCompressionResult(pngResult, 'jpeg');
  assertCompressionResult(gifResult, 'jpeg');
  assertCompressionResult(webpResult, 'jpeg');
  assertIOSSmoke(
    gifResult.byteSize <= targetSizeMaxBytes,
    `Expected iOS GIF target-size output <= ${targetSizeMaxBytes} bytes, received ${gifResult.byteSize}.`
  );
  assertIOSSmoke(
    webpResult.byteSize <= targetSizeMaxBytes,
    `Expected iOS WebP target-size output <= ${targetSizeMaxBytes} bytes, received ${webpResult.byteSize}.`
  );

  const jpegToPngResult = await runIOSSmokeStep('compress-jpeg-to-png', () =>
    compressImage({
      source: { uri: jpegUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: { format: 'png', quality: 10 },
      metadata: 'safe',
    })
  );
  const pngToPngResult = await runIOSSmokeStep('compress-png-to-png', () =>
    compressImage({
      source: { uri: pngUri },
      resize: { maxWidth: 18, maxHeight: 12, mode: 'cover' },
      output: { format: 'png', quality: 10 },
      metadata: 'strip',
    })
  );
  const gifToPngResult = await runIOSSmokeStep('compress-gif-to-png', () =>
    compressImage({
      source: { uri: gifUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: { format: 'png', quality: 10 },
      metadata: 'strip',
    })
  );
  const webpToPngResult = await runIOSSmokeStep('compress-webp-to-png', () =>
    compressImage({
      source: { uri: webpUri },
      resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
      output: { format: 'png', quality: 10 },
      metadata: 'strip',
    })
  );

  assertCompressionResult(jpegToPngResult, 'png');
  assertCompressionResult(pngToPngResult, 'png');
  assertCompressionResult(gifToPngResult, 'png');
  assertCompressionResult(webpToPngResult, 'png');

  const targetSizeResult = await runIOSSmokeStep(
    'compress-jpeg-to-jpeg-max-bytes',
    () =>
      compressImage({
        source: { uri: jpegUri },
        resize: { maxWidth: 16, maxHeight: 16, mode: 'contain' },
        output: {
          format: 'jpeg',
          quality: 90,
          maxBytes: targetSizeMaxBytes,
        },
        metadata: 'safe',
      })
  );
  assertCompressionResult(targetSizeResult, 'jpeg');
  assertIOSSmoke(
    targetSizeResult.byteSize <= targetSizeMaxBytes,
    `Expected iOS target-size output <= ${targetSizeMaxBytes} bytes, received ${targetSizeResult.byteSize}.`
  );

  await runIOSSmokeStep('reject-png-max-bytes', () =>
    expectNativeErrorCode(
      () =>
        compressImage({
          source: { uri: pngUri },
          output: { format: 'png', quality: 70, maxBytes: targetSizeMaxBytes },
          metadata: 'safe',
        }),
      'ERR_NOT_IMPLEMENTED',
      'Expected PNG maxBytes to be unsupported on iOS.'
    )
  );

  const unsupportedInputs = ['heic', 'heif', 'avif'];
  for (const format of unsupportedInputs) {
    const unsupportedUri = await runIOSSmokeStep(
      `copy-unsupported-${format}-fixture`,
      () => copyUnsupportedImageToCache(format)
    );
    await runIOSSmokeStep(`reject-${format}-input`, () =>
      expectNativeErrorCode(
        () =>
          compressImage({
            source: { uri: unsupportedUri },
            output: { format: 'jpeg', quality: 70 },
            metadata: 'safe',
          }),
        'ERR_UNSUPPORTED_FORMAT',
        `Expected ${format} input to be unsupported on iOS.`
      )
    );
  }

  const unsupportedOutputCases = [
    { format: 'webp', step: 'reject-webp-output' },
    { format: 'heic', step: 'reject-heic-output' },
    { format: 'heif', step: 'reject-heif-output' },
    { format: 'avif', step: 'reject-avif-output' },
  ] as const;
  for (const { format, step } of unsupportedOutputCases) {
    await runIOSSmokeStep(step, () =>
      expectNativeErrorCode(
        () =>
          compressImage({
            source: { uri: jpegUri },
            output: { format, quality: 70 },
            metadata: 'safe',
          }),
        'ERR_NOT_IMPLEMENTED',
        `Expected ${format} output to be unimplemented on iOS.`
      )
    );
  }

  await runIOSSmokeStep('reject-gif-output', () =>
    expectNativeErrorCode(
      () =>
        compressImage({
          source: { uri: jpegUri },
          output: { format: 'gif' as OutputFormat, quality: 70 },
          metadata: 'safe',
        }),
      'ERR_INVALID_OPTIONS',
      'Expected GIF output to be rejected before native compression.'
    )
  );

  await runIOSSmokeStep('reject-metadata-preserve', () =>
    expectNativeErrorCode(
      () =>
        compressImage({
          source: { uri: jpegUri },
          output: { format: 'jpeg', quality: 70 },
          metadata: 'preserve',
        }),
      'ERR_NOT_IMPLEMENTED',
      "Expected metadata: 'preserve' to be unimplemented on iOS."
    )
  );

  return {
    platform: 'ios',
    jpegResultBytes: jpegResult.byteSize,
    pngResultBytes: pngResult.byteSize,
    gifResultBytes: gifResult.byteSize,
    webpResultBytes: webpResult.byteSize,
    jpegToPngResultBytes: jpegToPngResult.byteSize,
    pngToPngResultBytes: pngToPngResult.byteSize,
    gifToPngResultBytes: gifToPngResult.byteSize,
    webpToPngResultBytes: webpToPngResult.byteSize,
    targetSizeResultBytes: targetSizeResult.byteSize,
    unsupportedInputs,
    unsupportedOutputs: unsupportedOutputCases.map(({ format }) => format),
  };
}

function assertIOSSmokeSampleModule(
  module: ExampleImageSourceModule | undefined
): asserts module is IOSSmokeSampleModule {
  if (
    !module?.copySampleJpegToCache ||
    !module.copySamplePngToCache ||
    !module.copyUnsupportedImageToCache
  ) {
    throw new Error('iOS smoke sample module methods are unavailable.');
  }
}

async function runIOSSmokeStep<T>(
  name: string,
  action: () => Promise<T>
): Promise<T> {
  await emitIOSSmokeLog(`RNICK_IOS_SMOKE_STEP_START ${name}`);

  try {
    const result = await withIOSSmokeTimeout(name, action());
    await emitIOSSmokeLog(`RNICK_IOS_SMOKE_STEP_PASS ${name}`);
    return result;
  } catch (error) {
    const errorState = toErrorState(error);
    await emitIOSSmokeLog(
      `RNICK_IOS_SMOKE_STEP_FAIL ${name} ${errorState.code} ${errorState.message}`
    );
    throw error;
  }
}

function withIOSSmokeTimeout<T>(name: string, promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject({
        code: 'ERR_IOS_SMOKE_TIMEOUT',
        message: `Timed out while waiting for iOS smoke step: ${name}.`,
      });
    }, IOS_SMOKE_STEP_TIMEOUT_MS);

    promise.then(
      (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function assertIOSFormatCapability(
  capabilities: ImageCompressionCapabilities,
  format: ImageFormat,
  expectedInput: boolean,
  expectedOutput: boolean
): void {
  const capability = capabilities.formats.find(
    (candidate) => candidate.format === format
  );

  assertIOSSmoke(!!capability, `Missing ${format} capability.`);
  assertIOSSmoke(
    capability.input === expectedInput,
    `Expected ${format} input=${expectedInput}, received ${capability.input}.`
  );
  assertIOSSmoke(
    capability.output === expectedOutput,
    `Expected ${format} output=${expectedOutput}, received ${capability.output}.`
  );
}

function assertCompressionResult(
  result: CompressionResult,
  format: OutputFormat
): void {
  assertIOSSmoke(result.format === format, `Expected result format ${format}.`);
  assertIOSSmoke(result.uri.startsWith('file://'), 'Expected file:// result URI.');
  assertIOSSmoke(result.width > 0, 'Expected positive result width.');
  assertIOSSmoke(result.height > 0, 'Expected positive result height.');
  assertIOSSmoke(result.byteSize > 0, 'Expected positive result byteSize.');
  assertIOSSmoke(
    result.originalByteSize > 0,
    'Expected positive result originalByteSize.'
  );
}

async function expectNativeErrorCode(
  action: () => Promise<unknown>,
  expectedCode: string,
  message: string
): Promise<void> {
  try {
    await action();
  } catch (error) {
    const errorState = toErrorState(error);
    assertIOSSmoke(
      errorState.code === expectedCode,
      `${message} Received ${errorState.code}: ${errorState.message}`
    );
    return;
  }

  throw new Error(message);
}

function assertIOSSmoke(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function formatBytes(value: number): string {
  return `${value.toLocaleString()} B`;
}

function parseOptionalPositiveInteger(value: string): number | undefined {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }

  const parsed = Number(trimmed);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function toErrorState(error: unknown): ErrorState {
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
    return {
      code: 'ERR_UNKNOWN',
      message: error.message,
    };
  }

  return {
    code: 'ERR_UNKNOWN',
    message: 'Native operation failed.',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8fa',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  title: {
    color: '#101828',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#475467',
    fontSize: 15,
  },
  section: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d5dd',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  sectionTitle: {
    color: '#101828',
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#98a2b3',
    borderRadius: 6,
    borderWidth: 1,
    color: '#101828',
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  disabledInput: {
    backgroundColor: '#f2f4f7',
    color: '#667085',
  },
  uriInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  row: {
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 12,
  },
  qualityField: {
    flex: 1,
    gap: 8,
    minWidth: 112,
  },
  compactField: {
    flex: 1,
    gap: 8,
    minWidth: 112,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
  },
  action: {
    minWidth: 120,
    minHeight: 44,
    justifyContent: 'center',
  },
  successSection: {
    borderColor: '#27a376',
  },
  errorSection: {
    borderColor: '#d92d20',
  },
  resultLine: {
    gap: 4,
  },
  resultLabel: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  resultValue: {
    color: '#101828',
    fontSize: 14,
  },
});
