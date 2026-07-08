export const DEFAULT_IOS_VALIDATION_CONFIG = Object.freeze({
  metroPort: 8081,
  metroReadyTimeoutMs: 180000,
  smokeTimeoutMs: 180000,
  smokeMaxAttempts: 2,
  smokeLogStreamWarmupMs: 1000,
  smokeDiagnosticLogWindow: '10m',
  podInstallMaxAttempts: 2,
});

const IOS_SMOKE_PASS_BASE_RESULT_FIELDS = Object.freeze([
  'platform',
  'jpegResultBytes',
  'jpegPreserveResultBytes',
  'pngResultBytes',
  'gifResultBytes',
  'webpResultBytes',
  'heicResultBytes',
  'heifResultBytes',
]);

const IOS_SMOKE_PASS_AVIF_INPUT_RESULT_FIELDS = Object.freeze([
  'avifResultBytes',
]);

const IOS_SMOKE_PASS_PNG_OUTPUT_RESULT_FIELDS = Object.freeze([
  'jpegToPngResultBytes',
  'pngToPngResultBytes',
  'gifToPngResultBytes',
  'webpToPngResultBytes',
  'heicToPngResultBytes',
  'heifToPngResultBytes',
]);

const IOS_SMOKE_PASS_AVIF_TO_PNG_RESULT_FIELDS = Object.freeze([
  'avifToPngResultBytes',
]);

const IOS_SMOKE_PASS_CAPABILITY_FIELDS = Object.freeze([
  'webpOutputAvailable',
  'avifInputAvailable',
]);

const IOS_SMOKE_PASS_WEBP_OUTPUT_NON_AVIF_RESULT_FIELDS = Object.freeze([
  'jpegToWebPResultBytes',
  'pngToWebPResultBytes',
  'gifToWebPResultBytes',
  'webpToWebPResultBytes',
  'heicToWebPResultBytes',
  'heifToWebPResultBytes',
]);

const IOS_SMOKE_PASS_AVIF_TO_WEBP_RESULT_FIELDS = Object.freeze([
  'avifToWebPResultBytes',
]);

const IOS_SMOKE_PASS_WEBP_TARGET_SIZE_FIELDS = Object.freeze([
  'webpTargetSizeResultBytes',
]);

const IOS_SMOKE_PASS_TRAILING_FIELDS = Object.freeze([
  'targetSizeResultBytes',
  'unsupportedInputs',
  'unsupportedOutputs',
]);

function createIOSSmokePassPayloadRequiredFields({
  webpOutputAvailable,
  avifInputAvailable,
}) {
  return Object.freeze([
    ...IOS_SMOKE_PASS_BASE_RESULT_FIELDS,
    ...(avifInputAvailable ? IOS_SMOKE_PASS_AVIF_INPUT_RESULT_FIELDS : []),
    ...IOS_SMOKE_PASS_PNG_OUTPUT_RESULT_FIELDS,
    ...(avifInputAvailable ? IOS_SMOKE_PASS_AVIF_TO_PNG_RESULT_FIELDS : []),
    ...IOS_SMOKE_PASS_CAPABILITY_FIELDS,
    ...(webpOutputAvailable
      ? [
          ...IOS_SMOKE_PASS_WEBP_OUTPUT_NON_AVIF_RESULT_FIELDS,
          ...(avifInputAvailable ? IOS_SMOKE_PASS_AVIF_TO_WEBP_RESULT_FIELDS : []),
          ...IOS_SMOKE_PASS_WEBP_TARGET_SIZE_FIELDS,
        ]
      : []),
    ...IOS_SMOKE_PASS_TRAILING_FIELDS,
  ]);
}

export const IOS_SMOKE_PASS_WEBP_OUTPUT_REQUIRED_FIELDS = Object.freeze([
  ...IOS_SMOKE_PASS_WEBP_OUTPUT_NON_AVIF_RESULT_FIELDS,
  ...IOS_SMOKE_PASS_AVIF_TO_WEBP_RESULT_FIELDS,
  ...IOS_SMOKE_PASS_WEBP_TARGET_SIZE_FIELDS,
]);

