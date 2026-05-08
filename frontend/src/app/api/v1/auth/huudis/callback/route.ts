import { NextResponse } from 'next/server';
import { config } from '@/lib/server/config';
import { exchangeCode, decodeIdToken } from '@/lib/server/huudis';
import { readPkce, clearPkce, writeSession } from '@/lib/server/session';

interface CallbackBody {
  code?: string;
  state?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CallbackBody | null;
  if (!body?.code || !body.state) {
    return NextResponse.json({ error: 'missing_code_or_state' }, { status: 400 });
  }

  const pkce = await readPkce();
  if (!pkce || pkce.state !== body.state) {
    return NextResponse.json({ error: 'invalid_state' }, { status: 400 });
  }

  let tokens;
  try {
    tokens = await exchangeCode({
      code: body.code,
      codeVerifier: pkce.verifier,
      // Echo the redirect_uri the /authorize call used. Required for
      // dual-host login (fulkruma.com + fulkruma.forjio.com) — Huudis
      // requires identical redirect_uri in /token as in /authorize.
      redirectUri: pkce.redirectUri,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'token_exchange_failed', detail: String(err) },
      { status: 502 },
    );
  }

  if (!tokens.id_token) {
    return NextResponse.json({ error: 'id_token_missing' }, { status: 502 });
  }

  let claims;
  try {
    claims = decodeIdToken(tokens.id_token);
  } catch (err) {
    return NextResponse.json(
      { error: 'id_token_malformed', detail: String(err) },
      { status: 502 },
    );
  }

  // Single-user gate: reject anyone whose huudis sub doesn't match
  // bang's allowed user_id. SaaS multi-tenant lifts this gate later.
  if (!config.huudis.allowedUserIds().includes(claims.sub)) {
    return NextResponse.json({ error: 'not_authorized' }, { status: 403 });
  }

  const accessExpAt = Date.now() + tokens.expires_in * 1000;
  await writeSession({
    huudisAccessToken: tokens.access_token,
    huudisRefreshToken: tokens.refresh_token,
    huudisUserId: claims.sub,
    iat: Date.now(),
    accessExpAt,
  });
  await clearPkce();

  return NextResponse.json({ ok: true });
}
