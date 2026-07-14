import { test, expect, type Page } from '@playwright/test';
import {
  registerTestUser,
  authenticateAndNavigate,
  apiHeaders,
  type TestAuth,
} from './fixtures/auth-helpers';

/**
 * Authenticated dashboard gate.
 *
 * auth.spec.ts only proves the browser LANDS on /dashboard. A dashboard whose
 * every API call 500s still has that URL, so that assertion passes against a
 * completely dead backend. This spec closes that hole.
 *
 * The overview page (frontend/src/app/(dashboard)/dashboard/page.tsx) calls
 * GET /api/v1/stats/overview and renders `recent.movements[].variantId` and
 * `recent.movements[].warehouse.name` verbatim into the "Recent movements"
 * card. Both strings are minted fresh here (timestamp + random suffix) and
 * written through the real authenticated API in beforeAll, so they exist
 * NOWHERE in the client bundle. The browser can only paint them by making a
 * successful, cookie-authenticated GET /stats/overview and reading THIS
 * account's rows out of the response. A dead backend, a 401, or a
 * cross-account leak all render "No movements yet." instead — which is exactly
 * what the negative control confirms.
 */

const FRONTEND_URL =
  process.env.FRONTEND_URL || 'https://staging-fulkruma.forjio.com';
const API_BASE =
  process.env.BACKEND_URL || `${FRONTEND_URL.replace(/\/+$/, '')}/api/v1`;

// Run-unique identifiers. Regenerated per run, so a cached/stale page or a
// hard-coded fixture cannot satisfy the assertions.
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const WAREHOUSE_NAME = `E2E Warehouse ${RUN_ID}`;
const VARIANT_ID = `E2EVAR-${RUN_ID}`;
const STOCK_DELTA = 7;

let auth: TestAuth;
let warehouseId: string;

/** Small typed wrapper over the real staging API, authenticated by the session
 *  cookie the signup handed us — the same credential the browser will carry. */
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: apiHeaders({ cookie: `fulkruma_session=${auth.sessionCookie}` }),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`POST ${path} failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json.data as T;
}

/** Fail the test on ANY console error or uncaught page exception. Must be
 *  wired BEFORE the first navigation or early errors are missed. */
function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

test.describe('Authenticated dashboard', () => {
  test.beforeAll(async () => {
    // Fresh user => empty account. Everything the dashboard shows below has to
    // come from rows we create here, through the real authenticated API.
    auth = await registerTestUser('dash');

    const wh = await apiPost<{ warehouse: { id: string; name: string } }>(
      '/warehouses',
      { name: WAREHOUSE_NAME, city: 'Jakarta' },
    );
    warehouseId = wh.warehouse.id;
    expect(wh.warehouse.name).toBe(WAREHOUSE_NAME);

    // Produces a StockMovement, which is what /stats/overview surfaces under
    // recent.movements — the payload the overview card renders.
    await apiPost('/stock/adjust', {
      variantId: VARIANT_ID,
      warehouseId,
      delta: STOCK_DELTA,
      reason: 'initial_stock',
    });
  });

  test('overview renders account data that only a successful authenticated API call can produce', async ({
    page,
  }) => {
    const consoleErrors = captureConsoleErrors(page);

    await authenticateAndNavigate(page, auth, '/dashboard');

    // Still authenticated — not bounced to /login.
    await expect(page).toHaveURL(/\/dashboard/);

    // The page's own failure path. If /stats/overview errored, this banner is
    // what renders instead of the data below.
    await expect(
      page.getByText(/Failed to load overview/i),
    ).toHaveCount(0);

    // THE LOAD-BEARING ASSERTION.
    // Both strings were minted at runtime and written through the API above.
    // They are not in the bundle, not in any fixture, not in the HTML shell —
    // the only way they reach the DOM is a 200 from GET /stats/overview
    // carrying THIS account's stock movement.
    await expect(page.getByText(VARIANT_ID, { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText(WAREHOUSE_NAME, { exact: false }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // Signed delta from the same response, rendered by the movements row.
    await expect(page.getByText(`+${STOCK_DELTA}`, { exact: true })).toBeVisible();

    // Counter tiles are computed server-side from this account's rows. On a
    // dead backend `value` is undefined and each tile renders a spinner; on a
    // live-but-empty account they are 0. Exactly 1 warehouse + 1 SKU proves a
    // real, account-scoped aggregate came back.
    // NOTE: filter by the tile's own label — the sidebar nav also links to
    // these hrefs, and an unfiltered locator resolves to the nav link first.
    await expect(
      page
        .locator('a[href="/dashboard/warehouses"]')
        .filter({ hasText: 'Active warehouses' }),
    ).toContainText('1');
    await expect(
      page
        .locator('a[href="/dashboard/stock"]')
        .filter({ hasText: 'SKUs tracked' }),
    ).toContainText('1');

    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('warehouses page lists the run-unique warehouse created via the API', async ({
    page,
  }) => {
    const consoleErrors = captureConsoleErrors(page);

    await authenticateAndNavigate(page, auth, '/dashboard/warehouses');
    await expect(page).toHaveURL(/\/dashboard\/warehouses/);

    // Same argument: this name cannot be rendered without a 200 from the
    // authenticated GET /warehouses for this session.
    await expect(page.getByText(WAREHOUSE_NAME).first()).toBeVisible({
      timeout: 20_000,
    });

    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
  });
});