function createIOSSmokePassPayloadSchemaCase({
  id,
  webpOutputAvailable,
  avifInputAvailable,
}) {
  return Object.freeze({
    id,
    webpOutputAvailable,
    avifInputAvailable,
    requiredFields: createIOSSmokePassPayloadRequiredFields({
      webpOutputAvailable,
      avifInputAvailable,
    }),
  });
}

export const IOS_SMOKE_PASS_PAYLOAD_SCHEMA_MATRIX = Object.freeze([
  createIOSSmokePassPayloadSchemaCase({
    id: 'webp-output-unavailable-avif-input-available',
    webpOutputAvailable: false,
    avifInputAvailable: true,
  }),
  createIOSSmokePassPayloadSchemaCase({
    id: 'webp-output-unavailable-avif-input-unavailable',
    webpOutputAvailable: false,
    avifInputAvailable: false,
  }),
  createIOSSmokePassPayloadSchemaCase({
    id: 'webp-output-available-avif-input-available',
    webpOutputAvailable: true,
    avifInputAvailable: true,
  }),
  createIOSSmokePassPayloadSchemaCase({
    id: 'webp-output-available-avif-input-unavailable',
    webpOutputAvailable: true,
    avifInputAvailable: false,
  }),
]);

function getIOSSmokePassPayloadSchemaCase({
  webpOutputAvailable,
  avifInputAvailable,
}) {
  return IOS_SMOKE_PASS_PAYLOAD_SCHEMA_MATRIX.find(
    (schemaCase) =>
      schemaCase.webpOutputAvailable === webpOutputAvailable &&
      schemaCase.avifInputAvailable === avifInputAvailable
  );
}

export const IOS_SMOKE_PASS_PAYLOAD_REQUIRED_FIELDS =
  getIOSSmokePassPayloadSchemaCase({
    webpOutputAvailable: false,
    avifInputAvailable: true,
  }).requiredFields;

export const IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_REQUIRED_FIELDS =
  getIOSSmokePassPayloadSchemaCase({
    webpOutputAvailable: false,
    avifInputAvailable: false,
  }).requiredFields;

export const IOS_SMOKE_PASS_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS =
  getIOSSmokePassPayloadSchemaCase({
    webpOutputAvailable: true,
    avifInputAvailable: true,
  }).requiredFields;

export const IOS_SMOKE_PASS_AVIF_INPUT_UNAVAILABLE_WEBP_OUTPUT_AVAILABLE_REQUIRED_FIELDS =
  getIOSSmokePassPayloadSchemaCase({
    webpOutputAvailable: true,
    avifInputAvailable: false,
  }).requiredFields;

export function createIOSValidationConfig(env = {}) {
  return {
    metroPort: parsePositiveInteger(
      env.RNICK_IOS_METRO_PORT,
      DEFAULT_IOS_VALIDATION_CONFIG.metroPort
    ),
    metroReadyTimeoutMs: parsePositiveInteger(
      env.RNICK_IOS_METRO_READY_TIMEOUT_MS,
      DEFAULT_IOS_VALIDATION_CONFIG.metroReadyTimeoutMs
    ),
    smokeTimeoutMs: parsePositiveInteger(
      env.RNICK_IOS_SMOKE_TIMEOUT_MS,
      DEFAULT_IOS_VALIDATION_CONFIG.smokeTimeoutMs
    ),
    smokeMaxAttempts: parsePositiveInteger(
      env.RNICK_IOS_SMOKE_ATTEMPTS,
      DEFAULT_IOS_VALIDATION_CONFIG.smokeMaxAttempts
    ),
    smokeLogStreamWarmupMs: parsePositiveInteger(
      env.RNICK_IOS_SMOKE_LOG_STREAM_WARMUP_MS,
      DEFAULT_IOS_VALIDATION_CONFIG.smokeLogStreamWarmupMs
    ),
    smokeDiagnosticLogWindow: parseNonEmptyString(
      env.RNICK_IOS_SMOKE_DIAGNOSTIC_LOG_WINDOW,
      DEFAULT_IOS_VALIDATION_CONFIG.smokeDiagnosticLogWindow
    ),
    podInstallMaxAttempts: parsePositiveInteger(
      env.RNICK_IOS_POD_INSTALL_ATTEMPTS,
      DEFAULT_IOS_VALIDATION_CONFIG.podInstallMaxAttempts
    ),
  };
}

