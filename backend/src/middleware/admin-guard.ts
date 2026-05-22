/**
 * Guard for Fulkruma's admin surface — the partner-billing endpoints
 * under /api/v1/admin (workspace provisioning + partner-usage rollups).
 *
 * Accepts ANY of three credentials, so a single set of routes serves
 * three callers:
 *
 *   1. An `admin`-role BFF session cookie (`fulkruma_admin_session`).
 *      This is the in-fulkruma admin portal — the frontend data proxy
 *      (api/v1/console/[...path]) forwards the cookie + the
 *      `X-Fulkruma-Role: admin` header, which the shared auth-server
 *      kit resolves. The auth config's `gate` already restricted the
 *      cookie to owner/admin members of Fulkruma's Huudis workspace at
 *      sign-in (the `workspace_role` claim), so a present `admin`
 *      session is by definition an authorised admin.
 *
 *   2. The `X-Forjio-Admin-Secret` header matching
 *      `FULKRUMA_FORJIO_ADMIN_SECRET`. The shared-secret path, kept for
 *      a future cross-product admin proxy (mirrors ripllo / plugipay).
 *
 *   3. An HMAC API key carrying the `fulkruma:platform:admin` scope —
 *      the existing partner-billing path (storlaunch / ripllo SDKs).
 *      `requireAuth` resolves the HMAC header into `req.auth`; this
 *      guard then accepts it if the scope is present. This preserves
 *      the pre-existing `requirePlatformAdmin` behaviour exactly.
 *
 * On the admin-session / secret paths it stamps `req.auth` (so handlers
 * can read an actor id) and continues; otherwise 401 / 403.
 */
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { err } from '@forjio/sdk/http';
import { resolveSessionForRequest } from '@forjio/sdk/auth-server';
import { authConfig } from '../auth-config.js';

const issuer = process.env.HUUDIS_ISSUER ?? 'https://huudis.com';
const audience = process.env.HUUDIS_AUDIENCE ?? process.env.FORJIO_SERVICE ?? 'fulkruma';

const PARTNER_ADMIN_SCOPE = 'fulkruma:platform:admin';

function secretMatches(req: Request): boolean {
  const expected = process.env.FULKRUMA_FORJIO_ADMIN_SECRET;
  const got = req.headers['x-forjio-admin-secret'];
  if (!expected || typeof got !== 'string' || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function adminGuard(req: Request, res: Response, next: NextFunction) {
  // Path A — in-fulkruma admin portal: a resolved `admin`-role session.
  const session = resolveSessionForRequest(authConfig, req);
  if (session && session.role === 'admin') {
    req.auth = {
      sub: session.huudisSub,
      accountId: session.accountId,
      scope: '',
      iss: issuer,
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 900,
      iat: Math.floor(Date.now() / 1000),
      role: 'admin',
    } as unknown as Request['auth'];
    return next();
  }

  // Path B — shared-secret cross-product admin proxy.
  if (secretMatches(req)) {
    return next();
  }

  // Path C — legacy partner-billing HMAC: `requireAuth` (run upstream)
  // has already populated `req.auth` from the HMAC key. Accept it iff
  // the key carries the `fulkruma:platform:admin` scope.
  const scope = (req.auth as unknown as { scope?: string })?.scope ?? '';
  if (scope.split(' ').includes(PARTNER_ADMIN_SCOPE)) {
    return next();
  }

  if (req.auth) {
    return res
      .status(403)
      .json(err('FORBIDDEN', 'Platform-admin scope or admin session required', req.requestId ?? 'req_unknown'));
  }
  return res
    .status(401)
    .json(err('AUTH_REQUIRED', 'admin session or secret required', req.requestId ?? 'req_unknown'));
}
