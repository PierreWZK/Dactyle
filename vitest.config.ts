import { defineConfig } from 'vitest/config';

// Les tests E2E (e2e/) sont lancés par Playwright, pas par Vitest.
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
});
