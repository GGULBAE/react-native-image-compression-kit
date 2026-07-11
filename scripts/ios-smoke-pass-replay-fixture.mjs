import { createHash } from 'node:crypto';
import {
  getIOSSmokePassPayloadContractDifferences,
  validateIOSSmokePassPayload,
} from './ios-smoke-contract.mjs';

export const IOS_SMOKE_PASS_REPLAY_FIXTURE_SCHEMA_VERSION = 1;

const ROOT_FIELDS = Object.freeze([
  'schemaVersion',
  'provenance',
  'sourceLine',
]);
const PROVENANCE_FIELDS = Object.freeze([
  'workflowName',
  'runId',
  'runUrl',
  'headSha',
  'jobName',
  'stepName',
  'logTimestamp',
  'sourceLineSha256',
]);
const PASS_MARKER = ' RNICK_IOS_SMOKE_PASS ';

export function extractSingleIOSSmokePassSourceLine(logText) {
  if (typeof logText !== 'string') {
    throw new Error('iOS smoke log text must be a string.');
  }

  const sourceLines = logText
    .split(/\r?\n/)
    .filter((line) => line.includes(PASS_MARKER));

  if (sourceLines.length !== 1) {
    throw new Error(
      `Expected exactly one RNICK_IOS_SMOKE_PASS source line, found ${sourceLines.length}.`
    );
  }

  return sourceLines[0];
}

export function createIOSSmokePassReplayFixture({
  logText,
  workflowName,
  runId,
  runUrl,
  headSha,
}) {
  const sourceLine = extractSingleIOSSmokePassSourceLine(logText);
  const { jobName, stepName, logTimestamp } = parseGitHubActionsLogPrefix(
    sourceLine
  );

  const fixture = {
    schemaVersion: IOS_SMOKE_PASS_REPLAY_FIXTURE_SCHEMA_VERSION,
    provenance: {
      workflowName: requireNonEmptyString(workflowName, 'workflowName'),
      runId: requirePositiveSafeInteger(runId, 'runId'),
      runUrl: requireNonEmptyString(runUrl, 'runUrl'),
      headSha: requireHeadSha(headSha),
      jobName,
      stepName,
      logTimestamp,
      sourceLineSha256: sha256(sourceLine),
    },
    sourceLine,
  };

  return validateIOSSmokePassReplayFixture(fixture);
}

export function validateIOSSmokePassReplayFixture(fixture) {
  requireRecord(fixture, 'fixture');
  requireExactFields(fixture, ROOT_FIELDS, 'fixture');

  if (fixture.schemaVersion !== IOS_SMOKE_PASS_REPLAY_FIXTURE_SCHEMA_VERSION) {
    throw new Error(
      `iOS smoke PASS replay fixture schemaVersion must be ${IOS_SMOKE_PASS_REPLAY_FIXTURE_SCHEMA_VERSION}.`
    );
  }

  requireRecord(fixture.provenance, 'fixture.provenance');
  requireExactFields(
    fixture.provenance,
    PROVENANCE_FIELDS,
    'fixture.provenance'
  );

  const provenance = fixture.provenance;
  requireNonEmptyString(provenance.workflowName, 'provenance.workflowName');
  requirePositiveSafeInteger(provenance.runId, 'provenance.runId');
  requireRunUrl(provenance.runUrl, provenance.runId);
  requireHeadSha(provenance.headSha);
  requireNonEmptyString(provenance.jobName, 'provenance.jobName');
  requireNonEmptyString(provenance.stepName, 'provenance.stepName');
  requireLogTimestamp(provenance.logTimestamp);
  requireSha256(provenance.sourceLineSha256);

  const sourceLine = extractSingleIOSSmokePassSourceLine(fixture.sourceLine);
  const sourceMetadata = parseGitHubActionsLogPrefix(sourceLine);
  const payloadText = sourceLine.slice(
    sourceLine.indexOf(PASS_MARKER) + PASS_MARKER.length
  );
  validateIOSSmokePassPayload(parsePayloadObject(payloadText));

  for (const field of ['jobName', 'stepName', 'logTimestamp']) {
    if (provenance[field] !== sourceMetadata[field]) {
      throw new Error(
        `fixture.provenance.${field} does not match the PASS source line.`
      );
    }
  }

  if (provenance.sourceLineSha256 !== sha256(sourceLine)) {
    throw new Error(
      'fixture.provenance.sourceLineSha256 does not match the PASS source line.'
    );
  }

  return fixture;
}

export function formatIOSSmokePassReplayFixture(fixture) {
  validateIOSSmokePassReplayFixture(fixture);
  return `${JSON.stringify(fixture, null, 2)}\n`;
}

export function getIOSSmokePassReplayFixtureDifferences(
  expectedFixture,
  actualFixture
) {
  validateIOSSmokePassReplayFixture(expectedFixture);

  if (!isRecord(actualFixture)) {
    return ['schema'];
  }

  const differences = [];

  if (!hasExactFields(actualFixture, ROOT_FIELDS)) {
    differences.push('schema');
  }

  if (actualFixture.schemaVersion !== expectedFixture.schemaVersion) {
    differences.push('schemaVersion');
  }

  if (!isRecord(actualFixture.provenance)) {
    differences.push('provenance');
  } else {
    if (!hasExactFields(actualFixture.provenance, PROVENANCE_FIELDS)) {
      differences.push('provenance.schema');
    } else {
      for (const field of PROVENANCE_FIELDS) {
        if (
          actualFixture.provenance[field] !== expectedFixture.provenance[field]
        ) {
          differences.push(`provenance.${field}`);
        }
      }
    }
  }

  if (actualFixture.sourceLine !== expectedFixture.sourceLine) {
    differences.push('sourceLine');
  }

  return differences;
}

