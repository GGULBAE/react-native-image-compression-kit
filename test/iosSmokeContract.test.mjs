import { describe, expect, it } from 'vitest';
import {
  createIOSValidationConfig,
  createSmokeTimeoutError,
  extractIOSSmokeDiagnosticExcerpt,
  formatIOSSmokePassPayloadSchema,
  formatIOSSmokeDiagnosticsSummary,
  formatSmokeTimeoutDiagnostics,
  getIOSSmokePassPayloadRequiredFields,
  IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_REQUIRED_FIELDS,
  IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS,
  IOS_SMOKE_PASS_PAYLOAD_REQUIRED_FIELDS,
  IOS_SMOKE_PASS_PAYLOAD_SCHEMA_MATRIX,
  IOS_SMOKE_PASS_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS,
  IOS_SMOKE_PASS_WEBP_OUTPUT_REQUIRED_FIELDS,
  listMissingIOSSmokePassPayloadFields,
  parseIOSSmokePassPayload,
  shouldRetrySmokeTimeout,
} from '../scripts/ios-smoke-contract.mjs';

const IOS_SMOKE_PASS_FIXTURE_FIELD_VALUES = Object.freeze({
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
  jpegToWebPResultBytes: 512,
  pngToWebPResultBytes: 528,
  gifToWebPResultBytes: 416,
  webpToWebPResultBytes: 380,
  heicToWebPResultBytes: 544,
  heifToWebPResultBytes: 544,
  avifToWebPResultBytes: 540,
  webpTargetSizeResultBytes: 872,
  targetSizeResultBytes: 940,
});

const IOS_SMOKE_PASS_REQUIRED_FIELDS_BY_MATRIX_ID = new Map([
  ['webp-output-unavailable-avif-input-available', IOS_SMOKE_PASS_PAYLOAD_REQUIRED_FIELDS],
  [
    'webp-output-unavailable-avif-input-unavailable',
    IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_REQUIRED_FIELDS,
  ],
  [
    'webp-output-available-avif-input-available',
    IOS_SMOKE_PASS_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS,
  ],
  [
    'webp-output-available-avif-input-unavailable',
    IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS,
  ],
]);

const IOS_SMOKE_PASS_MATRIX_FIELD_PROBES = Object.freeze({
  'webp-output-unavailable-avif-input-available': Object.freeze([
    'avifResultBytes',
  ]),
  'webp-output-unavailable-avif-input-unavailable': Object.freeze([
    'unsupportedInputs',
  ]),
  'webp-output-available-avif-input-available': Object.freeze([
    'jpegToWebPResultBytes',
    'pngToWebPResultBytes',
    'gifToWebPResultBytes',
    'webpToWebPResultBytes',
    'heicToWebPResultBytes',
    'heifToWebPResultBytes',
    'avifToWebPResultBytes',
  ]),
  'webp-output-available-avif-input-unavailable': Object.freeze([
    'heifToWebPResultBytes',
  ]),
});

const IOS_SMOKE_PASS_CI_LOG_REPLAY_FIXTURE = [
  'iOS host-app smoke\tRun iOS host-app smoke\t2026-07-08T08:25:57.8580780Z 2026-07-08 08:25:57.760 Df ImageCompressionKitExample[19401:e5d6] (ImageCompressionKitExample.debug.dylib) RNICK_IOS_SMOKE_STEP_PASS reject-png-metadata-preserve',
  [
    'iOS host-app smoke\tRun iOS host-app smoke\t2026-07-08T08:25:57.8583890Z',
    '2026-07-08 08:25:57.761 Df ImageCompressionKitExample[19401:db3e]',
    '(ImageCompressionKitExample.debug.dylib)',
    'RNICK_IOS_SMOKE_PASS',
    '{"platform":"ios","jpegResultBytes":883,"jpegPreserveResultBytes":942,"pngResultBytes":970,"gifResultBytes":776,"webpResultBytes":772,"heicResultBytes":1000,"heifResultBytes":1000,"avifResultBytes":998,"jpegToPngResultBytes":625,"pngToPngResultBytes":672,"gifToPngResultBytes":331,"webpToPngResultBytes":248,"heicToPngResultBytes":1071,"heifToPngResultBytes":1071,"avifToPngResultBytes":1066,"webpOutputAvailable":false,"avifInputAvailable":true,"targetSizeResultBytes":940,"unsupportedInputs":[],"unsupportedOutputs":["webp","heic","heif","avif"]}',
  ].join(' '),
].join('\n');

function createIOSSmokePassPayloadFixture({
  webpOutputAvailable,
  avifInputAvailable,
}) {
  const requiredFields = getIOSSmokePassPayloadRequiredFields({
    webpOutputAvailable,
    avifInputAvailable,
  });
  const fieldValues = {
    ...IOS_SMOKE_PASS_FIXTURE_FIELD_VALUES,
    webpOutputAvailable,
    avifInputAvailable,
    unsupportedInputs: avifInputAvailable ? [] : ['avif'],
    unsupportedOutputs: webpOutputAvailable
      ? ['heic', 'heif', 'avif']
      : ['webp', 'heic', 'heif', 'avif'],
  };

  return Object.fromEntries(
    requiredFields.map((field) => [field, fieldValues[field]])
  );
}

function createIOSSmokePassLogFixture(schemaCase) {
  return [
    'Metro ready on fixture port 8081',
    [
      '2026-07-08 07:41:00.000 Df ImageCompressionKitExample[24100:9f1b]',
      'RNICK_IOS_SMOKE_PASS',
      JSON.stringify(createIOSSmokePassPayloadFixture(schemaCase)),
    ].join(' '),
    'post-pass cleanup line',
  ].join('\n');
}

