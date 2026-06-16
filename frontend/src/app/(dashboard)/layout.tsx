'use client';

// BFF migration (F-AUTH): the dashboard gate is now a thin client
// check via useAuth → /api/v1/auth/me.
//
// The old layout was a server component that called Huudis /account on
// every navigation with the raw cookie token and redirect('/login')'d
// on ANY failure — so a stale 15-minute access token forced a logout.
// The backend BFF now holds + refreshes the Huudis tokens; this layout
// just reflects the session state and never hard-bounces on a
// transient upstream hiccup.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { DashboardShell } from '@/components/layout/shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <DashboardShell user={{ name: user.name, email: user.email }}>
      {children}
      <Script
        src="https://suppuo.com/widget.js"
        data-suppuo-account="acc_01KPHFWPES4T3T0XSM9MT6ZJYV"
        strategy="afterInteractive"
      />
    </DashboardShell>
  );
}
