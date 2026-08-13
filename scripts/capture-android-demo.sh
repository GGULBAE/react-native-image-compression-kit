#!/usr/bin/env bash

set -euo pipefail

: "${RNICK_DEMO_PACKAGE_VERSION:?RNICK_DEMO_PACKAGE_VERSION is required}"
: "${RNICK_DEMO_SOURCE_SHA:?RNICK_DEMO_SOURCE_SHA is required}"
: "${RNICK_DEMO_RUN_URL:?RNICK_DEMO_RUN_URL is required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
: "${GITHUB_RUN_ATTEMPT:?GITHUB_RUN_ATTEMPT is required}"
: "${RUNNER_OS:?RUNNER_OS is required}"
: "${RUNNER_ARCH:?RUNNER_ARCH is required}"
: "${RUNNER_NAME:?RUNNER_NAME is required}"
: "${ImageOS:?ImageOS is required}"
: "${ImageVersion:?ImageVersion is required}"

metro_pid=""
screenrecord_pid=""
logcat_pid=""

stop_logcat_stream() {
  if [ -n "$logcat_pid" ]; then
    kill -TERM "$logcat_pid" 2>/dev/null || true
    for _attempt in $(seq 1 50); do
      if ! kill -0 "$logcat_pid" 2>/dev/null; then
        break
      fi
      sleep 0.1
    done
    if kill -0 "$logcat_pid" 2>/dev/null; then
      kill -KILL "$logcat_pid" 2>/dev/null || true
    fi
    wait "$logcat_pid" 2>/dev/null || true
    logcat_pid=""
  fi
}

