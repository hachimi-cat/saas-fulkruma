import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { ok, err } from '@forjio/sdk/http';
import {
  buildAuthorizeUrl,
  exchangeCode,
  passwordGrant,
  signupGrant,
  fetchAccount,
  fetchWorkspaceIds,
  generateCodeVerifier,
  codeChallengeFor,
  generateState,
  HUUDIS_ISSUER,
} from '../services/huudis.js';
import { createSession, lookupSession, SESSION_COOKIE } from '../services/auth-store.js';

// BFF migration (F-AUTH): the Huudis SSO routes for the Fulkruma
// backend. Replaces the frontend's lib/server/huudis.ts + the
// api/v1/auth/* route handlers. Ported from saas-plugipay's
// routes/auth.ts (the canonical BFF reference).

const router = Router();

const OIDC_STATE_COOKIE = 'fulkruma_oidc_state';
const STATE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SECURE = process.env.NODE_ENV === 'production';
const STATE_SECRET =
  process.env.OIDC_SIGNING_SECRET ??
  process.env.HUUDIS_CLIENT_SECRET ??
  'dev-only-fallback-oidc-secret';

// Single-user gate (optional): if HUUDIS_ALLOWED_USER_IDS (plural,
// comma-separated) or HUUDIS_ALLOWED_USER_ID (singular) is set, only
// those Huudis subs may sign in — preserves Fulkruma's current
// allowlist (the old frontend config read both env names). Empty/unset
// = open (multi-tenant).
const ALLOWED_USER_IDS = [
  process.env.HUUDIS_ALLOWED_USER_IDS ?? '',
  process.env.HUUDIS_ALLOWED_USER_ID ?? '',
]
  .join(',')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith('REPLACE_ME'));
function gateUser(sub: string): boolean {
  return ALLOWED_USER_IDS.length === 0 || ALLOWED_USER_IDS.includes(sub);
}

const rid = (req: Request) => req.requestId ?? 'req_unknown';

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return undefined;
}

// Per-request origin — fulkruma.com + fulkruma.forjio.com share one
// backend; the OIDC state cookie is host-scoped, so compute the origin
// from the inbound request rather than pinning it to env.
function originOf(req: Request): string {
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ||
    req.protocol ||
    'https';
  const host =
    (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() ||
    req.get('host') ||
    'fulkruma.com';
  return `${proto}://${host}`;
}
function redirectUriFor(req: Request): string {
  return `${originOf(req)}/api/v1/auth/huudis/callback`;
}

interface OidcState {
  state: string;
  codeVerifier: string;
  returnTo: string;
  expiresAt: number;
}
function signState(s: OidcState): string {
  const payload = Buffer.from(JSON.stringify(s)).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyState(token: string | undefined): OidcState | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString()) as OidcState;
    return Date.now() > s.expiresAt ? null : s;
  } catch {
    return null;
  }
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

/** Resolve the Huudis identity, gate it, and mint a Fulkruma session. */
async function mintSession(tokens: {
  access_token: string;
  refresh_token?: string;
}): Promise<{ token: string } | { error: string }> {
  const account = await fetchAccount(tokens.access_token);
  if (!account.id || !account.email) return { error: 'HUUDIS_ACCOUNT_INCOMPLETE' };
  if (!gateUser(account.id)) return { error: 'NOT_AUTHORIZED' };
  const accountIds = await fetchWorkspaceIds(tokens.access_token);
  const token = createSession({
    name: account.name || account.email,
    email: account.email,
    huudisSub: account.id,
    huudisAccessToken: tokens.access_token,
    huudisRefreshToken: tokens.refresh_token,
    accountIds,
  });
  return { token };
}

// ─── OIDC code flow ──────────────────────────────────────────────────
router.get('/huudis/start', (req, res) => {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const rawReturn = String(req.query.return_to ?? '/dashboard').trim();
  const returnTo = rawReturn.startsWith('/') ? rawReturn : '/dashboard';
  const provider = String(req.query.provider ?? '').toLowerCase();
  const idpHint = provider === 'google' || provider === 'apple' ? provider : undefined;

  res.cookie(
    OIDC_STATE_COOKIE,
    signState({ state, codeVerifier, returnTo, expiresAt: Date.now() + STATE_TTL_MS }),
    { httpOnly: true, secure: SECURE, sameSite: 'lax', maxAge: STATE_TTL_MS, path: '/' },
  );
  return res.redirect(
    buildAuthorizeUrl({
      state,
      codeChallenge: codeChallengeFor(codeVerifier),
      redirectUri: redirectUriFor(req),
      idpHint,
    }),
  );
});

