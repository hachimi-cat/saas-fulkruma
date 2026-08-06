import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AuthError, type ForjioClaims } from '@forjio/sdk/auth';
import { err } from '@forjio/sdk/http';
import { ulid } from 'ulid';
import crypto from 'node:crypto';
import { hmacAuth } from './hmac-auth.js';
import { resolveSessionForRequest, parseCookie } from '@forjio/sdk/auth-server';
import { authConfig } from '../auth-config.js';
import {
  DELEGATION_DENIED_PATHS as EMBED_DENIED_PATHS,
  getDelegationSecret,
  verifyDelegationToken,
} from '@forjio/catentio-embed';
import { FULKRUMA_DELEGATION_PREFIX } from '../lib/catentio-profile.js';

/**
 * Allowlist-first: an embedded agent run may reach these prefixes and
 * NOTHING else, whatever the method. These are exactly the resources in
 * FULKRUMA_PROFILE — the setup surfaces. The inventory ledger, in-flight
 * shipments, customer licenses and buyer addresses stay closed.
 */
const DELEGATION_ALLOWED_PATHS = ['/api/v1/warehouses', '/api/v1/products'];

/**
 * Denied BEFORE the allowlist is consulted, so a future allowlist entry
 * can never re-open one of them. The package's floor is INHERITED
 * rather than copied, so a later addition there lands here for free.
 *
 * The variants sub-path sits INSIDE an allowed prefix and needs a regex
 * rather than a prefix: it carries priceCents, and the family has an
 * unsettled inconsistency about whether that column is cents or whole
 * rupiah.
 */
const DELEGATION_DENIED_PATHS = [
  ...EMBED_DENIED_PATHS,
  '/api/v1/stock',
  '/api/v1/shipments',
  '/api/v1/deliveries',
  '/api/v1/licenses',
  '/api/v1/shipping-credits',
  '/api/v1/shipping',
  '/api/v1/addresses',
  '/api/v1/webhooks',
  '/api/v1/audit-log',
  '/api/v1/stats',
  '/api/v1/admin',
  '/api/v1/huudis',
];

const DELEGATION_DENIED_SUBPATHS = [/^\/api\/v1\/products\/[^/]+\/variants(\/|$)/];

declare module 'express-serve-static-core' {
  interface Request {
    auth?: ForjioClaims;
    requestId?: string;
  }
}

const issuer = process.env.HUUDIS_ISSUER ?? 'https://huudis.com';
const audience = process.env.HUUDIS_AUDIENCE ?? process.env.FORJIO_SERVICE ?? 'fulkruma';

