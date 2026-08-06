import React from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { formatBytes } from '../exampleUtils';
import {
  GUIDED_DEMO_STAGES,
  type GuidedDemoState,
} from '../guidedDemo';

type GuidedDemoProps = {
  state: GuidedDemoState | null;
};

export function GuidedDemo({ state }: GuidedDemoProps) {
  const activeIndex = state
    ? GUIDED_DEMO_STAGES.findIndex(({ id }) => id === state.stage)
    : -1;

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="never"
        scrollEnabled={false}
      >
        <View>
          <Text style={styles.eyebrow}>Real native walkthrough</Text>
          <Text style={styles.title}>Image compression, end to end</Text>
          <Text style={styles.subtitle}>
            A deterministic sample processed by the installed native runtime.
          </Text>
        </View>

        <View accessibilityRole="progressbar" style={styles.progressRow}>
          {GUIDED_DEMO_STAGES.map((stage, index) => {
            const isActive = index === activeIndex;
            const isComplete = index < activeIndex;
            return (
              <View key={stage.id} style={styles.progressItem}>
                <View
                  style={[
                    styles.progressBadge,
                    isActive ? styles.progressBadgeActive : null,
                    isComplete ? styles.progressBadgeComplete : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.progressNumber,
                      isActive || isComplete ? styles.progressNumberActive : null,
                    ]}
                  >
                    {isComplete ? '✓' : index + 1}
                  </Text>
                </View>
                <Text style={[styles.progressLabel, isActive ? styles.activeText : null]}>
                  {stage.label}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          {state ? <StageContent state={state} /> : <Preparing />}
        </View>

        <Text style={styles.footer}>
          No browser substitute · deterministic repository fixture
        </Text>
      </ScrollView>
    </View>
  );
}

function StageContent({ state }: { state: GuidedDemoState }) {
  if (state.stage === 'source') {
    return (
      <>
        <StageHeading step="01" title="Load a local source" />
        <Image
          accessibilityLabel="Bundled JPEG source"
          resizeMode="contain"
          source={{ uri: state.sourceUri }}
          style={styles.heroImage}
        />
        <Pill text="Bundled JPEG · local file URI" />
      </>
    );
  }

  if (state.stage === 'options') {
    return (
      <>
        <StageHeading step="02" title="Choose a bounded request" />
        <Option label="Resize" value="160 × 160 · contain" />
        <Option label="Output" value="JPEG · quality 76" />
        <Option label="Target size" value="≤ 8,000 bytes" />
        <Option label="Metadata" value="safe" />
      </>
    );
  }

  if (state.stage === 'capabilities') {
    const jpeg = state.capabilities.formats.find(({ format }) => format === 'jpeg');
    return (
      <>
        <StageHeading step="03" title="Check this runtime" />
        <View style={styles.platformBadge}>
          <Text style={styles.platformText}>{state.capabilities.platform.toUpperCase()}</Text>
        </View>
        <Capability label="JPEG input" supported={jpeg?.input === true} />
        <Capability label="JPEG output" supported={jpeg?.output === true} />
        <Capability
          label="Target-size compression"
          supported={state.capabilities.supportsTargetSizeCompression}
        />
        <Capability
          label="Cancellation"
          supported={state.capabilities.supportsCancellation}
        />
      </>
    );
  }

  if (state.stage === 'compressing') {
    return (
      <View style={styles.loadingContent}>
        <ActivityIndicator color="#0f766e" size="large" />
        <StageHeading step="04" title="Run native compression" centered />
        <Text style={styles.loadingText}>
          Decode, resize, encode, and enforce the byte target.
        </Text>
      </View>
    );
  }

  const result = state.result;
  if (!result) return <Preparing />;
  return (
    <>
      <StageHeading step="05" title="Inspect the real result" />
      <View style={styles.comparisonRow}>
        <Preview label="Before" uri={state.sourceUri} />
        <Preview label="After" uri={result.uri} />
      </View>
      <View style={styles.metricGrid}>
        <Metric label="Original" value={formatBytes(result.originalByteSize)} />
        <Metric label="Output" value={formatBytes(result.byteSize)} />
        <Metric label="Dimensions" value={`${result.width} × ${result.height}`} />
        <Metric label="Source bytes" value={`${(result.compressionRatio * 100).toFixed(1)}%`} />
      </View>
    </>
  );
}

function Preparing() {
  return (
    <View style={styles.loadingContent}>
      <ActivityIndicator color="#0f766e" size="large" />
      <Text style={styles.loadingText}>Preparing the native sample…</Text>
    </View>
  );
}

function StageHeading({
  step,
  title,
  centered = false,
}: {
  step: string;
  title: string;
  centered?: boolean;
}) {
  return (
    <View style={[styles.stageHeading, centered ? styles.centered : null]}>
      <Text style={styles.step}>{step}</Text>
      <Text style={styles.stageTitle}>{title}</Text>
    </View>
  );
}

function Option({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.optionRow}>
      <Text style={styles.optionLabel}>{label}</Text>
      <Text style={styles.optionValue}>{value}</Text>
    </View>
  );
}

function Capability({ label, supported }: { label: string; supported: boolean }) {
  return (
    <View style={styles.optionRow}>
      <Text style={styles.optionLabel}>{label}</Text>
      <Text style={supported ? styles.supported : styles.unsupported}>
        {supported ? '✓ supported' : 'not supported'}
      </Text>
    </View>
  );
}

function Preview({ label, uri }: { label: string; uri: string }) {
  return (
    <View style={styles.previewItem}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Image
        accessibilityLabel={`${label} compression preview`}
        resizeMode="contain"
        source={{ uri }}
        style={styles.previewImage}
      />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <View style={styles.pill}>
      <ActivityIndicator color="#0d5f59" size="small" />
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f7f6' },
  container: {
    flexGrow: 1,
    gap: 20,
    paddingBottom: 20,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 12 : 64,
  },
  eyebrow: {
    color: '#0f766e', fontSize: 12, fontWeight: '800', letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: '#102a2a', fontSize: 30, fontWeight: '800', marginTop: 6 },
  subtitle: { color: '#4b6462', fontSize: 15, lineHeight: 21, marginTop: 6 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressItem: { alignItems: 'center', flex: 1, gap: 5 },
  progressBadge: {
    alignItems: 'center', backgroundColor: '#dce5e3', borderRadius: 18,
    height: 34, justifyContent: 'center', width: 34,
  },
  progressBadgeActive: { backgroundColor: '#0f766e' },
  progressBadgeComplete: { backgroundColor: '#8bd3c7' },
  progressNumber: { color: '#58706d', fontSize: 13, fontWeight: '800' },
  progressNumberActive: { color: '#ffffff' },
  progressLabel: { color: '#667c79', fontSize: 10, fontWeight: '700' },
  activeText: { color: '#0f766e' },
  card: {
    backgroundColor: '#ffffff', borderColor: '#cbdad7', borderRadius: 22,
    borderWidth: 1, flex: 1, gap: 14, minHeight: 0, padding: 20,
  },
  stageHeading: { gap: 3 },
  centered: { alignItems: 'center' },
  step: { color: '#0f766e', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  stageTitle: { color: '#102a2a', fontSize: 23, fontWeight: '800' },
  heroImage: { backgroundColor: '#eef3f2', borderRadius: 16, flex: 1, width: '100%' },
  pill: {
    alignItems: 'center', alignSelf: 'center', backgroundColor: '#e7f6f2',
    borderRadius: 99, flexDirection: 'row', gap: 7,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  pillText: { color: '#0d5f59', fontSize: 13, fontWeight: '700' },
  optionRow: {
    alignItems: 'center', backgroundColor: '#f7faf9', borderRadius: 12,
    flexDirection: 'row', justifyContent: 'space-between', padding: 15,
  },
  optionLabel: { color: '#526966', fontSize: 14, fontWeight: '600' },
  optionValue: { color: '#102a2a', fontSize: 15, fontWeight: '800' },
  platformBadge: {
    alignSelf: 'flex-start', backgroundColor: '#102a2a', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  platformText: { color: '#ffffff', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  supported: { color: '#08775d', fontSize: 14, fontWeight: '800' },
  unsupported: { color: '#a03f3f', fontSize: 14, fontWeight: '700' },
  loadingContent: { alignItems: 'center', flex: 1, gap: 18, justifyContent: 'center' },
  loadingText: { color: '#526966', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  comparisonRow: { flexDirection: 'row', gap: 12 },
  previewItem: { flex: 1, gap: 7 },
  previewLabel: { color: '#526966', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  previewImage: { backgroundColor: '#eef3f2', borderRadius: 12, height: 210, width: '100%' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { backgroundColor: '#e7f6f2', borderRadius: 11, minWidth: '46%', padding: 12 },
  metricLabel: { color: '#526966', fontSize: 11, fontWeight: '700' },
  metricValue: { color: '#0d5f59', fontSize: 17, fontWeight: '800', marginTop: 3 },
  footer: { color: '#667c79', fontSize: 11, textAlign: 'center' },
});
