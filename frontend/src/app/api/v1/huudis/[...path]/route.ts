import { NextResponse, type NextRequest } from 'next/server';
import { config } from '@/lib/server/config';
import { readSession, writeSession } from '@/lib/server/session';
import { refreshAccessToken } from '@/lib/server/huudis';

async function callUpstream(
  path: string,
  search: string,
  req: NextRequest,
  accessToken: string,
): Promise<Response> {
  const upstream = `${config.huudis.issuer()}/api/v1/${path}${search}`;
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
  headers.set('authorization', `Bearer ${accessToken}`);

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }
  return fetch(upstream, init);
}

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const search = url.search;
  const joined = path.join('/');

  let res = await callUpstream(joined, search, req, session.huudisAccessToken);
  if (res.status === 401) {
    try {
      const refreshed = await refreshAccessToken(session.huudisRefreshToken);
      const accessExpAt = Date.now() + refreshed.expires_in * 1000;
      await writeSession({
        ...session,
        huudisAccessToken: refreshed.access_token,
        huudisRefreshToken: refreshed.refresh_token ?? session.huudisRefreshToken,
        accessExpAt,
      });
      res = await callUpstream(joined, search, req, refreshed.access_token);
    } catch {
      return NextResponse.json({ error: 'session_expired' }, { status: 401 });
    }
  }

  const outHeaders = new Headers();
  res.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'transfer-encoding' || lower === 'connection') return;
    outHeaders.set(key, value);
  });
  return new Response(res.body, {
    status: res.status,
    headers: outHeaders,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
