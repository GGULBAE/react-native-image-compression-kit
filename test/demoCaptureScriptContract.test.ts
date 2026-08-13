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
    expect(source).toContain('RNICK_ECONOMIC_RESILIENCE_PASS');
    expect(source).toContain('create-economic-resilience-environment.mjs');
    expect(source).toContain('create-economic-resilience-evidence.mjs');
    expect(source).toContain('verify-economic-resilience-evidence.mjs');
    expect(source).toContain('--run-id "$GITHUB_RUN_ID"');
    expect(source).toContain('--run-attempt "$GITHUB_RUN_ATTEMPT"');
    expect(source).toContain('ffprobe_version=$(ffprobe -version | head -n 1)');
    expect(source).toContain('--ffprobe "$ffprobe_version"');
    expect(source).toContain('--max-width 1600');
    expect(source).toContain('--max-height 1200');
  });

  it('streams filtered Android logs cumulatively until all evidence markers pass', () => {
    const streamStart = source.indexOf(
      "adb logcat -v threadtime -s RNICK_DEMO:I '*:S' > /tmp/rnick-demo-raw/native.log &",
    );
    const captureLaunch = source.indexOf(
      'adb shell am start -n com.imagecompressionkit.example/.MainActivity --ez rnick-demo-capture true',
    );
    const completionGate = source.indexOf(
      "grep -q 'RNICK_ECONOMIC_RESILIENCE_PASS'",
    );
    const streamStop = source.indexOf('stop_logcat_stream', captureLaunch);
    const firstBuilder = source.indexOf('node scripts/normalize-demo-recording.mjs');

    expect(source).toContain('logcat_pid=$!');
    expect(source).toContain('kill -TERM "$logcat_pid"');
    expect(source).toContain('kill -KILL "$logcat_pid"');
    expect(source).toContain('for _attempt in $(seq 1 50)');
    expect(source).toContain('wait "$logcat_pid"');
    expect(source).not.toContain('adb logcat -d');
    expect(source).toContain("grep -q 'RNICK_DEMO_FAIL'");
    expect(source).toContain('tail -n 200 /tmp/rnick-demo-raw/native.log');
    expect(source).toContain('tail -n 200 /tmp/rnick-metro.log');
    expect(streamStart).toBeGreaterThan(-1);
    expect(streamStart).toBeLessThan(captureLaunch);
    expect(completionGate).toBeGreaterThan(captureLaunch);
    expect(streamStop).toBeGreaterThan(completionGate);
    expect(streamStop).toBeLessThan(firstBuilder);
  });

  it('pins dispatch source and retains complete platform logs for the 12 MP bundle', () => {
    expect(workflow).toContain('source_sha:');
    expect(workflow.match(/Verify exact source checkout/g)?.length).toBe(2);
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$EXPECTED_SOURCE_SHA"');
    expect(workflow).toContain('RNICK_ECONOMIC_RESILIENCE_');
    expect(workflow).toContain('RNICK_ECONOMIC_RESILIENCE_PASS');
    expect(workflow).toContain('log show --style compact --last 15m');
    expect(workflow).not.toContain('--start "$capture_started_at"');
    expect(workflow).not.toContain('log show --style compact --last 3m');
    expect(workflow).toContain('for attempt in $(seq 1 300)');
    expect(workflow).toContain("grep -q 'RNICK_DEMO_FAIL'");
    expect(workflow).toContain('tail -n 200 /tmp/rnick-demo-raw/native.log');
    expect(workflow).toContain('tail -n 200 /tmp/rnick-metro.log');
    expect(workflow).toContain('create-economic-resilience-environment.mjs');
    expect(workflow).toContain('create-economic-resilience-evidence.mjs');
    expect(workflow).toContain('verify-economic-resilience-evidence.mjs');
    expect(workflow).toContain('--run-id "$GITHUB_RUN_ID"');
    expect(workflow).toContain('--run-attempt "$GITHUB_RUN_ATTEMPT"');
    expect(workflow).toContain('ffprobe_version=$(ffprobe -version | head -n 1)');
    expect(workflow).toContain('--ffprobe "$ffprobe_version"');
    expect(workflow).toContain('xcrun simctl list runtimes --json');
    expect(workflow).toContain('inspect-ios-simulator-metadata.mjs');
    expect(workflow).toContain("require('/tmp/rnick-sim-metadata.json').udid");
    expect(workflow).not.toContain('simctl spawn "$udid" sw_vers');
  });

  it('records the complete guided walkthrough on both native platforms', () => {
    expect(guidedDemo).toContain('const ANDROID_SOURCE_STAGE_MS = 12_000');
    expect(guidedDemo).toContain('const IOS_SOURCE_STAGE_MS = 9_000');
    expect(guidedDemo).toContain(
      "platform === 'android' ? ANDROID_SOURCE_STAGE_MS : IOS_SOURCE_STAGE_MS"
    );
    expect(guidedScreen).toContain('<ActivityIndicator color="#0d5f59" size="small" />');
    expect(guidedScreen).toContain('contentInsetAdjustmentBehavior="never"');
    expect(guidedScreen).toContain(
      'accessibilityLabel="Native compression walkthrough progress"'
    );
    expect(guidedScreen).toContain('accessibilityRole="progressbar"');
    expect(guidedScreen).toContain('accessibilityValue={{');
    expect(guidedScreen).toContain("text: progressText");
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
    expect(source).toContain('if ! wait "$screenrecord_pid"; then');
    expect(source.indexOf('if ! wait "$screenrecord_pid"; then')).toBeLessThan(
      source.indexOf('adb pull /sdcard/rnick-guided-demo.mp4')
    );
    expect(source.indexOf('adb pull /sdcard/rnick-guided-demo.mp4')).toBeLessThan(
      source.indexOf('normalize-demo-recording.mjs')
    );
    expect(source).toContain('normalize-demo-recording.mjs');
    expect(source).toContain('--result-frame /tmp/rnick-demo-raw/screen.png');
    expect(source.indexOf('normalize-demo-recording.mjs')).toBeLessThan(
      source.indexOf('create-demo-evidence.mjs')
    );
    expect(source).toContain('measure-demo-visual-agreement.mjs');
    expect(source.indexOf('measure-demo-visual-agreement.mjs')).toBeLessThan(
      source.indexOf('create-demo-evidence.mjs')
    );
    expect(source).toContain('--visual-agreement /tmp/rnick-demo-raw/visual-agreement.json');
    expect(source).toContain('--resize-mode contain');
    expect(source).toContain('--max-width 160');
    expect(source).toContain('--max-height 160');
    expect(source).toContain(
      '--capture-method "android adb screenrecord H.264; timeline normalized and final native frame held with ffmpeg"'
    );

    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).toContain('sudo apt-get install --yes --no-install-recommends ffmpeg');
    expect(workflow).toContain('brew list ffmpeg');
    expect(workflow).toContain('simctl io "$udid" recordVideo --codec=h264');
    expect(workflow).toContain(
      'xcrun simctl launch --terminate-running-process "$udid" com.imagecompressionkit.example'
    );
    expect(workflow).toContain(
      'xcrun simctl terminate "$udid" com.imagecompressionkit.example || true'
    );
    expect(
      workflow.indexOf(
        'xcrun simctl launch --terminate-running-process "$udid" com.imagecompressionkit.example'
      )
    ).toBeLessThan(workflow.indexOf('simctl io "$udid" recordVideo'));
    expect(workflow.indexOf('simctl io "$udid" recordVideo')).toBeLessThan(
      workflow.indexOf('SIMCTL_CHILD_RNICK_DEMO_CAPTURE=1 xcrun simctl launch')
    );
    expect(workflow.indexOf('SIMCTL_CHILD_RNICK_DEMO_CAPTURE=1 xcrun simctl launch')).toBeLessThan(
      workflow.indexOf("grep -q 'RNICK_GUIDED_DEMO_READY'")
    );
    expect(workflow.indexOf("grep -q 'RNICK_GUIDED_DEMO_READY'")).toBeLessThan(
      workflow.indexOf("grep -q 'RNICK_GUIDED_DEMO_STAGE.*\"id\":\"result\"'")
    );
    expect(
      workflow.indexOf("grep -q 'RNICK_GUIDED_DEMO_STAGE.*\"id\":\"result\"'")
    ).toBeLessThan(workflow.lastIndexOf('kill -INT "$video_pid"'));
    expect(workflow.lastIndexOf('kill -INT "$video_pid"')).toBeLessThan(
      workflow.indexOf("grep -q 'RNICK_GUIDED_DEMO_PASS'")
    );
    expect(workflow).toContain('recording-raw.mp4');
    expect(workflow).toContain('normalize-demo-recording.mjs');
    expect(workflow).toContain('--trim-start-seconds 3');
    expect(readFileSync('scripts/normalize-demo-recording.mjs', 'utf8')).toContain(
      'tpad=stop_mode=clone:stop_duration=${movingDurationSeconds}'
    );
    expect(workflow).toContain('--result-frame /tmp/rnick-demo-raw/screen.png');
    expect(workflow.indexOf('node scripts/normalize-demo-recording.mjs')).toBeLessThan(
      workflow.indexOf('node scripts/create-demo-evidence.mjs')
    );
    expect(workflow).toContain('node scripts/measure-demo-visual-agreement.mjs');
    expect(
      workflow.indexOf('node scripts/measure-demo-visual-agreement.mjs')
    ).toBeLessThan(workflow.indexOf('node scripts/create-demo-evidence.mjs'));
    expect(workflow).toContain(
      '--visual-agreement /tmp/rnick-demo-raw/visual-agreement.json'
    );
    expect(workflow).toContain('"scripts/merge-demo-evidence.mjs"');
    expect(workflow).toContain('--resize-mode contain');
    expect(workflow).toContain('--max-width 160');
    expect(workflow).toContain('--max-height 160');
    expect(workflow).toContain(
      '--capture-method "ios simctl recordVideo H.264 after a non-capture warm launch; 3-second recorder/startup lead trimmed, timeline normalized, and final native frame held with ffmpeg"'
    );
  });
});
