import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseChunkedNativePayload, summarizeBenchmarkSamples } from './benchmark-core.mjs';
import { inspectDemoVisualAgreement } from './demo-visual-agreement-core.mjs';

export const ECONOMIC_RESILIENCE_SCHEMA_VERSION = 1;
export const ECONOMIC_RESILIENCE_SCENARIO_ID = 'kit-only-12mp-jpeg-v1';
export const ECONOMIC_RESILIENCE_CHUNK_MARKER =
  'RNICK_ECONOMIC_RESILIENCE_CHUNK';
export const ECONOMIC_RESILIENCE_PASS_MARKER =
  'RNICK_ECONOMIC_RESILIENCE_PASS';
export const ECONOMIC_RESILIENCE_ASSET_FILES = Object.freeze([
  'economic-resilience.json',
  'environment.json',
  'fixture-manifest.json',
  'output.jpg',
  'source.jpg',
  'visual-agreement.json',
]);
export const ECONOMIC_RESILIENCE_FIXTURE = Object.freeze({
  id: 'kit-only-12mp-v1',
  file: 'kit-only-12mp-v1.jpg',
  mediaType: 'image/jpeg',
  width: 4000,
  height: 3000,
  pixelCount: 12_000_000,
  orientation: 1,
  orientationEncoding: 'implicit-default-no-exif-orientation',
  byteSize: 1_721_333,
  maximumFixtureByteSize: 8_000_000,
  sha256: 'bdcf4e083f1860d8829898211e4b1c428a80dfd53dceca697c6f7e4a4901bfcc',
});
export const ECONOMIC_RESILIENCE_FIXTURE_PROVENANCE = Object.freeze({
  kind: 'project-generated-synthetic',
  containsPersonalData: false,
  license: 'MIT',
  generator: 'FFmpeg 8.1.2 and libjpeg-turbo jpegtran 3.1.4.1',
  recipe:
    'testsrc2 4000x3000 with three asymmetric color fields and a 127x113 grid; MJPEG q=2, yuvj444p, bitexact muxing; jpegtran -copy none -optimize removes COM, EXIF, XMP, and IPTC metadata',
});
export const ECONOMIC_RESILIENCE_OPERATION = Object.freeze({
  resize: { maxWidth: 1600, maxHeight: 1200, mode: 'contain' },
  output: { format: 'jpeg', quality: 90, maxBytes: 500_000 },
  metadata: 'strip',
});

const EXIF_APP1_IDENTIFIER = Buffer.from('Exif\0\0', 'latin1');
const STANDARD_XMP_APP1_IDENTIFIER = Buffer.from(
  'http://ns.adobe.com/xap/1.0/\0',
  'latin1'
);
const EXTENDED_XMP_APP1_IDENTIFIER = Buffer.from(
  'http://ns.adobe.com/xmp/extension/\0',
  'latin1'
);

const ENVIRONMENT_FIELDS = Object.freeze([
  'platform',
  'runtime',
  'osBuild',
  'device',
  'deviceKind',
  'abi',
  'reactNativeArchitecture',
  'reactNativeVersion',
  'jsEngine',
  'buildType',
  'runner',
  'toolchain',
]);
const RUNNER_FIELDS = Object.freeze([
  'label',
  'os',
  'arch',
  'name',
  'imageOS',
  'imageVersion',
]);
const TOOLCHAIN_FIELDS = Object.freeze([
  'node',
  'ffmpeg',
  'ffprobe',
  'primary',
  'platformSdk',
]);
const CAPABILITY_FIELDS = Object.freeze([
  'platform',
  'formats',
  'metadataPolicies',
  'supportsTargetSizeCompression',
  'supportsCancellation',
  'maxConcurrentOperations',
  'supportsDecodeDownsampling',
  'resourceLimits',
]);
const FORMAT_CAPABILITY_FIELDS = Object.freeze([
  'format',
  'input',
  'output',
  'supportsAlpha',
  'supportsAnimation',
  'notes',
]);
const RESOURCE_LIMIT_FIELDS = Object.freeze([
  'maxSourceDimension',
  'maxSourcePixels',
  'maxWorkingPixels',
]);
const IMAGE_FORMATS = Object.freeze([
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'avif',
  'gif',
]);
const FIXTURE_MANIFEST_FIELDS = Object.freeze([
  'schemaVersion',
  'id',
  'file',
  'provenance',
  'mediaType',
  'width',
  'height',
  'pixelCount',
  'orientation',
  'orientationEncoding',
  'byteSize',
  'maximumFixtureByteSize',
  'sha256',
]);
const FIXTURE_PROVENANCE_FIELDS = Object.freeze([
  'kind',
  'containsPersonalData',
  'license',
  'generator',
  'recipe',
]);
const NATIVE_PAYLOAD_FIELDS = Object.freeze([
  'schemaVersion',
  'scenarioId',
  'implementation',
  'platform',
  'architecture',
  'jsEngine',
  'fixture',
  'operation',
  'capabilities',
  'timing',
  'representative',
  'samples',
  'cleanup',
]);
const NATIVE_FIXTURE_FIELDS = Object.freeze([
  ...Object.keys(ECONOMIC_RESILIENCE_FIXTURE),
  'sourceUri',
  'inspection',
  'remainsAfterRun',
]);
const IMAGE_INSPECTION_FIELDS = Object.freeze([
  'exists',
  'byteSize',
  'sha256',
  'mediaType',
  'width',
  'height',
]);
const NATIVE_SAMPLE_FIELDS = Object.freeze([
  'phase',
  'iteration',
  'elapsedMs',
  'result',
  'sourceToOutputByteDifference',
  'outputInspection',
  'cleanup',
]);
const COMPRESSION_RESULT_FIELDS = Object.freeze([
  'format',
  'width',
  'height',
  'byteSize',
  'originalByteSize',
  'compressionRatio',
]);
const SAMPLE_CLEANUP_FIELDS = Object.freeze([
  'packageOutputRemoved',
  'existsAfterRemoval',
  'residualByteSize',
]);
const AGGREGATE_CLEANUP_FIELDS = Object.freeze([
  'attemptedPackageOutputs',
  'removedPackageOutputs',
  'residualPackageOutputs',
  'residualPackageOutputBytes',
]);
const EVIDENCE_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'scenarioId',
  'implementation',
  'sourceCommit',
  'runId',
  'runAttempt',
  'capturedAt',
  'runUrl',
  'environment',
  'capabilities',
  'fixture',
  'operation',
  'timing',
  'samples',
  'measuredSummary',
  'representative',
  'economics',
  'cleanup',
  'visualAgreement',
]);

