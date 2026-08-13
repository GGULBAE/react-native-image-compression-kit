import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ECONOMIC_RESILIENCE_FIXTURE,
  ECONOMIC_RESILIENCE_OPERATION,
  buildEconomicResilienceEvidence,
  inspectEconomicResilienceEvidence,
  inspectFixtureManifest,
  inspectJpegStructure,
  inspectNativeEconomicResiliencePayload,
} from '../scripts/economic-resilience-evidence-core.mjs';
import { createDemoVisualAgreementReport } from '../scripts/demo-visual-agreement-core.mjs';
import { createChunkedNativeLogMessages } from '../example/src/nativeBenchmarkLog.ts';

const SOURCE = readFileSync('example/fixtures/kit-only-12mp-v1.jpg');
const FIXTURE_MANIFEST = JSON.parse(
  readFileSync('example/fixtures/kit-only-12mp-v1.json', 'utf8')
);
const OUTPUT = minimalJpeg(1600, 1200);
const OUTPUT_SHA = sha256(OUTPUT);
const VERIFIER = path.resolve('scripts/verify-economic-resilience-evidence.mjs');
const roots = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

describe('kit-only 12 MP economic resilience evidence', () => {
  it('binds the repository fixture, raw samples, signed bytes, SSIM, environment, and cleanup', () => {
    const artifact = createArtifact();
    const report = inspectEconomicResilienceEvidence(artifact.root, artifact.evidence);
    expect(report.error).toBe(null);

    expect(inspectFixtureManifest(FIXTURE_MANIFEST, SOURCE)).toMatchObject({
      status: 'passed',
      byteSize: 1_721_333,
      sha256: ECONOMIC_RESILIENCE_FIXTURE.sha256,
      geometry: '4000x3000',
      metadataFree: true,
    });
    expect(report).toMatchObject({
      status: 'passed',
      platform: 'android',
      economics: {
        boundary: 'source-to-output-observation',
        sourceOwnership: 'source-remains',
        matchedTransferBaseline: null,
        sourceToOutputByteDifference: SOURCE.length - OUTPUT.length,
        costSavingsClaim: null,
      },
    });
  });

  it('fails closed across malformed JPEG markers, scans, segments, and metadata', () => {
    const malformed = [
      Buffer.alloc(0),
      Buffer.from([0xff, 0xd8, 0xff, 0xff]),
      Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]),
      Buffer.from([0xff, 0xd8, 0xff, 0xda]),
      Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]),
      Buffer.from([
        0xff, 0xd8, 0xff, 0xda, 0x00, 0x08,
        0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
        0x11, 0xff, 0xff,
      ]),
      Buffer.from([0xff, 0xd8, 0xff, 0x01, 0xff, 0xd9]),
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0xff, 0xd9]),
    ];
    for (const bytes of malformed) {
      expect(inspectJpegStructure(bytes).status).toBe('failed');
    }

    const iptc = Buffer.from('Photoshop 3.0', 'latin1');
    const withApp13 = Buffer.concat([
      SOURCE.subarray(0, -2),
      Buffer.from([
        0xff,
        0xed,
        ((iptc.length + 2) >> 8) & 0xff,
        (iptc.length + 2) & 0xff,
      ]),
      iptc,
      SOURCE.subarray(-2),
    ]);
    expect(inspectJpegStructure(withApp13)).toMatchObject({
      status: 'passed',
      hasIptc: true,
      app13Count: 1,
    });

    const malformedManifest = structuredClone(FIXTURE_MANIFEST);
    delete malformedManifest.schemaVersion;
    delete malformedManifest.provenance.kind;
    malformedManifest.width = 1;
    const manifestReport = inspectFixtureManifest(malformedManifest, Buffer.alloc(0));
    expect(manifestReport.status).toBe('failed');
    expect(manifestReport.error).toContain('fixture manifest fields drifted');
  });

  it('reports every malformed native payload boundary without accepting a PASS payload', () => {
    const payload = validPayload();
    payload.extra = true;
    payload.implementation = { name: 'other', extra: true };
    payload.schemaVersion = 2;
    payload.scenarioId = 'other';
    payload.platform = 'web';
    payload.architecture = 'other';
    payload.jsEngine = 'other';
    payload.fixture = {
      ...payload.fixture,
      id: 'other',
      sourceUri: '',
      inspection: {},
      remainsAfterRun: false,
      extra: true,
    };
    payload.operation = null;
    payload.timing = {
      clock: 'other',
      boundary: 'other',
      warmupIterations: 0,
      measuredIterations: 0,
      extra: true,
    };
    payload.capabilities = {};
    payload.samples = [
      {
        phase: 'other',
        iteration: 0,
        elapsedMs: 0,
        result: {},
        sourceToOutputByteDifference: 0,
        outputInspection: {},
        cleanup: {},
        extra: true,
      },
    ];
    payload.representative = {
      measuredIteration: 0,
      stagedOutputUri: '',
      inspection: {},
      extra: true,
    };
    payload.cleanup = {
      attemptedPackageOutputs: 1,
      removedPackageOutputs: 0,
      residualPackageOutputs: 1,
      residualPackageOutputBytes: 1,
      extra: true,
    };

    const errors = inspectNativeEconomicResiliencePayload(payload);
    expect(errors.length).toBeGreaterThan(20);
    expect(errors.join(' | ')).toContain('native payload fields drifted');
    expect(errors.join(' | ')).toContain('capabilities do not satisfy the scenario');
  });

  it('rejects invalid build identity, environment, fixture, output, and visual inputs together', () => {
    const payload = structuredClone(validPayload());
    payload.platform = 'web';
    expect(() =>
      buildEconomicResilienceEvidence({
        payload,
        packageVersion: 'not-semver',
        sourceCommit: 'short',
        runId: 0,
        runAttempt: 0,
        capturedAt: '1',
        runUrl: 'https://example.com/run/1',
        environment: {},
        fixtureManifest: {},
        sourceBytes: Buffer.alloc(0),
        outputBytes: Buffer.alloc(0),
        visualAgreement: {},
      })
    ).toThrow(/packageVersion|sourceCommit|runId|capturedAt|visual agreement/);
  });

  it('rejects a comprehensively drifted evidence object and unsafe artifact entries', () => {
    const artifact = createArtifact();
    const evidence = structuredClone(artifact.evidence);
    evidence.extra = true;
    evidence.schemaVersion = 2;
    evidence.status = 'failed';
    evidence.scenarioId = 'other';
    evidence.implementation = { name: 'other', version: 'latest', buildSource: 'registry', extra: true };
    evidence.sourceCommit = 'short';
    evidence.runId = 0;
    evidence.runAttempt = 0;
    evidence.capturedAt = '1';
    evidence.runUrl = 'https://example.com';
    evidence.environment = {};
    evidence.capabilities = {};
    evidence.fixture = {};
    evidence.operation = {};
    evidence.timing = {};
    evidence.samples = null;
    evidence.measuredSummary = {};
    evidence.representative = {};
    evidence.economics = {};
    evidence.cleanup = {};
    evidence.visualAgreement = {};
    const report = inspectEconomicResilienceEvidence(artifact.root, evidence);
    expect(report.status).toBe('failed');
    expect(report.error).toContain('evidence fields drifted');
    expect(report.error).toContain('evidence samples are required');

    const linkedArtifact = createArtifact();
    const sourcePath = path.join(linkedArtifact.root, 'source.jpg');
    const externalSource = path.join(path.dirname(linkedArtifact.root), 'external-source.jpg');
    renameSync(sourcePath, externalSource);
    symlinkSync(externalSource, sourcePath);
    expect(
      inspectEconomicResilienceEvidence(linkedArtifact.root, linkedArtifact.evidence).error
    ).toMatch(/non-regular|non-symlink/);

    const invalidJsonArtifact = createArtifact();
    writeFileSync(path.join(invalidJsonArtifact.root, 'environment.json'), '{invalid');
    expect(
      inspectEconomicResilienceEvidence(invalidJsonArtifact.root, invalidJsonArtifact.evidence).error
    ).toContain('asset JSON is invalid: environment.json');

    const fileRoot = path.join(path.dirname(artifact.root), 'not-a-directory');
    writeFileSync(fileRoot, 'file');
    expect(inspectEconomicResilienceEvidence(fileRoot, evidence).error).toContain(
      'artifact root must be a regular directory'
    );
  });

  it('rejects summary and embedded visual numbers that drift from bound raw evidence', () => {
    for (const mutate of [
      (evidence) => {
        evidence.measuredSummary.elapsedMs.median += 1;
      },
      (evidence) => {
        evidence.visualAgreement.uprightSimilarity -= 0.01;
      },
    ]) {
      const artifact = createArtifact();
      mutate(artifact.evidence);
      rewriteEvidence(artifact);
      expect(inspectEconomicResilienceEvidence(artifact.root, artifact.evidence).status)
        .toBe('failed');
    }
  });

  it('rejects fixture and representative identity or geometry drift', () => {
    for (const mutate of [
      (evidence) => {
        evidence.fixture.id = 'other-fixture';
      },
      (evidence) => {
        evidence.fixture.file = 'renamed.jpg';
      },
      (evidence) => {
        evidence.fixture.manifestFile = 'other.json';
      },
      (evidence) => {
        evidence.representative.file = 'other.jpg';
      },
      (evidence) => {
        evidence.representative.width = 1599;
      },
    ]) {
      const artifact = createArtifact();
      mutate(artifact.evidence);
      rewriteEvidence(artifact);
      expect(inspectEconomicResilienceEvidence(artifact.root, artifact.evidence).status)
        .toBe('failed');
    }
  });

  it('rejects capability extra fields, missing formats, type drift, and cancellation drift', () => {
    for (const mutate of [
      (evidence) => {
        evidence.capabilities.extra = true;
      },
      (evidence) => {
        evidence.capabilities.formats.pop();
      },
      (evidence) => {
        evidence.capabilities.formats[1].format = 'jpeg';
      },
      (evidence) => {
        evidence.capabilities.resourceLimits.maxSourcePixels = '48000000';
      },
      (evidence) => {
        evidence.capabilities.supportsCancellation = false;
      },
    ]) {
      const artifact = createArtifact();
      mutate(artifact.evidence);
      rewriteEvidence(artifact);
      expect(inspectEconomicResilienceEvidence(artifact.root, artifact.evidence).status)
        .toBe('failed');
    }
  });

  it('rejects empty, unknown, mistyped, and additional environment values', () => {
    for (const mutate of [
      (environment) => {
        environment.runtime = '';
      },
      (environment) => {
        environment.osBuild = 42;
      },
      (environment) => {
        environment.runner.name = 'unknown';
      },
      (environment) => {
        environment.toolchain.extra = 'drift';
      },
    ]) {
      const artifact = createArtifact();
      mutate(artifact.evidence.environment);
      rewriteEnvironment(artifact);
      rewriteEvidence(artifact);
      expect(inspectEconomicResilienceEvidence(artifact.root, artifact.evidence).status)
        .toBe('failed');
    }
  });

  it('rejects a lifecycle claim when eleven package outputs remain', () => {
    const artifact = createArtifact();
    artifact.evidence.cleanup.removedPackageOutputs = 1;
    artifact.evidence.cleanup.residualPackageOutputs = 11;
    artifact.evidence.cleanup.residualPackageOutputBytes = 11 * OUTPUT.length;
    artifact.evidence.samples.slice(1).forEach((sample) => {
      sample.cleanup.packageOutputRemoved = false;
      sample.cleanup.existsAfterRemoval = true;
      sample.cleanup.residualByteSize = OUTPUT.length;
    });
    rewriteEvidence(artifact);
    const report = inspectEconomicResilienceEvidence(artifact.root, artifact.evidence);
    expect(report.status).toBe('failed');
    expect(report.error).toContain('zero residual');
  });

  it('rejects extra assets and fixture metadata comments', () => {
    const artifact = createArtifact();
    writeFileSync(path.join(artifact.root, 'unexpected.txt'), 'drift');
    expect(inspectEconomicResilienceEvidence(artifact.root, artifact.evidence).status)
      .toBe('failed');

    const commented = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x09]),
      Buffer.from('comment'),
      SOURCE.subarray(2),
    ]);
    expect(inspectFixtureManifest(FIXTURE_MANIFEST, commented).error).toContain(
      'must not contain APP1, APP13, or JPEG comment metadata'
    );

    const postScanComment = Buffer.concat([
      SOURCE.subarray(0, -2),
      Buffer.from([0xff, 0xfe, 0x00, 0x09]),
      Buffer.from('comment'),
      SOURCE.subarray(-2),
    ]);
    expect(inspectFixtureManifest(FIXTURE_MANIFEST, postScanComment).error).toContain(
      'must not contain APP1, APP13, or JPEG comment metadata'
    );

    const postScanExif = Buffer.concat([
      SOURCE.subarray(0, -2),
      Buffer.from([0xff, 0xe1, 0x00, 0x08]),
      Buffer.from('Exif\0\0'),
      SOURCE.subarray(-2),
    ]);
    expect(inspectFixtureManifest(FIXTURE_MANIFEST, postScanExif).error).toContain(
      'must not contain APP1, APP13, or JPEG comment metadata'
    );

    const extendedXmpSignature = Buffer.from(
      'http://ns.adobe.com/xmp/extension/\0',
      'latin1'
    );
    const extendedXmp = Buffer.concat([
      SOURCE.subarray(0, -2),
      Buffer.from([
        0xff,
        0xe1,
        ((extendedXmpSignature.length + 2) >> 8) & 0xff,
        (extendedXmpSignature.length + 2) & 0xff,
      ]),
      extendedXmpSignature,
      SOURCE.subarray(-2),
    ]);
    expect(inspectFixtureManifest(FIXTURE_MANIFEST, extendedXmp).error).toContain(
      'must not contain APP1, APP13, or JPEG comment metadata'
    );

    const trailing = Buffer.concat([SOURCE, Buffer.from('trailing')]);
    expect(inspectFixtureManifest(FIXTURE_MANIFEST, trailing).error).toContain(
      'JPEG contains bytes after EOI'
    );

    const driftedManifest = structuredClone(FIXTURE_MANIFEST);
    driftedManifest.provenance.generator = 'other encoder';
    expect(inspectFixtureManifest(driftedManifest, SOURCE).error).toContain(
      'provenance drifted from the immutable generation record'
    );
  });

  it('the offline CLI replays decode, geometry, SSIM, and the flip control', () => {
    const artifact = createReplayableArtifact();
    const valid = spawnSync(
      process.execPath,
      [
        VERIFIER,
        '--artifact-dir',
        artifact.root,
      ],
      { cwd: os.tmpdir(), encoding: 'utf8' }
    );
    expect(valid.status, valid.stderr).toBe(0);

    const forgedArtifact = createArtifact();
    const forged = spawnSync(
      process.execPath,
      [
        'scripts/verify-economic-resilience-evidence.mjs',
        '--artifact-dir',
        forgedArtifact.root,
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    );
    expect(forged.status).toBe(1);
    expect(forged.stdout).toContain('visual replay failed');
  }, 30_000);

  it('keeps reports outside artifacts and publishes them without replacement', () => {
    const artifact = createReplayableArtifact();
    const evidencePath = path.join(artifact.root, 'economic-resilience.json');
    const originalEvidence = readFileSync(evidencePath);
    const parent = path.dirname(artifact.root);
    const reportPath = path.join(parent, 'verification.json');

    const valid = runVerifier(artifact.root, reportPath);
    expect(valid.status, valid.stderr).toBe(0);
    expect(readFileSync(reportPath, 'utf8')).toBe(valid.stdout);
    expect(JSON.parse(valid.stdout).replay).toMatchObject({
      status: 'passed',
      measurementMatch: true,
    });
    expect(readFileSync(evidencePath)).toEqual(originalEvidence);

    const inside = runVerifier(artifact.root, path.join(artifact.root, 'source.jpg'));
    expect(inside.status).not.toBe(0);
    expect(readFileSync(path.join(artifact.root, 'source.jpg'))).toEqual(SOURCE);

    const existing = path.join(parent, 'existing.json');
    writeFileSync(existing, 'keep');
    expect(runVerifier(artifact.root, existing).status).not.toBe(0);
    expect(readFileSync(existing, 'utf8')).toBe('keep');

    const linked = path.join(parent, 'linked.json');
    symlinkSync(existing, linked);
    expect(runVerifier(artifact.root, linked).status).not.toBe(0);
    expect(readFileSync(existing, 'utf8')).toBe('keep');

    const artifactAlias = path.join(parent, 'artifact-alias');
    symlinkSync(artifact.root, artifactAlias);
    expect(runVerifier(artifact.root, path.join(artifactAlias, 'report.json')).status)
      .not.toBe(0);
    expect(readFileSync(evidencePath)).toEqual(originalEvidence);
  }, 30_000);

  it('preflights every artifact entry before parsing evidence JSON', () => {
    const artifact = createArtifact();
    const evidencePath = path.join(artifact.root, 'economic-resilience.json');
    const external = path.join(path.dirname(artifact.root), 'external.json');
    renameSync(evidencePath, external);
    symlinkSync(external, evidencePath);
    writeFileSync(external, '{ definitely not valid JSON');

    const result = spawnSync(
      process.execPath,
      [VERIFIER, '--artifact-dir', artifact.root],
      { cwd: os.tmpdir(), encoding: 'utf8' }
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('regular non-symlink file: economic-resilience.json');
    expect(result.stderr).not.toContain('SyntaxError');
  });

  it('writes exact environment bytes atomically and refuses linked inputs or outputs', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-economic-environment-'));
    roots.push(parent);
    const log = path.join(parent, 'native.log');
    writeFileSync(log, `${createChunkedNativeLogMessages(
      validPayload(),
      'economic-environment-test',
      {
        chunk: 'RNICK_ECONOMIC_RESILIENCE_CHUNK',
        pass: 'RNICK_ECONOMIC_RESILIENCE_PASS',
      }
    ).join('\n')}\n`);
    const output = path.join(parent, 'environment.json');
    const args = environmentArgs(log, output);
    const created = spawnSync(process.execPath, args, { encoding: 'utf8' });
    expect(created.status, created.stderr).toBe(0);
    expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(validEnvironment());

    const existing = spawnSync(process.execPath, args, { encoding: 'utf8' });
    expect(existing.status).not.toBe(0);
    expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(validEnvironment());

    const linkedLog = path.join(parent, 'linked.log');
    symlinkSync(log, linkedLog);
    const linkedInput = spawnSync(
      process.execPath,
      environmentArgs(linkedLog, path.join(parent, 'linked-input.json')),
      { encoding: 'utf8' }
    );
    expect(linkedInput.status).not.toBe(0);

    const outputLink = path.join(parent, 'output-link.json');
    symlinkSync(output, outputLink);
    const linkedOutput = spawnSync(
      process.execPath,
      environmentArgs(log, outputLink),
      { encoding: 'utf8' }
    );
    expect(linkedOutput.status).not.toBe(0);
    expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(validEnvironment());

    const linkedParent = path.join(parent, 'linked-parent');
    const realParent = path.join(parent, 'real-parent');
    mkdirSync(realParent);
    symlinkSync(realParent, linkedParent);
    const linkedParentOutput = spawnSync(
      process.execPath,
      environmentArgs(log, path.join(linkedParent, 'environment.json')),
      { encoding: 'utf8' }
    );
    expect(linkedParentOutput.status).not.toBe(0);
    expect(() => readFileSync(path.join(realParent, 'environment.json'))).toThrow();
  });

  it('builds transactionally through an aliased ancestor and leaves no root on validation failure', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-economic-builder-'));
    roots.push(parent);
    const actual = path.join(parent, 'actual-inputs');
    const alias = path.join(parent, 'aliased-inputs');
    mkdirSync(actual);
    symlinkSync(actual, alias);
    const payload = validPayload();
    const visualAgreement = createDemoVisualAgreementReport({
      sourceBytes: SOURCE,
      outputBytes: OUTPUT,
      sourceWidth: 4000,
      sourceHeight: 3000,
      width: 1600,
      height: 1200,
      resizeMode: 'contain',
      maxWidth: 1600,
      maxHeight: 1200,
      uprightSimilarity: 0.95,
      verticalFlipSimilarity: 0.5,
    });
    const files = {
      log: 'native.log',
      source: 'source.jpg',
      output: 'output.jpg',
      manifest: 'fixture.json',
      visual: 'visual.json',
      environment: 'environment.json',
    };
    writeFileSync(
      path.join(actual, files.log),
      `${createChunkedNativeLogMessages(payload, 'economic-builder-test', {
        chunk: 'RNICK_ECONOMIC_RESILIENCE_CHUNK',
        pass: 'RNICK_ECONOMIC_RESILIENCE_PASS',
      }).join('\n')}\n`
    );
    writeFileSync(path.join(actual, files.source), SOURCE);
    writeFileSync(path.join(actual, files.output), OUTPUT);
    writeFileSync(path.join(actual, files.manifest), `${JSON.stringify(FIXTURE_MANIFEST)}\n`);
    writeFileSync(path.join(actual, files.visual), `${JSON.stringify(visualAgreement)}\n`);
    writeFileSync(path.join(actual, files.environment), `${JSON.stringify(validEnvironment())}\n`);

    const destination = path.join(parent, 'built');
    const result = spawnSync(
      process.execPath,
      builderArgs(alias, files, destination, '0.4.1'),
      { encoding: 'utf8' }
    );
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(path.join(destination, 'economic-resilience', 'economic-resilience.json')))
      .toBe(true);

    const failedDestination = path.join(parent, 'must-not-remain');
    const failed = spawnSync(
      process.execPath,
      builderArgs(alias, files, failedDestination, 'not-semver'),
      { encoding: 'utf8' }
    );
    expect(failed.status).not.toBe(0);
    expect(existsSync(failedDestination)).toBe(false);
  });
});

