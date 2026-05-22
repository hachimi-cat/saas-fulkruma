import { Suspense } from 'react';
import Link from 'next/link';
import { fetchSocialProviders } from '@forjio/auth-ui';
import { LogoMark } from '@/components/brand/logo';
import { RoleAuthForm } from '@/components/auth/role-auth-form';

// Server Component: resolve which social providers Huudis has
// configured at render time, so the SSR HTML ships with the correct
// button set.
//
// The admin portal is internal staff tooling — there is no marketing
// surface for it, so unlike the merchant login page this renders a
// self-contained centered card rather than wrapping in the marketing
// chrome. Access is gated by the backend `gate` (Fulkruma-Huudis-
// workspace membership): a non-admin who signs in here is rejected at
// session-mint time.
export default async function AdminLoginPage() {
  const providers = await fetchSocialProviders(
    process.env.NEXT_PUBLIC_HUUDIS_ISSUER || 'https://huudis.com',
  );
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/30 px-4 py-16 md:py-24">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/admin/login" className="inline-flex">
            <LogoMark size={36} />
          </Link>
          <span className="mt-4 block font-mono text-[11px] uppercase tracking-[0.2em] text-brand-700">
            Admin portal
          </span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to the Fulkruma admin console
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <Suspense fallback={null}>
            <RoleAuthForm mode="login" role="admin" providers={providers} />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Internal staff only. Auth runs through{' '}
          <a className="underline hover:text-foreground" href="https://huudis.com">
            Huudis
          </a>
          .
        </p>
      </div>
    </div>
  );
}
