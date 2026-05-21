import { NextRequest } from 'next/server';

// BFF migration (F-AUTH): same-origin data proxy to the Fulkruma
// backend. The backend is the BFF — it owns auth. This proxy just
// forwards the browser's request, *including the fulkruma_session
// cookie*, to the backend, which resolves it via requireAuth Path 0.
// (Previously this injected an internal secret + X-Fulkruma-Account-Id
// derived from a frontend-held session — that session now lives in the
// backend.)

const BACKEND = process.env.FULKRUMA_API_URL ?? 'http://localhost:4140';

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  const joined = path.join('/');
  const url = new URL(req.url);
  const upstream = `${BACKEND}/api/v1/${joined}${url.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // Keep `cookie` — that is how the backend authenticates the user.
    if (lower === 'host' || lower === 'content-length' || lower === 'connection') return;
    headers.set(key, value);
  });

  const init: RequestInit = { method: req.method, headers, redirect: 'manual' };
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