function omitFields(source, fields) {
  const clone = { ...source };
  for (const field of fields) {
    delete clone[field];
  }
  return clone;
}

function formatExpectedIOSSmokePassPayloadSchema(payload) {
  return Object.entries(payload)
    .map(([key, value]) => `${key}: ${describeExpectedFixtureSchemaValue(value)}`)
    .join('\n');
}

function describeExpectedFixtureSchemaValue(value) {
  if (Array.isArray(value)) {
    const elementType = value.length === 0 ? 'empty' : typeof value[0];
    return `array<${elementType}>(${value.length})`;
  }

  if (Number.isInteger(value)) {
    return 'integer';
  }

  return typeof value;
}

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

  it('snapshots every iOS smoke PASS payload schema matrix case from a fixture factory', () => {
    expect(IOS_SMOKE_PASS_PAYLOAD_SCHEMA_MATRIX.map(({ id }) => id)).toEqual([
      'webp-output-unavailable-avif-input-available',
      'webp-output-unavailable-avif-input-unavailable',
      'webp-output-available-avif-input-available',
      'webp-output-available-avif-input-unavailable',
    ]);
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

    for (const schemaCase of IOS_SMOKE_PASS_PAYLOAD_SCHEMA_MATRIX) {
      const payload = parseIOSSmokePassPayload(
        createIOSSmokePassLogFixture(schemaCase)
      );
      const expectedPayload = createIOSSmokePassPayloadFixture(schemaCase);
      const expectedRequiredFields =
        IOS_SMOKE_PASS_REQUIRED_FIELDS_BY_MATRIX_ID.get(schemaCase.id);
      const missingFieldProbe =
        IOS_SMOKE_PASS_MATRIX_FIELD_PROBES[schemaCase.id];

      expect(payload).toEqual(expectedPayload);
      expect(Object.keys(payload)).toEqual(schemaCase.requiredFields);
      expect(schemaCase.requiredFields).toEqual(expectedRequiredFields);
      expect(getIOSSmokePassPayloadRequiredFields(payload)).toEqual(
        schemaCase.requiredFields
      );
      expect(listMissingIOSSmokePassPayloadFields(payload)).toEqual([]);
      expect(payload.webpOutputAvailable).toBe(schemaCase.webpOutputAvailable);
      expect(payload.avifInputAvailable).toBe(schemaCase.avifInputAvailable);
      expect(payload.unsupportedInputs).toEqual(
        schemaCase.avifInputAvailable ? [] : ['avif']
      );
      expect(payload.unsupportedOutputs).toEqual(
        schemaCase.webpOutputAvailable
          ? ['heic', 'heif', 'avif']
          : ['webp', 'heic', 'heif', 'avif']
      );
      expect(formatIOSSmokePassPayloadSchema(payload)).toBe(
        formatExpectedIOSSmokePassPayloadSchema(expectedPayload)
      );
      expect(listMissingIOSSmokePassPayloadFields(
        omitFields(payload, missingFieldProbe)
      )).toEqual(missingFieldProbe);

      if (schemaCase.avifInputAvailable) {
        expect(payload).toHaveProperty('avifResultBytes');
        expect(payload).toHaveProperty('avifToPngResultBytes');
      } else {
        expect(payload).not.toHaveProperty('avifResultBytes');
        expect(payload).not.toHaveProperty('avifToPngResultBytes');
      }

      if (schemaCase.webpOutputAvailable) {
        expect(payload).toHaveProperty('webpTargetSizeResultBytes');
        expect(payload.unsupportedOutputs).not.toContain('webp');
      } else {
        expect(payload).not.toHaveProperty('webpTargetSizeResultBytes');
      }

      if (schemaCase.webpOutputAvailable && schemaCase.avifInputAvailable) {
        expect(payload).toHaveProperty('avifToWebPResultBytes');
      } else {
        expect(payload).not.toHaveProperty('avifToWebPResultBytes');
      }
    }

    expect(listMissingIOSSmokePassPayloadFields({ platform: 'ios' })).toEqual(
      IOS_SMOKE_PASS_PAYLOAD_REQUIRED_FIELDS.filter(
        (field) => field !== 'platform'
      )
    );
    expect(
      IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS
    ).not.toContain('avifToWebPResultBytes');
  });

  it('replays a successful GitHub Actions iOS smoke PASS log line against the matrix schema', () => {
    const schemaCase = IOS_SMOKE_PASS_PAYLOAD_SCHEMA_MATRIX.find(
      ({ id }) => id === 'webp-output-unavailable-avif-input-available'
    );
    const payload = parseIOSSmokePassPayload(
      IOS_SMOKE_PASS_CI_LOG_REPLAY_FIXTURE
    );

    expect(IOS_SMOKE_PASS_CI_LOG_REPLAY_FIXTURE).toContain(
      'iOS host-app smoke\tRun iOS host-app smoke\t2026-07-08T08:25:57.8583890Z'
    );
    expect(IOS_SMOKE_PASS_CI_LOG_REPLAY_FIXTURE).toContain(
      '(ImageCompressionKitExample.debug.dylib) RNICK_IOS_SMOKE_PASS'
    );
    expect(payload).toEqual(createIOSSmokePassPayloadFixture(schemaCase));
    expect(Object.keys(payload)).toEqual(schemaCase.requiredFields);
    expect(getIOSSmokePassPayloadRequiredFields(payload)).toEqual(
      schemaCase.requiredFields
    );
    expect(listMissingIOSSmokePassPayloadFields(payload)).toEqual([]);
    expect(formatIOSSmokePassPayloadSchema(payload)).toBe(
      formatExpectedIOSSmokePassPayloadSchema(payload)
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
