import { NextResponse, type NextRequest } from 'next/server';
import { config } from '@/lib/server/config';
import { readSession } from '@/lib/server/session';

// Same-origin proxy from the portal to the Fulkruma backend.
// Reads the HMAC-signed session cookie, looks up the merchant accountId
// (single-user mode: huudis sub === accountId), and forwards the request
// to FULKRUMA_API_URL with the internal trust headers.
//
// Backend `requireAuth` middleware accepts X-Fulkruma-Internal-Secret +
// X-Fulkruma-Account-Id; see backend/src/middleware/auth.ts.

function internalSecret(): string {
  const v = process.env.FULKRUMA_INTERNAL_API_SECRET;
  if (!v) throw new Error('FULKRUMA_INTERNAL_API_SECRET not set');
  return v;
}

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: { code: 'AUTH_REQUIRED' } }, { status: 401 });
  }
  const { path } = await ctx.params;
  const joined = path.join('/');
  const url = new URL(req.url);
  const upstream = `${config.api.url()}/api/v1/${joined}${url.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === 'host' ||
      lower === 'cookie' ||
      lower === 'authorization' ||
      lower === 'content-length' ||
      lower === 'connection'
    ) return;
    headers.set(key, value);
  });
  headers.set('x-fulkruma-internal-secret', internalSecret());
  // The active workspace context — if the client passed X-Account-Id
  // (e.g., the merchant picked a partner-provisioned workspace like
  // a Storlaunch merchant's), use that. Otherwise fall back to the
  // user's own Huudis id which == accountId for single-user fulkruma.
  // Proper session-persisted switcher = S-050 follow-up. For now this
  // lets the dashboard read cirengs's data by setting:
  //   localStorage.setItem('fulkruma_account_id', 'acc_xxx')
  // and reloading. Same primitive Storlaunch uses.
  const overrideAccountId = req.headers.get('x-account-id') ?? undefined;
  headers.set('x-fulkruma-account-id', overrideAccountId || session.huudisUserId);
  headers.set('x-fulkruma-user-id', session.huudisUserId);

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }
  const res = await fetch(upstream, init);

  const outHeaders = new Headers();
  res.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'transfer-encoding' || lower === 'connection') return;
    outHeaders.set(key, value);
  });
  return new Response(res.body, { status: res.status, headers: outHeaders });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
