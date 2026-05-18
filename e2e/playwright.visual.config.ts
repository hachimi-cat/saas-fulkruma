// Visual regression config — separate from playwright.config.ts so
// functional E2E flakiness doesn't gate the visual job (and vice versa).
//
// Runs against staging (FRONTEND_URL=<staging url> by default, override
// per-env). All screenshots are full-page, diffed at 0.5% tolerance
// against e2e/tests/visual.spec.ts-snapshots/<name>-linux.png.
//
// Baselines must be generated in CI via:
//   workflow_dispatch (Actions tab) → "CI/CD" → run with
//   update_baselines = true. The visual-regression job commits the
//   refreshed PNGs back to the branch.

import { defineConfig, devices } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://staging-fulkruma.forjio.com';

export default defineConfig({
  testDir: './tests',
  testMatch: /visual\.spec\.ts$/,
  // No parallel — screenshots are deterministic and full-page, but
  // serializing keeps GPU/CPU load consistent so raster jitter stays
  // below threshold.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 90_000,

  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer — runs against deployed staging directly.
});
