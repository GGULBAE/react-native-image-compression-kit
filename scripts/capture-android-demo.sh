#!/usr/bin/env bash

set -euo pipefail

: "${RNICK_DEMO_PACKAGE_VERSION:?RNICK_DEMO_PACKAGE_VERSION is required}"
: "${RNICK_DEMO_SOURCE_SHA:?RNICK_DEMO_SOURCE_SHA is required}"
: "${RNICK_DEMO_RUN_URL:?RNICK_DEMO_RUN_URL is required}"

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
trap 'kill "$metro_pid" 2>/dev/null || true' EXIT

for attempt in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8081/status | grep -q 'packager-status:running'; then
    break
  fi
  test "$attempt" != "60"
  sleep 1
done

(cd example/android && ./gradlew app:installDebug --no-daemon)
adb logcat -c
adb shell am force-stop com.imagecompressionkit.example
adb shell am start -n com.imagecompressionkit.example/.MainActivity --ez rnick-demo-capture true
mkdir -p /tmp/rnick-demo-raw

for attempt in $(seq 1 120); do
  adb logcat -d -s RNICK_DEMO:I '*:S' > /tmp/rnick-demo-raw/native.log
  if grep -q 'RNICK_DEMO_PASS' /tmp/rnick-demo-raw/native.log; then
    break
  fi
  test "$attempt" != "120"
  sleep 1
done

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

node scripts/create-demo-evidence.mjs \
  --platform android \
  --package-version "$RNICK_DEMO_PACKAGE_VERSION" \
  --source-sha "$RNICK_DEMO_SOURCE_SHA" \
  --runtime "$runtime" \
  --device "$device" \
  --source /tmp/rnick-demo-raw/source.jpg \
  --output /tmp/rnick-demo-raw/output.jpg \
  --screenshot /tmp/rnick-demo-raw/screen.png \
  --log /tmp/rnick-demo-raw/native.log \
  --destination demo-evidence/android \
  --run-url "$RNICK_DEMO_RUN_URL"
