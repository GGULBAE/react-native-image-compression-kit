import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type {
  CompressionResult,
  MetadataPolicy,
} from 'react-native-image-compression-kit';
import {
  formatBytes,
  formatUriForDisplay,
  recoveryForErrorCode,
  type ErrorState,
} from '../exampleUtils';
import { ResultLine } from './ResultLine';

type ResultPanelProps = {
  sourceUri: string;
  result: CompressionResult | null;
  metadataPolicy: MetadataPolicy;
  resultMetadataPolicy: MetadataPolicy | null;
  error: ErrorState | null;
};

export function ResultPanel({
  sourceUri,
  result,
  metadataPolicy,
  resultMetadataPolicy,
  error,
}: ResultPanelProps) {
  return (
    <>
      {result ? (
        <View style={[styles.section, styles.successSection]}>
          <Text style={styles.sectionTitle}>Result</Text>
          <View style={styles.comparisonRow}>
            <Preview label="Before" uri={sourceUri} />
            <Preview label="After" uri={result.uri} />
          </View>
          <ResultLine label="uri" value={formatUriForDisplay(result.uri)} />
          <ResultLine label="format" value={result.format} />
          <ResultLine
            label="metadata"
            value={resultMetadataPolicy ?? metadataPolicy}
          />
          <ResultLine label="dimensions" value={`${result.width} × ${result.height}`} />
          <ResultLine label="byteSize" value={formatBytes(result.byteSize)} />
          <ResultLine
            label="originalByteSize"
            value={formatBytes(result.originalByteSize)}
          />
          <ResultLine
            label="compressionRatio"
            value={`${result.compressionRatio.toFixed(3)} (${(
              result.compressionRatio * 100
            ).toFixed(1)}% of source bytes)`}
          />
        </View>
      ) : null}

      {error ? (
        <View style={[styles.section, styles.errorSection]}>
          <Text style={styles.sectionTitle}>Error</Text>
          <ResultLine label="code" value={error.code} />
          <ResultLine label="message" value={error.message} />
          <ResultLine
            label="recovery"
            value={recoveryForErrorCode(error.code)}
          />
        </View>
      ) : null}
    </>
  );
}

function Preview({ label, uri }: { label: string; uri: string }) {
  return (
    <View style={styles.comparisonItem}>
      <Text style={styles.comparisonLabel}>{label}</Text>
      <Image
        accessibilityLabel={`${label} compression preview`}
        resizeMode="contain"
        source={{ uri }}
        style={styles.comparisonImage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  sectionTitle: {
    color: '#101828',
    fontSize: 16,
    fontWeight: '700',
  },
  successSection: {
    backgroundColor: '#ecfdf3',
    borderColor: '#6ce9a6',
  },
  errorSection: {
    backgroundColor: '#fef3f2',
    borderColor: '#fda29b',
  },
  comparisonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  comparisonItem: {
    flex: 1,
    gap: 6,
  },
  comparisonLabel: {
    color: '#344054',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  comparisonImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
});
