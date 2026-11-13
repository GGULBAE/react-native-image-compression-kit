import { describe, expect, it } from 'vitest';
import { selectIOSSimulatorForSDK } from '../scripts/ios-simulator-selection-core.mjs';

const runtime = version => `com.apple.CoreSimulator.SimRuntime.iOS-${version}`;
const phone = (udid, overrides = {}) => ({
  name: 'iPhone Fixture', udid, isAvailable: true, state: 'Shutdown', ...overrides,
});

describe('iOS validation simulator selection', () => {
  it('chooses the SDK-matching runtime instead of the first installed iPhone', () => {
    const selected = selectIOSSimulatorForSDK({
      [runtime('26-2')]: [phone('OLDER')],
      [runtime('26-5')]: [phone('MATCHING')],
      [runtime('27-0')]: [phone('NEWER')],
    }, '26.5');
    expect(selected.udid).toBe('MATCHING');
    expect(selected.runtime).toBe(runtime('26-5'));
  });

  it('supports patch runtimes and device-specific runtime identifiers', () => {
    expect(selectIOSSimulatorForSDK({
      [runtime('26-4-1')]: [phone('PATCH')],
    }, '26.4.1').udid).toBe('PATCH');
    expect(selectIOSSimulatorForSDK({
      [runtime('27-2-iPhone19-4')]: [phone('DEVICE')],
    }, '27.2').udid).toBe('DEVICE');
  });

  it('prefers an already booted matching iPhone and ignores unsuitable devices', () => {
    expect(selectIOSSimulatorForSDK({
      [runtime('26-5')]: [
        phone('OFFLINE', { isAvailable: false }),
        phone('TABLET', { name: 'iPad Fixture' }),
        phone('', { name: 'iPhone without identity' }),
        phone('NO-NAME', { name: null }),
        phone('COLD'),
        phone('BOOTED', { state: 'Booted' }),
      ],
    }, '26.5').udid).toBe('BOOTED');
  });

  it('fails before boot/build rather than falling back to a different SDK generation', () => {
    expect(() => selectIOSSimulatorForSDK({
      [runtime('26-50')]: [phone('PREFIX-COLLISION')],
      [runtime('26-4')]: [phone('OLD')],
      [runtime('26-5')]: null,
    }, '26.5')).toThrow('No available iPhone simulator matches iOS Simulator SDK 26.5');
    expect(() => selectIOSSimulatorForSDK(undefined, '26.5')).toThrow('Install a matching simulator runtime');
  });

  it('rejects an unrecognized SDK version', () => {
    for (const version of ['', 'latest', '26', '26.5-beta']) {
      expect(() => selectIOSSimulatorForSDK({}, version)).toThrow('Invalid iOS Simulator SDK version');
    }
  });
});
