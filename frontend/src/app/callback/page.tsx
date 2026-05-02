'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const upstreamError = searchParams.get('error');

    if (upstreamError) {
      setError(upstreamError);
      return;
    }
    if (!code || !state) {
      setError('missing_code_or_state');
      return;
    }

    fetch('/api/v1/auth/huudis/callback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, state }),
    })
      .then(async (res) => {
        if (res.ok) {
          router.replace('/dashboard');
          return;
        }
        const body = await res.json().catch(() => ({ error: 'unknown' }));
        setError(body.error ?? `status_${res.status}`);
      })
      .catch((err) => setError(String(err)));
  }, [router, searchParams]);

  if (error) {
    return (
      <>
        <h1 className="text-lg font-semibold">Sign-in failed</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <a
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-600 transition"
        >
          Try again
        </a>
      </>
    );
  }
  return (
    <>
      <h1 className="text-lg font-semibold">Finishing sign-in…</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Exchanging your code with Huudis.
      </p>
    </>
  );
}

export default function CallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <CallbackInner />
        </Suspense>
      </div>
    </main>
  );
}
