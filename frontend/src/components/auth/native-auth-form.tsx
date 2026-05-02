'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';

export function NativeAuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params?.get('return_to') || '/dashboard';
  const ssoError = params?.get('sso_error');
  const ssoDetail = params?.get('sso_detail');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    ssoError ? `Sign-in failed: ${ssoDetail || ssoError}` : null,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const path = mode === 'signup' ? '/api/v1/auth/signup' : '/api/v1/auth/login';
      const body: Record<string, unknown> = { email, password };
      if (mode === 'signup' && name.trim()) body.name = name.trim();
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message ?? `Request failed (${res.status})`);
      }
      router.push(returnTo);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const otherMode = mode === 'login' ? 'signup' : 'login';
  const otherHref = `/${otherMode}?return_to=${encodeURIComponent(returnTo)}`;
  const socialUrl = (provider: 'google' | 'apple') =>
    `/api/v1/auth/huudis/start?provider=${provider}&return_to=${encodeURIComponent(returnTo)}`;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-2">
        <a
          href={socialUrl('google')}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background py-2 text-sm font-medium hover:bg-accent transition"
        >
          <GoogleMark className="h-4 w-4" />
          Continue with Google
        </a>
        <a
          href={socialUrl('apple')}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background py-2 text-sm font-medium hover:bg-accent transition"
        >
          <AppleMark className="h-4 w-4" />
          Continue with Apple
        </a>
      </div>

      <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
        <div className="flex-1 border-t border-border" />
        OR
        <div className="flex-1 border-t border-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === 'signup' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Your name <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-medium text-muted-foreground">Password</label>
            {mode === 'login' && (
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <input
            type="password"
            required
            minLength={mode === 'signup' ? 10 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {mode === 'signup' && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              At least 10 characters.
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-brand-600 transition disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
        <Link href={otherHref} className="font-medium text-foreground hover:underline">
          {mode === 'login' ? 'Sign up' : 'Sign in'}
        </Link>
      </p>
    </div>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 7.1 29.4 5 24 5 16.3 5 9.6 9.4 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.6 5.1C9.5 39.4 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.3 5.2C40.6 35.3 44 30 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.404 2.262-1.144 3.083-.76.846-1.965 1.483-3.144 1.405-.135-1.142.42-2.314 1.13-3.122.79-.916 2.103-1.585 3.158-1.366zM18.95 17.83c-.32.738-.484 1.07-.9 1.722-.578.91-1.394 2.038-2.404 2.046-.9.008-1.13-.586-2.355-.582-1.225.005-1.477.594-2.376.587-1.01-.008-1.78-1.027-2.36-1.937-1.62-2.546-1.79-5.532-.79-7.117.71-1.121 1.83-1.78 2.88-1.78 1.07 0 1.74.586 2.62.586.85 0 1.37-.587 2.61-.587.93 0 1.92.508 2.62 1.385-2.3 1.262-1.93 4.55.45 5.677z" />
    </svg>
  );
}