cleanup() {
  stop_logcat_stream
  if [ -n "$screenrecord_pid" ]; then
    kill "$screenrecord_pid" 2>/dev/null || true
    wait "$screenrecord_pid" 2>/dev/null || true
  fi
  if [ -n "$metro_pid" ]; then
    kill "$metro_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT

capture_window_dump() {
  adb shell uiautomator dump /sdcard/rnick-demo-window.xml >/dev/null
  adb exec-out cat /sdcard/rnick-demo-window.xml > /tmp/rnick-demo-raw/window.xml
}

dismiss_system_anr_dialog() {
  for attempt in 1 2; do
    capture_window_dump
    if ! grep -Eiq "isn.?t responding|not responding|android:id/aerr_wait" /tmp/rnick-demo-raw/window.xml; then
      return
    fi

    coordinates=$(node --input-type=module - /tmp/rnick-demo-raw/window.xml <<'NODE'
import { readFileSync } from 'node:fs';
const source = readFileSync(process.argv[2], 'utf8');
const nodes = [...source.matchAll(/<node\b[^>]*>/g)].map(([node]) => node);
const read = (node, name) => node.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '';
const waitNode = nodes.find((node) =>
  read(node, 'resource-id') === 'android:id/aerr_wait' || read(node, 'text') === 'Wait'
);
const bounds = read(waitNode ?? '', 'bounds').match(/\[(\d+),(\d+)]\[(\d+),(\d+)]/);
if (bounds) {
  const [, left, top, right, bottom] = bounds.map(Number);
  process.stdout.write(`${Math.floor((left + right) / 2)} ${Math.floor((top + bottom) / 2)}`);
}
NODE
    )
    if [ -n "$coordinates" ]; then
      adb shell input tap $coordinates
    else
      adb shell input keyevent 4
    fi
    sleep 2
  done

  capture_window_dump
  if grep -Eiq "isn.?t responding|not responding|android:id/aerr_wait" /tmp/rnick-demo-raw/window.xml; then
    echo 'System ANR dialog still obscures the Android demo.' >&2
    exit 1
  fi
}

pnpm build
pnpm example:codegen
pnpm --filter image-compression-kit-example exec react-native start --port 8081 > /tmp/rnick-metro.log 2>&1 &
metro_pid=$!

for attempt in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8081/status | grep -q 'packager-status:running'; then
    break
  fi
  test "$attempt" != "60"
  sleep 1
done

(cd example/android && ./gradlew app:installDebug --no-daemon)
mkdir -p /tmp/rnick-demo-raw
adb logcat -c
adb logcat -v threadtime -s RNICK_DEMO:I '*:S' > /tmp/rnick-demo-raw/native.log &
logcat_pid=$!
sleep 1
kill -0 "$logcat_pid"
adb shell am force-stop com.imagecompressionkit.example
adb shell am start -n com.imagecompressionkit.example/.MainActivity --ez rnick-demo-capture true

for attempt in $(seq 1 60); do
  if grep -q 'RNICK_GUIDED_DEMO_READY' /tmp/rnick-demo-raw/native.log; then
    break
  fi
  test "$attempt" != "60"
  sleep 1
done

adb shell rm -f /sdcard/rnick-guided-demo.mp4
adb shell screenrecord \
  --size 720x1600 \
  --bit-rate 2000000 \
  --time-limit 30 \
  /sdcard/rnick-guided-demo.mp4 \
  > /tmp/rnick-demo-raw/screenrecord.log 2>&1 &
screenrecord_pid=$!

for attempt in $(seq 1 60); do
  if grep -q 'RNICK_GUIDED_DEMO_PASS' /tmp/rnick-demo-raw/native.log; then
    break
  fi
  test "$attempt" != "60"
  sleep 1
done

if ! wait "$screenrecord_pid"; then
  echo 'adb screenrecord exited non-zero; validating the captured MP4 before accepting it.' >&2
  tail -n 50 /tmp/rnick-demo-raw/screenrecord.log >&2 || true
fi
screenrecord_pid=""
adb pull /sdcard/rnick-guided-demo.mp4 /tmp/rnick-demo-raw/recording-raw.mp4 >/dev/null

for attempt in $(seq 1 300); do
  if grep -q 'RNICK_DEMO_PASS' /tmp/rnick-demo-raw/native.log && \
    grep -q 'RNICK_BENCHMARK_PASS' /tmp/rnick-demo-raw/native.log && \
    grep -q 'RNICK_BENCHMARK_COMPARISON_PASS' /tmp/rnick-demo-raw/native.log && \
    grep -q 'RNICK_ECONOMIC_RESILIENCE_PASS' /tmp/rnick-demo-raw/native.log; then
    break
  fi
  test "$attempt" != "300"
  sleep 1
done

stop_logcat_stream

sleep 2
dismiss_system_anr_dialog
adb shell am start -n com.imagecompressionkit.example/.MainActivity >/dev/null
activity_state=$(adb shell dumpsys activity activities)
window_state=$(adb shell dumpsys window windows)
if ! printf '%s\n' "$activity_state" | grep -Eq '(mResumedActivity|topResumedActivity).*com.imagecompressionkit.example' && \
  ! printf '%s\n' "$window_state" | grep -Eq '(mCurrentFocus|mFocusedApp).*com.imagecompressionkit.example'; then
  echo 'Example app is not the resumed activity before screenshot capture.' >&2
  printf '%s\n' "$activity_state" | grep -E 'ResumedActivity|com.imagecompressionkit.example' >&2 || true
  printf '%s\n' "$window_state" | grep -E 'mCurrentFocus|mFocusedApp' >&2 || true
  exit 1
fi
adb exec-out screencap -p > /tmp/rnick-demo-raw/screen.png
node --input-type=module - /tmp/rnick-demo-raw/native.log > /tmp/rnick-demo-raw/uris.txt <<'NODE'
import { readFileSync } from 'node:fs';
const text = readFileSync(process.argv[2], 'utf8');
const match = [...text.matchAll(/RNICK_DEMO_PASS (\{.+\})/g)].at(-1);
if (!match) throw new Error('native demo marker missing');
const value = JSON.parse(match[1]);
console.log(new URL(value.sourceUri).pathname);
console.log(new URL(value.result.uri).pathname);
NODE

source_path=$(sed -n '1p' /tmp/rnick-demo-raw/uris.txt)
output_path=$(sed -n '2p' /tmp/rnick-demo-raw/uris.txt)
adb exec-out run-as com.imagecompressionkit.example cat "$source_path" > /tmp/rnick-demo-raw/source.jpg
adb exec-out run-as com.imagecompressionkit.example cat "$output_path" > /tmp/rnick-demo-raw/output.jpg
runtime="Android $(adb shell getprop ro.build.version.release | tr -d '\r') / API $(adb shell getprop ro.build.version.sdk | tr -d '\r')"
device="$(adb shell getprop ro.product.manufacturer | tr -d '\r') $(adb shell getprop ro.product.model | tr -d '\r')"

node scripts/normalize-demo-recording.mjs \
  --input /tmp/rnick-demo-raw/recording-raw.mp4 \
  --output /tmp/rnick-demo-raw/recording.mp4 \
  --log /tmp/rnick-demo-raw/native.log \
  --result-frame /tmp/rnick-demo-raw/screen.png

node scripts/measure-demo-visual-agreement.mjs \
  --source /tmp/rnick-demo-raw/source.jpg \
  --output /tmp/rnick-demo-raw/output.jpg \
  --resize-mode contain \
  --max-width 160 \
  --max-height 160 \
  --report /tmp/rnick-demo-raw/visual-agreement.json

node scripts/create-demo-evidence.mjs \
  --platform android \
  --package-version "$RNICK_DEMO_PACKAGE_VERSION" \
  --source-sha "$RNICK_DEMO_SOURCE_SHA" \
  --runtime "$runtime" \
  --device "$device" \
  --source /tmp/rnick-demo-raw/source.jpg \
  --output /tmp/rnick-demo-raw/output.jpg \
  --screenshot /tmp/rnick-demo-raw/screen.png \
  --recording /tmp/rnick-demo-raw/recording.mp4 \
  --capture-method "android adb screenrecord H.264; timeline normalized and final native frame held with ffmpeg" \
  --visual-agreement /tmp/rnick-demo-raw/visual-agreement.json \
  --log /tmp/rnick-demo-raw/native.log \
  --destination demo-evidence/android \
  --run-url "$RNICK_DEMO_RUN_URL"

node scripts/create-benchmark-evidence.mjs \
  --platform android \
  --package-version "$RNICK_DEMO_PACKAGE_VERSION" \
  --source-sha "$RNICK_DEMO_SOURCE_SHA" \
  --runtime "$runtime" \
  --device "$device" \
  --source /tmp/rnick-demo-raw/source.jpg \
  --log /tmp/rnick-demo-raw/native.log \
  --destination demo-evidence/android \
  --run-url "$RNICK_DEMO_RUN_URL"

node scripts/create-benchmark-comparison-evidence.mjs \
  --platform android \
  --source-sha "$RNICK_DEMO_SOURCE_SHA" \
  --runtime "$runtime" \
  --device "$device" \
  --source /tmp/rnick-demo-raw/source.jpg \
  --log /tmp/rnick-demo-raw/native.log \
  --plan benchmarks/native-comparison/implementations.json \
  --destination demo-evidence/android \
  --run-url "$RNICK_DEMO_RUN_URL"

node scripts/verify-benchmark-comparison-evidence.mjs demo-evidence/android

mkdir -p /tmp/rnick-economic-raw
node --input-type=module - /tmp/rnick-demo-raw/native.log > /tmp/rnick-economic-raw/uris.txt <<'NODE'
import { readFileSync } from 'node:fs';
import { parseNativeEconomicResiliencePayload } from './scripts/economic-resilience-evidence-core.mjs';
const payload = parseNativeEconomicResiliencePayload(readFileSync(process.argv[2], 'utf8'));
console.log(new URL(payload.fixture.sourceUri).pathname);
console.log(new URL(payload.representative.stagedOutputUri).pathname);
NODE
economic_source_path=$(sed -n '1p' /tmp/rnick-economic-raw/uris.txt)
economic_output_path=$(sed -n '2p' /tmp/rnick-economic-raw/uris.txt)
adb exec-out run-as com.imagecompressionkit.example cat "$economic_source_path" > /tmp/rnick-economic-raw/source.jpg
adb exec-out run-as com.imagecompressionkit.example cat "$economic_output_path" > /tmp/rnick-economic-raw/output.jpg
node scripts/measure-demo-visual-agreement.mjs \
  --source /tmp/rnick-economic-raw/source.jpg \
  --output /tmp/rnick-economic-raw/output.jpg \
  --resize-mode contain \
  --max-width 1600 \
  --max-height 1200 \
  --report /tmp/rnick-economic-raw/visual-agreement.json
react_native_version=$(node -e "process.stdout.write(require('./example/package.json').dependencies['react-native'])")
os_build=$(adb shell getprop ro.build.id | tr -d '\r')
abi=$(adb shell getprop ro.product.cpu.abi | tr -d '\r')
node_version=$(node --version)
ffmpeg_version=$(ffmpeg -version | head -n 1)
ffprobe_version=$(ffprobe -version | head -n 1)
java_version=$(java -version 2>&1 | head -n 1)
node scripts/create-economic-resilience-environment.mjs \
  --platform android \
  --runtime "$runtime" \
  --os-build "$os_build" \
  --device "$device" \
  --device-kind emulator \
  --abi "$abi" \
  --react-native-version "$react_native_version" \
  --native-log /tmp/rnick-demo-raw/native.log \
  --build-type debug \
  --runner-label ubuntu-latest \
  --runner-os "$RUNNER_OS" \
  --runner-arch "$RUNNER_ARCH" \
  --runner-name "$RUNNER_NAME" \
  --image-os "$ImageOS" \
  --image-version "$ImageVersion" \
  --node "$node_version" \
  --ffmpeg "$ffmpeg_version" \
  --ffprobe "$ffprobe_version" \
  --primary-toolchain "$java_version" \
  --platform-sdk "Android compile SDK 36; emulator API 35; build-tools 36.0.0; NDK 27.1.12297006" \
  --output /tmp/rnick-economic-raw/environment.json
node scripts/create-economic-resilience-evidence.mjs \
  --platform android \
  --package-version "$RNICK_DEMO_PACKAGE_VERSION" \
  --source-sha "$RNICK_DEMO_SOURCE_SHA" \
  --run-id "$GITHUB_RUN_ID" \
  --run-attempt "$GITHUB_RUN_ATTEMPT" \
  --run-url "$RNICK_DEMO_RUN_URL" \
  --log /tmp/rnick-demo-raw/native.log \
  --source /tmp/rnick-economic-raw/source.jpg \
  --output /tmp/rnick-economic-raw/output.jpg \
  --fixture-manifest example/fixtures/kit-only-12mp-v1.json \
  --visual-agreement /tmp/rnick-economic-raw/visual-agreement.json \
  --environment /tmp/rnick-economic-raw/environment.json \
  --destination demo-evidence/android
node scripts/verify-economic-resilience-evidence.mjs \
  --artifact-dir demo-evidence/android/economic-resilience \
  --report-file /tmp/rnick-economic-raw/verification.json