function createArtifact() {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-economic-evidence-'));
  roots.push(parent);
  const root = path.join(parent, 'economic-resilience');
  mkdirSync(root);
  const payload = validPayload();
  const environment = validEnvironment();
  const visualAgreement = createDemoVisualAgreementReport({
    sourceBytes: SOURCE,
    outputBytes: OUTPUT,
    sourceWidth: 4000,
    sourceHeight: 3000,
    width: 1600,
    height: 1200,
    resizeMode: 'contain',
    maxWidth: 1600,
    maxHeight: 1200,
    uprightSimilarity: 0.95,
    verticalFlipSimilarity: 0.5,
  });
  const evidence = buildEconomicResilienceEvidence({
    payload,
    packageVersion: '0.4.1',
    sourceCommit: '1'.repeat(40),
    runId: 31_674_626_714,
    runAttempt: 1,
    capturedAt: '2026-08-13T07:00:00.000Z',
    runUrl:
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/31674626714',
    environment,
    fixtureManifest: FIXTURE_MANIFEST,
    sourceBytes: SOURCE,
    outputBytes: OUTPUT,
    visualAgreement,
  });
  writeFileSync(path.join(root, 'source.jpg'), SOURCE);
  writeFileSync(path.join(root, 'output.jpg'), OUTPUT);
  writeFileSync(
    path.join(root, 'fixture-manifest.json'),
    `${JSON.stringify(FIXTURE_MANIFEST, null, 2)}\n`
  );
  writeFileSync(
    path.join(root, 'visual-agreement.json'),
    `${JSON.stringify(visualAgreement, null, 2)}\n`
  );
  writeFileSync(
    path.join(root, 'environment.json'),
    `${JSON.stringify(environment, null, 2)}\n`
  );
  writeFileSync(
    path.join(root, 'economic-resilience.json'),
    `${JSON.stringify(evidence, null, 2)}\n`
  );
  return { root, evidence };
}

