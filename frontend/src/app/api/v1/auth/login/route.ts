import { NextResponse } from 'next/server';
import { config } from '@/lib/server/config';
import { decodeIdToken } from '@/lib/server/huudis';
import { writeSession } from '@/lib/server/session';

interface LoginBody {
  email?: string;
  password?: string;
}

interface HuudisTokens {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
}

// Native email+password login — mirrors plugipay/storlaunch/linksnap.
// Form POSTs here, we hit Huudis ROPC server-side with the fulkruma
// client_secret, enforce the single-user gate, set fulkruma_session.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as LoginBody | null;
  if (!body?.email || !body.password) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'email and password are required' } },
      { status: 400 },
    );
  }

  const form = new URLSearchParams({
    grant_type: 'password',
    client_id: config.huudis.clientId(),
    client_secret: config.huudis.clientSecret(),
    username: body.email.toLowerCase().trim(),
    password: body.password,
    scope: 'openid profile email fulkruma:admin',
  });

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
    } catch {
      // ignore — fall through
    }
    if (detail.toLowerCase().includes('mfa_required')) {
      return NextResponse.json(
        { error: { code: 'MFA_REQUIRED', message: 'MFA is required — sign in via Huudis directly.' } },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: { code: 'INVALID_CREDENTIALS', message: detail || 'Incorrect email or password' } },
      { status: 401 },
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
      name: claims.name ?? null,
    },
  });
}
