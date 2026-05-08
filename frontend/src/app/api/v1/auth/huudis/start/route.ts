import { NextResponse, type NextRequest } from 'next/server';
import {
  generateCodeVerifier,
  codeChallengeFor,
  generateState,
  buildAuthorizeUrl,
} from '@/lib/server/huudis';
import { writePkce } from '@/lib/server/session';

// Derive redirect_uri from inbound request host so login works on both
// fulkruma.com and fulkruma.forjio.com without losing the OIDC state
// cookie across hosts (env-pinned redirect_uri would break the
// non-canonical host).
function originOf(req: NextRequest): string {
  const proto =
    req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    req.nextUrl.protocol.replace(':', '') ||
    'https';
  const host =
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    req.headers.get('host') ||
    req.nextUrl.host;
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const verifier = generateCodeVerifier();
  const state = generateState();
  const redirectUri = `${originOf(req)}/callback`;
  await writePkce({ verifier, state, iat: Date.now(), redirectUri });
  const provider = req.nextUrl.searchParams.get('provider');
  const idpHint =
    provider === 'google' || provider === 'apple' ? provider : undefined;
  const url = buildAuthorizeUrl({
    state,
    codeChallenge: codeChallengeFor(verifier),
    idpHint,
    redirectUri,
  });
  return NextResponse.redirect(url, { status: 302 });
}
