import { test, expect } from '@playwright/test';
import { registerTestUser } from './fixtures/auth-helpers';

// The login/signup pages render the shared @forjio/auth-ui <AuthForm>.
// That component renders visible <label>Email</label>/<label>Password</label>
// elements that are NOT associated with their inputs (no htmlFor/id), so
// page.getByLabel() can't match them. Select the inputs by type instead, and
// the submit/nav by their accessible names. Empty-submit is guarded by HTML5
// `required` (no custom "please fill in all fields" copy).
const emailInput = (page: import('@playwright/test').Page) =>
  page.locator('form input[type="email"]');
const passwordInput = (page: import('@playwright/test').Page) =>
  page.locator('form input[type="password"]');

const E2E_BYPASS_SECRET = process.env.E2E_BYPASS_SECRET || '';

test.describe('Authentication Flow', () => {
  // Inject the rate-limit bypass header on the browser context so the in-page
  // /auth/me probe the dashboard guard runs after a UI login/signup isn't
  // throttled. The bypass is currently inert on fulkruma staging (no
  // consumer), but sending it is harmless and mirrors authenticateAndNavigate().
  test.beforeEach(async ({ page }) => {
    if (E2E_BYPASS_SECRET) {
      await page.context().setExtraHTTPHeaders({ 'x-e2e-bypass': E2E_BYPASS_SECRET });
    }
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/login');
    await expect(emailInput(page)).toBeVisible({ timeout: 15_000 });
    await expect(passwordInput(page)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /sign in/i }),
    ).toBeVisible();
  });

  test('should block submit with empty required fields', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('button', { name: /sign in/i }),
    ).toBeVisible({ timeout: 15_000 });

    // auth-ui relies on native HTML5 validation: the email input is
    // `required`, so an empty submit is blocked by the browser and the form
    // never POSTs / navigates. Assert the constraint is enforced (input
    // reports invalid) and the page stays on /login.
    await page.getByRole('button', { name: /sign in/i }).click();

    const emailValid = await emailInput(page).evaluate(
      (el: HTMLInputElement) => el.checkValidity(),
    );
    expect(emailValid).toBe(false);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should navigate between login and signup', async ({ page }) => {
    await page.goto('/login');

    // auth-ui's switch link is a "Sign up" link inside the form card whose
    // href carries a return_to query param (e.g. /signup?return_to=%2Fdashboard).
    await expect(
      page.locator('a[href^="/signup"]', { hasText: /sign up/i }),
    ).toBeVisible({ timeout: 15_000 });
    await page.locator('a[href^="/signup"]', { hasText: /sign up/i }).click();
    await expect(page).toHaveURL(/\/signup/, { timeout: 10_000 });

    await expect(
      page.locator('a[href^="/login"]', { hasText: /sign in/i }),
    ).toBeVisible({ timeout: 15_000 });
    await page.locator('a[href^="/login"]', { hasText: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('should redirect to dashboard after login', async ({ page }) => {
    // Register a real user via the staging API, then sign in via the UI.
    const auth = await registerTestUser('auth-login');
    const password = 'TestPass123!';

    await page.goto('/login');
    await expect(emailInput(page)).toBeVisible({ timeout: 15_000 });
    await emailInput(page).fill(auth.user.email);
    await passwordInput(page).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Regression guard: after AuthForm sets the cookie it does a client-side
    // router.push('/dashboard'); a stale client auth singleton would bounce
    // back to /login. fulkruma is verified SAFE, so this must land on /dashboard.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test('should redirect to dashboard after signup', async ({ page }) => {
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `e2e-signup-${uid}@test.com`;

    // auth-ui signup form: email + password (min 10 chars) + an optional
    // "Your name" text field. No confirm-password, no terms checkbox.
    await page.goto('/signup');
    await expect(emailInput(page)).toBeVisible({ timeout: 15_000 });

    const nameInput = page.locator('form input[type="text"]');
    if (await nameInput.count()) {
      await nameInput.first().fill('E2E Signup Test');
    }
    await emailInput(page).fill(email);
    await passwordInput(page).fill('TestPass123!');
    await page.getByRole('button', { name: /create account/i }).click();

    // Regression guard (the bounce class): real UI signup must land on
    // /dashboard, NOT be bounced back to /login by a stale auth singleton.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });
});
