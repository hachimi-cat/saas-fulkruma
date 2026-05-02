import Link from 'next/link';
import { LogoMark } from '@/components/brand/logo';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex">
          <LogoMark size={36} />
        </Link>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email — we&rsquo;ll send a reset link from Huudis.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
