import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { calculateByteEconomics } from '../website/.vitepress/theme/byteEconomics.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('byte economics calculator', () => {
  const baseInputs = {
    acceptedCount: 1_000_000,
    packageInputBytesPerAccepted: 4_000_000,
    acceptedOutputBytesPerAccepted: 500_000,
    matchedBaselineBytesPerAccepted: null,
    retentionDays: 30,
    ownsStagingSource: false,
    storagePricePerDecimalGbMonth: 0.015,
  };

  it('keeps the observed delta separate from an absent matched baseline', () => {
    const result = calculateByteEconomics(baseInputs);

    expect(result).toMatchObject({
      sourceToOutputByteDelta: 3_500_000_000_000,
      newPipelineTransferBytes: 500_000_000_000,
      matchedTransferDifferenceBytes: null,
      retainedOutputBytes: 500_000_000_000,
      retainedOutputStorageCost: 7.5,
      stagingReplacementDifferenceBytes: null,
      stagingReplacementStorageCostDifference: null,
      unchangedObjectCount: 1_000_000,
      unchangedWriteRequestCount: 1_000_000,
    });
  });

  it('enables transfer and staging differences only from their explicit inputs', () => {
    const result = calculateByteEconomics({
      ...baseInputs,
      matchedBaselineBytesPerAccepted: 4_000_000,
      ownsStagingSource: true,
    });

    expect(result.matchedTransferDifferenceBytes).toBe(3_500_000_000_000);
    expect(result.stagingReplacementDifferenceBytes).toBe(3_500_000_000_000);
    expect(result.stagingReplacementStorageCostDifference).toBe(52.5);
  });

  it('reports growth as a signed difference instead of manufacturing savings', () => {
    const result = calculateByteEconomics({
      acceptedCount: 10,
      packageInputBytesPerAccepted: 500,
      acceptedOutputBytesPerAccepted: 800,
      matchedBaselineBytesPerAccepted: 600,
      retentionDays: 15,
      ownsStagingSource: true,
      storagePricePerDecimalGbMonth: 2,
    });

    expect(result.sourceToOutputByteDelta).toBe(-3_000);
    expect(result.matchedTransferDifferenceBytes).toBe(-2_000);
    expect(result.stagingReplacementDifferenceBytes).toBe(-3_000);
    expect(result.stagingReplacementStorageCostDifference).toBeCloseTo(-0.000003);
  });

  it('rejects invalid and unsafe scenario arithmetic', () => {
    expect(() =>
      calculateByteEconomics({ ...baseInputs, acceptedCount: 1.5 })
    ).toThrow('Accepted output count must be a safe integer');
    expect(() =>
      calculateByteEconomics({
        ...baseInputs,
        packageInputBytesPerAccepted: 0,
      })
    ).toThrow('Package input bytes must be a safe integer of at least 1');
    expect(() =>
      calculateByteEconomics({
        ...baseInputs,
        acceptedCount: Number.MAX_SAFE_INTEGER,
      })
    ).toThrow("exceeds JavaScript's safe integer range");
  });

  it('keeps calculator inputs local and exposes every economic boundary', () => {
    const component = read(
      'website/.vitepress/theme/ByteEconomicsCalculator.vue'
    );
    const theme = read('website/.vitepress/theme/index.ts');
    const guide = read('website/guide/byte-economics.md');
    const css = read('website/.vitepress/theme/custom.css');

    for (const contract of [
      'does not transmit or persist your inputs',
      'Matched transfer difference',
      'App-owned staging replacement',
      'Gallery/provider source remains',
      'Unchanged, not zero',
      '2026-08-13',
    ]) {
      expect(component).toContain(contract);
    }
    for (const forbiddenPrimitive of [
      /\bfetch\s*\(/,
      /XMLHttpRequest/,
      /sendBeacon/,
      /localStorage/,
      /sessionStorage/,
      /indexedDB/,
      /document\.cookie/,
    ]) {
      expect(component).not.toMatch(forbiddenPrimitive);
    }
    expect(theme).toContain(
      "app.component('ByteEconomicsCalculator', ByteEconomicsCalculator)"
    );
    expect(guide).toContain('<ByteEconomicsCalculator />');
    expect(guide).toContain('matched current-pipeline');
    expect(css).toContain('.byte-calculator__results');
  });
});

describe('pipeline selection guide', () => {
  it('is discoverable and chooses on contracts without a speed leaderboard', () => {
    const guide = read('website/guide/choosing-an-image-pipeline.md');
    const config = read('website/.vitepress/config.mts');

    for (const contract of [
      'Choose by contract, not a speed rank',
      'Target bytes',
      'Metadata policy',
      'Cancellation',
      'Runtime capability',
      'Output ownership',
      'Evidence',
      'One runner capture cannot establish a universal speed or quality order',
    ]) {
      expect(guide).toContain(contract);
    }
    expect(guide).not.toMatch(/react-native-compressor|image-resizer/i);
    expect(guide).not.toMatch(/fastest|universally faster|quality superiority/i);
    expect(
      config.match(/link: '\/guide\/choosing-an-image-pipeline'/g)
    ).toHaveLength(2);
  });
});
