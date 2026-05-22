import { Suspense } from 'react';
import Link from 'next/link';
import { AuthForm, fetchSocialProviders } from '@forjio/auth-ui';
import { LogoMark } from '@/components/brand/logo';

// Server Component: resolve which social providers Huudis has configured
// at render time, so the SSR HTML ships with the correct button set —
// no client-fetch flash of disabled providers.
export default async function LoginPage() {
  const providers = await fetchSocialProviders(
    process.env.NEXT_PUBLIC_HUUDIS_ISSUER || 'https://huudis.com',
  );
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex">
          <LogoMark size={36} />
        </Link>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your Fulkruma account</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <Suspense fallback={null}>
          <AuthForm mode="login" brand="Fulkruma" providers={providers} />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Auth runs through{' '}
        <a className="underline hover:text-foreground" href="https://huudis.com">
          Huudis
        </a>{' '}
        — same account works across the Forjio family.
      </p>
    </div>
  );
}