function validPayload() {
  const inspection = {
    exists: true,
    byteSize: OUTPUT.length,
    sha256: OUTPUT_SHA,
    mediaType: 'image/jpeg',
    width: 1600,
    height: 1200,
  };
  const samples = Array.from({ length: 12 }, (_, index) => ({
    phase: index < 2 ? 'warmup' : 'measured',
    iteration: index < 2 ? index + 1 : index - 1,
    elapsedMs: index + 1,
    result: {
      format: 'jpeg',
      width: 1600,
      height: 1200,
      byteSize: OUTPUT.length,
      originalByteSize: SOURCE.length,
      compressionRatio: OUTPUT.length / SOURCE.length,
    },
    sourceToOutputByteDifference: SOURCE.length - OUTPUT.length,
    outputInspection: { ...inspection },
    cleanup: {
      packageOutputRemoved: true,
      existsAfterRemoval: false,
      residualByteSize: 0,
    },
  }));
  return {
    schemaVersion: 1,
    scenarioId: 'kit-only-12mp-jpeg-v1',
    implementation: { name: 'react-native-image-compression-kit' },
    platform: 'android',
    architecture: 'new',
    jsEngine: 'hermes',
    fixture: {
      ...ECONOMIC_RESILIENCE_FIXTURE,
      sourceUri: 'file:///cache/source.jpg',
      inspection: {
        exists: true,
        byteSize: SOURCE.length,
        sha256: sha256(SOURCE),
        mediaType: 'image/jpeg',
        width: 4000,
        height: 3000,
      },
      remainsAfterRun: true,
    },
    operation: ECONOMIC_RESILIENCE_OPERATION,
    capabilities: validCapabilities(),
    timing: {
      clock: 'performance.now',
      boundary: 'compressImage-call-only',
      warmupIterations: 2,
      measuredIterations: 10,
    },
    representative: {
      measuredIteration: 10,
      stagedOutputUri: 'file:///cache/staged-output.jpg',
      inspection: { ...inspection },
    },
    samples,
    cleanup: {
      attemptedPackageOutputs: 12,
      removedPackageOutputs: 12,
      residualPackageOutputs: 0,
      residualPackageOutputBytes: 0,
    },
  };
}

