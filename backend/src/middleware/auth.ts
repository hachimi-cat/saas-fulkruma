import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AuthError, type ForjioClaims } from '@forjio/sdk/auth';
import { err } from '@forjio/sdk/http';
import { ulid } from 'ulid';
import crypto from 'node:crypto';

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

  // ─ Path 2: bearer JWT
  const token = req.headers.authorization?.replace(/^Bearer /i, '');
  if (!token) {
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
