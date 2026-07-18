import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Android demo screenshot capture', () => {
  const source = readFileSync('scripts/capture-android-demo.sh', 'utf8');

  it('rejects system ANR overlays and requires the example app in front', () => {
    expect(source).toContain('dismiss_system_anr_dialog');
    expect(source).toContain('android:id/aerr_wait');
    expect(source).toContain('mResumedActivity|topResumedActivity');
    expect(source).toContain('mCurrentFocus|mFocusedApp');
    expect(source.indexOf('dismiss_system_anr_dialog')).toBeLessThan(
      source.indexOf('adb exec-out screencap -p')
    );
  });
});
