import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Android demo screenshot capture', () => {
  const source = readFileSync('scripts/capture-android-demo.sh', 'utf8');
  const workflow = readFileSync('.github/workflows/demo-evidence.yml', 'utf8');
  const guidedDemo = readFileSync('example/src/guidedDemo.ts', 'utf8');
  const guidedScreen = readFileSync('example/src/components/GuidedDemo.tsx', 'utf8');

  it('rejects system ANR overlays and requires the example app in front', () => {
    expect(source).toContain('dismiss_system_anr_dialog');
    expect(source).toContain('android:id/aerr_wait');
    expect(source).toContain('mResumedActivity|topResumedActivity');
    expect(source).toContain('mCurrentFocus|mFocusedApp');
    expect(source.indexOf('dismiss_system_anr_dialog')).toBeLessThan(
      source.indexOf('adb exec-out screencap -p')
    );
  });

  it('waits for schema-valid benchmark output before collecting evidence', () => {
    expect(source).toContain('RNICK_BENCHMARK_PASS');
    expect(source).toContain('create-benchmark-evidence.mjs');
    expect(source).toContain('RNICK_BENCHMARK_COMPARISON_PASS');
    expect(source).toContain('create-benchmark-comparison-evidence.mjs');
    expect(source).toContain('verify-benchmark-comparison-evidence.mjs');
  });

  it('records the complete guided walkthrough on both native platforms', () => {
    expect(guidedDemo).toContain('const ANDROID_SOURCE_STAGE_MS = 12_000');
    expect(guidedDemo).toContain('const IOS_SOURCE_STAGE_MS = 9_000');
    expect(guidedDemo).toContain(
      "platform === 'android' ? ANDROID_SOURCE_STAGE_MS : IOS_SOURCE_STAGE_MS"
    );
    expect(guidedScreen).toContain('<ActivityIndicator color="#0d5f59" size="small" />');
    expect(guidedScreen).toContain('contentInsetAdjustmentBehavior="never"');
    expect(guidedScreen).toContain("(StatusBar.currentHeight ?? 24) + 12 : 64");
    expect(source).toContain('adb shell screenrecord');
    expect(source).toContain('--time-limit 30');
    expect(source.indexOf('RNICK_GUIDED_DEMO_READY')).toBeLessThan(
      source.indexOf('adb shell screenrecord')
    );
    expect(source.indexOf('adb shell screenrecord')).toBeLessThan(
      source.indexOf('RNICK_GUIDED_DEMO_PASS')
    );
    expect(source).toContain('--recording /tmp/rnick-demo-raw/recording.mp4');
    expect(source).toContain('recording-raw.mp4');
    expect(source).toContain('normalize-demo-recording.mjs');
    expect(source).toContain('--result-frame /tmp/rnick-demo-raw/screen.png');
    expect(source.indexOf('normalize-demo-recording.mjs')).toBeLessThan(
      source.indexOf('create-demo-evidence.mjs')
    );
    expect(source).toContain(
      '--capture-method "android adb screenrecord H.264; timeline normalized and final native frame held with ffmpeg"'
    );

    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).toContain('sudo apt-get install --yes --no-install-recommends ffmpeg');
    expect(workflow).toContain('brew list ffmpeg');
    expect(workflow).toContain('simctl io "$udid" recordVideo --codec=h264');
    expect(workflow.indexOf("grep -q 'RNICK_GUIDED_DEMO_READY'")).toBeLessThan(
      workflow.indexOf('simctl io "$udid" recordVideo')
    );
    expect(workflow.indexOf('simctl io "$udid" recordVideo')).toBeLessThan(
      workflow.indexOf("grep -q 'RNICK_GUIDED_DEMO_PASS'")
    );
    expect(workflow).toContain('recording-raw.mp4');
    expect(workflow).toContain('normalize-demo-recording.mjs');
    expect(workflow).toContain('--result-frame /tmp/rnick-demo-raw/screen.png');
    expect(workflow.indexOf('node scripts/normalize-demo-recording.mjs')).toBeLessThan(
      workflow.indexOf('node scripts/create-demo-evidence.mjs')
    );
    expect(workflow).toContain(
      '--capture-method "ios simctl recordVideo H.264; timeline normalized and final native frame held with ffmpeg"'
    );
  });
});