export function parseNativeEconomicResiliencePayload(contents) {
  return parseChunkedNativePayload(contents, {
    passMarker: ECONOMIC_RESILIENCE_PASS_MARKER,
    chunkMarker: ECONOMIC_RESILIENCE_CHUNK_MARKER,
  });
}

export function inspectJpegStructure(bytes) {
  const buffer = Buffer.from(bytes ?? []);
  const errors = [];
  let width = null;
  let height = null;
  let precision = null;
  let components = null;
  let hasExif = false;
  let hasXmp = false;
  let hasIptc = false;
  let commentCount = 0;
  let app1Count = 0;
  let app13Count = 0;
  let hasStartOfScan = false;
  let hasEndOfImage = false;
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return { status: 'failed', error: 'JPEG SOI marker is missing' };
  }
  let offset = 2;
  while (offset < buffer.length) {
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0x00) {
      errors.push('JPEG stuffed byte appears outside scan data');
      break;
    }
    if (marker === 0xd9) {
      hasEndOfImage = true;
      if (offset !== buffer.length) errors.push('JPEG contains bytes after EOI');
      break;
    }
    if (marker === 0xda) {
      hasStartOfScan = true;
      if (offset + 2 > buffer.length) {
        errors.push('JPEG SOS length is truncated');
        break;
      } else {
        const scanHeaderLength = buffer.readUInt16BE(offset);
        const scanComponentCount = buffer[offset + 2];
        if (
          !positiveInteger(scanComponentCount) ||
          scanHeaderLength !== 6 + 2 * scanComponentCount ||
          offset + scanHeaderLength > buffer.length
        ) {
          errors.push('JPEG SOS header length or component count is invalid');
          break;
        }
        offset += scanHeaderLength;
      }
      // Entropy-coded scan bytes use FF00 for a literal FF byte and may carry
      // restart markers. Resume normal marker parsing at the next other marker
      // so metadata between scans or before EOI cannot evade inspection.
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        let markerOffset = offset;
        while (markerOffset < buffer.length && buffer[markerOffset] === 0xff) {
          markerOffset += 1;
        }
        if (markerOffset >= buffer.length) {
          offset = markerOffset;
          break;
        }
        const scanMarker = buffer[markerOffset];
        if (scanMarker === 0x00 || (scanMarker >= 0xd0 && scanMarker <= 0xd7)) {
          offset = markerOffset + 1;
          continue;
        }
        offset = markerOffset;
        break;
      }
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) {
      errors.push('JPEG segment length is truncated');
      break;
    }
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      errors.push('JPEG segment extends outside the file');
      break;
    }
    const payloadStart = offset + 2;
    const payloadEnd = offset + segmentLength;
    const payload = buffer.subarray(payloadStart, payloadEnd);
    if (marker === 0xe1) {
      app1Count += 1;
      hasExif ||= payload.subarray(0, EXIF_APP1_IDENTIFIER.length)
        .equals(EXIF_APP1_IDENTIFIER);
      hasXmp ||= payload.subarray(0, STANDARD_XMP_APP1_IDENTIFIER.length)
        .equals(STANDARD_XMP_APP1_IDENTIFIER);
      hasXmp ||= payload.subarray(0, EXTENDED_XMP_APP1_IDENTIFIER.length)
        .equals(EXTENDED_XMP_APP1_IDENTIFIER);
    }
    if (marker === 0xed) {
      app13Count += 1;
      hasIptc ||= payload.toString('latin1').includes('Photoshop 3.0');
    }
    if (marker === 0xfe) commentCount += 1;
    if ([0xc0, 0xc1, 0xc2].includes(marker) && payload.length >= 6) {
      precision = payload[0];
      height = payload.readUInt16BE(1);
      width = payload.readUInt16BE(3);
      components = payload[5];
    }
    offset += segmentLength;
  }
  if (!positiveInteger(width) || !positiveInteger(height)) {
    errors.push('JPEG frame geometry is missing');
  }
  if (precision !== 8) errors.push('JPEG precision must be 8 bit');
  if (![1, 3].includes(components)) errors.push('JPEG component count is unsupported');
  if (!hasStartOfScan) errors.push('JPEG SOS marker is missing');
  if (!hasEndOfImage) errors.push('JPEG EOI marker is missing');
  return {
    status: errors.length === 0 ? 'passed' : 'failed',
    mediaType: 'image/jpeg',
    width,
    height,
    precision,
    components,
    hasExif,
    hasXmp,
    hasIptc,
    commentCount,
    app1Count,
    app13Count,
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}