export function parseIOSSmokePassPayload(logText) {
  const passMarker = 'RNICK_IOS_SMOKE_PASS';
  const passLine = String(logText ?? '')
    .split(/\r?\n/)
    .find((line) => isIOSSmokePassPayloadLine(line, passMarker));

  if (!passLine) {
    return null;
  }

  const payloadText = passLine
    .slice(passLine.indexOf(passMarker) + passMarker.length)
    .trim();

  if (payloadText.length === 0) {
    throw new Error('RNICK_IOS_SMOKE_PASS payload is missing.');
  }

  let parsed;
  try {
    parsed = JSON.parse(payloadText);
  } catch (error) {
    throw new Error(
      `RNICK_IOS_SMOKE_PASS payload JSON could not be parsed: ${error.message}`
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('RNICK_IOS_SMOKE_PASS payload must be a JSON object.');
  }

  return parsed;
}

function isIOSSmokePassPayloadLine(line, passMarker) {
  const markerIndex = line.indexOf(passMarker);
  if (markerIndex === -1) {
    return false;
  }

  const prefix = line.slice(0, markerIndex).toLowerCase();
  return (
    !prefix.includes('timed out waiting for') &&
    !prefix.includes('timed out before')
  );
}

export function listMissingIOSSmokePassPayloadFields(
  payload,
  requiredFields
) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const fields = requiredFields ?? getIOSSmokePassPayloadRequiredFields(source);
  return fields.filter(
    (field) => !Object.prototype.hasOwnProperty.call(source, field)
  );
}

export function getIOSSmokePassPayloadRequiredFields(payload) {
  if (!payload || typeof payload !== 'object') {
    return IOS_SMOKE_PASS_PAYLOAD_REQUIRED_FIELDS;
  }

  const schemaCase = getIOSSmokePassPayloadSchemaCase({
    webpOutputAvailable: payload.webpOutputAvailable === true,
    avifInputAvailable: payload.avifInputAvailable !== false,
  });

  return schemaCase.requiredFields;
}

export function formatIOSSmokePassPayloadSchema(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return Object.entries(source)
    .map(([key, value]) => `${key}: ${describePayloadValueSchema(value)}`)
    .join('\n');
}

export function isSmokeTimeoutError(error) {
  return Boolean(error && typeof error === 'object' && error.rnickSmokeTimeout === true);
}

export function shouldRetrySmokeTimeout({ error, attempt, maxAttempts }) {
  return isSmokeTimeoutError(error) && attempt < maxAttempts;
}

export function formatSmokeRetryWarning({ attempt, maxAttempts }) {
  return [
    `iOS smoke attempt ${attempt}/${maxAttempts} timed out before RNICK_IOS_SMOKE_PASS.`,
    'Retrying after terminating the app so the next attempt gets a fresh launch and log stream.',
  ].join('\n');
}

export function formatSmokeRetryWarningMessages({ error, attempt, maxAttempts }) {
  return [
    error instanceof Error ? error.message : String(error),
    formatSmokeRetryWarning({ attempt, maxAttempts }),
  ];
}

