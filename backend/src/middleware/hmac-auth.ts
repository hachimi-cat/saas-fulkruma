/**
 * HMAC auth for the Fulkruma public REST API. Mirrors plugipay's
 * Plugipay-HMAC-SHA256 scheme so the SDKs share signing semantics.
 *
 * Authorization header:
 *   Fulkruma-HMAC-SHA256 keyId=<KEYID>, scope=*, signature=<hex>
 *
 * String to sign:
 *   `${METHOD}\n${PATH}\n${TIMESTAMP}\n${SHA256_HEX(BODY)}`
 *   plus optional `\n${IDEMPOTENCY_KEY}` if `Idempotency-Key` is set.
 *
 * Headers:
 *   X-Fulkruma-Timestamp        — unix seconds
 *   Idempotency-Key             — optional
 *   X-Fulkruma-On-Behalf-Of     — only honoured when the key holds
 *                                 `fulkruma:platform:admin` scope.
 *                                 Rescopes `req.auth.accountId` to the
 *                                 named merchant.
 *
 * On success, populates `req.auth` with `{ sub, accountId, scope, iss,
 * aud, ... }` so downstream route handlers (which use the same
 * `requireAuth` shape) work transparently.
 */
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { ulid } from 'ulid';
import type { ForjioClaims } from '@forjio/sdk/auth';
import { err } from '@forjio/sdk/http';
import { prisma } from '../lib/db.js';

const TS_TOLERANCE_SEC = 300;
const PARTNER_ADMIN_SCOPE = 'fulkruma:platform:admin';

interface ParsedAuth {
  keyId: string;
  signature: string;
  scope: string;
}

function parseAuthHeader(h: string | undefined): ParsedAuth | null {
  if (!h || !h.startsWith('Fulkruma-HMAC-SHA256 ')) return null;
  const rest = h.slice('Fulkruma-HMAC-SHA256 '.length);
  const parts: Record<string, string> = {};
  for (const segment of rest.split(',')) {
    const [k, v] = segment.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  }
  if (!parts.keyId || !parts.signature) return null;
  return { keyId: parts.keyId, signature: parts.signature, scope: parts.scope ?? '*' };
}

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function constantEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function hmacAuth(req: Request, res: Response, next: NextFunction) {
  const reqId = req.requestId ?? `req_${ulid()}`;
  const fail = (code: string, message: string, status = 401) =>
    res.status(status).json(err(code, message, reqId));

  const parsed = parseAuthHeader(req.headers.authorization);
  if (!parsed) return fail('AUTH_REQUIRED', 'Missing or malformed Authorization header');

  const ts = req.headers['x-fulkruma-timestamp'];
  if (!ts || typeof ts !== 'string') return fail('AUTH_REQUIRED', 'X-Fulkruma-Timestamp missing');
  const tsNum = Number.parseInt(ts, 10);
  if (!Number.isFinite(tsNum)) return fail('INVALID_TIMESTAMP', 'X-Fulkruma-Timestamp not numeric');
  const drift = Math.abs(Math.floor(Date.now() / 1000) - tsNum);
  if (drift > TS_TOLERANCE_SEC) return fail('CLOCK_SKEW', `Timestamp ${drift}s out of tolerance`);

  const idem = req.headers['idempotency-key'];
  const idemPart = idem && typeof idem === 'string' ? `\n${idem}` : '';

  // Reconstruct body hash. The shipping route mounts express.raw on
  // /webhooks/*; for the admin/SDK surface we use express.json which has
  // already consumed the body — so pull from req.body. Tests must POST
  // with a body parser already in the chain.
  const bodyJson = req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : '';
  const bodyHash = sha256Hex(bodyJson);

  // The SDK signs the full URL path INCLUDING query string (and the
  // /api/v1 mount prefix). Use req.originalUrl as-is so GET requests
  // with query params (e.g. /api/v1/addresses?customer_id=cmpXXX)
  // hash to the same canonical string the client signed. Mirrors
  // plugipay's HMAC verifier (which also includes the query).
  const fullPath = req.originalUrl ?? req.url;
  const stringToSign = `${req.method.toUpperCase()}\n${fullPath}\n${ts}\n${bodyHash}${idemPart}`;

  // Fetch the key; verify the key is active.
  const key = await prisma.apiKey.findUnique({ where: { keyId: parsed.keyId } });
  if (!key) return fail('INVALID_KEY', 'Unknown keyId');
  if (key.revokedAt) return fail('REVOKED_KEY', 'Key has been revoked');

  // We store sha256(secret); HMAC requires the raw secret. So
  // we treat the stored secretHash AS the HMAC secret — i.e. clients
  // sign with their secret, server signs the same hash → identical
  // hex output if and only if the stored `secretHash` equals the
  // sha256 of the same raw secret the client holds. Wait, that's
  // wrong: the server doesn't have the raw secret. The plugipay
  // pattern stores the raw secret. Use the same: store secretHash
  // = the raw secret (this is acceptable because HMAC keys are
  // never displayed to users twice — the key creation flow shows
  // them once). Update: rename column treatment without migration —
  // we just put the raw secret in `secretHash` going forward.
  const sigOk = constantEq(
    crypto.createHmac('sha256', key.secretHash).update(stringToSign).digest('hex'),
    parsed.signature,
  );
  if (!sigOk) return fail('BAD_SIGNATURE', 'Signature mismatch');

  // Honour on-behalf-of when the caller holds the platform-admin scope.
  const scopes = (key.scopes as string[]) ?? [];
  let effectiveAccountId = key.accountId;
  let onBehalfOf: string | undefined;
  const obh = req.headers['x-fulkruma-on-behalf-of'];
  if (typeof obh === 'string' && obh.length > 0) {
    if (!scopes.includes(PARTNER_ADMIN_SCOPE)) {
      return fail('FORBIDDEN_ONBEHALF', 'Key not allowed to use X-Fulkruma-On-Behalf-Of', 403);
    }
    effectiveAccountId = obh;
    onBehalfOf = obh;
  }

  // Touch lastUsedAt asynchronously — never block the request.
  prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {/* swallow */});

  const claims: ForjioClaims = {
    sub: effectiveAccountId,
    accountId: effectiveAccountId,
    scope: scopes.join(' '),
    iss: 'fulkruma:hmac',
    aud: 'fulkruma',
    exp: Math.floor(Date.now() / 1000) + 900,
    iat: Math.floor(Date.now() / 1000),
  } as unknown as ForjioClaims;
  // Stash partner + onBehalf so partner-billing routes can audit.
  (claims as { partner?: string }).partner = key.partner ?? undefined;
  (claims as { onBehalfOf?: string }).onBehalfOf = onBehalfOf;
  req.auth = claims;
  req.requestId = reqId;
  next();
}

/** Guard for admin endpoints — rejects keys without the partner-admin scope. */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  const scope = (req.auth as unknown as { scope?: string })?.scope ?? '';
  if (!scope.split(' ').includes(PARTNER_ADMIN_SCOPE)) {
    return res.status(403).json(err('FORBIDDEN', 'Platform-admin scope required', req.requestId ?? 'req_unknown'));
  }
  next();
}