export function inspectFixtureManifest(manifest, sourceBytes) {
  const errors = [];
  if (!sameFields(manifest, FIXTURE_MANIFEST_FIELDS)) {
    errors.push('fixture manifest fields drifted');
  }
  if (!sameFields(manifest?.provenance, FIXTURE_PROVENANCE_FIELDS)) {
    errors.push('fixture provenance fields drifted');
  }
  if (manifest?.schemaVersion !== 1) errors.push('fixture schemaVersion must be 1');
  for (const [field, expected] of Object.entries(ECONOMIC_RESILIENCE_FIXTURE)) {
    if (manifest?.[field] !== expected) errors.push(`fixture ${field} drifted`);
  }
  if (!deepEqual(manifest?.provenance, ECONOMIC_RESILIENCE_FIXTURE_PROVENANCE)) {
    errors.push('fixture provenance drifted from the immutable generation record');
  }
  if (sourceBytes.length !== ECONOMIC_RESILIENCE_FIXTURE.byteSize) {
    errors.push('fixture byte size mismatch');
  }
  if (sha256(sourceBytes) !== ECONOMIC_RESILIENCE_FIXTURE.sha256) {
    errors.push('fixture SHA-256 mismatch');
  }
  const jpeg = inspectJpegStructure(sourceBytes);
  if (jpeg.status !== 'passed') errors.push(jpeg.error);
  if (
    jpeg.width !== ECONOMIC_RESILIENCE_FIXTURE.width ||
    jpeg.height !== ECONOMIC_RESILIENCE_FIXTURE.height
  ) {
    errors.push('fixture JPEG geometry mismatch');
  }
  if (jpeg.app1Count !== 0 || jpeg.app13Count !== 0 || jpeg.commentCount !== 0) {
    errors.push('fixture must not contain APP1, APP13, or JPEG comment metadata');
  }
  return {
    status: errors.length === 0 ? 'passed' : 'failed',
    fixtureId: manifest?.id ?? null,
    byteSize: sourceBytes.length,
    sha256: sha256(sourceBytes),
    geometry: jpeg.width && jpeg.height ? `${jpeg.width}x${jpeg.height}` : null,
    metadataFree: jpeg.app1Count === 0 && jpeg.app13Count === 0 && jpeg.commentCount === 0,
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}

export function inspectNativeEconomicResiliencePayload(payload) {
  const errors = [];
  if (!sameFields(payload, NATIVE_PAYLOAD_FIELDS)) {
    errors.push('native payload fields drifted');
  }
  if (!sameFields(payload?.implementation, ['name'])) {
    errors.push('native implementation fields drifted');
  }
  if (!sameFields(payload?.fixture, NATIVE_FIXTURE_FIELDS)) {
    errors.push('native fixture fields drifted');
  }
  if (!sameFields(payload?.timing, ['clock', 'boundary', 'warmupIterations', 'measuredIterations'])) {
    errors.push('native timing fields drifted');
  }
  if (!sameFields(payload?.representative, ['measuredIteration', 'stagedOutputUri', 'inspection'])) {
    errors.push('native representative fields drifted');
  }
  if (!sameFields(payload?.cleanup, AGGREGATE_CLEANUP_FIELDS)) {
    errors.push('native aggregate cleanup fields drifted');
  }
  if (payload?.schemaVersion !== ECONOMIC_RESILIENCE_SCHEMA_VERSION) {
    errors.push('native schemaVersion must be 1');
  }
  if (payload?.scenarioId !== ECONOMIC_RESILIENCE_SCENARIO_ID) {
    errors.push('native scenarioId drifted');
  }
  if (payload?.implementation?.name !== 'react-native-image-compression-kit') {
    errors.push('native implementation name is invalid');
  }
  if (!['android', 'ios'].includes(payload?.platform)) {
    errors.push('native platform must be android or ios');
  }
  if (!['legacy', 'new'].includes(payload?.architecture)) {
    errors.push('native architecture must be legacy or new');
  }
  if (!['hermes', 'jsc'].includes(payload?.jsEngine)) {
    errors.push('native jsEngine must be hermes or jsc');
  }
  for (const [field, expected] of Object.entries(ECONOMIC_RESILIENCE_FIXTURE)) {
    if (payload?.fixture?.[field] !== expected) {
      errors.push(`native fixture ${field} drifted`);
    }
  }
  if (!nonEmpty(payload?.fixture?.sourceUri)) errors.push('native sourceUri is required');
  if (payload?.fixture?.remainsAfterRun !== true) {
    errors.push('native source must remain after the run');
  }
  errors.push(
    ...inspectImageInspection(payload?.fixture?.inspection, {
      byteSize: ECONOMIC_RESILIENCE_FIXTURE.byteSize,
      sha256: ECONOMIC_RESILIENCE_FIXTURE.sha256,
      width: 4000,
      height: 3000,
    }).map((error) => `native source ${error}`)
  );
  if (!deepEqual(payload?.operation, ECONOMIC_RESILIENCE_OPERATION)) {
    errors.push('native operation drifted');
  }
  if (
    !['performance.now', 'Date.now'].includes(payload?.timing?.clock) ||
    payload?.timing?.boundary !== 'compressImage-call-only' ||
    payload?.timing?.warmupIterations !== 2 ||
    payload?.timing?.measuredIterations !== 10
  ) {
    errors.push('native timing contract drifted');
  }
  errors.push(...inspectCapabilities(payload?.capabilities, payload?.platform));

  const samples = Array.isArray(payload?.samples) ? payload.samples : [];
  if (samples.length !== 12) errors.push('native samples must contain 2 warmups and 10 measured calls');
  samples.forEach((sample, index) => {
    if (!sameFields(sample, NATIVE_SAMPLE_FIELDS)) {
      errors.push(`native sample ${index + 1} fields drifted`);
    }
    if (!sameFields(sample?.result, COMPRESSION_RESULT_FIELDS)) {
      errors.push(`native sample ${index + 1} result fields drifted`);
    }
    if (!sameFields(sample?.cleanup, SAMPLE_CLEANUP_FIELDS)) {
      errors.push(`native sample ${index + 1} cleanup fields drifted`);
    }
    const expectedPhase = index < 2 ? 'warmup' : 'measured';
    const expectedIteration = index < 2 ? index + 1 : index - 1;
    if (sample?.phase !== expectedPhase || sample?.iteration !== expectedIteration) {
      errors.push(`native sample ${index + 1} phase or iteration is invalid`);
    }
    if (!finitePositive(sample?.elapsedMs)) {
      errors.push(`native sample ${index + 1} elapsedMs must be positive`);
    }
    errors.push(...inspectSampleResult(sample, index + 1));
    if (
      sample?.cleanup?.packageOutputRemoved !== true ||
      sample?.cleanup?.existsAfterRemoval !== false ||
      sample?.cleanup?.residualByteSize !== 0
    ) {
      errors.push(`native sample ${index + 1} cleanup did not reach zero residual`);
    }
  });
  const representativeSample = samples.find(
    ({ phase, iteration }) => phase === 'measured' && iteration === 10
  );
  if (
    payload?.representative?.measuredIteration !== 10 ||
    !nonEmpty(payload?.representative?.stagedOutputUri)
  ) {
    errors.push('native representative must stage measured iteration 10');
  }
  if (
    representativeSample &&
    !deepEqual(payload?.representative?.inspection, representativeSample.outputInspection)
  ) {
    errors.push('native representative inspection does not match measured iteration 10');
  }
  if (
    payload?.cleanup?.attemptedPackageOutputs !== 12 ||
    payload?.cleanup?.removedPackageOutputs !== 12 ||
    payload?.cleanup?.residualPackageOutputs !== 0 ||
    payload?.cleanup?.residualPackageOutputBytes !== 0
  ) {
    errors.push('native aggregate cleanup must remove all 12 package outputs');
  }
  return errors;
}

export function buildEconomicResilienceEvidence({
  payload,
  packageVersion,
  sourceCommit,
  runId,
  runAttempt,
  capturedAt,
  runUrl,
  environment,
  fixtureManifest,
  sourceBytes,
  outputBytes,
  visualAgreement,
}) {
  const errors = inspectNativeEconomicResiliencePayload(payload);
  if (!exactSemver(packageVersion)) errors.push('packageVersion must be exact semver');
  if (!/^[0-9a-f]{40}$/.test(sourceCommit ?? '')) {
    errors.push('sourceCommit must be a full lowercase SHA');
  }
  if (!positiveInteger(runId)) errors.push('runId must be a positive integer');
  if (!positiveInteger(runAttempt)) errors.push('runAttempt must be a positive integer');
  if (!canonicalIsoTimestamp(capturedAt)) {
    errors.push('capturedAt must be an ISO timestamp');
  }
  if (!validRunUrl(runUrl)) errors.push('runUrl must identify the capture workflow run');
  if (validRunUrl(runUrl) && Number(runUrl.split('/').at(-1)) !== runId) {
    errors.push('runUrl must end with runId');
  }
  errors.push(...inspectEnvironment(environment, payload));
  const fixtureReport = inspectFixtureManifest(fixtureManifest, sourceBytes);
  if (fixtureReport.status !== 'passed') errors.push(fixtureReport.error);
  const outputJpeg = inspectJpegStructure(outputBytes);
  if (outputJpeg.status !== 'passed') errors.push(outputJpeg.error);
  const representative = payload?.representative?.inspection;
  if (
    outputBytes.length !== representative?.byteSize ||
    sha256(outputBytes) !== representative?.sha256 ||
    outputJpeg.width !== representative?.width ||
    outputJpeg.height !== representative?.height
  ) {
    errors.push('staged output file does not match native representative inspection');
  }
  if (outputJpeg.app1Count !== 0 || outputJpeg.app13Count !== 0 || outputJpeg.commentCount !== 0) {
    errors.push('strip output contains APP1, APP13, or JPEG comment metadata');
  }
  const visualReport = inspectDemoVisualAgreement(visualAgreement, {
    sourceBytes,
    outputBytes,
    resizeOptions: ECONOMIC_RESILIENCE_OPERATION.resize,
  });
  if (visualReport.status !== 'passed' || visualReport.agreementStatus !== 'passed') {
    errors.push(`visual agreement failed: ${visualReport.error ?? visualAgreement?.status}`);
  }
  if (errors.length > 0) throw new Error(errors.join(' | '));

  const measuredSamples = payload.samples.filter(({ phase }) => phase === 'measured');
  const representativeSample = measuredSamples.find(({ iteration }) => iteration === 10);
  return {
    schemaVersion: ECONOMIC_RESILIENCE_SCHEMA_VERSION,
    status: 'passed',
    scenarioId: ECONOMIC_RESILIENCE_SCENARIO_ID,
    implementation: {
      name: 'react-native-image-compression-kit',
      version: packageVersion,
      buildSource: 'checked-out-source-tree',
    },
    sourceCommit,
    runId,
    runAttempt,
    capturedAt,
    runUrl,
    environment: {
      ...environment,
      reactNativeArchitecture: payload.architecture,
    },
    capabilities: payload.capabilities,
    fixture: {
      id: fixtureManifest.id,
      file: 'source.jpg',
      manifestFile: 'fixture-manifest.json',
      byteSize: sourceBytes.length,
      sha256: sha256(sourceBytes),
      width: ECONOMIC_RESILIENCE_FIXTURE.width,
      height: ECONOMIC_RESILIENCE_FIXTURE.height,
      remainsAfterRun: true,
    },
    operation: ECONOMIC_RESILIENCE_OPERATION,
    timing: payload.timing,
    samples: payload.samples,
    measuredSummary: summarizeBenchmarkSamples(
      measuredSamples.map(({ iteration, elapsedMs, result }) => ({
        iteration,
        elapsedMs,
        result,
      }))
    ),
    representative: {
      measuredIteration: 10,
      file: 'output.jpg',
      byteSize: outputBytes.length,
      sha256: sha256(outputBytes),
      width: outputJpeg.width,
      height: outputJpeg.height,
    },
    economics: {
      boundary: 'source-to-output-observation',
      sourceOwnership: 'source-remains',
      stagedEvidenceOwnership: 'example-owned-copy',
      matchedTransferBaseline: null,
      sourceBytes: sourceBytes.length,
      outputBytes: outputBytes.length,
      sourceToOutputByteDifference:
        representativeSample.result.originalByteSize - representativeSample.result.byteSize,
      costSavingsClaim: null,
    },
    cleanup: payload.cleanup,
    visualAgreement,
  };
}

export function inspectEconomicResilienceEvidence(root, evidence) {
  const errors = [];
  const artifactRoot = path.resolve(root);
  let files = [];
  try {
    files = readArtifactDirectory(artifactRoot).sort();
  } catch (error) {
    errors.push(error.message);
  }
  if (!deepEqual(files, ECONOMIC_RESILIENCE_ASSET_FILES)) {
    errors.push('artifact must contain the exact economic resilience asset set');
  }
  if (!sameFields(evidence, EVIDENCE_FIELDS)) errors.push('evidence fields drifted');
  if (!sameFields(evidence?.implementation, ['name', 'version', 'buildSource'])) {
    errors.push('evidence implementation fields drifted');
  }
  if (!sameFields(evidence?.fixture, [
    'id',
    'file',
    'manifestFile',
    'byteSize',
    'sha256',
    'width',
    'height',
    'remainsAfterRun',
  ])) {
    errors.push('evidence fixture fields drifted');
  }
  if (!sameFields(evidence?.representative, [
    'measuredIteration',
    'file',
    'byteSize',
    'sha256',
    'width',
    'height',
  ])) {
    errors.push('evidence representative fields drifted');
  }
  if (!sameFields(evidence?.economics, [
    'boundary',
    'sourceOwnership',
    'stagedEvidenceOwnership',
    'matchedTransferBaseline',
    'sourceBytes',
    'outputBytes',
    'sourceToOutputByteDifference',
    'costSavingsClaim',
  ])) {
    errors.push('evidence economics fields drifted');
  }
  if (evidence?.schemaVersion !== 1 || evidence?.status !== 'passed') {
    errors.push('evidence schemaVersion/status is invalid');
  }
  if (evidence?.scenarioId !== ECONOMIC_RESILIENCE_SCENARIO_ID) {
    errors.push('evidence scenarioId drifted');
  }
  if (evidence?.implementation?.name !== 'react-native-image-compression-kit') {
    errors.push('evidence implementation name is invalid');
  }
  if (!exactSemver(evidence?.implementation?.version)) {
    errors.push('evidence implementation version must be exact semver');
  }
  if (evidence?.implementation?.buildSource !== 'checked-out-source-tree') {
    errors.push('evidence implementation must identify the checked-out source tree');
  }
  if (!/^[0-9a-f]{40}$/.test(evidence?.sourceCommit ?? '')) {
    errors.push('evidence sourceCommit must be a full lowercase SHA');
  }
  if (!positiveInteger(evidence?.runId)) errors.push('evidence runId is invalid');
  if (!positiveInteger(evidence?.runAttempt)) errors.push('evidence runAttempt is invalid');
  if (!canonicalIsoTimestamp(evidence?.capturedAt)) {
    errors.push('evidence capturedAt must be an ISO timestamp');
  }
  if (!validRunUrl(evidence?.runUrl)) errors.push('evidence runUrl is invalid');
  if (
    validRunUrl(evidence?.runUrl) &&
    Number(evidence.runUrl.split('/').at(-1)) !== evidence?.runId
  ) {
    errors.push('evidence runUrl does not match runId');
  }
  errors.push(...inspectEnvironment(evidence?.environment, {
    platform: evidence?.environment?.platform,
    architecture: evidence?.environment?.reactNativeArchitecture,
    jsEngine: evidence?.environment?.jsEngine,
  }));
  errors.push(...inspectCapabilities(evidence?.capabilities, evidence?.environment?.platform));
  if (!deepEqual(evidence?.operation, ECONOMIC_RESILIENCE_OPERATION)) {
    errors.push('evidence operation drifted');
  }
  if (
    evidence?.cleanup?.attemptedPackageOutputs !== 12 ||
    evidence?.cleanup?.removedPackageOutputs !== 12 ||
    evidence?.cleanup?.residualPackageOutputs !== 0 ||
    evidence?.cleanup?.residualPackageOutputBytes !== 0
  ) {
    errors.push('evidence cleanup must report zero residual across 12 outputs');
  }
  if (
    evidence?.economics?.boundary !== 'source-to-output-observation' ||
    evidence?.economics?.sourceOwnership !== 'source-remains' ||
    evidence?.economics?.stagedEvidenceOwnership !== 'example-owned-copy' ||
    evidence?.economics?.matchedTransferBaseline !== null ||
    evidence?.economics?.costSavingsClaim !== null
  ) {
    errors.push('evidence economics boundary is invalid');
  }
  if (
    evidence?.fixture?.id !== ECONOMIC_RESILIENCE_FIXTURE.id ||
    evidence?.fixture?.file !== 'source.jpg' ||
    evidence?.fixture?.manifestFile !== 'fixture-manifest.json' ||
    evidence?.fixture?.byteSize !== ECONOMIC_RESILIENCE_FIXTURE.byteSize ||
    evidence?.fixture?.sha256 !== ECONOMIC_RESILIENCE_FIXTURE.sha256 ||
    evidence?.fixture?.width !== 4000 ||
    evidence?.fixture?.height !== 3000 ||
    evidence?.fixture?.remainsAfterRun !== true
  ) {
    errors.push('evidence fixture identity drifted');
  }
  if (
    evidence?.representative?.measuredIteration !== 10 ||
    evidence?.representative?.file !== 'output.jpg' ||
    evidence?.representative?.width !== 1600 ||
    evidence?.representative?.height !== 1200
  ) {
    errors.push('evidence representative identity drifted');
  }

  const source = readSecureAsset(artifactRoot, 'source.jpg', errors);
  const output = readSecureAsset(artifactRoot, 'output.jpg', errors);
  const fixtureManifest = readJsonAsset(artifactRoot, 'fixture-manifest.json', errors);
  const environment = readJsonAsset(artifactRoot, 'environment.json', errors);
  const visualAgreement = readJsonAsset(artifactRoot, 'visual-agreement.json', errors);
  if (source && fixtureManifest) {
    const fixtureReport = inspectFixtureManifest(fixtureManifest, source);
    if (fixtureReport.status !== 'passed') errors.push(fixtureReport.error);
  }
  if (output) {
    const jpeg = inspectJpegStructure(output);
    if (jpeg.status !== 'passed') errors.push(jpeg.error);
    if (
      output.length !== evidence?.representative?.byteSize ||
      sha256(output) !== evidence?.representative?.sha256 ||
      jpeg.width !== evidence?.representative?.width ||
      jpeg.height !== evidence?.representative?.height
    ) {
      errors.push('representative output asset does not match evidence');
    }
    if (jpeg.app1Count !== 0 || jpeg.app13Count !== 0 || jpeg.commentCount !== 0) {
      errors.push('representative output contains stripped metadata');
    }
  }
  if (source && output && visualAgreement) {
    const report = inspectDemoVisualAgreement(visualAgreement, {
      sourceBytes: source,
      outputBytes: output,
      resizeOptions: ECONOMIC_RESILIENCE_OPERATION.resize,
    });
    if (report.status !== 'passed' || report.agreementStatus !== 'passed') {
      errors.push(`visual agreement asset is invalid: ${report.error}`);
    }
    if (!deepEqual(evidence?.visualAgreement, visualAgreement)) {
      errors.push('embedded visual agreement does not match its asset');
    }
  }
  if (environment && !deepEqual(environment, evidence?.environment)) {
    errors.push('environment asset does not match evidence environment');
  }
  if (
    source && output &&
    (evidence?.economics?.sourceBytes !== source.length ||
      evidence?.economics?.outputBytes !== output.length ||
      evidence?.economics?.sourceToOutputByteDifference !== source.length - output.length)
  ) {
    errors.push('signed source-to-output byte difference is inconsistent');
  }
  if (Array.isArray(evidence?.samples)) {
    const nativeLike = {
      schemaVersion: evidence?.schemaVersion,
      scenarioId: evidence?.scenarioId,
      implementation: { name: evidence?.implementation?.name },
      platform: evidence?.environment?.platform,
      architecture: evidence?.environment?.reactNativeArchitecture,
      jsEngine: evidence?.environment?.jsEngine,
      fixture: {
        ...ECONOMIC_RESILIENCE_FIXTURE,
        sourceUri: 'file:///retained-source.jpg',
        inspection: {
          exists: true,
          byteSize: evidence?.fixture?.byteSize,
          sha256: evidence?.fixture?.sha256,
          mediaType: 'image/jpeg',
          width: evidence?.fixture?.width,
          height: evidence?.fixture?.height,
        },
        remainsAfterRun: evidence?.fixture?.remainsAfterRun,
      },
      representative: {
        measuredIteration: evidence?.representative?.measuredIteration,
        stagedOutputUri: 'file:///staged-output.jpg',
        inspection: {
          exists: true,
          byteSize: evidence?.representative?.byteSize,
          sha256: evidence?.representative?.sha256,
          mediaType: 'image/jpeg',
          width: evidence?.representative?.width,
          height: evidence?.representative?.height,
        },
      },
      operation: evidence?.operation,
      capabilities: evidence?.capabilities,
      timing: evidence?.timing,
      samples: evidence?.samples,
      cleanup: evidence?.cleanup,
    };
    errors.push(...inspectNativeEconomicResiliencePayload(nativeLike));
    const measuredSamples = evidence.samples.filter(({ phase }) => phase === 'measured');
    if (measuredSamples.length === 10) {
      const expectedSummary = summarizeBenchmarkSamples(
        measuredSamples.map(({ iteration, elapsedMs, result }) => ({
          iteration,
          elapsedMs,
          result,
        }))
      );
      if (!deepEqual(evidence?.measuredSummary, expectedSummary)) {
        errors.push('measured summary does not match the raw samples');
      }
    }
  } else {
    errors.push('evidence samples are required');
  }
  return {
    schemaVersion: 1,
    status: errors.length === 0 ? 'passed' : 'failed',
    scenarioId: evidence?.scenarioId ?? null,
    platform: evidence?.environment?.platform ?? null,
    sourceCommit: evidence?.sourceCommit ?? null,
    representative: errors.length === 0 ? evidence.representative : null,
    economics: errors.length === 0 ? evidence.economics : null,
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}

function inspectSampleResult(sample, sampleIndex) {
  const errors = [];
  const result = sample?.result;
  if (
    result?.format !== 'jpeg' ||
    result?.width !== 1600 ||
    result?.height !== 1200 ||
    !positiveInteger(result?.byteSize) ||
    result.byteSize > 500_000 ||
    result?.originalByteSize !== ECONOMIC_RESILIENCE_FIXTURE.byteSize ||
    !finitePositive(result?.compressionRatio) ||
    Math.abs(result.compressionRatio - result.byteSize / result.originalByteSize) > 1e-6
  ) {
    errors.push(`native sample ${sampleIndex} result is invalid`);
  }
  if (sample?.sourceToOutputByteDifference !== result?.originalByteSize - result?.byteSize) {
    errors.push(`native sample ${sampleIndex} signed byte difference is inconsistent`);
  }
  errors.push(
    ...inspectImageInspection(sample?.outputInspection, {
      byteSize: result?.byteSize,
      width: result?.width,
      height: result?.height,
    }).map((error) => `native sample ${sampleIndex} output ${error}`)
  );
  return errors;
}

function inspectImageInspection(inspection, expected = {}) {
  const errors = [];
  if (!sameFields(inspection, IMAGE_INSPECTION_FIELDS)) {
    errors.push('fields drifted');
  }
  if (inspection?.exists !== true) errors.push('must exist');
  if (!positiveInteger(inspection?.byteSize)) errors.push('byteSize is invalid');
  if (!/^[0-9a-f]{64}$/.test(inspection?.sha256 ?? '')) errors.push('SHA-256 is invalid');
  if (inspection?.mediaType !== 'image/jpeg') errors.push('mediaType must be image/jpeg');
  if (!positiveInteger(inspection?.width) || !positiveInteger(inspection?.height)) {
    errors.push('geometry is invalid');
  }
  for (const field of ['byteSize', 'sha256', 'width', 'height']) {
    if (expected[field] !== undefined && inspection?.[field] !== expected[field]) {
      errors.push(`${field} does not match`);
    }
  }
  return errors;
}

function inspectCapabilities(capabilities, platform) {
  const errors = [];
  if (!sameFields(capabilities, CAPABILITY_FIELDS)) {
    errors.push('capability fields drifted');
  }
  if (containsUnknown(capabilities)) errors.push('capabilities contain unknown values');
  if (!Array.isArray(capabilities?.formats) || capabilities.formats.length !== 7) {
    errors.push('capabilities must contain exactly seven formats');
  } else {
    if (!deepEqual(capabilities.formats.map(({ format }) => format), IMAGE_FORMATS)) {
      errors.push('capability formats must use the canonical order without duplicates');
    }
    capabilities.formats.forEach((format, index) => {
      if (!sameFields(format, FORMAT_CAPABILITY_FIELDS)) {
        errors.push(`capability format ${index + 1} fields drifted`);
      }
      if (
        format?.format !== IMAGE_FORMATS[index] ||
        typeof format?.input !== 'boolean' ||
        typeof format?.output !== 'boolean' ||
        typeof format?.supportsAlpha !== 'boolean' ||
        typeof format?.supportsAnimation !== 'boolean' ||
        !Array.isArray(format?.notes) ||
        format.notes.length === 0 ||
        format.notes.some((note) => !nonEmpty(note))
      ) {
        errors.push(`capability format ${index + 1} shape is invalid`);
      }
    });
  }
  if (!deepEqual(capabilities?.metadataPolicies, ['preserve', 'safe', 'strip'])) {
    errors.push('capability metadata policies drifted');
  }
  if (!sameFields(capabilities?.resourceLimits, RESOURCE_LIMIT_FIELDS)) {
    errors.push('capability resource limit fields drifted');
  }
  const jpeg = capabilities?.formats?.find?.(({ format }) => format === 'jpeg');
  if (
    capabilities?.platform !== platform ||
    jpeg?.input !== true ||
    jpeg?.output !== true ||
    capabilities?.supportsTargetSizeCompression !== true ||
    capabilities?.supportsCancellation !== true ||
    capabilities?.supportsDecodeDownsampling !== true ||
    !capabilities?.metadataPolicies?.includes?.('strip') ||
    !positiveInteger(capabilities?.maxConcurrentOperations) ||
    !positiveInteger(capabilities?.resourceLimits?.maxSourceDimension) ||
    capabilities.resourceLimits.maxSourceDimension < 4000 ||
    !positiveInteger(capabilities?.resourceLimits?.maxSourcePixels) ||
    capabilities.resourceLimits.maxSourcePixels < 12_000_000 ||
    !positiveInteger(capabilities?.resourceLimits?.maxWorkingPixels) ||
    capabilities.resourceLimits.maxWorkingPixels < 1_920_000
  ) {
    errors.push('capabilities do not satisfy the scenario');
  }
  return errors;
}

function inspectEnvironment(environment, payload) {
  const errors = [];
  if (!sameFields(environment, ENVIRONMENT_FIELDS)) errors.push('environment fields drifted');
  if (!sameFields(environment?.runner, RUNNER_FIELDS)) errors.push('runner fields drifted');
  if (!sameFields(environment?.toolchain, TOOLCHAIN_FIELDS)) errors.push('toolchain fields drifted');
  if (containsUnknown(environment)) errors.push('environment contains empty or unknown values');
  for (const field of [
    'platform',
    'runtime',
    'osBuild',
    'device',
    'deviceKind',
    'abi',
    'reactNativeArchitecture',
    'reactNativeVersion',
    'jsEngine',
    'buildType',
  ]) {
    if (!nonEmpty(environment?.[field])) errors.push(`environment ${field} must be text`);
  }
  for (const field of RUNNER_FIELDS) {
    if (!nonEmpty(environment?.runner?.[field])) {
      errors.push(`environment runner ${field} must be text`);
    }
  }
  for (const field of TOOLCHAIN_FIELDS) {
    if (!nonEmpty(environment?.toolchain?.[field])) {
      errors.push(`environment toolchain ${field} must be text`);
    }
  }
  if (environment?.platform !== payload?.platform) errors.push('environment platform mismatch');
  if (environment?.reactNativeArchitecture !== payload?.architecture) {
    errors.push('environment architecture mismatch');
  }
  if (environment?.jsEngine !== payload?.jsEngine) {
    errors.push('environment JS engine mismatch');
  }
  if (!['emulator', 'simulator'].includes(environment?.deviceKind)) {
    errors.push('environment deviceKind must be emulator or simulator');
  }
  if (
    (environment?.platform === 'android' &&
      (environment.deviceKind !== 'emulator' ||
        environment?.runner?.label !== 'ubuntu-latest')) ||
    (environment?.platform === 'ios' &&
      (environment.deviceKind !== 'simulator' ||
        environment?.runner?.label !== 'macos-latest'))
  ) {
    errors.push('environment platform, device kind, and runner label disagree');
  }
  if (!exactSemver(environment?.reactNativeVersion)) {
    errors.push('environment React Native version must be exact semver');
  }
  if (!['hermes', 'jsc'].includes(environment?.jsEngine)) {
    errors.push('environment jsEngine must be hermes or jsc');
  }
  if (environment?.buildType !== 'debug') errors.push('environment buildType must be debug');
  return errors;
}

function containsUnknown(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    return value.trim() === '' || /^(?:unknown|null|undefined|n\/a)$/i.test(value.trim());
  }
  if (Array.isArray(value)) return value.length === 0 || value.some(containsUnknown);
  if (typeof value === 'object') {
    const values = Object.values(value);
    return values.length === 0 || values.some(containsUnknown);
  }
  return false;
}

function sameFields(value, expected) {
  return value && deepEqual(Object.keys(value).sort(), [...expected].sort());
}

function readSecureAsset(root, relative, errors) {
  const candidate = path.resolve(root, relative);
  if (!candidate.startsWith(`${root}${path.sep}`) || !existsSync(candidate)) {
    errors.push(`asset is missing: ${relative}`);
    return null;
  }
  const status = lstatSync(candidate);
  if (!status.isFile() || status.isSymbolicLink()) {
    errors.push(`asset must be a regular non-symlink file: ${relative}`);
    return null;
  }
  return readFileSync(candidate);
}

function readJsonAsset(root, relative, errors) {
  const bytes = readSecureAsset(root, relative, errors);
  if (!bytes) return null;
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    errors.push(`asset JSON is invalid: ${relative}: ${error.message}`);
    return null;
  }
}

function readArtifactDirectory(root) {
  const status = lstatSync(root);
  if (!status.isDirectory() || status.isSymbolicLink()) {
    throw new Error('artifact root must be a regular directory');
  }
  // Kept synchronous so the verifier has one deterministic filesystem snapshot.
  const entries = [];
  for (const entry of readdirSync(root)) {
    const fullPath = path.join(root, entry);
    const status = lstatSync(fullPath);
    if (!status.isFile() || status.isSymbolicLink()) {
      throw new Error(`artifact contains a non-regular entry: ${entry}`);
    }
    entries.push(entry);
  }
  return entries;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function finitePositive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactSemver(value) {
  return /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(
    value ?? ''
  );
}

function canonicalIsoTimestamp(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function validRunUrl(value) {
  return /^https:\/\/github\.com\/GGULBAE\/react-native-image-compression-kit\/actions\/runs\/\d+$/.test(
    value ?? ''
  );
}
