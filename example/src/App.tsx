import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  NativeModules,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  compressImage,
  getImageCompressionCapabilities,
  type CompressionResult,
  type ImageCompressionCapabilities,
} from 'react-native-image-compression-kit';

type ErrorState = {
  code: string;
  message: string;
};

type ExampleImageSourceModule = {
  copySampleJpegToCache: () => Promise<string>;
};

const DEFAULT_QUALITY = '72';
const SAMPLE_MODULE = NativeModules.ExampleImageSource as
  | ExampleImageSourceModule
  | undefined;

export default function App(): React.JSX.Element {
  const [sourceUri, setSourceUri] = useState('');
  const [qualityText, setQualityText] = useState(DEFAULT_QUALITY);
  const [capabilities, setCapabilities] =
    useState<ImageCompressionCapabilities | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
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
    setError(null);

    try {
      const nextResult = await compressImage({
        source: { uri: sourceUri.trim() },
        output: {
          format: 'jpeg',
          quality: Number.parseInt(quality, 10),
        },
      });

      setResult(nextResult);
    } catch (nativeError) {
      setError(toErrorState(nativeError));
    } finally {
      setIsCompressing(false);
    }
  }, [quality, sourceUri]);

  const jpegCapability = capabilities?.formats.find(
    (capability) => capability.format === 'jpeg'
  );
  const canSubmit = sourceUri.trim().length > 0 && !isCompressing;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Image Compression Kit</Text>
        <Text style={styles.subtitle}>Android JPEG MVP</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Source URI</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            onChangeText={setSourceUri}
            placeholder="file:///data/user/0/..."
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
        </View>

        {result ? (
          <View style={[styles.section, styles.successSection]}>
            <Text style={styles.sectionTitle}>Result</Text>
            <ResultLine label="uri" value={result.uri} />
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

function formatBytes(value: number): string {
  return `${value.toLocaleString()} B`;
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
  uriInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
  },
  qualityField: {
    flex: 1,
    gap: 8,
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
