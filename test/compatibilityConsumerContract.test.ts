import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('scripts/compatibility-consumer.mjs', 'utf8');

describe('compatibility consumer iOS environment', () => {
  it('tests the package without the RN template Flipper dependency', () => {
    expect(source).toContain("NO_FLIPPER: '1'");
    expect(source).toContain("RCT_NEW_ARCH_ENABLED: lane.architecture === 'new' ? '1' : '0'");
  });
});

describe('compatibility consumer Android resources', () => {
  it('replaces the generated Gradle heap with the hosted-runner budget', () => {
    expect(source).toContain(
      "const androidGradleJvmArgs = '-Xmx4g -XX:MaxMetaspaceSize=1g';"
    );
    expect(source).toContain(
      'const gradleJvmArgsProperty = `org.gradle.jvmargs=${androidGradleJvmArgs}`;'
    );
    expect(source).toContain(
      'architectureUpdated.replace(\n          /(^|\\n)org\\.gradle\\.jvmargs=.*/,'
    );
  });
});
