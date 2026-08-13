import { describe, expect, it } from 'vitest';
import { inspectBootedIosSimulatorMetadata } from '../scripts/ios-simulator-metadata-core.mjs';

const UDID = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE';
const RUNTIME_ID = 'com.apple.CoreSimulator.SimRuntime.iOS-26-0';

describe('iOS simulator metadata', () => {
  it('binds the selected booted device to its installed runtime build', () => {
    expect(
      inspectBootedIosSimulatorMetadata({
        devices: {
          devices: {
            [RUNTIME_ID]: [
              { state: 'Booted', name: 'iPhone 16 Pro', udid: UDID },
            ],
          },
        },
        runtimes: {
          runtimes: [
            {
              identifier: RUNTIME_ID,
              name: 'iOS 26.0',
              buildversion: '23A340',
              isAvailable: true,
            },
          ],
        },
        udid: UDID,
      })
    ).toEqual({
      status: 'passed',
      udid: UDID,
      runtimeIdentifier: RUNTIME_ID,
      runtime: 'iOS 26.0',
      osBuild: '23A340',
      device: 'iPhone 16 Pro',
      error: null,
    });
  });

  it('rejects malformed and ambiguous simulator identifiers', () => {
    const malformed = inspectBootedIosSimulatorMetadata({
      devices: { devices: {} },
      runtimes: { runtimes: [] },
      udid: 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEZ',
    });
    expect(malformed.status).toBe('failed');
    expect(malformed.error).toContain('canonical simulator identifier');

    const ambiguous = inspectBootedIosSimulatorMetadata({
      devices: {
        devices: {
          [RUNTIME_ID]: [
            { state: 'Booted', name: 'iPhone 16 Pro', udid: UDID },
            { state: 'Booted', name: 'Duplicate', udid: UDID },
          ],
        },
      },
      runtimes: {
        runtimes: [
          {
            identifier: RUNTIME_ID,
            name: 'iOS 26.0',
            buildversion: '23A340',
            isAvailable: true,
          },
        ],
      },
      udid: UDID,
    });
    expect(ambiguous.status).toBe('failed');
    expect(ambiguous.error).toContain('exactly one iOS simulator device');
  });

  it('rejects non-booted devices and incomplete runtime metadata', () => {
    const report = inspectBootedIosSimulatorMetadata({
      devices: {
        devices: {
          [RUNTIME_ID]: [
            { state: 'Shutdown', name: '', udid: UDID },
          ],
        },
      },
      runtimes: {
        runtimes: [
          {
            identifier: RUNTIME_ID,
            name: '',
            buildversion: '',
            isAvailable: false,
          },
        ],
      },
      udid: UDID,
    });
    expect(report.status).toBe('failed');
    expect(report.error).toContain('selected simulator must be booted');
    expect(report.error).toContain('selected simulator name is required');
    expect(report.error).toContain('runtime must be available');
    expect(report.error).toContain('runtime name must identify iOS');
    expect(report.error).toContain('runtime buildversion is required');
  });

  it('rejects malformed device and runtime containers', () => {
    const report = inspectBootedIosSimulatorMetadata({
      devices: { devices: { [RUNTIME_ID]: null } },
      runtimes: { runtimes: null },
      udid: UDID,
    });
    expect(report.status).toBe('failed');
    expect(report.error).toContain('device list must be an array');
    expect(report.error).toContain('runtimes payload must contain a runtimes array');
  });

  it('ignores booted non-iOS devices while selecting the iOS simulator', () => {
    const report = inspectBootedIosSimulatorMetadata({
      devices: {
        devices: {
          'com.apple.CoreSimulator.SimRuntime.watchOS-26-0': [
            { state: 'Booted', name: 'Apple Watch', udid: UDID },
          ],
          [RUNTIME_ID]: [
            { state: 'Booted', name: 'iPhone 16 Pro', udid: UDID },
          ],
        },
      },
      runtimes: {
        runtimes: [
          {
            identifier: RUNTIME_ID,
            name: 'iOS 26.0',
            buildversion: '23A340',
            isAvailable: true,
          },
        ],
      },
    });
    expect(report.status).toBe('passed');
    expect(report.runtimeIdentifier).toBe(RUNTIME_ID);
  });

  it('rejects unavailable devices and unsafe runtime labels', () => {
    const report = inspectBootedIosSimulatorMetadata({
      devices: {
        devices: {
          [RUNTIME_ID]: [
            {
              state: 'Booted',
              name: 'iPhone 16 Pro',
              udid: UDID,
              isAvailable: false,
            },
          ],
        },
      },
      runtimes: {
        runtimes: [
          {
            identifier: RUNTIME_ID,
            name: 'watchOS 26.0',
            buildversion: '23A340\nforged',
            isAvailable: true,
          },
        ],
      },
    });
    expect(report.status).toBe('failed');
    expect(report.error).toContain('device must be available');
    expect(report.error).toContain('runtime name must identify iOS');
    expect(report.error).toContain('runtime buildversion is required');
  });
});
