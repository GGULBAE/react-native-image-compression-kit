import { useMemo, useState } from 'react';
import type {
  CompressionOptions,
  MetadataPolicy,
  OutputFormat,
  ResizeMode,
} from 'react-native-image-compression-kit';
import { parseOptionalPositiveInteger } from './exampleUtils';

const DEFAULT_QUALITY = '72';

export function useCompressionForm() {
  const [qualityText, setQualityText] = useState(DEFAULT_QUALITY);
  const [maxBytesText, setMaxBytesText] = useState('');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('jpeg');
  const [maxWidthText, setMaxWidthText] = useState('');
  const [maxHeightText, setMaxHeightText] = useState('');
  const [resizeMode, setResizeMode] = useState<ResizeMode>('contain');
  const [metadataPolicy, setMetadataPolicy] =
    useState<MetadataPolicy>('safe');

  const quality = useMemo(() => {
    const parsed = Number.parseInt(qualityText, 10);
    return String(
      Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : DEFAULT_QUALITY
    );
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

  return {
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
  };
}
