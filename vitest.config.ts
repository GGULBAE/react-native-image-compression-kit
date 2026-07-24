import { defineConfig } from 'vitest/config';
import {
  COVERAGE_EXCLUDE,
  COVERAGE_INCLUDE,
  COVERAGE_THRESHOLDS,
} from './coverage.config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.{ts,mjs}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: COVERAGE_THRESHOLDS,
      include: [...COVERAGE_INCLUDE],
      exclude: [
        // React Native Codegen and barrel entry wrappers are validated by
        // package/native contracts instead of isolated Node execution.
        ...COVERAGE_EXCLUDE.slice(0, 2),
        // Generated trees, fixtures, evidence, and CLI entry wrappers stay
        // outside the explicit runtime/core include set above.
        ...COVERAGE_EXCLUDE.slice(2),
      ],
    },
  },
});
