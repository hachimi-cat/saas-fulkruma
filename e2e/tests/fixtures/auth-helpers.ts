import type { Page } from '@playwright/test';

// Public-https staging. CI sets FRONTEND_URL (the e2e-staging job runs
// against https://staging-fulkruma.forjio.com); BACKEND_URL defaults to the
// same host's /api/v1. These defaults point at the public staging host so a
// bare local run hits the right place too.
const FRONTEND_URL =
  process.env.FRONTEND_URL || 'https://staging-fulkruma.forjio.com';
const API_BASE =
  process.env.BACKEND_URL || `${FRONTEND_URL.replace(/\/+$/, '')}/api/v1`;
const E2E_BYPASS_SECRET = process.env.E2E_BYPASS_SECRET || '';

// Hostname (no port) of the FRONTEND_URL — the fulkruma_session cookie has to
// be set on this domain for browser-context fetches to send it. Default
// mirrors the playwright config baseURL.
function frontendHostname(): string {
  try {
    return new URL(FRONTEND_URL).hostname;
  } catch {
    return 'staging-fulkruma.forjio.com';
  }
}

// Whether the frontend is served over https — the staging cookie carries the
// Secure flag there, so the planted cookie must match or the browser drops it.
function frontendIsHttps(): boolean {
  try {
    return new URL(FRONTEND_URL).protocol === 'https:';
  } catch {
    return true;
  }
}

/** Build headers with optional rate-limit bypass for E2E. The bypass secret
 *  is currently INERT on fulkruma staging (no consumer) — sending the header
 *  is harmless and forward-compatible if a consumer is wired later. */
export function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (E2E_BYPASS_SECRET) h['x-e2e-bypass'] = E2E_BYPASS_SECRET;
  return h;
}

export interface TestAuth {
  user: { id: string; name: string; email: string };
  /** Raw `fulkruma_session=...` cookie value returned by /auth/signup.
   *  fulkruma is an OIDC BFF on @forjio/sdk/auth-server but exposes ROPC
   *  /auth/{signup,login}; these are cookie-only — the response body is just
   *  {data:{signedUp,role}}, no token, no user. The session IS the cookie. */
  sessionCookie: string;
}

type MeUser = { id: string; name: string; email: string };

/** Poll GET /auth/me with the session cookie until it returns the user, or
 *  give up after ~5s. Catches the post-signup window where the backend has
 *  responded but the session isn't queryable yet, which would race the
 *  browser planting + dashboard nav and bounce the page to /login mid-test. */
async function waitForSessionLive(sessionCookie: string): Promise<MeUser | null> {
  const deadline = Date.now() + 5000;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: apiHeaders({ cookie: `fulkruma_session=${sessionCookie}` }),
      });
      lastStatus = res.status;
      if (res.ok) {
        const json = await res.json();
        const user = json?.data?.user;
        if (user?.id) {
          return { id: user.id, name: user.name, email: user.email };
        }
      }
    } catch {
      // network blip — retry
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  console.warn(`[auth-helper] /auth/me never returned a user within 5s; last status=${lastStatus}`);
  return null;
}

/** Register a unique test user via the real staging API (with retry for rate
 *  limits). Keeps a small cooldown between signups — the bypass is inert here
 *  so the ROPC route's own throttle still applies. */
export async function registerTestUser(
  prefix = 'e2e',
  retries = 8,
): Promise<TestAuth> {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({
        name: `E2E ${prefix} Test`,
        email: `${prefix}-${uid}-${attempt}@test.com`,
        password: 'TestPass123!',
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      // Small cooldown between registrations to stay under the ROPC throttle.
      await new Promise((r) => setTimeout(r, 1500));
      const setCookie = res.headers.get('set-cookie') ?? '';
      const m = /fulkruma_session=([^;]+)/.exec(setCookie);
      const sessionCookie = m ? m[1] : undefined;
      if (!sessionCookie) {
        throw new Error(
          `Signup succeeded but no fulkruma_session cookie in Set-Cookie: ${setCookie}`,
        );
      }
      const user = await waitForSessionLive(sessionCookie);
      if (!user) {
        throw new Error(
          'Signup succeeded but GET /auth/me never returned a user within 5s — session not live',
        );
      }
      return { user, sessionCookie };
    }
    if (
      (json?.error?.code === 'RATE_LIMITED' || res.status === 429) &&
      attempt < retries
    ) {
      await new Promise((r) => setTimeout(r, 3000 * Math.pow(2, attempt)));
      continue;
    }
    throw new Error(`Signup failed: ${JSON.stringify(json)}`);
  }
  throw new Error('Signup failed: max retries exceeded');
}

/**
 * Plant the fulkruma_session cookie on the browser context and navigate to a
 * page. The frontend is cookie-first (axios withCredentials), so the cookie
 * must exist before any page JS runs.
 */
export async function authenticateAndNavigate(
  page: Page,
  auth: TestAuth,
  path: string,
) {
  await page.context().addCookies([{
    name: 'fulkruma_session',
    value: auth.sessionCookie,
    domain: frontendHostname(),
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: frontendIsHttps(),
  }]);
  if (E2E_BYPASS_SECRET) {
    await page.context().setExtraHTTPHeaders({ 'x-e2e-bypass': E2E_BYPASS_SECRET });
  }
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
}
