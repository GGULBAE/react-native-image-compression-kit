export interface ByteEconomicsInputs {
  acceptedCount: number;
  packageInputBytesPerAccepted: number;
  acceptedOutputBytesPerAccepted: number;
  matchedBaselineBytesPerAccepted: number | null;
  retentionDays: number;
  ownsStagingSource: boolean;
  storagePricePerDecimalGbMonth: number;
}

export interface ByteEconomicsResults {
  sourceToOutputByteDelta: number;
  newPipelineTransferBytes: number;
  matchedTransferDifferenceBytes: number | null;
  retainedOutputBytes: number;
  retainedOutputStorageCost: number;
  stagingReplacementDifferenceBytes: number | null;
  stagingReplacementStorageCostDifference: number | null;
  unchangedObjectCount: number;
  unchangedWriteRequestCount: number;
}

const DECIMAL_GB = 1_000_000_000;
const DAYS_PER_MONTH = 30;

export function calculateByteEconomics(
  inputs: ByteEconomicsInputs
): ByteEconomicsResults {
  const acceptedCount = requireSafeInteger(
    inputs.acceptedCount,
    'Accepted output count',
    0
  );
  const inputBytes = requireSafeInteger(
    inputs.packageInputBytesPerAccepted,
    'Package input bytes',
    1
  );
  const outputBytes = requireSafeInteger(
    inputs.acceptedOutputBytesPerAccepted,
    'Accepted output bytes',
    1
  );
  const baselineBytes =
    inputs.matchedBaselineBytesPerAccepted === null
      ? null
      : requireSafeInteger(
          inputs.matchedBaselineBytesPerAccepted,
          'Matched baseline transferred bytes',
          0
        );
  const retentionDays = requireFiniteNumber(
    inputs.retentionDays,
    'Retention days',
    0
  );
  const storagePrice = requireFiniteNumber(
    inputs.storagePricePerDecimalGbMonth,
    'Storage price',
    0
  );

  const retainedOutputBytes = safeByteProduct(
    acceptedCount,
    outputBytes,
    'Retained output bytes'
  );
  const sourceToOutputByteDelta = safeByteProduct(
    acceptedCount,
    inputBytes - outputBytes,
    'Source-to-output byte delta'
  );
  const matchedTransferDifferenceBytes =
    baselineBytes === null
      ? null
      : safeByteProduct(
          acceptedCount,
          baselineBytes - outputBytes,
          'Matched transfer difference'
        );
  const stagingReplacementDifferenceBytes = inputs.ownsStagingSource
    ? safeByteProduct(
        acceptedCount,
        inputBytes - outputBytes,
        'Staging replacement difference'
      )
    : null;
  const storageCost = (bytes: number) =>
    normalizeCurrency(
      ((bytes / DECIMAL_GB) * storagePrice * retentionDays) / DAYS_PER_MONTH
    );

  return {
    sourceToOutputByteDelta,
    newPipelineTransferBytes: retainedOutputBytes,
    matchedTransferDifferenceBytes,
    retainedOutputBytes,
    retainedOutputStorageCost: storageCost(retainedOutputBytes),
    stagingReplacementDifferenceBytes,
    stagingReplacementStorageCostDifference:
      stagingReplacementDifferenceBytes === null
        ? null
        : storageCost(stagingReplacementDifferenceBytes),
    unchangedObjectCount: acceptedCount,
    unchangedWriteRequestCount: acceptedCount,
  };
}

function requireSafeInteger(value: number, label: string, minimum: number) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${label} must be a safe integer of at least ${minimum}.`);
  }
  return value;
}

function requireFiniteNumber(value: number, label: string, minimum: number) {
  if (!Number.isFinite(value) || value < minimum) {
    throw new RangeError(`${label} must be a finite number of at least ${minimum}.`);
  }
  return value;
}

function safeByteProduct(count: number, bytes: number, label: string) {
  const total = count * bytes;
  if (!Number.isSafeInteger(total)) {
    throw new RangeError(`${label} exceeds JavaScript's safe integer range.`);
  }
  return total;
}

function normalizeCurrency(value: number) {
  const precision = 100_000_000;
  return Math.round(value * precision) / precision;
}
