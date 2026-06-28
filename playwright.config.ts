import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // E2E tests need real browser, not happy-dom. Vitest picks up *.test.ts files;
  // Playwright picks up *.spec.ts. Disjoint include globs prevent collisions.
  fullyParallel: false,  // single dev server is shared
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    // Use installed Chromium explicitly (macOS default location)
    channel: undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});