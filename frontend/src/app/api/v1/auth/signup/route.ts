import { NextResponse } from 'next/server';
import { config } from '@/lib/server/config';
import { decodeIdToken } from '@/lib/server/huudis';
import { writeSession } from '@/lib/server/session';

interface SignupBody {
  email?: string;
  password?: string;
  name?: string;
}

interface HuudisTokens {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
}

// Signup-direct via Huudis ROPC-style grant (mirrors plugipay).
// Issues an access + refresh token immediately so the user lands
// signed-in on /dashboard.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SignupBody | null;
  if (!body?.email || !body.password) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'email and password are required' } },
      { status: 400 },
    );
  }
  if (body.password.length < 10) {
    return NextResponse.json(
      { error: { code: 'WEAK_PASSWORD', message: 'password must be at least 10 characters' } },
      { status: 400 },
    );
  }

  const form = new URLSearchParams({
    grant_type: 'urn:forjio:grant-type:signup',
    client_id: config.huudis.clientId(),
    client_secret: config.huudis.clientSecret(),
    email: body.email.toLowerCase().trim(),
    password: body.password,
    scope: 'openid profile email fulkruma:admin',
  });
  if (body.name?.trim()) form.set('name', body.name.trim());

  let upstream: Response;
  try {
    upstream = await fetch(`${config.huudis.issuer()}/api/v1/oidc/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
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
      detail = parsed.error_description || parsed.error || text;
    } catch { /* ignore */ }
    return NextResponse.json(
      { error: { code: 'SIGNUP_FAILED', message: detail || 'could not create account' } },
      { status: 400 },
    );
  }

  let tokens: HuudisTokens;
  try {
    tokens = JSON.parse(text);
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'INVALID_RESPONSE', message: String(err) } },
      { status: 502 },
    );
  }

  if (!tokens.id_token) {
    return NextResponse.json(
      { error: { code: 'NO_ID_TOKEN', message: 'Huudis did not return an id_token' } },
      { status: 502 },
    );
  }

  let claims;
  try {
    claims = decodeIdToken(tokens.id_token);
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'MALFORMED_ID_TOKEN', message: String(err) } },
      { status: 502 },
    );
  }

  // Single-user gate also applies to signup — a signed-up user that
  // isn't bang gets a 403. Saas mode lifts this gate.
  if (!config.huudis.allowedUserIds().includes(claims.sub)) {
    return NextResponse.json(
      { error: { code: 'NOT_AUTHORIZED', message: 'Access is restricted.' } },
      { status: 403 },
    );
  }

  await writeSession({
    huudisAccessToken: tokens.access_token,
    huudisRefreshToken: tokens.refresh_token,
    huudisUserId: claims.sub,
    iat: Date.now(),
    accessExpAt: Date.now() + tokens.expires_in * 1000,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: claims.sub,
      email: claims.email ?? body.email,
      name: claims.name ?? body.name ?? null,
    },
  });
}
