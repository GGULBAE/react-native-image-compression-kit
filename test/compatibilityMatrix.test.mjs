import { describe, expect, it } from 'vitest';
import {
  selectCompatibilityLane,
  validateCompatibilityMatrix,
} from '../scripts/compatibility-matrix-core.mjs';

const packageJson = {
  version: '0.3.0',
  peerDependencies: { 'react-native': '>=0.73 <1.0' },
};
const manifest = {
  schemaVersion: 1,
  packageVersion: '0.3.0',
  workflow: '.github/workflows/compatibility.yml',
  lanes: [
    lane('rn-floor-legacy', '0.73.11', '18', 'legacy', { cli: '12.3.7' }),
    lane('rn-current-legacy', '0.86.0', '24', 'legacy', { cli: '20.1.3' }),
    lane('rn-current-new', '0.86.0', '24', 'new', { cli: '20.1.3' }),
    lane('expo-current-new', '0.86.0', '24', 'new', {
      kind: 'expo',
      expo: '57.0.7',
    }),
  ],
};

describe('compatibility matrix', () => {
  it('accepts exact required release lanes', () => {
    expect(validateCompatibilityMatrix(manifest, packageJson)).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it('rejects peer-range drift, latest selection, and missing release authority', () => {
    const candidate = structuredClone(manifest);
    candidate.lanes[0].reactNative = 'latest';
    candidate.lanes[1].releaseRequired = false;

    const report = validateCompatibilityMatrix(candidate, {
      ...packageJson,
      peerDependencies: { 'react-native': '>=0.80 <1.0' },
    });

    expect(report.ok).toBe(false);
    expect(report.errors.join('\n')).toContain('latest selection is forbidden');
    expect(report.errors.join('\n')).toContain('releaseRequired must be true');
    expect(report.errors.join('\n')).toContain('React Native peer range expected');
  });

  it('selects an explicit lane and platform only', () => {
    expect(selectCompatibilityLane(manifest, 'rn-current-new', 'ios')).toMatchObject({
      reactNative: '0.86.0',
      architecture: 'new',
    });
    expect(() => selectCompatibilityLane(manifest, 'missing', 'ios')).toThrow(
      'unknown compatibility lane'
    );
  });
});

function lane(id, reactNative, node, architecture, overrides = {}) {
  return {
    id,
    kind: 'bare',
    reactNative,
    react: reactNative === '0.73.11' ? '18.2.0' : '19.2.3',
    node,
    architecture,
    platforms: ['android', 'ios'],
    releaseRequired: true,
    ...overrides,
  };
}