export function getIOSSmokePassReplayFixtureValidationDifferences(fixture) {
  if (!isRecord(fixture)) {
    return ['schema'];
  }

  const differences = [];

  if (!hasExactFields(fixture, ROOT_FIELDS)) {
    differences.push('schema');
  }

  if (fixture.schemaVersion !== IOS_SMOKE_PASS_REPLAY_FIXTURE_SCHEMA_VERSION) {
    differences.push('schemaVersion');
  }

  const provenance = fixture.provenance;
  if (!isRecord(provenance)) {
    differences.push('provenance');
  } else {
    if (!hasExactFields(provenance, PROVENANCE_FIELDS)) {
      differences.push('provenance.schema');
    }

    for (const [field, validator] of [
      ['workflowName', () => requireNonEmptyString(provenance.workflowName, '')],
      ['runId', () => requirePositiveSafeInteger(provenance.runId, '')],
      ['runUrl', () => requireRunUrl(provenance.runUrl, provenance.runId)],
      ['headSha', () => requireHeadSha(provenance.headSha)],
      ['jobName', () => requireNonEmptyString(provenance.jobName, '')],
      ['stepName', () => requireNonEmptyString(provenance.stepName, '')],
      ['logTimestamp', () => requireLogTimestamp(provenance.logTimestamp)],
      ['sourceLineSha256', () => requireSha256(provenance.sourceLineSha256)],
    ]) {
      try {
        validator();
      } catch {
        differences.push(`provenance.${field}`);
      }
    }
  }

  let sourceLine;
  let sourceMetadata;
  try {
    sourceLine = extractSingleIOSSmokePassSourceLine(fixture.sourceLine);
    sourceMetadata = parseGitHubActionsLogPrefix(sourceLine);
  } catch {
    differences.push('sourceLine');
  }

  if (sourceLine && isRecord(provenance)) {
    if (sourceMetadata) {
      for (const field of ['jobName', 'stepName', 'logTimestamp']) {
        if (provenance[field] !== sourceMetadata[field]) {
          differences.push(`provenance.${field}`);
        }
      }
    }

    if (provenance.sourceLineSha256 !== sha256(sourceLine)) {
      differences.push('provenance.sourceLineSha256');
    }

    try {
      const payloadText = sourceLine.slice(
        sourceLine.indexOf(PASS_MARKER) + PASS_MARKER.length
      );
      differences.push(
        ...getIOSSmokePassPayloadContractDifferences(
          parsePayloadObject(payloadText)
        )
      );
    } catch {
      differences.push('payload.schema');
    }
  }

  return [...new Set(differences)];
}

function parseGitHubActionsLogPrefix(sourceLine) {
  const fields = sourceLine.split('\t');

  if (fields.length !== 3) {
    throw new Error(
      'RNICK_IOS_SMOKE_PASS source line must contain GitHub Actions job, step, and log fields.'
    );
  }

  const [jobName, stepName, logField] = fields;
  const timestampEnd = logField.indexOf(' ');

  if (timestampEnd < 0) {
    throw new Error(
      'RNICK_IOS_SMOKE_PASS source line is missing its GitHub Actions timestamp.'
    );
  }

  const logTimestamp = logField.slice(0, timestampEnd);
  requireNonEmptyString(jobName, 'sourceLine.jobName');
  requireNonEmptyString(stepName, 'sourceLine.stepName');
  requireLogTimestamp(logTimestamp);

  return { jobName, stepName, logTimestamp };
}

function requireRecord(value, label) {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function requireExactFields(value, expectedFields, label) {
  if (!hasExactFields(value, expectedFields)) {
    throw new Error(
      `${label} fields must be: ${expectedFields.join(', ')}.`
    );
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactFields(value, expectedFields) {
  return (
    JSON.stringify(Object.keys(value)) === JSON.stringify(expectedFields)
  );
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function requirePositiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer.`);
  }

  return value;
}

function requireRunUrl(value, runId) {
  requireNonEmptyString(value, 'provenance.runUrl');

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('provenance.runUrl must be a valid URL.');
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'github.com' ||
    !parsed.pathname.includes(`/actions/runs/${runId}`)
  ) {
    throw new Error(
      'provenance.runUrl must be an HTTPS GitHub Actions URL for provenance.runId.'
    );
  }
}

function requireHeadSha(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    throw new Error('headSha must be a lowercase 40-character Git SHA.');
  }

  return value;
}

function requireLogTimestamp(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/.test(value)
  ) {
    throw new Error(
      'provenance.logTimestamp must be a GitHub Actions UTC timestamp.'
    );
  }
}

function requireSha256(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(
      'provenance.sourceLineSha256 must be a lowercase SHA-256 digest.'
    );
  }
}

function parsePayloadObject(payloadText) {
  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    throw new Error('RNICK_IOS_SMOKE_PASS source line payload must be JSON.');
  }

  requireRecord(payload, 'RNICK_IOS_SMOKE_PASS source line payload');
  return payload;
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