function validCapabilities() {
  return {
    platform: 'android',
    formats: ['jpeg', 'png', 'webp', 'heic', 'heif', 'avif', 'gif'].map(
      (format) => ({
        format,
        input: true,
        output: ['jpeg', 'png', 'webp'].includes(format),
        supportsAlpha: format !== 'jpeg',
        supportsAnimation: false,
        notes: [`${format} exact runtime note`],
      })
    ),
    metadataPolicies: ['preserve', 'safe', 'strip'],
    supportsTargetSizeCompression: true,
    supportsCancellation: true,
    maxConcurrentOperations: 2,
    supportsDecodeDownsampling: true,
    resourceLimits: {
      maxSourceDimension: 16_384,
      maxSourcePixels: 48_000_000,
      maxWorkingPixels: 16_000_000,
    },
  };
}

function validEnvironment() {
  return {
    platform: 'android',
    runtime: 'Android 15 / API 35',
    osBuild: 'AP3A.241105.008',
    device: 'Google sdk_gphone64_x86_64',
    deviceKind: 'emulator',
    abi: 'x86_64',
    reactNativeArchitecture: 'new',
    reactNativeVersion: '0.86.2',
    jsEngine: 'hermes',
    buildType: 'debug',
    runner: {
      label: 'ubuntu-latest',
      os: 'Linux',
      arch: 'X64',
      name: 'GitHub Actions 123',
      imageOS: 'ubuntu24',
      imageVersion: '20260810.1',
    },
    toolchain: {
      node: 'v24.18.0',
      ffmpeg: 'ffmpeg version 7.1.1',
      ffprobe: 'ffprobe version 7.1.1',
      primary: 'openjdk version 21.0.8',
      platformSdk:
        'Android compile SDK 36; emulator API 35; build-tools 36.0.0; NDK 27.1.12297006',
    },
  };
}

