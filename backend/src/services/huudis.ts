import crypto from 'node:crypto';

// BFF migration (F-AUTH): the Huudis OIDC client for the Fulkruma
// backend. The OIDC client belongs in the backend now — the
// confidential client_secret and the refresh tokens never reach the
// browser. Ported from the (to-be-removed) frontend lib/server/huudis.ts.

const HUUDIS_ISSUER = process.env.HUUDIS_ISSUER ?? 'https://huudis.com';
const HUUDIS_CLIENT_ID = process.env.HUUDIS_CLIENT_ID ?? 'fulkruma';
const HUUDIS_CLIENT_SECRET = process.env.HUUDIS_CLIENT_SECRET ?? '';
const SCOPE = 'openid profile email fulkruma:admin';

export interface HuudisTokens {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
}

export interface HuudisAccount {
  id: string;
  email: string;
  name: string;
  emailVerified?: boolean;
}

export interface IdTokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  email?: string;
  name?: string;
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}
export function codeChallengeFor(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}
export function generateState(): string {
  return crypto.randomBytes(16).toString('base64url');
}

export function buildAuthorizeUrl(opts: {
  state: string;
  codeChallenge: string;
  redirectUri: string;
  idpHint?: 'google' | 'apple';
}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: HUUDIS_CLIENT_ID,
    redirect_uri: opts.redirectUri,
    scope: SCOPE,
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
  });
  if (opts.idpHint) params.set('idp_hint', opts.idpHint);
  return `${HUUDIS_ISSUER}/api/v1/oidc/authorize?${params.toString()}`;
}

export async function exchangeCode(opts: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<HuudisTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: HUUDIS_CLIENT_ID,
    client_secret: HUUDIS_CLIENT_SECRET,
    code_verifier: opts.codeVerifier,
  });
  const res = await fetch(`${HUUDIS_ISSUER}/api/v1/oidc/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`huudis token exchange ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as HuudisTokens;
}

// ─── Native email+password — Huudis ROPC + the Forjio signup grant ───
async function tokenRequest(extra: Record<string, string>): Promise<HuudisTokens> {
  const body = new URLSearchParams({
    client_id: HUUDIS_CLIENT_ID,
    client_secret: HUUDIS_CLIENT_SECRET,
    ...extra,
  });
  const res = await fetch(`${HUUDIS_ISSUER}/api/v1/oidc/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  });
  const text = await res.text();
  let parsed: { access_token?: string; error?: string; error_description?: string } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  if (!res.ok || !parsed.access_token) {
    throw new Error(
      `${parsed.error ?? `http_${res.status}`}: ${parsed.error_description ?? text.slice(0, 200)}`,
    );
  }
  return parsed as unknown as HuudisTokens;
}

export async function passwordGrant(email: string, password: string): Promise<HuudisTokens> {
  return tokenRequest({ grant_type: 'password', username: email, password, scope: SCOPE });
}

export async function signupGrant(
  email: string,
  password: string,
  name?: string,
): Promise<HuudisTokens> {
  return tokenRequest({
    grant_type: 'urn:forjio:grant-type:signup',
    email,
    password,
    scope: SCOPE,
    ...(name ? { name } : {}),
  });
}

async function rawRefreshAccessToken(refreshToken: string): Promise<HuudisTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: HUUDIS_CLIENT_ID,
    client_secret: HUUDIS_CLIENT_SECRET,
  });
  const res = await fetch(`${HUUDIS_ISSUER}/api/v1/oidc/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`huudis refresh ${res.status}: ${await res.text()}`);
  return (await res.json()) as HuudisTokens;
}

// Two-layer cache vs Huudis's refresh-token-family reuse detection:
// Huudis rotates the refresh token AND revokes the whole family on
// reuse. Layer 1 dedups strictly-concurrent refreshes; layer 2 aliases
// an already-rotated token to its result for 5 min, so a late arrival
// still carrying the pre-rotation token doesn't nuke the family.
const _refreshInFlight = new Map<string, Promise<HuudisTokens>>();
const _rotatedTokens = new Map<string, HuudisTokens>();
const REFRESH_CACHE_MS = 2_000;
const ROTATED_TOKEN_TTL_MS = 5 * 60 * 1000;

export async function refreshAccessToken(refreshToken: string): Promise<HuudisTokens> {
  const aliased = _rotatedTokens.get(refreshToken);
  if (aliased) return aliased;
  const cached = _refreshInFlight.get(refreshToken);
  if (cached) return cached;
  const promise = rawRefreshAccessToken(refreshToken);
  _refreshInFlight.set(refreshToken, promise);
  promise
    .then((tokens) => {
      _rotatedTokens.set(refreshToken, tokens);
      setTimeout(() => {
        if (_rotatedTokens.get(refreshToken) === tokens) _rotatedTokens.delete(refreshToken);
      }, ROTATED_TOKEN_TTL_MS);
    })
    .catch(() => {
      /* don't cache failures — let the next attempt retry */
    })
    .finally(() => {
      setTimeout(() => {
        if (_refreshInFlight.get(refreshToken) === promise) _refreshInFlight.delete(refreshToken);
      }, REFRESH_CACHE_MS);
    });
  return promise;
}

export function decodeIdToken(idToken: string): IdTokenClaims {
  const payload = idToken.split('.')[1];
  if (!payload) throw new Error('malformed id_token');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as IdTokenClaims;
}

export async function fetchAccount(accessToken: string): Promise<HuudisAccount> {
  const res = await fetch(`${HUUDIS_ISSUER}/api/v1/account`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`huudis /account ${res.status}`);
  const body = (await res.json()) as HuudisAccount | { data: HuudisAccount };
  return body && typeof body === 'object' && 'data' in body && body.data
    ? body.data
    : (body as HuudisAccount);
}

/** Workspace account-ids the user belongs to — membership-checked, so
 *  the active-workspace override cookie can be validated against it. */
export async function fetchWorkspaceIds(accessToken: string): Promise<string[]> {
  try {
    const res = await fetch(`${HUUDIS_ISSUER}/api/v1/account/workspaces`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const body = (await res.json().catch(() => null)) as
      | { data?: Array<{ id?: unknown }> }
      | Array<{ id?: unknown }>
      | null;
    const list = Array.isArray(body) ? body : (body?.data ?? []);
    return list
      .map((w) => (typeof w?.id === 'string' ? w.id : null))
      .filter((id): id is string => !!id && /^acc_/.test(id));
  } catch {
    return [];
  }
}

export { HUUDIS_ISSUER, HUUDIS_CLIENT_ID, HUUDIS_CLIENT_SECRET };
