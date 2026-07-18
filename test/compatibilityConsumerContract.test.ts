import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('scripts/compatibility-consumer.mjs', 'utf8');

describe('compatibility consumer iOS environment', () => {
  it('tests the package without the RN template Flipper dependency', () => {
    expect(source).toContain("NO_FLIPPER: '1'");
    expect(source).toContain("RCT_NEW_ARCH_ENABLED: lane.architecture === 'new' ? '1' : '0'");
  });
});
