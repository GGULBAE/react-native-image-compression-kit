import React from 'react';
import { Button, Image, StyleSheet, Text, TextInput, View } from 'react-native';

type SourcePanelProps = {
  sourceUri: string;
  isLoadingSample: boolean;
  isPickingImage: boolean;
  onChangeSource: (uri: string) => void;
  onLoadSample: () => void;
  onPickImage: () => void;
};

export function SourcePanel({
  sourceUri,
  isLoadingSample,
  isPickingImage,
  onChangeSource,
  onLoadSample,
  onPickImage,
}: SourcePanelProps) {
  const isBusy = isLoadingSample || isPickingImage;

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Source URI</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        onChangeText={onChangeSource}
        placeholder="file:///data/user/0/... or content://..."
        style={styles.input}
        value={sourceUri}
      />
      {sourceUri ? (
        <Image
          accessibilityLabel="Selected source preview"
          resizeMode="contain"
          source={{ uri: sourceUri }}
          style={styles.preview}
        />
      ) : null}
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            disabled={isBusy}
            onPress={onLoadSample}
            title={isLoadingSample ? 'Loading sample' : 'Bundled sample'}
          />
        </View>
        <View style={styles.action}>
          <Button
            disabled={isBusy}
            onPress={onPickImage}
            title={isPickingImage ? 'Opening gallery' : 'Choose from gallery'}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d5dd',
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 14,
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
    fontSize: 14,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    backgroundColor: '#f2f4f7',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  action: {
    flexGrow: 1,
    minWidth: 150,
  },
});