/**
 * Auth middleware. Two paths:
 *
 *  1. Internal proxy from the saas-fulkruma portal — header
 *     `X-Fulkruma-Internal-Secret` matches our shared secret. The
 *     portal already authenticated the user via Huudis ROPC + HMAC-
 *     signed session cookie; we trust the accountId it forwards in
 *     `X-Fulkruma-Account-Id`. Constant-time compare on the secret.
 *
 *  2. Direct API call (CLI / SDK / partner) — `Authorization: Bearer
 *     <jwt>` verified against Huudis JWKS via @forjio/sdk. accountId
 *     comes from the JWT's accountId claim, falling back to the
 *     subject (single-user fulkruma uses sub as accountId).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // ─ Path 0: browser session cookie — the BFF path. The Fulkruma
  //   backend is the Huudis OAuth client (@forjio/sdk/auth-server +
  //   ../auth-config); resolve the role session cookie here. Honors
  //   the membership-checked `fulkruma_active_workspace` override.
  const bffSession = resolveSessionForRequest(authConfig, req);
  if (bffSession) {
    const override = parseCookie(req.headers.cookie, 'fulkruma_active_workspace');
    const allowed = bffSession.accountIds ?? [bffSession.accountId];
    const accountId =
      override && /^acc_/.test(override) && allowed.includes(override)
        ? override
        : bffSession.accountId;
    req.auth = {
      sub: bffSession.huudisSub,
      accountId,
      // email/name ride along for the catentio flag allowlist (which
      // matches on either the usr_ id or the address) and for display.
      email: bffSession.email,
      name: bffSession.name,
      scope: '',
      iss: issuer,
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 900,
      iat: Math.floor(Date.now() / 1000),
    } as unknown as ForjioClaims;
    return next();
  }

  // ─ Path 1: portal proxy
  const internalSecret = req.headers['x-fulkruma-internal-secret'] as string | undefined;
  const internalAccountId = req.headers['x-fulkruma-account-id'] as string | undefined;
  const internalUserId = req.headers['x-fulkruma-user-id'] as string | undefined;
  const expectedSecret = process.env.FULKRUMA_INTERNAL_API_SECRET;
  if (internalSecret && expectedSecret) {
    const a = Buffer.from(internalSecret);
    const b = Buffer.from(expectedSecret);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      if (!internalAccountId) {
        return res.status(401).json(err('AUTH_REQUIRED', 'X-Fulkruma-Account-Id missing', req.requestId ?? ulid()));
      }
      // Cast to ForjioClaims-shaped object — only the fields routes actually read.
      req.auth = {
        sub: internalUserId ?? internalAccountId,
        accountId: internalAccountId,
        scope: '',
        iss: issuer,
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 900,
        iat: Math.floor(Date.now() / 1000),
      } as unknown as ForjioClaims;
      return next();
    }
  }

  // ─ Path 1.5: catentio delegation (`Authorization: Delegation <token>`)
  // an embedded agent run acting for a signed-in member (see
  // routes/catentio.ts; token minted there via @forjio/catentio-embed).
  // Ahead of the HMAC and Bearer paths because a delegation header is
  // neither.
  //
  // Review mode mints the token WITHOUT the write bit, and refusing
  // non-GET here is what makes the review step un-promptable: the agent
  // cannot talk its way past an auth layer that never reads what it said.
  const delegationHeader = req.headers.authorization;
  if (delegationHeader?.startsWith('Delegation ')) {
    // requireAuth runs inside mounted routers, where req.path alone is
    // router-relative — match on baseUrl+path or every rule is a no-op.
    const fullPath = `${req.baseUrl || ''}${req.path || ''}`;
    const denied =
      DELEGATION_DENIED_PATHS.some((pth) => fullPath === pth || fullPath.startsWith(`${pth}/`)) ||
      DELEGATION_DENIED_SUBPATHS.some((re) => re.test(fullPath));
    const allowed =
      !denied &&
      DELEGATION_ALLOWED_PATHS.some((pth) => fullPath === pth || fullPath.startsWith(`${pth}/`));
    if (!allowed) {
      return res
        .status(403)
        .json(err('FORBIDDEN', 'This resource is not available to delegated agents', req.requestId ?? ulid()));
    }
    let delegationSecret: string;
    try {
      delegationSecret = getDelegationSecret();
    } catch {
      return res
        .status(401)
        .json(err('INVALID_TOKEN', 'Invalid or expired delegation token', req.requestId ?? ulid()));
    }
    const dClaims = verifyDelegationToken(
      delegationHeader.slice('Delegation '.length),
      delegationSecret,
      { prefix: FULKRUMA_DELEGATION_PREFIX },
    );
    if (!dClaims) {
      return res
        .status(401)
        .json(err('INVALID_TOKEN', 'Invalid or expired delegation token', req.requestId ?? ulid()));
    }
    if (!dClaims.writes && req.method !== 'GET' && req.method !== 'HEAD') {
      return res
        .status(403)
        .json(
          err(
            'FORBIDDEN',
            'This assistant proposes changes for your approval — it cannot write directly',
            req.requestId ?? ulid(),
          ),
        );
    }
    req.auth = {
      sub: dClaims.sub,
      accountId: dClaims.workspaceId,
      email: dClaims.email,
      name: dClaims.name,
      scope: '',
      iss: issuer,
      aud: audience,
      exp: dClaims.exp,
      iat: dClaims.iat,
    } as unknown as ForjioClaims;
    return next();
  }

  // ─ Path 2: HMAC Authorization header (SDK / Storlaunch / partner)
  const authHeader = req.headers.authorization ?? '';
  if (authHeader.startsWith('Fulkruma-HMAC-SHA256 ')) {
    return hmacAuth(req, res, next);
  }

  // ─ Path 3: bearer JWT
  const token = authHeader.replace(/^Bearer /i, '');
  if (!token || token === authHeader) {
    return res.status(401).json(err('AUTH_REQUIRED', 'Missing Authorization header', req.requestId ?? ulid()));
  }
  try {
    const claims = await verifyAccessToken(token, { issuer, audience });
    // In single-user fulkruma, accountId == huudis sub. If the token
    // doesn't carry accountId, derive it.
    if (!claims.accountId && claims.sub) {
      (claims as { accountId?: string }).accountId = claims.sub;
    }
    req.auth = claims;
    return next();
  } catch (e) {
    const authErr = e instanceof AuthError ? e : new AuthError('INVALID_TOKEN', 'verification failed');
    return res.status(401).json(err(authErr.code, authErr.message, req.requestId ?? ulid()));
  }
}

/** Attaches a requestId to every request for logging + the API envelope. */
export function requestId(req: Request, _res: Response, next: NextFunction) {
  req.requestId = `req_${ulid()}`;
  next();
}
