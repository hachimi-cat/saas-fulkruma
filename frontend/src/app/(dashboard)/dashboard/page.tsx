import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Fulkruma';

export default async function DashboardPage() {
  // Auth gate — the actual session cookie is set in /callback after OIDC
  // code exchange. Until Huudis is live (M1), this redirect short-circuits
  // to a placeholder. Replace with real huudis redirect once M1 is live.
  const jar = await cookies();
  const signedIn = jar.get('forjio_session');

  if (!signedIn) {
    const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER ?? 'https://huudis.com';
    const client = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID ?? 'fulkruma';
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/callback`;
    const authorize = new URL(`${issuer}/authorize`);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('client_id', client);
    authorize.searchParams.set('redirect_uri', redirectUri);
    authorize.searchParams.set('scope', `openid profile email ${client}:admin`);
    redirect(authorize.toString());
  }

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>{brand} Dashboard</h1>
        <p style={{ color: 'var(--muted)' }}>
          Empty shell — each product fills this with its own sections.
        </p>
      </header>
      <div
        style={{
          border: '1px dashed var(--border)',
          borderRadius: 12,
          padding: 48,
          color: 'var(--muted)',
          textAlign: 'center',
        }}
      >
        No content yet. Add your product surface in{' '}
        <code>src/app/(dashboard)/dashboard/</code>.
      </div>
    </main>
  );
}
