import { Router, type Request, type Response } from 'express';
import { err } from '@forjio/sdk/http';
import { lookupSession, createSession, SESSION_COOKIE } from '../services/auth-store.js';
import { refreshAccessToken, HUUDIS_ISSUER } from '../services/huudis.js';

// BFF migration (F-AUTH): proxy whitelisted Huudis IAM calls on behalf
// of the signed-in user, using the Huudis token held server-side in the
// session. Refreshes reactively on a 401 and rewrites the session
// cookie. A dead refresh token returns 502 — it does NOT log the user
// out of Fulkruma; the fulkruma_session cookie stays valid so the
// dashboard keeps working.

const router = Router();
const SECURE = process.env.NODE_ENV === 'production';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Whitelisted upstream paths only — never forward arbitrary /api/v1/*.
const ALLOW = [/^\/account(\/.*)?$/, /^\/iam(\/.*)?$/];

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return undefined;
}

async function callHuudis(
  method: string,
  path: string,
  accessToken: string,
  body: unknown,
  query: string,
): Promise<{ status: number; body: unknown }> {
  const init: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  };
  if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${HUUDIS_ISSUER}/api/v1${path}${query}`, init);
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: parsed };
}

function handler(method: string) {
  return async (req: Request, res: Response): Promise<void> => {
    const rid = req.requestId ?? 'req_unknown';
    const session = lookupSession(parseCookie(req.headers.cookie, SESSION_COOKIE));
    if (!session) {
      res.status(401).json(err('UNAUTHORIZED', 'no active session', rid));
      return;
    }
    if (!session.huudisAccessToken) {
      res.status(401).json(err('NO_HUUDIS_TOKEN', 'no Huudis token on session', rid));
      return;
    }
    const sub = req.url.split('?')[0] ?? '';
    if (!ALLOW.some((r) => r.test(sub))) {
      res.status(403).json(err('FORBIDDEN', 'path not proxied', rid));
      return;
    }
    const qIdx = req.url.indexOf('?');
    const query = qIdx >= 0 ? req.url.slice(qIdx) : '';

    let out = await callHuudis(method, sub, session.huudisAccessToken, req.body, query);

    // 401 ⇒ the 15-min access token has almost certainly expired. Try
    // one refresh (single-flighted in services/huudis.ts), persist the
    // rotated tokens back to the cookie, and retry once.
    if (out.status === 401 && session.huudisRefreshToken) {
      try {
        const refreshed = await refreshAccessToken(session.huudisRefreshToken);
        const token = createSession({
          name: session.name,
          email: session.email,
          huudisSub: session.huudisSub,
          huudisAccessToken: refreshed.access_token,
          huudisRefreshToken: refreshed.refresh_token ?? session.huudisRefreshToken,
          accountIds: session.accountIds,
        });
        res.cookie(SESSION_COOKIE, token, {
          httpOnly: true,
          secure: SECURE,
          sameSite: 'lax',
          maxAge: SESSION_TTL_MS,
          path: '/',
        });
        out = await callHuudis(method, sub, refreshed.access_token, req.body, query);
      } catch {
        res
          .status(502)
          .json(
            err('HUUDIS_UNREACHABLE', 'Huudis session could not be refreshed; sign out and back in.', rid),
          );
        return;
      }
    }
    res.status(out.status).json(out.body);
  };
}

router.get('*', handler('GET'));
router.post('*', handler('POST'));
router.patch('*', handler('PATCH'));
router.delete('*', handler('DELETE'));

export default router;