export function createSmokeTimeoutErrorFromCLIState({
  config,
  attempt,
  udid,
  bundleId,
  scheme,
  smokeLogOutput,
  launchOutput,
  metroOutput,
  simulatorSummary,
  optionalCommandOutput,
  recentIOSSmokeLogs,
}) {
  return createSmokeTimeoutError({
    smokeTimeoutMs: config.smokeTimeoutMs,
    attempt,
    maxAttempts: config.smokeMaxAttempts,
    diagnosticLogWindow: config.smokeDiagnosticLogWindow,
    simulator: simulatorSummary(udid),
    appContainer: optionalCommandOutput('xcrun', [
      'simctl',
      'get_app_container',
      udid,
      bundleId,
      'app',
    ]),
    appDataContainer: optionalCommandOutput('xcrun', [
      'simctl',
      'get_app_container',
      udid,
      bundleId,
      'data',
    ]),
    appProcessLookup: optionalCommandOutput('xcrun', [
      'simctl',
      'spawn',
      udid,
      'pgrep',
      '-fl',
      scheme,
    ]),
    smokeLogOutput,
    launchOutput,
    metroOutput,
    unifiedLogTail: recentIOSSmokeLogs(udid),
  });
}

export function createSmokeAttemptLifecycle({
  metroProcess,
  logProcess,
  setLogProcess,
  stopProcess,
  clearAttemptTimeout,
  writeOutput = () => {},
  onPass,
  onFail,
}) {
  let markerBuffer = '';
  let smokeLogOutput = '';
  let launchOutput = '';
  let settled = false;

  const onData = (chunk, { smokeLog = false } = {}) => {
    const text = chunk.toString();
    markerBuffer += text;

    if (smokeLog) {
      smokeLogOutput += text;
    }

    if (text.length > 0) {
      writeOutput(text);
    }

    if (markerBuffer.includes('RNICK_IOS_SMOKE_FAIL')) {
      finish(onFail, new Error(`iOS smoke failed:\n${markerBuffer}`));
    } else if (markerBuffer.includes('RNICK_IOS_SMOKE_PASS')) {
      finish(onPass);
    }
  };
  const onMetroData = (chunk) => {
    onData(chunk);
  };
  const onSmokeLogData = (chunk) => {
    onData(chunk, { smokeLog: true });
  };
  const onLogProcessError = (error) => {
    onData(Buffer.from(`iOS smoke log stream error: ${error.message}\n`), {
      smokeLog: true,
    });
  };

  const attach = () => {
    metroProcess.stdout.on('data', onMetroData);
    metroProcess.stderr.on('data', onMetroData);
    logProcess.stdout.on('data', onSmokeLogData);
    logProcess.stderr.on('data', onSmokeLogData);
    logProcess.on('error', onLogProcessError);
    setLogProcess(logProcess);
  };

  const finish = (callback, error) => {
    if (settled) {
      return;
    }

    settled = true;
    clearAttemptTimeout();
    metroProcess.stdout.off('data', onMetroData);
    metroProcess.stderr.off('data', onMetroData);
    logProcess.stdout.off('data', onSmokeLogData);
    logProcess.stderr.off('data', onSmokeLogData);
    logProcess.off('error', onLogProcessError);
    stopProcess(logProcess);
    setLogProcess(null);

    if (error) {
      callback(error);
    } else {
      callback();
    }
  };

  return {
    attach,
    finish,
    setLaunchOutput(value) {
      launchOutput = String(value ?? '');
    },
    snapshot() {
      return {
        launchOutput,
        markerBuffer,
        settled,
        smokeLogOutput,
      };
    },
  };
}

export function createSmokeTimeoutError(options) {
  const error = new Error(formatSmokeTimeoutDiagnostics(options));
  error.rnickSmokeTimeout = true;
  return error;
}

