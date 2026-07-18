import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  METADATA_POLICIES,
  compressImage,
  getImageCompressionCapabilities,
  type CompressionOptions,
  type CompressionResult,
  type ImageCompressionCapabilities,
  type MetadataPolicy,
  type OutputFormat,
  type ResizeMode,
} from 'react-native-image-compression-kit';
import { SAMPLE_MODULE } from './exampleNative';
import {
  emitIOSSmokeLog,
  runIOSHostAppSmokeValidation,
} from './iosSmoke';
import {
  toErrorState,
  type ErrorState,
} from './exampleUtils';
import { ResultLine } from './components/ResultLine';
import { ResultPanel } from './components/ResultPanel';
import { SourcePanel } from './components/SourcePanel';
import { useCompressionForm } from './useCompressionForm';
import { runNativeDemoCapture } from './demoCapture';

const EXAMPLE_OUTPUT_FORMATS: OutputFormat[] = ['jpeg', 'png', 'webp'];
const RESIZE_MODES: ResizeMode[] = ['contain', 'cover', 'stretch'];

export default function App(): React.JSX.Element {
  const scrollViewRef = useRef<ScrollView>(null);
  const [sourceUri, setSourceUri] = useState('');
  const {
    qualityText,
    setQualityText,
    quality,
    maxBytesText,
    setMaxBytesText,
    maxBytes,
    outputFormat,
    setOutputFormat,
    maxWidthText,
    setMaxWidthText,
    maxHeightText,
    setMaxHeightText,
    resizeMode,
    setResizeMode,
    resizeOptions,
    metadataPolicy,
    setMetadataPolicy,
  } = useCompressionForm();
  const [capabilities, setCapabilities] =
    useState<ImageCompressionCapabilities | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [resultMetadataPolicy, setResultMetadataPolicy] =
    useState<MetadataPolicy | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const supportedOutputFormats =
    capabilities?.formats
      .filter((capability) => capability.output)
      .map((capability) => capability.format) ?? [];
  const supportsSelectedTargetSize =
    capabilities?.supportsTargetSizeCompression === true &&
    supportedOutputFormats.includes(outputFormat) &&
    (outputFormat === 'jpeg' || outputFormat === 'webp');

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
      setResult(null);
    } catch (nativeError) {
      setError(toErrorState(nativeError));
    } finally {
      setIsLoadingSample(false);
    }
  }, []);

  const pickImage = useCallback(async () => {
    setIsPickingImage(true);
    setError(null);

    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
        includeExtra: false,
      });

      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        setError({
          code: `ERR_PICKER_${response.errorCode.toUpperCase()}`,
          message: response.errorMessage ?? 'The gallery picker failed.',
        });
        return;
      }

      const uri = response.assets?.[0]?.uri;
      if (!uri) {
        setError({
          code: 'ERR_PICKER_EMPTY_RESULT',
          message: 'The gallery picker did not return a local image URI.',
        });
        return;
      }

      setSourceUri(uri);
      setResult(null);
      setResultMetadataPolicy(null);
    } catch (pickerError) {
      setError(toErrorState(pickerError));
    } finally {
      setIsPickingImage(false);
    }
  }, []);

  useEffect(() => {
    void loadSample();
  }, [loadSample]);

  useEffect(() => {
    let isMounted = true;

    SAMPLE_MODULE?.isDemoCaptureEnabled?.()
      .then(async (enabled) => {
        if (!enabled || !isMounted || !SAMPLE_MODULE) return;

        setIsCompressing(true);
        setError(null);
        try {
          const capture = await runNativeDemoCapture(
            SAMPLE_MODULE,
            Platform.OS === 'ios' ? 'ios' : 'android'
          );
          if (!isMounted) return;
          setSourceUri(capture.sourceUri);
          setCapabilities(capture.capabilities);
          setResult(capture.result);
          setResultMetadataPolicy('safe');
          await emitIOSSmokeLog(capture.log);
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 500);
        } catch (captureError) {
          const errorState = toErrorState(captureError);
          await emitIOSSmokeLog(
            `RNICK_DEMO_FAIL ${errorState.code} ${errorState.message}`
          );
          if (isMounted) setError(errorState);
        } finally {
          if (isMounted) setIsCompressing(false);
        }
      })
      .catch((captureError) => {
        if (isMounted) setError(toErrorState(captureError));
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>Native example</Text>
        <Text style={styles.title}>Compression playground</Text>
        <Text style={styles.subtitle}>
          Pick a local image or keep the deterministic sample, then compare the
          native output and runtime capability evidence.
        </Text>

        <SourcePanel
          isLoadingSample={isLoadingSample}
          isPickingImage={isPickingImage}
          onChangeSource={setSourceUri}
          onLoadSample={loadSample}
          onPickImage={pickImage}
          sourceUri={sourceUri}
        />

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
                  color={outputFormat === format ? '#0f766e' : '#667085'}
                  disabled={
                    capabilities !== null &&
                    !supportedOutputFormats.includes(format)
                  }
                  onPress={() => setOutputFormat(format)}
                  title={format}
                />
              </View>
            ))}
          </View>
          <Text style={styles.helperText}>
            Unavailable output formats are disabled from runtime capabilities.
          </Text>
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
                  color={resizeMode === mode ? '#0f766e' : '#667085'}
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
                    color={metadataPolicy === policy ? '#0f766e' : '#667085'}
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

        <ResultPanel
          error={error}
          metadataPolicy={metadataPolicy}
          result={result}
          resultMetadataPolicy={resultMetadataPolicy}
          sourceUri={sourceUri}
        />
      </ScrollView>
    </View>
  );
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
  eyebrow: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
  helperText: {
    color: '#667085',
    fontSize: 12,
    lineHeight: 18,
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
});
