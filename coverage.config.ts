export const COVERAGE_THRESHOLDS = {
  statements: 94,
  branches: 83,
  functions: 98,
  lines: 94,
} as const;

export const COVERAGE_INCLUDE = [
  'src/api.ts',
  'src/errors.ts',
  'src/nativeModule.ts',
  'src/types.ts',
  'src/validation.ts',
  'scripts/*-core.mjs',
  'scripts/github-attestation-transport.mjs',
  'scripts/ios-smoke-contract.mjs',
  'scripts/ios-smoke-pass-replay-fixture.mjs',
  'scripts/registry-health-report.mjs',
] as const;

export const COVERAGE_EXCLUDE = [
  'src/NativeImageCompressionKit.ts',
  'src/index.ts',
  '**/generated/**',
  'test/fixtures/**',
  'evidence/**',
  'scripts/verify-*.mjs',
] as const;