export function formatSmokeTimeoutDiagnostics({
  smokeTimeoutMs,
  attempt,
  maxAttempts,
  diagnosticLogWindow,
  simulator,
  appContainer,
  appDataContainer,
  appProcessLookup,
  launchOutput,
  smokeLogOutput,
  metroOutput,
  unifiedLogTail,
}) {
  return [
    `Timed out waiting for RNICK_IOS_SMOKE_PASS after ${smokeTimeoutMs}ms.`,
    `iOS smoke attempt: ${attempt}/${maxAttempts}`,
    'iOS smoke diagnostics:',
    `- simulator: ${formatInline(simulator)}`,
    `- app container: ${formatInline(appContainer)}`,
    `- app data container: ${formatInline(appDataContainer)}`,
    `- app process lookup: ${formatInline(appProcessLookup)}`,
    `- launch output:\n${indentBlock(formatBlock(launchOutput, '(no launch output captured)'))}`,
    `- captured RNICK_IOS_SMOKE stream tail:\n${indentBlock(
      tailLines(formatBlock(smokeLogOutput, '(no RNICK_IOS_SMOKE lines captured)'), 120)
    )}`,
    `- Metro output tail:\n${indentBlock(
      tailLines(formatBlock(metroOutput, '(no Metro output captured)'), 120)
    )}`,
    `- unified log tail (${diagnosticLogWindow}):\n${indentBlock(
      formatBlock(unifiedLogTail, '(no matching unified log entries captured)')
    )}`,
  ].join('\n');
}

export function parsePositiveInteger(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultValue;
  }

  return parsed;
}

export function tailLines(value, maxLines) {
  return String(value)
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-maxLines)
    .join('\n');
}

const IOS_SMOKE_DIAGNOSTIC_LINE_PATTERN =
  /Starting iOS smoke attempt|RNICK_IOS_SMOKE|Timed out waiting for RNICK_IOS_SMOKE_PASS|iOS smoke diagnostics:|iOS smoke failed:|iOS smoke log stream error:|Retrying after terminating the app/;

export function extractIOSSmokeDiagnosticExcerpt(logText, maxLines = 160) {
  return tailLines(
    String(logText ?? '')
      .split(/\r?\n/)
      .filter((line) => IOS_SMOKE_DIAGNOSTIC_LINE_PATTERN.test(line))
      .join('\n'),
    maxLines
  );
}

export function formatIOSSmokeDiagnosticsSummary({
  logText,
  markerMaxLines = 80,
  tailMaxLines = 160,
} = {}) {
  const parsedLogText = String(logText ?? '');
  const diagnosticExcerpt = extractIOSSmokeDiagnosticExcerpt(
    parsedLogText,
    markerMaxLines
  );
  const packedLogTail = tailLines(formatBlock(parsedLogText, '(no iOS smoke log captured)'), tailMaxLines);

  return [
    '## iOS smoke diagnostics',
    '',
    '### Key markers and diagnostics',
    '',
    '```text',
    formatBlock(
      diagnosticExcerpt,
      '(no RNICK_IOS_SMOKE markers or diagnostics lines captured)'
    ),
    '```',
    '',
    '### Packed log tail',
    '',
    '```text',
    packedLogTail,
    '```',
  ].join('\n');
}

function parseNonEmptyString(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = String(value).trim();
  return parsed.length > 0 ? parsed : defaultValue;
}

function formatInline(value) {
  return formatBlock(value, 'unavailable');
}

function formatBlock(value, fallback) {
  const parsed = String(value ?? '').trim();
  return parsed.length > 0 ? parsed : fallback;
}

function describePayloadValueSchema(value) {
  if (Array.isArray(value)) {
    const itemTypes = [...new Set(value.map((entry) => typeof entry))];
    return `array<${itemTypes.length > 0 ? itemTypes.join('|') : 'empty'}>(${value.length})`;
  }

  if (Number.isInteger(value)) {
    return 'integer';
  }

  return typeof value;
}

function indentBlock(value) {
  return String(value)
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join('\n');
}
