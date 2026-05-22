import { NextRequest } from 'next/server';
import type { SessionRole } from '@/lib/auth';

// BFF migration (F-AUTH): the same-origin data proxy to the Fulkruma
// backend. The backend is the BFF — it owns auth. A role's proxy route
// forwards the browser's request, *including the role session cookie*,
// to the backend and stamps an authoritative X-Fulkruma-Role header so
// the backend resolves the right role session (requireAuth Path 0).
//
// The merchant surface keeps its own proxy at api/v1/fulkruma/[...path]
// (no role header — single-role legacy path). The admin portal mounts
// `bffProxy('admin')` at api/v1/console/[...path].

const BACKEND = process.env.FULKRUMA_API_URL ?? 'http://localhost:4140';

export function bffProxy(role: SessionRole) {
  return async function handle(
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
      // Drop any client-sent x-fulkruma-role; we stamp it authoritatively.
      if (
        lower === 'host' ||
        lower === 'content-length' ||
        lower === 'connection' ||
        lower === 'x-fulkruma-role'
      )
        return;
      headers.set(key, value);
    });
    headers.set('x-fulkruma-role', role);

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
  };
}
