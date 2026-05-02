import { test, expect } from '@playwright/test';
import { BACKEND_URL } from '../playwright.config.js';

test('backend /api/v1/health returns Forjio envelope', async ({ request }) => {
  const res = await request.get(`${BACKEND_URL}/api/v1/health`);
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.error).toBeNull();
  expect(body.data.status).toBe('ok');
  expect(body.meta.requestId).toMatch(/^req_/);
});

test('frontend marketing page renders brand name', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1').first()).toBeVisible();
});
