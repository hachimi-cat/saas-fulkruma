import { NextResponse } from 'next/server';
import { config } from '@/lib/server/config';

interface RequestBody {
  email?: string;
}

// Proxy to Huudis password-reset request — Huudis owns identity, so
// we just forward and let it send the email. Returns 200 either way
// to avoid leaking which emails are registered.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as RequestBody | null;
  if (!body?.email) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'email is required' } },
      { status: 400 },
    );
  }

  try {
    await fetch(`${config.huudis.issuer()}/api/v1/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: body.email.toLowerCase().trim(),
        // Tell Huudis where to send the user back after reset.
        return_to: `${config.portal.url()}/login`,
      }),
    });
  } catch (err) {
    // Soft-fail — still return ok to keep email enumeration impossible.
    console.error('[password-reset/request] upstream error', err);
  }

  return NextResponse.json({ ok: true });
}
