import { describe, expect, it } from 'vitest';
import {
  createIOSValidationConfig,
  createSmokeTimeoutError,
  extractIOSSmokeDiagnosticExcerpt,
  formatIOSSmokePassPayloadSchema,
  formatIOSSmokeDiagnosticsSummary,
  formatSmokeTimeoutDiagnostics,
  getIOSSmokePassPayloadRequiredFields,
  IOS_SMOKE_PASS_PAYLOAD_REQUIRED_FIELDS,
  IOS_SMOKE_PASS_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS,
  IOS_SMOKE_PASS_WEBP_OUTPUT_REQUIRED_FIELDS,
  listMissingIOSSmokePassPayloadFields,
  parseIOSSmokePassPayload,
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

  it('snapshots the diagnostics summary markdown schema', () => {
    const logText = [
      'Installing ImageCompressionKitExample.app',
      'Starting iOS smoke attempt 1/2 with timeout=45000ms.',
      'RNICK_IOS_SMOKE_START',
      'Metro unrelated line',
      'Timed out waiting for RNICK_IOS_SMOKE_PASS after 45000ms.',
      'iOS smoke diagnostics:',
      '- captured RNICK_IOS_SMOKE stream tail:',
      '  RNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg',
      'Retrying after terminating the app so the next attempt gets a fresh launch and log stream.',
      'final cleanup line',
    ].join('\n');

    expect(
      formatIOSSmokeDiagnosticsSummary({
        logText,
        markerMaxLines: 20,
        tailMaxLines: 4,
      })
    ).toBe(
      [
        '## iOS smoke diagnostics',
        '',
        '### Key markers and diagnostics',
        '',
        '```text',
        'Starting iOS smoke attempt 1/2 with timeout=45000ms.',
        'RNICK_IOS_SMOKE_START',
        'Timed out waiting for RNICK_IOS_SMOKE_PASS after 45000ms.',
        'iOS smoke diagnostics:',
        '- captured RNICK_IOS_SMOKE stream tail:',
        '  RNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg',
        'Retrying after terminating the app so the next attempt gets a fresh launch and log stream.',
        '```',
        '',
        '### Packed log tail',
        '',
        '```text',
        '- captured RNICK_IOS_SMOKE stream tail:',
        '  RNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg',
        'Retrying after terminating the app so the next attempt gets a fresh launch and log stream.',
        'final cleanup line',
        '```',
      ].join('\n')
    );
  });

  it('snapshots empty and no-marker diagnostics summaries', () => {
    expect(
      formatIOSSmokeDiagnosticsSummary({
        logText: '',
        markerMaxLines: 5,
        tailMaxLines: 5,
      })
    ).toBe(
      [
        '## iOS smoke diagnostics',
        '',
        '### Key markers and diagnostics',
        '',
        '```text',
        '(no RNICK_IOS_SMOKE markers or diagnostics lines captured)',
        '```',
        '',
        '### Packed log tail',
        '',
        '```text',
        '(no iOS smoke log captured)',
        '```',
      ].join('\n')
    );

    expect(
      formatIOSSmokeDiagnosticsSummary({
        logText: [
          'Installing ImageCompressionKitExample.app',
          'Metro ready without smoke markers',
          'final cleanup line',
        ].join('\n'),
        markerMaxLines: 5,
        tailMaxLines: 5,
      })
    ).toBe(
      [
        '## iOS smoke diagnostics',
        '',
        '### Key markers and diagnostics',
        '',
        '```text',
        '(no RNICK_IOS_SMOKE markers or diagnostics lines captured)',
        '```',
        '',
        '### Packed log tail',
        '',
        '```text',
        'Installing ImageCompressionKitExample.app',
        'Metro ready without smoke markers',
        'final cleanup line',
        '```',
      ].join('\n')
    );
  });

  it('bounds very long diagnostics summaries to marker and tail windows', () => {
    const markerLines = Array.from(
      { length: 12 },
      (_, index) => `RNICK_IOS_SMOKE_STEP_${index + 1}`
    );
    const logLines = markerLines.flatMap((line, index) => [
      `noise line ${index + 1}`,
      line,
    ]);
    logLines.push('final cleanup line');

    expect(
      formatIOSSmokeDiagnosticsSummary({
        logText: logLines.join('\n'),
        markerMaxLines: 4,
        tailMaxLines: 5,
      })
    ).toBe(
      [
        '## iOS smoke diagnostics',
        '',
        '### Key markers and diagnostics',
        '',
        '```text',
        'RNICK_IOS_SMOKE_STEP_9',
        'RNICK_IOS_SMOKE_STEP_10',
        'RNICK_IOS_SMOKE_STEP_11',
        'RNICK_IOS_SMOKE_STEP_12',
        '```',
        '',
        '### Packed log tail',
        '',
        '```text',
        'noise line 11',
        'RNICK_IOS_SMOKE_STEP_11',
        'noise line 12',
        'RNICK_IOS_SMOKE_STEP_12',
        'final cleanup line',
        '```',
      ].join('\n')
    );
  });

  it('snapshots the iOS smoke PASS payload schema from a log fixture', () => {
    const passLogText = [
      'Metro ready on fixture port 8081',
      [
        '2026-07-08 03:59:29.520 Df ImageCompressionKitExample[12372:92a8]',
        'RNICK_IOS_SMOKE_PASS',
        '{"platform":"ios","jpegResultBytes":883,"jpegPreserveResultBytes":942,"pngResultBytes":970,"gifResultBytes":776,"webpResultBytes":772,"heicResultBytes":1000,"heifResultBytes":1000,"avifResultBytes":998,"jpegToPngResultBytes":625,"pngToPngResultBytes":672,"gifToPngResultBytes":331,"webpToPngResultBytes":248,"heicToPngResultBytes":1071,"heifToPngResultBytes":1071,"avifToPngResultBytes":1066,"webpOutputAvailable":false,"avifInputAvailable":true,"targetSizeResultBytes":940,"unsupportedInputs":[],"unsupportedOutputs":["webp","heic","heif","avif"]}',
      ].join(' '),
      'post-pass cleanup line',
    ].join('\n');

    const payload = parseIOSSmokePassPayload(passLogText);

    expect(payload).toEqual({
      platform: 'ios',
      jpegResultBytes: 883,
      jpegPreserveResultBytes: 942,
      pngResultBytes: 970,
      gifResultBytes: 776,
      webpResultBytes: 772,
      heicResultBytes: 1000,
      heifResultBytes: 1000,
      avifResultBytes: 998,
      jpegToPngResultBytes: 625,
      pngToPngResultBytes: 672,
      gifToPngResultBytes: 331,
      webpToPngResultBytes: 248,
      heicToPngResultBytes: 1071,
      heifToPngResultBytes: 1071,
      avifToPngResultBytes: 1066,
      webpOutputAvailable: false,
      avifInputAvailable: true,
      targetSizeResultBytes: 940,
      unsupportedInputs: [],
      unsupportedOutputs: ['webp', 'heic', 'heif', 'avif'],
    });
    expect(Object.keys(payload)).toEqual([
      'platform',
      'jpegResultBytes',
      'jpegPreserveResultBytes',
      'pngResultBytes',
      'gifResultBytes',
      'webpResultBytes',
      'heicResultBytes',
      'heifResultBytes',
      'avifResultBytes',
      'jpegToPngResultBytes',
      'pngToPngResultBytes',
      'gifToPngResultBytes',
      'webpToPngResultBytes',
      'heicToPngResultBytes',
      'heifToPngResultBytes',
      'avifToPngResultBytes',
      'webpOutputAvailable',
      'avifInputAvailable',
      'targetSizeResultBytes',
      'unsupportedInputs',
      'unsupportedOutputs',
    ]);
    expect(IOS_SMOKE_PASS_PAYLOAD_REQUIRED_FIELDS).toEqual(Object.keys(payload));
    expect(listMissingIOSSmokePassPayloadFields(payload)).toEqual([]);
    const { avifResultBytes, ...payloadWithoutAvifResultBytes } = payload;
    expect(listMissingIOSSmokePassPayloadFields(payloadWithoutAvifResultBytes)).toEqual([
      'avifResultBytes',
    ]);
    expect(listMissingIOSSmokePassPayloadFields({ platform: 'ios' })).toEqual([
      'jpegResultBytes',
      'jpegPreserveResultBytes',
      'pngResultBytes',
      'gifResultBytes',
      'webpResultBytes',
      'heicResultBytes',
      'heifResultBytes',
      'avifResultBytes',
      'jpegToPngResultBytes',
      'pngToPngResultBytes',
      'gifToPngResultBytes',
      'webpToPngResultBytes',
      'heicToPngResultBytes',
      'heifToPngResultBytes',
      'avifToPngResultBytes',
      'webpOutputAvailable',
      'avifInputAvailable',
      'targetSizeResultBytes',
      'unsupportedInputs',
      'unsupportedOutputs',
    ]);
    expect(formatIOSSmokePassPayloadSchema(payload)).toBe(
      [
        'platform: string',
        'jpegResultBytes: integer',
        'jpegPreserveResultBytes: integer',
        'pngResultBytes: integer',
        'gifResultBytes: integer',
        'webpResultBytes: integer',
        'heicResultBytes: integer',
        'heifResultBytes: integer',
        'avifResultBytes: integer',
        'jpegToPngResultBytes: integer',
        'pngToPngResultBytes: integer',
        'gifToPngResultBytes: integer',
        'webpToPngResultBytes: integer',
        'heicToPngResultBytes: integer',
        'heifToPngResultBytes: integer',
        'avifToPngResultBytes: integer',
        'webpOutputAvailable: boolean',
        'avifInputAvailable: boolean',
        'targetSizeResultBytes: integer',
        'unsupportedInputs: array<empty>(0)',
        'unsupportedOutputs: array<string>(4)',
      ].join('\n')
    );
  });

  it('snapshots the iOS smoke PASS payload schema when WebP output is available', () => {
    const passLogText = [
      'Metro ready on fixture port 8081',
      [
        '2026-07-08 05:18:42.102 Df ImageCompressionKitExample[22311:9f1b]',
        'RNICK_IOS_SMOKE_PASS',
        '{"platform":"ios","jpegResultBytes":883,"jpegPreserveResultBytes":942,"pngResultBytes":970,"gifResultBytes":776,"webpResultBytes":772,"heicResultBytes":1000,"heifResultBytes":1000,"avifResultBytes":998,"jpegToPngResultBytes":625,"pngToPngResultBytes":672,"gifToPngResultBytes":331,"webpToPngResultBytes":248,"heicToPngResultBytes":1071,"heifToPngResultBytes":1071,"avifToPngResultBytes":1066,"webpOutputAvailable":true,"avifInputAvailable":true,"jpegToWebPResultBytes":512,"pngToWebPResultBytes":528,"gifToWebPResultBytes":416,"webpToWebPResultBytes":380,"heicToWebPResultBytes":544,"heifToWebPResultBytes":544,"avifToWebPResultBytes":540,"webpTargetSizeResultBytes":872,"targetSizeResultBytes":940,"unsupportedInputs":[],"unsupportedOutputs":["heic","heif","avif"]}',
      ].join(' '),
      'post-pass cleanup line',
    ].join('\n');

    const payload = parseIOSSmokePassPayload(passLogText);

    expect(payload).toEqual({
      platform: 'ios',
      jpegResultBytes: 883,
      jpegPreserveResultBytes: 942,
      pngResultBytes: 970,
      gifResultBytes: 776,
      webpResultBytes: 772,
      heicResultBytes: 1000,
      heifResultBytes: 1000,
      avifResultBytes: 998,
      jpegToPngResultBytes: 625,
      pngToPngResultBytes: 672,
      gifToPngResultBytes: 331,
      webpToPngResultBytes: 248,
      heicToPngResultBytes: 1071,
      heifToPngResultBytes: 1071,
      avifToPngResultBytes: 1066,
      webpOutputAvailable: true,
      avifInputAvailable: true,
      jpegToWebPResultBytes: 512,
      pngToWebPResultBytes: 528,
      gifToWebPResultBytes: 416,
      webpToWebPResultBytes: 380,
      heicToWebPResultBytes: 544,
      heifToWebPResultBytes: 544,
      avifToWebPResultBytes: 540,
      webpTargetSizeResultBytes: 872,
      targetSizeResultBytes: 940,
      unsupportedInputs: [],
      unsupportedOutputs: ['heic', 'heif', 'avif'],
    });
    expect(Object.keys(payload)).toEqual(
      IOS_SMOKE_PASS_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS
    );
    expect(IOS_SMOKE_PASS_WEBP_OUTPUT_REQUIRED_FIELDS).toEqual([
      'jpegToWebPResultBytes',
      'pngToWebPResultBytes',
      'gifToWebPResultBytes',
      'webpToWebPResultBytes',
      'heicToWebPResultBytes',
      'heifToWebPResultBytes',
      'avifToWebPResultBytes',
      'webpTargetSizeResultBytes',
    ]);
    expect(getIOSSmokePassPayloadRequiredFields(payload)).toEqual(
      IOS_SMOKE_PASS_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS
    );
    expect(listMissingIOSSmokePassPayloadFields(payload)).toEqual([]);
    expect(payload.unsupportedOutputs).not.toContain('webp');
    const { webpTargetSizeResultBytes, ...payloadWithoutWebPTargetSize } = payload;
    expect(listMissingIOSSmokePassPayloadFields(payloadWithoutWebPTargetSize)).toEqual([
      'webpTargetSizeResultBytes',
    ]);
    const {
      jpegToWebPResultBytes,
      pngToWebPResultBytes,
      gifToWebPResultBytes,
      webpToWebPResultBytes,
      heicToWebPResultBytes,
      heifToWebPResultBytes,
      avifToWebPResultBytes,
      ...payloadWithoutWebPOutputResults
    } = payload;
    expect(listMissingIOSSmokePassPayloadFields(payloadWithoutWebPOutputResults)).toEqual([
      'jpegToWebPResultBytes',
      'pngToWebPResultBytes',
      'gifToWebPResultBytes',
      'webpToWebPResultBytes',
      'heicToWebPResultBytes',
      'heifToWebPResultBytes',
      'avifToWebPResultBytes',
    ]);
    expect(formatIOSSmokePassPayloadSchema(payload)).toBe(
      [
        'platform: string',
        'jpegResultBytes: integer',
        'jpegPreserveResultBytes: integer',
        'pngResultBytes: integer',
        'gifResultBytes: integer',
        'webpResultBytes: integer',
        'heicResultBytes: integer',
        'heifResultBytes: integer',
        'avifResultBytes: integer',
        'jpegToPngResultBytes: integer',
        'pngToPngResultBytes: integer',
        'gifToPngResultBytes: integer',
        'webpToPngResultBytes: integer',
        'heicToPngResultBytes: integer',
        'heifToPngResultBytes: integer',
        'avifToPngResultBytes: integer',
        'webpOutputAvailable: boolean',
        'avifInputAvailable: boolean',
        'jpegToWebPResultBytes: integer',
        'pngToWebPResultBytes: integer',
        'gifToWebPResultBytes: integer',
        'webpToWebPResultBytes: integer',
        'heicToWebPResultBytes: integer',
        'heifToWebPResultBytes: integer',
        'avifToWebPResultBytes: integer',
        'webpTargetSizeResultBytes: integer',
        'targetSizeResultBytes: integer',
        'unsupportedInputs: array<empty>(0)',
        'unsupportedOutputs: array<string>(3)',
      ].join('\n')
    );
  });

  it('handles missing and malformed iOS smoke PASS payload logs', () => {
    expect(parseIOSSmokePassPayload('RNICK_IOS_SMOKE_START')).toBeNull();
    expect(
      parseIOSSmokePassPayload(
        'Timed out waiting for RNICK_IOS_SMOKE_PASS after 45000ms.'
      )
    ).toBeNull();
    expect(
      parseIOSSmokePassPayload(
        'iOS smoke attempt 1/2 timed out before RNICK_IOS_SMOKE_PASS.'
      )
    ).toBeNull();
    expect(() => parseIOSSmokePassPayload('RNICK_IOS_SMOKE_PASS')).toThrow(
      'RNICK_IOS_SMOKE_PASS payload is missing.'
    );
    expect(() =>
      parseIOSSmokePassPayload('RNICK_IOS_SMOKE_PASS not-json')
    ).toThrow('RNICK_IOS_SMOKE_PASS payload JSON could not be parsed');
    expect(() => parseIOSSmokePassPayload('RNICK_IOS_SMOKE_PASS []')).toThrow(
      'RNICK_IOS_SMOKE_PASS payload must be a JSON object.'
    );
  });
});
