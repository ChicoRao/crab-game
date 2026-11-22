import { defineConfig } from 'vitest/config';

// Engine coverage gate: >= 95% lines and branches (docs/engineering.md §5).
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test-utils.ts'],
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
