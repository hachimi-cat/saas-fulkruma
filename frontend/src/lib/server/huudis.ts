import 'server-only';
import crypto from 'node:crypto';
import { config } from './config';

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
  idpHint?: 'google' | 'apple';
  redirectUri?: string;
}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.huudis.clientId(),
    redirect_uri: opts.redirectUri ?? config.portal.redirectUri(),
    scope: 'openid profile email fulkruma:admin',
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
  });
  if (opts.idpHint) params.set('idp_hint', opts.idpHint);
  return `${config.huudis.issuer()}/api/v1/oidc/authorize?${params.toString()}`;
}

export async function exchangeCode(opts: {
  code: string;
  codeVerifier: string;
  redirectUri?: string;
}): Promise<HuudisTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri ?? config.portal.redirectUri(),
    client_id: config.huudis.clientId(),
    client_secret: config.huudis.clientSecret(),
    code_verifier: opts.codeVerifier,
  });
  const res = await fetch(`${config.huudis.issuer()}/api/v1/oidc/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`huudis token exchange ${res.status}: ${text}`);
  }
  return (await res.json()) as HuudisTokens;
}

async function rawRefreshAccessToken(refreshToken: string): Promise<HuudisTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.huudis.clientId(),
    client_secret: config.huudis.clientSecret(),
  });
  const res = await fetch(`${config.huudis.issuer()}/api/v1/oidc/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`huudis refresh ${res.status}: ${text}`);
  }
  return (await res.json()) as HuudisTokens;
}

// In-process single-flight cache. Huudis rotates refresh tokens AND
// revokes the entire token family on reuse detection (saas-huudis/
// backend/src/services/oidc.ts:refreshTokens). When two concurrent
// requests in the same Next.js process try to refresh with the same
// token, only the first succeeds — the second arrives at Huudis after
// rotation, looks like a stolen token, and nukes every active session
// for the user. Symptom: user gets logged out unexpectedly. Pawpado
// hit this most often because its dashboard polls every 5s from two
// components; plugipay never hit it because plugipay doesn't poll.
//
// Dedup keyed by refresh-token value. Cache the resolved promise (in
// either success or failure) for ~2s so concurrent callers all wait
// on the same Huudis call. After that the entry is dropped so the
// next genuine refresh attempt isn't blocked.
const _refreshInFlight = new Map<string, Promise<HuudisTokens>>();
const REFRESH_CACHE_MS = 2_000;

export async function refreshAccessToken(refreshToken: string): Promise<HuudisTokens> {
  const cached = _refreshInFlight.get(refreshToken);
  if (cached) return cached;
  const promise = rawRefreshAccessToken(refreshToken);
  _refreshInFlight.set(refreshToken, promise);
  void promise.finally(() => {
    setTimeout(() => {
      if (_refreshInFlight.get(refreshToken) === promise) {
        _refreshInFlight.delete(refreshToken);
      }
    }, REFRESH_CACHE_MS);
  });
  return promise;
}

export function decodeIdToken(idToken: string): IdTokenClaims {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('malformed id_token');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  return payload as IdTokenClaims;
}

export async function fetchAccount(accessToken: string): Promise<HuudisAccount> {
  const res = await fetch(`${config.huudis.issuer()}/api/v1/account`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`huudis /account ${res.status}: ${text}`);
  }
  const body = (await res.json()) as
    | HuudisAccount
    | { data: HuudisAccount; error: unknown; meta?: unknown };
  if (body && typeof body === 'object' && 'data' in body && body.data) {
    return body.data;
  }
  return body as HuudisAccount;
}
