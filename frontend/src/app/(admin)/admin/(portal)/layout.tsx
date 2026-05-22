'use client';

// Admin portal gate — thin client check via useAuth('admin'). Mirrors
// the merchant (dashboard)/layout.tsx.
//
// The `(portal)` route group wraps the authenticated admin pages
// (/admin/dashboard, /admin/partners) WITHOUT affecting their URLs, so
// the gate sits above all of them while /admin/login,
// /admin/forgot-password and /admin/reset-password stay public.
//
// This is only a UX gate — the security boundary is the backend `gate`
// in auth-config.ts (Fulkruma-Huudis-workspace membership): a non
// owner/admin member can never mint an `admin` session, so even if
// this client check were bypassed the admin APIs would still reject
// them.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AdminShell } from '@/components/layout/admin-shell';

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth('admin');
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/admin/login');
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
    <AdminShell user={{ name: user.name, email: user.email }}>{children}</AdminShell>
  );
}
