// Visual regression for marketing chrome.
//
// Lives alongside the functional E2E specs but is ONLY run via
// playwright.visual.config.ts (which restricts testMatch to this file).
// Functional E2E excludes it via testIgnore in playwright.config.ts /
// playwright.ci.config.ts.
//
// Baselines are committed at e2e/tests/visual.spec.ts-snapshots/ and MUST
// be generated in CI (workflow_dispatch with update_baselines=true) — not
// locally — because font/raster differences between dev-machine and the
// GHA ubuntu runner will produce noisy diffs otherwise.

import { test, expect } from '@playwright/test';

// Marketing pages that exist in frontend/src/app/(marketing)/. Keep this
// list in sync with that directory; pages added there should be screenshot
// targets here so chrome drift gets caught.
const PAGES = [
  '/',
  '/features',
  '/pricing',
  '/docs',
  '/about',
  '/contact',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const path of PAGES) {
  for (const vp of VIEWPORTS) {
    const slug = path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '_');
    test(`marketing ${path} — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(path, { waitUntil: 'networkidle' });
      // Settle webfonts + lazy images. networkidle alone fires before
      // font-display:swap finishes painting in some browsers.
      await page.waitForTimeout(2000);
      await expect(page).toHaveScreenshot(`${slug}-${vp.name}.png`, {
        // 0.5% tolerance — enough to absorb subpixel font rendering
        // jitter between CI runs, tight enough to catch real layout
        // shifts (a misaligned button is ~1-2% of the viewport).
        maxDiffPixelRatio: 0.005,
        fullPage: true,
      });
    });
  }
}
