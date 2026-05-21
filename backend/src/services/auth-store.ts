import crypto from 'node:crypto';

// BFF migration (F-AUTH): server-side session store for the Fulkruma
// Backend-For-Frontend. The Express backend is the confidential OAuth
// client — it holds the Huudis tokens and issues the browser only this
// opaque, HMAC-signed session token (the `fulkruma_session` cookie).
//
// Ported from saas-plugipay's auth-store (the canonical BFF reference),
// adapted to Fulkruma's accountId convention: single-user Fulkruma uses
// the Huudis `sub` directly as the accountId (see middleware/auth.ts),
// so we do NOT hash a derived id like Plugipay does.

export interface FulkrumaSession {
  accountId: string;
  email: string;
  name: string;
  huudisSub: string;
  huudisAccessToken?: string;
  huudisRefreshToken?: string;
  // Workspace account-ids the user is a member of, membership-checked
  // at mint time. The `fulkruma_active_workspace` override cookie is
  // validated against this list — without it any logged-in user could
  // set the cookie to an arbitrary acc_* and act as that workspace's
  // owner (horizontal privilege escalation).
  accountIds?: string[];
}

interface SignedPayload extends FulkrumaSession {
  expiresAt: number; // epoch ms
}

export const SESSION_COOKIE = 'fulkruma_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SECRET =
  process.env.SESSION_SIGNING_SECRET
  ?? process.env.HUUDIS_CLIENT_SECRET
  ?? 'dev-only-fallback-session-secret';

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export interface MintSessionInput {
  name: string;
  email: string;
  huudisSub: string;
  huudisAccessToken?: string;
  huudisRefreshToken?: string;
  /** Huudis workspace account-ids the user belongs to (membership-checked). */
  accountIds?: string[];
}

/**
 * Mint a stateless HMAC-signed session token. Stateless ⇒ survives
 * backend restarts and scales across workers — no server-side session
 * table to keep in sync.
 */
export function createSession(input: MintSessionInput): string {
  // Single-user Fulkruma: the Huudis sub IS the accountId (matches
  // middleware/auth.ts Path 3 + the portal's X-Fulkruma-Account-Id).
  const accountId = input.huudisSub;
  const accountIds = Array.from(new Set([accountId, ...(input.accountIds ?? [])]));
  const payload: SignedPayload = {
    accountId,
    email: input.email,
    name: input.name,
    huudisSub: input.huudisSub,
    huudisAccessToken: input.huudisAccessToken,
    huudisRefreshToken: input.huudisRefreshToken,
    accountIds,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  const body = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = base64url(crypto.createHmac('sha256', SECRET).update(body).digest());
  return `${body}.${sig}`;
}

export function lookupSession(token: string | undefined): FulkrumaSession | undefined {
  if (!token) return undefined;
  const parts = token.split('.');
  if (parts.length !== 2) return undefined;
  const [body, sig] = parts as [string, string];
  const expected = base64url(crypto.createHmac('sha256', SECRET).update(body).digest());
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return undefined;
  } catch {
    return undefined;
  }
  let parsed: SignedPayload;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64').toString()) as SignedPayload;
  } catch {
    return undefined;
  }
  if (!parsed.expiresAt || Date.now() > parsed.expiresAt) return undefined;
  return {
    accountId: parsed.accountId,
    email: parsed.email,
    name: parsed.name,
    huudisSub: parsed.huudisSub,
    huudisAccessToken: parsed.huudisAccessToken,
    huudisRefreshToken: parsed.huudisRefreshToken,
    accountIds: parsed.accountIds,
  };
}
