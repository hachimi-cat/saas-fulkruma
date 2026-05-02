import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { config } from './config';

export interface SessionPayload {
  huudisAccessToken: string;
  huudisRefreshToken: string;
  huudisUserId: string;
  iat: number;
  accessExpAt: number;
}

const ENC = 'base64url';

function sign(value: string, key: Buffer): string {
  return crypto.createHmac('sha256', key).update(value).digest(ENC);
}

function constantTimeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function hmacKey(): Buffer {
  return Buffer.from(config.session.cookieSecret(), 'hex');
}

export function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString(ENC);
  const sig = sign(body, hmacKey());
  return `${body}.${sig}`;
}

export function decodeSession(raw: string | undefined | null): SessionPayload | null {
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = sign(body, hmacKey());
  if (!constantTimeEq(sig, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, ENC).toString('utf8')) as SessionPayload;
  } catch {
    return null;
  }
}

export async function readSession(): Promise<SessionPayload | null> {
  const c = await cookies();
  const raw = c.get(config.session.cookieName)?.value;
  return decodeSession(raw);
}

export async function writeSession(payload: SessionPayload): Promise<void> {
  const c = await cookies();
  c.set({
    name: config.session.cookieName,
    value: encodeSession(payload),
    httpOnly: true,
    secure: config.session.secure(),
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(config.session.refreshTtlMs / 1000),
  });
}

export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.set({
    name: config.session.cookieName,
    value: '',
    httpOnly: true,
    secure: config.session.secure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

const PKCE_COOKIE = 'fulkruma_oidc_pkce';

export interface PkcePayload {
  verifier: string;
  state: string;
  iat: number;
}

export async function writePkce(payload: PkcePayload): Promise<void> {
  const body = Buffer.from(JSON.stringify(payload)).toString(ENC);
  const sig = sign(body, hmacKey());
  const c = await cookies();
  c.set({
    name: PKCE_COOKIE,
    value: `${body}.${sig}`,
    httpOnly: true,
    secure: config.session.secure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  });
}

export async function readPkce(): Promise<PkcePayload | null> {
  const c = await cookies();
  const raw = c.get(PKCE_COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = sign(body, hmacKey());
  if (!constantTimeEq(sig, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, ENC).toString('utf8')) as PkcePayload;
  } catch {
    return null;
  }
}

export async function clearPkce(): Promise<void> {
  const c = await cookies();
  c.set({
    name: PKCE_COOKIE,
    value: '',
    httpOnly: true,
    secure: config.session.secure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
