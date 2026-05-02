import { Suspense } from 'react';
import Link from 'next/link';
import { LogoMark } from '@/components/brand/logo';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex">
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
  );
}
