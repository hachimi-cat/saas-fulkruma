import { NextResponse } from 'next/server';
import { readSession, writeSession } from '@/lib/server/session';
import { fetchAccount, refreshAccessToken } from '@/lib/server/huudis';

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  let accessToken = session.huudisAccessToken;
  if (Date.now() > session.accessExpAt - 60_000) {
    try {
      const refreshed = await refreshAccessToken(session.huudisRefreshToken);
      const accessExpAt = Date.now() + refreshed.expires_in * 1000;
      accessToken = refreshed.access_token;
      await writeSession({
        ...session,
        huudisAccessToken: refreshed.access_token,
        huudisRefreshToken: refreshed.refresh_token ?? session.huudisRefreshToken,
        accessExpAt,
      });
    } catch {
      return NextResponse.json({ user: null, error: 'refresh_failed' }, { status: 401 });
    }
  }

  let account;
  try {
    account = await fetchAccount(accessToken);
  } catch {
    return NextResponse.json({ user: null, error: 'account_fetch_failed' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: account.id,
      name: account.name,
      email: account.email,
      huudisUserId: session.huudisUserId,
    },
  });
}
