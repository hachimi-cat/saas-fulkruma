import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      <Link href="/" className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold"
        >
          F
        </span>
        <span className="text-base font-semibold tracking-tight">Fulkruma</span>
      </Link>

      <h1 className="mt-6 text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fulkruma uses Huudis for authentication. You'll be redirected to sign in.
      </p>

      <a
        href="/api/v1/auth/huudis/start"
        className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-brand-600 transition"
      >
        Continue with Huudis <ArrowRight size={14} />
      </a>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Don't have an account?{' '}
        <a href="https://huudis.com/signup?return_to=https://fulkruma.com/login" className="font-medium text-foreground hover:underline">
          Create one on Huudis
        </a>
      </p>
    </div>
  );
}
