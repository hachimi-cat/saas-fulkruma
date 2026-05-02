import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AuthError, type ForjioClaims } from '@forjio/sdk/auth';
import { err } from '@forjio/sdk/http';
import { ulid } from 'ulid';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: ForjioClaims;
    requestId?: string;
  }
}

const issuer = process.env.HUUDIS_ISSUER ?? 'https://huudis.com';
const audience = process.env.HUUDIS_AUDIENCE ?? process.env.FORJIO_SERVICE ?? 'fulkruma';

/** Extracts `Authorization: Bearer <jwt>` and verifies via @forjio/sdk.
 *  Attaches claims to `req.auth`. Rejects with a standard envelope on
 *  failure. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /i, '');
  if (!token) {
    return res.status(401).json(err('AUTH_REQUIRED', 'Missing Authorization header', req.requestId ?? ulid()));
  }
  try {
    req.auth = await verifyAccessToken(token, { issuer, audience });
    next();
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
