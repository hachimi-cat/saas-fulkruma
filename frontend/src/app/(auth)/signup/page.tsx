import { Suspense } from 'react';
import Link from 'next/link';
import { LogoMark } from '@/components/brand/logo';
import { NativeAuthForm } from '@/components/auth/native-auth-form';

export default function SignupPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex">
          <LogoMark size={36} />
        </Link>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Get stock and shipping running in an afternoon.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <Suspense fallback={null}>
          <NativeAuthForm mode="signup" />
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