function createReplayableArtifact() {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'rnick-economic-replay-'));
  roots.push(parent);
  const output = path.join(parent, 'output.jpg');
  mustRun('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-i', 'example/fixtures/kit-only-12mp-v1.jpg',
    '-vf', 'scale=1600:1200:flags=lanczos',
    '-frames:v', '1',
    '-c:v', 'mjpeg',
    '-q:v', '2',
    '-pix_fmt', 'yuvj420p',
    '-map_metadata', '-1',
    '-flags', '+bitexact',
    '-fflags', '+bitexact',
    output,
  ]);
  const outputBytes = readFileSync(output);
  const visualPath = path.join(parent, 'visual.json');
  mustRun(process.execPath, [
    'scripts/measure-demo-visual-agreement.mjs',
    '--source', 'example/fixtures/kit-only-12mp-v1.jpg',
    '--output', output,
    '--resize-mode', 'contain',
    '--max-width', '1600',
    '--max-height', '1200',
    '--report', visualPath,
  ]);
  const visualAgreement = JSON.parse(readFileSync(visualPath, 'utf8'));
  const payload = validPayloadForOutput(outputBytes);
  const environment = validEnvironment();
  environment.toolchain.ffmpeg = firstLine(
    mustRun('ffmpeg', ['-version'], { encoding: 'utf8' }).stdout
  );
  environment.toolchain.ffprobe = firstLine(
    mustRun('ffprobe', ['-version'], { encoding: 'utf8' }).stdout
  );
  const evidence = buildEconomicResilienceEvidence({
    payload,
    packageVersion: '0.4.1',
    sourceCommit: '1'.repeat(40),
    runId: 31_674_626_714,
    runAttempt: 1,
    capturedAt: '2026-08-13T07:00:00.000Z',
    runUrl:
      'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/31674626714',
    environment,
    fixtureManifest: FIXTURE_MANIFEST,
    sourceBytes: SOURCE,
    outputBytes,
    visualAgreement,
  });
  const root = path.join(parent, 'economic-resilience');
  mkdirSync(root);
  cpSync('example/fixtures/kit-only-12mp-v1.jpg', path.join(root, 'source.jpg'));
  cpSync(output, path.join(root, 'output.jpg'));
  writeFileSync(path.join(root, 'fixture-manifest.json'), `${JSON.stringify(FIXTURE_MANIFEST, null, 2)}\n`);
  writeFileSync(path.join(root, 'visual-agreement.json'), `${JSON.stringify(visualAgreement, null, 2)}\n`);
  writeFileSync(path.join(root, 'environment.json'), `${JSON.stringify(environment, null, 2)}\n`);
  writeFileSync(path.join(root, 'economic-resilience.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  return { root };
}

function validPayloadForOutput(outputBytes) {
  const payload = validPayload();
  const inspection = {
    exists: true,
    byteSize: outputBytes.length,
    sha256: sha256(outputBytes),
    mediaType: 'image/jpeg',
    width: 1600,
    height: 1200,
  };
  payload.samples.forEach((sample) => {
    sample.result.byteSize = outputBytes.length;
    sample.result.compressionRatio = outputBytes.length / SOURCE.length;
    sample.sourceToOutputByteDifference = SOURCE.length - outputBytes.length;
    sample.outputInspection = { ...inspection };
  });
  payload.representative.inspection = { ...inspection };
  return payload;
}

function mustRun(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result;
}

function runVerifier(artifactDir, reportFile) {
  return spawnSync(
    process.execPath,
    [
      VERIFIER,
      '--artifact-dir',
      artifactDir,
      '--report-file',
      reportFile,
    ],
    { cwd: os.tmpdir(), encoding: 'utf8' }
  );
}

function environmentArgs(nativeLog, output) {
  const environment = validEnvironment();
  return [
    path.resolve('scripts/create-economic-resilience-environment.mjs'),
    '--platform', environment.platform,
    '--runtime', environment.runtime,
    '--os-build', environment.osBuild,
    '--device', environment.device,
    '--device-kind', environment.deviceKind,
    '--abi', environment.abi,
    '--react-native-version', environment.reactNativeVersion,
    '--native-log', nativeLog,
    '--build-type', environment.buildType,
    '--runner-label', environment.runner.label,
    '--runner-os', environment.runner.os,
    '--runner-arch', environment.runner.arch,
    '--runner-name', environment.runner.name,
    '--image-os', environment.runner.imageOS,
    '--image-version', environment.runner.imageVersion,
    '--node', environment.toolchain.node,
    '--ffmpeg', environment.toolchain.ffmpeg,
    '--ffprobe', environment.toolchain.ffprobe,
    '--primary-toolchain', environment.toolchain.primary,
    '--platform-sdk', environment.toolchain.platformSdk,
    '--output', output,
  ];
}

function builderArgs(root, files, destination, packageVersion) {
  return [
    path.resolve('scripts/create-economic-resilience-evidence.mjs'),
    '--platform', 'android',
    '--package-version', packageVersion,
    '--source-sha', '1'.repeat(40),
    '--run-id', '31674626714',
    '--run-attempt', '1',
    '--run-url',
    'https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/31674626714',
    '--captured-at', '2026-08-13T07:00:00.000Z',
    '--log', path.join(root, files.log),
    '--source', path.join(root, files.source),
    '--output', path.join(root, files.output),
    '--fixture-manifest', path.join(root, files.manifest),
    '--visual-agreement', path.join(root, files.visual),
    '--environment', path.join(root, files.environment),
    '--destination', destination,
  ];
}

function firstLine(value) {
  return String(value).split(/\r?\n/, 1)[0];
}

function minimalJpeg(width, height) {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x0c,
    0x03, 0x01, 0x00, 0x02, 0x00, 0x03, 0x00, 0x00, 0x3f, 0x00,
    0xff, 0xd9,
  ]);
}

function rewriteEvidence({ root, evidence }) {
  writeFileSync(
    path.join(root, 'economic-resilience.json'),
    `${JSON.stringify(evidence, null, 2)}\n`
  );
}

function rewriteEnvironment({ root, evidence }) {
  writeFileSync(
    path.join(root, 'environment.json'),
    `${JSON.stringify(evidence.environment, null, 2)}\n`
  );
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
