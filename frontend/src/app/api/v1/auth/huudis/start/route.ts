import { NextResponse, type NextRequest } from 'next/server';
import {
  generateCodeVerifier,
  codeChallengeFor,
  generateState,
  buildAuthorizeUrl,
} from '@/lib/server/huudis';
import { writePkce } from '@/lib/server/session';

export async function GET(req: NextRequest) {
  const verifier = generateCodeVerifier();
  const state = generateState();
  await writePkce({ verifier, state, iat: Date.now() });
  const provider = req.nextUrl.searchParams.get('provider');
  const idpHint =
    provider === 'google' || provider === 'apple' ? provider : undefined;
  const url = buildAuthorizeUrl({
    state,
    codeChallenge: codeChallengeFor(verifier),
    idpHint,
  });
  return NextResponse.redirect(url, { status: 302 });
}
