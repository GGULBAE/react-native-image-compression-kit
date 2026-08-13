import { describe, expect, it } from 'vitest';
import {
  createDemoVisualAgreementReport,
  inspectDemoVisualAgreement,
  calculateContainDimensions,
  parseFfmpegFrameDimensions,
  parseFfmpegSsim,
} from '../scripts/demo-visual-agreement-core.mjs';

const sourceBytes = Buffer.from('asymmetric source');
const outputBytes = Buffer.from('upright output');

describe('native demo visual agreement', () => {
  it('accepts an upright result that beats the vertical-flip control', () => {
    const report = createDemoVisualAgreementReport({
      sourceBytes,
      outputBytes,
      sourceWidth: 600,
      sourceHeight: 960,
      width: 100,
      height: 160,
      resizeMode: 'contain',
      maxWidth: 160,
      maxHeight: 160,
      uprightSimilarity: 0.947591,
      verticalFlipSimilarity: 0.76037,
    });
    expect(report.status).toBe('passed');
    expect(report).toMatchObject({
      schemaVersion: 2,
      algorithm: 'ffmpeg-auto-oriented-contain-ssim-v2',
    });
    expect(inspectDemoVisualAgreement(report, {
      sourceBytes,
      outputBytes,
      resizeOptions: { mode: 'contain', maxWidth: 160, maxHeight: 160 },
    })).toEqual({
      status: 'passed',
      agreementStatus: 'passed',
      error: null,
    });
  });

  it('rejects the observed inverted-result signature and digest drift', () => {
    const report = createDemoVisualAgreementReport({
      sourceBytes,
      outputBytes,
      sourceWidth: 200,
      sourceHeight: 320,
      width: 100,
      height: 160,
      resizeMode: 'contain',
      maxWidth: 160,
      maxHeight: 160,
      uprightSimilarity: 0.76037,
      verticalFlipSimilarity: 0.947591,
    });
    expect(report.status).toBe('failed');
    const inspection = inspectDemoVisualAgreement(
      { ...report, status: 'passed' },
      { sourceBytes, outputBytes: Buffer.from('different output') }
    );
    expect(inspection.status).toBe('failed');
    expect(inspection.error).toContain('status does not match the derived visual outcome');
    expect(inspection.error).toContain('output SHA-256 mismatch');
  });

  it('rejects a stretched output even when SSIM is high', () => {
    const report = createDemoVisualAgreementReport({
      sourceBytes,
      outputBytes,
      sourceWidth: 200,
      sourceHeight: 320,
      width: 160,
      height: 160,
      resizeMode: 'contain',
      maxWidth: 160,
      maxHeight: 160,
      uprightSimilarity: 0.97514,
      verticalFlipSimilarity: 0.800741,
    });
    expect(report).toMatchObject({
      status: 'failed',
      expectedWidth: 100,
      expectedHeight: 160,
      checks: { geometry: false },
    });
    expect(inspectDemoVisualAgreement(report, {
      sourceBytes,
      outputBytes,
      resizeOptions: { mode: 'contain', maxWidth: 160, maxHeight: 160 },
    })).toMatchObject({ status: 'passed', agreementStatus: 'failed' });
  });

  it('rejects malformed v2 fields, derived checks, request drift, and asset drift', () => {
    const valid = createDemoVisualAgreementReport({
      sourceBytes,
      outputBytes,
      sourceWidth: 600,
      sourceHeight: 960,
      width: 100,
      height: 160,
      resizeMode: 'contain',
      maxWidth: 160,
      maxHeight: 160,
      uprightSimilarity: 0.95,
      verticalFlipSimilarity: 0.7,
    });
    const malformed = {
      ...valid,
      schemaVersion: 9,
      status: 'unknown',
      algorithm: 'unmeasured',
      resizeMode: 'cover',
      maxWidth: 0,
      expectedWidth: 999,
      uprightSimilarity: 2,
      minimumSimilarity: 0.8,
      minimumOrientationMargin: 0.01,
      checks: {},
      sourceSha256: '0'.repeat(64),
      outputSha256: '0'.repeat(64),
    };
    const inspection = inspectDemoVisualAgreement(malformed, {
      sourceBytes,
      outputBytes,
      resizeOptions: { mode: 'contain', maxWidth: 160, maxHeight: 160 },
    });
    expect(inspection.status).toBe('failed');
    for (const message of [
      'schemaVersion must be 2',
      'status must be passed or failed',
      'algorithm is unsupported',
      'resizeMode must be contain',
      'maxWidth must be a positive integer',
      'uprightSimilarity must be between 0 and 1',
      'minimum similarity drifted',
      'orientation margin drifted',
      'expected dimensions do not match contain geometry',
      'geometry check does not match the measured values',
      'status does not match the derived visual outcome',
      'resize contract does not match the native request',
      'source SHA-256 mismatch',
      'output SHA-256 mismatch',
    ]) {
      expect(inspection.error).toContain(message);
    }
    expect(calculateContainDimensions({
      sourceWidth: 600,
      sourceHeight: 960,
      maxWidth: 0,
      maxHeight: 160,
    })).toEqual({ width: null, height: null });
  });

  it('calculates rounded contain geometry and parses auto-oriented dimensions', () => {
    expect(calculateContainDimensions({
      sourceWidth: 320,
      sourceHeight: 200,
      maxWidth: 160,
      maxHeight: 160,
    })).toEqual({ width: 160, height: 100 });
    expect(parseFfmpegFrameDimensions('showinfo s:200x320 i:P')).toEqual({
      width: 200,
      height: 320,
    });
  });

  it('preserves inspection compatibility with a valid visual report v1', () => {
    const legacy = {
      schemaVersion: 1,
      status: 'passed',
      algorithm: 'ffmpeg-auto-oriented-ssim-v1',
      width: 100,
      height: 160,
      uprightSimilarity: 0.95,
      verticalFlipSimilarity: 0.7,
      minimumSimilarity: 0.9,
      minimumOrientationMargin: 0.02,
      sourceSha256: createDemoVisualAgreementReport({
        sourceBytes,
        outputBytes,
        sourceWidth: 600,
        sourceHeight: 960,
        width: 100,
        height: 160,
        resizeMode: 'contain',
        maxWidth: 160,
        maxHeight: 160,
        uprightSimilarity: 0.95,
        verticalFlipSimilarity: 0.7,
      }).sourceSha256,
      outputSha256: createDemoVisualAgreementReport({
        sourceBytes,
        outputBytes,
        sourceWidth: 600,
        sourceHeight: 960,
        width: 100,
        height: 160,
        resizeMode: 'contain',
        maxWidth: 160,
        maxHeight: 160,
        uprightSimilarity: 0.95,
        verticalFlipSimilarity: 0.7,
      }).outputSha256,
    };
    expect(inspectDemoVisualAgreement(legacy, { sourceBytes, outputBytes })).toEqual({
      status: 'passed',
      agreementStatus: 'passed',
      error: null,
    });
  });

  it('parses the final ffmpeg SSIM summary', () => {
    expect(parseFfmpegSsim('SSIM Y:0.9 U:0.9 V:0.9 All:0.934502 (11.8)')).toBe(
      0.934502
    );
    expect(() => parseFfmpegSsim('no summary')).toThrow('summary is missing');
    expect(() => parseFfmpegSsim('SSIM All:1.2')).toThrow('summary is invalid');
    expect(() => parseFfmpegFrameDimensions('showinfo size:0x320')).toThrow(
      'frame dimensions are invalid'
    );
  });
});
