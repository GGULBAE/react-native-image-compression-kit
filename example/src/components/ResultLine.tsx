import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function ResultLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  label: {
    color: '#475467',
    fontSize: 13,
    fontWeight: '600',
  },
  value: {
    color: '#101828',
    flex: 1,
    fontSize: 13,
    textAlign: 'right',
  },
});