router.get('/huudis/callback', async (req, res, next) => {
  try {
    const { code, state, error, error_description } = req.query as Record<
      string,
      string | undefined
    >;
    const appUrl = originOf(req);
    if (error) {
      return res.redirect(
        `${appUrl}/login?sso_error=${encodeURIComponent(error)}` +
          (error_description ? `&sso_detail=${encodeURIComponent(error_description)}` : ''),
      );
    }
    if (!code || !state) return res.redirect(`${appUrl}/login?sso_error=missing_code`);

    const stored = verifyState(parseCookie(req.headers.cookie, OIDC_STATE_COOKIE));
    res.clearCookie(OIDC_STATE_COOKIE, { path: '/' });
    if (!stored || stored.state !== state) {
      return res.redirect(`${appUrl}/login?sso_error=invalid_state`);
    }

    const tokens = await exchangeCode({
      code,
      codeVerifier: stored.codeVerifier,
      redirectUri: redirectUriFor(req),
    });
    const minted = await mintSession(tokens);
    if ('error' in minted) {
      return res.redirect(`${appUrl}/login?sso_error=${encodeURIComponent(minted.error)}`);
    }
    setSessionCookie(res, minted.token);
    return res.redirect(`${appUrl}${stored.returnTo}`);
  } catch (e) {
    next(e);
  }
});

// ─── Native email + password (Huudis ROPC + signup grant) ────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (!email || !password) {
      return res
        .status(400)
        .json(err('VALIDATION_ERROR', 'email and password are required', rid(req)));
    }
    let tokens;
    try {
      tokens = await passwordGrant(String(email).toLowerCase().trim(), String(password));
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('mfa_required')) {
        return res
          .status(401)
          .json(err('MFA_REQUIRED', 'MFA enabled — sign in via the Huudis flow.', rid(req)));
      }
      return res
        .status(401)
        .json(
          err(
            'INVALID_CREDENTIALS',
            msg.replace(/^.*?:\s*/, '') || 'incorrect email or password',
            rid(req),
          ),
        );
    }
    const minted = await mintSession(tokens);
    if ('error' in minted) {
      return res.status(403).json(err(minted.error, 'access is restricted', rid(req)));
    }
    setSessionCookie(res, minted.token);
    return res.json(ok({ signedIn: true }, rid(req)));
  } catch (e) {
    next(e);
  }
});

router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name } = (req.body ?? {}) as {
      email?: string;
      password?: string;
      name?: string;
    };
    if (!email || !password) {
      return res
        .status(400)
        .json(err('VALIDATION_ERROR', 'email and password are required', rid(req)));
    }
    if (password.length < 10) {
      return res
        .status(400)
        .json(err('WEAK_PASSWORD', 'password must be at least 10 characters', rid(req)));
    }
    let tokens;
    try {
      tokens = await signupGrant(
        String(email).toLowerCase().trim(),
        String(password),
        name ? String(name).trim() : undefined,
      );
    } catch (e) {
      return res
        .status(400)
        .json(
          err(
            'SIGNUP_FAILED',
            (e as Error).message.replace(/^.*?:\s*/, '') || 'could not create account',
            rid(req),
          ),
        );
    }
    const minted = await mintSession(tokens);
    if ('error' in minted) {
      return res.status(403).json(err(minted.error, 'access is restricted', rid(req)));
    }
    setSessionCookie(res, minted.token);
    return res.json(ok({ signedUp: true }, rid(req)));
  } catch (e) {
    next(e);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  return res.json(ok({ signedOut: true }, rid(req)));
});

// GET /auth/me — the thin frontend useAuth() calls this. Resolves the
// session cookie; never refreshes (the Huudis token is only needed for
// the IAM proxy, which refreshes reactively).
router.get('/me', (req, res) => {
  const session = lookupSession(parseCookie(req.headers.cookie, SESSION_COOKIE));
  if (!session) {
    return res.status(401).json(err('UNAUTHORIZED', 'no active session', rid(req)));
  }
  return res.json(
    ok(
      {
        user: {
          id: session.accountId,
          name: session.name,
          email: session.email,
          huudisUserId: session.huudisSub,
        },
      },
      rid(req),
    ),
  );
});

// ─── Password reset — proxied to Huudis (identity + email live there) ─
router.post('/password-reset/request', async (req, res, next) => {
  try {
    const { email } = (req.body ?? {}) as { email?: string };
    if (!email) {
      return res.status(400).json(err('VALIDATION_ERROR', 'email is required', rid(req)));
    }
    await fetch(`${HUUDIS_ISSUER}/api/v1/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(email).toLowerCase().trim() }),
    });
    // Huudis always 200s to prevent email enumeration — mirror that.
    return res.json(ok({ sent: true }, rid(req)));
  } catch (e) {
    next(e);
  }
});

router.post('/password-reset/complete', async (req, res, next) => {
  try {
    const { token, password } = (req.body ?? {}) as { token?: string; password?: string };
    if (!token || !password) {
      return res
        .status(400)
        .json(err('VALIDATION_ERROR', 'token and password are required', rid(req)));
    }
    if (password.length < 10) {
      return res
        .status(400)
        .json(err('WEAK_PASSWORD', 'password must be at least 10 characters', rid(req)));
    }
    const upstream = await fetch(`${HUUDIS_ISSUER}/api/v1/auth/password-reset/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json(err('INVALID_TOKEN', 'reset failed', rid(req)));
    }
    return res.json(ok({ reset: true }, rid(req)));
  } catch (e) {
    next(e);
  }
});

export default router;
