import { describe, expect, it } from 'vitest';
import {
  createIOSValidationConfig,
  createSmokeTimeoutError,
  extractIOSSmokeDiagnosticExcerpt,
  formatIOSSmokeDiagnosticsSummary,
  formatSmokeTimeoutDiagnostics,
  shouldRetrySmokeTimeout,
} from '../scripts/ios-smoke-contract.mjs';

describe('iOS smoke contract helpers', () => {
  it('parses default and overridden iOS validation environment values', () => {
    expect(createIOSValidationConfig({})).toEqual({
      metroPort: 8081,
      metroReadyTimeoutMs: 180000,
      smokeTimeoutMs: 180000,
      smokeMaxAttempts: 2,
      smokeLogStreamWarmupMs: 1000,
      smokeDiagnosticLogWindow: '10m',
      podInstallMaxAttempts: 2,
    });

    expect(
      createIOSValidationConfig({
        RNICK_IOS_METRO_PORT: '8181',
        RNICK_IOS_METRO_READY_TIMEOUT_MS: '90000',
        RNICK_IOS_SMOKE_TIMEOUT_MS: '45000',
        RNICK_IOS_SMOKE_ATTEMPTS: '4',
        RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS: '2500',
        RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW: '30m',
        RNICK_IOS_POD_INSTALL_ATTEMPTS: '3',
      })
    ).toEqual({
      metroPort: 8181,
      metroReadyTimeoutMs: 90000,
      smokeTimeoutMs: 45000,
      smokeMaxAttempts: 4,
      smokeLogStreamWarmupMs: 2500,
      smokeDiagnosticLogWindow: '30m',
      podInstallMaxAttempts: 3,
    });
  });

  it('falls back to defaults for invalid positive integer and empty window overrides', () => {
    expect(
      createIOSValidationConfig({
        RNICK_IOS_METRO_PORT: '0',
        RNICK_IOS_METRO_READY_TIMEOUT_MS: '-1',
        RNICK_IOS_SMOKE_TIMEOUT_MS: 'abc',
        RNICK_IOS_SMOKE_ATTEMPTS: '1.5',
        RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS: '',
        RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW: '   ',
        RNICK_IOS_POD_INSTALL_ATTEMPTS: 'NaN',
      })
    ).toEqual({
      metroPort: 8081,
      metroReadyTimeoutMs: 180000,
      smokeTimeoutMs: 180000,
      smokeMaxAttempts: 2,
      smokeLogStreamWarmupMs: 1000,
      smokeDiagnosticLogWindow: '10m',
      podInstallMaxAttempts: 2,
    });
  });

  it('retries timeout-only errors before the final attempt', () => {
    const timeoutError = createSmokeTimeoutError({
      smokeTimeoutMs: 180000,
      attempt: 1,
      maxAttempts: 2,
      diagnosticLogWindow: '10m',
      simulator: 'iPhone 17 Pro (UDID) runtime=iOS-26-5 state=Booted available=true',
      appContainer: '/tmp/ImageCompressionKitExample.app',
      appDataContainer: '/tmp/data',
      appProcessLookup: '123 ImageCompressionKitExample',
      launchOutput: 'com.imagecompressionkit.example: 123',
      smokeLogOutput: 'RNICK_IOS_SMOKE_START',
      metroOutput: 'Metro ready',
      unifiedLogTail: 'RNICK_IOS_SMOKE_START',
    });

    expect(timeoutError.rnickSmokeTimeout).toBe(true);
    expect(
      shouldRetrySmokeTimeout({
        error: timeoutError,
        attempt: 1,
        maxAttempts: 2,
      })
    ).toBe(true);
    expect(
      shouldRetrySmokeTimeout({
        error: timeoutError,
        attempt: 2,
        maxAttempts: 2,
      })
    ).toBe(false);
    expect(
      shouldRetrySmokeTimeout({
        error: new Error('RNICK_IOS_SMOKE_FAIL'),
        attempt: 1,
        maxAttempts: 2,
      })
    ).toBe(false);
  });

  it('formats timeout diagnostics with simulator, app, process, launch, log, and Metro state', () => {
    const smokeLines = Array.from(
      { length: 125 },
      (_, index) => `RNICK_IOS_SMOKE_STEP_${index + 1}`
    ).join('\n');
    const metroLines = Array.from(
      { length: 125 },
      (_, index) => `Metro line ${index + 1}`
    ).join('\n');

    const diagnostics = formatSmokeTimeoutDiagnostics({
      smokeTimeoutMs: 45000,
      attempt: 2,
      maxAttempts: 4,
      diagnosticLogWindow: '30m',
      simulator: 'iPhone 17 Pro (UDID) runtime=iOS-26-5 state=Booted available=true',
      appContainer: '/tmp/ImageCompressionKitExample.app',
      appDataContainer: '/tmp/ImageCompressionKitExampleData',
      appProcessLookup: '123 ImageCompressionKitExample',
      launchOutput: 'com.imagecompressionkit.example: 123',
      smokeLogOutput: smokeLines,
      metroOutput: metroLines,
      unifiedLogTail: 'RNICK_IOS_SMOKE_START\nRNICK_IOS_SMOKE_STEP_START',
    });

    expect(diagnostics).toContain(
      'Timed out waiting for RNICK_IOS_SMOKE_PASS after 45000ms.'
    );
    expect(diagnostics).toContain('iOS smoke attempt: 2/4');
    expect(diagnostics).toContain('iOS smoke diagnostics:');
    expect(diagnostics).toContain(
      '- simulator: iPhone 17 Pro (UDID) runtime=iOS-26-5 state=Booted available=true'
    );
    expect(diagnostics).toContain('- app container: /tmp/ImageCompressionKitExample.app');
    expect(diagnostics).toContain(
      '- app data container: /tmp/ImageCompressionKitExampleData'
    );
    expect(diagnostics).toContain('- app process lookup: 123 ImageCompressionKitExample');
    expect(diagnostics).toContain('- launch output:\n  com.imagecompressionkit.example: 123');
    expect(diagnostics).toContain('- captured RNICK_IOS_SMOKE stream tail:');
    expect(diagnostics).toContain('RNICK_IOS_SMOKE_STEP_125');
    expect(diagnostics.split('\n')).not.toContain('  RNICK_IOS_SMOKE_STEP_1');
    expect(diagnostics).toContain('- Metro output tail:');
    expect(diagnostics).toContain('Metro line 125');
    expect(diagnostics.split('\n')).not.toContain('  Metro line 1');
    expect(diagnostics).toContain('- unified log tail (30m):');
    expect(diagnostics).toContain('RNICK_IOS_SMOKE_STEP_START');
  });

  it('formats packed diagnostics summary with key markers before the log tail', () => {
    const logText = [
      'Installing ImageCompressionKitExample.app',
      'Starting iOS smoke attempt 1/2 with timeout=45000ms.',
      'RNICK_IOS_SMOKE_START',
      'Metro unrelated line',
      'Timed out waiting for RNICK_IOS_SMOKE_PASS after 45000ms.',
      'iOS smoke diagnostics:',
      '- simulator: iPhone Fixture state=Booted',
      '- captured RNICK_IOS_SMOKE stream tail:',
      '  RNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg',
      'iOS smoke log stream error: fixture log stream disconnected',
      'Retrying after terminating the app so the next attempt gets a fresh launch and log stream.',
      'final cleanup line',
    ].join('\n');

    expect(extractIOSSmokeDiagnosticExcerpt(logText, 10)).toBe(
      [
        'Starting iOS smoke attempt 1/2 with timeout=45000ms.',
        'RNICK_IOS_SMOKE_START',
        'Timed out waiting for RNICK_IOS_SMOKE_PASS after 45000ms.',
        'iOS smoke diagnostics:',
        '- captured RNICK_IOS_SMOKE stream tail:',
        '  RNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg',
        'iOS smoke log stream error: fixture log stream disconnected',
        'Retrying after terminating the app so the next attempt gets a fresh launch and log stream.',
      ].join('\n')
    );

    const summary = formatIOSSmokeDiagnosticsSummary({
      logText,
      markerMaxLines: 10,
      tailMaxLines: 4,
    });

    expect(summary).toContain('## iOS smoke diagnostics');
    expect(summary).toContain('### Key markers and diagnostics');
    expect(summary).toContain('RNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg');
    expect(summary).toContain('iOS smoke log stream error: fixture log stream disconnected');
    expect(summary).toContain('### Packed log tail');
    expect(summary).toContain('final cleanup line');
    expect(summary).not.toContain('Installing ImageCompressionKitExample.app');
    expect(summary.indexOf('### Key markers and diagnostics')).toBeLessThan(
      summary.indexOf('### Packed log tail')
    );
  });
});
