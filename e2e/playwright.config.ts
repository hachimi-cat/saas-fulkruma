import { defineConfig } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

const isRemote = !!(process.env.FRONTEND_URL || process.env.BACKEND_URL || process.env.CI);

export default defineConfig({
  testDir: './tests',
  fullyParallel: !isRemote,
  forbidOnly: !!process.env.CI,
  retries: isRemote ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { viewport: { width: 1280, height: 800 } } },
  ],
});

export { BACKEND_URL };
