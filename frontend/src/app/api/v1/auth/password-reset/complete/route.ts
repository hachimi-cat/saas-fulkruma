import { NextResponse } from 'next/server';
import { config } from '@/lib/server/config';

interface CompleteBody {
  token?: string;
  password?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CompleteBody | null;
  if (!body?.token || !body.password) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'token and password are required' } },
      { status: 400 },
    );
  }
  if (body.password.length < 10) {
    return NextResponse.json(
      { error: { code: 'WEAK_PASSWORD', message: 'password must be at least 10 characters' } },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${config.huudis.issuer()}/api/v1/auth/password-reset/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: body.token, password: body.password }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'UPSTREAM_ERROR', message: String(err) } },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    let detail: string = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.error?.message || parsed.error_description || parsed.error || text;
    } catch { /* ignore */ }
    return NextResponse.json(
      { error: { code: 'RESET_FAILED', message: detail || 'reset failed' } },
      { status: upstream.status },
    );
  }

  return NextResponse.json({ ok: true });
}
