import { Suspense } from 'react';
import Link from 'next/link';
import { LogoMark } from '@/components/brand/logo';
import { ResetPasswordForm } from '@forjio/auth-ui';

// Admin reset-password — mirrors (auth)/reset-password/page.tsx.
// `ResetPasswordForm` reads the `?token=` search param from the Huudis
// reset email and posts to the auth-ui default endpoint
// (/api/v1/auth/reset-password) mounted by `createAuthRouter`, which
// proxies to Huudis. Role-agnostic — wrapped in Suspense because the
// form reads search params.
export default function AdminResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/30 px-4 py-16 md:py-24">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/admin/login" className="inline-flex">
            <LogoMark size={36} />
          </Link>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick something you&rsquo;ll remember — we won&rsquo;t email it back.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
