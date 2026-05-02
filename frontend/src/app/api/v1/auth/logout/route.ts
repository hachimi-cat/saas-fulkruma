import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/server/session';
import { config } from '@/lib/server/config';

export async function POST() {
  await clearSession();
  const params = new URLSearchParams({
    post_logout_redirect_uri: `${config.portal.url()}/login`,
  });
  return NextResponse.json({
    ok: true,
    endSessionUrl: `${config.huudis.issuer()}/api/v1/oidc/end-session?${params.toString()}`,
  });
}
