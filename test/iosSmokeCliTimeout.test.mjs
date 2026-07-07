import { describe, expect, it } from 'vitest';
import {
  createIOSValidationConfig,
  createSmokeTimeoutErrorFromCLIState,
  formatSmokeRetryWarningMessages,
} from '../scripts/ios-smoke-contract.mjs';

describe('iOS smoke CLI timeout fixtures', () => {
  const config = createIOSValidationConfig({
    RNICK_IOS_SMOKE_TIMEOUT_MS: '45000',
    RNICK_IOS_SMOKE_ATTEMPTS: '3',
    RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW: '30m',
  });

  function createFixtureTimeoutError() {
    const calls = [];
    const udid = 'SIM-123';
    const bundleId = 'com.imagecompressionkit.example';
    const scheme = 'ImageCompressionKitExample';
    const commandOutputs = new Map([
      [
        `simctl get_app_container ${udid} ${bundleId} app`,
        '/tmp/ImageCompressionKitExample.app',
      ],
      [
        `simctl get_app_container ${udid} ${bundleId} data`,
        '/tmp/ImageCompressionKitExampleData',
      ],
      [`simctl spawn ${udid} pgrep -fl ${scheme}`, '4242 ImageCompressionKitExample'],
    ]);

    const error = createSmokeTimeoutErrorFromCLIState({
      config,
      attempt: 1,
      udid,
      bundleId,
      scheme,
      smokeLogOutput:
        'RNICK_IOS_SMOKE_START\nRNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg',
      launchOutput: `${bundleId}: 4242`,
      metroOutput: 'Metro ready on 8081\nRNICK_IOS_SMOKE_METRO fixture',
      simulatorSummary(nextUdid) {
        calls.push(['simulatorSummary', nextUdid]);
        return `iPhone Fixture (${nextUdid}) runtime=iOS-26-5 state=Booted available=true`;
      },
      optionalCommandOutput(command, args) {
        calls.push([command, args.join(' ')]);
        return commandOutputs.get(args.join(' ')) ?? 'missing fixture output';
      },
      recentIOSSmokeLogs(nextUdid) {
        calls.push(['recentIOSSmokeLogs', nextUdid]);
        return 'RNICK_IOS_SMOKE_START\nRNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg';
      },
    });

    return { calls, error };
  }

  it('assembles timeout diagnostics from fake CLI launch, log stream, Metro, and unified log output', () => {
    const { calls, error } = createFixtureTimeoutError();

    expect(calls).toEqual([
      ['simulatorSummary', 'SIM-123'],
      [
        'xcrun',
        'simctl get_app_container SIM-123 com.imagecompressionkit.example app',
      ],
      [
        'xcrun',
        'simctl get_app_container SIM-123 com.imagecompressionkit.example data',
      ],
      ['xcrun', 'simctl spawn SIM-123 pgrep -fl ImageCompressionKitExample'],
      ['recentIOSSmokeLogs', 'SIM-123'],
    ]);
    expect(error.rnickSmokeTimeout).toBe(true);
    expect(error.message).toContain(
      'Timed out waiting for RNICK_IOS_SMOKE_PASS after 45000ms.'
    );
    expect(error.message).toContain('iOS smoke attempt: 1/3');
    expect(error.message).toContain(
      '- simulator: iPhone Fixture (SIM-123) runtime=iOS-26-5 state=Booted available=true'
    );
    expect(error.message).toContain('- app container: /tmp/ImageCompressionKitExample.app');
    expect(error.message).toContain(
      '- app data container: /tmp/ImageCompressionKitExampleData'
    );
    expect(error.message).toContain('- app process lookup: 4242 ImageCompressionKitExample');
    expect(error.message).toContain(
      '- launch output:\n  com.imagecompressionkit.example: 4242'
    );
    expect(error.message).toContain('- captured RNICK_IOS_SMOKE stream tail:');
    expect(error.message).toContain('RNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg');
    expect(error.message).toContain('- Metro output tail:');
    expect(error.message).toContain('RNICK_IOS_SMOKE_METRO fixture');
    expect(error.message).toContain('- unified log tail (30m):');
  });

  it('keeps timeout diagnostics before the retry warning message', () => {
    const { error } = createFixtureTimeoutError();

    const warnings = formatSmokeRetryWarningMessages({
      error,
      attempt: 1,
      maxAttempts: config.smokeMaxAttempts,
    });

    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toBe(error.message);
    expect(warnings[0]).toContain('iOS smoke diagnostics:');
    expect(warnings[1]).toBe(
      [
        'iOS smoke attempt 1/3 timed out before RNICK_IOS_SMOKE_PASS.',
        'Retrying after terminating the app so the next attempt gets a fresh launch and log stream.',
      ].join('\n')
    );
  });
});
